import type { StorageAdapter } from "../StorageAdapter";
import type {
  FileItem,
  StorageAdapterContext,
  StorageInitResult,
} from "../types";

export class FileSystemAdapter implements StorageAdapter {
  readonly type = "filesystem" as const;
  readonly name = "FileSystem Access";
  readonly supportsFolders = true;
  ready = false;
  private directoryHandle: FileSystemDirectoryHandle | null = null;
  private handleKey = "fs-handle";

  // 获取选择的目录名称
  get directoryName(): string | null {
    return this.directoryHandle?.name ?? null;
  }

  async init(context?: StorageAdapterContext): Promise<StorageInitResult> {
    if (!("showDirectoryPicker" in window)) {
      return { ready: false, message: "File System Access API not supported" };
    }

    if (context?.identifier) {
      this.handleKey = `fs-handle-${context.identifier}`;
    }

    if (context?.identifier && !this.directoryHandle) {
      this.directoryHandle = await this.restoreHandle().catch(() => null);
    }

    if (!this.directoryHandle) {
      this.directoryHandle = await window.showDirectoryPicker({
        mode: "readwrite",
      });
      await this.persistHandle(this.directoryHandle);
    }

    const permission = await this.directoryHandle.requestPermission({
      mode: "readwrite",
    });
    this.ready = permission === "granted";
    return { ready: this.ready, message: permission };
  }

  private async persistHandle(handle: FileSystemDirectoryHandle) {
    try {
      const db = await this.openHandleDb();
      const tx = db.transaction("handles", "readwrite");
      await tx.store.put(handle, this.handleKey);
      await tx.done;
    } catch {
      /* ignore */
    }
  }

  private async restoreHandle(): Promise<FileSystemDirectoryHandle | null> {
    const db = await this.openHandleDb();
    const tx = db.transaction("handles", "readonly");
    const handle = await tx.store.get(this.handleKey);
    await tx.done;
    return handle ?? null;
  }

