import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MigrationHintModal } from "../../components/UpdateModal/MigrationHintModal";
import type { DesktopBridge } from "../../types/desktop";

const setBridge = (hint: boolean) => {
  const openExternal = vi.fn(async (_url: string) => {});
  const bridge: Pick<DesktopBridge, "platform" | "migration" | "shell"> = {
    platform: "linux",
    migration: { takeHint: async () => hint },
    shell: { openExternal },
  };
  window.wemdDesktop = bridge as DesktopBridge;
  return openExternal;
};

describe("MigrationHintModal 跳版迁移提示", () => {
  afterEach(() => {
    window.wemdDesktop = undefined;
  });

  it("不需要提示时不显示", async () => {
    setBridge(false);
    render(<MigrationHintModal />);
    await act(async () => {});
    expect(screen.queryByText("迁移旧版设置")).toBeNull();
  });

  it("需要提示时显示，点下载打开 v1.6.1 发布页并关闭", async () => {
    const openExternal = setBridge(true);
    render(<MigrationHintModal />);
    fireEvent.click(await screen.findByText("下载 v1.6.1"));
    expect(openExternal).toHaveBeenCalledWith(
      "https://github.com/tenngoxars/WeMD/releases/tag/v1.6.1",
    );
    expect(screen.queryByText("迁移旧版设置")).toBeNull();
  });
});
