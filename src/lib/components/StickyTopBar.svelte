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
    threshold?: number;
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
    threshold = 400
  }: Props = $props();

  let visible = $state(false);

  onMount(() => {
    function handleScroll() {
      visible = window.scrollY > threshold;
    }
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  });
</script>

<div class="sticky-top" class:visible aria-hidden={!visible}>
  <div class="sticky-top-inner">
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
  .sticky-top {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 60;
    background: #ffffff;
    border-bottom: 1px solid #E5E7EB;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
    transform: translateY(-100%);
    transition: transform 0.25s ease;
    pointer-events: none;
  }
  .sticky-top.visible {
    transform: translateY(0);
    pointer-events: auto;
  }
  .sticky-top-inner {
    max-width: 520px;
    margin: 0 auto;
    padding: 10px 16px;
  }

  @media (min-width: 640px) {
    .sticky-top-inner { max-width: 720px; }
  }
</style>
