import { app, BrowserWindow, Menu, dialog, ipcMain, nativeImage, IpcMainInvokeEvent, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { checkForUpdates, openReleasesPage } from './updater';

// 判断是否为开发模式 - 使用 app.isPackaged 是最可靠的方式
// 注意：app.isPackaged 只能在 app ready 之后使用，这里用延迟判断
let isDev = !app.isPackaged || process.argv.includes('--dev') || !!process.env.ELECTRON_START_URL;

app.setName('WeMD');
app.setAppUserModelId('com.wemd.app');

let mainWindow: BrowserWindow | null = null;
let workspaceDir: string | null = null;
let fileWatcher: fs.FSWatcher | null = null;
let watcherDebounceTimer: NodeJS.Timeout | null = null;

// --- 文件监听器 ---
function startWatching(dir: string) {
    if (fileWatcher) {
        fileWatcher.close();
        fileWatcher = null;
    }
    if (!dir || !fs.existsSync(dir)) return;

    try {
        fileWatcher = fs.watch(dir, { recursive: false }, (_eventType, filename) => {
            if (!filename) return;
            // 忽略隐藏文件和非 md 文件
            if (filename.startsWith('.') || !filename.endsWith('.md')) return;

            // 防抖发送更新事件
            if (watcherDebounceTimer) clearTimeout(watcherDebounceTimer);
            watcherDebounceTimer = setTimeout(() => {
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('file:refresh');
                }
            }, 300); // 300ms 防抖
        });
    } catch (error) {
        console.error('Failed to watch directory:', error);
    }
}

function stopWatching() {
    if (fileWatcher) {
        fileWatcher.close();
        fileWatcher = null;
    }
}

// --- 辅助函数 ---

function getWindowIcon() {


    // 方案 1: 当前脚本同级 assets 目录
    let iconPath = path.join(__dirname, 'assets', 'icon.png');

    // 方案 2: 父级 assets 目录 (dist 场景)
    if (!fs.existsSync(iconPath)) {
        iconPath = path.join(__dirname, '..', 'assets', 'icon.png');
    }

    // 方案 3: 绝对开发路径回退 (开发环境可选)
    // omit for now.

    const img = nativeImage.createFromPath(iconPath);
    return img.isEmpty() ? null : img;
}

// 检查文件是否存在并生成带编号的唯一路径
function getUniqueFilePath(targetPath: string): string {
    const dir = path.dirname(targetPath);
    const ext = path.extname(targetPath);
    const name = path.basename(targetPath, ext); // 不含扩展名的文件名

    let candidate = targetPath;
    let counter = 1;
    while (fs.existsSync(candidate)) {
        candidate = path.join(dir, `${name} (${counter})${ext}`);
        counter += 1;
    }
    return candidate;
}

function isPathInsideWorkspace(targetPath: string): boolean {
    if (!workspaceDir) return false;
    const workspaceResolvedRaw = path.resolve(workspaceDir);
    const workspaceRoot = path.parse(workspaceResolvedRaw).root;
    const workspaceResolved =
        workspaceResolvedRaw === workspaceRoot
            ? workspaceResolvedRaw
            : workspaceResolvedRaw.replace(/[\\/]+$/, '');
    const targetResolved = path.resolve(targetPath);

    const normalizedWorkspace = process.platform === 'win32'
        ? workspaceResolved.toLowerCase()
        : workspaceResolved;
    const normalizedTarget = process.platform === 'win32'
        ? targetResolved.toLowerCase()
        : targetResolved;

    const workspacePrefix = normalizedWorkspace.endsWith(path.sep)
        ? normalizedWorkspace
        : normalizedWorkspace + path.sep;

    return normalizedTarget === normalizedWorkspace || normalizedTarget.startsWith(workspacePrefix);
}

interface FileEntry {
    name: string;
    path: string;
    isDirectory: boolean;
    createdAt: Date;
    updatedAt: Date;
    size: number;
    title?: string;
    themeName: string;
    children?: FileEntry[]; // 用于文件夹
}

