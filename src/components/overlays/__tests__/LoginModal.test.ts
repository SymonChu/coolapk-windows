import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../../../stores/auth';
import LoginModal from '../LoginModal.vue';
import { CoolapkTauriAPI } from '../../../api/coolapk';

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(vi.fn())
}));

describe('LoginModal account actions', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    setActivePinia(createPinia());
  });

  it('imports native webview credentials before checking the client login status', async () => {
    const store = useAuthStore();
    store.isLoginModalOpen = true;
    let imported = false;
    const sync = vi.spyOn(CoolapkTauriAPI, 'syncLoginWebview').mockImplementation(async () => {
      imported = true;
      return true;
    });
    vi.spyOn(CoolapkTauriAPI, 'closeLoginWebview').mockResolvedValue(true);
    const check = vi.spyOn(store, 'checkStatus').mockImplementation(async () => imported);
    const wrapper = mount(LoginModal, {
      global: { stubs: { Teleport: true, Transition: false } }
    });
    await wrapper.get('.btn-hero-sync').trigger('click');
    await flushPromises();
    expect(sync).toHaveBeenCalledOnce();
    expect(check).toHaveBeenCalledOnce();
    expect(wrapper.text()).toContain('酷安账号凭据同步成功');
    wrapper.unmount();
  });

  it('keeps the modal open when the official verification has not yielded credentials', async () => {
    const store = useAuthStore();
    store.isLoginModalOpen = true;
    vi.spyOn(CoolapkTauriAPI, 'syncLoginWebview').mockResolvedValue(false);
    vi.spyOn(store, 'checkStatus').mockResolvedValue(false);
    const wrapper = mount(LoginModal, {
      global: { stubs: { Teleport: true, Transition: false } }
    });
    await wrapper.get('.btn-hero-sync').trigger('click');
    await flushPromises();
    expect(store.isLoginModalOpen).toBe(true);
    expect(wrapper.text()).toContain('陌生设备短信验证');
    wrapper.unmount();
  });

  it('shows a native synchronization error instead of treating it as successful login', async () => {
    const store = useAuthStore();
    store.isLoginModalOpen = true;
    vi.spyOn(CoolapkTauriAPI, 'syncLoginWebview').mockRejectedValue('无法读取登录窗口凭据');
    const check = vi.spyOn(store, 'checkStatus');
    const wrapper = mount(LoginModal, {
      global: { stubs: { Teleport: true, Transition: false } }
    });
    await wrapper.get('.btn-hero-sync').trigger('click');
    await flushPromises();
    expect(store.isLoginModalOpen).toBe(true);
    expect(wrapper.text()).toContain('无法读取登录窗口凭据');
    expect(check).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('closes the modal after logout instead of switching to the saved-account panel', async () => {
    const store = useAuthStore();
    store.isLoggedIn = true;
    store.user = { uid: '1', username: 'test', userAvatar: '' };
    store.isLoginModalOpen = true;
    const logout = vi.spyOn(store, 'logout').mockImplementation(async () => {
      store.isLoggedIn = false;
      store.user = null;
    });
    const wrapper = mount(LoginModal, {
      global: { stubs: { Teleport: true, Transition: false } }
    });

    const button = wrapper.findAll('button').find((item) => item.text().includes('退出登录'));
    expect(button).toBeTruthy();
    await button!.trigger('click');
    await flushPromises();

    expect(logout).toHaveBeenCalledOnce();
    expect(store.isLoginModalOpen).toBe(false);
  });

  it('marks an expired account and exposes reauthorization and delete actions', async () => {
    const store = useAuthStore();
    store.isLoginModalOpen = true;
    store.accounts = [{ uid: '1', username: 'expired-user', userAvatar: '' }];
    vi.spyOn(store, 'loginAs').mockRejectedValue('服务端确认凭据已过期');
    const removeAccount = vi.spyOn(store, 'removeAccount').mockResolvedValue(undefined);
    const wrapper = mount(LoginModal, {
      global: { stubs: { Teleport: true, Transition: false } }
    });

    await wrapper.get('.saved-account-login').trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('凭据已过期');
    expect(wrapper.get('.saved-account-login').text()).toContain('重新授权');
    expect(wrapper.text()).toContain('服务端确认凭据已过期');

    await wrapper.get('.saved-account-remove').trigger('click');
    expect(wrapper.text()).toContain('确定删除本地账户“expired-user”吗？');
    expect(removeAccount).not.toHaveBeenCalled();

    await wrapper.get('.confirm-dialog-confirm').trigger('click');
    await flushPromises();
    expect(removeAccount).toHaveBeenCalledWith('1');
  });
});
