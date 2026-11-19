/**
 * 文章导出为长图：复用复制链路的最终 HTML，按手机宽度排版后截图为 PNG。
 * 支持单张长图与按内容边界智能分割，分割时每张独立渲染以保持清晰度。
 */

import { getFontEmbedCSS, toCanvas } from "html-to-image";
import { zip } from "fflate";
import toast from "react-hot-toast";
import { renderWechatContainer } from "./wechatCopyService";
import { getExportFontEmbedCss } from "./exportFonts";
import { applyLightRootVars } from "./inlineStyleVarResolver";

const DEFAULT_WIDTH = 375;
const PREFERRED_PIXEL_RATIO = 2;
const DEFAULT_SPLIT_MAX_HEIGHT = 2000;
// 取 iOS Safari 画布面积上限这一最保守值，桌面端超长文章也会降倍率
const MAX_CANVAS_AREA = 16_777_216;
// html-to-image 默认会把超过 16384 像素的边等比缩小，这里与它保持一致
const MAX_CANVAS_SIDE = 16_384;
const IMAGE_PLACEHOLDER =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN4+PDhfwAJLAPuzvzE0gAAAABJRU5ErkJggg==";
const TRANSPARENT_PIXEL =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

export interface SplitPage {
  top: number;
  bottom: number;
}

export interface LongImageExportOptions {
  showMacBar?: boolean;
  fontFamily?: string;
  fontFallback?: string;
  fontSize?: number;
  width?: number;
  preferredPixelRatio?: number;
  backgroundColor?: string;
  mode?: "single" | "split";
  splitMaxHeight?: number;
}

export interface LongImagePreview {
  dataUrl: string;
  width: number;
  height: number;
  pages: SplitPage[];
  pixelRatio: number;
  /** 预览图的 PNG 字节数，用来估算导出大小 */
  bytes: number;
}

/** 在画布尺寸上限内取尽量高的倍率，超长文章自动降低清晰度而不是导出失败 */
export function computeExportPixelRatio(
  width: number,
  height: number,
  preferred = PREFERRED_PIXEL_RATIO,
): number {
  if (width <= 0 || height <= 0) return preferred;
  const bySide = MAX_CANVAS_SIDE / Math.max(width, height);
  const byArea = Math.sqrt(MAX_CANVAS_AREA / (width * height));
  return Math.floor(Math.min(preferred, bySide, byArea) * 1000) / 1000;
}

