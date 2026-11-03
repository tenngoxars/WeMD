import { BrowserWindow, ipcMain } from "electron";
import { checkForUpdates, openReleasesPage } from "../updater";

export function registerUpdateHandlers(): void {
  ipcMain.handle("update:openReleases", () => {
    openReleasesPage();
  });
  // 用 handle 而不是 on：渲染进程可以等到检查结束，按钮据此停止转动
  ipcMain.handle("update:check", (event) =>
    checkForUpdates(BrowserWindow.fromWebContents(event.sender), true),
  );
}
