import { useEffect, useMemo, useRef, useState } from "react";
import { EditorView, minimalSetup } from "codemirror";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { EditorState } from "@codemirror/state";
import { isolateHistory } from "@codemirror/commands";
import {
  editorBaseThemeDark,
  editorBaseThemeLight,
  wechatMarkdownHighlighting,
  wechatMarkdownHighlightingDark,
} from "./markdownTheme";
import { markdownBlockDecorations } from "./editorMarkdownDecorations";
import { mathExtension } from "./markdownMath";
import { underlineExtension } from "./markdownUnderline";
import { useUITheme } from "../../hooks/useUITheme";
import { useEditorStore } from "../../store/editorStore";
import { AiRewriteLauncher } from "./AiRewrite/AiRewriteLauncher";
import { useAiRewrite } from "./AiRewrite/useAiRewrite";
import {
  useAiPanelStore,
  type EditorTextActions,
} from "../../store/aiPanelStore";
import { locateQuoteMatch, type TextRange } from "../../services/ai/aiLocate";
import { countWords, countLines } from "../../utils/wordCount";
import { Toolbar } from "./Toolbar";
import { SearchPanel } from "./SearchPanel";
import { SaveIndicator } from "./SaveIndicator";
import toast from "react-hot-toast";
import "./MarkdownEditor.css";
import { isWebKitGtk as detectWebKitGtk } from "../../utils/isWebKitGtk";
import { customKeymap } from "./editorShortcuts";
import { paragraphSelectionStyle } from "./mouseSelectionStyle";
import { docSyncChanges } from "./docSync";
import {
  WECHAT_IMAGE_MAX_SIZE_BYTES,
  formatImageSize,
} from "../../services/image/autoCompressImage";
import { uploadEditorImage } from "../../services/image/imageUploadFlow";
import {
  shouldSnapToScrollEdge,
  subscribeScrollIntent,
  type ScrollSyncAdapter,
} from "../Workspace/editorPreviewScrollSync";

