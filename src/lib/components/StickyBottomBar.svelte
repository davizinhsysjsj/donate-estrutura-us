<script lang="ts">
  import { onMount } from 'svelte';
  import ProgressCard from './ProgressCard.svelte';

  type Props = {
    raised: number;
    goal: number;
    lastDonorName: string;
    lastDonorAmount: number;
    lastDonorAgo?: string;
    onDonate: () => void;
    onShare: () => void;
    onDonorsClick?: () => void;
    triggerSelector?: string;
    currency?: string;
    locale?: string;
    raisedLabel?: string;
    ofLabel?: string;
    donatedVerb?: string;
    donateLabel?: string;
    shareLabel?: string;
    donorsAria?: string;
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
    triggerSelector = '#progress-anchor',
    currency,
    locale,
    raisedLabel,
    ofLabel,
    donatedVerb,
    donateLabel,
    shareLabel,
    donorsAria
  }: Props = $props();

  let visible = $state(false);

  onMount(() => {
    const target = document.querySelector(triggerSelector);
    if (!target) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = !entry.isIntersecting;
      },
      { rootMargin: '0px 0px -20px 0px', threshold: 0 }
    );
    observer.observe(target);
    return () => observer.disconnect();
  });
</script>

<div class="sticky-bottom" class:visible aria-hidden={!visible}>
  <div class="sticky-bottom-inner">
    <ProgressCard
      raised={raised}
      goal={goal}
      lastDonorName={lastDonorName}
      lastDonorAmount={lastDonorAmount}
      lastDonorAgo={lastDonorAgo}
      onDonate={onDonate}
      onShare={onShare}
      onDonorsClick={onDonorsClick}
      compact={true}
      {currency}
      {locale}
      {raisedLabel}
      {ofLabel}
      {donatedVerb}
      {donateLabel}
      {shareLabel}
      {donorsAria}
    />
  </div>
</div>

<style>
  .sticky-bottom {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 60;
    background: #ffffff;
    border-top-left-radius: 28px;
    border-top-right-radius: 28px;
    box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.12), 0 -2px 8px rgba(0, 0, 0, 0.04);
    transform: translateY(110%);
    transition: transform 0.28s cubic-bezier(0.2, 0.8, 0.2, 1);
    pointer-events: none;
    padding-bottom: env(safe-area-inset-bottom);
  }
  .sticky-bottom.visible {
    transform: translateY(0);
    pointer-events: auto;
  }
  .sticky-bottom-inner {
    max-width: 520px;
    margin: 0 auto;
    padding: 16px 18px 14px;
  }

  @media (min-width: 640px) {
    .sticky-bottom-inner { max-width: 720px; padding: 18px 24px 16px; }
  }
</style>