const buildBaseName = (markdown: string): string => {
  const heading = markdown.match(/^#{1,2}\s+(.+)$/m)?.[1]?.trim();
  const cleaned = Array.from(
    (heading || "WeMD 长图").replace(/[\\/:*?"<>|]/g, "_"),
  )
    .filter((char) => char.charCodeAt(0) >= 32)
    .join("")
    .trim();
  return Array.from(cleaned).slice(0, 60).join("") || "WeMD 长图";
};

const resolveBackgroundColor = (value?: string): string | undefined =>
  value === "transparent" ? undefined : (value ?? "#ffffff");

interface ImageSlot {
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
  contain: boolean;
}

/**
 * 截图前把图片换成透明占位并记下位置，截完再把原图直接画到画布上。
 * WebKit（Safari、Tauri 桌面版）不绘制 SVG foreignObject 里约 300KB 以上的 data URI 图片，
 * Mermaid 图与照片经截图库内联后都会超过，直接绘制各引擎结果一致。
 */
const takeOutImages = (container: HTMLElement): ImageSlot[] => {
  const origin = container.getBoundingClientRect();
  const px = (value: string) => parseFloat(value) || 0;
  return Array.from(container.querySelectorAll("img")).flatMap((img) => {
    const rect = img.getBoundingClientRect();
    if (!img.src || rect.width === 0 || rect.height === 0) return [];
    const style = getComputedStyle(img);
    const left = px(style.borderLeftWidth) + px(style.paddingLeft);
    const top = px(style.borderTopWidth) + px(style.paddingTop);
    const width =
      rect.width - left - px(style.borderRightWidth) - px(style.paddingRight);
    const height =
      rect.height - top - px(style.borderBottomWidth) - px(style.paddingBottom);
    const corner = style.borderTopLeftRadius;
    const slot: ImageSlot = {
      src: img.currentSrc || img.src,
      x: rect.left - origin.left + left,
      y: rect.top - origin.top + top,
      width,
      height,
      radius: corner.endsWith("%")
        ? (Math.min(width, height) * px(corner)) / 100
        : px(corner),
      contain: style.objectFit === "contain",
    };
    // 锁定尺寸后再换占位，版式不变
    img.style.setProperty("width", `${rect.width}px`, "important");
    img.style.setProperty("height", `${rect.height}px`, "important");
    img.removeAttribute("srcset");
    img.src = TRANSPARENT_PIXEL;
    return [slot];
  });
};

/**
 * 读取失败返回 null（图床没开跨域等）。远程图片绕过缓存重新请求：
 * 预览里的 <img> 可能缓存了不带 CORS 头的响应，WebKit 复用它会读取失败。
 */
const loadImage = async (
  src: string,
): Promise<{ image: HTMLImageElement; release: () => void } | null> => {
  let url = src;
  try {
    if (/^https?:/i.test(src)) {
      const response = await fetch(src, { mode: "cors", cache: "no-store" });
      if (!response.ok) return null;
      url = URL.createObjectURL(await response.blob());
    }
    const image = new Image();
    image.src = url;
    await image.decode();
    return {
      image,
      release: () => url !== src && URL.revokeObjectURL(url),
    };
  } catch {
    if (url !== src) URL.revokeObjectURL(url);
    return null;
  }
};

/** roundRect 在 Safari 15.x、Firefox ≤111、Chrome ≤98 不存在，缺失时用 arcTo 画同样的圆角路径 */
const roundedRect = (
  context: CanvasRenderingContext2D,
  { x, y, width, height, radius }: ImageSlot,
) => {
  if (typeof context.roundRect === "function") {
    context.roundRect(x, y, width, height, radius);
    return;
  }
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r);
  context.closePath();
};

interface LoadedImages {
  placeholder: { image: HTMLImageElement; release: () => void } | null;
  loaded: Array<{ image: HTMLImageElement; release: () => void } | null>;
  blocked: string[];
}

const loadImages = async (slots: ImageSlot[]): Promise<LoadedImages> => {
  const [placeholder, ...loaded] = await Promise.all([
    loadImage(IMAGE_PLACEHOLDER),
    ...slots.map((slot) => loadImage(slot.src)),
  ]);
  const blocked = Array.from(
    new Set(
      slots
        .filter((slot, index) => !loaded[index] && /^https?:/i.test(slot.src))
        .map((slot) => slot.src),
    ),
  );
  return { placeholder, loaded, blocked };
};

const releaseImages = (images: LoadedImages): void => {
  images.placeholder?.release();
  images.loaded.forEach((item) => item?.release());
};

interface DrawImagesOptions {
  /** 原始容器坐标到当前画布的纵向偏移，分页导出时传页顶 */
  offsetY?: number;
  /** 原始容器宽度，用来还原画布缩放 */
  width?: number;
  /** 只绘制与当前页相交的图片 */
  pageTop?: number;
  pageBottom?: number;
}

const drawImages = (
  canvas: HTMLCanvasElement,
  slots: ImageSlot[],
  images: LoadedImages,
  options: DrawImagesOptions = {},
): void => {
  if (slots.length === 0) return;
  const offsetY = options.offsetY ?? 0;
  const width = options.width ?? DEFAULT_WIDTH;
  const pageTop = options.pageTop ?? 0;
  const pageBottom = options.pageBottom ?? Number.POSITIVE_INFINITY;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("浏览器不支持画布");
  const scale = canvas.width / width;
  context.save();
  context.scale(scale, scale);

  slots.forEach((slot, index) => {
    if (slot.y + slot.height <= pageTop || slot.y >= pageBottom) return;
    const loadedImage = images.loaded[index]?.image;
    const image = loadedImage ?? images.placeholder?.image;
    if (!image) return;
    let { x, y, width: slotWidth, height: slotHeight } = slot;
    y -= offsetY;
    if (
      slot.contain &&
      loadedImage &&
      loadedImage.naturalWidth > 0 &&
      loadedImage.naturalHeight > 0
    ) {
      const fit = Math.min(
        slotWidth / loadedImage.naturalWidth,
        slotHeight / loadedImage.naturalHeight,
      );
      x += (slotWidth - loadedImage.naturalWidth * fit) / 2;
      y += (slotHeight - loadedImage.naturalHeight * fit) / 2;
      slotWidth = loadedImage.naturalWidth * fit;
      slotHeight = loadedImage.naturalHeight * fit;
    }
    context.save();
    context.beginPath();
    roundedRect(context, {
      ...slot,
      x,
      y,
      width: slotWidth,
      height: slotHeight,
    });
    context.clip();
    context.drawImage(image, x, y, slotWidth, slotHeight);
    context.restore();
  });
  context.restore();
};

const canvasToPng = async (canvas: HTMLCanvasElement): Promise<Blob> => {
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  canvas.width = 0;
  canvas.height = 0;
  if (!blob) throw new Error("浏览器未生成图片");
  return blob;
};

const downloadBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  // WebKit 可能还没接管下载就销毁 URL，延迟释放
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
};

interface PreparedExport {
  container: HTMLDivElement;
  slots: ImageSlot[];
  width: number;
  height: number;
  fontEmbedCss?: string;
}

const prepareExportContainer = async (
  markdown: string,
  css: string,
  options: LongImageExportOptions,
): Promise<PreparedExport> => {
  const width = options.width ?? DEFAULT_WIDTH;
  const rendered = await renderWechatContainer(markdown, css, {
    showMacBar: options.showMacBar,
    width: `${width}px`,
    tableWrap: true,
    fontFamily: options.fontFamily,
    fontFallback: options.fontFallback,
    fontSize: options.fontSize,
  });
  const container = rendered.container;

  try {
    // 代码块在长图里自动换行，不依赖复制链路对代码块的处理
    container.querySelectorAll<HTMLElement>("pre > code").forEach((code) => {
      code.style.whiteSpace = "pre-wrap";
      code.style.overflowWrap = "anywhere";
    });
    // 滑动图组在长图里改为纵向排列，全部图片都显示
    container
      .querySelectorAll<HTMLElement>(".imageflow-layer2")
      .forEach((layer) => {
        layer.style.whiteSpace = "normal";
        layer.style.overflowX = "visible";
      });
    container
      .querySelectorAll<HTMLElement>(".imageflow-layer3")
      .forEach((item) => {
        item.style.display = "block";
        item.style.width = "100%";
        item.style.marginRight = "0";
      });
    container
      .querySelectorAll(".imageflow-caption")
      .forEach((caption) => caption.remove());

    await Promise.all(
      Array.from(container.querySelectorAll("img")).map((img) =>
        img.complete ? undefined : img.decode().catch(() => undefined),
      ),
    );
    const slots = takeOutImages(container);
    // 仍可滚动的区域只截可见部分，隐藏滚动条避免被画进图里
    container.querySelectorAll<HTMLElement>("*").forEach((el) => {
      const { overflowX, overflowY } = getComputedStyle(el);
      if (/auto|scroll/.test(overflowX + overflowY)) {
        el.style.scrollbarWidth = "none";
      }
    });

    let fontEmbedCss: string | undefined;
    if (options.fontFamily) {
      const parts: string[] = [];
      // html-to-image 只要拿到 fontEmbedCSS 就不再自动收集页面字体，
      // 公式的 KaTeX 字体必须显式收集，否则会被替换成普通字体
      if (container.querySelector(".katex")) {
        try {
          parts.push(await getFontEmbedCSS(container));
        } catch (error) {
          console.warn("[WeMD] KaTeX 字体收集失败", error);
        }
      }
      const hostedCss = getExportFontEmbedCss(options.fontFamily);
      if (hostedCss) parts.push(hostedCss);
      fontEmbedCss = parts.filter(Boolean).join("\n") || undefined;
    }

    return {
      container,
      slots,
      width,
      height: container.scrollHeight,
      fontEmbedCss,
    };
  } catch (error) {
    container.remove();
    throw error;
  }
};

// ── 智能分割 ────────────────────────────────────────

interface BlockUnit {
  top: number;
  bottom: number;
  heading: boolean;
  element: Element;
}

// 这些块整体保留，不在内部切分（表格行与代码行由 collectInnerCuts 兜底）
const ATOMIC_TAGS: Record<string, true> = {
  TABLE: true,
  PRE: true,
  FIGURE: true,
  IMG: true,
  SVG: true,
  VIDEO: true,
  IFRAME: true,
};

/** 根节点下可能还有一层承接内边距的包装，逐层下钻到真正的块列表 */
const getBlockElements = (root: Element): Element[] => {
  let blocks = Array.from(root.children);
  while (blocks.length === 1) {
    const only = blocks[0];
    if (ATOMIC_TAGS[only.tagName] || only.classList.contains("table-container"))
      break;
    const hasOwnText = Array.from(only.childNodes).some(
      (node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim(),
    );
    if (hasOwnText || only.children.length === 0) break;
    blocks = Array.from(only.children);
  }
  return blocks;
};

const collectUnits = (container: HTMLElement): BlockUnit[] => {
  const root = container.firstElementChild;
  if (!root) return [];
  const origin = container.getBoundingClientRect().top;
  return getBlockElements(root)
    .map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        element,
        top: rect.top - origin,
        bottom: rect.bottom - origin,
        heading: /^H[1-6]$/.test(element.tagName),
      };
    })
    .filter((unit) => unit.bottom - unit.top > 0.5)
    .sort((a, b) => a.top - b.top);
};

