import { getAiConfig } from "@/lib/ai/config";

/**
 * 健康检查
 *
 * 用于部署平台监控、部署后自检，以及确认当前跑在哪种 AI 模式。
 * 只返回模式与模型名，不返回任何 Key 信息。
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const config = getAiConfig();
  return Response.json(
    {
      ok: true,
      app: "SkinLens AI",
      mode: config.mode,
      model: config.mode === "llm" ? config.model : null,
      hasApiKey: config.hasApiKey,
      environment: process.env.NODE_ENV ?? "unknown",
      timestamp: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
