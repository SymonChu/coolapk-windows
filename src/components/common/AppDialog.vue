<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="isOpen" class="dialog-backdrop" @click="handleBackdropClick"></div>
    </Transition>
    <Transition name="scale-dialog">
      <div v-if="isOpen" class="dialog-wrapper">
        <div class="dialog-container" :class="dialogClass" :style="{ width: `${width}px` }">
          <div v-if="title" class="dialog-header">
            <slot name="header">
            <h3 class="dialog-title">{{ title }}</h3>
            <button class="dialog-close" aria-label="关闭" @click="close">
              <i class="fas fa-times"></i>
            </button>
            </slot>
          </div>
          <div class="dialog-body custom-scrollbar">
            <slot></slot>
          </div>
          <div v-if="$slots.footer" class="dialog-footer">
            <slot name="footer"></slot>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { onActivated, onDeactivated, onMounted, onUnmounted } from 'vue';
import { useAndroidBackButton } from '../../utils/androidBackButton';

const props = withDefaults(
  defineProps<{
    isOpen: boolean;
    title?: string;
    dialogClass?: string;
    width?: number;
    closeOnBackdrop?: boolean;
  }>(),
  {
    title: '',
    width: 600,
    closeOnBackdrop: true
  }
);

const emit = defineEmits<{
  (e: 'close'): void;
}>();

function close() {
  emit('close');
}

function handleBackdropClick() {
  if (props.closeOnBackdrop) {
    close();
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (props.isOpen && e.key === 'Escape') {
    close();
  }
}

useAndroidBackButton(() => props.isOpen, close);

function bindGlobalListeners() {
  window.addEventListener('keydown', handleKeydown);
}

function unbindGlobalListeners() {
  window.removeEventListener('keydown', handleKeydown);
}

onMounted(bindGlobalListeners);
onActivated(bindGlobalListeners);
onDeactivated(unbindGlobalListeners);
onUnmounted(unbindGlobalListeners);
</script>

<style scoped>
.dialog-backdrop {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.45);
  z-index: 2000;
  backdrop-filter: blur(4px);
}

.dialog-wrapper {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2001;
  pointer-events: none;
}

.dialog-container {
  pointer-events: auto;
  background-color: var(--surface);
  border-radius: var(--radius-dialog);
  box-shadow: var(--shadow-dialog);
  border: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  max-width: calc(100vw - 32px);
  /* 软键盘弹出时 85vh 仍然按布局视口算，这里再按可视高度夹一次。 */
  max-height: min(85vh, calc(var(--app-viewport-height, 100vh) - 32px));
  overflow: hidden;
}

.dialog-header {
  height: 56px;
  padding: 0 var(--space-5);
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--border-light);
}

.dialog-title {
  font-size: var(--font-size-title-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
}

.dialog-close {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-control);
  color: var(--text-secondary);
  transition: all var(--duration-fast) var(--ease-default);
}

.dialog-close:hover {
  background-color: var(--surface-hover);
  color: var(--text-primary);
}

/* 触摸端关闭按钮是唯一的可见出口，抬到 44x44 命中区。 */
@media (pointer: coarse) {
  .dialog-close {
    width: 44px;
    height: 44px;
    margin-right: -6px;
  }
}

.dialog-body {
  padding: var(--space-5);
  overflow-y: auto;
  flex: 1;
}

.dialog-footer {
  padding: var(--space-4) var(--space-5);
  border-top: 1px solid var(--border-light);
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-3);
  background-color: var(--background-secondary);
}
</style>
