import { useEffect, useRef } from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { EditorState } from '@codemirror/state';
import { githubLight } from '@uiw/codemirror-theme-github';
import { useEditorStore } from '../../store/editorStore';
import './MarkdownEditor.css';

export function MarkdownEditor() {
    const editorRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    const { markdown: content, setMarkdown } = useEditorStore();
    const initialContent = useRef(content);

    useEffect(() => {
        if (!editorRef.current) return;

        const startState = EditorState.create({
            doc: initialContent.current,
            extensions: [
                basicSetup,
                markdown(),
                githubLight,
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

        viewRef.current = view;

        return () => {
            view.destroy();
        };
    }, [setMarkdown]);

    useEffect(() => {
        const view = viewRef.current;
        if (!view) return;
        const currentDoc = view.state.doc.toString();
        if (currentDoc === content) return;
        view.dispatch({
            changes: { from: 0, to: view.state.doc.length, insert: content },
        });
    }, [content]);

    return (
        <div className="markdown-editor">
            <div className="editor-header">
                <span className="editor-title">Markdown 编辑器</span>
            </div>
            <div ref={editorRef} className="editor-container" />
        </div>
    );
}
