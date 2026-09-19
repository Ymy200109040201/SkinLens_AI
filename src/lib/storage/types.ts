import type { AnalysisRecord, ChatMessage, ProfileSnapshot, UserProfile } from "../domain/types";

/**
 * 数据访问层接口
 *
 * MVP 使用浏览器本地存储实现；未来接入 Supabase / PostgreSQL 时，
 * 只需要提供一个新的实现并在 getRepository() 中切换，页面代码无需改动。
 */
export interface DataRepository {
  loadProfile(): Promise<UserProfile>;
  saveProfile(profile: UserProfile): Promise<void>;

  listAnalyses(): Promise<AnalysisRecord[]>;
  getAnalysis(id: string): Promise<AnalysisRecord | null>;
  saveAnalysis(record: AnalysisRecord): Promise<void>;
  deleteAnalysis(id: string): Promise<void>;
  setFavorite(id: string, favorite: boolean): Promise<void>;

  loadChat(recordId: string): Promise<ChatMessage[]>;
  saveChat(recordId: string, messages: ChatMessage[]): Promise<void>;
  deleteChat(recordId: string): Promise<void>;

  exportAll(): Promise<string>;
  clearAll(): Promise<void>;
}

export const EMPTY_PROFILE: UserProfile = {
  nickname: "",
  skinType: null,
  skinConcerns: [],
  goals: [],
  watchedIngredients: [],
  avoidedIngredients: [],
  updatedAt: new Date(0).toISOString(),
};

export function toProfileSnapshot(profile: UserProfile): ProfileSnapshot {
  return {
    skinType: profile.skinType,
    skinConcerns: [...profile.skinConcerns],
    goals: [...profile.goals],
    watchedIngredients: [...profile.watchedIngredients],
    avoidedIngredients: [...profile.avoidedIngredients],
  };
}

export function hasProfileContent(profile: UserProfile): boolean {
  return Boolean(
    profile.skinType ||
      profile.skinConcerns.length > 0 ||
      profile.goals.length > 0 ||
      profile.watchedIngredients.length > 0 ||
      profile.avoidedIngredients.length > 0,
  );
}
