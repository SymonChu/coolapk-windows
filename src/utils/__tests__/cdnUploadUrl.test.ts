import { describe, expect, it } from 'vitest';
import { normalizeCdnUploadUrl } from '../cdnUploadUrl';

describe('CDN 上传 HTTPS 地址', () => {
  it('保留文件路径与签名参数，升级协议及协议相对地址', () => {
    const path = 'image.coolapk.com/feed/test@0x0.zip?token=a%2Fb&x=1#file';
    expect(normalizeCdnUploadUrl(`http://${path}`)).toBe(`https://${path}`);
    expect(normalizeCdnUploadUrl(`//${path}`)).toBe(`https://${path}`);
  });
  it.each(['http://image.coolapk.com.evil.com/a', 'http://example.com/a', 'https://image.coolapk.com/a', 'invalid', ''])('保留其他地址：%s', raw => {
    expect(normalizeCdnUploadUrl(raw)).toBe(raw);
  });
});
