/**
 * 设备机型预设：UA 机型（model/build/android）与常用设备显示名映射。
 *
 * 2026-10-08：新增 brand（厂商/品牌）字段。设备码（X-App-Device）的
 * `manufacturer;brand;model;build` 四段以前在 Rust 里写死成 Xiaomi/23113RKC6C，
 * 选了三星/华为等模板就与 UA 自相矛盾（用户反馈「自定义设备信息好像没有作用」）。
 * 现在品牌与机型一起下发，只在「启用自定义设备信息」时生效。
 *
 * 型号代码来源：khwang9883/MobileModels（型号汇总）与各厂商官网参数页，均为国行型号。
 * Build 号沿用同一串 Android 16 通用构建号（与既有预设保持一致，不逐机型伪造）。
 */

export interface DevicePreset {
  /** 预设展示名 */
  label: string;
  /** 匹配 UserPage 动态 deviceTitle 的别名（常用设备一键应用） */
  aliases: string[];
  /** UA 内嵌机型代码，如 23113RKC6C（小米 14） */
  model: string;
  /** 厂商 / 品牌：写入设备码的 manufacturer;brand 两段 */
  brand: string;
  androidVersion: string;
  build: string;
}

const BUILD_ANDROID_16 = 'AQ3A.250226.002';

