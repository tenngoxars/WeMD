import { constants, deflateSync, inflateSync } from "node:zlib";
import type { Page } from "playwright";

const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
const FORMULA_SELECTOR =
  ".inline-equation[data-latex], .block-equation[data-latex]";

interface PngChunk {
  type: string;
  data: Buffer;
}

export interface FormulaImage {
  index: number;
  display: "inline" | "block";
  cssWidth: number;
  cssHeight: number;
  pixelWidth: number;
  pixelHeight: number;
  rawBytes: number;
  optimizedBytes: number;
}

export interface FormulaImageResult {
  total: number;
  complex: number;
  converted: number;
  rawBytes: number;
  optimizedBytes: number;
  warnings: string[];
  images: FormulaImage[];
}

const crcTable = Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit += 1) {
    crc = (crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1) >>> 0;
  }
  return crc;
});

const crc32 = (value: Buffer): number => {
  let crc = 0xffffffff;
  for (const byte of value) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
};

const parsePng = (png: Buffer): PngChunk[] => {
  if (
    png.length < PNG_SIGNATURE.length ||
    !png.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)
  ) {
    throw new Error("无效的 PNG 签名");
  }
  const chunks: PngChunk[] = [];
  let offset = PNG_SIGNATURE.length;
  while (offset < png.length) {
    if (offset + 12 > png.length) throw new Error("PNG chunk 不完整");
    const length = png.readUInt32BE(offset);
    const end = offset + 12 + length;
    if (end > png.length) throw new Error("PNG chunk 长度越界");
    const type = png.toString("ascii", offset + 4, offset + 8);
    chunks.push({ type, data: png.subarray(offset + 8, offset + 8 + length) });
    offset = end;
    if (type === "IEND") break;
  }
  if (!chunks.some(({ type }) => type === "IHDR"))
    throw new Error("PNG 缺少 IHDR");
  if (!chunks.some(({ type }) => type === "IDAT"))
    throw new Error("PNG 缺少 IDAT");
  return chunks;
};

const encodeChunk = ({ type, data }: PngChunk): Buffer => {
  const typeBuffer = Buffer.from(type, "ascii");
  const chunk = Buffer.allocUnsafe(data.length + 12);
  chunk.writeUInt32BE(data.length, 0);
  typeBuffer.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(
    crc32(Buffer.concat([typeBuffer, data])),
    data.length + 8,
  );
  return chunk;
};

const rebuildPng = (chunks: PngChunk[], idat: Buffer): Buffer => {
  let wroteIdat = false;
  const output: Buffer[] = [PNG_SIGNATURE];
  for (const chunk of chunks) {
    if (chunk.type !== "IDAT") {
      output.push(encodeChunk(chunk));
      continue;
    }
    if (!wroteIdat) {
      output.push(encodeChunk({ type: "IDAT", data: idat }));
      wroteIdat = true;
    }
  }
  return Buffer.concat(output);
};

/** Recompresses Chromium's PNG scanlines without changing any pixels. */
export const optimizePngLosslessly = (png: Buffer): Buffer => {
  const chunks = parsePng(png);
  const compressed = Buffer.concat(
    chunks.filter(({ type }) => type === "IDAT").map(({ data }) => data),
  );
  const scanlines = inflateSync(compressed);
  const candidates = [
    constants.Z_DEFAULT_STRATEGY,
    constants.Z_FILTERED,
    constants.Z_RLE,
  ].map((strategy) =>
    deflateSync(scanlines, { level: 9, memLevel: 9, strategy }),
  );
  const smallest = candidates.reduce((best, candidate) =>
    candidate.length < best.length ? candidate : best,
  );
  const rebuilt = rebuildPng(chunks, smallest);
  return rebuilt.length < png.length ? rebuilt : png;
};

const pngSize = (png: Buffer): { width: number; height: number } => {
  const ihdr = parsePng(png).find(({ type }) => type === "IHDR");
  if (!ihdr || ihdr.data.length < 8) throw new Error("PNG IHDR 不完整");
  return {
    width: ihdr.data.readUInt32BE(0),
    height: ihdr.data.readUInt32BE(4),
  };
};

