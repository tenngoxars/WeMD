import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { memoryStorage } from 'multer';
import { extname } from 'path';
import { COSService } from '../services/cos.service';
import { writeFileSync } from 'fs';

type StorageMode = 'local' | 'cos';

@Controller('upload')
export class UploadController {
  private cosService: COSService | null = null;
  private storageMode: StorageMode;

  constructor(private configService: ConfigService) {
    const configuredMode = this.configService.get<string>('STORAGE_MODE');
    this.storageMode = configuredMode === 'cos' ? 'cos' : 'local';

    if (this.storageMode === 'cos') {
      const secretId = this.configService.get<string>('COS_SECRET_ID');
      const secretKey = this.configService.get<string>('COS_SECRET_KEY');
      const bucket = this.configService.get<string>('COS_BUCKET');
      const region = this.configService.get<string>('COS_REGION');
      const customDomain = this.configService.get<string>('COS_CUSTOM_DOMAIN');

      if (secretId && secretKey && bucket && region) {
        this.cosService = new COSService({
          secretId,
          secretKey,
          bucket,
          region,
          customDomain,
        });
      }
    }
  }

  @Post()
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
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('请上传文件');
    }

    // Multer 默认按 latin1 解码文件名，这里转成 UTF-8，避免中文乱码
    const originalName = Buffer.from(file.originalname, 'latin1').toString(
      'utf8',
    );

    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = extname(file.originalname);
    const filename = `${uniqueSuffix}${ext}`;

    // 如果使用 COS 存储
    if (this.storageMode === 'cos' && this.cosService) {
      try {
        const result = await this.cosService.uploadFile(file.buffer, filename);
        return {
          url: result.url,
          filename: originalName,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new BadRequestException(`上传到云存储失败: ${message}`);
      }
    }

    // 默认使用本地存储
    const localPath = `./uploads/${filename}`;
    writeFileSync(localPath, file.buffer);

    const url = `http://localhost:4000/uploads/${filename}`;
    return {
      url,
      filename: originalName,
    };
  }
}
