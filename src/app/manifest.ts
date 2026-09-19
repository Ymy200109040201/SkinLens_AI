import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SkinLens AI · AI 化妆品成分分析",
    short_name: "SkinLens AI",
    description: "看懂成分，更了解它是否适合你。输入成分表即可获得结合个人肤质的个性化成分分析。",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fcf8fa",
    theme_color: "#fcf8fa",
    lang: "zh-CN",
    categories: ["beauty", "lifestyle", "utilities"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      { name: "分析一款产品", short_name: "分析产品", url: "/analyze" },
      { name: "分析记录", short_name: "记录", url: "/history" },
      { name: "产品对比", short_name: "对比", url: "/compare" },
    ],
  };
}
