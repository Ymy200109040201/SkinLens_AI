import { analyzeSkinImage } from "@/lib/skin";
import { toAppError } from "@/lib/errors";

/**
 * AI 拍照测肤接口预留（当前返回 501）
 *
 * 未来接入前需要先完成明确的用户授权流程与隐私说明。
 */
export async function POST(request: Request) {
  try {
    const formData = await request.formData().catch(() => null);
    const value = formData?.get("image") ?? formData?.get("photo");
    const file = value instanceof File ? value : null;
    const result = await analyzeSkinImage({
      data: file ? await file.arrayBuffer() : new ArrayBuffer(0),
      mimeType: file?.type ?? "application/octet-stream",
    });
    return Response.json(result);
  } catch (error) {
    const appError = toAppError(error, "NOT_IMPLEMENTED");
    return Response.json({ error: appError.code, message: appError.message }, { status: 501 });
  }
}
