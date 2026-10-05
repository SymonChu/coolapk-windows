<template>
  <div class="rating-chart">
    <div class="chart-head">
      <span class="chart-title"><i class="fas fa-chart-line"></i> 评分趋势</span>
      <div class="period-tabs" aria-label="评分范围">
        <button type="button" :class="['period-btn', { active: audience === 'all' }]" @click="audience = 'all'">全部用户</button>
        <button v-if="hasOwnerData" type="button" :class="['period-btn', { active: audience === 'owner' }]" @click="audience = 'owner'">机主</button>
      </div>
      <div class="period-tabs">
        <button
          v-for="(label, key) in RATING_CHART_PERIOD_LABELS"
          :key="key"
          type="button"
          :class="['period-btn', { active: activePeriod === key }]"
          @click="activePeriod = key"
        >
          {{ label }}
        </button>
      </div>
    </div>

    <div v-if="points.length === 0" class="chart-empty">
      <EmptyState title="暂无评分数据" description="该周期内还没有用户评分" />
    </div>

    <div v-else class="chart-body">
      <div class="period-tabs chart-metric-tabs" aria-label="走势指标">
        <button type="button" :class="['period-btn', { active: metric === 'score' }]" @click="metric = 'score'">平均分</button>
        <button type="button" :class="['period-btn', { active: metric === 'count' }]" @click="metric = 'count'">点评人数</button>
      </div>
      <svg
        class="chart-svg"
        :viewBox="`0 0 ${viewWidth} ${viewHeight}`"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="评分趋势折线图"
        @mousemove="handleChartMove"
        @mouseleave="hoveredIndex = -1"
      >
        <defs>
          <linearGradient id="chart-area-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" :stop-color="brandColor" stop-opacity="0.22" />
            <stop offset="100%" :stop-color="brandColor" stop-opacity="0.02" />
          </linearGradient>
        </defs>

        <line
          v-for="gridY in gridYs"
          :key="`grid-${gridY.value}`"
          :x1="padding.left"
          :x2="viewWidth - padding.right"
          :y1="gridY.y"
          :y2="gridY.y"
          class="grid-line"
        />
        <text
          v-for="gridY in gridYs"
          :key="`grid-label-${gridY.value}`"
          :x="padding.left - 8"
          :y="gridY.y + 4"
          class="axis-label"
          text-anchor="end"
        >
          {{ gridY.label }}
        </text>

        <path :d="areaPath" class="area-fill" />
        <path :d="linePath" class="score-line" />

        <g v-for="(point, index) in positioned" :key="`point-${index}`">
          <circle
            v-if="hoveredIndex === index || positioned.length <= 40"
            :cx="point.x"
            :cy="point.y"
            r="3.4"
            class="score-dot"
          />
          <text
            v-if="showXLabel(index)"
            :x="point.x"
            :y="viewHeight - padding.bottom + 16"
            class="axis-label"
            text-anchor="middle"
          >
            {{ point.shortLabel }}
          </text>
        </g>
      </svg>
      <div v-if="hoveredPoint" class="chart-tooltip" :style="tooltipStyle" role="status">
        <strong>{{ hoveredPoint.label }}</strong>
        <span>均分 {{ hoveredPoint.score.toFixed(1) }} 分</span>
        <span>{{ hoveredPoint.count }} 人评分</span>
      </div>
      <div class="chart-legend">
        <span class="legend-item"><i class="legend-line"></i>{{ effectiveAudience === 'owner' ? '机主' : '全部用户' }}{{ metric === 'score' ? '均分' : '点评人数' }}</span>
        <span class="legend-note">悬停数据点查看详情</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import EmptyState from '../common/EmptyState.vue';
import { RATING_CHART_PERIOD_LABELS, extractRatingChartSeries, type RatingChartPeriodKey, type RatingChartPeriods } from '../../types/product';

const props = defineProps<{
  periods: RatingChartPeriods | null;
}>();

