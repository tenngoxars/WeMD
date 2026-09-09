import { createRequire } from "node:module";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, parse, resolve } from "node:path";
import { createMarkdownParser, processHtml } from "@wemd/core";
import { parseMarkdownFileContent } from "@wemd/core/markdown-file-meta";
import { chromium } from "playwright";
import { CliError, resolveThemeForArticle } from "./index.js";
import { rasterizeFormulaImages } from "./math-images.js";

export interface RenderResult {
  schemaVersion: 1;
  cliVersion: string;
  inputPath: string;
  theme: {
    reference: string;
    fingerprint: string;
    source: "builtin" | "workspace" | "file";
  };
  outputs: {
    fragment: string;
    preview: string;
    report: string;
    copy?: string;
  };
  warnings: string[];
  errors: string[];
  stats: {
    images: number;
    mermaid: number;
    tables: number;
    math: number;
    complexMath: number;
    mathImages: number;
  };
  compatibility: {
    images: {
      status: "ready" | "warning" | "blocked";
      warnings: string[];
      errors: string[];
    };
    mermaid: {
      status: "not-present" | "rendered" | "warning";
      rendered: number;
      warnings: string[];
    };
    math: {
      status: "not-present" | "ready" | "warning";
      total: number;
      complex: number;
      imageFallbacks: number;
    };
    strict: { enabled: boolean; errors: string[] };
  };
  copy:
    | { status: "not-requested"; requiresExactHtmlTransport: boolean }
    | {
        status: "ready" | "blocked";
        requiresExactHtmlTransport: boolean;
        preferredTransport: "selection" | "exact-html-event";
        fallbackTransport: "clipboard-api";
      };
  open:
    | { status: "not-requested" }
    | { status: "opened" }
    | { status: "failed"; error: string };
}

export interface RenderOptions {
  article: string;
  theme?: string;
  themeFile?: string;
  outDir?: string;
  linkFootnotes: boolean;
  tableWrap: boolean;
  codeMacBar: boolean;
  strict: boolean;
}

const require = createRequire(import.meta.url);
const KATEX_CSS_PATH = require.resolve("katex/dist/katex.min.css");
const MERMAID_SCRIPT_PATH = require.resolve("mermaid/dist/mermaid.min.js");

const htmlEscape = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;");

