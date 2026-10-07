<template>
  <!--
    悬浮发布按钮（界面稿 v4）：默认停在内容区底部中间，毛玻璃质感。
    桌面端显示；手机端由 MobileBottomNav 的发布按钮承担，这里隐藏。
  -->
  <button
    type="button"
    class="publish-fab"
    title="发布动态"
    aria-label="发布动态"
    @click="appStore.openPublish()"
  >
    <i class="fas fa-plus publish-fab-icon"></i>
    <span class="publish-fab-label">发布动态</span>
  </button>
</template>

<script setup lang="ts">
import { useAppStore } from '../../stores/app';

const appStore = useAppStore();
</script>

<style scoped>
.publish-fab {
  position: absolute;
  left: 50%;
  bottom: 26px;
  transform: translateX(-50%);
  z-index: 60;

  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 46px;
  padding: 0 22px;

  border: 1px solid rgba(255, 255, 255, 0.45);
  border-radius: 23px;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;

  /* 毛玻璃：半透明品牌绿 + 背后模糊 */
  background-color: rgba(47, 160, 111, 0.72);
  background-color: color-mix(in srgb, var(--brand-primary) 70%, transparent);
  -webkit-backdrop-filter: blur(14px) saturate(170%);
  backdrop-filter: blur(14px) saturate(170%);
  box-shadow: 0 10px 26px rgba(15, 23, 42, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.4);
  transition:
    transform var(--duration-fast) var(--ease-default),
    background-color var(--duration-fast) var(--ease-default),
    box-shadow var(--duration-fast) var(--ease-default);
}

.publish-fab:hover {
  transform: translateX(-50%) translateY(-2px);
  background-color: color-mix(in srgb, var(--brand-hover, var(--brand-primary)) 80%, transparent);
  box-shadow: 0 14px 32px rgba(15, 23, 42, 0.26), inset 0 1px 0 rgba(255, 255, 255, 0.5);
}

.publish-fab:active {
  transform: translateX(-50%) scale(0.97);
}

.publish-fab:focus-visible {
  outline: 2px solid var(--brand-primary);
  outline-offset: 3px;
}

.publish-fab-icon {
  font-size: 16px;
  line-height: 1;
}
</style>
