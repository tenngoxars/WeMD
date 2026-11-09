export interface HistorySnapshot {
  id: string;
  markdown: string;
  title: string;
  theme: string;
  themeName: string;
  customCSS: string;
  filePath?: string;
  createdAt: string;
  savedAt: string;
}

/** 列表只用到的字段，正文按需从 IndexedDB 读取 */
export type HistoryMeta = Pick<
  HistorySnapshot,
  "id" | "title" | "themeName" | "createdAt" | "savedAt"
>;

export type HistorySnapshotInput = Omit<
  HistorySnapshot,
  "id" | "savedAt" | "createdAt"
>;
