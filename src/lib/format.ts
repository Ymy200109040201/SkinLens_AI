import type {
  IngredientCategory,
  ProductType,
  SkinConcern,
  SkinGoal,
  SkinType,
  WatchItemType,
} from "./domain/types";
import {
  INGREDIENT_CATEGORY_LABELS,
  PRODUCT_TYPE_LABELS,
  SKIN_CONCERN_LABELS,
  SKIN_GOAL_LABELS,
  SKIN_TYPE_LABELS,
  WATCH_TYPE_LABELS,
} from "./domain/labels";

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatRelative(iso: string): string {
  const date = new Date(iso).getTime();
  if (Number.isNaN(date)) return "—";
  const diff = Date.now() - date;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return "刚刚";
  if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`;
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`;
  if (diff < 7 * day) return `${Math.floor(diff / day)} 天前`;
  return formatDateTime(iso).slice(0, 10);
}

export function skinTypeLabel(value: SkinType | null): string {
  return value ? SKIN_TYPE_LABELS[value] : "未设置肤质";
}

export function concernLabels(values: SkinConcern[]): string[] {
  return values.map((value) => SKIN_CONCERN_LABELS[value]);
}

export function goalLabels(values: SkinGoal[]): string[] {
  return values.map((value) => SKIN_GOAL_LABELS[value]);
}

export function productTypeLabel(value: ProductType): string {
  return PRODUCT_TYPE_LABELS[value];
}

export function categoryLabel(value: IngredientCategory | "unknown"): string {
  if (value === "unknown") return "未收录";
  return INGREDIENT_CATEGORY_LABELS[value];
}

export function watchTypeLabel(value: WatchItemType): string {
  return WATCH_TYPE_LABELS[value];
}

export function truncate(text: string, max = 60): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
}

export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
