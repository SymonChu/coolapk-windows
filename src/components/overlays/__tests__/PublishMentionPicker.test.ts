import { mount, flushPromises } from '@vue/test-utils';
import { describe, it, expect, vi } from 'vitest';
import PublishMentionPicker from '../PublishMentionPicker.vue';
import { CoolapkTauriAPI } from '../../../api/coolapk';
vi.mock('../../../api/coolapk', () => ({ CoolapkTauriAPI: { searchUsers: vi.fn(), getFollowUserList: vi.fn(), getFansList: vi.fn() } }));
vi.mock('../../../utils/tauriStore', () => ({ readTauriStoreValue: vi.fn(async () => [{ uid: '1', username: '酷友甲' }]), writeTauriStoreValue: vi.fn() }));
describe('发帖提醒选择', () => {
  it('读取最近联系人并插入已选择酷友', async () => {
    const wrapper = mount(PublishMentionPicker, { global: { stubs: { teleport: true } }, props: { uid: '9' } });
    await flushPromises();
    await wrapper.get('input[type=checkbox]').setValue(true);
    await wrapper.findAll('button').at(-1)!.trigger('click');
    expect(wrapper.emitted('select')?.[0]?.[0]).toEqual([{ uid: '1', username: '酷友甲', avatar: undefined }]);
    wrapper.unmount();
  });
  it('分页去重并允许多选关注列表', async () => {
    vi.mocked(CoolapkTauriAPI.getFollowUserList).mockResolvedValueOnce({ code: 200, data: [{ userInfo: { uid: '2', username: '酷友乙' } }] }).mockResolvedValueOnce({ code: 200, data: [{ uid: '2', username: '酷友乙' }, { uid: '3', username: '酷友丙' }] });
    const wrapper = mount(PublishMentionPicker, { global: { stubs: { teleport: true } }, props: { uid: '9' } });
    await flushPromises();
    await wrapper.findAll('.tabs button')[1].trigger('click');
    await flushPromises();
    await wrapper.findAll('button').find((button) => button.text() === '加载更多')!.trigger('click');
    await flushPromises();
    const checks = wrapper.findAll('input[type=checkbox]');
    expect(checks).toHaveLength(2);
    await checks[0].setValue(true);
    await checks[1].setValue(true);
    await wrapper.findAll('button').at(-1)!.trigger('click');
    expect(wrapper.emitted('select')?.[0]?.[0]).toEqual(expect.arrayContaining([expect.objectContaining({ uid: '2' }), expect.objectContaining({ uid: '3' })]));
    wrapper.unmount();
  });
});
