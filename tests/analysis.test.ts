import assert from "node:assert/strict";
import test from "node:test";

import { buildLocalAnalysis } from "../src/lib/analysis/rules.ts";
import {
  computeFormulaStructure,
  resolveIngredients,
  STRUCTURE_RULES,
} from "../src/lib/analysis/structure.ts";
import { chineseIngredientLabel } from "../src/lib/display.ts";
import type { ProfileSnapshot } from "../src/lib/domain/types.ts";
import { parseIngredients } from "../src/lib/ingredients/parser.ts";

const SERUM = [
  "Water, Glycerin, Niacinamide, Butylene Glycol, Panthenol, Sodium Hyaluronate,",
  "Centella Asiatica Extract, Tranexamic Acid, Tocopherol, Carbomer,",
  "Phenoxyethanol, Ethylhexylglycerin, Fragrance, Linalool, Limonene",
].join(" ");

const SOOTHING_PROFILE: ProfileSnapshot = {
  skinType: "dry",
  skinConcerns: ["redness", "stinging"],
  goals: ["whitening", "hydration"],
  watchedIngredients: ["Niacinamide"],
  avoidedIngredients: ["Fragrance"],
};

const OILY_PROFILE: ProfileSnapshot = {
  skinType: "oily",
  skinConcerns: ["acne"],
  goals: ["oil_control"],
  watchedIngredients: [],
  avoidedIngredients: [],
};

function analyze(profile: ProfileSnapshot) {
  const { items } = parseIngredients(SERUM);
  const resolved = resolveIngredients(items);
  const structure = computeFormulaStructure(resolved);
  return buildLocalAnalysis({
    productName: "测试精华",
    productTypeLabel: "精华",
    ingredients: resolved,
    profile,
    structure,
  });
}

test("配方结构覆盖需求中要求的六个维度", () => {
  const { items } = parseIngredients(SERUM);
  const structure = computeFormulaStructure(resolveIngredients(items));
  const groups = structure.map((item) => item.group);
  for (const required of ["保湿", "功能性成分", "舒缓", "香精相关", "防腐体系"]) {
    assert.ok(groups.includes(required), `缺少分组：${required}`);
  }
  // 润肤维度始终存在于分组定义中，只是这款精华里没有润肤类成分
  assert.ok(STRUCTURE_RULES.some((rule) => rule.group === "润肤"));
  const total = structure.reduce((sum, item) => sum + item.score, 0);
  assert.ok(total > 0 && total <= 110, `结构比重合计异常：${total}`);
});

test("关注功效会匹配到对应成分", () => {
  const result = analyze(SOOTHING_PROFILE);
  const whitening = result.matchedGoals.find((item) => item.goal === "whitening");
  assert.ok(whitening);
  assert.ok(whitening.relatedIngredients.length > 0);
  assert.match(whitening.explanation, /美白/);
});

test("用户设置的避开成分会在 watchItems 中高优先级出现", () => {
  const result = analyze(SOOTHING_PROFILE);
  const avoid = result.watchItems.filter((item) => item.type === "user_avoid");
  assert.equal(avoid.length, 1);
  assert.equal(result.watchItems[0].type, "user_avoid");
  assert.match(avoid[0].reason, /避开/);
});

test("香精与潜在刺激因素会被区分成不同类别", () => {
  const result = analyze(SOOTHING_PROFILE);
  const types = new Set(result.watchItems.map((item) => item.type));
  assert.ok(types.has("allergen"));
  assert.ok(types.has("irritation"));
  const allergen = result.watchItems.find((item) => item.type === "allergen");
  assert.match(allergen?.reason ?? "", /敏感|致敏|香精/);
});

test("偏敏感画像会得到更多「建议关注」提示", () => {
  const sensitive = analyze(SOOTHING_PROFILE);
  const oily = analyze(OILY_PROFILE);
  const sensitiveAttention = sensitive.skinCompatibility.attentions.join("");
  const oilyAttention = oily.skinCompatibility.attentions.join("");
  assert.match(sensitiveAttention, /耐受|泛红|刺痛/);
  assert.notEqual(sensitiveAttention, oilyAttention);
});

test("修改画像后同一产品的分析结果会发生变化", () => {
  const first = analyze(SOOTHING_PROFILE);
  const second = analyze(OILY_PROFILE);
  assert.notEqual(first.summary, second.summary);
  assert.notEqual(first.personalizedAnalysis, second.personalizedAnalysis);
  assert.notDeepEqual(first.matchedGoals, second.matchedGoals);
});

test("不会输出绝对化或医疗化的措辞", () => {
  const result = analyze(SOOTHING_PROFILE);
  const text = [
    result.summary,
    result.personalizedAnalysis,
    result.formulaOverview.summary,
    ...result.watchItems.map((item) => item.reason),
    ...result.skinCompatibility.attentions,
  ].join(" ");
  for (const banned of ["有毒", "危险产品", "一定过敏", "100% 安全", "可以治疗", "百分百"]) {
    assert.ok(!text.includes(banned), `出现了不建议的措辞：${banned}`);
  }
});

test("面向用户的成分说明只使用中文名称", () => {
  const result = analyze(SOOTHING_PROFILE);
  const labels = [
    ...result.watchItems.map((item) => item.ingredient),
    ...result.ingredientExplanations.map((item) => item.ingredient),
    ...result.formulaOverview.structure.flatMap((item) => item.ingredients),
    ...result.matchedGoals.flatMap((item) => item.relatedIngredients),
  ];
  assert.ok(labels.length > 0);
  for (const label of labels) {
    assert.ok(!/[A-Za-z]{3,}/.test(label), `出现了英文成分名：${label}`);
  }
});

test("中英文写法都能转换为中文展示名", () => {
  assert.equal(chineseIngredientLabel("Niacinamide"), "烟酰胺");
  assert.equal(chineseIngredientLabel("Fragrance"), "香精");
  assert.equal(chineseIngredientLabel("Linalool"), "芳樟醇");
  assert.equal(chineseIngredientLabel("烟酰胺（Niacinamide）"), "烟酰胺");
  assert.equal(chineseIngredientLabel("玻尿酸"), "透明质酸钠");
  assert.equal(chineseIngredientLabel("未收录的成分 X"), "未收录的成分 X");
});
