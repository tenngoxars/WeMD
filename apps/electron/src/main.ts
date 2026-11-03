import { app, BrowserWindow } from "electron";
import { createMenu } from "./menu";
import { registerIpcHandlers } from "./ipc";
import { checkForUpdates } from "./updater";
import { configureAppIdentity, createWindow } from "./window";
import { stopWatching } from "./watch/workspaceWatcher";
import { configureSingleInstance } from "./singleInstance";
import { exportOnClose, exportSettings } from "./migration/exportSettings";

const isDev =
  !app.isPackaged ||
  process.argv.includes("--dev") ||
  !!process.env.ELECTRON_START_URL;

configureAppIdentity();

let mainWindow: BrowserWindow | null = null;
// 退出触发的 close 被导出拦下会取消本次退出，导出完成后需补一次 quit
let quitting = false;
app.on("before-quit", () => {
  quitting = true;
});

const getMainWindow = () => mainWindow;

function openMainWindow(): BrowserWindow {
  mainWindow = createWindow({
    isDev,
    onClosed: () => {
      mainWindow = null;
      stopWatching();
    },
  });
  const contents = mainWindow.webContents;
  const exportNow = () => exportSettings(contents, app.getPath("userData"));
  contents.on("did-finish-load", () => void exportNow());
  exportOnClose(mainWindow, exportNow, () => {
    if (quitting) app.quit();
  });
  return mainWindow;
}

const isPrimaryInstance = configureSingleInstance(
  {
    requestSingleInstanceLock: () => app.requestSingleInstanceLock(),
    quit: () => app.quit(),
    onSecondInstance: (listener) => {
      app.on("second-instance", () => {
        // 第二实例可能早于 ready 事件抵达，统一排到窗口生命周期可用后处理。
        void app.whenReady().then(listener);
      });
    },
  },
  getMainWindow,
  openMainWindow,
);

if (isPrimaryInstance) {
  registerIpcHandlers(getMainWindow);

  app.whenReady().then(() => {
    openMainWindow();
    createMenu(getMainWindow);

    setTimeout(() => {
      checkForUpdates(mainWindow);
    }, 3000);

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        openMainWindow();
      }
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });
}
