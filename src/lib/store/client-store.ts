import type { AnalysisRecord, ChatMessage, UserProfile } from "../domain/types";
import { getRepository } from "../storage";
import { EMPTY_PROFILE, hasProfileContent, toProfileSnapshot } from "../storage/types";

/**
 * 轻量客户端 store
 *
 * 使用 useSyncExternalStore 订阅，避免引入额外状态管理库，
 * 同时保证服务端渲染与客户端 hydrate 的初始状态一致。
 */

export interface StoreState {
  ready: boolean;
  profile: UserProfile;
  analyses: AnalysisRecord[];
  aiMode: "llm" | "mock" | "unknown";
  aiModel: string | null;
}

const INITIAL_STATE: StoreState = {
  ready: false,
  profile: EMPTY_PROFILE,
  analyses: [],
  aiMode: "unknown",
  aiModel: null,
};

let state: StoreState = INITIAL_STATE;
const listeners = new Set<() => void>();
let initPromise: Promise<void> | null = null;

function emit(next: Partial<StoreState>) {
  state = { ...state, ...next };
  for (const listener of listeners) listener();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSnapshot(): StoreState {
  return state;
}

export function getServerSnapshot(): StoreState {
  return INITIAL_STATE;
}

export async function initStore(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const repository = getRepository();
    try {
      const [profile, analyses] = await Promise.all([
        repository.loadProfile(),
        repository.listAnalyses(),
      ]);
      emit({ profile, analyses, ready: true });
    } catch (error) {
      console.error("[store] 初始化失败", error);
      emit({ ready: true });
    }
    try {
      const response = await fetch("/api/ai-status", { cache: "no-store" });
      if (response.ok) {
        const data = (await response.json()) as { mode?: "llm" | "mock"; model?: string };
        emit({ aiMode: data.mode ?? "mock", aiModel: data.model ?? null });
      } else {
        emit({ aiMode: "mock", aiModel: null });
      }
    } catch {
      emit({ aiMode: "unknown", aiModel: null });
    }
  })();
  return initPromise;
}

export async function updateProfile(patch: Partial<UserProfile>): Promise<void> {
  const next: UserProfile = { ...state.profile, ...patch };
  emit({ profile: next });
  await getRepository().saveProfile(next);
}

export async function addAnalysis(record: AnalysisRecord): Promise<void> {
  await getRepository().saveAnalysis(record);
  emit({ analyses: [record, ...state.analyses.filter((item) => item.id !== record.id)] });
}

export async function removeAnalysis(id: string): Promise<void> {
  await getRepository().deleteAnalysis(id);
  emit({ analyses: state.analyses.filter((item) => item.id !== id) });
}

export async function toggleFavorite(id: string): Promise<void> {
  const target = state.analyses.find((item) => item.id === id);
  if (!target) return;
  const favorite = !target.favorite;
  await getRepository().setFavorite(id, favorite);
  emit({
    analyses: state.analyses.map((item) => (item.id === id ? { ...item, favorite } : item)),
  });
}

export async function loadChat(recordId: string): Promise<ChatMessage[]> {
  return getRepository().loadChat(recordId);
}

export async function saveChat(recordId: string, messages: ChatMessage[]): Promise<void> {
  await getRepository().saveChat(recordId, messages);
}

export async function exportData(): Promise<string> {
  return getRepository().exportAll();
}

export async function clearAllData(): Promise<void> {
  await getRepository().clearAll();
  emit({ profile: EMPTY_PROFILE, analyses: [] });
}

/**
 * 一键载入演示数据（示例画像 + 三款示例产品）
 *
 * 数据由 /api/demo 用本地规则引擎即时生成，随后写入当前浏览器的本地存储，
 * 因此可以像真实分析记录一样查看报告、对比和追问，也可以随时清除。
 */
export async function loadDemoData(): Promise<number> {
  const response = await fetch("/api/demo", { method: "POST" });
  const data = (await response.json().catch(() => null)) as
    | { profile?: UserProfile; records?: AnalysisRecord[]; message?: string }
    | null;

  if (!response.ok || !data?.profile || !data.records?.length) {
    throw new Error(data?.message ?? "演示数据载入失败，请稍后重试。");
  }

  const repository = getRepository();
  await repository.saveProfile(data.profile);
  for (const record of data.records) {
    await repository.saveAnalysis(record);
  }

  const existingIds = new Set(data.records.map((item) => item.id));
  // 与本地仓库一致的排序：最近分析排在最前面
  const merged = [...data.records, ...state.analyses.filter((item) => !existingIds.has(item.id))].sort(
    (a, b) => (a.createdAt < b.createdAt ? 1 : -1),
  );
  emit({
    profile: data.profile,
    analyses: merged,
    ready: true,
  });

  return data.records.length;
}

export { hasProfileContent, toProfileSnapshot };
