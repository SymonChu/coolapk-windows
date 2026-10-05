import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleAnchorClick } from '../anchorClick';
import { CoolapkTauriAPI } from '../../api/coolapk';
import { router } from '../../router';

vi.mock('../../router', () => ({ router: { push: vi.fn(), resolve: vi.fn(() => ({ matched: [{}] })) } }));
vi.mock('../../api/coolapk', () => ({ CoolapkTauriAPI: { openUrl: vi.fn().mockResolvedValue(true) } }));
vi.mock('../feedNavigation', () => ({ openFeedDetail: vi.fn() }));

beforeEach(() => vi.clearAllMocks());

describe('富文本 @链接点击', () => {
  it.each(['/u/花粉Alive', '//www.coolapk.com/u/花粉Alive', 'https://m.coolapk.com/u/%E8%8A%B1%E7%B2%89Alive'])
    ('嵌套文字点击也通过用户名解析打开主页：%s', href => {
      const anchor = document.createElement('a');
      anchor.setAttribute('href', href);
      const text = document.createElement('span');
      text.textContent = '@花粉Alive';
      anchor.appendChild(text);
      const event = new MouseEvent('click', { cancelable: true });
      Object.defineProperty(event, 'target', { value: text });
      handleAnchorClick(event);
      expect(event.defaultPrevented).toBe(true);
      expect(CoolapkTauriAPI.openUrl).toHaveBeenCalledWith(new URL(href, 'https://www.coolapk.com').href, 'internal');
      expect(router.push).not.toHaveBeenCalled();
    });
});