/** Replaces rendered KaTeX nodes with self-contained, losslessly compressed 2x PNG images. */
export async function rasterizeFormulaImages(
  page: Page,
): Promise<FormulaImageResult> {
  await page.evaluate(() => document.fonts.ready);
  const formulaKinds = await page
    .locator(FORMULA_SELECTOR)
    .evaluateAll((nodes) =>
      nodes.map((node, index) => {
        node.setAttribute("data-wemd-raster-index", String(index));
        const element = node as HTMLElement;
        const latex = element.getAttribute("data-latex") || "";
        return (
          element.classList.contains("block-equation") ||
          Boolean(element.querySelector(".katex-error")) ||
          /\\begin\b|\\(?:dfrac|tfrac|frac|sqrt|vec|hat|bar|tilde|overline|underline)\b|\\(?:partial|nabla|infty|pm|times)\b|[_^]|[=+\-<>]/.test(
            latex,
          )
        );
      }),
    );
  const total = formulaKinds.length;

  const warnings: string[] = [];
  const images: FormulaImage[] = [];
  for (let index = 0; index < total; index += 1) {
    const formula = page.locator(`[data-wemd-raster-index="${index}"]`);
    let veilId: string | undefined;
    try {
      const metadata = await formula.evaluate((node, formulaIndex) => {
        const element = node as HTMLElement;
        const display = element.classList.contains("block-equation");
        let background = "rgb(255, 255, 255)";
        let current: HTMLElement | null = element;
        while (current && current !== document.body) {
          const candidate = getComputedStyle(current).backgroundColor;
          if (
            candidate &&
            candidate !== "transparent" &&
            candidate !== "rgba(0, 0, 0, 0)"
          ) {
            background = candidate;
            break;
          }
          current = current.parentElement;
        }

        const captureId = `wemd-formula-capture-${formulaIndex}`;
        const captureVeilId = `${captureId}-veil`;
        const veil = document.createElement("div");
        veil.id = captureVeilId;
        veil.style.cssText = [
          "position:fixed",
          "inset:0",
          "z-index:2147483646",
          `background:${background}`,
          "pointer-events:none",
        ].join(";");
        const host = document.createElement(display ? "div" : "span");
        host.id = captureId;
        host.style.cssText = [
          "position:absolute",
          "left:0",
          "top:0",
          "z-index:2147483647",
          "display:inline-block",
          "width:max-content",
          "max-width:none",
          "margin:0",
          "padding:4px 6px",
          "box-sizing:content-box",
          `background:${background}`,
          "overflow:visible",
        ].join(";");
        const clone = element.cloneNode(true) as HTMLElement;
        clone.removeAttribute("data-wemd-raster-index");
        clone.style.display = "inline-block";
        clone.style.width = "auto";
        clone.style.maxWidth = "none";
        clone.style.margin = "0";
        clone.style.padding = "0";
        clone.style.overflow = "visible";
        clone
          .querySelectorAll<HTMLElement>(".katex-display,.katex,.katex-html")
          .forEach((child) => {
            child.style.display = "inline-block";
            child.style.width = "auto";
            child.style.maxWidth = "none";
            child.style.margin = "0";
          });
        host.append(clone);
        veil.append(host);
        document.body.append(veil);
        return {
          captureId,
          captureVeilId,
          display,
          latex: element.getAttribute("data-latex") || "数学公式",
        };
      }, index);
      veilId = metadata.captureVeilId;
      const capture = page.locator(`#${metadata.captureId}`);
      const box = await capture.boundingBox();
      if (!box || box.width <= 0 || box.height <= 0)
        throw new Error("公式没有可截图的尺寸");

      const raw = await capture.screenshot({
        type: "png",
        scale: "device",
        animations: "disabled",
        caret: "hide",
        omitBackground: false,
      });
      const optimized = optimizePngLosslessly(raw);
      const pixels = pngSize(optimized);
      const cssWidth = Math.ceil(box.width);
      const cssHeight = Math.ceil(box.height);
      await formula.evaluate(
        (node, image) => {
          const replacement = document.createElement("img");
          replacement.src = image.src;
          replacement.alt = image.alt;
          replacement.width = image.width;
          replacement.height = image.height;
          replacement.setAttribute("data-wemd-generated", "formula");
          replacement.style.width = `${image.width}px`;
          replacement.style.height = `${image.height}px`;
          replacement.style.maxWidth = "100%";
          replacement.style.objectFit = "contain";
          if (image.display) {
            replacement.style.display = "block";
            replacement.style.margin = "1em auto";
          } else {
            replacement.style.display = "inline-block";
            replacement.style.margin = "0 0.08em";
            replacement.style.verticalAlign = "-0.18em";
          }
          node.replaceWith(replacement);
        },
        {
          src: `data:image/png;base64,${optimized.toString("base64")}`,
          alt: metadata.latex,
          width: cssWidth,
          height: cssHeight,
          display: metadata.display,
        },
      );
      images.push({
        index,
        display: metadata.display ? "block" : "inline",
        cssWidth,
        cssHeight,
        pixelWidth: pixels.width,
        pixelHeight: pixels.height,
        rawBytes: raw.length,
        optimizedBytes: optimized.length,
      });
    } catch (error) {
      warnings.push(
        `公式图片化失败，保留可读 HTML：${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      if (veilId) {
        await page
          .locator(`#${veilId}`)
          .evaluate((node) => node.remove())
          .catch(() => {});
      }
    }
  }
  await page
    .locator("[data-wemd-raster-index]")
    .evaluateAll((nodes) =>
      nodes.forEach((node) => node.removeAttribute("data-wemd-raster-index")),
    );
  return {
    total,
    complex: formulaKinds.filter(Boolean).length,
    converted: images.length,
    rawBytes: images.reduce((sum, image) => sum + image.rawBytes, 0),
    optimizedBytes: images.reduce(
      (sum, image) => sum + image.optimizedBytes,
      0,
    ),
    warnings: [...new Set(warnings)],
    images,
  };
}
