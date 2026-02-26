import { useEffect, useCallback, useRef } from "react";
import { useFileStore } from "../store/fileStore";
import { useEditorStore } from "../store/editorStore";
import { useThemeStore } from "../store/themeStore";
import { useStorageContext } from "../storage/StorageContext";
import type { FileItem, TreeItem } from "../store/fileTypes";
import toast from "react-hot-toast";
import {
  applyMarkdownFileMeta,
  buildMarkdownFileContent,
  parseMarkdownFileContent,
  stripMarkdownExtension,
} from "../utils/markdownFileMeta";
import { resolveNewArticleThemeSnapshot } from "../utils/newArticleTheme";

// 本地定义 Electron API 类型以确保类型安全
interface ElectronFileItem {
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

interface ElectronAPI {
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
    // 文件夹管理
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
    onRefresh: (cb: () => void) => () => void;
    removeRefreshListener: (handler: () => void) => void;
    onMenuNewFile: (cb: () => void) => () => void;
    onMenuSave: (cb: () => void) => () => void;
    onMenuSwitchWorkspace: (cb: () => void) => () => void;
    removeAllListeners: () => void;
  };
}

// 将 Electron 返回的树形数据转换为 TreeItem[]
function convertToTreeItems(items: ElectronFileItem[]): TreeItem[] {
  return items.map((f) => {
    if (f.isDirectory && f.children) {
      return {
        name: f.name,
        path: f.path,
        createdAt: new Date(f.createdAt),
        updatedAt: new Date(f.updatedAt),
        isDirectory: true as const,
        children: convertToTreeItems(f.children),
      };
    }
    return {
      name: f.name,
      path: f.path,
      createdAt: new Date(f.createdAt),
      updatedAt: new Date(f.updatedAt),
      size: f.size ?? 0,
      title: f.title,
      themeName: f.themeName,
      isDirectory: false as const,
    };
  });
}

// storage adapter 返回的 FileItem 类型
interface AdapterFileItem {
  name: string;
  path: string;
  size?: number;
  updatedAt?: string;
  meta?: Record<string, unknown>;
}

// 将 adapter 返回的数据转换为 TreeItem[]
function convertAdapterFilesToTreeItems(items: AdapterFileItem[]): TreeItem[] {
  return items.map((f) => {
    if (f.meta?.isDirectory && Array.isArray(f.meta?.children)) {
      return {
        name: f.name,
        path: f.path,
        createdAt: f.updatedAt ? new Date(f.updatedAt) : new Date(),
        updatedAt: f.updatedAt ? new Date(f.updatedAt) : new Date(),
        isDirectory: true as const,
        children: convertAdapterFilesToTreeItems(
          f.meta.children as AdapterFileItem[],
        ),
      };
    }
    return {
      name: f.name,
      path: f.path,
      createdAt: f.updatedAt ? new Date(f.updatedAt) : new Date(),
      updatedAt: f.updatedAt ? new Date(f.updatedAt) : new Date(),
      size: f.size ?? 0,
      title: (f.meta?.title as string) || undefined,
      themeName: (f.meta?.themeName as string) || undefined,
      isDirectory: false as const,
    };
  });
}

const getElectron = (): ElectronAPI | null => {
  return window.electron as unknown as ElectronAPI | null;
};

