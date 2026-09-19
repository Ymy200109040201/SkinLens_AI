import assert from "node:assert/strict";
import test from "node:test";

import { normalizeIngredientText, parseIngredients } from "../src/lib/ingredients/parser.ts";

test("可以解析逗号分隔的英文成分表", () => {
  const { items } = parseIngredients("Water, Glycerin, Niacinamide, Butylene Glycol");
  assert.equal(items.length, 4);
  assert.equal(items[0].ingredientId, "water");
  assert.equal(items[2].ingredientId, "niacinamide");
  assert.equal(items[2].matched, true);
});

test("可以解析中文顿号与全角逗号分隔的成分表", () => {
  const { items } = parseIngredients("成分：水、甘油、烟酰胺、丁二醇、透明质酸钠");
  assert.equal(items.length, 5);
  assert.equal(items[0].ingredientId, "water");
  assert.equal(items[2].ingredientId, "niacinamide");
  assert.equal(items[4].ingredientId, "sodium-hyaluronate");

  const { items: fullWidth } = parseIngredients("水，甘油，烟酰胺");
  assert.equal(fullWidth.length, 3);
});

test("可以识别常见别名与括号备注", () => {
  const { items } = parseIngredients(
    "Aqua, Glycerol, 玻尿酸, 维生素C, Niacinamide (Vitamin B3), Tocopherol (Vitamin E)",
  );
  const ids = items.map((item) => item.ingredientId);
  assert.ok(ids.includes("water"));
  assert.ok(ids.includes("glycerin"));
  assert.ok(ids.includes("sodium-hyaluronate"));
  assert.ok(ids.includes("ascorbic-acid"));
  assert.ok(ids.includes("niacinamide"));
  assert.ok(ids.includes("tocopherol"));
});

test("重复成分只保留一次并记录出现次数", () => {
  const { items } = parseIngredients("Water, water, AQUA, Glycerin");
  const water = items.find((item) => item.ingredientId === "water");
  assert.ok(water);
  assert.equal(water?.occurrence, 3);
  assert.equal(items.length, 2);
});

test("过滤噪声字段，并保留原始输入", () => {
  const { items } = parseIngredients("全成分：Water, Glycerin, Niacinamide");
  assert.equal(items[0].raw, "Water");
  assert.equal(items.length, 3);
});

test("支持「可能含有」段落并单独标注", () => {
  const { items } = parseIngredients(
    "Water, Glycerin, Niacinamide, May Contain: Limonene, Linalool",
  );
  const limonene = items.find((item) => item.ingredientId === "limonene");
  assert.equal(limonene?.mayContain, true);
  const water = items.find((item) => item.ingredientId === "water");
  assert.equal(water?.mayContain, false);
});

test("未收录成分会保留原文并进入未匹配列表", () => {
  const { items, unmatched } = parseIngredients("Water, Glycerin, Mystery Extract X");
  assert.equal(items.length, 3);
  assert.deepEqual(unmatched, ["Mystery Extract X"]);
});

test("空输入或纯符号输入不会产生成分", () => {
  assert.equal(parseIngredients("").items.length, 0);
  assert.equal(parseIngredients("   ").items.length, 0);
  assert.equal(parseIngredients(", , ,").items.length, 0);
});

test("normalizeIngredientText 会统一全角符号与异常空格", () => {
  const normalized = normalizeIngredientText("水，甘油\u3000;  烟酰胺");
  assert.equal(normalized, "水,甘油 ;  烟酰胺");
});
