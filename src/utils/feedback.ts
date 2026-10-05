import type { Router } from 'vue-router';
import { APP_VERSION } from '../constants/version';

export const DEVELOPER_UID = '1451266';
export const DEVELOPER_USERNAME = 'oxygen的喵';

export function getFeedbackTemplate(): string {
  let osName = 'Windows';
  if (typeof navigator !== 'undefined') {
    const ua = navigator.userAgent;
    // Android UA 同时包含 Linux，必须先识别 Android。
    if (/android/i.test(ua)) {
      osName = 'Android';
    } else if (/iphone|ipad|ipod/i.test(ua)
      || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) {
      // iOS UA 包含 Mac OS；iPad 桌面模式会使用 Macintosh UA。
      osName = 'iOS';
    } else if (ua.includes('Macintosh') || ua.includes('Mac OS')) {
      osName = 'macOS';
    } else if (ua.includes('Linux')) {
      osName = 'Linux';
    } else if (ua.includes('Windows')) {
      osName = 'Windows';
    }
  }

  return `【酷安客户端问题反馈】
- 客户端版本：v${APP_VERSION}
- 操作系统：${osName}
- 问题描述：
- 复现步骤：`;
}

export function openFeedbackMessage(
  router: Router,
  authStore?: { isLoggedIn: boolean; openLoginModal?: () => void },
) {
  if (authStore && !authStore.isLoggedIn) {
    if (typeof authStore.openLoginModal === 'function') {
      authStore.openLoginModal();
    }
    return;
  }

  const initialText = getFeedbackTemplate();
  void router.push({
    path: '/messages',
    query: {
      uid: DEVELOPER_UID,
      username: DEVELOPER_USERNAME,
      initialText,
      feedback: '1',
      open: String(Date.now()),
    },
  });
}
