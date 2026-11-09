import { useEffect, useMemo, useState, useRef } from "react";
import toast from "react-hot-toast";
import { useEditorStore } from "../../store/editorStore";
import { useThemeStore } from "../../store/themeStore";
import { isThemeSelectable } from "../../store/themes/builtInThemes";
import { useHistoryStore } from "../../store/historyStore";
import { platformActions } from "../../lib/platformAdapter";
import { type DesignerVariables, defaultVariables } from "./ThemeDesigner";
import { generateCSS } from "./ThemeDesigner/generateCSS";
import { ThemePanelView } from "./ThemePanelView";
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
  const workspaceBackend = useThemeStore((state) => state.workspaceBackend);
  const workspaceFileBroken = useThemeStore(
    (state) => state.workspaceFileBroken,
  );
  const storageHint =
    workspaceBackend && !workspaceFileBroken
      ? "保存在当前本地文件夹，换浏览器或设备打开同一文件夹即可继续使用"
      : workspaceFileBroken
        ? "本地文件夹中的主题文件无法读取，本次保存仅留在本机"
        : "保存在当前浏览器，启用本地文件夹后会随文件夹一起保存";
  const persistSnapshot = useHistoryStore(
    (state) => state.persistActiveSnapshot,
  );
  // 快照写入失败已由 historyDb 提示；主题本身已生效，弹窗流程照常走完，避免重复创建主题
  const persistActiveSnapshot = async (
    data: Parameters<typeof persistSnapshot>[0],
  ) => {
    try {
      await persistSnapshot(data);
    } catch {
      // 已提示
    }
  };

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);

  const allThemes = useMemo(
    () => [
      ...getAllThemes().filter((item) => item.isBuiltIn),
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editorMode, setEditorMode] = useState<"visual" | "css">("visual");
  const [originalName, setOriginalName] = useState("");
  const [originalCss, setOriginalCss] = useState("");
  const [originalDesignerVariables, setOriginalDesignerVariables] = useState<
    DesignerVariables | undefined
  >(undefined);
  const [useCurrentArticle, setUseCurrentArticle] = useState(true);

  const selectedTheme = allThemes.find((item) => item.id === selectedThemeId);
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
      const currentTheme = allThemes.find((item) => item.id === theme);
      if (currentTheme) {
        setSelectedThemeId(currentTheme.id);
        setNameInput(currentTheme.name);
        setCssInput(currentTheme.css);
        setEditorMode(currentTheme.editorMode || "css");
        const nextDesignerVariables =
          currentTheme.editorMode === "visual"
            ? normalizeDesignerVariables(currentTheme.designerVariables)
            : undefined;
        setDesignerVariables(nextDesignerVariables);
        setOriginalDesignerVariables(nextDesignerVariables);
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
    const target = allThemes.find((item) => item.id === themeId);
    if (!target) return;

    setSelectedThemeId(themeId);
    setNameInput(target.name);
    setCssInput(target.css);
    setEditorMode(target.editorMode || "css");
    setVisualCss("");

    const nextDesignerVariables =
      target.editorMode === "visual"
        ? normalizeDesignerVariables(target.designerVariables)
        : undefined;
    setDesignerVariables(nextDesignerVariables);
    setOriginalDesignerVariables(nextDesignerVariables);

    setOriginalName(target.name);
    setOriginalCss(target.css);
    setIsCreating(false);
    setCreationStep("select-mode");
    setShowDeleteConfirm(false);
  };

  const handleCreateNew = () => {
    setIsCreating(true);
    setCreationStep("select-mode");
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
      setOriginalName(nameInput);
      setOriginalCss(cssToSave);
      setOriginalDesignerVariables(
        editorMode === "visual" ? designerVariables : undefined,
      );
      setIsCreating(false);
      toast.success("主题创建成功");
      return;
    }

    if (isCustomTheme) {
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
    selectTheme("default");
    handleSelectTheme("default");
    setShowDeleteConfirm(false);
    toast.success("主题已删除");
  };

  const handleDuplicate = () => {
    if (!selectedTheme) return;
    const duplicated = duplicateTheme(
      selectedThemeId,
      `${selectedTheme.name} (副本)`,
    );
    handleSelectTheme(duplicated.id);
    toast.success("主题已复制");
  };

  const handleCancelCreate = () => {
    setIsCreating(false);
    if (theme) {
      handleSelectTheme(theme);
    }
  };

  const handleImportThemeFile = async (file: File) => {
    const success = await importTheme(file);
    if (success) {
      toast.success("主题导入成功");
    } else {
      toast.error("导入失败，请检查文件格式");
    }
  };

  const builtInThemes = allThemes.filter(
    (item) => item.isBuiltIn && isThemeSelectable(item),
  );
  const customThemes = allThemes.filter((item) => !item.isBuiltIn);
  const isVisualEditing =
    (isCreating && editorMode === "visual") ||
    (!isCreating && isCustomTheme && selectedTheme?.editorMode === "visual");
  const previewCss = isVisualEditing ? visualCss || cssInput : cssInput;
  const canSave = Boolean(
    nameInput.trim() &&
      (editorMode === "visual"
        ? visualCss.trim() || cssInput.trim()
        : cssInput.trim()),
  );

  return (
    <ThemePanelView
      open={open}
      onClose={onClose}
      fileInputRef={fileInputRef}
      builtInThemes={builtInThemes}
      customThemes={customThemes}
      selectedTheme={selectedTheme}
      selectedThemeId={selectedThemeId}
      isCustomTheme={Boolean(isCustomTheme)}
      isCreating={isCreating}
      creationStep={creationStep}
      editorMode={editorMode}
      isVisualEditing={Boolean(isVisualEditing)}
      showDeleteConfirm={showDeleteConfirm}
      storageHint={storageHint}
      useCurrentArticle={useCurrentArticle}
      previewCss={previewCss}
      designerVariables={designerVariables}
      nameInput={nameInput}
      cssInput={cssInput}
      canSave={canSave}
      hasChanges={Boolean(hasChanges)}
      exportMenuOpen={exportMenuOpen}
      exportMenuRef={exportMenuRef}
      onSelectTheme={handleSelectTheme}
      onCreateNew={handleCreateNew}
      onImportThemeFile={handleImportThemeFile}
      onSelectCreationMode={handleSelectCreationMode}
      onSetUseCurrentArticle={setUseCurrentArticle}
      onVisualCssChange={handleVisualCssChange}
      onVariablesChange={handleVariablesChange}
      onNameInputChange={setNameInput}
      onCssInputChange={handleCssInputChange}
      onCloseDeleteConfirm={() => setShowDeleteConfirm(false)}
      onConfirmDelete={handleConfirmDelete}
      onCancelCreate={handleCancelCreate}
      onDuplicate={handleDuplicate}
      onToggleExportMenu={() => setExportMenuOpen((prev) => !prev)}
      onExportJson={() => {
        exportTheme(selectedThemeId);
        setExportMenuOpen(false);
      }}
      onExportCss={() => {
        exportThemeCSS(selectedThemeId);
        setExportMenuOpen(false);
      }}
      onDeleteClick={handleDeleteClick}
      onSave={handleSave}
      onApply={handleApply}
    />
  );
}
