import type { ParsedIngredient } from "../domain/types";
import { findIngredientByName, normalizeKey } from "./lookup";

/**
 * 成分表解析器
 *
 * 职责：
 * 1. 拆分成分字符串（逗号 / 顿号 / 分号 / 换行 / 项目符号）
 * 2. 清理特殊空格、编号、包裹符号
 * 3. 统一大小写与别名
 * 4. 去重（保留首次出现顺序）
 * 5. 保留原始输入片段
 *
 * 注意：解析与数据库匹配在本地完成，不依赖大模型。
 */

const SPLIT_PATTERN = /[,，;；、\n\r\u2028\u2029]+|\s\/\s|\s{2,}/;

const NOISE_TOKENS = new Set(
  [
    "成分",
    "成分表",
    "配料",
    "全成分",
    "主要成分",
    "其他微量成分",
    "微量成分",
    "ingredients",
    "ingredient",
    "inci",
    "maycontain",
    "可能含有",
    "含有",
  ].map(normalizeKey),
);

const MAY_CONTAIN_PATTERN = /(可能含有|may\s*contain|may contain)/i;

export interface ParseOptions {
  /** 少于该数量则认为是无效输入 */
  minCount?: number;
}

export interface ParseResult {
  items: ParsedIngredient[];
  unmatched: string[];
  totalTokens: number;
}

/** 归一化整段文本：全角符号、异常空格、零宽字符 */
export function normalizeIngredientText(input: string): string {
  return input
    .replace(/[\u200b-\u200d\ufeff]/g, "")
    .replace(/\u00a0|\u3000/g, " ")
    .replace(/[（]/g, "(")
    .replace(/[）]/g, ")")
    .replace(/[【]/g, "(")
    .replace(/[】]/g, ")")
    .replace(/[，]/g, ",")
    .replace(/[；]/g, ";")
    .replace(/[、]/g, "、")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\r\n?/g, "\n");
}

/** 清洗单个 token，去掉编号、项目符号、包裹引号与结尾标点 */
function cleanToken(token: string): string {
  let value = token
    .replace(/^[\s\-–—•·*▪●○※#]+/, "")
    .replace(/^\d+[.)、:：]\s*/, "")
    .replace(/[.。;；,，:：]+$/, "")
    .replace(/\s+/g, " ")
    .trim();

  // 仅当括号成对出现时才去掉最外层包裹的括号，避免破坏 "Niacinamide (Vitamin B3"
  while (value.length > 2 && /^[(\[【]/.test(value) && /[)\]】]$/.test(value)) {
    value = value.slice(1, -1).trim();
  }

  return value.replace(/^["'“”‘’]+/, "").replace(/["'“”‘’]+$/, "").trim();
}

/** 去掉「成分：」这类前缀 */
function stripLeadingLabel(text: string): string {
  return text.replace(
    /^\s*(全成分|成分表|成分|配料|主要成分|ingredients?)\s*[:：]\s*/i,
    "",
  );
}

/**
 * 生成用于数据库匹配的候选键。
 * 例如 "Niacinamide (Vitamin B3)" 会依次尝试整体、括号外、括号内三种形式。
 */
function candidateKeys(raw: string): string[] {
  const keys: string[] = [];
  const pushKey = (value: string) => {
    const key = normalizeKey(value);
    if (key && !keys.includes(key)) keys.push(key);
  };

  pushKey(raw);

  // 去掉括号内容；同时兼容「只有左括号」的截断情况
  const withoutParen = raw.replace(/\([^)]*\)/g, " ").replace(/\([^)]*$/, " ");
  pushKey(withoutParen);

  const parenMatches = raw.match(/\(([^)]*)\)/g) ?? [];
  for (const match of parenMatches) {
    pushKey(match.replace(/[()]/g, " "));
  }

  // "Aqua / Water" 这类写法，逐段尝试
  for (const part of raw.split(/\s*\/\s*/)) {
    pushKey(part);
  }

  return keys;
}

export function parseIngredients(input: string, options: ParseOptions = {}): ParseResult {
  const text = stripLeadingLabel(normalizeIngredientText(input ?? ""));

  // 分离「可能含有」段落，便于在结果中提示
  let mainText = text;
  let mayContainText = "";
  const markerIndex = text.search(MAY_CONTAIN_PATTERN);
  if (markerIndex >= 0) {
    mainText = text.slice(0, markerIndex);
    mayContainText = text.slice(markerIndex).replace(MAY_CONTAIN_PATTERN, "");
  }

  const seen = new Map<string, ParsedIngredient>();
  const items: ParsedIngredient[] = [];

  const consume = (chunk: string, mayContain: boolean) => {
    const tokens = chunk
      .split(SPLIT_PATTERN)
      .map(cleanToken)
      .filter(Boolean);

    for (const token of tokens) {
      const key = normalizeKey(token);
      if (!key) continue;
      if (NOISE_TOKENS.has(key)) continue;
      // 过滤纯数字 / 纯百分比 / 过短的拉丁字母片段
      if (/^[\d.%+\-/]+$/.test(key)) continue;
      if (/^[a-z]{1,2}$/.test(key)) continue;

      const record = candidateKeys(token)
        .map((candidate) => findIngredientByName(candidate))
        .find(Boolean);

      const dedupeKey = record ? `id:${record.ingredient_id}` : `raw:${key}`;
      const existing = seen.get(dedupeKey);
      if (existing) {
        existing.occurrence += 1;
        continue;
      }

      const parsed: ParsedIngredient = {
        raw: token,
        canonical: record ? record.inci_name : token,
        ingredientId: record ? record.ingredient_id : null,
        matched: Boolean(record),
        position: items.length,
        occurrence: 1,
        mayContain,
      };
      seen.set(dedupeKey, parsed);
      items.push(parsed);
    }
  };

  consume(mainText, false);
  if (mayContainText.trim()) {
    consume(mayContainText, true);
  }

  const totalTokens = items.length;
  const unmatched = items.filter((item) => !item.matched).map((item) => item.raw);

  void options;
  return { items, unmatched, totalTokens };
}

/** 供演示与测试使用的示例成分表 */
export const SAMPLE_INGREDIENTS = [
  {
    name: "净透焕亮精华（示例）",
    type: "serum" as const,
    text: "Water, Glycerin, Niacinamide, Butylene Glycol, Panthenol, Sodium Hyaluronate, Centella Asiatica Extract, Tranexamic Acid, Tocopherol, Carbomer, Phenoxyethanol, Ethylhexylglycerin, Disodium EDTA, Fragrance, Linalool, Limonene",
  },
  {
    name: "丰润修护面霜（示例）",
    type: "cream" as const,
    text: "Aqua, Glycerin, Caprylic/Capric Triglyceride, Cetearyl Alcohol, Squalane, Ceramide NP, Cholesterol, Panthenol, Madecassoside, Butyrospermum Parkii Butter, Dimethicone, Ceteareth-20, Carbomer, Phenoxyethanol, Ethylhexylglycerin, Tocopheryl Acetate",
  },
  {
    name: "清爽控油洁面（示例）",
    type: "cleanser" as const,
    // 中文成分表示例：用于说明「中英文成分表都能识别」
    text: "水、椰油酰甘氨酸钠、椰油酰胺丙基甜菜碱、月桂基葡糖苷、甘油、水杨酸、吡咯烷酮羧酸锌、尿囊素、柠檬酸、氯化钠、苯甲酸钠、香精、柠檬烯",
  },
];
