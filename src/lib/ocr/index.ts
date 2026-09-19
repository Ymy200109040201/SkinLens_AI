import { AppError } from "../errors";

/**
 * OCR 接口预留位
 *
 * 当前版本不实现拍照识别，但这里的接口已经按未来的真实流程设计好：
 *
 *   图片 → OCR 服务/本地模型 → 原始成分文本 → 现有 Ingredient Parser
 *
 * 接入方式（未来）：
 * 1. 在 `src/app/api/ocr/route.ts` 中把 request.formData() 里的图片交给本函数
 * 2. 本函数内部调用选定的 OCR 提供方（如云端 Vision API 或本地 tesseract）
 * 3. 返回 { text } 后，前端直接调用 /api/analyze，无需改动分析链路
 */

export interface IngredientImageInput {
  /** 图片二进制数据 */
  data: ArrayBuffer;
  /** MIME 类型，例如 image/jpeg */
  mimeType: string;
  /** 可选的语言提示 */
  languageHint?: "zh" | "en" | "auto";
}

export interface IngredientOcrResult {
  /** OCR 识别出的原始文本 */
  text: string;
  /** 可信度 0-1，若提供方可返回 */
  confidence: number | null;
  /** 提供方标识，便于排查 */
  provider: string;
}

export async function parseIngredientImage(
  input: IngredientImageInput,
): Promise<IngredientOcrResult> {
  void input;
  throw new AppError(
    "NOT_IMPLEMENTED",
    "拍照识别成分表功能正在开发中，当前版本请手动粘贴或输入成分表。",
  );
}
