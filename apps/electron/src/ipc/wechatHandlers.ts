import type { IpcMainInvokeEvent } from "electron";
import { ipcMain } from "electron";
import {
  getAccessToken,
  uploadImageToWechat,
  type WechatUploadPayload,
} from "../wechat/wechatApi";

export function registerWechatHandlers(): void {
  ipcMain.handle(
    "wechat:uploadimg",
    async (_event: IpcMainInvokeEvent, payload: WechatUploadPayload) => {
      try {
        const url = await uploadImageToWechat(payload);
        return { success: true, url };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
  );

  ipcMain.handle(
    "wechat:token-test",
    async (
      _event: IpcMainInvokeEvent,
      payload: { appid: string; secret: string },
    ) => {
      try {
        await getAccessToken(payload.appid, payload.secret);
        return { success: true };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
  );
}
