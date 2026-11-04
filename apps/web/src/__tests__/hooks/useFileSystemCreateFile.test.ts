import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useFileSystem } from "../../hooks/useFileSystem";

const mocks = vi.hoisted(() => {
  const fileStoreState = {
    workspacePath: "/workspace",
    workspaceRevision: 0,
    files: [],
    currentFile: null,
    isLoading: false,
    isSaving: false,
    lastSavedContent: "",
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

  const fileStoreSnapshot = {
    currentFile: null,
    isDirty: false,
    lastSavedContent: "",
    files: [],
    isRestoring: false,
  } as {
    currentFile: { name: string; path: string; title?: string } | null;
    isDirty: boolean;
    lastSavedContent: string;
    files: unknown[];
    isRestoring: boolean;
  };
  const fileStoreGetState = vi.fn(() => fileStoreSnapshot);

  const editorStoreState = {
    setMarkdown: vi.fn(),
    markdown: "",
  };

  const editorStoreSnapshot = {
    markdown: "",
  };
  const editorStoreGetState = vi.fn(() => editorStoreSnapshot);

  const selectTheme = vi.fn();
  const themeStoreState = {
    themeId: "default",
    themeName: "默认主题",
  };
  const themeStoreGetState = vi.fn(() => ({
    themeId: "default",
    themeName: "默认主题",
    customCSS: "",
    selectTheme,
    getAllThemes: () => [{ id: "default", name: "默认主题" }],
  }));

  const storageContext = {
    adapter: null as unknown,
    ready: false,
    type: "indexeddb" as "indexeddb" | "filesystem",
  };

  return {
    fileStoreState,
    fileStoreSnapshot,
    fileStoreGetState,
    editorStoreState,
    editorStoreSnapshot,
    editorStoreGetState,
    themeStoreState,
    themeStoreGetState,
    storageContext,
    selectTheme,
    useFileSystemEffectsMock: vi.fn(),
    localStorage: {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    },
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
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const setDesktopMock = (desktop: unknown) => {
  Object.defineProperty(window, "wemdDesktop", {
    value: desktop,
    configurable: true,
  });
};

const createDeferred = <Value>() => {
  let resolvePromise: (value: Value) => void = () => undefined;
  const promise = new Promise<Value>((resolve) => {
    resolvePromise = resolve;
  });
  return { promise, resolve: resolvePromise };
};

describe("useFileSystem 文件操作", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.storageContext.adapter = null;
    mocks.storageContext.ready = false;
    mocks.storageContext.type = "indexeddb";
    mocks.fileStoreState.workspaceRevision = 0;
    mocks.fileStoreSnapshot.currentFile = null;
    mocks.fileStoreSnapshot.isDirty = false;
    mocks.fileStoreSnapshot.lastSavedContent = "";
    mocks.fileStoreSnapshot.files = [];
    mocks.fileStoreSnapshot.isRestoring = false;
    mocks.editorStoreSnapshot.markdown = "";
    vi.stubGlobal("localStorage", mocks.localStorage);
    delete (window as unknown as { wemdDesktop?: unknown }).wemdDesktop;
  });

  afterEach(() => {
    delete (window as unknown as { wemdDesktop?: unknown }).wemdDesktop;
    vi.unstubAllGlobals();
  });

  it("桌面端模式下使用文章标题生成默认文件名", async () => {
    const createFile = vi.fn(
      async (_payload: { filename?: string; content?: string }) => ({
        success: true,
        filePath: "/workspace/新文章.md",
        filename: "新文章.md",
      }),
    );
    const listFiles = vi.fn(async () => ({ success: true, files: [] }));
    const readFile = vi.fn(async () => ({
      success: true,
      content:
        '---\ntheme: default\nthemeName: "默认主题"\ntitle: "新文章"\n---\n\n# 新文章\n\n',
    }));

    setDesktopMock({
      fs: {
        listFiles,
        readFile,
        createFile,
      },
    });

    const { result } = renderHook(() => useFileSystem());

    await act(async () => {
      await result.current.createFile();
    });

    expect(createFile).toHaveBeenCalledWith(
      expect.objectContaining({
        filename: "新文章.md",
      }),
    );
    const createPayload = createFile.mock.calls[0]?.[0];
    expect(createPayload?.content).toContain('title: "新文章"');
    expect(mocks.fileStoreState.setCurrentFile).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "新文章.md",
        title: "新文章",
      }),
    );
  });

  it("浏览器文件夹模式下避免覆盖已有新文章文件", async () => {
    const adapter = {
      listFiles: vi.fn(async () => []),
      readFile: vi.fn(async () =>
        [
          "---",
          "theme: default",
          'themeName: "默认主题"',
          'title: "新文章"',
          "---",
          "",
          "# 新文章",
          "",
        ].join("\n"),
      ),
      writeFile: vi.fn(async () => {}),
      exists: vi.fn(async (path: string) => path === "docs/新文章.md"),
    };
    mocks.storageContext.adapter = adapter;
    mocks.storageContext.ready = true;
    mocks.storageContext.type = "filesystem";

    const { result } = renderHook(() => useFileSystem());

    await act(async () => {
      await result.current.createFile("docs");
    });

    expect(adapter.exists).toHaveBeenCalledWith("docs/新文章.md");
    expect(adapter.exists).toHaveBeenCalledWith("docs/新文章 (1).md");
    expect(adapter.writeFile).toHaveBeenCalledWith(
      "docs/新文章 (1).md",
      expect.stringContaining('title: "新文章"'),
    );
    expect(mocks.fileStoreState.setCurrentFile).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "新文章 (1).md",
        path: "docs/新文章 (1).md",
        title: "新文章",
      }),
    );
  });

  it("浏览器文件夹模式下可从文件栏直接切换工作区", async () => {
    const adapter = {
      listFiles: vi.fn(async () => []),
      selectWorkspace: vi.fn(async () => ({
        success: true,
        workspaceName: "新的工作区",
      })),
    };
    mocks.storageContext.adapter = adapter;
    mocks.storageContext.ready = true;
    mocks.storageContext.type = "filesystem";

    const { result } = renderHook(() => useFileSystem());

    await act(async () => {
      await result.current.selectWorkspace();
    });

    expect(adapter.selectWorkspace).toHaveBeenCalledTimes(1);
    expect(mocks.fileStoreState.setWorkspacePath).toHaveBeenCalledWith(
      "新的工作区",
    );
    expect(mocks.fileStoreState.bumpWorkspaceRevision).toHaveBeenCalledTimes(1);
    expect(mocks.fileStoreState.setCurrentFile).toHaveBeenCalledWith(null);
    expect(mocks.editorStoreState.setMarkdown).toHaveBeenCalledWith("");
    expect(adapter.listFiles).toHaveBeenCalledTimes(1);
    expect(mocks.fileStoreState.setFiles).toHaveBeenCalledWith([]);
  });

  it("浏览器切换工作区前保存尚未自动保存的文章", async () => {
    const savedContent = [
      "---",
      "theme: default",
      'themeName: "默认主题"',
      'title: "草稿"',
      "---",
      "",
      "# 旧内容",
      "",
    ].join("\n");
    const writeFile = vi.fn(async () => {});
    const adapter = {
      listFiles: vi.fn(async () => []),
      writeFile,
      selectWorkspace: vi.fn(
        async (options?: { beforeCommit?: () => Promise<boolean> }) => {
          const canCommit = (await options?.beforeCommit?.()) ?? true;
          return canCommit
            ? { success: true, workspaceName: "新的工作区" }
            : { success: false, canceled: true };
        },
      ),
    };
    mocks.fileStoreSnapshot.currentFile = {
      name: "草稿.md",
      path: "草稿.md",
      title: "草稿",
    };
    mocks.fileStoreSnapshot.isDirty = true;
    mocks.fileStoreSnapshot.lastSavedContent = savedContent;
    mocks.editorStoreSnapshot.markdown = "# 尚未自动保存的内容\n";
    mocks.storageContext.adapter = adapter;
    mocks.storageContext.ready = true;
    mocks.storageContext.type = "filesystem";

    const { result } = renderHook(() => useFileSystem());

    await act(async () => {
      await result.current.selectWorkspace();
    });

    expect(writeFile).toHaveBeenCalledWith(
      "草稿.md",
      expect.stringContaining("# 尚未自动保存的内容"),
    );
    expect(mocks.fileStoreState.setWorkspacePath).toHaveBeenCalledWith(
      "新的工作区",
    );
  });

  it("浏览器保存旧文章失败时保留当前工作区", async () => {
    const savedContent = [
      "---",
      "theme: default",
      'themeName: "默认主题"',
      'title: "草稿"',
      "---",
      "",
      "# 旧内容",
      "",
    ].join("\n");
    const listFiles = vi.fn(async () => []);
    const adapter = {
      listFiles,
      writeFile: vi.fn(async () => {
        throw new Error("磁盘写入失败");
      }),
      selectWorkspace: vi.fn(
        async (options?: { beforeCommit?: () => Promise<boolean> }) => {
          const canCommit = (await options?.beforeCommit?.()) ?? true;
          return canCommit
            ? { success: true, workspaceName: "新的工作区" }
            : { success: false, canceled: true };
        },
      ),
    };
    mocks.fileStoreSnapshot.currentFile = {
      name: "草稿.md",
      path: "草稿.md",
      title: "草稿",
    };
    mocks.fileStoreSnapshot.isDirty = true;
    mocks.fileStoreSnapshot.lastSavedContent = savedContent;
    mocks.editorStoreSnapshot.markdown = "# 尚未自动保存的内容\n";
    mocks.storageContext.adapter = adapter;
    mocks.storageContext.ready = true;
    mocks.storageContext.type = "filesystem";

    const { result } = renderHook(() => useFileSystem());

    await act(async () => {
      await result.current.selectWorkspace();
    });

    expect(mocks.fileStoreState.setWorkspacePath).not.toHaveBeenCalled();
    expect(mocks.fileStoreState.setCurrentFile).not.toHaveBeenCalled();
    expect(listFiles).not.toHaveBeenCalled();
  });

  it("内容已撤销回保存版本时清除残留的未保存状态", async () => {
    const savedContent = [
      "---",
      "theme: default",
      'themeName: "默认主题"',
      'title: "草稿"',
      "---",
      "",
      "# 已保存内容",
      "",
    ].join("\n");
    const writeFile = vi.fn(async () => {});
    const adapter = {
      listFiles: vi.fn(async () => []),
      writeFile,
      selectWorkspace: vi.fn(
        async (options?: { beforeCommit?: () => Promise<boolean> }) => {
          const canCommit = (await options?.beforeCommit?.()) ?? true;
          return canCommit
            ? { success: true, workspaceName: "新的工作区" }
            : { success: false, canceled: true };
        },
      ),
    };
    mocks.fileStoreSnapshot.currentFile = {
      name: "草稿.md",
      path: "草稿.md",
      title: "草稿",
    };
    mocks.fileStoreSnapshot.isDirty = true;
    mocks.fileStoreSnapshot.lastSavedContent = savedContent;
    mocks.editorStoreSnapshot.markdown = "# 已保存内容\n";
    mocks.storageContext.adapter = adapter;
    mocks.storageContext.ready = true;
    mocks.storageContext.type = "filesystem";

    const { result } = renderHook(() => useFileSystem());

    await act(async () => {
      await result.current.selectWorkspace();
    });

    expect(writeFile).not.toHaveBeenCalled();
    expect(mocks.fileStoreState.setIsDirty).toHaveBeenCalledWith(false);
    expect(mocks.fileStoreState.bumpWorkspaceRevision).toHaveBeenCalledTimes(1);
  });

  it("浏览器新工作区扫描失败时先清空旧文件列表", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const adapter = {
      listFiles: vi.fn(async () => {
        throw new Error("目录扫描失败");
      }),
      selectWorkspace: vi.fn(
        async (options?: { beforeCommit?: () => Promise<boolean> }) => {
          await options?.beforeCommit?.();
          return { success: true, workspaceName: "新的工作区" };
        },
      ),
    };
    mocks.storageContext.adapter = adapter;
    mocks.storageContext.ready = true;
    mocks.storageContext.type = "filesystem";

    const { result } = renderHook(() => useFileSystem());

    await act(async () => {
      await result.current.selectWorkspace();
    });

    expect(mocks.fileStoreState.setFiles).toHaveBeenCalledWith([]);
    expect(mocks.fileStoreState.setCurrentFile).toHaveBeenCalledWith(null);
    expect(consoleError).toHaveBeenCalledWith(
      "加载文件列表失败:",
      expect.any(Error),
    );
    consoleError.mockRestore();
  });

  it("桌面端切换工作区前先保存尚未自动保存的文章", async () => {
    const savedContent = [
      "---",
      "theme: default",
      'themeName: "默认主题"',
      'title: "草稿"',
      "---",
      "",
      "# 旧内容",
      "",
    ].join("\n");
    const saveFile = vi.fn(async () => ({ success: true }));
    const selectWorkspace = vi.fn(async () => ({
      success: true,
      path: "/new-workspace",
    }));
    const setWorkspace = vi.fn(async () => ({
      success: true,
      path: "/new-workspace",
    }));
    const listFiles = vi.fn(async () => ({ success: true, files: [] }));
    mocks.fileStoreSnapshot.currentFile = {
      name: "草稿.md",
      path: "/workspace/草稿.md",
      title: "草稿",
    };
    mocks.fileStoreSnapshot.isDirty = true;
    mocks.fileStoreSnapshot.lastSavedContent = savedContent;
    mocks.editorStoreSnapshot.markdown = "# 尚未自动保存的内容\n";
    setDesktopMock({
      fs: {
        saveFile,
        selectWorkspace,
        setWorkspace,
        listFiles,
      },
    });

    const { result } = renderHook(() => useFileSystem());

    await act(async () => {
      await result.current.selectWorkspace();
    });

    expect(saveFile).toHaveBeenCalledWith({
      filePath: "/workspace/草稿.md",
      content: expect.stringContaining("# 尚未自动保存的内容"),
    });
    expect(saveFile.mock.invocationCallOrder[0]).toBeLessThan(
      selectWorkspace.mock.invocationCallOrder[0],
    );
    expect(setWorkspace).toHaveBeenCalledWith("/new-workspace");
    expect(mocks.fileStoreState.setWorkspacePath).toHaveBeenCalledWith(
      "/new-workspace",
    );
    expect(mocks.fileStoreState.bumpWorkspaceRevision).toHaveBeenCalledTimes(1);
  });

  it("桌面端切换工作区时保存期间继续输入的最新内容", async () => {
    const savedContent = [
      "---",
      "theme: default",
      'themeName: "默认主题"',
      'title: "草稿"',
      "---",
      "",
      "# 旧内容",
      "",
    ].join("\n");
    const firstSave = createDeferred<{ success: true }>();
    let saveCount = 0;
    const saveFile = vi.fn(
      async (_payload: { filePath: string; content: string }) => {
        saveCount += 1;
        return saveCount === 1 ? firstSave.promise : { success: true };
      },
    );
    const selectWorkspace = vi.fn(async () => ({
      success: true,
      path: "/new-workspace",
    }));
    const setWorkspace = vi.fn(async () => ({
      success: true,
      path: "/new-workspace",
    }));
    mocks.fileStoreSnapshot.currentFile = {
      name: "草稿.md",
      path: "/workspace/草稿.md",
      title: "草稿",
    };
    mocks.fileStoreSnapshot.isDirty = true;
    mocks.fileStoreSnapshot.lastSavedContent = savedContent;
    mocks.editorStoreSnapshot.markdown = "# 开始切换时的内容\n";
    setDesktopMock({
      fs: {
        saveFile,
        selectWorkspace,
        setWorkspace,
        listFiles: vi.fn(async () => ({ success: true, files: [] })),
      },
    });

    const { result } = renderHook(() => useFileSystem());
    const switching = result.current.selectWorkspace();

    await waitFor(() => expect(saveFile).toHaveBeenCalledTimes(1));
    mocks.editorStoreSnapshot.markdown = "# 保存期间继续输入的内容\n";

    await act(async () => {
      firstSave.resolve({ success: true });
      await switching;
    });

    expect(saveFile).toHaveBeenCalledTimes(2);
    expect(saveFile.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({
        filePath: "/workspace/草稿.md",
        content: expect.stringContaining("# 保存期间继续输入的内容"),
      }),
    );
    expect(saveFile.mock.invocationCallOrder[1]).toBeLessThan(
      selectWorkspace.mock.invocationCallOrder[0],
    );
  });

  it("工作区切换后忽略旧目录的晚到扫描结果", async () => {
    const oldScan =
      createDeferred<
        Array<{ name: string; path: string; updatedAt: string }>
      >();
    const adapter = {
      listFiles: vi
        .fn()
        .mockImplementationOnce(() => oldScan.promise)
        .mockResolvedValueOnce([]),
      selectWorkspace: vi.fn(
        async (options?: { beforeCommit?: () => Promise<boolean> }) => {
          const canCommit = (await options?.beforeCommit?.()) ?? true;
          return canCommit
            ? { success: true, workspaceName: "新的工作区" }
            : { success: false, canceled: true };
        },
      ),
    };
    mocks.storageContext.adapter = adapter;
    mocks.storageContext.ready = true;
    mocks.storageContext.type = "filesystem";

    const { result } = renderHook(() => useFileSystem());
    const staleRefresh = result.current.refreshFiles();
    await waitFor(() => expect(adapter.listFiles).toHaveBeenCalledTimes(1));

    await act(async () => {
      await result.current.selectWorkspace();
    });
    expect(adapter.listFiles).toHaveBeenCalledTimes(2);
    mocks.fileStoreState.setFiles.mockClear();

    await act(async () => {
      oldScan.resolve([
        {
          name: "旧文章.md",
          path: "旧文章.md",
          updatedAt: "2026-07-27T00:00:00.000Z",
        },
      ]);
      await staleRefresh;
    });

    expect(mocks.fileStoreState.setFiles).not.toHaveBeenCalled();
  });
});
