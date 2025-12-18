import { useEffect, useRef, useState } from 'react';
import { EditorView, minimalSetup } from 'codemirror';
import { keymap } from '@codemirror/view';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { EditorState, Prec } from '@codemirror/state';
import { githubLight } from '@uiw/codemirror-theme-github';
import { wechatMarkdownHighlighting, wechatMarkdownHighlightingDark } from './markdownTheme';
import { useUITheme } from '../../hooks/useUITheme';
import { useEditorStore } from '../../store/editorStore';
import { countWords, countLines } from '../../utils/wordCount';
import { Toolbar } from './Toolbar';
import { SearchPanel } from './SearchPanel';
import toast from 'react-hot-toast';
import './MarkdownEditor.css';

const SYNC_SCROLL_EVENT = 'wemd-sync-scroll';

interface SyncScrollDetail {
    source: 'editor' | 'preview';
    ratio: number;
}

// 辅助函数：用 prefix/suffix 包裹选中文本
function wrapSelection(view: EditorView, prefix: string, suffix: string): boolean {
    const selection = view.state.selection.main;
    const selectedText = view.state.doc.sliceString(selection.from, selection.to);
    const wrapped = prefix + (selectedText || '文本') + suffix;

    view.dispatch({
        changes: { from: selection.from, to: selection.to, insert: wrapped },
        selection: selectedText
            ? { anchor: selection.from, head: selection.from + wrapped.length }
            : { anchor: selection.from + prefix.length, head: selection.from + prefix.length + 2 }
    });
    return true; // 阻止浏览器默认行为
}

// Markdown 格式化快捷键
const markdownKeymap = Prec.highest(keymap.of([
    { key: 'Mod-b', run: (view) => wrapSelection(view, '**', '**') },
    { key: 'Mod-i', run: (view) => wrapSelection(view, '*', '*') },
]));

