<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Heart, Send, Volume2, VolumeX, Share2 } from 'lucide-svelte';
  import {
    captureAndPersistFbclid, getFbp, getEid, trackEvent, uuid, buildShopifyCartUrl,
    type UtmData
  } from '$lib/utils/fbtracking';
  import { track as trackAnalytics, getSid } from '$lib/utils/analytics';
  import {
    SHOPIFY_SHOP_DOMAIN, pickVariantForAmount
  } from '$lib/data/variants';
  import type { PageData } from './$types';

  const { data } = $props<{ data: PageData }>();

  // ── Tracking ──────────────────────────────────────────────────────────
  let fbclid: string | null = $state(null);
  let fbc: string | null = $state(null);
  let fbp: string | null = $state(null);
  let utm: UtmData | null = $state(null);

  // ── Live viewer counter (oscila) ─────────────────────────────────────
  let viewers = $state(342 + Math.floor(Math.random() * 80));
  let peakViewers = $state(viewers);

  // ── Live timer (tempo desde página carregou, apresentado como "on the air for") ─
  // A âncora é 5h atrás pra parecer que ela tá "ao vivo" há muitas horas
  const liveStartTs = Date.now() - (5 * 60 * 60 * 1000 + Math.floor(Math.random() * 60 * 60 * 1000));
  let liveElapsedSec = $state(Math.floor((Date.now() - liveStartTs) / 1000));

  function formatElapsed(sec: number): string {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  // ── Days countdown ─────────────────────────────────────────────────────
  const SURGERY_DATE = new Date('2026-08-18T00:00:00Z');
  const daysLeft = Math.max(0, Math.ceil((SURGERY_DATE.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

  // ── Raised counter ─────────────────────────────────────────────────────
  let totalRaised = $state(3847);
  const GOAL = 15750;
  const raisedPct = $derived(Math.min(100, Math.round((totalRaised / GOAL) * 100)));

  // ── WhatsApp feed (mensagens da Sarah) ────────────────────────────────
  // Timestamps são deltas relativos ao "agora" simulado (liveElapsedSec).
  // À medida que o tempo passa, novas mensagens vão aparecendo do array FUTURE.
  type Msg = { id: string; from: 'sarah' | 'you' | 'system'; text: string; ts: number; delivered?: boolean; type?: 'text' | 'photo' | 'voice' };

  // Mensagens INICIAIS (vão aparecendo no mount progressivamente até completar o feed histórico)
  const INITIAL_MESSAGES: Array<{ from: 'sarah' | 'system'; text: string; minutesAgo: number; type?: 'text' | 'photo' | 'voice' }> = [
    { from: 'system', text: 'Sarah opened this room 5 hours ago 🤍', minutesAgo: 300 },
    { from: 'sarah', text: "Ok. I'm going to leave this open. If any of you want to be here with us... you're welcome.", minutesAgo: 298 },
    { from: 'sarah', text: "The nurses said it's okay to have my phone in the room. So here we are.", minutesAgo: 285 },
    { from: 'sarah', text: "Ellie's temperature is 38.9°C. Not great but not the worst it's been this week.", minutesAgo: 240 },
    { from: 'sarah', text: "If anyone reading this is a nurse or a doctor... please tell me that's ok?", minutesAgo: 212 },
    { from: 'sarah', text: "The consultant just came in. Monday's IVIG treatment is critical. £4,200 needed by then.", minutesAgo: 175 },
    { from: 'sarah', text: "Thank you for the donations. I don't have words. 🥺", minutesAgo: 145 },
    { from: 'sarah', text: "[voice message · 0:42]", minutesAgo: 120, type: 'voice' },
    { from: 'sarah', text: "Someone from Sheffield just gave £100. Whoever you are, thank you.", minutesAgo: 88 },
    { from: 'sarah', text: "My phone is at 12%. Trying to find a charger. Back in a bit x", minutesAgo: 62 },
    { from: 'sarah', text: "Back. Ellie's still asleep. Watching the monitor.", minutesAgo: 38 },
    { from: 'sarah', text: "If you can spare even £1... it's another 15 minutes on the monitor. That's what it costs. Just 15 minutes.", minutesAgo: 22 },
    { from: 'sarah', text: "Thank you all 🤍", minutesAgo: 8 }
  ];

  // Mensagens FUTURAS (aparecem periodicamente, uma por vez)
  const FUTURE_MESSAGES: string[] = [
    "Ellie just squeezed my hand.",
    "The doctor is doing rounds again.",
    "Someone anonymous just donated £250. I'm crying.",
    "If you're reading this... please share this page with 3 people. That's all I'm asking.",
    "Ellie's oxygen is back up to 96%. Small wins.",
    "The nurse is bringing more saline. Standard stuff.",
    "I keep looking at the monitor. It's my whole world now.",
    "Update: we're £11,900 short. But we started at £15,750 short. That's you.",
    "Ellie asked for water. I know she asked because her lips moved.",
    "Hi to everyone who just joined. Welcome to our room 🤍",
    "The consultant confirmed Monday's protocol will happen if we raise the money.",
    "I'm going to try to sleep for 20 mins on this chair. Nurse will wake me if anything changes.",
    "Back. Nothing changed. Which is a good thing.",
    "Someone shared this on Facebook and 40 people came in the last 10 minutes. Whoever you are, thank you.",
    "Ellie moved her foot. First voluntary movement in 4 hours.",
    "The night nurse is switching over. Her name is Priya, she's been amazing.",
    "If you have kids... hug them tonight. Please just do it.",
    "This is Sarah, Ellie's mum. If you're new here, my daughter has high-risk neuroblastoma.",
    "I've had one hour of sleep in the last 30 hours. Not a complaint. Just where we are.",
    "Ellie's monitor just beeped. False alarm. Heart's fine. Sorry, panicking.",
    "Please don't stop sharing. We need £4,200 by Sunday night for Monday's dose.",
    "Someone sent me a message asking how to help without money. Just share this. That's it.",
    "Ok Ellie just opened her eyes for 3 seconds. That was real."
  ];

  let messages = $state<Msg[]>([]);
  let msgIdCounter = 0;

  function newMsgId(): string {
    return `m${++msgIdCounter}_${Date.now()}`;
  }

  function pushMsg(m: Omit<Msg, 'id'>) {
    messages = [...messages, { ...m, id: newMsgId() }];
    // Auto scroll pra baixo se possível
    setTimeout(() => {
      const feed = document.querySelector<HTMLElement>('.wa-feed');
      if (feed) feed.scrollTop = feed.scrollHeight;
    }, 30);
  }

  function formatWhen(deltaMs: number): string {
    // Se veio de INITIAL_MESSAGES com minutesAgo, deltaMs é relativo ao carregamento
    // e vai "envelhecendo" naturalmente conforme liveElapsedSec cresce
    const absDelta = Math.abs(deltaMs);
    if (absDelta < 60_000) return 'now';
    const m = Math.floor(absDelta / 60_000);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}m ago`;
  }

  // ── Viewer chat (Twitch-style) ────────────────────────────────────────
  type ViewerMsg = { id: string; name: string; text: string; kind: 'msg' | 'donate' | 'share' };
  const VIEWER_NAMES = [
    'Emma', 'Jack', 'Sophie', 'Liam', 'Chloe', 'Oliver', 'Grace', 'Harry', 'Millie', 'Ryan',
    'Poppy', 'George', 'Amy', 'Ben', 'Ella', 'Charlotte', 'Dan', 'Lucy', 'Tom', 'Katie',
    'James', 'Rachel', 'Steve', 'Jenny', 'Mark', 'Louise', 'Paul', 'Hannah', 'Nick', 'Zoe'
  ];
  const VIEWER_CITIES = [
    'Manchester', 'Liverpool', 'Leeds', 'Newcastle', 'Birmingham', 'Sheffield',
    'Bristol', 'Glasgow', 'Edinburgh', 'Cardiff', 'Belfast', 'Nottingham',
    'Southampton', 'Portsmouth', 'Oxford', 'Cambridge', 'Reading', 'Preston',
    'Bolton', 'Sunderland', 'Blackpool', 'Wigan', 'Middlesbrough'
  ];
  const VIEWER_MSG_POOL = [
    'praying for you Sarah 🤍',
    'sending love from the north',
    'just shared with my mums group',
    'stay strong Ellie 💪',
    'my daughter is 9 too, this is heartbreaking',
    'shared on FB',
    "you're doing amazing Sarah",
    'come on Ellie ❤️',
    'praying she pulls through',
    'love from Scotland xx',
    'just donated whatever i could',
    'thinking of you and Ellie tonight',
    'proud of you Sarah',
    'my mum had cancer, this hits hard',
    'shared on WhatsApp with the family',
    "we're here Sarah",
    'strength to your family',
    "she's a fighter, you can see it",
    'godspeed Ellie 🙏',
    "hug from a nurse in Bristol",
    'donated £10 - wish it could be more',
    'thinking of you all',
    'come on lass'
  ];

  let viewerChat = $state<ViewerMsg[]>([]);
  let vChatIdCounter = 0;

  function pushViewer(v: Omit<ViewerMsg, 'id'>) {
    const id = `v${++vChatIdCounter}`;
    viewerChat = [...viewerChat.slice(-24), { ...v, id }];
  }

  function pickRandom<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function generateViewerMsg(): ViewerMsg {
    const roll = Math.random();
    const first = pickRandom(VIEWER_NAMES);
    const lastInitial = String.fromCharCode(65 + Math.floor(Math.random() * 26));
    const name = `${first} ${lastInitial}.`;
    const city = pickRandom(VIEWER_CITIES);
    if (roll < 0.35) {
      // donation
      const amounts = [5, 10, 15, 20, 25, 50, 100, 200];
      const amount = amounts[Math.floor(Math.random() * amounts.length)];
      totalRaised += amount;
      return { id: '', kind: 'donate', name: `${name} · ${city}`, text: `donated £${amount}` };
    } else if (roll < 0.50) {
      return { id: '', kind: 'share', name: `${name} · ${city}`, text: 'shared this page' };
    } else {
      return { id: '', kind: 'msg', name: `${name} · ${city}`, text: pickRandom(VIEWER_MSG_POOL) };
    }
  }

  // ── User input (send Sarah a message) ────────────────────────────────
  let userInput = $state('');
  let sendingUser = $state(false);

  function sendUserMessage(e?: Event) {
    if (e) e.preventDefault();
    const txt = userInput.trim();
    if (!txt || sendingUser) return;
    sendingUser = true;
    pushMsg({ from: 'you', text: txt, ts: Date.now() });
    userInput = '';
    trackAnalytics('liveroom_message_sent', { length: txt.length });
    // Auto-reply da Sarah em 3-5s (claramente automático)
    const delay = 3000 + Math.floor(Math.random() * 2500);
    setTimeout(() => {
      const replies = [
        "thank you 🤍",
        "reading every message when I can 🤍",
        "means everything, thank you",
        "we appreciate you being here",
        "🤍",
        "thank you, sharing means so much",
        "reading in between shifts x"
      ];
      pushMsg({ from: 'sarah', text: pickRandom(replies), ts: Date.now() });
      sendingUser = false;
    }, delay);
  }

  // ── Sticky donation CTA ────────────────────────────────────────────
  const DONATION_TIERS = [
    { amount: 5, label: '15 minutes on her monitor' },
    { amount: 25, label: '1 day of pain relief' },
    { amount: 50, label: '1 week of nutrition during chemo' },
    { amount: 100, label: 'Full pre-treatment scan' },
    { amount: 200, label: 'Three chemotherapy sessions' }
  ];
  let selectedAmount = $state(50);
  let donating = $state(false);
  let quickDonating = $state<number | null>(null);
  let showDonateModal = $state(false);

  function quickDonate(amount: number) {
    if (quickDonating !== null) return;
    quickDonating = amount;

    const eventId = uuid();
    const contentId = `liveroom-${amount}`;

    trackAnalytics('amount_select', { amount, source: 'liveroom' });
    trackAnalytics('cta_click', { amount, tier: contentId, source: 'liveroom' });

    trackEvent('InitiateCheckout', {
      value: amount,
      currency: 'GBP',
      content_ids: [contentId],
      content_type: 'product',
      num_items: 1
    }, eventId);

    try {
      fetch('/api/track-ic', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({
          eventId,
          value: amount,
          currency: 'GBP',
          fbclid,
          fbp,
          fbc: fbc ?? undefined,
          userAgent: navigator.userAgent,
          sourceUrl: window.location.href,
          sid: getSid(),
          utm_source: utm?.source ?? undefined,
          utm_campaign: utm?.campaign ?? undefined
        })
      }).catch((e) => console.warn('[liveroom] CAPI IC failed', e));
    } catch (e) {
      console.warn('[liveroom] CAPI IC fetch threw', e);
    }

    const variantId = pickVariantForAmount(amount);

    setTimeout(() => {
      if (!variantId || variantId.startsWith('PLACEHOLDER')) {
        window.location.href = `/supporter?tier=${amount}&event_id=${eventId}`;
      } else {
        window.location.href = buildShopifyCartUrl({
          shopDomain: SHOPIFY_SHOP_DOMAIN,
          variantId,
          fbclid,
          fbp,
          eventId,
          utm,
          sid: getSid(),
          eid: getEid(),
          funnel: 'ellie'
        });
      }
    }, 250);
  }

  // ── Sound toggle (bipe do monitor loop) ─────────────────────────────
  let soundOn = $state(false);
  let ambientAudio: HTMLAudioElement | null = null;

  function toggleSound() {
    soundOn = !soundOn;
    trackAnalytics('liveroom_sound_toggle', { on: soundOn });
    if (!ambientAudio) return;
    if (soundOn) {
      ambientAudio.volume = 0.35;
      ambientAudio.play().catch(() => {});
    } else {
      ambientAudio.pause();
    }
  }

  // ── VSL overlay inicial ──────────────────────────────────────────────
  // Ao carregar, mostra tela cheia com botão "Watch Ellie live". Click dispara:
  //  1. Autoplay do video com som (muted=false)
  //  2. Ativa bipe do monitor
  //  3. Some o overlay
  let vslOverlayVisible = $state(true);
  let heroVideoEl: HTMLVideoElement | null = $state(null);

  function startWatching() {
    vslOverlayVisible = false;
    trackAnalytics('liveroom_vsl_click', {});
    // Video: unmute + play
    try {
      if (heroVideoEl) {
        heroVideoEl.muted = false;
        heroVideoEl.volume = 0.9;
        heroVideoEl.play().catch(() => {
          // Se o browser não deixar auto-play com som, mantém mudo mas tocando
          if (heroVideoEl) heroVideoEl.muted = true;
          heroVideoEl?.play().catch(() => {});
        });
      }
    } catch {}
    // Bipe do monitor
    try {
      if (ambientAudio) {
        soundOn = true;
        ambientAudio.volume = 0.28;
        ambientAudio.play().catch(() => {});
      }
    } catch {}
  }

  // ── Share ─────────────────────────────────────────────────────────
  function shareLive() {
    trackAnalytics('liveroom_share_click', {});
    const shareText = "Sarah is livestreaming from Ellie's hospital room. She's fighting neuroblastoma at 9 years old. Just be here with her.";
    const url = 'https://belgianpawsfoundation.org/liveroom';
    if (navigator.share) {
      navigator.share({ title: "Ellie's Live Room", text: shareText, url }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(`${shareText} ${url}`);
      showToast('Link copied — share it 🤍');
    }
  }

  let toastMsg = $state('');
  let toastShow = $state(false);
  function showToast(msg: string) {
    toastMsg = msg;
    toastShow = true;
    setTimeout(() => (toastShow = false), 2400);
  }

  // ── Timers ────────────────────────────────────────────────────────
  let liveTimer: ReturnType<typeof setInterval> | null = null;
  let viewersTimer: ReturnType<typeof setInterval> | null = null;
  let sarahMsgTimer: ReturnType<typeof setInterval> | null = null;
  let viewerChatTimer: ReturnType<typeof setInterval> | null = null;
  let sarahMsgIdx = 0;

  function loadInitialMessages() {
    // Aplica todas as mensagens iniciais de uma vez, ordenadas cronológicamente
    const now = Date.now();
    const initial: Msg[] = INITIAL_MESSAGES.map((m) => ({
      id: newMsgId(),
      from: m.from,
      text: m.text,
      ts: now - m.minutesAgo * 60_000,
      type: m.type,
      delivered: true
    }));
    messages = initial;
    setTimeout(() => {
      const feed = document.querySelector<HTMLElement>('.wa-feed');
      if (feed) feed.scrollTop = feed.scrollHeight;
    }, 60);
  }

  onMount(() => {
    // Tracking
    const tracking = captureAndPersistFbclid();
    fbclid = tracking.fbclid;
    fbc = tracking.fbc;
    utm = tracking.utm;
    setTimeout(() => { fbp = getFbp(); }, 400);

    loadInitialMessages();

    // Live timer — atualiza a cada segundo
    liveTimer = setInterval(() => {
      liveElapsedSec = Math.floor((Date.now() - liveStartTs) / 1000);
    }, 1000);

    // Viewers oscillation — sobe e desce
    viewersTimer = setInterval(() => {
      const delta = Math.floor(Math.random() * 9) - 3;
      viewers = Math.max(200, viewers + delta);
      if (viewers > peakViewers) peakViewers = viewers;
    }, 3500);

    // Nova mensagem da Sarah cada 40-90s
    function scheduleSarah() {
      const delay = 40_000 + Math.floor(Math.random() * 50_000);
      sarahMsgTimer = setTimeout(() => {
        const nextText = FUTURE_MESSAGES[sarahMsgIdx % FUTURE_MESSAGES.length];
        sarahMsgIdx += 1;
        pushMsg({ from: 'sarah', text: nextText, ts: Date.now() });
        scheduleSarah();
      }, delay);
    }
    scheduleSarah();

    // Chat de viewers cada 4-10s
    viewerChatTimer = setInterval(() => {
      pushViewer(generateViewerMsg());
    }, 5_000 + Math.floor(Math.random() * 4_000));

    // Pré-popula chat com uns 6 msgs pra não abrir vazio
    for (let i = 0; i < 6; i++) pushViewer(generateViewerMsg());

    // Ambient audio (bipe do monitor) — pré-carrega mas não toca até user permitir
    try {
      ambientAudio = new Audio('/ellie/monitor-beep.mp3');
      ambientAudio.loop = true;
    } catch {}

    trackEvent('ViewContent', {
      content_name: 'liveroom',
      content_category: 'live'
    }, uuid());
    trackAnalytics('liveroom_view', {});
  });

  onDestroy(() => {
    if (liveTimer) clearInterval(liveTimer);
    if (viewersTimer) clearInterval(viewersTimer);
    if (sarahMsgTimer) clearTimeout(sarahMsgTimer);
    if (viewerChatTimer) clearInterval(viewerChatTimer);
    ambientAudio?.pause();
  });
</script>

<svelte:head>
  <title>🔴 LIVE — Ellie's Room · Manchester Children's Hospital</title>
  <meta name="description" content="Sarah is livestreaming from her daughter's hospital room. Ellie, 9, has 42 days to save her life. Please be here with them tonight." />
  <meta name="theme-color" content="#000000" />
</svelte:head>

<!-- URGENCY BAR -->
<div class="urgency">
  <span class="urg-pulse"></span>
  <span class="urg-txt"><strong>{daysLeft} days left</strong> · Ellie needs <strong>£4,200</strong> for Monday's IVIG dose · £{(GOAL - totalRaised).toLocaleString('en-GB')} to go</span>
</div>

<!-- HEADER -->
<header class="lr-header">
  <div class="lr-brand">
    <span class="lr-live-dot"></span>
    LIVE
    <span class="lr-brand-title">Ellie's Room · Manchester Children's</span>
  </div>
  <div class="lr-header-right">
    <button class="lr-icon-btn" onclick={toggleSound} aria-label="Toggle monitor sound">
      {#if soundOn}<Volume2 size={18} />{:else}<VolumeX size={18} />{/if}
    </button>
    <button class="lr-icon-btn" onclick={shareLive} aria-label="Share live room">
      <Share2 size={18} />
    </button>
  </div>
</header>

<main class="lr-main">
  <!-- VIDEO SECTION -->
  <section class="lr-video-wrap">
    <video
      class="lr-video"
      bind:this={heroVideoEl}
      autoplay muted loop playsinline
      poster="/ellie/ellie-coma-hero.webp"
    >
      <source src="/ellie/videos/ellie-live-loop.mp4" type="video/mp4" />
    </video>

    {#if vslOverlayVisible}
      <button class="vsl-overlay" onclick={startWatching} aria-label="Watch Ellie live">
        <div class="vsl-inner">
          <div class="vsl-play-btn" aria-hidden="true">
            <VolumeX size={38} strokeWidth={2.5} />
            <span class="vsl-play-ring"></span>
            <span class="vsl-play-ring vsl-play-ring-2"></span>
          </div>
          <div class="vsl-title">Watch Ellie <span class="vsl-title-red">LIVE</span></div>
          <div class="vsl-sub">Tap to unmute · Sarah is in the room</div>
        </div>
      </button>
    {/if}

    <div class="lr-video-overlay">
      <div class="lr-live-badge">
        <span class="lr-live-dot lr-live-dot-lg"></span>
        LIVE
      </div>
      <div class="lr-video-meta">
        <span class="lr-viewers">👁 {viewers.toLocaleString('en-GB')} watching now</span>
        <span class="lr-live-time">on air · {formatElapsed(liveElapsedSec)}</span>
      </div>
    </div>

    <div class="lr-video-caption">
      <div class="lr-cap-line1">Ellie · 9 years old</div>
      <div class="lr-cap-line2">Paediatric ICU · Post-chemo recovery</div>
    </div>
  </section>

  <!-- WHATSAPP FEED -->
  <section class="lr-chat">
    <div class="lr-chat-header">
      <img class="lr-avatar" src="/ellie/sarah-avatar.jpg" alt="Sarah" />
      <div class="lr-chat-title-block">
        <div class="lr-chat-title">
          Sarah <span class="lr-chat-title-sub">Ellie's mum</span>
        </div>
        <div class="lr-online">
          <span class="lr-online-dot"></span> online now · phone in the room
        </div>
      </div>
    </div>

    <div class="wa-feed">
      {#each messages as m (m.id)}
        {#if m.from === 'system'}
          <div class="wa-system">{m.text}</div>
        {:else}
          <div class="wa-msg wa-msg-{m.from}">
            <div class="wa-bubble">
              {#if m.type === 'voice'}
                <span class="wa-voice">▶︎ {m.text}</span>
              {:else}
                {m.text}
              {/if}
              <span class="wa-ts">{formatWhen(m.ts - Date.now())}{m.from === 'you' ? ' ✓✓' : ''}</span>
            </div>
          </div>
        {/if}
      {/each}
      {#if sendingUser}
        <div class="wa-typing">Sarah is typing…</div>
      {/if}
    </div>

    <form class="wa-input" onsubmit={sendUserMessage}>
      <input
        type="text"
        placeholder="Send Sarah a message of support…"
        bind:value={userInput}
        disabled={sendingUser}
        maxlength="140"
      />
      <button type="submit" disabled={!userInput.trim() || sendingUser} aria-label="Send">
        <Send size={16} />
      </button>
    </form>
    <p class="wa-disclaimer">Auto-reply enabled while Sarah is with Ellie. Messages shared with permission 🤍</p>
  </section>
</main>

<!-- VIEWER STREAM (Twitch-style scroll) -->
<section class="lr-viewer-chat">
  <div class="lr-vc-header">
    <span class="lr-vc-live-dot"></span> Everyone in the room
  </div>
  <div class="lr-vc-stream">
    {#each viewerChat as v (v.id)}
      <div class="lr-vc-row lr-vc-{v.kind}">
        <span class="lr-vc-name">{v.name}</span>
        <span class="lr-vc-txt">
          {#if v.kind === 'donate'}💗 {v.text}
          {:else if v.kind === 'share'}📢 {v.text}
          {:else}{v.text}{/if}
        </span>
      </div>
    {/each}
  </div>
</section>

<!-- RAISED BAR -->
<section class="lr-raised">
  <div class="lr-raised-nums">
    <span class="lr-raised-current">£{totalRaised.toLocaleString('en-GB')}</span>
    <span class="lr-raised-sep">/</span>
    <span class="lr-raised-goal">£{GOAL.toLocaleString('en-GB')}</span>
  </div>
  <div class="lr-raised-track">
    <div class="lr-raised-fill" style:width="{raisedPct}%"></div>
  </div>
  <div class="lr-raised-hint">Monday's dose needed by 8pm Sunday</div>
</section>

<!-- QUICK DONATE TIERS -->
<section class="lr-tiers">
  <h3 class="lr-tiers-title">Every pound keeps her monitor on. Every donation ends up on Ellie's chart.</h3>
  <div class="lr-tier-grid">
    {#each DONATION_TIERS as t}
      <button
        class="lr-tier"
        class:lr-tier-popular={t.amount === 50}
        onclick={() => quickDonate(t.amount)}
        disabled={quickDonating !== null}
      >
        {#if t.amount === 50}
          <span class="lr-tier-badge">Most given tonight</span>
        {/if}
        <span class="lr-tier-amount">£{t.amount}</span>
        <span class="lr-tier-label">{t.label}</span>
        {#if quickDonating === t.amount}
          <span class="lr-tier-loading">Redirecting…</span>
        {:else}
          <span class="lr-tier-cta">Donate now →</span>
        {/if}
      </button>
    {/each}
  </div>
</section>

<!-- STICKY BOTTOM CTA -->
<div class="lr-sticky">
  <button class="lr-sticky-btn" onclick={() => quickDonate(50)} disabled={quickDonating !== null}>
    <Heart size={18} fill="currentColor" />
    <span>Save Ellie tonight — £50</span>
    <span class="lr-sticky-pulse"></span>
  </button>
</div>

{#if toastShow}
  <div class="lr-toast">{toastMsg}</div>
{/if}

<style>
  :global(html), :global(body) { background: #ffffff; }
  :global(body) {
    color: #0f172a;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    margin: 0;
  }

  /* URGENCY BAR */
  .urgency {
    background: #DC2626;
    color: #fff;
    padding: 8px 14px;
    text-align: center;
    font-size: 0.8125rem;
    font-weight: 600;
    letter-spacing: 0.01em;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    position: sticky;
    top: 0;
    z-index: 50;
  }
  .urg-pulse {
    display: inline-block;
    width: 10px; height: 10px;
    border-radius: 50%;
    background: #fff;
    animation: urgPulse 1.4s ease-in-out infinite;
  }
  @keyframes urgPulse {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.4); opacity: 0.4; }
  }

  /* HEADER */
  .lr-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: #ffffff;
    border-bottom: 1px solid #e5e7eb;
    position: sticky;
    top: 34px;
    z-index: 40;
  }
  .lr-brand {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 700;
    font-size: 0.875rem;
    letter-spacing: 0.05em;
    color: #0f172a;
  }
  .lr-brand-title {
    color: #6b7280;
    font-weight: 500;
    margin-left: 8px;
    font-size: 0.8125rem;
  }
  .lr-live-dot {
    width: 8px; height: 8px;
    background: #DC2626;
    border-radius: 50%;
    animation: livePulse 1.6s ease-in-out infinite;
  }
  .lr-live-dot-lg { width: 10px; height: 10px; }
  @keyframes livePulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(220,38,38,0.7); }
    50% { box-shadow: 0 0 0 8px rgba(220,38,38,0); }
  }
  .lr-header-right { display: flex; gap: 6px; }
  .lr-icon-btn {
    background: transparent;
    border: 1px solid #e5e7eb;
    color: #475569;
    width: 34px; height: 34px;
    border-radius: 8px;
    display: inline-flex;
    align-items: center; justify-content: center;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
  }
  .lr-icon-btn:hover { background: #f1f5f9; border-color: #cbd5e1; }

  /* MAIN GRID */
  .lr-main {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0;
    max-width: 1200px;
    margin: 0 auto;
  }
  @media (min-width: 900px) {
    .lr-main {
      grid-template-columns: 1.35fr 1fr;
      gap: 1px;
      background: #e5e7eb;
    }
  }

  /* VIDEO */
  .lr-video-wrap {
    position: relative;
    background: #000;
    aspect-ratio: 9 / 16;
    max-height: 78vh;
    overflow: hidden;
  }
  @media (min-width: 900px) {
    .lr-video-wrap {
      aspect-ratio: auto;
      max-height: none;
      height: 100%;
      min-height: 640px;
    }
  }
  .lr-video {
    width: 100%; height: 100%;
    object-fit: cover;
    object-position: center center;
    display: block;
  }
  .lr-video-overlay {
    position: absolute;
    top: 12px; left: 12px; right: 12px;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    pointer-events: none;
  }
  .lr-live-badge {
    background: rgba(220,38,38,0.95);
    color: #fff;
    font-weight: 800;
    font-size: 0.75rem;
    letter-spacing: 0.1em;
    padding: 6px 10px;
    border-radius: 4px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .lr-video-meta {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 4px;
    text-align: right;
  }
  .lr-viewers, .lr-live-time {
    background: rgba(0,0,0,0.6);
    backdrop-filter: blur(6px);
    color: #fff;
    font-size: 0.75rem;
    padding: 4px 8px;
    border-radius: 4px;
    font-variant-numeric: tabular-nums;
    font-weight: 600;
  }
  .lr-video-caption {
    position: absolute;
    bottom: 14px; left: 14px;
    background: rgba(0,0,0,0.55);
    backdrop-filter: blur(8px);
    padding: 10px 14px;
    border-radius: 6px;
    border-left: 3px solid #DC2626;
  }
  .lr-cap-line1 {
    font-weight: 700;
    font-size: 0.9375rem;
    color: #fff;
  }
  .lr-cap-line2 {
    font-size: 0.75rem;
    color: #d4d4d4;
    margin-top: 2px;
  }

  /* CHAT (WhatsApp feed) */
  .lr-chat {
    display: flex;
    flex-direction: column;
    background: #ffffff;
    min-height: 500px;
  }
  @media (min-width: 900px) {
    .lr-chat { height: 100%; }
  }
  .lr-chat-header {
    padding: 14px 16px;
    background: #075E54;
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .lr-avatar {
    width: 42px; height: 42px;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid #128C7E;
  }
  .lr-chat-title-block { flex: 1; min-width: 0; }
  .lr-chat-title {
    color: #fff;
    font-weight: 700;
    font-size: 0.9375rem;
    line-height: 1.1;
  }
  .lr-chat-title-sub {
    color: #DCF8C6;
    font-weight: 400;
    font-size: 0.75rem;
    margin-left: 6px;
  }
  .lr-online {
    color: #DCF8C6;
    font-size: 0.75rem;
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 2px;
  }
  .lr-online-dot {
    width: 7px; height: 7px;
    background: #6EE7B7;
    border-radius: 50%;
    box-shadow: 0 0 6px rgba(110,231,183,0.7);
  }

  .wa-feed {
    flex: 1;
    padding: 16px 12px;
    overflow-y: auto;
    background:
      linear-gradient(rgba(239, 234, 226, 0.85), rgba(239, 234, 226, 0.85)),
      url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 40 40'><circle cx='20' cy='20' r='0.6' fill='%23a8a29e77'/></svg>");
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-height: 480px;
  }
  @media (min-width: 900px) {
    .wa-feed { max-height: none; }
  }
  .wa-system {
    align-self: center;
    background: #fef3c7;
    color: #78350f;
    font-size: 0.75rem;
    padding: 5px 10px;
    border-radius: 12px;
    margin: 6px 0;
    box-shadow: 0 1px 1px rgba(0,0,0,0.05);
  }
  .wa-msg { display: flex; }
  .wa-msg-sarah { justify-content: flex-start; }
  .wa-msg-you { justify-content: flex-end; }
  .wa-bubble {
    max-width: 78%;
    padding: 8px 12px 5px;
    border-radius: 8px;
    font-size: 0.9375rem;
    line-height: 1.35;
    color: #0f172a;
    position: relative;
    box-shadow: 0 1px 1px rgba(0,0,0,0.12);
    word-wrap: break-word;
  }
  .wa-msg-sarah .wa-bubble {
    background: #ffffff;
    border-top-left-radius: 2px;
  }
  .wa-msg-you .wa-bubble {
    background: #d9fdd3;
    color: #0f172a;
    border-top-right-radius: 2px;
  }
  .wa-ts {
    display: block;
    font-size: 0.6875rem;
    color: rgba(15,23,42,0.45);
    text-align: right;
    margin-top: 2px;
    letter-spacing: 0.01em;
  }
  .wa-voice {
    display: inline-block;
    padding: 4px 8px;
    background: #f3f4f6;
    border-radius: 6px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.8125rem;
    color: #0f6e5a;
  }
  .wa-typing {
    align-self: flex-start;
    color: #6b7280;
    font-size: 0.8125rem;
    font-style: italic;
    padding: 4px 12px;
  }

  .wa-input {
    display: flex;
    gap: 8px;
    padding: 10px 12px;
    background: #f0f2f5;
    border-top: 1px solid #e5e7eb;
  }
  .wa-input input {
    flex: 1;
    background: #ffffff;
    border: none;
    color: #0f172a;
    padding: 10px 14px;
    border-radius: 24px;
    font-family: inherit;
    font-size: 0.9375rem;
    outline: none;
    box-shadow: 0 1px 1px rgba(0,0,0,0.05);
  }
  .wa-input input::placeholder { color: #9ca3af; }
  .wa-input button {
    background: #25D366;
    border: none;
    color: #fff;
    width: 40px; height: 40px;
    border-radius: 50%;
    display: inline-flex;
    align-items: center; justify-content: center;
    cursor: pointer;
    transition: background 0.15s, transform 0.1s;
  }
  .wa-input button:hover:not(:disabled) { background: #1EBE57; }
  .wa-input button:active:not(:disabled) { transform: scale(0.94); }
  .wa-input button:disabled { opacity: 0.4; cursor: not-allowed; }
  .wa-disclaimer {
    margin: 0;
    padding: 8px 14px 14px;
    background: #f0f2f5;
    color: #64748b;
    font-size: 0.6875rem;
    text-align: center;
  }

  /* VIEWER CHAT (Twitch-style) */
  .lr-viewer-chat {
    background: #f9fafb;
    border-top: 1px solid #e5e7eb;
    padding: 14px 16px 16px;
  }
  .lr-vc-header {
    color: #6b7280;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
    font-weight: 700;
  }
  .lr-vc-live-dot {
    width: 8px; height: 8px;
    background: #DC2626;
    border-radius: 50%;
    animation: livePulse 1.6s ease-in-out infinite;
  }
  .lr-vc-stream {
    max-height: 200px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding-right: 4px;
  }
  .lr-vc-row {
    font-size: 0.8125rem;
    line-height: 1.4;
    color: #374151;
    animation: vcSlideIn 0.35s ease-out;
  }
  @keyframes vcSlideIn {
    from { opacity: 0; transform: translateX(-6px); }
    to { opacity: 1; transform: translateX(0); }
  }
  .lr-vc-name {
    font-weight: 700;
    color: #4f46e5;
    margin-right: 6px;
  }
  .lr-vc-donate .lr-vc-name { color: #15803d; }
  .lr-vc-donate .lr-vc-txt { color: #166534; font-weight: 600; }
  .lr-vc-share .lr-vc-name { color: #b45309; }
  .lr-vc-share .lr-vc-txt { color: #92400e; }

  /* RAISED BAR */
  .lr-raised {
    background: #ffffff;
    padding: 22px 20px 18px;
    text-align: center;
    border-top: 1px solid #e5e7eb;
  }
  .lr-raised-nums {
    font-size: 1.5rem;
    font-weight: 800;
    color: #0f172a;
    letter-spacing: -0.01em;
    margin-bottom: 12px;
  }
  .lr-raised-current { color: #16A34A; }
  .lr-raised-sep { color: #cbd5e1; margin: 0 6px; }
  .lr-raised-goal { color: #64748b; font-weight: 500; font-size: 1.125rem; }
  .lr-raised-track {
    width: 100%;
    max-width: 520px;
    margin: 0 auto;
    height: 10px;
    background: #f1f5f9;
    border-radius: 6px;
    overflow: hidden;
  }
  .lr-raised-fill {
    height: 100%;
    background: linear-gradient(90deg, #16A34A, #22C55E);
    border-radius: 6px;
    transition: width 0.6s cubic-bezier(0.16, 1, 0.3, 1);
    box-shadow: 0 0 12px rgba(34, 197, 94, 0.5);
  }
  .lr-raised-hint {
    margin-top: 8px;
    font-size: 0.75rem;
    color: #DC2626;
    font-weight: 600;
    letter-spacing: 0.02em;
  }

  /* TIERS */
  .lr-tiers {
    padding: 24px 16px 100px;
    max-width: 720px;
    margin: 0 auto;
    background: #ffffff;
  }
  .lr-tiers-title {
    font-size: 1rem;
    color: #0f172a;
    font-weight: 600;
    text-align: center;
    margin: 0 0 18px;
    line-height: 1.4;
  }
  .lr-tier-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  @media (min-width: 640px) {
    .lr-tier-grid { grid-template-columns: repeat(3, 1fr); }
  }
  .lr-tier {
    position: relative;
    background: #ffffff;
    border: 1.5px solid #e5e7eb;
    color: #0f172a;
    padding: 16px 12px 14px;
    border-radius: 12px;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    text-align: center;
    transition: border-color 0.15s, transform 0.1s, background 0.15s, box-shadow 0.15s;
    font-family: inherit;
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  }
  .lr-tier:hover:not(:disabled) { border-color: #DC2626; background: #fef2f2; box-shadow: 0 4px 12px rgba(220,38,38,0.12); }
  .lr-tier:active:not(:disabled) { transform: scale(0.98); }
  .lr-tier:disabled { opacity: 0.5; cursor: progress; }
  .lr-tier-popular {
    border-color: #DC2626;
    background: linear-gradient(180deg, #fef2f2, #ffffff);
  }
  .lr-tier-badge {
    position: absolute;
    top: -8px;
    left: 50%;
    transform: translateX(-50%);
    background: #DC2626;
    color: #fff;
    font-size: 0.625rem;
    font-weight: 700;
    padding: 3px 10px;
    border-radius: 4px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    white-space: nowrap;
  }
  .lr-tier-amount {
    font-size: 1.375rem;
    font-weight: 800;
    color: #0f172a;
    line-height: 1;
    margin-top: 4px;
  }
  .lr-tier-label {
    font-size: 0.6875rem;
    color: #64748b;
    line-height: 1.3;
    min-height: 28px;
  }
  .lr-tier-cta {
    font-size: 0.75rem;
    color: #DC2626;
    font-weight: 700;
    margin-top: 4px;
  }
  .lr-tier-loading {
    font-size: 0.75rem;
    color: #b45309;
    font-weight: 600;
    margin-top: 4px;
  }

  /* STICKY CTA */
  .lr-sticky {
    position: fixed;
    bottom: 0; left: 0; right: 0;
    padding: 10px 14px calc(10px + env(safe-area-inset-bottom));
    background: linear-gradient(180deg, rgba(255,255,255,0), rgba(255,255,255,0.98) 30%);
    z-index: 60;
  }
  .lr-sticky-btn {
    width: 100%;
    max-width: 520px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    background: linear-gradient(180deg, #DC2626, #B91C1C);
    color: #fff;
    border: none;
    padding: 15px 22px;
    font-size: 1rem;
    font-weight: 700;
    border-radius: 12px;
    cursor: pointer;
    box-shadow: 0 6px 24px rgba(220,38,38,0.5);
    position: relative;
    margin: 0 auto;
    letter-spacing: 0.01em;
    animation: stickyBounce 2.8s ease-in-out infinite;
  }
  .lr-sticky-btn:hover:not(:disabled) { transform: translateY(-1px); }
  .lr-sticky-btn:active:not(:disabled) { transform: scale(0.98); }
  .lr-sticky-btn:disabled { opacity: 0.7; cursor: progress; }
  .lr-sticky-pulse {
    position: absolute;
    inset: 0;
    border-radius: 12px;
    box-shadow: 0 0 0 0 rgba(220,38,38,0.6);
    animation: stickyPulse 1.8s ease-out infinite;
    pointer-events: none;
  }
  @keyframes stickyBounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-2px); }
  }
  @keyframes stickyPulse {
    0% { box-shadow: 0 0 0 0 rgba(220,38,38,0.6); }
    70% { box-shadow: 0 0 0 18px rgba(220,38,38,0); }
    100% { box-shadow: 0 0 0 0 rgba(220,38,38,0); }
  }

  /* TOAST */
  .lr-toast {
    position: fixed;
    bottom: 90px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0,0,0,0.9);
    color: #fff;
    padding: 12px 20px;
    border-radius: 24px;
    font-size: 0.875rem;
    font-weight: 600;
    z-index: 70;
    box-shadow: 0 8px 24px rgba(0,0,0,0.5);
    animation: toastIn 0.3s ease-out;
  }
  @keyframes toastIn {
    from { opacity: 0; transform: translate(-50%, 10px); }
    to { opacity: 1; transform: translate(-50%, 0); }
  }

  /* VSL OVERLAY (tela cheia inicial pra clicar e assistir) */
  .vsl-overlay {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.85) 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    cursor: pointer;
    z-index: 20;
    backdrop-filter: blur(3px);
    -webkit-backdrop-filter: blur(3px);
    color: #fff;
    padding: 24px;
    text-align: center;
    font-family: inherit;
    animation: vslFadeIn 0.4s ease-out;
  }
  @keyframes vslFadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  .vsl-inner {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 22px;
    max-width: 400px;
  }
  .vsl-play-btn {
    position: relative;
    width: 100px;
    height: 100px;
    border-radius: 50%;
    background: rgba(220, 38, 38, 0.95);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 12px 40px rgba(220, 38, 38, 0.45);
  }
  .vsl-play-ring {
    position: absolute;
    inset: -6px;
    border-radius: 50%;
    border: 2px solid rgba(220, 38, 38, 0.7);
    animation: vslRingPulse 2s ease-out infinite;
  }
  .vsl-play-ring-2 { animation-delay: 1s; }
  @keyframes vslRingPulse {
    0% { transform: scale(1); opacity: 0.9; }
    100% { transform: scale(1.5); opacity: 0; }
  }
  .vsl-title {
    font-size: 1.75rem;
    font-weight: 800;
    letter-spacing: -0.01em;
    line-height: 1.15;
    color: #fff;
  }
  .vsl-title-red {
    color: #FCA5A5;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .vsl-title-red::before {
    content: '';
    display: inline-block;
    width: 10px; height: 10px;
    border-radius: 50%;
    background: #DC2626;
    animation: livePulse 1.6s ease-in-out infinite;
  }
  .vsl-sub {
    font-size: 0.9375rem;
    color: rgba(255,255,255,0.85);
    font-weight: 500;
    letter-spacing: 0.01em;
  }
  .vsl-overlay:hover .vsl-play-btn { transform: scale(1.05); transition: transform 0.15s; }
  .vsl-overlay:active .vsl-play-btn { transform: scale(0.96); }
</style>