/** 收集块内部的合法切割点：文字行底、代码行底、表格行底 */
const collectInnerCuts = (unit: BlockUnit, origin: number): number[] => {
  const element = unit.element;
  const table =
    element.tagName === "TABLE"
      ? element
      : element.classList.contains("table-container")
        ? element.querySelector("table")
        : null;

  if (table) {
    const cuts = new Set<number>();
    table.querySelectorAll("tr").forEach((row) => {
      const rect = row.getBoundingClientRect();
      if (rect.height > 0) cuts.add(rect.bottom - origin);
    });
    return [...cuts]
      .filter(
        (position) => position > unit.top + 0.5 && position < unit.bottom - 0.5,
      )
      .sort((a, b) => a - b);
  }

  if (element.tagName === "IMG" || element.tagName === "SVG") return [];

  // 图片、公式等原子盒内部不允许作为切口
  const atomicRects = Array.from(
    element.querySelectorAll("img, svg, .katex, .katex-display"),
  )
    .map((node) => {
      const rect = node.getBoundingClientRect();
      return { top: rect.top - origin, bottom: rect.bottom - origin };
    })
    .filter((rect) => rect.bottom > rect.top);

  const cuts = new Set<number>();
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const text = node.textContent ?? "";
    if (text.trim() && !node.parentElement?.closest(".katex")) {
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const rect of range.getClientRects()) {
        if (rect.height > 0) {
          // 同一行的多个 inline 片段 bottom 相同，取整避免浮点重复
          cuts.add(Math.round((rect.bottom - origin) * 10) / 10);
        }
      }
    }
    node = walker.nextNode();
  }

  return [...cuts]
    .filter(
      (position) => position > unit.top + 0.5 && position < unit.bottom - 0.5,
    )
    .filter(
      (position) =>
        !atomicRects.some(
          (rect) => position > rect.top + 0.5 && position < rect.bottom - 0.5,
        ),
    )
    .sort((a, b) => a - b);
};

