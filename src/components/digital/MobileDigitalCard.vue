<template>
  <section v-if="isCarousel && children.length" class="mobile-digital-banner">
    <div class="banner-track" @scroll.passive="updateBanner" ref="bannerTrack">
      <button v-for="(item, index) in children" :key="getEntityKey(item, index)" type="button" :aria-label="getDigitalEntityTitle(item) || '数码推荐'" @click="$emit('open', item)">
        <AppImage :src="getEntityImage(item)" fit="cover" image-class="banner-image" />
      </button>
    </div>
    <div v-if="children.length > 1" class="banner-dots"><button v-for="(_, index) in children" :key="index" :class="{ active: bannerIndex === index }" :aria-label="`第 ${index + 1} 张推荐`" @click="showBanner(index)"></button></div>
  </section>
  <section v-else-if="isGrid || isTimeline || isProductList" :class="['mobile-digital-card', { 'is-navigation': isNavigation }]">
    <header v-if="title" class="card-heading">
      <h3>{{ title }}</h3>
      <button v-if="resolveDiscoveryRoute(entity)" type="button" @click="$emit('open', entity)">{{ entity.subTitle || '更多' }}<i class="fas fa-chevron-right"></i></button>
    </header>
    <div v-if="isGrid" :class="['card-grid', { 'category-grid': isNavigation, 'mini-grid': isMini }]" :style="{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }">
      <button v-for="(item, index) in children" :key="getEntityKey(item, index)" type="button" class="grid-item" @click="$emit('open', item)">
        <div class="grid-image">
          <AppImage v-if="getEntityImage(item)" :src="getEntityImage(item)" fit="contain" />
          <i v-else :class="getEntityFallbackIcon(item)"></i>
          <span v-if="ranked" :class="['rank-ribbon', `rank-${index + 1}`]">{{ index + 1 }}</span>
        </div>
        <span class="grid-name">{{ getDigitalEntityTitle(item) }}</span>
        <span v-if="!isNavigation && !isMini && getDigitalProductHot(item)" class="grid-hot"><i class="fas fa-fire-flame-curved"></i>{{ getDigitalProductHot(item) }}</span>
      </button>
    </div>
    <div v-else class="card-rows" :class="{ 'timeline-rows': isTimeline }">
      <button v-for="(item, index) in children" :key="getEntityKey(item, index)" type="button" class="product-row" @click="$emit('open', item)">
        <span v-if="isTimeline" class="release-date"><span>{{ dateParts(item)[0] }}</span><small>{{ dateParts(item)[1] }}</small></span>
        <AppImage v-if="getEntityImage(item)" :src="getEntityImage(item)" fit="contain" class="row-image" />
        <span class="row-name">{{ getDigitalEntityTitle(item) }}</span>
        <span v-if="(!isTimeline || Number(item.release_status) === 1) && getDigitalProductHot(item)" class="row-hot"><i class="fas fa-fire-flame-curved"></i>{{ getDigitalProductHot(item) }}</span>
      </button>
    </div>
  </section>
  <section v-else-if="isFeedGroup" class="mobile-digital-card mobile-feed-group">
    <header v-if="title" class="card-heading"><h3>{{ title }}</h3><button v-if="resolveDiscoveryRoute(entity)" type="button" @click="$emit('open', entity)">{{ entity.subTitle || '更多' }}<i class="fas fa-chevron-right"></i></button></header>
    <DiscoveryEntityCard v-for="(item, index) in children" :key="getEntityKey(item, index)" :entity="item" @open="$emit('open', $event)" />
  </section>
  <DiscoveryEntityCard v-else :entity="entity" @open="$emit('open', $event)" />
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import AppImage from '../common/AppImage.vue';
import DiscoveryEntityCard from '../discovery/DiscoveryEntityCard.vue';
import type { DiscoveryEntity } from '../../types/discovery';
import { getEntityImage, getEntityKey, getEntityFallbackIcon, resolveDiscoveryRoute } from '../../utils/discovery';
import { getDigitalEntityTitle, getDigitalProductHot, getDigitalProductRelease } from '../../utils/digitalProduct';