// 读取单个 md 文件并提取 themeName
function readFileEntry(fullPath: string, name: string): FileEntry {
    const stats = fs.statSync(fullPath);
    let themeName = '默认主题';
    let title: string | undefined;
    try {
        const fd = fs.openSync(fullPath, 'r');
        const buffer = Buffer.alloc(1200);
        const bytesRead = fs.readSync(fd, buffer, 0, 1200, 0);
        fs.closeSync(fd);
        const content = buffer.toString('utf8', 0, bytesRead);
        const match = content.match(/^---\n([\s\S]*?)\n---/);
        if (match) {
            const parseValue = (raw?: string) => {
                if (!raw) return undefined;
                const trimmed = raw.trim();
                if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
                    const quote = trimmed[0];
                    const inner = trimmed.slice(1, -1);
                    if (quote === '"') {
                        return inner.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
                    }
                    return inner.replace(/\\'/g, "'");
                }
                return trimmed;
            };
            const themeMatch = match[1].match(/themeName:\s*(.+)/);
            const titleMatch = match[1].match(/title:\s*(.+)/);
            if (themeMatch) {
                themeName = parseValue(themeMatch[1]) || '默认主题';
            }
            if (titleMatch) {
                title = parseValue(titleMatch[1]) || undefined;
            }
        }
    } catch (e) { /* 忽略 */ }
    return {
        name,
        path: fullPath,
        isDirectory: false,
        createdAt: stats.birthtime,
        updatedAt: stats.mtime,
        size: stats.size,
        title,
        themeName,
    };
}

function scanWorkspace(dir: string): FileEntry[] {
    if (!dir || !fs.existsSync(dir)) return [];
    try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        const results: FileEntry[] = [];

        // 先处理文件夹
        const folders = entries
            .filter(e => e.isDirectory() && !e.name.startsWith('.'))
            .sort((a, b) => a.name.localeCompare(b.name));
        for (const folder of folders) {
            const folderPath = path.join(dir, folder.name);
            const stats = fs.statSync(folderPath);
            const children = scanWorkspace(folderPath); // 递归
            results.push({
                name: folder.name,
                path: folderPath,
                isDirectory: true,
                createdAt: stats.birthtime,
                updatedAt: stats.mtime,
                size: 0,
                themeName: '',
                children,
            });
        }

        // 再处理 md 文件
        const mdFiles = entries
            .filter(e => e.isFile() && e.name.endsWith('.md') && !e.name.startsWith('.'))
            .map(e => readFileEntry(path.join(dir, e.name), e.name))
            .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
        results.push(...mdFiles);

        return results;
    } catch (error) {
        console.error('Scan workspace failed:', error);
        return [];
    }
}

// --- 窗口管理 ---

function createWindow() {
    const windowIcon = getWindowIcon() || undefined;
    const isWindows = process.platform === 'win32';

    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 1024,
        minHeight: 640,
        title: 'WeMD',
        icon: windowIcon,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
        titleBarStyle: 'hidden',
        frame: !isWindows, // Windows 完全无边框
        titleBarOverlay: isWindows ? false : {
            color: '#f5f7f9',
            symbolColor: '#2c2c2c',
            height: 48,
        },
        trafficLightPosition: { x: 20, y: 28 },
        show: false, // 延迟显示，避免闪烁
    });

    const startUrl = process.env.ELECTRON_START_URL
        ? process.env.ELECTRON_START_URL
        : isDev
            ? 'http://localhost:5173'
            : `file://${path.join(process.resourcesPath, 'web-dist', 'index.html')}`;

    console.log('[WeMD] Loading URL:', startUrl);
    console.log('[WeMD] isDev:', isDev);
    console.log('[WeMD] resourcesPath:', process.resourcesPath);

    mainWindow.loadURL(startUrl);

    // 准备就绪后显示并最大化，解决 macOS 启动不最大化问题
    mainWindow.once('ready-to-show', () => {
        if (!mainWindow) return;
        mainWindow.maximize();
        mainWindow.show();
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
        stopWatching();
    });
}