const removeUntrustedExecutableMarkup = (html: string): string =>
  html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<script\b[^>]*\/?\s*>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, "")
    .replace(/<\/?(?:iframe|object|embed|link|meta)\b[^>]*>/gi, "")
    .replace(/\son[a-z]+\s*=\s*(?:\"[^\"]*\"|'[^']*'|[^\s>]+)/gi, "");

const stripCounterPseudoRules = (css: string): string =>
  css.replace(
    /([^{}]+?):{1,2}(before|after)\s*\{([^{}]*)\}/gi,
    (full, _selector: string, _pseudo: string, body: string) =>
      /content\s*:[^;{}]*\bcounters?\s*\(/i.test(body) ? "" : full,
  );

const unsafeCssReason = (css: string): string | null => {
  if (/@import\b|expression\s*\(|behavior\s*:/i.test(css))
    return "主题 CSS 包含不允许的可执行或外部导入规则";
  if (/url\(\s*['\"]?\s*(?:javascript:|file:|blob:)/i.test(css))
    return "主题 CSS 包含不允许的 URL";
  return null;
};

const previewDocument = (
  title: string,
  css: string,
  fragment: string,
): string =>
  `<!doctype html>
<html lang="zh-CN">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${htmlEscape(title)}</title><style>${css.replace(/<\/style/gi, "<\\/style")}</style></head>
<body>${fragment}</body>
</html>
`;

export async function atomicWrite(
  path: string,
  content: string,
): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = join(
    dirname(path),
    `.${basename(path)}.${process.pid}.${Date.now()}.tmp`,
  );
  try {
    await writeFile(temporary, content, "utf8");
    await rename(temporary, path);
  } catch (error) {
    try {
      await unlink(temporary);
    } catch {
      // Best-effort cleanup; the reportable error remains the original write failure.
    }
    throw error;
  }
}

async function normalizeInChromium(
  sourceHtml: string,
  css: string,
  options: Pick<RenderOptions, "linkFootnotes" | "tableWrap">,
  materializeCounters: boolean,
): Promise<{
  fragment: string;
  warnings: string[];
  errors: string[];
  requiresExactHtmlTransport: boolean;
  compatibility: {
    imageWarnings: string[];
    imageErrors: string[];
    mermaidWarnings: string[];
  };
  stats: {
    images: number;
    mermaid: number;
    tables: number;
    math: number;
    complexMath: number;
    mathImages: number;
  };
}> {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (error) {
    throw new CliError(
      `无法启动 Playwright Chromium：${error instanceof Error ? error.message : String(error)}`,
      5,
    );
  }

  try {
    const authoredRootBackground = Array.from(
      css.matchAll(/#wemd\s*\{([^{}]*)\}/gi),
    )
      .map((match) => match[1])
      .filter((rule) => /\bbackground(?:-image)?\s*:/i.test(rule))
      .join(";");
    const page = await browser.newPage({
      viewport: { width: 760, height: 1200 },
      deviceScaleFactor: 2,
    });
    await page.setContent(
      `<!doctype html><html><head><style>${css.replace(/<\/style/gi, "<\\/style")}</style></head><body>${sourceHtml}</body></html>`,
      {
        waitUntil: "domcontentloaded",
      },
    );
    await page.addScriptTag({ path: MERMAID_SCRIPT_PATH });
    const mathImages = await rasterizeFormulaImages(page);
    const normalized = await page.evaluate(
      async ({
        linkFootnotes,
        tableWrap,
        materializeCounters,
        rootBackgroundCss,
      }) => {
        const root = document.body;
        const warnings: string[] = [];
        const errors: string[] = [];
        const imageWarnings: string[] = [];
        const imageErrors: string[] = [];
        const mermaidWarnings: string[] = [];
        let mermaid = 0;

        root.querySelectorAll("script, input").forEach((node) => node.remove());
        root.querySelectorAll("*").forEach((element) => {
          Array.from(element.attributes).forEach((attribute) => {
            if (
              /^on/i.test(attribute.name) ||
              attribute.name === "data-tool" ||
              (attribute.name.startsWith("data-wemd-") &&
                attribute.name !== "data-wemd-generated") ||
              attribute.name === "contenteditable"
            ) {
              element.removeAttribute(attribute.name);
            }
          });

          const style = element instanceof HTMLElement ? element.style : null;
          if (!style) return;
          for (let index = style.length - 1; index >= 0; index -= 1) {
            const property = style.item(index);
            if (property.startsWith("--")) {
              style.removeProperty(property);
              continue;
            }
            const value = style.getPropertyValue(property);
            if (value.includes("var(")) {
              style.setProperty(
                property,
                getComputedStyle(element).getPropertyValue(property),
              );
            }
          }
          if (!style.cssText.trim()) element.removeAttribute("style");
        });

        const articleRoot = root.querySelector<HTMLElement>("#wemd");
        if (!articleRoot) throw new Error("WeMD render root is missing");

        // Ported from apps/web/src/services/wechatCounterCompat.ts (baseline 964525d):
        // resolve real computed counter state instead of guessing headings by tag name.
        if (materializeCounters) {
          const scopes = new Map<
            string,
            Array<{ depth: number; value: number }>
          >();
          const operations = (input: string, reset: boolean) => {
            if (
              !input ||
              /^(none|normal|initial|unset|inherit|revert)/i.test(input.trim())
            )
              return [];
            return Array.from(
              input.matchAll(/([a-zA-Z_][\w-]*)(?:\s+(-?\d+))?/g),
            ).map((match) => ({
              name: match[1],
              value: match[2] ? Number.parseInt(match[2], 10) : reset ? 0 : 1,
            }));
          };
          const applyOperations = (
            style: CSSStyleDeclaration,
            depth: number,
          ) => {
            scopes.forEach((items, name) => {
              const next = items.filter((item) => item.depth <= depth);
              if (next.length) scopes.set(name, next);
              else scopes.delete(name);
            });
            operations(style.getPropertyValue("counter-reset"), true).forEach(
              ({ name, value }) => {
                const items = scopes.get(name) || [];
                const index = items.findIndex((item) => item.depth === depth);
                if (index >= 0) items[index] = { depth, value };
                else items.push({ depth, value });
                scopes.set(name, items);
              },
            );
            operations(
              style.getPropertyValue("counter-increment"),
              false,
            ).forEach(({ name, value }) => {
              const items = scopes.get(name) || [{ depth, value: 0 }];
              items[items.length - 1] = {
                ...items[items.length - 1],
                value: items[items.length - 1].value + value,
              };
              scopes.set(name, items);
            });
          };
          const format = (value: number, style = "decimal") => {
            if (style.trim() === "decimal-leading-zero")
              return value >= 0 && value < 10 ? `0${value}` : String(value);
            return String(value);
          };
          const content = (template: string) =>
            Array.from(
              template.matchAll(
                /counter\(([^,)]+)(?:,\s*([^)]*))?\)|"((?:\\.|[^\\"])*)"|'((?:\\.|[^\\'])*)'/gi,
              ),
            )
              .map((match) => {
                if (match[1]) {
                  const values = scopes.get(match[1].trim());
                  return format(values?.at(-1)?.value ?? 0, match[2]);
                }
                return (match[3] ?? match[4] ?? "").replace(/\\A\s?/g, "\n");
              })
              .join("");
          const insertPseudo = (
            element: HTMLElement,
            pseudo: "before" | "after",
            depth: number,
          ) => {
            const style = getComputedStyle(element, `::${pseudo}`);
            applyOperations(style, depth);
            const value = content(style.content || "");
            if (!value) return;
            const node = document.createElement("span");
            node.textContent = value;
            node.setAttribute("data-wemd-counter-generated", pseudo);
            [
              "color",
              "font-family",
              "font-size",
              "font-style",
              "font-weight",
              "line-height",
              "letter-spacing",
              "display",
              "vertical-align",
              "padding",
              "margin",
            ].forEach((name) => {
              const property = style.getPropertyValue(name).trim();
              if (property && !/^(none|normal|initial)$/i.test(property))
                node.style.setProperty(name, property);
            });
            if (pseudo === "before") element.prepend(node);
            else element.append(node);
          };
          const walk = (element: HTMLElement, depth: number) => {
            applyOperations(getComputedStyle(element), depth);
            const children = Array.from(element.children).filter(
              (child): child is HTMLElement => child instanceof HTMLElement,
            );
            insertPseudo(element, "before", depth);
            children.forEach((child) => walk(child, depth + 1));
            insertPseudo(element, "after", depth);
          };
          walk(articleRoot, 0);
        }

        // Ported from apps/web/src/services/wechatMermaidRenderer.ts (baseline 964525d):
        // Mermaid itself produces SVG, then the SVG is rasterized to a generated PNG.
        const mermaidApi = (
          window as unknown as {
            mermaid?: {
              initialize: (config: object) => void;
              render: (id: string, diagram: string) => Promise<{ svg: string }>;
            };
          }
        ).mermaid;
        mermaidApi?.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          flowchart: { htmlLabels: false },
        });
        for (const [index, block] of Array.from(
          articleRoot.querySelectorAll<HTMLPreElement>("pre.mermaid"),
        ).entries()) {
          try {
            if (!mermaidApi) throw new Error("Mermaid runtime unavailable");
            const rendered = await mermaidApi.render(
              `wemd-cli-mermaid-${index}`,
              block.textContent || "",
            );
            const holder = document.createElement("div");
            holder.innerHTML = rendered.svg;
            const svg = holder.querySelector("svg");
            if (!svg) throw new Error("Mermaid did not return SVG");
            svg
              .querySelectorAll("image,foreignObject")
              .forEach((node) => node.remove());
            const viewBox = svg
              .getAttribute("viewBox")
              ?.trim()
              .split(/[\s,]+/)
              .map(Number);
            const width =
              Number.parseFloat(svg.getAttribute("width") || "") ||
              viewBox?.[2] ||
              400;
            const height =
              Number.parseFloat(svg.getAttribute("height") || "") ||
              viewBox?.[3] ||
              300;
            svg.setAttribute("width", String(width));
            svg.setAttribute("height", String(height));
            svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
            const blobUrl = URL.createObjectURL(
              new Blob([new XMLSerializer().serializeToString(svg)], {
                type: "image/svg+xml;charset=utf-8",
              }),
            );
            const image = new Image();
            image.src = blobUrl;
            await new Promise<void>((resolve, reject) => {
              image.onload = () => resolve();
              image.onerror = () =>
                reject(new Error("Mermaid SVG cannot be loaded"));
            });
            const canvas = document.createElement("canvas");
            canvas.width = width * 3;
            canvas.height = height * 3;
            const context = canvas.getContext("2d");
            if (!context) throw new Error("Mermaid PNG canvas unavailable");
            context.scale(3, 3);
            context.fillStyle = "#ffffff";
            context.fillRect(0, 0, width, height);
            context.drawImage(image, 0, 0);
            URL.revokeObjectURL(blobUrl);
            const figure = document.createElement("div");
            figure.style.margin = "1em 0";
            figure.style.textAlign = "center";
            const png = document.createElement("img");
            png.src = canvas.toDataURL("image/png");
            png.alt = "Mermaid diagram";
            png.setAttribute("data-wemd-generated", "mermaid");
            png.style.width = "100%";
            png.style.height = "auto";
            figure.append(png);
            block.replaceWith(figure);
            mermaid += 1;
          } catch (error) {
            const warning = `Mermaid 渲染失败：${error instanceof Error ? error.message : String(error)}`;
            warnings.push(warning);
            mermaidWarnings.push(warning);
            block.remove();
          }
        }

        // Equivalent to apps/web/src/services/wechatTableRenderer.ts: --table-wrap
        // permits content wrapping; otherwise retain the scroll-container behavior.
        articleRoot
          .querySelectorAll<HTMLTableElement>("table")
          .forEach((table) => {
            const container = table.parentElement?.classList.contains(
              "table-container",
            )
              ? table.parentElement
              : (() => {
                  const wrapper = document.createElement("section");
                  wrapper.className = "table-container";
                  table.replaceWith(wrapper);
                  wrapper.append(table);
                  return wrapper;
                })();
            container.style.overflowX = tableWrap ? "visible" : "auto";
            if (!tableWrap)
              container.style.setProperty(
                "-webkit-overflow-scrolling",
                "touch",
              );
            table.style.borderCollapse = "collapse";
            table.style.tableLayout = "auto";
            table.style.width = tableWrap ? "100%" : "auto";
            table.style.minWidth = tableWrap ? "0" : "100%";
            table.style.whiteSpace = tableWrap ? "normal" : "nowrap";
            table.querySelectorAll<HTMLElement>("th,td").forEach((cell) => {
              cell.style.lineHeight = "1.4";
              cell.style.padding = "6px 8px";
              cell.style.textAlign = "center";
              cell.style.whiteSpace = tableWrap ? "normal" : "nowrap";
              cell.style.overflowWrap = tableWrap ? "anywhere" : "";
              cell.style.wordBreak = tableWrap ? "break-word" : "";
              if (tableWrap) cell.style.minWidth = "0";
            });
          });

        // Ported from apps/web/src/services/wechatCopyService.ts and
        // apps/web/src/utils/linkFootnote.ts (baseline 964525d): external links
        // become non-clickable footnotes, while WeChat-internal and anchors stay.
        if (linkFootnotes) {
          const links = Array.from(
            articleRoot.querySelectorAll<HTMLAnchorElement>("a[href]"),
          ).filter((link) => {
            const href = link.getAttribute("href") || "";
            return /^https?:/i.test(href) && !href.includes("mp.weixin.qq.com");
          });
          if (links.length > 0) {
            const footnotes = document.createElement("section");
            footnotes.className = "wemd-link-footnotes";
            links.forEach((link, index) => {
              const href = link.getAttribute("href") || "";
              const word = document.createElement("span");
              word.className = "footnote-word";
              word.textContent = link.textContent?.trim() || href;
              const marker = document.createElement("sup");
              marker.textContent = `[${index + 1}]`;
              link.replaceWith(word, marker);
              const line = document.createElement("p");
              line.textContent = `[${index + 1}] ${word.textContent}\n${href}`;
              footnotes.append(line);
            });
            const separator = document.createElement("h3");
            separator.className = "footnotes-sep";
            articleRoot.append(separator);
            articleRoot.append(footnotes);
          }
        }

        // Formulae that failed the CLI screenshot fallback remain readable.
        articleRoot
          .querySelectorAll(
            '.katex-mathml, annotation[encoding="application/x-tex"]',
          )
          .forEach((node) => node.remove());
        articleRoot
          .querySelectorAll<HTMLElement>("[data-latex]")
          .forEach((node) => node.removeAttribute("data-latex"));
        articleRoot
          .querySelectorAll<HTMLElement>(".katex, .katex-html, .base")
          .forEach((node) =>
            node.style.setProperty("white-space", "nowrap", "important"),
          );

        articleRoot
          .querySelectorAll<HTMLElement>("pre > code")
          .forEach((code) => {
            const walker = document.createTreeWalker(
              code,
              NodeFilter.SHOW_TEXT,
            );
            const textNodes: Text[] = [];
            let node = walker.nextNode();
            while (node) {
              textNodes.push(node as Text);
              node = walker.nextNode();
            }
            textNodes.forEach((textNode) => {
              if (!/[\r\n]/.test(textNode.data)) return;
              const fragment = document.createDocumentFragment();
              textNode.data.split(/\r\n?|\n/).forEach((line, index) => {
                if (index) fragment.append(document.createElement("br"));
                if (line) fragment.append(document.createTextNode(line));
              });
              textNode.replaceWith(fragment);
            });
          });
        const rootComputed = getComputedStyle(articleRoot);
        // juice intentionally omits some CSS image declarations while inlining.
        // Preserve the authored #wemd background as a fallback, matching the
        // Web background-canvas pass instead of silently dropping it.
        const authoredBackground = document.createElement("div");
        authoredBackground.style.cssText = rootBackgroundCss;
        const backgroundValue = (name: string) => {
          const computed = rootComputed.getPropertyValue(name).trim();
          const authored = authoredBackground.style.getPropertyValue(name);
          return name === "background-image" && /^none$/i.test(computed)
            ? authored || computed
            : computed || authored;
        };
        const continuousBackground =
          backgroundValue("background-image") &&
          !/^none$/i.test(backgroundValue("background-image").trim());
        // Ported from apps/web/src/services/wechatBackgroundCanvas.ts and
        // wechatCopyNormalizer.ts (baseline 964525d): preserve continuous
        // backgrounds as longhands; otherwise migrate root padding to content.
        if (continuousBackground) {
          articleRoot.style.removeProperty("background");
          [
            "background-color",
            "background-image",
            "background-position",
            "background-size",
            "background-repeat",
            "background-origin",
            "background-clip",
            "background-attachment",
          ].forEach((name) =>
            articleRoot.style.setProperty(name, backgroundValue(name)),
          );
        } else {
          const paddingLeft = rootComputed.paddingLeft;
          const paddingRight = rootComputed.paddingRight;
          const paddingTop = rootComputed.paddingTop;
          const paddingBottom = rootComputed.paddingBottom;
          if (paddingLeft || paddingRight) {
            Array.from(articleRoot.children).forEach((child) => {
              if (!(child instanceof HTMLElement)) return;
              const useMargin = /^(H[1-6]|BLOCKQUOTE|PRE|HR)$/i.test(
                child.tagName,
              );
              if (paddingLeft) {
                const property = useMargin ? "margin-left" : "padding-left";
                child.style.setProperty(
                  property,
                  child.style.getPropertyValue(property) || paddingLeft,
                );
              }
              if (paddingRight) {
                const property = useMargin ? "margin-right" : "padding-right";
                child.style.setProperty(
                  property,
                  child.style.getPropertyValue(property) || paddingRight,
                );
              }
            });
          }
          if (paddingTop || paddingBottom) {
            const wrapper = document.createElement("div");
            wrapper.style.display = "block";
            wrapper.style.width = "100%";
            wrapper.style.boxSizing = "border-box";
            if (paddingTop) wrapper.style.paddingTop = paddingTop;
            if (paddingBottom) wrapper.style.paddingBottom = paddingBottom;
            while (articleRoot.firstChild)
              wrapper.append(articleRoot.firstChild);
            articleRoot.append(wrapper);
          }
          [
            "padding",
            "padding-left",
            "padding-right",
            "padding-top",
            "padding-bottom",
          ].forEach((name) => articleRoot.style.removeProperty(name));
        }
        if (!continuousBackground && articleRoot.tagName === "SECTION") {
          const replacement = document.createElement("div");
          Array.from(articleRoot.attributes).forEach((attribute) =>
            replacement.setAttribute(attribute.name, attribute.value),
          );
          while (articleRoot.firstChild)
            replacement.append(articleRoot.firstChild);
          articleRoot.replaceWith(replacement);
          replacement.id = "wemd";
        }
        const finalRoot =
          root.querySelector<HTMLElement>("#wemd") || articleRoot;
        const rootBackground =
          finalRoot.style.backgroundColor || finalRoot.style.background;
        if (
          !continuousBackground &&
          rootBackground &&
          !/^transparent$/i.test(rootBackground.trim())
        ) {
          finalRoot.style.removeProperty("background");
          finalRoot.style.removeProperty("background-color");
          finalRoot
            .querySelectorAll<HTMLElement>(
              "p,h1,h2,h3,h4,h5,h6,ul,ol,li,section,figure,figcaption",
            )
            .forEach((block) => {
              if (!block.style.background && !block.style.backgroundColor) {
                block.style.backgroundColor = rootBackground;
              }
            });
        }
        finalRoot.removeAttribute("id");
        finalRoot
          .querySelectorAll<HTMLElement>(
            "[data-tool],[data-wemd-counter-generated]",
          )
          .forEach((node) => {
            node.removeAttribute("data-tool");
            node.removeAttribute("data-wemd-counter-generated");
          });
        finalRoot.querySelectorAll<HTMLElement>("*").forEach((element) => {
          const hasText = Array.from(element.childNodes).some(
            (node) =>
              node.nodeType === Node.TEXT_NODE && node.textContent?.trim(),
          );
          if (hasText && !element.style.color) {
            element.style.color = getComputedStyle(element).color || "#1a1a1a";
          }
        });

        const inspectUrl = (
          source: string,
          kind: "image" | "navigation",
          generatedImage = false,
        ) => {
          const value = source.trim();
          if (!value || value.startsWith("#")) return;
          if (/^https:/i.test(value)) return;
          if (/^http:/i.test(value)) {
            if (kind === "image") {
              const warning = `非 HTTPS 图片可能无法被公众号保留：${value}`;
              warnings.push(warning);
              imageWarnings.push(warning);
            }
            return;
          }
          if (
            kind === "image" &&
            generatedImage &&
            /^data:image\/png;base64,/i.test(value)
          )
            return;
          errors.push(
            `不允许用于发布的 ${kind === "image" ? "图片" : "导航"} URL：${value}`,
          );
          if (kind === "image") {
            imageErrors.push(`不允许用于发布的 图片 URL：${value}`);
          }
        };
        finalRoot
          .querySelectorAll<HTMLElement>(
            "[href],[action],[formaction],[poster],[cite],[xlink\\:href]",
          )
          .forEach((element) => {
            [
              "href",
              "action",
              "formaction",
              "poster",
              "cite",
              "xlink:href",
            ].forEach((name) => {
              const value = element.getAttribute(name);
              if (value !== null) inspectUrl(value, "navigation");
            });
          });
        finalRoot
          .querySelectorAll<HTMLImageElement>("img[src]")
          .forEach((image) => {
            inspectUrl(
              image.getAttribute("src") || "",
              "image",
              ["mermaid", "formula"].includes(
                image.getAttribute("data-wemd-generated") || "",
              ),
            );
            image.removeAttribute("data-wemd-generated");
          });
        // The Web publisher removes non-image runtime media. Keep the CLI
        // boundary equally explicit: every remaining resource URL must be
        // publishable, and generated Mermaid/formula images may retain data PNG.
        finalRoot.querySelectorAll<HTMLElement>("[src]").forEach((element) => {
          if (element.tagName === "IMG") return;
          inspectUrl(element.getAttribute("src") || "", "navigation");
        });
        finalRoot
          .querySelectorAll<HTMLElement>("[srcset]")
          .forEach((element) => {
            const sourceSet = element.getAttribute("srcset") || "";
            if (
              /\b(?:data:|javascript:|file:|blob:)|(?:^|,)\s*(?:\/|\.\.?\/)/i.test(
                sourceSet,
              )
            ) {
              const error = `不允许用于发布的 srcset：${sourceSet}`;
              errors.push(error);
              imageErrors.push(error);
            } else {
              sourceSet
                .split(",")
                .forEach((candidate) =>
                  inspectUrl(candidate.trim().split(/\s+/)[0] || "", "image"),
                );
            }
          });

        finalRoot.querySelectorAll<HTMLElement>("*").forEach((element) => {
          const style = element.getAttribute("style") || "";
          if (
            /expression\s*\(|behavior\s*:|url\(\s*['\"]?\s*(?:javascript:|file:|blob:)/i.test(
              style,
            )
          ) {
            errors.push("fragment 包含不安全的 CSS URL 或表达式");
          }
        });
        const fragment = finalRoot.outerHTML.trim();
        if (
          /<script\b|\son[a-z]+\s*=|\bvar\(|<input\b|<pre[^>]*\bmermaid\b|javascript\s*:/i.test(
            fragment,
          )
        ) {
          errors.push("fragment 未满足发布安全清理要求");
        }
        return {
          fragment,
          warnings: [...new Set(warnings)].sort(),
          errors: [...new Set(errors)].sort(),
          requiresExactHtmlTransport: Boolean(continuousBackground),
          compatibility: {
            imageWarnings: [...new Set(imageWarnings)].sort(),
            imageErrors: [...new Set(imageErrors)].sort(),
            mermaidWarnings: [...new Set(mermaidWarnings)].sort(),
          },
          stats: {
            images: finalRoot.querySelectorAll("img").length,
            mermaid,
            tables: finalRoot.querySelectorAll("table").length,
            math: 0,
            complexMath: 0,
            mathImages: 0,
          },
        };
      },
      {
        linkFootnotes: options.linkFootnotes,
        tableWrap: options.tableWrap,
        materializeCounters,
        rootBackgroundCss: authoredRootBackground,
      },
    );
    return {
      ...normalized,
      warnings: [
        ...new Set([...normalized.warnings, ...mathImages.warnings]),
      ].sort(),
      stats: {
        ...normalized.stats,
        math: mathImages.total,
        complexMath: mathImages.complex,
        mathImages: mathImages.converted,
      },
    };
  } catch (error) {
    if (error instanceof CliError) throw error;
    throw new CliError(
      `Chromium DOM 规范化失败：${error instanceof Error ? error.message : String(error)}`,
      5,
    );
  } finally {
    await browser.close();
  }
}

export async function writeRenderReport(result: RenderResult): Promise<void> {
  await atomicWrite(
    result.outputs.report,
    `${JSON.stringify(result, null, 2)}\n`,
  );
}

async function renderArticleExecution(
  options: RenderOptions,
  allowBlockedOutput = false,
): Promise<RenderResult> {
  const inputPath = resolve(options.article);
  let article;
  try {
    article = await readFile(inputPath, "utf8");
  } catch (error) {
    throw new CliError(
      `无法读取文章：${error instanceof Error ? error.message : String(error)}`,
      3,
    );
  }
  const meta = parseMarkdownFileContent(article);
  const resolvedTheme = await resolveThemeForArticle(
    inputPath,
    options.theme,
    options.themeFile,
  );
  const katexCss = await readFile(KATEX_CSS_PATH, "utf8");
  const themeSafetyError = unsafeCssReason(resolvedTheme.theme.css);
  if (themeSafetyError) throw new CliError(themeSafetyError, 4);
  const parser = createMarkdownParser({
    mathRenderer: "katex",
    showMacBar: options.codeMacBar,
  });
  const rawHtml = removeUntrustedExecutableMarkup(parser.render(meta.body));
  const renderCss = `${resolvedTheme.theme.css}\n${katexCss}`;
  const styledHtml = processHtml(
    rawHtml,
    stripCounterPseudoRules(renderCss),
    true,
    true,
  );
  const normalized = await normalizeInChromium(
    styledHtml,
    renderCss,
    options,
    /\bcounter\s*\(/i.test(resolvedTheme.theme.css),
  );
  const warnings = [...resolvedTheme.warnings, ...normalized.warnings].sort();
  const strictErrors = options.strict
    ? warnings.map((warning) => `--strict 拒绝警告：${warning}`)
    : [];
  const blockingErrors = [...normalized.errors, ...strictErrors];
  if (blockingErrors.length > 0 && !allowBlockedOutput) {
    throw new CliError(blockingErrors[0], 4);
  }

  const outputDirectory = resolve(options.outDir ?? dirname(inputPath));
  const stem = parse(inputPath).name || basename(inputPath, extname(inputPath));
  const fragmentPath = join(outputDirectory, `${stem}.fragment.html`);
  const previewPath = join(outputDirectory, `${stem}.preview.html`);
  const reportPath = join(outputDirectory, `${stem}.report.json`);
  if ([fragmentPath, previewPath, reportPath].includes(inputPath)) {
    throw new CliError("输出路径不能覆盖输入 Markdown", 6);
  }
  const result: RenderResult = {
    schemaVersion: 1,
    cliVersion: "0.1.0",
    inputPath,
    theme: {
      reference: resolvedTheme.theme.reference,
      fingerprint: resolvedTheme.theme.fingerprint,
      source: resolvedTheme.theme.source,
    },
    outputs: {
      fragment: fragmentPath,
      preview: previewPath,
      report: reportPath,
    },
    warnings,
    errors: blockingErrors,
    stats: normalized.stats,
    compatibility: {
      images: {
        status:
          normalized.compatibility.imageErrors.length > 0
            ? "blocked"
            : normalized.compatibility.imageWarnings.length > 0
              ? "warning"
              : "ready",
        warnings: normalized.compatibility.imageWarnings,
        errors: normalized.compatibility.imageErrors,
      },
      mermaid: {
        status:
          normalized.compatibility.mermaidWarnings.length > 0
            ? "warning"
            : normalized.stats.mermaid > 0
              ? "rendered"
              : "not-present",
        rendered: normalized.stats.mermaid,
        warnings: normalized.compatibility.mermaidWarnings,
      },
      math: {
        status:
          normalized.stats.math === 0
            ? "not-present"
            : normalized.stats.complexMath > normalized.stats.mathImages
              ? "warning"
              : "ready",
        total: normalized.stats.math,
        complex: normalized.stats.complexMath,
        imageFallbacks: normalized.stats.mathImages,
      },
      strict: { enabled: options.strict, errors: strictErrors },
    },
    copy: {
      status: "not-requested",
      requiresExactHtmlTransport: normalized.requiresExactHtmlTransport,
    },
    open: { status: "not-requested" },
  };
  const publishableFragment =
    blockingErrors.length > 0
      ? '<div data-wemd-copy-blocked style="padding:24px;border:1px solid #d77;color:#8b1e1e;background:#fff5f5;">正文因发布安全检查未通过而未嵌入此页面。请根据报告修正后重新生成。</div>'
      : normalized.fragment;
  try {
    await atomicWrite(fragmentPath, `${publishableFragment}\n`);
    await atomicWrite(
      previewPath,
      previewDocument(meta.title || stem, renderCss, publishableFragment),
    );
    await writeRenderReport(result);
  } catch (error) {
    throw new CliError(
      `无法写入渲染产物：${error instanceof Error ? error.message : String(error)}`,
      6,
    );
  }
  return result;
}

export async function renderArticle(
  options: RenderOptions,
): Promise<RenderResult> {
  return renderArticleExecution(options);
}

export async function renderArticleForCopy(
  options: RenderOptions,
): Promise<RenderResult> {
  return renderArticleExecution(options, true);
}
