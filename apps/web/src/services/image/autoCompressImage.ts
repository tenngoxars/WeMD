export const WECHAT_IMAGE_MAX_SIZE_BYTES = 2 * 1024 * 1024;

const SUPPORTED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

const DEFAULT_MAX_INPUT_BYTES = 40 * 1024 * 1024;
const DEFAULT_MAX_INPUT_PIXELS = 36_000_000;
const SCALE_DEDUP_EPSILON = 0.01;
const SCALE_STOP_EPSILON = 0.005;
const QUALITY_STOP_EPSILON = 0.01;

interface LoadedImage {
  image: CanvasImageSource;
  width: number;
  height: number;
}

interface RenderBlobInput {
  image: CanvasImageSource;
  width: number;
  height: number;
  mimeType: string;
  quality: number;
}

interface CompressionCandidate {
  blob: Blob;
  scale: number;
  quality: number;
  size: number;
}

interface CompressionSession {
  cache: Map<string, Blob | null>;
  encodeAttempts: number;
  bestCandidate: CompressionCandidate | null;
  budgetExceeded: boolean;
}

export interface ImageCompressionDependencies {
  loadImage: (file: File) => Promise<LoadedImage>;
  renderToBlob: (input: RenderBlobInput) => Promise<Blob | null>;
}

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
  const mergedOptions = resolveOptions(options);

  if (file.size <= mergedOptions.maxSizeBytes) {
    return {
      file,
      originalSize: file.size,
      finalSize: file.size,
      compressed: false,
    };
  }

  if (file.size > mergedOptions.maxInputBytes) {
    throw new Error("图片体积过大，暂不支持自动压缩，请先手动处理后重试");
  }

  if (!isSupportedForAutoCompress(file.type)) {
    throw new Error("该图片格式暂不支持自动压缩，请手动压缩后重试");
  }

  const loadedImage = await dependencies.loadImage(file);
  const imagePixels = loadedImage.width * loadedImage.height;
  if (imagePixels > mergedOptions.maxInputPixels) {
    throw new Error("图片分辨率过高，暂不支持自动压缩，请先手动处理后重试");
  }

  const compressedBlob = await searchCompressedBlob(
    loadedImage,
    file.size,
    file.type,
    mergedOptions,
    dependencies,
  );

  if (!compressedBlob || compressedBlob.size > mergedOptions.maxSizeBytes) {
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

async function searchCompressedBlob(
  loadedImage: LoadedImage,
  originalFileSize: number,
  mimeType: string,
  options: Required<PrepareImageForUploadOptions>,
  dependencies: ImageCompressionDependencies,
): Promise<Blob | null> {
  const session: CompressionSession = {
    cache: new Map(),
    encodeAttempts: 0,
    bestCandidate: null,
    budgetExceeded: false,
  };

  const fullHigh = await renderCandidate(
    session,
    loadedImage,
    mimeType,
    options,
    dependencies,
    1,
    options.maxQuality,
  );
  if (fullHigh && fullHigh.size <= options.maxSizeBytes) {
    return fullHigh.blob;
  }

  const fullLow = await renderCandidate(
    session,
    loadedImage,
    mimeType,
    options,
    dependencies,
    1,
    options.minQuality,
  );
  if (fullLow && fullLow.size <= options.maxSizeBytes) {
    const improved = await searchBestQualityAtScale(
      session,
      loadedImage,
      mimeType,
      options,
      dependencies,
      1,
    );
    return improved?.blob ?? fullLow.blob;
  }

  const bestScale = await searchBestScale(
    session,
    loadedImage,
    mimeType,
    options,
    dependencies,
    originalFileSize,
  );

  if (bestScale !== null) {
    const bestAtScale = await searchBestQualityAtScale(
      session,
      loadedImage,
      mimeType,
      options,
      dependencies,
      bestScale,
    );

    if (bestAtScale) {
      return bestAtScale.blob;
    }
  }

  return session.bestCandidate?.blob ?? null;
}

async function searchBestScale(
  session: CompressionSession,
  loadedImage: LoadedImage,
  mimeType: string,
  options: Required<PrepareImageForUploadOptions>,
  dependencies: ImageCompressionDependencies,
  originalFileSize: number,
): Promise<number | null> {
  const scaleHints = buildScaleHints(originalFileSize, options);
  let feasibleScale: number | null = null;
  let infeasibleScale = 1;

  for (const hint of scaleHints) {
    if (hint >= 1) continue;
    const candidate = await renderCandidate(
      session,
      loadedImage,
      mimeType,
      options,
      dependencies,
      hint,
      options.minQuality,
    );

    if (session.budgetExceeded) {
      break;
    }

    if (candidate && candidate.size <= options.maxSizeBytes) {
      feasibleScale = hint;
      break;
    }
    infeasibleScale = Math.min(infeasibleScale, hint);
  }

  if (feasibleScale === null) {
    const floorCandidate = await renderCandidate(
      session,
      loadedImage,
      mimeType,
      options,
      dependencies,
      options.minScale,
      options.minQuality,
    );
    if (!floorCandidate || floorCandidate.size > options.maxSizeBytes) {
      return null;
    }
    feasibleScale = options.minScale;
    infeasibleScale = Math.max(infeasibleScale, feasibleScale);
  }

  let low = feasibleScale;
  let high = Math.max(infeasibleScale, low);
  let bestScale = low;

  for (let i = 0; i < options.scaleSearchSteps; i += 1) {
    if (high - low <= SCALE_STOP_EPSILON) {
      break;
    }

    const mid = clampScale((low + high) / 2, options.minScale);
    if (mid <= low || mid >= high) {
      break;
    }

    const candidate = await renderCandidate(
      session,
      loadedImage,
      mimeType,
      options,
      dependencies,
      mid,
      options.minQuality,
    );

    if (!candidate || candidate.size > options.maxSizeBytes) {
      high = mid;
      continue;
    }

    bestScale = mid;
    low = mid;
  }

  return bestScale;
}

async function searchBestQualityAtScale(
  session: CompressionSession,
  loadedImage: LoadedImage,
  mimeType: string,
  options: Required<PrepareImageForUploadOptions>,
  dependencies: ImageCompressionDependencies,
  scale: number,
): Promise<CompressionCandidate | null> {
  const highCandidate = await renderCandidate(
    session,
    loadedImage,
    mimeType,
    options,
    dependencies,
    scale,
    options.maxQuality,
  );
  if (highCandidate && highCandidate.size <= options.maxSizeBytes) {
    return highCandidate;
  }

  const lowCandidate = await renderCandidate(
    session,
    loadedImage,
    mimeType,
    options,
    dependencies,
    scale,
    options.minQuality,
  );
  if (!lowCandidate || lowCandidate.size > options.maxSizeBytes) {
    return null;
  }

  let low = options.minQuality;
  let high = options.maxQuality;
  let bestCandidate = lowCandidate;

  for (let i = 0; i < options.qualitySearchSteps; i += 1) {
    if (high - low <= QUALITY_STOP_EPSILON) {
      break;
    }

    const midQuality = (low + high) / 2;
    const midCandidate = await renderCandidate(
      session,
      loadedImage,
      mimeType,
      options,
      dependencies,
      scale,
      midQuality,
    );

    if (!midCandidate) {
      break;
    }

    if (midCandidate.size <= options.maxSizeBytes) {
      bestCandidate = midCandidate;
      low = midQuality;
    } else {
      high = midQuality;
    }
  }

  return bestCandidate;
}

async function renderCandidate(
  session: CompressionSession,
  loadedImage: LoadedImage,
  mimeType: string,
  options: Required<PrepareImageForUploadOptions>,
  dependencies: ImageCompressionDependencies,
  scale: number,
  quality: number,
): Promise<CompressionCandidate | null> {
  const normalizedScale = clampScale(scale, options.minScale);
  const normalizedQuality = clampQuality(quality);
  const { width, height } = toDimensions(loadedImage, normalizedScale);
  const cacheKey = `${width}x${height}@${normalizedQuality.toFixed(4)}`;

  if (!session.cache.has(cacheKey)) {
    if (session.encodeAttempts >= options.maxEncodeAttempts) {
      session.budgetExceeded = true;
      return null;
    }

    session.encodeAttempts += 1;
    const blob = await dependencies.renderToBlob({
      image: loadedImage.image,
      width,
      height,
      mimeType,
      quality: normalizedQuality,
    });
    session.cache.set(cacheKey, blob);
  }

  const blob = session.cache.get(cacheKey) ?? null;
  if (!blob) {
    return null;
  }

  const candidate: CompressionCandidate = {
    blob,
    scale: normalizedScale,
    quality: normalizedQuality,
    size: blob.size,
  };
  if (
    candidate.size <= options.maxSizeBytes &&
    isBetterCandidate(candidate, session.bestCandidate)
  ) {
    session.bestCandidate = candidate;
  }

  return candidate;
}

function buildScaleHints(
  originalFileSize: number,
  options: Required<PrepareImageForUploadOptions>,
): number[] {
  const ratio = options.maxSizeBytes / Math.max(1, originalFileSize);
  const estimatedScale = clampScale(Math.sqrt(ratio) * 1.08, options.minScale);
  const candidates = [
    1,
    estimatedScale * 1.2,
    estimatedScale,
    estimatedScale * 0.85,
    ...options.scaleFactors,
    options.minScale,
  ]
    .map((scale) => clampScale(scale, options.minScale))
    .filter((scale) => scale > 0);

  const uniqueScales: number[] = [];
  for (const scale of candidates) {
    if (
      !uniqueScales.some(
        (value) => Math.abs(value - scale) < SCALE_DEDUP_EPSILON,
      )
    ) {
      uniqueScales.push(scale);
    }
  }

  return uniqueScales.sort((a, b) => b - a);
}

function toDimensions(
  loadedImage: LoadedImage,
  scale: number,
): {
  width: number;
  height: number;
} {
  return {
    width: Math.max(1, Math.round(loadedImage.width * scale)),
    height: Math.max(1, Math.round(loadedImage.height * scale)),
  };
}

function isBetterCandidate(
  candidate: CompressionCandidate,
  current: CompressionCandidate | null,
): boolean {
  if (!current) return true;
  if (candidate.scale > current.scale + 0.0001) return true;
  if (Math.abs(candidate.scale - current.scale) <= 0.0001) {
    if (candidate.quality > current.quality + 0.0001) return true;
    if (
      Math.abs(candidate.quality - current.quality) <= 0.0001 &&
      candidate.size > current.size
    ) {
      return true;
    }
  }
  return false;
}

function resolveOptions(
  options: PrepareImageForUploadOptions,
): Required<PrepareImageForUploadOptions> {
  const merged = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  if (merged.maxQuality < merged.minQuality) {
    const value = clampQuality(merged.minQuality);
    merged.minQuality = value;
    merged.maxQuality = value;
  }

  merged.minQuality = clampQuality(merged.minQuality);
  merged.maxQuality = clampQuality(merged.maxQuality);
  merged.minScale = clampScale(merged.minScale, 0.1);
  merged.scaleSearchSteps = Math.max(1, Math.floor(merged.scaleSearchSteps));
  merged.qualitySearchSteps = Math.max(
    1,
    Math.floor(merged.qualitySearchSteps),
  );
  merged.maxEncodeAttempts = Math.max(1, Math.floor(merged.maxEncodeAttempts));
  merged.maxInputBytes = Math.max(merged.maxSizeBytes, merged.maxInputBytes);
  merged.maxInputPixels = Math.max(1, Math.floor(merged.maxInputPixels));

  return merged;
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

function clampQuality(quality: number): number {
  if (quality < 0) return 0;
  if (quality > 1) return 1;
  return quality;
}

function clampScale(scale: number, minScale: number): number {
  if (scale < minScale) return minScale;
  if (scale > 1) return 1;
  return scale;
}

function isSupportedForAutoCompress(mimeType: string): boolean {
  return SUPPORTED_MIME_TYPES.has(mimeType.toLowerCase());
}
