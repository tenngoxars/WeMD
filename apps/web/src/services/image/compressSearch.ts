/**
 * 图片压缩搜索算法
 * 两阶段二分搜索：先找最大可行分辨率，再在该分辨率下找最高质量
 */

const SCALE_DEDUP_EPSILON = 0.01;
const SCALE_STOP_EPSILON = 0.005;
const QUALITY_STOP_EPSILON = 0.01;

export interface LoadedImage {
  image: CanvasImageSource;
  width: number;
  height: number;
}

export interface RenderBlobInput {
  image: CanvasImageSource;
  width: number;
  height: number;
  mimeType: string;
  quality: number;
}

export interface CompressionCandidate {
  blob: Blob;
  scale: number;
  quality: number;
  size: number;
}

export interface CompressionSession {
  cache: Map<string, Blob | null>;
  encodeAttempts: number;
  bestCandidate: CompressionCandidate | null;
  budgetExceeded: boolean;
}

export interface ImageCompressionDependencies {
  loadImage: (file: File) => Promise<LoadedImage>;
  renderToBlob: (input: RenderBlobInput) => Promise<Blob | null>;
}

export interface CompressionOptions {
  maxSizeBytes: number;
  minQuality: number;
  maxQuality: number;
  minScale: number;
  scaleSearchSteps: number;
  qualitySearchSteps: number;
  maxEncodeAttempts: number;
  scaleFactors: number[];
}

export function createSession(): CompressionSession {
  return {
    cache: new Map(),
    encodeAttempts: 0,
    bestCandidate: null,
    budgetExceeded: false,
  };
}

/**
 * 搜索满足体积限制的最优压缩结果
 * 策略：先尝试原尺寸 → 降质量 → 缩分辨率 → 在最优分辨率下提升质量
 */
export async function searchCompressedBlob(
  loadedImage: LoadedImage,
  originalFileSize: number,
  mimeType: string,
  options: CompressionOptions,
  dependencies: ImageCompressionDependencies,
): Promise<Blob | null> {
  const session = createSession();

  // 尝试原尺寸 + 高质量
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

  // 尝试原尺寸 + 低质量
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

  // 需要缩小分辨率
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
    if (bestAtScale) return bestAtScale.blob;
  }

  return session.bestCandidate?.blob ?? null;
}

/**
 * 二分搜索满足体积限制的最大分辨率（scale）
 */
async function searchBestScale(
  session: CompressionSession,
  loadedImage: LoadedImage,
  mimeType: string,
  options: CompressionOptions,
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

    if (session.budgetExceeded) break;

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

  // 在 [feasibleScale, infeasibleScale] 区间二分搜索
  let low = feasibleScale;
  let high = Math.max(infeasibleScale, low);
  let bestScale = low;

  for (let i = 0; i < options.scaleSearchSteps; i += 1) {
    if (high - low <= SCALE_STOP_EPSILON) break;

    const mid = clampScale((low + high) / 2, options.minScale);
    if (mid <= low || mid >= high) break;

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
    } else {
      bestScale = mid;
      low = mid;
    }
  }

  return bestScale;
}

/**
 * 在固定分辨率下二分搜索满足体积限制的最高质量
 */
async function searchBestQualityAtScale(
  session: CompressionSession,
  loadedImage: LoadedImage,
  mimeType: string,
  options: CompressionOptions,
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
    if (high - low <= QUALITY_STOP_EPSILON) break;

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

    if (!midCandidate) break;

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
  options: CompressionOptions,
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
  if (!blob) return null;

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

/**
 * 根据原始体积估算起点 scale，生成搜索候选列表
 * Math.sqrt(ratio) 基于"像素面积与文件体积近似线性"假设
 * ×1.08 是乐观修正系数：搜索从偏大值开始可快速命中可行点
 */
function buildScaleHints(
  originalFileSize: number,
  options: CompressionOptions,
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
    .map((s) => clampScale(s, options.minScale))
    .filter((s) => s > 0);

  const uniqueScales: number[] = [];
  for (const scale of candidates) {
    if (!uniqueScales.some((v) => Math.abs(v - scale) < SCALE_DEDUP_EPSILON)) {
      uniqueScales.push(scale);
    }
  }

  return uniqueScales.sort((a, b) => b - a);
}

/**
 * 判断 candidate 是否优于 current
 * 优先级：更高分辨率 > 更高质量 > 更大体积（同参数下更大的 blob 保留了更多图片信息）
 */
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

function toDimensions(
  loadedImage: LoadedImage,
  scale: number,
): { width: number; height: number } {
  return {
    width: Math.max(1, Math.round(loadedImage.width * scale)),
    height: Math.max(1, Math.round(loadedImage.height * scale)),
  };
}

export function clampQuality(quality: number): number {
  if (quality < 0) return 0;
  if (quality > 1) return 1;
  return quality;
}

export function clampScale(scale: number, minScale: number): number {
  if (scale < minScale) return minScale;
  if (scale > 1) return 1;
  return scale;
}
