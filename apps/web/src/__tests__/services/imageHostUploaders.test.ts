import { beforeEach, describe, expect, it, vi } from "vitest";

const sdk = vi.hoisted(() => ({
  ossPut: vi.fn(),
  cosPutObject: vi.fn(),
  qiniuUpload: vi.fn(),
}));

vi.mock("tiny-oss", () => ({
  default: class {
    put(key: string, file: File) {
      return sdk.ossPut(key, file);
    }
  },
}));

type CosCallback = (err: null, data: { Location: string }) => void;

vi.mock("cos-js-sdk-v5", () => ({
  default: class {
    putObject(params: unknown, callback: CosCallback) {
      sdk.cosPutObject(params, callback);
    }
  },
}));

vi.mock("qiniu-js", () => ({
  upload: sdk.qiniuUpload,
  region: {
    z0: "z0",
    z1: "z1",
    z2: "z2",
    na0: "na0",
    as0: "as0",
    cnEast2: "cn-east-2",
  },
}));

import { AliyunUploader } from "../../services/image/uploaders/AliyunUploader";
import { TencentUploader } from "../../services/image/uploaders/TencentUploader";
import { QiniuUploader } from "../../services/image/uploaders/QiniuUploader";

const imageFile = () => new File(["x"], "demo.png", { type: "image/png" });

const aliyunBase = {
  region: "oss-cn-hangzhou",
  bucket: "my-bucket",
  accessKeyId: "ak",
  accessKeySecret: "sk",
};

const tencentBase = {
  secretId: "sid",
  secretKey: "skey",
  bucket: "my-bucket-1250000000",
  region: "ap-guangzhou",
};

const qiniuBase = {
  accessKey: "ak",
  secretKey: "sk",
  bucket: "my-bucket",
  domain: "https://cdn.example.com",
};

describe("阿里云 OSS 自定义域名", () => {
  beforeEach(() => {
    sdk.ossPut.mockReset().mockResolvedValue({});
  });

  it("填写自定义域名后用域名拼接图片地址", async () => {
    const uploader = new AliyunUploader({
      ...aliyunBase,
      cdnHost: "https://cdn.example.com",
    });

    await expect(uploader.upload(imageFile())).resolves.toMatch(
      /^https:\/\/cdn\.example\.com\/\d+_demo\.png$/,
    );
  });

  it("兼容旧配置里存在 endpoint 的自定义域名", async () => {
    const uploader = new AliyunUploader({
      ...aliyunBase,
      endpoint: "https://legacy.example.com",
    });

    await expect(uploader.upload(imageFile())).resolves.toMatch(
      /^https:\/\/legacy\.example\.com\/\d+_demo\.png$/,
    );
  });

  it("同时存在新旧字段时以新字段为准", async () => {
    const uploader = new AliyunUploader({
      ...aliyunBase,
      cdnHost: "https://cdn.example.com",
      endpoint: "https://legacy.example.com",
    });

    await expect(uploader.upload(imageFile())).resolves.toMatch(
      /^https:\/\/cdn\.example\.com\//,
    );
  });

  it("不填自定义域名时返回 OSS 默认地址", async () => {
    const uploader = new AliyunUploader({ ...aliyunBase });

    await expect(uploader.upload(imageFile())).resolves.toMatch(
      /^https:\/\/my-bucket\.oss-cn-hangzhou\.aliyuncs\.com\/\d+_demo\.png$/,
    );
  });

  it("自定义域名清空后回到 OSS 默认地址", async () => {
    const uploader = new AliyunUploader({
      ...aliyunBase,
      cdnHost: "",
      endpoint: "https://legacy.example.com",
    });

    await expect(uploader.upload(imageFile())).resolves.toMatch(
      /^https:\/\/my-bucket\.oss-cn-hangzhou\.aliyuncs\.com\//,
    );
  });
});

describe("腾讯云 COS 自定义域名", () => {
  const cosLocation = "my-bucket.cos.ap-guangzhou.myqcloud.com/x.png";

  beforeEach(() => {
    sdk.cosPutObject
      .mockReset()
      .mockImplementation((_params: unknown, callback: CosCallback) =>
        callback(null, { Location: cosLocation }),
      );
  });

  it("填写自定义域名后用域名拼接图片地址", async () => {
    const uploader = new TencentUploader({
      ...tencentBase,
      cdnHost: "https://cdn.example.com",
    });

    await expect(uploader.upload(imageFile())).resolves.toMatch(
      /^https:\/\/cdn\.example\.com\/\d+_demo\.png$/,
    );
  });

  it("兼容旧配置里存在 endpoint 的自定义域名", async () => {
    const uploader = new TencentUploader({
      ...tencentBase,
      endpoint: "https://legacy.example.com",
    });

    await expect(uploader.upload(imageFile())).resolves.toMatch(
      /^https:\/\/legacy\.example\.com\/\d+_demo\.png$/,
    );
  });

  it("不填自定义域名时返回 COS 返回的地址", async () => {
    const uploader = new TencentUploader({ ...tencentBase });

    await expect(uploader.upload(imageFile())).resolves.toBe(
      "https://my-bucket.cos.ap-guangzhou.myqcloud.com/x.png",
    );
  });

  it("配置了目录时自定义域名带目录拼接", async () => {
    const uploader = new TencentUploader({
      ...tencentBase,
      path: "blog",
      cdnHost: "https://cdn.example.com",
    });

    await expect(uploader.upload(imageFile())).resolves.toMatch(
      /^https:\/\/cdn\.example\.com\/blog\/\d+_demo\.png$/,
    );
  });
});

describe("七牛云存储区域映射", () => {
  beforeEach(() => {
    sdk.qiniuUpload.mockReset().mockReturnValue({
      subscribe: ({ complete }: { complete: (res: { key: string }) => void }) =>
        complete({ key: "123_demo.png" }),
    });
  });

  const uploadWithRegion = async (region?: string) => {
    const uploader = new QiniuUploader({ ...qiniuBase, region });
    await uploader.upload(imageFile());
    return sdk.qiniuUpload.mock.calls[0][4] as { region?: string };
  };

  it.each(["z0", "z1", "z2", "na0", "as0", "cn-east-2"])(
    "区域 %s 原样传给 SDK",
    async (region) => {
      expect(await uploadWithRegion(region)).toEqual({ region });
    },
  );

  it("未选择区域时按华东-浙江上传", async () => {
    expect((await uploadWithRegion()).region).toBe("z0");
  });

  it("SDK 不支持的区域不传区域，交由 SDK 识别", async () => {
    expect((await uploadWithRegion("ap-northeast-1")).region).toBeUndefined();
  });

  it("上传完成后返回 CDN 域名拼接的地址", async () => {
    const uploader = new QiniuUploader({ ...qiniuBase, region: "z0" });
    await expect(uploader.upload(imageFile())).resolves.toBe(
      "https://cdn.example.com/123_demo.png",
    );
  });
});
