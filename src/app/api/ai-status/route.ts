import { getAiConfig } from "@/lib/ai/config";

export async function GET() {
  const config = getAiConfig();
  return Response.json({
    mode: config.mode,
    model: config.model,
    hasApiKey: config.hasApiKey,
    reason: config.reason,
  });
}
