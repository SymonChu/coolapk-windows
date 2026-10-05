import { describe, expect, it } from 'vitest';
import { router } from '../index';

describe('内容新页路由注册', () => {
  it('酷友圈活动列表路由存在', () => {
    expect(router.resolve('/events').matched.length).toBeGreaterThan(0);
    expect(router.resolve('/events').name).toBe('Events');
  });

  it('活动详情路由存在', () => {
    const resolved = router.resolve('/event/1082');
    expect(resolved.matched.length).toBeGreaterThan(0);
    expect(resolved.params.eventId).toBe('1082');
  });

  it('节点版块路由存在并解析 nodeType/nodeId', () => {
    const resolved = router.resolve('/node/topic/数码');
    expect(resolved.matched.length).toBeGreaterThan(0);
    expect(resolved.params.nodeType).toBe('topic');
    expect(resolved.params.nodeId).toBe('数码');
  });

  it('APK 闲置型号列表路由存在并保留筛选参数', () => {
    const resolved = router.resolve('/secondhand/list?brand=1&productId=2&ershouType=3');
    expect(resolved.matched.length).toBeGreaterThan(0);
    expect(resolved.name).toBe('SecondHandList');
    expect(resolved.query.productId).toBe('2');
  });

  it('APK 闲置品牌分类路由存在', () => {
    expect(router.resolve('/secondhand/brands').name).toBe('SecondHandBrands');
  });

  it('万物清单列表/创建/详情路由存在', () => {
    expect(router.resolve('/anylist').name).toBe('AnyList');
    expect(router.resolve('/anylist/create').name).toBe('AnyListCreate');
    expect(router.resolve('/anylist/9').params.listId).toBe('9');
  });

  it('我的动态号路由存在', () => {
    expect(router.resolve('/my-dyh').name).toBe('MyDyh');
  });

  it('问答详情路由存在并解析 questionId', () => {
    const resolved = router.resolve('/question/123456');
    expect(resolved.matched.length).toBeGreaterThan(0);
    expect(resolved.name).toBe('QuestionDetail');
    expect(resolved.params.questionId).toBe('123456');
  });
});
