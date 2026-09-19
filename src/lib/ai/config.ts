/**
 * AI 运行配置
 *
 * 所有 Key 只在服务端读取，浏览器端拿不到。
 */

export type AiMode = "llm" | "mock";

export interface AiRuntimeConfig {
  mode: AiMode;
  hasApiKey: boolean;
  model: string;
  baseUrl: string;
  /** 处于 Mock 模式的原因（用于界面提示） */
  reason: string | null;
}

const DEFAULT_MODEL = "gpt-4o-mini";
const DEFAULT_BASE_URL = "https://api.openai.com/v1";

/** 常见布尔写法，用于读取「强制演示模式」开关 */
function readBooleanFlag(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

export function getAiConfig(): AiRuntimeConfig {
  const apiKey = process.env.OPENAI_API_KEY?.trim() ?? "";
  // 支持两种写法：MOCK_AI=true（推荐，语义直观）与 SKINLENS_FORCE_MOCK=1（历史写法）
  const forcedMock =
    readBooleanFlag(process.env.MOCK_AI) || readBooleanFlag(process.env.SKINLENS_FORCE_MOCK);
  const forcedMockSource = readBooleanFlag(process.env.MOCK_AI)
    ? "MOCK_AI"
    : "SKINLENS_FORCE_MOCK";
  const model = process.env.AI_MODEL?.trim() || DEFAULT_MODEL;
  const baseUrl = (process.env.OPENAI_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, "");

  if (forcedMock) {
    return {
      mode: "mock",
      hasApiKey: Boolean(apiKey),
      model,
      baseUrl,
      reason: `已通过环境变量 ${forcedMockSource}=true 强制使用演示模式。`,
    };
  }

  if (!apiKey) {
    return {
      mode: "mock",
      hasApiKey: false,
      model,
      baseUrl,
      reason: "未配置 OPENAI_API_KEY，当前使用本地演示分析模式（Mock AI Mode）。",
    };
  }

  return { mode: "llm", hasApiKey: true, model, baseUrl, reason: null };
}

export function isMockMode(): boolean {
  return getAiConfig().mode === "mock";
}
