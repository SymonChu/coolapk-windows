<template>
  <div class="brand-area" :class="{ 'is-collapsed': collapsed }" data-tauri-drag-region>
    <!--
      顶栏左上角品牌块：酷安 logo + 「酷安」。
      2026-10-07 界面稿 v4 复审：账号入口（头像 + 资料浮层）挪回顶栏右上角
      （AccountEntry.vue），左上角固定只显示 logo 与名称，不再随登录状态变化。
      左栏收起或窗口变窄时只留 logo。macOS Overlay 模式下由 TopBar 隐藏整块
      （原生红黄绿按钮占用左侧）。
    -->
    <img
      class="brand-logo"
      src="../../assets/coolapk-logo-rounded.png"
      alt=""
      draggable="false"
      data-tauri-drag-region
    />
    <span class="brand-name" data-tauri-drag-region>酷安</span>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ collapsed?: boolean }>(), { collapsed: false });
</script>

<style scoped>
.brand-area {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  padding-left: 20px;
  color: var(--text-primary);
}

.brand-logo {
  width: 30px;
  height: 30px;
  flex: 0 0 auto;
  border-radius: 8px;
  user-select: none;
  -webkit-user-drag: none;
}

.brand-name {
  overflow: hidden;
  font-size: 16px;
  font-weight: var(--font-weight-bold);
  letter-spacing: -0.3px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 侧栏收起：只留 logo */
.brand-area.is-collapsed {
  padding-left: 13px;
}

.brand-area.is-collapsed .brand-name {
  display: none;
}
</style>
