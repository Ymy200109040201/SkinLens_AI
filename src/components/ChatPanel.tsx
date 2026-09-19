"use client";

import { useEffect, useRef, useState } from "react";

import { ChatIcon, SparkIcon } from "./icons";
import { Button, Spinner, Tag } from "./ui";
import type { AnalysisRecord, ChatMessage } from "@/lib/domain/types";
import { toChatPayload } from "@/lib/report";
import { loadChat, saveChat } from "@/lib/store/client-store";

/**
 * 上下文感知的产品问答面板
 *
 * 每次提问都会自动携带当前产品、完整成分、用户画像与已有分析结论，
 * 因此可以连续追问。对话保存在本地，刷新页面后仍然保留。
 */
export default function ChatPanel({
  record,
  seedQuestion,
  onSeedConsumed,
}: {
  record: AnalysisRecord;
  seedQuestion?: string | null;
  onSeedConsumed?: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    void loadChat(record.id).then((history) => {
      if (!cancelled) {
        setMessages(history);
        setLoaded(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [record.id]);

  useEffect(() => {
    if (seedQuestion) {
      void send(seedQuestion);
      onSeedConsumed?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedQuestion]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  async function send(question: string) {
    const text = question.trim();
    if (!text || pending) return;

    const userMessage: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };
    const history = [...messages, userMessage];
    setMessages(history);
    setInput("");
    setPending(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          toChatPayload(record, history.map((item) => ({ role: item.role, content: item.content }))),
        ),
      });
      const data = (await response.json().catch(() => null)) as
        | { reply?: string; engine?: "llm" | "rule"; message?: string }
        | null;

      const replyText =
        data?.reply ??
        data?.message ??
        "抱歉，我暂时无法回答这个问题，请稍后再试。";

      const assistantMessage: ChatMessage = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: replyText,
        createdAt: new Date().toISOString(),
        engine: data?.engine ?? "rule",
      };
      const next = [...history, assistantMessage];
      setMessages(next);
      await saveChat(
        record.id,
        next.map((item) => ({ ...item })),
      );
    } catch {
      const assistantMessage: ChatMessage = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: "网络请求失败，请检查网络后重新提问。",
        createdAt: new Date().toISOString(),
        engine: "rule",
      };
      setMessages([...history, assistantMessage]);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div ref={listRef} className="no-scrollbar flex-1 space-y-3 overflow-y-auto pb-3">
        {!loaded ? (
          <p className="py-6 text-center text-[13px] text-muted">正在加载对话…</p>
        ) : messages.length === 0 ? (
          <div className="space-y-3 py-2">
            <p className="text-[13.5px] leading-6 text-ink-soft">
              这里可以基于当前产品连续追问。我会自动带上这款产品的完整成分、你的画像和本次分析结论。
            </p>
            <div className="space-y-2">
              {record.analysis.questionsStarter.map((question) => (
                <button
                  key={question}
                  type="button"
                  onClick={() => send(question)}
                  className="flex w-full items-center gap-2 rounded-2xl border border-line bg-surface-muted/60 px-3.5 py-3 text-left text-[13px] text-ink-soft transition hover:border-brand/40"
                >
                  <ChatIcon width={16} height={16} className="shrink-0 text-brand" />
                  {question}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={message.role === "user" ? "flex justify-end" : "flex justify-start"}
            >
              <div
                className={
                  message.role === "user"
                    ? "max-w-[85%] rounded-2xl rounded-br-md bg-gradient-to-r from-brand to-lilac px-3.5 py-2.5 text-[13.5px] leading-6 text-white"
                    : "max-w-[92%] rounded-2xl rounded-bl-md border border-line bg-surface px-3.5 py-2.5 text-[13.5px] leading-6 text-ink"
                }
              >
                {message.role === "assistant" ? (
                  <span className="mb-1 flex items-center gap-1.5">
                    <SparkIcon width={13} height={13} className="text-lilac" />
                    <span className="text-[11px] text-lilac">
                      {message.engine === "llm" ? "AI 回答" : "本地分析回答"}
                    </span>
                  </span>
                ) : null}
                <p className="whitespace-pre-wrap">{message.content}</p>
              </div>
            </div>
          ))
        )}

        {pending ? (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-line bg-surface px-3.5 py-2.5 text-[13px] text-muted">
              <Spinner className="border-lilac/30 border-t-lilac" />
              正在结合当前产品与你的画像思考…
            </div>
          </div>
        ) : null}
      </div>

      <div className="border-t border-line pt-3">
        {messages.length > 0 ? (
          <div className="no-scrollbar mb-2 flex gap-2 overflow-x-auto">
            {record.analysis.questionsStarter.slice(0, 3).map((question) => (
              <button
                key={question}
                type="button"
                onClick={() => send(question)}
                className="shrink-0"
                disabled={pending}
              >
                <Tag tone="lilac">{question}</Tag>
              </button>
            ))}
          </div>
        ) : null}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void send(input);
          }}
          className="flex items-end gap-2"
        >
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void send(input);
              }
            }}
            rows={2}
            placeholder="例如：烟酰胺在这里主要起什么作用？"
            className="max-h-28 flex-1 resize-none rounded-2xl border border-line-strong bg-surface px-3.5 py-2.5 text-[13.5px] leading-6 text-ink outline-none focus:border-brand"
          />
          <Button type="submit" disabled={pending || !input.trim()} className="h-12">
            发送
          </Button>
        </form>
        <p className="mt-2 text-[11px] text-muted">
          AI 回答基于成分资料与本次分析结果，不构成医疗建议。
        </p>
      </div>
    </div>
  );
}
