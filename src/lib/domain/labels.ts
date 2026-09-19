import type {
  IngredientCategory,
  ProductType,
  SkinConcern,
  SkinGoal,
  SkinType,
  WatchItemType,
} from "./types";

export const APP_NAME = "SkinLens AI";
export const APP_TAGLINE = "看懂成分，更了解它是否适合你。";

/** 全站统一的免责声明 */
export const MEDICAL_DISCLAIMER =
  "成分分析基于公开成分资料与配方结构推断，不构成医疗诊断或医学建议。如有皮肤问题请咨询专业医生。";

export const INFO_DATA_NOTICE =
  "成分资料为信息性科普内容，用于帮助你理解成分与配方结构，不代表医学结论。";

export const SKIN_TYPE_LABELS: Record<SkinType, string> = {
  dry: "干性",
  oily: "油性",
  combination: "混合性",
  normal: "中性",
  unsure: "不确定",
};

export const SKIN_CONCERN_LABELS: Record<SkinConcern, string> = {
  redness: "容易泛红",
  acne: "容易长痘",
  dryness: "容易干燥",
  oiliness: "容易出油",
  stinging: "容易刺痛",
  pores: "毛孔困扰",
};

export const SKIN_GOAL_LABELS: Record<SkinGoal, string> = {
  whitening: "美白",
  anti_aging: "抗皱",
  hydration: "保湿",
  barrier: "修护屏障",
  soothing: "舒缓",
  oil_control: "控油",
  pores: "毛孔",
  antioxidant: "抗氧化",
};

export const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  cream: "面霜",
  serum: "精华",
  toner: "化妆水",
  sunscreen: "防晒",
  mask: "面膜",
  cleanser: "洁面",
  makeup: "彩妆",
  other: "其他",
};

export const INGREDIENT_CATEGORY_LABELS: Record<IngredientCategory, string> = {
  solvent: "溶剂",
  humectant: "保湿剂",
  emollient: "润肤剂",
  occlusive: "封闭剂",
  emulsifier: "乳化剂",
  thickener: "增稠剂",
  active: "功能性成分",
  soothing: "舒缓成分",
  fragrance: "香精香料",
  preservative: "防腐剂",
  uv_filter: "防晒剂",
  surfactant: "表面活性剂",
  ph_adjuster: "pH 调节剂",
  colorant: "着色剂",
  chelating: "螯合剂",
  other: "其他",
};

export const WATCH_TYPE_LABELS: Record<WatchItemType, string> = {
  allergen: "潜在过敏关注",
  irritation: "潜在刺激关注",
  user_watch: "你的关注成分",
  user_avoid: "你的避开成分",
  fragrance: "香精相关",
  preservative: "防腐体系",
  acne_related: "与痘痘话题相关",
  other: "其他",
};

export const RELEVANCE_LABELS: Record<"high" | "medium" | "low", string> = {
  high: "成分数量较多",
  medium: "有相关成分",
  low: "少量相关成分",
};

/** 配方结构分组顺序（用于结果页展示顺序固定） */
export const STRUCTURE_GROUPS = [
  "保湿",
  "润肤",
  "功能性成分",
  "舒缓",
  "香精相关",
  "防腐体系",
] as const;

export type StructureGroup = (typeof STRUCTURE_GROUPS)[number];
