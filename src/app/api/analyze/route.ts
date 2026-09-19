import { analyzeProduct } from "@/lib/ai/analyze";
import { checkRateLimit, rateLimitResponse } from "@/lib/api/rate-limit";
import { parseAnalyzeBody } from "@/lib/api/validate";
import { AppError, toAppError } from "@/lib/errors";

export async function POST(request: Request) {
  const limit = checkRateLimit(request, "analyze");
  if (!limit.ok) return rateLimitResponse("analyze", limit);

  try {
    const body = await request.json().catch(() => null);
    const payload = parseAnalyzeBody(body);
    if (!payload) {
      throw new AppError("EMPTY_INGREDIENTS");
    }

    const record = await analyzeProduct(payload);
    return Response.json({ record });
  } catch (error) {
    const appError = toAppError(error);
    const status = appError.code === "EMPTY_INGREDIENTS" || appError.code === "TOO_FEW_INGREDIENTS" ? 400 : 500;
    return Response.json({ error: appError.code, message: appError.message }, { status });
  }
}
