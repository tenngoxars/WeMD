// 历史记录状态管理（使用 IndexedDB 持久化）
// 列表只放元数据，内存里只保留当前文章的正文，篇数不设上限
import { create } from "zustand";
import {
  clearHistoryDb,
  deleteHistoryFromDb,
  getHistoryFromDb,
  loadHistoryMetaFromDb,
  putHistoryToDb,
  toMeta,
} from "./historyDb";
import type {
  HistoryMeta,
  HistorySnapshot,
  HistorySnapshotInput,
} from "./historyTypes";

export type { HistoryMeta, HistorySnapshot } from "./historyTypes";

// 写入类操作在 IndexedDB 写失败时抛出，且不改内存状态，当前正文仍留在编辑器里
interface HistoryStore {
  history: HistoryMeta[];
  /** 当前文章的完整内容，id 始终等于 activeId */
  active: HistorySnapshot | null;
  loading: boolean;
  filter: string;
  activeId: string | null;

  loadHistory: () => Promise<void>;
  setFilter: (value: string) => void;
  /** 读取正文并设为当前文章 */
  openEntry: (id: string) => Promise<HistorySnapshot | null>;
  saveSnapshot: (data: HistorySnapshotInput) => Promise<HistorySnapshot | null>;
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
  const updateEntryState = async (
    id: string,
    updates: Partial<HistorySnapshotInput>,
  ) => {
    const { active } = get();
    const current = active?.id === id ? active : await getHistoryFromDb(id);
    if (!current) return null;
    if (!hasChanges(current, updates)) return current;
    const updated: HistorySnapshot = {
      ...current,
      ...updates,
      savedAt: new Date().toISOString(),
    };
    await putHistoryToDb(updated);
    // savedAt 刚刷新，一定是最新的一条，直接移到列表顶部
    set((state) => ({
      history: [
        toMeta(updated),
        ...state.history.filter((entry) => entry.id !== id),
      ],
      active: state.active?.id === id ? updated : state.active,
    }));
    return updated;
  };

  return {
    history: [],
    active: null,
    loading: true,
    filter: "",
    activeId: null,
    loadHistory: async () => {
      set({ loading: true });
      const history = await loadHistoryMetaFromDb();
      const active = history[0] ? await getHistoryFromDb(history[0].id) : null;
      set({ history, active, activeId: active?.id ?? null, loading: false });
    },
    setFilter: (value) => set({ filter: value }),
    openEntry: async (id) => {
      const { active } = get();
      if (active?.id === id) return active;
      const entry = await getHistoryFromDb(id);
      if (entry) set({ active: entry, activeId: entry.id });
      return entry;
    },
    saveSnapshot: async (data) => {
      if (!data.markdown.trim()) return null;
      const entry = createSnapshot({
        ...data,
        title: data.title?.trim() || "未命名文章",
        themeName: data.themeName || "默认主题",
      });
      await putHistoryToDb(entry);
      set((state) => ({
        history: [toMeta(entry), ...state.history],
        active: entry,
        activeId: entry.id,
      }));
      return entry;
    },
    persistActiveSnapshot: async (data) => {
      const entry = get().active;
      if (!entry) return null;
      const title = data.title?.trim() || entry.title || "未命名文章";
      const payload = {
        ...data,
        title,
        themeName: data.themeName ?? entry.themeName,
      };
      if (!hasChanges(entry, payload)) return entry;
      return updateEntryState(entry.id, payload);
    },
    deleteEntry: async (id) => {
      await deleteHistoryFromDb(id);
      const history = get().history.filter((entry) => entry.id !== id);
      if (get().activeId !== id) {
        set({ history });
        return;
      }
      const next = history[0] ? await getHistoryFromDb(history[0].id) : null;
      set({ history, active: next, activeId: next?.id ?? null });
    },
    clearHistory: async () => {
      await clearHistoryDb();
      set({ history: [], active: null, activeId: null });
    },
    updateTitle: async (id, title) => {
      await updateEntryState(id, { title: title.trim() || "未命名文章" });
    },
  };
});
