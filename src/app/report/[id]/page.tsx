import type { Metadata } from "next";

import ReportView from "@/components/ReportView";

export const metadata: Metadata = { title: "分析报告" };

export default async function ReportPage({ params }: PageProps<"/report/[id]">) {
  const { id } = await params;
  return <ReportView id={id} />;
}
