import * as qiniu from "qiniu-js";
import CryptoJS from "crypto-js";
import type { ImageUploader } from "../ImageUploader";

interface QiniuConfig {
  accessKey: string;
  secretKey: string;
  bucket: string;
  domain: string; // CDN 域名
  region?: string; // 存储区域
}

type QiniuRegion = "z0" | "z1" | "z2" | "na0" | "as0" | "cn-east-2";

/**
 * 七牛云图床
 * 使用官方 SDK：qiniu-js
 */
export class QiniuUploader implements ImageUploader {
  name = "七牛云";
  private config: QiniuConfig;

  constructor(config: QiniuConfig) {
    this.config = config;
  }

  configure(config: QiniuConfig) {
    this.config = config;
  }

  async validate(): Promise<boolean> {
    try {
      // 验证配置是否完整
      if (
        !this.config.accessKey ||
        !this.config.secretKey ||
        !this.config.bucket ||
        !this.config.domain
      ) {
        return false;
      }

      // 尝试上传一个极小的测试文件来验证配置
      const testContent = new Blob(["test"], { type: "text/plain" });
      const testFile = new File([testContent], "test-connection.txt", {
        type: "text/plain",
      });

      const fileName = `validate-${Date.now()}.txt`;
      const token = await this.getUploadToken();

      return new Promise((resolve) => {
        const observable = qiniu.upload(
          testFile,
          fileName,
          token,
          {},
          {
            region: this.getRegion(),
          },
        );

        observable.subscribe({
          next: () => {},
          error: (err) => {
            console.error("验证失败:", err);
            resolve(false);
          },
          complete: () => {
            resolve(true);
          },
        });
      });
    } catch (e) {
      console.error("验证失败:", e);
      return false;
    }
  }

  async upload(file: File): Promise<string> {
    // 生成文件名
    const fileName = `${Date.now()}_${file.name}`;

    // 获取上传 Token
    const token = await this.getUploadToken();

    return new Promise((resolve, reject) => {
      const observable = qiniu.upload(
        file,
        fileName,
        token,
        {},
        {
          region: this.getRegion(),
        },
      );

      observable.subscribe({
        error: (err) => {
          console.error("上传失败:", err);
          reject(new Error(`上传失败: ${err.message}`));
        },
        complete: (res) => {
          // 返回 CDN 地址
          resolve(`${this.config.domain}/${res.key}`);
        },
      });
    });
  }

  private getRegion(): QiniuRegion {
    // 将配置的字符串区域映射到 SDK 的 Region 对象
    const regionMap: Record<string, QiniuRegion> = {
      z0: "z0",
      z1: "z1",
      z2: "z2",
      na0: "na0",
      as0: "as0",
      "cn-east-2": "cn-east-2",
    };

    const region = this.config.region || "z0";
    return regionMap[region] || qiniu.region.z0;
  }

  private async getUploadToken(): Promise<string> {
    // 1. 准备密钥
    const accessKey = this.config.accessKey?.trim();
    const secretKey = this.config.secretKey?.trim();
    const bucket = this.config.bucket?.trim();

    if (!accessKey || !secretKey || !bucket) {
      throw new Error("七牛云配置不完整");
    }

    // 2. 构造上传策略
    const putPolicy = {
      scope: bucket,
      deadline: Math.floor(Date.now() / 1000) + 3600, // 1小时有效期
    };

    // 3. 编码上传策略 (使用 doocs/md 的算法)
    const policy = JSON.stringify(putPolicy);
    const encoded = this.base64encode(this.utf16to8(policy));

    // 4. 生成签名
    const hash = CryptoJS.HmacSHA1(encoded, secretKey);
    const encodedSigned = hash.toString(CryptoJS.enc.Base64);
    const safeEncodedSigned = this.safe64(encodedSigned);

    // 5. 拼接 Token
    return `${accessKey}:${safeEncodedSigned}:${encoded}`;
  }

  // 以下是 doocs/md 的 tokenTools 实现
  private utf16to8(str: string): string {
    let out = "";
    const len = str.length;

    for (let i = 0; i < len; i++) {
      const c = str.charCodeAt(i);

      if (c >= 0x0001 && c <= 0x007f) {
        out += str.charAt(i);
      } else if (c > 0x07ff) {
        out += String.fromCharCode(0xe0 | ((c >> 12) & 0x0f));
        out += String.fromCharCode(0x80 | ((c >> 6) & 0x3f));
        out += String.fromCharCode(0x80 | (c & 0x3f));
      } else {
        out += String.fromCharCode(0xc0 | ((c >> 6) & 0x1f));
        out += String.fromCharCode(0x80 | (c & 0x3f));
      }
    }

    return out;
  }

  private base64encode(str: string): string {
    const base64EncodeChars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    let out = "";
    let i = 0;
    const len = str.length;

    while (i < len) {
      const c1 = str.charCodeAt(i++) & 0xff;

      if (i === len) {
        out += base64EncodeChars.charAt(c1 >> 2);
        out += base64EncodeChars.charAt((c1 & 0x3) << 4);
        out += "==";
        break;
      }

      const c2 = str.charCodeAt(i++);

      if (i === len) {
        out += base64EncodeChars.charAt(c1 >> 2);
        out += base64EncodeChars.charAt(((c1 & 0x3) << 4) | ((c2 & 0xf0) >> 4));
        out += base64EncodeChars.charAt((c2 & 0xf) << 2);
        out += "=";
        break;
      }

      const c3 = str.charCodeAt(i++);

      out += base64EncodeChars.charAt(c1 >> 2);
      out += base64EncodeChars.charAt(((c1 & 0x3) << 4) | ((c2 & 0xf0) >> 4));
      out += base64EncodeChars.charAt(((c2 & 0xf) << 2) | ((c3 & 0xc0) >> 6));
      out += base64EncodeChars.charAt(c3 & 0x3f);
    }

    return out;
  }

  private safe64(base64: string): string {
    return base64.replace(/\+/g, "-").replace(/\//g, "_");
  }
}
