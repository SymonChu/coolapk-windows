import { describe, expect, it } from 'vitest';
import { isEquipmentPageUrl, parseEquipmentPage } from '../equipmentPage';

const url = 'https://m.coolapk.com/myDevice/3340664';
const html = `
  <div id="user"><div id="user-info"><img src="http://avatar.coolapk.com/avatar.jpg"><p>用户甲</p></div>
    <div id="rating"><div><p>酷安评价</p><p>略有小成</p></div><div><div><p>数码设备</p><p>2</p></div><div><p>发烧指数</p><p>42</p></div></div></div>
    <div id="latest-product-list"><div><img src="//image.coolapk.com/phone.png"><p>手机甲</p></div></div>
  </div>
  <div id="category-list">
    <div class="category-item"><p>手机</p><div><a href="/product/3285" onclick="evil()"><img src="http://image.coolapk.com/phone.png"><p>手机甲</p></a><div><p>我的评分</p><p><span>5</span><svg></svg></p></div></div></div>
    <div class="category-item"><p>平板电脑</p><div><a href="/product/4973"><p>平板乙</p></a><div><p>去评分</p></div></div></div>
    <div class="category-item" style="display:none"><p>耳机</p></div>
  </div>
  <a style="display:none" href="/mp/do?m=editProductOwner">编辑</a>
  <a href="/mp/do?m=productOwnerShare">保存并分享</a>
  <script>evil()</script>`;

describe('官方装备页数据提取', () => {
  it('保留用户、统计、图片、分类、设备和评分，忽略隐藏分类和按钮', () => {
    const data = parseEquipmentPage(html, url)!;
    expect(data.username).toBe('用户甲');
    expect(data.avatar).toBe('https://avatar.coolapk.com/avatar.jpg');
    expect(data.stats).toEqual([
      { label: '酷安评价', value: '略有小成' },
      { label: '数码设备', value: '2' },
      { label: '发烧指数', value: '42' },
    ]);
    expect(data.recent[0]?.image).toBe('https://image.coolapk.com/phone.png');
    expect(data.categories.map(category => category.name)).toEqual(['手机', '平板电脑']);
    expect(data.categories[0]?.items[0]).toMatchObject({
      name: '手机甲', url: 'https://m.coolapk.com/product/3285', ratingLabel: '我的评分', rating: '5',
    });
    expect(data.categories[1]?.items[0]?.ratingLabel).toBe('去评分');
    expect(data.actions).toEqual([{ label: '保存并分享', url: 'https://m.coolapk.com/mp/do?m=productOwnerShare' }]);
    expect(JSON.stringify(data)).not.toContain('evil');
  });

  it('拒绝脚本图片地址与跨域设备链接', () => {
    const data = parseEquipmentPage(html.replace('http://avatar.coolapk.com/avatar.jpg', 'javascript:evil()')
      .replace('/product/3285', 'https://coolapk.com.evil.com/product/3285'), url)!;
    expect(data.avatar).toBe('');
    expect(data.categories[0]?.items[0]?.url).toBe('');
  });

  it('空装备保留概要，结构不符时交给原页面处理', () => {
    expect(parseEquipmentPage('<div id="user-info"><p>新用户</p></div><div id="category-list"></div>', url)?.categories).toEqual([]);
    expect(parseEquipmentPage('<p>请先登录</p>', url)).toBeNull();
  });

  it.each(['https://m.coolapk.com.evil.com/myDevice/1', 'https://example.com/myDevice/1', 'javascript:alert(1)', 'https://m.coolapk.com/myDevice/edit', 'https://m.coolapk.com/feed/1'])('不会把其他地址识别为装备页：%s', raw => {
    expect(isEquipmentPageUrl(raw)).toBe(false);
    expect(parseEquipmentPage(html, raw)).toBeNull();
  });
});
