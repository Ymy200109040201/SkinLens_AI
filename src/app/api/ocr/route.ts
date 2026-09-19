import { parseIngredientImage } from "@/lib/ocr";
import { toAppError } from "@/lib/errors";

/**
 * OCR 接口预留（当前返回 501）
 *
 * 未来接入：接收 multipart/form-data 中的图片，交给 parseIngredientImage 处理，
 * 返回识别出的成分文本，前端复用现有 /api/analyze 流程。
 */
export async function POST(request: Request) {
  try {
    const formData = await request.formData().catch(() => null);
    const value = formData?.get("image") ?? formData?.get("file");
    const file = value instanceof File ? value : null;
    const result = await parseIngredientImage({
      data: file ? await file.arrayBuffer() : new ArrayBuffer(0),
      mimeType: file?.type ?? "application/octet-stream",
      languageHint: "auto",
    });
    return Response.json(result);
  } catch (error) {
    const appError = toAppError(error, "NOT_IMPLEMENTED");
    return Response.json({ error: appError.code, message: appError.message }, { status: 501 });
  }
}
