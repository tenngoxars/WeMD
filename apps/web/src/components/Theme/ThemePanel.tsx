import { useEffect, useMemo, useState, useRef } from "react";
import toast from "react-hot-toast";
import {
  Plus,
  Copy,
  Trash2,
  X,
  AlertTriangle,
  Palette,
  Code,
} from "lucide-react";
import {
  createMarkdownParser,
  processHtml,
  convertCssToWeChatDarkMode,
} from "@wemd/core";
import { useEditorStore } from "../../store/editorStore";
import { useThemeStore } from "../../store/themeStore";
import { useHistoryStore } from "../../store/historyStore";
import { useUITheme } from "../../hooks/useUITheme";
import { ThemeDesigner, type DesignerVariables } from "./ThemeDesigner";
import "./ThemePanel.css";

// 主题预览用的示例 Markdown
const PREVIEW_MARKDOWN = `# 一级标题示例

这是一段**加粗文本**、*斜体文本*、~~删除线文本~~、==高亮文本==和 [链接示例](https://github.com/tenngoxars/WeMD)。
正文段落通常需要设置行高和间距，以保证阅读体验。

---

## 二级标题

> 这是一个引用块示例，通常用于强调重要内容或摘录。

| 平台 | 特点 | 适用程度 |
| :--- | :--- | :--- |
| 微信 | 封闭但流量大 | ⭐⭐⭐⭐⭐ |
| 博客 | 自由但流量小 | ⭐⭐⭐ |

### 三级标题

这里演示脚注的使用：[WeChat Markdown](https://github.com/tenngoxars/WeMD "WeMD 是一款专为公众号设计的编辑器") 可以极大提升排版效率。

> [!TIP]
> 这是一个提示块示例。支持切换“默认彩色”或“跟随主题色”风格，让排版更统一。

- 无序列表
  - 嵌套的无序列表 A
  - 嵌套的无序列表 B


1. 有序列表
   1. 嵌套的有序列表 A
   2. 嵌套的有序列表 B


#### 四级标题

这里有 \`行内代码\` 样式，也可以用来表示 \`npm install wemd\` 等指令。

\`\`\`js
// 代码块示例
function hello() {
  console.log("Hello WeMD");
}
\`\`\`

![WeMD 示例图片：不仅支持常规排版，更可以深度定制每一个细节。](https://img.wemd.app/example.jpg)
`;

