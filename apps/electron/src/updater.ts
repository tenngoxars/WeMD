import { app, shell, BrowserWindow } from 'electron';

const GITHUB_REPO = 'tenngoxars/WeMD';
const RELEASES_URL = `https://github.com/${GITHUB_REPO}/releases`;
const API_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

export interface UpdateInfo {
    latestVersion: string;
    currentVersion: string;
    releaseUrl: string;
    releaseNotes: string;
}

/**
 * 检查 GitHub Releases 是否有新版本
 * @param mainWindow 主窗口
 * @param force 是否强制检查（忽略跳过的版本）
 */
export async function checkForUpdates(
    mainWindow: BrowserWindow | null,
    force: boolean = false
): Promise<void> {
    try {
        const response = await fetch(API_URL, {
            headers: { 'User-Agent': 'WeMD-Electron' }
        });
        if (!response.ok) return;

        const data = await response.json();
        const latestVersion = data.tag_name?.replace(/^v/, '');
        const currentVersion = app.getVersion();
        const releaseNotes = data.body || '';

        if (latestVersion && isNewerVersion(latestVersion, currentVersion)) {
            // 发送 IPC 消息到渲染进程
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('update:available', {
                    latestVersion,
                    currentVersion,
                    releaseUrl: RELEASES_URL,
                    releaseNotes,
                    force, // 是否为手动检查（强制显示）
                });
            }
        } else if (force && mainWindow && !mainWindow.isDestroyed()) {
            // 手动检查但没有新版本，通知用户
            mainWindow.webContents.send('update:upToDate', {
                currentVersion,
            });
        }
    } catch (error) {
        console.error('Update check failed:', error);
        if (force && mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('update:error');
        }
    }
}

/**
 * 比较版本号，判断 latest 是否比 current 新
 */
function isNewerVersion(latest: string, current: string): boolean {
    const latestParts = latest.split('.').map(Number);
    const currentParts = current.split('.').map(Number);
    for (let i = 0; i < 3; i++) {
        if ((latestParts[i] || 0) > (currentParts[i] || 0)) return true;
        if ((latestParts[i] || 0) < (currentParts[i] || 0)) return false;
    }
    return false;
}

/**
 * 打开 Releases 页面（供渲染进程调用）
 */
export function openReleasesPage(): void {
    shell.openExternal(RELEASES_URL);
}
