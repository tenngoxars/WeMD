// 工作区本地图片的共享策略：扩展名白名单、MIME 映射与 wemd-file:// URL 解析。
// 该模块不依赖 electron，方便用 node --test 直接测试。

export const LOCAL_FILE_SCHEME = "wemd-file";

export const IMAGE_EXTENSIONS: ReadonlySet<string> = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "bmp",
  "svg",
  "avif",
]);

export const IMAGE_MIME_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
  svg: "image/svg+xml",
  avif: "image/avif",
};

export type ResolveProtocolPathResult =
  | { ok: true; absolutePath: string }
  | { ok: false; status: number; error: string };

// 从 wemd-file://local/<encodeURIComponent(绝对路径)> 解析出绝对路径并校验。
// isInside 由调用方注入（主进程传 isPathInsideWorkspace），便于测试。
export function resolveProtocolPath(
  requestUrl: string,
  isInside: (targetPath: string) => boolean,
  allowedExtensions: ReadonlySet<string> = IMAGE_EXTENSIONS,
): ResolveProtocolPathResult {
  let parsed: URL;
  try {
    parsed = new URL(requestUrl);
  } catch {
    return { ok: false, status: 400, error: "非法 URL" };
  }

  const encoded = parsed.pathname.replace(/^\/+/, "");
  if (!encoded) {
    return { ok: false, status: 400, error: "缺少文件路径" };
  }

  let absolutePath: string;
  try {
    absolutePath = decodeURIComponent(encoded);
  } catch {
    return { ok: false, status: 400, error: "路径解码失败" };
  }

  const extension =
    absolutePath.split(/[\\/]/).pop()?.split(".").pop()?.toLowerCase() ?? "";
  if (!allowedExtensions.has(extension)) {
    return { ok: false, status: 403, error: "不支持的文件类型" };
  }

  if (!isInside(absolutePath)) {
    return { ok: false, status: 403, error: "路径越权" };
  }

  return { ok: true, absolutePath };
}