  private async openHandleDb() {
    const { openDB } = await import("idb");
    return openDB("wemd-fs-handles", 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("handles")) {
          db.createObjectStore("handles");
        }
      },
    });
  }

  private ensureHandle() {
    if (!this.directoryHandle)
      throw new Error("Directory handle not initialized");
    return this.directoryHandle;
  }

  /**
   * 递归读取目录，返回树形结构
   */
  async listFiles(): Promise<FileItem[]> {
    const handle = this.ensureHandle();
    return this.scanDirectory(handle, "");
  }

  /**
   * 递归扫描目录
   */
  private async scanDirectory(
    dirHandle: FileSystemDirectoryHandle,
    basePath: string,
  ): Promise<FileItem[]> {
    const result: FileItem[] = [];
    const folders: FileItem[] = [];
    const files: FileItem[] = [];

    for await (const entry of dirHandle.values()) {
      if (entry.name.startsWith(".")) continue; // 忽略隐藏文件/文件夹

      const entryPath = basePath ? `${basePath}/${entry.name}` : entry.name;

      if (entry.kind === "directory") {
        const subHandle = await dirHandle.getDirectoryHandle(entry.name);
        const children = await this.scanDirectory(subHandle, entryPath);
        folders.push({
          path: entryPath,
          name: entry.name,
          meta: {
            isDirectory: true,
            children,
          },
        });
      } else if (entry.kind === "file" && entry.name.endsWith(".md")) {
        const fileHandle = entry as FileSystemFileHandle;
        const file = await fileHandle.getFile();

        // 读取文件开头 500 字节提取 themeName
        let themeName: string | undefined;
        try {
          const slice = file.slice(0, 500);
          const text = await slice.text();
          const match = text.match(/^---\n([\s\S]*?)\n---/);
          if (match) {
            const themeMatch = match[1].match(/themeName:\s*(.+)/);
            if (themeMatch) {
              themeName = themeMatch[1].trim().replace(/^['"]|['"]$/g, "");
            }
          }
        } catch {
          // ignore
        }

        files.push({
          path: entryPath,
          name: entry.name,
          size: file.size,
          updatedAt: file.lastModified
            ? new Date(file.lastModified).toISOString()
            : undefined,
          meta: { themeName, isDirectory: false },
        });
      }
    }

    // 文件按编辑时间降序排序
    files.sort((a, b) => {
      const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return timeB - timeA;
    });

    // 文件夹按名称排序
    folders.sort((a, b) => a.name.localeCompare(b.name));

    // 先文件夹后文件
    return [...folders, ...files];
  }

  async readFile(path: string): Promise<string> {
    const fileHandle = await this.resolveFileHandle(path);
    const file = await fileHandle.getFile();
    return file.text();
  }

  async writeFile(path: string, content: string): Promise<void> {
    const fileHandle = await this.resolveFileHandle(path, true);
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
  }

  async deleteFile(path: string): Promise<void> {
    const { parent, name } = await this.resolveParentAndName(path);
    await parent.removeEntry(name);
  }

  async renameFile(oldPath: string, newPath: string): Promise<void> {
    if (oldPath === newPath) return;
    const content = await this.readFile(oldPath);
    await this.writeFile(newPath, content);
    await this.deleteFile(oldPath);
  }

  async exists(path: string): Promise<boolean> {
    try {
      await this.resolveFileHandle(path);
      return true;
    } catch {
      return false;
    }
  }

  async teardown() {
    this.directoryHandle = null;
    this.ready = false;
  }

  // --- 目录操作方法 ---

  async createFolder(
    folderPath: string,
  ): Promise<{ success: boolean; path?: string; error?: string }> {
    try {
      const parts = folderPath.split("/").filter(Boolean);
      if (parts.length === 0) {
        return { success: false, error: "文件夹名称不能为空" };
      }
      let current = this.ensureHandle();

      for (let index = 0; index < parts.length; index += 1) {
        const part = parts[index];
        const isLast = index === parts.length - 1;

        if (isLast) {
          try {
            await current.getDirectoryHandle(part);
            return { success: false, error: "文件夹已存在" };
          } catch (e: unknown) {
            const errorName = (e as { name?: string }).name;
            if (errorName && errorName !== "NotFoundError") {
              return {
                success: false,
                error: e instanceof Error ? e.message : String(e),
              };
            }
          }
        }

        // 逐级获取或创建目录，不进行特殊字符替换，因为 part 是路径的一部分
        current = await current.getDirectoryHandle(part, { create: true });
      }
      return { success: true, path: folderPath };
    } catch (e: unknown) {
      return {
        success: false,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }

  async moveFile(
    filePath: string,
    targetFolder: string,
  ): Promise<{ success: boolean; newPath?: string; error?: string }> {
    try {
      const fileName = filePath.split("/").pop() || filePath;
      const newPath = targetFolder ? `${targetFolder}/${fileName}` : fileName;

      if (filePath === newPath) return { success: true, newPath };

      let parent: FileSystemDirectoryHandle;
      let name: string;
      try {
        ({ parent, name } = await this.resolveParentAndName(newPath));
      } catch (e: unknown) {
        return { success: false, error: "目标文件夹不存在" };
      }

      try {
        await parent.getFileHandle(name);
        return { success: false, error: "目标位置已存在同名文件" };
      } catch (e: unknown) {
        const errorName = (e as { name?: string }).name;
        if (errorName && errorName !== "NotFoundError") {
          return {
            success: false,
            error: e instanceof Error ? e.message : String(e),
          };
        }
      }

      const content = await this.readFile(filePath);
      await this.writeFile(newPath, content);
      await this.deleteFile(filePath);
      return { success: true, newPath };
    } catch (e: unknown) {
      return {
        success: false,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }

  async deleteFolder(
    folderPath: string,
    options?: { recursive?: boolean },
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { parent, name } = await this.resolveParentAndName(folderPath);
      const recursive = options?.recursive === true;

      if (!recursive) {
        // 检查是否为空
        const folderHandle = await parent.getDirectoryHandle(name);
        const entries = [];
        for await (const entry of folderHandle.values()) {
          entries.push(entry);
        }
        if (entries.length > 0) {
          return {
            success: false,
            error: "文件夹不为空，请先移出或删除其中的文件",
          };
        }
        await parent.removeEntry(name);
        return { success: true };
      }

      try {
        await parent.removeEntry(name, { recursive: true });
        return { success: true };
      } catch {
        const folderHandle = await parent.getDirectoryHandle(name);
        await this.deleteDirectoryRecursive(folderHandle);
        await parent.removeEntry(name);
      }
      return { success: true };
    } catch (e: unknown) {
      return {
        success: false,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }

  async renameFolder(
    oldPath: string,
    newPath: string,
  ): Promise<{ success: boolean; newPath?: string; error?: string }> {
    return this.moveFolderPath(
      this.normalizePath(oldPath),
      this.normalizePath(newPath),
    );
  }

  async moveFolder(
    folderPath: string,
    targetFolder: string,
  ): Promise<{ success: boolean; newPath?: string; error?: string }> {
    const normalizedPath = this.normalizePath(folderPath);
    const normalizedTarget = this.normalizePath(targetFolder);
    const folderName = normalizedPath.split("/").pop() || normalizedPath;
    const newPath = normalizedTarget
      ? `${normalizedTarget}/${folderName}`
      : folderName;
    return this.moveFolderPath(normalizedPath, newPath);
  }

  async inspectFolder(
    folderPath: string,
  ): Promise<{ success: boolean; entries?: string[]; error?: string }> {
    try {
      const handle = await this.resolveDirectoryHandle(
        this.normalizePath(folderPath),
      );
      const entries: string[] = [];
      for await (const entry of handle.values()) {
        if (entry.name.startsWith(".")) {
          entries.push(entry.name);
          continue;
        }
        if (entry.kind === "file" && !entry.name.endsWith(".md")) {
          entries.push(entry.name);
        }
      }
      return { success: true, entries };
    } catch (e: unknown) {
      return {
        success: false,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }

  // --- 辅助方法 ---

  /**
   * 解析路径获取文件 handle
   */
  private async resolveFileHandle(
    path: string,
    create = false,
  ): Promise<FileSystemFileHandle> {
    const parts = path.split("/");
    const fileName = parts.pop()!;
    let current = this.ensureHandle();

    for (const part of parts) {
      current = await current.getDirectoryHandle(part, { create });
    }

    return current.getFileHandle(fileName, { create });
  }

  /**
   * 解析路径获取父目录 handle 和名称
   */
  private async resolveParentAndName(
    path: string,
  ): Promise<{ parent: FileSystemDirectoryHandle; name: string }> {
    const parts = path.split("/");
    const name = parts.pop()!;
    let current = this.ensureHandle();

    for (const part of parts) {
      current = await current.getDirectoryHandle(part);
    }

    return { parent: current, name };
  }

  private async resolveDirectoryHandle(
    path: string,
  ): Promise<FileSystemDirectoryHandle> {
    if (!path) return this.ensureHandle();
    const parts = path.split("/").filter(Boolean);
    let current = this.ensureHandle();
    for (const part of parts) {
      current = await current.getDirectoryHandle(part);
    }
    return current;
  }

  private normalizePath(input: string): string {
    return input.replace(/\\/g, "/");
  }

  private async moveFolderPath(
    oldPath: string,
    newPath: string,
  ): Promise<{ success: boolean; newPath?: string; error?: string }> {
    try {
      const normalizedOld = this.normalizePath(oldPath);
      const normalizedNew = this.normalizePath(newPath);

      if (normalizedOld === normalizedNew)
        return { success: true, newPath: oldPath };
      if (normalizedNew.startsWith(`${normalizedOld}/`)) {
        return { success: false, error: "不能移动到子文件夹" };
      }

      const { parent: oldParent, name: oldName } =
        await this.resolveParentAndName(normalizedOld);
      let sourceHandle: FileSystemDirectoryHandle;
      try {
        sourceHandle = await oldParent.getDirectoryHandle(oldName);
      } catch (e: unknown) {
        return { success: false, error: "文件夹不存在" };
      }

      let newParent: FileSystemDirectoryHandle;
      let newName: string;
      try {
        ({ parent: newParent, name: newName } =
          await this.resolveParentAndName(normalizedNew));
      } catch (e: unknown) {
        return { success: false, error: "目标文件夹不存在" };
      }

      try {
        await newParent.getDirectoryHandle(newName);
        return { success: false, error: "目标位置已存在同名文件夹" };
      } catch (e: unknown) {
        const errorName = (e as { name?: string }).name;
        if (errorName && errorName !== "NotFoundError") {
          return {
            success: false,
            error: e instanceof Error ? e.message : String(e),
          };
        }
      }

      try {
        await newParent.getFileHandle(newName);
        return { success: false, error: "目标位置已存在同名文件" };
      } catch (e: unknown) {
        const errorName = (e as { name?: string }).name;
        if (errorName && errorName !== "NotFoundError") {
          return {
            success: false,
            error: e instanceof Error ? e.message : String(e),
          };
        }
      }

      const targetHandle = await newParent.getDirectoryHandle(newName, {
        create: true,
      });
      await this.copyDirectoryRecursive(sourceHandle, targetHandle);

      try {
        await oldParent.removeEntry(oldName, { recursive: true });
      } catch {
        await this.deleteDirectoryRecursive(sourceHandle);
        await oldParent.removeEntry(oldName);
      }

      return { success: true, newPath: normalizedNew };
    } catch (e: unknown) {
      return {
        success: false,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }

  private async copyDirectoryRecursive(
    source: FileSystemDirectoryHandle,
    target: FileSystemDirectoryHandle,
  ): Promise<void> {
    for await (const entry of source.values()) {
      if (entry.kind === "directory") {
        const nextTarget = await target.getDirectoryHandle(entry.name, {
          create: true,
        });
        await this.copyDirectoryRecursive(
          entry as FileSystemDirectoryHandle,
          nextTarget,
        );
      } else {
        const file = await (entry as FileSystemFileHandle).getFile();
        const fileHandle = await target.getFileHandle(entry.name, {
          create: true,
        });
        const writable = await fileHandle.createWritable();
        await writable.write(file);
        await writable.close();
      }
    }
  }

  private async deleteDirectoryRecursive(
    handle: FileSystemDirectoryHandle,
  ): Promise<void> {
    for await (const entry of handle.values()) {
      if (entry.kind === "directory") {
        await this.deleteDirectoryRecursive(entry as FileSystemDirectoryHandle);
        await handle.removeEntry(entry.name);
      } else {
        await handle.removeEntry(entry.name);
      }
    }
  }
}
