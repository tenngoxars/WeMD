// 历史记录状态管理（使用 IndexedDB 持久化）
import { create } from "zustand";
import { useEditorStore } from "./editorStore";
import {
  addHistoryToDb,
  clearHistoryDb,
  deleteHistoryFromDb,
  loadHistoryFromDb,
  updateHistoryInDb,
} from "./historyDb";
import type { HistorySnapshot, HistorySnapshotInput } from "./historyTypes";
import { normalizeMarkdownFileName } from "../utils/fileName";

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

type ElectronFileAPI = {
  deleteFiles?: (paths: string[]) => Promise<{ success: boolean }>;
  renameFile?: (
    from: string,
    to: string,
  ) => Promise<{ success: boolean; filePath?: string; error?: string }>;
  fileExists?: (path: string) => Promise<{ success: boolean; exists: boolean }>;
};

const getElectronFile = (): ElectronFileAPI | null => {
  if (typeof window === "undefined") return null;
  const electron = (
    window as typeof window & { electron?: { file?: ElectronFileAPI } }
  ).electron;
  return electron?.file ?? null;
};

const splitPath = (filePath: string) => {
  const last = Math.max(filePath.lastIndexOf("/"), filePath.lastIndexOf("\\"));
  const dir = last >= 0 ? filePath.slice(0, last) : "";
  const base = last >= 0 ? filePath.slice(last + 1) : filePath;
  const sep = filePath.includes("\\") ? "\\" : "/";
  return { dir, base, sep };
};

const joinPath = (dir: string, name: string, sep: string) => {
  if (!dir) return name;
  if (dir.endsWith(sep)) return `${dir}${name}`;
  return `${dir}${sep}${name}`;
};

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

  const deleteFiles = async (paths: string[]) => {
    if (typeof window === "undefined") return;
    const electronFile = getElectronFile();
    if (!electronFile?.deleteFiles) return;
    const valid = paths.filter(Boolean);
    if (valid.length === 0) return;
    try {
      await electronFile.deleteFiles(valid);
    } catch (error) {
      console.error("[History] delete files failed", error);
    }
  };

  const pruneMissingFiles = async (entries: HistorySnapshot[]) => {
    const electronFile = getElectronFile();
    const checkFile = electronFile?.fileExists;
    if (!checkFile) return entries;
    const checks = await Promise.all(
      entries.map((entry) =>
        entry.filePath
          ? checkFile(entry.filePath).catch(() => ({ exists: true }))
          : Promise.resolve({ exists: true }),
      ),
    );
    const remaining: HistorySnapshot[] = [];
    const removed: HistorySnapshot[] = [];
    entries.forEach((entry, idx) => {
      const exists = entry.filePath ? checks[idx]?.exists !== false : true;
      if (exists) {
        remaining.push(entry);
      } else {
        removed.push(entry);
      }
    });
    if (removed.length) {
      await Promise.all(removed.map((entry) => deleteHistoryFromDb(entry.id)));
    }
    return remaining;
  };

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
      let history = refreshOrder(await loadHistoryFromDb());
      history = await pruneMissingFiles(history);
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
      const entry = get().history.find((item) => item.id === id);
      if (entry?.filePath) {
        await deleteFiles([entry.filePath]);
      }
      await deleteHistoryFromDb(id);
      const nextHistory = get()
        .history.filter((entry) => entry.id !== id)
        .slice(0, MAX_HISTORY_ENTRIES);
      const nextActive =
        get().activeId === id ? (nextHistory[0]?.id ?? null) : get().activeId;
      set({ history: nextHistory, activeId: nextActive });
    },
    clearHistory: async () => {
      const filePaths = get()
        .history.map((entry) => entry.filePath)
        .filter((p): p is string => !!p);
      await deleteFiles(filePaths);
      await clearHistoryDb();
      set({ history: [], activeId: null });
    },
    updateTitle: async (id, title) => {
      const trimmed = title.trim() || "未命名文章";
      const entry = get().history.find((item) => item.id === id);
      let nextFilePath = entry?.filePath;
      if (entry?.filePath) {
        const { dir, sep } = splitPath(entry.filePath);
        const target = joinPath(
          dir,
          normalizeMarkdownFileName(trimmed, { maxLength: 60 }),
          sep,
        );
        if (target !== entry.filePath) {
          const electronFile = getElectronFile();
          if (electronFile?.renameFile) {
            try {
              const result = await electronFile.renameFile(
                entry.filePath,
                target,
              );
              if (result?.success && result.filePath) {
                nextFilePath = result.filePath;
                if (get().activeId === id) {
                  useEditorStore.getState().setFilePath(result.filePath);
                }
              } else if (result?.error) {
                console.error("[History] rename failed", result.error);
              }
            } catch (error) {
              console.error("[History] rename error", error);
            }
          }
        }
      }
      await updateEntryState(id, {
        title: trimmed,
        savedAt: new Date().toISOString(),
        filePath: nextFilePath,
      });
    },
  };
});
