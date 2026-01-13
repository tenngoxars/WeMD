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
  Download,
  ChevronDown,
  Upload,
} from "lucide-react";
import { useEditorStore } from "../../store/editorStore";
import { useThemeStore } from "../../store/themeStore";
import { useHistoryStore } from "../../store/historyStore";
import { platformActions } from "../../lib/platformAdapter";
import {
  ThemeDesigner,
  type DesignerVariables,
  defaultVariables,
} from "./ThemeDesigner";
import { generateCSS } from "./ThemeDesigner/generateCSS";
import { ThemeLivePreview } from "./ThemeLivePreview";
import "./ThemePanel.css";

interface ThemePanelProps {
  open: boolean;
  onClose: () => void;
}

const normalizeDesignerVariables = (
  variables?: DesignerVariables,
): DesignerVariables => ({
  ...defaultVariables,
  ...variables,
  h1: { ...defaultVariables.h1, ...variables?.h1 },
  h2: { ...defaultVariables.h2, ...variables?.h2 },
  h3: { ...defaultVariables.h3, ...variables?.h3 },
  h4: { ...defaultVariables.h4, ...variables?.h4 },
});

const areDesignerVariablesEqual = (
  a?: DesignerVariables,
  b?: DesignerVariables,
) => {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return JSON.stringify(a) === JSON.stringify(b);
};

