<template>
  <section class="official-product-card">
    <button class="product-summary" @click="$emit('open', target)"><AppImage :src="getFeedRelationImage(target)" fit="contain" class="product-logo" /><span class="product-copy"><span><small>{{ target.productTypeName || '数码' }}</small>{{ getFeedRelationTitle(target) }}</span><em>{{ getFeedRelationSubtitle(target) }}</em></span><span v-if="score" class="product-score"><strong>{{ score }}</strong><span aria-hidden="true"><i v-for="n in 5" :key="n" class="fas fa-star" :class="{ filled: n <= Math.round(Number(score) / 2) }"></i></span></span></button>
    <div class="product-actions"><button :disabled="pending" @click="toggleFollow">{{ following ? '已关注' : '关注' }}</button><button @click="publish">我也发一条</button></div>
  </section>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import AppImage from '../common/AppImage.vue';
import { getFeedRelationImage, getFeedRelationTitle, getFeedRelationSubtitle } from '../../utils/feedRelations';
import { getDigitalProductRating } from '../../utils/digitalProduct';
import { CoolapkTauriAPI } from '../../api/coolapk';
import { useAuthStore } from '../../stores/auth';
import { useAppStore } from '../../stores/app';
import { showToast } from '../../utils/toast';
import { getErrorMessage } from '../../utils/errors';
const props = defineProps<{ target: Record<string, any> }>();
defineEmits<{ open: [target: Record<string, any>] }>();
const auth = useAuthStore(); const app = useAppStore();
const score = computed(() => getDigitalProductRating(props.target));
const following = ref(Number(props.target.isFollow || props.target.userAction?.follow) === 1);
const pending = ref(false);
watch(() => [props.target.id, props.target.isFollow, props.target.userAction?.follow], () => { following.value = Number(props.target.isFollow || props.target.userAction?.follow) === 1; });
async function toggleFollow() {
  if (!auth.isLoggedIn) { auth.openLoginModal(); return; }
  if (pending.value) return;
  pending.value = true;
  try { await CoolapkTauriAPI.changeProductFollowStatus(String(props.target.id || props.target.entityId), following.value ? 0 : 1); following.value = !following.value; }
  catch (error) { showToast(getErrorMessage(error, '关注数码失败'), 'error'); }
  finally { pending.value = false; }
}
function publish() { if (!auth.isLoggedIn) { auth.openLoginModal(); return; } app.openPublish(`#${getFeedRelationTitle(props.target)}# `); }
</script>
<style scoped>
.official-product-card { margin: 32px 0 12px; padding: 12px; border-radius: 9px; background: var(--surface-hover); }
.product-summary { display: flex; align-items: center; gap: 10px; width: 100%; padding: 0; border: 0; background: transparent; color: var(--text-primary); text-align: left; }
.product-logo { width: 42px; height: 48px; flex: 0 0 42px; }
.product-copy { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px; }
.product-copy > span { font-size: 16px; overflow-wrap: anywhere; }
.product-copy small { display: inline-block; color: var(--brand-primary); border: 1px solid var(--brand-primary); border-radius: 3px; margin-right: 6px; padding: 0 3px; font-size: 11px; }
.product-copy em { color: var(--text-secondary); font-style: normal; font-size: 12px; }
.product-score { display: flex; flex-direction: column; align-items: center; gap: 5px; }
.product-score strong { font-size: 24px; }
.product-score i { font-size: 9px; padding: 2px; margin: 1px; border-radius: 2px; background: var(--text-tertiary); color: white; }
.product-score i.filled { background: #ffb500; }
.product-actions { display: flex; gap: 12px; margin-top: 16px; }
.product-actions button { flex: 1; min-height: 32px; border: 1px solid var(--brand-primary); border-radius: 6px; background: transparent; color: var(--brand-primary); font: inherit; font-size: 14px; }
.product-actions button:last-child { background: var(--brand-soft); border-color: transparent; }
</style>
