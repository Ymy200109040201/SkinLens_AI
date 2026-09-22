"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { CameraIcon, ChevronRightIcon, LinkIcon, PlusIcon, ShieldIcon, TrashIcon } from "@/components/icons";
import { AiBadge, Button, Card, CardTitle, Chip, Sheet, Tag } from "@/components/ui";
import {
  APP_NAME,
  INFO_DATA_NOTICE,
  MEDICAL_DISCLAIMER,
  SKIN_CONCERN_LABELS,
  SKIN_GOAL_LABELS,
  SKIN_TYPE_LABELS,
} from "@/lib/domain/labels";
import type { SkinConcern, SkinGoal, SkinType, UserProfile } from "@/lib/domain/types";
import { searchIngredients } from "@/lib/ingredients/lookup";
import {
  clearAllData,
  exportData,
  loadDemoData,
  updateProfile,
} from "@/lib/store/client-store";
import { useStore } from "@/hooks/useStore";

const SKIN_TYPES: SkinType[] = ["dry", "oily", "combination", "normal", "unsure"];
const SKIN_CONCERNS: SkinConcern[] = ["redness", "acne", "dryness", "oiliness", "stinging", "pores"];
const SKIN_GOALS: SkinGoal[] = [
  "whitening",
  "anti_aging",
  "hydration",
  "barrier",
  "soothing",
  "oil_control",
  "pores",
  "antioxidant",
];

const WATCH_SUGGESTIONS = ["香精", "变性乙醇", "芳樟醇", "柠檬烯", "水杨酸"];

