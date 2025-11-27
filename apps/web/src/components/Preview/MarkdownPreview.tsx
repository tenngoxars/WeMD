import { useEffect, useState, useRef, useMemo } from 'react';
import { createMarkdownParser, processHtml } from '@wemd/core';
import { useEditorStore } from '../../store/editorStore';
import './MarkdownPreview.css';

export function MarkdownPreview() {
  const { markdown, theme, customCSS, getThemeCSS } = useEditorStore();
  const [html, setHtml] = useState('');
  const previewRef = useRef<HTMLDivElement>(null);

  // 缓存 parser 实例，避免每次渲染都创建新实例
  const parser = useMemo(() => createMarkdownParser(), []);

  useEffect(() => {
    const rawHtml = parser.render(markdown);

    // 使用 store 中的 getThemeCSS 方法，会自动处理自定义 CSS
    const css = getThemeCSS(theme);
    const styledHtml = processHtml(rawHtml, css);

    setHtml(styledHtml);
  }, [markdown, theme, customCSS, getThemeCSS, parser]);

  // 注入 MathJax 支持
  useEffect(() => {
    if (!window.MathJax || !previewRef.current || !html) {
      return;
    }

    // 延迟渲染，避免频繁触发
    const timer = setTimeout(() => {
      if (previewRef.current && window.MathJax) {
        window.MathJax.typesetClear([previewRef.current]);
        window.MathJax.typesetPromise([previewRef.current]).catch((err: unknown) => {
          console.error('MathJax typeset error:', err);
        });
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [html]);

  return (
    <div className="markdown-preview">
      <div className="preview-header">
        <span className="preview-title">实时预览</span>
        <span className="preview-subtitle">微信排版效果</span>
      </div>
      <div className="preview-container">
        <div className="preview-content">
          <div
            ref={previewRef}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      </div>
    </div>
  );
}

// 声明 MathJax 类型
declare global {
  interface Window {
    MathJax?: {
      typesetClear: (elements: Element[]) => void;
      typesetPromise: (elements: Element[]) => Promise<void>;
    };
  }
}
