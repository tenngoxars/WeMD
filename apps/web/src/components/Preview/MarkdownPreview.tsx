import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import mermaid from "mermaid";
import { createMarkdownParser, processHtml } from "@wemd/core";
import { useEditorStore } from "../../store/editorStore";
import { useThemeStore } from "../../store/themeStore";
import { useUITheme } from "../../hooks/useUITheme";
import { hasMathFormula, renderMathInElement } from "../../utils/katexRenderer";
import { convertLinksToFootnotes } from "../../utils/linkFootnote";
import {
  getLinkToFootnoteEnabled,
  LINK_TO_FOOTNOTE_EVENT,
} from "../Editor/ToolbarState";
import {
  getMermaidConfig,
  getThemedMermaidDiagram,
} from "../../utils/mermaidConfig";
import "./MarkdownPreview.css";

const SYNC_SCROLL_EVENT = "wemd-sync-scroll";

interface SyncScrollDetail {
  source: "editor" | "preview";
  ratio: number;
}

export function MarkdownPreview() {
  const { markdown } = useEditorStore();
  const { themeId: theme, customCSS, getThemeCSS } = useThemeStore();
  const uiTheme = useUITheme((state) => state.theme);
  const [html, setHtml] = useState("");
  const [linkToFootnoteEnabled, setLinkToFootnoteEnabledState] = useState(() =>
    getLinkToFootnoteEnabled(),
  );
  const previewRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isSyncingRef = useRef(false);
  const mermaidRenderIdRef = useRef(0);

  // 缓存 parser 实例，避免每次渲染都创建新实例
  const parser = useMemo(() => createMarkdownParser(), []);

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

    setHtml(styledHtml);
  }, [
    markdown,
    theme,
    customCSS,
    getThemeCSS,
    parser,
    uiTheme,
    linkToFootnoteEnabled,
  ]);

  // KaTeX 渲染：轻量级、快速，解决内存问题
  // MathJax 仅在复制到微信时使用
  useEffect(() => {
    if (!previewRef.current || !html) {
      return;
    }

    // 检测是否包含数学公式
    if (!hasMathFormula(markdown)) {
      return; // 无公式，跳过渲染
    }

    // 延迟渲染，避免频繁触发
    const timer = setTimeout(() => {
      if (previewRef.current) {
        renderMathInElement(previewRef.current);
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [html, markdown]);

  // 获取当前主题对象（注意与 line 25 的 themeId 区分）
  const currentTheme = useThemeStore(
    (state) =>
      state.customThemes.find((t) => t.id === state.themeId) ||
      state.getAllThemes().find((t) => t.id === state.themeId),
  );

  const designerVars = currentTheme?.designerVariables;
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

  // 处理预览栏滚动事件
  const handlePreviewScroll = useCallback(() => {
    if (isSyncingRef.current || !scrollContainerRef.current) return;

    const container = scrollContainerRef.current;
    const scrollTop = container.scrollTop;
    const scrollHeight = container.scrollHeight - container.clientHeight;

    if (scrollHeight <= 0) return;

    const ratio = scrollTop / scrollHeight;

    // 发送同步事件给编辑器
    const event = new CustomEvent<SyncScrollDetail>(SYNC_SCROLL_EVENT, {
      detail: { source: "preview", ratio },
    });
    window.dispatchEvent(event);
  }, []);

  // 接收编辑器的同步事件
  const handleSync = useCallback((event: Event) => {
    const customEvent = event as CustomEvent<SyncScrollDetail>;
    const { source, ratio } = customEvent.detail;

    if (source === "preview" || !scrollContainerRef.current) return;

    const container = scrollContainerRef.current;
    const scrollHeight = container.scrollHeight - container.clientHeight;

    if (scrollHeight <= 0) return;

    isSyncingRef.current = true;
    container.scrollTop = scrollHeight * ratio;

    setTimeout(() => {
      isSyncingRef.current = false;
    }, 100);
  }, []);

  // 添加滚动事件监听
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    // 监听预览栏滚动
    container.addEventListener("scroll", handlePreviewScroll);

    // 监听编辑器的同步事件
    window.addEventListener(SYNC_SCROLL_EVENT, handleSync as EventListener);

    return () => {
      container.removeEventListener("scroll", handlePreviewScroll);
      window.removeEventListener(
        SYNC_SCROLL_EVENT,
        handleSync as EventListener,
      );
    };
  }, [handlePreviewScroll, handleSync]);

  useEffect(() => {
    const handleLinkToFootnoteChange = (event: Event) => {
      const customEvent = event as CustomEvent<boolean>;
      setLinkToFootnoteEnabledState(customEvent.detail);
    };

    window.addEventListener(
      LINK_TO_FOOTNOTE_EVENT,
      handleLinkToFootnoteChange as EventListener,
    );
    return () => {
      window.removeEventListener(
        LINK_TO_FOOTNOTE_EVENT,
        handleLinkToFootnoteChange as EventListener,
      );
    };
  }, []);

  return (
    <div className="markdown-preview">
      <div className="preview-header">
        <span className="preview-title">实时预览</span>
        <span className="preview-subtitle">微信排版效果</span>
      </div>
      <div className="preview-container" ref={scrollContainerRef}>
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
