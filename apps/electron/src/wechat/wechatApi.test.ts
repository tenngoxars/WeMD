import test from "node:test";
import assert from "node:assert/strict";
import { getAccessToken, uploadImageToWechat } from "./wechatApi";

interface MockCall {
  url: string;
  options?: { method?: string; body?: unknown };
}

const jsonResponse = (data: unknown) =>
  ({ json: async () => data }) as unknown as Response;

function createFetchMock(responses: unknown[]) {
  const calls: MockCall[] = [];
  let index = 0;
  const fetchMock = (async (url: string | URL, options?: MockCall["options"]) => {
    calls.push({ url: String(url), options });
    const data = responses[Math.min(index, responses.length - 1)];
    index += 1;
    return jsonResponse(data);
  }) as typeof fetch;
  return { fetchMock, calls };
}

const uploadPayload = {
  appid: "wx-appid",
  secret: "wx-secret",
  fileBase64: Buffer.from("fake-image").toString("base64"),
  filename: "demo.png",
  mime: "image/png",
};

test("首次获取 token 调用微信接口并缓存", async () => {
  const { fetchMock, calls } = createFetchMock([
    { access_token: "token-1", expires_in: 7200 },
  ]);

  const token = await getAccessToken("appid-cache-1", "secret-1", fetchMock);
  assert.equal(token, "token-1");
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /grant_type=client_credential/);
  assert.match(calls[0].url, /appid=appid-cache-1/);
  assert.match(calls[0].url, /secret=secret-1/);
});

test("token 缓存命中时不重复请求", async () => {
  const { fetchMock, calls } = createFetchMock([
    { access_token: "token-2", expires_in: 7200 },
  ]);

  await getAccessToken("appid-cache-2", "secret-1", fetchMock);
  const token = await getAccessToken("appid-cache-2", "secret-1", fetchMock);

  assert.equal(token, "token-2");
  assert.equal(calls.length, 1);
});

test("token 过期后重新获取", async () => {
  // expires_in 100s，减去 200s 提前量后视为立即过期
  const { fetchMock, calls } = createFetchMock([
    { access_token: "token-old", expires_in: 100 },
    { access_token: "token-new", expires_in: 7200 },
  ]);

  await getAccessToken("appid-expire", "secret-1", fetchMock);
  const token = await getAccessToken("appid-expire", "secret-1", fetchMock);

  assert.equal(token, "token-new");
  assert.equal(calls.length, 2);
});

test("token 接口返回 errcode 时抛出带微信错误信息的异常", async () => {
  const { fetchMock } = createFetchMock([
    { errcode: 40013, errmsg: "invalid appid" },
  ]);

  await assert.rejects(
    getAccessToken("appid-bad", "secret-bad", fetchMock),
    /invalid appid.*40013/,
  );
});

test("uploadimg 成功返回 url", async () => {
  const { fetchMock, calls } = createFetchMock([
    { access_token: "access-token-123", expires_in: 7200 },
    { url: "http://mmbiz.qpic.cn/demo/0" },
  ]);

  const url = await uploadImageToWechat(
    { ...uploadPayload, appid: "appid-upload-ok" },
    fetchMock,
  );

  assert.equal(url, "http://mmbiz.qpic.cn/demo/0");
  assert.equal(calls.length, 2);
  assert.match(
    calls[1].url,
    /media\/uploadimg\?access_token=access-token-123$/,
  );
  assert.equal(calls[1].options?.method, "POST");
  const body = calls[1].options?.body as FormData;
  assert.ok(body instanceof FormData);
  assert.ok(body.get("media"));
});

test("uploadimg 返回 errcode 时抛出异常", async () => {
  const { fetchMock } = createFetchMock([
    { access_token: "access-token-123", expires_in: 7200 },
    { errcode: 45009, errmsg: "api freq out of limit" },
  ]);

  await assert.rejects(
    uploadImageToWechat({ ...uploadPayload, appid: "appid-upload-err" }, fetchMock),
    /api freq out of limit.*45009/,
  );
});

test("uploadimg 未返回 url 时抛出异常", async () => {
  const { fetchMock } = createFetchMock([
    { access_token: "access-token-123", expires_in: 7200 },
    {},
  ]);

  await assert.rejects(
    uploadImageToWechat({ ...uploadPayload, appid: "appid-upload-nourl" }, fetchMock),
    /微信未返回图片地址/,
  );
});
