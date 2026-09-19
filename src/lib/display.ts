import { findIngredientByName } from "./ingredients/lookup";

/**
 * 展示层的中文转换工具
 *
 * 产品面向中文用户，因此在界面上优先展示中文成分名。
 * INCI 英文名只在「完整成分表」的详情里以「INCI 名称」单独给出，
 * 方便用户对照包装，而不会出现在结论性文案中。
 */

/** 去掉「（INCI）」这类括号补充，留下主体名称 */
export function baseIngredientName(label: string): string {
  return label
    .replace(/[（(][^）)]*[）)]?/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 把任意写法的成分名（中文名 / 英文 INCI / 别名）统一转换为中文展示名。
 * 无法识别时返回原文（例如成分库未收录的成分）。
 */
export function chineseIngredientLabel(label: string): string {
  const candidates = [label, baseIngredientName(label)];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const record = findIngredientByName(candidate);
    if (record) return record.chinese_name;
  }
  return label;
}
