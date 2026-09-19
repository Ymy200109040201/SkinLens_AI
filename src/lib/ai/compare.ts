import type {
  CompareRequestPayload,
  CompareResult,
  CompareSideSummary,
  ProfileSnapshot,
} from "../domain/types";
import { SKIN_GOAL_LABELS } from "../domain/labels";
import { normalizeKey } from "../ingredients/lookup";
import { dominantGroups } from "../analysis/structure";
import { getAiConfig } from "./config";
import { callLlmJson } from "./provider";
import { COMPARE_JSON_SPEC, COMPARE_SYSTEM_PROMPT, describeProfile } from "./prompts";

/**
 * 产品对比服务
 *
 * 只做「差异呈现」，不做优劣排名或总体打分。
 */

function toSideSummary(side: CompareRequestPayload["left"]): CompareSideSummary {
  return {
    id: side.id,
    productName: side.name,
    productType: side.type,
    ingredientCount: side.ingredients.length,
    structure: side.structure,
    goalHits: side.goalHits,
    watchItems: side.watchItems,
    compatibility: side.compatibility,
  };
}

function diffStructure(left: CompareSideSummary, right: CompareSideSummary) {
  const groups = new Set([
    ...left.structure.map((item) => item.group),
    ...right.structure.map((item) => item.group),
  ]);
  return Array.from(groups)
    .map((group) => {
      const leftScore = left.structure.find((item) => item.group === group)?.score ?? 0;
      const rightScore = right.structure.find((item) => item.group === group)?.score ?? 0;
      const gap = Math.abs(leftScore - rightScore);
      const heavier = leftScore > rightScore ? "left" : "right";
      const note =
        gap <= 4
          ? "两者在该分组上的估算比重接近。"
          : `${heavier === "left" ? "A" : "B"} 在该分组上的估算比重更高（相差约 ${gap} 个百分点）。`;
      return { group, leftScore, rightScore, note };
    })
    .filter((item) => item.leftScore > 0 || item.rightScore > 0)
    .sort((a, b) => Math.max(b.leftScore, b.rightScore) - Math.max(a.leftScore, a.rightScore));
}

function diffProfile(
  left: CompareSideSummary,
  right: CompareSideSummary,
  profile: ProfileSnapshot,
): string[] {
  const lines: string[] = [];

  for (const goal of profile.goals) {
    const leftCount = left.goalHits.find((item) => item.goal === goal)?.relatedIngredients.length ?? 0;
    const rightCount =
      right.goalHits.find((item) => item.goal === goal)?.relatedIngredients.length ?? 0;
    if (leftCount === 0 && rightCount === 0) continue;
    if (leftCount === rightCount) {
      lines.push(
        `在「${SKIN_GOAL_LABELS[goal]}」方向上，两款产品各有 ${leftCount} 项相关成分，数量接近。`,
      );
    } else {
      lines.push(
        `在「${SKIN_GOAL_LABELS[goal]}」方向上，A 有 ${leftCount} 项相关成分，B 有 ${rightCount} 项。`,
      );
    }
  }

  const leftAvoid = left.watchItems.filter((item) => item.type === "user_avoid").length;
  const rightAvoid = right.watchItems.filter((item) => item.type === "user_avoid").length;
  if (leftAvoid > 0 || rightAvoid > 0) {
    lines.push(
      `命中的「避开成分」数量：A ${leftAvoid} 项，B ${rightAvoid} 项${
        leftAvoid === rightAvoid ? "，两者相同。" : "。"
      }`,
    );
  }

  const leftFlag = left.watchItems.filter(
    (item) => item.type === "allergen" || item.type === "irritation",
  ).length;
  const rightFlag = right.watchItems.filter(
    (item) => item.type === "allergen" || item.type === "irritation",
  ).length;
  if (leftFlag > 0 || rightFlag > 0) {
    lines.push(
      `公开资料中的潜在关注项数量：A ${leftFlag} 项，B ${rightFlag} 项。数量差异反映的是配方思路不同，并不构成优劣结论。`,
    );
  }

  if (lines.length === 0) {
    lines.push("以你当前设置的画像来看，两款产品在成分层面没有明显的方向性差异。");
  }
  return lines;
}

