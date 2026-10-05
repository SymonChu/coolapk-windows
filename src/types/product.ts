export interface ProductConfig {
  id: string | number;
  title?: string;
  product_id?: string | number;
  price?: number | string;
  cpu?: string;
  ram?: string;
  release_time?: string;
  phone_material?: string;
  screen_material?: string;
  keywords?: string;
  url?: string;
  is_add_compare?: number;
  config_data?: string;
  [key: string]: unknown;
}

export interface ProductBrand {
  id?: string | number;
  entityId?: string | number;
  entityType?: string;
  title?: string;
  name?: string;
  logo?: string;
  pic?: string;
  url?: string;
  subTitle?: string;
  type?: string;
  category_level?: string;
  is_recommend?: number;
  product_num?: number;
  series_num?: number;
  secondCategoryRows?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

export interface ProductMedia {
  id?: string | number;
  entityId?: string | number;
  entityType?: string;
  feed_id?: string | number;
  product_id?: string | number;
  type?: string;
  is_recommend?: number;
  media_info?: string;
  url?: string;
  pic?: string;
  uid?: string | number;
  username?: string;
  user_name?: string;
  url_md5?: string;
  [key: string]: unknown;
}

export interface RatingChartData {
  count?: number;
  dateline?: number;
  datelineStr?: string;
  startDate?: number | string;
  endDate?: number | string;
  score?: number;
  maxScore?: number;
  minScore?: number;
  maxCount?: number;
  minCount?: number;
  [key: string]: unknown;
}

export interface RatingChartAxis {
  min?: number;
  max?: number;
  [key: string]: unknown;
}

export interface RatingChart {
  dataType?: string;
  maxCount?: number;
  maxScore?: number;
  minCount?: number;
  minScore?: number;
  x?: RatingChartData[];
  y?: RatingChartAxis[];
  [key: string]: unknown;
}

export interface RatingChartPeriod {
  ratingChart?: RatingChart | null;
  ownerRatingChart?: RatingChart | null;
  [key: string]: unknown;
}

export interface RatingChartPeriods {
  day?: RatingChartPeriod | null;
  week?: RatingChartPeriod | null;
  month?: RatingChartPeriod | null;
  [key: string]: unknown;
}

export interface NodeRating {
  id?: string | number;
  entityId?: string | number;
  entityType?: string;
  uid?: string | number;
  username?: string;
  userAvatar?: string;
  userInfo?: Record<string, unknown>;
  message?: string;
  star?: number;
  rating_score?: number;
  score?: number;
  dateline?: number | string;
  device_title?: string;
  rating_info?: Array<{ title?: string; name?: string; score?: number; star?: number }>;
  sub_scores?: Array<{ label?: string; score?: number }>;
  userAction?: Record<string, unknown>;
  pics?: string[];
  picArr?: string[];
  pic?: string;
  [key: string]: unknown;
}

function formatProductConfigValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map(formatProductConfigValue).filter(Boolean).join('，');
  }
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => {
        const formatted = formatProductConfigValue(item);
        return formatted ? `${key}: ${formatted}` : '';
      })
      .filter(Boolean)
      .join('；');
  }
  return String(value);
}

/** 解析产品配置的 config_data JSON 字符串为分组参数表 */
export function parseProductConfigData(raw: unknown): Record<string, Record<string, string>> {
  if (typeof raw !== 'string' || !raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const groups: Record<string, Record<string, string>> = {};
    for (const [groupName, groupValue] of Object.entries(parsed)) {
      if (!groupValue || typeof groupValue !== 'object' || Array.isArray(groupValue)) continue;
      const fields: Record<string, string> = {};
      for (const [key, value] of Object.entries(groupValue as Record<string, unknown>)) {
        if (value === null || value === undefined) continue;
        const formattedValue = formatProductConfigValue(value);
        if (formattedValue) fields[key] = formattedValue;
      }
      if (Object.keys(fields).length > 0) groups[groupName] = fields;
    }
    return groups;
  } catch {
    return {};
  }
}

export type RatingChartPeriodKey = 'day' | 'week' | 'month';

export const RATING_CHART_PERIOD_LABELS: Record<RatingChartPeriodKey, string> = {
  day: '日',
  week: '周',
  month: '月',
};

/** 从评分趋势响应中提取指定周期的折线数据点（x 轴时间 + y 轴均分） */
export function extractRatingChartSeries(
  period: RatingChartPeriod | null | undefined,
  audience: 'all' | 'owner' = 'all',
): Array<{ label: string; score: number; count: number }> {
  const chart = audience === 'owner' ? period?.ownerRatingChart : (period?.ratingChart || period?.ownerRatingChart);
  if (!chart || !Array.isArray(chart.x)) return [];
  const points = chart.x
    .filter((item) => item && item.score !== undefined && item.score !== null && item.count !== 0)
    .map((item) => ({
      label: ratingChartDateLabel(item),
      score: Number(item.score),
      count: Number(item.count ?? 0),
      order: ratingChartDateOrder(item),
    }))
    .filter((point) => Number.isFinite(point.score) && point.score > 0 && point.score <= 10);
  return points.sort((a, b) => a.order - b.order).map(({ order: _order, ...point }) => point);
}

function ratingChartDateOrder(item: RatingChartData): number {
  const raw = item.startDate ?? item.dateline ?? item.datelineStr;
  if (typeof raw === 'number') return raw;
  const numeric = Number(raw);
  if (Number.isFinite(numeric)) return numeric;
  const parsed = Date.parse(String(raw ?? ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function ratingChartDateLabel(item: RatingChartData): string {
  const raw = item.startDate || item.datelineStr || item.dateline;
  if (raw === undefined || raw === null) return '';
  if (typeof raw === 'number' || /^\d{10,13}$/.test(String(raw))) {
    const value = Number(raw);
    const date = new Date(value < 1e11 ? value * 1000 : value);
    if (Number.isFinite(date.getTime())) return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
  return String(raw);
}
