import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Copy, Trash2, X, AlertTriangle } from 'lucide-react';
import { createMarkdownParser, processHtml, convertCssToWeChatDarkMode } from '@wemd/core';
import { useEditorStore } from '../../store/editorStore';
import { useThemeStore } from '../../store/themeStore';
import { useHistoryStore } from '../../store/historyStore';
import { useUITheme } from '../../hooks/useUITheme';
import './ThemePanel.css';

// 主题预览用的示例 Markdown
const PREVIEW_MARKDOWN = `# 标题示例

这是一段**加粗文本**和*斜体文本*。

## 二级标题

> 这是一段引用文本

- 列表项 1
- 列表项 2

\`\`\`js
const hello = "world";
\`\`\`
`;

// 实时预览组件 - 使用 iframe 隔离样式
function ThemeLivePreview({ css }: { css: string }) {
  const parser = useMemo(() => createMarkdownParser(), []);
  const uiTheme = useUITheme((state) => state.theme);
  const isDarkMode = uiTheme === 'dark';

  const html = useMemo(() => {
    const rawHtml = parser.render(PREVIEW_MARKDOWN);
    // 深色模式下使用微信颜色转换算法
    const finalCss = isDarkMode ? convertCssToWeChatDarkMode(css) : css;
    // 使用内联样式模式，确保样式完全隔离
    return processHtml(rawHtml, finalCss, true);
  }, [parser, css, isDarkMode]);

  // 构建完整的 iframe 内容
  const iframeContent = useMemo(() => {
    const bgColor = isDarkMode ? '#252526' : '#fff';
    const textColor = isDarkMode ? '#d4d4d4' : '#000';


    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            padding: 16px;
            font-size: 14px;
            line-height: 1.6;
            background: ${bgColor};
            color: ${textColor};
          }
        </style>
      </head>
      <body>${html}</body>
      </html>
    `;
  }, [html, isDarkMode]);

  return (
    <div className="theme-live-preview">
      <div className="preview-header-mini">
        <span>实时预览</span>
      </div>
      <iframe
        className="preview-iframe"
        srcDoc={iframeContent}
        title="主题预览"
        sandbox="allow-same-origin"
      />
    </div>
  );
}

interface ThemePanelProps {
  open: boolean;
  onClose: () => void;
}



export function ThemePanel({ open, onClose }: ThemePanelProps) {
  const theme = useThemeStore((state) => state.themeId);
  const selectTheme = useThemeStore((state) => state.selectTheme);
  const createTheme = useThemeStore((state) => state.createTheme);
  const updateTheme = useThemeStore((state) => state.updateTheme);
  const deleteTheme = useThemeStore((state) => state.deleteTheme);
  const duplicateTheme = useThemeStore((state) => state.duplicateTheme);
  const getAllThemes = useThemeStore((state) => state.getAllThemes);
  const customThemesFromStore = useThemeStore((state) => state.customThemes);
  const persistActiveSnapshot = useHistoryStore((state) => state.persistActiveSnapshot);
  // customThemes 变化时重新计算 allThemes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const allThemes = useMemo(() => getAllThemes(), [getAllThemes, customThemesFromStore]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isElectron = typeof window !== 'undefined' && !!(window as any).electron;
  const [selectedThemeId, setSelectedThemeId] = useState<string>('');
  const [nameInput, setNameInput] = useState('');
  const [cssInput, setCssInput] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const selectedTheme = allThemes.find((t) => t.id === selectedThemeId);
  const isCustomTheme = selectedTheme && !selectedTheme.isBuiltIn;

  useEffect(() => {
    if (open) {
      const currentTheme = allThemes.find((t) => t.id === theme);
      if (currentTheme) {
        setSelectedThemeId(currentTheme.id);
        setNameInput(currentTheme.name);
        setCssInput(currentTheme.css);
      }
      setIsCreating(false);
      setShowDeleteConfirm(false);
    }
  }, [open, theme, allThemes]);

  if (!open) return null;

  const handleSelectTheme = (themeId: string) => {
    const theme = allThemes.find((t) => t.id === themeId);
    if (!theme) return;

    setSelectedThemeId(themeId);
    setNameInput(theme.name);
    setCssInput(theme.css);
    setIsCreating(false);
    setShowDeleteConfirm(false);
  };

  const handleCreateNew = () => {
    setIsCreating(true);
    setSelectedThemeId('');
    setNameInput('');
    setCssInput(''); // 新建主题时 CSS 为空
    setShowDeleteConfirm(false);
  };

  const handleApply = async () => {
    selectTheme(selectedThemeId);
    if (!isElectron) {
      const state = useEditorStore.getState();
      await persistActiveSnapshot({
        markdown: state.markdown,
        theme: selectedThemeId,
        customCSS: '',
        themeName: selectedTheme?.name || '默认主题',
      });
    }
    onClose();
  };

  const handleSave = async () => {
    if (isCreating) {
      // 创建新主题
      const newTheme = createTheme(nameInput, cssInput);
      selectTheme(newTheme.id);

      if (!isElectron) {
        const state = useEditorStore.getState();
        await persistActiveSnapshot({
          markdown: state.markdown,
          theme: newTheme.id,
          customCSS: '',
          themeName: newTheme.name,
        });
      }

      setSelectedThemeId(newTheme.id);
      setIsCreating(false);
      toast.success('主题创建成功');
    } else if (isCustomTheme) {
      // 更新现有主题
      updateTheme(selectedThemeId, {
        name: nameInput.trim() || '未命名主题',
        css: cssInput,
      });

      if (!isElectron) {
        const editorState = useEditorStore.getState();
        const themeState = useThemeStore.getState();
        if (themeState.themeId === selectedThemeId) {
          await persistActiveSnapshot({
            markdown: editorState.markdown,
            theme: selectedThemeId,
            customCSS: '',
            themeName: nameInput.trim() || '未命名主题',
          });
        }
      }
      toast.success('主题已保存');
    }
  };

  const handleDeleteClick = () => {
    if (!isCustomTheme) return;
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = () => {
    if (!isCustomTheme) return;

    deleteTheme(selectedThemeId);
    // 切换到默认主题并应用
    selectTheme('default');
    handleSelectTheme('default');
    setShowDeleteConfirm(false);
    toast.success('主题已删除');
  };

  const handleDuplicate = () => {
    if (!selectedTheme) return;
    const newName = `${selectedTheme.name} (副本)`;
    const duplicated = duplicateTheme(selectedThemeId, newName);
    handleSelectTheme(duplicated.id);
    toast.success('主题已复制');
  };

  // 分组主题
  const builtInThemes = allThemes.filter((t) => t.isBuiltIn);
  const customThemes = allThemes.filter((t) => !t.isBuiltIn);

  return (
    <div className="theme-overlay" onClick={onClose}>
      <div className="theme-modal" onClick={(e) => e.stopPropagation()}>
        <div className="theme-header">
          <h3>主题管理</h3>
          <button className="close-btn" onClick={onClose} aria-label="关闭">
            <X size={20} />
          </button>
        </div>

        <div className="theme-body">
          {/* 左侧主题列表 */}
          <div className="theme-sidebar">
            <button className="btn-new-theme" onClick={handleCreateNew}>
              <Plus size={16} /> 新建自定义主题
            </button>

            <div className="theme-list-scroll">
              {customThemes.length > 0 && (
                <div className="theme-group">
                  <div className="theme-group-title">自定义主题</div>
                  {customThemes.map((item) => (
                    <button
                      key={item.id}
                      className={`theme-item ${item.id === selectedThemeId ? 'active' : ''}`}
                      onClick={() => handleSelectTheme(item.id)}
                    >
                      {item.name}
                    </button>
                  ))}
                </div>
              )}

              <div className="theme-group">
                <div className="theme-group-title">内置主题</div>
                {builtInThemes.map((item) => (
                  <button
                    key={item.id}
                    className={`theme-item ${item.id === selectedThemeId ? 'active' : ''}`}
                    onClick={() => handleSelectTheme(item.id)}
                  >
                    {item.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 右侧编辑区 */}
          <div className="theme-editor" style={{ position: 'relative' }}>
            {showDeleteConfirm && (
              <div className="delete-confirm-overlay">
                <div className="delete-confirm-box">
                  <div className="confirm-icon-wrapper">
                    <AlertTriangle size={24} color="#ef4444" />
                  </div>
                  <h4>确认删除</h4>
                  <p>确定要删除主题 "{selectedTheme?.name}" 吗？此操作无法撤销。</p>
                  <div className="delete-confirm-actions">
                    <button className="btn-secondary" onClick={() => setShowDeleteConfirm(false)}>
                      取消
                    </button>
                    <button className="btn-primary" style={{ background: '#ef4444', boxShadow: 'none' }} onClick={handleConfirmDelete}>
                      确认删除
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="theme-form">
              {/* 实时预览区 - 嵌入在表单内 */}
              <div className="theme-form-preview">
                <ThemeLivePreview css={cssInput} />
              </div>

              <div className="theme-form-fields">
                <label>主题名称</label>
                <input
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="输入主题名称..."
                  disabled={!isCreating && !isCustomTheme}
                />

                <label>CSS 样式</label>
                <textarea
                  value={cssInput}
                  onChange={(e) => setCssInput(e.target.value)}
                  placeholder="输入 CSS 样式代码..."
                  spellCheck={false}
                  disabled={!isCreating && !isCustomTheme}
                />

                {!isCreating && !isCustomTheme && (
                  <p className="info-hint">
                    💡 内置主题不可编辑，点击"复制"按钮可以基于此主题创建自定义主题
                  </p>
                )}
              </div>
            </div>

            <div className="theme-actions">
              {isCreating ? (
                <>
                  <button
                    className="btn-secondary"
                    onClick={() => {
                      setIsCreating(false);
                      if (theme) {
                        handleSelectTheme(theme);
                      }
                    }}
                  >
                    取消
                  </button>
                  <button
                    className="btn-primary"
                    onClick={handleSave}
                    disabled={!nameInput.trim() || !cssInput.trim()}
                  >
                    保存新主题
                  </button>
                </>
              ) : isCustomTheme ? (
                <>
                  <button className="btn-icon-text" onClick={handleDuplicate}>
                    <Copy size={16} /> 复制
                  </button>
                  <button className="btn-icon-text btn-danger" onClick={handleDeleteClick}>
                    <Trash2 size={16} /> 删除
                  </button>
                  <div className="flex-spacer"></div>
                  <button className="btn-secondary" onClick={onClose}>
                    取消
                  </button>
                  <button className="btn-primary" onClick={handleSave}>
                    保存修改
                  </button>
                  <button className="btn-primary" onClick={handleApply}>
                    应用主题
                  </button>
                </>
              ) : (
                <>
                  <button className="btn-icon-text" onClick={handleDuplicate}>
                    <Copy size={16} /> 复制
                  </button>
                  <div className="flex-spacer"></div>
                  <button className="btn-secondary" onClick={onClose}>
                    取消
                  </button>
                  <button className="btn-primary" onClick={handleApply}>
                    应用主题
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
