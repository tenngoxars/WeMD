import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { parseMarkdownFileContent } from "@wemd/core/markdown-file-meta";
import {
  basicTheme,
  codeGithubDarkTheme,
  modernEditorialTheme,
} from "@wemd/core/themes";
import { afterEach, describe, expect, it } from "vitest";
import { CliError, run, type ListResult, type ThemeResult } from "./index.js";
import type { RenderResult } from "./render.js";

const temporaryRoots: string[] = [];

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "wemd-cli-test-"));
  temporaryRoots.push(root);
  return root;
}

async function writeArticle(
  path: string,
  content = "# Article\n",
): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, "utf8");
}

async function writeWorkspaceThemes(
  root: string,
  themes: unknown[],
): Promise<string> {
  const path = join(root, ".wemd", "themes.json");
  await mkdir(dirname(path), { recursive: true });
  await writeFile(
    path,
    JSON.stringify({ version: 1, workspaceId: "test-workspace", themes }),
    "utf8",
  );
  return path;
}

const asList = (output: ListResult | ThemeResult): ListResult => {
  expect("themes" in output).toBe(true);
  return output as ListResult;
};

const asResolved = (output: ListResult | ThemeResult): ThemeResult => {
  expect("theme" in output).toBe(true);
  return output as ThemeResult;
};

const asRendered = (
  output: ListResult | ThemeResult | RenderResult,
): RenderResult => {
  expect("outputs" in output).toBe(true);
  return output as RenderResult;
};

