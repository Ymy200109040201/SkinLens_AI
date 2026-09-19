import { answerQuestion } from "@/lib/ai/chat";
import { checkRateLimit, rateLimitResponse } from "@/lib/api/rate-limit";
import { parseChatBody } from "@/lib/api/validate";
import { AppError, toAppError } from "@/lib/errors";

export async function POST(request: Request) {
  const limit = checkRateLimit(request, "chat");
  if (!limit.ok) return rateLimitResponse("chat", limit);

  try {
    const body = await request.json().catch(() => null);
    const payload = parseChatBody(body);
    if (!payload) {
      throw new AppError("EMPTY_INGREDIENTS", "缺少必要的产品上下文，请重新打开分析结果页。");
    }
    const result = await answerQuestion(payload);
    return Response.json(result);
  } catch (error) {
    const appError = toAppError(error);
    return Response.json({ error: appError.code, message: appError.message }, { status: 500 });
  }
}
