import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import RatingChart from '../RatingChart.vue';
import type { RatingChartPeriods } from '../../../types/product';

function makePeriods(): RatingChartPeriods {
  return {
    week: {
      ratingChart: {
        y: [{ min: 0, max: 10 }],
        x: [
          { startDate: '2025-01-01', score: 5.5, count: 3 },
          { startDate: '2025-01-02', score: 6.2, count: 5 },
          { startDate: '2025-01-03', score: 8.1, count: 8 },
        ],
      },
    },
  };
}

describe('评分趋势图 Y 轴标签', () => {
  it('positions points inside the chart and shows details on hover', async () => {
    const wrapper = mount(RatingChart, { props: { periods: makePeriods() }, global: { stubs: { EmptyState: true } } });
    const dots = wrapper.findAll('circle.score-dot');
    expect(dots).toHaveLength(3);
    expect(Number(dots[0].attributes('cx'))).toBeGreaterThan(0);
    const scoreY = dots[0].attributes('cy');
    const svg = wrapper.find('svg');
    Object.defineProperty(svg.element, 'getBoundingClientRect', { value: () => ({ left: 0, top: 0, width: 640, height: 240 }) });
    await svg.trigger('mousemove', { clientX: 46, clientY: 100 });
    expect(wrapper.find('.chart-tooltip').text()).toContain('5.5 分');
    await wrapper.findAll('.chart-metric-tabs button')[1].trigger('click');
    expect(wrapper.find('.chart-legend').text()).toContain('点评人数');
    expect(wrapper.findAll('circle.score-dot')[0].attributes('cy')).not.toBe(scoreY);
  });
  it('顶部应为最大值、底部应为最小值，与数据线方向一致', () => {
    const wrapper = mount(RatingChart, {
      props: { periods: makePeriods() },
      global: {
        stubs: { EmptyState: true },
      },
    });

    const labels = wrapper
      .findAll('text.axis-label')
      .map((node) => node.text())
      .filter((text) => /^\d+(\.\d+)?$/.test(text));

    // 5 条网格线标签：顶部 maxScore，底部 minScore
    const [first, second, third, fourth, last] = labels;
    expect(first).toBe('10.0');
    expect(second).toBe('7.5');
    expect(third).toBe('5.0');
    expect(fourth).toBe('2.5');
    expect(last).toBe('0.0');
  });

  it('Y 轴标签应随可见分数范围收敛（不固定为 0-10）', () => {
    const wrapper = mount(RatingChart, {
      props: {
        periods: {
          week: {
            ratingChart: {
              y: [{ min: 4, max: 9 }],
              x: [
                { startDate: '2025-01-01', score: 5, count: 1 },
                { startDate: '2025-01-02', score: 6, count: 1 },
              ],
            },
          },
        },
      },
      global: { stubs: { EmptyState: true } },
    });

    const labels = wrapper
      .findAll('text.axis-label')
      .map((node) => node.text())
      .filter((text) => /^\d+(\.\d+)?$/.test(text));

    expect(labels[0]).toBe('9.0');
    expect(labels[labels.length - 1]).toBe('4.0');
  });
});
