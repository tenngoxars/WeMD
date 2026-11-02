import COS from "cos-js-sdk-v5";
import type { ImageUploader } from "../ImageUploader";

interface TencentConfig {
  secretId: string;
  secretKey: string;
  bucket: string;
  region: string; // 例如：ap-guangzhou
  path?: string;
  cdnHost?: string;
}

/**
 * 腾讯云 COS 图床
 * 官网：https://cloud.tencent.com/product/cos
 */
export class TencentUploader implements ImageUploader {
  name = "腾讯云 COS";
  private config: TencentConfig;

  constructor(config: TencentConfig) {
    this.config = config;
  }

  configure(config: TencentConfig) {
    this.config = config;
  }

  async validate(): Promise<boolean> {
    try {
      if (
        !this.config.secretId ||
        !this.config.secretKey ||
        !this.config.bucket ||
        !this.config.region
      ) {
        return false;
      }

      const cos = new COS({
        SecretId: this.config.secretId,
        SecretKey: this.config.secretKey,
      });

      // 尝试获取 bucket 信息来验证配置
      return new Promise((resolve) => {
        cos.headBucket(
          {
            Bucket: this.config.bucket,
            Region: this.config.region,
          },
          (err) => {
            resolve(!err);
          },
        );
      });
    } catch {
      return false;
    }
  }

  async upload(file: File): Promise<string> {
    const dateFilename = `${Date.now()}_${file.name}`;
    const path = this.config.path || "";
    const key = path ? `${path}/${dateFilename}` : dateFilename;

    const cos = new COS({
      SecretId: this.config.secretId,
      SecretKey: this.config.secretKey,
    });

    return new Promise((resolve, reject) => {
      cos.putObject(
        {
          Bucket: this.config.bucket,
          Region: this.config.region,
          Key: key,
          Body: file,
        },
        (err, data) => {
          if (err) {
            reject(new Error(`上传失败: ${err.message || err}`));
          } else if (this.config.cdnHost) {
            resolve(
              path === ""
                ? `${this.config.cdnHost}/${dateFilename}`
                : `${this.config.cdnHost}/${path}/${dateFilename}`,
            );
          } else {
            resolve(`https://${data.Location}`);
          }
        },
      );
    });
  }
}
