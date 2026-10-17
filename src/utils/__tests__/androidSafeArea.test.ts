import { describe, it, expect } from 'vitest';
import source from '../androidSafeArea.ts?raw';

// 安全区兜底链路的关键行为（源码级断言，范例同 HomeTabPanel.doubleColumn.test.ts）：
// 1) 只在 Android Tauri 运行时生效
// 2) 必须把像素值换算成 CSS px 写入 --android-safe-area-top
// 3) DOMContentLoaded 后拉取 + resize/orientationchange 重拉
describe('androidSafeArea 兜底链路', () => {
  it('仅 Android Tauri 下启用', () => {
    expect(source).toMatch(/isTauri\(\) && typeof navigator !== 'undefined' && \/android\/i\.test\(navigator\.userAgent\)/);
  });

  it('写入的 CSS 变量名为 --android-safe-area-top（与 MainActivity 注入一致）', () => {
    expect(source).toContain("setProperty('--android-safe-area-top'");
  });

  it('按 devicePixelRatio 换算像素为 CSS px', () => {
    expect(source).toMatch(/pixels \/ density/);
  });

  it('页面就绪后拉取（DOM ready 分支齐全）并注册重拉事件', () => {
    expect(source).toMatch(/readyState === 'loading'/);
    expect(source).toContain("'DOMContentLoaded'");
    expect(source).toMatch(/addEventListener\('resize'/);
    expect(source).toMatch(/addEventListener\('orientationchange'/);
  });

  it('拉取失败只告警不阻塞启动', () => {
    expect(source).toMatch(/console\.warn\('拉取 Android 顶部安全区失败:'/);
  });

  it('重复调用 setupAndroidSafeArea 只安装一次', () => {
    expect(source).toMatch(/if \(installed/);
  });
});
