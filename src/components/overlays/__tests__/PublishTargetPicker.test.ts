import { mount, flushPromises } from '@vue/test-utils';
import { describe, it, expect, vi, afterEach } from 'vitest';
import PublishTargetPicker from '../PublishTargetPicker.vue';
import { CoolapkTauriAPI } from '../../../api/coolapk';
vi.mock('../../../api/coolapk', () => ({ CoolapkTauriAPI: { searchPublishTopics: vi.fn(), searchApks: vi.fn(), searchByType: vi.fn(), getProductDetail: vi.fn() } }));
afterEach(() => vi.useRealTimers());
describe('发布到板块', () => {
  it('选择话题保留真实板块标识，支持移除', async () => {
    vi.mocked(CoolapkTauriAPI.searchPublishTopics).mockResolvedValue({ code: 200, data: [{ id: '123', title: '摄影', entityType: 'topic' }] });
    const wrapper = mount(PublishTargetPicker, { global: { stubs: { teleport: true } }, props: { modelValue: null } });
    await wrapper.get('.target-current button').trigger('click');
    await flushPromises();
    await wrapper.get('.target-choice').trigger('click');
    expect(wrapper.emitted('update:modelValue')?.[0]?.[0]).toMatchObject({ id: '123', type: 'tag', title: '摄影' });
    await wrapper.setProps({ modelValue: { id: '123', type: 'tag', title: '摄影' } });
    await wrapper.findAll('.target-current button')[1].trigger('click');
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([null]);
    wrapper.unmount();
  });
  it('产品选择读取官方 page_name 和 rule，并保留真实产品标识', async () => {
    vi.useFakeTimers();
    vi.mocked(CoolapkTauriAPI.searchPublishTopics).mockResolvedValue({ code: 200, data: [] });
    vi.mocked(CoolapkTauriAPI.searchByType).mockResolvedValue({ code: 200, data: [{ id: '7', title: '手机' }] });
    vi.mocked(CoolapkTauriAPI.getProductDetail).mockResolvedValue({ code: 200, data: { subTab: [{ page_name: '2', title: '跑分', rule: { antutu_score: { max: '200' } } }] } });
    const wrapper = mount(PublishTargetPicker, { global: { stubs: { teleport: true } }, props: { modelValue: null } });
    await wrapper.get('.target-current button').trigger('click');
    await flushPromises();
    await wrapper.findAll('.tabs button')[2].trigger('click');
    await wrapper.get('input').setValue('手机');
    await vi.advanceTimersByTimeAsync(500);
    await wrapper.get('.target-choice').trigger('click');
    await flushPromises();
    expect(CoolapkTauriAPI.getProductDetail).toHaveBeenCalledWith('7');
    expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toMatchObject({ type: 'product_phone', id: '7', subTabs: [{ pageName: '2', title: '跑分', subTabRule: { antutuScore: { max: '200' } } }] });
    wrapper.unmount();
  });

});
