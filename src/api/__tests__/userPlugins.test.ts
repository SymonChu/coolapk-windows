import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { CoolapkTauriAPI } from '../coolapk';

beforeEach(() => { vi.mocked(invoke).mockReset(); });
describe('挂件原生接口', () => {
  it('遵循原生 code/data 返回协议，分页类别传到 Rust', async () => {
    vi.mocked(invoke).mockResolvedValue({ code: 200, data: { pluginList: [] } });
    expect((await CoolapkTauriAPI.getUserPlugins(false, 2, 1)).data.pluginList).toEqual([]);
    expect(invoke).toHaveBeenCalledWith('get_user_plugins', { store: false, page: 2, pluginType: 1 });
  });
  it('保存提交两类 ID，业务失败留给页面处理且不自动重复提交', async () => {
    vi.mocked(invoke).mockResolvedValue({ code: 200, data: { status: 400, message: '不可使用' } });
    expect((await CoolapkTauriAPI.saveUserPlugins(0, 9)).data.status).toBe(400);
    expect(invoke).toHaveBeenCalledExactlyOnceWith('save_user_plugins', { avatarId: 0, feedId: 9 });
  });
  it('领取网络失败不会自动重试', async () => {
    vi.mocked(invoke).mockRejectedValue('network error');
    await expect(CoolapkTauriAPI.claimUserPlugin(8)).rejects.toBe('network error');
    expect(invoke).toHaveBeenCalledExactlyOnceWith('claim_user_plugin', { id: 8 });
  });
});
