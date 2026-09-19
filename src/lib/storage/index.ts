import { LocalRepository } from "./local-repository";
import type { DataRepository } from "./types";

let repository: DataRepository | null = null;

/**
 * 获取数据仓库实例。
 *
 * 未来接入服务端存储时，可在这里根据环境变量切换实现，例如：
 *   if (process.env.NEXT_PUBLIC_DATA_SOURCE === 'supabase') return new SupabaseRepository()
 */
export function getRepository(): DataRepository {
  if (!repository) {
    repository = new LocalRepository();
  }
  return repository;
}
