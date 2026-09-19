import Link from "next/link";

import { Card, CardTitle } from "@/components/ui";

export const metadata = { title: "离线状态" };

export default function OfflinePage() {
  return (
    <main className="space-y-4 pt-8">
      <Card>
        <CardTitle
          title="当前处于离线状态"
          subtitle="SkinLens AI 已缓存基础页面，但分析需要联网调用服务端接口。"
        />
        <p className="text-[13px] leading-6 text-ink-soft">
          你仍然可以浏览已缓存的分析记录页面。恢复网络后刷新即可继续分析新产品。
        </p>
        <Link
          href="/history"
          className="mt-4 inline-flex h-11 items-center rounded-2xl border border-line-strong bg-surface px-4 text-[14px] text-ink-soft"
        >
          查看分析记录
        </Link>
      </Card>
    </main>
  );
}
