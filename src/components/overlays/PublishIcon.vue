<template><span class="publish-icon" :style="{ '--publish-icon': `url(&quot;${icons[name]}&quot;)` }" aria-hidden="true"></span></template>
<script setup lang="ts">
import emotion from '../../assets/icons/publish/emotion.svg';
import photo from '../../assets/icons/publish/photo.svg';
import mention from '../../assets/icons/publish/mention.svg';
import topic from '../../assets/icons/publish/topic.svg';
import app from '../../assets/icons/publish/app.svg';
import goods from '../../assets/icons/publish/goods.svg';
import more from '../../assets/icons/publish/more.svg';
import close from '../../assets/icons/publish/close.png';
import back from '../../assets/icons/publish/back.png';
import add from '../../assets/icons/publish/add.png';
import eye from '../../assets/icons/publish/eye.png';
// 使用 APK 原始路径和透明图形，跟随主题统一着色；来源记录见图标目录 sources.json。
// 内联 SVG 含有裁剪路径的括号，CSS url 必须带引号，否则遮罩失效并显示实心方块。
const icons = { emotion, photo, mention, topic, app, goods, more, close, back, add, eye };
defineProps<{ name: keyof typeof icons }>();
</script>
<style scoped>
.publish-icon { display: inline-block; width: 24px; height: 24px; flex-shrink: 0; background: currentColor; mask: var(--publish-icon) center / contain no-repeat; -webkit-mask: var(--publish-icon) center / contain no-repeat; }
</style>
