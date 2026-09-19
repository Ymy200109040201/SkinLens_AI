import type { ChatRequestPayload, ChatResponsePayload, SkinGoal } from "../domain/types";
import {
  INGREDIENT_CATEGORY_LABELS,
  SKIN_GOAL_LABELS,
} from "../domain/labels";
import { getIngredientById, normalizeKey } from "../ingredients/lookup";
import { getAiConfig } from "./config";
import { callLlmText } from "./provider";
import { CHAT_SYSTEM_PROMPT, describeProfile } from "./prompts";

/**
 * 上下文感知的产品问答
 *
 * 每次提问都会自动携带：当前产品、完整成分、用户画像、已有分析结论。
 * 未配置 AI Key 时使用本地检索式回答，保证 Demo 流程完整可用。
 */

interface ResolvedChatIngredient {
  raw: string;
  ingredientId: string | null;
  displayName: string;
  chineseName: string;
  inciName: string;
  categoryLabel: string;
  functions: string[];
  notes: string;
  allergen: boolean;
  irritation: boolean;
}

function resolveChatIngredients(payload: ChatRequestPayload): ResolvedChatIngredient[] {
  return payload.product.ingredients.map((item) => {
    const record = item.ingredientId ? getIngredientById(item.ingredientId) : undefined;
    return {
      raw: item.raw,
      ingredientId: item.ingredientId,
      displayName: record ? `${record.chinese_name}（${record.inci_name}）` : item.raw,
      chineseName: record?.chinese_name ?? item.raw,
      inciName: record?.inci_name ?? item.raw,
      categoryLabel: record ? INGREDIENT_CATEGORY_LABELS[record.category] : "未收录",
      functions: record?.functions ?? [],
      notes: record?.skin_related_notes ?? "本地成分库暂未收录这项成分。",
      allergen: record?.allergen_flag ?? false,
      irritation: record?.irritation_flag ?? false,
    };
  });
}

function keywordsOf(question: string): string[] {
  const lower = question.toLowerCase();
  const tokens = new Set<string>();
  const latin = lower.match(/[a-z][a-z\- ]{2,}/g) ?? [];
  for (const token of latin) tokens.add(normalizeKey(token));
  const cjk = lower.match(/[\u4e00-\u9fa5]{2,}/g) ?? [];
  for (const token of cjk) {
    tokens.add(token);
    // 中文长词拆成 2-3 字片段，便于匹配成分名
    for (let size = 2; size <= 3; size += 1) {
      for (let i = 0; i + size <= token.length; i += 1) {
        tokens.add(token.slice(i, i + size));
      }
    }
  }
  return Array.from(tokens).filter((token) => token.length >= 2);
}

function mentionedIngredients(
  question: string,
  items: ResolvedChatIngredient[],
): ResolvedChatIngredient[] {
  const questionKey = normalizeKey(question);
  const matched = items.filter((item) => {
    const names = [item.chineseName, item.inciName, item.raw].map(normalizeKey).filter(Boolean);
    return names.some((name) => name.length >= 2 && questionKey.includes(name));
  });
  if (matched.length > 0) return matched;

  const keywords = keywordsOf(question);
  return items.filter((item) => {
    const haystack = `${normalizeKey(item.chineseName)}|${normalizeKey(item.inciName)}`;
    return keywords.some((keyword) => haystack.includes(keyword) && keyword.length >= 2);
  });
}

function listNames(items: ResolvedChatIngredient[], max = 6): string {
  const names = items.map((item) => item.chineseName);
  if (names.length === 0) return "无";
  if (names.length <= max) return names.join("、");
  return `${names.slice(0, max).join("、")} 等 ${names.length} 项`;
}

function goalFromQuestion(question: string): SkinGoal | null {
  const text = question.toLowerCase();
  const map: [SkinGoal, string[]][] = [
    ["whitening", ["美白", "提亮", "亮肤", "淡斑"]],
    ["anti_aging", ["抗皱", "抗老", "紧致", "细纹", "纹路"]],
    ["hydration", ["保湿", "补水", "干燥", "水润"]],
    ["barrier", ["修护", "屏障", "修复"]],
    ["soothing", ["舒缓", "镇静", "泛红"]],
    ["oil_control", ["控油", "出油", "油光"]],
    ["pores", ["毛孔", "闭口", "黑头"]],
    ["antioxidant", ["抗氧化", "自由基"]],
  ];
  for (const [goal, words] of map) {
    if (words.some((word) => text.includes(word))) return goal;
  }
  return null;
}

