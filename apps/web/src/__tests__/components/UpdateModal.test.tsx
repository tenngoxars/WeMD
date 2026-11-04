import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { UpdateModal } from "../../components/UpdateModal/UpdateModal";
import type { DesktopBridge } from "../../types/desktop";

const setUpdate = (update: DesktopBridge["update"]) => {
  window.wemdDesktop = { platform: "linux", update } as DesktopBridge;
};

const renderModal = () =>
  render(
    <UpdateModal
      latestVersion="9.9.9"
      currentVersion="1.0.0"
      onClose={() => {}}
      onDownload={() => {}}
      onSkipVersion={() => {}}
    />,
  );

describe("UpdateModal 应用内更新", () => {
  afterEach(() => {
    window.wemdDesktop = undefined;
  });

  it("不支持应用内更新时只有「前往下载」", async () => {
    setUpdate({ install: vi.fn(), canInstall: async () => false });
    renderModal();
    await Promise.resolve();
    expect(screen.queryByText("立即更新")).toBeNull();
    expect(screen.getByText("前往下载")).toBeTruthy();
  });

  it("安装失败时显示原因并保留「前往下载」", async () => {
    const install = vi
      .fn()
      .mockRejectedValue(new Error("未找到可安装的更新包"));
    setUpdate({ install, canInstall: async () => true });
    renderModal();
    fireEvent.click(await screen.findByText("立即更新"));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "未找到可安装的更新包",
    );
    expect(screen.getByText("前往下载")).toBeTruthy();
    expect(screen.getByText("立即更新")).toBeTruthy();
  });
});
