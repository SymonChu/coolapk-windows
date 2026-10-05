import { mount, flushPromises } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PublishExtras from '../PublishExtras.vue';
import { CoolapkTauriAPI } from '../../../api/coolapk';
vi.mock('../../../api/coolapk', () => ({ CoolapkTauriAPI: { getMyDyhEditorList: vi.fn(), getGoodsDetail: vi.fn(), prepareGoodsByUrl: vi.fn() } }));
beforeEach(() => vi.clearAllMocks());
describe('内容声明与附加内容', () => {
  it('原创禁止转载映射为 2，订阅号使用可编辑列表', async () => {
    vi.mocked(CoolapkTauriAPI.getMyDyhEditorList).mockResolvedValue({ code: 200, data: [{ id: '9', title: '我的订阅号' }] });
    const wrapper = mount(PublishExtras, { props: { uid: '1', modelValue: { originalType: 1 } }, global: { stubs: { teleport: true, GoodsSearchPickerDialog: true } } });
    await flushPromises();
    await wrapper.findAll('.publish-setting-row')[0].trigger('click');
    await wrapper.get('input[type=checkbox]').setValue(true);
    expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toMatchObject({ originalType: 2 });
    await wrapper.findAll('.publish-confirm')[0].trigger('click');
    await wrapper.findAll('.publish-setting-row').find(button => button.text().includes('订阅号'))!.trigger('click');
    await wrapper.findAll('.publish-choice').find(button => button.text() === '我的订阅号')!.trigger('click');
    expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toMatchObject({ dyhId: '9' });
    expect(CoolapkTauriAPI.getMyDyhEditorList).toHaveBeenCalledWith(1);
    wrapper.unmount();
  });
  it('读取商品详情后附加真实链接，缺少链接不能发布附件', async () => {
    vi.mocked(CoolapkTauriAPI.getMyDyhEditorList).mockResolvedValue({ code: 200, data: [] });
    vi.mocked(CoolapkTauriAPI.getGoodsDetail).mockResolvedValueOnce({ code: 200, data: { url: '/goods/detail?id=8', title: '好物' } }).mockResolvedValueOnce({ code: 200, data: {} });
    const wrapper = mount(PublishExtras, { props: { uid: '1', modelValue: {} }, global: { stubs: { teleport: true, GoodsSearchPickerDialog: true } } });
    await flushPromises();
    const picker = wrapper.findComponent({ name: 'GoodsSearchPickerDialog' });
    picker.vm.$emit('pick', { id: '8' });
    await flushPromises();
    expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toMatchObject({ extraUrl: '/goods/detail?id=8' });
    picker.vm.$emit('pick', { id: '9' });
    await flushPromises();
    expect(wrapper.get('[role=alert]').text()).toContain('缺少');
    expect(wrapper.emitted('update:modelValue')).toHaveLength(1);
    wrapper.unmount();
  });
  it('商城 iPhone 搜索结果通过商品链接转换，不能用商城 ID 查询好物详情', async () => {
    vi.mocked(CoolapkTauriAPI.getMyDyhEditorList).mockResolvedValue({ code: 200, data: [] });
    vi.mocked(CoolapkTauriAPI.prepareGoodsByUrl).mockResolvedValue({ code: 200, data: { id: '123', url: '/goods/detail/123', title: 'iPhone 14 Pro Max' } });
    const wrapper = mount(PublishExtras, { props: { uid: '1', modelValue: {} }, global: { stubs: { teleport: true, GoodsSearchPickerDialog: true } } });
    await flushPromises();
    wrapper.findComponent({ name: 'GoodsSearchPickerDialog' }).vm.$emit('pick', { id: 'mall-sku', entityType: 'pear_goods', goods_title: 'iPhone 14 Pro Max', goods_url: 'https://item.jd.com/100001.html' });
    await flushPromises();
    expect(CoolapkTauriAPI.prepareGoodsByUrl).toHaveBeenCalledWith('https://item.jd.com/100001.html');
    expect(CoolapkTauriAPI.getGoodsDetail).not.toHaveBeenCalled();
    expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toMatchObject({ extraUrl: '/goods/detail/123' });
    expect(wrapper.emitted('attachment-title')?.at(-1)).toEqual(['iPhone 14 Pro Max']);
    wrapper.unmount();
  });
  it('转换失败重试同一个商品，保留原附件，不加载订阅号', async () => {
    vi.mocked(CoolapkTauriAPI.getMyDyhEditorList).mockResolvedValue({ code: 200, data: [] });
    vi.mocked(CoolapkTauriAPI.prepareGoodsByUrl).mockRejectedValueOnce(new Error('添加失败')).mockResolvedValueOnce({ code: 200, data: { url: '/goods/detail/123', title: 'iPhone' } });
    const wrapper = mount(PublishExtras, { props: { uid: '1', modelValue: { extraUrl: '/goods/detail/old' } }, global: { stubs: { teleport: true, GoodsSearchPickerDialog: true } } });
    await flushPromises();
    const picker = wrapper.findComponent({ name: 'GoodsSearchPickerDialog' });
    picker.vm.$emit('pick', { id: 'sku', entityType: 'pear_goods', goods_url: 'https://item.jd.com/100001.html' });
    await flushPromises();
    expect(wrapper.emitted('update:modelValue')).toBeUndefined();
    expect(wrapper.get('[role=alert]').text()).toContain('添加失败');
    picker.vm.$emit('retry');
    await flushPromises();
    expect(CoolapkTauriAPI.prepareGoodsByUrl).toHaveBeenCalledTimes(2);
    expect(CoolapkTauriAPI.getMyDyhEditorList).toHaveBeenCalledTimes(1);
    expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toMatchObject({ extraUrl: '/goods/detail/123' });
    wrapper.unmount();
  });

});
