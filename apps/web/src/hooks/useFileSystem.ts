import { useEffect, useCallback, useRef } from 'react';
import { useFileStore } from '../store/fileStore';
import { useEditorStore } from '../store/editorStore';
import { useThemeStore } from '../store/themeStore';
import { useStorageContext } from '../storage/StorageContext';
import type { FileItem } from '../store/fileTypes';
import toast from 'react-hot-toast';

// 本地定义 Electron API 类型以确保类型安全
interface ElectronFileItem {
    name: string;
    path: string;
    createdAt: string;
    updatedAt: string;
    size?: number;
    themeName?: string;
}

interface ElectronAPI {
    fs: {
        selectWorkspace: () => Promise<{ success: boolean; path?: string; canceled?: boolean }>;
        setWorkspace: (dir: string) => Promise<{ success: boolean; path?: string }>;
        listFiles: (dir?: string) => Promise<{ success: boolean; files?: ElectronFileItem[] }>;
        readFile: (path: string) => Promise<{ success: boolean; content?: string; error?: string }>;
        createFile: (payload: { filename?: string; content?: string }) => Promise<{ success: boolean; filePath?: string; filename?: string }>;
        saveFile: (payload: { filePath: string; content: string }) => Promise<{ success: boolean; error?: string }>;
        renameFile: (payload: { oldPath: string; newName: string }) => Promise<{ success: boolean; filePath?: string; error?: string }>;
        deleteFile: (path: string) => Promise<{ success: boolean; error?: string }>;
        revealInFinder: (path: string) => Promise<void>;
        onRefresh: (cb: () => void) => (() => void);
        removeRefreshListener: (handler: (() => void)) => void;
        onMenuNewFile: (cb: () => void) => (() => void);
        onMenuSave: (cb: () => void) => (() => void);
        onMenuSwitchWorkspace: (cb: () => void) => (() => void);
        removeAllListeners: () => void;
    };
}

const getElectron = (): ElectronAPI | null => {
    // @ts-expect-error - Electron API 在运行时注入
    return window.electron as ElectronAPI;
};

const WORKSPACE_KEY = 'wemd-workspace-path';
const LAST_FILE_KEY = 'wemd-last-file-path';

