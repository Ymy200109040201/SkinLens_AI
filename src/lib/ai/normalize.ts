import type {
  AnalysisResult,
  FormulaStructureItem,
  IngredientExplanation,
  MatchedGoal,
  ProfileSnapshot,
  RelevanceLevel,
  SkinCompatibility,
  SkinGoal,
  WatchItem,
  WatchItemType,
} from "../domain/types";
import { SKIN_GOAL_LABELS, STRUCTURE_GROUPS } from "../domain/labels";

/**
 * 结构化输出校验
 *
 * 大模型返回的 JSON 未必完全符合约定，这里做一次「宽松校验 + 回退」：
 * 字段缺失或类型不对时，用本地规则引擎的结果补上，保证前端渲染永远有数据。
 */

const GOAL_VALUES: SkinGoal[] = [
  "whitening",
  "anti_aging",
  "hydration",
  "barrier",
  "soothing",
  "oil_control",
  "pores",
  "antioxidant",
];

const WATCH_TYPES: WatchItemType[] = [
  "allergen",
  "irritation",
  "user_watch",
  "user_avoid",
  "fragrance",
  "preservative",
  "acne_related",
  "other",
];

const RELEVANCE: RelevanceLevel[] = ["high", "medium", "low"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  return fallback;
}

function asStringArray(value: unknown, limit = 20): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim())
    .slice(0, limit);
}

function normalizeStructure(
  value: unknown,
  fallback: FormulaStructureItem[],
): FormulaStructureItem[] {
  if (!Array.isArray(value)) return fallback;
  const items: FormulaStructureItem[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    const group = asString(entry.group);
    if (!group) continue;
    if (!(STRUCTURE_GROUPS as readonly string[]).includes(group)) continue;
    const ingredients = asStringArray(entry.ingredients, 30);
    const scoreRaw = typeof entry.score === "number" ? entry.score : Number(entry.score);
    const score = Number.isFinite(scoreRaw) ? Math.max(0, Math.min(100, Math.round(scoreRaw))) : 0;
    items.push({
      group,
      ingredients,
      score,
      note: asString(entry.note, "—"),
    });
  }
  // 至少要有 3 个分组才认为模型输出可用，否则回退到本地计算结果
  return items.length >= 3 ? items : fallback;
}

function normalizeMatchedGoals(
  value: unknown,
  fallback: MatchedGoal[],
  profile: ProfileSnapshot,
): MatchedGoal[] {
  if (!Array.isArray(value)) return fallback;
  const goals = new Map<SkinGoal, MatchedGoal>();
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    const goal = asString(entry.goal) as SkinGoal;
    if (!GOAL_VALUES.includes(goal)) continue;
    const relevance = asString(entry.relevance) as RelevanceLevel;
    goals.set(goal, {
      goal,
      relatedIngredients: asStringArray(entry.relatedIngredients, 20),
      relevance: RELEVANCE.includes(relevance) ? relevance : "low",
      explanation: asString(entry.explanation, `与「${SKIN_GOAL_LABELS[goal]}」相关的成分说明。`),
    });
  }

  // 保证用户设置的每个关注功效都有一条记录
  const ordered: MatchedGoal[] = [];
  for (const goal of profile.goals) {
    const fromModel = goals.get(goal);
    const fromFallback = fallback.find((item) => item.goal === goal);
    if (fromModel) ordered.push(fromModel);
    else if (fromFallback) ordered.push(fromFallback);
  }
  return ordered.length > 0 ? ordered : fallback;
}

function normalizeWatchItems(value: unknown, fallback: WatchItem[]): WatchItem[] {
  if (!Array.isArray(value)) return fallback;
  const items: WatchItem[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    const ingredient = asString(entry.ingredient);
    const reason = asString(entry.reason);
    if (!ingredient || !reason) continue;
    const type = asString(entry.type) as WatchItemType;
    items.push({
      ingredient,
      type: WATCH_TYPES.includes(type) ? type : "other",
      reason,
      userRelated: entry.userRelated === true,
    });
    if (items.length >= 20) break;
  }
  return items.length > 0 ? items : fallback;
}

function normalizeCompatibility(value: unknown, fallback: SkinCompatibility): SkinCompatibility {
  if (!isRecord(value)) return fallback;
  const positives = asStringArray(value.positives, 10);
  const attentions = asStringArray(value.attentions, 10);
  return {
    summary: asString(value.summary, fallback.summary),
    positives: positives.length > 0 ? positives : fallback.positives,
    attentions: attentions.length > 0 ? attentions : fallback.attentions,
  };
}

function normalizeExplanations(
  value: unknown,
  fallback: IngredientExplanation[],
): IngredientExplanation[] {
  if (!Array.isArray(value)) return fallback;
  const items: IngredientExplanation[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    const ingredient = asString(entry.ingredient);
    const explanation = asString(entry.explanation);
    if (!ingredient || !explanation) continue;
    items.push({
      ingredient,
      functions: asStringArray(entry.functions, 6),
      explanation,
      relatedToUser: entry.relatedToUser === true,
    });
    if (items.length >= 14) break;
  }
  return items.length > 0 ? items : fallback;
}

export function normalizeAnalysisResult(
  raw: unknown,
  fallback: AnalysisResult,
  profile: ProfileSnapshot,
): AnalysisResult {
  if (!isRecord(raw)) return fallback;

  const formulaOverviewRaw = isRecord(raw.formulaOverview) ? raw.formulaOverview : {};
  const questions = asStringArray(raw.questionsStarter, 4);

  return {
    summary: asString(raw.summary, fallback.summary),
    formulaOverview: {
      summary: asString(formulaOverviewRaw.summary, fallback.formulaOverview.summary),
      structure: normalizeStructure(formulaOverviewRaw.structure, fallback.formulaOverview.structure),
    },
    personalizedAnalysis: asString(raw.personalizedAnalysis, fallback.personalizedAnalysis),
    matchedGoals: normalizeMatchedGoals(raw.matchedGoals, fallback.matchedGoals, profile),
    watchItems: normalizeWatchItems(raw.watchItems, fallback.watchItems),
    skinCompatibility: normalizeCompatibility(raw.skinCompatibility, fallback.skinCompatibility),
    ingredientExplanations: normalizeExplanations(
      raw.ingredientExplanations,
      fallback.ingredientExplanations,
    ),
    questionsStarter: questions.length > 0 ? questions : fallback.questionsStarter,
  };
}
