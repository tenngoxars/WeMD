import { Injectable, BadRequestException } from '@nestjs/common';

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

@Injectable()
export class WechatTokenService {
  // 按 appid 分键缓存，微信 token 有效期 7200s，提前 200s 过期避免边界失效
  private cache = new Map<string, CachedToken>();

  async getAccessToken(appid: string, secret: string): Promise<string> {
    const cached = this.cache.get(appid);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.token;
    }

    const url =
      `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential` +
      `&appid=${encodeURIComponent(appid)}&secret=${encodeURIComponent(secret)}`;

    const response = await fetch(url);
    const data = (await response.json()) as WechatTokenResponse;

    if (data.errcode) {
      throw new BadRequestException({
        message: `获取微信 access_token 失败: ${data.errmsg}`,
        errcode: data.errcode,
      });
    }

    if (!data.access_token) {
      throw new BadRequestException('微信未返回 access_token');
    }

    const expiresIn = data.expires_in ?? 7200;
    this.cache.set(appid, {
      token: data.access_token,
      expiresAt: Date.now() + (expiresIn - 200) * 1000,
    });

    return data.access_token;
  }
}
