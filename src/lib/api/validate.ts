import type {
  AnalysisResult,
  ChatRequestPayload,
  CompareRequestPayload,
  ProductType,
  ProfileSnapshot,
  SkinConcern,
  SkinGoal,
  SkinType,
} from "../domain/types";

const SKIN_TYPES: SkinType[] = ["dry", "oily", "combination", "normal", "unsure"];
const SKIN_CONCERNS: SkinConcern[] = [
  "redness",
  "acne",
  "dryness",
  "oiliness",
  "stinging",
  "pores",
];
const SKIN_GOALS: SkinGoal[] = [
  "whitening",
  "anti_aging",
  "hydration",
  "barrier",
  "soothing",
  "oil_control",
  "pores",
  "antioxidant",
];
const PRODUCT_TYPES: ProductType[] = [
  "cream",
  "serum",
  "toner",
  "sunscreen",
  "mask",
  "cleanser",
  "makeup",
  "other",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringList(value: unknown, limit = 40): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim().slice(0, 80))
    .slice(0, limit);
}

function enumList<T extends string>(value: unknown, allowed: T[]): T[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is T => typeof item === "string" && allowed.includes(item as T));
}

export function parseProfile(value: unknown): ProfileSnapshot {
  const raw = isRecord(value) ? value : {};
  const skinType = SKIN_TYPES.includes(raw.skinType as SkinType)
    ? (raw.skinType as SkinType)
    : null;
  return {
    skinType,
    skinConcerns: enumList(raw.skinConcerns, SKIN_CONCERNS),
    goals: enumList(raw.goals, SKIN_GOALS),
    watchedIngredients: stringList(raw.watchedIngredients),
    avoidedIngredients: stringList(raw.avoidedIngredients),
  };
}

export function parseProductType(value: unknown): ProductType {
  return PRODUCT_TYPES.includes(value as ProductType) ? (value as ProductType) : "other";
}

export function parseAnalyzeBody(body: unknown): {
  productName: string;
  productType: ProductType;
  rawIngredients: string;
  profile: ProfileSnapshot;
} | null {
  if (!isRecord(body)) return null;
  const rawIngredients = typeof body.rawIngredients === "string" ? body.rawIngredients : "";
  if (!rawIngredients.trim()) return null;
  return {
    productName: typeof body.productName === "string" ? body.productName.slice(0, 120) : "",
    productType: parseProductType(body.productType),
    rawIngredients: rawIngredients.slice(0, 12000),
    profile: parseProfile(body.profile),
  };
}

export function parseChatBody(body: unknown): ChatRequestPayload | null {
  if (!isRecord(body)) return null;
  const product = isRecord(body.product) ? body.product : null;
  const analysis = isRecord(body.analysis) ? (body.analysis as unknown as AnalysisResult) : null;
  if (!product || !Array.isArray(product.ingredients) || !analysis) return null;

  const messages = Array.isArray(body.messages)
    ? body.messages
        .filter((item): item is Record<string, unknown> => isRecord(item))
        .map((item) => ({
          role: item.role === "assistant" ? ("assistant" as const) : ("user" as const),
          content: typeof item.content === "string" ? item.content.slice(0, 2000) : "",
        }))
        .filter((item) => item.content.trim().length > 0)
        .slice(-10)
    : [];

  return {
    product: {
      name: typeof product.name === "string" ? product.name.slice(0, 120) : "",
      type: parseProductType(product.type),
      ingredients: product.ingredients
        .filter((item): item is Record<string, unknown> => isRecord(item))
        .map((item) => ({
          raw: typeof item.raw === "string" ? item.raw.slice(0, 200) : "",
          ingredientId: typeof item.ingredientId === "string" ? item.ingredientId : null,
        }))
        .filter((item) => item.raw.length > 0)
        .slice(0, 220),
    },
    analysis,
    profile: parseProfile(body.profile),
    messages,
  };
}

function parseCompareSide(value: unknown): CompareRequestPayload["left"] | null {
  if (!isRecord(value)) return null;
  const analysisLike = isRecord(value) ? value : {};
  return {
    id: typeof value.id === "string" ? value.id : "unknown",
    name: typeof value.name === "string" ? value.name.slice(0, 120) : "未命名产品",
    type: parseProductType(value.type),
    ingredients: stringList(value.ingredients, 220),
    structure: Array.isArray(value.structure)
      ? (value.structure as CompareRequestPayload["left"]["structure"]).slice(0, 12)
      : [],
    goalHits: Array.isArray(value.goalHits)
      ? (value.goalHits as CompareRequestPayload["left"]["goalHits"]).slice(0, 12)
      : [],
    watchItems: Array.isArray(value.watchItems)
      ? (value.watchItems as CompareRequestPayload["left"]["watchItems"]).slice(0, 40)
      : [],
    compatibility:
      isRecord(analysisLike.compatibility) &&
      typeof analysisLike.compatibility.summary === "string"
        ? (analysisLike.compatibility as unknown as CompareRequestPayload["left"]["compatibility"])
        : { summary: "暂无匹配说明。", positives: [], attentions: [] },
  };
}

export function parseCompareBody(body: unknown): CompareRequestPayload | null {
  if (!isRecord(body)) return null;
  const left = parseCompareSide(body.left);
  const right = parseCompareSide(body.right);
  if (!left || !right) return null;
  if (left.ingredients.length === 0 || right.ingredients.length === 0) return null;
  return { left, right, profile: parseProfile(body.profile) };
}
