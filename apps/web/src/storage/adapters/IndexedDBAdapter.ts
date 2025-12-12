import type { StorageAdapter } from '../StorageAdapter';
import type { FileItem, StorageInitResult } from '../types';

const DB_NAME = 'wemd-files';
const DB_VERSION = 2; // 升级版本以触发迁移
const META_STORE = 'meta';
const CONTENT_STORE = 'content';

interface MetaRecord {
  path: string;
  updatedAt: string;
}

interface ContentRecord {
  path: string;
  content: string;
}

// 旧版本记录格式（用于迁移）
interface LegacyRecord {
  path: string;
  content: string;
  updatedAt: string;
}

export class IndexedDBAdapter implements StorageAdapter {
  readonly type = 'indexeddb' as const;
  readonly name = 'IndexedDB';
  ready = false;
  private db: IDBDatabase | null = null;

  async init(): Promise<StorageInitResult> {
    this.db = await this.openDb();
    this.ready = true;
    return { ready: true, message: 'IndexedDB ready' };
  }

  private openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const oldVersion = event.oldVersion;

        // 创建新的存储
        if (!db.objectStoreNames.contains(META_STORE)) {
          db.createObjectStore(META_STORE, { keyPath: 'path' });
        }
        if (!db.objectStoreNames.contains(CONTENT_STORE)) {
          db.createObjectStore(CONTENT_STORE, { keyPath: 'path' });
        }

        // 从旧版本迁移数据
        if (oldVersion === 1 && db.objectStoreNames.contains('files')) {
          const tx = (event.target as IDBOpenDBRequest).transaction!;
          const oldStore = tx.objectStore('files');
          const metaStore = tx.objectStore(META_STORE);
          const contentStore = tx.objectStore(CONTENT_STORE);

          oldStore.openCursor().onsuccess = (e) => {
            const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
            if (cursor) {
              const record = cursor.value as LegacyRecord;
              metaStore.put({ path: record.path, updatedAt: record.updatedAt });
              contentStore.put({ path: record.path, content: record.content });
              cursor.continue();
            }
          };
        }
      };
    });
  }

  private getStore(storeName: string, mode: IDBTransactionMode) {
    if (!this.db) throw new Error('IndexedDB not initialized');
    return this.db.transaction(storeName, mode).objectStore(storeName);
  }

  /**
   * 只读取元数据，不读取内容，减少内存占用
   */
  async listFiles(): Promise<FileItem[]> {
    const store = this.getStore(META_STORE, 'readonly');
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const files: FileItem[] = (request.result as MetaRecord[]).map((item) => ({
          path: item.path,
          name: item.path.split('/').pop() ?? item.path,
          updatedAt: item.updatedAt,
        }));
        // 按编辑时间降序排序
        files.sort((a, b) => {
          const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
          const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
          return timeB - timeA;
        });
        resolve(files);
      };
    });
  }

  async readFile(path: string): Promise<string> {
    const store = this.getStore(CONTENT_STORE, 'readonly');
    return new Promise((resolve, reject) => {
      const request = store.get(path);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const record = request.result as ContentRecord | undefined;
        if (!record) reject(new Error('File not found'));
        else resolve(record.content);
      };
    });
  }

  async writeFile(path: string, content: string): Promise<void> {
    if (!this.db) throw new Error('IndexedDB not initialized');

    const tx = this.db.transaction([META_STORE, CONTENT_STORE], 'readwrite');
    const metaStore = tx.objectStore(META_STORE);
    const contentStore = tx.objectStore(CONTENT_STORE);

    const now = new Date().toISOString();
    metaStore.put({ path, updatedAt: now });
    contentStore.put({ path, content });

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async deleteFile(path: string): Promise<void> {
    if (!this.db) throw new Error('IndexedDB not initialized');

    const tx = this.db.transaction([META_STORE, CONTENT_STORE], 'readwrite');
    tx.objectStore(META_STORE).delete(path);
    tx.objectStore(CONTENT_STORE).delete(path);

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async renameFile(oldPath: string, newPath: string): Promise<void> {
    const content = await this.readFile(oldPath);
    await this.writeFile(newPath, content);
    await this.deleteFile(oldPath);
  }

  async exists(path: string): Promise<boolean> {
    const store = this.getStore(META_STORE, 'readonly');
    return new Promise((resolve, reject) => {
      const request = store.getKey(path);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(!!request.result);
    });
  }

  async teardown() {
    this.db?.close();
    this.db = null;
    this.ready = false;
  }
}

