import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as HistoryDbModule from "../../store/historyDb";
import type { HistorySnapshot } from "../../store/historyTypes";

const db = vi.hoisted(() => ({
  putHistoryToDb: vi.fn(),
  getHistoryFromDb: vi.fn(),
}));

vi.mock("../../store/historyDb", async (importOriginal) => ({
  ...(await importOriginal<typeof HistoryDbModule>()),
  ...db,
}));

import { useHistoryStore } from "../../store/historyStore";

const entry: HistorySnapshot = {
  id: "a",
  markdown: "# 原文",
  title: "原文",
  theme: "default",
  themeName: "默认主题",
  customCSS: "",
  createdAt: "2026-01-01T00:00:00.000Z",
  savedAt: "2026-01-01T00:00:00.000Z",
};

describe("historyStore 保存失败", () => {
  beforeEach(() => {
    db.putHistoryToDb.mockRejectedValue(new Error("QuotaExceededError"));
    useHistoryStore.setState({
      history: [entry],
      active: entry,
      activeId: entry.id,
    });
  });

  it("更新当前文章失败时抛出，内存状态保持不变", async () => {
    await expect(
      useHistoryStore
        .getState()
        .persistActiveSnapshot({ ...entry, markdown: "# 新内容" }),
    ).rejects.toThrow();

    expect(useHistoryStore.getState().active).toBe(entry);
    expect(useHistoryStore.getState().history).toEqual([entry]);
  });

  it("新建文章失败时抛出，不切换当前文章", async () => {
    await expect(
      useHistoryStore.getState().saveSnapshot({ ...entry, markdown: "# 新" }),
    ).rejects.toThrow();

    expect(useHistoryStore.getState().activeId).toBe("a");
    expect(useHistoryStore.getState().history).toHaveLength(1);
  });
});
