import { useEffect, useRef } from "react";
import type { StorageAdapter } from "../storage/StorageAdapter";
import type { StorageType } from "../storage/types";
import { useFileStore } from "../store/fileStore";
import { useThemeStore } from "../store/themeStore";
import {
  applyMarkdownFileMeta,
  stripMarkdownExtension,
} from "../utils/markdownFileMeta";
import {
  flattenFiles,
  LAST_FILE_KEY,
  WORKSPACE_KEY,
  type ElectronAPI,
} from "./useFileSystemHelpers";

interface UseFileSystemEffectsParams {
  enabled: boolean;
  electron: ElectronAPI | null;
  adapter: StorageAdapter | null;
  storageReady: boolean;
  storageType: StorageType;
  currentFile: ReturnType<typeof useFileStore.getState>["currentFile"];
  markdown: string;
  theme: string;
  themeName: string;
  isRestoring: boolean;
  isDirty: boolean;
  lastSavedContent: string;
  loadWorkspace: (path: string) => Promise<void>;
  refreshFiles: (dir?: string) => Promise<void>;
  openFile: (
    file: NonNullable<ReturnType<typeof useFileStore.getState>["currentFile"]>,
  ) => Promise<void>;
  createFile: (folderPath?: string) => Promise<void>;
  saveFile: (showToast?: boolean) => Promise<void>;
  selectWorkspace: () => Promise<void>;
  setCurrentFile: ReturnType<typeof useFileStore.getState>["setCurrentFile"];
  setMarkdown: (value: string) => void;
  setIsDirty: ReturnType<typeof useFileStore.getState>["setIsDirty"];
  setLastSavedContent: ReturnType<
    typeof useFileStore.getState
  >["setLastSavedContent"];
  setLoading: ReturnType<typeof useFileStore.getState>["setLoading"];
  setWorkspacePath: ReturnType<
    typeof useFileStore.getState
  >["setWorkspacePath"];
}

const getBrowserStorage = (): Storage | null => {
  if (typeof window === "undefined") return null;
  try {
    const storage = window.localStorage as Partial<Storage> | null;
    if (!storage) return null;
    if (typeof storage.getItem !== "function") return null;
    if (typeof storage.setItem !== "function") return null;
    if (typeof storage.removeItem !== "function") return null;
    return storage as Storage;
  } catch {
    return null;
  }
};

export function useFileSystemEffects({
  enabled,
  electron,
  adapter,
  storageReady,
  storageType,
  currentFile,
  markdown,
  theme,
  themeName,
  isRestoring,
  isDirty,
  lastSavedContent,
  loadWorkspace,
  refreshFiles,
  openFile,
  createFile,
  saveFile,
  selectWorkspace,
  setCurrentFile,
  setMarkdown,
  setIsDirty,
  setLastSavedContent,
  setLoading,
  setWorkspacePath,
}: UseFileSystemEffectsParams) {
  const createFileRef = useRef(createFile);
  const saveFileRef = useRef(saveFile);
  const selectWorkspaceRef = useRef(selectWorkspace);

  useEffect(() => {
    createFileRef.current = createFile;
  }, [createFile]);

  useEffect(() => {
    saveFileRef.current = saveFile;
  }, [saveFile]);

  useEffect(() => {
    selectWorkspaceRef.current = selectWorkspace;
  }, [selectWorkspace]);

  useEffect(() => {
    if (!enabled) return;
    const storage = getBrowserStorage();
    if (electron) {
      const saved = storage?.getItem?.(WORKSPACE_KEY);
      if (saved) {
        void loadWorkspace(saved);
      }
      return;
    }

    setCurrentFile(null);
    setMarkdown("");
    useThemeStore.getState().selectTheme("default");
    setIsDirty(false);
    setLastSavedContent("");

    if (storageReady && storageType === "filesystem") {
      setLoading(true);
      void (async () => {
        try {
          await refreshFiles();
          const lastPath = storage?.getItem?.(LAST_FILE_KEY);
          const { files: currentFiles } = useFileStore.getState();
          const flat = flattenFiles(currentFiles);
          if (flat.length > 0) {
            const target = lastPath
              ? flat.find((file) => file.path === lastPath) || flat[0]
              : flat[0];
            if (target) {
              await openFile(target);
            }
          }
        } finally {
          setLoading(false);
        }
      })();

      const folderName =
        storageType === "filesystem" &&
        (adapter as unknown as { directoryName?: string } | null)?.directoryName
          ? (adapter as unknown as { directoryName: string }).directoryName
          : "本地文件夹";
      setWorkspacePath(folderName);
      return;
    }

    if (storageReady && storageType === "indexeddb") {
      setWorkspacePath("浏览器存储");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, electron, storageReady, storageType]);

  useEffect(() => {
    if (!enabled) return;
    if (!electron) return;
    const handler = electron.fs.onRefresh(() => {
      void refreshFiles();
    });
    return () => {
      electron.fs.removeRefreshListener(handler);
    };
  }, [enabled, refreshFiles, electron]);

  useEffect(() => {
    if (!enabled) return;
    if (!electron) return;
    electron.fs.onMenuNewFile(() => {
      void createFileRef.current();
    });
    electron.fs.onMenuSave(() => {
      void saveFileRef.current();
    });
    electron.fs.onMenuSwitchWorkspace(() => {
      void selectWorkspaceRef.current();
    });

    return () => {
      electron.fs.removeAllListeners();
    };
  }, [enabled, electron]);

  useEffect(() => {
    if (!enabled) return;
    if (!currentFile || !markdown) return;
    if (isRestoring) return;

    const { themeId: currentTheme, themeName: currentThemeName } =
      useThemeStore.getState();
    const fullContent = applyMarkdownFileMeta(lastSavedContent, {
      body: markdown,
      theme: currentTheme,
      themeName: currentThemeName,
      title: currentFile.title || stripMarkdownExtension(currentFile.name),
    });

    if (fullContent !== lastSavedContent) {
      setIsDirty(true);
    }
    if (!isDirty) return;

    const timer = setTimeout(() => {
      const currentIsRestoring = useFileStore.getState().isRestoring;
      const currentIsDirty = useFileStore.getState().isDirty;
      if (currentIsDirty && !currentIsRestoring) {
        void saveFile();
      }
    }, 3000);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    markdown,
    theme,
    themeName,
    currentFile,
    saveFile,
    isRestoring,
    isDirty,
    lastSavedContent,
    enabled,
  ]);
}
