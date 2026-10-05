import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
const mocks = vi.hoisted(() => ({ list: vi.fn(), share: vi.fn(), toast: vi.fn(), openUrl: vi.fn() }));
vi.mock('../../../api/coolapk', () => ({ CoolapkTauriAPI: { getFeedShareDyhList: mocks.list, shareFeedToDyh: mocks.share, openUrl: mocks.openUrl } }));
vi.mock('../../../utils/toast', () => ({ showToast: mocks.toast }));
import FeedDyhShareDialog from '../FeedDyhShareDialog.vue';
const mountDialog = () => mount(FeedDyhShareDialog, { props: { isOpen: true, feedId: '42' }, global: { stubs: { AppDialog: { template: '<div><slot /><slot name="footer" /></div>' }, AppImage: true, LoadingState: true } } });
describe('看看号分享', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.share.mockResolvedValue({ code: 200 }); });
  it('只有一个看看号不显示加载更多，多选提交使用官方收录类型', async () => {
    mocks.list.mockResolvedValue({ data: [{ id: '7', title: '看看号' }] });
    const wrapper = mountDialog(); await flushPromises();
    expect(mocks.list).toHaveBeenCalledWith(1, 1);
    expect(wrapper.find('.dyh-share-more').exists()).toBe(false);
    expect(wrapper.find('.dyh-share-submit').attributes('disabled')).toBeDefined();
    await wrapper.find('input[type="checkbox"]').setValue(true);
    await wrapper.find('.dyh-share-submit').trigger('click'); await flushPromises();
    expect(mocks.share).toHaveBeenCalledWith('42', ['7'], 1);
    expect(wrapper.emitted('close')).toHaveLength(1);
    wrapper.unmount();
  });
  it('切换到广场后忽略旧收录列表的迟到响应', async () => {
    let resolveOld!: (response: unknown) => void;
    mocks.list.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; })).mockResolvedValueOnce({ data: [{ id: '8', title: '广场号' }] });
    const wrapper = mountDialog();
    await wrapper.findAll('.dyh-share-tabs button')[1].trigger('click'); await flushPromises();
    resolveOld({ data: [{ id: '7', title: '过时列表' }] }); await flushPromises();
    expect(wrapper.text()).toContain('广场号');
    expect(wrapper.text()).not.toContain('过时列表');
    await wrapper.find('input[type="checkbox"]').setValue(true);
    await wrapper.find('.dyh-share-submit').trigger('click'); await flushPromises();
    expect(mocks.share).toHaveBeenCalledWith('42', ['8'], 2);
    wrapper.unmount();
  });
  it('服务端拒绝提交时保留选择并显示真实失败，不报告成功', async () => {
    mocks.list.mockResolvedValue({ data: [{ id: '7', title: '看看号' }] });
    mocks.share.mockRejectedValue(new Error('权限不足'));
    const wrapper = mountDialog(); await flushPromises();
    await wrapper.find('input[type="checkbox"]').setValue(true);
    await wrapper.find('.dyh-share-submit').trigger('click'); await flushPromises();
    expect(mocks.toast).toHaveBeenCalledWith('权限不足', 'error');
    expect(wrapper.emitted('close')).toBeUndefined();
    expect((wrapper.find('input[type="checkbox"]').element as HTMLInputElement).checked).toBe(true);
    wrapper.unmount();
  });
  it('没有管理的看看号时提供创建入口，不把服务端 HTML 显示出来', async () => {
    mocks.list.mockRejectedValue(new Error("还没有可管理的看看号，<a href='https://m.coolapk.com/mp/do?c=dyh'>去创建</a>"));
    const wrapper = mountDialog(); await flushPromises();
    expect(wrapper.text()).not.toContain('<a');
    expect(wrapper.find('.dyh-share-error button').text()).toBe('去创建');
    await wrapper.find('.dyh-share-error button').trigger('click');
    expect(mocks.openUrl).toHaveBeenCalledWith('https://m.coolapk.com/mp/do?c=dyh', 'internal');
    wrapper.unmount();
  });
});