/**
 * 纯分页逻辑：按块边界尽量装满，单块过高时退到内部行边界。
 * 页尾标题移到下一页；放不下的原子块单独成页，允许超页。
 */
export const packSplitPages = (
  units: Array<{ top: number; bottom: number; heading?: boolean }>,
  maxHeight: number,
  innerCuts?: Map<number, number[]>,
): SplitPage[] => {
  const pages: SplitPage[] = [];
  let pageTop = 0;
  let index = 0;

  while (index < units.length) {
    const limit = pageTop + maxHeight;
    let last = -1;
    for (let cursor = index; cursor < units.length; cursor += 1) {
      if (units[cursor].bottom <= limit) last = cursor;
      else break;
    }

    if (last >= index) {
      let cut = units[last].bottom;
      let next = last + 1;
      // 标题孤零零留在页尾时，把它推到下一页
      if (
        units[last].heading &&
        last > index &&
        next < units.length &&
        units[last].top > pageTop
      ) {
        cut = units[last].top;
        next = last;
      }
      if (cut <= pageTop) {
        cut = units[last].bottom;
        next = last + 1;
      }
      pages.push({ top: pageTop, bottom: cut });
      pageTop = cut;
      index = next;
      continue;
    }

    const unit = units[index];
    const allCuts = (innerCuts?.get(index) ?? []).filter(
      (position) => position > pageTop + 1,
    );
    const fittingCuts = allCuts.filter((position) => position <= limit);
    // 行内没有正好落在页高内的切口时，取第一个略超页高的切口：比整块超页更接近目标
    const cut =
      fittingCuts[fittingCuts.length - 1] ??
      allCuts.find((position) => position > limit);
    if (cut !== undefined) {
      pages.push({ top: pageTop, bottom: cut });
      pageTop = cut;
      continue;
    }

    pages.push({ top: pageTop, bottom: unit.bottom });
    pageTop = unit.bottom;
    index += 1;
  }

  return pages.filter((page) => page.bottom - page.top > 0.5);
};

