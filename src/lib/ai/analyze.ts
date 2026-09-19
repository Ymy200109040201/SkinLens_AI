import { randomUUID } from "node:crypto";

import type {
  AnalysisMeta,
  AnalysisRecord,
  AnalysisResult,
  ProductType,
  ProfileSnapshot,
} from "../domain/types";
import { MEDICAL_DISCLAIMER, PRODUCT_TYPE_LABELS } from "../domain/labels";
import { AppError, toAppError } from "../errors";
import { parseIngredients } from "../ingredients/parser";
import { computeFormulaStructure, resolveIngredients } from "../analysis/structure";
import { buildLocalAnalysis } from "../analysis/rules";
import { getAiConfig } from "./config";
import { normalizeAnalysisResult } from "./normalize";
import { callLlmJson } from "./provider";
import {
  ANALYSIS_JSON_SPEC,
  ANALYSIS_SYSTEM_PROMPT,
  buildAnalysisUserPrompt,
} from "./prompts";

const MAX_INGREDIENT_LENGTH = 8000;
const MIN_INGREDIENT_COUNT = 3;
const MAX_INGREDIENT_COUNT = 220;

export interface AnalyzeProductInput {
  productName: string;
  productType: ProductType;
  rawIngredients: string;
  profile: ProfileSnapshot;
}

export interface AnalyzeProductOptions {
  /**
   * 强制使用本地规则引擎，跳过外部 AI 调用。
   * 用于「一键载入演示数据」这类需要即时、零成本、结果稳定的场景。
   */
  preferLocal?: boolean;
}

function buildNotices(profile: ProfileSnapshot, extra: string[] = []): string[] {
  const notices: string[] = [];
  if (!profile.skinType && profile.skinConcerns.length === 0) {
    notices.push("目前还没有设置肤质，将使用通用成分分析。");
  }
  if (profile.goals.length === 0) {
    notices.push("还没有设置关注功效，本次不会输出功效相关性分析。");
  }
  notices.push(...extra);
  return notices;
}

/**
 * 统一的产品分析服务
 *
 * 流程：解析 → 匹配成分库 → 结构估算 → 本地规则分析（作为基线）
 *      → 如启用 AI，调用模型并用结构化结果替换基线 → 校验/回退 → 生成记录
 */
export async function analyzeProduct(
  input: AnalyzeProductInput,
  options: AnalyzeProductOptions = {},
): Promise<AnalysisRecord> {
  const rawText = (input.rawIngredients ?? "").trim();

  if (!rawText) {
    throw new AppError("EMPTY_INGREDIENTS");
  }
  if (rawText.length > MAX_INGREDIENT_LENGTH) {
    throw new AppError("TOO_LONG_INGREDIENTS");
  }

  const { items, unmatched } = parseIngredients(rawText);

  if (items.length === 0) {
    throw new AppError("EMPTY_INGREDIENTS");
  }
  if (items.length < MIN_INGREDIENT_COUNT) {
    throw new AppError("TOO_FEW_INGREDIENTS");
  }
  if (items.length > MAX_INGREDIENT_COUNT) {
    throw new AppError("TOO_LONG_INGREDIENTS");
  }

  const resolved = resolveIngredients(items);
  const structure = computeFormulaStructure(resolved);
  const productTypeLabel = PRODUCT_TYPE_LABELS[input.productType] ?? "其他";

  const localResult = buildLocalAnalysis({
    productName: input.productName,
    productTypeLabel,
    ingredients: resolved,
    profile: input.profile,
    structure,
  });

  const config = getAiConfig();
  const extraNotices: string[] = [];
  if (unmatched.length > 0) {
    extraNotices.push(
      `有 ${unmatched.length} 项成分暂未收录在本地成分库中，已按原文保留并交给 AI 一并参考。`,
    );
  }
  if (items.some((item) => item.mayContain)) {
    extraNotices.push("成分表中包含「可能含有」段落，相关成分已单独标注。");
  }
  if (unmatched.length > 0 && resolved.length === unmatched.length) {
    extraNotices.push("本次几乎没有匹配到本地成分库，分析结果仅供参考。");
  }

  let result: AnalysisResult = localResult;
  let meta: AnalysisMeta = {
    engine: "rule",
    model: null,
    generatedAt: new Date().toISOString(),
    notices: [],
  };

  if (config.mode === "llm" && !options.preferLocal) {
    try {
      const structureSummary = structure
        .map((item) => `${item.group}：约 ${item.score}%（${item.ingredients.join("、")}）`)
        .join("\n");

      const raw = await callLlmJson<unknown>({
        system: `${ANALYSIS_SYSTEM_PROMPT}\n\n${ANALYSIS_JSON_SPEC}`,
        user: buildAnalysisUserPrompt({
          productName: input.productName,
          productTypeLabel,
          rawIngredients: rawText,
          ingredients: resolved,
          profile: input.profile,
          structureSummary,
        }),
        temperature: 0.35,
        maxTokens: 3000,
      });

      result = normalizeAnalysisResult(raw, localResult, input.profile);
      meta = {
        engine: "llm",
        model: config.model,
        generatedAt: new Date().toISOString(),
        notices: [],
      };
      extraNotices.push(`本次分析由 AI 模型（${config.model}）生成，并结合本地成分库校验。`);
    } catch (error) {
      const appError = toAppError(error, "AI_UNAVAILABLE");
      console.error("[analyze] AI 调用失败，回退本地分析：", appError.code);
      extraNotices.push(
        appError.code === "AI_TIMEOUT"
          ? "AI 响应超时，已使用本地分析模式完成本次分析。"
          : "AI 服务暂时不可用，已使用本地分析模式完成本次分析。",
      );
      result = localResult;
      meta = {
        engine: "rule",
        model: config.model,
        generatedAt: new Date().toISOString(),
        notices: [],
      };
    }
  } else {
    extraNotices.push(config.reason ?? "当前为本地演示分析模式。");
    extraNotices.push("本地模式基于成分数据库与规则引擎生成，效果接近真实 AI 分析，可直接用于演示。");
  }

  extraNotices.push(MEDICAL_DISCLAIMER);

  return {
    id: randomUUID(),
    productName: input.productName?.trim() || `${productTypeLabel}（未命名）`,
    productType: input.productType,
    rawIngredients: rawText,
    parsedIngredients: items,
    unmatchedIngredients: unmatched,
    analysis: result,
    meta: {
      ...meta,
      notices: buildNotices(input.profile, extraNotices),
    },
    profileSnapshot: input.profile,
    createdAt: new Date().toISOString(),
    favorite: false,
  };
}
