import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ listener: undefined as undefined | ((event: any) => void), stop: vi.fn(), search: vi.fn(), select: vi.fn() }));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn((_name, callback) => { mocks.listener = callback; return Promise.resolve(mocks.stop); }) }));
vi.mock('../../../api/coolapk', () => ({ CoolapkTauriAPI: { searchByType: mocks.search, selectEquipmentProduct: mocks.select } }));
vi.mock('../../../utils/androidBackButton', () => ({ useAndroidBackButton: vi.fn() }));
import EquipmentProductPicker from '../EquipmentProductPicker.vue';

function mountPicker() {
  return mount(EquipmentProductPicker, { global: { stubs: { AppImage: true, teleport: true } } });
}

describe('装备产品选择器', () => {
  beforeEach(() => {
    mocks.stop.mockClear();
    mocks.search.mockReset().mockResolvedValue({ data: [{ entityType: 'product', id: 123, title: '手机甲', logo: '' }] });
    mocks.select.mockReset().mockResolvedValue(undefined);
  });

  it('搜索真实产品并将选择回填到来源编辑窗口，卸载时释放监听', async () => {
    const wrapper = mountPicker();
    await flushPromises();
    mocks.listener!({ payload: { windowLabel: 'browser_window_3' } });
    await flushPromises();
    await wrapper.get('input').setValue('手机甲');
    await wrapper.get('form').trigger('submit');
    await flushPromises();
    expect(mocks.search).toHaveBeenCalledWith({ searchType: 'product', query: '手机甲', page: 1, lastItem: '' });
    await wrapper.get('.equipment-result').trigger('click');
    await flushPromises();
    expect(mocks.select).toHaveBeenCalledWith('browser_window_3', '123');
    expect(wrapper.find('input').exists()).toBe(false);
    wrapper.unmount();
    expect(mocks.stop).toHaveBeenCalledOnce();
  });

  it('回填失败保留选择器与错误，允许重试', async () => {
    mocks.select.mockRejectedValueOnce(new Error('装备编辑窗口已关闭'));
    const wrapper = mountPicker();
    await flushPromises();
    mocks.listener!({ payload: { windowLabel: 'browser_window_4' } });
    await flushPromises();
    await wrapper.get('input').setValue('手机');
    await wrapper.get('form').trigger('submit');
    await flushPromises();
    await wrapper.get('.equipment-result').trigger('click');
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain('窗口已关闭');
    expect(wrapper.get('.equipment-result').attributes('disabled')).toBeUndefined();
    wrapper.unmount();
  });

  it('关闭后的旧搜索结果不会混入下一次选择', async () => {
    let resolve!: (value: any) => void;
    mocks.search.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    const wrapper = mountPicker();
    await flushPromises();
    mocks.listener!({ payload: { windowLabel: 'browser_window_1' } });
    await flushPromises();
    await wrapper.get('input').setValue('旧请求');
    await wrapper.get('form').trigger('submit');
    mocks.listener!({ payload: { windowLabel: 'browser_window_2' } });
    resolve({ data: [{ entityType: 'product', id: 9, title: '旧结果' }] });
    await flushPromises();
    expect(wrapper.text()).not.toContain('旧结果');
    expect(wrapper.get('input').element.value).toBe('');
    wrapper.unmount();
  });
});
