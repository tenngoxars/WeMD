import { Injectable, BadRequestException } from '@nestjs/common';
import { WechatTokenService } from './wechat-token.service';

export interface WechatCredentials {
  appid: string;
  secret: string;
}

interface WechatUploadResponse {
  url?: string;
  errcode?: number;
  errmsg?: string;
}

@Injectable()
export class WechatService {
  constructor(private tokenService: WechatTokenService) {}

  async uploadImg(
    file: Express.Multer.File,
    creds: WechatCredentials,
  ): Promise<{ url: string }> {
    const accessToken = await this.tokenService.getAccessToken(
      creds.appid,
      creds.secret,
    );

    const formData = new FormData();
    const blob = new Blob([new Uint8Array(file.buffer)], {
      type: file.mimetype,
    });
    formData.append('media', blob, file.originalname);

    const response = await fetch(
      `https://api.weixin.qq.com/cgi-bin/media/uploadimg?access_token=${accessToken}`,
      {
        method: 'POST',
        body: formData,
      },
    );
    const data = (await response.json()) as WechatUploadResponse;

    if (data.errcode) {
      throw new BadRequestException({
        message: data.errmsg,
        errcode: data.errcode,
      });
    }

    if (!data.url) {
      throw new BadRequestException('微信未返回图片地址');
    }

    return { url: data.url };
  }
}
