import { getAiConfig } from "../ai/config";

/**
 * 轻量级限流（公网 Demo 的「防刷」保险丝）
 *
 * 公网 URL 意味着任何人都能触发服务端 AI 调用；如果 Key 泄露或被人写脚本刷，
 * 会产生真实费用。这里做一个进程内的滑动窗口限流，超限直接返回 429。
 *
 * 注意：计数保存在单个服务实例的内存里。Serverless（如 Vercel）会有多个实例，
 * 因此它是「防误用」而不是「防攻击」的兜底手段，配合平台用量告警一起使用。
 */

const WINDOW_MS = 60_000;
const MAX_TRACKED_CLIENTS = 5_000;

const buckets = new Map<string, number[]>();

function defaultLimitPerMinute(): number {
  const raw = process.env.AI_RATE_LIMIT_PER_MINUTE?.trim();
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  // 调用真实模型时更保守；本地演示模式几乎零成本，可以放宽
  return getAiConfig().mode === "llm" ? 20 : 90;
}

/** 从常见代理头里取客户端标识，退化时使用固定桶 */
export function clientKey(request: Request): string {
  const headers = request.headers;
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return (
    headers.get("x-real-ip")?.trim() ||
    headers.get("cf-connecting-ip")?.trim() ||
    "unknown-client"
  );
}

export interface RateLimitResult {
  ok: boolean;
  /** 建议的 Retry-After 秒数 */
  retryAfter: number;
  limit: number;
  remaining: number;
}

export function checkRateLimit(
  request: Request,
  scope: string,
  limitPerMinute = defaultLimitPerMinute(),
): RateLimitResult {
  const now = Date.now();
  const key = `${scope}:${clientKey(request)}`;

  // 简单清理，避免长期运行时 Map 无限增长
  if (buckets.size > MAX_TRACKED_CLIENTS) {
    for (const [bucketKey, timestamps] of buckets) {
      if (timestamps.every((time) => now - time > WINDOW_MS)) buckets.delete(bucketKey);
      if (buckets.size <= MAX_TRACKED_CLIENTS / 2) break;
    }
    if (buckets.size > MAX_TRACKED_CLIENTS) buckets.clear();
  }

  const hits = (buckets.get(key) ?? []).filter((time) => now - time < WINDOW_MS);
  if (hits.length >= limitPerMinute) {
    buckets.set(key, hits);
    const oldest = hits[0] ?? now;
    return {
      ok: false,
      retryAfter: Math.max(1, Math.ceil((WINDOW_MS - (now - oldest)) / 1000)),
      limit: limitPerMinute,
      remaining: 0,
    };
  }

  hits.push(now);
  buckets.set(key, hits);
  return {
    ok: true,
    retryAfter: 0,
    limit: limitPerMinute,
    remaining: Math.max(0, limitPerMinute - hits.length),
  };
}

/** 超限时返回的友好提示（前端会直接展示 message 字段） */
export function rateLimitResponse(scope: string, result: RateLimitResult): Response {
  return Response.json(
    {
      error: "RATE_LIMITED",
      message: "操作有点频繁，请等一分钟再试。演示环境对请求次数做了限制。",
      scope,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(result.retryAfter),
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": "0",
      },
    },
  );
}
