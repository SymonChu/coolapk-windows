import { describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ notifications: vi.fn(), messages: vi.fn() }));
vi.mock('../../api/coolapk', () => ({ CoolapkTauriAPI: { getNotifications: mocks.notifications, listMessages: mocks.messages } }));
import { androidNotificationContent } from '../androidNotificationContent';
describe('Android 通知正文和点击目标', () => {
  it('点赞显示点赞人，避免把动态作者作为发送者，保留正文链接目标', async () => {
    mocks.notifications.mockResolvedValue({ data: [{ id: '999', username: '动态作者', likeUsername: '点赞人', likeAvatar: 'https://example.com/avatar.png', note: '<a href="/feed/123">赞了你的动态</a>' }] });
    const result = await androidNotificationContent(['like'], '1', 1);
    expect(result.title).toBe('点赞人');
    expect(result.route).toBe('/feed/123');
  });
  it('忽略自己发出的私信，点击直接打开发送者会话', async () => {
    mocks.messages.mockResolvedValue({ data: [{ fromuid: '1', message: '我发的' }, { fromuid: '2', fromusername: '酷友', message: '你好' }] });
    const result = await androidNotificationContent(['message'], '1', 2);
    expect(result.body).toBe('你好');
    expect(result.route).toBe('/messages?uid=2');
  });
  it('接口失败仍有通知正文和可用的通知列表入口', async () => {
    mocks.notifications.mockRejectedValue(new Error('offline'));
    expect(await androidNotificationContent(['comment'], '1', 3)).toMatchObject({ route: '/notifications', body: '你有 3 条未读通知，点击查看详情。' });
  });
});
