import type { FileItem, TreeItem } from "../store/fileTypes";
import type { FileItem as AdapterFileItem } from "../storage/types";

export interface ElectronFileItem {
  name: string;
  path: string;
  createdAt: string;
  updatedAt: string;
  size?: number;
  title?: string;
  themeName?: string;
  isDirectory?: boolean;
  children?: ElectronFileItem[];
}

export interface ElectronAPI {
  fs: {
    selectWorkspace: () => Promise<{
      success: boolean;
      path?: string;
      canceled?: boolean;
    }>;
    setWorkspace: (dir: string) => Promise<{ success: boolean; path?: string }>;
    listFiles: (
      dir?: string,
    ) => Promise<{ success: boolean; files?: ElectronFileItem[] }>;
    readFile: (
      path: string,
    ) => Promise<{ success: boolean; content?: string; error?: string }>;
    readImage?: (path: string) => Promise<{
      success: boolean;
      data?: string;
      mime?: string;
      error?: string;
    }>;
    createFile: (payload: {
      filename?: string;
      content?: string;
    }) => Promise<{ success: boolean; filePath?: string; filename?: string }>;
    saveFile: (payload: {
      filePath: string;
      content: string;
    }) => Promise<{ success: boolean; error?: string }>;
    renameFile: (payload: {
      oldPath: string;
      newName: string;
    }) => Promise<{ success: boolean; filePath?: string; error?: string }>;
    deleteFile: (path: string) => Promise<{ success: boolean; error?: string }>;
    revealInFinder: (path: string) => Promise<void>;
    createFolder: (folderName: string) => Promise<{
      success: boolean;
      path?: string;
      name?: string;
      error?: string;
    }>;
    moveFile: (payload: {
      filePath: string;
      targetFolder: string;
    }) => Promise<{ success: boolean; newPath?: string; error?: string }>;
    inspectFolder: (
      folderPath: string,
    ) => Promise<{ success: boolean; entries?: string[]; error?: string }>;
    deleteFolder: (
      payload: string | { folderPath: string; recursive?: boolean },
    ) => Promise<{ success: boolean; error?: string }>;
    renameFolder: (payload: {
      folderPath: string;
      newName: string;
    }) => Promise<{ success: boolean; newPath?: string; error?: string }>;
    moveFolder: (payload: {
      folderPath: string;
      targetFolder: string;
    }) => Promise<{ success: boolean; newPath?: string; error?: string }>;
    onRefresh: (cb: () => void) => unknown;
    removeRefreshListener: (handler: unknown) => void;
    onMenuNewFile: (cb: () => void) => unknown;
    onMenuSave: (cb: () => void) => unknown;
    onMenuSwitchWorkspace: (cb: () => void) => unknown;
    removeAllListeners: () => void;
  };
  wechat?: {
    uploadimg: (payload: {
      appid: string;
      secret: string;
      fileBase64: string;
      filename: string;
      mime: string;
    }) => Promise<{ success: boolean; url?: string; error?: string }>;
    tokenTest: (payload: {
      appid: string;
      secret: string;
    }) => Promise<{ success: boolean; error?: string }>;
  };
}

export const WORKSPACE_KEY = "wemd-workspace-path";
export const LAST_FILE_KEY = "wemd-last-file-path";

export const getElectron = (): ElectronAPI | null => {
  return window.electron as unknown as ElectronAPI | null;
};

export function convertToTreeItems(items: ElectronFileItem[]): TreeItem[] {
  return items.map((entry) => {
    if (entry.isDirectory && entry.children) {
      return {
        name: entry.name,
        path: entry.path,
        createdAt: new Date(entry.createdAt),
        updatedAt: new Date(entry.updatedAt),
        isDirectory: true as const,
        children: convertToTreeItems(entry.children),
      };
    }
    return {
      name: entry.name,
      path: entry.path,
      createdAt: new Date(entry.createdAt),
      updatedAt: new Date(entry.updatedAt),
      size: entry.size ?? 0,
      title: entry.title,
      themeName: entry.themeName,
      isDirectory: false as const,
    };
  });
}

export function convertAdapterFilesToTreeItems(
  items: AdapterFileItem[],
): TreeItem[] {
  return items.map((entry) => {
    if (entry.meta?.isDirectory && Array.isArray(entry.meta?.children)) {
      return {
        name: entry.name,
        path: entry.path,
        createdAt: entry.updatedAt ? new Date(entry.updatedAt) : new Date(),
        updatedAt: entry.updatedAt ? new Date(entry.updatedAt) : new Date(),
        isDirectory: true as const,
        children: convertAdapterFilesToTreeItems(
          entry.meta.children as AdapterFileItem[],
        ),
      };
    }
    return {
      name: entry.name,
      path: entry.path,
      createdAt: entry.updatedAt ? new Date(entry.updatedAt) : new Date(),
      updatedAt: entry.updatedAt ? new Date(entry.updatedAt) : new Date(),
      size: entry.size ?? 0,
      title: (entry.meta?.title as string) || undefined,
      themeName: (entry.meta?.themeName as string) || undefined,
      isDirectory: false as const,
    };
  });
}

export function flattenFiles(items: TreeItem[]): FileItem[] {
  const result: FileItem[] = [];
  for (const item of items) {
    if (item.isDirectory) {
      result.push(...flattenFiles(item.children));
    } else {
      result.push(item as FileItem);
    }
  }
  return result;
}

export function splitPath(filePath: string): { dir: string; sep: string } {
  const lastSlash = Math.max(
    filePath.lastIndexOf("/"),
    filePath.lastIndexOf("\\"),
  );
  if (lastSlash === -1) {
    return { dir: "", sep: "/" };
  }
  return { dir: filePath.slice(0, lastSlash), sep: filePath[lastSlash] };
}

export function joinPath(base: string | undefined, name: string): string {
  if (!base) return name;
  const sep = base.includes("\\") ? "\\" : "/";
  const trimmed = base.replace(/[\\/]+$/, "");
  return `${trimmed}${sep}${name}`;
}

export function normalizePath(input: string): string {
  return input.replace(/\\/g, "/");
}

export function replacePathPrefix(
  filePath: string,
  oldPrefix: string,
  newPrefix: string,
): string | null {
  const normalizedPath = normalizePath(filePath);
  const normalizedOld = normalizePath(oldPrefix);
  const normalizedNew = normalizePath(newPrefix);

  if (normalizedPath === normalizedOld) {
    const output = normalizedNew;
    return newPrefix.includes("\\") ? output.replace(/\//g, "\\") : output;
  }

  if (!normalizedPath.startsWith(`${normalizedOld}/`)) return null;
  const suffix = normalizedPath.slice(normalizedOld.length);
  const output = normalizedNew + suffix;
  return newPrefix.includes("\\") ? output.replace(/\//g, "\\") : output;
}

export function isPathWithinFolder(
  filePath: string,
  folderPath: string,
): boolean {
  const normalizedFile = normalizePath(filePath);
  const normalizedFolder = normalizePath(folderPath);
  return (
    normalizedFile === normalizedFolder ||
    normalizedFile.startsWith(`${normalizedFolder}/`)
  );
}
