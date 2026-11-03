import { BrowserWindow, ipcMain } from "electron";
import { checkForUpdates, openReleasesPage } from "../updater";

export function registerUpdateHandlers(): void {
  ipcMain.handle("update:openReleases", () => {
    openReleasesPage();
  });
  ipcMain.on("update:check", (event) => {
    checkForUpdates(BrowserWindow.fromWebContents(event.sender), true);
  });
}
