import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ load: vi.fn(), manager: vi.fn(), save: vi.fn(), push: vi.fn() }));
vi.mock('vue-router', () => ({ useRouter: () => ({ push: mocks.push, resolve: () => ({ matched: [{}] }) }) }));
vi.mock('../../api/coolapk', () => ({ CoolapkTauriAPI: { getLoadConfig: mocks.load, getMyCardManager: mocks.manager, updateMyCardConfig: mocks.save } }));
vi.mock('../../utils/androidBackButton', () => ({ useAndroidBackButton: vi.fn() }));
import MyProfileCards from './MyProfileCards.vue';
import { useAuthStore } from '../../stores/auth';
describe('官方个人中心内容卡片', () => {
  beforeEach(() => {
    setActivePinia(createPinia()); vi.clearAllMocks();
    useAuthStore().user = { uid: '1', username: '测试', userAvatar: '' };
    mocks.load.mockResolvedValue({ data: [
      { entityType: 'entity_type_user_card_manager', title: '我的卡片' },
      { entityType: 'card', entityId: 1002, title: '我的常去', entityTemplate: 'iconScrollCard', entities: [{ title: '手机', typeName: '数码', url: '/product/1', logo: 'https://example.com/phone.png' }] },
      { entityType: 'card', entityId: 1003, title: '浏览历史', entityTemplate: 'iconListCard', entities: [{ title: '酷友', typeName: '用户', entityType: 'history', url: '/u/1', dateline: 1 }] },
    ] });
    mocks.manager.mockResolvedValue({ data: [{ id: '1002', title: '我的常去', page_visibility: 1 }, { id: '1003', title: '浏览历史', page_visibility: 0 }] });
  });
  it('保留服务端卡片分组和子内容，横向卡片与历史行分别展示', async () => {
    const wrapper = mount(MyProfileCards); await flushPromises();
    expect(wrapper.findAll('.server-card')).toHaveLength(2);
    expect(wrapper.find('.card-horizontal').text()).toContain('手机数码');
    expect(wrapper.find('.history-item').text()).toContain('酷友用户');
    await wrapper.find('.card-horizontal button').trigger('click'); expect(mocks.push).toHaveBeenCalledWith('/product/1'); wrapper.unmount();
  });
  it('卡片管理读取真实可用清单，保存 show/hide ID 且仅成功后关闭', async () => {
    const wrapper = mount(MyProfileCards); await flushPromises();
    await wrapper.find('.cards-heading button').trigger('click'); await flushPromises();
    const dialog = document.querySelector('.card-manager-page')!;
    (dialog.querySelector('[aria-label="添加浏览历史"]') as HTMLButtonElement).click(); await flushPromises();
    mocks.save.mockResolvedValueOnce({ data: '0' });
    (dialog.querySelectorAll('header button')[1] as HTMLButtonElement).click(); await flushPromises();
    expect(JSON.parse(mocks.save.mock.calls[0]![0])).toEqual({ show: [1002, 1003], hide: [] });
    expect(document.querySelector('.manager-error')?.textContent).toContain('服务器未确认');
    mocks.save.mockResolvedValueOnce({ data: '1' });
    (dialog.querySelectorAll('header button')[1] as HTMLButtonElement).click(); await flushPromises();
    expect(document.querySelector('.card-manager-page')).toBeNull(); wrapper.unmount();
  });
  it('账号退出时清空前一个账号的卡片', async () => {
    const wrapper = mount(MyProfileCards); await flushPromises();
    useAuthStore().user = null; await flushPromises();
    expect(wrapper.findAll('.server-card')).toHaveLength(0);
    expect(wrapper.text()).toContain('登录后查看'); wrapper.unmount();
  });
});