// 从树形结构中提取所有文件（不包括文件夹）
function flattenFiles(items: TreeItem[]): FileItem[] {
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

function splitPath(filePath: string): { dir: string; sep: string } {
  const lastSlash = Math.max(
    filePath.lastIndexOf("/"),
    filePath.lastIndexOf("\\"),
  );
  if (lastSlash === -1) {
    return { dir: "", sep: "/" };
  }
  return { dir: filePath.slice(0, lastSlash), sep: filePath[lastSlash] };
}

function joinPath(base: string | undefined, name: string): string {
  if (!base) return name;
  const sep = base.includes("\\") ? "\\" : "/";
  const trimmed = base.replace(/[\\/]+$/, "");
  return `${trimmed}${sep}${name}`;
}

function normalizePath(input: string): string {
  return input.replace(/\\/g, "/");
}

function replacePathPrefix(
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

function isPathWithinFolder(filePath: string, folderPath: string): boolean {
  const normalizedFile = normalizePath(filePath);
  const normalizedFolder = normalizePath(folderPath);
  return (
    normalizedFile === normalizedFolder ||
    normalizedFile.startsWith(`${normalizedFolder}/`)
  );
}

const WORKSPACE_KEY = "wemd-workspace-path";
const LAST_FILE_KEY = "wemd-last-file-path";

export function useFileSystem() {
  const {
    adapter,
    ready: storageReady,
    type: storageType,
  } = useStorageContext();
  const electron = getElectron();

  const {
    workspacePath,
    files,
    currentFile,
    isLoading,
    isSaving,
    lastSavedContent,
    isDirty,
    isRestoring, // 从 Store 获取状态
    setWorkspacePath,
    setFiles,
    setCurrentFile,
    setLoading,
    setSaving,
    setLastSavedContent,
    setLastSavedAt,
    setIsDirty,
    setIsRestoring, // 获取 setter
  } = useFileStore();

  const { setMarkdown, markdown } = useEditorStore();
  const { themeId: theme, themeName } = useThemeStore();

  // 移除 useRef，直接使用 Store 中的全局状态

  // 仅保留 isCreating 作为本地防抖，防止UI快速点击，无需全局同步
  const isCreating = useRef<boolean>(false);

  // 1. 加载工作区
  const loadWorkspace = useCallback(
    async (path: string) => {
      if (electron) {
        setLoading(true);
        try {
          const res = await electron.fs.setWorkspace(path);
          if (res.success) {
            setWorkspacePath(path);
            localStorage.setItem(WORKSPACE_KEY, path);
            await refreshFiles(path);
          } else {
            setWorkspacePath(null);
            localStorage.removeItem(WORKSPACE_KEY);
          }
        } catch (e) {
          console.error(e);
        } finally {
          setLoading(false);
        }
      } else {
        // Web 模式：工作区由适配器初始化管理
        setWorkspacePath(path); // 对于 Web，path 只是一个标识符
        await refreshFiles();
      }
    },
    // refreshFiles, setLoading, setWorkspacePath 是稳定引用，无需加入依赖
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [electron],
  );

  // 2. 刷新文件列表
  const refreshFiles = useCallback(
    async (dir?: string) => {
      if (electron) {
        const target = dir || workspacePath;
        if (!target) return;

        const res = await electron.fs.listFiles(target);
        if (res.success && res.files) {
          const mapped = convertToTreeItems(res.files);
          setFiles(mapped);
        }
      } else if (adapter && storageReady) {
        try {
          const rawFiles = await adapter.listFiles();
          // 转换 adapter 返回的数据为 TreeItem[]
          const mapped = convertAdapterFilesToTreeItems(rawFiles);
          setFiles(mapped);
        } catch (error) {
          console.error("加载文件列表失败:", error);
          toast.error("无法加载文件列表");
        }
      }
    },
    // setFiles 是稳定引用，无需加入依赖
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [workspacePath, electron, adapter, storageReady],
  );

  // 3. 选择工作区（对话框）
  const selectWorkspace = useCallback(async () => {
    if (electron) {
      const res = await electron.fs.selectWorkspace();
      if (res.success && res.path) {
        await loadWorkspace(res.path);
      }
    } else {
      // Web 模式：通过 StorageContext 触发适配器选择（通常由 UI 处理）
      // 如果执行到这里，说明用户点击了文件夹图标
      // 对于 FileSystem 适配器，可能需要重新初始化
      toast('请在右上角"存储模式"中切换文件夹', { icon: "ℹ️" });
    }
  }, [loadWorkspace, electron]);

  // 4. 打开文件
  const openFile = useCallback(
    async (file: FileItem) => {
      // 防止重复打开正在打开的文件

      // 关键修复：在开始切换前立即设置全局 isRestoring，这会暂停所有组件(App/Sidebar)中的自动保存逻辑
      setIsRestoring(true);

      // 获取最新的 isDirty 状态 (注意：isDirty 是 prop 传入的当前值，在 async 函数中可能陈旧)
      // 最好直接从 store 获取最新 snapshot，但这里依赖闭包
      // 由于 isRestoring 已被设为 true，自动保存已被阻断，我们可以安全地执行手动保存

      // 切换文件前保存当前文件的更改（包括主题）
      // 注意：isDirty 可能在其他组件中更新，这里使用传入的 isDirty
      // 但由于 openFile 可能在 isDirty 更新前触发，我们假设如果 store 说 dirty 就是 dirty
      const currentIsDirty = useFileStore.getState().isDirty;
      const currentCurrentFile = useFileStore.getState().currentFile;

      if (currentCurrentFile && currentIsDirty) {
        const { markdown: currentMarkdown } = useEditorStore.getState();
        const { themeId: currentTheme, themeName: currentThemeName } =
          useThemeStore.getState();
        const baseContent = useFileStore.getState().lastSavedContent;
        const fullContent = applyMarkdownFileMeta(baseContent, {
          body: currentMarkdown,
          theme: currentTheme,
          themeName: currentThemeName,
          title:
            currentCurrentFile.title ||
            stripMarkdownExtension(currentCurrentFile.name),
        });

        if (electron) {
          try {
            const res = await electron.fs.saveFile({
              filePath: currentCurrentFile.path,
              content: fullContent,
            });
            if (res.success) {
              setIsDirty(false);
              setLastSavedContent(fullContent);
              setLastSavedAt(new Date());
              await refreshFiles();
            } else {
              console.error("切换前保存失败:", res.error);
            }
          } catch (e) {
            console.error("切换前保存失败:", e);
          }
        } else if (adapter && storageReady) {
          try {
            await adapter.writeFile(currentCurrentFile.path, fullContent);
            setIsDirty(false); // 保存成功后重置脏状态
            setLastSavedContent(fullContent);
            setLastSavedAt(new Date());
            // 刷新文件列表以更新 themeName 显示
            await refreshFiles();
          } catch (e) {
            console.error("切换前保存失败:", e);
          }
        }
      }

      let content = "";
      let success = false;

      if (electron) {
        const res = await electron.fs.readFile(file.path);
        if (res.success && typeof res.content === "string") {
          content = res.content;
          success = true;
        }
      } else if (adapter && storageReady) {
        try {
          content = await adapter.readFile(file.path);
          success = true;
        } catch (error) {
          console.error("读取文件错误:", error);
        }
      }

      if (success) {
        const parsed = parseMarkdownFileContent(content);
        const resolvedTitle =
          parsed.title?.trim() ||
          file.title?.trim() ||
          stripMarkdownExtension(file.name);

        setCurrentFile({ ...file, title: resolvedTitle });
        setMarkdown(parsed.body);
        useThemeStore.getState().selectTheme(parsed.theme);
        setLastSavedContent(content);
        setIsDirty(false);
      } else {
        toast.error("无法读取文件");
      }

      // 延迟重置 isRestoring，等待状态稳定
      setTimeout(() => {
        setIsRestoring(false);
      }, 100);

      // 保存最后打开的文件路径到 localStorage
      localStorage.setItem(LAST_FILE_KEY, file.path);
    },
    // zustand setters 都是稳定引用无需加入依赖
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setMarkdown, electron, adapter, storageReady, refreshFiles],
  );

  // 5. 创建文件
  const createFile = useCallback(
    async (folderPath?: string) => {
      // 防止快速重复点击创建多个文件
      if (isCreating.current) return;
      isCreating.current = true;

      const initialTitle = "新文章";
      const themeState = useThemeStore.getState();
      const targetTheme = resolveNewArticleThemeSnapshot(
        themeState,
        themeState.getAllThemes(),
      );
      const initialContent = buildMarkdownFileContent({
        body: "# 新文章\n\n",
        theme: targetTheme.themeId,
        themeName: targetTheme.themeName,
        title: initialTitle,
      });

      try {
        if (electron) {
          if (!workspacePath) return;
          // 如果指定了文件夹，构建完整路径
          const filename = `未命名文章-${Date.now()}.md`;
          const targetPath = joinPath(folderPath, filename);
          const res = await electron.fs.createFile({
            filename: targetPath,
            content: initialContent,
          });
          if (res.success && res.filePath) {
            await refreshFiles();
            const newFile = {
              name: res.filename!,
              path: res.filePath!,
              createdAt: new Date(),
              updatedAt: new Date(),
              size: 0,
              title: initialTitle,
              themeName: targetTheme.themeName,
            };
            await openFile(newFile);
            toast.success("已创建新文章");
          }
        } else if (adapter && storageReady) {
          const filename = `未命名文章-${Date.now()}.md`;
          const targetPath = joinPath(folderPath, filename);
          await adapter.writeFile(targetPath, initialContent);
          await refreshFiles();
          const newFile = {
            name: filename,
            path: targetPath,
            createdAt: new Date(),
            updatedAt: new Date(),
            size: initialContent.length,
            title: initialTitle,
            themeName: targetTheme.themeName,
          };
          await openFile(newFile);
          toast.success("已创建新文章");
        }
      } catch {
        toast.error("创建失败");
      } finally {
        isCreating.current = false;
      }
    },
    [workspacePath, refreshFiles, openFile, electron, adapter, storageReady],
  );

  // 6. 保存文件
  const saveFile = useCallback(
    async (showToast = false) => {
      if (!currentFile) return;
      setSaving(true);

      const { markdown } = useEditorStore.getState();
      const { themeId: theme, themeName } = useThemeStore.getState();

      const baseContent = useFileStore.getState().lastSavedContent;
      const fullContent = applyMarkdownFileMeta(baseContent, {
        body: markdown,
        theme,
        themeName,
        title: currentFile.title || stripMarkdownExtension(currentFile.name),
      });

      // 检查内容是否有变化 (使用全局状态)
      if (fullContent === useFileStore.getState().lastSavedContent) {
        setSaving(false);
        if (showToast) toast.success("内容无变化");
        return; // 无变化则跳过保存
      }

      let success = false;
      let errorMsg = "";

      if (electron) {
        const res = await electron.fs.saveFile({
          filePath: currentFile.path,
          content: fullContent,
        });
        if (res.success) success = true;
        else errorMsg = res.error || "Unknown error";
      } else if (adapter && storageReady) {
        try {
          await adapter.writeFile(currentFile.path, fullContent);
          success = true;
        } catch (e: unknown) {
          errorMsg = e instanceof Error ? e.message : String(e);
        }
      }

      setSaving(false);

      if (success) {
        setLastSavedContent(fullContent); // 更新全局已保存内容
        setLastSavedAt(new Date()); // 记录保存时间
        setIsDirty(false); // 重置全局脏状态
        if (showToast) toast.success("已保存");
      } else {
        toast.error("保存失败: " + errorMsg);
      }
    },
    // zustand setters 都是稳定引用无需加入依赖
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentFile, electron, adapter, storageReady],
  );

  // 7. 更新文章标题（不改文件名）
  const updateFileTitle = useCallback(
    async (file: FileItem, newName: string) => {
      const nextTitle = newName.trim();
      if (!nextTitle) {
        toast.error("标题不能为空");
        return;
      }

      let content = "";
      if (electron) {
        const readRes = await electron.fs.readFile(file.path);
        if (!readRes.success || typeof readRes.content !== "string") {
          toast.error(readRes.error || "读取文件失败");
          return;
        }
        content = readRes.content;
      } else if (adapter && storageReady) {
        try {
          content = await adapter.readFile(file.path);
        } catch {
          toast.error("读取文件失败");
          return;
        }
      } else {
        toast.error("当前模式不支持此操作");
        return;
      }

      const parsed = parseMarkdownFileContent(content);
      const fullContent = applyMarkdownFileMeta(content, {
        body: parsed.body,
        theme: parsed.theme,
        themeName: parsed.themeName,
        title: nextTitle,
      });

      let success = false;
      let errorMsg = "";
      if (electron) {
        const saveRes = await electron.fs.saveFile({
          filePath: file.path,
          content: fullContent,
        });
        success = saveRes.success;
        errorMsg = saveRes.error || "";
      } else if (adapter && storageReady) {
        try {
          await adapter.writeFile(file.path, fullContent);
          success = true;
        } catch (e: unknown) {
          errorMsg = e instanceof Error ? e.message : String(e);
        }
      }

      if (!success) {
        toast.error(errorMsg || "更新标题失败");
        return;
      }

      if (currentFile && currentFile.path === file.path) {
        setCurrentFile({ ...currentFile, title: nextTitle });
        const currentState = useFileStore.getState();
        if (!currentState.isDirty) {
          setLastSavedContent(fullContent);
        }
      }

      toast.success("标题已更新");
      await refreshFiles();
    },
    // zustand setters 都是稳定引用无需加入依赖
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [refreshFiles, currentFile, electron, adapter, storageReady],
  );

  // 8. 删除文件
  const deleteFile = useCallback(
    async (file: FileItem) => {
      let success = false;

      if (electron) {
        const res = await electron.fs.deleteFile(file.path);
        success = res.success;
      } else if (adapter && storageReady) {
        try {
          await adapter.deleteFile(file.path);
          success = true;
        } catch (error) {
          console.error(error);
        }
      }

      if (success) {
        toast.success("已删除");
        await refreshFiles();
        if (currentFile && currentFile.path === file.path) {
          setCurrentFile(null);
          setMarkdown(""); // 清空编辑器
          setIsDirty(false);
          setLastSavedContent("");
        }
      } else {
        toast.error("删除失败");
      }
    },
    // zustand setters 都是稳定引用无需加入依赖
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [refreshFiles, currentFile, setMarkdown, electron, adapter, storageReady],
  );

  // --- 副作用 Effects ---

  // 初始化：加载保存的工作区（仅 Electron）
  useEffect(() => {
    if (electron) {
      const saved = localStorage.getItem(WORKSPACE_KEY);
      if (saved) {
        loadWorkspace(saved);
      }
    } else {
      // Web：存储类型变化时重置状态
      setCurrentFile(null);
      setMarkdown("");
      useThemeStore.getState().selectTheme("default");
      setIsDirty(false);
      setLastSavedContent("");

      if (storageReady && storageType === "filesystem") {
        // Web：存储就绪后刷新文件（仅限 filesystem 模式）
        setLoading(true);
        (async () => {
          try {
            await refreshFiles();
            // 自动打开上次打开的文件或第一个文件
            const lastPath = localStorage.getItem(LAST_FILE_KEY);
            const { files: currentFiles } = useFileStore.getState();
            const flatFiles = flattenFiles(currentFiles);
            if (flatFiles.length > 0) {
              const targetFile = lastPath
                ? flatFiles.find((f) => f.path === lastPath) || flatFiles[0]
                : flatFiles[0];
              if (targetFile) {
                await openFile(targetFile);
              }
            }
          } finally {
            setLoading(false);
          }
        })();
        // 设置工作区路径用于 UI 显示
        const folderName =
          storageType === "filesystem" &&
          (adapter as unknown as { directoryName?: string }).directoryName
            ? (adapter as unknown as { directoryName: string }).directoryName
            : storageType === "filesystem"
              ? "本地文件夹"
              : "浏览器存储";
        setWorkspacePath(folderName);
      } else if (storageReady && storageType === "indexeddb") {
        // IndexedDB 模式：设置工作区标识
        setWorkspacePath("浏览器存储");
      }
    }
    // 初始化 effect 仅在指定条件变化时触发， setters 都是稳定引用
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [electron, storageReady, storageType]);

  // 文件监听事件（Electron）
  useEffect(() => {
    if (!electron) return;
    const handler = electron.fs.onRefresh(() => {
      refreshFiles();
    });
    return () => electron.fs.removeRefreshListener(handler);
  }, [refreshFiles, electron]);

  // 菜单事件（Electron）
  useEffect(() => {
    if (!electron) return;
    electron.fs.onMenuNewFile(() => createFile());
    electron.fs.onMenuSave(() => saveFile());
    electron.fs.onMenuSwitchWorkspace(() => selectWorkspace());

    return () => {
      // 清理
    };
  }, [createFile, saveFile, selectWorkspace, electron]);

  // 自动保存
  // 注意：所有使用 useFileSystem 的组件都会挂载此 effect，但由于依赖全局状态，逻辑是一致的
  // 不过最好只在 App 层级执行一次，防止多重 timer。
  // 但鉴于 logic 依赖 currentFile (全局) 和 markdown (全局)，多重执行也无大碍，只要 isDirty/lastSavedContent 同步即可
  useEffect(() => {
    if (!currentFile || !markdown) return;
    if (isRestoring) return; // 正在恢复中，跳过

    const { themeId: theme, themeName } = useThemeStore.getState();
    const fullContent = applyMarkdownFileMeta(lastSavedContent, {
      body: markdown,
      theme,
      themeName,
      title: currentFile.title || stripMarkdownExtension(currentFile.name),
    });

    if (fullContent !== lastSavedContent) {
      setIsDirty(true);
    }

    if (!isDirty) return;

    const timer = setTimeout(() => {
      // 再次检查全局状态
      const currentIsRestoring = useFileStore.getState().isRestoring;
      const currentIsDirty = useFileStore.getState().isDirty;

      if (currentIsDirty && !currentIsRestoring) {
        saveFile();
      }
    }, 3000);

    return () => clearTimeout(timer);
    // setIsDirty 是稳定引用无需加入依赖
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
  ]);

  // 移除了此处重复的 Cmd+S 监听器
  // 应由 App.tsx 或其他顶层组件统一处理

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

  // 10. 创建文件夹
  const createFolder = useCallback(
    async (folderName: string, parentFolder?: string) => {
      // 构建完整路径
      const fullPath = joinPath(parentFolder, folderName);

      if (electron) {
        const res = await electron.fs.createFolder(fullPath);
        if (res.success) {
          toast.success("文件夹已创建");
          await refreshFiles();
          return res.path;
        } else {
          toast.error(res.error || "创建失败");
          return null;
        }
      } else if (adapter?.createFolder) {
        const res = await adapter.createFolder(fullPath);
        if (res.success) {
          toast.success("文件夹已创建");
          await refreshFiles();
          return res.path;
        } else {
          toast.error(res.error || "创建失败");
          return null;
        }
      } else {
        toast.error("当前存储模式不支持文件夹操作");
        return null;
      }
    },
    [electron, adapter, refreshFiles],
  );

  // 11. 移动文件到文件夹
  const moveToFolder = useCallback(
    async (file: FileItem, targetFolder: string) => {
      if (electron) {
        const res = await electron.fs.moveFile({
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
        } else {
          toast.error(res.error || "移动失败");
          return false;
        }
      } else if (adapter?.moveFile) {
        const res = await adapter.moveFile(file.path, targetFolder);
        if (res.success) {
          toast.success("文件已移动");
          await refreshFiles();
          if (currentFile && currentFile.path === file.path && res.newPath) {
            setCurrentFile({ ...currentFile, path: res.newPath });
            localStorage.setItem(LAST_FILE_KEY, res.newPath);
          }
          return true;
        } else {
          toast.error(res.error || "移动失败");
          return false;
        }
      } else {
        toast.error("当前存储模式不支持文件夹操作");
        return false;
      }
    },
    [electron, adapter, refreshFiles, currentFile, setCurrentFile],
  );

  // 12. 重命名文件夹
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

      if (electron) {
        const res = await electron.fs.renameFolder({
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
    [electron, adapter, refreshFiles, updateCurrentFilePathForFolder],
  );

  // 13. 移动文件夹
  const moveFolder = useCallback(
    async (folder: { path: string }, targetFolder: string) => {
      if (electron) {
        const res = await electron.fs.moveFolder({
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
    [electron, adapter, refreshFiles, updateCurrentFilePathForFolder],
  );

  // 14. 删除文件夹
  const deleteFolderFn = useCallback(
    async (folderPath: string, options?: { recursive?: boolean }) => {
      if (electron) {
        const res = await electron.fs.deleteFolder({
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
        } else {
          toast.error(res.error || "删除失败");
          return false;
        }
      } else if (adapter?.deleteFolder) {
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
        } else {
          toast.error(res.error || "删除失败");
          return false;
        }
      } else {
        toast.error("当前存储模式不支持文件夹操作");
        return false;
      }
    },
    [
      electron,
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
      if (electron) {
        const res = await electron.fs.inspectFolder(folderPath);
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
    [electron, adapter],
  );

  return {
    workspacePath,
    files,
    currentFile,
    isLoading,
    isSaving,
    selectWorkspace,
    openFile,
    createFile,
    saveFile,
    updateFileTitle,
    // 兼容旧调用，后续可移除
    renameFile: updateFileTitle,
    deleteFile,
    // 文件夹操作
    createFolder,
    moveToFolder,
    renameFolder,
    moveFolder,
    deleteFolder: deleteFolderFn,
    inspectFolder,
    flattenFiles,
  };
}
