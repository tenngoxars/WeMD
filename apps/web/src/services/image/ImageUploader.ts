/**
 * 图床上传接口
 */

export interface ImageUploader {
  /** 图床名称 */
  name: string;

  /** 上传图片 */
  upload(file: File): Promise<string>;

  /** 配置图床（可选） */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  configure?(config: any): void;

  /** 验证配置（可选） */
  validate?(): Promise<boolean>;
}

/**
 * 图床配置
 */
export interface ImageHostConfig {
  type: "official" | "qiniu" | "aliyun" | "tencent" | "s3" | "wechat";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  config?: any;
}

/**
 * 图床管理器
 * 使用动态导入实现按需加载，减少首屏加载体积
 */
export class ImageHostManager {
  private uploaderPromise: Promise<ImageUploader>;
  private config: ImageHostConfig;
  /** validate() 失败时 uploader 提供的具体原因（若该图床支持，如微信图床） */
  lastError?: string;

  constructor(config: ImageHostConfig) {
    this.config = config;
    this.uploaderPromise = this.createUploader(config);
  }

  /**
   * 动态加载对应的图床上传器
   * 只有在用户选择特定图床时才会加载对应的 SDK
   */
  private async createUploader(
    config: ImageHostConfig,
  ): Promise<ImageUploader> {
    switch (config.type) {
      case "official": {
        const { OfficialUploader } = await import(
          "./uploaders/OfficialUploader"
        );
        return new OfficialUploader(config.config);
      }
      case "qiniu": {
        const { QiniuUploader } = await import("./uploaders/QiniuUploader");
        return new QiniuUploader(config.config);
      }
      case "aliyun": {
        const { AliyunUploader } = await import("./uploaders/AliyunUploader");
        return new AliyunUploader(config.config);
      }
      case "tencent": {
        const { TencentUploader } = await import("./uploaders/TencentUploader");
        return new TencentUploader(config.config);
      }
      case "s3": {
        const { S3Uploader } = await import("./uploaders/S3Uploader");
        return new S3Uploader(config.config);
      }
      case "wechat": {
        const { WechatUploader } = await import("./uploaders/WechatUploader");
        return new WechatUploader(config.config);
      }
      default: {
        const { OfficialUploader } = await import(
          "./uploaders/OfficialUploader"
        );
        return new OfficialUploader(config.config);
      }
    }
  }

  async upload(file: File): Promise<string> {
    // 统一检查文件大小（最大 10MB）
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      throw new Error("图片大小不能超过 10MB");
    }
    const uploader = await this.uploaderPromise;
    return await uploader.upload(file);
  }

  async validate(): Promise<boolean> {
    const uploader = await this.uploaderPromise;
    this.lastError = undefined;
    if (uploader.validate) {
      const valid = await uploader.validate();
      if (!valid) {
        this.lastError = (uploader as { lastError?: string }).lastError;
      }
      return valid;
    }
    return true;
  }
}
