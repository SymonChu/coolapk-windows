<template>
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <template v-if="name === 'write'">
      <path d="M4 16.5 3.5 20l3.5-.5L19 7a2.1 2.1 0 0 0-3-3L4 16.5ZM14.5 5.5l3 3M3 23h17" />
    </template>
    <template v-else-if="name === 'comment'">
      <path d="M21 12a9 9 0 1 0-9 9h6a3 3 0 0 0 3-3v-6Z" />
      <path d="M7 9h10M7 14h7" />
    </template>
    <path v-else-if="name === 'like'" :fill="active ? 'currentColor' : 'none'" d="M9 21H4V10h5m0 11h9a2 2 0 0 0 2-1.7l1-8a2 2 0 0 0-2-2.3h-6V5a3 3 0 0 0-3-3L9 10v11Z" />
    <path v-else-if="name === 'favorite'" :fill="active ? 'currentColor' : 'none'" d="m12 2 3 6.5 7 1-5 5 .9 7-5.9-3.3L6 21.5l1-7-5-5 7-1L12 2Z" />
    <template v-else>
      <path d="M12 3a9 9 0 1 0 9 9M16 2l5 3-3 5M20 5c-5 0-8 3-8 7" />
    </template>
  </svg>
</template>
<script setup lang="ts">
defineProps<{ name: 'write' | 'comment' | 'like' | 'favorite' | 'share'; active?: boolean }>();
</script>
