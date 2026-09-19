import type {
  AnalysisResult,
  FormulaStructureItem,
  IngredientRecord,
  MatchedGoal,
  ProfileSnapshot,
  RelevanceLevel,
  SkinCompatibility,
  SkinGoal,
  WatchItem,
} from "../domain/types";
import {
  SKIN_CONCERN_LABELS,
  SKIN_GOAL_LABELS,
  SKIN_TYPE_LABELS,
} from "../domain/labels";
import { normalizeKey } from "../ingredients/lookup";
import { dominantGroups, type ResolvedIngredient } from "./structure";

/**
 * 本地规则分析引擎
 *
 * 两个用途：
 * 1. 未配置 AI Key 时的 Demo / Mock 模式
 * 2. AI 调用失败或返回非法 JSON 时的降级方案
 *
 * 输出结构与 AI 输出完全一致，前端无需区分。
 */

function joinNames(names: string[], max = 3): string {
  if (names.length === 0) return "";
  if (names.length <= max) return names.join("、");
  return `${names.slice(0, max).join("、")} 等 ${names.length} 项`;
}

function relevanceOf(count: number): RelevanceLevel {
  if (count >= 3) return "high";
  if (count === 2) return "medium";
  return "low";
}

function nameOf(item: ResolvedIngredient): string {
  return item.record?.chinese_name ?? item.parsed.raw;
}

export function userListMatches(
  item: IngredientRecord | null,
  raw: string,
  list: string[],
): boolean {
  if (list.length === 0) return false;
  const candidates = new Set<string>();
  const rawKey = normalizeKey(raw);
  if (rawKey) candidates.add(rawKey);
  if (item) {
    candidates.add(normalizeKey(item.inci_name));
    candidates.add(normalizeKey(item.chinese_name));
    for (const alias of item.aliases) candidates.add(normalizeKey(alias));
  }
  return list.some((entry) => candidates.has(normalizeKey(entry)));
}

/* ------------------------------------------------------------------ */
/* 匹配用户关注功效                                                    */
/* ------------------------------------------------------------------ */

export function matchGoals(items: ResolvedIngredient[], goals: SkinGoal[]): MatchedGoal[] {
  return goals.map((goal) => {
    const related = items.filter((item) => item.record?.goal_tags.includes(goal));
    const count = related.length;
    const names = related.map(nameOf);
    const explanation =
      count === 0
        ? `在本次识别到的成分中，暂未看到与「${SKIN_GOAL_LABELS[goal]}」直接相关的常见成分。这不代表配方一定没有该方向的作用，只是当前成分库没有找到明确的对应成分。`
        : `识别到 ${count} 项与「${SKIN_GOAL_LABELS[goal]}」相关的常见成分：${joinNames(names, 4)}。它们在这份成分表中的排序越靠前，通常意味着在配方中的占比越高。`;
    return {
      goal,
      relatedIngredients: names,
      relevance: relevanceOf(count),
      explanation,
    };
  });
}

/* ------------------------------------------------------------------ */
/* 值得关注的成分                                                      */
/* ------------------------------------------------------------------ */

const PRIORITY: Record<string, number> = {
  user_avoid: 0,
  user_watch: 1,
  allergen: 2,
  irritation: 3,
  acne_related: 4,
  fragrance: 5,
  preservative: 6,
  other: 7,
};

