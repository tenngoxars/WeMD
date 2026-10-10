import test from "node:test";
import assert from "node:assert/strict";
import { IMAGE_EXTENSIONS, resolveProtocolPath } from "./localImagePolicy";

const buildUrl = (targetPath: string) =>
  `wemd-file://local/${encodeURIComponent(targetPath)}`;
const alwaysInside = () => true;
const alwaysOutside = () => false;

test("解析合法的工作区图片 URL", () => {
  const absolutePath = "C:/ws/post/images/a.png";
  const result = resolveProtocolPath(buildUrl(absolutePath), alwaysInside);
  assert.deepEqual(result, { ok: true, absolutePath });
});

test("解析带反斜杠的 Windows 路径", () => {
  const result = resolveProtocolPath(buildUrl("C:\\ws\\a.png"), alwaysInside);
  assert.deepEqual(result, { ok: true, absolutePath: "C:\\ws\\a.png" });
});

test("拒绝工作区之外的路径", () => {
  const result = resolveProtocolPath(
    buildUrl("C:/other/secret.png"),
    alwaysOutside,
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.status, 403);
});

test("拒绝不在白名单中的扩展名", () => {
  const result = resolveProtocolPath(buildUrl("C:/ws/evil.exe"), alwaysInside);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.status, 403);
});

test("扩展名大小写不敏感", () => {
  const result = resolveProtocolPath(buildUrl("C:/ws/a.PNG"), alwaysInside);
  assert.equal(result.ok, true);
});

test("缺少路径返回 400", () => {
  const result = resolveProtocolPath("wemd-file://local/", alwaysInside);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.status, 400);
});

test("非法 URL 返回 400", () => {
  const result = resolveProtocolPath("not a url", alwaysInside);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.status, 400);
});

test("白名单可通过参数覆盖", () => {
  const result = resolveProtocolPath(
    buildUrl("C:/ws/notes.txt"),
    alwaysInside,
    new Set(["txt"]),
  );
  assert.equal(result.ok, true);
  assert.ok(IMAGE_EXTENSIONS.has("png"));
});
