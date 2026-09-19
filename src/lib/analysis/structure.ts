import type {
  FormulaStructureItem,
  IngredientCategory,
  IngredientRecord,
  ParsedIngredient,
} from "../domain/types";
import { getIngredientById } from "../ingredients/lookup";

/** 已解析成分 + 数据库记录的组合视图 */
export interface ResolvedIngredient {
  parsed: ParsedIngredient;
  record: IngredientRecord | null;
  /** 展示名：优先「中文名（INCI）」 */
  displayName: string;
  position: number;
}

export function resolveIngredients(items: ParsedIngredient[]): ResolvedIngredient[] {
  return items.map((parsed) => {
    const record = parsed.ingredientId ? getIngredientById(parsed.ingredientId) ?? null : null;
    return {
      parsed,
      record,
      displayName: record
        ? record.chinese_name === record.inci_name
          ? record.inci_name
          : `${record.chinese_name}（${record.inci_name}）`
        : parsed.raw,
      position: parsed.position,
    };
  });
}

/** 配方结构分组（涵盖需求中要求的六个维度，并补充防晒与基底类） */
export const STRUCTURE_RULES: {
  group: string;
  categories: IngredientCategory[];
  note: string;
}[] = [
  {
    group: "保湿",
    categories: ["humectant", "occlusive"],
    note: "帮助皮肤保持水润感、减少水分流失",
  },
  { group: "润肤", categories: ["emollient"], note: "影响肤感与柔润度" },
  {
    group: "功能性成分",
    categories: ["active"],
    note: "通常与提亮、抗皱、角质护理等诉求相关",
  },
  { group: "舒缓", categories: ["soothing"], note: "常见于偏舒适取向的配方" },
  { group: "香精相关", categories: ["fragrance"], note: "提供香气，也是常见致敏来源" },
  { group: "防腐体系", categories: ["preservative"], note: "抑制微生物生长，保证使用安全" },
  {
    group: "防晒与着色",
    categories: ["uv_filter", "colorant"],
    note: "防晒或调整产品外观",
  },
  {
    group: "基底与质地辅助",
    categories: [
      "solvent",
      "emulsifier",
      "thickener",
      "surfactant",
      "ph_adjuster",
      "chelating",
      "other",
    ],
    note: "构成配方基底、质地与稳定性",
  },
];

/**
 * 估算分组的相对比重。
 *
 * 说明：真实配方比例属于厂商信息，外部无法得知。这里用
 * 「成分数量 + 在成分表中的排序位置」做加权估算：越靠前的成分通常含量越高，权重更大。
 * 展示时会明确标注这是估算值，不代表真实含量百分比。
 */
function weightForPosition(position: number): number {
  return 1 / (1 + position * 0.28);
}

export function computeFormulaStructure(items: ResolvedIngredient[]): FormulaStructureItem[] {
  const totalWeight = items.reduce((sum, item) => sum + weightForPosition(item.position), 0);
  if (totalWeight <= 0) return [];

  return STRUCTURE_RULES.map((rule) => {
    const groupItems = items.filter(
      (item) => item.record && rule.categories.includes(item.record.category),
    );
    const weight = groupItems.reduce((sum, item) => sum + weightForPosition(item.position), 0);
    const score = Math.round((weight / totalWeight) * 100);
    const names = groupItems
      .slice(0, 6)
      .map((item) => item.record?.chinese_name ?? item.parsed.raw);
    return {
      group: rule.group,
      ingredients: names,
      score,
      note:
        groupItems.length > 0
          ? `${rule.note}（${groupItems.length} 项）`
          : "本次未识别到相关成分",
    };
  }).filter((item) => item.score > 0 && item.ingredients.length > 0);
}

/**
 * 取出配方中比重最高的分组名。
 *
 * 用于「整体偏向……」这类结论性描述，因此会排除「基底与质地辅助」「防腐体系」这两个
 * 主要体现配方工艺、而非产品定位的分组；如果排除后没有可用分组，则回退到完整列表。
 */
const SUMMARY_EXCLUDED_GROUPS = new Set(["基底与质地辅助", "防腐体系"]);

export function dominantGroups(structure: FormulaStructureItem[], limit = 2): string[] {
  const meaningful = structure.filter(
    (item) => item.ingredients.length > 0 && !SUMMARY_EXCLUDED_GROUPS.has(item.group),
  );
  const pool = meaningful.length > 0 ? meaningful : structure.filter((item) => item.ingredients.length > 0);
  return [...pool]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.group);
}
