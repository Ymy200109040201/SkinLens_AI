/** 产品内统一的可展示错误码 */
export type AppErrorCode =
  | "EMPTY_INGREDIENTS"
  | "TOO_FEW_INGREDIENTS"
  | "TOO_LONG_INGREDIENTS"
  | "PRODUCT_NOT_FOUND"
  | "AI_UNAVAILABLE"
  | "AI_INVALID_JSON"
  | "AI_TIMEOUT"
  | "NETWORK_ERROR"
  | "NOT_IMPLEMENTED"
  | "UNKNOWN";

const MESSAGES: Record<AppErrorCode, string> = {
  EMPTY_INGREDIENTS: "请先粘贴完整的成分表，例如：水、甘油、烟酰胺……",
  TOO_FEW_INGREDIENTS: "识别到的成分太少，请检查是否粘贴了完整成分表（通常 10 项以上）。",
  TOO_LONG_INGREDIENTS: "成分表内容过长，请拆分成两次分析。",
  PRODUCT_NOT_FOUND: "没有找到这条分析记录，它可能已被删除。",
  AI_UNAVAILABLE: "AI 服务暂时不可用，已使用本地分析模式完成本次分析。",
  AI_TIMEOUT: "AI 响应超时，已使用本地分析模式完成本次分析。",
  AI_INVALID_JSON: "AI 返回内容格式异常，已改用本地分析模式。",
  NETWORK_ERROR: "网络请求失败，请检查网络后重试。",
  NOT_IMPLEMENTED: "该功能正在开发中，当前版本暂未开放。",
  UNKNOWN: "出现未知问题，请稍后重试。",
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  /** 是否可以直接向用户展示 */
  readonly userFacing: boolean;

  constructor(code: AppErrorCode, message?: string, options?: { userFacing?: boolean }) {
    super(message ?? MESSAGES[code]);
    this.name = "AppError";
    this.code = code;
    this.userFacing = options?.userFacing ?? true;
  }
}

export function messageForCode(code: AppErrorCode): string {
  return MESSAGES[code];
}

export function toAppError(error: unknown, fallback: AppErrorCode = "UNKNOWN"): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof Error && error.name === "AbortError") {
    return new AppError("AI_TIMEOUT");
  }
  return new AppError(fallback);
}