export const DEVICE_PRESETS: DevicePreset[] = [
  // ── 2026 年最新旗舰（2026-10-08 新增）───────────────────────────────
  {
    label: '小米 17 Pro Max',
    aliases: ['小米17 Pro Max', '小米 17 Pro Max', 'Xiaomi 17 Pro Max', '2509FPN0BC'],
    model: '2509FPN0BC',
    brand: 'Xiaomi',
    androidVersion: '16',
    build: BUILD_ANDROID_16,
  },
  {
    label: '小米 17 Pro',
    aliases: ['小米17 Pro', '小米 17 Pro', 'Xiaomi 17 Pro', '25098PN5AC'],
    model: '25098PN5AC',
    brand: 'Xiaomi',
    androidVersion: '16',
    build: BUILD_ANDROID_16,
  },
  {
    label: '小米 17',
    aliases: ['小米17', '小米 17', 'Xiaomi 17', '25113PN0EC'],
    model: '25113PN0EC',
    brand: 'Xiaomi',
    androidVersion: '16',
    build: BUILD_ANDROID_16,
  },
  {
    label: 'Redmi K90 Pro Max',
    aliases: ['Redmi K90 Pro Max', '红米K90 Pro Max', 'REDMI K90 Pro Max', '25102RKBEC'],
    model: '25102RKBEC',
    brand: 'Redmi',
    androidVersion: '16',
    build: BUILD_ANDROID_16,
  },
  {
    label: '三星 Galaxy S26 Ultra',
    aliases: ['三星Galaxy S26 Ultra', '三星 Galaxy S26 Ultra', 'Galaxy S26 Ultra', 'SM-S9480'],
    model: 'SM-S9480',
    brand: 'samsung',
    androidVersion: '16',
    build: BUILD_ANDROID_16,
  },
  {
    label: 'OPPO Find X9 Pro',
    aliases: ['OPPO Find X9 Pro', 'Find X9 Pro', 'PLG110'],
    model: 'PLG110',
    brand: 'OPPO',
    androidVersion: '16',
    build: BUILD_ANDROID_16,
  },
  {
    label: 'vivo X300 Pro',
    aliases: ['vivo X300 Pro', 'vivoX300 Pro', 'X300 Pro', 'V2502A'],
    model: 'V2502A',
    brand: 'vivo',
    androidVersion: '16',
    build: BUILD_ANDROID_16,
  },
  {
    label: '一加 15',
    aliases: ['一加15', '一加 15', 'OnePlus 15', 'PLK110'],
    model: 'PLK110',
    brand: 'OnePlus',
    androidVersion: '16',
    build: BUILD_ANDROID_16,
  },
  {
    label: '荣耀 Magic8 Pro',
    aliases: ['荣耀Magic8 Pro', '荣耀 Magic8 Pro', 'Magic8 Pro', 'Magic 8 Pro', 'BKQ-AN10'],
    model: 'BKQ-AN10',
    brand: 'HONOR',
    androidVersion: '16',
    build: BUILD_ANDROID_16,
  },
  {
    label: '华为 Mate 80 Pro',
    aliases: ['华为Mate 80 Pro', '华为 Mate 80 Pro', 'Mate 80 Pro', 'SGT-AL00'],
    model: 'SGT-AL00',
    brand: 'HUAWEI',
    androidVersion: '14',
    build: BUILD_ANDROID_16,
  },
  {
    label: 'Google Pixel 10 Pro',
    aliases: ['Pixel 10 Pro', 'Google Pixel 10 Pro', 'Pixel 10', 'blazer'],
    model: 'blazer',
    brand: 'Google',
    androidVersion: '16',
    build: BUILD_ANDROID_16,
  },

  // ── 早期机型（2024–2025）──────────────────────────────────────────
  {
    label: '小米 14',
    aliases: ['小米14', '小米 14', 'Xiaomi 14', '小米14 Pro', '小米 14 Pro', '23113RKC6C'],
    model: '23113RKC6C',
    brand: 'Xiaomi',
    androidVersion: '16',
    build: BUILD_ANDROID_16,
  },
  {
    label: '小米 13 Pro',
    aliases: ['小米13 Pro', '小米 13 Pro', 'Xiaomi 13 Pro', '2211133C'],
    model: '2211133C',
    brand: 'Xiaomi',
    androidVersion: '15',
    build: BUILD_ANDROID_16,
  },
  {
    label: '小米 15 Pro',
    aliases: ['小米15 Pro', '小米 15 Pro', 'Xiaomi 15 Pro', '25019PN48C'],
    model: '25019PN48C',
    brand: 'Xiaomi',
    androidVersion: '16',
    build: BUILD_ANDROID_16,
  },
  {
    label: 'Redmi K50 电竞版',
    aliases: ['Redmi K50 电竞版', '红米K50电竞版', 'Redmi K50 Gaming', '22041211AC'],
    model: '22041211AC',
    brand: 'Redmi',
    androidVersion: '15',
    build: BUILD_ANDROID_16,
  },
  {
    label: 'Redmi K80 Pro',
    aliases: ['Redmi K80 Pro', '红米K80 Pro', '24122RKC7C'],
    model: '24122RKC7C',
    brand: 'Redmi',
    androidVersion: '15',
    build: BUILD_ANDROID_16,
  },
  {
    label: 'Redmi K80',
    aliases: ['Redmi K80', '红米K80', '24117RK2CC'],
    model: '24117RK2CC',
    brand: 'Redmi',
    androidVersion: '15',
    build: BUILD_ANDROID_16,
  },
  {
    label: '三星 Galaxy S24 Ultra',
    aliases: ['三星Galaxy S24 Ultra', '三星 Galaxy S24 Ultra', 'Galaxy S24 Ultra', 'SM-S9280'],
    model: 'SM-S9280',
    brand: 'samsung',
    androidVersion: '15',
    build: BUILD_ANDROID_16,
  },
  {
    label: '三星 Galaxy S25 Ultra',
    aliases: ['三星Galaxy S25 Ultra', '三星 Galaxy S25 Ultra', 'Galaxy S25 Ultra', 'SM-S9380'],
    model: 'SM-S9380',
    brand: 'samsung',
    androidVersion: '16',
    build: BUILD_ANDROID_16,
  },
  {
    label: '一加 13',
    aliases: ['一加13', '一加 13', 'OnePlus 13', 'PJZ110'],
    model: 'PJZ110',
    brand: 'OnePlus',
    androidVersion: '16',
    build: BUILD_ANDROID_16,
  },
  {
    label: 'OPPO Find X8',
    aliases: ['OPPO Find X8', 'OPPO Find X8 Pro', 'Find X8', 'PKB110'],
    model: 'PKB110',
    brand: 'OPPO',
    androidVersion: '15',
    build: BUILD_ANDROID_16,
  },
  {
    label: 'vivo X200 Pro',
    aliases: ['vivo X200 Pro', 'vivoX200 Pro', 'X200 Pro', 'V2405A'],
    model: 'V2405A',
    brand: 'vivo',
    androidVersion: '16',
    build: BUILD_ANDROID_16,
  },
  {
    label: '华为 Mate 70 Pro',
    aliases: ['华为Mate 70 Pro', '华为 Mate 70 Pro', 'Mate 70 Pro', 'HBP-AL00'],
    model: 'HBP-AL00',
    brand: 'HUAWEI',
    androidVersion: '14',
    build: BUILD_ANDROID_16,
  },
  {
    label: 'Google Pixel 9 Pro',
    aliases: ['Pixel 9 Pro', 'Google Pixel 9 Pro', 'Pixel 9', 'comet'],
    model: 'comet',
    brand: 'Google',
    androidVersion: '16',
    build: BUILD_ANDROID_16,
  },
];

/** 用常用设备显示名（动态 deviceTitle）匹配预设，匹配不到返回 undefined */
export function findPresetByDeviceTitle(title: string): DevicePreset | undefined {
  const t = (title || '').trim();
  if (!t) return undefined;
  return DEVICE_PRESETS.find((p) =>
    p.aliases.some((a) => a.toLowerCase() === t.toLowerCase() || t.toLowerCase().includes(a.toLowerCase()))
  );
}
