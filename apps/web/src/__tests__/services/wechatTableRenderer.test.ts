import { describe, expect, it } from "vitest";
import { renderTableBlocksForPreview } from "../../services/wechatTableRenderer";

describe("wechatTableRenderer", () => {
  it("自动换行模式让预览表格适配内容区", async () => {
    const container = document.createElement("div");
    container.innerHTML = `
      <div class="table-container">
        <table><tbody><tr><td>很长的单元格内容</td></tr></tbody></table>
      </div>
    `;

    await renderTableBlocksForPreview(container, true);

    const wrapper = container.querySelector(".table-container") as HTMLElement;
    const table = container.querySelector("table") as HTMLTableElement;
    const cell = container.querySelector("td") as HTMLTableCellElement;
    expect(wrapper.style.overflowX).toBe("visible");
    expect(wrapper).not.toHaveAttribute("data-ignore-width");
    expect(table.style.width).toBe("100%");
    expect(table.style.minWidth).toBe("0");
    expect(table.style.whiteSpace).toBe("normal");
    expect(table).not.toHaveAttribute("data-ignore-width");
    expect(cell.style.whiteSpace).toBe("normal");
    expect(cell.style.overflowWrap).toBe("anywhere");
    expect(cell.style.wordBreak).toBe("break-word");
  });

  it("自动换行时覆盖主题单元格最小宽度并在关闭后恢复", async () => {
    const container = document.createElement("div");
    container.innerHTML = `
      <div class="table-container">
        <table><tbody><tr><td style="min-width: 100px">内容</td></tr></tbody></table>
      </div>
    `;

    await renderTableBlocksForPreview(container, true);
    const cell = container.querySelector("td") as HTMLTableCellElement;
    expect(cell.style.minWidth).toBe("0");

    await renderTableBlocksForPreview(container, false);
    expect(cell.style.minWidth).toBe("100px");
  });

  it("关闭后恢复横向滚动并清理换行样式", async () => {
    const container = document.createElement("div");
    container.innerHTML = `
      <div class="table-container">
        <table><tbody><tr><td>很长的单元格内容</td></tr></tbody></table>
      </div>
    `;

    await renderTableBlocksForPreview(container, true);
    await renderTableBlocksForPreview(container, false);

    const wrapper = container.querySelector(".table-container") as HTMLElement;
    const table = container.querySelector("table") as HTMLTableElement;
    const cell = container.querySelector("td") as HTMLTableCellElement;
    expect(wrapper.style.overflowX).toBe("auto");
    expect(wrapper).toHaveAttribute("data-ignore-width");
    expect(table.style.width).toBe("auto");
    expect(table.style.minWidth).toBe("100%");
    expect(table.style.whiteSpace).toBe("nowrap");
    expect(table).toHaveAttribute("data-ignore-width");
    expect(cell.style.whiteSpace).toBe("nowrap");
    expect(cell.style.overflowWrap).toBe("");
    expect(cell.style.wordBreak).toBe("");
  });
});
