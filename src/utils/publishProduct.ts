import type { PublishOptions, PublishTarget } from '../types/publish';

// APK 的 Gson 字段为 page_name、rule 和下划线跑分名，统一转换后供选择和范围检查使用。
export function normalizeProductPublishTabs(value: unknown): NonNullable<PublishTarget['subTabs']> {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const pageName = String(item.page_name ?? item.pageName ?? '');
    if (!/^[0-6]$/.test(pageName) || !item.title) return [];
    const rule = item.rule ?? item.subTabRule;
    return [{ pageName, title: String(item.title), isSubtab: item.is_subtab ?? item.isSubtab, subTabRule: rule && typeof rule === 'object' ? { min: rule.min, max: rule.max, antutuScore: rule.antutu_score ?? rule.antutuScore, geekBenchSingleScore: rule.geek_bench_single_score ?? rule.geekBenchSingleScore, geekBenchMultiScore: rule.geek_bench_multi_score ?? rule.geekBenchMultiScore, threeDMarkScore: rule['3d_mark_score'] ?? rule.threeDMarkScore } : undefined }];
  });
}

export const BENCHMARK_FIELDS = [
  { key: 'antutu_score', title: '安兔兔', rule: 'antutuScore' },
  { key: 'geek_bench_single_score', title: 'GeekBench 单核', rule: 'geekBenchSingleScore' },
  { key: 'geek_bench_multi_score', title: 'GeekBench 多核', rule: 'geekBenchMultiScore' },
  { key: '3d_mark_score', title: 'WildLife Extreme', rule: 'threeDMarkScore' },
] as const;

// 对照 APK 的 tsubdata 格式和服务端下发范围检查，发送前给出具体错误。
export function validateProductPublish(target: PublishTarget | null, options: PublishOptions, imageCount: number): string {
  const id = options.subTypeId || '';
  if (!id) return '';
  const tab = target?.subTabs?.find((item) => item.pageName === id);
  if (target?.type !== 'product_phone' || !tab) return '请选择有效的产品子板块';
  if (['3', '4'].includes(id) && imageCount === 0) return `${tab.title}至少需要一张图片`;
  const data = options.subData || '';
  const rule = tab.subTabRule;
  if (id === '1') {
    const hours = Number(data);
    const min = Number(rule?.min) > 0 ? Number(rule?.min) : 2;
    const max = Number(rule?.max) > 0 ? Number(rule?.max) : 17;
    if (!data || !Number.isFinite(hours) || hours < min || hours > max) return `续航时长须为 ${min} 至 ${max} 小时`;
  }
  if (id === '2') {
    try {
      const scores = JSON.parse(data);
      if (!scores || Array.isArray(scores) || typeof scores !== 'object' || !Object.keys(scores).length) return '请至少填写一项跑分';
      for (const [key, value] of Object.entries(scores)) {
        const field = BENCHMARK_FIELDS.find((item) => item.key === key);
        if (!field || typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return '跑分数据无效';
        const bounds = rule?.[field.rule];
        if ((bounds?.min && value < Number(bounds.min)) || (bounds?.max && value > Number(bounds.max))) return `${field.title}超出该产品的分数范围`;
      }
    } catch { return '请至少填写一项跑分'; }
  }
  if (id === '5' && !/^[1-5]$/.test(data)) return '请选择反馈严重度';
  if (id === '6') {
    try {
      const price = JSON.parse(data);
      if (!price || !Number.isFinite(price.final_price) || price.final_price <= 0 || !Number.isInteger(price.config_id) || price.config_id <= 0 || typeof price.config_name !== 'string' || !price.config_name.trim()) return '请填写到手价并选择产品配置';
    } catch { return '请填写到手价并选择产品配置'; }
  }
  return '';
}
