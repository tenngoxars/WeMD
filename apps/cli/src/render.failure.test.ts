import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("playwright", () => ({
  chromium: {
    launch: vi
      .fn()
      .mockRejectedValue(new Error("Chromium unavailable for test")),
  },
}));

import { run } from "./index.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("render Chromium failure", () => {
  it("returns exit code 5 and creates no output when Chromium cannot start", async () => {
    const root = await mkdtemp(join(tmpdir(), "wemd-cli-render-failure-"));
    roots.push(root);
    const article = join(root, "article.md");
    await writeFile(article, "# Article\n", "utf8");

    await expect(
      run(["render", article, "--out-dir", join(root, "out")]),
    ).rejects.toEqual(expect.objectContaining({ exitCode: 5 }));
  });
});
