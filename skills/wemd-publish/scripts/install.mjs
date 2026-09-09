import { spawn } from "node:child_process";
import {
  access,
  lstat,
  mkdir,
  readlink,
  realpath,
  symlink,
} from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

const minimumNodeMajor = 22;

function nodeMajor() {
  return Number.parseInt(process.versions.node.split(".")[0] ?? "0", 10);
}

function parseArguments(argv) {
  let target;
  let skipDeps = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--skip-deps") {
      skipDeps = true;
      continue;
    }
    if (argument === "--target") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--"))
        throw new Error("--target 需要目录路径");
      target = resolve(value);
      index += 1;
      continue;
    }
    throw new Error(`不支持的参数：${argument}`);
  }
  return { skipDeps, target };
}

function run(command, args, options = {}) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      shell: false,
      stdio: "inherit",
      ...options,
    });
    child.once("error", (error) => rejectRun(error));
    child.once("close", (code, signal) => {
      if (code === 0) return resolveRun();
      rejectRun(
        new Error(
          `${command} ${args.join(" ")} 失败${signal ? `（${signal}）` : `（退出码 ${code ?? 1}）`}`,
        ),
      );
    });
  });
}

function capture(command, args, options = {}) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      ...options,
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk;
    });
    child.once("error", (error) => rejectRun(error));
    child.once("close", (code, signal) => {
      if (code === 0) return resolveRun({ stdout, stderr });
      rejectRun(
        new Error(
          `${command} ${args.join(" ")} 失败${signal ? `（${signal}）` : `（退出码 ${code ?? 1}）`}\n${stderr}`,
        ),
      );
    });
  });
}

async function repositoryRoot() {
  const scriptPath = await realpath(fileURLToPath(import.meta.url));
  return join(dirname(scriptPath), "../../..");
}

async function requirePnpm() {
  try {
    await run("pnpm", ["--version"]);
  } catch (error) {
    throw new Error(
      `需要 pnpm。可先运行 corepack enable pnpm。${error instanceof Error ? ` 原因：${error.message}` : ""}`,
    );
  }
}

async function requireCliBuild(root) {
  const cliPath = join(root, "apps", "cli", "dist", "cli.js");
  try {
    await access(cliPath);
  } catch {
    throw new Error(
      `CLI 尚未构建：${cliPath}。请运行 pnpm --filter @wemd/cli build 后重试。`,
    );
  }
  return cliPath;
}

async function requireDoctor(cliPath, root) {
  const { stdout } = await capture(
    process.execPath,
    [cliPath, "doctor", "--json"],
    { cwd: root },
  );
  let result;
  try {
    result = JSON.parse(stdout);
  } catch {
    throw new Error(`无法解析 wemd doctor 输出：${stdout}`);
  }
  if (result?.ok !== true) {
    const warnings = Array.isArray(result?.warnings)
      ? result.warnings.join("；")
      : "未知诊断错误";
    throw new Error(
      `wemd doctor 未就绪：${warnings}。请运行 pnpm --filter @wemd/cli exec playwright install chromium，并重新运行 pnpm --filter @wemd/cli build。`,
    );
  }
}

async function installDependencies(root) {
  await run(
    "pnpm",
    ["--filter", "@wemd/cli...", "install", "--frozen-lockfile"],
    { cwd: root },
  );
  await run("pnpm", ["--filter", "@wemd/core", "build"], { cwd: root });
  await run(
    "pnpm",
    ["--filter", "@wemd/cli", "exec", "playwright", "install", "chromium"],
    { cwd: root },
  );
  await run("pnpm", ["--filter", "@wemd/cli", "build"], { cwd: root });
}

async function linkSkill(source, target) {
  try {
    const targetStat = await lstat(target);
    if (!targetStat.isSymbolicLink()) {
      throw new Error(
        `目标已被真实${targetStat.isDirectory() ? "目录" : "文件"}占用：${target}。请移除或选择空目录，安装器不会覆盖它。`,
      );
    }
    let linkedSource;
    try {
      linkedSource = await realpath(target);
    } catch {
      const rawLink = await readlink(target);
      throw new Error(
        `目标是失效符号链接：${target} -> ${rawLink}。请人工处理后重试。`,
      );
    }
    if (linkedSource === source) {
      console.log(`wemd-publish 已安装：${target}`);
      return;
    }
    throw new Error(
      `目标已链接到另一处：${target} -> ${linkedSource}。安装器不会覆盖它。`,
    );
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      await mkdir(dirname(target), { recursive: true });
      await symlink(source, target, "dir");
      console.log(`wemd-publish 已安装：${target} -> ${source}`);
      return;
    }
    throw error;
  }
}

async function main() {
  if (nodeMajor() < minimumNodeMajor) {
    throw new Error(
      `需要 Node.js >= ${minimumNodeMajor}，当前为 ${process.versions.node}`,
    );
  }
  const { skipDeps, target: requestedTarget } = parseArguments(
    process.argv.slice(2),
  );
  await requirePnpm();
  const root = await repositoryRoot();
  const source = await realpath(join(root, "skills", "wemd-publish"));
  const target =
    requestedTarget ??
    resolve(
      process.env.CODEX_HOME || join(homedir(), ".codex"),
      "skills",
      "wemd-publish",
    );

  if (!skipDeps) await installDependencies(root);
  const cliPath = await requireCliBuild(root);
  await requireDoctor(cliPath, root);
  await linkSkill(source, target);
}

main().catch((error) => {
  console.error(
    `wemd-publish: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
});
