import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';

const mocks = vi.hoisted(() => ({
  open: vi.fn(),
  push: vi.fn(),
  uploadFileToCdn: vi.fn(),
  dropHandler: undefined as undefined | ((event: any) => void),
  stopDrop: vi.fn(),
}));

vi.mock('vue-router', () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: mocks.open }));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn().mockResolvedValue(() => undefined) }));
vi.mock('../../api/coolapk', () => ({ CoolapkTauriAPI: mocks }));
vi.mock('@tauri-apps/api/core', () => ({ isTauri: () => true }));
vi.mock('@tauri-apps/api/webview', () => ({ getCurrentWebview: () => ({ onDragDropEvent: (handler: any) => { mocks.dropHandler = handler; return Promise.resolve(mocks.stopDrop); } }) }));
vi.mock('../../utils/platform', () => ({ isTouchMobilePlatform: () => false }));

import CdnUploadPage from '../CdnUploadPage.vue';
import { useUploadStore } from '../../stores/uploads';

describe('酷安 CDN 文件上传入口', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
    vi.clearAllMocks();
    mocks.open.mockResolvedValue(['C:\\upload\\sample.zip']);
    mocks.uploadFileToCdn.mockResolvedValue({ code: 200, data: 'https://image.coolapk.com/sample.zip' });
  });

  it('选择文件后加入全局队列并跳转到上传任务管理页', async () => {
    const wrapper = mount(CdnUploadPage);
    await wrapper.find('.upload-picker-panel button').trigger('click');
    await flushPromises();

    const store = useUploadStore();
    expect(store.tasks).toHaveLength(1);
    expect(store.tasks[0]?.fileName).toBe('sample.zip');
    expect(mocks.uploadFileToCdn).toHaveBeenCalledWith(store.tasks[0]?.id, 'C:\\upload\\sample.zip', store.tasks[0]?.attempt);
    expect(mocks.push).toHaveBeenCalledWith({ path: '/downloads', query: { mode: 'upload', tab: 'active' } });
    wrapper.unmount();
  });

  it('面板内原生拖拽多个文件进入队列，面板外放下不上传，卸载释放监听', async () => {
    const wrapper = mount(CdnUploadPage);
    await flushPromises();
    vi.spyOn(wrapper.get('.upload-picker-panel').element, 'getBoundingClientRect').mockReturnValue({ left: 10, right: 200, top: 10, bottom: 200 } as DOMRect);
    const position = { x: 50 * window.devicePixelRatio, y: 50 * window.devicePixelRatio };
    mocks.dropHandler!({ payload: { type: 'enter', position, paths: ['C:\\a.zip'] } });
    await flushPromises();
    expect(wrapper.get('.upload-picker-panel').classes()).toContain('is-dragging');
    mocks.dropHandler!({ payload: { type: 'drop', position: { x: 0, y: 0 }, paths: ['C:\\outside.zip'] } });
    await flushPromises();
    expect(useUploadStore().tasks).toHaveLength(0);
    mocks.dropHandler!({ payload: { type: 'drop', position, paths: ['C:\\a.zip', 'C:\\b.txt', 'C:\\a.zip'] } });
    await flushPromises();
    expect(useUploadStore().tasks).toHaveLength(2);
    expect(mocks.open).not.toHaveBeenCalled();
    expect(mocks.push).toHaveBeenCalledWith({ path: '/downloads', query: { mode: 'upload', tab: 'active' } });
    wrapper.unmount();
    expect(mocks.stopDrop).toHaveBeenCalledOnce();
  });
});
