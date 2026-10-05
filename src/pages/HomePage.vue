<template>
  <!-- 布局变化只更新展示参数，保留栏目页、分页游标和滚动容器。 -->
  <MobileHomePager :mobile="mobile" />
</template>
<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue';
import MobileHomePager from '../components/feed/MobileHomePager.vue';
import { useSettingsStore } from '../stores/settings';
import { isTouchMobilePlatform } from '../utils/platform';
const settings = useSettingsStore();
const narrow = ref(window.matchMedia('(max-width: 720px)').matches);
const mobile = computed(() => narrow.value && (isTouchMobilePlatform() || !settings.settings.disableAutoMobileMode));
const media = window.matchMedia('(max-width: 720px)');
function resize() { narrow.value = media.matches; }
onMounted(() => media.addEventListener('change', resize));
onUnmounted(() => media.removeEventListener('change', resize));
</script>
