<script lang="ts">
  type Props = {
    percent: number;
    size?: number;
    stroke?: number;
    fontSize?: number;
    arcColor?: string;
    trackColor?: string;
    textColor?: string;
  };

  let {
    percent,
    size = 52,
    stroke = 6,
    fontSize,
    arcColor = '#9FE870',
    trackColor = '#E5E7EB',
    textColor = '#0E4B2C'
  }: Props = $props();

  const safePct = $derived(Math.max(0, Math.min(100, percent)));
  const radius = $derived((size - stroke) / 2);
  const circumference = $derived(2 * Math.PI * radius);
  const dashOffset = $derived(circumference - (safePct / 100) * circumference);
  const computedFontSize = $derived(fontSize ?? Math.max(9, Math.round(size * 0.22)));
  const cx = $derived(size / 2);
  const cy = $derived(size / 2);
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 {size} {size}"
  role="progressbar"
  aria-valuenow={Math.round(safePct)}
  aria-valuemin="0"
  aria-valuemax="100"
  aria-label="Campaign progress {Math.round(safePct)}%"
>
  <circle
    cx={cx}
    cy={cy}
    r={radius}
    fill="none"
    stroke={trackColor}
    stroke-width={stroke}
  />
  <circle
    cx={cx}
    cy={cy}
    r={radius}
    fill="none"
    stroke={arcColor}
    stroke-width={stroke}
    stroke-linecap="round"
    stroke-dasharray={circumference}
    stroke-dashoffset={dashOffset}
    transform="rotate(-90 {cx} {cy})"
    style="transition: stroke-dashoffset 0.7s ease;"
  />
  <text
    x="50%"
    y="50%"
    text-anchor="middle"
    dominant-baseline="central"
    font-size={computedFontSize}
    font-weight="700"
    fill={textColor}
    font-family="Inter, system-ui, sans-serif"
  >
    {Math.round(safePct)}%
  </text>
</svg>
