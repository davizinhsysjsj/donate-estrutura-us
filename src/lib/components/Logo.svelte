<script lang="ts">
  import { cn } from '$lib/utils/cn';
  let { class: className = '' }: { class?: string } = $props();
</script>

<a href="/" class={cn('inline-flex items-baseline gap-2 group', className)}>
  <span class="font-serif text-2xl md:text-3xl font-bold text-amber-accent tracking-tight">PawsCo</span>
  <span class="text-xs uppercase tracking-[0.2em] text-muted font-medium group-hover:text-copper transition-colors">Rescue</span>
</a>
