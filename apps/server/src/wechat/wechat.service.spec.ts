import { BadRequestException } from '@nestjs/common';
import { WechatService } from './wechat.service';
import { WechatTokenService } from './wechat-token.service';

describe('WechatService', () => {
  let service: WechatService;
  let tokenService: WechatTokenService;
  const mockFetch = jest.fn();

  const file = {
    originalname: 'test.png',
    mimetype: 'image/png',
    buffer: Buffer.from('fake-image'),
  } as Express.Multer.File;

  beforeEach(() => {
    tokenService = new WechatTokenService();
    service = new WechatService(tokenService);
    mockFetch.mockReset();
    global.fetch = mockFetch;
    jest
      .spyOn(tokenService, 'getAccessToken')
      .mockResolvedValue('access-token-123');
  });

  it('上传成功返回 url', async () => {
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ url: 'http://mmbiz.qpic.cn/demo/0' }),
    });

    const result = await service.uploadImg(file, {
      appid: 'appid-1',
      secret: 'secret-1',
    });

    expect(result).toEqual({ url: 'http://mmbiz.qpic.cn/demo/0' });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      'https://api.weixin.qq.com/cgi-bin/media/uploadimg?access_token=access-token-123',
    );
    expect(options.method).toBe('POST');
    const body = options.body as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect(body.get('media')).toBeTruthy();
  });

  it('微信返回 errcode 时抛出含 errcode/errmsg 的异常', async () => {
    mockFetch.mockResolvedValue({
      json: () =>
        Promise.resolve({ errcode: 45009, errmsg: 'api freq out of limit' }),
    });

    await expect(
      service.uploadImg(file, { appid: 'appid-1', secret: 'secret-1' }),
    ).rejects.toMatchObject({
      response: { message: 'api freq out of limit', errcode: 45009 },
    });
  });

  it('微信未返回 url 时抛出异常', async () => {
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({}),
    });

    await expect(
      service.uploadImg(file, { appid: 'appid-1', secret: 'secret-1' }),
    ).rejects.toThrow(BadRequestException);
  });
});
