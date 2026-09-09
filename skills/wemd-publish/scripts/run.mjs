import { spawn } from "node:child_process";
import { access, realpath } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const minimumNodeMajor = 22;

function nodeMajor() {
  return Number.parseInt(process.versions.node.split(".")[0] ?? "0", 10);
}

function fail(message) {
  console.error(`wemd-publish: ${message}`);
  process.exitCode = 1;
}

async function repositoryRoot() {
  const scriptPath = await realpath(fileURLToPath(import.meta.url));
  return join(dirname(scriptPath), "../../..");
}

async function main() {
  if (nodeMajor() < minimumNodeMajor) {
    fail(
      `需要 Node.js >= ${minimumNodeMajor}，当前为 ${process.versions.node}`,
    );
    return;
  }

  const cliPath = join(await repositoryRoot(), "apps", "cli", "dist", "cli.js");
  try {
    await access(cliPath);
  } catch {
    fail(
      `找不到已构建的 CLI：${cliPath}。请先运行安装器或 pnpm --filter @wemd/cli build。`,
    );
    return;
  }

  const child = spawn(process.execPath, [cliPath, ...process.argv.slice(2)], {
    cwd: process.cwd(),
    shell: false,
    stdio: "inherit",
  });
  child.once("error", (error) => {
    fail(`无法启动 CLI：${error.message}`);
  });
  child.once("close", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exitCode = code ?? 1;
  });
}

main().catch((error) =>
  fail(error instanceof Error ? error.message : String(error)),
);
