import {
  Controller,
  Post,
  Body,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { memoryStorage } from 'multer';
import { WechatService } from './wechat.service';
import { WechatTokenService } from './wechat-token.service';

@Controller('wechat')
export class WechatController {
  constructor(
    private wechatService: WechatService,
    private tokenService: WechatTokenService,
    private configService: ConfigService,
  ) {}

  /**
   * 表单未带凭据时回退到环境变量 WECHAT_APPID / WECHAT_SECRET
   */
  private resolveCredentials(appid?: string, secret?: string) {
    const finalAppid =
      appid?.trim() || this.configService.get<string>('WECHAT_APPID');
    const finalSecret =
      secret?.trim() || this.configService.get<string>('WECHAT_SECRET');

    if (!finalAppid || !finalSecret) {
      throw new BadRequestException(
        '缺少公众号凭据：请在表单中填写 appid/secret，或在服务端配置环境变量 WECHAT_APPID / WECHAT_SECRET',
      );
    }

    return { appid: finalAppid, secret: finalSecret };
  }

  @Post('uploadimg')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(), // 使用内存存储以保留 buffer
      fileFilter: (req, file, callback) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|gif|webp)$/)) {
          return callback(new BadRequestException('只支持图片文件'), false);
        }
        callback(null, true);
      },
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
      },
    }),
  )
  async uploadImg(
    @UploadedFile() file: Express.Multer.File,
    @Body('appid') appid?: string,
    @Body('secret') secret?: string,
  ) {
    if (!file) {
      throw new BadRequestException('请上传文件');
    }

    const creds = this.resolveCredentials(appid, secret);
    return this.wechatService.uploadImg(file, creds);
  }

  @Post('token-test')
  async tokenTest(
    @Body('appid') appid?: string,
    @Body('secret') secret?: string,
  ) {
    const creds = this.resolveCredentials(appid, secret);
    await this.tokenService.getAccessToken(creds.appid, creds.secret);
    return { ok: true };
  }
}
