import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { dirname, join, parse, resolve as resolvePath } from "node:path";
import { parseArgs } from "node:util";
import { parseMarkdownFileContent } from "@wemd/core/markdown-file-meta";
import { builtInThemeCatalog } from "@wemd/core/themes";
import { createCopyPage, openCommand } from "./copy-page.js";
import { doctor, type DoctorResult } from "./doctor.js";
import { renderArticle, type RenderResult } from "./render.js";

export type ThemeSource = "builtin" | "workspace" | "file";
export interface ThemeSummary {
  reference: string;
  id: string;
  name: string;
  source: ThemeSource;
  selectable: boolean;
  sourcePath?: string;
}

export interface PublicResolvedTheme extends ThemeSummary {
  fingerprint: string;
}

export interface ResolvedTheme extends PublicResolvedTheme {
  css: string;
}

export interface WorkspaceTheme {
  id: string;
  name: string;
  css: string;
  isSelectable?: boolean;
}

export interface ThemeResult {
  theme: PublicResolvedTheme;
  workspaceThemeFile: string | null;
  warnings: string[];
}

export interface ListResult {
  themes: ThemeSummary[];
  workspaceThemeFile: string | null;
  warnings: string[];
}

export class CliError extends Error {
  constructor(
    message: string,
    readonly exitCode: 2 | 3 | 4 | 5 | 6 | 7,
  ) {
    super(message);
    this.name = "CliError";
  }
}

const fingerprint = (css: string): string =>
  createHash("sha256").update(css).digest("hex");

const resolvedTheme = (
  id: string,
  name: string,
  css: string,
  source: ThemeSource,
  selectable: boolean,
  sourcePath?: string,
): ResolvedTheme => ({
  reference: `${source}:${id}`,
  id,
  name,
  source,
  selectable,
  ...(sourcePath ? { sourcePath } : {}),
  fingerprint: fingerprint(css),
  css,
});

const publicSummary = ({
  css: _css,
  fingerprint: _fingerprint,
  ...theme
}: ResolvedTheme): ThemeSummary => theme;

const publicResolvedTheme = ({
  css: _css,
  ...theme
}: ResolvedTheme): PublicResolvedTheme => theme;

const isMissingPathError = (error: unknown): boolean =>
  error instanceof Error &&
  "code" in error &&
  (error.code === "ENOENT" || error.code === "ENOTDIR");

