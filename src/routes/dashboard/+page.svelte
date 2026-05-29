<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  let { data } = $props();

  // ── State ──
  type Tab = 'overview' | 'live' | 'funnel' | 'vsl' | 'heatmap' | 'sessions' | 'revenue' | 'tech';
  let activeTab = $state<Tab>('overview');
  let win = $state<'2m' | '15m' | '1h' | '6h' | '24h' | '7d'>('24h');
  let pathFilter = $state<'' | '/' | '/donate' | '/vsl'>('');
  let deviceFilter = $state<'' | 'mobile' | 'desktop' | 'tablet'>('');
  let countryFilter = $state('');
  let includeBots = $state(false);
  let snap = $state<any>(null);
  let lastUpdate = $state(0);
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let sidebarOpen = $state(true);
  let mobileMenuOpen = $state(false);
  let mobileFiltersOpen = $state(false);
  let detailSid = $state<string | null>(null);
  let detailData = $state<any>(null);

  // ── Fetch ──
  async function pull() {
    const params = new URLSearchParams({ window: win });
    if (pathFilter) params.set('path', pathFilter);
    if (deviceFilter) params.set('device', deviceFilter);
    if (countryFilter) params.set('country', countryFilter);
    if (includeBots) params.set('bots', '1');
    try {
      const r = await fetch(`/api/analytics?${params}`, { cache: 'no-store' });
      if (!r.ok) return;
      snap = await r.json();
      lastUpdate = Date.now();
    } catch {}
  }

  async function openSession(sid: string) {
    detailSid = sid;
    detailData = null;
    try {
      const r = await fetch(`/api/analytics/session/${sid}`);
      if (r.ok) detailData = await r.json();
    } catch {}
  }
  function closeDetail() {
    detailSid = null;
    detailData = null;
  }

  onMount(() => {
    if (!data.authed) return;
    pull();
    pollTimer = setInterval(pull, 3000);
  });
  onDestroy(() => { if (pollTimer) clearInterval(pollTimer); });

  $effect(() => {
    if (!data.authed) return;
    const _ = win + pathFilter + deviceFilter + countryFilter + includeBots;
    pull();
  });

  // ── Reset ──
  let resetting = $state(false);
  let toastMsg = $state('');
  async function resetData() {
    if (!confirm('Zerar TODOS os dados? Ação irreversível.')) return;
    resetting = true;
    try {
      const r = await fetch('/api/analytics/reset', { method: 'POST' });
      const out = await r.json();
      toastMsg = `Zerado: ${out.cleared.events} eventos · ${out.cleared.sessions} sessões`;
      await pull();
    } catch (e: any) {
      toastMsg = `Erro: ${e.message}`;
    }
    resetting = false;
    setTimeout(() => (toastMsg = ''), 4000);
  }

  // ── Helpers ──
  const fmtNum = (n: number) => n.toLocaleString('pt-BR');
  const fmtPct = (n: number) => (n * 100).toFixed(1) + '%';
  const fmtDelta = (n: number) => (n >= 0 ? '+' : '') + (n * 100).toFixed(1) + '%';
  const fmtEur = (n: number) => '€' + n.toFixed(2).replace('.', ',');
  function fmtDuration(sec: number): string {
    if (sec < 60) return `${sec}s`;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}m${s.toString().padStart(2, '0')}s`;
  }
  function fmtMs(ms: number): string {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }
  function fmtTime(ts: number): string {
    return new Date(ts).toLocaleTimeString('pt-BR', { hour12: false });
  }
  function flagFor(code?: string): string {
    if (!code || code.length !== 2) return '🌐';
    return code.toUpperCase().replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
  }
  function evIcon(ev: string): string {
    return ({
      pageview: '◐', scroll_depth: '↓', scroll_back: '↑', cta_click: '⌘',
      amount_select: '€', bancontact_click: '✓', purchase: '★',
      vsl_play_with_sound: '🔊', vsl_quartile: '▶', vsl_rewatch: '⟲', vsl_complete: '◉',
      web_vital: '⏱', js_error: '⚠', section_view: '▦',
      click_heatmap: '•', rage_click: '⚡', dead_click: '✕'
    } as any)[ev] || '·';
  }
  function evColor(ev: string): string {
    if (ev === 'purchase') return '#f9d65b';
    if (ev === 'bancontact_click') return '#00d97e';
    if (ev === 'rage_click' || ev === 'js_error') return '#ff5b5b';
    if (ev.startsWith('vsl_')) return '#a78bfa';
    return '#7cdbfa';
  }
  function evLabel(ev: string): string {
    return ev.replace(/_/g, ' ');
  }
  function devIcon(d: string): string {
    return d === 'mobile' ? '📱' : d === 'tablet' ? '📲' : '🖥';
  }

  // Delta KPIs
  function deltaClass(d: number) {
    if (d > 0.01) return 'up';
    if (d < -0.01) return 'down';
    return 'flat';
  }

  // ── Charts SVG ──
  const PALETTE = ['#02a95c', '#1de9b6', '#4dd0e1', '#a78bfa', '#ff7043', '#ffd54f', '#ec407a', '#26c6da'];

  function donutPaths(items: { label: string; value: number; color: string }[]) {
    const total = items.reduce((a, b) => a + b.value, 0);
    if (total === 0) return [];
    let acc = 0;
    const r = 56;
    const cx = 70;
    const cy = 70;
    return items.map((it) => {
      const startAngle = (acc / total) * 2 * Math.PI - Math.PI / 2;
      acc += it.value;
      const endAngle = (acc / total) * 2 * Math.PI - Math.PI / 2;
      const x1 = cx + r * Math.cos(startAngle);
      const y1 = cy + r * Math.sin(startAngle);
      const x2 = cx + r * Math.cos(endAngle);
      const y2 = cy + r * Math.sin(endAngle);
      const large = endAngle - startAngle > Math.PI ? 1 : 0;
      const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
      return { ...it, d, pct: it.value / total };
    });
  }

  function sparkPath(series: any[], key = 'pv'): string {
    if (!series.length) return '';
    const w = 800, h = 100;
    const max = Math.max(1, ...series.map((p) => p[key]));
    const dx = w / Math.max(1, series.length - 1);
    return series
      .map((p, i) => {
        const x = i * dx;
        const y = h - (p[key] / max) * h;
        return (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1);
      })
      .join(' ');
  }
  function sparkArea(series: any[], key = 'pv'): string {
    const line = sparkPath(series, key);
    if (!line) return '';
    return line + ` L 800 100 L 0 100 Z`;
  }

  // Derivacoes
  const utmItems = $derived(
    snap?.utmBreakdown
      ? snap.utmBreakdown.slice(0, 6).map((u: any, i: number) => ({
          label: u.source, value: u.count, color: PALETTE[i % PALETTE.length]
        }))
      : []
  );
  const deviceItems = $derived(
    snap?.deviceCounts
      ? [
          { label: 'Mobile', value: snap.deviceCounts.mobile, color: PALETTE[0] },
          { label: 'Desktop', value: snap.deviceCounts.desktop, color: PALETTE[2] },
          { label: 'Tablet', value: snap.deviceCounts.tablet, color: PALETTE[4] }
        ].filter((x) => x.value > 0)
      : []
  );
  const browserItems = $derived(
    snap?.browserBreakdown
      ? snap.browserBreakdown.slice(0, 6).map((b: any, i: number) => ({
          label: b.browser, value: b.count, color: PALETTE[i % PALETTE.length]
        }))
      : []
  );

  let updateAgoSec = $state(0);
  let agoTimer: ReturnType<typeof setInterval> | null = null;
  onMount(() => {
    agoTimer = setInterval(() => {
      updateAgoSec = lastUpdate ? Math.round((Date.now() - lastUpdate) / 1000) : 0;
    }, 1000);
  });
  onDestroy(() => { if (agoTimer) clearInterval(agoTimer); });

  function vitalGrade(metric: 'lcp' | 'inp' | 'cls', val: number): 'good' | 'ok' | 'bad' {
    if (metric === 'lcp') return val < 2500 ? 'good' : val < 4000 ? 'ok' : 'bad';
    if (metric === 'inp') return val < 200 ? 'good' : val < 500 ? 'ok' : 'bad';
    if (metric === 'cls') return val < 0.1 ? 'good' : val < 0.25 ? 'ok' : 'bad';
    return 'ok';
  }
</script>

<svelte:head>
  <title>Vitrack</title>
  <link rel="icon" type="image/png" href="/dashboard/vitrack-favicon.png" />
  <meta name="robots" content="noindex" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap" />
</svelte:head>

{#if !data.authed}
  <div class="login-wrap">
    <form method="POST" action="?/login" class="login-card">
      <div class="login-brand">
        <img src="/dashboard/vitrack-logo.png" alt="Vitrack" class="brand-logo" />
      </div>
      <p>Acesso restrito. Insira o token de acesso.</p>
      <input type="password" name="token" placeholder="Token" autofocus autocomplete="current-password" />
      <button type="submit">Entrar</button>
    </form>
  </div>
{:else}
<div class="app" class:sidebar-collapsed={!sidebarOpen} class:mobile-menu-open={mobileMenuOpen}>

  {#if mobileMenuOpen}
    <button class="mobile-backdrop" aria-label="fechar menu" onclick={() => (mobileMenuOpen = false)}></button>
  {/if}

  <!-- Sidebar -->
  <aside class="sidebar" class:mobile-open={mobileMenuOpen}>
    <div class="sidebar-brand">
      {#if sidebarOpen}
        <img src="/dashboard/vitrack-logo.png" alt="Vitrack" class="brand-logo-side" />
      {:else}
        <img src="/dashboard/vitrack-favicon.png" alt="Vitrack" class="brand-favicon-side" />
      {/if}
    </div>
    <nav class="nav">
      {#each [
        { id: 'overview', label: 'Visão geral', icon: '◐' },
        { id: 'live', label: 'Live', icon: '●' },
        { id: 'funnel', label: 'Funil', icon: '⊞' },
        { id: 'vsl', label: 'VSL', icon: '▶' },
        { id: 'heatmap', label: 'Heatmap', icon: '◉' },
        { id: 'sessions', label: 'Sessões', icon: '☰' },
        { id: 'revenue', label: 'Receita', icon: '€' },
        { id: 'tech', label: 'Performance', icon: '⏱' }
      ] as item}
        <button class="nav-item" class:active={activeTab === item.id} onclick={() => { activeTab = item.id as Tab; mobileMenuOpen = false; }}>
          <span class="nav-icon">{item.icon}</span>
          <span class="nav-label" class:hidden-collapsed={!sidebarOpen}>{item.label}</span>
        </button>
      {/each}
    </nav>
    <div class="sidebar-foot">
      <button class="collapse-btn" onclick={() => (sidebarOpen = !sidebarOpen)}>
        {sidebarOpen ? '⟨⟨' : '⟩⟩'}
      </button>
    </div>
  </aside>

  <!-- Main -->
  <main class="main">
    <!-- Topbar -->
    <header class="topbar">
      <div class="topbar-left">
        <button class="hamburger" aria-label="abrir menu" onclick={() => (mobileMenuOpen = true)}>
          <span></span><span></span><span></span>
        </button>
        <div class="topbar-title-block">
          <h1 class="page-title">{activeTab[0].toUpperCase() + activeTab.slice(1)}</h1>
          <span class="status">
            <span class="status-dot" class:on={updateAgoSec < 6}></span>
            <span class="status-text">{updateAgoSec < 6 ? `live · ${updateAgoSec}s` : `${updateAgoSec}s atrás`}</span>
          </span>
        </div>
        <button class="filters-toggle" aria-label="filtros" onclick={() => (mobileFiltersOpen = !mobileFiltersOpen)}>
          {mobileFiltersOpen ? '✕' : '⌥'}
        </button>
      </div>
      <div class="topbar-right" class:mobile-open={mobileFiltersOpen}>
        <select bind:value={win} class="select">
          <option value="2m">Últimos 2 min</option>
          <option value="15m">15 min</option>
          <option value="1h">1 hora</option>
          <option value="6h">6 horas</option>
          <option value="24h">24 horas</option>
          <option value="7d">7 dias</option>
        </select>
        <select bind:value={pathFilter} class="select">
          <option value="">Todas as rotas</option>
          <option value="/">/ (LP)</option>
          <option value="/donate">/donate</option>
          <option value="/vsl">/vsl</option>
        </select>
        <select bind:value={deviceFilter} class="select">
          <option value="">Todos devices</option>
          <option value="mobile">Mobile</option>
          <option value="desktop">Desktop</option>
          <option value="tablet">Tablet</option>
        </select>
        <input class="select country-input" placeholder="País (ex: BE)" bind:value={countryFilter} maxlength="2" />
        <label class="toggle">
          <input type="checkbox" bind:checked={includeBots} />
          <span>Bots</span>
        </label>
        <button class="btn-reset" onclick={resetData} disabled={resetting} title="Zerar todos os dados">
          {resetting ? '…' : 'Reset'}
        </button>
      </div>
    </header>

    {#if toastMsg}
      <div class="toast">{toastMsg}</div>
    {/if}

    {#if !snap}
      <div class="loading">
        <div class="spinner"></div>
        <span>Carregando dados…</span>
      </div>
    {:else}

      {#if activeTab === 'overview'}
        <!-- KPIs -->
        <section class="kpi-grid">
          <div class="kpi kpi-live">
            <div class="kpi-label">Online agora</div>
            <div class="kpi-value">{snap.kpis.online}</div>
            <div class="kpi-sub">visitantes ativos · últimos 2 min</div>
            <div class="kpi-breakdown">
              <span class="kpi-chip" title="Visitantes em / (LP)">
                <span class="kpi-chip-dot" style="background:#02a95c"></span>
                <span class="kpi-chip-label">LP</span>
                <strong>{snap.kpis.onlineLp ?? 0}</strong>
              </span>
              <span class="kpi-chip" title="Visitantes em /donate">
                <span class="kpi-chip-dot" style="background:#ffd54f"></span>
                <span class="kpi-chip-label">/donate</span>
                <strong>{snap.kpis.onlineDonate ?? 0}</strong>
              </span>
              <span class="kpi-chip" title="Visitantes em /vsl">
                <span class="kpi-chip-dot" style="background:#a78bfa"></span>
                <span class="kpi-chip-label">/vsl</span>
                <strong>{snap.kpis.onlineVsl ?? 0}</strong>
              </span>
            </div>
          </div>
          <div class="kpi">
            <div class="kpi-label">Sessões na janela</div>
            <div class="kpi-value">{fmtNum(snap.kpis.totalSessions)}</div>
            <div class="kpi-sub kpi-delta {deltaClass(snap.compare.sessions.delta)}">
              {fmtDelta(snap.compare.sessions.delta)} vs período anterior
            </div>
          </div>
          <div class="kpi">
            <div class="kpi-label">Pageviews</div>
            <div class="kpi-value">{fmtNum(snap.kpis.pageviews)}</div>
            <div class="kpi-sub kpi-delta {deltaClass(snap.compare.pageviews.delta)}">
              {fmtDelta(snap.compare.pageviews.delta)}
            </div>
          </div>
          <div class="kpi">
            <div class="kpi-label">Receita</div>
            <div class="kpi-value">{fmtEur(snap.kpis.revenue)}</div>
            <div class="kpi-sub kpi-delta {deltaClass(snap.compare.revenue.delta)}">
              {fmtDelta(snap.compare.revenue.delta)} · {snap.kpis.purchased} pedidos
            </div>
          </div>
          <div class="kpi">
            <div class="kpi-label">Conversão</div>
            <div class="kpi-value">{fmtPct(snap.kpis.conversionRate)}</div>
            <div class="kpi-sub kpi-delta {deltaClass(snap.compare.conversion.delta)}">
              {fmtDelta(snap.compare.conversion.delta)} · sessões → Bancontact
            </div>
          </div>
          <div class="kpi">
            <div class="kpi-label">Tempo médio</div>
            <div class="kpi-value">{fmtDuration(snap.kpis.avgSessionDurationSec)}</div>
            <div class="kpi-sub">duração da sessão</div>
          </div>
        </section>

        <!-- Time series -->
        <section class="card card-wide">
          <div class="card-head">
            <h2>Atividade em tempo real</h2>
            <span class="muted small">pageviews e sessões na janela</span>
          </div>
          {#if snap.timeSeries.length}
            <svg viewBox="0 0 800 100" class="spark" preserveAspectRatio="none">
              <defs>
                <linearGradient id="gradPv" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="#02a95c" stop-opacity="0.4" />
                  <stop offset="100%" stop-color="#02a95c" stop-opacity="0" />
                </linearGradient>
              </defs>
              <path d={sparkArea(snap.timeSeries)} fill="url(#gradPv)" />
              <path d={sparkPath(snap.timeSeries)} stroke="#02a95c" stroke-width="2" fill="none" />
            </svg>
            <div class="time-axis">
              <span>{new Date(snap.timeSeries[0].t).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
              <span>{new Date(snap.timeSeries[snap.timeSeries.length - 1].t).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          {/if}
        </section>

        <div class="two-col">
          <section class="card">
            <h2>Origem do tráfego</h2>
            {#if utmItems.length === 0}
              <p class="muted">Sem dados.</p>
            {:else}
              <div class="donut-wrap">
                <svg viewBox="0 0 140 140" class="donut">
                  {#each donutPaths(utmItems) as slice}
                    <path d={slice.d} fill={slice.color} />
                  {/each}
                  <circle cx="70" cy="70" r="32" fill="#0d1117" />
                  <text x="70" y="72" text-anchor="middle" fill="#fff" font-size="12" font-weight="600">{snap.kpis.totalSessions}</text>
                </svg>
                <div class="legend">
                  {#each utmItems as it}
                    <div class="legend-row">
                      <span class="legend-dot" style="background: {it.color}"></span>
                      <span class="legend-label">{it.label}</span>
                      <span class="legend-val">{it.value}</span>
                    </div>
                  {/each}
                </div>
              </div>
            {/if}
          </section>
          <section class="card">
            <h2>Países</h2>
            {#if !snap.geoBreakdown.length}<p class="muted">Sem dados geográficos.</p>{:else}
              {#each snap.geoBreakdown.slice(0, 8) as g}
                <div class="bar-row">
                  <div class="bar-label">{flagFor(g.countryCode)} {g.country}</div>
                  <div class="bar-wrap">
                    <div class="bar-fill" style="width: {(g.count / snap.geoBreakdown[0].count) * 100}%"></div>
                  </div>
                  <div class="bar-val">{g.count}</div>
                </div>
              {/each}
            {/if}
          </section>
        </div>

        <div class="two-col">
          <section class="card">
            <h2>Dispositivos</h2>
            {#if deviceItems.length === 0}<p class="muted">—</p>{:else}
              <div class="donut-wrap">
                <svg viewBox="0 0 140 140" class="donut">
                  {#each donutPaths(deviceItems) as slice}<path d={slice.d} fill={slice.color} />{/each}
                  <circle cx="70" cy="70" r="32" fill="#0d1117" />
                </svg>
                <div class="legend">
                  {#each deviceItems as it}
                    <div class="legend-row"><span class="legend-dot" style="background: {it.color}"></span><span class="legend-label">{it.label}</span><span class="legend-val">{it.value}</span></div>
                  {/each}
                </div>
              </div>
            {/if}
          </section>
          <section class="card">
            <h2>Browsers</h2>
            {#if browserItems.length === 0}<p class="muted">—</p>{:else}
              <div class="donut-wrap">
                <svg viewBox="0 0 140 140" class="donut">
                  {#each donutPaths(browserItems) as slice}<path d={slice.d} fill={slice.color} />{/each}
                  <circle cx="70" cy="70" r="32" fill="#0d1117" />
                </svg>
                <div class="legend">
                  {#each browserItems as it}
                    <div class="legend-row"><span class="legend-dot" style="background: {it.color}"></span><span class="legend-label">{it.label}</span><span class="legend-val">{it.value}</span></div>
                  {/each}
                </div>
              </div>
            {/if}
          </section>
        </div>
      {/if}

      {#if activeTab === 'live'}
        <section class="card">
          <div class="card-head">
            <h2>Sessões ativas</h2>
            <span class="muted small">{snap.liveSessions.length} visitantes nos últimos 2 minutos</span>
          </div>
          {#if !snap.liveSessions.length}
            <div class="empty"><span class="empty-emoji">∅</span><p>Ninguém na página agora.</p></div>
          {:else}
            <div class="live-table">
              <div class="lt-head">
                <span>Visitante</span><span>Rota</span><span>Local</span><span>Device</span><span>Origem</span><span>Tempo</span><span>Estado</span>
              </div>
              {#each snap.liveSessions as s}
                <button
                  class="lt-row"
                  class:converted={s.clickedBancontact}
                  class:purchased={s.purchaseAmount}
                  class:bot={s.isBot}
                  onclick={() => openSession(s.sidFull)}
                >
                  <span class="mono">#{s.sid}{#if s.isBot}<span class="bot-tag">bot</span>{/if}</span>
                  <span class="path mono">{s.path}</span>
                  <span>{flagFor(s.countryCode)} {s.city || s.country || '—'}</span>
                  <span>{devIcon(s.device)} {s.device}</span>
                  <span class="muted">{s.utm_source || '(direct)'}</span>
                  <span>{fmtDuration(s.durationSec)}</span>
                  <span>
                    {#if s.purchaseAmount}<span class="tag tag-gold">€{s.purchaseAmount} paid</span>
                    {:else if s.clickedBancontact}<span class="tag tag-green">checkout</span>
                    {:else if s.selectedAmount !== null}<span class="tag tag-orange">€{s.selectedAmount}</span>
                    {:else if s.reachedDonate}<span class="tag tag-blue">/donate</span>
                    {:else}<span class="tag">browse</span>{/if}
                  </span>
                </button>
              {/each}
            </div>
          {/if}
        </section>

        <section class="card">
          <h2>Feed de eventos <span class="muted small">· últimos 5min</span></h2>
          {#if !snap.liveFeed.length}
            <div class="empty"><span class="empty-emoji">∅</span><p>Sem eventos.</p></div>
          {:else}
            <div class="feed">
              {#each snap.liveFeed as e}
                <div class="feed-row">
                  <span class="feed-icon" style="color: {evColor(e.ev)}">{evIcon(e.ev)}</span>
                  <span class="feed-ev">{evLabel(e.ev)}</span>
                  <span class="feed-data">
                    {#if e.data?.amount}€{e.data.amount}{/if}
                    {#if e.data?.pct}{e.data.pct}%{/if}
                    {#if e.data?.q}q{e.data.q}{/if}
                  </span>
                  <span class="feed-path mono">{e.path}</span>
                  <span class="mono feed-sid">#{e.sid}</span>
                  <span class="feed-time">{fmtTime(e.ts)}</span>
                </div>
              {/each}
            </div>
          {/if}
        </section>
      {/if}

      {#if activeTab === 'funnel'}
        <section class="card">
          <h2>Funil de conversão</h2>
          {#each [
            { label: 'Sessões', value: snap.funnel.totalSessions, base: snap.funnel.totalSessions },
            { label: 'Chegaram em /donate', value: snap.funnel.reachedDonate, base: snap.funnel.totalSessions },
            { label: 'Selecionaram valor', value: snap.funnel.selectedAmount, base: snap.funnel.totalSessions },
            { label: 'Clicaram Bancontact', value: snap.funnel.clickedBancontact, base: snap.funnel.totalSessions },
            { label: 'Compraram', value: snap.funnel.purchased, base: snap.funnel.totalSessions }
          ] as step, i}
            <div class="funnel-row">
              <div class="funnel-label">{step.label}</div>
              <div class="funnel-bar-wrap">
                <div class="funnel-bar" style="width: {step.base ? (step.value / step.base) * 100 : 0}%; opacity: {1 - i * 0.13}"></div>
                <span class="funnel-val">{fmtNum(step.value)}</span>
              </div>
              <div class="funnel-pct">{step.base ? ((step.value / step.base) * 100).toFixed(1) : '0'}%</div>
            </div>
          {/each}
        </section>

        <section class="card">
          <h2>Tempo entre etapas (mediana)</h2>
          <div class="timing-grid">
            <div class="timing-item">
              <div class="timing-label">LP → /donate</div>
              <div class="timing-value">{fmtMs(snap.funnelTiming.medianLpToDonateMs)}</div>
            </div>
            <div class="timing-item">
              <div class="timing-label">/donate → seleção</div>
              <div class="timing-value">{fmtMs(snap.funnelTiming.medianDonateToAmountMs)}</div>
            </div>
            <div class="timing-item">
              <div class="timing-label">Seleção → Bancontact</div>
              <div class="timing-value">{fmtMs(snap.funnelTiming.medianAmountToBccMs)}</div>
            </div>
          </div>
        </section>

        <section class="card">
          <h2>Top valores selecionados</h2>
          {#if !snap.topAmounts.length}<p class="muted">Sem seleções.</p>{:else}
            {#each snap.topAmounts as a}
              <div class="bar-row">
                <div class="bar-label">€{a.amount}</div>
                <div class="bar-wrap">
                  <div class="bar-fill" style="width: {(a.count / snap.topAmounts[0].count) * 100}%"></div>
                </div>
                <div class="bar-val">{a.count}</div>
              </div>
            {/each}
          {/if}
        </section>

        <section class="card">
          <h2>Tempo médio por seção</h2>
          {#if !snap.sectionTimes.length}<p class="muted">Sem dados ainda.</p>{:else}
            {#each snap.sectionTimes as s}
              <div class="bar-row">
                <div class="bar-label">{s.section}</div>
                <div class="bar-wrap">
                  <div class="bar-fill bar-purple" style="width: {(s.avgMs / snap.sectionTimes[0].avgMs) * 100}%"></div>
                </div>
                <div class="bar-val">{fmtMs(s.avgMs)} <span class="muted small">({s.sessions})</span></div>
              </div>
            {/each}
          {/if}
        </section>

        <section class="card">
          <h2>A/B: LP vs /vsl <span class="muted small">· landing page</span></h2>
          <div class="ab-grid">
            <div class="ab-col">
              <div class="ab-title">/ (LP)</div>
              <div class="ab-stat"><span>Sessões</span><strong>{snap.abTest.lp.sessions}</strong></div>
              <div class="ab-stat"><span>Checkout</span><strong>{snap.abTest.lp.convCheckout}</strong></div>
              <div class="ab-stat"><span>Compras</span><strong>{snap.abTest.lp.convPurchase}</strong></div>
              <div class="ab-stat"><span>Receita</span><strong>{fmtEur(snap.abTest.lp.revenue)}</strong></div>
              <div class="ab-stat"><span>Tempo médio</span><strong>{fmtDuration(snap.abTest.lp.avgDurationSec)}</strong></div>
            </div>
            <div class="ab-col">
              <div class="ab-title">/vsl</div>
              <div class="ab-stat"><span>Sessões</span><strong>{snap.abTest.vsl.sessions}</strong></div>
              <div class="ab-stat"><span>Checkout</span><strong>{snap.abTest.vsl.convCheckout}</strong></div>
              <div class="ab-stat"><span>Compras</span><strong>{snap.abTest.vsl.convPurchase}</strong></div>
              <div class="ab-stat"><span>Receita</span><strong>{fmtEur(snap.abTest.vsl.revenue)}</strong></div>
              <div class="ab-stat"><span>Tempo médio</span><strong>{fmtDuration(snap.abTest.vsl.avgDurationSec)}</strong></div>
            </div>
          </div>
        </section>
      {/if}

      {#if activeTab === 'vsl'}
        <section class="card">
          <h2>Retenção da VSL</h2>
          {#if !snap.vslRetention.started}
            <div class="empty"><span class="empty-emoji">▶</span><p>Sem plays ainda.</p></div>
          {:else}
            {@const v = snap.vslRetention}
            {@const steps = [
              { label: 'Iniciaram', value: v.started, base: v.started },
              { label: 'Com som', value: v.soundOn, base: v.started },
              { label: '25%', value: v.q25, base: v.started },
              { label: '50%', value: v.q50, base: v.started },
              { label: '75%', value: v.q75, base: v.started },
              { label: '100%', value: v.q100, base: v.started }
            ]}
            {#each steps as step, i}
              <div class="funnel-row">
                <div class="funnel-label">{step.label}</div>
                <div class="funnel-bar-wrap">
                  <div class="funnel-bar bar-purple-grad" style="width: {step.base ? (step.value / step.base) * 100 : 0}%; opacity: {1 - i * 0.1}"></div>
                  <span class="funnel-val">{step.value}</span>
                </div>
                <div class="funnel-pct">{step.base ? ((step.value / step.base) * 100).toFixed(1) : '0'}%</div>
              </div>
            {/each}
            <div class="vsl-extra">Re-watches: <strong>{v.rewatchTotal}</strong></div>
          {/if}
        </section>
      {/if}

      {#if activeTab === 'heatmap'}
        <section class="card card-wide">
          <div class="card-head">
            <h2>Heatmap de cliques</h2>
            <span class="muted small">{snap.heatmap.length} cliques na janela {pathFilter ? `· filtrado por ${pathFilter}` : ''}</span>
          </div>
          {#if !snap.heatmap.length}
            <div class="empty"><span class="empty-emoji">◉</span><p>Sem cliques na janela.</p></div>
          {:else}
            <div class="heatmap-canvas">
              <svg viewBox="0 0 1000 1000" preserveAspectRatio="none">
                {#each snap.heatmap as h}
                  <circle cx={h.x * 10} cy={h.y * 10} r="18" fill="#ff5b5b" fill-opacity="0.18" />
                {/each}
                {#each snap.heatmap as h}
                  <circle cx={h.x * 10} cy={h.y * 10} r="4" fill="#ff5b5b" fill-opacity="0.6" />
                {/each}
              </svg>
              <div class="heatmap-note muted small">Coordenadas normalizadas (% da viewport)</div>
            </div>
          {/if}
        </section>
      {/if}

      {#if activeTab === 'sessions'}
        <section class="card">
          <h2>Todas as sessões na janela</h2>
          <div class="live-table">
            <div class="lt-head">
              <span>Visitante</span><span>Landing</span><span>Local</span><span>Device</span><span>Origem</span><span>Tempo</span><span>Estado</span>
            </div>
            {#each snap.liveSessions as s}
              <button
                class="lt-row"
                class:converted={s.clickedBancontact}
                class:purchased={s.purchaseAmount}
                class:bot={s.isBot}
                onclick={() => openSession(s.sidFull)}
              >
                <span class="mono">#{s.sid}{#if s.isBot}<span class="bot-tag">bot</span>{/if}</span>
                <span class="path mono">{s.landing}</span>
                <span>{flagFor(s.countryCode)} {s.city || '—'}</span>
                <span>{devIcon(s.device)} {s.browser || s.device}</span>
                <span class="muted">{s.utm_source || '(direct)'}</span>
                <span>{fmtDuration(s.durationSec)}</span>
                <span>
                  {#if s.purchaseAmount}<span class="tag tag-gold">€{s.purchaseAmount}</span>
                  {:else if s.clickedBancontact}<span class="tag tag-green">checkout</span>
                  {:else if s.selectedAmount !== null}<span class="tag tag-orange">€{s.selectedAmount}</span>
                  {:else if s.reachedDonate}<span class="tag tag-blue">/donate</span>
                  {:else}<span class="tag">browse</span>{/if}
                </span>
              </button>
            {/each}
          </div>
        </section>
      {/if}

      {#if activeTab === 'revenue'}
        <section class="kpi-grid">
          <div class="kpi">
            <div class="kpi-label">Receita</div>
            <div class="kpi-value">{fmtEur(snap.kpis.revenue)}</div>
            <div class="kpi-sub kpi-delta {deltaClass(snap.compare.revenue.delta)}">{fmtDelta(snap.compare.revenue.delta)} vs período anterior</div>
          </div>
          <div class="kpi">
            <div class="kpi-label">Pedidos</div>
            <div class="kpi-value">{snap.kpis.purchased}</div>
            <div class="kpi-sub">compras confirmadas</div>
          </div>
          <div class="kpi">
            <div class="kpi-label">Ticket médio</div>
            <div class="kpi-value">{fmtEur(snap.kpis.avgTicket)}</div>
            <div class="kpi-sub">por pedido</div>
          </div>
        </section>

        <section class="card card-wide">
          <h2>Receita por origem</h2>
          {#if !snap.revenueBySource.length}<p class="muted">Sem compras na janela.</p>{:else}
            {#each snap.revenueBySource as r}
              <div class="bar-row">
                <div class="bar-label">{r.source}</div>
                <div class="bar-wrap">
                  <div class="bar-fill bar-gold" style="width: {(r.revenue / snap.revenueBySource[0].revenue) * 100}%"></div>
                </div>
                <div class="bar-val">{fmtEur(r.revenue)} <span class="muted small">({r.count})</span></div>
              </div>
            {/each}
          {/if}
        </section>

        <section class="card card-wide">
          <h2>Receita ao longo do tempo</h2>
          <svg viewBox="0 0 800 100" class="spark" preserveAspectRatio="none">
            <defs>
              <linearGradient id="gradRev" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#f9d65b" stop-opacity="0.4" />
                <stop offset="100%" stop-color="#f9d65b" stop-opacity="0" />
              </linearGradient>
            </defs>
            <path d={sparkArea(snap.timeSeries, 'revenue')} fill="url(#gradRev)" />
            <path d={sparkPath(snap.timeSeries, 'revenue')} stroke="#f9d65b" stroke-width="2" fill="none" />
          </svg>
        </section>
      {/if}

      {#if activeTab === 'tech'}
        <section class="kpi-grid">
          <div class="kpi">
            <div class="kpi-label">LCP <span class="vital-grade {vitalGrade('lcp', snap.vitalsKpis.lcpP75)}"></span></div>
            <div class="kpi-value">{fmtMs(snap.vitalsKpis.lcpP75)}</div>
            <div class="kpi-sub">p75 · meta &lt; 2.5s</div>
          </div>
          <div class="kpi">
            <div class="kpi-label">INP <span class="vital-grade {vitalGrade('inp', snap.vitalsKpis.inpP75)}"></span></div>
            <div class="kpi-value">{fmtMs(snap.vitalsKpis.inpP75)}</div>
            <div class="kpi-sub">p75 · meta &lt; 200ms</div>
          </div>
          <div class="kpi">
            <div class="kpi-label">CLS <span class="vital-grade {vitalGrade('cls', snap.vitalsKpis.clsP75)}"></span></div>
            <div class="kpi-value">{snap.vitalsKpis.clsP75.toFixed(3)}</div>
            <div class="kpi-sub">p75 · meta &lt; 0.1</div>
          </div>
          <div class="kpi">
            <div class="kpi-label">TTFB</div>
            <div class="kpi-value">{fmtMs(snap.vitalsKpis.ttfbP75)}</div>
            <div class="kpi-sub">p75</div>
          </div>
          <div class="kpi">
            <div class="kpi-label">Erros JS</div>
            <div class="kpi-value">{snap.vitalsKpis.errorsCount}</div>
            <div class="kpi-sub">na janela</div>
          </div>
          <div class="kpi">
            <div class="kpi-label">Amostras</div>
            <div class="kpi-value">{snap.vitalsKpis.samples}</div>
            <div class="kpi-sub">sessões com vitais</div>
          </div>
        </section>

        <section class="card">
          <h2>Rotas mais visitadas</h2>
          {#each snap.topPaths as p}
            <div class="bar-row">
              <div class="bar-label" title={p.path}>{p.path}</div>
              <div class="bar-wrap"><div class="bar-fill bar-cyan" style="width: {(p.count / snap.topPaths[0].count) * 100}%"></div></div>
              <div class="bar-val">{p.count}</div>
            </div>
          {/each}
        </section>
      {/if}

    {/if}

    <footer class="dash-foot">
      <span>store: {snap?.capacity.events ?? 0} eventos · {snap?.capacity.sessions ?? 0} sessões · {snap?.capacity.heat ?? 0} cliques</span>
      <span>refresh 3s</span>
    </footer>
  </main>
</div>

<!-- Session detail modal -->
{#if detailSid}
  <div class="modal-overlay" onclick={closeDetail} role="dialog">
    <div class="modal" onclick={(e) => e.stopPropagation()} role="document">
      <div class="modal-head">
        <h3>Sessão #{detailSid.slice(0, 12)}</h3>
        <button class="modal-close" onclick={closeDetail} aria-label="fechar">✕</button>
      </div>
      {#if !detailData}
        <div class="loading"><div class="spinner"></div><span>Carregando…</span></div>
      {:else}
        {@const s = detailData.session}
        <div class="detail-grid">
          <div class="detail-card">
            <h4>Identidade</h4>
            <div><span>Local:</span> {flagFor(s.countryCode)} {s.city || '—'}, {s.country || '—'}</div>
            <div><span>ISP:</span> {s.isp || '—'} {s.isProxy ? '(proxy/hosting)' : ''}</div>
            <div><span>Browser:</span> {s.browser} / {s.os}</div>
            <div><span>Device:</span> {s.device}</div>
            {#if s.isBot}<div class="bot-warn">⚠ Bot detectado: {s.botReasons.join(', ')}</div>{/if}
          </div>
          <div class="detail-card">
            <h4>Origem</h4>
            <div><span>Landing:</span> {s.landingPath}</div>
            <div><span>Referrer:</span> {s.ref || '—'}</div>
            <div><span>UTM source:</span> {s.utm_source || '(direct)'}</div>
            <div><span>UTM medium:</span> {s.utm_medium || '—'}</div>
            <div><span>UTM campaign:</span> {s.utm_campaign || '—'}</div>
            <div><span>fbclid:</span> {s.fbclid || '—'}</div>
          </div>
          <div class="detail-card">
            <h4>Engajamento</h4>
            <div><span>Pageviews:</span> {s.pageViews}</div>
            <div><span>Scroll max:</span> {s.scrollMax}%</div>
            <div><span>Scroll backs:</span> {s.scrollBacks}</div>
            <div><span>Clicks:</span> {s.clicks}</div>
            <div><span>Rage clicks:</span> {s.rageClicks}</div>
            <div><span>Dead clicks:</span> {s.deadClicks}</div>
          </div>
          <div class="detail-card">
            <h4>Funil</h4>
            <div><span>Chegou em /donate:</span> {s.reachedDonate ? '✓' : '—'}</div>
            <div><span>Selecionou:</span> {s.selectedAmount ? '€' + s.selectedAmount : '—'}</div>
            <div><span>Bancontact:</span> {s.clickedBancontact ? '✓' : '—'}</div>
            <div><span>Comprou:</span> {s.purchaseAmount ? '€' + s.purchaseAmount : '—'}</div>
          </div>
          <div class="detail-card">
            <h4>VSL</h4>
            <div><span>Com som:</span> {s.vslPlayedWithSound ? '✓' : '—'}</div>
            <div><span>Quartile máx:</span> {s.vslMaxQuartile}%</div>
            <div><span>Rewatches:</span> {s.vslRewatches}</div>
          </div>
          <div class="detail-card">
            <h4>Web Vitals</h4>
            <div><span>LCP:</span> {s.vitals.lcp ? fmtMs(s.vitals.lcp) : '—'}</div>
            <div><span>INP:</span> {s.vitals.inp ? fmtMs(s.vitals.inp) : '—'}</div>
            <div><span>CLS:</span> {s.vitals.cls ?? '—'}</div>
            <div><span>TTFB:</span> {s.vitals.ttfb ? fmtMs(s.vitals.ttfb) : '—'}</div>
          </div>
        </div>
        <h4 class="timeline-title">Timeline ({detailData.events.length} eventos)</h4>
        <div class="timeline">
          {#each detailData.events as e}
            <div class="timeline-row">
              <span class="feed-icon" style="color: {evColor(e.ev)}">{evIcon(e.ev)}</span>
              <span class="timeline-time mono">{fmtTime(e.ts)}</span>
              <span class="timeline-ev">{evLabel(e.ev)}</span>
              <span class="timeline-path mono">{e.path}</span>
              <span class="timeline-data">{e.data ? JSON.stringify(e.data) : ''}</span>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
{/if}
{/if}

<style>
  :global(html), :global(body) {
    margin: 0; padding: 0;
    background: #0a0d12; color: #e6e9ef;
    font-family: 'Inter', -apple-system, system-ui, sans-serif;
    font-feature-settings: 'cv11', 'ss01';
    -webkit-font-smoothing: antialiased;
  }
  :global(*) { box-sizing: border-box; }

  /* ── Login ── */
  .login-wrap {
    min-height: 100vh; display: grid; place-items: center;
    background: radial-gradient(ellipse at center, #11161d 0%, #050608 70%);
  }
  .login-card {
    background: #11161d; border: 1px solid #1f2630;
    padding: 36px; border-radius: 16px; min-width: 360px;
    display: flex; flex-direction: column; gap: 16px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.5);
  }
  .login-brand { display: flex; align-items: center; justify-content: center; gap: 10px; }
  .brand-logo { height: 80px; width: auto; display: block; }
  .login-card h1 { margin: 0; font-size: 1.25rem; font-weight: 700; letter-spacing: -0.02em; }
  .login-card p { margin: 0; color: #8b94a4; font-size: 0.875rem; }
  .login-card input {
    background: #0a0d12; border: 1px solid #2a3340; color: #e6e9ef;
    padding: 12px 14px; border-radius: 10px; font-size: 0.9375rem;
    font-family: inherit; transition: border-color 0.15s;
  }
  .login-card input:focus { outline: none; border-color: #02a95c; }
  .login-card button {
    background: linear-gradient(180deg, #02b864 0%, #02a95c 100%);
    color: #fff; border: none; padding: 12px; border-radius: 10px;
    font-weight: 600; cursor: pointer; font-family: inherit; font-size: 0.9375rem;
    box-shadow: 0 4px 12px rgba(2, 169, 92, 0.3);
  }

  /* ── App layout ── */
  .app { display: grid; grid-template-columns: 220px 1fr; min-height: 100vh; }
  .app.sidebar-collapsed { grid-template-columns: 64px 1fr; }

  /* ── Sidebar ── */
  .sidebar {
    background: #0d1117; border-right: 1px solid #1a1f28;
    display: flex; flex-direction: column;
    position: sticky; top: 0; height: 100vh;
  }
  .sidebar-brand {
    display: flex; align-items: center; justify-content: center; gap: 10px;
    padding: 12px 8px; border-bottom: 1px solid #1a1f28; min-height: 64px;
  }
  .brand-dot {
    width: 10px; height: 10px; border-radius: 50%;
    background: linear-gradient(135deg, #02a95c, #1de9b6);
    box-shadow: 0 0 12px rgba(2,169,92,0.7);
  }
  .brand-name { font-weight: 700; letter-spacing: -0.01em; }
  .brand-logo-side { height: 44px; width: auto; display: block; }
  .brand-favicon-side { width: 52px; height: 52px; display: block; margin: 0 auto; }
  .nav { flex: 1; padding: 12px 8px; display: flex; flex-direction: column; gap: 2px; }
  .nav-item {
    background: transparent; border: none; color: #8b94a4;
    padding: 10px 12px; border-radius: 8px; cursor: pointer;
    font-family: inherit; font-size: 0.875rem; font-weight: 500;
    display: flex; align-items: center; gap: 12px; text-align: left;
    transition: all 0.12s;
  }
  .nav-item:hover { background: #11161d; color: #e6e9ef; }
  .nav-item.active {
    background: linear-gradient(90deg, rgba(2,169,92,0.15), transparent);
    color: #02a95c;
    box-shadow: inset 2px 0 0 #02a95c;
  }
  .nav-icon { font-size: 1rem; width: 18px; text-align: center; }
  .sidebar-foot { padding: 12px; border-top: 1px solid #1a1f28; }
  .collapse-btn {
    background: transparent; border: 1px solid #1f2630; color: #8b94a4;
    width: 100%; padding: 6px; border-radius: 6px; cursor: pointer;
    font-family: inherit; font-size: 0.75rem;
  }

  /* ── Main / Topbar ── */
  .main { padding: 24px 32px; max-width: 100%; overflow-x: hidden; }
  .topbar {
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: 24px; gap: 16px; flex-wrap: wrap;
  }
  .topbar-left { display: flex; align-items: baseline; gap: 16px; }
  .page-title {
    margin: 0; font-size: 1.5rem; font-weight: 700;
    letter-spacing: -0.025em; text-transform: capitalize;
  }
  .status {
    font-size: 0.8125rem; color: #8b94a4;
    display: inline-flex; align-items: center; gap: 6px;
  }
  .status-dot { width: 6px; height: 6px; border-radius: 50%; background: #555; }
  .status-dot.on { background: #02a95c; animation: pulse 1.5s ease-in-out infinite; }
  @keyframes pulse {
    0%,100% { opacity:1; box-shadow:0 0 0 0 rgba(2,169,92,0.6); }
    50% { opacity:.6; box-shadow:0 0 0 8px rgba(2,169,92,0); }
  }

  .topbar-right { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  .select {
    background: #11161d; border: 1px solid #1f2630; color: #e6e9ef;
    padding: 8px 12px; border-radius: 8px; font-size: 0.8125rem;
    cursor: pointer; font-family: inherit; transition: border-color 0.15s;
  }
  .select:hover { border-color: #2a3340; }
  .select:focus { outline: none; border-color: #02a95c; }
  .country-input { width: 110px; cursor: text; text-transform: uppercase; }
  .toggle {
    display: inline-flex; align-items: center; gap: 6px;
    font-size: 0.8125rem; color: #8b94a4; cursor: pointer;
    padding: 8px 10px; border: 1px solid #1f2630; border-radius: 8px;
  }
  .toggle input { accent-color: #02a95c; }
  .btn-reset {
    background: transparent; border: 1px solid #4a1d1d; color: #ff7070;
    padding: 8px 14px; border-radius: 8px; font-size: 0.8125rem; font-weight: 600;
    font-family: inherit; cursor: pointer; transition: all 0.15s;
  }
  .btn-reset:hover:not(:disabled) { background: rgba(255,70,70,0.1); border-color: #ff7070; }
  .btn-reset:disabled { opacity: 0.5; cursor: not-allowed; }

  .toast {
    background: rgba(2,169,92,0.12); border: 1px solid #02a95c; color: #02a95c;
    padding: 10px 16px; border-radius: 8px; margin-bottom: 16px;
    font-size: 0.875rem; font-weight: 500;
  }

  /* ── KPIs ── */
  .kpi-grid {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 14px; margin-bottom: 20px;
  }
  .kpi {
    background: #11161d; border: 1px solid #1a1f28; padding: 18px 20px;
    border-radius: 12px; position: relative; overflow: hidden;
    transition: transform 0.15s, border-color 0.15s;
  }
  .kpi:hover { border-color: #1f2630; transform: translateY(-1px); }
  .kpi-live::before {
    content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px;
    background: linear-gradient(90deg, transparent, #02a95c, transparent);
    animation: shimmer 2.4s linear infinite;
  }
  @keyframes shimmer { 0% { transform:translateX(-100%);} 100% { transform:translateX(100%);} }
  .kpi-label {
    color: #8b94a4; font-size: 0.6875rem; text-transform: uppercase;
    letter-spacing: 0.08em; font-weight: 600;
    display: flex; align-items: center; gap: 8px;
  }
  .kpi-value {
    font-family: 'JetBrains Mono', ui-monospace, monospace;
    font-size: 2rem; font-weight: 600; margin-top: 8px; letter-spacing: -0.03em;
  }
  .kpi-live .kpi-value { color: #02a95c; }
  .kpi-breakdown {
    display: flex; flex-wrap: wrap; gap: 6px;
    margin-top: 10px;
  }
  .kpi-chip {
    display: inline-flex; align-items: center; gap: 5px;
    background: #0a0d12; border: 1px solid #1f2630;
    padding: 4px 8px; border-radius: 999px;
    font-size: 0.6875rem; color: #8b94a4;
  }
  .kpi-chip strong {
    color: #e6e9ef; font-family: 'JetBrains Mono', monospace;
    font-weight: 600; font-size: 0.75rem;
  }
  .kpi-chip-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
  .kpi-chip-label { font-weight: 500; }
  .kpi-sub { color: #8b94a4; font-size: 0.75rem; margin-top: 6px; }
  .kpi-delta.up { color: #02a95c; }
  .kpi-delta.down { color: #ff5b5b; }
  .kpi-delta.flat { color: #8b94a4; }

  .vital-grade {
    display: inline-block; width: 8px; height: 8px; border-radius: 50%;
  }
  .vital-grade.good { background: #02a95c; }
  .vital-grade.ok { background: #ffd54f; }
  .vital-grade.bad { background: #ff5b5b; }

  /* ── Cards ── */
  .card {
    background: #11161d; border: 1px solid #1a1f28; padding: 20px;
    border-radius: 12px; margin-bottom: 16px;
  }
  .card.card-wide { width: 100%; }
  .card h2 {
    margin: 0 0 16px 0; font-size: 0.9375rem; font-weight: 600;
    color: #d6dae3; letter-spacing: -0.01em;
  }
  .card h2 .small { font-weight: 400; font-size: 0.8125rem; }
  .card-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 12px; }
  .card-head h2 { margin: 0; }

  .two-col {
    display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;
  }
  @media (max-width: 900px) { .two-col { grid-template-columns: 1fr; } }

  /* ── Funnel ── */
  .funnel-row {
    display: grid; grid-template-columns: 200px 1fr 60px;
    gap: 12px; align-items: center; margin-bottom: 8px;
  }
  .funnel-label { font-size: 0.875rem; color: #d6dae3; }
  .funnel-bar-wrap {
    background: #0a0d12; height: 32px; border-radius: 6px; position: relative;
    overflow: hidden; border: 1px solid #1a1f28;
  }
  .funnel-bar {
    background: linear-gradient(90deg, #02a95c, #1de9b6);
    height: 100%; transition: width 0.4s ease;
  }
  .funnel-bar.bar-purple-grad { background: linear-gradient(90deg, #a78bfa, #ec407a); }
  .funnel-val {
    position: absolute; right: 8px; top: 50%; transform: translateY(-50%);
    font-size: 0.8125rem; font-weight: 600;
    font-family: 'JetBrains Mono', monospace;
  }
  .funnel-pct {
    color: #02a95c; font-weight: 600; text-align: right;
    font-family: 'JetBrains Mono', monospace; font-size: 0.875rem;
  }

  /* Timing */
  .timing-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; }
  .timing-item { background: #0a0d12; border: 1px solid #1a1f28; padding: 14px; border-radius: 8px; }
  .timing-label { color: #8b94a4; font-size: 0.75rem; text-transform: uppercase; }
  .timing-value { font-family: 'JetBrains Mono', monospace; font-size: 1.5rem; margin-top: 6px; }

  /* A/B */
  .ab-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  @media (max-width: 700px) { .ab-grid { grid-template-columns: 1fr; } }
  .ab-col { background: #0a0d12; border: 1px solid #1a1f28; border-radius: 10px; padding: 16px; }
  .ab-title { font-weight: 600; color: #02a95c; margin-bottom: 12px; }
  .ab-stat { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #1a1f28; }
  .ab-stat:last-child { border-bottom: none; }
  .ab-stat span { color: #8b94a4; font-size: 0.8125rem; }
  .ab-stat strong { font-family: 'JetBrains Mono', monospace; font-weight: 600; }

  /* Bars */
  .bar-row {
    display: grid; grid-template-columns: 110px 1fr 100px; gap: 10px;
    align-items: center; margin-bottom: 6px;
  }
  .bar-label { font-size: 0.8125rem; color: #d6dae3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .bar-wrap { background: #0a0d12; height: 20px; border-radius: 4px; border: 1px solid #1a1f28; overflow: hidden; }
  .bar-fill { background: linear-gradient(90deg, #02a95c, #1de9b6); height: 100%; transition: width 0.4s; }
  .bar-fill.bar-purple { background: linear-gradient(90deg, #a78bfa, #4dd0e1); }
  .bar-fill.bar-cyan { background: linear-gradient(90deg, #4dd0e1, #1de9b6); }
  .bar-fill.bar-gold { background: linear-gradient(90deg, #f9d65b, #ffaa00); }
  .bar-val { color: #d6dae3; font-size: 0.8125rem; text-align: right; font-family: 'JetBrains Mono', monospace; }

  /* Sparkline */
  .spark { width: 100%; height: 120px; }
  .time-axis { display: flex; justify-content: space-between; color: #8b94a4; font-size: 0.6875rem; margin-top: 6px; }

  /* Donuts */
  .donut-wrap { display: flex; gap: 24px; align-items: center; flex-wrap: wrap; }
  .donut { width: 140px; height: 140px; flex-shrink: 0; }
  .legend { display: flex; flex-direction: column; gap: 6px; flex: 1; min-width: 0; }
  .legend-row { display: flex; align-items: center; gap: 8px; font-size: 0.8125rem; }
  .legend-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
  .legend-label { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .legend-val { color: #8b94a4; font-family: 'JetBrains Mono', monospace; }

  /* Live table */
  .live-table { display: flex; flex-direction: column; gap: 3px; }
  .lt-head, .lt-row {
    display: grid; grid-template-columns: 110px 1.5fr 1.3fr 1fr 1fr 80px 110px;
    gap: 10px; padding: 9px 12px; align-items: center;
  }
  .lt-head { color: #8b94a4; font-size: 0.6875rem; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; }
  .lt-row {
    background: #0a0d12; border-radius: 8px; font-size: 0.8125rem;
    border: 1px solid transparent; cursor: pointer; text-align: left;
    color: inherit; font-family: inherit; transition: all 0.12s;
  }
  .lt-row:hover { border-color: #1f2630; }
  .lt-row.converted { border-color: #02a95c; box-shadow: 0 0 12px rgba(2,169,92,0.15); }
  .lt-row.purchased { border-color: #f9d65b; box-shadow: 0 0 16px rgba(249,214,91,0.18); }
  .lt-row.bot { opacity: 0.6; }
  .lt-row .path { color: #4dd0e1; }
  .mono { font-family: 'JetBrains Mono', ui-monospace, monospace; color: #8b94a4; font-size: 0.75rem; }
  .bot-tag {
    background: rgba(255,91,91,0.15); color: #ff5b5b;
    font-size: 0.625rem; padding: 1px 5px; border-radius: 3px; margin-left: 6px;
  }

  .tag {
    display: inline-block; padding: 3px 10px; border-radius: 999px;
    font-size: 0.6875rem; font-weight: 600; background: #1f2630; color: #8b94a4;
  }
  .tag-green { background: rgba(2,169,92,0.18); color: #02a95c; }
  .tag-orange { background: rgba(255,112,67,0.2); color: #ff7043; }
  .tag-blue { background: rgba(77,208,225,0.2); color: #4dd0e1; }
  .tag-gold { background: rgba(249,214,91,0.2); color: #f9d65b; }

  /* Feed */
  .feed { display: flex; flex-direction: column; gap: 1px; max-height: 480px; overflow-y: auto; }
  .feed-row {
    display: grid; grid-template-columns: 24px 130px 70px 1fr 100px 80px;
    gap: 10px; padding: 8px 12px; font-size: 0.8125rem; align-items: center;
    background: #0a0d12; border-radius: 6px;
  }
  .feed-icon { font-size: 0.875rem; text-align: center; }
  .feed-ev { font-weight: 500; }
  .feed-data { color: #f9d65b; font-family: 'JetBrains Mono', monospace; font-size: 0.75rem; }
  .feed-path { color: #4dd0e1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .feed-sid { font-size: 0.6875rem; }
  .feed-time { color: #8b94a4; font-size: 0.6875rem; text-align: right; }

  /* Heatmap */
  .heatmap-canvas {
    position: relative;
    background: #0a0d12; border: 1px dashed #2a3340; border-radius: 8px;
    aspect-ratio: 1 / 1; max-width: 600px; margin: 0 auto;
  }
  .heatmap-canvas svg { width: 100%; height: 100%; }
  .heatmap-note { text-align: center; padding: 8px; }

  .vsl-extra { margin-top: 16px; padding: 12px; background: #0a0d12; border-radius: 8px; font-size: 0.875rem; }
  .vsl-extra strong { color: #a78bfa; font-family: 'JetBrains Mono', monospace; }

  /* Empty */
  .empty { padding: 40px; text-align: center; color: #8b94a4; }
  .empty-emoji { font-size: 2.5rem; display: block; margin-bottom: 8px; opacity: 0.4; }
  .empty p { margin: 0; font-size: 0.875rem; }

  .muted { color: #8b94a4; }
  .small { font-size: 0.75rem; }

  /* Loading */
  .loading {
    display: flex; align-items: center; justify-content: center; gap: 12px;
    padding: 80px; color: #8b94a4;
  }
  .spinner {
    width: 24px; height: 24px; border: 2px solid #2a3340;
    border-top-color: #02a95c; border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  .dash-foot {
    margin-top: 24px; padding-top: 16px; border-top: 1px solid #1a1f28;
    display: flex; justify-content: space-between; color: #8b94a4; font-size: 0.6875rem;
  }

  /* Modal */
  .modal-overlay {
    position: fixed; inset: 0; background: rgba(5,7,10,0.7);
    display: flex; justify-content: center; align-items: flex-start;
    padding: 40px 20px; z-index: 100;
    backdrop-filter: blur(4px);
    overflow-y: auto;
  }
  .modal {
    background: #11161d; border: 1px solid #1f2630; border-radius: 14px;
    max-width: 980px; width: 100%; padding: 24px;
    box-shadow: 0 24px 60px rgba(0,0,0,0.6);
  }
  .modal-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
  .modal-head h3 { margin: 0; font-size: 1rem; font-weight: 600; font-family: 'JetBrains Mono', monospace; }
  .modal-close {
    background: transparent; border: 1px solid #1f2630; color: #8b94a4;
    width: 30px; height: 30px; border-radius: 8px; cursor: pointer; font-size: 0.875rem;
  }
  .detail-grid {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 12px; margin-bottom: 20px;
  }
  .detail-card {
    background: #0a0d12; border: 1px solid #1a1f28; border-radius: 10px; padding: 12px;
    font-size: 0.8125rem;
  }
  .detail-card h4 {
    margin: 0 0 10px 0; font-size: 0.6875rem; color: #8b94a4;
    text-transform: uppercase; letter-spacing: 0.06em;
  }
  .detail-card div { padding: 3px 0; }
  .detail-card div span { color: #8b94a4; margin-right: 6px; font-size: 0.75rem; }
  .bot-warn { color: #ff5b5b; margin-top: 8px; font-size: 0.75rem; }

  .timeline-title { font-size: 0.875rem; margin: 0 0 10px 0; color: #d6dae3; }
  .timeline { max-height: 320px; overflow-y: auto; }
  .timeline-row {
    display: grid; grid-template-columns: 22px 70px 130px 1fr 1fr;
    gap: 10px; padding: 6px 0; font-size: 0.75rem; align-items: center;
    border-bottom: 1px solid #1a1f28;
  }
  .timeline-time { color: #8b94a4; }
  .timeline-ev { font-weight: 500; }
  .timeline-path { color: #4dd0e1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .timeline-data { color: #8b94a4; font-family: 'JetBrains Mono', monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.6875rem; }

  /* Hambúrguer + botões mobile — escondidos no desktop */
  .hamburger, .filters-toggle, .mobile-backdrop { display: none; }
  .topbar-title-block { display: flex; align-items: baseline; gap: 12px; }
  .nav-label.hidden-collapsed { display: none; }

  /* ─────────────── RESPONSIVE — TABLET ≤ 1024px ─────────────── */
  @media (max-width: 1024px) {
    .main { padding: 20px 22px; }
    .lt-head, .lt-row {
      grid-template-columns: 90px 1.2fr 1fr 90px 80px 70px 90px;
      gap: 8px; padding: 8px 10px; font-size: 0.75rem;
    }
    .feed-row {
      grid-template-columns: 22px 110px 60px 1fr 80px 70px;
      padding: 7px 10px; font-size: 0.75rem;
    }
    .funnel-row { grid-template-columns: 160px 1fr 56px; }
    .topbar-right .select { padding: 7px 10px; font-size: 0.75rem; }
    .country-input { width: 90px; }
  }

  /* ─────────────── RESPONSIVE — MOBILE ≤ 768px ─────────────── */
  @media (max-width: 768px) {
    /* App layout: sidebar vira drawer */
    .app, .app.sidebar-collapsed { grid-template-columns: 1fr; }

    .sidebar {
      position: fixed; top: 0; left: 0; bottom: 0;
      width: 240px; max-width: 80vw; height: 100vh; z-index: 90;
      transform: translateX(-100%); transition: transform 0.25s ease-out;
      box-shadow: 0 0 40px rgba(0,0,0,0.5);
      padding-top: env(safe-area-inset-top);
    }
    .sidebar.mobile-open { transform: translateX(0); }
    .nav-label.hidden-collapsed { display: inline; }
    .sidebar-foot { display: none; }

    .mobile-backdrop {
      display: block; position: fixed; inset: 0; z-index: 80;
      background: rgba(0,0,0,0.55); backdrop-filter: blur(2px);
      border: none; cursor: pointer; padding: 0;
    }

    /* Main */
    .main {
      padding: 16px 14px;
      padding-top: calc(16px + env(safe-area-inset-top));
      padding-bottom: calc(20px + env(safe-area-inset-bottom));
    }

    /* Topbar */
    .topbar {
      flex-direction: column; align-items: stretch; gap: 12px;
      margin-bottom: 16px;
      position: sticky; top: 0; z-index: 50;
      background: linear-gradient(180deg, #0a0d12 75%, rgba(10,13,18,0));
      padding-top: 8px; margin-top: -8px;
    }
    .topbar-left {
      display: flex; align-items: center; gap: 12px; width: 100%;
    }
    .topbar-title-block {
      flex: 1; min-width: 0; flex-direction: column;
      align-items: flex-start; gap: 2px;
    }
    .page-title { font-size: 1.125rem; }
    .status { font-size: 0.6875rem; }
    .status-text { white-space: nowrap; }

    .hamburger {
      display: inline-flex; flex-direction: column; justify-content: center;
      gap: 4px; width: 38px; height: 38px; border-radius: 8px;
      background: #11161d; border: 1px solid #1f2630; cursor: pointer;
      padding: 0 9px; flex-shrink: 0;
    }
    .hamburger span {
      display: block; height: 2px; width: 100%;
      background: #e6e9ef; border-radius: 2px;
    }

    .filters-toggle {
      display: inline-flex; align-items: center; justify-content: center;
      width: 38px; height: 38px; border-radius: 8px;
      background: #11161d; border: 1px solid #1f2630;
      color: #e6e9ef; cursor: pointer; font-size: 1rem; flex-shrink: 0;
    }

    /* Filtros viram painel colapsável */
    .topbar-right {
      display: none; flex-direction: column; align-items: stretch;
      gap: 8px; width: 100%;
      background: #11161d; border: 1px solid #1f2630;
      padding: 12px; border-radius: 12px;
    }
    .topbar-right.mobile-open { display: flex; }
    .topbar-right .select,
    .topbar-right .country-input,
    .topbar-right .toggle,
    .topbar-right .btn-reset {
      width: 100%; padding: 11px 12px; font-size: 0.875rem;
    }
    .country-input { width: 100%; }
    .toggle { justify-content: space-between; }

    /* KPIs */
    .kpi-grid { grid-template-columns: 1fr 1fr; gap: 10px; }
    .kpi { padding: 14px 14px; }
    .kpi-label { font-size: 0.625rem; }
    .kpi-value { font-size: 1.5rem; margin-top: 4px; }
    .kpi-sub { font-size: 0.6875rem; margin-top: 4px; }

    /* Cards */
    .card { padding: 14px; margin-bottom: 12px; border-radius: 10px; }
    .card h2 { font-size: 0.875rem; margin-bottom: 12px; }
    .card-head { flex-direction: column; align-items: flex-start; gap: 4px; }

    /* Funil */
    .funnel-row {
      grid-template-columns: 1fr;
      gap: 4px; padding: 6px 0; margin-bottom: 6px;
      border-bottom: 1px solid #1a1f28;
    }
    .funnel-label { font-size: 0.8125rem; }
    .funnel-bar-wrap { height: 26px; order: 2; }
    .funnel-pct { text-align: left; font-size: 0.75rem; order: 3; }

    /* Bar rows */
    .bar-row {
      grid-template-columns: 1fr;
      gap: 4px; padding: 6px 0; margin-bottom: 6px;
      border-bottom: 1px solid #1a1f28;
    }
    .bar-row:last-child { border-bottom: none; }
    .bar-label { font-size: 0.8125rem; white-space: normal; }
    .bar-wrap { height: 14px; }
    .bar-val { text-align: left; font-size: 0.75rem; }

    /* Time series */
    .spark { height: 90px; }

    /* Donuts */
    .donut-wrap { gap: 14px; justify-content: center; }
    .donut { width: 110px; height: 110px; }
    .legend { width: 100%; }

    /* Timing grid */
    .timing-grid { grid-template-columns: 1fr 1fr; gap: 8px; }
    .timing-item { padding: 10px; }
    .timing-value { font-size: 1.125rem; }

    /* A/B */
    .ab-grid { grid-template-columns: 1fr; }

    /* Live table → cards 2col */
    .lt-head { display: none; }
    .lt-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px 10px; padding: 12px;
      font-size: 0.8125rem; border-radius: 10px;
    }
    .lt-row > span { display: flex; flex-direction: column; gap: 1px; }
    .lt-row > span:first-child { grid-column: 1 / -1; font-size: 0.75rem; padding-bottom: 4px; border-bottom: 1px solid #1a1f28; flex-direction: row; align-items: center; justify-content: space-between; }
    .lt-row > span:last-child { grid-column: 1 / -1; padding-top: 4px; border-top: 1px solid #1a1f28; flex-direction: row; align-items: center; justify-content: flex-end; }

    /* Feed → cards */
    .feed { gap: 6px; max-height: none; }
    .feed-row {
      grid-template-columns: 22px 1fr auto;
      grid-template-areas:
        "icon ev time"
        "icon path data"
        "icon sid sid";
      gap: 2px 10px; padding: 10px 12px; font-size: 0.75rem;
      border-radius: 10px;
    }
    .feed-icon { grid-area: icon; align-self: start; }
    .feed-ev { grid-area: ev; font-size: 0.8125rem; }
    .feed-data { grid-area: data; text-align: right; }
    .feed-path { grid-area: path; font-size: 0.6875rem; }
    .feed-sid { grid-area: sid; font-size: 0.625rem; }
    .feed-time { grid-area: time; font-size: 0.625rem; text-align: right; }

    /* Heatmap */
    .heatmap-canvas { max-width: 100%; }

    /* Modal */
    .modal-overlay { padding: 0; align-items: stretch; }
    .modal {
      border-radius: 0; max-width: 100%; min-height: 100vh;
      padding: 16px 14px;
      padding-top: calc(16px + env(safe-area-inset-top));
      padding-bottom: calc(20px + env(safe-area-inset-bottom));
    }
    .detail-grid { grid-template-columns: 1fr; gap: 10px; }
    .detail-card { padding: 12px; }
    .timeline-row {
      grid-template-columns: 22px 60px 1fr;
      grid-template-areas:
        "icon time ev"
        "icon path data";
      gap: 2px 8px; padding: 8px 0;
    }
    .timeline-row > :nth-child(1) { grid-area: icon; align-self: center; }
    .timeline-row > :nth-child(2) { grid-area: time; }
    .timeline-row > :nth-child(3) { grid-area: ev; }
    .timeline-row > :nth-child(4) { grid-area: path; }
    .timeline-row > :nth-child(5) { grid-area: data; font-size: 0.625rem; }

    /* Footer */
    .dash-foot { flex-direction: column; gap: 4px; text-align: left; }

    /* Toast */
    .toast {
      position: fixed; left: 12px; right: 12px; top: 60px;
      z-index: 60; margin: 0;
    }
  }

  /* ─────────────── RESPONSIVE — TELEFONE PEQUENO ≤ 420px ─────────────── */
  @media (max-width: 420px) {
    .main { padding: 12px 10px; padding-top: calc(12px + env(safe-area-inset-top)); }
    .kpi-grid { grid-template-columns: 1fr 1fr; gap: 8px; }
    .kpi { padding: 12px 10px; }
    .kpi-value { font-size: 1.25rem; }
    .lt-row { grid-template-columns: 1fr; padding: 10px; }
    .lt-row > span:first-child, .lt-row > span:last-child { grid-column: 1; }
    .card { padding: 12px; }
    .card h2 { font-size: 0.8125rem; }
    .login-card { min-width: 0; width: calc(100vw - 32px); padding: 24px; }
  }

  /* Touch — alvo mínimo de 44px nos botões críticos */
  @media (hover: none) and (pointer: coarse) {
    .nav-item { padding: 12px 14px; font-size: 0.9375rem; }
    .select, .btn-reset, .toggle { min-height: 40px; }
    .lt-row { min-height: 56px; }
    .modal-close { width: 40px; height: 40px; }
  }

  /* Scrollbar dark — webkit */
  .feed::-webkit-scrollbar, .timeline::-webkit-scrollbar { width: 6px; }
  .feed::-webkit-scrollbar-thumb, .timeline::-webkit-scrollbar-thumb { background: #1f2630; border-radius: 3px; }
  .feed::-webkit-scrollbar-track, .timeline::-webkit-scrollbar-track { background: transparent; }
</style>
