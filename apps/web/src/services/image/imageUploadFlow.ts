import { ImageHostManager, type ImageHostConfig } from "./ImageUploader";
import {
  type ImageCompressionDependencies,
  type PrepareImageForUploadOptions,
  prepareImageForUpload,
} from "./autoCompressImage";

export interface UploadEditorImageOptions {
  compressionOptions?: PrepareImageForUploadOptions;
  compressionDependencies?: ImageCompressionDependencies;
  getImageHostConfig?: () => ImageHostConfig;
  createManager?: (config: ImageHostConfig) => {
    upload: (file: File) => Promise<string>;
  };
}

export interface UploadEditorImageResult {
  url: string;
  sourceFile: File;
  uploadedFile: File;
  compressed: boolean;
  originalSize: number;
  finalSize: number;
}

export function getStoredImageHostConfig(): ImageHostConfig {
  const configStr = localStorage.getItem("imageHostConfig");
  if (!configStr) {
    return { type: "official" };
  }

  try {
    return JSON.parse(configStr) as ImageHostConfig;
  } catch {
    return { type: "official" };
  }
}

export async function uploadEditorImage(
  sourceFile: File,
  options: UploadEditorImageOptions = {},
): Promise<UploadEditorImageResult> {
  const prepared = await prepareImageForUpload(
    sourceFile,
    options.compressionOptions,
    options.compressionDependencies,
  );

  const config = options.getImageHostConfig
    ? options.getImageHostConfig()
    : getStoredImageHostConfig();
  const manager = options.createManager
    ? options.createManager(config)
    : new ImageHostManager(config);
  const url = await manager.upload(prepared.file);

  return {
    url,
    sourceFile,
    uploadedFile: prepared.file,
    compressed: prepared.compressed,
    originalSize: prepared.originalSize,
    finalSize: prepared.finalSize,
  };
}
