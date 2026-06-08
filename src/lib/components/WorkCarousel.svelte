<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { ChevronLeft, ChevronRight } from 'lucide-svelte';

  interface Slide { src: string; caption?: string; }
  interface Props { slides: Slide[]; title?: string; eyebrow?: string; }

  const { slides, title = 'Ons werk', eyebrow = 'Achter de schermen' }: Props = $props();

  let track: HTMLDivElement | null = $state(null);
  let current = $state(0);
  let autoplayTimer: ReturnType<typeof setInterval> | null = null;
  let paused = $state(false);

  function scrollToIndex(i: number) {
    if (!track) return;
    const w = track.clientWidth;
    track.scrollTo({ left: i * w, behavior: 'smooth' });
  }

  function next() { scrollToIndex((current + 1) % slides.length); }
  function prev() { scrollToIndex((current - 1 + slides.length) % slides.length); }

  function handleScroll() {
    if (!track) return;
    const w = track.clientWidth;
    if (!w) return;
    const idx = Math.round(track.scrollLeft / w);
    if (idx !== current) current = idx;
  }

  onMount(() => {
    autoplayTimer = setInterval(() => {
      if (!paused && document.visibilityState === 'visible') next();
    }, 5500);
  });

  onDestroy(() => {
    if (autoplayTimer) clearInterval(autoplayTimer);
  });
</script>

<section
  class="work-section"
  data-section="work"
  onmouseenter={() => (paused = true)}
  onmouseleave={() => (paused = false)}
  ontouchstart={() => (paused = true)}
  role="region"
  aria-label={title}
>
  <div class="work-header">
    {#if eyebrow}<div class="work-eyebrow">{eyebrow}</div>{/if}
    <h2 class="work-title">{title}</h2>
  </div>

  <div class="work-carousel">
    <button class="work-arrow work-arrow-prev" aria-label="Vorige" onclick={prev}>
      <ChevronLeft size={20} strokeWidth={2.5} />
    </button>

    <div
      class="work-track"
      bind:this={track}
      onscroll={handleScroll}
      tabindex="0"
      role="group"
      aria-roledescription="carrousel"
    >
      {#each slides as slide, i}
        <div class="work-slide" aria-roledescription="slide" aria-label={`${i + 1} van ${slides.length}`}>
          <div class="work-image-wrap">
            <img
              src={slide.src}
              alt={slide.caption || `Ons werk ${i + 1}`}
              loading={i === 0 ? 'eager' : 'lazy'}
              fetchpriority={i === 0 ? 'high' : 'auto'}
              decoding="async"
            />
            <div class="work-gradient"></div>
          </div>
          {#if slide.caption}
            <p class="work-caption">{slide.caption}</p>
          {/if}
        </div>
      {/each}
    </div>

    <button class="work-arrow work-arrow-next" aria-label="Volgende" onclick={next}>
      <ChevronRight size={20} strokeWidth={2.5} />
    </button>
  </div>

  <div class="work-dots" role="tablist">
    {#each slides as _, i}
      <button
        class="work-dot"
        class:active={i === current}
        onclick={() => scrollToIndex(i)}
        aria-label={`Naar foto ${i + 1}`}
        aria-selected={i === current}
        role="tab"
      ></button>
    {/each}
  </div>
</section>

<style>
  .work-section {
    padding: 28px 0 32px;
    background: linear-gradient(180deg, #fff 0%, #FAF7F2 100%);
    border-top: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
  }

  .work-header {
    padding: 0 16px;
    margin-bottom: 18px;
  }
  .work-eyebrow {
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--primary);
    margin-bottom: 6px;
  }
  .work-title {
    font-size: 1.625rem;
    font-weight: 800;
    letter-spacing: -0.02em;
    color: var(--fg);
    margin: 0;
    line-height: 1.15;
  }

  .work-carousel {
    position: relative;
    display: flex;
    align-items: center;
  }

  .work-track {
    display: flex;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    scroll-behavior: smooth;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    width: 100%;
    gap: 0;
    padding: 0 16px;
  }
  .work-track::-webkit-scrollbar { display: none; }
  .work-track:focus-visible { outline: 2px solid var(--primary); outline-offset: -4px; }

  .work-slide {
    flex: 0 0 100%;
    scroll-snap-align: center;
    scroll-snap-stop: always;
    padding: 0 4px;
    box-sizing: border-box;
  }

  .work-image-wrap {
    position: relative;
    width: 100%;
    aspect-ratio: 4 / 3;
    border-radius: 18px;
    overflow: hidden;
    background: #eee;
    box-shadow: 0 8px 24px rgba(0,0,0,0.10), 0 2px 6px rgba(0,0,0,0.06);
  }
  .work-image-wrap img {
    width: 100%; height: 100%; object-fit: cover; display: block;
  }
  .work-gradient {
    position: absolute; inset: auto 0 0 0; height: 40%;
    background: linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.45) 100%);
    pointer-events: none;
  }

  .work-caption {
    margin: 14px 4px 0;
    font-size: 0.9375rem;
    color: var(--fg);
    line-height: 1.5;
    text-align: center;
    font-weight: 500;
  }

  .work-arrow {
    position: absolute;
    top: calc(50% - 28px);
    transform: translateY(-50%);
    width: 40px; height: 40px;
    border-radius: 50%;
    background: rgba(255,255,255,0.95);
    border: 1px solid var(--border);
    color: var(--fg);
    cursor: pointer;
    display: none;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 12px rgba(0,0,0,0.12);
    z-index: 2;
    transition: background 0.15s, transform 0.15s;
  }
  .work-arrow:hover { background: #fff; transform: translateY(-50%) scale(1.05); }
  .work-arrow-prev { left: 8px; }
  .work-arrow-next { right: 8px; }

  .work-dots {
    display: flex;
    justify-content: center;
    gap: 8px;
    margin-top: 18px;
    padding: 0 16px;
  }
  .work-dot {
    width: 8px; height: 8px;
    border-radius: 50%;
    border: none;
    background: rgba(0,0,0,0.18);
    cursor: pointer;
    padding: 0;
    transition: background 0.2s, width 0.2s;
  }
  .work-dot.active {
    background: var(--primary);
    width: 22px;
    border-radius: 4px;
  }

  /* Desktop refinements */
  @media (min-width: 720px) {
    .work-section { padding: 40px 0 44px; }
    .work-header { padding: 0 32px; margin-bottom: 22px; }
    .work-title { font-size: 2rem; }
    .work-track { padding: 0 32px; }
    .work-slide { padding: 0 8px; }
    .work-image-wrap { aspect-ratio: 16 / 10; border-radius: 22px; }
    .work-arrow { display: flex; }
    .work-arrow-prev { left: 16px; }
    .work-arrow-next { right: 16px; }
    .work-caption { font-size: 1rem; margin-top: 16px; }
  }
</style>
