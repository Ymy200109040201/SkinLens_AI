"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { CompareIcon, PlusIcon, SearchIcon, StarIcon, TrashIcon } from "@/components/icons";
import { Button, Card, Chip, EmptyState, Sheet, Tag } from "@/components/ui";
import { formatRelative, productTypeLabel } from "@/lib/format";
import { summarySnippet } from "@/lib/report";
import { removeAnalysis, toggleFavorite } from "@/lib/store/client-store";
import { useStore } from "@/hooks/useStore";

export default function HistoryPage() {
  const router = useRouter();
  const { ready, analyses } = useStore();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "favorite">("all");
  const [compareMode, setCompareMode] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return analyses
      .filter((record) => (filter === "favorite" ? record.favorite : true))
      .filter((record) => {
        if (!keyword) return true;
        return (
          record.productName.toLowerCase().includes(keyword) ||
          record.rawIngredients.toLowerCase().includes(keyword) ||
          record.analysis.summary.toLowerCase().includes(keyword)
        );
      });
  }, [analyses, filter, query]);

  function toggleSelected(id: string) {
    setSelected((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length >= 2) return [current[1], id];
      return [...current, id];
    });
  }

  const pendingRecord = analyses.find((item) => item.id === pendingDelete) ?? null;

  return (
    <main className="space-y-4">
      <header className="flex items-center justify-between pt-1">
        <h1 className="text-[19px] font-semibold tracking-tight text-ink">分析记录</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setCompareMode((value) => !value);
              setSelected([]);
            }}
            className={`flex h-9 items-center gap-1.5 rounded-2xl border px-3 text-[13px] transition ${
              compareMode
                ? "border-brand/40 bg-brand-soft text-brand-dark"
                : "border-line bg-surface text-ink-soft"
            }`}
          >
            <CompareIcon width={16} height={16} />
            {compareMode ? "退出对比" : "选择对比"}
          </button>
          <Link
            href="/analyze"
            aria-label="分析新产品"
            className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-r from-brand to-lilac text-white"
          >
            <PlusIcon width={18} height={18} />
          </Link>
        </div>
      </header>

      <div className="space-y-3">
        <label className="relative block">
          <SearchIcon
            width={17}
            height={17}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索产品名称、成分或结论"
            className="h-12 w-full rounded-2xl border border-line-strong bg-surface pl-10 pr-4 text-[14px] text-ink outline-none transition placeholder:text-muted focus:border-brand"
          />
        </label>
        <div className="flex gap-2">
          <Chip selected={filter === "all"} onClick={() => setFilter("all")}>
            全部 {analyses.length}
          </Chip>
          <Chip selected={filter === "favorite"} onClick={() => setFilter("favorite")}>
            收藏 {analyses.filter((item) => item.favorite).length}
          </Chip>
        </div>
      </div>

      {compareMode ? (
        <Card className="bg-brand-soft/50">
          <p className="text-[13px] leading-6 text-brand-dark">
            已选择 {selected.length} / 2 款产品，选满 2 款后即可开始对比。
          </p>
          <Button
            className="mt-3"
            size="sm"
            disabled={selected.length !== 2}
            onClick={() => router.push(`/compare?a=${selected[0]}&b=${selected[1]}`)}
          >
            开始对比
          </Button>
        </Card>
      ) : null}

      {!ready ? (
        <div className="space-y-3">
          {[0, 1, 2].map((key) => (
            <div key={key} className="h-24 animate-pulse rounded-3xl bg-surface-muted" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={analyses.length === 0 ? "还没有分析记录" : "没有匹配的记录"}
          description={
            analyses.length === 0
              ? "分析过的产品会保存在当前设备上，方便随时重新查看和对比。"
              : "试试更换关键词，或切换到「全部」。"
          }
          action={
            analyses.length === 0 ? (
              <Link
                href="/analyze"
                className="inline-flex h-10 items-center rounded-2xl bg-gradient-to-r from-brand to-lilac px-4 text-[13.5px] font-medium text-white"
              >
                分析一款产品
              </Link>
            ) : null
          }
        />
      ) : (
        <ul className="space-y-3">
          {filtered.map((record) => {
            const isSelected = selected.includes(record.id);
            return (
              <li key={record.id}>
                <Card
                  className={`transition ${
                    isSelected ? "border-brand/50 ring-1 ring-brand/30" : ""
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {compareMode ? (
                      <button
                        type="button"
                        onClick={() => toggleSelected(record.id)}
                        aria-label="选择这条记录"
                        className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border text-[12px] ${
                          isSelected
                            ? "border-brand bg-brand text-white"
                            : "border-line-strong bg-surface text-transparent"
                        }`}
                      >
                        ✓
                      </button>
                    ) : null}

                    <Link href={`/report/${record.id}`} className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[15px] font-medium text-ink">
                          {record.productName}
                        </span>
                        <Tag tone="brand">{productTypeLabel(record.productType)}</Tag>
                        {record.favorite ? <Tag tone="lilac">收藏</Tag> : null}
                      </div>
                      <p className="mt-1.5 line-clamp-2 text-[12.5px] leading-5 text-ink-soft">
                        {summarySnippet(record, 72)}
                      </p>
                      <p className="mt-2 text-[11.5px] text-muted">
                        {formatRelative(record.createdAt)} · {record.parsedIngredients.length} 项成分
                      </p>
                    </Link>

                    <div className="flex shrink-0 flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => void toggleFavorite(record.id)}
                        aria-label="收藏"
                        className={`flex h-8 w-8 items-center justify-center rounded-xl border transition ${
                          record.favorite
                            ? "border-brand/30 bg-brand-soft text-brand-dark"
                            : "border-line bg-surface text-muted"
                        }`}
                      >
                        <StarIcon width={15} height={15} filled={record.favorite} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDelete(record.id)}
                        aria-label="删除"
                        className="flex h-8 w-8 items-center justify-center rounded-xl border border-line bg-surface text-muted"
                      >
                        <TrashIcon width={15} height={15} />
                      </button>
                    </div>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <Sheet
        open={Boolean(pendingRecord)}
        onClose={() => setPendingDelete(null)}
        title="删除这条分析记录？"
      >
        <p className="text-[13.5px] leading-6 text-ink-soft">
          将删除「{pendingRecord?.productName}」以及它的问答记录，删除后无法恢复。
        </p>
        <div className="mt-4 flex gap-2">
          <Button variant="soft" fullWidth onClick={() => setPendingDelete(null)}>
            取消
          </Button>
          <Button
            variant="danger"
            fullWidth
            onClick={async () => {
              if (pendingDelete) await removeAnalysis(pendingDelete);
              setPendingDelete(null);
            }}
          >
            确认删除
          </Button>
        </div>
      </Sheet>
    </main>
  );
}
