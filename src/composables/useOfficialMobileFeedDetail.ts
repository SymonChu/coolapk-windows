import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useSettingsStore } from '../stores/settings';
import { isTouchMobilePlatform } from '../utils/platform';
const viewportWidth = ref(typeof window === 'undefined' ? 1200 : window.innerWidth);
let subscribers = 0;
function resize() { viewportWidth.value = window.innerWidth; }
export function shouldUseOfficialMobileFeedDetail(enabled: boolean, width: number, touchMobile: boolean, disableAutoMobileMode: boolean): boolean {
  return enabled && (touchMobile || (width <= 720 && !disableAutoMobileMode));
}
export function useOfficialMobileFeedDetail() {
  const settings = useSettingsStore();
  onMounted(() => { if (subscribers++ === 0) { resize(); window.addEventListener('resize', resize); } });
  onUnmounted(() => { if (--subscribers === 0) window.removeEventListener('resize', resize); });
  return computed(() => shouldUseOfficialMobileFeedDetail(settings.settings.officialMobileFeedDetail, viewportWidth.value, isTouchMobilePlatform(), settings.settings.disableAutoMobileMode));
}