function localSummary(
  left: CompareSideSummary,
  right: CompareSideSummary,
  structureDiff: CompareResult["structureDiff"],
  profileDiff: string[],
): string {
  const topDiff = structureDiff.slice(0, 3).filter((item) => item.leftScore !== item.rightScore);
  const leftDominant = dominantGroups(left.structure, 1)[0];
  const rightDominant = dominantGroups(right.structure, 1)[0];
  const leftWatch = left.watchItems.filter(
    (item) => item.type === "allergen" || item.type === "irritation" || item.type === "user_avoid",
  ).length;
  const rightWatch = right.watchItems.filter(
    (item) => item.type === "allergen" || item.type === "irritation" || item.type === "user_avoid",
  ).length;

  const parts: string[] = [];
  parts.push(
    `A「${left.productName}」共 ${left.ingredientCount} 项成分，配方重心更偏向「${
      leftDominant ?? "信息不足"
    }」；B「${right.productName}」共 ${right.ingredientCount} 项成分，重心更偏向「${
      rightDominant ?? "信息不足"
    }」。`,
  );
  if (topDiff.length > 0) {
    parts.push(
      `结构差异最明显的是${topDiff
        .map((item) => `${item.group}（A ${item.leftScore}%／B ${item.rightScore}%）`)
        .join("、")}。`,
    );
  }
  parts.push(
    `值得关注的成分数量方面，A 为 ${leftWatch} 项，B 为 ${rightWatch} 项。数量差异反映的是配方思路不同，并不构成产品优劣结论。`,
  );
  if (profileDiff.length > 0) {
    parts.push(`结合你的画像来看：${profileDiff.slice(0, 2).join("")}`);
  }
  parts.push("建议结合自己的肤感偏好与耐受情况，选择更符合当下需求的一款。");
  return parts.join("");
}

export async function compareProducts(payload: CompareRequestPayload): Promise<CompareResult> {
  const left = toSideSummary(payload.left);
  const right = toSideSummary(payload.right);

  const leftNames = payload.left.ingredients;
  const rightNames = payload.right.ingredients;
  const leftSet = new Set(leftNames.map((name) => normalizeKey(name)));
  const rightSet = new Set(rightNames.map((name) => normalizeKey(name)));

  const sharedIngredients = leftNames.filter((name) => rightSet.has(normalizeKey(name)));
  const onlyLeft = leftNames.filter((name) => !rightSet.has(normalizeKey(name)));
  const onlyRight = rightNames.filter((name) => !leftSet.has(normalizeKey(name)));

  const structureDiff = diffStructure(left, right);
  const localProfileDiff = diffProfile(left, right, payload.profile);

  const config = getAiConfig();
  let summary = localSummary(left, right, structureDiff, localProfileDiff);
  let profileDiff = localProfileDiff;
  let engine: "llm" | "rule" = "rule";
  let model: string | null = null;
  const notices: string[] = [];

  if (config.mode === "llm") {
    try {
      const raw = await callLlmJson<{ profileDiff?: unknown; summary?: unknown }>({
        system: `${COMPARE_SYSTEM_PROMPT}\n\n${COMPARE_JSON_SPEC}`,
        user: `## 产品 A
名称：${left.productName}
成分数量：${left.ingredientCount}
配方结构估算：${left.structure.map((item) => `${item.group} ${item.score}%`).join("、")}
关注功效相关成分：${left.goalHits
          .map((item) => `${SKIN_GOAL_LABELS[item.goal]}：${item.relatedIngredients.join("、") || "无"}`)
          .join("；")}
值得关注：${left.watchItems.map((item) => `${item.ingredient}（${item.reason}）`).join("；") || "无"}
肤质匹配：${left.compatibility.summary}

## 产品 B
名称：${right.productName}
成分数量：${right.ingredientCount}
配方结构估算：${right.structure.map((item) => `${item.group} ${item.score}%`).join("、")}
关注功效相关成分：${right.goalHits
          .map((item) => `${SKIN_GOAL_LABELS[item.goal]}：${item.relatedIngredients.join("、") || "无"}`)
          .join("；")}
值得关注：${right.watchItems.map((item) => `${item.ingredient}（${item.reason}）`).join("；") || "无"}
肤质匹配：${right.compatibility.summary}

## 客观差异数据
共有成分：${sharedIngredients.join("、") || "无"}
仅 A 含有：${onlyLeft.join("、") || "无"}
仅 B 含有：${onlyRight.join("、") || "无"}
结构差异：${structureDiff.map((item) => `${item.group} A${item.leftScore}% / B${item.rightScore}%`).join("、")}

## 用户画像
${describeProfile(payload.profile)}`,
        temperature: 0.4,
        maxTokens: 1600,
      });

      if (raw && typeof raw === "object") {
        const candidateSummary =
          typeof raw.summary === "string" && raw.summary.trim() ? raw.summary.trim() : summary;
        const candidateProfileDiff = Array.isArray(raw.profileDiff)
          ? raw.profileDiff
              .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
              .slice(0, 6)
          : profileDiff;
        summary = candidateSummary;
        profileDiff = candidateProfileDiff.length > 0 ? candidateProfileDiff : profileDiff;
        engine = "llm";
        model = config.model;
        notices.push(`AI 对比总结由 ${config.model} 生成，客观差异数据由本地计算。`);
      }
    } catch (error) {
      console.error("[compare] AI 调用失败，使用本地对比总结：", error);
      notices.push("AI 服务暂时不可用，已使用本地对比模式生成总结。");
    }
  } else {
    notices.push(config.reason ?? "当前为本地演示对比模式。");
  }

  notices.push("对比结果用于帮助理解差异，不构成产品优劣排名或医学建议。");

  return {
    left,
    right,
    sharedIngredients,
    onlyLeft,
    onlyRight,
    structureDiff,
    profileDiff,
    summary,
    meta: {
      engine,
      model,
      generatedAt: new Date().toISOString(),
      notices,
    },
  };
}