// --- IPC 处理器 ---

// 窗口控制 (用于 Windows 自定义标题栏)
ipcMain.handle('window:minimize', () => mainWindow?.minimize());
ipcMain.handle('window:maximize', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize();
    else mainWindow?.maximize();
});
ipcMain.handle('window:close', () => mainWindow?.close());
ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized());

// 工作区管理
ipcMain.handle('workspace:select', async () => {
    if (!mainWindow) return { success: false, error: 'Window not initialized' };
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory', 'createDirectory'],
        message: '选择 WeMD 工作区文件夹'
    });
    if (result.canceled || result.filePaths.length === 0) {
        return { success: false, canceled: true };
    }
    const dir = result.filePaths[0];
    workspaceDir = dir;
    startWatching(dir);
    return { success: true, path: dir };
});

ipcMain.handle('workspace:current', async () => {
    // 这里可以结合 electron-store 持久化，暂时由前端传过来校验
    return { success: true, path: workspaceDir };
});

ipcMain.handle('workspace:set', async (_event: IpcMainInvokeEvent, dir: string) => {
    if (!dir || !fs.existsSync(dir)) {
        return { success: false, error: 'Directory not found' };
    }
    workspaceDir = dir;
    startWatching(dir);
    return { success: true, path: dir };
});

ipcMain.handle('file:list', async (_event: IpcMainInvokeEvent, dir?: string) => {
    const targetDir = dir || workspaceDir;
    if (!targetDir) return { success: false, error: 'No workspace selected' };
    if (!isPathInsideWorkspace(targetDir)) {
        return { success: false, error: '非法路径' };
    }
    const files = scanWorkspace(targetDir);
    return { success: true, files };
});

