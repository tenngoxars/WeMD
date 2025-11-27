import { useState, useEffect } from 'react';
import { useEditorStore } from '../../store/editorStore';
import './Header.css';

export function Header() {
    const { copyToWechat, customCSS, setCustomCSS, getThemeCSS } = useEditorStore();
    const [showCSSEditor, setShowCSSEditor] = useState(false);
    const [cssContent, setCssContent] = useState('');

    const handleOpenEditor = () => {
        // 获取当前主题的 CSS
        const currentCSS = customCSS || getThemeCSS('default');
        setCssContent(currentCSS);
        setShowCSSEditor(true);
    };

    const handleSaveCSS = () => {
        setCustomCSS(cssContent);
        setShowCSSEditor(false);
    };

    const handleCancel = () => {
        setShowCSSEditor(false);
        // 重置为当前 CSS，避免未保存的修改
        setCssContent(customCSS || getThemeCSS('default'));
    };

    // 键盘快捷键支持
    useEffect(() => {
        if (!showCSSEditor) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            // ESC 关闭编辑器
            if (e.key === 'Escape') {
                handleCancel();
            }
            // Cmd/Ctrl + S 保存
            if ((e.metaKey || e.ctrlKey) && e.key === 's') {
                e.preventDefault();
                handleSaveCSS();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showCSSEditor]);

    return (
        <>
            <header className="app-header">
                <div className="header-left">
                    <div className="logo">
                        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                            <rect width="32" height="32" rx="8" fill="url(#gradient)" />
                            <path
                                d="M16 8L20 12H18V20H14V12H12L16 8Z"
                                fill="white"
                                opacity="0.9"
                            />
                            <path
                                d="M10 22H22V24H10V22Z"
                                fill="white"
                                opacity="0.9"
                            />
                            <defs>
                                <linearGradient id="gradient" x1="0" y1="0" x2="32" y2="32">
                                    <stop offset="0%" stopColor="#667eea" />
                                    <stop offset="100%" stopColor="#764ba2" />
                                </linearGradient>
                            </defs>
                        </svg>
                        <span className="logo-text">
                            <span className="gradient-text">WeMD</span>
                        </span>
                    </div>
                </div>

                <div className="header-right">
                    <button className="btn-secondary" onClick={handleOpenEditor}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                        </svg>
                        <span>编辑 CSS</span>
                    </button>
                    <button className="btn-primary" onClick={copyToWechat}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        <span>复制到微信</span>
                    </button>
                </div>
            </header>

            {showCSSEditor && (
                <div className="css-editor-overlay" onClick={handleCancel}>
                    <div className="css-editor-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="css-editor-header">
                            <h3>主题 CSS 编辑器</h3>
                            <button className="close-btn" onClick={handleCancel} aria-label="关闭">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <div className="css-editor-body">
                            <textarea
                                className="css-editor-textarea"
                                value={cssContent}
                                onChange={(e) => setCssContent(e.target.value)}
                                spellCheck={false}
                                placeholder="输入 CSS 样式..."
                                autoFocus
                            />
                        </div>
                        <div className="css-editor-footer">
                            <button className="btn-secondary" onClick={handleCancel}>
                                取消 (ESC)
                            </button>
                            <button className="btn-primary" onClick={handleSaveCSS}>
                                应用修改 (⌘S)
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
