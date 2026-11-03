import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import { Header } from "../../components/Header/Header";
import { useWindowControls } from "../../hooks/useWindowControls";
import { useUITheme } from "../../hooks/useUITheme";
import { useEditorStore } from "../../store/editorStore";

// Mock hooks
vi.mock("../../hooks/useWindowControls");
vi.mock("../../hooks/useUITheme");
vi.mock("../../store/editorStore");

// Mock components that might cause issues in JSDOM or aren't focus of test
vi.mock("../../components/Theme/ThemePanel", () => ({
  ThemePanel: ({ open }: { open: boolean }) =>
    open ? <div data-testid="theme-panel">Theme Panel</div> : null,
}));
vi.mock("../../components/StorageModeSelector/StorageModeSelector", () => ({
  StorageModeSelector: () => (
    <div data-testid="storage-selector">Storage Selector</div>
  ),
}));
vi.mock("../../components/Settings/ImageHostSettings", () => ({
  ImageHostSettings: () => (
    <div data-testid="image-host-settings">Image Host Settings</div>
  ),
}));

describe("Header", () => {
  // Default mocks
  const mockCopyToWechat = vi.fn();
  const mockCopyAsHtml = vi.fn();
  const mockExportLongImage = vi.fn();
  const mockSetTheme = vi.fn();
  const mockMinimize = vi.fn();
  const mockMaximize = vi.fn();
  const mockClose = vi.fn();
  let storageMock: {
    getItem: ReturnType<typeof vi.fn>;
    setItem: ReturnType<typeof vi.fn>;
    removeItem: ReturnType<typeof vi.fn>;
    clear: ReturnType<typeof vi.fn>;
    key: ReturnType<typeof vi.fn>;
    length: number;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    const store = new Map<string, string>();
    storageMock = {
      getItem: vi.fn((key: string) => store.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        store.set(key, String(value));
      }),
      removeItem: vi.fn((key: string) => {
        store.delete(key);
      }),
      clear: vi.fn(() => {
        store.clear();
      }),
      key: vi.fn((index: number) => Array.from(store.keys())[index] ?? null),
      length: 0,
    };
    Object.defineProperty(storageMock, "length", {
      get: () => store.size,
      enumerable: true,
    });
    vi.stubGlobal("localStorage", storageMock);

    if (
      typeof window !== "undefined" &&
      window.localStorage &&
      typeof window.localStorage.removeItem === "function"
    ) {
      window.localStorage.removeItem("wemd-header-autohide");
    }

    // Setup default hook returns
    vi.mocked(useEditorStore).mockReturnValue({
      copyToWechat: mockCopyToWechat,
      copyAsHtml: mockCopyAsHtml,
      exportLongImage: mockExportLongImage,
    });

    vi.mocked(useUITheme).mockImplementation(
      (selector: (state: any) => any) => {
        const state = { theme: "light", setTheme: mockSetTheme };
        return selector(state);
      },
    );

    vi.mocked(useWindowControls).mockReturnValue({
      isDesktop: false,
      isWindows: false,
      isMac: true,
      platform: "web",
      minimize: mockMinimize,
      maximize: mockMaximize,
      close: mockClose,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders logo and core elements", () => {
    render(<Header />);

    expect(screen.getByRole("img", { name: "WeMD Logo" })).toHaveAttribute(
      "src",
      "/favicon-dark.svg",
    );
    expect(screen.getByText("WeMD")).toHaveClass("logo-text");
    expect(screen.getByText("复制到公众号")).toBeInTheDocument();
  });

  it("toggles theme interaction", () => {
    render(<Header />);

    const themeBtn = screen.getByLabelText("切换到暗色模式");
    fireEvent.click(themeBtn);
    expect(mockSetTheme).toHaveBeenCalledWith("dark");
  });

  it("calls copyToWechat action", () => {
    render(<Header />);

    fireEvent.click(screen.getByText("复制到公众号"));
    expect(mockCopyToWechat).toHaveBeenCalled();
  });

  it("triggers export actions from the export menu and closes it", () => {
    render(<Header />);
    const trigger = screen.getByRole("button", { name: "导出" });

    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("menuitem", { name: "复制 HTML" }));
    expect(mockCopyAsHtml).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("menuitem", { name: "导出长图" }));
    expect(mockExportLongImage).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("closes the export menu on Escape and outside click", () => {
    render(<Header />);
    const trigger = screen.getByRole("button", { name: "导出" });

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    fireEvent.click(trigger);
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(mockCopyAsHtml).not.toHaveBeenCalled();
  });

  it("opens article theme panel from the compact navigation", async () => {
    render(<Header />);

    fireEvent.click(screen.getByRole("button", { name: "文章主题" }));

    expect(await screen.findByTestId("theme-panel")).toBeInTheDocument();
  });

  it("does not render window controls on Web/Mac", () => {
    vi.mocked(useWindowControls).mockReturnValue({
      isDesktop: false,
      isWindows: false,
      isMac: true,
      platform: "web",
      minimize: mockMinimize,
      maximize: mockMaximize,
      close: mockClose,
    });

    render(<Header />);

    expect(screen.queryByLabelText("最小化")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("关闭")).not.toBeInTheDocument();
  });

  it("renders window controls on Windows desktop", () => {
    vi.mocked(useWindowControls).mockReturnValue({
      isDesktop: true,
      isWindows: true,
      isMac: false,
      platform: "win32",
      minimize: mockMinimize,
      maximize: mockMaximize,
      close: mockClose,
    });

    render(<Header />);

    expect(screen.getByLabelText("最小化")).toBeInTheDocument();
    expect(screen.getByLabelText("最大化")).toBeInTheDocument();
    expect(screen.getByLabelText("关闭")).toBeInTheDocument();

    // Test interactions
    fireEvent.click(screen.getByLabelText("关闭"));
    expect(mockClose).toHaveBeenCalled();
  });

  it("toggles header visibility (hide/show)", () => {
    render(<Header />);

    const hideBtn = screen.getByLabelText("隐藏标题栏");
    fireEvent.click(hideBtn);

    expect(screen.getByLabelText("显示标题栏")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("显示标题栏"));

    expect(screen.getByLabelText("隐藏标题栏")).toBeInTheDocument();
  });

  it("shows floating toolbar buttons when header is hidden", () => {
    render(<Header />);

    fireEvent.click(screen.getByLabelText("隐藏标题栏"));

    const floatingToolbar = document.querySelector(".floating-toolbar");
    expect(floatingToolbar).not.toBeNull();
    expect(screen.getByLabelText("显示标题栏")).toBeInTheDocument();
    expect(screen.getByLabelText("主题管理")).toBeInTheDocument();
    expect(screen.getByLabelText("图床设置")).toBeInTheDocument();
    expect(
      within(floatingToolbar as HTMLElement).getByRole("button", {
        name: "复制到公众号",
      }),
    ).toBeInTheDocument();
  });

  it("keeps a window drag region when the header is hidden in desktop", () => {
    vi.mocked(useWindowControls).mockReturnValue({
      isDesktop: true,
      isWindows: false,
      isMac: true,
      platform: "darwin",
      minimize: mockMinimize,
      maximize: mockMaximize,
      close: mockClose,
    });

    render(<Header />);

    const hiddenTitlebar = document.querySelector(".hidden-titlebar");
    expect(hiddenTitlebar).not.toBeNull();
    expect(hiddenTitlebar).not.toHaveClass("is-active");
    expect(
      hiddenTitlebar?.querySelector(".hidden-titlebar-drag-region"),
    ).not.toBeNull();

    fireEvent.click(screen.getByLabelText("隐藏标题栏"));

    expect(document.querySelector(".hidden-titlebar")).toHaveClass("is-active");
  });

  it("places Windows controls beside the hidden drag region", () => {
    vi.mocked(useWindowControls).mockReturnValue({
      isDesktop: true,
      isWindows: true,
      isMac: false,
      platform: "win32",
      minimize: mockMinimize,
      maximize: mockMaximize,
      close: mockClose,
    });

    render(<Header />);
    fireEvent.click(screen.getByLabelText("隐藏标题栏"));

    const hiddenTitlebar = document.querySelector(".hidden-titlebar");
    const controls = hiddenTitlebar?.querySelector(".window-controls-compact");
    expect(controls).not.toBeNull();

    fireEvent.click(within(controls as HTMLElement).getByLabelText("最小化"));
    fireEvent.click(within(controls as HTMLElement).getByLabelText("最大化"));
    fireEvent.click(within(controls as HTMLElement).getByLabelText("关闭"));

    expect(mockMinimize).toHaveBeenCalledOnce();
    expect(mockMaximize).toHaveBeenCalledOnce();
    expect(mockClose).toHaveBeenCalledOnce();
  });

  it("does not render the hidden titlebar outside desktop", () => {
    render(<Header />);

    fireEvent.click(screen.getByLabelText("隐藏标题栏"));

    expect(document.querySelector(".hidden-titlebar")).toBeNull();
  });

  it("persists header visibility to localStorage", async () => {
    render(<Header />);

    fireEvent.click(screen.getByLabelText("隐藏标题栏"));

    await waitFor(() => {
      expect(storageMock.setItem).toHaveBeenCalledWith(
        "wemd-header-autohide",
        "true",
      );
    });
  });
});
