<template>
  <section aria-label="产品子板块">
    <button type="button" class="publish-setting-row" @click="showOptions = true"><i class="fas fa-list setting-icon"></i><span class="setting-title">产品子板块</span><span class="setting-value" :class="{ selected: subType }">{{ currentTab?.title || '普通讨论' }}</span><i class="fas fa-chevron-right setting-arrow"></i></button>
    <PublishOptionSheet :is-open="showOptions" :title="target.title" @close="showOptions = false"><div class="product-options">
    <label>子板块 <select v-model="subType"><option value="">普通讨论</option><option v-for="tab in tabs" :key="tab.pageName" :value="tab.pageName">{{ tab.title }}</option></select></label>
    <label v-if="subType === '1'">亮屏续航（小时）<input v-model="hours" type="number" step="0.1" :min="currentTab?.subTabRule?.min || 2" :max="currentTab?.subTabRule?.max || 17" /></label>
    <div v-if="subType === '2'" class="scores"><label v-for="field in BENCHMARK_FIELDS" :key="field.key">{{ field.title }}<input v-model="scores[field.key]" type="number" min="1" step="1" /></label></div>
    <p v-if="subType === '3' || subType === '4'">{{ currentTab?.title }}必须附上图片。</p>
    <label v-if="subType === '5'">问题严重度 <select v-model="level"><option value="">请选择</option><option v-for="(title, index) in ['较低', '一般', '次要', '严重', '致命']" :key="title" :value="String(index + 1)">{{ title }}</option></select></label>
    <template v-if="subType === '6'">
      <label>到手价（元）<input v-model="price" type="number" min="0.01" max="9999999.99" step="0.01" /></label>
      <label>产品配置 <select v-model="configId"><option value="">请选择配置</option><option v-for="config in versions" :key="config.id" :value="String(config.id)">{{ config.title }}</option></select></label>
      <p v-if="loading">正在读取产品配置…</p><p v-if="error" role="alert">{{ error }} <button type="button" @click="loadVersions">重试</button></p>
    </template>
    </div><template #footer><button type="button" class="publish-confirm" @click="showOptions = false">确定</button></template></PublishOptionSheet>
  </section>
</template>
<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue';
import type { PublishTarget, PublishOptions } from '../../types/publish';
import PublishOptionSheet from './PublishOptionSheet.vue';
import '../../styles/publish.css';
import { BENCHMARK_FIELDS } from '../../utils/publishProduct';
import { CoolapkTauriAPI } from '../../api/coolapk';
const props = defineProps<{ target: PublishTarget; modelValue: PublishOptions }>();
const emit = defineEmits<{ 'update:modelValue': [options: PublishOptions] }>();
const showOptions = ref(false);
const subType = ref('');
const hours = ref('');
const level = ref('');
const price = ref('');
const configId = ref('');
const scores = reactive<Record<string, string>>({});
const versions = ref<{ id: string | number; title: string }[]>([]);
const loading = ref(false);
const error = ref('');
let revision = 0;
let versionsLoadedFor = '';
const tabs = computed(() => (props.target.subTabs || []).filter((tab) => /^[0-6]$/.test(tab.pageName)));
const currentTab = computed(() => tabs.value.find((tab) => tab.pageName === subType.value));
async function loadVersions() {
  const request = ++revision;
  loading.value = true;
  error.value = '';
  try {
    const response = await CoolapkTauriAPI.getProductVersions(props.target.id);
    if (request !== revision) return;
    if (response?.code !== 200) throw new Error(response?.message || '获取配置失败');
    versions.value = (Array.isArray(response.data) ? response.data : []).filter((item: any) => Number(item.id) > 0 && item.title);
    versionsLoadedFor = props.target.id;
  } catch (failure) { if (request === revision) error.value = String(failure instanceof Error ? failure.message : failure); }
  finally { if (request === revision) loading.value = false; }
}
// 恢复草稿时读取其子板块数据；切换产品由父组件清空选项。
function restoreOptions() {
  subType.value = props.modelValue.subTypeId || '';
  hours.value = ''; level.value = ''; price.value = ''; configId.value = '';
  Object.keys(scores).forEach((key) => delete scores[key]);
  const data = props.modelValue.subData || '';
  if (subType.value === '1') hours.value = data;
  if (subType.value === '5') level.value = data;
  try {
    if (subType.value === '2') for (const [key, value] of Object.entries(JSON.parse(data))) scores[key] = String(value);
    if (subType.value === '6') { const value = JSON.parse(data); price.value = String(value.final_price || ''); configId.value = String(value.config_id || ''); if (value.config_id && value.config_name && !versions.value.some((item) => String(item.id) === String(value.config_id))) versions.value.push({ id: value.config_id, title: value.config_name }); }
  } catch { /* 不完整的数据由发布前检查提示，不擅自填充有效值。 */ }
}
watch(() => props.target.id, () => { ++revision; versions.value = []; restoreOptions(); }, { immediate: true });
watch(() => props.modelValue, restoreOptions);
watch([() => props.target.id, subType], ([productId, id]) => { if (id === '6' && versionsLoadedFor !== productId) void loadVersions(); }, { immediate: true });
watch([subType, hours, level, price, configId, scores], () => {
  let data = '';
  if (subType.value === '1') data = String(hours.value);
  if (subType.value === '2') data = JSON.stringify(Object.fromEntries(Object.entries(scores).filter(([, value]) => Number(value) > 0).map(([key, value]) => [key, Number(value)])));
  if (subType.value === '5') data = level.value;
  if (subType.value === '6') { const config = versions.value.find((item) => String(item.id) === configId.value); data = JSON.stringify({ final_price: Number(price.value), config_id: Number(configId.value), config_name: config?.title || '' }); }
  if ((props.modelValue.subTypeId || '') !== subType.value || (props.modelValue.subData || '') !== data) emit('update:modelValue', { subTypeId: subType.value, subData: data });
}, { deep: true });
</script>
<style scoped>
.product-options { display: flex; flex-direction: column; gap: 20px; padding: 8px 0 16px; color: var(--text-secondary); font-size: 14px; }
label { display: flex; flex-direction: column; gap: 10px; }
input, select { padding: 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); color: var(--text-primary); width: 100%; }
.scores { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
button { color: var(--brand-primary); }
@media (max-width: 600px) { .scores { grid-template-columns: 1fr; } }
</style>
