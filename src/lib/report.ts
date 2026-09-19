import type { AnalysisRecord, ChatRequestPayload, CompareInputSide } from "./domain/types";
import { getIngredientById } from "./ingredients/lookup";

/**
 * 取出用于界面展示的成分名称列表（中文优先）。
 * 成分库已收录的显示中文名，未收录的保留用户粘贴的原文。
 */
export function displayIngredientNames(record: AnalysisRecord): string[] {
  return record.parsedIngredients.map((item) => {
    const ingredient = item.ingredientId ? getIngredientById(item.ingredientId) : undefined;
    return ingredient?.chinese_name ?? item.raw;
  });
}

/** 从分析记录构建问答所需的上下文 */
export function toChatPayload(
  record: AnalysisRecord,
  messages: ChatRequestPayload["messages"],
): ChatRequestPayload {
  return {
    product: {
      name: record.productName,
      type: record.productType,
      ingredients: record.parsedIngredients.map((item) => ({
        raw: item.raw,
        ingredientId: item.ingredientId,
      })),
    },
    analysis: record.analysis,
    profile: record.profileSnapshot,
    messages,
  };
}

/** 从分析记录构建对比所需的单侧数据 */
export function toCompareSide(record: AnalysisRecord): CompareInputSide {
  return {
    id: record.id,
    name: record.productName,
    type: record.productType,
    ingredients: displayIngredientNames(record),
    structure: record.analysis.formulaOverview.structure,
    goalHits: record.analysis.matchedGoals,
    watchItems: record.analysis.watchItems,
    compatibility: record.analysis.skinCompatibility,
  };
}

/** 记录列表里的一句话摘要 */
export function summarySnippet(record: AnalysisRecord, max = 62): string {
  const text = record.analysis.summary;
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
}