function localAnswer(question: string, payload: ChatRequestPayload): string {
  const items = resolveChatIngredients(payload);
  const { analysis, profile } = payload;
  const productLabel = payload.product.name || "这款产品";

  /* 1. 为什么提醒某个成分 */
  if (/为什么|为何|怎么.*提醒|提醒.*原因/.test(question)) {
    const mentioned = mentionedIngredients(question, items);
    const target = mentioned[0];
    if (target) {
      const watch = analysis.watchItems.find(
        (item) =>
          item.ingredient.includes(target.chineseName) || item.ingredient.includes(target.inciName),
      );
      if (watch) {
        return `提醒「${target.chineseName}」的原因是：${watch.reason}\n\n它的分类是${target.categoryLabel}，常见作用包括 ${
          target.functions.join("、") || "配方辅助作用"
        }。${
          watch.userRelated
            ? "它和你自己设置的关注 / 避开清单有关，所以我会优先指出来。"
            : "这不代表产品有问题，只是这类成分在公开资料中通常会被列出来提醒用户留意。"
        }\n\n个体差异始终存在，如果你的皮肤比较容易敏感，先小面积试用会更稳妥。`;
      }
      return `${target.chineseName}在这份成分表中的常见作用是 ${
        target.functions.join("、") || "配方辅助作用"
      }。${target.notes}本次分析里它没有被单独列为关注项。`;
    }
  }

  /* 2. 某类成分有哪些（保湿 / 舒缓 / 防腐 / 香精 / 控油…） */
  const wantsList = /哪些|有什么|都有|列出|包含/.test(question);
  if (wantsList || /成分表/.test(question)) {
    if (/保湿|补水|锁水/.test(question)) {
      const list = items.filter(
        (item) =>
          item.categoryLabel.includes("保湿") ||
          item.categoryLabel.includes("封闭") ||
          item.functions.some((fn) => fn.includes("保湿") || fn.includes("锁水")),
      );
      return list.length > 0
        ? `${productLabel}里与保湿相关的成分主要有 ${list.length} 项：${listNames(list)}。\n\n它们多数属于吸水或锁水类型，排序越靠前通常占比越高。`
        : "这份成分表里，我暂时没有找到明确的保湿类成分。";
    }
    if (/舒缓|镇静|泛红/.test(question)) {
      const list = items.filter((item) => item.categoryLabel.includes("舒缓"));
      return list.length > 0
        ? `舒缓方向的成分有 ${list.length} 项：${listNames(list)}。这类成分通常出现在偏舒适取向的配方里。`
        : "这份成分表里我没有找到明确归为舒缓类的成分。";
    }
    if (/防腐|防腐剂/.test(question)) {
      const list = items.filter((item) => item.categoryLabel.includes("防腐"));
      return list.length > 0
        ? `这份配方使用了 ${list.length} 项防腐相关成分：${listNames(list)}。防腐体系的作用是保证产品在使用周期内不被微生物污染，种类多并不等于产品有问题。`
        : "我没有在这份成分表里识别到常见的防腐剂成分。";
    }
    if (/香精|香料|香/.test(question)) {
      const list = items.filter((item) => item.categoryLabel.includes("香精") || item.allergen);
      return list.length > 0
        ? `与香气相关的成分有 ${list.length} 项：${listNames(
            list,
          )}。香精类是化妆品中最常被提到的接触性过敏来源之一，如果你曾经对香精敏感，可以重点留意。`
        : "我没有在这份成分表里识别到香精或香料类成分。";
    }
    if (/防晒/.test(question)) {
      const list = items.filter((item) => item.categoryLabel.includes("防晒"));
      return list.length > 0
        ? `防晒相关成分有 ${list.length} 项：${listNames(list)}。`
        : "这份成分表里没有识别到常见防晒剂，如果你按防晒使用，可以再核对包装标注。";
    }
  }

  /* 3. 与关注功效相关的成分 */
  const goal = goalFromQuestion(question);
  if (goal) {
    const matched = analysis.matchedGoals.find((item) => item.goal === goal);
    if (matched && matched.relatedIngredients.length > 0) {
      return `与「${SKIN_GOAL_LABELS[goal]}」相关的成分有 ${matched.relatedIngredients.length} 项：${matched.relatedIngredients.join(
        "、",
      )}。\n\n${matched.explanation}`;
    }
    return `在本次识别到的成分中，我没有找到与「${SKIN_GOAL_LABELS[goal]}」直接对应的常见成分。这不代表产品一定没有这个方向的作用，只是成分表里缺少明确的对应成分。${
      profile.goals.includes(goal) ? "" : "\n\n你也可以在「我的」里把这项加入关注功效，之后的每次分析都会自动带上。"
    }`;
  }

  /* 4. 是否适合我 / 会不会过敏 / 能不能用 */
  if (/适合|能不能用|可以用|会不会过敏|过敏|刺激|敏感/.test(question)) {
    return `${analysis.skinCompatibility.summary}\n\n可能比较匹配的地方：${
      analysis.skinCompatibility.positives[0] ?? "—"
    }\n\n建议重点了解的地方：${
      analysis.skinCompatibility.attentions[0] ?? "—"
    }\n\n成分分析只能帮助理解配方，无法判断某个人一定过敏或一定不过敏。稳妥的做法是先在耳后或下颌小面积试用几天，观察自己的真实反应。`;
  }

  /* 5. 排序 / 含量 */
  if (/排序|顺序|含量|浓度|排在前/.test(question)) {
    return `成分表通常按照含量从高到低排列，所以越靠前的成分一般占比越高。\n\n这份表里最靠前的几项是：${listNames(
      items.slice(0, 5),
    )}。\n\n需要注意两点：一是极低浓度的成分（如防腐剂、部分香料）可能排在后面，二是不同国家对排序的具体要求略有差异，所以它更适合用来判断「相对多少」，而不是精确含量。`;
  }

  /* 6. 是否包含用户关注 / 避开的成分 */
  if (/我关注|我避开|避开|关注成分/.test(question)) {
    const watchHits = analysis.watchItems.filter((item) => item.userRelated);
    if (watchHits.length > 0) {
      return `把你设置的清单和这份成分表对照后，命中了 ${watchHits.length} 项：${watchHits
        .map((item) => item.ingredient.split("（")[0])
        .join("、")}。\n\n${watchHits[0].reason}`;
    }
    return "把你设置的关注 / 避开清单和这份成分表对照后，本次没有命中任何一项。";
  }

  /* 7. 提到具体成分，解释它的作用 */
  const mentioned = mentionedIngredients(question, items);
  if (mentioned.length > 0) {
    const target = mentioned[0];
    const watch = analysis.watchItems.find((item) => item.ingredient.includes(target.chineseName));
      return `${target.chineseName}在这份配方里的分类是${target.categoryLabel}，常见作用包括 ${
        target.functions.join("、") || "配方辅助作用"
      }。\n\n${target.notes}${watch ? `\n\n提醒一句：${watch.reason}` : ""}`;
  }

  /* 8. 兜底：给出分析结论摘要 */
  return `我先按当前这份分析结果回答：${analysis.summary}\n\n你可以继续问我，例如：\n· 这款产品里有哪些保湿成分？\n· 我关注的功效在这里有哪些相关成分？\n· 为什么提醒我某个成分？\n· 这些成分里有需要我特别注意的吗？`;
}

