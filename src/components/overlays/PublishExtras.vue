<template>
  <section class="publish-extras" aria-label="内容声明和附加内容">
    <button type="button" class="publish-setting-row declaration-row" :class="{ selected: declaration }" @click="showDeclaration = true"><i class="far fa-file-alt setting-icon"></i><span class="setting-title">内容声明</span><span class="setting-value" :class="{ selected: declaration }">{{ declaration === 1 ? (modelValue.originalType === 2 ? '原创，禁止转载' : '内容原创') : declaration === 3 ? '内容转载' : '无需声明' }}</span><i class="fas fa-chevron-right setting-arrow"></i></button>
    <button type="button" class="publish-setting-row goods-row" :class="{ selected: modelValue.extraUrl }" @click="showGoods = true"><i class="fas fa-shopping-bag setting-icon"></i><span class="setting-title">好物</span><span class="setting-value" :class="{ selected: modelValue.extraUrl }">{{ goodsTitle || (modelValue.extraUrl ? '已附加商品' : '添加商品') }}</span><i class="fas fa-chevron-right setting-arrow"></i></button>
    <button v-if="modelValue.extraUrl" type="button" class="remove-goods" @click="removeGoods">移除商品</button>
    <button v-if="dyhs.length || modelValue.dyhId || error" type="button" class="publish-setting-row dyh-row" :class="{ selected: modelValue.dyhId }" @click="showDyh = true"><i class="far fa-newspaper setting-icon"></i><span class="setting-title">订阅号</span><span class="setting-value" :class="{ selected: modelValue.dyhId }">{{ dyhs.find(item => String(item.id) === modelValue.dyhId)?.title || (modelValue.dyhId ? '已选择订阅号' : '不发布到订阅号') }}</span><i class="fas fa-chevron-right setting-arrow"></i></button>
    <p v-if="goodsError" role="alert" class="extras-error">{{ goodsError }} <button type="button" :disabled="preparingGoods" @click="retryGoods">重试</button></p>
    <p v-if="error" role="alert" class="extras-error">{{ error }} <button type="button" @click="loadDyhs(true)">重试</button></p>
    <PublishOptionSheet :is-open="showDeclaration" title="内容声明" presentation="bottom" @close="showDeclaration = false">
      <button v-for="choice in declarations" :key="choice.value" type="button" class="publish-choice" :class="{ 'is-selected': declaration === choice.value }" @click="update({ originalType: choice.value })"><span>{{ choice.title }}</span><i :class="declaration === choice.value ? 'fas fa-check-circle' : 'far fa-circle'"></i></button>
      <label v-if="declaration === 1" class="repost-choice"><input type="checkbox" :checked="modelValue.originalType === 2" @change="setRepost" />未经允许，禁止转载</label>
      <template #footer><button type="button" class="publish-confirm" @click="showDeclaration = false">确定</button></template>
    </PublishOptionSheet>
    <PublishOptionSheet :is-open="showDyh" title="发布到订阅号" @close="showDyh = false">
      <button type="button" class="publish-choice" @click="chooseDyh('')">不发布到订阅号<i :class="!modelValue.dyhId ? 'fas fa-check-circle' : 'far fa-circle'"></i></button>
      <button v-for="dyh in dyhs" :key="dyh.id" type="button" class="publish-choice" :class="{ 'is-selected': modelValue.dyhId === String(dyh.id) }" @click="chooseDyh(String(dyh.id))">{{ dyh.title }}<i :class="modelValue.dyhId === String(dyh.id) ? 'fas fa-check-circle' : 'far fa-circle'"></i></button>
      <p v-if="loading" class="publish-picker-state">正在读取可编辑订阅号…</p><p v-else-if="!dyhs.length" class="publish-picker-state">暂无可编辑订阅号</p><button v-if="hasMoreDyhs && !loading" type="button" class="publish-picker-more" @click="loadDyhs(false)">更多订阅号</button>
    </PublishOptionSheet>
    <GoodsSearchPickerDialog :is-open="showGoods" title="选择动态附加商品" :busy="preparingGoods" :error="goodsError" @close="showGoods = false" @pick="chooseGoods" @retry="retryGoods" />
  </section>