async function nearestWorkspaceFile(
  article?: string,
): Promise<string | undefined> {
  if (!article) return undefined;
  let dir = dirname(resolvePath(article));
  while (true) {
    const candidate = join(dir, ".wemd", "themes.json");
    try {
      const candidateStat = await stat(candidate);
      if (candidateStat.isFile()) return candidate;
    } catch (error) {
      if (!isMissingPathError(error)) {
        throw new CliError(
          `无法检查工作区主题文件 ${candidate}: ${error instanceof Error ? error.message : String(error)}`,
          3,
        );
      }
    }
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

async function loadWorkspace(
  file?: string,
): Promise<{ themes: WorkspaceTheme[]; warnings: string[] }> {
  if (!file) return { themes: [], warnings: [] };
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    throw new CliError(
      `无法读取工作区主题文件 ${file}: ${error instanceof Error ? error.message : String(error)}`,
      3,
    );
  }
  if (
    !parsed ||
    typeof parsed !== "object" ||
    !Array.isArray((parsed as { themes?: unknown }).themes)
  ) {
    throw new CliError(
      "主题文件格式不正确：顶层必须是对象且 themes 必须是数组",
      3,
    );
  }

  const warnings: string[] = [];
  const themes: WorkspaceTheme[] = [];
  const seen = new Set<string>();
  for (const [index, item] of (
    parsed as { themes: unknown[] }
  ).themes.entries()) {
    if (
      !item ||
      typeof item !== "object" ||
      typeof (item as WorkspaceTheme).id !== "string" ||
      !(item as WorkspaceTheme).id.trim() ||
      typeof (item as WorkspaceTheme).name !== "string" ||
      !(item as WorkspaceTheme).name.trim() ||
      typeof (item as WorkspaceTheme).css !== "string"
    ) {
      warnings.push(`忽略无效主题条目（第 ${index + 1} 项）`);
      continue;
    }

    const theme = item as WorkspaceTheme;
    if (seen.has(theme.id)) {
      warnings.push(`忽略重复主题 ID：${theme.id}`);
      continue;
    }
    seen.add(theme.id);
    themes.push(theme);
  }
  return { themes, warnings };
}

function resolveTheme(
  reference: string,
  workspace: WorkspaceTheme[],
  workspaceFile?: string,
): ResolvedTheme {
  const colon = reference.indexOf(":");
  const source = colon > 0 ? reference.slice(0, colon) : undefined;
  const id = source ? reference.slice(colon + 1) : reference;
  if (!id || (source && source !== "builtin" && source !== "workspace")) {
    throw new CliError(`主题不存在：${reference}`, 2);
  }
  const builtin = builtInThemeCatalog.find((theme) => theme.id === id);
  const custom = workspace.find((theme) => theme.id === id);
  const item =
    source === "builtin"
      ? builtin
      : source === "workspace"
        ? custom
        : (builtin ?? custom);
  if (!item) throw new CliError(`主题不存在：${reference}`, 2);
  return source === "workspace" || (!source && !builtin)
    ? resolvedTheme(
        item.id,
        item.name,
        item.css,
        "workspace",
        item.isSelectable !== false,
        workspaceFile,
      )
    : resolvedTheme(
        item.id,
        item.name,
        item.css,
        "builtin",
        item.isSelectable !== false,
      );
}

function options(argv: string[]) {
  return parseArgs({
    args: argv,
    options: {
      article: { type: "string" },
      theme: { type: "string" },
      "theme-file": { type: "string" },
      "out-dir": { type: "string" },
      "link-footnotes": { type: "boolean" },
      "table-wrap": { type: "boolean" },
      "code-mac-bar": { type: "boolean" },
      strict: { type: "boolean" },
      open: { type: "boolean" },
      json: { type: "boolean", short: "j" },
    },
    allowPositionals: true,
    strict: true,
  });
}

export async function resolveThemeForArticle(
  article: string,
  themeReference?: string,
  themeFile?: string,
): Promise<{
  theme: ResolvedTheme;
  workspaceThemeFile: string | null;
  warnings: string[];
}> {
  const workspaceFile = await nearestWorkspaceFile(article);
  const workspace = await loadWorkspace(workspaceFile);
  let meta;
  try {
    meta = parseMarkdownFileContent(
      await readFile(resolvePath(article), "utf8"),
    );
  } catch (error) {
    throw new CliError(
      `无法读取文章：${error instanceof Error ? error.message : String(error)}`,
      3,
    );
  }

  let theme: ResolvedTheme;
  if (themeFile) {
    const path = resolvePath(themeFile);
    try {
      const css = await readFile(path, "utf8");
      const id = parse(path).name;
      theme = resolvedTheme(id, parse(path).base, css, "file", true, path);
    } catch (error) {
      throw new CliError(
        `无法读取主题 CSS 文件 ${path}: ${error instanceof Error ? error.message : String(error)}`,
        3,
      );
    }
  } else {
    theme = resolveTheme(
      themeReference ?? meta.theme,
      workspace.themes,
      workspaceFile,
    );
  }

  return {
    theme,
    workspaceThemeFile: workspaceFile ?? null,
    warnings: workspace.warnings,
  };
}

type RunOutput = ListResult | ThemeResult | RenderResult | DoctorResult;

const hasRenderOptions = (
  values: ReturnType<typeof options>["values"],
): boolean =>
  Boolean(
    values.article ||
      values.theme ||
      values["theme-file"] ||
      values["out-dir"] ||
      values["link-footnotes"] ||
      values["table-wrap"] ||
      values["code-mac-bar"] ||
      values.strict ||
      values.open,
  );

const renderOptions = (
  article: string,
  values: ReturnType<typeof options>["values"],
) => ({
  article,
  theme: values.theme,
  themeFile: values["theme-file"],
  outDir: values["out-dir"],
  linkFootnotes: values["link-footnotes"] === true,
  tableWrap: values["table-wrap"] === true,
  codeMacBar: values["code-mac-bar"] === true,
  strict: values.strict === true,
});

export async function run(
  argv: string[],
): Promise<{ code: 0 | 4; output: RunOutput }> {
  let parsed: ReturnType<typeof options>;
  try {
    parsed = options(argv);
  } catch (error) {
    throw new CliError(
      error instanceof Error ? error.message : String(error),
      2,
    );
  }

  const [group, command, positional, extra] = parsed.positionals;
  if (group === "doctor") {
    if (command || positional || extra || hasRenderOptions(parsed.values)) {
      throw new CliError("用法：wemd doctor [--json]", 2);
    }
    return { code: 0, output: await doctor() };
  }
  if (group === "render" || group === "copy") {
    if (!command || positional || extra) {
      throw new CliError(`用法：wemd ${group} <article.md>`, 2);
    }
    if (parsed.values.theme && parsed.values["theme-file"]) {
      throw new CliError("--theme 与 --theme-file 不能同时使用", 2);
    }
    if (group === "render" && parsed.values.open) {
      throw new CliError("--open 仅支持 copy 命令", 2);
    }
    const output =
      group === "copy"
        ? await createCopyPage(
            renderOptions(command, parsed.values),
            parsed.values.open === true,
          )
        : await renderArticle(renderOptions(command, parsed.values));
    return {
      code: output.copy.status === "blocked" ? 4 : 0,
      output,
    };
  }
  if (
    group !== "themes" ||
    (command !== "list" && command !== "resolve") ||
    extra
  ) {
    throw new CliError("用法：wemd themes list|resolve", 2);
  }
  if (
    parsed.values["out-dir"] ||
    parsed.values["link-footnotes"] ||
    parsed.values["table-wrap"] ||
    parsed.values["code-mac-bar"] ||
    parsed.values.strict ||
    parsed.values.open
  ) {
    throw new CliError("themes 命令不支持 render 选项", 2);
  }
  if (parsed.values.theme && parsed.values["theme-file"]) {
    throw new CliError("--theme 与 --theme-file 不能同时使用", 2);
  }
  if (
    command === "list" &&
    (parsed.values.theme || parsed.values["theme-file"])
  ) {
    throw new CliError("list 不支持主题覆盖参数", 2);
  }

  const article = command === "list" ? parsed.values.article : positional;
  if (command === "list" && positional) {
    throw new CliError("list 的文章路径必须通过 --article 指定", 2);
  }
  if (command === "resolve" && (parsed.values.article || !article)) {
    throw new CliError("用法：wemd themes resolve <article.md>", 2);
  }

  const workspaceFile = await nearestWorkspaceFile(article);
  const workspace = await loadWorkspace(workspaceFile);
  if (command === "list") {
    const themes = builtInThemeCatalog.map((theme) =>
      publicSummary(
        resolvedTheme(
          theme.id,
          theme.name,
          theme.css,
          "builtin",
          theme.isSelectable,
        ),
      ),
    );
    themes.push(
      ...workspace.themes.map((theme) =>
        publicSummary(
          resolvedTheme(
            theme.id,
            theme.name,
            theme.css,
            "workspace",
            theme.isSelectable !== false,
            workspaceFile,
          ),
        ),
      ),
    );
    return {
      code: 0,
      output: {
        themes,
        workspaceThemeFile: workspaceFile ?? null,
        warnings: workspace.warnings,
      },
    };
  }

  if (!article) {
    throw new CliError("用法：wemd themes resolve <article.md>", 2);
  }

  let meta;
  try {
    meta = parseMarkdownFileContent(
      await readFile(resolvePath(article), "utf8"),
    );
  } catch (error) {
    throw new CliError(
      `无法读取文章：${error instanceof Error ? error.message : String(error)}`,
      3,
    );
  }

  let theme: ResolvedTheme;
  if (parsed.values["theme-file"]) {
    const path = resolvePath(parsed.values["theme-file"]);
    try {
      const css = await readFile(path, "utf8");
      const id = parse(path).name;
      theme = resolvedTheme(id, parse(path).base, css, "file", true, path);
    } catch (error) {
      throw new CliError(
        `无法读取主题 CSS 文件 ${path}: ${error instanceof Error ? error.message : String(error)}`,
        3,
      );
    }
  } else {
    theme = resolveTheme(
      parsed.values.theme ?? meta.theme,
      workspace.themes,
      workspaceFile,
    );
  }

  return {
    code: 0,
    output: {
      theme: publicResolvedTheme(theme),
      workspaceThemeFile: workspaceFile ?? null,
      warnings: workspace.warnings,
    },
  };
}

export async function main(argv: string[]): Promise<void> {
  try {
    const result = await run(argv);
    if (argv.includes("--json") || argv.includes("-j")) {
      console.log(JSON.stringify(result.output));
    } else if ("themes" in result.output) {
      console.log(
        result.output.themes
          .map((theme) => `${theme.reference}\t${theme.name}`)
          .join("\n"),
      );
    } else if ("outputs" in result.output) {
      if (result.output.outputs.copy) {
        const command = openCommand(result.output.outputs.copy);
        console.log(`可复制页面：\n${result.output.outputs.copy}`);
        if (result.output.open.status === "not-requested" && command) {
          console.log(`\n运行以下命令打开：\n${command.display}`);
        } else if (result.output.open.status === "opened") {
          console.log("\n已在系统默认浏览器中打开。");
        } else if (result.output.open.status === "failed") {
          console.error(`warning: 自动打开失败：${result.output.open.error}`);
        }
      } else {
        console.log(
          `${result.output.outputs.fragment}\n${result.output.outputs.preview}\n${result.output.outputs.report}`,
        );
      }
    } else if ("ok" in result.output) {
      console.log(
        result.output.ok
          ? "WeMD doctor: ready"
          : `WeMD doctor: not ready (${result.output.warnings.join("; ")})`,
      );
    } else {
      console.log(
        `${result.output.theme.reference}\t${result.output.theme.name}\t${result.output.theme.fingerprint}`,
      );
    }
    result.output.warnings.forEach((warning) =>
      console.error(`warning: ${warning}`),
    );
    if ("errors" in result.output) {
      result.output.errors.forEach((error) => console.error(`error: ${error}`));
    }
    process.exitCode = result.code;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = error instanceof CliError ? error.exitCode : 3;
  }
}
