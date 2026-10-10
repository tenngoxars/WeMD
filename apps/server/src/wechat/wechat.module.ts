import { Module } from '@nestjs/common';
import { WechatController } from './wechat.controller';
import { WechatService } from './wechat.service';
import { WechatTokenService } from './wechat-token.service';

@Module({
  controllers: [WechatController],
  providers: [WechatService, WechatTokenService],
})
export class WechatModule {}