</template>
<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue';
import type { PublishOptions } from '../../types/publish';
import { CoolapkTauriAPI } from '../../api/coolapk';
import PublishOptionSheet from './PublishOptionSheet.vue';
import '../../styles/publish.css';
import GoodsSearchPickerDialog from '../goods/GoodsSearchPickerDialog.vue';
const props = defineProps<{ uid: string; modelValue: PublishOptions; attachmentTitle?: string }>();
const emit = defineEmits<{ 'update:modelValue': [options: PublishOptions]; 'attachment-title': [title: string] }>();
const declaration = computed(() => props.modelValue.originalType === 2 ? 1 : props.modelValue.originalType || 0);
const showGoods = ref(false);
const showDeclaration = ref(false);
const showDyh = ref(false);
const declarations = [{ value: 0, title: '无需声明' }, { value: 1, title: '内容原创' }, { value: 3, title: '内容转载' }] as const;
const goodsTitle = ref(props.attachmentTitle || '');
const dyhs = ref<{ id: string; title: string }[]>([]);
const loading = ref(false);
const error = ref('');
const goodsError = ref('');
const preparingGoods = ref(false);
let lastGoods: any = null;
let goodsRevision = 0;
const hasMoreDyhs = ref(false);
let page = 0;
let revision = 0;
function update(options: Partial<PublishOptions>) { emit('update:modelValue', { ...props.modelValue, ...options }); }
function setRepost(event: Event) { update({ originalType: (event.target as HTMLInputElement).checked ? 2 : 1 }); }
function chooseDyh(id: string) { update({ dyhId: id }); showDyh.value = false; }
function removeGoods() { goodsTitle.value = ''; emit('attachment-title', ''); update({ extraUrl: '' }); }
async function chooseGoods(goods: any) {
  if (preparingGoods.value) return;
  const request = ++goodsRevision;
  lastGoods = goods;
  goodsError.value = '';
  preparingGoods.value = true;
  try {
    // pear_goods 的 ID 属于商城；按官方流程用 goods_url 转为酷安 FeedGoods。
    let item = goods;
    if (goods.entityType === 'pear_goods' || (!goods.url && goods.goods_url)) {
      const url = String(goods.goods_url || '').trim();
      if (!url) throw new Error('商品缺少商城链接，请换一个商品');
      const response = await CoolapkTauriAPI.prepareGoodsByUrl(url);
      if (response?.code !== 200) throw new Error(response?.message || '添加商品失败');
      item = response.data;
    } else if (!goods.url) {
      const id = String(goods.id || goods.entityId || '');
      if (!id) throw new Error('商品信息不完整，请换一个商品');
      const response = await CoolapkTauriAPI.getGoodsDetail(id);
      if (response?.code !== 200) throw new Error(response?.message || '读取商品详情失败');
      item = response.data;
    }
    if (request !== goodsRevision) return;
    if (!item?.url) throw new Error('商品缺少可附加的链接，请换一个商品');
    goodsTitle.value = item.goods_title || item.title || goods.goods_title || goods.title || '已附加商品';
    emit('attachment-title', goodsTitle.value);
    update({ extraUrl: String(item.url) });
    showGoods.value = false;
  } catch (failure) { if (request === goodsRevision) goodsError.value = failure instanceof Error ? failure.message : String(failure); }
  finally { if (request === goodsRevision) preparingGoods.value = false; }
}
function retryGoods() { if (lastGoods) void chooseGoods(lastGoods); else showGoods.value = true; }
async function loadDyhs(reset: boolean) {
  const request = ++revision;
  const next = reset ? 1 : page + 1;
  loading.value = true;
  error.value = '';
  try {
    const response = await CoolapkTauriAPI.getMyDyhEditorList(next);
    if (request !== revision) return;
    if (response?.code !== 200) throw new Error(response?.message || '读取可编辑订阅号失败');
    const items = (Array.isArray(response.data) ? response.data : []).filter((item: any) => item.id && item.title);
    const previous = reset ? [] : dyhs.value;
    dyhs.value = [...new Map([...previous, ...items].map((item) => [String(item.id), item])).values()];
    hasMoreDyhs.value = items.length > 0 && (reset || dyhs.value.length > previous.length);
    page = next;
  } catch (failure) { if (request === revision) error.value = failure instanceof Error ? failure.message : String(failure); }
  finally { if (request === revision) loading.value = false; }
}
watch(() => props.uid, () => { ++goodsRevision; preparingGoods.value = false; goodsError.value = ''; lastGoods = null; showGoods.value = false; dyhs.value = []; void loadDyhs(true); }, { immediate: true });
watch(() => props.attachmentTitle, (value) => { goodsTitle.value = value || ''; });
defineExpose({ openGoods: () => { showGoods.value = true; }, openDeclaration: () => { showDeclaration.value = true; }, openDyh: () => { showDyh.value = true; }, hasDyhs: computed(() => !!(dyhs.value.length || props.modelValue.dyhId || error.value)) });
onBeforeUnmount(() => { ++goodsRevision; ++revision; });
</script>
<style scoped>
.repost-choice { display: flex; gap: 10px; padding: 18px 4px; color: var(--text-secondary); font-size: 13px; }
.repost-choice input { accent-color: var(--brand-primary); }
.remove-goods { display: block; margin-left: auto; padding: 6px 0; color: var(--text-tertiary); font-size: 12px; }
.extras-error { font-size: 12px; color: var(--text-secondary); }
.extras-error button { color: var(--brand-primary); }
</style>

<style scoped>
/* 正文仅展示已选附件；入口放在工具栏与更多网格中。 */
.publish-extras { display: flex; flex-wrap: wrap; gap: 8px; }
.declaration-row:not(.selected), .goods-row:not(.selected), .dyh-row:not(.selected) { display: none; }
.publish-extras .publish-setting-row { width: auto; min-height: 32px; height: auto; padding: 6px 10px; border: 1px solid var(--border-light); border-radius: 8px; gap: 8px; font-size: 12px; }
.publish-extras .publish-setting-row > .setting-title, .publish-extras .setting-arrow { display: none; }
.publish-extras .publish-setting-row > .setting-value { max-width: 220px; font-size: 12px; }
.remove-goods { margin: 0; padding: 6px; }
.extras-error { width: 100%; }
</style>
