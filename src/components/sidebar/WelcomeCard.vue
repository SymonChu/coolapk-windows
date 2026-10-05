<template>
  <div v-if="!authStore.isLoggedIn" class="sidebar-card welcome-card">
    <strong class="welcome-title">欢迎来到酷安</strong>
    <p class="welcome-desc">发现好应用，聊聊新数码，分享生活里的小惊喜。</p>
    <button type="button" class="welcome-login" @click="authStore.openLoginModal()">
      登录，加入讨论 →
    </button>
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '../../stores/auth';

const authStore = useAuthStore();
</script>

<style scoped>
.sidebar-card {
  background-color: var(--surface);
  border-radius: var(--radius-card);
  border: 1px solid var(--border);
  padding: var(--space-4);
  margin-bottom: var(--space-4);
  overflow: hidden;
  min-width: 0;
}

.welcome-title {
  display: block;
  color: var(--text-primary);
  font-size: 17px;
  line-height: 22px;
  font-weight: 700;
}

.welcome-desc {
  margin: 6px 0 10px;
  color: var(--text-tertiary);
  font-size: 12.5px;
  line-height: 19px;
}

.welcome-login {
  border: 0;
  background: transparent;
  padding: 0;
  color: var(--brand-primary);
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
}

.welcome-login:hover {
  text-decoration: underline;
}
</style>
