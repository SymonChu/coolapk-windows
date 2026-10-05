import type { DiscoveryEntity } from '../types/discovery';

/** 在路由切换或外部页面返回时保留 APK 闲置首页的实体和分页游标。 */
export type SecondHandPageCache = { initialized: boolean; items: DiscoveryEntity[]; page: number; firstItem: string; lastItem: string; pageContext: string; noMore: boolean };

export const secondHandPageCache: SecondHandPageCache = { initialized: false, items: [], page: 1, firstItem: '', lastItem: '', pageContext: '', noMore: false };

/** 在型号列表与外部闲鱼页面之间切换时保留对应型号的实体、游标和滚动位置。 */
export type SecondHandListCache = { initialized: boolean; items: DiscoveryEntity[]; page: number; firstItem: string; lastItem: string; pageContext: string; noMore: boolean; scrollTop: number };

export const secondHandListCache = new Map<string, SecondHandListCache>();
