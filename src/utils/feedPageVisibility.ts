import type { InjectionKey, Ref } from 'vue';

/** 缓存的栏目保留内容，但固定浮层只能属于当前可交互页面。 */
export const feedPageVisibleKey: InjectionKey<Readonly<Ref<boolean>>> = Symbol('feed-page-visible');
export const homePagerMovingKey: InjectionKey<Readonly<Ref<boolean>>> = Symbol('home-pager-moving');