const activePeriod = ref<RatingChartPeriodKey>('week');
const audience = ref<'all' | 'owner'>('all');
const metric = ref<'score' | 'count'>('score');
const hoveredIndex = ref(-1);
const tooltipStyle = ref({ left: '0px', top: '0px' });
const hasOwnerData = computed(() => (['day', 'week', 'month'] as const).some((key) => props.periods?.[key]?.ownerRatingChart?.x?.length));

const viewWidth = 640;
const viewHeight = 240;
const padding = { top: 18, right: 24, bottom: 34, left: 46 };
const brandColor = 'var(--brand-primary)';

const period = computed(() => {
  const periods = props.periods;
  if (!periods) return null;
  return periods[activePeriod.value] || null;
});
const effectiveAudience = computed(() => audience.value === 'owner' || !period.value?.ratingChart ? 'owner' : 'all');

const points = computed(() => {
  const series = extractRatingChartSeries(period.value, effectiveAudience.value);
  return series.map((point) => ({
    ...point,
    x: 0,
    y: 0,
    shortLabel: shortDateLabel(point.label),
  }));
});

const scoreValues = computed(() => points.value.map((point) => point.score));
const countValues = computed(() => points.value.map((point) => point.count));

const minScore = computed(() => {
  const axisMin = Number(period.value?.ratingChart?.y?.[0]?.min ?? period.value?.ownerRatingChart?.y?.[0]?.min ?? NaN);
  if (Number.isFinite(axisMin) && scoreValues.value.length) return Math.min(axisMin, Math.min(...scoreValues.value));
  return scoreValues.value.length ? Math.min(2, Math.min(...scoreValues.value) - 0.5) : 0;
});

const maxScore = computed(() => {
  const axisMax = Number(period.value?.ratingChart?.y?.[0]?.max ?? period.value?.ownerRatingChart?.y?.[0]?.max ?? NaN);
  if (Number.isFinite(axisMax) && scoreValues.value.length) return Math.max(axisMax, Math.max(...scoreValues.value));
  return 10;
});

const maxCount = computed(() => countValues.value.length ? Math.max(...countValues.value) : 0);
const chartMin = computed(() => metric.value === 'score' ? minScore.value : 0);
const chartMax = computed(() => metric.value === 'score' ? maxScore.value : Math.max(1, maxCount.value));

const innerWidth = computed(() => viewWidth - padding.left - padding.right);
const innerHeight = computed(() => viewHeight - padding.top - padding.bottom);

function xAt(index: number): number {
  const count = points.value.length;
  if (count <= 1) return padding.left + innerWidth.value / 2;
  return padding.left + (index / (count - 1)) * innerWidth.value;
}

function yFor(score: number): number {
  const range = Math.max(chartMax.value - chartMin.value, 0.0001);
  const ratio = (score - chartMin.value) / range;
  return padding.top + (1 - ratio) * innerHeight.value;
}

const positioned = computed(() => points.value.map((point, index) => ({
  ...point,
  x: xAt(index),
  y: yFor(metric.value === 'score' ? point.score : point.count),
})));

const hoveredPoint = computed(() => positioned.value[hoveredIndex.value] || null);

function handleChartMove(event: MouseEvent) {
  const svg = event.currentTarget as SVGSVGElement;
  const bounds = svg.getBoundingClientRect();
  if (!bounds.width || positioned.value.length === 0) return;
  const x = ((event.clientX - bounds.left) / bounds.width) * viewWidth;
  const index = Math.max(0, Math.min(positioned.value.length - 1,
    Math.round(((x - padding.left) / innerWidth.value) * (positioned.value.length - 1))));
  hoveredIndex.value = index;
  tooltipStyle.value = {
    left: `${Math.max(8, Math.min(bounds.width - 150, event.clientX - bounds.left + 12))}px`,
    top: `${Math.max(8, event.clientY - bounds.top - 70)}px`,
  };
}

