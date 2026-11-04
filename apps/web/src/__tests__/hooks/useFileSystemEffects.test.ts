import { describe, it, expect, vi, afterEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { DesktopFsBridge } from "../../hooks/useFileSystemHelpers";
import { useFileSystemEffects } from "../../hooks/useFileSystemEffects";
import type { StorageAdapter } from "../../storage/StorageAdapter";

const buildDesktopMock = () => {
  let refreshCallback: (() => void) | undefined;
  let menuNewFileCallback: (() => void) | undefined;

  const onRefresh = vi.fn((callback: () => void) => {
    refreshCallback = callback;
    return "refresh-handler";
  });

  const onMenuNewFile = vi.fn((callback: () => void) => {
    menuNewFileCallback = callback;
    return "menu-new-file-handler";
  });

  const fs = {
    selectWorkspace: vi.fn(async () => ({ success: true as const })),
    setWorkspace: vi.fn(async () => ({ success: true as const })),
    listFiles: vi.fn(async () => ({ success: true as const, files: [] })),
    readFile: vi.fn(async () => ({ success: true as const, content: "" })),
    createFile: vi.fn(async () => ({ success: true as const })),
    saveFile: vi.fn(async () => ({ success: true as const })),
    renameFile: vi.fn(async () => ({ success: true as const })),
    deleteFile: vi.fn(async () => ({ success: true as const })),
    revealInFinder: vi.fn(async () => {}),
    createFolder: vi.fn(async () => ({ success: true as const })),
    moveFile: vi.fn(async () => ({ success: true as const })),
    inspectFolder: vi.fn(async () => ({ success: true as const, entries: [] })),
    deleteFolder: vi.fn(async () => ({ success: true as const })),
    renameFolder: vi.fn(async () => ({ success: true as const })),
    moveFolder: vi.fn(async () => ({ success: true as const })),
    onRefresh,
    removeRefreshListener: vi.fn(),
    onMenuNewFile,
    onMenuSave: vi.fn(() => "menu-save-handler"),
    onMenuSwitchWorkspace: vi.fn(() => "menu-switch-workspace-handler"),
    removeAllListeners: vi.fn(),
  };

  return {
    desktop: { fs },
    fs,
    getRefreshCallback: () => refreshCallback,
    getMenuNewFileCallback: () => menuNewFileCallback,
  };
};

const buildParams = (
  overrides: Partial<Parameters<typeof useFileSystemEffects>[0]> = {},
) => ({
  enabled: true,
  desktop: null,
  adapter: null,
  storageReady: false,
  storageType: "indexeddb" as const,
  currentFile: null,
  markdown: "",
  theme: "default",
  themeName: "默认主题",
  isRestoring: false,
  isDirty: false,
  isLoading: false,
  lastSavedContent: "",
  loadWorkspace: vi.fn(async () => {}),
  refreshFiles: vi.fn(async () => {}),
  openFile: vi.fn(async () => {}),
  createFile: vi.fn(async () => {}),
  saveFile: vi.fn(async () => {}),
  selectWorkspace: vi.fn(async () => {}),
  setCurrentFile: vi.fn(),
  setMarkdown: vi.fn(),
  setIsDirty: vi.fn(),
  setLastSavedContent: vi.fn(),
  setLoading: vi.fn(),
  setWorkspacePath: vi.fn(),
  ...overrides,
});

const buildAdapterMock = (): StorageAdapter =>
  ({
    type: "filesystem",
    name: "File System Access",
    ready: true,
    init: vi.fn(async () => ({ ready: true })),
    listFiles: vi.fn(async () => []),
    readFile: vi.fn(async () => ""),
    writeFile: vi.fn(async () => {}),
    deleteFile: vi.fn(async () => {}),
    renameFile: vi.fn(async () => {}),
    exists: vi.fn(async () => false),
    teardown: vi.fn(async () => {}),
  }) as StorageAdapter;

describe("useFileSystemEffects", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    if (
      typeof window !== "undefined" &&
      window.localStorage &&
      typeof window.localStorage.clear === "function"
    ) {
      window.localStorage.clear();
    }
  });

  it("单实例下正确注册并清理 桌面端监听器", async () => {
    const { desktop, fs, getRefreshCallback, getMenuNewFileCallback } =
      buildDesktopMock();

    const refreshFiles = vi.fn(async () => {});
    const createFile = vi.fn(async () => {});

    const params = buildParams({
      desktop: desktop as DesktopFsBridge,
      refreshFiles,
      createFile,
    });

    const mounted = renderHook(() => useFileSystemEffects(params));

    await waitFor(() => {
      expect(fs.onRefresh).toHaveBeenCalledTimes(1);
      expect(fs.onMenuNewFile).toHaveBeenCalledTimes(1);
      expect(fs.onMenuSave).toHaveBeenCalledTimes(1);
      expect(fs.onMenuSwitchWorkspace).toHaveBeenCalledTimes(1);
    });

    getRefreshCallback()?.();
    await waitFor(() => {
      expect(refreshFiles).toHaveBeenCalledTimes(1);
    });

    getMenuNewFileCallback()?.();
    await waitFor(() => {
      expect(createFile).toHaveBeenCalledTimes(1);
    });

    mounted.unmount();

    expect(fs.removeRefreshListener).toHaveBeenCalledTimes(1);
    expect(fs.removeRefreshListener).toHaveBeenCalledWith("refresh-handler");
    expect(fs.removeAllListeners).toHaveBeenCalledTimes(1);
  });

  it("浏览器文件夹模式下窗口聚焦会防抖刷新文件列表", async () => {
    vi.useFakeTimers();
    const refreshFiles = vi.fn(async () => {});
    renderHook(() =>
      useFileSystemEffects(
        buildParams({
          adapter: buildAdapterMock(),
          storageReady: true,
          storageType: "filesystem",
          refreshFiles,
        }),
      ),
    );
    refreshFiles.mockClear();

    window.dispatchEvent(new Event("focus"));
    window.dispatchEvent(new Event("focus"));

    expect(refreshFiles).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(refreshFiles).toHaveBeenCalledTimes(1);
  });

  it("工作区切换加载中不执行聚焦刷新", async () => {
    vi.useFakeTimers();
    const refreshFiles = vi.fn(async () => {});
    renderHook(() =>
      useFileSystemEffects(
        buildParams({
          adapter: buildAdapterMock(),
          storageReady: true,
          storageType: "filesystem",
          isLoading: true,
          refreshFiles,
        }),
      ),
    );
    refreshFiles.mockClear();

    window.dispatchEvent(new Event("focus"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(refreshFiles).not.toHaveBeenCalled();
  });

  it("浏览器文件夹模式下页面恢复可见会刷新文件列表", async () => {
    vi.useFakeTimers();
    const refreshFiles = vi.fn(async () => {});
    renderHook(() =>
      useFileSystemEffects(
        buildParams({
          adapter: buildAdapterMock(),
          storageReady: true,
          storageType: "filesystem",
          refreshFiles,
        }),
      ),
    );
    refreshFiles.mockClear();

    Object.defineProperty(document, "visibilityState", {
      value: "visible",
      configurable: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(refreshFiles).toHaveBeenCalledTimes(1);
  });

  it("IndexedDB 模式下不会注册窗口聚焦刷新", async () => {
    vi.useFakeTimers();
    const refreshFiles = vi.fn(async () => {});
    renderHook(() =>
      useFileSystemEffects(
        buildParams({
          storageReady: true,
          storageType: "indexeddb",
          refreshFiles,
        }),
      ),
    );

    window.dispatchEvent(new Event("focus"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(refreshFiles).not.toHaveBeenCalled();
  });

  it("桌面端模式下不会注册浏览器聚焦刷新", async () => {
    vi.useFakeTimers();
    const { desktop } = buildDesktopMock();
    const refreshFiles = vi.fn(async () => {});
    renderHook(() =>
      useFileSystemEffects(
        buildParams({
          desktop: desktop as DesktopFsBridge,
          adapter: buildAdapterMock(),
          storageReady: true,
          storageType: "filesystem",
          refreshFiles,
        }),
      ),
    );

    window.dispatchEvent(new Event("focus"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(refreshFiles).not.toHaveBeenCalled();
  });

  it("禁用副作用时不会注册浏览器聚焦刷新", async () => {
    vi.useFakeTimers();
    const refreshFiles = vi.fn(async () => {});
    renderHook(() =>
      useFileSystemEffects(
        buildParams({
          enabled: false,
          adapter: buildAdapterMock(),
          storageReady: true,
          storageType: "filesystem",
          refreshFiles,
        }),
      ),
    );

    window.dispatchEvent(new Event("focus"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(refreshFiles).not.toHaveBeenCalled();
  });

  it("卸载后会移除浏览器聚焦刷新监听并取消待执行刷新", async () => {
    vi.useFakeTimers();
    const refreshFiles = vi.fn(async () => {});
    const removeWindowListener = vi.spyOn(window, "removeEventListener");
    const removeDocumentListener = vi.spyOn(document, "removeEventListener");
    const mounted = renderHook(() =>
      useFileSystemEffects(
        buildParams({
          adapter: buildAdapterMock(),
          storageReady: true,
          storageType: "filesystem",
          refreshFiles,
        }),
      ),
    );
    refreshFiles.mockClear();

    window.dispatchEvent(new Event("focus"));
    mounted.unmount();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(refreshFiles).not.toHaveBeenCalled();
    expect(removeWindowListener).toHaveBeenCalledWith(
      "focus",
      expect.any(Function),
    );
    expect(removeDocumentListener).toHaveBeenCalledWith(
      "visibilitychange",
      expect.any(Function),
    );
  });
});