afterEach(async () => {
  await Promise.all(
    temporaryRoots
      .splice(0)
      .map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("themes CLI", () => {
  it("lists all core themes without CSS bodies", async () => {
    const result = asList((await run(["themes", "list", "--json"])).output);

    expect(result.workspaceThemeFile).toBeNull();
    expect(result.warnings).toEqual([]);
    expect(result.themes).toHaveLength(17);
    expect(result.themes[0]).toMatchObject({
      reference: "builtin:default",
      id: "default",
      source: "builtin",
    });
    expect(JSON.stringify(result)).not.toContain('"css"');
  });

  it("resolves modern-editorial from core with the exact composed CSS hash", async () => {
    const root = await temporaryRoot();
    const article = join(root, "article.md");
    await writeArticle(article);

    const result = asResolved(
      (
        await run([
          "themes",
          "resolve",
          article,
          "--theme",
          "builtin:modern-editorial",
          "--json",
        ])
      ).output,
    );
    const expectedCss = `${basicTheme}\n${modernEditorialTheme}\n${codeGithubDarkTheme}`;

    expect(result.theme).toMatchObject({
      reference: "builtin:modern-editorial",
      id: "modern-editorial",
      name: "编辑部手记",
      source: "builtin",
      fingerprint: createHash("sha256").update(expectedCss).digest("hex"),
    });
    expect(JSON.stringify(result)).not.toContain('"css"');
  });

  it("discovers the nearest ancestor workspace and resolves frontmatter", async () => {
    const root = await temporaryRoot();
    const workspaceFile = await writeWorkspaceThemes(root, [
      { id: "custom-paper", name: "Paper", css: "#wemd { color: navy; }" },
    ]);
    const article = join(root, "notes", "nested", "article.md");
    await writeArticle(
      article,
      '---\ntheme: custom-paper\nthemeName: "Paper"\n---\n\n# Article\n',
    );

    const result = asResolved(
      (await run(["themes", "resolve", article, "--json"])).output,
    );

    expect(result.workspaceThemeFile).toBe(workspaceFile);
    expect(result.theme).toMatchObject({
      reference: "workspace:custom-paper",
      source: "workspace",
      sourcePath: workspaceFile,
    });
  });

  it("honors explicit overrides and source namespaces", async () => {
    const root = await temporaryRoot();
    await writeWorkspaceThemes(root, [
      { id: "default", name: "Workspace Default", css: "workspace-css" },
      { id: "custom-paper", name: "Paper", css: "paper-css" },
    ]);
    const article = join(root, "article.md");
    await writeArticle(article, "---\ntheme: custom-paper\n---\n\nBody\n");

    const explicitBuiltin = asResolved(
      (await run(["themes", "resolve", article, "--theme", "builtin:default"]))
        .output,
    );
    const unqualified = asResolved(
      (await run(["themes", "resolve", article, "--theme", "default"])).output,
    );
    const explicitWorkspace = asResolved(
      (
        await run([
          "themes",
          "resolve",
          article,
          "--theme",
          "workspace:default",
        ])
      ).output,
    );

    expect(explicitBuiltin.theme.reference).toBe("builtin:default");
    expect(unqualified.theme.reference).toBe("builtin:default");
    expect(explicitWorkspace.theme.reference).toBe("workspace:default");
  });

  it("loads a complete CSS file theme", async () => {
    const root = await temporaryRoot();
    const article = join(root, "article.md");
    const cssFile = join(root, "paper.css");
    const css = "#wemd { color: rebeccapurple; }";
    await writeArticle(article);
    await writeFile(cssFile, css, "utf8");

    const result = asResolved(
      (
        await run([
          "themes",
          "resolve",
          article,
          "--theme-file",
          cssFile,
          "--json",
        ])
      ).output,
    );

    expect(result.theme).toMatchObject({
      reference: "file:paper",
      id: "paper",
      name: "paper.css",
      source: "file",
      sourcePath: cssFile,
      fingerprint: createHash("sha256").update(css).digest("hex"),
    });
    expect(JSON.stringify(result)).not.toContain(css);
  });

  it("reports invalid and duplicate workspace entries as warnings", async () => {
    const root = await temporaryRoot();
    const workspaceFile = await writeWorkspaceThemes(root, [
      { id: "valid", name: "Valid", css: "valid-css" },
      null,
      { id: "valid", name: "Duplicate", css: "duplicate-css" },
    ]);
    const article = join(root, "article.md");
    await writeArticle(article);

    const result = asList(
      (await run(["themes", "list", "--article", article, "--json"])).output,
    );

    expect(result.workspaceThemeFile).toBe(workspaceFile);
    expect(result.themes.filter((theme) => theme.id === "valid")).toHaveLength(
      1,
    );
    expect(result.warnings).toEqual([
      "忽略无效主题条目（第 2 项）",
      "忽略重复主题 ID：valid",
    ]);
  });

  it("uses exit code 2 for argument and lookup errors", async () => {
    const root = await temporaryRoot();
    const article = join(root, "article.md");
    await writeArticle(article);

    await expect(
      run([
        "themes",
        "resolve",
        article,
        "--theme",
        "default",
        "--theme-file",
        "x.css",
      ]),
    ).rejects.toEqual(expect.objectContaining({ exitCode: 2 }));
    await expect(
      run(["themes", "resolve", article, "--theme", "missing"]),
    ).rejects.toEqual(expect.objectContaining({ exitCode: 2 }));
    await expect(run(["themes", "list", "unexpected.md"])).rejects.toEqual(
      expect.objectContaining({ exitCode: 2 }),
    );
  });

  it("uses exit code 3 for malformed workspace and missing CSS files", async () => {
    const root = await temporaryRoot();
    const article = join(root, "article.md");
    const workspaceFile = join(root, ".wemd", "themes.json");
    await writeArticle(article);
    await mkdir(dirname(workspaceFile), { recursive: true });
    await writeFile(workspaceFile, "not json", "utf8");

    await expect(run(["themes", "resolve", article])).rejects.toEqual(
      expect.objectContaining({ exitCode: 3 }),
    );

    await rm(workspaceFile);
    await expect(
      run([
        "themes",
        "resolve",
        article,
        "--theme-file",
        join(root, "missing.css"),
      ]),
    ).rejects.toEqual(expect.objectContaining({ exitCode: 3 }));
  });
});

describe("render CLI contract", () => {
  it("keeps the original Web defaultMarkdown as the real render fixture", async () => {
    const store = await readFile(
      resolve("..", "web", "src", "store", "editorStore.ts"),
      "utf8",
    );
    const fixture = await readFile(
      resolve("fixtures", "wemd-example.md"),
      "utf8",
    );
    const source = store.match(
      /export const defaultMarkdown = `([\s\S]*?)`;/,
    )?.[1];

    expect(source).toBeTruthy();
    const runtimeDefaultMarkdown = source!
      .replace(/\\`/g, "`")
      .replace(/\\\\/g, "\\");
    expect(parseMarkdownFileContent(fixture).body).toBe(runtimeDefaultMarkdown);
  });

  it("uses exit code 2 before renderer startup for invalid render arguments", async () => {
    await expect(run(["render"])).rejects.toEqual(
      expect.objectContaining({ exitCode: 2 }),
    );
    await expect(run(["render", "article.md", "extra.md"])).rejects.toEqual(
      expect.objectContaining({ exitCode: 2 }),
    );
  });

  it("writes artifacts beside the input by default and honors --out-dir", async () => {
    const root = await temporaryRoot();
    const articleDirectory = join(root, "article-source");
    const article = join(articleDirectory, "article.md");
    await mkdir(articleDirectory, { recursive: true });
    await writeArticle(article, "# 默认输出目录\n");

    const defaultOutput = asRendered((await run(["render", article])).output);
    expect(defaultOutput.outputs).toMatchObject({
      fragment: join(articleDirectory, "article.fragment.html"),
      preview: join(articleDirectory, "article.preview.html"),
      report: join(articleDirectory, "article.report.json"),
    });

    const overrideDirectory = join(root, "custom-output");
    const overridden = asRendered(
      (await run(["render", article, "--out-dir", overrideDirectory])).output,
    );
    expect(overridden.outputs).toMatchObject({
      fragment: join(overrideDirectory, "article.fragment.html"),
      preview: join(overrideDirectory, "article.preview.html"),
      report: join(overrideDirectory, "article.report.json"),
    });
  });

  it("renders the original fixture with default and modern-editorial safely", async () => {
    const root = await temporaryRoot();
    const fixture = resolve("fixtures", "wemd-example.md");

    for (const theme of ["builtin:default", "builtin:modern-editorial"]) {
      const output = asRendered(
        (
          await run([
            "render",
            fixture,
            "--theme",
            theme,
            "--out-dir",
            join(root, theme.replace(":", "-")),
          ])
        ).output,
      );
      const [fragment, preview, report] = await Promise.all([
        readFile(output.outputs.fragment, "utf8"),
        readFile(output.outputs.preview, "utf8"),
        readFile(output.outputs.report, "utf8"),
      ]);

      expect(fragment).toMatch(/<h1\b/);
      expect(fragment).toMatch(/<table\b/);
      expect(fragment).toMatch(/<pre\b/);
      expect(fragment).toMatch(/<img\b[^>]*https:/);
      expect(fragment).not.toMatch(
        /<script\b|\son[a-z]+\s*=|\bvar\(|<input\b|<pre[^>]*\bmermaid\b/i,
      );
      expect(preview).toMatch(/^<!doctype html>/i);
      expect(report).not.toMatch(/"css"\s*:/i);
      expect(JSON.parse(report)).toMatchObject({
        schemaVersion: 1,
        theme: { reference: theme },
        copy: { status: "not-requested" },
        open: { status: "not-requested" },
      });
    }
  }, 15_000);

  it("writes deterministic render artifacts on a repeated run", async () => {
    const root = await temporaryRoot();
    const args = [
      "render",
      resolve("fixtures", "wemd-example.md"),
      "--theme",
      "builtin:modern-editorial",
      "--out-dir",
      root,
    ];
    const first = asRendered((await run(args)).output);
    const before = await Promise.all([
      readFile(first.outputs.fragment, "utf8"),
      readFile(first.outputs.preview, "utf8"),
      readFile(first.outputs.report, "utf8"),
    ]);
    const second = asRendered((await run(args)).output);
    const after = await Promise.all([
      readFile(second.outputs.fragment, "utf8"),
      readFile(second.outputs.preview, "utf8"),
      readFile(second.outputs.report, "utf8"),
    ]);
    expect(after).toEqual(before);
  });

  it("rejects local images and strict HTTP-image warnings with exit code 4", async () => {
    const root = await temporaryRoot();
    const article = join(root, "unsafe.md");

    await writeArticle(
      article,
      '<img src="file:///tmp/not-for-publish.png" alt="local" />\n',
    );
    await expect(
      run(["render", article, "--out-dir", join(root, "local-output")]),
    ).rejects.toEqual(expect.objectContaining({ exitCode: 4 }));

    await writeArticle(article, "![HTTP](http://example.test/image.png)\n");
    await expect(
      run([
        "render",
        article,
        "--out-dir",
        join(root, "strict-output"),
        "--strict",
      ]),
    ).rejects.toEqual(expect.objectContaining({ exitCode: 4 }));
  });

  it("rejects dangerous navigation and srcset URL protocols", async () => {
    const root = await temporaryRoot();
    const article = join(root, "urls.md");
    await writeArticle(
      article,
      '<a href="data:text/html,unsafe">bad</a><img src="https://example.test/ok.png" srcset="file:///tmp/no.png 1x" />',
    );
    await expect(
      run(["render", article, "--out-dir", join(root, "out")]),
    ).rejects.toEqual(expect.objectContaining({ exitCode: 4 }));
  });

  it("rasterizes high-risk formulae, cleans metadata, and converts links to footnotes", async () => {
    const root = await temporaryRoot();
    const article = join(root, "math-and-links.md");
    await writeArticle(
      article,
      "外链 [Example](https://example.test) 和 [微信](https://mp.weixin.qq.com/s/example)\n\n公式：$a+b$\n\n- [ ] 任务\n\n```mermaid\ngraph TD; A-->B;\n```\n",
    );
    const output = asRendered(
      (
        await run([
          "render",
          article,
          "--link-footnotes",
          "--out-dir",
          join(root, "out"),
        ])
      ).output,
    );
    const fragment = await readFile(output.outputs.fragment, "utf8");
    expect(output.warnings).not.toEqual(
      expect.arrayContaining([
        expect.stringContaining("复杂 KaTeX 公式图片化失败"),
      ]),
    );
    expect(output.stats).toMatchObject({
      math: 1,
      complexMath: 1,
      mathImages: 1,
    });
    expect(output.compatibility.math.status).toBe("ready");
    expect(fragment).toContain("data:image/png;base64,");
    expect(fragment).toContain("⬜");
    expect(fragment).toContain("footnotes");
    expect(fragment).not.toMatch(
      /katex-mathml|application\/x-tex|data-latex|href="https:\/\/example\.test/,
    );
    expect(fragment).toContain('href="https://mp.weixin.qq.com/s/example"');
    await expect(
      run(["render", article, "--strict", "--out-dir", join(root, "strict")]),
    ).resolves.toMatchObject({ code: 0 });
  });

  it("returns exit code 6 without leaving an output when the out directory is a file", async () => {
    const root = await temporaryRoot();
    const article = join(root, "article.md");
    const occupied = join(root, "occupied");
    await writeArticle(article);
    await writeFile(occupied, "not-a-directory", "utf8");
    await expect(
      run(["render", article, "--out-dir", occupied]),
    ).rejects.toEqual(expect.objectContaining({ exitCode: 6 }));
    expect(
      (await readdir(root)).filter((entry) => entry.includes(".tmp")),
    ).toEqual([]);
  });

  it("materializes Chromium compatibility for vars, counters, background, table, and mac bar", async () => {
    const root = await temporaryRoot();
    const article = join(root, "compat.md");
    const css = join(root, "compat.css");
    await writeArticle(
      article,
      "## One\n\n```ts\nconst x = 1;\n```\n\n| A | B |\n| - | - |\n| 1 | 2 |\n",
    );
    await writeFile(
      css,
      "#wemd { --ink: #123456; background-image: linear-gradient(#fff,#eee); counter-reset: section 0; padding: 12px; } #wemd h2 { color: var(--ink); counter-increment: section; } #wemd h2::before { content: counter(section, decimal-leading-zero); }",
      "utf8",
    );
    const output = asRendered(
      (
        await run([
          "render",
          article,
          "--theme-file",
          css,
          "--table-wrap",
          "--code-mac-bar",
          "--out-dir",
          join(root, "out"),
        ])
      ).output,
    );
    const fragment = await readFile(output.outputs.fragment, "utf8");
    expect(fragment).not.toContain("var(");
    expect(fragment).toContain(">01<");
    // CSSOM serializes the explicitly materialized background longhands back
    // to an equivalent shorthand in the final HTML attribute.
    expect(fragment).toMatch(/background:/);
    expect(fragment).toMatch(/white-space: normal/);
    expect(fragment).toContain("mac-sign");
  }, 15_000);
});
