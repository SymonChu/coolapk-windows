import { describe, expect, it } from 'vitest';
import { mergePlugins, pluginClaimLabel, pluginCondition, pluginImage, pluginTime, pluginUsable } from '../userPlugins';
import { normalizeCoolapkRoute } from '../coolapkRoute';

describe('官方挂件协议', () => {
  const row = { id: 1046, title: '挂件', plugin_type: 0, avatar_plugin: 'full.png', avatar_plugin_logo: 'logo.png' };
  it('头像与动态分别使用预览图和缩略图', () => {
    expect(pluginImage(row)).toBe('full.png');
    expect(pluginImage(row, true)).toBe('logo.png');
    expect(pluginImage({ ...row, plugin_type: 1, feed_plugin: 'feed.gif' })).toBe('feed.gif');
  });
  it('领取窗口包含边界，已获取优先于过期', () => {
    const timed = { ...row, get_start_time: 100, get_expire_time: 200 };
    expect(pluginClaimLabel(timed, 99)).toBe('已过期');
    expect(pluginClaimLabel(timed, 100)).toBe('去获取');
    expect(pluginClaimLabel(timed, 200)).toBe('去获取');
    expect(pluginClaimLabel(timed, 201)).toBe('已过期');
    expect(pluginClaimLabel({ ...timed, is_get: 1 }, 201)).toBe('已获取');
    expect(pluginClaimLabel(row, 201)).toBe('去获取');
  });
  it('不可使用的挂件不能选择，但已佩戴行缺少 can_use 时仍可保留', () => {
    expect(pluginUsable(row)).toBe(true);
    expect(pluginUsable({ ...row, can_use: 0 })).toBe(false);
    expect(pluginUsable({ ...row, expired: 1 })).toBe(false);
  });
  it('跨页按 ID 去重并保留第一页之外当前佩戴项', () => {
    expect(mergePlugins([row], [{ ...row, title: '新标题' }, { ...row, id: 1047 }]).map(p => p.title)).toEqual(['新标题', '挂件']);
  });
  it('获取方式作为纯文本显示，期限使用服务端文本', () => {
    expect(pluginCondition('关注<a href="x">#话题#</a>')).toBe('关注#话题#');
    expect(pluginTime({ ...row, use_start_time_txt: '2026.02.11' }, true)).toBe('2026.02.11后可用');
  });
  it('官方管理与商店链接进入所有平台的本地页面', () => {
    expect(normalizeCoolapkRoute('https://m.coolapk.com/mp/userPlugin/myPlugin?autoTheme=1')).toBe('/my-plugins');
    expect(normalizeCoolapkRoute('https://m.coolapk.com/mp/userPlugin/store?noMenu=1')).toBe('/my-plugins/store');
    expect(normalizeCoolapkRoute('https://evil.example/mp/userPlugin/store')).toBeNull();
  });
});
