import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../../stores/auth';

const mocks = vi.hoisted(() => ({
  getLoadConfig: vi.fn(),
  openUrl: vi.fn(),
  push: vi.fn(),
}));

vi.mock('../../api/coolapk', () => ({
  CoolapkTauriAPI: {
    getLoadConfig: mocks.getLoadConfig,
    openUrl: mocks.openUrl,
  },
}));

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: mocks.push,
    resolve: () => ({ matched: [{}] }),
  }),
}));

import MyRecentPage from '../MyRecentPage.vue';

const AppImageStub = {
  props: ['src'],
  template: '<span class="app-image-stub">{{ src }}</span>',
};

describe('MyRecentPage', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mocks.getLoadConfig.mockReset();
    mocks.openUrl.mockReset();
    mocks.push.mockReset();
    mocks.getLoadConfig.mockResolvedValue({
      data: [{
        title: '我的卡片',
        entities: [{
          title: '我的常去',
          entities: [{ id: 1, title: 'ColorOS17', logo: 'logo', url: '/topic/ColorOS17' }],
        }],
      }],
    });
  });

  it('在我的栏目中加载并展示我的常去卡片', async () => {
    const authStore = useAuthStore();
    authStore.isLoggedIn = true;
    authStore.user = { uid: '10086', username: '酷友', userAvatar: '' };

    const wrapper = mount(MyRecentPage, {
      global: { stubs: { AppImage: AppImageStub } },
    });
    await flushPromises();

    expect(mocks.getLoadConfig).toHaveBeenCalledTimes(1);
    expect(wrapper.find('.recent-card-title').text()).toBe('ColorOS17');

    await wrapper.find('.recent-card').trigger('click');
    expect(mocks.push).toHaveBeenCalledWith('/topic/ColorOS17');
  });
});
