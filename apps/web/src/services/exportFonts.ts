/**
 * 长图导出的 WeMD 字体库
 *
 * 字体由 https://img.wemd.app/fonts/ 托管，按需下载并缓存到 Cache Storage。
 * 通过 FontFace 注册，避免 macOS WebKit 屏蔽用户安装字体的问题；
 * 导出图片时再把同一份字节内嵌成 @font-face，交给 html-to-image。
 */

const CATALOG_URL = "https://img.wemd.app/fonts/catalog.json";
const FONT_BASE_URL = "https://img.wemd.app/fonts/";
const CACHE_NAME = "wemd-fonts-v1";

export type ExportFontFormat = "woff2" | "opentype" | "truetype";

export interface ExportFontWeight {
  weight: number;
  file: string;
  format: ExportFontFormat;
  bytes: number;
  sha256: string;
}

export interface ExportFont {
  id: string;
  label: string;
  family: string;
  category?: string;
  /** 菜单里的字体样张，light / dark 两套配色 */
  previewLight?: string;
  previewDark?: string;
  version: string;
  license: string;
  licenseFiles: string[];
  /** 字体缺字时的回退族，缺省用 sans-serif */
  fallback?: "serif" | "sans-serif";
  weights: ExportFontWeight[];
}

interface ExportFontCatalog {
  version: number;
  updatedAt: string;
  fonts: ExportFont[];
}

const MIME_BY_FORMAT: Record<ExportFontFormat, string> = {
  woff2: "font/woff2",
  opentype: "font/otf",
  truetype: "font/ttf",
};

let catalogPromise: Promise<ExportFont[]> | null = null;

const isExportFontWeight = (value: unknown): value is ExportFontWeight => {
  if (!value || typeof value !== "object") return false;
  const weight = value as Partial<ExportFontWeight>;
  return (
    typeof weight.weight === "number" &&
    typeof weight.file === "string" &&
    typeof weight.format === "string" &&
    weight.format in MIME_BY_FORMAT &&
    typeof weight.bytes === "number" &&
    typeof weight.sha256 === "string"
  );
};

const isExportFont = (value: unknown): value is ExportFont => {
  if (!value || typeof value !== "object") return false;
  const font = value as Partial<ExportFont>;
  return (
    typeof font.id === "string" &&
    typeof font.label === "string" &&
    typeof font.family === "string" &&
    typeof font.version === "string" &&
    Array.isArray(font.licenseFiles) &&
    font.licenseFiles.every((file) => typeof file === "string") &&
    Array.isArray(font.weights) &&
    font.weights.length > 0 &&
    font.weights.every(isExportFontWeight)
  );
};

export const loadExportFontCatalog = (): Promise<ExportFont[]> => {
  if (!catalogPromise) {
    catalogPromise = (async () => {
      const response = await fetch(CATALOG_URL, {
        mode: "cors",
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(`字体列表加载失败（${response.status}）`);
      }
      const data = (await response.json()) as Partial<ExportFontCatalog>;
      const fonts = Array.isArray(data.fonts)
        ? data.fonts.filter(isExportFont)
        : [];
      if (fonts.length === 0) throw new Error("字体列表为空");
      return fonts;
    })().catch((error) => {
      catalogPromise = null;
      throw error;
    });
  }
  return catalogPromise;
};

const openCache = async (): Promise<Cache | null> => {
  if (typeof caches === "undefined") return null;
  try {
    return await caches.open(CACHE_NAME);
  } catch {
    return null;
  }
};

const readCached = async (url: string): Promise<ArrayBuffer | null> => {
  try {
    const cache = await openCache();
    if (!cache) return null;
    const hit = await cache.match(url);
    return hit ? await hit.arrayBuffer() : null;
  } catch {
    return null;
  }
};

const deleteCached = async (url: string): Promise<void> => {
  try {
    const cache = await openCache();
    await cache?.delete(url);
  } catch {
    // 缓存不可用时忽略
  }
};

const writeCached = async (
  url: string,
  buffer: ArrayBuffer,
  mime: string,
): Promise<void> => {
  try {
    const cache = await openCache();
    if (!cache) return;
    await cache.put(
      url,
      new Response(buffer.slice(0), {
        headers: { "Content-Type": mime },
      }),
    );
  } catch {
    // 缓存失败不影响本次导出
  }
};

const loadedFamilies = new Map<
  string,
  { font: ExportFont; weights: Map<number, ArrayBuffer> }
>();
const loadingFamilies = new Map<string, Promise<void>>();
const fontFaceCssCache = new Map<string, string>();

const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  let binary = "";
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
};

