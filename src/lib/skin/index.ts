import { AppError } from "../errors";
import type { ProfileSnapshot } from "../domain/types";

/**
 * AI 拍照测肤接口预留位
 *
 * 未来流程：
 *   用户授权 → 拍摄面部照片 → 视觉模型分析 → 返回 ProfileSnapshot 建议值 → 用户确认后写入画像
 *
 * 隐私注意事项（重要）：
 * - 当前版本不采集、不上传任何人脸照片
 * - 未来实现时必须先做明确的授权流程与用途说明，并提供「不使用照片也能正常使用产品」的降级路径
 */

export interface SkinImageInput {
  data: ArrayBuffer;
  mimeType: string;
}

export interface SkinImageAnalysisResult {
  suggestedProfile: Partial<ProfileSnapshot>;
  confidence: number | null;
  notes: string;
}

export async function analyzeSkinImage(
  input: SkinImageInput,
): Promise<SkinImageAnalysisResult> {
  void input;
  throw new AppError(
    "NOT_IMPLEMENTED",
    "AI 拍照测肤即将推出，当前版本请手动设置肤质。",
  );
}
