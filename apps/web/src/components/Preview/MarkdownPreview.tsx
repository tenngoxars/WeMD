import { useCallback, useEffect, useState, useRef, useMemo } from "react";
import mermaid from "mermaid";
import { createMarkdownParser, processHtml } from "@wemd/core";
import { useEditorStore } from "../../store/editorStore";
import { useFileStore } from "../../store/fileStore";
import { useThemeStore } from "../../store/themeStore";
import { useUITheme } from "../../hooks/useUITheme";
import {
  dirnameOf,
  rewriteLocalImagesInHtml,
} from "../../utils/localImageResolver";
// 公式由 packages/core 的 markdown-it-math 在解析期完成渲染，这里只需要样式
import "katex/dist/katex.min.css";
import { convertLinksToFootnotes } from "../../utils/linkFootnote";
import {
  getPublishingPreference,
  subscribePublishingPreference,
} from "../../store/publishingPreferences";
import {
  getMermaidConfig,
  getThemedMermaidDiagram,
} from "../../utils/mermaidConfig";
import { renderTableBlocksForPreview } from "../../services/wechatTableRenderer";
import {
  shouldSnapToScrollEdge,
  subscribeScrollIntent,
  type ScrollSyncAdapter,
} from "../Workspace/editorPreviewScrollSync";
import {
  mapScrollTopToSourceLine,
  mapSourceLineToScrollTop,
  type ScrollAnchor,
} from "../Workspace/scrollAnchorMapping";
import { fitInlineEquations } from "../../utils/fitInlineEquations";
import {
  hydrateMathJaxEquations,
  loadMathJax,
  needsMathJaxPreview,
} from "../../utils/mathJaxLoader";
import "./MarkdownPreview.css";

interface MarkdownPreviewProps {
  onScrollSyncReady?: (adapter: ScrollSyncAdapter | null) => void;
  onScrollContainerChange?: (container: HTMLDivElement | null) => void;
}

const collectAnchors = (
  root: HTMLElement,
  container: HTMLElement,
): ScrollAnchor[] => {
  const containerRect = container.getBoundingClientRect();
  return Array.from(
    root.querySelectorAll<HTMLElement>("[data-wemd-source-start]"),
  ).flatMap((element) => {
    const startLine = Number(element.dataset.wemdSourceStart);
    const endLine = Number(element.dataset.wemdSourceEnd);
    if (!Number.isFinite(startLine) || !Number.isFinite(endLine)) return [];
    const rect = element.getBoundingClientRect();
    const top = container.scrollTop + rect.top - containerRect.top;
    return [
      {
        startLine,
        endLine,
        top,
        bottom: top + rect.height,
      },
    ];
  });
};

