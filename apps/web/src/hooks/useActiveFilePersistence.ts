import { useCallback, useRef } from "react";
import toast from "react-hot-toast";
import type { StorageAdapter } from "../storage/StorageAdapter";
import type { FileItem } from "../store/fileTypes";
import { useEditorStore } from "../store/editorStore";
import { useFileStore } from "../store/fileStore";
import { useThemeStore } from "../store/themeStore";
import {
  applyMarkdownFileMeta,
  stripMarkdownExtension,
} from "../utils/markdownFileMeta";
import type { DesktopFsBridge } from "./useFileSystemHelpers";

interface ActiveFileSnapshot {
  file: FileItem;
  markdown: string;
  theme: string;
  themeName: string;
  content: string;
}

interface UseActiveFilePersistenceOptions {
  adapter: StorageAdapter | null;
  desktop: DesktopFsBridge | null;
  storageReady: boolean;
  setIsDirty: ReturnType<typeof useFileStore.getState>["setIsDirty"];
  setLastSavedAt: ReturnType<typeof useFileStore.getState>["setLastSavedAt"];
  setLastSavedContent: ReturnType<
    typeof useFileStore.getState
  >["setLastSavedContent"];
  setSaving: ReturnType<typeof useFileStore.getState>["setSaving"];
}

const MAX_CURRENT_SAVE_ATTEMPTS = 2;

export function useActiveFilePersistence({
  adapter,
  desktop,
  storageReady,
  setIsDirty,
  setLastSavedAt,
  setLastSavedContent,
  setSaving,
}: UseActiveFilePersistenceOptions) {
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());

  const createActiveFileSnapshot =
    useCallback((): ActiveFileSnapshot | null => {
      const activeFile = useFileStore.getState().currentFile;
      if (!activeFile) return null;

      const { markdown } = useEditorStore.getState();
      const { themeId, themeName } = useThemeStore.getState();
      const baseContent = useFileStore.getState().lastSavedContent;
      return {
        file: activeFile,
        markdown,
        theme: themeId,
        themeName,
        content: applyMarkdownFileMeta(baseContent, {
          body: markdown,
          theme: themeId,
          themeName,
          title: activeFile.title || stripMarkdownExtension(activeFile.name),
        }),
      };
    }, []);

  const isActiveFileSnapshotCurrent = useCallback(
    (snapshot: ActiveFileSnapshot): boolean => {
      const activeFile = useFileStore.getState().currentFile;
      const { markdown } = useEditorStore.getState();
      const { themeId, themeName } = useThemeStore.getState();
      return (
        activeFile?.path === snapshot.file.path &&
        activeFile.name === snapshot.file.name &&
        activeFile.title === snapshot.file.title &&
        markdown === snapshot.markdown &&
        themeId === snapshot.theme &&
        themeName === snapshot.themeName
      );
    },
    [],
  );

  const persistActiveFileNow = useCallback(
    async (showToast = false, ensureCurrent = false): Promise<boolean> => {
      setSaving(true);
      try {
        const attemptCount = ensureCurrent ? MAX_CURRENT_SAVE_ATTEMPTS : 1;
        for (let attempt = 0; attempt < attemptCount; attempt += 1) {
          const snapshot = createActiveFileSnapshot();
          if (!snapshot) return true;

          if (snapshot.content === useFileStore.getState().lastSavedContent) {
            const isCurrent = isActiveFileSnapshotCurrent(snapshot);
            setIsDirty(!isCurrent);
            if (isCurrent && showToast) toast.success("内容无变化");
            if (isCurrent || !ensureCurrent) return true;
            continue;
          }

          let success = false;
          let errorMessage = "";
          try {
            if (desktop) {
              const result = await desktop.fs.saveFile({
                filePath: snapshot.file.path,
                content: snapshot.content,
              });
              if (result.success) success = true;
              else errorMessage = result.error || "Unknown error";
            } else if (adapter && storageReady) {
              await adapter.writeFile(snapshot.file.path, snapshot.content);
              success = true;
            } else {
              errorMessage = "存储尚未就绪";
            }
          } catch (error: unknown) {
            errorMessage =
              error instanceof Error ? error.message : String(error);
          }

          if (!success) {
            toast.error("保存失败: " + errorMessage);
            return false;
          }

          setLastSavedContent(snapshot.content);
          setLastSavedAt(new Date());
          const isCurrent = isActiveFileSnapshotCurrent(snapshot);
          setIsDirty(!isCurrent);
          if (isCurrent) {
            if (showToast) toast.success("已保存");
            return true;
          }
          if (!ensureCurrent) return true;
        }

        toast.error("文章内容仍在变化，请稍后再切换工作区");
        return false;
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        toast.error("保存失败: " + errorMessage);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [
      adapter,
      createActiveFileSnapshot,
      desktop,
      isActiveFileSnapshotCurrent,
      setIsDirty,
      setLastSavedAt,
      setLastSavedContent,
      setSaving,
      storageReady,
    ],
  );

  return useCallback(
    (showToast = false, ensureCurrent = false): Promise<boolean> => {
      const task = saveQueueRef.current.then(() =>
        persistActiveFileNow(showToast, ensureCurrent),
      );
      saveQueueRef.current = task.then(
        () => undefined,
        () => undefined,
      );
      return task;
    },
    [persistActiveFileNow],
  );
}
