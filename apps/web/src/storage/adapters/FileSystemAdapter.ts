import type { StorageAdapter } from '../StorageAdapter';
import type { FileItem, StorageAdapterContext, StorageInitResult } from '../types';

export class FileSystemAdapter implements StorageAdapter {
  readonly type = 'filesystem' as const;
  readonly name = 'FileSystem Access';
  ready = false;
  private directoryHandle: FileSystemDirectoryHandle | null = null;
  private handleKey = 'fs-handle';

  async init(context?: StorageAdapterContext): Promise<StorageInitResult> {
    if (!('showDirectoryPicker' in window)) {
      return { ready: false, message: 'File System Access API not supported' };
    }

    if (context?.identifier) {
      this.handleKey = `fs-handle-${context.identifier}`;
    }

    if (context?.identifier && !this.directoryHandle) {
      this.directoryHandle = await this.restoreHandle().catch(() => null);
    }

    if (!this.directoryHandle) {
      this.directoryHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
      await this.persistHandle(this.directoryHandle);
    }

    const permission = await this.directoryHandle.requestPermission({ mode: 'readwrite' });
    this.ready = permission === 'granted';
    return { ready: this.ready, message: permission };
  }

  private async persistHandle(handle: FileSystemDirectoryHandle) {
    try {
      const db = await this.openHandleDb();
      const tx = db.transaction('handles', 'readwrite');
      await tx.store.put(handle, this.handleKey);
      await tx.done;
    } catch {
      /* ignore */
    }
  }

  private async restoreHandle(): Promise<FileSystemDirectoryHandle | null> {
    const db = await this.openHandleDb();
    const tx = db.transaction('handles', 'readonly');
    const handle = await tx.store.get(this.handleKey);
    await tx.done;
    return handle ?? null;
  }

  private async openHandleDb() {
    const { openDB } = await import('idb');
    return openDB('wemd-fs-handles', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('handles')) {
          db.createObjectStore('handles');
        }
      },
    });
  }

  private ensureHandle() {
    if (!this.directoryHandle) throw new Error('Directory handle not initialized');
    return this.directoryHandle;
  }

  /**
   * 只获取文件元数据，不读取内容，减少内存占用
   * themeName 将在打开文件时延迟加载
   */
  async listFiles(): Promise<FileItem[]> {
    const handle = this.ensureHandle();
    const result: FileItem[] = [];
    for await (const entry of handle.values()) {
      if (entry.kind === 'file' && entry.name.endsWith('.md')) {
        const fileHandle = entry as FileSystemFileHandle;
        const file = await fileHandle.getFile();
        // 不再读取 content，只获取元数据
        result.push({
          path: entry.name,
          name: entry.name,
          size: file.size,
          updatedAt: file.lastModified ? new Date(file.lastModified).toISOString() : undefined,
        });
      }
    }
    // 按编辑时间降序排序（最新的在前）
    result.sort((a, b) => {
      const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return timeB - timeA;
    });
    return result;
  }

  async readFile(path: string): Promise<string> {
    const fileHandle = await this.ensureHandle().getFileHandle(path);
    const file = await fileHandle.getFile();
    return file.text();
  }

  async writeFile(path: string, content: string): Promise<void> {
    const fileHandle = await this.ensureHandle().getFileHandle(path, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
  }

  async deleteFile(path: string): Promise<void> {
    await this.ensureHandle().removeEntry(path);
  }

  async renameFile(oldPath: string, newPath: string): Promise<void> {
    if (oldPath === newPath) return;
    const content = await this.readFile(oldPath);
    await this.writeFile(newPath, content);
    await this.deleteFile(oldPath);
  }

  async exists(path: string): Promise<boolean> {
    try {
      await this.ensureHandle().getFileHandle(path);
      return true;
    } catch {
      return false;
    }
  }

  async teardown() {
    this.directoryHandle = null;
    this.ready = false;
  }
}
