"use client";

import Link from "next/link";
import { useEffect } from "react";

import { Button, Card, CardTitle } from "@/components/ui";

/**
 * 路由级错误兜底
 *
 * 公网试用环境里，用户可能遇到网络抖动或浏览器限制（例如无痕模式下禁用本地存储）。
 * 这里保证任何未预期错误都有一页可读的中文提示，而不是浏览器默认报错页。
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app] 页面出现未预期错误", error);
  }, [error]);

  return (
    <main className="space-y-4 pt-8">
      <Card>
        <CardTitle
          title="页面暂时没能打开"
          subtitle="可能是网络波动，或浏览器限制了本地存储。重试通常就能恢复。"
        />
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={reset}>
            重试
          </Button>
          <Link
            href="/"
            className="inline-flex h-9 items-center rounded-xl border border-line-strong bg-surface px-3 text-[13px] text-ink-soft"
          >
            返回首页
          </Link>
        </div>
      </Card>
    </main>
  );
}
