<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  let { data } = $props();

  // ── State ──
  let win = $state<'2m' | '15m' | '1h' | '6h' | '24h' | '7d'>('24h');
  let pathFilter = $state<'' | '/' | '/donate' | '/vsl'>('');
  let deviceFilter = $state<'' | 'mobile' | 'desktop' | 'tablet'>('');
  let snap = $state<any>(null);
  let lastUpdate = $state(0);
  let loading = $state(false);
  let pollTimer: ReturnType<typeof setInterval> | null = null;

  // ── Fetch ──
  async function pull() {
    loading = true;
    const params = new URLSearchParams({ window: win });
    if (pathFilter) params.set('path', pathFilter);
    if (deviceFilter) params.set('device', deviceFilter);
    try {
      const r = await fetch(`/api/analytics?${params}`, { cache: 'no-store' });
      if (!r.ok) return;
      snap = await r.json();
      lastUpdate = Date.now();
    } catch {}
    loading = false;
  }

  onMount(() => {
    if (!data.authed) return;
    pull();
    pollTimer = setInterval(pull, 3000);
    return () => { if (pollTimer) clearInterval(pollTimer); };
  });

  onDestroy(() => { if (pollTimer) clearInterval(pollTimer); });

  // Re-pull quando filtro muda
  $effect(() => {
    if (!data.authed) return;
    const _ = win + pathFilter + deviceFilter;
    pull();
  });

  // ── Helpers ──
  function fmtDuration(sec: number): string {
    if (sec < 60) return `${sec}s`;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}m${s.toString().padStart(2, '0')}s`;
  }
  function fmtPct(n: number): string {
    return (n * 100).toFixed(1) + '%';
  }
  function fmtTime(ts: number): string {
    const d = new Date(ts);
    return d.toLocaleTimeString('pt-BR', { hour12: false });
  }
  function evIcon(ev: string): string {
    switch (ev) {
      case 'pageview': return '👁';
      case 'scroll_depth': return '↓';
      case 'cta_click': return '✦';
      case 'amount_select': return '€';
      case 'bancontact_click': return '✓';
      case 'vsl_play_with_sound': return '▶';
      case 'vsl_complete': return '◉';
      default: return '·';
    }
  }
  function evLabel(ev: string): string {
    return ev.replace(/_/g, ' ');
  }
  function devIcon(d: string): string {
    return d === 'mobile' ? '📱' : d === 'tablet' ? '📲' : '🖥';
  }

  // Donut chart (SVG)
  function donutPaths(items: { label: string; value: number; color: string }[]) {
    const total = items.reduce((a, b) => a + b.value, 0);
    if (total === 0) return [];
    let acc = 0;
    const r = 60;
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
  const utmColors = ['#02a95c', '#1de9b6', '#4dd0e1', '#9575cd', '#ff7043', '#ffd54f'];
  const deviceColors = { mobile: '#02a95c', desktop: '#4dd0e1', tablet: '#ff7043' };

  // Derivacoes pra evitar @const fora de bloco
  const utmItems = $derived(
    snap?.utmBreakdown
      ? snap.utmBreakdown.slice(0, 6).map((u: any, i: number) => ({
          label: u.source,
          value: u.count,
          color: utmColors[i % utmColors.length]
        }))
      : []
  );
  const deviceItems = $derived(
    snap?.deviceCounts
      ? [
          { label: 'Mobile', value: snap.deviceCounts.mobile, color: deviceColors.mobile },
          { label: 'Desktop', value: snap.deviceCounts.desktop, color: deviceColors.desktop },
          { label: 'Tablet', value: snap.deviceCounts.tablet, color: deviceColors.tablet }
        ].filter((x) => x.value > 0)
      : []
  );

  // Time series — sparkline
  function sparkPath(series: { t: number; pv: number }[]): string {
    if (!series.length) return '';
    const w = 800;
    const h = 100;
    const max = Math.max(1, ...series.map((p) => p.pv));
    const dx = w / Math.max(1, series.length - 1);
    return series
      .map((p, i) => {
        const x = i * dx;
        const y = h - (p.pv / max) * h;
        return (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1);
      })
      .join(' ');
  }
  function sparkArea(series: { t: number; pv: number }[]): string {
    const line = sparkPath(series);
    if (!line) return '';
    const w = 800;
    const h = 100;
    return line + ` L ${w} ${h} L 0 ${h} Z`;
  }

  // Funnel
  function funnelPct(funnel: any) {
    const t = funnel.totalSessions || 1;
    return {
      total: 100,
      donate: (funnel.reachedDonate / t) * 100,
      select: (funnel.selectedAmount / t) * 100,
      checkout: (funnel.clickedBancontact / t) * 100
    };
  }

  let updateAgoSec = $state(0);
  let updateTimer: ReturnType<typeof setInterval> | null = null;
  onMount(() => {
    updateTimer = setInterval(() => {
      updateAgoSec = lastUpdate ? Math.round((Date.now() - lastUpdate) / 1000) : 0;
    }, 1000);
    return () => { if (updateTimer) clearInterval(updateTimer); };
  });
</script>

<svelte:head>
  <title>Dashboard · PawsCo Analytics</title>
  <meta name="robots" content="noindex" />
</svelte:head>

{#if !data.authed}
  <div class="login-wrap">
    <form method="POST" action="?/login" class="login-card">
      <h1>PawsCo · Analytics</h1>
      <p>Acesso restrito. Insira o token.</p>
      <input type="password" name="token" placeholder="Token" autofocus />
      <button type="submit">Entrar</button>
    </form>
  </div>
{:else}
<div class="dash">
  <header class="dash-head">
    <div class="brand">
      <span class="brand-dot"></span>
      <span class="brand-name">PawsCo · Analytics</span>
      <span class="status">
        <span class="status-dot" class:on={updateAgoSec < 6}></span>
        {updateAgoSec < 6 ? `live · ${updateAgoSec}s` : `${updateAgoSec}s atrás`}
      </span>
    </div>
    <div class="filters">
      <select bind:value={win}>
        <option value="2m">Últimos 2min</option>
        <option value="15m">Últimos 15min</option>
        <option value="1h">Última hora</option>
        <option value="6h">Últimas 6h</option>
        <option value="24h">Últimas 24h</option>
        <option value="7d">Últimos 7 dias</option>
      </select>
      <select bind:value={pathFilter}>
        <option value="">Todas as rotas</option>
        <option value="/">/ (LP)</option>
        <option value="/donate">/donate</option>
        <option value="/vsl">/vsl</option>
      </select>
      <select bind:value={deviceFilter}>
        <option value="">Todos dispositivos</option>
        <option value="mobile">Mobile</option>
        <option value="desktop">Desktop</option>
        <option value="tablet">Tablet</option>
      </select>
    </div>
  </header>

  {#if snap}
    <!-- KPIs -->
    <section class="kpi-grid">
      <div class="kpi kpi-live">
        <div class="kpi-label">Online agora (2 min)</div>
        <div class="kpi-value">{snap.kpis.online}</div>
        <div class="kpi-sub">visitantes ativos</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Pageviews na janela</div>
        <div class="kpi-value">{snap.kpis.pageviews.toLocaleString('pt-BR')}</div>
        <div class="kpi-sub">{snap.kpis.uniqueVisitors} visitantes únicos</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Taxa de conversão</div>
        <div class="kpi-value">{fmtPct(snap.kpis.conversionRate)}</div>
        <div class="kpi-sub">sessões → Bancontact</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Tempo médio na sessão</div>
        <div class="kpi-value">{fmtDuration(snap.kpis.avgSessionDurationSec)}</div>
        <div class="kpi-sub">duração média</div>
      </div>
    </section>

    <!-- Funil -->
    <section class="card">
      <h2>Funil de conversão</h2>
      {#each [
        { label: 'Sessões totais', value: snap.funnel.totalSessions, base: snap.funnel.totalSessions },
        { label: 'Chegaram em /donate', value: snap.funnel.reachedDonate, base: snap.funnel.totalSessions },
        { label: 'Selecionaram valor', value: snap.funnel.selectedAmount, base: snap.funnel.totalSessions },
        { label: 'Clicaram Bancontact', value: snap.funnel.clickedBancontact, base: snap.funnel.totalSessions }
      ] as step, i}
        <div class="funnel-row">
          <div class="funnel-label">{step.label}</div>
          <div class="funnel-bar-wrap">
            <div
              class="funnel-bar"
              style="width: {step.base ? (step.value / step.base) * 100 : 0}%; opacity: {1 - i * 0.15}"
            ></div>
            <span class="funnel-val">{step.value.toLocaleString('pt-BR')}</span>
          </div>
          <div class="funnel-pct">{step.base ? ((step.value / step.base) * 100).toFixed(1) : '0'}%</div>
        </div>
      {/each}
    </section>

    <!-- Time series -->
    <section class="card">
      <h2>Pageviews ao longo do tempo</h2>
      {#if snap.timeSeries && snap.timeSeries.length}
        <svg viewBox="0 0 800 100" class="spark" preserveAspectRatio="none">
          <path d={sparkArea(snap.timeSeries)} fill="rgba(2, 169, 92, 0.18)" />
          <path d={sparkPath(snap.timeSeries)} stroke="#02a95c" stroke-width="2" fill="none" />
        </svg>
        <div class="time-axis">
          <span>{new Date(snap.timeSeries[0].t).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
          <span>{new Date(snap.timeSeries[snap.timeSeries.length - 1].t).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      {/if}
    </section>

    <div class="two-col">
      <!-- Top Amounts -->
      <section class="card">
        <h2>Valores mais clicados</h2>
        {#if snap.topAmounts.length === 0}
          <p class="muted">Sem dados ainda na janela.</p>
        {:else}
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

      <!-- Top Paths -->
      <section class="card">
        <h2>Rotas mais visitadas</h2>
        {#if snap.topPaths.length === 0}
          <p class="muted">Sem pageviews na janela.</p>
        {:else}
          {#each snap.topPaths as p}
            <div class="bar-row">
              <div class="bar-label" title={p.path}>{p.path}</div>
              <div class="bar-wrap">
                <div class="bar-fill bar-fill-blue" style="width: {(p.count / snap.topPaths[0].count) * 100}%"></div>
              </div>
              <div class="bar-val">{p.count}</div>
            </div>
          {/each}
        {/if}
      </section>
    </div>

    <div class="two-col">
      <!-- UTM Source Donut -->
      <section class="card">
        <h2>Origem do tráfego</h2>
        {#if snap.utmBreakdown.length === 0}
          <p class="muted">Sem sessões na janela.</p>
        {:else}
          <div class="donut-wrap">
            <svg viewBox="0 0 140 140" class="donut">
              {#each donutPaths(utmItems) as slice}
                <path d={slice.d} fill={slice.color} />
              {/each}
              <circle cx="70" cy="70" r="34" fill="#0a0d12" />
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

      <!-- Device Breakdown -->
      <section class="card">
        <h2>Dispositivos</h2>
        {#if deviceItems.length === 0}
          <p class="muted">Sem sessões na janela.</p>
        {:else}
          <div class="donut-wrap">
            <svg viewBox="0 0 140 140" class="donut">
              {#each donutPaths(deviceItems) as slice}
                <path d={slice.d} fill={slice.color} />
              {/each}
              <circle cx="70" cy="70" r="34" fill="#0a0d12" />
            </svg>
            <div class="legend">
              {#each deviceItems as it}
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
    </div>

    <!-- Live Sessions -->
    <section class="card">
      <h2>Sessões ativas <span class="muted small">· últimos 2min</span></h2>
      {#if snap.liveSessions.length === 0}
        <p class="muted">Ninguém na página agora.</p>
      {:else}
        <div class="live-table">
          <div class="lt-head">
            <span>Visitante</span>
            <span>Rota</span>
            <span>Dispositivo</span>
            <span>Origem</span>
            <span>Tempo</span>
            <span>Estado</span>
          </div>
          {#each snap.liveSessions as s}
            <div class="lt-row" class:converted={s.clickedBancontact}>
              <span class="mono">#{s.sid}</span>
              <span class="path">{s.path}</span>
              <span>{devIcon(s.device)} {s.device}</span>
              <span class="muted">{s.utm_source || '(direct)'}</span>
              <span>{fmtDuration(s.durationSec)}</span>
              <span>
                {#if s.clickedBancontact}<span class="tag tag-green">checkout</span>
                {:else if s.selectedAmount !== null}<span class="tag tag-orange">€{s.selectedAmount}</span>
                {:else if s.reachedDonate}<span class="tag tag-blue">/donate</span>
                {:else}<span class="tag">browse</span>
                {/if}
              </span>
            </div>
          {/each}
        </div>
      {/if}
    </section>

    <!-- Live Feed -->
    <section class="card">
      <h2>Feed de eventos <span class="muted small">· últimos 5min</span></h2>
      {#if snap.liveFeed.length === 0}
        <p class="muted">Sem eventos recentes.</p>
      {:else}
        <div class="feed">
          {#each snap.liveFeed as e}
            <div class="feed-row">
              <span class="feed-icon">{evIcon(e.ev)}</span>
              <span class="feed-ev">{evLabel(e.ev)}</span>
              <span class="feed-data">
                {#if e.data && e.data.amount}€{e.data.amount}{/if}
                {#if e.data && e.data.pct}{e.data.pct}%{/if}
              </span>
              <span class="feed-path">{e.path}</span>
              <span class="mono feed-sid">#{e.sid}</span>
              <span class="feed-time">{fmtTime(e.ts)}</span>
            </div>
          {/each}
        </div>
      {/if}
    </section>

    <footer class="dash-foot">
      <span>{snap.capacity.events} eventos · {snap.capacity.sessions} sessões em memória</span>
      <span>refresh a cada 3s · poll #{Math.floor(lastUpdate / 1000)}</span>
    </footer>
  {:else}
    <div class="loading">Carregando dados…</div>
  {/if}
</div>
{/if}

<style>
  :global(body) { background: #0a0d12; color: #e6e9ef; }
  :global(html), :global(body) { margin: 0; padding: 0; }

  .login-wrap {
    min-height: 100vh; display: grid; place-items: center;
    background: linear-gradient(135deg, #050608 0%, #0a0d12 100%);
  }
  .login-card {
    background: #11161d; border: 1px solid #1f2630;
    padding: 32px; border-radius: 12px; min-width: 320px;
    display: flex; flex-direction: column; gap: 12px;
  }
  .login-card h1 { margin: 0; font-size: 1.4rem; }
  .login-card p { margin: 0; color: #8b94a4; font-size: 0.875rem; }
  .login-card input {
    background: #0a0d12; border: 1px solid #2a3340; color: #e6e9ef;
    padding: 12px; border-radius: 8px; font-size: 0.9375rem;
  }
  .login-card button {
    background: #02a95c; color: #fff; border: none; padding: 12px;
    border-radius: 8px; font-weight: 600; cursor: pointer;
  }

  .dash {
    max-width: 1400px; margin: 0 auto; padding: 24px;
    font-family: -apple-system, "Inter", system-ui, sans-serif;
  }
  .dash-head {
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: 24px; flex-wrap: wrap; gap: 12px;
  }
  .brand { display: flex; align-items: center; gap: 10px; }
  .brand-dot {
    width: 10px; height: 10px; border-radius: 50%; background: #02a95c;
    box-shadow: 0 0 12px #02a95c;
  }
  .brand-name { font-weight: 700; letter-spacing: -0.01em; }
  .status {
    margin-left: 16px; font-size: 0.8125rem; color: #8b94a4;
    display: inline-flex; align-items: center; gap: 6px;
  }
  .status-dot {
    width: 6px; height: 6px; border-radius: 50%; background: #555;
  }
  .status-dot.on { background: #02a95c; animation: pulse 1.5s ease-in-out infinite; }
  @keyframes pulse {
    0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(2, 169, 92, 0.6); }
    50% { opacity: 0.6; box-shadow: 0 0 0 6px rgba(2, 169, 92, 0); }
  }

  .filters { display: flex; gap: 8px; flex-wrap: wrap; }
  .filters select {
    background: #11161d; border: 1px solid #1f2630; color: #e6e9ef;
    padding: 8px 12px; border-radius: 8px; font-size: 0.875rem;
    cursor: pointer; font-family: inherit;
  }
  .filters select:hover { border-color: #2a3340; }

  .kpi-grid {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 16px; margin-bottom: 24px;
  }
  .kpi {
    background: #11161d; border: 1px solid #1f2630; padding: 20px;
    border-radius: 12px; position: relative; overflow: hidden;
  }
  .kpi-live::before {
    content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px;
    background: linear-gradient(90deg, transparent, #02a95c, transparent);
    animation: live-shimmer 2s linear infinite;
  }
  @keyframes live-shimmer {
    0% { transform: translateX(-100%); } 100% { transform: translateX(100%); }
  }
  .kpi-label { color: #8b94a4; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; }
  .kpi-value { font-size: 2.25rem; font-weight: 700; margin-top: 8px; letter-spacing: -0.02em; }
  .kpi-live .kpi-value { color: #02a95c; }
  .kpi-sub { color: #8b94a4; font-size: 0.8125rem; margin-top: 4px; }

  .card {
    background: #11161d; border: 1px solid #1f2630; padding: 20px;
    border-radius: 12px; margin-bottom: 20px;
  }
  .card h2 { margin: 0 0 16px 0; font-size: 0.9375rem; font-weight: 600; color: #d6dae3; }
  .card h2 .small { font-weight: 400; font-size: 0.8125rem; }

  .two-col {
    display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;
  }
  @media (max-width: 800px) { .two-col { grid-template-columns: 1fr; } }

  /* Funil */
  .funnel-row {
    display: grid; grid-template-columns: 200px 1fr 60px;
    gap: 12px; align-items: center; margin-bottom: 10px;
  }
  .funnel-label { font-size: 0.875rem; color: #d6dae3; }
  .funnel-bar-wrap {
    background: #0a0d12; height: 32px; border-radius: 6px; position: relative;
    overflow: hidden; border: 1px solid #1f2630;
  }
  .funnel-bar {
    background: linear-gradient(90deg, #02a95c, #1de9b6);
    height: 100%; transition: width 0.4s ease;
  }
  .funnel-val {
    position: absolute; right: 8px; top: 50%; transform: translateY(-50%);
    font-size: 0.8125rem; font-weight: 600;
  }
  .funnel-pct { color: #02a95c; font-weight: 600; text-align: right; }

  /* Bars */
  .bar-row {
    display: grid; grid-template-columns: 80px 1fr 50px; gap: 10px;
    align-items: center; margin-bottom: 8px;
  }
  .bar-label { font-size: 0.875rem; color: #d6dae3; }
  .bar-wrap {
    background: #0a0d12; height: 22px; border-radius: 4px;
    border: 1px solid #1f2630; overflow: hidden;
  }
  .bar-fill {
    background: linear-gradient(90deg, #02a95c, #1de9b6);
    height: 100%; transition: width 0.4s;
  }
  .bar-fill-blue {
    background: linear-gradient(90deg, #4dd0e1, #1de9b6);
  }
  .bar-val { color: #8b94a4; font-size: 0.8125rem; text-align: right; }

  /* Sparkline */
  .spark { width: 100%; height: 120px; }
  .time-axis {
    display: flex; justify-content: space-between; color: #8b94a4;
    font-size: 0.75rem; margin-top: 8px;
  }

  /* Donuts */
  .donut-wrap { display: flex; gap: 20px; align-items: center; flex-wrap: wrap; }
  .donut { width: 140px; height: 140px; flex-shrink: 0; }
  .legend { display: flex; flex-direction: column; gap: 6px; flex: 1; min-width: 0; }
  .legend-row { display: flex; align-items: center; gap: 8px; font-size: 0.8125rem; }
  .legend-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
  .legend-label { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .legend-val { color: #8b94a4; }

  /* Live table */
  .live-table { display: flex; flex-direction: column; gap: 4px; }
  .lt-head, .lt-row {
    display: grid; grid-template-columns: 90px 1.5fr 1fr 1fr 80px 100px;
    gap: 12px; padding: 8px 12px; align-items: center;
  }
  .lt-head { color: #8b94a4; font-size: 0.75rem; text-transform: uppercase; }
  .lt-row {
    background: #0a0d12; border-radius: 6px; font-size: 0.8125rem;
    border: 1px solid transparent;
  }
  .lt-row.converted { border-color: #02a95c; box-shadow: 0 0 12px rgba(2, 169, 92, 0.2); }
  .lt-row .path { font-family: ui-monospace, monospace; color: #4dd0e1; }
  .mono { font-family: ui-monospace, monospace; color: #8b94a4; }

  .tag {
    display: inline-block; padding: 2px 8px; border-radius: 999px;
    font-size: 0.6875rem; font-weight: 600; background: #1f2630; color: #8b94a4;
  }
  .tag-green { background: rgba(2, 169, 92, 0.2); color: #02a95c; }
  .tag-orange { background: rgba(255, 112, 67, 0.2); color: #ff7043; }
  .tag-blue { background: rgba(77, 208, 225, 0.2); color: #4dd0e1; }

  /* Feed */
  .feed { display: flex; flex-direction: column; gap: 2px; max-height: 400px; overflow-y: auto; }
  .feed-row {
    display: grid; grid-template-columns: 24px 140px 80px 1fr 90px 90px;
    gap: 10px; padding: 6px 10px; font-size: 0.8125rem; align-items: center;
    border-bottom: 1px solid #1a1f28;
  }
  .feed-icon { color: #02a95c; font-size: 1rem; text-align: center; }
  .feed-ev { font-weight: 500; }
  .feed-data { color: #ffd54f; font-family: ui-monospace, monospace; font-size: 0.75rem; }
  .feed-path { color: #4dd0e1; font-family: ui-monospace, monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .feed-sid { font-size: 0.75rem; }
  .feed-time { color: #8b94a4; font-size: 0.75rem; text-align: right; }

  .muted { color: #8b94a4; }
  .small { font-size: 0.75rem; }
  .loading { color: #8b94a4; padding: 60px; text-align: center; }

  .dash-foot {
    margin-top: 24px; padding-top: 16px; border-top: 1px solid #1f2630;
    display: flex; justify-content: space-between; color: #8b94a4; font-size: 0.75rem;
  }
</style>