interface MarkdownEditorProps {
  onScrollSyncReady?: (adapter: ScrollSyncAdapter | null) => void;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

// Linux 的 WebKitGTK（Tauri 桌面版）把输入法正在转换的那段同步成选区，编辑器据此画出底色并把光标停在该段末尾；
// 其他引擎组词时选区与光标正常，不需要处理
const isWebKitGtk =
  typeof navigator !== "undefined" && detectWebKitGtk(navigator.userAgent);

export function MarkdownEditor({ onScrollSyncReady }: MarkdownEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const { markdown: content, setMarkdown } = useEditorStore();
  const aiRewrite = useAiRewrite(viewRef);
  const fixAnchorsRef = useRef(
    new Map<string, { range: TextRange; applied: string; original: string }>(),
  );
  const uiTheme = useUITheme((state) => state.theme);
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        setShowSearch(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!editorRef.current) return;

    const currentContent = viewRef.current
      ? viewRef.current.state.doc.toString()
      : content;

    const startState = EditorState.create({
      doc: currentContent,
      extensions: [
        minimalSetup,
        customKeymap,
        markdown({
          base: markdownLanguage,
          // 围栏代码块按语言懒加载高亮，Vite 会把各语言拆成独立 chunk
          codeLanguages: languages,
          extensions: [underlineExtension, mathExtension],
        }),
        uiTheme === "dark"
          ? [wechatMarkdownHighlightingDark, editorBaseThemeDark]
          : [wechatMarkdownHighlighting, editorBaseThemeLight],
        markdownBlockDecorations,
        aiRewrite.extension,
        EditorView.lineWrapping,
        paragraphSelectionStyle,
        EditorView.domEventHandlers({
          // 组词期间隐藏选区与光标，只在 WebKitGTK 生效（见 isWebKitGtk 与 MarkdownEditor.css）
          compositionstart: (_event, view) => {
            if (isWebKitGtk) view.dom.classList.add("cm-ime-composing");
          },
          // 组词中途失焦时 compositionend 可能不触发，失焦也一并清除
          compositionend: (_event, view) => {
            view.dom.classList.remove("cm-ime-composing");
          },
          blur: (_event, view) => {
            view.dom.classList.remove("cm-ime-composing");
          },
          paste: (event, view) => {
            const items = event.clipboardData?.items;
            if (!items) return;

            for (const item of items) {
              if (item.type.startsWith("image/")) {
                event.preventDefault();
                const file = item.getAsFile();
                if (!file) continue;

                const needAutoCompress =
                  file.size > WECHAT_IMAGE_MAX_SIZE_BYTES;

                // 使用统一流程自动压缩并上传
                const uploadPromise = (async () => {
                  const result = await uploadEditorImage(file, {
                    compressionOptions: {
                      maxSizeBytes: WECHAT_IMAGE_MAX_SIZE_BYTES,
                    },
                  });
                  return result;
                })();

                const loadingToken = `wemd-upload-${Date.now()}-${Math.random()
                  .toString(36)
                  .slice(2, 8)}`;
                const loadingText = `![上传中... ${file.name}](${loadingToken})`;
                const range = view.state.selection.main;
                view.dispatch({
                  changes: {
                    from: range.from,
                    to: range.to,
                    insert: loadingText,
                  },
                });

                toast.promise(uploadPromise, {
                  loading: needAutoCompress
                    ? "正在压缩并上传图片..."
                    : "正在上传图片...",
                  success: (result) => {
                    const imageText = `![](${result.url})`;
                    const currentDoc = view.state.doc.toString();
                    const index = currentDoc.indexOf(loadingText);

                    if (index !== -1) {
                      view.dispatch({
                        changes: {
                          from: index,
                          to: index + loadingText.length,
                          insert: imageText,
                        },
                      });
                    }
                    return result.compressed
                      ? `图片上传成功（已自动压缩 ${formatImageSize(
                          result.originalSize,
                        )} -> ${formatImageSize(result.finalSize)}）`
                      : "图片上传成功";
                  },
                  error: (err) => {
                    const currentDoc = view.state.doc.toString();
                    const index = currentDoc.indexOf(loadingText);
                    if (index !== -1) {
                      view.dispatch({
                        changes: {
                          from: index,
                          to: index + loadingText.length,
                          insert: "",
                        },
                      });
                    }
                    return `上传失败: ${err.message}`;
                  },
                });
              }
            }
          },
        }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            fixAnchorsRef.current.forEach((anchor) => {
              anchor.range = {
                ...anchor.range,
                from: update.changes.mapPos(anchor.range.from, 1),
                to: update.changes.mapPos(anchor.range.to, -1),
              };
            });
            const newContent = update.state.doc.toString();
            setMarkdown(newContent);
          }
        }),
        EditorView.theme({
          "&": {
            height: "100%",
          },
          ".cm-scroller": {
            fontFamily: "var(--font-mono)",
          },
        }),
      ],
    });

    const view = new EditorView({
      state: startState,
      parent: editorRef.current,
    });

    const scrollDOM = view.scrollDOM;
    let scrollSubscriber: () => void = () => undefined;
    const getPosition = () => {
      const max = scrollDOM.scrollHeight - scrollDOM.clientHeight;
      const ratio = max > 0 ? scrollDOM.scrollTop / max : 0;
      const block = view.lineBlockAtHeight(scrollDOM.scrollTop);
      const line = view.state.doc.lineAt(block.from).number - 1;
      const progress =
        block.height > 0
          ? clamp((scrollDOM.scrollTop - block.top) / block.height, 0, 1)
          : 0;
      return { sourceLine: line + progress, ratio };
    };

    const scrollToPosition: ScrollSyncAdapter["scrollToPosition"] = (
      position,
    ) => {
      const max = scrollDOM.scrollHeight - scrollDOM.clientHeight;
      if (max <= 0) return;
      const { sourceLine } = position;
      if (sourceLine === null || shouldSnapToScrollEdge(position)) {
        scrollDOM.scrollTo({ top: clamp(position.ratio, 0, 1) * max });
        return;
      }

      const targetSourceLine = clamp(
        sourceLine,
        0,
        Math.max(0, view.state.doc.lines - 1),
      );
      const lineNumber = Math.floor(targetSourceLine) + 1;
      const block = view.lineBlockAt(view.state.doc.line(lineNumber).from);
      const target = block.top + (targetSourceLine % 1) * block.height;
      scrollDOM.scrollTo({ top: clamp(target, 0, max) });
    };

    const handleEditorScroll = () => scrollSubscriber();
    scrollDOM.addEventListener("scroll", handleEditorScroll, { passive: true });
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
        subscribeScrollIntent(scrollDOM, listener),
    });

    viewRef.current = view;

    return () => {
      scrollDOM.removeEventListener("scroll", handleEditorScroll);
      onScrollSyncReady?.(null);
      view.destroy();
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setMarkdown, uiTheme, onScrollSyncReady]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const currentDoc = view.state.doc.toString();
    if (currentDoc === content) return;
    // 外部改动（切换文件、格式化）单独成为一步撤销，不与刚输入的文字合并
    view.dispatch({
      changes: docSyncChanges(currentDoc, content),
      annotations: isolateHistory.of("full"),
    });
  }, [content]);

  const wordCount = countWords(content);
  const lineCount = countLines(content);

  const editorActions = useMemo<EditorTextActions>(() => {
    const select = (view: EditorView, range: TextRange) => {
      view.dispatch({
        selection: { anchor: range.from, head: range.to },
        effects: EditorView.scrollIntoView(range.from, { y: "center" }),
      });
      view.focus();
    };

    return {
      reveal: (quote) => {
        const view = viewRef.current;
        if (!view) return false;
        const result = locateQuoteMatch(view.state.doc.toString(), quote);
        if (result.status !== "unique") return false;
        select(view, result.range);
        return true;
      },

      applyFix: (quote, replacement) => {
        const view = viewRef.current;
        if (!view || !replacement) return null;
        const doc = view.state.doc.toString();
        const result = locateQuoteMatch(doc, quote);
        if (result.status !== "unique") return null;
        const range = result.range;

        view.dispatch({ changes: { ...range, insert: replacement } });
        const applied = {
          from: range.from,
          to: range.from + replacement.length,
        };
        const anchorId = `ai-fix-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}`;
        fixAnchorsRef.current.set(anchorId, {
          range: { ...applied, anchorId },
          applied: replacement,
          original: doc.slice(range.from, range.to),
        });
        select(view, applied);
        return {
          range: { ...applied, anchorId },
          original: doc.slice(range.from, range.to),
        };
      },

      revertFix: (range, applied, original) => {
        const view = viewRef.current;
        if (!view) return false;
        const doc = view.state.doc.toString();
        const anchor = range.anchorId
          ? fixAnchorsRef.current.get(range.anchorId)
          : undefined;
        const target = anchor?.range ?? range;
        // 只接受事务映射后的锚点，并校验其内容仍是本次采纳结果。
        // 不再全文搜索 applied，避免用户编辑后误还原另一处相同文字。
        if (doc.slice(target.from, target.to) !== applied) return false;

        view.dispatch({
          changes: { from: target.from, to: target.to, insert: original },
        });
        select(view, { from: target.from, to: target.from + original.length });
        if (range.anchorId) fixAnchorsRef.current.delete(range.anchorId);
        return true;
      },
    };
  }, []);

  useEffect(() => {
    const setEditorActions = useAiPanelStore.getState().setEditorActions;
    setEditorActions(editorActions);
    return () => setEditorActions(null);
  }, [editorActions]);

  const handleInsert = (
    prefix: string,
    suffix: string,
    placeholder: string,
  ) => {
    const view = viewRef.current;
    if (!view) return;

    const selection = view.state.selection.main;
    const selectedText = view.state.doc.sliceString(
      selection.from,
      selection.to,
    );
    const textToInsert = selectedText || placeholder;
    const fullText = prefix + textToInsert + suffix;

    view.dispatch({
      changes: {
        from: selection.from,
        to: selection.to,
        insert: fullText,
      },
      selection: {
        anchor: selection.from + prefix.length,
        head: selection.from + prefix.length + textToInsert.length,
      },
    });

    view.focus();
  };

  return (
    <div className="markdown-editor">
      <div className="editor-header">
        <span className="editor-title">Markdown 编辑器</span>
      </div>
      <Toolbar onInsert={handleInsert} />
      {showSearch && viewRef.current && (
        <SearchPanel
          view={viewRef.current}
          onClose={() => setShowSearch(false)}
        />
      )}
      <div className="editor-body-wrapper">
        <div ref={editorRef} className="editor-container" />
      </div>
      <AiRewriteLauncher
        anchor={aiRewrite.anchor}
        target={aiRewrite.target}
        onOpen={aiRewrite.openFromAnchor}
        onClose={aiRewrite.close}
        onApply={aiRewrite.apply}
        onPreview={aiRewrite.preview}
      />
      <div className="editor-footer">
        <div className="editor-stats">
          <span className="editor-stat">行数: {lineCount}</span>
          <span className="editor-stat">字数: {wordCount}</span>
        </div>
        <SaveIndicator />
      </div>
    </div>
  );
}
