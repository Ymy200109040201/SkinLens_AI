import { INGREDIENTS } from "./dataset";
import type { IngredientRecord } from "../domain/types";

/** 归一化：小写、去空格与常见标点，便于跨语言匹配 */
export function normalizeKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\s\u00a0\u3000]+/g, "")
    .replace(/[.。·・\-_/,、;；:：()（）\[\]【】'’"“”*+%]/g, "")
    .trim();
}

const byId = new Map<string, IngredientRecord>();
const byKey = new Map<string, IngredientRecord>();

for (const item of INGREDIENTS) {
  byId.set(item.ingredient_id, item);
  const keys = [item.inci_name, item.chinese_name, ...item.aliases];
  for (const key of keys) {
    const normalized = normalizeKey(key);
    if (normalized && !byKey.has(normalized)) {
      byKey.set(normalized, item);
    }
  }
}

export function getIngredientById(id: string): IngredientRecord | undefined {
  return byId.get(id);
}

export function findIngredientByName(name: string): IngredientRecord | undefined {
  const key = normalizeKey(name);
  if (!key) return undefined;
  const direct = byKey.get(key);
  if (direct) return direct;
  return undefined;
}

export function searchIngredients(query: string, limit = 12): IngredientRecord[] {
  const key = normalizeKey(query);
  if (!key) return [];
  const results: IngredientRecord[] = [];
  for (const item of INGREDIENTS) {
    const haystack = [item.inci_name, item.chinese_name, ...item.aliases].map(normalizeKey);
    if (haystack.some((value) => value.includes(key))) {
      results.push(item);
      if (results.length >= limit) break;
    }
  }
  return results;
}

export function allIngredients(): IngredientRecord[] {
  return INGREDIENTS;
}

export function ingredientCount(): number {
  return INGREDIENTS.length;
}
