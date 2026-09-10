/**
 * 微信复制表格样式强化
 * 覆盖表格布局参数（行高、内边距），确保微信公众号中样式严格可控
 *
 * 设计原则：
 * - 字号跟随主题 CSS（已通过 juice 内联到元素 style 上），不再硬编码覆盖
 * - 色彩（边框、背景、斑马纹）跟主题走，保持视觉统一
 * - 默认保持 nowrap + 外层横向滚动；用户可切换为内容区内自动换行
 */

/** 表格专用布局参数（针对手机可读性优化） */
const TABLE_LAYOUT_STYLES = {
  lineHeight: "1.4",
  cellPadding: "6px 8px",
} as const;

const originalCellMinWidths = new WeakMap<HTMLElement, string>();

/**
 * 覆盖表格布局参数，保留主题色彩与主题字号。
 * 自动换行时暂时解除主题列宽约束，关闭后恢复原始内联值。
 */
const applyTableLayoutStyles = (
  table: HTMLTableElement,
  wrapEnabled: boolean,
): void => {
  table.style.borderCollapse = "collapse";
  table.style.tableLayout = "auto";
  table.style.width = wrapEnabled ? "100%" : "auto";
  table.style.minWidth = wrapEnabled ? "0" : "100%";
  table.style.whiteSpace = wrapEnabled ? "normal" : "nowrap";
  table.toggleAttribute("data-ignore-width", !wrapEnabled);

  const cells = table.querySelectorAll("th, td");
  for (const cell of cells) {
    const el = cell as HTMLElement;
    el.style.lineHeight = TABLE_LAYOUT_STYLES.lineHeight;
    el.style.padding = TABLE_LAYOUT_STYLES.cellPadding;
    el.style.whiteSpace = wrapEnabled ? "normal" : "nowrap";
    el.style.overflowWrap = wrapEnabled ? "anywhere" : "";
    el.style.wordBreak = wrapEnabled ? "break-word" : "";
    if (wrapEnabled) {
      if (!originalCellMinWidths.has(el)) {
        originalCellMinWidths.set(el, el.style.minWidth);
      }
      el.style.minWidth = "0";
    } else if (originalCellMinWidths.has(el)) {
      el.style.minWidth = originalCellMinWidths.get(el) ?? "";
      originalCellMinWidths.delete(el);
    }
    el.style.textAlign = "center";
  }
};

const applyContainerLayout = (
  tableContainer: HTMLElement,
  wrapEnabled: boolean,
): void => {
  tableContainer.style.overflowX = wrapEnabled ? "visible" : "auto";
  tableContainer.toggleAttribute("data-ignore-width", !wrapEnabled);
  if (wrapEnabled) {
    tableContainer.style.removeProperty("-webkit-overflow-scrolling");
  } else {
    tableContainer.style.setProperty("-webkit-overflow-scrolling", "touch");
  }
};

/**
 * 复制流程入口：强制覆盖所有表格的布局参数
 * 在 wechatCopyService 中于 renderMermaidBlocks 之后、normalizeCopyContainer 之前调用
 */
const renderTableLayout = async (
  container: HTMLElement,
  wrapEnabled: boolean = false,
): Promise<void> => {
  const tableContainers =
    container.querySelectorAll<HTMLElement>(".table-container");
  for (const tc of tableContainers) {
    applyContainerLayout(tc, wrapEnabled);
    const table = tc.querySelector("table");
    if (table) applyTableLayoutStyles(table, wrapEnabled);
  }
};

export const renderTableBlocks = renderTableLayout;

/** 预览与复制共用同一套表格布局，避免两条链路表现漂移。 */
export const renderTableBlocksForPreview = renderTableLayout;