/** 基于渲染后的 DOM 计算分页 */
export const computeSplitPages = (
  container: HTMLElement,
  maxHeight: number,
): SplitPage[] => {
  const units = collectUnits(container);
  if (units.length === 0) return [{ top: 0, bottom: container.scrollHeight }];
  const origin = container.getBoundingClientRect().top;
  const innerCuts = new Map<number, number[]>();
  units.forEach((unit, index) => {
    if (unit.bottom - unit.top > maxHeight) {
      innerCuts.set(index, collectInnerCuts(unit, origin));
    }
  });
  const pages = packSplitPages(units, maxHeight, innerCuts);
  // 底部 padding/margin 能放进最后一页时保留，避免长图底部被裁掉一截留白
  if (pages.length > 0) {
    const last = pages[pages.length - 1];
    const total = container.scrollHeight;
    const tail = total - last.bottom;
    if (tail > 0 && last.bottom - last.top + tail <= maxHeight * 1.1) {
      last.bottom = total;
    }
  }

  // 合并碎片页：优先并到下一页，其次上一页，避免出现几十像素的空白图
  let merged = true;
  while (merged) {
    merged = false;
    for (let index = 0; index < pages.length; index += 1) {
      const page = pages[index];
      const pageHeight = page.bottom - page.top;
      if (pageHeight > maxHeight * 0.15) continue;

      const next = pages[index + 1];
      if (next && next.bottom - page.top <= maxHeight * 1.2) {
        next.top = page.top;
        pages.splice(index, 1);
        merged = true;
        break;
      }

      const previous = pages[index - 1];
      if (previous && page.bottom - previous.top <= maxHeight * 1.2) {
        previous.bottom = page.bottom;
        pages.splice(index, 1);
        merged = true;
        break;
      }
    }
  }

  return pages;
};

// ── 截图 ────────────────────────────────────────────

const capturePage = async (
  prepared: PreparedExport,
  page: SplitPage,
  options: LongImageExportOptions,
  images: LoadedImages,
): Promise<Blob> => {
  const root = prepared.container.firstElementChild;
  if (!root) throw new Error("没有可导出的内容");

  const pageHeight = page.bottom - page.top;
  const wrapper = document.createElement("div");
  wrapper.style.cssText = `position:fixed;left:0;top:0;width:${prepared.width}px;height:${pageHeight}px;overflow:hidden;opacity:0;pointer-events:none;z-index:-1;`;
  wrapper.style.colorScheme = "light";
  wrapper.style.color = "#000000";
  applyLightRootVars(wrapper);
  const clone = root.cloneNode(true) as HTMLElement;
  clone.style.transform = `translateY(${-page.top}px)`;
  clone.style.transformOrigin = "top left";
  wrapper.appendChild(clone);
  document.body.appendChild(wrapper);

  try {
    const ratio = computeExportPixelRatio(
      prepared.width,
      pageHeight,
      options.preferredPixelRatio,
    );
    const canvas = await toCanvas(wrapper, {
      width: prepared.width,
      height: pageHeight,
      pixelRatio: ratio,
      backgroundColor: resolveBackgroundColor(options.backgroundColor),
      imagePlaceholder: IMAGE_PLACEHOLDER,
      fontEmbedCSS: prepared.fontEmbedCss,
      style: { opacity: "1", position: "static", zIndex: "auto" },
    });
    drawImages(canvas, prepared.slots, images, {
      offsetY: page.top,
      width: prepared.width,
      pageTop: page.top,
      pageBottom: page.bottom,
    });
    return await canvasToPng(canvas);
  } finally {
    wrapper.remove();
  }
};

