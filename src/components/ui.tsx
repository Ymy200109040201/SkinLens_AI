"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/format";

export function Card({
  children,
  className,
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section className={cn("card-base", padded && "p-5", className)}>{children}</section>
  );
}

export function CardTitle({
  title,
  subtitle,
  badge,
  action,
}: {
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-[17px] font-semibold tracking-tight text-ink">{title}</h2>
          {badge}
        </div>
        {subtitle ? <p className="mt-1 text-[13px] leading-5 text-muted">{subtitle}</p> : null}
      </div>
      {action}
    </header>
  );
}

export function AiBadge({ engine, model }: { engine?: "llm" | "rule"; model?: string | null }) {
  const isLlm = engine === "llm";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium",
        isLlm ? "bg-lilac-soft text-lilac" : "bg-brand-soft text-brand-dark",
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      {isLlm ? "AI 洞察" : "本地演示分析"}
      {isLlm && model ? <span className="opacity-70">· {model}</span> : null}
    </span>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "soft" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
};

export function Button({
  variant = "primary",
  size = "md",
  fullWidth,
  className,
  children,
  ...rest
}: ButtonProps) {
  const variants: Record<string, string> = {
    primary:
      "bg-gradient-to-r from-brand to-lilac text-white shadow-[var(--shadow-float)] hover:brightness-[1.03] active:brightness-95 disabled:opacity-60",
    soft: "bg-surface text-ink border border-line-strong hover:bg-surface-muted",
    ghost: "text-ink-soft hover:bg-surface-muted",
    danger: "bg-[#FBECEF] text-[#B3455F] border border-[#F3D6DD]",
  };
  const sizes: Record<string, string> = {
    sm: "h-9 px-3 text-[13px] rounded-xl",
    md: "h-11 px-4 text-[14px] rounded-2xl",
    lg: "h-14 px-5 text-[16px] rounded-2xl",
  };
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 font-medium transition disabled:cursor-not-allowed",
        variants[variant],
        sizes[size],
        fullWidth && "w-full",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Chip({
  selected,
  children,
  onClick,
  className,
}: {
  selected?: boolean;
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "rounded-full border px-3.5 py-2 text-[13px] transition",
        selected
          ? "border-brand bg-brand-soft font-medium text-brand-dark"
          : "border-line-strong bg-surface text-ink-soft hover:border-brand/40",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Tag({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "brand" | "warn" | "ok" | "lilac";
}) {
  const tones: Record<string, string> = {
    neutral: "bg-surface-muted text-ink-soft border-line",
    brand: "bg-brand-soft text-brand-dark border-brand/20",
    warn: "bg-warn-soft text-warn border-warn/20",
    ok: "bg-ok-soft text-ok border-ok/20",
    lilac: "bg-lilac-soft text-lilac border-lilac/20",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11.5px] leading-none",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

export function ScoreBar({ value, tone = "brand" }: { value: number; tone?: "brand" | "lilac" | "warn" }) {
  const tones: Record<string, string> = {
    brand: "bg-gradient-to-r from-brand/70 to-brand",
    lilac: "bg-gradient-to-r from-lilac/70 to-lilac",
    warn: "bg-gradient-to-r from-warn/70 to-warn",
  };
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-muted">
      <div
        className={cn("h-full rounded-full transition-all", tones[tone])}
        style={{ width: `${Math.max(4, Math.min(100, value))}%` }}
      />
    </div>
  );
}

export function EmptyState({
  title,
  description,
  icon,
  action,
}: {
  title: string;
  description: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-line-strong bg-surface/70 px-6 py-10 text-center">
      {icon ? <div className="mb-1 text-brand">{icon}</div> : null}
      <p className="text-[15px] font-medium text-ink">{title}</p>
      <p className="max-w-[280px] text-[13px] leading-5 text-muted">{description}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

export function Notice({
  children,
  tone = "info",
}: {
  children: ReactNode;
  tone?: "info" | "warn";
}) {
  return (
    <p
      className={cn(
        "rounded-2xl px-3.5 py-3 text-[12.5px] leading-5",
        tone === "warn" ? "bg-warn-soft text-warn" : "bg-lilac-soft/70 text-lilac",
      )}
    >
      {children}
    </p>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white",
        className,
      )}
    />
  );
}

export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        type="button"
        aria-label="关闭"
        onClick={onClose}
        className="absolute inset-0 bg-ink/25 backdrop-blur-[2px]"
      />
      <div className="relative z-10 max-h-[86dvh] w-full max-w-[640px] overflow-hidden rounded-t-3xl border border-line bg-surface shadow-2xl">
        <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h3 className="text-[16px] font-semibold text-ink">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-muted transition hover:bg-surface-muted"
            aria-label="关闭"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </header>
        <div className="no-scrollbar max-h-[68dvh] overflow-y-auto px-5 py-4">{children}</div>
        {footer ? <div className="border-t border-line px-5 py-3 pb-safe">{footer}</div> : null}
      </div>
    </div>
  );
}
