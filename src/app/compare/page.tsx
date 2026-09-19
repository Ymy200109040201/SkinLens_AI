"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";

import { CompareIcon } from "@/components/icons";
import { AiBadge, Button, Card, CardTitle, EmptyState, Sheet, Spinner, Tag } from "@/components/ui";
import type { AnalysisRecord, CompareResult } from "@/lib/domain/types";
import { SKIN_GOAL_LABELS } from "@/lib/domain/labels";
import { productTypeLabel } from "@/lib/format";
import { chineseIngredientLabel } from "@/lib/display";
import { toCompareSide } from "@/lib/report";
import { toProfileSnapshot } from "@/lib/storage/types";
import { useStore } from "@/hooks/useStore";

export default function ComparePage() {
  return (
    <Suspense
      fallback={
        <main className="space-y-4 pt-2">
          <div className="h-8 w-32 animate-pulse rounded-2xl bg-surface-muted" />
          <div className="h-48 animate-pulse rounded-3xl bg-surface-muted" />
        </main>
      }
    >
      <CompareInner />
    </Suspense>
  );
}

type CompareOutcome =
  | { key: string; status: "ok"; result: CompareResult }
  | { key: string; status: "error"; message: string };

function CompareInner() {
  const searchParams = useSearchParams();
  const { ready, analyses, profile } = useStore();

  const [leftId, setLeftId] = useState<string | null>(searchParams.get("a"));
  const [rightId, setRightId] = useState<string | null>(searchParams.get("b"));
  const [picker, setPicker] = useState<"left" | "right" | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [outcome, setOutcome] = useState<CompareOutcome | null>(null);

  // 未手动选择时，默认使用最近分析的两款产品（在渲染期推导，避免额外的状态同步）
  const left = useMemo(() => {
    const found = analyses.find((item) => item.id === leftId);
    if (found) return found;
    return ready ? analyses[0] ?? null : null;
  }, [analyses, leftId, ready]);

  const right = useMemo(() => {
    const found = analyses.find((item) => item.id === rightId && item.id !== left?.id);
    if (found) return found;
    return ready ? analyses.find((item) => item.id !== left?.id) ?? null : null;
  }, [analyses, rightId, left, ready]);

  // 记录最新的 analyses，供副作用在需要时读取
  const analysesRef = useRef(analyses);
  useEffect(() => {
    analysesRef.current = analyses;
  }, [analyses]);

  const pairKey =
    left && right && left.id !== right.id ? `${left.id}|${right.id}|${reloadKey}` : null;
  const settled = outcome && outcome.key === pairKey ? outcome : null;
  const loading = Boolean(pairKey) && !settled;
  const result = settled?.status === "ok" ? settled.result : null;
  const error = settled?.status === "error" ? settled.message : null;

  useEffect(() => {
    if (!pairKey) return;
    const [a, b] = pairKey.split("|");
    const source = analysesRef.current;
    const recordA = source.find((item) => item.id === a);
    const recordB = source.find((item) => item.id === b);
    if (!recordA || !recordB) return;

    let cancelled = false;
    const controller = new AbortController();

    void (async () => {
      try {
        const response = await fetch("/api/compare", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            left: toCompareSide(recordA),
            right: toCompareSide(recordB),
            profile: toProfileSnapshot(profile),
          }),
          signal: controller.signal,
        });
        const data = (await response.json().catch(() => null)) as
          | (CompareResult & { message?: string })
          | null;
        if (cancelled) return;
        if (!response.ok || !data) {
          setOutcome({
            key: pairKey,
            status: "error",
            message: data?.message ?? "对比失败，请稍后重试。",
          });
          return;
        }
        setOutcome({ key: pairKey, status: "ok", result: data });
      } catch (error_) {
        if (cancelled) return;
        setOutcome({
          key: pairKey,
          status: "error",
          message:
            error_ instanceof Error && error_.name === "AbortError"
              ? "对比已取消，请重试。"
              : "网络请求失败，请检查网络后重试。",
        });
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
    // profile 变化时重新生成对比结果
  }, [pairKey, profile]);

  if (!ready) {
    return (
      <main className="space-y-4 pt-2">
        <div className="h-8 w-32 animate-pulse rounded-2xl bg-surface-muted" />
        <div className="h-48 animate-pulse rounded-3xl bg-surface-muted" />
      </main>
    );
  }

  if (analyses.length < 2) {
    return (
      <main className="space-y-4">
        <h1 className="pt-1 text-[19px] font-semibold tracking-tight text-ink">产品对比</h1>
        <EmptyState
          title="至少需要两款产品才能对比"
          description="先分析两款产品，这里会自动帮你把配方结构、关注功效相关成分和关注项放在一起比较。"
          icon={<CompareIcon width={22} height={22} />}
          action={
            <Link
              href="/analyze"
              className="inline-flex h-10 items-center rounded-2xl bg-gradient-to-r from-brand to-lilac px-4 text-[13.5px] font-medium text-white"
            >
              分析一款产品
            </Link>
          }
        />
      </main>
    );
  }

  return (
    <main className="space-y-4">
      <header className="pt-1">
        <h1 className="text-[19px] font-semibold tracking-tight text-ink">产品对比</h1>
        <p className="mt-1 text-[12.5px] leading-5 text-muted">
          对比用于帮助理解两款产品的区别，我们不会给出「哪个更好」的结论。
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <ProductPicker
          label="产品 A"
          record={left}
          onOpen={() => setPicker("left")}
        />
        <ProductPicker
          label="产品 B"
          record={right}
          onOpen={() => setPicker("right")}
        />
      </div>

      {left && right && left.id === right.id ? (
        <Card>
          <p className="text-[13.5px] text-ink-soft">请选择两款不同的产品进行对比。</p>
        </Card>
      ) : null}

      {loading ? (
        <Card className="flex items-center gap-3">
          <Spinner className="border-brand/30 border-t-brand" />
          <p className="text-[13.5px] text-ink-soft">正在生成对比结果…</p>
        </Card>
      ) : null}

      {error ? (
        <Card>
          <p className="text-[13.5px] leading-6 text-warn">{error}</p>
          <Button
            className="mt-3"
            size="sm"
            onClick={() => setReloadKey((value) => value + 1)}
          >
            重试
          </Button>
        </Card>
      ) : null}

      {result ? (
        <>
          <Card>
            <CardTitle
              title="AI 对比总结"
              badge={<AiBadge engine={result.meta.engine} model={result.meta.model} />}
            />
            <p className="text-[14px] leading-7 text-ink">{result.summary}</p>
          </Card>

          <Card>
            <CardTitle title="配方结构对比" subtitle="估算比重，不代表真实含量百分比" />
            <ul className="space-y-4">
              {result.structureDiff.map((item) => (
                <li key={item.group}>
                  <p className="mb-2 text-[13px] font-medium text-ink">{item.group}</p>
                  <div className="space-y-1.5">
                    <CompareBar label="A" score={item.leftScore} tone="brand" />
                    <CompareBar label="B" score={item.rightScore} tone="lilac" />
                  </div>
                  <p className="mt-1.5 text-[11.5px] leading-5 text-muted">{item.note}</p>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardTitle title="与你的关注功效" />
            <ul className="space-y-3">
              {result.left.goalHits.map((goal) => {
                const rightGoal = result.right.goalHits.find((item) => item.goal === goal.goal);
                const rightCount = rightGoal?.relatedIngredients.length ?? 0;
                return (
                  <li key={goal.goal} className="rounded-2xl border border-line px-3.5 py-3">
                    <p className="text-[13.5px] font-medium text-ink">
                      {SKIN_GOAL_LABELS[goal.goal]}
                    </p>
                    <div className="mt-2 grid grid-cols-2 gap-3">
                      <SideList title="A" names={goal.relatedIngredients} tone="brand" />
                      <SideList title="B" names={rightGoal?.relatedIngredients ?? []} tone="lilac" />
                    </div>
                    {goal.relatedIngredients.length === 0 && rightCount === 0 ? (
                      <p className="mt-2 text-[11.5px] text-muted">
                        两款产品中都没有找到与该功效直接相关的常见成分。
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card>
            <CardTitle title="关注项差异" subtitle="潜在过敏关注与潜在刺激关注的分布" />
            <div className="grid grid-cols-2 gap-3">
              <WatchList title="A" items={result.left.watchItems} />
              <WatchList title="B" items={result.right.watchItems} />
            </div>
          </Card>

          <Card>
            <CardTitle title="关键成分差异" />
            <div className="space-y-4">
              <DiffBlock title="两款都含有" tone="neutral" names={result.sharedIngredients} />
              <DiffBlock title="仅产品 A 含有" tone="brand" names={result.onlyLeft} />
              <DiffBlock title="仅产品 B 含有" tone="lilac" names={result.onlyRight} />
            </div>
          </Card>

          <Card>
            <CardTitle title="与你的画像" />
            <ul className="space-y-2">
              {result.profileDiff.map((line) => (
                <li
                  key={line}
                  className="rounded-2xl bg-surface-muted px-3.5 py-3 text-[12.5px] leading-6 text-ink-soft"
                >
                  {line}
                </li>
              ))}
            </ul>
          </Card>

          <ul className="space-y-2">
            {result.meta.notices.map((notice) => (
              <li
                key={notice}
                className="rounded-2xl bg-surface-muted px-3.5 py-2.5 text-[12px] leading-5 text-muted"
              >
                {notice}
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <Sheet open={Boolean(picker)} onClose={() => setPicker(null)} title="选择产品">
        <ul className="space-y-2">
          {analyses.map((record) => {
            const active = picker === "left" ? record.id === leftId : record.id === rightId;
            return (
              <li key={record.id}>
                <button
                  type="button"
                  onClick={() => {
                    if (picker === "left") setLeftId(record.id);
                    else setRightId(record.id);
                    setPicker(null);
                  }}
                  className={`w-full rounded-2xl border px-3.5 py-3 text-left transition ${
                    active ? "border-brand bg-brand-soft/50" : "border-line bg-surface"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="text-[14px] font-medium text-ink">{record.productName}</span>
                    <Tag>{productTypeLabel(record.productType)}</Tag>
                  </span>
                  <span className="mt-1 block text-[11.5px] text-muted">
                    {record.parsedIngredients.length} 项成分
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </Sheet>
    </main>
  );
}

function ProductPicker({
  label,
  record,
  onOpen,
}: {
  label: string;
  record: AnalysisRecord | null;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="card-base flex min-h-[92px] flex-col items-start justify-between p-4 text-left transition hover:border-brand/40"
    >
      <span className="text-[11.5px] text-muted">{label}</span>
      {record ? (
        <>
          <span className="mt-1 line-clamp-2 text-[14px] font-medium leading-5 text-ink">
            {record.productName}
          </span>
          <span className="mt-1.5 flex flex-wrap gap-1.5">
            <Tag tone="brand">{productTypeLabel(record.productType)}</Tag>
            <Tag>{record.parsedIngredients.length} 项</Tag>
          </span>
        </>
      ) : (
        <span className="mt-2 text-[13px] text-brand-dark">点击选择产品</span>
      )}
    </button>
  );
}

function CompareBar({
  label,
  score,
  tone,
}: {
  label: string;
  score: number;
  tone: "brand" | "lilac";
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-3 text-[11px] text-muted">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-muted">
        <div
          className={`h-full rounded-full ${
            tone === "brand"
              ? "bg-gradient-to-r from-brand/60 to-brand"
              : "bg-gradient-to-r from-lilac/60 to-lilac"
          }`}
          style={{ width: `${Math.max(3, Math.min(100, score))}%` }}
        />
      </div>
      <span className="w-10 text-right text-[11px] text-muted">{score}%</span>
    </div>
  );
}

function SideList({
  title,
  names,
  tone,
}: {
  title: string;
  names: string[];
  tone: "brand" | "lilac";
}) {
  return (
    <div>
      <p className="mb-1.5 text-[11.5px] text-muted">{title}</p>
      {names.length === 0 ? (
        <p className="text-[12px] text-muted">无</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {names.slice(0, 6).map((name) => (
            <Tag key={name} tone={tone}>
              {name}
            </Tag>
          ))}
        </div>
      )}
    </div>
  );
}

function WatchList({
  title,
  items,
}: {
  title: string;
  items: CompareResult["left"]["watchItems"];
}) {
  const relevant = items.filter(
    (item) =>
      item.type === "allergen" ||
      item.type === "irritation" ||
      item.type === "user_avoid" ||
      item.type === "user_watch" ||
      item.type === "acne_related",
  );
  return (
    <div>
      <p className="mb-1.5 text-[11.5px] text-muted">{title} · {relevant.length} 项</p>
      {relevant.length === 0 ? (
        <p className="text-[12px] text-muted">无特别关注项</p>
      ) : (
        <ul className="space-y-1.5">
          {relevant.slice(0, 6).map((item, index) => (
            <li key={`${item.ingredient}-${index}`} className="text-[12px] leading-5 text-ink-soft">
              · {chineseIngredientLabel(item.ingredient)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DiffBlock({
  title,
  names,
  tone,
}: {
  title: string;
  names: string[];
  tone: "brand" | "lilac" | "neutral";
}) {
  return (
    <div>
      <p className="mb-1.5 text-[12.5px] font-medium text-ink">
        {title}
        <span className="ml-1.5 text-[11.5px] font-normal text-muted">{names.length} 项</span>
      </p>
      {names.length === 0 ? (
        <p className="text-[12px] text-muted">无</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {names.slice(0, 14).map((name) => (
            <Tag key={name} tone={tone}>
              {name}
            </Tag>
          ))}
          {names.length > 14 ? <Tag>等 {names.length} 项</Tag> : null}
        </div>
      )}
    </div>
  );
}
