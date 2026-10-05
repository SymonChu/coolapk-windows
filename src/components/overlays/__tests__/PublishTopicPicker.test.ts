import { mount, flushPromises } from '@vue/test-utils';
import { describe, it, expect, vi, afterEach } from 'vitest';
import PublishTopicPicker from '../PublishTopicPicker.vue';
import { CoolapkTauriAPI } from '../../../api/coolapk';
import { normalizePublishTopics } from '../../../utils/publishTopics';

vi.mock('../../../api/coolapk', () => ({ CoolapkTauriAPI: { searchPublishTopics: vi.fn() } }));
vi.mock('../../../utils/tauriStore', () => ({ readTauriStoreValue: vi.fn(async () => []), writeTauriStoreValue: vi.fn() }));
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });

describe('发帖话题选择', () => {
  it('过滤标题卡并展开话题分组', () => {
    expect(normalizePublishTopics([{ id: 'header', title: '热门', entityType: 'textTitle' }, { entities: [{ id: '1', title: '#摄影#', entityType: 'topic' }] }])).toEqual([{ id: '1', title: '摄影', logo: undefined }]);
  });

  it('使用官方搜索接口并返回完整选择对象', async () => {
    vi.mocked(CoolapkTauriAPI.searchPublishTopics).mockResolvedValue({ code: 200, data: [{ id: '1', title: '摄影', entityType: 'topic' }] });
    const wrapper = mount(PublishTopicPicker, { global: { stubs: { teleport: true } }, props: { uid: '123' } });
    await flushPromises();
    expect(CoolapkTauriAPI.searchPublishTopics).toHaveBeenCalledWith('', 1, '');
    await wrapper.get('.topic-choice').trigger('click');
    await flushPromises();
    expect(wrapper.emitted('select')?.[0]?.[0]).toMatchObject({ id: '1', title: '摄影' });
    wrapper.unmount();
  });

  it('搜索防抖且拒绝过期响应', async () => {
    vi.useFakeTimers();
    vi.mocked(CoolapkTauriAPI.searchPublishTopics).mockResolvedValueOnce({ code: 200, data: [] });
    const wrapper = mount(PublishTopicPicker, { global: { stubs: { teleport: true } }, props: { uid: '123' } });
    await flushPromises();
    let resolveOld!: (value: any) => void;
    vi.mocked(CoolapkTauriAPI.searchPublishTopics).mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }));
    await wrapper.get('input').setValue('旧');
    await vi.advanceTimersByTimeAsync(500);
    await wrapper.get('input').setValue('新');
    vi.mocked(CoolapkTauriAPI.searchPublishTopics).mockResolvedValueOnce({ code: 200, data: [{ id: '2', title: '新话题' }] });
    await vi.advanceTimersByTimeAsync(500);
    resolveOld({ code: 200, data: [{ id: '1', title: '旧话题' }] });
    await flushPromises();
    expect(wrapper.findAll('.topic-choice .publish-picker-name').map((item) => item.text())).toEqual(['#新话题#']);
    wrapper.unmount();
  });
});
