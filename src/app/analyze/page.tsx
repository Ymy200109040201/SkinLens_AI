"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { CameraIcon, ChevronRightIcon, FlaskIcon, SparkIcon } from "@/components/icons";
import { Button, Card, CardTitle, Chip, Notice, Spinner, Tag } from "@/components/ui";
import { PRODUCT_TYPE_LABELS } from "@/lib/domain/labels";
import type { ProductType } from "@/lib/domain/types";
import { parseIngredients, SAMPLE_INGREDIENTS } from "@/lib/ingredients/parser";
import { addAnalysis } from "@/lib/store/client-store";
import { toProfileSnapshot } from "@/lib/storage/types";
import { useStore } from "@/hooks/useStore";

const PRODUCT_TYPES: ProductType[] = [
  "cream",
  "serum",
  "toner",
  "sunscreen",
  "mask",
  "cleanser",
  "makeup",
  "other",
];

const LOADING_STEPS = [
  "正在解析成分表…",
  "正在匹配本地成分数据库…",
  "正在评估配方结构…",
  "AI 正在结合你的画像生成分析…",
  "正在整理报告…",
];

export default function AnalyzePage() {
  const router = useRouter();
  const { profile } = useStore();

  const [productName, setProductName] = useState("");
  const [productType, setProductType] = useState<ProductType>("serum");
  const [rawIngredients, setRawIngredients] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [sampleIndex, setSampleIndex] = useState(0);

  const preview = useMemo(() => {
    if (rawIngredients.trim().length < 4) return null;
    try {
      const result = parseIngredients(rawIngredients);
      return {
        total: result.items.length,
        matched: result.items.filter((item) => item.matched).length,
        unmatched: result.items.filter((item) => !item.matched).length,
      };
    } catch {
      return null;
    }
  }, [rawIngredients]);

  const canSubmit = rawIngredients.trim().length > 0 && !loading;

  function fillSample() {
    const sample = SAMPLE_INGREDIENTS[sampleIndex % SAMPLE_INGREDIENTS.length];
    setProductName(sample.name);
    setProductType(sample.type);
    setRawIngredients(sample.text);
    setSampleIndex((value) => value + 1);
    setError(null);
  }

  async function handleSubmit() {
    setError(null);

    const text = rawIngredients.trim();
    if (!text) {
      setError("请先粘贴完整的成分表，例如：Water, Glycerin, Niacinamide…");
      return;
    }
    if (preview && preview.total < 3) {
      setError("识别到的成分太少，请检查是否粘贴了完整成分表（通常 10 项以上）。");
      return;
    }

    setLoading(true);
    setStep(0);
    const timer = setInterval(() => {
      setStep((value) => (value + 1) % LOADING_STEPS.length);
    }, 1400);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName: productName.trim(),
          productType,
          rawIngredients: text,
          profile: toProfileSnapshot(profile),
        }),
      });

      const data = (await response.json().catch(() => null)) as
        | { record?: import("@/lib/domain/types").AnalysisRecord; message?: string }
        | null;

      if (!response.ok || !data?.record) {
        setError(data?.message ?? "分析失败，请稍后重试。");
        setLoading(false);
        return;
      }

      await addAnalysis(data.record);
      router.push(`/report/${data.record.id}`);
    } catch {
      setError("网络请求失败，请检查网络后重试。");
      setLoading(false);
    } finally {
      clearInterval(timer);
    }
  }

  return (
    <main className="space-y-4">
      <header className="flex items-center gap-2 pt-1">
        <Link
          href="/"
          className="flex h-9 w-9 items-center justify-center rounded-2xl border border-line bg-surface text-ink-soft"
          aria-label="返回首页"
        >
          <ChevronRightIcon width={18} height={18} className="rotate-180" />
        </Link>
        <h1 className="text-[19px] font-semibold tracking-tight text-ink">分析产品</h1>
      </header>

      <Card>
        <CardTitle
          title="产品信息"
          subtitle="名称可以留空，我们会用产品类型作为标题"
          badge={<AiBadgeInline />}
        />

        <label className="block">
          <span className="text-[13px] font-medium text-ink-soft">产品名称（可选）</span>
          <input
            value={productName}
            onChange={(event) => setProductName(event.target.value)}
            placeholder="例如：某品牌净透焕亮精华"
            className="mt-2 h-12 w-full rounded-2xl border border-line-strong bg-surface px-4 text-[14px] text-ink outline-none transition placeholder:text-muted focus:border-brand"
          />
        </label>

        <div className="mt-5">
          <span className="text-[13px] font-medium text-ink-soft">产品类型</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {PRODUCT_TYPES.map((type) => (
              <Chip
                key={type}
                selected={productType === type}
                onClick={() => setProductType(type)}
              >
                {PRODUCT_TYPE_LABELS[type]}
              </Chip>
            ))}
          </div>
        </div>
      </Card>

      <Card>
        <CardTitle
          title="完整成分表"
          subtitle="直接从包装或商品详情页复制粘贴即可，中英文、逗号或顿号分隔都能识别"
        />

        <textarea
          value={rawIngredients}
          onChange={(event) => {
            setRawIngredients(event.target.value);
            setError(null);
          }}
          rows={9}
          placeholder="例如：水、甘油、烟酰胺、丁二醇、聚二甲基硅氧烷……（中英文成分名都支持）"
          className="w-full resize-y rounded-2xl border border-line-strong bg-surface px-4 py-3 text-[13.5px] leading-6 text-ink outline-none transition placeholder:text-muted focus:border-brand"
        />

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button variant="soft" size="sm" onClick={fillSample} disabled={loading}>
            <FlaskIcon width={16} height={16} />
            填入示例成分表
          </Button>
          {rawIngredients ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setRawIngredients("");
                setProductName("");
                setError(null);
              }}
              disabled={loading}
            >
              清空
            </Button>
          ) : null}
        </div>

        {preview ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Tag tone="ok">已识别 {preview.total} 项成分</Tag>
            <Tag tone="brand">成分库匹配 {preview.matched} 项</Tag>
            {preview.unmatched > 0 ? <Tag tone="warn">未收录 {preview.unmatched} 项</Tag> : null}
          </div>
        ) : null}

        {error ? (
          <div className="mt-3">
            <p className="rounded-2xl bg-warn-soft px-3.5 py-3 text-[12.5px] leading-5 text-warn">
              {error}
            </p>
          </div>
        ) : null}
      </Card>

      <div className="space-y-2">
        <div className="flex items-center gap-2 rounded-2xl border border-dashed border-line-strong bg-surface/60 px-4 py-3 text-[12.5px] text-muted">
          <CameraIcon width={18} height={18} />
          拍照识别查成分 · 即将推出
        </div>
        <div className="rounded-2xl border border-dashed border-line-strong bg-surface/60 px-4 py-3 text-[12.5px] text-muted">
          复制链接查成分 · 即将推出
        </div>
      </div>

      <Button size="lg" fullWidth onClick={handleSubmit} disabled={!canSubmit}>
        {loading ? (
          <>
            <Spinner />
            {LOADING_STEPS[step]}
          </>
        ) : (
          <>
            <SparkIcon width={18} height={18} />
            开始 AI 分析
          </>
        )}
      </Button>

      {loading ? (
        <Card className="text-center">
          <p className="text-[13px] leading-6 text-ink-soft">
            分析通常需要 3-10 秒。未配置 AI Key 时，会使用本地成分库与规则引擎完成分析，同样可以走通完整流程。
          </p>
        </Card>
      ) : (
        <Notice>
          分析会结合你在「我的」中设置的肤质、关注功效与关注/避开成分。还没设置也可以先分析，之后重新分析会得到更贴合的结果。
        </Notice>
      )}
    </main>
  );
}

function AiBadgeInline() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-lilac-soft px-2.5 py-1 text-[11px] font-medium text-lilac">
      一次分析 = 解析 + 匹配 + AI 解读
    </span>
  );
}
