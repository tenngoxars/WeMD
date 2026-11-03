import { useStorageContext } from "../storage/StorageContext";
import { platform } from "../lib/platformAdapter";
import { useFileStore } from "../store/fileStore";
import { useHistoryStore } from "../store/historyStore";

/** AI 结果与请求的归属键。文件模式包含工作区版本，避免同路径串文。 */
export function useActiveArticleKey(): string {
  const { type } = useStorageContext();
  const activeId = useHistoryStore((state) => state.activeId);
  const currentFile = useFileStore((state) => state.currentFile);
  const workspaceRevision = useFileStore((state) => state.workspaceRevision);
  const isFileMode = platform.isDesktop || type === "filesystem";

  if (isFileMode) {
    return `file:${workspaceRevision}:${currentFile?.path ?? "draft"}`;
  }

  return `history:${activeId ?? "draft"}`;
}
