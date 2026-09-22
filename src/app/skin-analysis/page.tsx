import Link from "next/link";

import { CameraIcon, ChevronRightIcon, ShieldIcon } from "@/components/icons";
import { Card, CardTitle, Notice } from "@/components/ui";

export default function SkinAnalysisPage() {
  return (
    <main className="space-y-4">
      <header className="flex items-center gap-2 pt-1">
        <Link
          href="/profile"
          className="flex h-9 w-9 items-center justify-center rounded-2xl border border-line bg-surface text-ink-soft"
          aria-label="返回我的"
        >
          <ChevronRightIcon width={18} height={18} className="rotate-180" />
        </Link>
        <h1 className="text-[19px] font-semibold tracking-tight text-ink">AI 拍照测肤</h1>
      </header>

      <Card className="overflow-hidden bg-gradient-to-br from-brand-soft/60 via-surface to-lilac-soft/60">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-lilac shadow-sm">
          <CameraIcon width={23} height={23} />
        </div>
        <h2 className="mt-4 text-[21px] font-semibold tracking-tight text-ink">功能敬请期待</h2>
        <p className="mt-2 text-[13.5px] leading-6 text-ink-soft">
          未来可通过照片获得肤质和肤质特征建议，再由你确认后应用到个人画像。
        </p>
      </Card>

      <Card>
        <CardTitle title="未来如何使用" />
        <ol className="space-y-3 text-[13.5px] leading-6 text-ink-soft">
          <li><span className="mr-2 font-medium text-brand-dark">1.</span>拍摄或选择一张面部照片。</li>
          <li><span className="mr-2 font-medium text-brand-dark">2.</span>查看 AI 提供的肤质与肤质特征建议。</li>
          <li><span className="mr-2 font-medium text-brand-dark">3.</span>确认后再将建议应用到你的个人画像。</li>
        </ol>
      </Card>

      <Notice>
        当前版本不拍照、不上传、不保存任何人脸照片。你现在可以手动选择肤质和肤质特征，正常使用全部成分分析功能。
      </Notice>

      <Link
        href="/profile"
        className="flex h-12 items-center justify-center rounded-2xl bg-brand-soft text-[14px] font-medium text-brand-dark"
      >
        去手动设置画像
      </Link>

      <Link
        href="/privacy"
        className="flex items-center justify-between rounded-2xl border border-line bg-surface-muted/60 px-4 py-3 text-[13px] text-ink-soft"
      >
        <span className="flex items-center gap-2">
          <ShieldIcon width={17} height={17} className="text-lilac" />
          查看照片与数据说明
        </span>
        <ChevronRightIcon width={17} height={17} className="text-muted" />
      </Link>
    </main>
  );
}
