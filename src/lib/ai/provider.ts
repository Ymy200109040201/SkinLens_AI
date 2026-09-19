import { AppError } from "../errors";
import { getAiConfig } from "./config";

/**
 * 极简的 OpenAI 兼容客户端。
 * 只依赖 fetch，不引入额外 SDK，方便在任意 Node 环境运行。
 */

export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatCompletionResponse {
  choices?: { message?: { content?: string | null } }[];
  error?: { message?: string };
}

async function requestCompletion(
  messages: LlmMessage[],
  options: {
    json?: boolean;
    temperature?: number;
    maxTokens?: number;
    timeoutMs?: number;
  } = {},
): Promise<string> {
  const config = getAiConfig();
  if (config.mode !== "llm") {
    throw new AppError("AI_UNAVAILABLE", config.reason ?? undefined, { userFacing: false });
  }

  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? 45_000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY ?? ""}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: options.temperature ?? 0.4,
        max_tokens: options.maxTokens ?? 2400,
        ...(options.json ? { response_format: { type: "json_object" } } : {}),
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.error("[ai] 请求失败", response.status, text.slice(0, 400));
      throw new AppError("AI_UNAVAILABLE", undefined, { userFacing: false });
    }

    const data = (await response.json()) as ChatCompletionResponse;
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new AppError("AI_UNAVAILABLE", "AI 返回内容为空", { userFacing: false });
    }
    return content;
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new AppError("AI_TIMEOUT", undefined, { userFacing: false });
    }
    console.error("[ai] 调用异常", error);
    throw new AppError("AI_UNAVAILABLE", undefined, { userFacing: false });
  } finally {
    clearTimeout(timer);
  }
}

/** 从可能包含代码块或额外文字的内容中提取 JSON */
export function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  try {
    return JSON.parse(withoutFence);
  } catch {
    const start = withoutFence.indexOf("{");
    const end = withoutFence.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(withoutFence.slice(start, end + 1));
      } catch {
        throw new AppError("AI_INVALID_JSON", undefined, { userFacing: false });
      }
    }
    throw new AppError("AI_INVALID_JSON", undefined, { userFacing: false });
  }
}

export async function callLlmJson<T>(params: {
  system: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}): Promise<T> {
  const content = await requestCompletion(
    [
      { role: "system", content: params.system },
      { role: "user", content: params.user },
    ],
    {
      json: true,
      temperature: params.temperature,
      maxTokens: params.maxTokens,
      timeoutMs: params.timeoutMs,
    },
  );

  try {
    return extractJson(content) as T;
  } catch {
    // 一次自动重试：把原始输出回传，请模型修正为合法 JSON
    const repaired = await requestCompletion(
      [
        { role: "system", content: params.system },
        { role: "user", content: params.user },
        { role: "assistant", content: content.slice(0, 4000) },
        {
          role: "user",
          content: "上面的输出不是合法 JSON。请只输出修正后的合法 JSON，不要包含任何解释文字。",
        },
      ],
      { json: true, temperature: 0, maxTokens: params.maxTokens, timeoutMs: params.timeoutMs },
    );
    return extractJson(repaired) as T;
  }
}

export async function callLlmText(params: {
  system: string;
  messages: LlmMessage[];
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}): Promise<string> {
  return requestCompletion([{ role: "system", content: params.system }, ...params.messages], {
    temperature: params.temperature,
    maxTokens: params.maxTokens,
    timeoutMs: params.timeoutMs,
  });
}
