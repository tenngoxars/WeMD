import { useCallback } from "react";
import toast from "react-hot-toast";
import type { StorageAdapter } from "../storage/StorageAdapter";
import type { FileItem } from "../store/fileTypes";
import { useFileStore } from "../store/fileStore";
import {
  isPathWithinFolder,
  joinPath,
  LAST_FILE_KEY,
  replacePathPrefix,
  splitPath,
  type DesktopFsBridge,
} from "./useFileSystemHelpers";

interface UseFileSystemFolderActionsParams {
  desktop: DesktopFsBridge | null;
  adapter: StorageAdapter | null;
  refreshFiles: () => Promise<void>;
  currentFile: FileItem | null;
  setCurrentFile: (file: FileItem | null) => void;
  setMarkdown: (value: string) => void;
  setIsDirty: (dirty: boolean) => void;
  setLastSavedContent: (content: string) => void;
}

export function useFileSystemFolderActions({
  desktop,
  adapter,
  refreshFiles,
  currentFile,
  setCurrentFile,
  setMarkdown,
  setIsDirty,
  setLastSavedContent,
}: UseFileSystemFolderActionsParams) {
  const updateCurrentFilePathForFolder = useCallback(
    (oldPath: string, newPath: string) => {
      const activeFile = useFileStore.getState().currentFile;
      if (!activeFile) return;

      const updatedPath = replacePathPrefix(activeFile.path, oldPath, newPath);
      if (updatedPath && updatedPath !== activeFile.path) {
        setCurrentFile({ ...activeFile, path: updatedPath });
        localStorage.setItem(LAST_FILE_KEY, updatedPath);
      }
    },
    [setCurrentFile],
  );

  const createFolder = useCallback(
    async (folderName: string, parentFolder?: string) => {
      const fullPath = joinPath(parentFolder, folderName);

      if (desktop) {
        const res = await desktop.fs.createFolder(fullPath);
        if (res.success) {
          toast.success("文件夹已创建");
          await refreshFiles();
          return res.path;
        }
        toast.error(res.error || "创建失败");
        return null;
      }

      if (adapter?.createFolder) {
        const res = await adapter.createFolder(fullPath);
        if (res.success) {
          toast.success("文件夹已创建");
          await refreshFiles();
          return res.path;
        }
        toast.error(res.error || "创建失败");
        return null;
      }

      toast.error("当前存储模式不支持文件夹操作");
      return null;
    },
    [desktop, adapter, refreshFiles],
  );

  const moveToFolder = useCallback(
    async (file: FileItem, targetFolder: string) => {
      if (desktop) {
        const res = await desktop.fs.moveFile({
          filePath: file.path,
          targetFolder,
        });
        if (res.success) {
          toast.success("文件已移动");
          await refreshFiles();
          if (currentFile && currentFile.path === file.path && res.newPath) {
            setCurrentFile({ ...currentFile, path: res.newPath });
            localStorage.setItem(LAST_FILE_KEY, res.newPath);
          }
          return true;
        }
        toast.error(res.error || "移动失败");
        return false;
      }

      if (adapter?.moveFile) {
        const res = await adapter.moveFile(file.path, targetFolder);
        if (res.success) {
          toast.success("文件已移动");
          await refreshFiles();
          if (currentFile && currentFile.path === file.path && res.newPath) {
            setCurrentFile({ ...currentFile, path: res.newPath });
            localStorage.setItem(LAST_FILE_KEY, res.newPath);
          }
          return true;
        }
        toast.error(res.error || "移动失败");
        return false;
      }

      toast.error("当前存储模式不支持文件夹操作");
      return false;
    },
    [desktop, adapter, refreshFiles, currentFile, setCurrentFile],
  );

  const renameFolder = useCallback(
    async (folder: { path: string }, newName: string) => {
      const safeName = newName.trim();
      const safeBaseName = safeName.split(/[/\\]/).pop() || "";
      if (!safeBaseName) {
        toast.error("文件夹名称不能为空");
        return { success: false as const };
      }

      const { dir, sep } = splitPath(folder.path);
      const targetPath = dir ? `${dir}${sep}${safeBaseName}` : safeBaseName;

      if (desktop) {
        const res = await desktop.fs.renameFolder({
          folderPath: folder.path,
          newName: safeBaseName,
        });
        if (res.success && res.newPath) {
          toast.success("文件夹已重命名");
          await refreshFiles();
          updateCurrentFilePathForFolder(folder.path, res.newPath);
          return { success: true as const, newPath: res.newPath };
        }
        toast.error(res.error || "重命名失败");
        return { success: false as const };
      }

      if (adapter?.renameFolder) {
        const res = await adapter.renameFolder(folder.path, targetPath);
        if (res.success && res.newPath) {
          toast.success("文件夹已重命名");
          await refreshFiles();
          updateCurrentFilePathForFolder(folder.path, res.newPath);
          return { success: true as const, newPath: res.newPath };
        }
        toast.error(res.error || "重命名失败");
        return { success: false as const };
      }

      toast.error("当前存储模式不支持文件夹操作");
      return { success: false as const };
    },
    [desktop, adapter, refreshFiles, updateCurrentFilePathForFolder],
  );

  const moveFolder = useCallback(
    async (folder: { path: string }, targetFolder: string) => {
      if (desktop) {
        const res = await desktop.fs.moveFolder({
          folderPath: folder.path,
          targetFolder,
        });
        if (res.success && res.newPath) {
          toast.success("文件夹已移动");
          await refreshFiles();
          updateCurrentFilePathForFolder(folder.path, res.newPath);
          return { success: true as const, newPath: res.newPath };
        }
        toast.error(res.error || "移动失败");
        return { success: false as const };
      }

      if (adapter?.moveFolder) {
        const res = await adapter.moveFolder(folder.path, targetFolder);
        if (res.success && res.newPath) {
          toast.success("文件夹已移动");
          await refreshFiles();
          updateCurrentFilePathForFolder(folder.path, res.newPath);
          return { success: true as const, newPath: res.newPath };
        }
        toast.error(res.error || "移动失败");
        return { success: false as const };
      }

      toast.error("当前存储模式不支持文件夹操作");
      return { success: false as const };
    },
    [desktop, adapter, refreshFiles, updateCurrentFilePathForFolder],
  );

  const deleteFolder = useCallback(
    async (folderPath: string, options?: { recursive?: boolean }) => {
      if (desktop) {
        const res = await desktop.fs.deleteFolder({
          folderPath,
          recursive: options?.recursive,
        });
        if (res.success) {
          toast.success("文件夹已删除");
          await refreshFiles();
          if (currentFile && isPathWithinFolder(currentFile.path, folderPath)) {
            setCurrentFile(null);
            setMarkdown("");
            setIsDirty(false);
            setLastSavedContent("");
          }
          return true;
        }
        toast.error(res.error || "删除失败");
        return false;
      }

      if (adapter?.deleteFolder) {
        const res = await adapter.deleteFolder(folderPath, options);
        if (res.success) {
          toast.success("文件夹已删除");
          await refreshFiles();
          if (currentFile && isPathWithinFolder(currentFile.path, folderPath)) {
            setCurrentFile(null);
            setMarkdown("");
            setIsDirty(false);
            setLastSavedContent("");
          }
          return true;
        }
        toast.error(res.error || "删除失败");
        return false;
      }

      toast.error("当前存储模式不支持文件夹操作");
      return false;
    },
    [
      desktop,
      adapter,
      refreshFiles,
      currentFile,
      setMarkdown,
      setCurrentFile,
      setIsDirty,
      setLastSavedContent,
    ],
  );

  const inspectFolder = useCallback(
    async (folderPath: string) => {
      if (desktop) {
        const res = await desktop.fs.inspectFolder(folderPath);
        if (res.success && res.entries) return res.entries;
        return [];
      }
      if (adapter?.inspectFolder) {
        const res = await adapter.inspectFolder(folderPath);
        if (res.success && res.entries) return res.entries;
        return [];
      }
      return [];
    },
    [desktop, adapter],
  );

  return {
    createFolder,
    moveToFolder,
    renameFolder,
    moveFolder,
    deleteFolder,
    inspectFolder,
  };
}
