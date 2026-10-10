import type { ImageUploader } from "../ImageUploader";

interface WechatConfig {
  endpoint?: string;
  appid: string;
  secret: string;
}

const DEFAULT_ENDPOINT = "/api/wechat/uploadimg";

const WHITELIST_ERRCODE = 40164;
const WHITELIST_HINT =
  "请将错误中的 IP 添加到开发者控制台「基本信息 → IP 白名单」（developers.weixin.qq.com/console）后重试";

// 正式公众号有 IP 白名单限制，40164 时 errmsg 带出口 IP，追加引导文案方便用户操作
function withWhitelistHint(message: string, errcode?: number): string {
  if (errcode === WHITELIST_ERRCODE || /not in whitelist/i.test(message)) {
    return `${message}；${WHITELIST_HINT}`;
  }
  return message;
}

// File → base64，分块转换避免大数组展开导致栈溢出
// 用 FileReader 而非 file.arrayBuffer() 以兼容 jsdom 测试环境
async function fileToBase64(file: File): Promise<string> {
  const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
  const bytes = new Uint8Array(buffer);
  const CHUNK_SIZE = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK_SIZE));
  }
  return btoa(binary);
}

/**
 * 微信图床（公众号官方接口）
 * 桌面端（Electron）由主进程直连 api.weixin.qq.com 的 media/uploadimg；
 * 网页版通过自建 server 中转。返回的 url 可直接用于公众号图文
 */
export class WechatUploader implements ImageUploader {
  name = "微信图床";
  /** validate() 失败时的具体原因（含微信返回的 errmsg/errcode），供设置面板展示 */
  lastError?: string;
  private config: WechatConfig;

  constructor(config?: WechatConfig) {
    this.config = config ?? { appid: "", secret: "" };
  }

  configure(config: WechatConfig) {
    this.config = config;
  }

  private get endpoint(): string {
    return this.config.endpoint?.trim() || DEFAULT_ENDPOINT;
  }

  private get electronWechat() {
    if (typeof window === "undefined") return null;
    return window.electron?.wechat ?? null;
  }

  async upload(file: File): Promise<string> {
    if (!this.config.appid?.trim() || !this.config.secret?.trim()) {
      throw new Error("请先填写公众号 AppID 和 AppSecret");
    }

    const appid = this.config.appid.trim();
    const secret = this.config.secret.trim();

    const electron = this.electronWechat;
    if (electron) {
      const result = await electron.uploadimg({
        appid,
        secret,
        fileBase64: await fileToBase64(file),
        filename: file.name || "image.png",
        mime: file.type || "image/png",
      });
      if (!result.success || !result.url) {
        throw new Error(result.error || "上传失败");
      }
      return result.url;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("appid", appid);
    formData.append("secret", secret);

    const response = await fetch(this.endpoint, {
      method: "POST",
      body: formData,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message = Array.isArray(data.message)
        ? data.message.join("；")
        : data.message;
      throw new Error(message || `上传失败: ${response.statusText}`);
    }

    if (!data.url) {
      throw new Error("服务器未返回图片地址");
    }

    return data.url;
  }

  async validate(): Promise<boolean> {
    this.lastError = undefined;

    if (!this.config.appid?.trim() || !this.config.secret?.trim()) {
      this.lastError = "请先填写公众号 AppID 和 AppSecret";
      return false;
    }

    const appid = this.config.appid.trim();
    const secret = this.config.secret.trim();

    const electron = this.electronWechat;
    if (electron) {
      try {
        const result = await electron.tokenTest({ appid, secret });
        if (!result.success) {
          this.lastError = withWhitelistHint(result.error || "未知错误");
        }
        return result.success;
      } catch (e) {
        console.error("验证失败:", e);
        this.lastError = e instanceof Error ? e.message : String(e);
        return false;
      }
    }

    try {
      const testEndpoint = this.endpoint.replace(
        /\/uploadimg\/?$/,
        "/token-test",
      );
      const response = await fetch(testEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appid, secret }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        const rawMessage = Array.isArray(data.message)
          ? data.message.join("；")
          : data.message;
        this.lastError = withWhitelistHint(
          rawMessage || `请求失败: ${response.statusText}`,
          typeof data.errcode === "number" ? data.errcode : undefined,
        );
        return false;
      }
      return true;
    } catch (e) {
      console.error("验证失败:", e);
      this.lastError = e instanceof Error ? e.message : String(e);
      return false;
    }
  }
}