export default function ProfilePage() {
  const { ready, profile, analyses, aiMode, aiModel } = useStore();
  const [clearOpen, setClearOpen] = useState(false);
  const [demoConfirmOpen, setDemoConfirmOpen] = useState(false);
  const [exported, setExported] = useState(false);
  const [demoMessage, setDemoMessage] = useState<{ tone: "ok" | "warn"; text: string } | null>(
    null,
  );
  const [loadingDemo, setLoadingDemo] = useState(false);

  function patch(next: Partial<UserProfile>) {
    void updateProfile(next);
  }

  function toggleConcern(concern: SkinConcern) {
    patch({
      skinConcerns: profile.skinConcerns.includes(concern)
        ? profile.skinConcerns.filter((item) => item !== concern)
        : [...profile.skinConcerns, concern],
    });
  }

  function toggleGoal(goal: SkinGoal) {
    patch({
      goals: profile.goals.includes(goal)
        ? profile.goals.filter((item) => item !== goal)
        : [...profile.goals, goal],
    });
  }

  async function handleExport() {
    const json = await exportData();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `skinlens-data-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setExported(true);
    setTimeout(() => setExported(false), 2400);
  }

  async function handleLoadDemo() {
    setLoadingDemo(true);
    setDemoMessage(null);
    try {
      const count = await loadDemoData();
      setDemoMessage({
        tone: "ok",
        text: `已载入演示画像与 ${count} 条示例产品分析，可以到「记录」和「对比」里查看。`,
      });
    } catch (error) {
      setDemoMessage({
        tone: "warn",
        text: error instanceof Error ? error.message : "演示数据载入失败，请稍后重试。",
      });
    } finally {
      setLoadingDemo(false);
    }
  }

  return (
    <main className="space-y-4">
      <header className="flex items-center justify-between pt-1">
        <h1 className="text-[19px] font-semibold tracking-tight text-ink">我的</h1>
        <AiBadge engine={aiMode === "llm" ? "llm" : "rule"} model={aiModel} />
      </header>

      <Card>
        <CardTitle title="昵称" subtitle="可选，仅用于让报告读起来更自然" />
        <input
          value={profile.nickname}
          onChange={(event) => patch({ nickname: event.target.value.slice(0, 20) })}
          placeholder="例如：小奇"
          className="h-12 w-full rounded-2xl border border-line-strong bg-surface px-4 text-[14px] text-ink outline-none focus:border-brand"
        />
      </Card>

      <Card>
        <CardTitle title="肤质" subtitle="单选，选择「不确定」也可以正常分析" />
        <div className="flex flex-wrap gap-2">
          {SKIN_TYPES.map((type) => (
            <Chip
              key={type}
              selected={profile.skinType === type}
              onClick={() => patch({ skinType: profile.skinType === type ? null : type })}
            >
              {SKIN_TYPE_LABELS[type]}
            </Chip>
          ))}
        </div>
      </Card>

      <Card>
        <CardTitle title="肤质特征" subtitle="可多选，会用于判断哪些成分更值得你留意" />
        <div className="flex flex-wrap gap-2">
          {SKIN_CONCERNS.map((concern) => (
            <Chip
              key={concern}
              selected={profile.skinConcerns.includes(concern)}
              onClick={() => toggleConcern(concern)}
            >
              {SKIN_CONCERN_LABELS[concern]}
            </Chip>
          ))}
        </div>
      </Card>

      <Link
        href="/skin-analysis"
        className="flex items-center justify-between rounded-3xl border border-dashed border-line-strong bg-surface/70 px-5 py-4 transition hover:border-brand/40"
      >
        <span className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-lilac-soft text-lilac">
            <CameraIcon width={19} height={19} />
          </span>
          <span>
            <span className="block text-[14px] font-medium text-ink">AI 拍照测肤</span>
            <span className="mt-0.5 block text-[12px] text-muted">可同时给出肤质和肤质特征建议</span>
          </span>
        </span>
        <ChevronRightIcon width={18} height={18} className="text-muted" />
      </Link>

      <Card>
        <CardTitle title="关注功效" subtitle="可多选，分析时会优先说明这些方向上的相关成分" />
        <div className="flex flex-wrap gap-2">
          {SKIN_GOALS.map((goal) => (
            <Chip
              key={goal}
              selected={profile.goals.includes(goal)}
              onClick={() => toggleGoal(goal)}
            >
              {SKIN_GOAL_LABELS[goal]}
            </Chip>
          ))}
        </div>
      </Card>

      <IngredientEditor
        title="关注的成分"
        subtitle="想重点了解的成分，例如你听说过但不确定的成分"
        tone="brand"
        values={profile.watchedIngredients}
        onChange={(values) => patch({ watchedIngredients: values })}
      />

      <IngredientEditor
        title="希望避开的成分"
        subtitle="分析时如果命中，会在报告里优先标出"
        tone="warn"
        values={profile.avoidedIngredients}
        onChange={(values) => patch({ avoidedIngredients: values })}
      />

      <Card>
        <CardTitle title="隐私与数据" subtitle="本地存储、AI 传输与照片政策的说明" />
        <Link
          href="/privacy"
          className="flex items-center justify-between rounded-2xl border border-line bg-surface-muted/60 px-4 py-3 text-[13.5px] text-ink-soft"
        >
          <span className="flex items-center gap-2">
            <ShieldIcon width={17} height={17} className="text-lilac" />
            查看隐私与数据说明
          </span>
          <ChevronRightIcon width={17} height={17} className="text-muted" />
        </Link>
      </Card>

      <Card>
        <CardTitle
          title="数据管理"
          subtitle={`当前设备已保存 ${analyses.length} 条分析记录，全部只存在你自己的浏览器里`}
        />
        <div className="flex flex-wrap gap-2">
          <Button variant="soft" size="sm" onClick={() => setDemoConfirmOpen(true)} disabled={!ready || loadingDemo}>
            {loadingDemo ? "正在载入…" : "载入演示数据"}
          </Button>
          <Button variant="soft" size="sm" onClick={handleExport} disabled={!ready}>
            导出我的数据
          </Button>
          <Button variant="danger" size="sm" onClick={() => setClearOpen(true)} disabled={!ready}>
            <TrashIcon width={15} height={15} />
            清除全部数据
          </Button>
        </div>
        {demoMessage ? (
          <p
            className={`mt-3 rounded-2xl px-3.5 py-2.5 text-[12.5px] leading-5 ${
              demoMessage.tone === "ok" ? "bg-ok-soft text-ok" : "bg-warn-soft text-warn"
            }`}
          >
            {demoMessage.text}
          </p>
        ) : null}
        {exported ? (
          <p className="mt-3 text-[12px] text-ok">已导出 JSON 文件到你的下载目录。</p>
        ) : null}
      </Card>

      <Card>
        <CardTitle title="未来功能" />
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-2xl border border-dashed border-line-strong px-4 py-3 text-[13.5px] text-muted">
            <span className="flex items-center gap-2">
              <CameraIcon width={17} height={17} />
              拍照识别查成分 · 即将推出
            </span>
          </div>
          <div className="flex items-center justify-between rounded-2xl border border-dashed border-line-strong px-4 py-3 text-[13.5px] text-muted">
            <span className="flex items-center gap-2">
              <LinkIcon width={17} height={17} />
              复制链接查成分 · 即将推出
            </span>
          </div>
        </div>
      </Card>

      <Card>
        <CardTitle title={`关于 ${APP_NAME}`} subtitle="MVP 试用版 v0.1.0" />
        <p className="text-[12.5px] leading-6 text-ink-soft">{INFO_DATA_NOTICE}</p>
        <p className="mt-3 text-[12px] leading-6 text-muted">{MEDICAL_DISCLAIMER}</p>
      </Card>

      <Sheet open={clearOpen} onClose={() => setClearOpen(false)} title="清除全部本地数据？">
        <p className="text-[13.5px] leading-6 text-ink-soft">
          将删除当前设备上的个人画像、{analyses.length} 条分析记录以及全部问答对话，操作无法撤销。
        </p>
        <div className="mt-4 flex gap-2">
          <Button variant="soft" fullWidth onClick={() => setClearOpen(false)}>
            取消
          </Button>
          <Button
            variant="danger"
            fullWidth
            onClick={async () => {
              await clearAllData();
              setClearOpen(false);
            }}
          >
            确认清除
          </Button>
        </div>
      </Sheet>

      <Sheet
        open={demoConfirmOpen}
        onClose={() => setDemoConfirmOpen(false)}
        title="载入演示数据？"
      >
        <p className="text-[13.5px] leading-6 text-ink-soft">
          这会替换你当前的个人画像，并加入 3 条示例产品分析记录。现有分析记录会保留，你可以随时在数据管理中清除全部数据。
        </p>
        <div className="mt-4 flex gap-2">
          <Button variant="soft" fullWidth onClick={() => setDemoConfirmOpen(false)}>
            取消
          </Button>
          <Button
            fullWidth
            disabled={loadingDemo}
            onClick={async () => {
              await handleLoadDemo();
              setDemoConfirmOpen(false);
            }}
          >
            {loadingDemo ? "正在载入…" : "确认载入"}
          </Button>
        </div>
      </Sheet>
    </main>
  );
}

function IngredientEditor({
  title,
  subtitle,
  tone,
  values,
  onChange,
}: {
  title: string;
  subtitle: string;
  tone: "brand" | "warn";
  values: string[];
  onChange: (values: string[]) => void;
}) {
  const [input, setInput] = useState("");

  const suggestions = useMemo(() => {
    const keyword = input.trim();
    if (keyword.length < 2) return [];
    return searchIngredients(keyword, 5).map((item) => item.chinese_name);
  }, [input]);

  function add(value: string) {
    const name = value.trim();
    if (!name) return;
    if (values.some((item) => item.toLowerCase() === name.toLowerCase())) {
      setInput("");
      return;
    }
    onChange([...values, name]);
    setInput("");
  }

  return (
    <Card>
      <CardTitle title={title} subtitle={subtitle} />
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add(input);
            }
          }}
          placeholder="输入成分名，中文或英文都可以，例如：香精 / Fragrance"
          className="h-11 flex-1 rounded-2xl border border-line-strong bg-surface px-4 text-[13.5px] text-ink outline-none focus:border-brand"
        />
        <Button size="md" onClick={() => add(input)} disabled={!input.trim()}>
          <PlusIcon width={17} height={17} />
          添加
        </Button>
      </div>

      {suggestions.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {suggestions.map((name) => (
            <button key={name} type="button" onClick={() => add(name)}>
              <Tag tone={tone}>{name} +</Tag>
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {values.length === 0 ? (
          <p className="text-[12.5px] text-muted">还没有添加，可以从下面的常用项快速添加。</p>
        ) : (
          values.map((value) => (
            <span
              key={value}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] ${
                tone === "warn"
                  ? "border-warn/25 bg-warn-soft text-warn"
                  : "border-brand/25 bg-brand-soft text-brand-dark"
              }`}
            >
              {value}
              <button
                type="button"
                onClick={() => onChange(values.filter((item) => item !== value))}
                aria-label={`删除 ${value}`}
                className="text-current opacity-70"
              >
                ×
              </button>
            </span>
          ))
        )}
      </div>

      <div className="mt-3 border-t border-line pt-3">
        <p className="mb-2 text-[11.5px] text-muted">常用成分</p>
        <div className="flex flex-wrap gap-1.5">
          {WATCH_SUGGESTIONS.map((name) => (
            <button key={name} type="button" onClick={() => add(name)}>
              <Tag>{name} +</Tag>
            </button>
          ))}
        </div>
      </div>
    </Card>
  );
}