const verifySha256 = async (
  buffer: ArrayBuffer,
  expected: string,
): Promise<void> => {
  if (!expected || !globalThis.crypto?.subtle) return;
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  const actual = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  if (actual !== expected.toLowerCase()) {
    throw new Error("字体文件校验失败，请稍后重试");
  }
};

const fontWeightUrl = (font: ExportFont, weight: ExportFontWeight): string =>
  `${FONT_BASE_URL}${weight.file}?v=${encodeURIComponent(font.version)}`;

const loadWeight = async (
  font: ExportFont,
  weight: ExportFontWeight,
): Promise<ArrayBuffer> => {
  const url = fontWeightUrl(font, weight);
  const cached = await readCached(url);
  if (cached) {
    try {
      await verifySha256(cached, weight.sha256);
      return cached;
    } catch {
      await deleteCached(url);
    }
  }

  const response = await fetch(url, { mode: "cors" });
  if (!response.ok) {
    throw new Error(`${font.label} 下载失败（${response.status}）`);
  }
  const buffer = await response.arrayBuffer();
  await verifySha256(buffer, weight.sha256);
  await writeCached(url, buffer, MIME_BY_FORMAT[weight.format]);
  return buffer;
};

/**
 * 下载并注册字体族的所有字重。重复调用会复用同一个 Promise。
 * 先全部下载并加载成功，再统一加入 document.fonts，避免部分失败留下半套字重。
 */
export const loadExportFont = (font: ExportFont): Promise<void> => {
  if (loadedFamilies.has(font.family)) return Promise.resolve();
  const pending = loadingFamilies.get(font.family);
  if (pending) return pending;

  const task = (async () => {
    try {
      const downloaded = await Promise.all(
        font.weights.map(async (weight) => ({
          weight,
          buffer: await loadWeight(font, weight),
        })),
      );
      const faces = await Promise.all(
        downloaded.map(async ({ weight, buffer }) => {
          const face = new FontFace(font.family, buffer, {
            weight: String(weight.weight),
            style: "normal",
            display: "block",
          });
          await face.load();
          return { weight, buffer, face };
        }),
      );

      // 只保留当前字体的内嵌 CSS，避免切换字体后 Base64 常驻内存
      fontFaceCssCache.clear();
      const weights = new Map<number, ArrayBuffer>();
      faces.forEach(({ weight, buffer, face }) => {
        document.fonts.add(face);
        weights.set(weight.weight, buffer);
      });
      loadedFamilies.set(font.family, { font, weights });
    } catch (error) {
      // 字体加载或缓存损坏时清掉本族缓存，下次重试可从网络重新拉取
      await Promise.all(
        font.weights.map((weight) => deleteCached(fontWeightUrl(font, weight))),
      );
      throw error;
    }
  })().finally(() => {
    loadingFamilies.delete(font.family);
  });

  loadingFamilies.set(font.family, task);
  return task;
};

export const isExportFontLoaded = (font: ExportFont): boolean =>
  loadedFamilies.has(font.family);

const escapeCssFamily = (family: string): string =>
  family.replace(/["\\]/g, "\\$&");

/**
 * 生成用于 html-to-image 的 @font-face 内嵌 CSS。
 * 未加载或主题字体返回 null。
 */
export const getExportFontEmbedCss = (family: string): string | null => {
  const loaded = loadedFamilies.get(family);
  if (!loaded) return null;

  const cached = fontFaceCssCache.get(family);
  if (cached) return cached;

  const rules = [...loaded.weights.entries()].map(([weight, buffer]) => {
    const entry = loaded.font.weights.find((item) => item.weight === weight);
    const mime = MIME_BY_FORMAT[entry?.format ?? "woff2"];
    const base64 = arrayBufferToBase64(buffer);
    return `@font-face{font-family:"${escapeCssFamily(family)}";font-style:normal;font-weight:${weight};src:url(data:${mime};base64,${base64}) format("${entry?.format ?? "woff2"}");}`;
  });

  const css = rules.join("\n");
  // 只保留当前字体的 CSS，切回旧字体时重新生成，避免多份 Base64 同时驻留
  fontFaceCssCache.clear();
  fontFaceCssCache.set(family, css);
  return css;
};

export const formatFontSize = (bytes: number): string => {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
};

/** 仅供测试重置模块状态 */
export const __resetExportFontsForTest = (): void => {
  catalogPromise = null;
  loadedFamilies.clear();
  loadingFamilies.clear();
  fontFaceCssCache.clear();
};
