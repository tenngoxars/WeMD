import type { ImageUploader } from "../ImageUploader";

interface OfficialConfig {
  serverUrl?: string;
}

/**
 * 官方图床（通过 Cloudflare Worker 上传到 R2）
 */
export class OfficialUploader implements ImageUploader {
  name = "官方图床";
  private serverUrl: string;

  constructor(config?: OfficialConfig) {
    // 默认使用 Cloudflare Worker API
    this.serverUrl = config?.serverUrl || "https://api.wemd.app";
  }

  configure(config: OfficialConfig) {
    if (config.serverUrl) {
      this.serverUrl = config.serverUrl;
    }
  }

  async upload(file: File): Promise<string> {
    const formData = new FormData();
    formData.append("file", file);

    // 官方图床只对网页版域名放行跨域，桌面端改由原生层发请求
    const request = window.electron?.net?.fetch ?? fetch;
    const response = await request(`${this.serverUrl}/upload`, {
      method: "POST",
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `上传失败: ${response.statusText}`);
    }

    if (!data.url) {
      throw new Error("服务器未返回图片地址");
    }

    return data.url;
  }
}
