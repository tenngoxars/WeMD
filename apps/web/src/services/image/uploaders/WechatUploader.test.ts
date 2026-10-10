import { afterEach, describe, expect, it, vi } from "vitest";
import { WechatUploader } from "./WechatUploader";

function createImageFile(name = "demo.png"): File {
  return new File([new Uint8Array(16)], name, { type: "image/png" });
}

const config = {
  endpoint: "http://localhost:4000/api/wechat/uploadimg",
  appid: "wx-appid",
  secret: "wx-secret",
};

describe("WechatUploader", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete (window as { electron?: unknown }).electron;
  });

  it("上传时携带 file / appid / secret 并返回 url", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ url: "http://mmbiz.qpic.cn/demo/0" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const uploader = new WechatUploader(config);
    const file = createImageFile();
    const url = await uploader.upload(file);

    expect(url).toBe("http://mmbiz.qpic.cn/demo/0");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [endpoint, options] = fetchMock.mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(endpoint).toBe("http://localhost:4000/api/wechat/uploadimg");
    expect(options.method).toBe("POST");

    const body = options.body as FormData;
    expect(body.get("file")).toBeTruthy();
    expect((body.get("file") as File).name).toBe("demo.png");
    expect(body.get("appid")).toBe("wx-appid");
    expect(body.get("secret")).toBe("wx-secret");
  });

  it("未配置 endpoint 时使用默认 /api/wechat/uploadimg", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ url: "http://mmbiz.qpic.cn/demo/1" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const uploader = new WechatUploader({ appid: "a", secret: "s" });
    await uploader.upload(createImageFile());

    expect(fetchMock.mock.calls[0][0]).toBe("/api/wechat/uploadimg");
  });

  it("响应缺少 url 时抛出错误", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
    vi.stubGlobal("fetch", fetchMock);

    const uploader = new WechatUploader(config);
    await expect(uploader.upload(createImageFile())).rejects.toThrow(
      "服务器未返回图片地址",
    );
  });

  it("服务端返回错误时抛出 message", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      statusText: "Bad Request",
      json: () => Promise.resolve({ message: "invalid appid", errcode: 40013 }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const uploader = new WechatUploader(config);
    await expect(uploader.upload(createImageFile())).rejects.toThrow(
      "invalid appid",
    );
  });

  it("缺少 appid/secret 时直接抛出错误", async () => {
    const uploader = new WechatUploader({ appid: "", secret: "" });
    await expect(uploader.upload(createImageFile())).rejects.toThrow(
      "请先填写公众号 AppID 和 AppSecret",
    );
  });

  it("validate 将 endpoint 的 /uploadimg 替换为 /token-test", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    const uploader = new WechatUploader(config);
    const valid = await uploader.validate();

    expect(valid).toBe(true);
    const [endpoint, options] = fetchMock.mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(endpoint).toBe("http://localhost:4000/api/wechat/token-test");
    expect(options.method).toBe("POST");
    expect(JSON.parse(options.body as string)).toEqual({
      appid: "wx-appid",
      secret: "wx-secret",
    });
  });

  it("validate 在凭据缺失或服务不可达时返回 false", async () => {
    const empty = new WechatUploader({ appid: "", secret: "" });
    await expect(empty.validate()).resolves.toBe(false);

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    const uploader = new WechatUploader(config);
    await expect(uploader.validate()).resolves.toBe(false);
  });

  it("validate 失败时 lastError 记录微信返回的错误信息", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      statusText: "Bad Request",
      json: () => Promise.resolve({ message: "invalid appid", errcode: 40013 }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const uploader = new WechatUploader(config);
    const valid = await uploader.validate();

    expect(valid).toBe(false);
    expect(uploader.lastError).toContain("invalid appid");
    expect(uploader.lastError).not.toContain("白名单");
  });

  it("validate 遇到 errcode 40164 时 lastError 附带 IP 白名单引导", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      statusText: "Bad Request",
      json: () =>
        Promise.resolve({
          message: "invalid ip 1.2.3.4, not in whitelist",
          errcode: 40164,
        }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const uploader = new WechatUploader(config);
    const valid = await uploader.validate();

    expect(valid).toBe(false);
    expect(uploader.lastError).toContain("1.2.3.4");
    expect(uploader.lastError).toContain("IP 白名单");
  });

  it("validate 成功后清空 lastError", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        statusText: "Bad Request",
        json: () =>
          Promise.resolve({ message: "invalid appid", errcode: 40013 }),
      })
      .mockResolvedValueOnce({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    const uploader = new WechatUploader(config);
    await expect(uploader.validate()).resolves.toBe(false);
    expect(uploader.lastError).toBeTruthy();

    await expect(uploader.validate()).resolves.toBe(true);
    expect(uploader.lastError).toBeUndefined();
  });

  describe("Electron 直连通道", () => {
    function stubElectronWechat(result: {
      success: boolean;
      url?: string;
      error?: string;
    }) {
      const uploadimg = vi.fn().mockResolvedValue(result);
      const tokenTest = vi
        .fn()
        .mockResolvedValue({ success: result.success, error: result.error });
      (window as { electron?: unknown }).electron = {
        wechat: { uploadimg, tokenTest },
      };
      return { uploadimg, tokenTest };
    }

    it("桌面端 upload 走 IPC，不发 fetch", async () => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      const { uploadimg } = stubElectronWechat({
        success: true,
        url: "http://mmbiz.qpic.cn/demo/0",
      });

      const uploader = new WechatUploader(config);
      const url = await uploader.upload(createImageFile());

      expect(url).toBe("http://mmbiz.qpic.cn/demo/0");
      expect(fetchMock).not.toHaveBeenCalled();
      expect(uploadimg).toHaveBeenCalledTimes(1);

      const payload = uploadimg.mock.calls[0][0] as {
        appid: string;
        secret: string;
        fileBase64: string;
        filename: string;
        mime: string;
      };
      expect(payload.appid).toBe("wx-appid");
      expect(payload.secret).toBe("wx-secret");
      expect(payload.filename).toBe("demo.png");
      expect(payload.mime).toBe("image/png");
      // base64 应能还原为原文件字节
      expect([...atob(payload.fileBase64)].length).toBe(16);
    });

    it("IPC 返回 success:false 时抛出 error", async () => {
      vi.stubGlobal("fetch", vi.fn());
      stubElectronWechat({ success: false, error: "invalid appid" });

      const uploader = new WechatUploader(config);
      await expect(uploader.upload(createImageFile())).rejects.toThrow(
        "invalid appid",
      );
    });

    it("桌面端 validate 走 tokenTest IPC，不发 fetch", async () => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      const { tokenTest } = stubElectronWechat({ success: true });

      const uploader = new WechatUploader(config);
      const valid = await uploader.validate();

      expect(valid).toBe(true);
      expect(fetchMock).not.toHaveBeenCalled();
      expect(tokenTest).toHaveBeenCalledWith({
        appid: "wx-appid",
        secret: "wx-secret",
      });
    });

    it("桌面端 validate 在 tokenTest 失败或 IPC 异常时返回 false", async () => {
      vi.stubGlobal("fetch", vi.fn());
      stubElectronWechat({ success: false });
      const uploader = new WechatUploader(config);
      await expect(uploader.validate()).resolves.toBe(false);

      (window as { electron?: unknown }).electron = {
        wechat: {
          uploadimg: vi.fn(),
          tokenTest: vi.fn().mockRejectedValue(new Error("ipc error")),
        },
      };
      await expect(uploader.validate()).resolves.toBe(false);
    });

    it("桌面端 validate 失败时 lastError 取 IPC 返回的 error", async () => {
      vi.stubGlobal("fetch", vi.fn());
      stubElectronWechat({
        success: false,
        error:
          "获取微信 access_token 失败: invalid ip 1.2.3.4, not in whitelist (errcode: 40164)",
      });

      const uploader = new WechatUploader(config);
      const valid = await uploader.validate();

      expect(valid).toBe(false);
      expect(uploader.lastError).toContain("1.2.3.4");
      expect(uploader.lastError).toContain("IP 白名单");
    });
  });
});
