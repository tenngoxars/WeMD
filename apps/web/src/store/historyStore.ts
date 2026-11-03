// 历史记录状态管理（使用 IndexedDB 持久化）
import { create } from "zustand";
import {
  addHistoryToDb,
  clearHistoryDb,
  deleteHistoryFromDb,
  loadHistoryFromDb,
  updateHistoryInDb,
} from "./historyDb";
import type { HistorySnapshot, HistorySnapshotInput } from "./historyTypes";

export type { HistorySnapshot } from "./historyTypes";

const MAX_HISTORY_ENTRIES = 30;

interface HistoryStore {
  history: HistorySnapshot[];
  loading: boolean;
  filter: string;
  activeId: string | null;

  loadHistory: () => Promise<void>;
  setFilter: (value: string) => void;
  setActiveId: (id: string | null) => void;
  saveSnapshot: (
    data: HistorySnapshotInput,
    options?: { force?: boolean },
  ) => Promise<HistorySnapshot | null>;
  persistActiveSnapshot: (
    data: Omit<HistorySnapshotInput, "title"> & { title?: string },
  ) => Promise<HistorySnapshot | null>;
  deleteEntry: (id: string) => Promise<void>;
  clearHistory: () => Promise<void>;
  updateTitle: (id: string, title: string) => Promise<void>;
}

function createSnapshot(data: HistorySnapshotInput): HistorySnapshot {
  const randomId =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const now = new Date().toISOString();
  return {
    ...data,
    id: randomId,
    createdAt: now,
    savedAt: now,
  };
}

function isSameSnapshot(a?: HistorySnapshot, b?: HistorySnapshotInput) {
  if (!a || !b) return false;
  return (
    a.markdown === b.markdown &&
    a.theme === b.theme &&
    a.themeName === b.themeName &&
    a.customCSS === b.customCSS &&
    a.title === (b.title?.trim() || "未命名文章") &&
    a.filePath === b.filePath
  );
}

function hasChanges(
  entry: HistorySnapshot,
  data: Partial<HistorySnapshotInput>,
) {
  if (data.markdown !== undefined && data.markdown !== entry.markdown)
    return true;
  if (data.theme !== undefined && data.theme !== entry.theme) return true;
  if (data.themeName !== undefined && data.themeName !== entry.themeName)
    return true;
  if (data.customCSS !== undefined && data.customCSS !== entry.customCSS)
    return true;
  if (
    data.title !== undefined &&
    (data.title.trim() || "未命名文章") !== entry.title
  )
    return true;
  if (data.filePath !== undefined && data.filePath !== entry.filePath)
    return true;
  return false;
}

export const useHistoryStore = create<HistoryStore>((set, get) => {
  const refreshOrder = (entries: HistorySnapshot[]) =>
    [...entries].sort(
      (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime(),
    );

  const updateEntryState = async (
    id: string,
    updates: Partial<HistorySnapshot>,
  ) => {
    const entries = get().history;
    const index = entries.findIndex((entry) => entry.id === id);
    if (index === -1) return null;
    if (!hasChanges(entries[index], updates)) {
      return entries[index];
    }
    const updated: HistorySnapshot = {
      ...entries[index],
      ...updates,
      savedAt: updates.savedAt ?? new Date().toISOString(),
    };
    await updateHistoryInDb(updated);
    const nextHistory = refreshOrder(
      entries.map((entry, idx) => (idx === index ? updated : entry)),
    );
    set({ history: nextHistory });
    return updated;
  };

  return {
    history: [],
    loading: true,
    filter: "",
    activeId: null,
    loadHistory: async () => {
      set({ loading: true });
      const history = refreshOrder(await loadHistoryFromDb());
      set({ history, loading: false, activeId: history[0]?.id ?? null });
    },
    setFilter: (value) => set({ filter: value }),
    setActiveId: (id) => set({ activeId: id }),
    saveSnapshot: async (data, options) => {
      if (!data.markdown.trim()) return null;
      const history = get().history;
      const latestHistory = history[0];
      const shouldCreateHistory =
        options?.force || !isSameSnapshot(latestHistory, data);

      if (shouldCreateHistory) {
        const historyEntry = createSnapshot({
          ...data,
          title: data.title?.trim() || "未命名文章",
          themeName: data.themeName || "默认主题",
        });
        await addHistoryToDb(historyEntry);
        const nextHistory = refreshOrder([historyEntry, ...history]).slice(
          0,
          MAX_HISTORY_ENTRIES,
        );
        set({ history: nextHistory, activeId: historyEntry.id });
        return historyEntry;
      }
      return null;
    },
    persistActiveSnapshot: async (data) => {
      const id = get().activeId;
      if (!id) return null;
      const entry = get().history.find((item) => item.id === id);
      if (!entry) return null;
      const title = data.title?.trim() || entry.title || "未命名文章";
      const payload = {
        ...data,
        title,
        themeName: data.themeName ?? entry.themeName,
      };
      if (!hasChanges(entry, payload)) return entry;
      return updateEntryState(id, payload);
    },
    deleteEntry: async (id) => {
      await deleteHistoryFromDb(id);
      const nextHistory = get()
        .history.filter((entry) => entry.id !== id)
        .slice(0, MAX_HISTORY_ENTRIES);
      const nextActive =
        get().activeId === id ? (nextHistory[0]?.id ?? null) : get().activeId;
      set({ history: nextHistory, activeId: nextActive });
    },
    clearHistory: async () => {
      await clearHistoryDb();
      set({ history: [], activeId: null });
    },
    updateTitle: async (id, title) => {
      const trimmed = title.trim() || "未命名文章";
      const entry = get().history.find((item) => item.id === id);
      await updateEntryState(id, {
        title: trimmed,
        savedAt: new Date().toISOString(),
        filePath: entry?.filePath,
      });
    },
  };
});
