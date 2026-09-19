"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { CompareIcon, HomeIcon, RecordIcon, UserIcon } from "./icons";
import { cn } from "@/lib/format";

const ITEMS = [
  { href: "/", label: "首页", Icon: HomeIcon },
  { href: "/history", label: "记录", Icon: RecordIcon },
  { href: "/compare", label: "对比", Icon: CompareIcon },
  { href: "/profile", label: "我的", Icon: UserIcon },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/85 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-[640px] items-stretch justify-between px-3 pt-2 pb-safe">
        {ITEMS.map(({ href, label, Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 rounded-2xl px-2 py-1.5 text-[11px] transition",
                active ? "text-brand-dark" : "text-muted hover:text-ink-soft",
              )}
            >
              <span
                className={cn(
                  "flex h-9 w-full max-w-[64px] items-center justify-center rounded-xl transition",
                  active ? "bg-brand-soft" : "bg-transparent",
                )}
              >
                <Icon width={20} height={20} />
              </span>
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
