import type { Router } from 'vue-router';
import { APP_VERSION } from '../constants/version';
import { CoolapkTauriAPI } from '../api/coolapk';

// 说明：原实现会把反馈作为私信发给上游作者（DEVELOPER_UID/USERNAME）。
// 本项目已改为跳转 GitHub Issues；下面两个常量仅为 MessagesPage 的“是否与开发者会话”判断保留。
export const DEVELOPER_UID = '0';
export const DEVELOPER_USERNAME = 'SymonChu';
export const FEEDBACK_ISSUES_URL = 'https://github.com/SymonChu/coolapk-windows/issues/new';

export function getFeedbackTemplate(): string {
  let osName = 'Windows';
  if (typeof navigator !== 'undefined') {
    const ua = navigator.userAgent;
    // Android UA 同时包含 Linux，必须先识别 Android。
    if (/android/i.test(ua)) {
      osName = 'Android';
    } else if (/iphone|ipad|ipod/i.test(ua)
      || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) {
      osName = 'iOS';
    } else if (ua.includes('Macintosh') || ua.includes('Mac OS')) {
      osName = 'macOS';
    } else if (ua.includes('Linux')) {
      osName = 'Linux';
    } else if (ua.includes('Windows')) {
      osName = 'Windows';
    }
  }

  return `【问题反馈】
- 客户端版本：v${APP_VERSION}
- 操作系统：${osName}
- 问题描述：
- 复现步骤：`;
}

export function openFeedbackMessage(
  _router: Router,
  _authStore?: { isLoggedIn: boolean; openLoginModal?: () => void },
) {
  const url = `${FEEDBACK_ISSUES_URL}?title=${encodeURIComponent('[反馈] ')}&body=${encodeURIComponent(getFeedbackTemplate())}`;
  void CoolapkTauriAPI.openUrl(url, 'system');
}
