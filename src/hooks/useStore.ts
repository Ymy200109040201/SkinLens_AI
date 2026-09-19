"use client";

import { useEffect, useSyncExternalStore } from "react";

import {
  getServerSnapshot,
  getSnapshot,
  initStore,
  subscribe,
  type StoreState,
} from "@/lib/store/client-store";

export function useStore(): StoreState {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    void initStore();
  }, []);

  return state;
}