export function useFileSystem() {
    const { adapter, ready: storageReady, type: storageType } = useStorageContext();
    const electron = getElectron();

    const {
        workspacePath, files, currentFile, isLoading, isSaving,
        lastSavedContent, isDirty, isRestoring, // 从 Store 获取状态
        setWorkspacePath, setFiles, setCurrentFile, setLoading, setSaving,
        setLastSavedContent, setIsDirty, setIsRestoring // 获取 setter
    } = useFileStore();

    const { setMarkdown, markdown } = useEditorStore();
    const { themeId: theme, themeName } = useThemeStore();

    // 移除 useRef，直接使用 Store 中的全局状态
    // const lastSavedContent = useRef<string>('');
    // const isDirty = useRef<boolean>(false);
    // const isRestoring = useRef<boolean>(false);

    // 仅保留 isCreating 作为本地防抖，防止UI快速点击，无需全局同步
    const isCreating = useRef<boolean>(false);

    // 1. 加载工作区
    const loadWorkspace = useCallback(async (path: string) => {
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
    }, [electron]);

    // 2. 刷新文件列表
    const refreshFiles = useCallback(async (dir?: string) => {
        if (electron) {
            const target = dir || workspacePath;
            if (!target) return;

            const res = await electron.fs.listFiles(target);
            if (res.success && res.files) {
                const mapped = res.files.map((f) => ({
                    ...f,
                    size: f.size ?? 0,
                    createdAt: new Date(f.createdAt),
                    updatedAt: new Date(f.updatedAt)
                }));
                setFiles(mapped);
            }
        } else if (adapter && storageReady) {
            try {
                const files = await adapter.listFiles();
                // 适配器返回 FileItem[]，与 store 兼容
                setFiles(files.map(f => ({
                    name: f.name,
                    path: f.path,
                    size: f.size ?? 0,
                    createdAt: f.updatedAt ? new Date(f.updatedAt) : new Date(),
                    updatedAt: f.updatedAt ? new Date(f.updatedAt) : new Date(),
                    themeName: (f.meta?.themeName as string) || undefined
                })));
            } catch (error) {
                console.error('加载文件列表失败:', error);
                toast.error('无法加载文件列表');
            }
        }
    }, [workspacePath, electron, adapter, storageReady]);

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
            toast('请在右上角"存储模式"中切换文件夹', { icon: 'ℹ️' });
        }
    }, [loadWorkspace, electron]);

    // 4. 打开文件
    const openFile = useCallback(async (file: FileItem) => {
        // 防止重复打开正在打开的文件
        // if (isRestoring) return; (暂时注释，允许强制切换)

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
            const { themeId: currentTheme, themeName: currentThemeName } = useThemeStore.getState();
            const frontmatter = `---\ntheme: ${currentTheme}\nthemeName: ${currentThemeName}\n---\n`;
            const fullContent = frontmatter + '\n' + currentMarkdown;

            if (electron) {
                try {
                    const res = await electron.fs.saveFile({ filePath: currentCurrentFile.path, content: fullContent });
                    if (res.success) {
                        setIsDirty(false);
                        setLastSavedContent(fullContent);
                        await refreshFiles();
                    } else {
                        console.error('切换前保存失败:', res.error);
                    }
                } catch (e) {
                    console.error('切换前保存失败:', e);
                }
            } else if (adapter && storageReady) {
                try {
                    await adapter.writeFile(currentCurrentFile.path, fullContent);
                    setIsDirty(false); // 保存成功后重置脏状态
                    setLastSavedContent(fullContent);
                    // 刷新文件列表以更新 themeName 显示
                    await refreshFiles();
                } catch (e) {
                    console.error('切换前保存失败:', e);
                }
            }
        }

        let content = '';
        let success = false;

        if (electron) {
            const res = await electron.fs.readFile(file.path);
            if (res.success && typeof res.content === 'string') {
                content = res.content;
                success = true;
            }
        } else if (adapter && storageReady) {
            try {
                content = await adapter.readFile(file.path);
                success = true;
            } catch (error) {
                console.error('读取文件错误:', error);
            }
        }

        if (success) {
            setCurrentFile(file);

            // 解析 Frontmatter
            const match = content.match(/^---\n([\s\S]*?)\n---/);

            if (match) {
                const frontmatterRaw = match[1];
                const body = content.slice(match[0].length).trimStart();

                // 简单的 YAML 解析器
                const themeMatch = frontmatterRaw.match(/theme:\s*(.+)/);
                const theme = themeMatch ? themeMatch[1].trim() : 'default';

                setMarkdown(body);
                useThemeStore.getState().selectTheme(theme);

                // 更新全局 lastSavedContent，确保所有组件同步
                setLastSavedContent(content);
                setIsDirty(false); // 重置修改标记
            } else {
                setMarkdown(content);
                // 没有 frontmatter 时重置为默认值
                useThemeStore.getState().selectTheme('default');
                setLastSavedContent(content); // 保存完整内容
                setIsDirty(false); // 重置修改标记
            }
        } else {
            toast.error('无法读取文件');
        }

        // 延迟重置 isRestoring，等待状态稳定
        setTimeout(() => {
            setIsRestoring(false);
        }, 100);

        // 保存最后打开的文件路径到 localStorage
        localStorage.setItem(LAST_FILE_KEY, file.path);
    }, [setMarkdown, electron, adapter, storageReady, refreshFiles]);

    // 5. 创建文件
    const createFile = useCallback(async () => {
        // 防止快速重复点击创建多个文件
        if (isCreating.current) return;
        isCreating.current = true;

        const initialContent = '---\ntheme: default\nthemeName: 默认主题\n---\n\n# 新文章\n\n';

        try {
            if (electron) {
                if (!workspacePath) return;
                const res = await electron.fs.createFile({ content: initialContent });
                if (res.success && res.filePath) {
                    await refreshFiles();
                    const newFile = {
                        name: res.filename!,
                        path: res.filePath!,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                        size: 0,
                        themeName: '默认主题'
                    };
                    await openFile(newFile);
                    toast.success('已创建新文章');
                }
            } else if (adapter && storageReady) {
                const filename = `未命名文章-${Date.now()}.md`;
                await adapter.writeFile(filename, initialContent);
                await refreshFiles();
                const newFile = {
                    name: filename,
                    path: filename,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    size: initialContent.length,
                    themeName: '默认主题'
                };
                await openFile(newFile);
                toast.success('已创建新文章');
            }
        } catch {
            toast.error('创建失败');
        } finally {
            isCreating.current = false;
        }
    }, [workspacePath, refreshFiles, openFile, electron, adapter, storageReady]);

    // 6. 保存文件
    const saveFile = useCallback(async (showToast = false) => {
        if (!currentFile) return;
        setSaving(true);

        const { markdown } = useEditorStore.getState();
        const { themeId: theme, themeName } = useThemeStore.getState();

        // 构建 Frontmatter
        const frontmatter = `---
theme: ${theme}
themeName: ${themeName}
---
`;
        const fullContent = frontmatter + '\n' + markdown;

        // 检查内容是否有变化 (使用全局状态)
        if (fullContent === useFileStore.getState().lastSavedContent) {
            setSaving(false);
            if (showToast) toast.success('内容无变化');
            return; // 无变化则跳过保存
        }

        let success = false;
        let errorMsg = '';

        if (electron) {
            const res = await electron.fs.saveFile({ filePath: currentFile.path, content: fullContent });
            if (res.success) success = true;
            else errorMsg = res.error || 'Unknown error';
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
            setIsDirty(false); // 重置全局脏状态
            if (showToast) toast.success('已保存');
        } else {
            toast.error('保存失败: ' + errorMsg);
        }
    }, [currentFile, electron, adapter, storageReady]);

    // 7. 重命名文件保持不变...
    const renameFile = useCallback(async (file: FileItem, newName: string) => {
        const safeName = newName.endsWith('.md') ? newName : `${newName}.md`;

        if (electron) {
            const res = await electron.fs.renameFile({ oldPath: file.path, newName });
            if (res.success) {
                toast.success('重命名成功');
                await refreshFiles();
                if (currentFile && currentFile.path === file.path) {
                    setCurrentFile({ ...currentFile, path: res.filePath!, name: safeName });
                }
            } else {
                toast.error(res.error || '重命名失败');
            }
        } else if (adapter && storageReady) {
            try {
                await adapter.renameFile(file.path, safeName);
                toast.success('重命名成功');
                await refreshFiles();
                if (currentFile && currentFile.path === file.path) {
                    setCurrentFile({ ...currentFile, path: safeName, name: safeName });
                }
            } catch {
                toast.error('重命名失败');
            }
        }
    }, [refreshFiles, currentFile, electron, adapter, storageReady]);

    // 8. 删除文件
    const deleteFile = useCallback(async (file: FileItem) => {
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
            toast.success('已删除');
            await refreshFiles();
            if (currentFile && currentFile.path === file.path) {
                setCurrentFile(null);
                setMarkdown(''); // 清空编辑器
                setIsDirty(false);
                setLastSavedContent('');
            }
        } else {
            toast.error('删除失败');
        }
    }, [refreshFiles, currentFile, setMarkdown, electron, adapter, storageReady]);

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
            setMarkdown('');
            useThemeStore.getState().selectTheme('default');
            setIsDirty(false);
            setLastSavedContent('');

            if (storageReady && storageType === 'filesystem') {
                // Web：存储就绪后刷新文件（仅限 filesystem 模式）
                setLoading(true);
                (async () => {
                    try {
                        await refreshFiles();
                        // 自动打开上次打开的文件或第一个文件
                        const lastPath = localStorage.getItem(LAST_FILE_KEY);
                        const { files: currentFiles } = useFileStore.getState();
                        if (currentFiles.length > 0) {
                            const targetFile = lastPath
                                ? currentFiles.find(f => f.path === lastPath) || currentFiles[0]
                                : currentFiles[0];
                            if (targetFile) {
                                await openFile(targetFile);
                            }
                        }
                    } finally {
                        setLoading(false);
                    }
                })();
                // 设置虚拟工作区路径用于 UI 显示
                setWorkspacePath(storageType === 'filesystem' ? '本地文件夹' : '浏览器存储');
            } else if (storageReady && storageType === 'indexeddb') {
                // IndexedDB 模式：设置工作区标识
                setWorkspacePath('浏览器存储');
            }
        }
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
        const frontmatter = `---
theme: ${theme}
themeName: ${themeName}
---
`;
        const fullContent = frontmatter + '\n' + markdown;

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
    }, [markdown, theme, themeName, currentFile, saveFile, isRestoring, isDirty, lastSavedContent]);


    // 移除了此处重复的 Cmd+S 监听器
    // 应由 App.tsx 或其他顶层组件统一处理


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
        renameFile,
        deleteFile
    };
}
