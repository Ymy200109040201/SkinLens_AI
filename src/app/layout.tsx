import type { Metadata, Viewport } from "next";

import BottomNav from "@/components/BottomNav";
import PwaRegister from "@/components/PwaRegister";
import { APP_NAME, APP_TAGLINE } from "@/lib/domain/labels";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: `${APP_NAME} · AI 化妆品成分分析`,
    template: `%s · ${APP_NAME}`,
  },
  description: `${APP_TAGLINE}输入成分表，获得结合个人肤质与关注功效的个性化成分分析。`,
  applicationName: APP_NAME,
  appleWebApp: {
    capable: true,
    title: APP_NAME,
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-icon-180.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#fcf8fa",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-CN" className="h-full">
      <body className="min-h-dvh">
        <div className="mx-auto w-full max-w-[640px] min-h-dvh px-4 pt-5 pb-28">
          {children}
        </div>
        <BottomNav />
        <PwaRegister />
      </body>
    </html>
  );
}
