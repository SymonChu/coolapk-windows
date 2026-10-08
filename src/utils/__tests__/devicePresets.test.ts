import { describe, expect, it } from 'vitest';

import { DEVICE_PRESETS, findPresetByDeviceTitle } from '../devicePresets';

/**
 * 2026-10-08：机型预设加上了 brand（厂商/品牌），并补了 2026 年最新旗舰。
 * 品牌与机型会一起写进设备码（X-App-Device）的 `manufacturer;brand;model;build` 四段，
 * 所以这里把「不能有分号、不能重复机型」这类会直接破坏设备码的约束钉住。
 */
describe('设备机型预设', () => {
  it('每项机型/品牌/系统版本都有值，机型不重复，且不含会破坏设备码结构的分号', () => {
    const models = DEVICE_PRESETS.map((preset) => preset.model);
    expect(new Set(models).size).toBe(models.length);

    for (const preset of DEVICE_PRESETS) {
      expect(preset.model.trim()).not.toBe('');
      expect(preset.brand.trim()).not.toBe('');
      expect(preset.androidVersion.trim()).not.toBe('');
      expect(preset.build.trim()).not.toBe('');
      expect(preset.aliases.length).toBeGreaterThan(0);
      for (const value of [preset.model, preset.brand, preset.build]) {
        expect(value).not.toContain(';');
      }
    }
  });

  it('2026 年最新旗舰都在列表里', () => {
    const models = DEVICE_PRESETS.map((preset) => preset.model);
    for (const model of [
      '2509FPN0BC', // 小米 17 Pro Max
      '25098PN5AC', // 小米 17 Pro
      '25113PN0EC', // 小米 17
      '25102RKBEC', // Redmi K90 Pro Max
      'SM-S9480', // 三星 Galaxy S26 Ultra
      'PLG110', // OPPO Find X9 Pro
      'V2502A', // vivo X300 Pro
      'PLK110', // 一加 15
      'BKQ-AN10', // 荣耀 Magic8 Pro
      'SGT-AL00', // 华为 Mate 80 Pro
      'blazer', // Google Pixel 10 Pro
    ]) {
      expect(models).toContain(model);
    }
  });

  it('品牌与机型对得上（非小米机型不再自称 Xiaomi）', () => {
    const brandOf = (model: string) => DEVICE_PRESETS.find((preset) => preset.model === model)?.brand;
    expect(brandOf('SM-S9480')).toBe('samsung');
    expect(brandOf('SGT-AL00')).toBe('HUAWEI');
    expect(brandOf('PLG110')).toBe('OPPO');
    expect(brandOf('V2502A')).toBe('vivo');
    expect(brandOf('23113RKC6C')).toBe('Xiaomi');
    expect(brandOf('2509FPN0BC')).toBe('Xiaomi');
  });

  it('按机型型号或传播名都能匹配到预设', () => {
    expect(findPresetByDeviceTitle('SM-S9480')?.label).toBe('三星 Galaxy S26 Ultra');
    expect(findPresetByDeviceTitle('小米 17 Pro')?.label).toBe('小米 17 Pro');
    expect(findPresetByDeviceTitle('25102RKBEC')?.label).toBe('Redmi K90 Pro Max');
    expect(findPresetByDeviceTitle('不存在的机型')).toBeUndefined();
  });
});
