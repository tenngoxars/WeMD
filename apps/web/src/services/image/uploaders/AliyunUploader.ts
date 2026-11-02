import OSS from "tiny-oss";
import type { ImageUploader } from "../ImageUploader";

interface AliyunConfig {
  region: string;
  bucket: string;
  accessKeyId: string;
  accessKeySecret: string;
  useSSL?: boolean;
  cdnHost?: string;
  path?: string;
}

/**
 * 阿里云 OSS 图床
 * 官网：https://www.aliyun.com/product/oss
 */
export class AliyunUploader implements ImageUploader {
  name = "阿里云 OSS";
  private config: AliyunConfig;

  constructor(config: AliyunConfig) {
    this.config = config;
  }

  configure(config: AliyunConfig) {
    this.config = config;
  }

  async validate(): Promise<boolean> {
    try {
      if (
        !this.config.region ||
        !this.config.bucket ||
        !this.config.accessKeyId ||
        !this.config.accessKeySecret
      ) {
        return false;
      }

      const client = new OSS({
        region: this.config.region,
        bucket: this.config.bucket,
        accessKeyId: this.config.accessKeyId,
        accessKeySecret: this.config.accessKeySecret,
        secure: this.config.useSSL !== false,
      });

      // 尝试上传一个测试文件来验证配置
      const testKey = `_test_${Date.now()}.txt`;
      await client.put(testKey, new Blob(["test"]));
      return true;
    } catch {
      return false;
    }
  }

  async upload(file: File): Promise<string> {
    const dateFilename = `${Date.now()}_${file.name}`;
    const dir = this.config.path
      ? `${this.config.path}/${dateFilename}`
      : dateFilename;
    const secure = this.config.useSSL !== false;
    const protocol = secure ? "https" : "http";

    const client = new OSS({
      region: this.config.region,
      bucket: this.config.bucket,
      accessKeyId: this.config.accessKeyId,
      accessKeySecret: this.config.accessKeySecret,
      secure,
    });

    try {
      await client.put(dir, file);
      return this.config.cdnHost
        ? `${this.config.cdnHost}/${dir}`
        : `${protocol}://${this.config.bucket}.${this.config.region}.aliyuncs.com/${dir}`;
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      throw new Error(`上传失败: ${message}`);
    }
  }
}
