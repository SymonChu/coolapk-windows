import { describe, it, expect } from 'vitest';
import { shouldUseOfficialMobileFeedDetail } from '../useOfficialMobileFeedDetail';
import { normalizeSettings } from '../../stores/settings';
describe('官方移动详情的默认与回退', () => {
  it('旧配置默认开启，显式关闭经过配置规范化仍然保留', () => {
    expect(normalizeSettings({}).officialMobileFeedDetail).toBe(true);
    expect(normalizeSettings({ officialMobileFeedDetail: false }).officialMobileFeedDetail).toBe(false);
  });
  it('手机和平板启用；桌面宽窗保持原详情，禁用窄窗移动模式也保持原详情', () => {
    expect(shouldUseOfficialMobileFeedDetail(true, 360, true, false)).toBe(true);
    expect(shouldUseOfficialMobileFeedDetail(true, 1024, true, false)).toBe(true);
    expect(shouldUseOfficialMobileFeedDetail(true, 1200, false, false)).toBe(false);
    expect(shouldUseOfficialMobileFeedDetail(true, 360, false, true)).toBe(false);
    expect(shouldUseOfficialMobileFeedDetail(false, 360, true, false)).toBe(false);
  });
});
