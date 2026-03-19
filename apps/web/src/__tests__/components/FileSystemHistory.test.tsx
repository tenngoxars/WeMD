import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FileSystemHistory } from "../../components/History/FileSystemHistory";
import { useEditorStore } from "../../store/editorStore";
import { useFileStore } from "../../store/fileStore";
import { useThemeStore } from "../../store/themeStore";
import type { StorageAdapter } from "../../storage/StorageAdapter";
import type { FileItem } from "../../storage/types";

vi.mock("../../components/Sidebar/SidebarFooter", () => ({
  SidebarFooter: () => <div data-testid="sidebar-footer" />,
}));

describe("FileSystemHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useEditorStore.setState({
      markdown: "",
      currentFilePath: undefined,
      workspaceDir: undefined,
      lastAutoSavedAt: null,
      isEditing: false,
    });
    useThemeStore.setState({
      themeId: "default",
      themeName: "默认主题",
      customCSS: "",
    });
    useFileStore.setState({
      workspacePath: null,
      files: [],
      currentFile: null,
      isLoading: false,
      isSaving: false,
      lastSavedContent: "",
      lastSavedAt: null,
      isDirty: false,
      isRestoring: false,
    });
  });

  it("侧边栏改标题后，历史面板保存不会回滚且保留未知 frontmatter 字段", async () => {
    const source = `---
theme: default
themeName: "默认主题"
author: "Alice"
title: "旧标题"
---

# 正文
`;
    const writeFile = vi.fn(
      async (_path: string, _content: string) => undefined,
    );
    const listFiles = vi.fn(
      async (): Promise<FileItem[]> => [
        {
          path: "test.md",
          name: "test.md",
          updatedAt: new Date().toISOString(),
          meta: { isDirectory: false, title: "旧标题" },
        },
      ],
    );
    const readFile = vi.fn(async () => source);

    const adapter: StorageAdapter = {
      type: "filesystem",
      name: "FileSystem Access",
      ready: true,
      supportsFolders: true,
      init: async () => ({ ready: true }),
      listFiles,
      readFile,
      writeFile,
      deleteFile: async () => undefined,
      renameFile: async () => undefined,
      exists: async () => true,
      teardown: async () => undefined,
    };

    const { container } = render(<FileSystemHistory adapter={adapter} />);

    await waitFor(() => {
      expect(screen.getByText("旧标题")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("旧标题"));

    await waitFor(() => {
      expect(useFileStore.getState().currentFile?.title).toBe("旧标题");
    });

    act(() => {
      const current = useFileStore.getState().currentFile;
      if (!current) throw new Error("currentFile not initialized");
      useFileStore.setState({
        currentFile: { ...current, title: "A/B 标题" },
      });
    });

    const saveButton = container.querySelector(
      'button[data-tooltip="保存当前"]',
    ) as HTMLButtonElement | null;
    if (!saveButton) {
      throw new Error("save button not found");
    }
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(writeFile).toHaveBeenCalled();
    });

    const latestCall = writeFile.mock.calls.at(-1);
    if (!latestCall) {
      throw new Error("writeFile was not called");
    }
    expect(latestCall[1]).toContain('title: "A/B 标题"');
    expect(latestCall[1]).toContain('author: "Alice"');
  });

  it("新建文章时继承当前选中主题", async () => {
    const contentMap = new Map<string, string>();
    const writeFile = vi.fn(async (path: string, content: string) => {
      contentMap.set(path, content);
    });
    const readFile = vi.fn(async (path: string) => contentMap.get(path) || "");
    const listFiles = vi.fn(async (): Promise<FileItem[]> => []);

    useThemeStore.setState({
      themeId: "custom-green",
      themeName: "森林绿",
      customCSS: "body { color: green; }",
      customThemes: [
        {
          id: "custom-green",
          name: "森林绿",
          css: "body { color: green; }",
          isBuiltIn: false,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          editorMode: "css",
        },
      ],
    });

    const adapter: StorageAdapter = {
      type: "filesystem",
      name: "FileSystem Access",
      ready: true,
      supportsFolders: true,
      init: async () => ({ ready: true }),
      listFiles,
      readFile,
      writeFile,
      deleteFile: async () => undefined,
      renameFile: async () => undefined,
      exists: async () => true,
      teardown: async () => undefined,
    };

    const { container } = render(<FileSystemHistory adapter={adapter} />);

    const createButton = container.querySelector(
      'button[data-tooltip="新建文章"]',
    ) as HTMLButtonElement | null;
    if (!createButton) {
      throw new Error("create button not found");
    }

    fireEvent.click(createButton);

    await waitFor(() => {
      expect(writeFile).toHaveBeenCalled();
    });

    const firstCall = writeFile.mock.calls.at(0);
    if (!firstCall) {
      throw new Error("writeFile was not called");
    }
    const writtenContent = firstCall[1] as string;
    expect(writtenContent).toContain("theme: custom-green");
    expect(writtenContent).toContain('themeName: "森林绿"');
  });

  it("CRLF frontmatter 文件保存时不会重复生成 frontmatter 块", async () => {
    const source =
      "\uFEFF---\r\ntitle: 标题\r\ncreateTime: 2026/01/12 01:22:23\r\npermalink: /test/\r\ntags:\r\n  - tag1\r\n  - tag2\r\ncopyright:\r\n  creation: original\r\n  author:\r\n    name: Blogger\r\n---\r\n\r\n测试内容\r\n";
    const writeFile = vi.fn(
      async (_path: string, _content: string) => undefined,
    );
    const listFiles = vi.fn(
      async (): Promise<FileItem[]> => [
        {
          path: "test.md",
          name: "test.md",
          updatedAt: new Date().toISOString(),
          meta: { isDirectory: false, title: "标题" },
        },
      ],
    );
    const readFile = vi.fn(async () => source);

    const adapter: StorageAdapter = {
      type: "filesystem",
      name: "FileSystem Access",
      ready: true,
      supportsFolders: true,
      init: async () => ({ ready: true }),
      listFiles,
      readFile,
      writeFile,
      deleteFile: async () => undefined,
      renameFile: async () => undefined,
      exists: async () => true,
      teardown: async () => undefined,
    };

    const { container } = render(<FileSystemHistory adapter={adapter} />);

    await waitFor(() => {
      expect(screen.getByText("标题")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("标题"));

    await waitFor(() => {
      expect(useFileStore.getState().currentFile?.title).toBe("标题");
    });

    const saveButton = container.querySelector(
      'button[data-tooltip="保存当前"]',
    ) as HTMLButtonElement | null;
    if (!saveButton) {
      throw new Error("save button not found");
    }
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(writeFile).toHaveBeenCalled();
    });

    const latestCall = writeFile.mock.calls.at(-1);
    if (!latestCall) {
      throw new Error("writeFile was not called");
    }

    const writtenContent = latestCall[1] as string;
    expect(writtenContent).toContain("createTime: 2026/01/12 01:22:23");
    expect(writtenContent).toContain("permalink: /test/");
    expect(writtenContent).toContain("tags:");
    expect(writtenContent).toContain("copyright:");
    expect(writtenContent).toContain("theme: default");
    expect(writtenContent).toContain('themeName: "默认主题"');
    expect(writtenContent.startsWith("\uFEFF---\r\n")).toBe(true);
    const delimiterCount = writtenContent
      .split("\r\n")
      .filter((line) => line.replace("\uFEFF", "") === "---");
    expect(delimiterCount.length).toBe(2);
  });
});
