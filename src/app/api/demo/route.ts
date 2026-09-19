import { analyzeProduct } from "@/lib/ai/analyze";
import { checkRateLimit, rateLimitResponse } from "@/lib/api/rate-limit";
import { toAppError } from "@/lib/errors";
import { createDemoProfile, DEMO_NOTICE, DEMO_PRODUCTS } from "@/lib/demo/data";

/**
 * 一键载入演示数据
 *
 * 返回一份示例画像 + 三款示例产品（精华 / 面霜 / 洁面）的完整分析记录。
 * 分析固定使用本地规则引擎：结果稳定、即时返回，且不会消耗 AI 额度。
 * 数据由浏览器端写入本地存储，服务端不保存任何内容。
 */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const limit = checkRateLimit(request, "demo");
  if (!limit.ok) return rateLimitResponse("demo", limit);

  try {
    const profile = createDemoProfile();
    const records = [];

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
      record.meta.notices = [...record.meta.notices, DEMO_NOTICE];
      records.push(record);
    }

    return Response.json({ profile, records, notice: DEMO_NOTICE });
  } catch (error) {
    const appError = toAppError(error);
    return Response.json({ error: appError.code, message: appError.message }, { status: 500 });
  }
}
