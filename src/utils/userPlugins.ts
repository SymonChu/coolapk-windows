export interface UserPlugin {
  id: number;
  title: string;
  plugin_type: number;
  avatar_plugin?: string;
  avatar_plugin_logo?: string;
  feed_plugin?: string;
  feed_plugin_logo?: string;
  can_use?: number;
  expired?: number;
  day_left?: number | string;
  expire_days?: number | string;
  is_get?: number;
  get_url?: string;
  getFuncStr?: string;
  get_start_time?: number;
  get_expire_time?: number;
  use_start_time?: number;
  expire_time?: number;
  get_start_time_txt?: string;
  get_expire_time_txt?: string;
  use_start_time_txt?: string;
  expire_time_txt?: string;
}

export function pluginImage(plugin?: UserPlugin, logo = false): string {
  if (!plugin) return '';
  return Number(plugin.plugin_type) === 0
    ? (logo && plugin.avatar_plugin_logo || plugin.avatar_plugin || '')
    : (logo && plugin.feed_plugin_logo || plugin.feed_plugin || '');
}

export function pluginUsable(plugin: UserPlugin): boolean {
  return Number(plugin.expired || 0) !== 1 && (plugin.can_use === undefined || Number(plugin.can_use) === 1);
}

export function pluginClaimLabel(plugin: UserPlugin, now = Date.now() / 1000): string {
  if (Number(plugin.is_get) === 1) return '已获取';
  if ((Number(plugin.get_start_time) > 0 && now < Number(plugin.get_start_time)) ||
      (Number(plugin.get_expire_time) > 0 && now > Number(plugin.get_expire_time))) return '已过期';
  return '去获取';
}

export function pluginTime(plugin: UserPlugin, use = false): string {
  const start = use ? plugin.use_start_time_txt : plugin.get_start_time_txt;
  const end = use ? plugin.expire_time_txt : plugin.get_expire_time_txt;
  if (start && end) return `${start} - ${end}`;
  return start ? `${start}后${use ? '可用' : '可获取'}` : end ? `${end}${use ? '后不可用' : '获取截止'}` : '';
}

// 获取方式字段来自服务器；作为纯文本展示，不能直接注入网页 HTML。
export function pluginCondition(value = ''): string {
  return value.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

export function mergePlugins(existing: UserPlugin[], incoming: UserPlugin[]): UserPlugin[] {
  const rows = new Map(existing.map(row => [Number(row.id), row]));
  for (const row of incoming) if (Number(row.id) > 0) rows.set(Number(row.id), row);
  return [...rows.values()];
}
