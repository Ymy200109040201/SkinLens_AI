import { compareProducts } from "@/lib/ai/compare";
import { checkRateLimit, rateLimitResponse } from "@/lib/api/rate-limit";
import { parseCompareBody } from "@/lib/api/validate";
import { AppError, toAppError } from "@/lib/errors";

export async function POST(request: Request) {
  const limit = checkRateLimit(request, "compare");
  if (!limit.ok) return rateLimitResponse("compare", limit);

  try {
    const body = await request.json().catch(() => null);
    const payload = parseCompareBody(body);
    if (!payload) {
      throw new AppError("EMPTY_INGREDIENTS", "请选择两款已经分析过的产品后再进行对比。");
    }
    const result = await compareProducts(payload);
    return Response.json(result);
  } catch (error) {
    const appError = toAppError(error);
    return Response.json({ error: appError.code, message: appError.message }, { status: 500 });
  }
}