const captureFullImage = async (
  prepared: PreparedExport,
  options: LongImageExportOptions,
  images: LoadedImages,
): Promise<Blob> => {
  const ratio = computeExportPixelRatio(
    prepared.width,
    prepared.height,
    options.preferredPixelRatio,
  );
  const canvas = await toCanvas(prepared.container, {
    width: prepared.width,
    height: prepared.height,
    pixelRatio: ratio,
    backgroundColor: resolveBackgroundColor(options.backgroundColor),
    imagePlaceholder: IMAGE_PLACEHOLDER,
    fontEmbedCSS: prepared.fontEmbedCss,
    style: { opacity: "1", position: "static", zIndex: "auto" },
  });
  drawImages(canvas, prepared.slots, images, {
    width: prepared.width,
    pageTop: 0,
    pageBottom: prepared.height,
  });
  return canvasToPng(canvas);
};

// ── 预览 ────────────────────────────────────────────

export async function renderLongImagePreview(
  markdown: string,
  css: string,
  options: LongImageExportOptions = {},
): Promise<LongImagePreview> {
  const prepared = await prepareExportContainer(markdown, css, options);
  try {
    if (prepared.height < 2) {
      return {
        dataUrl: "",
        width: prepared.width,
        height: 0,
        pages: [],
        pixelRatio: 0,
        bytes: 0,
      };
    }
    const pages =
      options.mode === "split"
        ? computeSplitPages(
            prepared.container,
            options.splitMaxHeight ?? DEFAULT_SPLIT_MAX_HEIGHT,
          )
        : [{ top: 0, bottom: prepared.height }];
    // 预览按导出的清晰度渲染再等比缩小显示，避免缩略图被拉伸发糊
    const ratio = computeExportPixelRatio(prepared.width, prepared.height, 2);
    const canvas = await toCanvas(prepared.container, {
      width: prepared.width,
      height: prepared.height,
      pixelRatio: ratio,
      backgroundColor: resolveBackgroundColor(options.backgroundColor),
      imagePlaceholder: IMAGE_PLACEHOLDER,
      fontEmbedCSS: prepared.fontEmbedCss,
      style: { opacity: "1", position: "static", zIndex: "auto" },
    });
    const images = await loadImages(prepared.slots);
    try {
      drawImages(canvas, prepared.slots, images, {
        width: prepared.width,
        pageTop: 0,
        pageBottom: prepared.height,
      });

      const context = canvas.getContext("2d");
      if (context && pages.length > 1) {
        context.save();
        context.setTransform(1, 0, 0, 1, 0, 0);
        context.fillStyle = "#07c160";
        pages.slice(0, -1).forEach((page) => {
          context.fillRect(0, Math.round(page.bottom * ratio), canvas.width, 1);
        });
        context.restore();
      }

      const dataUrl = canvas.toDataURL("image/png");
      canvas.width = 0;
      canvas.height = 0;
      const bytes = Math.round(
        (Math.max(0, dataUrl.length - dataUrl.indexOf(",") - 1) * 3) / 4,
      );
      return {
        dataUrl,
        width: prepared.width,
        height: prepared.height,
        pages,
        pixelRatio: ratio,
        bytes,
      };
    } finally {
      releaseImages(images);
    }
  } finally {
    prepared.container.remove();
  }
}

