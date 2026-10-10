import type { IpcMainInvokeEvent } from "electron";
import { ipcMain } from "electron";
import * as fs from "fs";
import * as path from "path";
import { isPathInsideWorkspace } from "../workspace/state";
import {
  IMAGE_EXTENSIONS,
  IMAGE_MIME_TYPES,
} from "../protocol/localImagePolicy";

const MAX_IMAGE_SIZE_BYTES = 20 * 1024 * 1024;

export function registerImageHandlers(): void {
  ipcMain.handle(
    "file:read-image",
    async (_event: IpcMainInvokeEvent, filePath: string) => {
      try {
        if (typeof filePath !== "string" || !filePath) {
          return { success: false, error: "非法路径" };
        }
        if (!isPathInsideWorkspace(filePath)) {
          return { success: false, error: "非法路径" };
        }
        const extension = path.extname(filePath).slice(1).toLowerCase();
        if (!IMAGE_EXTENSIONS.has(extension)) {
          return { success: false, error: "不支持的图片格式" };
        }
        if (!fs.existsSync(filePath)) {
          return { success: false, error: "File not found" };
        }
        const stat = fs.statSync(filePath);
        if (stat.size > MAX_IMAGE_SIZE_BYTES) {
          return { success: false, error: "图片大小超过 20MB 限制" };
        }
        const data = fs.readFileSync(filePath).toString("base64");
        return {
          success: true,
          data,
          mime: IMAGE_MIME_TYPES[extension] ?? "application/octet-stream",
        };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
  );
}
