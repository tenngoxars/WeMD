import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { copyPageDocument, openCommand, openCopyPage } from "./copy-page.js";
import { run } from "./index.js";
import type { RenderResult } from "./render.js";

const roots: string[] = [];

const temporaryRoot = async (): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), "wemd-cli-copy-page-"));
  roots.push(root);
  return root;
};

const rendered = (value: unknown): RenderResult => {
  if (!value || typeof value !== "object" || !("outputs" in value)) {
    throw new Error("expected render result");
  }
  return value as RenderResult;
};

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("self-contained copy page", () => {
  it("writes the copy page beside the input when --out-dir is omitted", async () => {
    const root = await temporaryRoot();
    const article = join(root, "local-article.md");
    await writeFile(article, "# 本地文章\n\n正文。\n", "utf8");

    const output = rendered((await run(["copy", article])).output);
    expect(output.outputs).toMatchObject({
      fragment: join(root, "local-article.fragment.html"),
      preview: join(root, "local-article.preview.html"),
      report: join(root, "local-article.report.json"),
      copy: join(root, "local-article.copy.html"),
    });
  });

  it("creates a movable file:// page without writing the clipboard", async () => {
    const root = await temporaryRoot();
    const output = rendered(
      (
        await run([
          "copy",
          resolve("fixtures", "wemd-example.md"),
          "--theme",
          "builtin:modern-editorial",
          "--out-dir",
          root,
        ])
      ).output,
    );
    expect(output.outputs.copy).toBe(join(root, "wemd-example.copy.html"));
    expect(output.copy).toMatchObject({
      status: "ready",
      fallbackTransport: "clipboard-api",
    });
    expect(output.open).toEqual({ status: "not-requested" });

    const [page, fragment, report] = await Promise.all([
      readFile(output.outputs.copy!, "utf8"),
      readFile(output.outputs.fragment, "utf8"),
      readFile(output.outputs.report, "utf8"),
    ]);
    expect(page).toMatch(/^<!doctype html>/i);
    expect(page).toContain("<div data-wemd-copy-shell>");
    expect(page).toContain("<header data-wemd-copy-ui>");
    expect(page).toContain("<main data-wemd-preview>");
    expect(page).toContain('<div aria-hidden="true" data-wemd-copy-host>');
    expect(page).toMatch(
      /\[data-wemd-copy-shell\]\s*\{[^}]*background:\s*#eef1ee;/,
    );
    expect(page).not.toMatch(
      /body\[data-wemd-copy-page\]\s*\{[^}]*background:/,
    );
    expect(
      page.indexOf("</main>\n  </div>\n  <div aria-hidden"),
    ).toBeGreaterThan(-1);
    expect(page).toContain(fragment.trim());
    expect(page).not.toMatch(/fetch\s*\(|localhost|127\.0\.0\.1/i);
    expect(page).not.toMatch(/<main[^>]*>[\s\S]*data-wemd-copy-ui/);
    expect(page.indexOf('document.execCommand("copy")')).toBeLessThan(
      page.indexOf("navigator.clipboard.write"),
    );
    expect(page).toContain("copyHost.replaceChildren(article.cloneNode(true))");
    expect(page).toContain("copyHost.replaceChildren();");
    expect(JSON.parse(report)).toMatchObject({
      outputs: { copy: output.outputs.copy },
      copy: { status: "ready" },
      open: { status: "not-requested" },
      compatibility: {
        images: { status: expect.any(String) },
        mermaid: { status: expect.any(String) },
        math: { status: expect.any(String) },
        strict: { enabled: false, errors: [] },
      },
    });

    const blocked = copyPageDocument("blocked", "<div>safe</div>", {
      ...output,
      errors: ["严格模式阻断"],
      compatibility: {
        ...output.compatibility,
        strict: { enabled: true, errors: ["严格模式阻断"] },
      },
    });
    expect(blocked).toContain("data-wemd-copy-button disabled");
    expect(blocked).toContain("存在阻断性错误，当前不可复制");
  }, 20_000);

  it("records the exact copy-event transport for continuous backgrounds", async () => {
    const root = await temporaryRoot();
    const article = join(root, "continuous.md");
    const theme = join(root, "continuous.css");
    await writeFile(
      article,
      "# 连续背景\n\n正文包含引号、反斜杠 `\\\\` 和 `</script>`。\n",
      "utf8",
    );
    await writeFile(
      theme,
      "#wemd { color: #222; padding: 24px; background-image: linear-gradient(#fff, #eee); background-repeat: no-repeat; }",
      "utf8",
    );
    const output = rendered(
      (
        await run([
          "copy",
          article,
          "--theme-file",
          theme,
          "--out-dir",
          join(root, "out"),
        ])
      ).output,
    );
    const page = await readFile(output.outputs.copy!, "utf8");
    expect(output.copy).toMatchObject({
      requiresExactHtmlTransport: true,
      preferredTransport: "exact-html-event",
    });
    expect(page).toContain('data-wemd-exact-html="true"');
    expect(page).toContain('event.clipboardData.setData("text/html", html)');
    expect(page).toContain('event.clipboardData.setData("text/plain", text)');
    expect(page).toContain("event.preventDefault()");
    expect(page.match(/<\/script>/gi)).toHaveLength(1);
  }, 20_000);

  it("generates a disabled page without embedding unsafe content", async () => {
    const root = await temporaryRoot();
    const article = join(root, "blocked.md");
    await writeFile(
      article,
      '<img src="file:///tmp/private.png" onload="alert(1)" alt="local">\n',
      "utf8",
    );
    const execution = await run([
      "copy",
      article,
      "--out-dir",
      join(root, "out"),
    ]);
    const output = rendered(execution.output);
    const [page, fragment, report] = await Promise.all([
      readFile(output.outputs.copy!, "utf8"),
      readFile(output.outputs.fragment, "utf8"),
      readFile(output.outputs.report, "utf8"),
    ]);
    expect(execution.code).toBe(4);
    expect(output.copy.status).toBe("blocked");
    expect(output.errors).not.toHaveLength(0);
    expect(page).toContain("data-wemd-copy-button disabled");
    expect(page).not.toContain('<img src="file:///tmp/private.png"');
    expect(fragment).not.toContain("file:///tmp/private.png");
    expect(JSON.parse(report)).toMatchObject({
      copy: { status: "blocked" },
      errors: expect.arrayContaining([expect.any(String)]),
      compatibility: {
        images: {
          status: "blocked",
          errors: expect.arrayContaining([expect.any(String)]),
        },
      },
    });
  }, 20_000);

  it("keeps --open platform-specific and reports failures without deleting files", async () => {
    expect(openCommand("/tmp/a b.copy.html", "darwin")).toEqual({
      command: "open",
      args: ["/tmp/a b.copy.html"],
      display: 'open "/tmp/a b.copy.html"',
    });
    expect(openCommand("C:\\a b.copy.html", "win32")).toMatchObject({
      command: "explorer.exe",
      args: ["C:\\a b.copy.html"],
    });
    expect(openCommand("/tmp/a.copy.html", "linux")).toMatchObject({
      command: "xdg-open",
      args: ["/tmp/a.copy.html"],
    });

    const runner = vi.fn().mockRejectedValue(new Error("opener unavailable"));
    await expect(
      openCopyPage("/tmp/a.copy.html", "linux", runner),
    ).resolves.toEqual({
      status: "failed",
      error: "opener unavailable",
    });
    expect(runner).toHaveBeenCalledWith("xdg-open", ["/tmp/a.copy.html"]);
  });

  it("rejects --open outside copy and exposes a cross-platform doctor report", async () => {
    await expect(
      run(["render", resolve("fixtures", "wemd-example.md"), "--open"]),
    ).rejects.toEqual(expect.objectContaining({ exitCode: 2 }));
    const output = (await run(["doctor"])).output;
    expect(output).toMatchObject({
      platform: {
        name: process.platform,
        openSupported: expect.any(Boolean),
      },
      chromium: { accessible: expect.any(Boolean) },
    });
    expect(output).not.toHaveProperty("swift");
    expect(output).not.toHaveProperty("helper");
  });
});