export function buildWatchItems(
  items: ResolvedIngredient[],
  profile: ProfileSnapshot,
  limit = 26,
): WatchItem[] {
  const result: WatchItem[] = [];

  for (const item of items) {
    const record = item.record;
    const name = nameOf(item);
    const isAvoided = userListMatches(record, item.parsed.raw, profile.avoidedIngredients);
    const isWatched = userListMatches(record, item.parsed.raw, profile.watchedIngredients);
    const userRelated = isWatched || isAvoided;

    if (isAvoided) {
      result.push({
        ingredient: name,
        type: "user_avoid",
        reason: "你把它加入了「希望避开的成分」，本次成分表中检测到了它，可以重点了解。",
        userRelated: true,
      });
    }
    if (isWatched) {
      result.push({
        ingredient: name,
        type: "user_watch",
        reason: "你在「关注的成分」中标记了它，这里为你补充它在这份配方里的常见作用。",
        userRelated: true,
      });
    }
    if (record?.allergen_flag) {
      result.push({
        ingredient: name,
        type: "allergen",
        reason:
          record.category === "fragrance"
            ? "属于香精香料类成分，公开资料中常被列为需要留意的致敏来源。对于已经对香精敏感的人群，可能需要进一步了解。"
            : "公开资料中这类成分常被提及与致敏相关。对于已经对相关物质敏感的人群，可能需要进一步了解。",
        userRelated,
      });
    }
    if (record?.irritation_flag) {
      result.push({
        ingredient: name,
        type: "irritation",
        reason:
          "属于公开资料中常被提到的潜在刺激因素，感受因人而异；屏障状态不稳定或偏敏感时，通常更需要留意用量与使用频率。",
        userRelated,
      });
    }
    if (record?.acne_related_flag) {
      result.push({
        ingredient: name,
        type: "acne_related",
        reason:
          "这类成分在「是否容易闷痘」的讨论中经常出现，容易长痘的肌肤可以把它列入观察对象。",
        userRelated,
      });
    }
  }

  const preservatives = items.filter((item) => item.record?.category === "preservative");
  if (preservatives.length >= 4) {
    result.push({
      ingredient: `防腐体系（共 ${preservatives.length} 项）`,
      type: "preservative",
      reason: `这份配方使用了 ${preservatives.length} 项防腐相关成分：${joinNames(
        preservatives.map(nameOf),
        4,
      )}。多种防腐成分复配是常见做法，目的是让产品在使用周期内保持稳定。`,
      userRelated: false,
    });
  }

  return result
    .sort((a, b) => {
      if (a.userRelated !== b.userRelated) return a.userRelated ? -1 : 1;
      return (PRIORITY[a.type] ?? 9) - (PRIORITY[b.type] ?? 9);
    })
    .slice(0, limit);
}

/* ------------------------------------------------------------------ */
/* 与肤质的匹配情况                                                    */
/* ------------------------------------------------------------------ */

function withCategory(items: ResolvedIngredient[], categories: string[]): ResolvedIngredient[] {
  return items.filter((item) => item.record && categories.includes(item.record.category));
}

function withGoal(items: ResolvedIngredient[], goal: SkinGoal): ResolvedIngredient[] {
  return items.filter((item) => item.record?.goal_tags.includes(goal));
}

