import Link from "next/link";

import { ChevronRightIcon, ShieldIcon } from "@/components/icons";
import { Card, CardTitle } from "@/components/ui";

export const metadata = { title: "隐私与数据" };

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: "1. 我们收集什么",
    body: [
      "为了做个性化分析，SkinLens AI 会在你的设备上保存：肤质、肤质特征、关注功效、关注/避开成分清单、你粘贴的产品名称与成分表、分析结果、以及围绕产品进行的问答对话。",
      "当前 MVP 版本不要求注册账号，也不收集手机号、邮箱等身份信息。",
    ],
  },
  {
    title: "2. 数据存在哪里",
    body: [
      "以上数据默认保存在你当前使用的浏览器本地存储（localStorage）中，不会上传到我们自己的服务器数据库。",
      "这意味着：换设备、换浏览器或清除浏览器数据后，记录不会自动同步，也无法找回。你可以在「我的 → 数据管理」中导出全部数据为 JSON 文件自行备份。",
    ],
  },
  {
    title: "3. AI 分析会发送什么",
    body: [
      "当你点击「开始 AI 分析」时，服务端会把产品名称、产品类型、完整成分表，以及你的肤质、肤质特征、关注功效、关注/避开成分，一并发送给配置的 AI 模型服务，用于生成分析结果。",
      "整理与匹配成分的工作在本地完成，不依赖 AI 服务。API Key 只保存在服务端环境变量中，不会出现在浏览器里。",
      "如果项目未配置 AI Key，则整个流程使用本地成分库与规则引擎完成，不会向外发送任何数据。",
    ],
  },
  {
    title: "4. 关于人脸照片",
    body: [
      "当前版本不提供 AI 拍照测肤功能，因此不会采集、上传或保存任何人脸照片。",
      "未来如果上线拍照测肤，我们会先提供独立的授权流程与用途说明，并保证不使用照片也可以正常使用成分分析功能。",
    ],
  },
  {
    title: "5. 成分资料的定位",
    body: [
      "成分数据库内容是公开的化妆品成分科普信息，用于帮助你理解成分与配方结构，属于信息性资料。",
      "成分分析不构成医疗诊断或医学建议。如果你有明确的皮肤问题（如持续泛红、长痘、皮疹），请咨询专业医生。",
    ],
  },
  {
    title: "6. 你可以随时删除数据",
    body: [
      "在「我的 → 数据管理」中可以导出或一键清除当前设备上的全部数据，删除后不可恢复。",
      "单条分析记录也可以在报告页或「分析记录」列表中单独删除。",
    ],
  },
];

export default function PrivacyPage() {
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
        <h1 className="text-[19px] font-semibold tracking-tight text-ink">隐私与数据</h1>
      </header>

      <Card className="bg-gradient-to-br from-white to-lilac-soft/60">
        <div className="flex items-start gap-3">
          <ShieldIcon width={22} height={22} className="mt-0.5 shrink-0 text-lilac" />
          <p className="text-[13.5px] leading-6 text-ink-soft">
            我们用最少的必要数据换取个性化的成分分析体验：数据默认只留在你的设备上，
            不配置 AI Key 时不会向外发送任何内容。
          </p>
        </div>
      </Card>

      {SECTIONS.map((section) => (
        <Card key={section.title}>
          <CardTitle title={section.title} />
          <div className="space-y-3">
            {section.body.map((paragraph) => (
              <p key={paragraph} className="text-[13px] leading-6 text-ink-soft">
                {paragraph}
              </p>
            ))}
          </div>
        </Card>
      ))}

      <p className="px-1 pb-2 text-[11.5px] leading-5 text-muted">
        本说明适用于 SkinLens AI MVP 试用版 v0.1.0。
      </p>
    </main>
  );
}
