import type { ImageUploader } from "../ImageUploader";

interface WechatConfig {
  endpoint?: string;
  appid: string;
  secret: string;
}

const DEFAULT_ENDPOINT = "/api/wechat/uploadimg";

/**
 * 微信图床（公众号官方接口）
 * 通过自建 server 中转调用 api.weixin.qq.com 的 media/uploadimg，
 * 返回的 url 可直接用于公众号图文
 */
export class WechatUploader implements ImageUploader {
  name = "微信图床";
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

  async upload(file: File): Promise<string> {
    if (!this.config.appid?.trim() || !this.config.secret?.trim()) {
      throw new Error("请先填写公众号 AppID 和 AppSecret");
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("appid", this.config.appid.trim());
    formData.append("secret", this.config.secret.trim());

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
    if (!this.config.appid?.trim() || !this.config.secret?.trim()) {
      return false;
    }

    try {
      const testEndpoint = this.endpoint.replace(
        /\/uploadimg\/?$/,
        "/token-test",
      );
      const response = await fetch(testEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appid: this.config.appid.trim(),
          secret: this.config.secret.trim(),
        }),
      });
      return response.ok;
    } catch (e) {
      console.error("验证失败:", e);
      return false;
    }
  }
}
