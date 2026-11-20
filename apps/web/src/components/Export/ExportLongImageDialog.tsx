import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  AlertTriangle,
  Check,
  Image,
  ImageDown,
  Loader2,
  Scissors,
} from "lucide-react";
import { Modal } from "../common";
import { ExportDropdown, type ExportDropdownOption } from "./ExportDropdown";
import { getDesktop } from "../../lib/platformAdapter";
import {
  getActiveThemeRenderOptions,
  useEditorStore,
} from "../../store/editorStore";
import {
  computeExportPixelRatio,
  estimateExportBytes,
  exportLongImage,
  renderLongImagePreview,
  type LongImageExportOptions,
  type LongImagePreview,
} from "../../services/longImageExportService";
import {
  formatFontSize,
  isExportFontLoaded,
  loadExportFont,
  loadExportFontCatalog,
  type ExportFont,
} from "../../services/exportFonts";
import "./ExportLongImageDialog.css";

type BackgroundMode = "white" | "transparent" | "custom";
type ExportMode = "single" | "split";

interface ExportLongImageDialogProps {
  open: boolean;
  onClose: () => void;
}

interface DialogContent {
  markdown: string;
  css: string;
  showMacBar: boolean;
}

interface StoredOptions {
  fontId: string;
  mode: ExportMode;
  maxHeight: number;
  fontSize: number;
  clarity: number;
  background: BackgroundMode;
  customColor: string;
}

const STORAGE_KEY = "wemd-export-image-options";
const EXPORT_WIDTH = 375;
const WECHAT_IMAGE_LIMIT = 10 * 1024 * 1024;
const DEFAULT_FONT_FAMILY =
  'Optima-Regular, Optima, "PingFang SC", "Microsoft YaHei", "微软雅黑", "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const DEFAULT_OPTIONS: StoredOptions = {
  fontId: "default",
  mode: "single",
  maxHeight: 2000,
  fontSize: 16,
  clarity: 2,
  background: "white",
  customColor: "#ffffff",
};

const readStoredOptions = (): StoredOptions => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_OPTIONS;
    const parsed = JSON.parse(raw) as Partial<StoredOptions>;
    const merged = { ...DEFAULT_OPTIONS, ...parsed };
    // 旧版本存的是跟随主题，升级后统一落到默认字体
    if (merged.fontId === "theme") merged.fontId = "default";
    return merged;
  } catch {
    return DEFAULT_OPTIONS;
  }
};

const totalFontBytes = (font: ExportFont): number =>
  font.weights.reduce((sum, weight) => sum + weight.bytes, 0);