function buildContext(payload: ChatRequestPayload): string {
  const items = resolveChatIngredients(payload);
  const ingredientLines = items
    .map(
      (item, index) =>
        `${index + 1}. ${item.displayName}｜分类：${item.categoryLabel}｜作用：${
          item.functions.join("、") || "—"
        }${item.allergen ? "｜公开资料中的致敏相关成分" : ""}${
          item.irritation ? "｜潜在刺激因素" : ""
        }`,
    )
    .join("\n");

  const watchLines = payload.analysis.watchItems
    .map((item) => `- ${item.ingredient}（${item.type}）：${item.reason}`)
    .join("\n");

  const goalLines = payload.analysis.matchedGoals
    .map((item) => `- ${SKIN_GOAL_LABELS[item.goal]}：${item.relatedIngredients.join("、") || "无"}`)
    .join("\n");

  return `## 当前产品
名称：${payload.product.name || "未命名产品"}
成分总数：${items.length}
完整成分列表：
${ingredientLines}

## 解析结论
AI 总结：${payload.analysis.summary}
配方结构：${payload.analysis.formulaOverview.summary}
与用户关注的功效：
${goalLines || "- 用户未设置关注功效"}
值得关注的成分：
${watchLines || "- 无"}
与用户肤质的匹配情况：${payload.analysis.skinCompatibility.summary}
可能比较匹配：${payload.analysis.skinCompatibility.positives.join("；")}
建议重点了解：${payload.analysis.skinCompatibility.attentions.join("；")}

## 用户画像
${describeProfile(payload.profile)}`;
}

export async function answerQuestion(payload: ChatRequestPayload): Promise<ChatResponsePayload> {
  const question = payload.messages.filter((item) => item.role === "user").at(-1)?.content?.trim();
  const suggestions = payload.analysis.questionsStarter.slice(0, 4);

  if (!question) {
    return {
      reply: "请告诉我你想了解什么，比如「这款产品里有哪些保湿成分？」",
      engine: getAiConfig().mode === "llm" ? "llm" : "rule",
      suggestions,
    };
  }

  const config = getAiConfig();
  if (config.mode === "llm") {
    try {
      const history = payload.messages.slice(-8).map((message) => ({
        role: message.role,
        content: message.content,
      }));
      const reply = await callLlmText({
        system: `${CHAT_SYSTEM_PROMPT}\n\n${buildContext(payload)}`,
        messages: history,
        temperature: 0.4,
        maxTokens: 700,
        timeoutMs: 30_000,
      });
      return { reply: reply.trim(), engine: "llm", suggestions };
    } catch (error) {
      console.error("[chat] AI 调用失败，回退本地回答：", error);
      return { reply: localAnswer(question, payload), engine: "rule", suggestions };
    }
  }

  return { reply: localAnswer(question, payload), engine: "rule", suggestions };
}
