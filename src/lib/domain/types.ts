/**
 * SkinLens AI —— 领域模型定义
 *
 * 这里只放与产品语义相关的类型，界面文案（中文标签）统一放在 labels.ts，
 * 便于后续做多语言或文案调整。
 */

/** 肤质 */
export type SkinType = "dry" | "oily" | "combination" | "normal" | "unsure";

/** 肤质特征（可与肤质同时存在） */
export type SkinConcern =
  | "redness"
  | "acne"
  | "dryness"
  | "oiliness"
  | "stinging"
  | "pores";

/** 关注功效 */
export type SkinGoal =
  | "whitening"
  | "anti_aging"
  | "hydration"
  | "barrier"
  | "soothing"
  | "oil_control"
  | "pores"
  | "antioxidant";

/** 产品类型 */
export type ProductType =
  | "cream"
  | "serum"
  | "toner"
  | "sunscreen"
  | "mask"
  | "cleanser"
  | "makeup"
  | "other";

/** 成分分类 */
export type IngredientCategory =
  | "solvent"
  | "humectant"
  | "emollient"
  | "occlusive"
  | "emulsifier"
  | "thickener"
  | "active"
  | "soothing"
  | "fragrance"
  | "preservative"
  | "uv_filter"
  | "surfactant"
  | "ph_adjuster"
  | "colorant"
  | "chelating"
  | "other";

/** 成分数据库中的一条记录 */
export interface IngredientRecord {
  /** 内部唯一 ID */
  ingredient_id: string;
  /** INCI 标准名 */
  inci_name: string;
  /** 中文名称 */
  chinese_name: string;
  /** 常见别名（中英文皆可，用于解析匹配） */
  aliases: string[];
  /** 分类 */
  category: IngredientCategory;
  /** 主要作用（面向普通用户的中文短句） */
  functions: string[];
  /** 关联的功效标签，用于与用户关注功效匹配 */
  goal_tags: SkinGoal[];
  /** 与皮肤相关的说明 */
  skin_related_notes: string;
  /** 是否属于常见需留意的过敏相关成分（如香精香料类） */
  allergen_flag: boolean;
  /** 是否属于潜在刺激因素 */
  irritation_flag: boolean;
  /** 是否常与痘痘/闭口话题相关 */
  acne_related_flag: boolean;
  /** 数据来源 */
  source: string;
  /** 备注 */
  notes: string;
}

/** 解析后的成分条目 */
export interface ParsedIngredient {
  /** 原始文本片段 */
  raw: string;
  /** 归一化后用于匹配的键 */
  canonical: string;
  /** 匹配到的数据库 ID，未匹配为 null */
  ingredientId: string | null;
  /** 是否在数据库中找到 */
  matched: boolean;
  /** 在成分表中的位置（从 0 开始） */
  position: number;
  /** 与前面哪个条目重复（重复出现次数，1 表示首次出现） */
  occurrence: number;
  /** 是否来自「可能含有 / May Contain」段落 */
  mayContain: boolean;
}

/** 用户画像 */
export interface UserProfile {
  nickname: string;
  skinType: SkinType | null;
  skinConcerns: SkinConcern[];
  goals: SkinGoal[];
  /** 用户主动关注（想了解）的成分 */
  watchedIngredients: string[];
  /** 用户希望避开的成分 */
  avoidedIngredients: string[];
  updatedAt: string;
}

/** 分析时冻结的用户画像快照，保证历史记录可复现 */
export interface ProfileSnapshot {
  skinType: SkinType | null;
  skinConcerns: SkinConcern[];
  goals: SkinGoal[];
  watchedIngredients: string[];
  avoidedIngredients: string[];
}

/* ------------------------------------------------------------------ */
/* AI 结构化输出                                                       */
/* ------------------------------------------------------------------ */

export type RelevanceLevel = "high" | "medium" | "low";

export interface MatchedGoal {
  goal: SkinGoal;
  relatedIngredients: string[];
  relevance: RelevanceLevel;
  explanation: string;
}

export type WatchItemType =
  | "allergen"
  | "irritation"
  | "user_watch"
  | "user_avoid"
  | "fragrance"
  | "preservative"
  | "acne_related"
  | "other";

export interface WatchItem {
  ingredient: string;
  type: WatchItemType;
  reason: string;
  userRelated: boolean;
}