export function ExportLongImageDialog({
  open,
  onClose,
}: ExportLongImageDialogProps) {
  const [catalog, setCatalog] = useState<ExportFont[] | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [content, setContent] = useState<DialogContent | null>(null);
  const [preview, setPreview] = useState<LongImagePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [fontLoading, setFontLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [initialOptions] = useState(readStoredOptions);
  const [fontId, setFontId] = useState(initialOptions.fontId);
  const [mode, setMode] = useState<ExportMode>(initialOptions.mode);
  const [maxHeight, setMaxHeight] = useState(initialOptions.maxHeight);
  const [fontSize, setFontSize] = useState(initialOptions.fontSize);
  const [clarity, setClarity] = useState(initialOptions.clarity);
  const [background, setBackground] = useState<BackgroundMode>(
    initialOptions.background,
  );
  const [customColor, setCustomColor] = useState(initialOptions.customColor);
  const requestRef = useRef(0);
  const previewTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!open) {
      requestRef.current += 1;
      setPreviewLoading(false);
      setFontLoading(false);
      return;
    }
    setContent({
      markdown: useEditorStore.getState().markdown,
      ...getActiveThemeRenderOptions(),
    });
    setPreview(null);
    setPreviewError(null);
    setPreviewLoading(false);
    setFontLoading(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setCatalogError(null);
    loadExportFontCatalog()
      .then((fonts) => {
        if (alive) {
          setCatalog(fonts);
          setCatalogError(null);
        }
      })
      .catch((error: unknown) => {
        if (alive) {
          setCatalogError(
            error instanceof Error ? error.message : String(error),
          );
        }
      });
    return () => {
      alive = false;
    };
  }, [open]);

  const selectedFont =
    fontId === "default"
      ? null
      : (catalog?.find((font) => font.id === fontId) ?? null);

  useEffect(() => {
    if (!open) return;
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          fontId,
          mode,
          maxHeight,
          fontSize,
          clarity,
          background,
          customColor,
        }),
      );
    } catch {
      // 存储不可用时忽略
    }
  }, [
    open,
    fontId,
    mode,
    maxHeight,
    fontSize,
    clarity,
    background,
    customColor,
  ]);

  useEffect(() => {
    if (!open || !content) return;
    const font =
      fontId === "default"
        ? null
        : (catalog?.find((item) => item.id === fontId) ?? null);
    if (fontId !== "default" && !catalog && !catalogError) return;
    const requestId = ++requestRef.current;
    const timer = window.setTimeout(async () => {
      previewTimerRef.current = null;
      setPreviewLoading(true);
      setPreviewError(null);
      try {
        if (font && !isExportFontLoaded(font)) {
          setFontLoading(true);
          await loadExportFont(font);
        }
        if (requestId !== requestRef.current) return;
        const options: LongImageExportOptions = {
          showMacBar: content.showMacBar,
          fontFamily: fontId === "default" ? DEFAULT_FONT_FAMILY : font?.family,
          fontFallback:
            fontId === "default"
              ? "sans-serif"
              : (font?.fallback ?? "sans-serif"),
          fontSize,
          backgroundColor:
            background === "white"
              ? "#ffffff"
              : background === "transparent"
                ? "transparent"
                : customColor,
          mode,
          splitMaxHeight: maxHeight,
        };
        const result = await renderLongImagePreview(
          content.markdown,
          content.css,
          options,
        );
        if (requestId === requestRef.current) setPreview(result);
      } catch (error) {
        if (requestId === requestRef.current) {
          setPreviewError(
            error instanceof Error ? error.message : String(error),
          );
        }
      } finally {
        if (requestId === requestRef.current) {
          setPreviewLoading(false);
          setFontLoading(false);
        }
      }
    }, 250);
    previewTimerRef.current = timer;
    return () => {
      window.clearTimeout(timer);
      previewTimerRef.current = null;
      requestRef.current += 1;
    };
  }, [
    open,
    content,
    catalog,
    fontId,
    fontSize,
    catalogError,
    background,
    customColor,
    mode,
    maxHeight,
  ]);

  const handleExport = async () => {
    if (!content || exporting || waitingCatalog || !fontReady) return;
    requestRef.current += 1;
    if (previewTimerRef.current !== null) {
      window.clearTimeout(previewTimerRef.current);
      previewTimerRef.current = null;
    }
    setExporting(true);
    try {
      if (selectedFont && !isExportFontLoaded(selectedFont)) {
        setFontLoading(true);
        await loadExportFont(selectedFont);
      }
      const exported = await exportLongImage(content.markdown, content.css, {
        showMacBar: content.showMacBar,
        fontFamily:
          fontId === "default" ? DEFAULT_FONT_FAMILY : selectedFont?.family,
        fontFallback:
          fontId === "default"
            ? "sans-serif"
            : (selectedFont?.fallback ?? "sans-serif"),
        fontSize,
        preferredPixelRatio: clarity,
        backgroundColor:
          background === "white"
            ? "#ffffff"
            : background === "transparent"
              ? "transparent"
              : customColor,
        mode,
        splitMaxHeight: maxHeight,
      });
      if (exported) onClose();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "字体加载失败，请重试",
      );
    } finally {
      setExporting(false);
      setFontLoading(false);
    }
  };

  const fontOptions: ExportDropdownOption[] = [
    { value: "default", label: "默认字体" },
    ...(catalog ?? []).map((font) => ({
      value: font.id,
      label: font.label,
      fontFamily: isExportFontLoaded(font) ? `"${font.family}"` : undefined,
      image:
        font.previewLight && font.previewDark
          ? {
              light: `https://img.wemd.app/fonts/${font.previewLight}`,
              dark: `https://img.wemd.app/fonts/${font.previewDark}`,
            }
          : undefined,
    })),
  ];

  const pageCount = preview?.pages.length ?? 0;
  const effectiveHeight =
    mode === "split" && pageCount > 0 && preview
      ? Math.max(...preview.pages.map((page) => page.bottom - page.top))
      : (preview?.height ?? 0);
  const effectiveRatio = preview
    ? computeExportPixelRatio(EXPORT_WIDTH, effectiveHeight, clarity)
    : clarity;
  const fontReady = fontId === "default" || !!selectedFont;
  const waitingCatalog = !fontReady && !catalog && !catalogError;
  const isEmpty = preview !== null && preview.height < 2;
  const singleOutput = mode === "single" || pageCount <= 1;
  const estimatedBytes = preview
    ? estimateExportBytes(preview, clarity, EXPORT_WIDTH)
    : 0;
  const overLimit = singleOutput && estimatedBytes > WECHAT_IMAGE_LIMIT;
  const busy = exporting || fontLoading || previewLoading;

  return (
    <Modal
      open={open}
      onClose={exporting ? () => undefined : onClose}
      title="导出长图"
      description="设置只影响导出的图片，不修改文章和主题"
      className="export-image-modal"
      bodyClassName="export-image-body"
      dismissible={!exporting}
    >
      <div className="export-image-layout">
        <div className="export-preview-panel">
          <div className="export-preview-scroll">
            {preview?.dataUrl ? (
              <img
                src={preview.dataUrl}
                alt="长图预览"
                className={
                  background === "transparent" ? "is-transparent" : undefined
                }
              />
            ) : (
              <div className="export-preview-empty">
                {previewError ??
                  (waitingCatalog
                    ? "正在加载字体..."
                    : previewLoading
                      ? "正在生成预览..."
                      : isEmpty
                        ? "文章为空，暂无可导出内容"
                        : "暂无预览")}
              </div>
            )}
          </div>
          {previewLoading && preview && (
            <div className="export-preview-loading">
              <Loader2 size={20} className="export-spin" />
            </div>
          )}
          <div className="export-preview-meta">
            <span>
              {preview && preview.height >= 2
                ? `${EXPORT_WIDTH} × ${Math.round(preview.height)} px`
                : `${EXPORT_WIDTH} px`}
            </span>
            <span>
              {mode === "split" && pageCount > 1
                ? `预计 ${pageCount} 张`
                : "单张长图"}
            </span>
            <span>清晰度 {effectiveRatio}x</span>
            <span>
              {!singleOutput ? "ZIP " : ""}约{" "}
              {estimatedBytes > 0
                ? estimatedBytes >= 1024 * 1024
                  ? `${(estimatedBytes / 1024 / 1024).toFixed(1)} MB`
                  : `${Math.max(1, Math.round(estimatedBytes / 1024))} KB`
                : "—"}
            </span>
          </div>
          {previewError && preview?.dataUrl && (
            <div className="export-preview-error" role="alert">
              {previewError}
            </div>
          )}
          {overLimit && (
            <div className="export-limit-warning" role="alert">
              <AlertTriangle size={14} strokeWidth={2} />
              <span>预计超过公众号单图 10 MB 限制，上传可能失败</span>
              {mode === "single" ? (
                <button type="button" onClick={() => setMode("split")}>
                  改用智能分割
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setClarity(Math.max(1, clarity - 1))}
                >
                  降低清晰度
                </button>
              )}
            </div>
          )}
        </div>

        <div className="export-options">
          <div className="export-options-body">
            <div className="export-section">
              <div className="export-section-title">画面与排版</div>

              <div className="export-field">
                <label htmlFor="export-font">字体</label>
                <ExportDropdown
                  id="export-font"
                  value={fontId}
                  options={fontOptions}
                  onChange={setFontId}
                  ariaLabel="字体"
                  disabled={exporting}
                />
                <small>
                  {catalogError
                    ? catalogError
                    : fontId === "default"
                      ? "使用 WeMD 默认字体"
                      : selectedFont
                        ? `${formatFontSize(totalFontBytes(selectedFont))} · ${
                            isExportFontLoaded(selectedFont)
                              ? "已加载"
                              : "首次使用需下载"
                          }`
                        : "选择字体"}
                  {selectedFont?.licenseFiles?.[0] && (
                    <>
                      {" · "}
                      <a
                        className="export-font-license"
                        href={`https://img.wemd.app/fonts/${selectedFont.licenseFiles[0]}`}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(event) => {
                          const shell = getDesktop()?.shell;
                          if (!shell) return;
                          event.preventDefault();
                          void shell
                            .openExternal(event.currentTarget.href)
                            .catch(() => {
                              toast.error("无法打开字体许可链接");
                            });
                        }}
                      >
                        字体许可
                      </a>
                    </>
                  )}
                </small>
              </div>

              <div className="export-field">
                <label htmlFor="export-clarity">清晰度</label>
                <ExportDropdown
                  id="export-clarity"
                  value={String(clarity)}
                  options={[
                    { value: "1", label: "1x 标准" },
                    { value: "2", label: "2x 高清" },
                    { value: "3", label: "3x 超清" },
                  ]}
                  onChange={(next) => setClarity(Number(next))}
                  ariaLabel="清晰度"
                  disabled={exporting}
                />
                <small>
                  实际 {effectiveRatio}x；超长图片会自动降低，避免画布超限
                </small>
              </div>

              <div className="export-field">
                <label htmlFor="export-background">背景</label>
                <ExportDropdown
                  id="export-background"
                  value={background}
                  options={[
                    { value: "white", label: "白色" },
                    { value: "transparent", label: "透明" },
                    { value: "custom", label: "自定义颜色" },
                  ]}
                  onChange={(next) => setBackground(next as BackgroundMode)}
                  ariaLabel="背景"
                  disabled={exporting}
                />
                {background === "custom" && (
                  <input
                    type="color"
                    aria-label="自定义背景颜色"
                    value={customColor}
                    disabled={exporting}
                    onChange={(event) => setCustomColor(event.target.value)}
                  />
                )}
                {background === "transparent" && (
                  <small>只去除画布底色，主题自身背景仍保留</small>
                )}
              </div>

              <div className="export-field">
                <label htmlFor="export-font-size">字号</label>
                <ExportDropdown
                  id="export-font-size"
                  value={String(fontSize)}
                  options={[
                    { value: "14", label: "14px" },
                    { value: "16", label: "16px 默认" },
                    { value: "18", label: "18px" },
                  ]}
                  onChange={(next) => setFontSize(Number(next))}
                  ariaLabel="字号"
                  disabled={exporting}
                />
                <small>以正文字号为基准，整篇文字等比缩放</small>
              </div>
            </div>

            <div className="export-section">
              <div className="export-section-title">输出</div>

              <div className="export-field">
                <label>导出方式</label>
                <div
                  className="export-modes"
                  role="group"
                  aria-label="导出方式"
                >
                  <button
                    type="button"
                    className={`export-mode-card${mode === "single" ? " is-active" : ""}`}
                    aria-pressed={mode === "single"}
                    disabled={exporting}
                    onClick={() => setMode("single")}
                  >
                    <Image
                      size={17}
                      strokeWidth={1.8}
                      className="export-mode-icon"
                    />
                    <span className="export-mode-text">
                      <strong>单张长图</strong>
                      <small>一张完整图片</small>
                    </span>
                    {mode === "single" && (
                      <Check
                        size={14}
                        strokeWidth={2}
                        className="export-mode-check"
                      />
                    )}
                  </button>
                  <button
                    type="button"
                    className={`export-mode-card${mode === "split" ? " is-active" : ""}`}
                    aria-pressed={mode === "split"}
                    disabled={exporting}
                    onClick={() => setMode("split")}
                  >
                    <Scissors
                      size={17}
                      strokeWidth={1.8}
                      className="export-mode-icon"
                    />
                    <span className="export-mode-text">
                      <strong>智能分割</strong>
                      <small>按内容自动分页</small>
                    </span>
                    {mode === "split" && (
                      <Check
                        size={14}
                        strokeWidth={2}
                        className="export-mode-check"
                      />
                    )}
                  </button>
                </div>
              </div>

              {mode === "split" && (
                <div className="export-field">
                  <label htmlFor="export-max-height">每张最大高度</label>
                  <ExportDropdown
                    id="export-max-height"
                    value={String(maxHeight)}
                    options={[
                      { value: "2000", label: "2000px" },
                      { value: "3000", label: "3000px" },
                      { value: "4000", label: "4000px" },
                    ]}
                    onChange={(next) => setMaxHeight(Number(next))}
                    ariaLabel="每张最大高度"
                    disabled={exporting}
                  />
                  <small>只在文字行和块之间切，图片、表格、代码整块保留</small>
                </div>
              )}
            </div>
          </div>

          <div className="export-options-footer">
            <div className="export-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={onClose}
                disabled={exporting}
              >
                取消
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => void handleExport()}
                disabled={
                  busy || waitingCatalog || !fontReady || !content || isEmpty
                }
              >
                {exporting || fontLoading ? (
                  <Loader2 size={16} className="export-spin" />
                ) : (
                  <ImageDown size={16} />
                )}
                {exporting
                  ? "正在导出..."
                  : singleOutput
                    ? "导出 PNG"
                    : "导出 ZIP"}
              </button>
            </div>
            {mode === "split" && pageCount > 1 && (
              <p className="export-note">
                多张图片会打包成 ZIP，下载后解压即可。
              </p>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
