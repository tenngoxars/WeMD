import { BadRequestException } from '@nestjs/common';
import { WechatTokenService } from './wechat-token.service';

describe('WechatTokenService', () => {
  let service: WechatTokenService;
  const mockFetch = jest.fn();

  beforeEach(() => {
    service = new WechatTokenService();
    mockFetch.mockReset();
    global.fetch = mockFetch;
  });

  it('首次获取 token 时调用微信接口并缓存', async () => {
    mockFetch.mockResolvedValue({
      json: () =>
        Promise.resolve({ access_token: 'token-1', expires_in: 7200 }),
    });

    const token = await service.getAccessToken('appid-1', 'secret-1');

    expect(token).toBe('token-1');
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const url = (mockFetch.mock.calls[0] as [string])[0];
    expect(url).toContain('grant_type=client_credential');
    expect(url).toContain('appid=appid-1');
    expect(url).toContain('secret=secret-1');
  });

  it('缓存命中时不重复请求', async () => {
    mockFetch.mockResolvedValue({
      json: () =>
        Promise.resolve({ access_token: 'token-1', expires_in: 7200 }),
    });

    await service.getAccessToken('appid-1', 'secret-1');
    const token = await service.getAccessToken('appid-1', 'secret-1');

    expect(token).toBe('token-1');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('缓存按 appid 分键', async () => {
    mockFetch
      .mockResolvedValueOnce({
        json: () =>
          Promise.resolve({ access_token: 'token-a', expires_in: 7200 }),
      })
      .mockResolvedValueOnce({
        json: () =>
          Promise.resolve({ access_token: 'token-b', expires_in: 7200 }),
      });

    const tokenA = await service.getAccessToken('appid-a', 'secret-a');
    const tokenB = await service.getAccessToken('appid-b', 'secret-b');

    expect(tokenA).toBe('token-a');
    expect(tokenB).toBe('token-b');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('token 过期后重新获取', async () => {
    const now = Date.now();
    const dateSpy = jest
      .spyOn(Date, 'now')
      .mockReturnValueOnce(now) // set 缓存时
      .mockReturnValue(now + 7100 * 1000); // 超过 7000s 提前过期时间

    mockFetch.mockResolvedValue({
      json: () =>
        Promise.resolve({ access_token: 'token-new', expires_in: 7200 }),
    });

    await service.getAccessToken('appid-1', 'secret-1');
    const token = await service.getAccessToken('appid-1', 'secret-1');

    expect(token).toBe('token-new');
    expect(mockFetch).toHaveBeenCalledTimes(2);
    dateSpy.mockRestore();
  });

  it('微信返回 errcode 时抛出带错误信息的异常', async () => {
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ errcode: 40013, errmsg: 'invalid appid' }),
    });

    await expect(
      service.getAccessToken('bad-appid', 'bad-secret'),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.getAccessToken('bad-appid', 'bad-secret'),
    ).rejects.toMatchObject({
      response: { errcode: 40013 },
    });
  });
});
