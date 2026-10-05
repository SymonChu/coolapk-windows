import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useSettingsStore } from '../stores/settings';
import { isTouchMobilePlatform } from '../utils/platform';

/** 移动平台和移动布局不展示键盘提示；桌面强制布局仍保留提示。 */
export function useShortcutHints() {
  const settings = useSettingsStore();
  const width = ref(typeof window === 'undefined' ? 1024 : window.innerWidth);
  const mobilePlatform = isTouchMobilePlatform();
  const updateWidth = () => { width.value = window.innerWidth; };
  onMounted(() => window.addEventListener('resize', updateWidth));
  onUnmounted(() => window.removeEventListener('resize', updateWidth));
  return computed(() => !mobilePlatform
    && (width.value > 720 || settings.settings.disableAutoMobileMode));
}