export function buildSkinCompatibility(
  items: ResolvedIngredient[],
  profile: ProfileSnapshot,
  productTypeLabel: string,
): SkinCompatibility {
  const positives: string[] = [];
  const attentions: string[] = [];
  const concerns = profile.skinConcerns;
  const skinType = profile.skinType;

  const humectants = withCategory(items, ["humectant", "occlusive"]);
  const emollients = withCategory(items, ["emollient"]);
  const soothing = withCategory(items, ["soothing"]);
  const fragrances = withCategory(items, ["fragrance"]);
  const uvFilters = withCategory(items, ["uv_filter"]);
  const occlusives = withCategory(items, ["occlusive"]);
  const irritants = items.filter((item) => item.record?.irritation_flag);
  const acneRelated = items.filter((item) => item.record?.acne_related_flag);
  const oilControl = withGoal(items, "oil_control");
  const poreRelated = withGoal(items, "pores");
  const barrierItems = withGoal(items, "barrier");

  // 混合性肌肤通常同时存在偏干与偏油的区域，因此也纳入保湿方向的判断
  const wantsMoisture =
    skinType === "dry" || skinType === "combination" || concerns.includes("dryness");
  const wantsOilControl =
    skinType === "oily" || concerns.includes("oiliness") || concerns.includes("acne");
  const sensitive = concerns.includes("redness") || concerns.includes("stinging");

  if (wantsMoisture && humectants.length > 0) {
    positives.push(
      `含 ${humectants.length} 项保湿或锁水类成分（${joinNames(
        humectants.map(nameOf),
      )}），与「${SKIN_CONCERN_LABELS.dryness}」的需求方向一致。`,
    );
  }
  if (wantsMoisture && emollients.length > 0) {
    positives.push(
      `含 ${emollients.length} 项润肤类成分（${joinNames(
        emollients.map(nameOf),
      )}），有助于提升柔润感。`,
    );
  }
  if (wantsOilControl && oilControl.length > 0) {
    positives.push(
      `含 ${oilControl.length} 项与控油话题相关的成分（${joinNames(oilControl.map(nameOf))}），与你的出油关注点相关。`,
    );
  }
  if (sensitive && soothing.length > 0) {
    positives.push(
      `含 ${soothing.length} 项舒缓方向成分（${joinNames(
        soothing.map(nameOf),
      )}），这类成分常见于偏舒适取向的配方。`,
    );
  }
  if (concerns.includes("pores") && poreRelated.length > 0) {
    positives.push(
      `含 ${poreRelated.length} 项与毛孔话题相关的成分（${joinNames(poreRelated.map(nameOf))}）。`,
    );
  }
  if (profile.goals.includes("barrier") && barrierItems.length > 0) {
    positives.push(
      `含 ${barrierItems.length} 项与屏障修护话题相关的成分（${joinNames(barrierItems.map(nameOf))}）。`,
    );
  }
  if (concerns.includes("acne") && acneRelated.length === 0 && emollients.length <= 2) {
    positives.push(
      "本次识别到的成分中，没有出现在「致痘讨论」中常被提及的类型，润肤类成分也相对精简。",
    );
  }

  if (irritants.length > 0) {
    attentions.push(
      sensitive
        ? `检测到 ${irritants.length} 项潜在刺激因素（${joinNames(
            irritants.map(nameOf),
          )}）。你提到过「${
            concerns.includes("stinging") ? SKIN_CONCERN_LABELS.stinging : SKIN_CONCERN_LABELS.redness
          }」，建议先小面积试用了解自己的耐受情况。`
        : `检测到 ${irritants.length} 项公开资料中的潜在刺激因素（${joinNames(
            irritants.map(nameOf),
          )}），多数人使用没有明显感受，但初次使用时值得留意。`,
    );
  }
  if (fragrances.length > 0 && sensitive) {
    attentions.push(
      `配方中含香精香料类成分 ${fragrances.length} 项（${joinNames(
        fragrances.map(nameOf),
      )}）。对于容易泛红或刺痛的人群，这类成分常被列为优先观察对象。`,
    );
  }
  if (acneRelated.length > 0 && (concerns.includes("acne") || skinType === "oily")) {
    attentions.push(
      `含 ${acneRelated.length} 项在「是否容易闷痘」讨论中常被提及的成分（${joinNames(
        acneRelated.map(nameOf),
      )}）。这并不等于一定会长痘，但可以列入你的观察清单。`,
    );
  }
  if (wantsMoisture && humectants.length === 0) {
    attentions.push("本次识别到的成分中，保湿类成分较少，偏干肌肤可能需要额外搭配保湿步骤。");
  }
  if (skinType === "oily" && occlusives.length > 0) {
    attentions.push("配方中含有封闭性较强的成分，油性肌肤使用时可以留意肤感是否偏厚重。");
  }
  if (productTypeLabel === "防晒" && uvFilters.length === 0) {
    attentions.push(
      "未识别到常见防晒剂成分。如果你是把它当作防晒使用，可以再核对一下产品包装上的标注。",
    );
  }

  let summary: string;
  if (!profile.skinType && profile.skinConcerns.length === 0 && profile.goals.length === 0) {
    summary =
      "你还没有设置肤质与关注点，因此这里是通用成分分析。设置个人画像后，这一部分会给出与你更相关的说明。";
  } else {
    const skinLabel = profile.skinType ? SKIN_TYPE_LABELS[profile.skinType] : "未设置肤质";
    const goalText =
      profile.goals.length > 0
        ? `关注功效 ${profile.goals.map((goal) => SKIN_GOAL_LABELS[goal]).join(" · ")}`
        : "尚未设置关注功效";
    summary = `结合你当前的画像（${skinLabel} · ${goalText}），这款${productTypeLabel}中有 ${positives.length} 项与你的画像方向一致的因素，另有 ${attentions.length} 项建议进一步了解。`;
  }

  if (positives.length === 0) {
    positives.push(
      "与当前画像直接对应的成分特征不明显，可以结合下面的完整成分表进一步查看。",
    );
  }
  if (attentions.length === 0) {
    attentions.push(
      "本次没有发现需要特别提示的关注项，不过个体差异始终存在，仍建议初次使用时逐步建立耐受。",
    );
  }

  return { summary, positives, attentions };
}

