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
    const writeFile = vi.fn(async () => undefined);
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
});
