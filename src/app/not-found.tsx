import Link from "next/link";

import { Card, CardTitle } from "@/components/ui";

export const metadata = { title: "页面不存在" };

export default function NotFound() {
  return (
    <main className="space-y-4 pt-8">
      <Card>
        <CardTitle
          title="没有找到这个页面"
          subtitle="链接可能已经失效，或者这条分析记录已从当前设备删除。"
        />
        <div className="flex flex-wrap gap-2">
          <Link
            href="/"
            className="inline-flex h-10 items-center rounded-2xl bg-gradient-to-r from-brand to-lilac px-4 text-[13.5px] font-medium text-white"
          >
            返回首页
          </Link>
          <Link
            href="/analyze"
            className="inline-flex h-10 items-center rounded-2xl border border-line-strong bg-surface px-4 text-[13.5px] text-ink-soft"
          >
            分析一款产品
          </Link>
        </div>
      </Card>
    </main>
  );
}
