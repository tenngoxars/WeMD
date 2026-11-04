import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { SidebarFooter } from "../../components/Sidebar/SidebarFooter";
import type { DesktopBridge } from "../../types/desktop";

const setCheck = (check?: () => Promise<void>) => {
  window.wemdDesktop = {
    platform: "linux",
    update: { check },
  } as DesktopBridge;
};

describe("SidebarFooter 检查更新按钮", () => {
  beforeEach(() => {
    // 版本号由 Vite define 注入，测试环境没有
    vi.stubGlobal("__APP_VERSION__", "1.6.0");
  });

  afterEach(() => {
    window.wemdDesktop = undefined;
    vi.unstubAllGlobals();
  });

  it("网页版不显示", () => {
    render(<SidebarFooter />);
    expect(screen.queryByLabelText("检查更新")).toBeNull();
  });

  it("检查期间转动并禁用，结束后恢复；检查失败也会停下", async () => {
    let finish!: () => void;
    let fail!: (error: Error) => void;
    const pending = [
      new Promise<void>((resolve) => (finish = resolve)),
      new Promise<void>((_, reject) => (fail = reject)),
    ];
    let call = 0;
    setCheck(() => pending[call++]);
    render(<SidebarFooter />);

    for (const settle of [() => finish(), () => fail(new Error("网络错误"))]) {
      fireEvent.click(screen.getByLabelText("检查更新"));
      const busy = screen.getByLabelText("正在检查更新");
      expect(busy.className).toContain("is-checking");
      expect((busy as HTMLButtonElement).disabled).toBe(true);
      // 检查结束且最少转动时长过后，按钮恢复
      await act(async () => {
        settle();
        await new Promise((resolve) => setTimeout(resolve, 950));
      });
      const idle = screen.getByLabelText("检查更新");
      expect(idle.className).not.toContain("is-checking");
      expect((idle as HTMLButtonElement).disabled).toBe(false);
    }
    expect(call).toBe(2);
  });
});