export interface SkinCompatibility {
  summary: string;
  positives: string[];
  attentions: string[];
}

export interface IngredientExplanation {
  ingredient: string;
  functions: string[];
  explanation: string;
  relatedToUser: boolean;
}

export interface FormulaStructureItem {
  /** 结构分组，例如「保湿」「润肤」「功能性成分」 */
  group: string;
  /** 该分组下的成分名 */
  ingredients: string[];
  /** 相对占比评分 0-100（按成分数量与在成分表中的位置估算） */
  score: number;
  /** 一句话说明 */
  note: string;
}

export interface FormulaOverview {
  /** 配方偏向的一句话结论 */
  summary: string;
  structure: FormulaStructureItem[];
}

export interface AnalysisResult {
  /** AI 一句话总结 */
  summary: string;
  formulaOverview: FormulaOverview;
  /** 结合用户画像的整体个性化说明 */
  personalizedAnalysis: string;
  matchedGoals: MatchedGoal[];
  watchItems: WatchItem[];
  skinCompatibility: SkinCompatibility;
  ingredientExplanations: IngredientExplanation[];
  /** 推荐给用户的追问 */
  questionsStarter: string[];
}

export type AnalysisEngine = "llm" | "rule";

export interface AnalysisMeta {
  engine: AnalysisEngine;
  model: string | null;
  generatedAt: string;
  /** 需要提示给用户的说明，例如「未设置肤质，使用通用分析」 */
  notices: string[];
}

/** 一次完整的分析记录（持久化单元） */
export interface AnalysisRecord {
  id: string;
  productName: string;
  productType: ProductType;
  rawIngredients: string;
  parsedIngredients: ParsedIngredient[];
  /** 未能匹配数据库的成分原文 */
  unmatchedIngredients: string[];
  analysis: AnalysisResult;
  meta: AnalysisMeta;
  profileSnapshot: ProfileSnapshot;
  createdAt: string;
  favorite: boolean;
}

export interface AnalyzeRequestPayload {
  productName: string;
  productType: ProductType;
  rawIngredients: string;
  profile: ProfileSnapshot;
}

export interface AnalyzeResponsePayload {
  record: AnalysisRecord;
}

/* ------------------------------------------------------------------ */
/* AI 问答                                                             */
/* ------------------------------------------------------------------ */

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  engine?: AnalysisEngine;
}

export interface ChatRequestPayload {
  /** 当前产品上下文 */
  product: {
    name: string;
    type: ProductType;
    /** 解析后的成分（含数据库匹配结果），用于服务端推理 */
    ingredients: { raw: string; ingredientId: string | null }[];
  };
  analysis: AnalysisResult;
  profile: ProfileSnapshot;
  messages: { role: "user" | "assistant"; content: string }[];
}

export interface ChatResponsePayload {
  reply: string;
  engine: AnalysisEngine;
  suggestions: string[];
}

/* ------------------------------------------------------------------ */
/* 产品对比                                                            */
/* ------------------------------------------------------------------ */

export interface CompareSideSummary {
  id: string;
  productName: string;
  productType: ProductType;
  ingredientCount: number;
  structure: FormulaStructureItem[];
  goalHits: MatchedGoal[];
  watchItems: WatchItem[];
  compatibility: SkinCompatibility;
}

export interface CompareResult {
  left: CompareSideSummary;
  right: CompareSideSummary;
  /** 两款产品都含有的成分 */
  sharedIngredients: string[];
  /** 仅左侧含有的成分 */
  onlyLeft: string[];
  /** 仅右侧含有的成分 */
  onlyRight: string[];
  /** 配方结构差异的客观说明 */
  structureDiff: { group: string; leftScore: number; rightScore: number; note: string }[];
  /** 与当前用户画像的差异说明 */
  profileDiff: string[];
  /** AI 对比总结（不做优劣排名） */
  summary: string;
  meta: AnalysisMeta;
}

/** 记录中用于对比的精简快照 */
export interface CompareRequestPayload {
  left: CompareInputSide;
  right: CompareInputSide;
  profile: ProfileSnapshot;
}

export interface CompareInputSide {
  id: string;
  name: string;
  type: ProductType;
  ingredients: string[];
  structure: FormulaStructureItem[];
  goalHits: MatchedGoal[];
  watchItems: WatchItem[];
  compatibility: SkinCompatibility;
}