/* ------------------------------------------------------------------ */
/* 完整成分解释                                                        */
/* ------------------------------------------------------------------ */

export function buildIngredientExplanations(
  items: ResolvedIngredient[],
  profile: ProfileSnapshot,
  limit = 14,
): AnalysisResult["ingredientExplanations"] {
  const prioritized = [...items].sort((a, b) => {
    const flagA = a.record?.irritation_flag || a.record?.allergen_flag ? 1 : 0;
    const flagB = b.record?.irritation_flag || b.record?.allergen_flag ? 1 : 0;
    if (flagA !== flagB) return flagB - flagA;
    return a.position - b.position;
  });

  return prioritized
    .slice(0, limit)
    .sort((a, b) => a.position - b.position)
    .map((item) => {
      const record = item.record;
      const isAvoided = userListMatches(record, item.parsed.raw, profile.avoidedIngredients);
      const isWatched = userListMatches(record, item.parsed.raw, profile.watchedIngredients);
      const goalRelated = record ? record.goal_tags.some((tag) => profile.goals.includes(tag)) : false;
      const relatedToUser = isAvoided || isWatched || goalRelated;

      const base =
        record?.skin_related_notes ?? "这项成分暂未收录在本地成分库中，已为你保留原始名称。";
      const positionNote =
        item.position <= 5
          ? "它出现在成分表较靠前的位置，通常意味着在配方中的占比相对较高。"
          : "";
      const relationNote = isAvoided
        ? "它出现在你设置的「避开成分」清单中，建议重点了解。"
        : isWatched
          ? "它出现在你设置的「关注成分」清单中。"
          : goalRelated
            ? "它与你在「我的」中设置的部分关注方向相关。"
            : "";
      const flagNote = record?.allergen_flag
        ? "公开资料中常被列为需要留意的致敏相关成分。"
        : record?.irritation_flag
          ? "属于公开资料中常被提到的潜在刺激因素。"
          : "";

      return {
        ingredient: nameOf(item),
        functions: record?.functions ?? [],
        explanation:
          [base, positionNote, relationNote, flagNote].filter(Boolean).join(" ") ||
          "暂无更多信息。",
        relatedToUser,
      };
    });
}

/* ------------------------------------------------------------------ */
/* 分析结果组装                                                        */
/* ------------------------------------------------------------------ */

export interface LocalAnalysisInput {
  productName: string;
  productTypeLabel: string;
  ingredients: ResolvedIngredient[];
  profile: ProfileSnapshot;
  structure: FormulaStructureItem[];
}

export function buildQuestionsStarter(
  input: LocalAnalysisInput,
  watchItems: WatchItem[],
): string[] {
  const questions: string[] = ["这款产品里有哪些保湿成分？"];
  const topWatch = watchItems.find((item) => item.type !== "preservative");
  if (topWatch) {
    questions.push(`为什么提醒我「${topWatch.ingredient.split("（")[0]}」？`);
  }
  const firstGoal = input.profile.goals[0];
  if (firstGoal) {
    questions.push(`我关注${SKIN_GOAL_LABELS[firstGoal]}，这里有哪些相关成分？`);
  }
  const active = input.ingredients.find(
    (item) => item.record?.category === "active" && item.position < 12,
  );
  if (active?.record) {
    questions.push(`${active.record.chinese_name}在这里主要起什么作用？`);
  }
  questions.push("成分表里的排序说明什么？");
  return Array.from(new Set(questions)).slice(0, 4);
}