export function MarkdownEditor() {
    const editorRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    const { markdown: content, setMarkdown } = useEditorStore();
    const uiTheme = useUITheme((state) => state.theme);
    const initialContent = useRef(content);
    const isSyncingRef = useRef(false);
    const [showSearch, setShowSearch] = useState(false);

    // Cmd/Ctrl+F 打开搜索面板
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
                e.preventDefault();
                setShowSearch(true);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    useEffect(() => {
        if (!editorRef.current) return;

        // 主题切换时使用当前内容，首次加载时使用 store 中的内容
        const currentContent = viewRef.current
            ? viewRef.current.state.doc.toString()
            : content;

        const startState = EditorState.create({
            doc: currentContent,
            extensions: [
                minimalSetup,
                markdownKeymap,
                markdown({ base: markdownLanguage }),
                uiTheme === 'dark' ? wechatMarkdownHighlightingDark : wechatMarkdownHighlighting,
                githubLight,
                EditorView.lineWrapping,
                EditorView.domEventHandlers({
                    paste: (event, view) => {
                        const items = event.clipboardData?.items;
                        if (!items) return;

                        for (const item of items) {
                            if (item.type.startsWith('image/')) {
                                event.preventDefault();
                                const file = item.getAsFile();
                                if (!file) continue;

                                // 检查图片大小，超过 2MB 拒绝上传
                                const MAX_SIZE_MB = 2;
                                const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;
                                if (file.size > MAX_SIZE_BYTES) {
                                    const sizeMB = (file.size / 1024 / 1024).toFixed(1);
                                    toast.error(`请压缩图片后再试，公众号不支持超过 2MB 的图片外链(当前 ${sizeMB}MB)`, { duration: 4000 });
                                    continue;
                                }

                                // 使用 ImageHostManager 统一上传
                                const uploadPromise = (async () => {
                                    const saved = localStorage.getItem('imageHostConfig');
                                    const imageHostConfig = saved ? JSON.parse(saved) : { type: 'official' };
                                    const { ImageHostManager } = await import('../../services/image/ImageUploader');
                                    const manager = new ImageHostManager(imageHostConfig);
                                    const url = await manager.upload(file);
                                    return { url, filename: file.name };
                                })();

                                const loadingText = `![上传中... ${file.name}]()`;
                                const range = view.state.selection.main;
                                view.dispatch({
                                    changes: {
                                        from: range.from,
                                        to: range.to,
                                        insert: loadingText
                                    }
                                });

                                toast.promise(
                                    uploadPromise,
                                    {
                                        loading: '正在上传图片...',
                                        success: (result) => {
                                            const imageText = `![](${result.url})`;
                                            const currentDoc = view.state.doc.toString();
                                            const index = currentDoc.indexOf(loadingText);

                                            if (index !== -1) {
                                                view.dispatch({
                                                    changes: {
                                                        from: index,
                                                        to: index + loadingText.length,
                                                        insert: imageText
                                                    }
                                                });
                                            }
                                            return '图片上传成功';
                                        },
                                        error: (err) => {
                                            const currentDoc = view.state.doc.toString();
                                            const index = currentDoc.indexOf(loadingText);
                                            if (index !== -1) {
                                                view.dispatch({
                                                    changes: {
                                                        from: index,
                                                        to: index + loadingText.length,
                                                        insert: ''
                                                    }
                                                });
                                            }
                                            return `上传失败: ${err.message}`;
                                        }
                                    }
                                );
                            }
                        }
                    }
                }),
                EditorView.updateListener.of((update) => {
                    if (update.docChanged) {
                        const newContent = update.state.doc.toString();
                        setMarkdown(newContent);
                    }
                }),
                EditorView.theme({
                    '&': {
                        height: '100%',
                        fontSize: '15px',
                    },
                    '.cm-scroller': {
                        fontFamily: "'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', monospace",
                        lineHeight: '1.6',
                    },
                    '.cm-content': {
                        padding: '16px',
                    },
                    '.cm-gutters': {
                        backgroundColor: '#f8f9fa',
                        border: 'none',
                    },
                }),
            ],
        });

        const view = new EditorView({
            state: startState,
            parent: editorRef.current,
        });

        const scrollDOM = view.scrollDOM;
        const handleEditorScroll = () => {
            if (isSyncingRef.current) {
                isSyncingRef.current = false;
                return;
            }
            const max = scrollDOM.scrollHeight - scrollDOM.clientHeight;
            if (max <= 0) return;
            const ratio = scrollDOM.scrollTop / max;
            window.dispatchEvent(new CustomEvent<SyncScrollDetail>(SYNC_SCROLL_EVENT, { detail: { source: 'editor', ratio } }));
        };

        const handleSync = (event: Event) => {
            const customEvent = event as CustomEvent<SyncScrollDetail>;
            const detail = customEvent.detail;
            if (!detail || detail.source === 'editor') return;
            const max = scrollDOM.scrollHeight - scrollDOM.clientHeight;
            if (max <= 0) return;
            isSyncingRef.current = true;
            scrollDOM.scrollTo({ top: detail.ratio * max });
        };

        scrollDOM.addEventListener('scroll', handleEditorScroll);
        window.addEventListener(SYNC_SCROLL_EVENT, handleSync as EventListener);

        viewRef.current = view;

        return () => {
            scrollDOM.removeEventListener('scroll', handleEditorScroll);
            window.removeEventListener(SYNC_SCROLL_EVENT, handleSync as EventListener);
            view.destroy();
        };
        // 加入 uiTheme 依赖，主题切换时重建编辑器
    }, [setMarkdown, uiTheme]);

    useEffect(() => {
        const view = viewRef.current;
        if (!view) return;
        const currentDoc = view.state.doc.toString();
        if (currentDoc === content) return;
        view.dispatch({
            changes: { from: 0, to: view.state.doc.length, insert: content },
        });
    }, [content]);

    const wordCount = countWords(content);
    const lineCount = countLines(content);

    // 处理工具栏文本插入
    const handleInsert = (prefix: string, suffix: string, placeholder: string) => {
        const view = viewRef.current;
        if (!view) return;

        const selection = view.state.selection.main;
        const selectedText = view.state.doc.sliceString(selection.from, selection.to);
        const textToInsert = selectedText || placeholder;
        const fullText = prefix + textToInsert + suffix;

        view.dispatch({
            changes: {
                from: selection.from,
                to: selection.to,
                insert: fullText
            },
            selection: {
                anchor: selection.from + prefix.length,
                head: selection.from + prefix.length + textToInsert.length
            }
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
            <div className="editor-footer">
                <span className="editor-stat">行数: {lineCount}</span>
                <span className="editor-stat">字数: {wordCount}</span>
            </div>
        </div>
    );
}
