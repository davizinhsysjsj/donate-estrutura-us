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
    triggerSelector = '#progress-anchor'
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
    border-top: 1px solid #E5E7EB;
    box-shadow: 0 -2px 12px rgba(0, 0, 0, 0.08);
    transform: translateY(100%);
    transition: transform 0.25s ease;
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
    padding: 10px 16px;
  }

  @media (min-width: 640px) {
    .sticky-bottom-inner { max-width: 720px; }
  }
</style>
