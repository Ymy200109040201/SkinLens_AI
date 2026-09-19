import type { ProductType, UserProfile } from "../domain/types";
import { SAMPLE_INGREDIENTS } from "../ingredients/parser";

/**
 * Demo 数据
 *
 * 目的：让第一次打开产品的用户（评委、试用者）不用准备任何材料，
 * 就能看到「分析 → 报告 → 历史 → 对比 → 问答」的完整效果。
 *
 * 这些数据全部由本地规则引擎生成，不调用外部 AI，也不写入任何服务器，
 * 只保存在试用者自己的浏览器里，并且可以一键清除。
 */

export interface DemoProduct {
  name: string;
  type: ProductType;
  text: string;
}

/** 挂载在演示记录上的提示，让试用者知道这些数据可以清空 */
export const DEMO_NOTICE =
  "这是演示数据，可在「我的 → 数据管理」中一键清除，然后换成你自己的产品。";

/** 示例用户画像：混合性肌肤 + 关注美白 / 保湿 / 抗皱 + 关注烟酰胺 + 避开香精 */
export const DEMO_PROFILE_BASE: Omit<UserProfile, "updatedAt"> = {
  nickname: "小奇",
  skinType: "combination",
  skinConcerns: ["oiliness", "pores"],
  goals: ["whitening", "hydration", "anti_aging"],
  watchedIngredients: ["烟酰胺"],
  avoidedIngredients: ["香精"],
};

export function createDemoProfile(): UserProfile {
  return { ...DEMO_PROFILE_BASE, updatedAt: new Date().toISOString() };
}

/** 三款示例产品：精华 / 面霜 / 洁面（中英文成分表各覆盖一次） */
export const DEMO_PRODUCTS: DemoProduct[] = SAMPLE_INGREDIENTS.map((sample) => ({
  name: sample.name,
  type: sample.type,
  text: sample.text,
}));
