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
});
