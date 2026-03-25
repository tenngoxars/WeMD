import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import type { ElectronAPI } from "../../hooks/useFileSystemHelpers";
import { useFileSystemEffects } from "../../hooks/useFileSystemEffects";

const buildElectronMock = () => {
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
    electron: { fs },
    fs,
    getRefreshCallback: () => refreshCallback,
    getMenuNewFileCallback: () => menuNewFileCallback,
  };
};

describe("useFileSystemEffects", () => {
  afterEach(() => {
    vi.clearAllMocks();
    if (
      typeof window !== "undefined" &&
      window.localStorage &&
      typeof window.localStorage.clear === "function"
    ) {
      window.localStorage.clear();
    }
  });

  it("单实例下正确注册并清理 Electron 监听器", async () => {
    const { electron, fs, getRefreshCallback, getMenuNewFileCallback } =
      buildElectronMock();

    const refreshFiles = vi.fn(async () => {});
    const createFile = vi.fn(async () => {});

    const params = {
      enabled: true,
      electron: electron as ElectronAPI,
      adapter: null,
      storageReady: false,
      storageType: "indexeddb" as const,
      currentFile: null,
      markdown: "",
      theme: "default",
      themeName: "默认主题",
      isRestoring: false,
      isDirty: false,
      lastSavedContent: "",
      loadWorkspace: vi.fn(async () => {}),
      refreshFiles,
      openFile: vi.fn(async () => {}),
      createFile,
      saveFile: vi.fn(async () => {}),
      selectWorkspace: vi.fn(async () => {}),
      setCurrentFile: vi.fn(),
      setMarkdown: vi.fn(),
      setIsDirty: vi.fn(),
      setLastSavedContent: vi.fn(),
      setLoading: vi.fn(),
      setWorkspacePath: vi.fn(),
    };

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
});