/**
 * 用预览图的字节数按像素面积比例估算导出后的 PNG 大小。
 * PNG 压缩率随内容变化，这里只用于提示，不作为精确值。
 */
export const estimateExportBytes = (
  preview: Pick<LongImagePreview, "height" | "pixelRatio" | "pages" | "bytes">,
  clarity: number,
  width = DEFAULT_WIDTH,
): number => {
  if (preview.height < 2 || preview.pixelRatio <= 0 || preview.bytes <= 0) {
    return 0;
  }
  const pages =
    preview.pages.length > 0
      ? preview.pages
      : [{ top: 0, bottom: preview.height }];
  const exportArea = pages.reduce((sum, page) => {
    const pageHeight = page.bottom - page.top;
    const ratio = computeExportPixelRatio(width, pageHeight, clarity);
    return sum + pageHeight * ratio * ratio;
  }, 0);
  const previewArea = preview.height * preview.pixelRatio * preview.pixelRatio;
  return Math.round(preview.bytes * (exportArea / previewArea));
};

// ── 导出 ────────────────────────────────────────────

const zipBlobs = (files: Record<string, Uint8Array>): Promise<Uint8Array> =>
  new Promise((resolve, reject) => {
    zip(files, { level: 0 }, (error, data) => {
      if (error) reject(error);
      else resolve(data);
    });
  });

const notifyBlockedImages = (
  toastId: string,
  blockedImages: string[],
  prefix: string,
) => {
  const unique = Array.from(new Set(blockedImages));
  if (unique.length > 0) {
    toast(`${prefix}，${unique.length} 张图片无法读取，已用占位图代替`, {
      id: toastId,
      icon: "⚠️",
      duration: 5000,
    });
  } else {
    toast.success(prefix, { id: toastId });
  }
};

// 导出耗时一两秒，期间重复点击（顶栏、浮动工具栏、移动端入口共用）直接忽略
let exporting = false;

export async function exportLongImage(
  markdown: string,
  css: string,
  options: LongImageExportOptions = {},
): Promise<boolean> {
  if (exporting) return false;
  exporting = true;
  const toastId = toast.loading("正在生成长图...");
  let container: HTMLDivElement | null = null;

  try {
    const prepared = await prepareExportContainer(markdown, css, options);
    container = prepared.container;
    if (prepared.height < 2) throw new Error("文章为空，暂无可导出内容");
    const baseName = buildBaseName(markdown);
    const images = await loadImages(prepared.slots);

    try {
      if (options.mode !== "split") {
        const blob = await captureFullImage(prepared, options, images);
        downloadBlob(blob, `${baseName}.png`);
        notifyBlockedImages(toastId, images.blocked, "长图已导出");
        return true;
      }

      const pages = computeSplitPages(
        container,
        options.splitMaxHeight ?? DEFAULT_SPLIT_MAX_HEIGHT,
      );
      if (pages.length <= 1) {
        const blob = await captureFullImage(prepared, options, images);
        downloadBlob(blob, `${baseName}.png`);
        notifyBlockedImages(toastId, images.blocked, "长图已导出");
        return true;
      }

      const files: Record<string, Uint8Array> = {};
      const pad = String(pages.length).length;
      for (const [index, page] of pages.entries()) {
        toast.loading(`正在导出第 ${index + 1}/${pages.length} 张...`, {
          id: toastId,
        });
        const blob = await capturePage(prepared, page, options, images);
        files[`${baseName}-${String(index + 1).padStart(pad, "0")}.png`] =
          new Uint8Array(await blob.arrayBuffer());
      }

      const zipped = await zipBlobs(files);
      downloadBlob(
        new Blob([zipped], { type: "application/zip" }),
        `${baseName}-${pages.length}张.zip`,
      );
      notifyBlockedImages(
        toastId,
        images.blocked,
        `已导出 ${pages.length} 张长图`,
      );
      return true;
    } finally {
      releaseImages(images);
    }
  } catch (error) {
    console.error("导出长图失败:", error);
    const message = error instanceof Error ? error.message : String(error);
    toast.error(`导出长图失败: ${message}`, { id: toastId });
    return false;
  } finally {
    container?.remove();
    exporting = false;
  }
}
