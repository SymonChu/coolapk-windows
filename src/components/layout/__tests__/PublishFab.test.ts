import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { nextTick } from 'vue';

import PublishFab from '../PublishFab.vue';
import { useAppStore } from '../../../stores/app';
import { useSettingsStore } from '../../../stores/settings';

const PARENT_WIDTH = 800;
const PARENT_HEIGHT = 600;
const FAB_WIDTH = 120;
const FAB_HEIGHT = 46;
const FAB_LEFT = 340;
const FAB_TOP = 500;

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  } as DOMRect;
}

/** jsdom 没有布局：给按钮和它的 offsetParent 手工装上尺寸与坐标。 */
function stubLayout(element: HTMLElement, parent: HTMLElement) {
  Object.defineProperty(element, 'offsetParent', { value: parent, configurable: true });
  Object.defineProperty(element, 'offsetWidth', { value: FAB_WIDTH, configurable: true });
  Object.defineProperty(element, 'offsetHeight', { value: FAB_HEIGHT, configurable: true });
  Object.defineProperty(parent, 'clientWidth', { value: PARENT_WIDTH, configurable: true });
  Object.defineProperty(parent, 'clientHeight', { value: PARENT_HEIGHT, configurable: true });
  element.getBoundingClientRect = () => rect(FAB_LEFT, FAB_TOP, FAB_WIDTH, FAB_HEIGHT);
  parent.getBoundingClientRect = () => rect(0, 0, PARENT_WIDTH, PARENT_HEIGHT);
}

function pointerEvent(type: string, init: { pointerId: number; button?: number; clientX: number; clientY: number }) {
  const event = new Event(type);
  Object.assign(event, init);
  return event;
}

describe('PublishFab（首页悬浮发布按钮）', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('单击（没有拖动）打开发布弹窗', async () => {
    const app = useAppStore();
    const openPublish = vi.spyOn(app, 'openPublish').mockImplementation(() => undefined);
    const wrapper = mount(PublishFab);

    await wrapper.find('.publish-fab').trigger('click');

    expect(openPublish).toHaveBeenCalledTimes(1);
    wrapper.unmount();
  });

  it('拖动后记住坐标，且这次拖动不会触发发布', async () => {
    const app = useAppStore();
    const openPublish = vi.spyOn(app, 'openPublish').mockImplementation(() => undefined);
    const settings = useSettingsStore();
    const wrapper = mount(PublishFab);
    const button = wrapper.find('.publish-fab');
    const parent = document.createElement('div');
    stubLayout(button.element as HTMLElement, parent);

    button.element.dispatchEvent(pointerEvent('pointerdown', { pointerId: 1, button: 0, clientX: 340, clientY: 500 }));
    button.element.dispatchEvent(pointerEvent('pointermove', { pointerId: 1, clientX: 440, clientY: 520 }));
    await nextTick();

    // 拖动过程中只改本地显示，不写设置
    expect(settings.settings.publishFabPosition).toBeNull();
    expect(wrapper.classes()).toContain('is-moved');
    expect((button.element as HTMLElement).style.left).toBe('440px');
    expect((button.element as HTMLElement).style.top).toBe('520px');

    button.element.dispatchEvent(pointerEvent('pointerup', { pointerId: 1, clientX: 440, clientY: 520 }));
    await nextTick();
    expect(settings.settings.publishFabPosition).toEqual({ x: 440, y: 520 });

    // 拖动收尾的那次 click 被吞掉
    await button.trigger('click');
    expect(openPublish).not.toHaveBeenCalled();

    // 之后再单击仍然正常发布
    await button.trigger('click');
    expect(openPublish).toHaveBeenCalledTimes(1);
    wrapper.unmount();
  });

  it('拖到内容区外面会被拉回可视范围内', async () => {
    const settings = useSettingsStore();
    const wrapper = mount(PublishFab);
    const button = wrapper.find('.publish-fab');
    const parent = document.createElement('div');
    stubLayout(button.element as HTMLElement, parent);

    button.element.dispatchEvent(pointerEvent('pointerdown', { pointerId: 1, button: 0, clientX: 340, clientY: 500 }));
    button.element.dispatchEvent(pointerEvent('pointermove', { pointerId: 1, clientX: 5000, clientY: 5000 }));
    button.element.dispatchEvent(pointerEvent('pointerup', { pointerId: 1, clientX: 5000, clientY: 5000 }));
    await nextTick();

    // 右/下边界 = 内容区尺寸 - 按钮尺寸 - 8px 间距
    expect(settings.settings.publishFabPosition).toEqual({
      x: PARENT_WIDTH - FAB_WIDTH - 8,
      y: PARENT_HEIGHT - FAB_HEIGHT - 8,
    });
    wrapper.unmount();
  });

  it('手抖（位移小于阈值）不算拖动，仍然是点击发布', async () => {
    const app = useAppStore();
    const openPublish = vi.spyOn(app, 'openPublish').mockImplementation(() => undefined);
    const settings = useSettingsStore();
    const wrapper = mount(PublishFab);
    const button = wrapper.find('.publish-fab');
    const parent = document.createElement('div');
    stubLayout(button.element as HTMLElement, parent);

    button.element.dispatchEvent(pointerEvent('pointerdown', { pointerId: 1, button: 0, clientX: 340, clientY: 500 }));
    button.element.dispatchEvent(pointerEvent('pointermove', { pointerId: 1, clientX: 342, clientY: 501 }));
    button.element.dispatchEvent(pointerEvent('pointerup', { pointerId: 1, clientX: 342, clientY: 501 }));
    await button.trigger('click');

    expect(settings.settings.publishFabPosition).toBeNull();
    expect(wrapper.classes()).not.toContain('is-moved');
    expect(openPublish).toHaveBeenCalledTimes(1);
    wrapper.unmount();
  });
});
