import { describe, expect, it } from 'vitest';
import { normalizeMyCardsResponse } from '../myCards';

describe('my cards response normalization', () => {
  it('extracts the 我的常去 group from the account card configuration', () => {
    const cards = normalizeMyCardsResponse({
      code: 200,
      data: [{
        title: '我的卡片',
        entities: [{
          title: '我的常去',
          entities: [
            { id: 1, title: 'ColorOS17', logo: 'https://example.com/coloros.png', url: '#/topic/ColorOS17' },
            { id: 2, title: '一加13', icon: 'https://example.com/oneplus.png', actionUrl: '/product/13' },
          ],
        }],
      }],
    });

    expect(cards).toEqual([
      { id: '1', title: 'ColorOS17', imageUrl: 'https://example.com/coloros.png', url: '#/topic/ColorOS17' },
      { id: '2', title: '一加13', imageUrl: 'https://example.com/oneplus.png', url: '/product/13' },
    ]);
  });

  it('supports JSON encoded child entities and removes duplicate cards', () => {
    const cards = normalizeMyCardsResponse({
      data: {
        entities: [{
          label: '我的常去',
          items: JSON.stringify([
            { entityId: 'user-1', name: '常用用户', avatar: 'avatar', href: '/user/1' },
            { entityId: 'user-1', name: '常用用户', avatar: 'avatar', href: '/user/1' },
          ]),
        }],
      },
    });

    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({ id: 'user-1', title: '常用用户', url: '/user/1' });
  });
});
