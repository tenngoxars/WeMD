import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import toast from "react-hot-toast";
import type { HistoryMeta, HistorySnapshot } from "./historyTypes";

// history 存完整正文，meta 只存列表字段：文章多到几千篇时，启动只读 meta，正文打开时再读
interface HistoryDB extends DBSchema {
  history: {
    key: string;
    value: HistorySnapshot;
  };
  meta: {
    key: string;
    value: HistoryMeta;
  };
  draft: {
    key: string;
    value: unknown;
  };
}

const DB_NAME = "wemd-history";
const DB_VERSION = 3;

let dbPromise: Promise<IDBPDatabase<HistoryDB>> | null = null;

const BLOCKED_TOAST_ID = "history-db-blocked";

export function toMeta(entry: HistorySnapshot): HistoryMeta {
  return {
    id: entry.id,
    title: entry.title || "未命名文章",
    themeName: entry.themeName,
    createdAt: entry.createdAt || entry.savedAt,
    savedAt: entry.savedAt,
  };
}

async function getDB() {
  if (typeof window === "undefined") {
    throw new Error("IndexedDB is not available in SSR");
  }
  if (!dbPromise) {
    dbPromise = openDB<HistoryDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, _newVersion, tx) {
        if (oldVersion < 1) {
          db.createObjectStore("history");
        }
        if (oldVersion === 1) {
          if (db.objectStoreNames.contains("draft")) {
            db.deleteObjectStore("draft");
          }
          if (!db.objectStoreNames.contains("history")) {
            db.createObjectStore("history");
          }
        }
        if (oldVersion < 3) {
          // 旧版本最多 30 篇，一次性补齐 meta 即可
          const meta = db.createObjectStore("meta");
          void tx
            .objectStore("history")
            .getAll()
            .then((entries) =>
              Promise.all(entries.map((e) => meta.put(toMeta(e), e.id))),
            );
        }
      },
      // 其他标签页还开着旧版本连接，升级要等它们关闭，否则本页会一直停在加载中
      blocked() {
        toast.error("其他标签页还开着旧版 WeMD，关闭它们后才能加载文章", {
          id: BLOCKED_TOAST_ID,
          duration: Infinity,
        });
      },
      // 其他标签页要升级数据库：让出连接，本页已过时，需要刷新
      blocking(_currentVersion, _blockedVersion, event) {
        (event.target as IDBDatabase).close();
        toast.error("WeMD 已在其他标签页更新，请刷新本页", {
          id: "history-db-outdated",
          duration: Infinity,
        });
      },
    }).then((db) => {
      toast.dismiss(BLOCKED_TOAST_ID);
      return db;
    });
  }
  return dbPromise;
}

export async function loadHistoryMetaFromDb(): Promise<HistoryMeta[]> {
  try {
    const db = await getDB();
    return (await db.getAll("meta")).sort(
      (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime(),
    );
  } catch (error) {
    console.error("[HistoryDB] load failed", error);
    return [];
  }
}

export async function getHistoryFromDb(
  id: string,
): Promise<HistorySnapshot | null> {
  try {
    const db = await getDB();
    const entry = await db.get("history", id);
    return entry ? { ...entry, ...toMeta(entry) } : null;
  } catch (error) {
    console.error("[HistoryDB] get failed", error);
    return null;
  }
}

/** 正文与 meta 在同一事务里写，保证两边一致。失败时提示并抛出，调用方据此中止后续操作 */
export async function putHistoryToDb(entry: HistorySnapshot) {
  try {
    const db = await getDB();
    const tx = db.transaction(["history", "meta"], "readwrite");
    await Promise.all([
      tx.objectStore("history").put(entry, entry.id),
      tx.objectStore("meta").put(toMeta(entry), entry.id),
      tx.done,
    ]);
  } catch (error) {
    console.error("[HistoryDB] save failed", error);
    const reason =
      error instanceof DOMException && error.name === "QuotaExceededError"
        ? "浏览器存储空间不足"
        : "请刷新页面后重试";
    toast.error(`文章保存失败：${reason}。刷新前请先复制正文备份`, {
      id: "history-save-failed",
    });
    throw error;
  }
}

export async function deleteHistoryFromDb(id: string) {
  try {
    const db = await getDB();
    const tx = db.transaction(["history", "meta"], "readwrite");
    await Promise.all([
      tx.objectStore("history").delete(id),
      tx.objectStore("meta").delete(id),
      tx.done,
    ]);
  } catch (error) {
    console.error("[HistoryDB] delete failed", error);
  }
}

export async function clearHistoryDb() {
  try {
    const db = await getDB();
    const tx = db.transaction(["history", "meta"], "readwrite");
    await Promise.all([
      tx.objectStore("history").clear(),
      tx.objectStore("meta").clear(),
      tx.done,
    ]);
  } catch (error) {
    console.error("[HistoryDB] clear failed", error);
  }
}
