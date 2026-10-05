import { describe, it, expect } from 'vitest';
import { validateProductPublish, normalizeProductPublishTabs } from '../publishProduct';
import type { PublishTarget } from '../../types/publish';
const target: PublishTarget = { type: 'product_phone', id: '1', title: '产品', subTabs: [{ pageName: '1', title: '续航', subTabRule: { min: '3', max: '20' } }, { pageName: '2', title: '跑分', subTabRule: { antutuScore: { min: '100', max: '200' } } }, { pageName: '3', title: '上手' }, { pageName: '4', title: '样张' }, { pageName: '5', title: '反馈' }, { pageName: '6', title: '到手价' }] };
describe('产品子板块发布检查', () => {
  it('读取 APK 序列化字段并实际应用产品跑分限制', () => {
    const subTabs = normalizeProductPublishTabs([{ page_name: '2', title: '跑分', is_subtab: 1, rule: { antutu_score: { min: '100', max: '200' }, '3d_mark_score': { max: '1000' } } }, { page_name: 'all', title: '全部' }]);
    expect(subTabs).toHaveLength(1);
    expect(validateProductPublish({ ...target, subTabs }, { subTypeId: '2', subData: '{"antutu_score":300}' }, 0)).toContain('超出');
    expect(validateProductPublish({ ...target, subTabs }, { subTypeId: '2', subData: '{"3d_mark_score":900}' }, 0)).toBe('');
  });
  it('使用产品下发的续航和跑分范围', () => {
    expect(validateProductPublish(target, { subTypeId: '1', subData: '2' }, 0)).toContain('3 至 20');
    expect(validateProductPublish(target, { subTypeId: '1', subData: '10.5' }, 0)).toBe('');
    expect(validateProductPublish(target, { subTypeId: '2', subData: '{"antutu_score":300}' }, 0)).toContain('超出');
    expect(validateProductPublish(target, { subTypeId: '2', subData: '{"antutu_score":150}' }, 0)).toBe('');
  });
  it('图片、反馈和配置信息缺失时停止发布', () => {
    expect(validateProductPublish(target, { subTypeId: '3' }, 0)).toContain('图片');
    expect(validateProductPublish(target, { subTypeId: '4' }, 1)).toBe('');
    expect(validateProductPublish(target, { subTypeId: '5', subData: '6' }, 0)).toContain('严重度');
    expect(validateProductPublish(target, { subTypeId: '6', subData: '{"final_price":2999}' }, 0)).toContain('配置');
    expect(validateProductPublish(target, { subTypeId: '6', subData: '{"final_price":2999,"config_id":123,"config_name":"标准版"}' }, 0)).toBe('');
  });
});
