"use client";

import Link from "next/link";

import {
  ChevronRightIcon,
  CompareIcon,
  PlusIcon,
  SparkIcon,
} from "@/components/icons";
import { AiBadge, Card, CardTitle, EmptyState, Tag } from "@/components/ui";
import {
  APP_NAME,
  APP_TAGLINE,
  MEDICAL_DISCLAIMER,
  SKIN_CONCERN_LABELS,
  SKIN_GOAL_LABELS,
} from "@/lib/domain/labels";
import type { SkinConcern, SkinGoal } from "@/lib/domain/types";
import { formatRelative, productTypeLabel, skinTypeLabel } from "@/lib/format";
import { useStore } from "@/hooks/useStore";
import { summarySnippet } from "@/lib/report";
import { hasProfileContent } from "@/lib/storage/types";

function goalLabel(goal: SkinGoal): string {
  return SKIN_GOAL_LABELS[goal] ?? goal;
}

function concernLabel(concern: SkinConcern): string {
  return SKIN_CONCERN_LABELS[concern] ?? concern;
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-surface-muted ${className ?? "h-4 w-full"}`} />;
}

export default function HomePage() {
  const { ready, profile, analyses, aiMode, aiModel } = useStore();
  const recent = analyses.slice(0, 3);
  const profileReady = hasProfileContent(profile);
  return (
    <main className="space-y-4">
      <header className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-lilac text-white">
            <SparkIcon width={16} height={16} />
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-ink">{APP_NAME}</span>
        </div>
        <AiBadge engine={aiMode === "llm" ? "llm" : "rule"} model={aiModel} />
      </header>

      <section className="pt-2">
        <h1 className="text-[26px] font-semibold leading-[1.3] tracking-tight text-ink">
          {APP_TAGLINE}
        </h1>
        <p className="mt-2 text-[13.5px] leading-6 text-ink-soft">
          粘贴一款产品的完整成分表，AI 会结合你的肤质与关注功效，告诉你这份配方里有什么、为什么值得关注。
        </p>
      </section>

      <Link
        href="/analyze"
        className="flex h-16 items-center justify-center gap-2 rounded-3xl bg-gradient-to-r from-brand to-lilac text-[17px] font-semibold text-white shadow-[var(--shadow-float)] transition active:brightness-95"
      >
        <PlusIcon width={20} height={20} />
        分析一款产品
      </Link>

      <div>
        <Link
          href="/compare"
          className="flex items-center gap-2 rounded-2xl border border-line bg-surface/80 px-4 py-3 text-[13.5px] text-ink-soft transition hover:border-brand/40"
        >
          <CompareIcon width={18} height={18} className="text-lilac" />
          产品对比
        </Link>
      </div>

      <Card>
        <CardTitle title="我的画像" />
        {!ready ? (
          <div className="space-y-2">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : profileReady ? (
          <div className="space-y-3">
            <p className="text-[15px] font-medium text-ink">
              {skinTypeLabel(profile.skinType)}
              {profile.goals.length > 0
                ? ` · ${profile.goals
                    .slice(0, 4)
                    .map((goal) => goalLabel(goal))
                    .join(" · ")}`
                : ""}
            </p>
            <div className="flex flex-wrap gap-2">
              {profile.skinConcerns.slice(0, 4).map((concern) => (
                <Tag key={concern}>{concernLabel(concern)}</Tag>
              ))}
              <Tag tone="brand">关注成分 {profile.watchedIngredients.length} 项</Tag>
              <Tag tone="warn">避开成分 {profile.avoidedIngredients.length} 项</Tag>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-[13.5px] leading-6 text-ink-soft">
              还没有设置肤质和关注功效。设置后，每次分析都会自动结合你的情况给出个性化说明。
            </p>
            <Link
              href="/profile"
              className="inline-flex h-10 items-center rounded-2xl bg-brand-soft px-4 text-[13.5px] font-medium text-brand-dark"
            >
              去设置个人画像
            </Link>
          </div>
        )}
      </Card>

      <Card>
        <CardTitle
          title="最近分析"
          subtitle={recent.length > 0 ? "点击可以重新查看完整报告" : undefined}
          action={
            analyses.length > 0 ? (
              <Link
                href="/history"
                className="inline-flex items-center gap-0.5 text-[13px] text-brand-dark"
              >
                全部 {analyses.length}
                <ChevronRightIcon width={16} height={16} />
              </Link>
            ) : null
          }
        />
        {!ready ? (
          <div className="space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : recent.length === 0 ? (
          <EmptyState
            title="还没有分析记录"
            description="粘贴一款产品的成分表，几秒钟就能得到一份结合你个人情况的成分报告。"
            icon={<SparkIcon width={22} height={22} />}
            action={
              <Link
                href="/analyze"
                className="inline-flex h-10 items-center rounded-2xl bg-gradient-to-r from-brand to-lilac px-4 text-[13.5px] font-medium text-white"
              >
                开始第一次分析
              </Link>
            }
          />
        ) : (
          <ul className="space-y-2">
            {recent.map((record) => (
              <li key={record.id}>
                <Link
                  href={`/report/${record.id}`}
                  className="flex items-center gap-3 rounded-2xl border border-line bg-surface-muted/60 px-3.5 py-3 transition hover:border-brand/40"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-[12px] font-medium text-brand-dark">
                    {productTypeLabel(record.productType).slice(0, 2)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-[14px] font-medium text-ink">
                        {record.productName}
                      </span>
                      {record.favorite ? <Tag tone="brand">收藏</Tag> : null}
                    </span>
                    <span className="mt-0.5 block truncate text-[12px] text-muted">
                      {summarySnippet(record, 40)}
                    </span>
                  </span>
                  <span className="shrink-0 text-[11.5px] text-muted">
                    {formatRelative(record.createdAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <p className="px-1 pb-2 text-[11.5px] leading-5 text-muted">{MEDICAL_DISCLAIMER}</p>
    </main>
  );
}
