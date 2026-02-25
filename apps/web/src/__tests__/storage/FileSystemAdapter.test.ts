import { describe, expect, it, vi } from "vitest";
import { FileSystemAdapter } from "../../storage/adapters/FileSystemAdapter";

describe("FileSystemAdapter.renameFile", () => {
  it("禁止跨目录重命名，避免误创建文件夹", async () => {
    const adapter = new FileSystemAdapter();
    const readSpy = vi.spyOn(adapter, "readFile").mockResolvedValue("content");
    const writeSpy = vi.spyOn(adapter, "writeFile").mockResolvedValue();
    const deleteSpy = vi.spyOn(adapter, "deleteFile").mockResolvedValue();

    await expect(
      adapter.renameFile("docs/old.md", "docs/new/name.md"),
    ).rejects.toThrow("仅支持同目录重命名");

    expect(readSpy).not.toHaveBeenCalled();
    expect(writeSpy).not.toHaveBeenCalled();
    expect(deleteSpy).not.toHaveBeenCalled();
  });

  it("允许同目录重命名并保留原内容", async () => {
    const adapter = new FileSystemAdapter();
    const readSpy = vi.spyOn(adapter, "readFile").mockResolvedValue("content");
    const writeSpy = vi.spyOn(adapter, "writeFile").mockResolvedValue();
    const deleteSpy = vi.spyOn(adapter, "deleteFile").mockResolvedValue();

    await adapter.renameFile("docs/old.md", "docs/new.md");

    expect(readSpy).toHaveBeenCalledWith("docs/old.md");
    expect(writeSpy).toHaveBeenCalledWith("docs/new.md", "content");
    expect(deleteSpy).toHaveBeenCalledWith("docs/old.md");
  });
});
