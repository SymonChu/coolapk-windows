import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ fetchExternalPage: vi.fn(), openUrl: vi.fn(), openEquipmentWebview: vi.fn(), showToast: vi.fn(), url: 'https://example.com/article' }));
vi.mock('../../api/coolapk', () => ({ CoolapkTauriAPI: mocks }));
vi.mock('../../utils/anchorClick', () => ({ handleAnchorClick: vi.fn() }));
vi.mock('../../utils/toast', () => ({ showToast: mocks.showToast }));
vi.mock('vue-router', () => ({
  useRoute: () => ({ query: { url: mocks.url } })
}));
import ExternalPage from '../ExternalPage.vue';

describe('ExternalPage 系统浏览器', () => {
  beforeEach(() => {
    mocks.url = 'https://example.com/article';
    mocks.fetchExternalPage.mockReset().mockResolvedValue({ data: { html: '<p>文章正文</p>', status: 200 } });
    mocks.openUrl.mockReset().mockResolvedValue(true);
    mocks.openEquipmentWebview.mockReset().mockResolvedValue(undefined);
    mocks.showToast.mockClear();
  });

  it('装备页隐藏网页头部，编辑与分享在内置 WebView 打开', async () => {
    mocks.url = 'https://m.coolapk.com/myDevice/123';
    mocks.fetchExternalPage.mockResolvedValue({ data: { title: '我的装备', status: 200, html: `
      <div id="user-info"><p>用户甲</p></div>
      <div id="category-list"><div class="category-item"><p>手机</p>
        <div><a href="/product/3285"><p>手机甲</p></a><div><p>我的评分</p><p>5</p></div></div>
      </div><div class="category-item" style="display:none"><p>耳机</p></div></div>
      <a href="/mp/do?c=product&m=editProductOwner">编辑</a>
      <a href="/mp/do?c=product&m=productOwnerShare&uid=123">保存并分享</a>` } });
    const wrapper = mount(ExternalPage, { global: { stubs: { AppImage: true } } });
    await flushPromises();
    expect(wrapper.find('.external-content').exists()).toBe(false);
    expect(wrapper.find('.page-header').exists()).toBe(false);
    expect(wrapper.find('.equipment-actions .fa-external-link-alt').exists()).toBe(false);
    expect(wrapper.get('.equipment-category h3').text()).toBe('手机');
    expect(wrapper.get('.equipment-product').attributes('href')).toBe('https://m.coolapk.com/product/3285');
    expect(wrapper.get('.equipment-rating').text()).toContain('我的评分');
    expect(wrapper.text()).not.toContain('耳机');
    await wrapper.get('.equipment-actions button').trigger('click');
    await flushPromises();
    expect(mocks.openEquipmentWebview).toHaveBeenCalledWith('https://m.coolapk.com/mp/do?c=product&m=editProductOwner');
    await wrapper.findAll('.equipment-actions button')[1]!.trigger('click');
    await flushPromises();
    expect(mocks.openEquipmentWebview).toHaveBeenCalledWith('https://m.coolapk.com/mp/do?c=product&m=productOwnerShare&uid=123');
    mocks.openEquipmentWebview.mockRejectedValueOnce(new Error('窗口创建失败'));
    await wrapper.get('.equipment-actions button').trigger('click');
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain('窗口创建失败');
    expect(mocks.showToast).toHaveBeenCalledWith('装备页面打开失败：窗口创建失败', 'error');
    expect(wrapper.get('.equipment-actions button').attributes('disabled')).toBeUndefined();
    expect(mocks.openUrl).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it.each([
    { failure: '返回 false', error: '默认浏览器设置', rejects: false },
    { failure: '抛出异常', error: '未安装浏览器', rejects: true }
  ])('打开失败（$failure）时显示错误，允许再次尝试并清除旧错误', async ({ error, rejects }) => {
    if (rejects) mocks.openUrl.mockRejectedValueOnce(error);
    else mocks.openUrl.mockResolvedValueOnce(false);
    const wrapper = mount(ExternalPage);
    await flushPromises();
    await wrapper.get('.header-actions button').trigger('click');
    await flushPromises();
    expect(mocks.openUrl).toHaveBeenCalledWith('https://example.com/article', 'system');
    expect(wrapper.get('[role="alert"]').text()).toContain(error);
    expect(wrapper.text()).toContain('文章正文');
    await wrapper.get('.header-actions button').trigger('click');
    await flushPromises();
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    expect(mocks.openUrl).toHaveBeenCalledTimes(2);
    wrapper.unmount();
  });

  it.each([
    '<script>renderPage()</script>',
    '<div><br>&nbsp;</div>',
    '<a href="https://example.com">&nbsp;</a>',
    ''
  ])('抓取结果没有可见正文时显示浏览器打开提示：%s', async (html) => {
    mocks.fetchExternalPage.mockResolvedValue({ data: { html, status: 200 } });
    const wrapper = mount(ExternalPage);
    await flushPromises();
    expect(wrapper.text()).toContain('打开完整网页');
    expect(wrapper.find('.external-content').exists()).toBe(false);
    wrapper.unmount();
  });

  it('抓取失败仍可打开系统浏览器，并显示原始错误', async () => {
    mocks.fetchExternalPage.mockRejectedValue('连接超时');
    const wrapper = mount(ExternalPage);
    await flushPromises();
    expect(wrapper.text()).toContain('连接超时');
    await wrapper.get('.header-actions button').trigger('click');
    await flushPromises();
    expect(mocks.openUrl).toHaveBeenCalledWith('https://example.com/article', 'system');
    wrapper.unmount();
  });

  it('打开期间禁用按钮，避免重复调用，结束后恢复', async () => {
    let finishOpen!: (success: boolean) => void;
    mocks.openUrl.mockImplementation(() => new Promise<boolean>((resolve) => { finishOpen = resolve; }));
    const wrapper = mount(ExternalPage);
    await flushPromises();
    const button = wrapper.get('.header-actions button');
    await button.trigger('click');
    expect(button.attributes('disabled')).toBeDefined();
    await button.trigger('click');
    expect(mocks.openUrl).toHaveBeenCalledTimes(1);
    finishOpen(true);
    await flushPromises();
    expect(button.attributes('disabled')).toBeUndefined();
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    wrapper.unmount();
  });
});
