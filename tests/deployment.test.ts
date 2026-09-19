import assert from "node:assert/strict";
import test from "node:test";

import { analyzeProduct } from "../src/lib/ai/analyze.ts";
import { getAiConfig } from "../src/lib/ai/config.ts";
import { checkRateLimit, rateLimitResponse } from "../src/lib/api/rate-limit.ts";
import { createDemoProfile, DEMO_PRODUCTS } from "../src/lib/demo/data.ts";

test("演示数据包含示例画像与三款示例产品", () => {
  const profile = createDemoProfile();
  assert.ok(profile.skinType);
  assert.ok(profile.goals.length >= 3);
  assert.ok(profile.watchedIngredients.length > 0);
  assert.ok(profile.avoidedIngredients.length > 0);
  assert.equal(DEMO_PRODUCTS.length, 3);
  const types = DEMO_PRODUCTS.map((item) => item.type);
  assert.ok(types.includes("serum"));
  assert.ok(types.includes("cream"));
});

test("公网未配置任何环境变量时，应用仍然可用（自动进入演示模式）", () => {
  // 部署平台上的默认状态：没有 OPENAI_API_KEY、没有 MOCK_AI
  if (process.env.OPENAI_API_KEY || process.env.MOCK_AI) return;
  const config = getAiConfig();
  assert.equal(config.mode, "mock");
  assert.equal(config.hasApiKey, false);
  assert.ok(config.reason && config.reason.length > 0);
});

test("演示数据完全由本地规则引擎生成，不依赖外部 AI", async () => {
  const profile = createDemoProfile();
  for (const product of DEMO_PRODUCTS) {
    const record = await analyzeProduct(
      {
        productName: product.name,
        productType: product.type,
        rawIngredients: product.text,
        profile,
      },
      { preferLocal: true },
    );

    assert.equal(record.meta.engine, "rule");
    assert.equal(record.meta.model, null);
    assert.ok(record.parsedIngredients.length >= 5);
    assert.ok(record.analysis.summary.length > 10);
    assert.ok(record.analysis.questionsStarter.length > 0);
    // 演示数据不能被标记成「由 AI 模型生成」
    assert.ok(!record.meta.notices.some((notice) => notice.includes("AI 模型（")));
  }
});

test("同一来源超过限流阈值会返回 429 而不是继续请求 AI", () => {
  const request = new Request("https://demo.example.com/api/analyze", {
    method: "POST",
    headers: { "x-forwarded-for": "203.0.113.9" },
  });

  assert.equal(checkRateLimit(request, "unit-test", 2).ok, true);
  assert.equal(checkRateLimit(request, "unit-test", 2).ok, true);

  const blocked = checkRateLimit(request, "unit-test", 2);
  assert.equal(blocked.ok, false);
  assert.ok(blocked.retryAfter >= 1);

  const response = rateLimitResponse("unit-test", blocked);
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("Retry-After"), String(blocked.retryAfter));
});

test("不同来源 IP 之间互不影响", () => {
  const makeRequest = (ip: string) =>
    new Request("https://demo.example.com/api/chat", {
      method: "POST",
      headers: { "x-forwarded-for": ip },
    });

  assert.equal(checkRateLimit(makeRequest("198.51.100.1"), "unit-test-ip", 1).ok, true);
  assert.equal(checkRateLimit(makeRequest("198.51.100.2"), "unit-test-ip", 1).ok, true);
  assert.equal(checkRateLimit(makeRequest("198.51.100.1"), "unit-test-ip", 1).ok, false);
});