ipcMain.handle('file:read', async (_event: IpcMainInvokeEvent, filePath: string) => {
    try {
        if (!isPathInsideWorkspace(filePath)) {
            return { success: false, error: '非法路径' };
        }
        if (!fs.existsSync(filePath)) {
            return { success: false, error: 'File not found' };
        }
        const content = fs.readFileSync(filePath, 'utf-8');
        return { success: true, content, filePath };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('file:create', async (_event: IpcMainInvokeEvent, payload: { filename?: string; content?: string }) => {
    if (!workspaceDir) return { success: false, error: 'No workspace' };
    const { filename, content } = payload || {};

    let targetPath = '';
    if (filename) {
        if (path.isAbsolute(filename)) {
            targetPath = filename;
        } else {
            targetPath = path.join(workspaceDir, filename);
        }
    } else {
        targetPath = path.join(workspaceDir, '未命名文章.md');
    }

    if (!isPathInsideWorkspace(targetPath)) {
        return { success: false, error: '非法路径' };
    }

    // 自动处理重名
    targetPath = getUniqueFilePath(targetPath);

    try {
        const dir = path.dirname(targetPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(targetPath, content || '', 'utf-8');
        return { success: true, filePath: targetPath, filename: path.basename(targetPath) };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('file:save', async (_event: IpcMainInvokeEvent, payload: { filePath: string; content: string }) => {
    const { filePath, content } = payload;
    if (!filePath) return { success: false, error: 'File path required' };

    try {
        if (!isPathInsideWorkspace(filePath)) {
            return { success: false, error: '非法路径' };
        }
        // 检查内容是否变更，避免不必要的写入
        let existingContent = '';
        if (fs.existsSync(filePath)) {
            existingContent = fs.readFileSync(filePath, 'utf-8');
        }

        // 仅当内容不同才写入
        if (existingContent !== content) {
            fs.writeFileSync(filePath, content, 'utf-8');
        }

        return { success: true, filePath };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('file:rename', async (_event: IpcMainInvokeEvent, payload: { oldPath: string; newName: string }) => {
    const { oldPath, newName } = payload;
    if (!oldPath || !newName) return { success: false, error: 'Invalid arguments' };

    if (!isPathInsideWorkspace(oldPath)) {
        return { success: false, error: '非法路径' };
    }

    const dir = path.dirname(oldPath);
    // 确保新名字以 .md 结尾
    const trimmedName = newName.trim();
    const safeName = trimmedName.endsWith('.md') ? trimmedName : `${trimmedName}.md`;
    const safeBaseName = path.basename(safeName);
    const newPath = path.join(dir, safeName);

    if (oldPath === newPath) return { success: true, filePath: newPath };

    // 检查目标是否存在 (且不是大小写变名)
    if (fs.existsSync(newPath) && oldPath.toLowerCase() !== newPath.toLowerCase()) {
        return { success: false, error: '文件名已存在' };
    }

    try {
        const finalPath = path.join(dir, safeBaseName);
        if (!isPathInsideWorkspace(finalPath)) {
            return { success: false, error: '非法路径' };
        }
        if (fs.existsSync(finalPath) && oldPath.toLowerCase() !== finalPath.toLowerCase()) {
            return { success: false, error: '文件名已存在' };
        }
        fs.renameSync(oldPath, finalPath);
        return { success: true, filePath: finalPath };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('file:delete', async (_event: IpcMainInvokeEvent, filePath: string) => {
    if (!filePath) return { success: false, error: 'Path required' };
    try {
        if (!isPathInsideWorkspace(filePath)) {
            return { success: false, error: '非法路径' };
        }
        if (fs.existsSync(filePath)) {
            // 尝试移动到回收站
            await shell.trashItem(filePath);
        }
        return { success: true };
    } catch (error) {
        // 如果回收站失败，尝试物理删除
        try {
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            return { success: true };
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    }
});

ipcMain.handle('file:reveal', async (_event: IpcMainInvokeEvent, filePath: string) => {
    if (filePath) {
        if (!isPathInsideWorkspace(filePath)) return;
        shell.showItemInFolder(filePath);
    }
});

// --- 文件夹管理 ---
ipcMain.handle('folder:create', async (_event: IpcMainInvokeEvent, folderPathArg: string) => {
    if (!workspaceDir) return { success: false, error: 'No workspace' };
    if (!folderPathArg || folderPathArg.trim() === '') {
        return { success: false, error: '文件夹名称不能为空' };
    }

    let targetPath = folderPathArg.trim();
    if (!path.isAbsolute(targetPath)) {
        targetPath = path.join(workspaceDir, targetPath);
    }

    if (!isPathInsideWorkspace(targetPath)) {
        return { success: false, error: '非法路径' };
    }

    if (fs.existsSync(targetPath)) {
        return { success: false, error: '文件夹已存在' };
    }

    try {
        fs.mkdirSync(targetPath, { recursive: true });
        return { success: true, path: targetPath, name: path.basename(targetPath) };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('folder:rename', async (_event: IpcMainInvokeEvent, payload: { folderPath: string; newName: string }) => {
    const { folderPath, newName } = payload;
    if (!folderPath || !newName) return { success: false, error: 'Invalid arguments' };
    if (!isPathInsideWorkspace(folderPath)) return { success: false, error: '非法路径' };

    if (!fs.existsSync(folderPath)) {
        return { success: false, error: '文件夹不存在' };
    }
    const stats = fs.statSync(folderPath);
    if (!stats.isDirectory()) {
        return { success: false, error: '不是文件夹' };
    }

    const safeBaseName = path.basename(newName.trim());
    if (!safeBaseName) {
        return { success: false, error: '文件夹名称不能为空' };
    }

    const dir = path.dirname(folderPath);
    const newPath = path.join(dir, safeBaseName);

    if (!isPathInsideWorkspace(newPath)) {
        return { success: false, error: '非法路径' };
    }

    if (folderPath === newPath) {
        return { success: true, newPath };
    }

    if (fs.existsSync(newPath)) {
        return { success: false, error: '文件夹已存在' };
    }

    try {
        fs.renameSync(folderPath, newPath);
        return { success: true, newPath };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('folder:move-folder', async (_event: IpcMainInvokeEvent, payload: { folderPath: string; targetFolder: string }) => {
    const { folderPath, targetFolder } = payload;
    if (!folderPath) return { success: false, error: 'Path required' };

    if (!isPathInsideWorkspace(folderPath)) {
        return { success: false, error: '非法路径' };
    }

    if (!fs.existsSync(folderPath)) {
        return { success: false, error: '文件夹不存在' };
    }

    const stats = fs.statSync(folderPath);
    if (!stats.isDirectory()) {
        return { success: false, error: '不是文件夹' };
    }

    const targetDir = targetFolder ? targetFolder : workspaceDir;
    if (!targetDir) return { success: false, error: 'No workspace' };

    if (!isPathInsideWorkspace(targetDir)) {
        return { success: false, error: '非法路径' };
    }

    if (!fs.existsSync(targetDir) || !fs.statSync(targetDir).isDirectory()) {
        return { success: false, error: '目标文件夹不存在' };
    }

    const folderName = path.basename(folderPath);
    const newPath = path.join(targetDir, folderName);

    if (folderPath === newPath) return { success: true, newPath };

    const resolvedOld = path.resolve(folderPath);
    const resolvedNew = path.resolve(newPath);
    if (resolvedNew.startsWith(resolvedOld + path.sep)) {
        return { success: false, error: '不能移动到子文件夹' };
    }

    if (fs.existsSync(newPath)) {
        return { success: false, error: '目标位置已存在同名文件夹' };
    }

    try {
        fs.renameSync(folderPath, newPath);
        return { success: true, newPath };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('folder:move', async (_event: IpcMainInvokeEvent, payload: { filePath: string; targetFolder: string }) => {
    const { filePath, targetFolder } = payload;
    if (!filePath) return { success: false, error: 'File path required' };

    // targetFolder 为空字符串表示移动到根目录
    const targetDir = targetFolder ? targetFolder : workspaceDir;
    if (!targetDir) return { success: false, error: 'No workspace' };

    if (!isPathInsideWorkspace(filePath) || !isPathInsideWorkspace(targetDir)) {
        return { success: false, error: '非法路径' };
    }

    const fileName = path.basename(filePath);
    const newPath = path.join(targetDir, fileName);

    if (filePath === newPath) return { success: true, newPath };

    if (fs.existsSync(newPath)) {
        return { success: false, error: '目标位置已存在同名文件' };
    }

    try {
        fs.renameSync(filePath, newPath);
        return { success: true, newPath };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('folder:inspect', async (_event: IpcMainInvokeEvent, folderPath: string) => {
    if (!folderPath) return { success: false, error: 'Path required' };
    try {
        if (!isPathInsideWorkspace(folderPath)) {
            return { success: false, error: '非法路径' };
        }
        if (!fs.existsSync(folderPath)) {
            return { success: false, error: '文件夹不存在' };
        }
        const stats = fs.statSync(folderPath);
        if (!stats.isDirectory()) {
            return { success: false, error: '不是文件夹' };
        }

        const entries = fs.readdirSync(folderPath, { withFileTypes: true });
        const extraEntries = entries
            .filter((entry) => {
                if (entry.name.startsWith('.')) return true;
                return entry.isFile() && !entry.name.endsWith('.md');
            })
            .map((entry) => entry.name);

        return { success: true, entries: extraEntries };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle(
    'folder:delete',
    async (
        _event: IpcMainInvokeEvent,
        payload: string | { folderPath: string; recursive?: boolean }
    ) => {
        const folderPath = typeof payload === 'string' ? payload : payload?.folderPath;
        const recursive = typeof payload === 'string' ? false : payload?.recursive === true;
        if (!folderPath) return { success: false, error: 'Path required' };

        try {
            if (!isPathInsideWorkspace(folderPath)) {
                return { success: false, error: '非法路径' };
            }
            if (!fs.existsSync(folderPath)) {
                return { success: true }; // 已经不存在
            }

            const stats = fs.statSync(folderPath);
            if (!stats.isDirectory()) {
                return { success: false, error: '不是文件夹' };
            }

            if (recursive) {
                try {
                    await shell.trashItem(folderPath);
                    return { success: true };
                } catch {
                    fs.rmSync(folderPath, { recursive: true, force: true });
                    return { success: true };
                }
            }

            // 检查是否为空文件夹
            const contents = fs.readdirSync(folderPath);
            if (contents.length > 0) {
                return { success: false, error: '文件夹不为空，请先移出或删除其中的文件' };
            }

            fs.rmdirSync(folderPath);
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }
);

ipcMain.handle('shell:openExternal', async (_event: IpcMainInvokeEvent, url: string) => {
    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
        await shell.openExternal(url);
    }
});

// 更新相关
ipcMain.handle('update:openReleases', () => {
    openReleasesPage();
});


// 创建应用菜单
function createMenu() {
    const template: Electron.MenuItemConstructorOptions[] = [
        {
            label: 'WeMD',
            submenu: [
                { role: 'about', label: '关于 WeMD' },
                { type: 'separator' },
                { role: 'hide', label: '隐藏 WeMD' },
                { role: 'hideOthers', label: '隐藏其他' },
                { role: 'unhide', label: '显示全部' },
                { type: 'separator' },
                { role: 'quit', label: '退出 WeMD' },
            ],
        },
        {
            label: '文件',
            submenu: [
                {
                    label: '新建文章',
                    accelerator: 'CmdOrCtrl+N',
                    click: () => mainWindow && mainWindow.webContents.send('menu:new-file')
                },
                { type: 'separator' },
                {
                    label: '保存',
                    accelerator: 'CmdOrCtrl+S',
                    click: () => mainWindow && mainWindow.webContents.send('menu:save')
                },
                { type: 'separator' },
                {
                    label: '切换工作区...',
                    click: async () => {
                        mainWindow && mainWindow.webContents.send('menu:switch-workspace');
                    }
                }
            ],
        },
        {
            label: '编辑',
            submenu: [
                { role: 'undo', label: '撤销' },
                { role: 'redo', label: '重做' },
                { type: 'separator' },
                { role: 'cut', label: '剪切' },
                { role: 'copy', label: '复制' },
                { role: 'paste', label: '粘贴' },
                { role: 'selectAll', label: '全选' },
            ],
        },
        {
            label: '查看',
            submenu: [
                { role: 'reload', label: '重新加载' },
                { role: 'forceReload', label: '强制重新加载' },
                { role: 'toggleDevTools', label: '开发者工具' },
                { type: 'separator' },
                { role: 'resetZoom', label: '实际大小' },
                { role: 'zoomIn', label: '放大' },
                { role: 'zoomOut', label: '缩小' },
                { type: 'separator' },
                { role: 'togglefullscreen', label: '全屏' },
            ],
        },
        {
            label: '窗口',
            submenu: [
                { role: 'minimize', label: '最小化' },
                { role: 'zoom', label: '缩放' },
                { type: 'separator' },
                { role: 'front', label: '前置全部窗口' },
            ],
        },
        {
            label: '帮助',
            submenu: [
                {
                    label: '检查更新...',
                    click: () => checkForUpdates(mainWindow, true),
                },
                { type: 'separator' },
                {
                    label: '访问官网',
                    click: () => shell.openExternal('https://wemd.app'),
                },
                {
                    label: 'GitHub 仓库',
                    click: () => shell.openExternal('https://github.com/tenngoxars/WeMD'),
                },
            ],
        },
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

app.whenReady().then(() => {
    // macOS 会自动使用 app bundle 中的 icon.icns 作为 dock 图标
    createWindow();
    createMenu();

    // 延迟 3 秒检查更新，避免阻塞启动
    setTimeout(() => {
        checkForUpdates(mainWindow);
    }, 3000);

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
