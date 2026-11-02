/**
 * 文章导出为长图：复用复制链路的最终 HTML，按手机宽度排版后截图为 PNG
 */

import { toCanvas } from "html-to-image";
import toast from "react-hot-toast";
import {
  renderWechatContainer,
  type WechatContainerOptions,
} from "./wechatCopyService";

// 手机常见逻辑宽度，长图和手机上看到的排版一致
const EXPORT_WIDTH = 375;
const PREFERRED_PIXEL_RATIO = 2;
// ponytail: 取 iOS Safari 画布面积上限这一最保守值，桌面端超长文章也会降倍率；需要更清晰时再按平台放宽或改为分段导出
const MAX_CANVAS_AREA = 16_777_216;
// html-to-image 默认会把超过 16384 像素的边等比缩小，这里与它保持一致，倍率才是真实输出值
const MAX_CANVAS_SIDE = 16_384;
// 1×1 浅灰 PNG，图床未开跨域时用它占位，避免整张图导出失败
const IMAGE_PLACEHOLDER =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN4+PDhfwAJLAPuzvzE0gAAAABJRU5ErkJggg==";
// 1×1 透明 GIF，截图时占住图片的位置
const TRANSPARENT_PIXEL =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

/** 在画布尺寸上限内取尽量高的倍率，超长文章自动降低清晰度而不是导出失败 */
export function computeExportPixelRatio(width: number, height: number): number {
  if (width <= 0 || height <= 0) return PREFERRED_PIXEL_RATIO;
  const bySide = MAX_CANVAS_SIDE / Math.max(width, height);
  const byArea = Math.sqrt(MAX_CANVAS_AREA / (width * height));
  // 向下取整到千分位，避免浮点误差让画布越过上限
  return (
    Math.floor(Math.min(PREFERRED_PIXEL_RATIO, bySide, byArea) * 1000) / 1000
  );
}

const buildFileName = (markdown: string): string => {
  const heading = markdown.match(/^#{1,2}\s+(.+)$/m)?.[1]?.trim();
  const name = (heading || "WeMD 长图").replace(/[\\/:*?"<>|]/g, "_");
  return `${name}.png`;
};

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

/** 把原图画回截图画布，返回读取失败的远程图片地址（去重） */
const drawImages = async (
  canvas: HTMLCanvasElement,
  slots: ImageSlot[],
): Promise<string[]> => {
  if (slots.length === 0) return [];
  const context = canvas.getContext("2d");
  if (!context) throw new Error("浏览器不支持画布");
  const [placeholder, ...loaded] = await Promise.all([
    loadImage(IMAGE_PLACEHOLDER),
    ...slots.map((slot) => loadImage(slot.src)),
  ]);
  context.scale(canvas.width / EXPORT_WIDTH, canvas.width / EXPORT_WIDTH);
  slots.forEach((slot, index) => {
    const image = loaded[index]?.image ?? placeholder?.image;
    if (!image) return;
    let { x, y, width, height } = slot;
    if (slot.contain && loaded[index]) {
      const scale = Math.min(
        width / image.naturalWidth,
        height / image.naturalHeight,
      );
      x += (width - image.naturalWidth * scale) / 2;
      y += (height - image.naturalHeight * scale) / 2;
      width = image.naturalWidth * scale;
      height = image.naturalHeight * scale;
    }
    context.save();
    context.beginPath();
    context.roundRect(slot.x, slot.y, slot.width, slot.height, slot.radius);
    context.clip();
    context.drawImage(image, x, y, width, height);
    context.restore();
  });
  [placeholder, ...loaded].forEach((item) => item?.release());
  return Array.from(
    new Set(
      slots
        .filter((slot, index) => !loaded[index] && /^https?:/i.test(slot.src))
        .map((slot) => slot.src),
    ),
  );
};

const downloadBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
};

// 导出耗时一两秒，期间重复点击（顶栏、浮动工具栏、移动端入口共用）直接忽略
let exporting = false;

export async function exportLongImage(
  markdown: string,
  css: string,
  options: Pick<WechatContainerOptions, "showMacBar"> = {},
): Promise<void> {
  if (exporting) return;
  exporting = true;
  const toastId = toast.loading("正在生成长图...");
  let container: HTMLDivElement | null = null;

  try {
    // 长图不能横向滚动，表格强制换行
    const rendered = await renderWechatContainer(markdown, css, {
      ...options,
      width: `${EXPORT_WIDTH}px`,
      tableWrap: true,
    });
    container = rendered.container;
    // 代码块在长图里自动换行，不依赖复制链路对代码块的处理（#110 可能改回滚动）
    container.querySelectorAll<HTMLElement>("pre > code").forEach((code) => {
      code.style.whiteSpace = "pre-wrap";
      code.style.overflowWrap = "anywhere";
    });
    // 滑动图组在长图里改为纵向排列，全部图片都显示；去掉「左右滑动」提示
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
    // 滑动图组等仍可滚动的区域只截可见部分，隐藏滚动条避免它被画进图里
    container.querySelectorAll<HTMLElement>("*").forEach((el) => {
      const { overflowX, overflowY } = getComputedStyle(el);
      if (/auto|scroll/.test(overflowX + overflowY)) {
        el.style.scrollbarWidth = "none";
      }
    });

    const height = container.scrollHeight;
    const canvas = await toCanvas(container, {
      width: EXPORT_WIDTH,
      height,
      pixelRatio: computeExportPixelRatio(EXPORT_WIDTH, height),
      backgroundColor: "#ffffff",
      // 主题里的背景图仍由截图库内联，读不到时用占位
      imagePlaceholder: IMAGE_PLACEHOLDER,
      // 离屏容器本身透明且固定定位，截图副本要恢复为可见的普通流
      style: { opacity: "1", position: "static", zIndex: "auto" },
    });
    const blockedImages = await drawImages(canvas, slots);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png"),
    );
    if (!blob) throw new Error("浏览器未生成图片");

    downloadBlob(blob, buildFileName(markdown));
    if (blockedImages.length > 0) {
      // 导出本身成功，用警告而不是报错样式
      toast(
        `长图已导出，${blockedImages.length} 张图片无法读取，已用占位图代替`,
        { id: toastId, icon: "⚠️", duration: 5000 },
      );
    } else {
      toast.success("长图已导出", { id: toastId });
    }
  } catch (error) {
    console.error("导出长图失败:", error);
    const message = error instanceof Error ? error.message : String(error);
    toast.error(`导出长图失败: ${message}`, { id: toastId });
  } finally {
    container?.remove();
    exporting = false;
  }
}
