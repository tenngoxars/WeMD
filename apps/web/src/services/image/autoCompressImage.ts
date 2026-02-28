/**
 * 图片自动压缩入口
 * 当图片超过体积限制时自动压缩，供工具栏上传和编辑器粘贴共用
 */
import {
  type LoadedImage,
  type RenderBlobInput,
  type ImageCompressionDependencies,
  type CompressionOptions,
  searchCompressedBlob,
  clampQuality,
  clampScale,
} from "./compressSearch";

export type { ImageCompressionDependencies } from "./compressSearch";

export const WECHAT_IMAGE_MAX_SIZE_BYTES = 2 * 1024 * 1024;

const SUPPORTED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

const DEFAULT_MAX_INPUT_BYTES = 40 * 1024 * 1024;
const DEFAULT_MAX_INPUT_PIXELS = 36_000_000;

export interface PrepareImageForUploadOptions {
  maxSizeBytes?: number;
  minQuality?: number;
  maxQuality?: number;
  minScale?: number;
  scaleSearchSteps?: number;
  qualitySearchSteps?: number;
  maxEncodeAttempts?: number;
  maxInputBytes?: number;
  maxInputPixels?: number;
  scaleFactors?: number[];
}

export interface PreparedImageForUploadResult {
  file: File;
  originalSize: number;
  finalSize: number;
  compressed: boolean;
}

interface ResolvedOptions extends CompressionOptions {
  maxInputBytes: number;
  maxInputPixels: number;
}

const DEFAULT_OPTIONS: Required<PrepareImageForUploadOptions> = {
  maxSizeBytes: WECHAT_IMAGE_MAX_SIZE_BYTES,
  minQuality: 0.45,
  maxQuality: 0.92,
  minScale: 0.3,
  scaleSearchSteps: 3,
  qualitySearchSteps: 3,
  maxEncodeAttempts: 10,
  maxInputBytes: DEFAULT_MAX_INPUT_BYTES,
  maxInputPixels: DEFAULT_MAX_INPUT_PIXELS,
  scaleFactors: [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.42],
};

const defaultDependencies: ImageCompressionDependencies = {
  loadImage: loadImageFromFile,
  renderToBlob: renderImageToBlob,
};

export function formatImageSize(sizeInBytes: number): string {
  return `${(sizeInBytes / 1024 / 1024).toFixed(1)}MB`;
}

export async function prepareImageForUpload(
  file: File,
  options: PrepareImageForUploadOptions = {},
  dependencies: ImageCompressionDependencies = defaultDependencies,
): Promise<PreparedImageForUploadResult> {
  const opts = resolveOptions(options);

  if (file.size <= opts.maxSizeBytes) {
    return {
      file,
      originalSize: file.size,
      finalSize: file.size,
      compressed: false,
    };
  }

  if (file.size > opts.maxInputBytes) {
    throw new Error("图片体积过大，暂不支持自动压缩，请先手动处理后重试");
  }

  if (!isSupportedForAutoCompress(file.type)) {
    throw new Error("该图片格式暂不支持自动压缩，请手动压缩后重试");
  }

  const loadedImage = await dependencies.loadImage(file);
  if (loadedImage.width * loadedImage.height > opts.maxInputPixels) {
    throw new Error("图片分辨率过高，暂不支持自动压缩，请先手动处理后重试");
  }

  // PNG 无损格式不支持 quality 参数，超限时转为 JPEG 压缩效果更好
  const compressMime = file.type === "image/png" ? "image/jpeg" : file.type;

  const compressedBlob = await searchCompressedBlob(
    loadedImage,
    file.size,
    compressMime,
    opts,
    dependencies,
  );

  if (!compressedBlob || compressedBlob.size > opts.maxSizeBytes) {
    throw new Error("自动压缩后仍超过 2MB，请手动压缩后重试");
  }

  const compressedFile = toCompressedFile(file, compressedBlob);
  return {
    file: compressedFile,
    originalSize: file.size,
    finalSize: compressedFile.size,
    compressed: true,
  };
}

function resolveOptions(
  options: PrepareImageForUploadOptions,
): ResolvedOptions {
  const merged = { ...DEFAULT_OPTIONS, ...options };

  if (merged.maxQuality < merged.minQuality) {
    const value = clampQuality(merged.minQuality);
    merged.minQuality = value;
    merged.maxQuality = value;
  }

  return {
    maxSizeBytes: merged.maxSizeBytes,
    minQuality: clampQuality(merged.minQuality),
    maxQuality: clampQuality(merged.maxQuality),
    minScale: clampScale(merged.minScale, 0.1),
    scaleSearchSteps: Math.max(1, Math.floor(merged.scaleSearchSteps)),
    qualitySearchSteps: Math.max(1, Math.floor(merged.qualitySearchSteps)),
    maxEncodeAttempts: Math.max(1, Math.floor(merged.maxEncodeAttempts)),
    scaleFactors: merged.scaleFactors,
    maxInputBytes: Math.max(merged.maxSizeBytes, merged.maxInputBytes),
    maxInputPixels: Math.max(1, Math.floor(merged.maxInputPixels)),
  };
}

async function loadImageFromFile(file: File): Promise<LoadedImage> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("图片解析失败，请重试"));
      element.src = objectUrl;
    });
    return {
      image,
      width: image.naturalWidth || image.width,
      height: image.naturalHeight || image.height,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function renderImageToBlob(input: RenderBlobInput): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = input.width;
  canvas.height = input.height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("当前浏览器不支持自动压缩，请手动压缩后重试");
  }
  context.drawImage(input.image, 0, 0, input.width, input.height);
  return await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(
      (blob) => resolve(blob),
      input.mimeType,
      clampQuality(input.quality),
    );
  });
}

function toCompressedFile(originalFile: File, blob: Blob): File {
  const outputType = blob.type || originalFile.type || "image/jpeg";
  const extension = extensionByMimeType(outputType);
  const baseName = originalFile.name.replace(/\.[^/.]+$/, "");
  const fileName = extension ? `${baseName}.${extension}` : originalFile.name;
  return new File([blob], fileName, {
    type: outputType,
    lastModified: Date.now(),
  });
}

function extensionByMimeType(mimeType: string): string | null {
  switch (mimeType) {
    case "image/jpeg":
    case "image/jpg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return null;
  }
}

function isSupportedForAutoCompress(mimeType: string): boolean {
  return SUPPORTED_MIME_TYPES.has(mimeType.toLowerCase());
}
