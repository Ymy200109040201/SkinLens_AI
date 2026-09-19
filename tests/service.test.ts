import assert from "node:assert/strict";
import test from "node:test";

process.env.SKINLENS_FORCE_MOCK = "1";

import { analyzeProduct } from "../src/lib/ai/analyze.ts";
import { answerQuestion } from "../src/lib/ai/chat.ts";
import { compareProducts } from "../src/lib/ai/compare.ts";
import type { ProfileSnapshot } from "../src/lib/domain/types.ts";
import { AppError } from "../src/lib/errors.ts";
import { toChatPayload, toCompareSide } from "../src/lib/report.ts";

const PROFILE: ProfileSnapshot = {
  skinType: "combination",
  skinConcerns: ["oiliness", "pores"],
  goals: ["whitening", "anti_aging", "hydration"],
  watchedIngredients: ["Niacinamide"],
  avoidedIngredients: ["Fragrance"],
};

const SERUM = "Water, Glycerin, Niacinamide, Panthenol, Sodium Hyaluronate, Adenosine, Carbomer, Phenoxyethanol, Fragrance, Limonene";
const CREAM = "Aqua, Glycerin, Squalane, Ceramide NP, Cholesterol, Panthenol, Cetearyl Alcohol, Dimethicone, Phenoxyethanol, Tocopheryl Acetate";

test("未配置 AI Key 时会使用本地演示模式完成分析", async () => {
  const record = await analyzeProduct({
    productName: "测试精华",
    productType: "serum",
    rawIngredients: SERUM,
    profile: PROFILE,
  });

  assert.equal(record.meta.engine, "rule");
  assert.ok(record.id.length > 0);
  assert.equal(record.parsedIngredients.length, 10);
  assert.ok(record.analysis.summary.length > 10);
  assert.ok(record.analysis.matchedGoals.length === PROFILE.goals.length);
  assert.ok(record.analysis.formulaOverview.structure.length > 0);
  assert.ok(record.analysis.questionsStarter.length > 0);
  assert.deepEqual(record.profileSnapshot, PROFILE);
  assert.ok(record.meta.notices.some((notice) => notice.includes("本地") || notice.includes("演示")));
});

test("未设置画像时会给出通用分析提示", async () => {
  const record = await analyzeProduct({
    productName: "",
    productType: "cream",
    rawIngredients: CREAM,
    profile: {
      skinType: null,
      skinConcerns: [],
      goals: [],
      watchedIngredients: [],
      avoidedIngredients: [],
    },
  });
  assert.ok(record.meta.notices.some((notice) => notice.includes("还没有设置肤质")));
  assert.equal(record.analysis.matchedGoals.length, 0);
  assert.match(record.productName, /面霜/);
});

test("空成分表与过短成分表会抛出可展示的错误", async () => {
  await assert.rejects(
    () =>
      analyzeProduct({
        productName: "空",
        productType: "serum",
        rawIngredients: "   ",
        profile: PROFILE,
      }),
    (error: unknown) => error instanceof AppError && error.code === "EMPTY_INGREDIENTS",
  );

  await assert.rejects(
    () =>
      analyzeProduct({
        productName: "太短",
        productType: "serum",
        rawIngredients: "Water, Glycerin",
        profile: PROFILE,
      }),
    (error: unknown) => error instanceof AppError && error.code === "TOO_FEW_INGREDIENTS",
  );
});

test("AI 问答会结合当前产品与用户画像回答", async () => {
  const record = await analyzeProduct({
    productName: "测试精华",
    productType: "serum",
    rawIngredients: SERUM,
    profile: PROFILE,
  });

  const hydrationAnswer = await answerQuestion(
    toChatPayload(record, [{ role: "user", content: "这款产品里有哪些保湿成分？" }]),
  );
  assert.equal(hydrationAnswer.engine, "rule");
  assert.match(hydrationAnswer.reply, /保湿/);

  const why = await answerQuestion(
    toChatPayload(record, [{ role: "user", content: "为什么特别提醒「香精」这个成分？" }]),
  );
  assert.match(why.reply, /香精|Fragrance/);

  const goal = await answerQuestion(
    toChatPayload(record, [{ role: "user", content: "我关注抗皱，这里面有哪些相关成分？" }]),
  );
  assert.match(goal.reply, /抗皱/);
  assert.ok(goal.suggestions.length > 0);
});

test("产品对比会给出结构化差异且不做优劣排名", async () => {
  const left = await analyzeProduct({
    productName: "精华 A",
    productType: "serum",
    rawIngredients: SERUM,
    profile: PROFILE,
  });
  const right = await analyzeProduct({
    productName: "面霜 B",
    productType: "cream",
    rawIngredients: CREAM,
    profile: PROFILE,
  });

  const result = await compareProducts({
    left: toCompareSide(left),
    right: toCompareSide(right),
    profile: PROFILE,
  });

  // 面向中文用户：对比结果中的成分名必须是中文
  assert.ok(result.sharedIngredients.some((name) => name.includes("甘油")));
  assert.ok(result.onlyLeft.some((name) => name.includes("烟酰胺")));
  assert.ok(result.onlyRight.some((name) => name.includes("神经酰胺")));
  for (const name of [...result.sharedIngredients, ...result.onlyLeft, ...result.onlyRight]) {
    assert.ok(!/[A-Za-z]{3,}/.test(name), `对比结果中出现了英文成分名：${name}`);
  }
  assert.ok(result.structureDiff.length > 0);
  assert.ok(result.summary.length > 20);
  for (const banned of ["更好", "更安全", "更推荐", "最佳", "排名"]) {
    assert.ok(!result.summary.includes(banned), `对比总结中出现了排名式措辞：${banned}`);
  }
});