export function buildLocalAnalysis(input: LocalAnalysisInput): AnalysisResult {
  const { ingredients, profile, structure, productName, productTypeLabel } = input;
  const matchedCount = ingredients.filter((item) => item.record).length;
  const total = ingredients.length;
  const dominant = dominantGroups(structure, 2);
  const watchItems = buildWatchItems(ingredients, profile);
  const matchedGoals = matchGoals(ingredients, profile.goals);
  const skinCompatibility = buildSkinCompatibility(ingredients, profile, productTypeLabel);
  const ingredientExplanations = buildIngredientExplanations(ingredients, profile);
  const userAvoidHits = watchItems.filter((item) => item.type === "user_avoid");
  const goalHits = matchedGoals.filter((item) => item.relatedIngredients.length > 0);

  const summaryParts: string[] = [
    `共解析出 ${total} 项成分${
      matchedCount > 0 ? `，其中 ${matchedCount} 项已在成分库中有收录` : ""
    }`,
  ];
  if (dominant.length > 0) {
    summaryParts.push(`整体配方更偏向「${dominant.join("」与「")}」`);
  }
  if (goalHits.length > 0) {
    summaryParts.push(
      `与你关注的 ${goalHits.map((item) => SKIN_GOAL_LABELS[item.goal]).join(" / ")} 都能找到相关成分`,
    );
  } else if (profile.goals.length > 0) {
    summaryParts.push("暂未找到与你的关注功效直接对应的常见成分");
  }
  const summary = `${productName || "这款产品"}（${productTypeLabel}）：${summaryParts.join("，")}。${
    userAvoidHits.length > 0
      ? `需要注意，成分表中出现了你标记为避开的 ${userAvoidHits.length} 项成分。`
      : ""
  }`;

  const topGroup = structure.find((item) => item.group === dominant[0]);
  const formulaSummary =
    dominant.length > 0
      ? `整体来看，该配方更偏向「${dominant.join("」与「")}」：${topGroup?.note ?? ""}。下面是各分组的相对比重（按成分数量与排序位置估算，不代表真实含量百分比）。`
      : "整体来看，本次可匹配到的成分较少，暂时无法给出配方结构判断。下面是已知部分的分布情况。";

  const personalizedParts: string[] = [];
  if (!profile.skinType && profile.skinConcerns.length === 0) {
    personalizedParts.push("你还没有设置肤质，本次为通用成分分析。");
  } else {
    const concernText =
      profile.skinConcerns.length > 0
        ? ` · ${profile.skinConcerns.map((item) => SKIN_CONCERN_LABELS[item]).join(" · ")}`
        : "";
    personalizedParts.push(
      `按照你当前的画像（${
        profile.skinType ? SKIN_TYPE_LABELS[profile.skinType] : "未设置肤质"
      }${concernText}）：`,
    );
    if (goalHits.length > 0) {
      personalizedParts.push(
        `配方中有 ${goalHits.length} 个关注方向能找到对应成分，其中「${
          SKIN_GOAL_LABELS[goalHits[0].goal]
        }」相关成分相对集中。`,
      );
    } else if (profile.goals.length === 0) {
      personalizedParts.push("你还没有设置关注功效，因此无法给出功效相关性分析。");
    } else {
      personalizedParts.push(
        "配方中与你关注功效直接相关的成分不明显，可以考虑结合其它产品做一次对比。",
      );
    }
  }
  if (watchItems.some((item) => item.userRelated)) {
    personalizedParts.push(
      "同时，成分表里出现了你在「我的」中标记过的成分，已在下方「值得关注」中单独列出。",
    );
  }

  return {
    summary,
    formulaOverview: {
      summary: formulaSummary,
      structure,
    },
    personalizedAnalysis: personalizedParts.join(""),
    matchedGoals,
    watchItems,
    skinCompatibility,
    ingredientExplanations,
    questionsStarter: buildQuestionsStarter(input, watchItems),
  };
}
