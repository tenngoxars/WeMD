import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useFileSystem } from "../../hooks/useFileSystem";

const mocks = vi.hoisted(() => {
  const activeFile = {
    name: "新文章.md",
    path: "/workspace/新文章.md",
    createdAt: new Date("2026-06-04T00:00:00.000Z"),
    updatedAt: new Date("2026-06-04T00:00:00.000Z"),
    size: 1,
    title: "新文章",
  };

  const fileStoreState = {
    workspacePath: "/workspace",
    files: [],
    currentFile: activeFile,
    isLoading: false,
    isSaving: false,
    lastSavedContent: "",
    isDirty: false,
    isRestoring: false,
    setWorkspacePath: vi.fn(),
    setFiles: vi.fn(),
    setCurrentFile: vi.fn(),
    setLoading: vi.fn(),
    setSaving: vi.fn(),
    setLastSavedContent: vi.fn(),
    setLastSavedAt: vi.fn(),
    setIsDirty: vi.fn(),
    setIsRestoring: vi.fn(),
  };

  const fileStoreGetState = vi.fn(() => ({
    currentFile: fileStoreState.currentFile,
    isDirty: false,
    lastSavedContent: fileStoreState.lastSavedContent,
    files: [],
    isRestoring: false,
  }));

  const editorStoreState = {
    setMarkdown: vi.fn(),
    markdown: "",
  };

  const editorStoreGetState = vi.fn(() => ({
    markdown: "",
  }));

  const themeStoreState = {
    themeId: "default",
    themeName: "默认主题",
  };
  const themeStoreGetState = vi.fn(() => ({
    themeId: "default",
    themeName: "默认主题",
    customCSS: "",
    selectTheme: vi.fn(),
    getAllThemes: () => [{ id: "default", name: "默认主题" }],
  }));

  const storageContext = {
    adapter: null as unknown,
    ready: false,
    type: "indexeddb" as "indexeddb" | "filesystem",
  };

  const toast = {
    success: vi.fn(),
    error: vi.fn(),
  };

  return {
    activeFile,
    fileStoreState,
    fileStoreGetState,
    editorStoreState,
    editorStoreGetState,
    themeStoreState,
    themeStoreGetState,
    storageContext,
    toast,
    useFileSystemEffectsMock: vi.fn(),
  };
});

vi.mock("../../hooks/useFileSystemEffects", () => ({
  useFileSystemEffects: mocks.useFileSystemEffectsMock,
}));

vi.mock("../../storage/StorageContext", () => ({
  useStorageContext: () => mocks.storageContext,
}));

vi.mock("../../store/fileStore", () => ({
  useFileStore: Object.assign(
    vi.fn(() => mocks.fileStoreState),
    {
      getState: mocks.fileStoreGetState,
    },
  ),
}));

vi.mock("../../store/editorStore", () => ({
  useEditorStore: Object.assign(
    vi.fn(() => mocks.editorStoreState),
    {
      getState: mocks.editorStoreGetState,
    },
  ),
}));

vi.mock("../../store/themeStore", () => ({
  useThemeStore: Object.assign(
    vi.fn(() => mocks.themeStoreState),
    {
      getState: mocks.themeStoreGetState,
    },
  ),
}));

vi.mock("react-hot-toast", () => ({
  default: mocks.toast,
}));

const markdownContent = [
  "---",
  "theme: default",
  'themeName: "默认主题"',
  'title: "新文章"',
  "---",
  "",
  "# 新文章",
  "",
].join("\n");

const setDesktopMock = (desktop: unknown) => {
  Object.defineProperty(window, "wemdDesktop", {
    value: desktop,
    configurable: true,
  });
};

describe("useFileSystem renameFile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, "localStorage", {
      value: {
        setItem: vi.fn(),
        getItem: vi.fn(),
        removeItem: vi.fn(),
      },
      configurable: true,
    });
    mocks.fileStoreState.currentFile = { ...mocks.activeFile };
    mocks.fileStoreState.lastSavedContent = markdownContent;
    mocks.storageContext.adapter = null;
    mocks.storageContext.ready = false;
    mocks.storageContext.type = "indexeddb";
    delete (window as unknown as { wemdDesktop?: unknown }).wemdDesktop;
  });

  it("桌面端模式下重命名会同步物理文件名并保留原始标题", async () => {
    const readFile = vi.fn(async () => ({
      success: true,
      content: markdownContent,
    }));
    const renameFile = vi.fn(async () => ({
      success: true,
      filePath: "/workspace/产品_需求.md",
    }));
    const saveFile = vi.fn(async () => ({ success: true }));
    const listFiles = vi.fn(async () => ({ success: true, files: [] }));

    setDesktopMock({
      fs: {
        readFile,
        renameFile,
        saveFile,
        listFiles,
      },
    });

    const { result } = renderHook(() => useFileSystem());

    await act(async () => {
      await result.current.updateFileTitle(mocks.activeFile, "产品/需求");
    });

    expect(renameFile).toHaveBeenCalledWith({
      oldPath: "/workspace/新文章.md",
      newName: "产品_需求.md",
    });
    expect(saveFile).toHaveBeenCalledWith({
      filePath: "/workspace/产品_需求.md",
      content: expect.stringContaining('title: "产品/需求"'),
    });
    expect(mocks.fileStoreState.setCurrentFile).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "产品_需求.md",
        path: "/workspace/产品_需求.md",
        title: "产品/需求",
      }),
    );
  });

  it("浏览器文件夹模式下重命名会先检查目标文件是否存在", async () => {
    const adapter = {
      listFiles: vi.fn(async () => []),
      readFile: vi.fn(async () => markdownContent),
      writeFile: vi.fn(async () => {}),
      renameFile: vi.fn(async () => {}),
      exists: vi.fn(async () => false),
    };
    mocks.storageContext.adapter = adapter;
    mocks.storageContext.ready = true;
    mocks.storageContext.type = "filesystem";
    const file = { ...mocks.activeFile, path: "docs/新文章.md" };
    mocks.fileStoreState.currentFile = file;

    const { result } = renderHook(() => useFileSystem());

    await act(async () => {
      await result.current.updateFileTitle(file, "我的文章");
    });

    expect(adapter.exists).toHaveBeenCalledWith("docs/我的文章.md");
    expect(adapter.renameFile).toHaveBeenCalledWith(
      "docs/新文章.md",
      "docs/我的文章.md",
    );
    expect(adapter.writeFile).toHaveBeenCalledWith(
      "docs/我的文章.md",
      expect.stringContaining('title: "我的文章"'),
    );
  });

  it("浏览器文件夹模式下不会覆盖已有目标文件", async () => {
    const adapter = {
      listFiles: vi.fn(async () => []),
      readFile: vi.fn(async () => markdownContent),
      writeFile: vi.fn(async () => {}),
      renameFile: vi.fn(async () => {}),
      exists: vi.fn(async () => true),
    };
    mocks.storageContext.adapter = adapter;
    mocks.storageContext.ready = true;
    mocks.storageContext.type = "filesystem";
    const file = { ...mocks.activeFile, path: "docs/新文章.md" };
    mocks.fileStoreState.currentFile = file;

    const { result } = renderHook(() => useFileSystem());

    await act(async () => {
      await result.current.updateFileTitle(file, "我的文章");
    });

    expect(adapter.renameFile).not.toHaveBeenCalled();
    expect(adapter.writeFile).not.toHaveBeenCalled();
    expect(mocks.toast.error).toHaveBeenCalledWith("文件名已存在");
  });
});
