/**
 * 微信公众号官方接口直连（主进程使用，无 CORS 限制）
 * 纯逻辑模块，不依赖 electron，可用 node --test 直接测试
 */

export interface WechatUploadPayload {
  appid: string;
  secret: string;
  fileBase64: string;
  filename: string;
  mime: string;
}

type FetchImpl = typeof fetch;

interface CachedToken {
  token: string;
  expiresAt: number;
}

interface WechatTokenResponse {
  access_token?: string;
  expires_in?: number;
  errcode?: number;
  errmsg?: string;
}

interface WechatUploadResponse {
  url?: string;
  errcode?: number;
  errmsg?: string;
}

// 按 appid 分键缓存，微信 token 有效期 7200s，提前 200s 过期避免边界失效
const tokenCache = new Map<string, CachedToken>();

export async function getAccessToken(
  appid: string,
  secret: string,
  fetchImpl: FetchImpl = fetch,
): Promise<string> {
  const cached = tokenCache.get(appid);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.token;
  }

  const url =
    `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential` +
    `&appid=${encodeURIComponent(appid)}&secret=${encodeURIComponent(secret)}`;

  const response = await fetchImpl(url);
  const data = (await response.json()) as WechatTokenResponse;

  if (data.errcode) {
    throw new Error(
      `获取微信 access_token 失败: ${data.errmsg} (errcode: ${data.errcode})`,
    );
  }

  if (!data.access_token) {
    throw new Error("微信未返回 access_token");
  }

  const expiresIn = data.expires_in ?? 7200;
  tokenCache.set(appid, {
    token: data.access_token,
    expiresAt: Date.now() + (expiresIn - 200) * 1000,
  });

  return data.access_token;
}

export async function uploadImageToWechat(
  payload: WechatUploadPayload,
  fetchImpl: FetchImpl = fetch,
): Promise<string> {
  const { appid, secret, fileBase64, filename, mime } = payload;

  const accessToken = await getAccessToken(appid, secret, fetchImpl);

  const buffer = Buffer.from(fileBase64, "base64");
  const blob = new Blob([new Uint8Array(buffer)], { type: mime });
  const formData = new FormData();
  formData.append("media", blob, filename);

  const response = await fetchImpl(
    `https://api.weixin.qq.com/cgi-bin/media/uploadimg?access_token=${accessToken}`,
    {
      method: "POST",
      body: formData,
    },
  );
  const data = (await response.json()) as WechatUploadResponse;

  if (data.errcode) {
    throw new Error(`${data.errmsg} (errcode: ${data.errcode})`);
  }

  if (!data.url) {
    throw new Error("微信未返回图片地址");
  }

  return data.url;
}