export function MarkdownPreview({
  onScrollSyncReady,
  onScrollContainerChange,
}: MarkdownPreviewProps) {
  const { markdown } = useEditorStore();
  const currentFilePath = useFileStore((state) => state.currentFile?.path);
  // Electron 工作区模式下，以当前文件所在目录作为本地图片的解析基准
  const localImageBaseDir =
    typeof window !== "undefined" && window.electron && currentFilePath
      ? dirnameOf(currentFilePath)
      : null;
  const { themeId: theme, customCSS, getThemeCSS } = useThemeStore();
  const uiTheme = useUITheme((state) => state.theme);
  const [html, setHtml] = useState("");
  const [linkToFootnoteEnabled, setLinkToFootnoteEnabledState] = useState(() =>
    getPublishingPreference("linkToFootnote"),
  );
  const [tableWrapEnabled, setTableWrapEnabledState] = useState(() =>
    getPublishingPreference("tableWrap"),
  );
  const [mathJaxReady, setMathJaxReady] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  // 锚点缓存跨 html 变化保留在 ref 上，内容变了只置空、不重建 adapter
  const anchorCacheRef = useRef<ScrollAnchor[] | null>(null);
  const mermaidRenderIdRef = useRef(0);
  const registerScrollContainer = useCallback(
    (container: HTMLDivElement | null) => {
      scrollContainerRef.current = container;
      onScrollContainerChange?.(container);
    },
    [onScrollContainerChange],
  );

  // 获取当前主题对象（注意与 line 25 的 themeId 区分）
  const currentTheme = useThemeStore(
    (state) =>
      state.customThemes.find((t) => t.id === state.themeId) ||
      state.getAllThemes().find((t) => t.id === state.themeId),
  );
  const designerVars = currentTheme?.designerVariables;
  const showMacBar = designerVars?.showMacBar ?? false;
  const useMathJaxForPreview = needsMathJaxPreview(markdown);

  useEffect(() => {
    if (!useMathJaxForPreview) {
      setMathJaxReady(false);
      return;
    }

    let cancelled = false;
    loadMathJax()
      .then(() => {
        if (!cancelled) setMathJaxReady(true);
      })
      .catch((error) => {
        console.error("MathJax preview load failed:", error);
        if (!cancelled) setMathJaxReady(false);
      });

    return () => {
      cancelled = true;
    };
  }, [useMathJaxForPreview]);

  // 缓存 parser 实例，避免每次渲染都创建新实例
  const parser = useMemo(
    () =>
      createMarkdownParser({
        showMacBar,
        mathRenderer: useMathJaxForPreview && mathJaxReady ? "auto" : "katex",
        includeSourcePosition: true,
      }),
    [showMacBar, useMathJaxForPreview, mathJaxReady],
  );

  useEffect(() => {
    const rawHtml = parser.render(markdown);
    const previewHtml = linkToFootnoteEnabled
      ? convertLinksToFootnotes(rawHtml)
      : rawHtml;

    // 使用 store 中的 getThemeCSS 方法，根据 UI 主题决定是否追加深色模式覆盖
    const isDarkMode = uiTheme === "dark";
    const css = getThemeCSS(theme, isDarkMode);
    // 预览模式不使用内联样式，直接注入 style 标签，大幅降低内存占用
    const styledHtml = processHtml(previewHtml, css, false);

    // 本地图片改写成 wemd-file:// 协议地址，预览才能加载工作区内的图片
    const finalHtml = localImageBaseDir
      ? rewriteLocalImagesInHtml(styledHtml, localImageBaseDir)
      : styledHtml;

    setHtml(finalHtml);
  }, [
    markdown,
    theme,
    customCSS,
    getThemeCSS,
    parser,
    uiTheme,
    linkToFootnoteEnabled,
    localImageBaseDir,
  ]);

  const mermaidTheme = designerVars?.mermaidTheme || "base";
  const mermaidConfigKey = useMemo(() => mermaidTheme, [mermaidTheme]);

  useEffect(() => {
    try {
      mermaid.initialize({ startOnLoad: false });
    } catch (e) {
      console.error("Mermaid initialization failed:", e);
    }
  }, []);

  useEffect(() => {
    if (!previewRef.current || !html) return;

    const mermaidBlocks = Array.from(
      previewRef.current.querySelectorAll<HTMLElement>(".mermaid"),
    );
    if (mermaidBlocks.length === 0) return;
    const renderToken = ++mermaidRenderIdRef.current;

    // 延迟渲染以确保 DOM 更新完成
    const timer = setTimeout(() => {
      const initConfig = getMermaidConfig(designerVars);

      mermaidBlocks.forEach((block, index) => {
        if (!block.dataset.mermaidRaw) {
          block.dataset.mermaidRaw = block.textContent ?? "";
        }
        const diagram = block.dataset.mermaidRaw ?? "";
        if (!diagram.trim()) return;

        const themedDiagram = getThemedMermaidDiagram(diagram, initConfig);

        mermaid
          .render(`preview-${renderToken}-${index}`, themedDiagram)
          .then(({ svg }) => {
            if (mermaidRenderIdRef.current !== renderToken) return;
            block.innerHTML = svg;
          })
          .catch((e) => {
            console.error("Mermaid render error:", e);
          });
      });
    }, 100);

    return () => clearTimeout(timer);
  }, [html, mermaidConfigKey, designerVars]);

  // 表格布局与发布偏好保持一致，开关变化时直接重排现有 DOM。
  useEffect(() => {
    if (!previewRef.current || !html) return;

    const tables = previewRef.current.querySelectorAll(".table-container");
    if (tables.length === 0) return;

    renderTableBlocksForPreview(previewRef.current, tableWrapEnabled);
  }, [html, tableWrapEnabled]);

  // 滚动同步 adapter 的生命周期跟随 DOM 节点，**不能**跟随 html。
  // 挂 html 依赖会导致每敲一个字符都销毁重建一次 adapter，而注册 preview adapter
  // 会触发一次 restoreAfterLayoutChange，于是两个面板被反复强制滚动（表现为一直往上跳）。
  useEffect(() => {
    const container = scrollContainerRef.current;
    const root = previewRef.current;
    if (!container || !root) return;
    let scrollSubscriber: () => void = () => undefined;
    const getAnchors = () => {
      anchorCacheRef.current ??= collectAnchors(root, container);
      return anchorCacheRef.current;
    };
    const getPosition: ScrollSyncAdapter["getPosition"] = () => {
      const max = Math.max(0, container.scrollHeight - container.clientHeight);
      const ratio = max > 0 ? container.scrollTop / max : 0;
      return {
        sourceLine: mapScrollTopToSourceLine(getAnchors(), container.scrollTop),
        ratio,
      };
    };
    const scrollToPosition: ScrollSyncAdapter["scrollToPosition"] = (
      position,
    ) => {
      const max = Math.max(0, container.scrollHeight - container.clientHeight);
      const { sourceLine } = position;
      if (sourceLine === null || shouldSnapToScrollEdge(position)) {
        container.scrollTop = Math.min(Math.max(position.ratio, 0), 1) * max;
        return;
      }
      container.scrollTop = mapSourceLineToScrollTop(
        getAnchors(),
        sourceLine,
        max,
        position.ratio,
      );
    };
    const handleScroll = () => scrollSubscriber();
    container.addEventListener("scroll", handleScroll, { passive: true });
    onScrollSyncReady?.({
      getPosition,
      scrollToPosition,
      subscribeScroll: (listener) => {
        scrollSubscriber = listener;
        return () => {
          if (scrollSubscriber === listener) scrollSubscriber = () => undefined;
        };
      },
      subscribeUserIntent: (listener) =>
        subscribeScrollIntent(container, listener),
      subscribeLayoutChange: (listener) => {
        if (typeof ResizeObserver === "undefined") return () => undefined;
        const observer = new ResizeObserver(() => {
          anchorCacheRef.current = null;
          listener();
        });
        observer.observe(root);
        return () => observer.disconnect();
      },
    });
    return () => {
      container.removeEventListener("scroll", handleScroll);
      onScrollSyncReady?.(null);
    };
  }, [onScrollSyncReady]);

  // 内容变化只让锚点失效，不重建 adapter
  useEffect(() => {
    anchorCacheRef.current = null;
  }, [html]);

  useEffect(() => {
    return subscribePublishingPreference(
      "linkToFootnote",
      setLinkToFootnoteEnabledState,
    );
  }, []);

  useEffect(() => {
    return subscribePublishingPreference("tableWrap", setTableWrapEnabledState);
  }, []);

  useEffect(() => {
    if (
      !previewRef.current ||
      !html ||
      !useMathJaxForPreview ||
      !mathJaxReady
    ) {
      return;
    }

    let cancelled = false;
    const runFit = () => {
      if (previewRef.current) {
        fitInlineEquations(previewRef.current);
      }
    };

    hydrateMathJaxEquations(previewRef.current)
      .then(() => {
        if (cancelled) return;
        runFit();
        requestAnimationFrame(runFit);
      })
      .catch((error) => {
        console.error("MathJax preview hydrate failed:", error);
      });

    const wemd =
      previewRef.current.querySelector<HTMLElement>("#wemd") ??
      previewRef.current;
    let resizeObserver: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => runFit());
      resizeObserver.observe(wemd);
    }

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
    };
  }, [html, useMathJaxForPreview, mathJaxReady]);

  return (
    <div className="markdown-preview">
      <div className="preview-header">
        <span className="preview-title">实时预览</span>
        <span className="preview-subtitle">微信排版效果</span>
      </div>
      <div
        className="preview-container"
        ref={registerScrollContainer}
        onClick={(e) => {
          const target = e.target as HTMLElement;
          const link = target.closest("a");
          if (link && link.href && window.electron?.shell?.openExternal) {
            e.preventDefault();
            window.electron.shell.openExternal(link.href);
          }
        }}
      >
        <div className="preview-content">
          <style
            dangerouslySetInnerHTML={{
              __html: getThemeCSS(theme, uiTheme === "dark"),
            }}
          />
          <div ref={previewRef} dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      </div>
    </div>
  );
}
// MathJax 类型已在 mathJaxLoader.ts 中声明
