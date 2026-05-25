<script lang="ts">
  import { ChevronRight } from 'lucide-svelte';
  import ProgressDonut from './ProgressDonut.svelte';

  type Props = {
    raised: number;
    goal: number;
    lastDonorName: string;
    lastDonorAmount: number;
    lastDonorAgo?: string;
    onDonate: () => void;
    onShare: () => void;
    onDonorsClick?: () => void;
    compact?: boolean;
  };

  let {
    raised,
    goal,
    lastDonorName,
    lastDonorAmount,
    lastDonorAgo,
    onDonate,
    onShare,
    onDonorsClick,
    compact = false
  }: Props = $props();

  const percent = $derived(Math.min(100, Math.round((raised / goal) * 100)));
  const fmtRaised = $derived(raised.toLocaleString('en-IE'));
  const fmtGoal = $derived(goal.toLocaleString('en-IE'));
</script>

<div class="progress-card" class:progress-card-compact={compact}>
  <div class="progress-card-row">
    <ProgressDonut
      percent={percent}
      size={compact ? 36 : 52}
      stroke={compact ? 4 : 6}
    />
    <div class="progress-card-text">
      <div class="progress-card-amount-line">
        <span class="progress-card-raised">€{fmtRaised} raised</span>
        <span class="progress-card-goal"> of €{fmtGoal}</span>
      </div>
      <button
        type="button"
        class="progress-card-donor"
        onclick={onDonorsClick}
        aria-label="See all donors"
      >
        <span class="progress-card-donor-text">
          {lastDonorName} donated €{lastDonorAmount}{lastDonorAgo ? ` · ${lastDonorAgo}` : ''}
        </span>
        <ChevronRight size={compact ? 12 : 14} strokeWidth={2.5} />
      </button>
    </div>
  </div>

  <div class="progress-card-actions">
    <button type="button" class="pill pill-donate" onclick={onDonate}>Donate</button>
    <button type="button" class="pill pill-share" onclick={onShare}>Share</button>
  </div>
</div>

<style>
  .progress-card {
    display: flex;
    flex-direction: column;
    gap: 14px;
    width: 100%;
  }
  .progress-card-compact { gap: 8px; }

  .progress-card-row {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
  }
  .progress-card-compact .progress-card-row { gap: 10px; }

  .progress-card-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .progress-card-amount-line {
    line-height: 1.2;
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 4px;
  }
  .progress-card-raised {
    font-size: 1rem;
    font-weight: 700;
    color: #0E4B2C;
    letter-spacing: -0.01em;
  }
  .progress-card-compact .progress-card-raised { font-size: 0.875rem; }

  .progress-card-goal {
    font-size: 1rem;
    color: #6B7280;
    font-weight: 400;
  }
  .progress-card-compact .progress-card-goal { font-size: 0.8125rem; }

  .progress-card-donor {
    background: none;
    border: none;
    padding: 0;
    margin: 0;
    font-family: inherit;
    display: inline-flex;
    align-items: center;
    gap: 2px;
    color: #6B7280;
    font-size: 0.8125rem;
    cursor: pointer;
    text-align: left;
    line-height: 1.3;
  }
  .progress-card-compact .progress-card-donor { font-size: 0.6875rem; }

  .progress-card-donor:hover { color: #0E4B2C; }
  .progress-card-donor-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 100%;
  }

  .progress-card-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    width: 100%;
  }
  .progress-card-compact .progress-card-actions { gap: 8px; }

  .pill {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 9999px;
    border: none;
    cursor: pointer;
    font-family: inherit;
    font-weight: 600;
    font-size: 1rem;
    padding: 14px 24px;
    transition: background 0.15s ease, transform 0.1s ease;
    line-height: 1;
    white-space: nowrap;
  }
  .progress-card-compact .pill {
    padding: 8px 14px;
    font-size: 0.8125rem;
    font-weight: 600;
  }

  .pill:active { transform: scale(0.97); }

  .pill-donate {
    background: #C5F26E;
    color: #0E4B2C;
  }
  .pill-donate:hover { background: #B5E859; }

  .pill-share {
    background: #0E4B2C;
    color: #FFFFFF;
  }
  .pill-share:hover { background: #0A3A20; }

  @media (min-width: 640px) {
    .progress-card-raised { font-size: 1.125rem; }
    .progress-card-goal { font-size: 1.0625rem; }
    .progress-card-donor { font-size: 0.875rem; }
  }
</style>
