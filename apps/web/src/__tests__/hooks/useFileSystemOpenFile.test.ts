import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useFileSystem } from "../../hooks/useFileSystem";

const mocks = vi.hoisted(() => {
  const fileStoreState = {
    workspacePath: "/workspace",
    workspaceRevision: 1,
    files: [],
    currentFile: null,
    isLoading: false,
    isSaving: false,
    lastSavedContent: "",
    lastSavedAt: null,
    isDirty: false,
    isRestoring: false,
    setWorkspacePath: vi.fn(),
    bumpWorkspaceRevision: vi.fn(),
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
    isDirty: fileStoreState.isDirty,
    lastSavedContent: fileStoreState.lastSavedContent,
    files: fileStoreState.files,
    workspaceRevision: fileStoreState.workspaceRevision,
    isRestoring: false,
  }));

  const editorStoreState = {
    markdown: "",
    setMarkdown: vi.fn(),
  };

  const editorStoreGetState = vi.fn(() => ({
    markdown: editorStoreState.markdown,
  }));

  const themeStoreState = {
    themeId: "default",
    themeName: "默认主题",
  };
  const themeStoreGetState = vi.fn(() => ({
    ...themeStoreState,
    selectTheme: vi.fn(),
    getAllThemes: () => [{ id: "default", name: "默认主题" }],
    customCSS: "",
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

const setDesktopMock = (desktop: unknown) => {
  Object.defineProperty(window, "wemdDesktop", {
    value: desktop,
    configurable: true,
  });
};

const buildDesktop = (content: string) => ({
  platform: "darwin",
  fs: {
    selectWorkspace: vi.fn(),
    setWorkspace: vi.fn(),
    listFiles: vi.fn(),
    readFile: vi.fn(async () => ({ success: true, content })),
    createFile: vi.fn(),
    saveFile: vi.fn(),
    renameFile: vi.fn(),
    deleteFile: vi.fn(),
    revealInFinder: vi.fn(),
    createFolder: vi.fn(),
    moveFile: vi.fn(),
    inspectFolder: vi.fn(),
    deleteFolder: vi.fn(),
    renameFolder: vi.fn(),
    moveFolder: vi.fn(),
    onRefresh: vi.fn(),
    removeRefreshListener: vi.fn(),
    onMenuNewFile: vi.fn(),
    onMenuSave: vi.fn(),
    onMenuSwitchWorkspace: vi.fn(),
    removeAllListeners: vi.fn(),
  },
});

const markdown = (title: string) =>
  ["---", "theme: default", `title: "${title}"`, "---", "", "# 正文", ""].join(
    "\n",
  );

const openWith = async (name: string, path: string, content: string) => {
  setDesktopMock(buildDesktop(content));
  const { result } = renderHook(() => useFileSystem({ enableEffects: false }));
  await act(async () => {
    await result.current.openFile({
      name,
      path,
      createdAt: new Date("2026-11-11T03:00:00.000Z"),
      updatedAt: new Date("2026-11-11T03:00:00.000Z"),
      size: 120,
      title: "新文章",
    });
  });
  return mocks.fileStoreState.setCurrentFile;
};

describe("useFileSystem openFile 标题", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fileStoreState.currentFile = null;
    mocks.fileStoreState.lastSavedContent = "";
    mocks.fileStoreState.isDirty = false;
    mocks.editorStoreState.markdown = "";
    mocks.storageContext.adapter = null;
    mocks.storageContext.ready = false;
    mocks.storageContext.type = "indexeddb";
    Object.defineProperty(window, "localStorage", {
      value: {
        setItem: vi.fn(),
        getItem: vi.fn(),
        removeItem: vi.fn(),
      },
      configurable: true,
    });
    Reflect.deleteProperty(window, "wemdDesktop");
  });

  it("外部改名后打开文件以文件名作为标题", async () => {
    const setCurrentFile = await openWith(
      "清晰指南.md",
      "/workspace/清晰指南.md",
      markdown("新文章"),
    );

    expect(setCurrentFile).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/workspace/清晰指南.md",
        title: "清晰指南",
      }),
    );
  });

  it("含非法字符的标题仍保留原标题", async () => {
    const setCurrentFile = await openWith(
      "产品_需求.md",
      "/workspace/产品_需求.md",
      markdown("产品/需求"),
    );

    expect(setCurrentFile).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/workspace/产品_需求.md",
        title: "产品/需求",
      }),
    );
  });
});
