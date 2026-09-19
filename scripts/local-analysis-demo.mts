/**
 * 本地分析演示脚本
 *
 * 不启动网页，直接在终端里查看「本地演示模式」为一款产品生成的结构化分析结果，
 * 适合快速检查成分解析、配方结构估算与个性化分析的效果。
 *
 * 用法：npm run demo
 */

process.env.SKINLENS_FORCE_MOCK = "1";

const { analyzeProduct } = await import("../src/lib/ai/analyze.ts");
const { PRODUCT_TYPE_LABELS, SKIN_GOAL_LABELS } = await import("../src/lib/domain/labels.ts");

const record = await analyzeProduct({
  productName: "净透焕亮精华（示例）",
  productType: "serum",
  rawIngredients:
    "Water, Glycerin, Niacinamide, Butylene Glycol, Panthenol, Sodium Hyaluronate, " +
    "Centella Asiatica Extract, Tranexamic Acid, Tocopherol, Carbomer, " +
    "Phenoxyethanol, Ethylhexylglycerin, Disodium EDTA, Fragrance, Linalool, Limonene",
  profile: {
    skinType: "combination",
    skinConcerns: ["oiliness", "pores", "redness"],
    goals: ["whitening", "anti_aging", "hydration"],
    watchedIngredients: ["Niacinamide"],
    avoidedIngredients: ["Fragrance", "Alcohol Denat."],
  },
});

const analysis = record.analysis;

console.log("=".repeat(60));
console.log(`产品：${record.productName}（${PRODUCT_TYPE_LABELS[record.productType]}）`);
console.log(`引擎：${record.meta.engine} / 解析成分 ${record.parsedIngredients.length} 项`);
console.log("=".repeat(60));

console.log("\n【AI 总结】");
console.log(analysis.summary);

console.log("\n【结合你的画像】");
console.log(analysis.personalizedAnalysis);

console.log("\n【配方结构】");
console.log(analysis.formulaOverview.summary);
for (const item of analysis.formulaOverview.structure) {
  console.log(`  ${item.group} 约 ${item.score}% — ${item.ingredients.join("、")}`);
}

console.log("\n【与你的关注】");
for (const goal of analysis.matchedGoals) {
  console.log(
    `  · ${SKIN_GOAL_LABELS[goal.goal]} [${goal.relevance}] ${
      goal.relatedIngredients.join("、") || "暂未发现相关成分"
    }`,
  );
}

console.log("\n【与你的肤质】");
console.log(`  ${analysis.skinCompatibility.summary}`);
for (const item of analysis.skinCompatibility.positives) console.log(`  ✓ ${item}`);
for (const item of analysis.skinCompatibility.attentions) console.log(`  ⚠ ${item}`);

console.log("\n【值得关注】");
for (const item of analysis.watchItems) {
  console.log(`  · [${item.type}] ${item.ingredient}`);
  console.log(`    ${item.reason}`);
}

console.log("\n【提示】");
for (const notice of record.meta.notices) console.log(`  · ${notice}`);
