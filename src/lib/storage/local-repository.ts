import type { AnalysisRecord, ChatMessage, UserProfile } from "../domain/types";
import { EMPTY_PROFILE, type DataRepository } from "./types";

/**
 * 浏览器本地存储实现（localStorage）
 *
 * 选择 localStorage 而不是 IndexedDB 的原因：MVP 的数据量很小
 * （单条记录约 5-10KB），实现简单、同步读取，刷新后不会丢失。
 * 如果后续记录数量增大，可以在保持接口不变的前提下换成 IndexedDB。
 */

const PREFIX = "skinlens:v1";
const KEY_PROFILE = `${PREFIX}:profile`;
const KEY_ANALYSES = `${PREFIX}:analyses`;
const KEY_CHAT = `${PREFIX}:chat`;

function hasStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readJson<T>(key: string, fallback: T): T {
  if (!hasStorage()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch (error) {
    console.error("[storage] 读取失败", key, error);
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  if (!hasStorage()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error("[storage] 写入失败", key, error);
  }
}

export class LocalRepository implements DataRepository {
  async loadProfile(): Promise<UserProfile> {
    return { ...EMPTY_PROFILE, ...readJson<Partial<UserProfile>>(KEY_PROFILE, {}) };
  }

  async saveProfile(profile: UserProfile): Promise<void> {
    writeJson(KEY_PROFILE, { ...profile, updatedAt: new Date().toISOString() });
  }

  async listAnalyses(): Promise<AnalysisRecord[]> {
    const list = readJson<AnalysisRecord[]>(KEY_ANALYSES, []);
    return [...list].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  async getAnalysis(id: string): Promise<AnalysisRecord | null> {
    const list = readJson<AnalysisRecord[]>(KEY_ANALYSES, []);
    return list.find((item) => item.id === id) ?? null;
  }

  async saveAnalysis(record: AnalysisRecord): Promise<void> {
    const list = readJson<AnalysisRecord[]>(KEY_ANALYSES, []);
    const index = list.findIndex((item) => item.id === record.id);
    if (index >= 0) list[index] = record;
    else list.unshift(record);
    writeJson(KEY_ANALYSES, list.slice(0, 200));
  }

  async deleteAnalysis(id: string): Promise<void> {
    const list = readJson<AnalysisRecord[]>(KEY_ANALYSES, []);
    writeJson(
      KEY_ANALYSES,
      list.filter((item) => item.id !== id),
    );
    await this.deleteChat(id);
  }

  async setFavorite(id: string, favorite: boolean): Promise<void> {
    const list = readJson<AnalysisRecord[]>(KEY_ANALYSES, []);
    const index = list.findIndex((item) => item.id === id);
    if (index >= 0) {
      list[index] = { ...list[index], favorite };
      writeJson(KEY_ANALYSES, list);
    }
  }

  async loadChat(recordId: string): Promise<ChatMessage[]> {
    const all = readJson<Record<string, ChatMessage[]>>(KEY_CHAT, {});
    return all[recordId] ?? [];
  }

  async saveChat(recordId: string, messages: ChatMessage[]): Promise<void> {
    const all = readJson<Record<string, ChatMessage[]>>(KEY_CHAT, {});
    all[recordId] = messages.slice(-40);
    writeJson(KEY_CHAT, all);
  }

  async deleteChat(recordId: string): Promise<void> {
    const all = readJson<Record<string, ChatMessage[]>>(KEY_CHAT, {});
    if (all[recordId]) {
      delete all[recordId];
      writeJson(KEY_CHAT, all);
    }
  }

  async exportAll(): Promise<string> {
    return JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        app: "SkinLens AI",
        version: 1,
        profile: await this.loadProfile(),
        analyses: await this.listAnalyses(),
        chat: readJson<Record<string, ChatMessage[]>>(KEY_CHAT, {}),
      },
      null,
      2,
    );
  }

  async clearAll(): Promise<void> {
    if (!hasStorage()) return;
    window.localStorage.removeItem(KEY_PROFILE);
    window.localStorage.removeItem(KEY_ANALYSES);
    window.localStorage.removeItem(KEY_CHAT);
  }
}
