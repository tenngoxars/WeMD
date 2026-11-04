import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  buildPayload,
  exportOnClose,
  MIGRATION_FILE,
  writeMigrationFile,
} from "./exportSettings";

test("buildPayload 只保留白名单内的字符串值", () => {
  const payload = buildPayload({
    "wemd-ai-config": '{"apiKey":"k"}',
    "wemd-skipped-version": "1.0.0",
    "wemd-table-wrap": 1,
  });
  assert.deepEqual(payload.entries, { "wemd-ai-config": '{"apiKey":"k"}' });
  assert.equal(payload.version, 1);
  assert.deepEqual(buildPayload(null).entries, {});
});

test("writeMigrationFile 原子写入且权限为 600", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wemd-mig-"));
  try {
    writeMigrationFile(dir, { a: 1 });
    writeMigrationFile(dir, { a: 2 });
    const file = path.join(dir, MIGRATION_FILE);
    assert.deepEqual(JSON.parse(fs.readFileSync(file, "utf8")), { a: 2 });
    assert.deepEqual(fs.readdirSync(dir), [MIGRATION_FILE]);
    if (process.platform !== "win32") {
      assert.equal(fs.statSync(file).mode & 0o777, 0o600);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("writeMigrationFile 清理旧临时文件，失败时不残留本次临时文件", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wemd-mig-"));
  try {
    fs.writeFileSync(path.join(dir, `${MIGRATION_FILE}.123.tmp`), "old");
    fs.writeFileSync(path.join(dir, `${MIGRATION_FILE}.abc.tmp`), "keep");
    // 目标是非空目录，rename 必然失败
    fs.mkdirSync(path.join(dir, MIGRATION_FILE, "x"), { recursive: true });
    assert.throws(() => writeMigrationFile(dir, { a: 1 }));
    assert.deepEqual(fs.readdirSync(dir).sort(), [MIGRATION_FILE, `${MIGRATION_FILE}.abc.tmp`]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function fakeWindow() {
  let listener: (event: { preventDefault(): void }) => void = () => {};
  const win = {
    closed: 0,
    prevented: 0,
    on: (_: "close", l: typeof listener) => {
      listener = l;
    },
    // 模拟 BrowserWindow：close() 会再触发 close 事件，未被阻止才算关闭
    close: () => {
      let prevented = false;
      listener({ preventDefault: () => (prevented = true) });
      if (prevented) win.prevented++;
      else win.closed++;
    },
    isDestroyed: () => false,
  };
  return win;
}

test("exportOnClose 导出完成后关闭，且重复关闭不重入", async () => {
  const win = fakeWindow();
  let runs = 0;
  let after = 0;
  exportOnClose(
    win,
    async () => {
      runs++;
    },
    () => after++,
  );
  win.close();
  win.close();
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(runs, 1);
  assert.equal(win.closed, 1);
  assert.equal(after, 1);
});

test("exportOnClose 导出卡住时超时也能关闭", async () => {
  const win = fakeWindow();
  exportOnClose(win, () => new Promise(() => {}), undefined, 20);
  win.close();
  assert.equal(win.closed, 0);
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(win.closed, 1);
});