export function ThemePanel({ open, onClose }: ThemePanelProps) {
  const theme = useThemeStore((state) => state.themeId);
  const selectTheme = useThemeStore((state) => state.selectTheme);
  const createTheme = useThemeStore((state) => state.createTheme);
  const updateTheme = useThemeStore((state) => state.updateTheme);
  const deleteTheme = useThemeStore((state) => state.deleteTheme);
  const duplicateTheme = useThemeStore((state) => state.duplicateTheme);
  const getAllThemes = useThemeStore((state) => state.getAllThemes);
  const exportTheme = useThemeStore((state) => state.exportTheme);
  const exportThemeCSS = useThemeStore((state) => state.exportThemeCSS);
  const importTheme = useThemeStore((state) => state.importTheme);
  const customThemesFromStore = useThemeStore((state) => state.customThemes);
  const persistActiveSnapshot = useHistoryStore(
    (state) => state.persistActiveSnapshot,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const allThemes = useMemo(
    () => [
      ...getAllThemes().filter((theme) => theme.isBuiltIn),
      ...customThemesFromStore,
    ],
    [getAllThemes, customThemesFromStore],
  );
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
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editorMode, setEditorMode] = useState<"visual" | "css">("visual");
  const [originalName, setOriginalName] = useState("");
  const [originalCss, setOriginalCss] = useState("");
  const [originalDesignerVariables, setOriginalDesignerVariables] = useState<
    DesignerVariables | undefined
  >(undefined);

  const selectedTheme = allThemes.find((t) => t.id === selectedThemeId);
  const isCustomTheme = selectedTheme && !selectedTheme.isBuiltIn;

  useEffect(() => {
    setExportMenuOpen(false);
  }, [selectedThemeId, isCustomTheme]);

  useEffect(() => {
    if (!open) {
      setExportMenuOpen(false);
    }
  }, [open]);

  const isVisualCustom =
    isCustomTheme && selectedTheme?.editorMode === "visual";
  const hasDesignerChanges =
    isVisualCustom &&
    !areDesignerVariablesEqual(designerVariables, originalDesignerVariables);
  const hasChanges =
    isCustomTheme &&
    (nameInput !== originalName ||
      cssInput !== originalCss ||
      hasDesignerChanges);

  const prevOpenRef = useRef(false);
  useEffect(() => {
    const wasOpen = prevOpenRef.current;
    prevOpenRef.current = open;

    if (open && !wasOpen) {
      const currentTheme = allThemes.find((t) => t.id === theme);
      if (currentTheme) {
        setSelectedThemeId(currentTheme.id);
        setNameInput(currentTheme.name);
        setCssInput(currentTheme.css);
        // 从主题读取编辑模式和变量
        setEditorMode(currentTheme.editorMode || "css");
        const nextDesignerVariables =
          currentTheme.editorMode === "visual"
            ? normalizeDesignerVariables(currentTheme.designerVariables)
            : undefined;
        setDesignerVariables(nextDesignerVariables);
        setOriginalDesignerVariables(nextDesignerVariables);
        // 记录原始值用于比较
        setOriginalName(currentTheme.name);
        setOriginalCss(currentTheme.css);
      } else {
        setEditorMode("css");
        setDesignerVariables(undefined);
        setOriginalDesignerVariables(undefined);
        setOriginalName("");
        setOriginalCss("");
      }
      setIsCreating(false);
      setCreationStep("select-mode");
      setShowDeleteConfirm(false);
      setVisualCss("");
    }
  }, [open, theme, allThemes]);

  const handleSelectTheme = (themeId: string) => {
    const theme = allThemes.find((t) => t.id === themeId);
    if (!theme) return;

    setSelectedThemeId(themeId);
    setNameInput(theme.name);
    setCssInput(theme.css);
    setEditorMode(theme.editorMode || "css");
    setVisualCss("");
    const nextDesignerVariables =
      theme.editorMode === "visual"
        ? normalizeDesignerVariables(theme.designerVariables)
        : undefined;
    setDesignerVariables(nextDesignerVariables);
    setOriginalDesignerVariables(nextDesignerVariables);
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
    setOriginalDesignerVariables(undefined);
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
    setDesignerVariables(normalizeDesignerVariables(vars));
  };

  const handleCssInputChange = (value: string) => {
    setCssInput(value);
  };

  useEffect(() => {
    if (!exportMenuOpen) return;

    const handleOutsideClick = (event: MouseEvent) => {
      if (
        exportMenuRef.current &&
        !exportMenuRef.current.contains(event.target as Node)
      ) {
        setExportMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setExportMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [exportMenuOpen]);

  const handleApply = async () => {
    // 自动保存逻辑：如果是自定义主题且有未保存的更改，先执行保存
    if (isCustomTheme && hasChanges) {
      const cssToVerify =
        editorMode === "visual" ? visualCss || cssInput : cssInput;
      if (!nameInput.trim() || !cssToVerify.trim()) {
        toast.error("无法保存更改：主题名称或内容不能为空");
        return;
      }
      await handleSave();
    }

    selectTheme(selectedThemeId);
    if (platformActions.shouldPersistHistory()) {
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

      if (platformActions.shouldPersistHistory()) {
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
      setOriginalDesignerVariables(
        editorMode === "visual" ? designerVariables : undefined,
      );
      setIsCreating(false);
      toast.success("主题创建成功");
    } else if (isCustomTheme) {
      // 更新现有主题（可视化主题从 designerVariables 重新生成 CSS 以确保同步）
      const isVisualMode =
        selectedTheme?.editorMode === "visual" && designerVariables;
      const cssToSave = isVisualMode
        ? generateCSS(designerVariables)
        : cssInput;

      const updates: {
        name: string;
        css: string;
        designerVariables?: DesignerVariables;
      } = {
        name: nameInput.trim() || "未命名主题",
        css: cssToSave,
      };
      if (isVisualMode) {
        updates.designerVariables = designerVariables;
      }
      updateTheme(selectedThemeId, updates);

      if (platformActions.shouldPersistHistory()) {
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
      setOriginalDesignerVariables(
        isVisualMode ? designerVariables : undefined,
      );
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

  if (!open) return null;

  const builtInThemes = allThemes.filter((t) => t.isBuiltIn);
  const customThemes = allThemes.filter((t) => !t.isBuiltIn);
  // 可视化模式下（无论是创建还是编辑），优先使用 visualCss（编辑器生成的最新 CSS）
  const isVisualEditing =
    (isCreating && editorMode === "visual") ||
    (!isCreating && isCustomTheme && selectedTheme?.editorMode === "visual");
  const previewCss = isVisualEditing ? visualCss || cssInput : cssInput;
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
            <button
              className="btn-import-theme"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={16} /> 导入主题
            </button>
            <input
              type="file"
              ref={fileInputRef}
              accept=".json"
              style={{ display: "none" }}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const success = await importTheme(file);
                  if (success) {
                    toast.success("主题导入成功");
                  } else {
                    toast.error("导入失败，请检查文件格式");
                  }
                  e.target.value = "";
                }
              }}
            />

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
                    <ThemeLivePreview
                      css={previewCss}
                      designerVariables={
                        isVisualEditing ? designerVariables : undefined
                      }
                    />
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
                  <div className="theme-export-menu" ref={exportMenuRef}>
                    <button
                      className="btn-icon-text"
                      onClick={() => setExportMenuOpen((open) => !open)}
                      aria-haspopup="menu"
                      aria-expanded={exportMenuOpen}
                    >
                      <Download size={16} /> 导出 <ChevronDown size={14} />
                    </button>
                    {exportMenuOpen && (
                      <div className="theme-export-dropdown" role="menu">
                        {selectedTheme?.editorMode === "visual" && (
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              exportTheme(selectedThemeId);
                              setExportMenuOpen(false);
                            }}
                          >
                            <Download size={16} /> JSON（支持可视化编辑）
                          </button>
                        )}
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            exportThemeCSS(selectedThemeId);
                            setExportMenuOpen(false);
                          }}
                        >
                          <Download size={16} /> CSS（不支持可视化编辑）
                        </button>
                      </div>
                    )}
                  </div>
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