const props = defineProps<{ entity: DiscoveryEntity }>();
defineEmits<{ open: [entity: DiscoveryEntity] }>();
const children = computed(() => props.entity.entities || []);
const template = computed(() => String(props.entity.entityTemplate || '').toLowerCase());
const title = computed(() => getDigitalEntityTitle(props.entity));
const isCarousel = computed(() => template.value.startsWith('imagecarouselcard'));
const isNavigation = computed(() => template.value === 'iconlinkgridcard');
const isMini = computed(() => template.value === 'iconminigridcard');
const isGrid = computed(() => ['iconlinkgridcard', 'iconlongtitlegridcard', 'icongridcard', 'iconminigridcard'].includes(template.value));
const isFeedGroup = computed(() => children.value.length > 0 && children.value.every(item => item.entityType === 'feed'));
const isTimeline = computed(() => template.value === 'producttimelinelistcard');
const isProductList = computed(() => template.value === 'iconlistcard' && children.value.length > 0 && children.value.every(item => item.entityType === 'product'));
const extra = computed<Record<string, unknown>>(() => {
  if (props.entity.extraData && typeof props.entity.extraData === 'object') return props.entity.extraData as Record<string, unknown>;
  try { return JSON.parse(String(props.entity.extraData || '{}')); } catch { return {}; }
});
const columns = computed(() => {
  if (isNavigation.value) return 5;
  const cols = Number(extra.value.cols);
  return Number.isInteger(cols) && cols > 0 && cols <= 5 ? cols : 4;
});
const ranked = computed(() => ['1', 'true'].includes(String(extra.value.withRanking)));
function dateParts(item: DiscoveryEntity): [string, string] {
  const date = getDigitalProductRelease(item);
  const match = date.match(/^(\d{4})年(?:(\d{1,2})月(\d{1,2})日|(.*))$/);
  if (match) return [match[2] ? `${match[2].padStart(2, '0')}.${match[3]!.padStart(2, '0')}` : match[4] || '未公布', match[1]!];
  return [date || '未公布', ''];
}
const bannerTrack = ref<HTMLElement | null>(null);
const bannerIndex = ref(0);
function updateBanner() {
  const track = bannerTrack.value;
  if (track?.clientWidth) bannerIndex.value = Math.round(track.scrollLeft / track.clientWidth);
}
function showBanner(index: number) {
  const track = bannerTrack.value;
  track?.scrollTo({ left: index * track.clientWidth, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
}
</script>

<style scoped>
.mobile-digital-card { border-radius: 14px; background: var(--surface); padding: 12px; min-width: 0; overflow: hidden; }
.mobile-feed-group { padding: 12px 0 0; }
.mobile-feed-group > .card-heading { padding-left: 12px; padding-right: 12px; }
.card-heading { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 0 0 10px; }
.card-heading h3 { margin: 0; color: var(--text-primary); font-size: 18px; line-height: 26px; font-weight: 700; }
.card-heading button { display: flex; align-items: center; gap: 8px; min-height: 32px; border: 0; background: transparent; color: var(--text-tertiary); font-size: 13px; }
.card-grid { display: grid; row-gap: 12px; }
.grid-item { display: flex; flex-direction: column; align-items: center; gap: 8px; min-width: 0; padding: 0; border: 0; background: transparent; color: var(--text-primary); font: inherit; }
.grid-image { position: relative; display: grid; place-items: center; width: 100%; height: 62px; }
.grid-image :deep(.app-image-container) { width: 48px; height: 48px; background: transparent; }
.grid-name { width: 100%; font-size: 14px; line-height: 19px; min-height: 38px; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; text-align: center; font-weight: 400; }
.grid-hot, .row-hot { display: flex; align-items: center; justify-content: center; gap: 2px; font-size: 11px; color: var(--text-secondary); white-space: nowrap; }
.rank-ribbon { position: absolute; left: 0; top: 0; min-width: 14px; height: 17px; padding: 0 2px 3px; background: #ccc7c7; color: white; font-size: 11px; line-height: 17px; clip-path: polygon(0 0,100% 0,100% 100%,50% 80%,0 100%); }
.rank-1 { background: #ff443c; }.rank-2 { background: #ff8700; }.rank-3 { background: #ffbd00; }.rank-4 { background: #c5df2d; }
.is-navigation { padding: 10px 8px; }
.category-grid { row-gap: 16px; }
.category-grid .grid-item { gap: 4px; }
.category-grid .grid-image { height: 40px; }
.category-grid .grid-image :deep(.app-image-container) { width: 36px; height: 36px; border-radius: 50%; }
.category-grid .grid-name { font-size: 12px; line-height: 18px; min-height: 18px; -webkit-line-clamp: 1; white-space: nowrap; }
.mini-grid .grid-name { font-size: 12px; }
.card-rows { display: flex; flex-direction: column; }
.product-row { display: flex; align-items: center; gap: 8px; width: 100%; min-height: 72px; padding: 6px 0; border: 0; background: transparent; text-align: left; color: var(--text-primary); }
.row-image { width: 42px; height: 42px; flex: 0 0 42px; }
.row-name { flex: 1; min-width: 0; font-size: 14px; line-height: 20px; overflow: hidden; text-overflow: ellipsis; }
.release-date { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; align-self: stretch; flex: 0 0 66px; margin-right: 12px; border-right: 1px solid var(--surface-hover); font-size: 16px; }
.release-date::after { position: absolute; right: -5px; top: calc(50% - 5px); width: 10px; height: 10px; background: var(--surface-hover); border-radius: 50%; content: ''; }
.release-date small { font-size: 12px; }
.timeline-rows .row-image { width: 34px; height: 34px; flex-basis: 34px; }
.mobile-digital-banner { position: relative; overflow: hidden; border-radius: 14px; }
.banner-track { display: flex; overflow-x: auto; scroll-snap-type: x mandatory; scrollbar-width: none; }
.banner-track::-webkit-scrollbar { display: none; }
.banner-track > button { flex: 0 0 100%; min-width: 0; aspect-ratio: 4.5; padding: 0; border: 0; background: transparent; scroll-snap-align: start; }
.banner-track :deep(.app-image-container) { width: 100%; height: 100%; }
.banner-dots { position: absolute; right: 8px; bottom: 7px; display: flex; gap: 4px; }
.banner-dots button { width: 6px; height: 6px; padding: 0; border: 0; border-radius: 50%; background: #ffffff70; }
.banner-dots button.active { background: white; }
.grid-item:active, .product-row:active { opacity: .65; }
</style>
