import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';

vi.mock('../../../api/coolapk', () => ({ CoolapkTauriAPI: { openUrl: vi.fn() } }));
vi.mock('../../../utils/toast', () => ({ showToast: vi.fn() }));

import UploadTaskCard from '../UploadTaskCard.vue';
import type { CdnUploadTask } from '../../../types/upload';

function createTask(overrides: Partial<CdnUploadTask> = {}): CdnUploadTask {
  return {
    id: 'task-eta',
    attempt: 1,
    filePath: 'C:\\upload\\file.zip',
    fileName: 'file.zip',
    status: 'uploading',
    uploaded: 80_000,
    total: 200_000,
    speed: 1_000,
    url: '',
    error: '',
    createdAt: 1,
    updatedAt: 1,
    completedAt: 0,
    ...overrides,
  };
}

describe('上传任务卡剩余时间', () => {
  it('仅在上传中且总大小和速度有效时显示 ETA', async () => {
    const wrapper = mount(UploadTaskCard, {
      props: { task: createTask() },
      global: { stubs: { AppButton: true } },
    });
    expect(wrapper.find('.upload-remaining').text()).toBe('剩余约 2 分钟');

    await wrapper.setProps({ task: createTask({ status: 'preparing' }) });
    expect(wrapper.find('.upload-remaining').exists()).toBe(false);

    await wrapper.setProps({ task: createTask({ speed: 0 }) });
    expect(wrapper.find('.upload-remaining').exists()).toBe(false);

    await wrapper.setProps({ task: createTask({ total: 0 }) });
    expect(wrapper.find('.upload-remaining').exists()).toBe(false);
  });
});
