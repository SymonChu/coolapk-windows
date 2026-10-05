<template>
  <div class="equipment-content" @click="handleAnchorClick">
    <section class="equipment-summary">
      <div class="equipment-user">
        <AppImage class="equipment-avatar" :src="data.avatar" :alt="data.username" />
        <strong>{{ data.username }}</strong>
      </div>
      <div class="equipment-stats">
        <div v-for="stat in data.stats" :key="stat.label" class="equipment-stat">
          <span>{{ stat.label }}</span><strong>{{ stat.value }}</strong>
        </div>
      </div>
      <div v-if="data.recent.length" class="equipment-recent">
        <div v-for="item in data.recent" :key="item.name" class="equipment-recent-item">
          <AppImage class="equipment-image" :src="item.image" :alt="item.name" fit="contain" />
          <span>{{ item.name }}</span>
        </div>
      </div>
    </section>
    <div class="equipment-categories">
      <section v-for="category in data.categories" :key="category.name" class="equipment-category">
        <h3>{{ category.name }}</h3>
        <div v-for="item in category.items" :key="item.url || item.name" class="equipment-row">
          <a v-if="item.url" :href="item.url" class="equipment-product">
            <AppImage class="equipment-image" :src="item.image" :alt="item.name" fit="contain" />
            <span>{{ item.name }}</span>
          </a>
          <span v-else class="equipment-product">{{ item.name }}</span>
          <div v-if="item.ratingLabel || item.rating" class="equipment-rating">
            <span>{{ item.ratingLabel }}</span><strong v-if="item.rating">{{ item.rating }}</strong>
          </div>
        </div>
      </section>
    </div>
    <EmptyState v-if="!data.categories.length" title="暂无装备" />
    <div v-if="data.actions.length" class="equipment-actions">
      <AppButton v-for="action in data.actions" :key="action.url" variant="secondary" :disabled="opening" @click="emit('open-action', action.url)">
        {{ action.label }}
      </AppButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { EquipmentPageData } from '../../utils/equipmentPage';
import { handleAnchorClick } from '../../utils/anchorClick';
import AppImage from '../common/AppImage.vue';
import AppButton from '../common/AppButton.vue';
import EmptyState from '../common/EmptyState.vue';

defineProps<{ data: EquipmentPageData; opening?: boolean }>();
const emit = defineEmits<{ 'open-action': [url: string] }>();
</script>

<style scoped>
.equipment-content { display: grid; gap: var(--space-4); }
.equipment-summary, .equipment-category { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-card); padding: var(--space-4); }
.equipment-user, .equipment-product, .equipment-recent-item { display: flex; align-items: center; gap: var(--space-3); min-width: 0; }
.equipment-avatar { width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0; }
.equipment-stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--space-2); margin-top: var(--space-4); }
.equipment-stat { display: flex; flex-direction: column; gap: var(--space-1); background: var(--surface-hover); border-radius: var(--radius-card); padding: var(--space-3); font-size: var(--font-size-caption); }
.equipment-stat strong, .equipment-rating strong { color: var(--brand-primary); font-size: var(--font-size-body); }
.equipment-recent { display: grid; gap: var(--space-3); margin-top: var(--space-4); }
.equipment-image { width: 48px; height: 48px; border-radius: 8px; flex-shrink: 0; }
.equipment-categories { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr)); gap: var(--space-4); align-items: start; }
.equipment-category h3 { margin: 0 0 var(--space-3); font-size: var(--font-size-body); }
.equipment-row { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); padding: var(--space-3) 0; }
.equipment-row + .equipment-row { border-top: 1px solid var(--border); }
.equipment-product { color: var(--text-primary); text-decoration: none; overflow-wrap: anywhere; }
.equipment-product:hover { color: var(--brand-primary); }
.equipment-rating { display: flex; flex-direction: column; align-items: center; gap: var(--space-1); color: var(--text-secondary); font-size: var(--font-size-caption); flex-shrink: 0; }
.equipment-actions { display: flex; flex-wrap: wrap; justify-content: center; gap: var(--space-3); }
@media (max-width: 600px) {
  .equipment-categories { grid-template-columns: 1fr; }
  .equipment-stat { padding: var(--space-2); }
}
</style>
