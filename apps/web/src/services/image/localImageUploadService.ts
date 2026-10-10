import {
  isLocalImageSrc,
  resolveLocalImagePath,
} from "../../utils/localImageResolver";
import { uploadEditorImage } from "./imageUploadFlow";

// 匹配 markdown 图片语法：![alt](src)、![alt](src "title")、![alt](<src>)
// 分组：1=![alt](  2=尖括号 src  3=普通 src  4=可选 title  5=)
const IMAGE_PATTERN =
  /(!\[[^\]]*\]\()\s*(?:<([^>\n]+)>|([^\s)]+))((?:\s+(?:"[^"\n]*"|'[^'\n]*'|\([^)\n]*\)))?)(\))/g;

export interface LocalImageRef {
  fullMatch: string;
  src: string;
  absPath: string;
  // 同一文件在文中出现过的所有 src 写法
  srcs: string[];
}

export interface LocalImageUploadFailure {
  src: string;
  reason: string;
}

export interface UploadLocalImagesResult {
  markdown: string;
  uploaded: number;
  failed: LocalImageUploadFailure[];
}

export interface UploadLocalImagesDeps {
  readImage?: (absPath: string) => Promise<{
    success: boolean;
    data?: string;
    mime?: string;
    error?: string;
  }>;
  upload?: (file: File) => Promise<string>;
  onProgress?: (done: number, total: number) => void;
}

// 扫描 markdown 中的本地图片引用，按解析后的绝对路径去重
export function collectLocalImageRefs(
  markdown: string,
  baseDir: string,
): LocalImageRef[] {
  const refs: LocalImageRef[] = [];
  const byPath = new Map<string, LocalImageRef>();
  const pattern = new RegExp(IMAGE_PATTERN.source, "g");

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(markdown)) !== null) {
    const src = (match[2] ?? match[3] ?? "").trim();
    if (!src || !isLocalImageSrc(src)) continue;

    const absPath = resolveLocalImagePath(src, baseDir);
    const existing = byPath.get(absPath);
    if (existing) {
      if (!existing.srcs.includes(src)) existing.srcs.push(src);
      continue;
    }

    const ref: LocalImageRef = {
      fullMatch: match[0],
      src,
      absPath,
      srcs: [src],
    };
    byPath.set(absPath, ref);
    refs.push(ref);
  }

  return refs;
}

// base64 → File，逐字节拷贝避免大数组展开导致栈溢出
export function base64ToFile(
  base64: string,
  filename: string,
  mime: string,
): File {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new File([bytes], filename, { type: mime });
}

function basenameOf(filePath: string): string {
  const parts = filePath.split(/[\\/]/);
  return parts[parts.length - 1] || "image.png";
}

const defaultReadImage: NonNullable<UploadLocalImagesDeps["readImage"]> = (
  absPath,
) => {
  const electron = typeof window !== "undefined" ? window.electron : undefined;
  if (!electron?.fs?.readImage) {
    return Promise.resolve({
      success: false,
      error: "当前环境不支持读取本地图片",
    });
  }
  return electron.fs.readImage(absPath);
};

const defaultUpload: NonNullable<UploadLocalImagesDeps["upload"]> = async (
  file,
) => {
  const result = await uploadEditorImage(file);
  return result.url;
};

// 把 markdown 里所有本地图片上传到图床，并把 src 替换为在线链接
export async function uploadLocalImagesInMarkdown(
  markdown: string,
  baseDir: string,
  deps: UploadLocalImagesDeps = {},
): Promise<UploadLocalImagesResult> {
  const readImage = deps.readImage ?? defaultReadImage;
  const upload = deps.upload ?? defaultUpload;

  const refs = collectLocalImageRefs(markdown, baseDir);
  if (refs.length === 0) {
    return { markdown, uploaded: 0, failed: [] };
  }

  const urlByPath = new Map<string, string>();
  const failed: LocalImageUploadFailure[] = [];
  let done = 0;

  for (const ref of refs) {
    try {
      const res = await readImage(ref.absPath);
      if (!res.success || !res.data) {
        throw new Error(res.error || "读取图片失败");
      }
      const file = base64ToFile(
        res.data,
        basenameOf(ref.absPath),
        res.mime || "image/png",
      );
      const url = await upload(file);
      urlByPath.set(ref.absPath, url);
    } catch (error) {
      failed.push({
        src: ref.src,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
    done += 1;
    deps.onProgress?.(done, refs.length);
  }

  if (urlByPath.size === 0) {
    return { markdown, uploaded: 0, failed };
  }

  // 按 collect 时记录的 src 原文替换，同一 src 多处引用一并替换
  const urlBySrc = new Map<string, string>();
  for (const ref of refs) {
    const url = urlByPath.get(ref.absPath);
    if (!url) continue;
    for (const src of ref.srcs) {
      urlBySrc.set(src, url);
    }
  }

  const nextMarkdown = markdown.replace(
    new RegExp(IMAGE_PATTERN.source, "g"),
    (
      full: string,
      open: string,
      angleSrc: string | undefined,
      plainSrc: string | undefined,
      title: string | undefined,
      close: string,
    ) => {
      const src = (angleSrc ?? plainSrc ?? "").trim();
      const url = urlBySrc.get(src);
      if (!url) return full;
      return `${open}${url}${title ?? ""}${close}`;
    },
  );

  return { markdown: nextMarkdown, uploaded: urlByPath.size, failed };
}
