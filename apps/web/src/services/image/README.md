# 图床支持

WeMD 当前内置 5 类图床，均通过 `ImageHostManager` 统一管理。

## 支持的图床

| 图床       | 配置难度 | 说明                                         |
| ---------- | -------- | -------------------------------------------- |
| 官方图床   | ⭐       | 默认可用，开箱即用                           |
| 七牛云     | ⭐⭐⭐   | 适合国内常见对象存储场景                     |
| 阿里云 OSS | ⭐⭐⭐   | 阿里云对象存储                               |
| 腾讯云 COS | ⭐⭐⭐   | 腾讯云对象存储                               |
| S3 兼容    | ⭐⭐⭐⭐ | 兼容 AWS S3 / Cloudflare R2 / MinIO / Spaces |

## 快速开始

### 1. 官方图床（默认）

无需配置，直接可用。

### 2. 七牛云

需要填写：

- `accessKey`
- `secretKey`
- `bucket`
- `domain`
- `region`（可选，默认 `z0`）

### 3. 阿里云 OSS

需要填写：

- `accessKeyId`
- `accessKeySecret`
- `bucket`
- `region`
- `cdnHost`（可选）
- `path`（可选）

### 4. 腾讯云 COS

需要填写：

- `secretId`
- `secretKey`
- `bucket`
- `region`
- `cdnHost`（可选）
- `path`（可选）

### 5. S3 兼容

需要填写：

- `endpoint`
- `region`
- `accessKeyId`
- `secretAccessKey`
- `bucket`
- `pathPrefix`（可选）
- `customDomain`（可选）
- `forcePathStyle`（可选，MinIO 常用）
- `legacyCompatibility`（可选，旧版 S3 兼容服务报 501 时开启）

## 使用示例

```typescript
import { ImageHostManager } from "./services/image/ImageUploader";

const config = JSON.parse(
  localStorage.getItem("imageHostConfig") || '{"type":"official"}',
);

const manager = new ImageHostManager(config);
const url = await manager.upload(file);
```

## 常见问题

### Q: 是否支持 PicGo / PicList？

不直接对接工具本身，但支持 S3 兼容协议。  
如果 PicGo / PicList 配置的是同一套 S3 参数，可与 WeMD 共用同一存储后端。

### Q: 图片上传失败怎么办？

1. 检查图床配置是否完整。
2. 在图床设置面板点击“测试连接”。
3. 检查 Bucket 权限和 CORS 配置。
4. 查看浏览器控制台报错信息。

### Q: 测试连接返回 501 NotImplemented 怎么办？

新版 AWS SDK 会附加一些老版本 S3 兼容服务不认识的请求头（`x-amz-checksum-*`、
`x-amz-user-agent`）和 `x-id` 查询参数，老服务会直接返回 501。
在 S3 面板勾选“兼容旧版 S3”后重试。

背景参考：[S3 default integrity change](https://github.com/aws/aws-sdk-js-v3/issues/6810)（校验和请求头）、
[NotImplemented: search parameter x-id not implemented](https://github.com/aws/aws-sdk-js-v3/issues/5565)（`x-id` 查询参数）。

## 开发指南

### 添加新的图床支持

1. 在 `src/services/image/uploaders/` 新增 uploader。
2. 在 `ImageHostManager` 中注册新的 `type`。
3. 在 `ImageHostSettings` 中补充配置 UI。