const linePath = computed(() => {
  if (positioned.value.length === 0) return '';
  return positioned.value
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)},${point.y.toFixed(1)}`)
    .join(' ');
});

const areaPath = computed(() => {
  if (positioned.value.length === 0) return '';
  const baseY = viewHeight - padding.bottom;
  const line = linePath.value;
  const first = positioned.value[0];
  const last = positioned.value[positioned.value.length - 1];
  return `${line} L${last.x.toFixed(1)},${baseY} L${first.x.toFixed(1)},${baseY} Z`;
});

const gridYs = computed(() => {
  const rows = 4;
  const gridLines: Array<{ y: number; value: number; label: string }> = [];
  for (let row = 0; row <= rows; row++) {
    // 与 yFor(score) 保持一致：顶部对应 maxScore，底部对应 minScore
    const value = chartMax.value - (chartMax.value - chartMin.value) * (row / rows);
    const y = padding.top + (row / rows) * innerHeight.value;
    gridLines.push({ y, value, label: metric.value === 'score' ? value.toFixed(1) : String(Math.round(value)) });
  }
  return gridLines;
});

function showXLabel(index: number): boolean {
  const count = positioned.value.length;
  if (count <= 6) return true;
  if (index === 0 || index === count - 1) return true;
  return index % Math.ceil(count / 6) === 0;
}

function shortDateLabel(raw: string): string {
  if (!raw) return '';
  const text = String(raw).trim();
  // 形如 "08-20" / "2025-08-20" / "8月20日"
  const match = text.match(/(\d{4}-)?(\d{2})-(\d{2})/);
  if (match) return `${match[2]}/${match[3]}`;
  const chineseMatch = text.match(/(\d{1,2})月(\d{1,2})日/);
  if (chineseMatch) return `${chineseMatch[1]}/${chineseMatch[2]}`;
  return text.slice(0, 8);
}

</script>

<style scoped>
.rating-chart {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  padding: var(--space-4);
}

.chart-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.chart-title {
  font-size: var(--font-size-sub);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
}

.chart-title i {
  color: var(--brand-primary);
  margin-right: 6px;
}

.period-tabs {
  display: flex;
  gap: 4px;
  background-color: var(--background-secondary);
  border-radius: var(--radius-control);
  padding: 3px;
}

.period-btn {
  border: 0;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  padding: 4px 12px;
  border-radius: var(--radius-control);
  cursor: pointer;
}

.period-btn.active {
  background-color: var(--surface);
  color: var(--brand-primary);
  font-weight: var(--font-weight-semibold);
  box-shadow: var(--shadow-sm);
}

.chart-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  position: relative;
}

.chart-metric-tabs { align-self: flex-start; }

.chart-tooltip {
  position: absolute;
  z-index: 2;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 7px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-control);
  background: var(--surface);
  box-shadow: var(--shadow-sm);
  color: var(--text-primary);
  font-size: 12px;
  pointer-events: none;
}

.chart-svg {
  width: 100%;
  height: auto;
  display: block;
}

.grid-line {
  stroke: var(--border);
  stroke-width: 1;
  stroke-dasharray: 4 4;
}

.axis-label {
  fill: var(--text-tertiary);
  font-size: 11px;
}

.area-fill {
  fill: url(#chart-area-fill);
}

.score-line {
  stroke: var(--brand-primary);
  stroke-width: 2.4;
  stroke-linecap: round;
  stroke-linejoin: round;
  fill: none;
}

.score-dot {
  fill: var(--surface);
  stroke: var(--brand-primary);
  stroke-width: 2;
}

.score-dot-hit {
  fill: transparent;
  stroke: transparent;
  cursor: pointer;
  pointer-events: all;
}

.chart-legend {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-secondary);
}

.legend-line {
  display: inline-block;
  width: 18px;
  height: 3px;
  border-radius: 2px;
  background-color: var(--brand-primary);
}

.legend-note {
  font-size: 11px;
  color: var(--text-tertiary);
}

.chart-empty {
  min-height: 160px;
  display: grid;
  place-items: center;
}
</style>
