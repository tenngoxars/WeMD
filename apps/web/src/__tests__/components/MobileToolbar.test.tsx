import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MobileToolbar } from "../../components/common/MobileToolbar";

describe("MobileToolbar", () => {
  it("opens more menu and triggers copyAsHtml", () => {
    const onViewChange = vi.fn();
    const onCopyToWechat = vi.fn();
    const onCopyAsHtml = vi.fn();
    const onOpenTheme = vi.fn();

    render(
      <MobileToolbar
        activeView="editor"
        onViewChange={onViewChange}
        onCopyToWechat={onCopyToWechat}
        onCopyAsHtml={onCopyAsHtml}
        onDownloadHtml={vi.fn()}
        onExportLongImage={vi.fn()}
        onOpenTheme={onOpenTheme}
      />,
    );

    fireEvent.click(screen.getAllByRole("button")[3]);
    fireEvent.click(screen.getByText("复制带样式 HTML"));

    expect(onCopyAsHtml).toHaveBeenCalledTimes(1);
  });

  it("triggers downloadHtml from more menu", () => {
    const onDownloadHtml = vi.fn();

    render(
      <MobileToolbar
        activeView="editor"
        onViewChange={vi.fn()}
        onCopyToWechat={vi.fn()}
        onCopyAsHtml={vi.fn()}
        onDownloadHtml={onDownloadHtml}
        onExportLongImage={vi.fn()}
        onOpenTheme={vi.fn()}
      />,
    );

    fireEvent.click(screen.getAllByRole("button")[3]);
    fireEvent.click(screen.getByText("下载 HTML 文件"));

    expect(onDownloadHtml).toHaveBeenCalledTimes(1);
  });

  it("triggers theme action from more menu", () => {
    const onViewChange = vi.fn();
    const onCopyToWechat = vi.fn();
    const onCopyAsHtml = vi.fn();
    const onOpenTheme = vi.fn();

    render(
      <MobileToolbar
        activeView="editor"
        onViewChange={onViewChange}
        onCopyToWechat={onCopyToWechat}
        onCopyAsHtml={onCopyAsHtml}
        onDownloadHtml={vi.fn()}
        onExportLongImage={vi.fn()}
        onOpenTheme={onOpenTheme}
      />,
    );

    fireEvent.click(screen.getAllByRole("button")[3]);
    fireEvent.click(screen.getByText("主题管理"));

    expect(onOpenTheme).toHaveBeenCalledTimes(1);
  });
});