// 实时预览组件 - 使用 iframe 隔离样式，并通过直接操作 DOM 避免重载导致的滚动重置
function ThemeLivePreview({ css }: { css: string }) {
  const parser = useMemo(() => createMarkdownParser(), []);
  const uiTheme = useUITheme((state) => state.theme);
  const isDarkMode = uiTheme === "dark";
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // 基础外壳文档，只加载一次
  const shellDoc = useMemo(
    () => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style id="base-style">
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          padding: 16px;
          font-size: 14px;
          line-height: 1.6;
          transition: background 0.2s, color 0.2s;
        }
        /* 隐藏滚动条直到内容加载 */
        body:empty { display: none; }
      </style>
      <style id="theme-style"></style>
    </head>
    <body><div id="preview-root"></div></body>
    </html>
  `,
    [],
  );

  const finalCss = useMemo(
    () => (isDarkMode ? convertCssToWeChatDarkMode(css) : css),
    [css, isDarkMode],
  );
  const html = useMemo(() => {
    const rawHtml = parser.render(PREVIEW_MARKDOWN);
    return processHtml(rawHtml, finalCss, true);
  }, [parser, finalCss]);

  // 同步更新 iframe 内容
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const updateContent = () => {
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc) return;

      const themeStyle = doc.getElementById("theme-style");
      const root = doc.getElementById("preview-root");

      if (themeStyle && root) {
        // 保存当前滚动位置
        const scrollY = iframe.contentWindow?.scrollY || 0;

        // 更新颜色
        doc.body.style.background = isDarkMode ? "#252526" : "#fff";
        doc.body.style.color = isDarkMode ? "#d4d4d4" : "#000";

        // 更新样式和 HTML
        themeStyle.textContent = finalCss;
        root.innerHTML = html;

        // 恢复滚动位置
        iframe.contentWindow?.scrollTo(0, scrollY);
      }
    };

    // 如果 iframe 还没加载完，等待加载后再更新
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (
      doc &&
      doc.readyState === "complete" &&
      doc.getElementById("preview-root")
    ) {
      updateContent();
    } else {
      iframe.onload = updateContent;
    }
  }, [html, finalCss, isDarkMode]);

  return (
    <div className="theme-live-preview">
      <div className="preview-header-mini">
        <span>实时预览</span>
      </div>
      <iframe
        ref={iframeRef}
        className="preview-iframe"
        srcDoc={shellDoc}
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
  const persistActiveSnapshot = useHistoryStore(
    (state) => state.persistActiveSnapshot,
  );
  // customThemes 变化时重新计算 allThemes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const allThemes = useMemo(
    () => getAllThemes(),
    [getAllThemes, customThemesFromStore],
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isElectron =
    typeof window !== "undefined" && !!(window as any).electron;
  const [selectedThemeId, setSelectedThemeId] = useState<string>("");
  const [nameInput, setNameInput] = useState("");
  const [cssInput, setCssInput] = useState("");
  const [visualCss, setVisualCss] = useState("");
  const [designerVariables, setDesignerVariables] = useState<
    DesignerVariables | undefined
  >(undefined);
  const [isCreating, setIsCreating] = useState(false);
  const [creationStep, setCreationStep] = useState<"select-mode" | "editing">(
    "select-mode",
  );
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editorMode, setEditorMode] = useState<"visual" | "css">("visual");
  // 用于检测是否有改动
  const [originalName, setOriginalName] = useState("");
  const [originalCss, setOriginalCss] = useState("");

  const selectedTheme = allThemes.find((t) => t.id === selectedThemeId);
  const isCustomTheme = selectedTheme && !selectedTheme.isBuiltIn;
  // 检测是否有未保存的改动
  const hasChanges =
    isCustomTheme && (nameInput !== originalName || cssInput !== originalCss);

  useEffect(() => {
    if (open) {
      const currentTheme = allThemes.find((t) => t.id === theme);
      if (currentTheme) {
        setSelectedThemeId(currentTheme.id);
        setNameInput(currentTheme.name);
        setCssInput(currentTheme.css);
        // 从主题读取编辑模式和变量
        setEditorMode(currentTheme.editorMode || "css");
        setDesignerVariables(currentTheme.designerVariables);
        // 记录原始值用于比较
        setOriginalName(currentTheme.name);
        setOriginalCss(currentTheme.css);
      } else {
        setEditorMode("css");
        setDesignerVariables(undefined);
        setOriginalName("");
        setOriginalCss("");
      }
      setIsCreating(false);
      setCreationStep("select-mode");
      setShowDeleteConfirm(false);
      setVisualCss("");
    }
  }, [open, theme, allThemes]);

  if (!open) return null;

  const handleSelectTheme = (themeId: string) => {
    const theme = allThemes.find((t) => t.id === themeId);
    if (!theme) return;

    setSelectedThemeId(themeId);
    setNameInput(theme.name);
    setCssInput(theme.css);
    setEditorMode(theme.editorMode || "css");
    setVisualCss("");
    setDesignerVariables(theme.designerVariables);
    // 记录原始值
    setOriginalName(theme.name);
    setOriginalCss(theme.css);
    setIsCreating(false);
    setCreationStep("select-mode");
    setShowDeleteConfirm(false);
  };

  const handleCreateNew = () => {
    setIsCreating(true);
    setCreationStep("select-mode"); // 先选择模式
    setSelectedThemeId("");
    setNameInput("");
    setCssInput("");
    setVisualCss("");
    setDesignerVariables(undefined);
    setShowDeleteConfirm(false);
  };

  const handleSelectCreationMode = (mode: "visual" | "css") => {
    setEditorMode(mode);
    setCreationStep("editing");
  };

  const handleVisualCssChange = (nextCss: string) => {
    setVisualCss(nextCss);
    setCssInput(nextCss);
  };

  const handleVariablesChange = (vars: DesignerVariables) => {
    setDesignerVariables(vars);
  };

  const handleCssInputChange = (value: string) => {
    setCssInput(value);
  };

  const handleApply = async () => {
    selectTheme(selectedThemeId);
    if (!isElectron) {
      const state = useEditorStore.getState();
      await persistActiveSnapshot({
        markdown: state.markdown,
        theme: selectedThemeId,
        customCSS: "",
        themeName: selectedTheme?.name || "默认主题",
      });
    }
    onClose();
  };

  const handleSave = async () => {
    if (isCreating) {
      const cssToSave =
        editorMode === "visual" ? visualCss || cssInput : cssInput;
      // 创建新主题，传入编辑模式和可视化变量
      const newTheme = createTheme(
        nameInput,
        editorMode,
        cssToSave,
        editorMode === "visual" ? designerVariables : undefined,
      );
      selectTheme(newTheme.id);

      if (!isElectron) {
        const state = useEditorStore.getState();
        await persistActiveSnapshot({
          markdown: state.markdown,
          theme: newTheme.id,
          customCSS: "",
          themeName: newTheme.name,
        });
      }

      setSelectedThemeId(newTheme.id);
      setCssInput(cssToSave);
      // 重置原始值，使 hasChanges 变为 false
      setOriginalName(nameInput);
      setOriginalCss(cssToSave);
      setIsCreating(false);
      toast.success("主题创建成功");
    } else if (isCustomTheme) {
      // 更新现有主题（可视化主题同时保存变量）
      const updates: {
        name: string;
        css: string;
        designerVariables?: DesignerVariables;
      } = {
        name: nameInput.trim() || "未命名主题",
        css: cssInput,
      };
      if (selectedTheme?.editorMode === "visual" && designerVariables) {
        updates.designerVariables = designerVariables;
      }
      updateTheme(selectedThemeId, updates);

      if (!isElectron) {
        const editorState = useEditorStore.getState();
        const themeState = useThemeStore.getState();
        if (themeState.themeId === selectedThemeId) {
          await persistActiveSnapshot({
            markdown: editorState.markdown,
            theme: selectedThemeId,
            customCSS: "",
            themeName: nameInput.trim() || "未命名主题",
          });
        }
      }
      // 保存后重置原始值
      setOriginalName(nameInput.trim() || "未命名主题");
      setOriginalCss(cssInput);
      toast.success("主题已保存");
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
    selectTheme("default");
    handleSelectTheme("default");
    setShowDeleteConfirm(false);
    toast.success("主题已删除");
  };

  const handleDuplicate = () => {
    if (!selectedTheme) return;
    const newName = `${selectedTheme.name} (副本)`;
    const duplicated = duplicateTheme(selectedThemeId, newName);
    handleSelectTheme(duplicated.id);
    toast.success("主题已复制");
  };

  // 分组主题
  const builtInThemes = allThemes.filter((t) => t.isBuiltIn);
  const customThemes = allThemes.filter((t) => !t.isBuiltIn);
  const previewCss =
    isCreating && editorMode === "visual" ? visualCss || cssInput : cssInput;
  const canSave =
    nameInput.trim() &&
    (editorMode === "visual"
      ? visualCss.trim() || cssInput.trim()
      : cssInput.trim());

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
                      className={`theme-item ${item.id === selectedThemeId ? "active" : ""}`}
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
                    className={`theme-item ${item.id === selectedThemeId ? "active" : ""}`}
                    onClick={() => handleSelectTheme(item.id)}
                  >
                    {item.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 右侧编辑区 */}
          <div className="theme-editor" style={{ position: "relative" }}>
            {showDeleteConfirm && (
              <div className="delete-confirm-overlay">
                <div className="delete-confirm-box">
                  <div className="confirm-icon-wrapper">
                    <AlertTriangle size={24} color="#ef4444" />
                  </div>
                  <h4>确认删除</h4>
                  <p>
                    确定要删除主题 "{selectedTheme?.name}" 吗？此操作无法撤销。
                  </p>
                  <div className="delete-confirm-actions">
                    <button
                      className="btn-secondary"
                      onClick={() => setShowDeleteConfirm(false)}
                    >
                      取消
                    </button>
                    <button
                      className="btn-primary"
                      style={{ background: "#ef4444", boxShadow: "none" }}
                      onClick={handleConfirmDelete}
                    >
                      确认删除
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="theme-form">
              {/* 模式选择步骤 - 新建时首先选择编辑方式 */}
              {isCreating && creationStep === "select-mode" && (
                <div className="mode-selection">
                  <h3>选择创建方式</h3>
                  <div className="mode-cards">
                    <button
                      className="mode-card"
                      onClick={() => handleSelectCreationMode("visual")}
                    >
                      <span className="mode-icon">
                        <Palette size={32} />
                      </span>
                      <span className="mode-title">可视化设计</span>
                      <span className="mode-desc">
                        通过可视化控件快速定制主题样式
                      </span>
                      <span className="mode-tag">适合快速上手</span>
                    </button>
                    <button
                      className="mode-card"
                      onClick={() => handleSelectCreationMode("css")}
                    >
                      <span className="mode-icon">
                        <Code size={32} />
                      </span>
                      <span className="mode-title">手写 CSS</span>
                      <span className="mode-desc">
                        直接编写 CSS 代码，完全自由控制
                      </span>
                      <span className="mode-tag">适合高级用户</span>
                    </button>
                  </div>
                </div>
              )}

              {/* 正式编辑区 - 选择模式后或编辑已有主题时显示 */}
              {(!isCreating || (isCreating && creationStep === "editing")) && (
                <>
                  {/* 实时预览区 */}
                  <div className="theme-form-preview">
                    <ThemeLivePreview css={previewCss} />
                  </div>

                  <div className="theme-form-fields">
                    <label>主题名称</label>
                    <input
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      placeholder="输入主题名称..."
                      disabled={!isCreating && !isCustomTheme}
                    />

                    {/* 可视化设计器 - 可视化模式 */}
                    {((isCreating && editorMode === "visual") ||
                      (!isCreating &&
                        isCustomTheme &&
                        selectedTheme?.editorMode === "visual")) && (
                      <div className="visual-designer-container">
                        <ThemeDesigner
                          onCSSChange={handleVisualCssChange}
                          onVariablesChange={handleVariablesChange}
                          initialVariables={
                            isCreating
                              ? undefined
                              : selectedTheme?.designerVariables
                          }
                        />
                      </div>
                    )}

                    {/* CSS 编辑器 - CSS 模式或编辑旧版/CSS 主题 */}
                    {((isCreating && editorMode === "css") ||
                      (!isCreating &&
                        selectedTheme?.editorMode !== "visual")) && (
                      <>
                        <label>CSS 样式</label>
                        <textarea
                          value={cssInput}
                          onChange={(e) => handleCssInputChange(e.target.value)}
                          placeholder="输入 CSS 样式代码..."
                          spellCheck={false}
                          disabled={!isCreating && !isCustomTheme}
                        />
                      </>
                    )}

                    {!isCreating && !isCustomTheme && (
                      <p className="info-hint">
                        💡
                        内置主题不可编辑，点击"复制"按钮可以基于此主题创建自定义主题
                      </p>
                    )}
                  </div>
                </>
              )}
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
                    disabled={!canSave}
                  >
                    保存为新主题
                  </button>
                </>
              ) : isCustomTheme ? (
                <>
                  <button className="btn-icon-text" onClick={handleDuplicate}>
                    <Copy size={16} /> 复制
                  </button>
                  <button
                    className="btn-icon-text btn-danger"
                    onClick={handleDeleteClick}
                  >
                    <Trash2 size={16} /> 删除
                  </button>
                  <div className="flex-spacer"></div>
                  <button className="btn-secondary" onClick={onClose}>
                    取消
                  </button>
                  <button
                    className="btn-primary"
                    onClick={handleSave}
                    disabled={!hasChanges}
                  >
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
