import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Welcome } from "../../components/Welcome/Welcome";
import { useFileSystem } from "../../hooks/useFileSystem";
import { useUITheme } from "../../hooks/useUITheme";
import { useWindowControls } from "../../hooks/useWindowControls";

vi.mock("../../hooks/useFileSystem");
vi.mock("../../hooks/useUITheme");
vi.mock("../../hooks/useWindowControls");

describe("Welcome", () => {
  const selectWorkspace = vi.fn();
  const minimize = vi.fn();
  const maximize = vi.fn();
  const close = vi.fn();
  let theme = "default";

  beforeEach(() => {
    vi.clearAllMocks();
    theme = "default";
    vi.mocked(useFileSystem).mockReturnValue({
      selectWorkspace,
    } as unknown as ReturnType<typeof useFileSystem>);
    vi.mocked(useUITheme).mockImplementation((selector) =>
      selector({ theme } as ReturnType<typeof useUITheme.getState>),
    );
    vi.mocked(useWindowControls).mockReturnValue({
      isDesktop: false,
      isWindows: false,
      isMac: false,
      platform: undefined,
      minimize,
      maximize,
      close,
    });
  });

  it("根据界面主题使用清晰可见的 Logo", () => {
    const { rerender } = render(<Welcome />);
    expect(screen.getByRole("img", { name: "WeMD Logo" })).toHaveAttribute(
      "src",
      "/favicon-dark.svg",
    );

    theme = "dark";
    rerender(<Welcome />);
    expect(screen.getByRole("img", { name: "WeMD Logo" })).toHaveAttribute(
      "src",
      "/favicon-light.svg",
    );
  });

  it("点击主操作时选择工作区", () => {
    render(<Welcome />);

    fireEvent.click(screen.getByRole("button", { name: "选择工作区文件夹" }));

    expect(selectWorkspace).toHaveBeenCalledOnce();
  });

  it("Windows 桌面端欢迎页提供可用的窗口控制", () => {
    vi.mocked(useWindowControls).mockReturnValue({
      isDesktop: true,
      isWindows: true,
      isMac: false,
      platform: "win32",
      minimize,
      maximize,
      close,
    });

    render(<Welcome />);

    fireEvent.click(screen.getByRole("button", { name: "最小化" }));
    fireEvent.click(screen.getByRole("button", { name: "最大化" }));
    fireEvent.click(screen.getByRole("button", { name: "关闭" }));

    expect(minimize).toHaveBeenCalledOnce();
    expect(maximize).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
  });

  it("非 Windows 环境不渲染自绘窗口控制", () => {
    render(<Welcome />);

    expect(screen.queryByRole("button", { name: "关闭" })).toBeNull();
  });
});
