"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import ChatPanel from "./ChatPanel";
import {
  AlertIcon,
  ChatIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  SparkIcon,
  StarIcon,
  TrashIcon,
} from "./icons";
import { AiBadge, Button, Card, CardTitle, Sheet, Tag } from "./ui";
import type { IngredientRecord, WatchItem } from "@/lib/domain/types";
import {
  INGREDIENT_CATEGORY_LABELS,
  MEDICAL_DISCLAIMER,
  RELEVANCE_LABELS,
  SKIN_GOAL_LABELS,
  WATCH_TYPE_LABELS,
} from "@/lib/domain/labels";
import { cn, formatDateTime, productTypeLabel } from "@/lib/format";
import { chineseIngredientLabel } from "@/lib/display";
import { getIngredientById } from "@/lib/ingredients/lookup";
import { useStore } from "@/hooks/useStore";
import { removeAnalysis, toggleFavorite } from "@/lib/store/client-store";

export default function ReportView({ id }: { id: string }) {
  const router = useRouter();
  const { ready, analyses } = useStore();
  const record = useMemo(() => analyses.find((item) => item.id === id), [analyses, id]);

  const [chatOpen, setChatOpen] = useState(false);
  const [seedQuestion, setSeedQuestion] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (!ready) {
    return (
      <main className="space-y-4 pt-2">
        <div className="h-8 w-40 animate-pulse rounded-2xl bg-surface-muted" />
        <div className="h-40 animate-pulse rounded-3xl bg-surface-muted" />
        <div className="h-64 animate-pulse rounded-3xl bg-surface-muted" />
      </main>
    );
  }

  if (!record) {
    return (
      <main className="space-y-4 pt-6">
        <Card className="text-center">
          <p className="text-[15px] font-medium text-ink">没有找到这条分析记录</p>
          <p className="mt-2 text-[13px] leading-6 text-muted">
            它可能已被删除，或者保存在了另一台设备上。分析记录默认只保存在当前浏览器。
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <Link
              href="/history"
              className="inline-flex h-10 items-center rounded-2xl border border-line-strong bg-surface px-4 text-[13.5px] text-ink-soft"
            >
              查看分析记录
            </Link>
            <Link
              href="/analyze"
              className="inline-flex h-10 items-center rounded-2xl bg-gradient-to-r from-brand to-lilac px-4 text-[13.5px] font-medium text-white"
            >
              分析新产品
            </Link>
          </div>
        </Card>
      </main>
    );
  }

  const analysis = record.analysis;
  const meta = record.meta;
  const profile = record.profileSnapshot;
  const matchedCount = record.parsedIngredients.filter((item) => item.matched).length;

  function askWhy(question: string) {
    setSeedQuestion(question);
    setChatOpen(true);
  }

  return (
    <main className="space-y-4">
      <header className="flex items-center justify-between pt-1">
        <Link
          href="/history"
          className="flex h-9 items-center gap-1 rounded-2xl border border-line bg-surface px-3 text-[13px] text-ink-soft"
        >
          <ChevronRightIcon width={16} height={16} className="rotate-180" />
          返回
        </Link>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void toggleFavorite(record.id)}
            aria-label="收藏"
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-2xl border transition",
              record.favorite
                ? "border-brand/30 bg-brand-soft text-brand-dark"
                : "border-line bg-surface text-muted",
            )}
          >
            <StarIcon width={17} height={17} filled={record.favorite} />
          </button>
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            aria-label="删除"
            className="flex h-9 w-9 items-center justify-center rounded-2xl border border-line bg-surface text-muted"
          >
            <TrashIcon width={17} height={17} />
          </button>
        </div>
      </header>

      <Card className="bg-gradient-to-br from-white to-brand-soft/50">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[20px] font-semibold leading-7 tracking-tight text-ink">
              {record.productName}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Tag tone="brand">{productTypeLabel(record.productType)}</Tag>
              <Tag>{record.parsedIngredients.length} 项成分</Tag>
              <Tag tone="lilac">匹配成分库 {matchedCount} 项</Tag>
            </div>
          </div>
          <AiBadge engine={meta.engine} model={meta.model} />
        </div>
        <p className="mt-3 text-[12px] text-muted">分析时间 {formatDateTime(record.createdAt)}</p>
      </Card>

      {meta.notices.length > 0 ? (
        <ul className="space-y-2">
          {meta.notices.slice(0, 4).map((notice) => (
            <li
              key={notice}
              className="rounded-2xl bg-surface-muted px-3.5 py-2.5 text-[12.5px] leading-5 text-ink-soft"
            >
              {notice}
            </li>
          ))}
        </ul>
      ) : null}

      <Card>
        <CardTitle title="AI 总结" badge={<AiBadge engine={meta.engine} model={meta.model} />} />
        <p className="text-[15px] leading-7 text-ink">{analysis.summary}</p>
        <div className="mt-4 rounded-2xl bg-lilac-soft/60 px-4 py-3.5">
          <p className="mb-1.5 flex items-center gap-1.5 text-[12px] font-medium text-lilac">
            <SparkIcon width={14} height={14} />
            结合你的画像
          </p>
          <p className="text-[13.5px] leading-6 text-ink-soft">{analysis.personalizedAnalysis}</p>
        </div>
      </Card>

      <Card>
        <CardTitle
          title="与你的关注"
          subtitle={
            profile.goals.length > 0
              ? `你关注的功效：${profile.goals.map((goal) => SKIN_GOAL_LABELS[goal]).join(" · ")}`
              : "还没有设置关注功效"
          }
        />
        {profile.goals.length === 0 ? (
          <div className="space-y-3">
            <p className="text-[13.5px] leading-6 text-ink-soft">
              还没有设置关注功效，本次没有输出功效相关性分析。
            </p>
            <Link
              href="/profile"
              className="inline-flex h-10 items-center rounded-2xl bg-brand-soft px-4 text-[13.5px] font-medium text-brand-dark"
            >
              去设置关注功效
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {analysis.matchedGoals.map((goal) => {
              const hasHit = goal.relatedIngredients.length > 0;
              return (
                <li
                  key={goal.goal}
                  className={cn(
                    "rounded-2xl border px-4 py-3.5",
                    hasHit ? "border-brand/25 bg-brand-soft/40" : "border-line bg-surface-muted/50",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[15px] font-semibold text-ink">
                      {SKIN_GOAL_LABELS[goal.goal]}
                    </span>
                    <span className="text-[12px] text-muted">
                      {hasHit
                        ? `相关成分：${goal.relatedIngredients.length} 项 · ${
                            RELEVANCE_LABELS[goal.relevance]
                          }`
                        : "暂未发现相关成分"}
                    </span>
                  </div>
                  {hasHit ? (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {goal.relatedIngredients.slice(0, 8).map((name) => (
                        <Tag key={name} tone="brand">
                          {chineseIngredientLabel(name)}
                        </Tag>
                      ))}
                    </div>
                  ) : null}
                  <p className="mt-2.5 text-[12.5px] leading-5 text-ink-soft">{goal.explanation}</p>
                  {hasHit ? (
                    <button
                      type="button"
                      onClick={() =>
                        askWhy(`我关注${SKIN_GOAL_LABELS[goal.goal]}，这款产品里有哪些相关成分？`)
                      }
                      className="mt-2 text-[12px] font-medium text-brand-dark"
                    >
                      这些成分怎么起作用？问 AI →
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card>
        <CardTitle title="与你的肤质" subtitle={analysis.skinCompatibility.summary} />
        <ul className="space-y-2.5">
          {analysis.skinCompatibility.positives.map((item) => (
            <li
              key={item}
              className="flex gap-2.5 rounded-2xl bg-ok-soft/70 px-3.5 py-3 text-[13px] leading-6 text-ink-soft"
            >
              <CheckIcon width={17} height={17} className="mt-0.5 shrink-0 text-ok" />
              <span>{item}</span>
            </li>
          ))}
          {analysis.skinCompatibility.attentions.map((item) => (
            <li
              key={item}
              className="flex gap-2.5 rounded-2xl bg-warn-soft/80 px-3.5 py-3 text-[13px] leading-6 text-ink-soft"
            >
              <AlertIcon width={17} height={17} className="mt-0.5 shrink-0 text-warn" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap gap-2">
          <Tag tone="ok">✓ 与当前画像相关</Tag>
          <Tag tone="warn">⚠️ 建议关注</Tag>
        </div>
      </Card>

      <Card>
        <CardTitle
          title="配方结构分析"
          subtitle="按成分数量与在成分表中的位置加权估算，不代表真实含量百分比"
        />
        <p className="mb-4 rounded-2xl bg-surface-muted px-4 py-3 text-[13px] leading-6 text-ink-soft">
          {analysis.formulaOverview.summary}
        </p>
        <ul className="space-y-3.5">
          {analysis.formulaOverview.structure.map((item) => (
            <li key={item.group}>
              <div className="mb-1.5 flex items-center justify-between text-[13px]">
                <span className="font-medium text-ink">{item.group}</span>
                <span className="text-muted">约 {item.score}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-surface-muted">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand/60 to-lilac"
                  style={{ width: `${Math.max(4, Math.min(100, item.score))}%` }}
                />
              </div>
              <p className="mt-1.5 text-[12px] leading-5 text-muted">{item.note}</p>
              {item.ingredients.length > 0 ? (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {item.ingredients.map((name) => (
                    <Tag key={name}>{name}</Tag>
                  ))}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <CardTitle title="值得关注" subtitle="区分潜在过敏关注、潜在刺激关注与你自己设置的关注/避开成分" />
        {analysis.watchItems.length === 0 ? (
          <p className="text-[13.5px] leading-6 text-ink-soft">
            本次没有识别到需要特别提示的成分。
          </p>
        ) : (
          <WatchGroups items={analysis.watchItems} onAskWhy={askWhy} />
        )}
      </Card>

      <Card>
        <CardTitle
          title="完整成分表"
          subtitle="点击任意成分可以展开查看名称、分类、作用以及与你关注点的关系"
        />
        <ul className="divide-y divide-line">
          {record.parsedIngredients.map((parsed) => (
            <IngredientRow
              key={`${parsed.position}-${parsed.raw}`}
              raw={parsed.raw}
              ingredientId={parsed.ingredientId}
              position={parsed.position}
              mayContain={parsed.mayContain}
              watched={profile.watchedIngredients}
              avoided={profile.avoidedIngredients}
              explanations={analysis.ingredientExplanations}
            />
          ))}
        </ul>
        {record.unmatchedIngredients.length > 0 ? (
          <div className="mt-4 rounded-2xl bg-surface-muted px-3.5 py-3">
            <p className="text-[12.5px] font-medium text-ink">
              未收录成分（{record.unmatchedIngredients.length} 项）
            </p>
            <p className="mt-1.5 text-[12px] leading-5 text-muted">
              {record.unmatchedIngredients.join("、")}
            </p>
            <p className="mt-1.5 text-[11.5px] leading-5 text-muted">
              这些成分暂未出现在本地成分库中，我们已经把原文一并交给 AI 参考。
            </p>
          </div>
        ) : null}
      </Card>

      <Card>
        <CardTitle title="你粘贴的原始成分表" />
        <p className="max-h-40 overflow-y-auto whitespace-pre-wrap break-words rounded-2xl bg-surface-muted px-3.5 py-3 text-[12px] leading-5 text-muted">
          {record.rawIngredients}
        </p>
      </Card>

      <p className="px-1 pb-2 text-[11.5px] leading-5 text-muted">{MEDICAL_DISCLAIMER}</p>

      <button
        type="button"
        onClick={() => {
          setSeedQuestion(null);
          setChatOpen(true);
        }}
        className="fixed bottom-24 left-1/2 z-30 flex h-12 -translate-x-1/2 items-center gap-2 rounded-full bg-gradient-to-r from-brand to-lilac px-5 text-[14px] font-medium text-white shadow-[var(--shadow-float)]"
      >
        <ChatIcon width={18} height={18} />
        问问 AI
      </button>

      <Sheet
        open={chatOpen}
        onClose={() => {
          setChatOpen(false);
          setSeedQuestion(null);
        }}
        title="问问 AI"
      >
        <div className="h-[62dvh]">
          <ChatPanel
            record={record}
            seedQuestion={seedQuestion}
            onSeedConsumed={() => setSeedQuestion(null)}
          />
        </div>
      </Sheet>

      <Sheet open={deleteOpen} onClose={() => setDeleteOpen(false)} title="删除这条分析记录？">
        <p className="text-[13.5px] leading-6 text-ink-soft">
          删除后这条记录与对应的问答对话都会从当前设备移除，且无法恢复。
        </p>
        <div className="mt-4 flex gap-2">
          <Button variant="soft" fullWidth onClick={() => setDeleteOpen(false)}>
            取消
          </Button>
          <Button
            variant="danger"
            fullWidth
            onClick={async () => {
              await removeAnalysis(record.id);
              router.push("/history");
            }}
          >
            确认删除
          </Button>
        </div>
      </Sheet>
    </main>
  );
}

const WATCH_GROUPS: {
  key: string;
  title: string;
  hint: string;
  types: WatchItem["type"][];
}[] = [
  {
    key: "personal",
    title: "与你个人相关",
    hint: "命中了你在「我的」中设置的关注或避开清单",
    types: ["user_avoid", "user_watch"],
  },
  {
    key: "allergen",
    title: "潜在过敏关注",
    hint: "公开资料中常被列为需要留意的致敏相关成分",
    types: ["allergen", "fragrance"],
  },
  {
    key: "irritation",
    title: "潜在刺激关注",
    hint: "公开资料中常被提到的潜在刺激因素，感受因人而异",
    types: ["irritation"],
  },
  {
    key: "acne",
    title: "与痘痘话题相关",
    hint: "在「是否容易闷痘」讨论中经常出现的成分",
    types: ["acne_related"],
  },
  {
    key: "other",
    title: "配方体系说明",
    hint: "帮你理解配方的组成逻辑，本身不代表风险",
    types: ["preservative", "other"],
  },
];

function WatchGroups({
  items,
  onAskWhy,
}: {
  items: WatchItem[];
  onAskWhy: (question: string) => void;
}) {
  return (
    <div className="space-y-4">
      {WATCH_GROUPS.map((group) => {
        const groupItems = items.filter((item) => group.types.includes(item.type));
        if (groupItems.length === 0) return null;
        return (
          <section key={group.key}>
            <div className="mb-2 flex items-center gap-2">
              <h3 className="text-[13.5px] font-medium text-ink">{group.title}</h3>
              <span className="text-[11.5px] text-muted">{groupItems.length} 项</span>
            </div>
            <p className="mb-2 text-[11.5px] leading-5 text-muted">{group.hint}</p>
            <ul className="space-y-2">
              {groupItems.map((item, index) => (
                <li
                  key={`${item.ingredient}-${item.type}-${index}`}
                  className={cn(
                    "rounded-2xl border px-3.5 py-3",
                    item.userRelated
                      ? "border-brand/30 bg-brand-soft/40"
                      : "border-line bg-surface-muted/50",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[13.5px] font-medium text-ink">
                      {chineseIngredientLabel(item.ingredient)}
                    </p>
                    <Tag tone={item.userRelated ? "brand" : "warn"}>
                      {WATCH_TYPE_LABELS[item.type]}
                    </Tag>
                  </div>
                  <p className="mt-1.5 text-[12.5px] leading-5 text-ink-soft">{item.reason}</p>
                  <button
                    type="button"
                    onClick={() =>
                      onAskWhy(`为什么特别提醒「${chineseIngredientLabel(item.ingredient)}」这个成分？`)
                    }
                    className="mt-2 text-[12px] font-medium text-brand-dark"
                  >
                    为什么？问 AI 解释 →
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function matchesUserList(record: IngredientRecord, list: string[]): boolean {
  const target = record.inci_name.toLowerCase();
  return list.some((entry) => {
    const value = entry.trim().toLowerCase();
    if (!value) return false;
    return (
      value === target ||
      value === record.chinese_name ||
      record.aliases.some((alias) => alias.toLowerCase() === value)
    );
  });
}

function IngredientRow({
  raw,
  ingredientId,
  position,
  mayContain,
  watched,
  avoided,
  explanations,
}: {
  raw: string;
  ingredientId: string | null;
  position: number;
  mayContain: boolean;
  watched: string[];
  avoided: string[];
  explanations: { ingredient: string; explanation: string }[];
}) {
  const [open, setOpen] = useState(false);
  const record: IngredientRecord | undefined = ingredientId
    ? getIngredientById(ingredientId)
    : undefined;
  const isAvoided = record ? matchesUserList(record, avoided) : false;
  const isWatched = record ? matchesUserList(record, watched) : false;
  const needsAttention = Boolean(record?.allergen_flag || record?.irritation_flag);
  const aiExplanation = explanations.find(
    (item) =>
      (record ? chineseIngredientLabel(item.ingredient) === record.chinese_name : false) ||
      chineseIngredientLabel(item.ingredient) === chineseIngredientLabel(raw),
  );

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-3 py-3 text-left"
      >
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-[11px] text-muted">
          {position + 1}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="text-[13.5px] font-medium text-ink">
              {record ? record.chinese_name : chineseIngredientLabel(raw)}
            </span>
            {!record ? <Tag>成分库暂未收录</Tag> : null}
            {isAvoided ? <Tag tone="warn">你的避开成分</Tag> : null}
            {isWatched ? <Tag tone="brand">你的关注成分</Tag> : null}
            {needsAttention ? <Tag tone="lilac">建议特别了解</Tag> : null}
            {mayContain ? <Tag>可能含有</Tag> : null}
          </span>
        </span>
        <ChevronDownIcon
          width={18}
          height={18}
          className={cn("shrink-0 text-muted transition", open && "rotate-180")}
        />
      </button>

      {open ? (
        <div className="mb-3 space-y-2 rounded-2xl bg-surface-muted/70 px-3.5 py-3 text-[12.5px] leading-5 text-ink-soft">
          {record ? (
            <>
              <p>
                <span className="text-muted">INCI 名称：</span>
                {record.inci_name}
              </p>
              <p>
                <span className="text-muted">分类：</span>
                {INGREDIENT_CATEGORY_LABELS[record.category]}
              </p>
              <p>
                <span className="text-muted">主要作用：</span>
                {record.functions.join("、")}
              </p>
              <p>
                <span className="text-muted">与你的关系：</span>
                {isAvoided
                  ? "它在你设置的「避开成分」清单中。"
                  : isWatched
                    ? "它在你设置的「关注成分」清单中。"
                    : "未直接命中你的关注 / 避开清单。"}
              </p>
              <p>
                <span className="text-muted">是否需要特别了解：</span>
                {needsAttention
                  ? "公开资料中属于常被提及的关注类成分，可以重点了解。"
                  : "暂无特别提示。"}
              </p>
              <p className="text-muted">{record.skin_related_notes}</p>
              {aiExplanation ? (
                <p className="rounded-xl bg-white/70 px-2.5 py-2">
                  <span className="text-muted">AI 解读：</span>
                  {aiExplanation.explanation}
                </p>
              ) : null}
              <p className="text-[11px] text-muted">
                资料来源：{record.source}。{record.notes}
              </p>
            </>
          ) : (
            <>
              <p>
                这项成分暂未收录在本地成分库中，暂时无法给出中文名称与详细说明，已为你保留包装上的原始写法。
              </p>
              <p className="text-[11px] text-muted">原始写法：{raw}</p>
              {aiExplanation ? (
                <p className="rounded-xl bg-white/70 px-2.5 py-2">
                  <span className="text-muted">AI 解读：</span>
                  {aiExplanation.explanation}
                </p>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </li>
  );
}
