<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  let { data } = $props();

  // ── State ──
  type Tab = 'overview' | 'live' | 'funnel' | 'vsl' | 'heatmap' | 'sessions' | 'revenue' | 'tech' | 'ads' | 'taxas' | 'campanhas';
  type Period = 'hoje' | 'ontem' | 'hoje_ontem' | 'ultimos_7d' | 'este_mes';
  let activeTab = $state<Tab>('overview');
  let period = $state<Period>('hoje');
  // win e fbWin são derivados do período unificado
  let win = $state<'2m' | '15m' | '1h' | '6h' | '24h' | '7d'>('24h');
  let pathFilter = $state<'' | '/' | '/donate' | '/vsl'>('');
  let deviceFilter = $state<'' | 'mobile' | 'desktop' | 'tablet'>('');
  let countryFilter = $state('');

  // ── País / Moeda ──
  type DisplayCurrency = 'BRL' | 'EUR' | 'USD';
  let displayCurrency = $state<DisplayCurrency>('BRL');
  const COUNTRY_OPTIONS = [
    { code: '',   flag: '🌍', label: 'Todos',   currency: 'BRL' as DisplayCurrency },
    { code: 'BR', flag: '🇧🇷', label: 'Brasil',  currency: 'BRL' as DisplayCurrency },
    { code: 'BE', flag: '🇧🇪', label: 'Bélgica', currency: 'EUR' as DisplayCurrency },
    { code: 'NL', flag: '🇳🇱', label: 'Holanda', currency: 'EUR' as DisplayCurrency },
    { code: 'US', flag: '🇺🇸', label: 'EUA',     currency: 'USD' as DisplayCurrency },
  ];
  let selectedCountryOpt = $state(COUNTRY_OPTIONS[0]);
  function selectCountry(opt: typeof COUNTRY_OPTIONS[number]) {
    selectedCountryOpt = opt;
    countryFilter = opt.code;
    displayCurrency = opt.currency;
  }

  // ── Período colapsável ──
  let periodOpen = $state(false);
  const includeBots = false; // bots sempre filtrados

  const PERIOD_LABELS: Record<Period, string> = {
    hoje:        'Hoje',
    ontem:       'Ontem',
    hoje_ontem:  'Hoje + Ontem',
    ultimos_7d:  'Últimos 7 dias',
    este_mes:    'Este mês',
  };
  // Modo da API analytics: today|yesterday|hoje_ontem|month|null (null = usa window)
  const PERIOD_TO_MODE: Record<Period, string | null> = {
    hoje:       'today',
    ontem:      'yesterday',
    hoje_ontem: 'hoje_ontem',
    ultimos_7d: null,   // usa window=7d
    este_mes:   'month',
  };
  const PERIOD_TO_WIN: Record<Period, typeof win> = {
    hoje:       '24h',
    ontem:      '24h',
    hoje_ontem: '24h',
    ultimos_7d: '7d',
    este_mes:   '7d',
  };
  type FbWinExtended = 'today' | 'yesterday' | 'hoje_ontem' | 'last_7_d' | 'last_14_d' | 'last_30_d' | 'this_month';
  const PERIOD_TO_FBWIN: Record<Period, FbWinExtended> = {
    hoje:       'today',
    ontem:      'yesterday',
    hoje_ontem: 'hoje_ontem',
    ultimos_7d: 'last_7_d',
    este_mes:   'this_month',
  };
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
    const params = new URLSearchParams();
    const mode = PERIOD_TO_MODE[period];
    if (mode) {
      params.set('mode', mode);
    } else {
      // 7d
      params.set('window', '7d');
    }
    if (pathFilter) params.set('path', pathFilter);
    if (deviceFilter) params.set('device', deviceFilter);
    if (countryFilter) params.set('country', countryFilter);
    if (includeBots) params.set('bots', '1');
    // Cache-buster: iOS Safari ignora cache:'no-store' as vezes;
    // adicionar param unico forca request fresh.
    params.set('_t', String(Date.now()));
    try {
      const r = await fetch(`/api/analytics?${params}`, {
        cache: 'no-store',
        headers: {
          'cache-control': 'no-cache, no-store, must-revalidate',
          'pragma': 'no-cache'
        }
      });
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
    // Inclui period diretamente — win pode ser igual entre 'hoje' e 'ontem'
    const _ = period + win + pathFilter + deviceFilter + countryFilter + includeBots;
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

  // ── Refresh manual ──
  let flashing = $state(false);

  async function refresh() {
    if (refreshing) return;
    refreshing = true;
    try {
      // Força busca de analytics + FB Ads (igual ao F5, mas sem recarregar a página)
      // Cada call tem cache-buster, garante dados fresh mesmo no iOS Safari.
      await Promise.all([pull(), pullFbAds()]);
    } catch (e) {
      console.warn('[dashboard] refresh failed', e);
    } finally {
      // Sempre solta o estado, mesmo se algum fetch falhou.
      refreshing = false;
    }
    // Pisca KPIs para dar feedback visual de que os dados chegaram
    flashing = true;
    setTimeout(() => (flashing = false), 450);
  }

  // Re-puxa quando a aba volta a ficar visivel (volta do background no mobile).
  // Evita o caso "fecho e abro o app, ai sim atualiza".
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && data.authed) {
        pull();
        pullFbAds();
      }
    });
  }

  // ── Helpers ──
  const fmtNum = (n: number) => n.toLocaleString('pt-BR');
  function fmtAgo(sec: number): string {
    if (sec < 5) return 'agora mesmo';
    if (sec < 60) return `${sec}s atrás`;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    if (m < 60) return s > 0 ? `${m}m ${s}s atrás` : `${m}m atrás`;
    const h = Math.floor(m / 60);
    const rm = m % 60;
    return rm > 0 ? `${h}h ${rm}m atrás` : `${h}h atrás`;
  }
  const fmtPct = (n: number) => (n * 100).toFixed(1) + '%';
  const fmtDelta = (n: number) => (n >= 0 ? '+' : '') + (n * 100).toFixed(1) + '%';
  const fmtEur = (n: number) => '€' + n.toFixed(2).replace('.', ',');
  const fmtBrl = (n: number) => 'R$ ' + n.toFixed(2).replace('.', ',');
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
          label: u.source === '(direct)' ? 'Sem UTM / Direto' : u.source,
          value: u.count,
          color: PALETTE[i % PALETTE.length],
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

  // ── FB Ads ──
  let fbWin = $state<FbWinExtended>('today');
  let fbAds = $state<any>(null);
  let fbLoading = $state(false);

  async function pullFbAds() {
    fbLoading = true;
    try {
      const r = await fetch(`/api/fb-ads?window=${fbWin}`, { cache: 'no-store' });
      if (r.ok) fbAds = await r.json();
    } catch {}
    fbLoading = false;
  }

  // Efeito: quando period muda, atualiza win + fbWin em sincronia
  $effect(() => {
    if (!data.authed) return;
    const _p = period;
    win   = PERIOD_TO_WIN[_p];
    fbWin = PERIOD_TO_FBWIN[_p];
  });

  $effect(() => {
    if (!data.authed) return;
    const _w = fbWin;
    pullFbAds();
  });

  // ── Tax Config ──
  interface TaxConfig {
    shopifyPct:   number;  // % da receita
    gatewayPct:   number;  // % da receita
    shopifyFixed: number;  // € fixo (ex: mensalidade)
    otherFixed:   number;  // outros custos € fixos
    eurToUsd:     number;  // taxa EUR→USD (ex: 1.08 = 1 EUR = 1.08 USD)
    usdToBrl:     number;  // taxa USD→BRL (ex: 5.70)
  }
  const DEFAULT_TAX: TaxConfig = {
    shopifyPct: 17, gatewayPct: 0,  // 17% padrão (igual UTMfy)
    shopifyFixed: 0, otherFixed: 0,
    eurToUsd: 1.08, usdToBrl: 5.70,
  };
  let taxConfig = $state<TaxConfig>({ ...DEFAULT_TAX });
  let taxSaved = $state(false);

  // Visible cards na overview
  type CardId = 'online' | 'sessions' | 'pageviews' | 'faturamento' | 'revenue' | 'conversion' | 'duration' | 'spend' | 'profit' | 'roas' | 'roi' | 'margem' | 'taxas_card';
  const ALL_CARD_DEFS: { id: CardId; label: string }[] = [
    { id: 'faturamento',  label: 'Faturamento Líquido' },
    { id: 'spend',        label: 'Gastos com Anúncios' },
    { id: 'roas',         label: 'ROAS' },
    { id: 'profit',       label: 'Lucro' },
    { id: 'roi',          label: 'ROI' },
    { id: 'margem',       label: 'Margem' },
    { id: 'taxas_card',   label: 'Taxas' },
    { id: 'online',       label: 'Online agora' },
    { id: 'sessions',     label: 'Sessões' },
    { id: 'pageviews',    label: 'Pageviews' },
    { id: 'revenue',      label: 'Receita Bruta' },
    { id: 'conversion',   label: 'Conversão' },
    { id: 'duration',     label: 'Tempo médio' },
  ];
  const DEFAULT_ORDER: CardId[] = ['faturamento','spend','roas','profit','roi','margem','taxas_card','online','sessions','pageviews','revenue','conversion','duration'];
  const DEFAULT_VISIBLE: CardId[] = ['faturamento','spend','roas','profit','roi','margem','taxas_card','online','sessions','pageviews'];
  let visibleCards = $state<Set<CardId>>(new Set(DEFAULT_VISIBLE));
  let cardOrder = $state<CardId[]>([...DEFAULT_ORDER]);
  let dragSrc = $state<CardId | null>(null);
  let customizeOpen = $state(false);
  // Modo edicao (mobile): long-press num card ativa, mostra handles + painel personalizar
  let editMode = $state(false);
  let longPressTimer: ReturnType<typeof setTimeout> | null = null;
  const LONG_PRESS_MS = 500;

  function startLongPress(e: PointerEvent) {
    if (e.pointerType === 'mouse') return; // so touch/pen
    if (editMode) return; // ja em edit, ignora
    // ignora se o toque foi na alca (handle ja gerencia)
    if ((e.target as HTMLElement).closest('.kpi-drag-handle')) return;
    if (longPressTimer) clearTimeout(longPressTimer);
    longPressTimer = setTimeout(() => {
      editMode = true;
      customizeOpen = true;
      if (navigator.vibrate) navigator.vibrate(25);
    }, LONG_PRESS_MS);
  }
  function cancelLongPress() {
    if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
  }
  function exitEditMode() {
    editMode = false;
    customizeOpen = false;
  }

  // ── Taxa de câmbio ao vivo ──
  let liveRate = $state<{ usdToBrl: number; eurToBrl: number; eurToUsd: number; source: string; updatedAt: number } | null>(null);

  async function fetchLiveRate() {
    try {
      const r = await fetch('/api/exchange-rate', { cache: 'no-store' });
      if (r.ok) liveRate = await r.json();
    } catch {}
  }

  // Taxas efetivas: usa câmbio ao vivo; fallback para manual do taxConfig
  const activeUsdToBrl = $derived(liveRate?.usdToBrl ?? taxConfig.usdToBrl ?? 5.70);
  const activeEurToBrl = $derived(liveRate?.eurToBrl ?? (taxConfig.eurToUsd * activeUsdToBrl));

  onMount(() => {
    if (!data.authed) return;
    // Carrega taxConfig do localStorage
    try {
      const saved = localStorage.getItem('vitrack_tax');
      if (saved) taxConfig = { ...DEFAULT_TAX, ...JSON.parse(saved) };
    } catch {}
    // Carrega visibleCards
    try {
      const sc = localStorage.getItem('vitrack_cards');
      if (sc) visibleCards = new Set(JSON.parse(sc) as CardId[]);
    } catch {}
    // Carrega cardOrder
    try {
      const co = localStorage.getItem('vitrack_card_order');
      if (co) {
        const parsed = JSON.parse(co) as CardId[];
        const valid = DEFAULT_ORDER.filter(id => !parsed.includes(id));
        cardOrder = [...parsed.filter(id => DEFAULT_ORDER.includes(id)), ...valid];
      }
    } catch {}
    // Busca câmbio ao vivo
    fetchLiveRate();
  });

  function dragStart(id: CardId) { dragSrc = id; }
  function dragOverCard(e: DragEvent, id: CardId) {
    e.preventDefault();
    if (!dragSrc || dragSrc === id) return;
    const next = [...cardOrder];
    const from = next.indexOf(dragSrc);
    const to = next.indexOf(id);
    if (from === -1 || to === -1) return;
    next.splice(from, 1);
    next.splice(to, 0, dragSrc);
    cardOrder = next;
  }
  function dragEnd() {
    dragSrc = null;
    localStorage.setItem('vitrack_card_order', JSON.stringify(cardOrder));
  }

  // ── Drag via alca (handle) — funciona em touch + mouse.
  // Estrategia: cada card tem um <button class="kpi-drag-handle"> com
  // touch-action:none. Touch nele = drag direto, sem hold. Touch no
  // resto do card = scroll normal.
  let pointerDragId: CardId | null = null;

  function findCardIdFromPoint(x: number, y: number): CardId | null {
    const el = document.elementFromPoint(x, y);
    if (!el) return null;
    const card = (el as Element).closest('[data-card-id]') as HTMLElement | null;
    return (card?.dataset.cardId as CardId) || null;
  }

  function handlePointerDown(e: PointerEvent, id: CardId) {
    e.preventDefault();
    e.stopPropagation();
    const target = e.currentTarget as HTMLElement;
    try { target.setPointerCapture(e.pointerId); } catch {}
    pointerDragId = id;
    dragSrc = id;
    if (navigator.vibrate) navigator.vibrate(15);
  }

  function handlePointerMove(e: PointerEvent) {
    if (!pointerDragId) return;
    e.preventDefault();
    const overId = findCardIdFromPoint(e.clientX, e.clientY);
    if (!overId || overId === pointerDragId) return;
    const next = [...cardOrder];
    const from = next.indexOf(pointerDragId);
    const to = next.indexOf(overId);
    if (from === -1 || to === -1) return;
    next.splice(from, 1);
    next.splice(to, 0, pointerDragId);
    cardOrder = next;
  }

  function handlePointerUp(e: PointerEvent) {
    const target = e.currentTarget as HTMLElement;
    try { target.releasePointerCapture(e.pointerId); } catch {}
    if (pointerDragId) {
      pointerDragId = null;
      dragSrc = null;
      localStorage.setItem('vitrack_card_order', JSON.stringify(cardOrder));
    }
  }

  function saveTax() {
    localStorage.setItem('vitrack_tax', JSON.stringify(taxConfig));
    taxSaved = true;
    setTimeout(() => (taxSaved = false), 2500);
  }

  function toggleCard(id: CardId) {
    const next = new Set(visibleCards);
    if (next.has(id)) next.delete(id); else next.add(id);
    visibleCards = next;
    localStorage.setItem('vitrack_cards', JSON.stringify([...next]));
  }

  // Cálculo de lucro
  const adSpendEur = $derived(fbAds?.spend ? fbAds.spend / (taxConfig.eurToUsd || 1.08) : 0);
  const totalTaxEur = $derived((rev: number) =>
    rev * (taxConfig.shopifyPct / 100) +
    rev * (taxConfig.gatewayPct  / 100) +
    taxConfig.shopifyFixed +
    taxConfig.otherFixed
  );
  const profitEur = $derived(
    snap ? snap.kpis.revenue - adSpendEur - totalTaxEur(snap.kpis.revenue) : 0
  );
  const roasCalc = $derived(
    adSpendEur > 0 && snap ? (snap.kpis.revenue / adSpendEur) : 0
  );

  // Conversões BRL — usa câmbio ao vivo (BCB), fallback para manual
  const eurToBrl   = $derived(activeEurToBrl);
  const adSpendBrl = $derived(fbAds?.spend ? fbAds.spend * activeUsdToBrl : 0);
  const revenueBrl = $derived(snap ? snap.kpis.revenue * activeEurToBrl : 0);
  const profitBrl  = $derived(profitEur * activeEurToBrl);

  // ── Métricas estilo UTMfy ──────────────────────────────────────────
  // Faturamento Líquido = Receita bruta − taxa Shopify (% sobre receita)
  const taxasBrl          = $derived(snap ? snap.kpis.revenue * (taxConfig.shopifyPct / 100) * activeEurToBrl : 0);
  const faturamentoLiqBrl = $derived(revenueBrl - taxasBrl);
  // ROAS = Receita bruta BRL / Gasto BRL (= UTMfy ROAS)
  const roasUtm           = $derived(adSpendBrl > 0 && snap ? revenueBrl / adSpendBrl : 0);
  // ROI = Faturamento Líquido / Gasto BRL (= UTMfy ROI)
  const roiUtm            = $derived(adSpendBrl > 0 ? faturamentoLiqBrl / adSpendBrl : 0);
  // Lucro = Faturamento Líquido − Gasto
  const lucroUtmBrl       = $derived(faturamentoLiqBrl - adSpendBrl);
  // Margem = Lucro / Faturamento Líquido
  const margemPct         = $derived(faturamentoLiqBrl > 0 ? (lucroUtmBrl / faturamentoLiqBrl) * 100 : 0);

  const fmtUsd = (n: number) => '$' + n.toFixed(2).replace('.', ',');
  const fmtPct2 = (n: number) => n.toFixed(2) + '%';

  // Formata gasto (USD) na moeda display ativa
  function fmtSpendDisplay(usd: number): string {
    if (displayCurrency === 'USD') return '$' + usd.toFixed(2);
    if (displayCurrency === 'EUR') return '€' + (usd / (liveRate?.eurToUsd ?? 1.16)).toFixed(2).replace('.', ',');
    return 'R$ ' + (usd * activeUsdToBrl).toFixed(2).replace('.', ',');
  }
  // Sub-label do gasto (moeda secundária)
  function fmtSpendSub(usd: number): string {
    if (displayCurrency === 'BRL') return fmtUsd(usd);
    return 'R$ ' + (usd * activeUsdToBrl).toFixed(2).replace('.', ',');
  }

  // ── Campanhas ──
  let fbCampaigns = $state<any[]>([]);
  let campaignsLoading = $state(false);

  async function pullCampaigns() {
    campaignsLoading = true;
    try {
      const r = await fetch(`/api/fb-ads?window=${fbWin}&campaigns=1`, { cache: 'no-store' });
      if (r.ok) {
        const d = await r.json();
        fbCampaigns = d.campaigns || [];
      }
    } catch {}
    campaignsLoading = false;
  }

  $effect(() => {
    if (!data.authed) return;
    if (activeTab === 'campanhas') {
      const _w = fbWin;
      pullCampaigns();
    }
  });

  let updateAgoSec = $state(0);
  let refreshing = $state(false);
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
  <link rel="icon" type="image/png" href="/dashboard/vitrack-favicon.png?v=2" />
  <meta name="robots" content="noindex" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap" />
</svelte:head>

{#if !data.authed}
  <div class="login-wrap">
    <form method="POST" action="?/login" class="login-card">
      <div class="login-brand">
        <img src="/dashboard/vitrack-logo.png?v=2" alt="Vitrack" class="brand-logo" />
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
        <img src="/dashboard/vitrack-logo.png?v=2" alt="Vitrack" class="brand-logo-side" />
      {:else}
        <img src="/dashboard/vitrack-favicon.png?v=2" alt="Vitrack" class="brand-favicon-side" />
      {/if}
    </div>
    <nav class="nav">
      {#each [
        { id: 'overview', label: 'Visão geral', icon: '◐' },
        { id: 'live', label: 'Live', icon: '●' },
        { id: 'funnel', label: 'Funil', icon: '⊞' },
        { id: 'campanhas', label: 'Campanhas', icon: '⊞' },
        { id: 'taxas', label: 'Taxas', icon: '⊕' },
        { id: 'vsl', label: 'VSL', icon: '▶' },
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
          <h1 class="page-title">Dashboard</h1>
        </div>
        <div class="update-row">
          <span class="status">
            <span class="status-dot" class:on={updateAgoSec < 6}></span>
            <span class="status-text">
              {updateAgoSec < 6 ? 'live' : 'Atualizado há ' + fmtAgo(updateAgoSec)}
            </span>
          </span>
          <button
            class="btn-update"
            onclick={refresh}
            disabled={refreshing}
          >{refreshing ? 'Atualizando' : 'Atualizar'}</button>
        </div>
        <button class="filters-toggle" aria-label="filtros" onclick={() => (mobileFiltersOpen = !mobileFiltersOpen)}>
          {mobileFiltersOpen ? '✕' : '⌥'}
        </button>
      </div>
      <div class="topbar-right" class:mobile-open={mobileFiltersOpen}>
        <!-- Período de visualização colapsável -->
        <button class="period-label-btn" onclick={() => (periodOpen = !periodOpen)}>
          <span class="period-label-icon">📅</span>
          <span>Período</span>
          <span class="period-label-active">{PERIOD_LABELS[period]}</span>
          <span class="period-chevron" class:open={periodOpen}>▾</span>
        </button>
        {#if periodOpen}
          <div class="period-pills">
            {#each (['hoje','ontem','hoje_ontem','ultimos_7d','este_mes'] as Period[]) as p}
              <button
                class="period-pill"
                class:active={period === p}
                onclick={() => { period = p; periodOpen = false; }}
              >{PERIOD_LABELS[p]}</button>
            {/each}
          </div>
        {/if}
        <select bind:value={pathFilter} class="select select-sm">
          <option value="">Todas rotas</option>
          <option value="/">/ (LP)</option>
          <option value="/donate">/donate</option>
          <option value="/vsl">/vsl</option>
        </select>
        <select bind:value={deviceFilter} class="select select-sm">
          <option value="">Todos devices</option>
          <option value="mobile">Mobile</option>
          <option value="desktop">Desktop</option>
          <option value="tablet">Tablet</option>
        </select>
        <!-- Seletor de país / moeda com bandeira -->
        <div class="country-select-wrap">
          <select
            class="select select-flag"
            value={selectedCountryOpt.code}
            onchange={(e) => {
              const opt = COUNTRY_OPTIONS.find(o => o.code === (e.target as HTMLSelectElement).value);
              if (opt) selectCountry(opt);
            }}
          >
            {#each COUNTRY_OPTIONS as opt}
              <option value={opt.code}>{opt.flag} {opt.label}</option>
            {/each}
          </select>
          <span class="currency-badge currency-{displayCurrency.toLowerCase()}">
            {displayCurrency}
          </span>
        </div>
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
      <div class="tab-content">
        <!-- Customize button (so desktop / sempre visivel; mobile usa long-press) -->
        <div class="customize-bar" class:edit-mode={editMode}>
          {#if editMode}
            <button class="btn-customize btn-customize-exit" onclick={exitEditMode}>
              ✓ Concluir edição
            </button>
          {:else}
            <button class="btn-customize btn-customize-desktop" onclick={() => (customizeOpen = !customizeOpen)}>
              {customizeOpen ? '✕ Fechar' : '⊙ Personalizar'}
            </button>
          {/if}
        </div>

        {#if customizeOpen}
          <div class="customize-panel">
            <p class="muted small" style="margin:0 0 10px">Escolha quais cards aparecem na visão geral:</p>
            <div class="card-toggles">
              {#each ALL_CARD_DEFS as def}
                <label class="card-toggle-item" class:active={visibleCards.has(def.id)}>
                  <input type="checkbox" checked={visibleCards.has(def.id)} onchange={() => toggleCard(def.id)} />
                  {def.label}
                </label>
              {/each}
            </div>
          </div>
        {/if}

        <!-- KPIs (drag para reordenar; mobile: long-press ativa edit mode) -->
        <section class="kpi-grid" class:flash={flashing} class:edit-mode={editMode}>
          {#each cardOrder.filter(id => visibleCards.has(id)) as cardId (cardId)}
            <div
              class="kpi"
              class:kpi-live={cardId === 'online'}
              class:kpi-spend={cardId === 'spend'}
              class:kpi-profit-pos={cardId === 'profit' && profitBrl > 0}
              class:kpi-profit-neg={cardId === 'profit' && profitBrl < 0}
              class:kpi-dragging={dragSrc === cardId}
              data-card-id={cardId}
              draggable="true"
              ondragstart={() => dragStart(cardId)}
              ondragover={(e) => dragOverCard(e, cardId)}
              ondragend={dragEnd}
              onpointerdown={startLongPress}
              onpointerup={cancelLongPress}
              onpointercancel={cancelLongPress}
              onpointermove={cancelLongPress}
              onpointerleave={cancelLongPress}
            >
              <button
                type="button"
                class="kpi-drag-handle"
                aria-label="Arrastar card"
                onpointerdown={(e) => handlePointerDown(e, cardId)}
                onpointermove={handlePointerMove}
                onpointerup={handlePointerUp}
                onpointercancel={handlePointerUp}
              >⠿</button>
              {#if cardId === 'online'}
                <div class="kpi-label">Online agora</div>
                <div class="kpi-online-hero">
                  <div class="kpi-online-number">{snap.kpis.online}</div>
                  <div class="kpi-online-caption">visitantes ativos · últimos 2 min</div>
                </div>
                <div class="kpi-breakdown kpi-breakdown-online">
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
              {:else if cardId === 'sessions'}
                <div class="kpi-label">Sessões</div>
                <div class="kpi-value">{fmtNum(snap.kpis.totalSessions)}</div>
                <div class="kpi-sub kpi-delta {deltaClass(snap.compare.sessions.delta)}">
                  {fmtDelta(snap.compare.sessions.delta)} vs período anterior
                </div>
              {:else if cardId === 'pageviews'}
                <div class="kpi-label">Pageviews</div>
                <div class="kpi-value">{fmtNum(snap.kpis.pageviews)}</div>
                <div class="kpi-sub kpi-delta {deltaClass(snap.compare.pageviews.delta)}">
                  {fmtDelta(snap.compare.pageviews.delta)}
                </div>
              {:else if cardId === 'revenue'}
                <div class="kpi-label">Receita</div>
                <div class="kpi-value">{fmtBrl(revenueBrl)}</div>
                <div class="kpi-sub kpi-secondary">{fmtEur(snap.kpis.revenue)} · {fmtUsd(snap.kpis.revenue * (taxConfig.eurToUsd || 1.08))}</div>
                <div class="kpi-sub kpi-delta {deltaClass(snap.compare.revenue.delta)}">
                  {fmtDelta(snap.compare.revenue.delta)} · {snap.kpis.purchased} pedidos
                </div>
              {:else if cardId === 'conversion'}
                <div class="kpi-label">Conversão</div>
                <div class="kpi-value">{fmtPct(snap.kpis.conversionRate)}</div>
                <div class="kpi-sub kpi-delta {deltaClass(snap.compare.conversion.delta)}">
                  {fmtDelta(snap.compare.conversion.delta)} · sessões → Bancontact
                </div>
              {:else if cardId === 'duration'}
                <div class="kpi-label">Tempo médio</div>
                <div class="kpi-value">{fmtDuration(snap.kpis.avgSessionDurationSec)}</div>
                <div class="kpi-sub">duração da sessão</div>
              {:else if cardId === 'spend'}
                <div class="kpi-label">Gasto Meta</div>
                <div class="kpi-value">{fbAds ? fmtBrl(adSpendBrl) : '—'}</div>
                <div class="kpi-sub kpi-secondary">{fbAds ? fmtEur(adSpendEur) + ' · ' + fmtUsd(fbAds.spend) : 'carregando…'}</div>
              {:else if cardId === 'profit'}
                <div class="kpi-label">Lucro</div>
                <div class="kpi-value">{snap ? fmtBrl(lucroUtmBrl) : '—'}</div>
                <div class="kpi-sub kpi-secondary">{snap ? fmtEur(lucroUtmBrl / eurToBrl) : ''}</div>
              {:else if cardId === 'roas'}
                <div class="kpi-label">ROAS</div>
                <div class="kpi-value kpi-green">{roasUtm > 0 ? roasUtm.toFixed(2) : '—'}</div>
                <div class="kpi-sub">receita bruta / gasto</div>
              {:else if cardId === 'faturamento'}
                <div class="kpi-label">Faturamento Líquido</div>
                <div class="kpi-value">{snap ? fmtBrl(faturamentoLiqBrl) : '—'}</div>
                <div class="kpi-sub kpi-secondary">{snap ? fmtEur(snap.kpis.revenue * (1 - taxConfig.shopifyPct / 100)) : ''}</div>
                <div class="kpi-sub">receita − {taxConfig.shopifyPct}% Shopify</div>
              {:else if cardId === 'roi'}
                <div class="kpi-label">ROI</div>
                <div class="kpi-value kpi-green">{roiUtm > 0 ? roiUtm.toFixed(2) : '—'}</div>
                <div class="kpi-sub">faturamento líq / gasto</div>
              {:else if cardId === 'margem'}
                <div class="kpi-label">Margem</div>
                <div class="kpi-value {margemPct > 0 ? 'kpi-green' : margemPct < 0 ? 'kpi-red' : ''}">{margemPct !== 0 ? margemPct.toFixed(1) + '%' : '—'}</div>
                <div class="kpi-sub">lucro / faturamento líq</div>
              {:else if cardId === 'taxas_card'}
                <div class="kpi-label">Taxas ({taxConfig.shopifyPct}%)</div>
                <div class="kpi-value">{snap ? fmtBrl(taxasBrl) : '—'}</div>
                <div class="kpi-sub kpi-secondary">{snap ? fmtEur(snap.kpis.revenue * taxConfig.shopifyPct / 100) : ''}</div>
                <div class="kpi-sub">Shopify sobre receita bruta</div>
              {/if}
            </div>
          {/each}
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
      </div><!-- /tab-content overview -->
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
        <section class="kpi-grid" class:flash={flashing}>
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

        <section class="card card-wide">
          <h2>Compras rastreadas na janela</h2>
          <div class="kpi-sub muted" style="margin-bottom:8px">
            Janela SP: {new Date(snap.sinceTs).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', hour12: false })}
            → {new Date(snap.untilTs).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', hour12: false })}
          </div>
          {#if !snap.purchaseList?.length}
            <p class="muted">Nenhuma compra rastreada na janela.</p>
          {:else}
            <table class="camp-utmfy" style="width:100%">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Horário São Paulo</th>
                  <th>Valor</th>
                </tr>
              </thead>
              <tbody>
                {#each snap.purchaseList as p, i}
                  <tr>
                    <td class="muted small">{i + 1}</td>
                    <td style="font-family:monospace">{new Date(p.purchaseAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', hour12: false, year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                    <td style="font-family:monospace;color:#f9d65b">{fmtEur(p.amount)}</td>
                  </tr>
                {/each}
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="2" style="font-weight:600">Total ({snap.purchaseList.length} pedidos)</td>
                  <td style="font-family:monospace;color:#f9d65b;font-weight:600">{fmtEur(snap.purchaseList.reduce((a,p) => a + p.amount, 0))}</td>
                </tr>
              </tfoot>
            </table>
          {/if}
        </section>
      {/if}

      {#if activeTab === 'tech'}
        <section class="kpi-grid" class:flash={flashing}>
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

      {#if activeTab === 'ads'}
      <div class="tab-content">
        <!-- Seletor de período dos anúncios -->
        <div class="ads-topbar">
          <div class="period-pills">
            {#each (['hoje','ontem','hoje_ontem','ultimos_7d','este_mes'] as Period[]) as p}
              <button class="period-pill" class:active={period === p} onclick={() => { period = p; }}>{PERIOD_LABELS[p]}</button>
            {/each}
          </div>
          <button class="btn-refresh" onclick={pullFbAds} disabled={fbLoading}>
            {fbLoading ? '…' : '↺ Atualizar'}
          </button>
          <span class="muted small">Cache 5 min · conta USD 2</span>
        </div>

        {#if fbAds?.error}
          <div class="ads-error">⚠ {fbAds.error}</div>
        {:else if !fbAds || fbLoading}
          <div class="loading"><div class="spinner"></div><span>Carregando anúncios…</span></div>
        {:else}
          <!-- KPIs Meta -->
          <section class="kpi-grid" class:flash={flashing}>
            <div class="kpi kpi-spend">
              <div class="kpi-label">Gasto</div>
              <div class="kpi-value">{fmtBrl(adSpendBrl)}</div>
              <div class="kpi-sub kpi-secondary">{fmtEur(adSpendEur)} · {fmtUsd(fbAds.spend)}</div>
            </div>
            <div class="kpi">
              <div class="kpi-label">Impressões</div>
              <div class="kpi-value">{fmtNum(fbAds.impressions)}</div>
              <div class="kpi-sub">CPM {fmtBrl(fbAds.cpm * activeUsdToBrl)}</div>
            </div>
            <div class="kpi">
              <div class="kpi-label">Cliques</div>
              <div class="kpi-value">{fmtNum(fbAds.clicks)}</div>
              <div class="kpi-sub">CPC {fmtBrl(fbAds.cpc * activeUsdToBrl)}</div>
            </div>
            <div class="kpi">
              <div class="kpi-label">Alcance</div>
              <div class="kpi-value">{fmtNum(fbAds.reach)}</div>
              <div class="kpi-sub">usuários únicos atingidos</div>
            </div>
            <div class="kpi">
              <div class="kpi-label">CTR</div>
              <div class="kpi-value">{fmtPct2(fbAds.ctr)}</div>
              <div class="kpi-sub">taxa de clique</div>
            </div>
            {#if snap}
            <div class="kpi" class:kpi-profit-pos={profitBrl > 0} class:kpi-profit-neg={profitBrl < 0}>
              <div class="kpi-label">Lucro estimado</div>
              <div class="kpi-value">{fmtBrl(profitBrl)}</div>
              <div class="kpi-sub kpi-secondary">{fmtEur(profitEur)} · {fmtUsd(profitEur * (taxConfig.eurToUsd || 1.08))}</div>
            </div>
            <div class="kpi">
              <div class="kpi-label">ROAS</div>
              <div class="kpi-value">{roasCalc > 0 ? roasCalc.toFixed(2) + '×' : '—'}</div>
              <div class="kpi-sub">receita / gasto</div>
            </div>
            {/if}
          </section>

          <!-- Breakdown financeiro -->
          {#if snap}
          <section class="card card-wide">
            <h2>Breakdown financeiro</h2>
            <div class="finance-grid">
              <div class="finance-row">
                <span class="finance-label">Receita bruta</span>
                <span class="finance-val finance-green">+{fmtBrl(revenueBrl)}</span>
                <span class="finance-secondary">{fmtEur(snap.kpis.revenue)}</span>
              </div>
              <div class="finance-row">
                <span class="finance-label">Gasto Meta Ads</span>
                <span class="finance-val finance-red">−{fmtBrl(adSpendBrl)}</span>
                <span class="finance-secondary">{fmtEur(adSpendEur)}</span>
              </div>
              <div class="finance-row">
                <span class="finance-label">Taxa Shopify ({taxConfig.shopifyPct}%)</span>
                <span class="finance-val finance-red">−{fmtBrl(snap.kpis.revenue * taxConfig.shopifyPct / 100 * eurToBrl)}</span>
                <span class="finance-secondary">{fmtEur(snap.kpis.revenue * taxConfig.shopifyPct / 100)}</span>
              </div>
              <div class="finance-row">
                <span class="finance-label">Taxa gateway ({taxConfig.gatewayPct}%)</span>
                <span class="finance-val finance-red">−{fmtBrl(snap.kpis.revenue * taxConfig.gatewayPct / 100 * eurToBrl)}</span>
                <span class="finance-secondary">{fmtEur(snap.kpis.revenue * taxConfig.gatewayPct / 100)}</span>
              </div>
              {#if taxConfig.shopifyFixed > 0}
              <div class="finance-row">
                <span class="finance-label">Shopify fixo</span>
                <span class="finance-val finance-red">−{fmtBrl(taxConfig.shopifyFixed * eurToBrl)}</span>
                <span class="finance-secondary">{fmtEur(taxConfig.shopifyFixed)}</span>
              </div>
              {/if}
              {#if taxConfig.otherFixed > 0}
              <div class="finance-row">
                <span class="finance-label">Outros custos</span>
                <span class="finance-val finance-red">−{fmtBrl(taxConfig.otherFixed * eurToBrl)}</span>
                <span class="finance-secondary">{fmtEur(taxConfig.otherFixed)}</span>
              </div>
              {/if}
              <div class="finance-row finance-total">
                <span class="finance-label">Lucro líquido</span>
                <span class="finance-val" class:finance-green={profitBrl > 0} class:finance-red={profitBrl < 0}>
                  {profitBrl >= 0 ? '+' : ''}{fmtBrl(profitBrl)}
                </span>
                <span class="finance-secondary">{fmtEur(profitEur)}</span>
              </div>
            </div>
            <p class="muted small" style="margin-top:12px">
              ⓘ USD→BRL: {taxConfig.usdToBrl} · EUR→USD: {taxConfig.eurToUsd}. Ajuste na aba Taxas.
              Receita usa janela ({win}); anúncios usam {fbWin}.
            </p>
          </section>
          {/if}
        {/if}
      </div><!-- /tab-content ads -->
      {/if}

      {#if activeTab === 'taxas'}
        <section class="card" style="max-width: 560px;">
          <h2>⊕ Configuração de Taxas</h2>

          <!-- Badge câmbio ao vivo -->
          {#if liveRate && liveRate.source !== 'fallback'}
            <div class="rate-live-box">
              <div class="rate-live-title">💱 Câmbio ao vivo — {liveRate.source}</div>
              <div class="rate-live-grid">
                <span>USD → BRL</span><strong>R$ {activeUsdToBrl.toFixed(4)}</strong>
                <span>EUR → BRL</span><strong>R$ {activeEurToBrl.toFixed(4)}</strong>
                <span>EUR → USD</span><strong>$ {liveRate.eurToUsd.toFixed(4)}</strong>
              </div>
              <p class="muted small" style="margin:6px 0 0">Atualiza a cada hora. Os valores manuais abaixo são usados como fallback.</p>
            </div>
          {:else}
            <div class="rate-live-box rate-live-fallback">
              ⚠ Câmbio ao vivo indisponível — usando valores manuais abaixo.
            </div>
          {/if}

          <p class="muted small" style="margin-bottom:20px">
            Taxas e câmbios manuais (fallback quando API offline).
            Salvas localmente no seu browser.
          </p>

          <div class="tax-form">
            <div class="tax-field">
              <label>Taxa Shopify (%)</label>
              <input type="number" min="0" max="100" step="0.1"
                bind:value={taxConfig.shopifyPct} class="tax-input" />
              <span class="tax-hint">% cobrada por transação pelo Shopify</span>
            </div>
            <div class="tax-field">
              <label>Taxa Gateway de Pagamento (%)</label>
              <input type="number" min="0" max="100" step="0.1"
                bind:value={taxConfig.gatewayPct} class="tax-input" />
              <span class="tax-hint">ex: Bancontact, Stripe, Mollie</span>
            </div>
            <div class="tax-field">
              <label>Custo fixo Shopify (€)</label>
              <input type="number" min="0" step="0.01"
                bind:value={taxConfig.shopifyFixed} class="tax-input" />
              <span class="tax-hint">mensalidade ou custo fixo de período</span>
            </div>
            <div class="tax-field">
              <label>Outros custos fixos (€)</label>
              <input type="number" min="0" step="0.01"
                bind:value={taxConfig.otherFixed} class="tax-input" />
              <span class="tax-hint">ferramentas, apps, criativos, etc.</span>
            </div>
            <div class="tax-field">
              <label>Taxa EUR → USD</label>
              <input type="number" min="0.5" max="2" step="0.001"
                bind:value={taxConfig.eurToUsd} class="tax-input" />
              <span class="tax-hint">ex: 1.08 = 1 EUR = 1.08 USD</span>
            </div>
            <div class="tax-field">
              <label>Taxa USD → BRL</label>
              <input type="number" min="1" max="20" step="0.01"
                bind:value={taxConfig.usdToBrl} class="tax-input" />
              <span class="tax-hint">ex: 5.70 = 1 USD = R$ 5,70</span>
            </div>

            <button class="btn-save-tax" onclick={saveTax}>
              {taxSaved ? '✓ Salvo!' : 'Salvar configurações'}
            </button>
          </div>

          <!-- Preview do cálculo -->
          <div class="tax-preview">
            <h3>Preview para €100,00 de receita</h3>
            <div class="finance-grid">
              <div class="finance-row">
                <span class="finance-label">Receita</span>
                <span class="finance-val finance-green">+{fmtBrl(100 * eurToBrl)}</span>
                <span class="finance-secondary">€100,00</span>
              </div>
              <div class="finance-row">
                <span class="finance-label">Taxa Shopify ({taxConfig.shopifyPct}%)</span>
                <span class="finance-val finance-red">−{fmtBrl(100 * taxConfig.shopifyPct / 100 * eurToBrl)}</span>
                <span class="finance-secondary">{fmtEur(100 * taxConfig.shopifyPct / 100)}</span>
              </div>
              <div class="finance-row">
                <span class="finance-label">Taxa Gateway ({taxConfig.gatewayPct}%)</span>
                <span class="finance-val finance-red">−{fmtBrl(100 * taxConfig.gatewayPct / 100 * eurToBrl)}</span>
                <span class="finance-secondary">{fmtEur(100 * taxConfig.gatewayPct / 100)}</span>
              </div>
              <div class="finance-row finance-total">
                <span class="finance-label">Líquido (sem ads/fixos)</span>
                <span class="finance-val finance-green">
                  +{fmtBrl((100 - 100 * taxConfig.shopifyPct / 100 - 100 * taxConfig.gatewayPct / 100) * eurToBrl)}
                </span>
                <span class="finance-secondary">{fmtEur(100 - 100 * taxConfig.shopifyPct / 100 - 100 * taxConfig.gatewayPct / 100)}</span>
              </div>
            </div>
          </div>
        </section>
      {/if}

      {#if activeTab === 'campanhas'}
      <div class="tab-content">

        <!-- Barra de filtros estilo UTMfy -->
        <div class="camp-filterbar">
          <div class="camp-filterbar-left">
            <div class="camp-filter-group">
              <label class="camp-filter-label">Período de visualização</label>
              <div class="period-pills camp-period">
                {#each (['hoje','ontem','hoje_ontem','ultimos_7d','este_mes'] as Period[]) as p}
                  <button class="period-pill" class:active={period === p} onclick={() => { period = p; }}>{PERIOD_LABELS[p]}</button>
                {/each}
              </div>
            </div>
          </div>
          <div class="camp-filterbar-right">
            <span class="camp-update-info">
              {#if campaignsLoading}
                <span class="camp-updating">↻ Atualizando…</span>
              {:else}
                Atualizado {fmtAgo(updateAgoSec)}
              {/if}
            </span>
            <button class="btn-camp-refresh" onclick={pullCampaigns} disabled={campaignsLoading}>
              ↻ Atualizar
            </button>
          </div>
        </div>

        {#if campaignsLoading}
          <div class="loading"><div class="spinner"></div><span>Carregando campanhas…</span></div>
        {:else if fbCampaigns.length === 0}
          <div class="empty"><span class="empty-emoji">◎</span><p>Sem campanhas no período. Tente outro intervalo.</p></div>
        {:else}
          <!-- Tabela estilo UTMfy -->
          {@const campTotalSpend  = fbCampaigns.reduce((s, c) => s + c.spend, 0)}
          {@const campTotalImpr   = fbCampaigns.reduce((s, c) => s + c.impressions, 0)}
          {@const campTotalClicks = fbCampaigns.reduce((s, c) => s + c.clicks, 0)}
          <div class="camp-utmfy-wrap">
            <table class="camp-utmfy">
              <thead>
                <tr>
                  <th class="th-status">Status</th>
                  <th class="th-name">Campanha</th>
                  <th class="th-num">Gastos</th>
                  <th class="th-num">Impressões</th>
                  <th class="th-num">Cliques</th>
                  <th class="th-num">CTR</th>
                  <th class="th-num">CPM</th>
                  <th class="th-num">CPC</th>
                </tr>
              </thead>
              <tbody>
                {#each fbCampaigns.sort((a, b) => b.spend - a.spend) as c, i}
                <tr class="camp-tr" class:camp-tr-alt={i % 2 !== 0}>
                  <td class="td-status">
                    <span class="camp-status-dot" class:active={c.spend > 0}></span>
                  </td>
                  <td class="td-name">
                    <span class="camp-name-txt" title={c.name}>{c.name}</span>
                  </td>
                  <td class="td-num">
                    <span class="camp-val-main">{fmtSpendDisplay(c.spend)}</span>
                    <span class="camp-val-sub">{fmtSpendSub(c.spend)}</span>
                  </td>
                  <td class="td-num">
                    <span class="camp-val-main">{fmtNum(c.impressions)}</span>
                  </td>
                  <td class="td-num">
                    <span class="camp-val-main">{fmtNum(c.clicks)}</span>
                  </td>
                  <td class="td-num">
                    <span class="camp-val-main {c.ctr > 2 ? 'camp-val-green' : c.ctr < 1 ? 'camp-val-red' : ''}">{fmtPct2(c.ctr)}</span>
                  </td>
                  <td class="td-num">
                    <span class="camp-val-main">{fmtSpendDisplay(c.cpm / 1000)}</span>
                    <span class="camp-val-sub">por mil</span>
                  </td>
                  <td class="td-num">
                    <span class="camp-val-main">{fmtSpendDisplay(c.cpc)}</span>
                    <span class="camp-val-sub">por clique</span>
                  </td>
                </tr>
                {/each}
              </tbody>
              <tfoot>
                <tr class="camp-tr-total">
                  <td></td>
                  <td class="td-name"><strong>{fbCampaigns.length} campanha{fbCampaigns.length !== 1 ? 's' : ''}</strong></td>
                  <td class="td-num"><span class="camp-val-main"><strong>{fmtSpendDisplay(campTotalSpend)}</strong></span><span class="camp-val-sub">{fmtSpendSub(campTotalSpend)}</span></td>
                  <td class="td-num"><span class="camp-val-main"><strong>{fmtNum(campTotalImpr)}</strong></span></td>
                  <td class="td-num"><span class="camp-val-main"><strong>{fmtNum(campTotalClicks)}</strong></span></td>
                  <td class="td-num">—</td>
                  <td class="td-num">—</td>
                  <td class="td-num">—</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <!-- Barras de gasto -->
          <div class="camp-bars-wrap">
            <h3 class="camp-bars-title">Distribuição de gastos</h3>
            {#each [...fbCampaigns].sort((a, b) => b.spend - a.spend) as c}
              {@const maxSpend = Math.max(...fbCampaigns.map(x => x.spend))}
              <div class="camp-bar-row">
                <div class="camp-bar-label" title={c.name}>{c.name.length > 35 ? c.name.slice(0, 35) + '…' : c.name}</div>
                <div class="camp-bar-track">
                  <div class="camp-bar-fill" style="width: {maxSpend > 0 ? (c.spend / maxSpend) * 100 : 0}%"></div>
                </div>
                <div class="camp-bar-val">{fmtSpendDisplay(c.spend)}</div>
              </div>
            {/each}
          </div>
        {/if}
      </div><!-- /tab-content campanhas -->
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
  .brand-logo { height: 135px; width: auto; display: block; }
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
    padding: 6px 8px; border-bottom: 1px solid #1a1f28; min-height: 64px;
    overflow: hidden;
  }
  .brand-dot {
    width: 10px; height: 10px; border-radius: 50%;
    background: linear-gradient(135deg, #02a95c, #1de9b6);
    box-shadow: 0 0 12px rgba(2,169,92,0.7);
  }
  .brand-name { font-weight: 700; letter-spacing: -0.01em; }
  .brand-logo-side { height: 75px; width: auto; display: block; }
  .brand-favicon-side { width: 60px; height: 60px; display: block; margin: 0 auto; }
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

  /* ── Update row (status + botão Atualizar) ── */
  .update-row {
    display: flex; align-items: center; gap: 12px;
  }
  .btn-update {
    background: #02a95c; color: #fff; border: none;
    padding: 5px 16px; border-radius: 8px; font-size: 0.8125rem; font-weight: 600;
    font-family: inherit; cursor: pointer; transition: background 0.15s, opacity 0.15s;
    white-space: nowrap;
  }
  .btn-update:hover:not(:disabled) { background: #019e55; }
  .btn-update:disabled { opacity: 0.65; cursor: default; }

  /* ── Flash dos KPIs quando dados já estão frescos ── */
  @keyframes kpi-flash {
    0%, 100% { opacity: 1; }
    20%, 60% { opacity: 0.25; }
    40%, 80% { opacity: 0.8; }
  }
  .kpi-grid.flash .kpi { animation: kpi-flash 0.45s ease; }
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

  .btn-refresh {
    background: transparent; border: 1px solid #1f2630; color: #8b94a4;
    width: 28px; height: 28px; border-radius: 8px; font-size: 1rem; line-height: 1;
    display: inline-flex; align-items: center; justify-content: center;
    cursor: pointer; font-family: inherit; transition: all 0.15s;
    flex-shrink: 0;
  }
  .btn-refresh:hover:not(:disabled) { border-color: #02a95c; color: #02a95c; background: rgba(2,169,92,0.08); }
  .btn-refresh:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-refresh.spinning { animation: spin 0.6s linear infinite; }
  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

  .toast {
    background: rgba(2,169,92,0.12); border: 1px solid #02a95c; color: #02a95c;
    padding: 10px 16px; border-radius: 8px; margin-bottom: 16px;
    font-size: 0.875rem; font-weight: 500;
  }

  /* ── KPIs ── */
  .kpi-grid {
    display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
    gap: 16px; margin-bottom: 16px; align-items: start;
  }
  .kpi {
    background: #11161d; border: 1px solid #1a1f28; padding: 18px 20px;
    border-radius: 12px; position: relative; overflow: hidden;
    transition: transform 0.15s, border-color 0.15s;
    display: flex; flex-direction: column;
  }
  .kpi:hover { border-color: #2a3340; transform: translateY(-1px); }
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

  /* Card Online Agora — layout hero centralizado */
  .kpi-online-hero {
    position: relative;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    margin: 14px 0 8px;
    padding: 18px 8px 12px;
  }
  .kpi-online-number {
    font-family: 'JetBrains Mono', ui-monospace, monospace;
    font-size: 3rem; font-weight: 700; letter-spacing: -0.04em;
    color: #02a95c;
    line-height: 1;
    /* Glow puro no numero — sem container box visivel */
    text-shadow:
      0 0 12px rgba(2,169,92,0.6),
      0 0 32px rgba(2,169,92,0.35),
      0 0 60px rgba(2,169,92,0.18);
  }
  .kpi-online-caption {
    color: #8b94a4; font-size: 0.7rem; margin-top: 10px;
    text-align: center; letter-spacing: 0.02em;
  }
  .kpi-breakdown-online {
    justify-content: center; gap: 8px; margin-top: 6px;
  }
  .kpi-breakdown-online .kpi-chip {
    padding: 5px 10px;
    background: linear-gradient(180deg, #11161d 0%, #0a0d12 100%);
  }

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
    border-radius: 12px; margin-bottom: 0;
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
    display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 0;
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
    /* Topbar mobile: título na 1ª linha (centralizado), ações na 2ª */
    .topbar-left {
      display: flex; flex-wrap: wrap; align-items: center; gap: 10px; width: 100%;
    }
    /* Linha 1 — título centralizado, ocupa toda a largura */
    .topbar-title-block {
      order: 1; width: 100%;
      display: flex; justify-content: center; align-items: center;
      flex-direction: row;
    }
    .page-title { font-size: 1.125rem; text-align: center; }
    /* Linha 2 — ☰ + update-row + ⌥ */
    .hamburger { order: 2; }
    .update-row {
      order: 3; flex: 1; justify-content: space-between;
      background: #11161d; border: 1px solid #1f2630;
      padding: 7px 12px; border-radius: 10px;
    }
    .filters-toggle { order: 4; }
    .status { font-size: 0.75rem; }
    .status-text { white-space: nowrap; }
    .btn-update { padding: 5px 14px; font-size: 0.8125rem; }

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

    /* KPIs — layout masonry no mobile (cards de alturas diferentes
       fluem em 2 colunas, sem buracos entre eles) */
    .kpi-grid {
      display: block;
      column-count: 2;
      column-gap: 10px;
    }
    .kpi-grid .kpi {
      break-inside: avoid;
      -webkit-column-break-inside: avoid;
      page-break-inside: avoid;
      margin-bottom: 10px;
      display: block;
    }
    .kpi { padding: 14px 14px; }
    .kpi-label { font-size: 0.625rem; }
    .kpi-value { font-size: 1.5rem; margin-top: 4px; }
    .kpi-sub { font-size: 0.6875rem; margin-top: 4px; }
    /* Online Agora — mobile */
    .kpi-online-hero { margin: 10px 0 6px; padding: 16px 4px 10px; }
    .kpi-online-number { font-size: 2.5rem; }
    .kpi-online-caption { font-size: 0.65rem; }
    .kpi-breakdown-online { gap: 6px; }
    .kpi-breakdown-online .kpi-chip { padding: 4px 8px; font-size: 0.7rem; }

    /* Cards */
    .card { padding: 14px; border-radius: 10px; }
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
    .kpi-grid { column-gap: 8px; }
    .kpi-grid .kpi { margin-bottom: 8px; }
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

  /* ── Personalizar ── */
  .customize-bar {
    display: flex; justify-content: flex-end;
  }
  .btn-customize {
    background: transparent; border: 1px solid #1f2630; color: #8b94a4;
    padding: 6px 14px; border-radius: 8px; font-size: 0.8125rem; font-weight: 500;
    font-family: inherit; cursor: pointer; transition: all 0.15s;
  }
  .btn-customize:hover { border-color: #02a95c; color: #02a95c; }
  .btn-customize-exit {
    border-color: #02a95c; color: #02a95c;
    background: rgba(2,169,92,0.08);
  }
  .customize-panel {
    background: #11161d; border: 1px solid #1f2630; border-radius: 12px;
    padding: 16px;
  }
  /* Mobile: esconde botao Personalizar (so long-press ativa) */
  @media (max-width: 640px) {
    .btn-customize-desktop { display: none; }
    .kpi-grid.edit-mode .kpi {
      animation: kpi-wiggle 0.5s ease-in-out infinite;
      -webkit-user-select: none; user-select: none;
      -webkit-touch-callout: none;
    }
    @keyframes kpi-wiggle {
      0%, 100% { transform: rotate(-0.4deg); }
      50% { transform: rotate(0.4deg); }
    }
  }
  .card-toggles {
    display: flex; flex-wrap: wrap; gap: 8px;
  }
  .card-toggle-item {
    display: inline-flex; align-items: center; gap: 8px;
    background: #0a0d12; border: 1px solid #1f2630;
    padding: 8px 14px; border-radius: 8px; font-size: 0.8125rem;
    cursor: pointer; color: #8b94a4; transition: all 0.12s;
  }
  .card-toggle-item.active {
    border-color: #02a95c; color: #02a95c;
    background: rgba(2,169,92,0.08);
  }
  .card-toggle-item input { display: none; }

  /* ── Ads KPI extras ── */
  .kpi-spend { border-color: rgba(255,170,0,0.3); }
  .kpi-spend .kpi-value { color: #ffaa00; }
  .kpi-profit-pos { border-color: rgba(2,169,92,0.3); }
  .kpi-profit-pos .kpi-value { color: #02a95c; }
  .kpi-profit-neg { border-color: rgba(255,91,91,0.3); }
  .kpi-profit-neg .kpi-value { color: #ff5b5b; }
  .kpi-green { color: #02a95c; }
  .kpi-red   { color: #ff5b5b; }

  /* ── Period pills ── */
  .period-pills {
    display: flex; gap: 4px; flex-wrap: wrap;
  }
  .period-pill {
    background: #11161d; border: 1px solid #1f2630; color: #8b94a4;
    padding: 7px 13px; border-radius: 8px; font-size: 0.8125rem; font-weight: 500;
    font-family: inherit; cursor: pointer; transition: all 0.12s; white-space: nowrap;
  }
  .period-pill:hover { border-color: #2a3340; color: #c8cdd5; }
  .period-pill.active {
    background: rgba(2,169,92,0.12); border-color: #02a95c; color: #02a95c;
  }

  @media (max-width: 768px) {
    .period-pills { gap: 3px; }
    .period-pill { padding: 6px 10px; font-size: 0.75rem; }
  }

  /* ── Tab content wrapper ── */
  .tab-content {
    display: flex; flex-direction: column; gap: 16px;
  }

  /* ── USD sub-label ── */
  .kpi-usd { font-size: 0.7rem; color: #6b7787; font-family: 'JetBrains Mono', monospace; }

  /* ── Ads topbar ── */
  .ads-topbar {
    display: flex; align-items: center; gap: 10px;
    flex-wrap: wrap;
  }
  .ads-error {
    background: rgba(255,91,91,0.1); border: 1px solid rgba(255,91,91,0.3);
    color: #ff5b5b; padding: 12px 16px; border-radius: 10px;
    font-size: 0.875rem; margin-bottom: 16px;
  }

  /* ── Finance breakdown ── */
  .finance-grid { display: flex; flex-direction: column; gap: 0; }
  .finance-row {
    display: grid; grid-template-columns: 1fr auto auto;
    align-items: center; gap: 12px;
    padding: 10px 0; border-bottom: 1px solid #1a1f28; font-size: 0.875rem;
  }
  .finance-row:last-child { border-bottom: none; }
  .finance-label { color: #8b94a4; }
  .finance-val { font-family: 'JetBrains Mono', monospace; font-weight: 600; font-size: 0.9375rem; }
  .finance-secondary { font-family: 'JetBrains Mono', monospace; font-size: 0.7rem; color: #4a5568; }
  .finance-green { color: #02a95c; }
  .finance-red   { color: #ff5b5b; }
  .finance-total { margin-top: 4px; }
  .finance-total .finance-label { color: #d6dae3; font-weight: 600; }
  .finance-total .finance-val { font-size: 1.125rem; }

  /* ── Câmbio ao vivo ── */
  .rate-live-box {
    background: #0d1117; border: 1px solid rgba(77,208,225,0.25);
    border-radius: 10px; padding: 14px 16px; margin-bottom: 16px;
  }
  .rate-live-fallback {
    border-color: rgba(255,170,0,0.3); color: #ffaa00; font-size: 0.8125rem;
  }
  .rate-live-title {
    font-size: 0.8125rem; font-weight: 600; color: #4dd0e1; margin-bottom: 10px;
  }
  .rate-live-grid {
    display: grid; grid-template-columns: 1fr auto;
    gap: 4px 16px; font-size: 0.8125rem;
  }
  .rate-live-grid span { color: #8b94a4; }
  .rate-live-grid strong { font-family: 'JetBrains Mono', monospace; color: #e6e9ef; }

  /* ── BRL secondary ── */
  .kpi-secondary {
    font-size: 0.6875rem; color: #4a5568;
    font-family: 'JetBrains Mono', monospace; margin-top: 1px;
  }

  /* ── Drag & drop cards ── */
  .kpi[draggable="true"] { cursor: grab; }
  .kpi[draggable="true"]:active { cursor: grabbing; }
  .kpi.kpi-dragging { opacity: 0.45; border-style: dashed; }
  .kpi-drag-handle {
    position: absolute; top: 6px; right: 6px;
    width: 28px; height: 28px;
    display: inline-flex; align-items: center; justify-content: center;
    background: transparent; border: none; padding: 0; margin: 0;
    color: #475064; font-size: 1.1rem; line-height: 1;
    cursor: grab; user-select: none;
    touch-action: none; /* CRUCIAL: bloqueia scroll do iOS so na alca */
    -webkit-tap-highlight-color: transparent;
    border-radius: 6px;
    transition: background 0.15s, color 0.15s;
    z-index: 2;
  }
  .kpi-drag-handle:hover, .kpi-drag-handle:focus-visible {
    background: rgba(255,255,255,0.06); color: #02a95c; outline: none;
  }
  .kpi-drag-handle:active { cursor: grabbing; background: rgba(2,169,92,0.15); color: #02a95c; }
  @media (max-width: 640px) {
    /* Mobile: handle escondido por padrao, so aparece em edit-mode.
       Alca maior pra facilitar toque quando visivel. */
    .kpi-drag-handle {
      width: 36px; height: 36px; font-size: 1.25rem;
      top: 4px; right: 4px;
      background: rgba(255,255,255,0.04);
      display: none;
    }
    .kpi-grid.edit-mode .kpi-drag-handle {
      display: inline-flex;
    }
  }

  /* ── Campanhas table ── */
  /* legado */
  .ta-right { text-align: right; }
  .bar-orange { background: linear-gradient(90deg, #ff7043, #ff9800); }

  /* ── Período colapsável ── */
  .period-label-btn {
    display: inline-flex; align-items: center; gap: 6px;
    background: #11161d; border: 1px solid #1f2630; color: #c8cdd5;
    padding: 7px 12px; border-radius: 8px; font-size: 0.8125rem; font-weight: 500;
    font-family: inherit; cursor: pointer; transition: all 0.15s;
    white-space: nowrap;
  }
  .period-label-btn:hover { border-color: #2e3a4a; color: #e6e9ef; }
  .period-label-active {
    color: #02a95c; font-weight: 700;
    background: rgba(2,169,92,0.1); padding: 1px 6px; border-radius: 4px;
    font-size: 0.75rem;
  }
  .period-chevron { font-size: 0.6rem; color: #6b7787; transition: transform 0.2s; }
  .period-chevron.open { transform: rotate(180deg); }
  .period-label-icon { font-size: 0.875rem; }

  /* ── Country / Moeda ── */
  .country-select-wrap {
    display: inline-flex; align-items: center; gap: 0;
    border: 1px solid #1f2630; border-radius: 8px; overflow: hidden;
    background: #11161d;
  }
  .select-flag {
    border: none !important; border-radius: 0 !important; background: transparent !important;
    padding: 7px 10px; font-size: 0.8125rem; min-width: 130px;
  }
  .currency-badge {
    padding: 0 10px; font-size: 0.6875rem; font-weight: 700;
    border-left: 1px solid #1a1f28; height: 100%;
    display: flex; align-items: center; white-space: nowrap;
    font-family: 'JetBrains Mono', monospace;
  }
  .currency-brl { color: #1de9b6; background: rgba(29,233,182,0.08); }
  .currency-eur { color: #4dd0e1; background: rgba(77,208,225,0.08); }
  .currency-usd { color: #f9d65b; background: rgba(249,214,91,0.08); }
  .select-sm { font-size: 0.75rem; padding: 6px 10px; }

  /* ── Filterbar campanhas (UTMfy style) ── */
  .camp-filterbar {
    display: flex; align-items: flex-end; justify-content: space-between;
    gap: 16px; flex-wrap: wrap; margin-bottom: 20px;
    padding: 16px 20px; background: #0d1117;
    border: 1px solid #1a1f28; border-radius: 12px;
  }
  .camp-filterbar-left { display: flex; align-items: flex-end; gap: 16px; flex-wrap: wrap; }
  .camp-filterbar-right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
  .camp-filter-group { display: flex; flex-direction: column; gap: 6px; }
  .camp-filter-label {
    font-size: 0.6875rem; font-weight: 600; text-transform: uppercase;
    letter-spacing: 0.06em; color: #6b7787;
  }
  .camp-period.period-pills { gap: 4px; }
  .camp-update-info { font-size: 0.75rem; color: #6b7787; white-space: nowrap; }
  .camp-updating { color: #4dd0e1; }
  .btn-camp-refresh {
    background: #1a2332; border: 1px solid #2a3a4a; color: #c8cdd5;
    padding: 8px 16px; border-radius: 8px; font-size: 0.8125rem; font-weight: 600;
    font-family: inherit; cursor: pointer; transition: all 0.15s; white-space: nowrap;
  }
  .btn-camp-refresh:hover:not(:disabled) { background: #243040; border-color: #02a95c; color: #02a95c; }
  .btn-camp-refresh:disabled { opacity: 0.5; cursor: not-allowed; }

  /* ── Tabela UTMfy ── */
  .camp-utmfy-wrap {
    overflow-x: auto; border-radius: 12px;
    border: 1px solid #1a1f28; background: #0d1117; margin-bottom: 20px;
  }
  .camp-utmfy {
    width: 100%; border-collapse: collapse; font-size: 0.8125rem;
  }
  .camp-utmfy thead tr {
    border-bottom: 2px solid #1a1f28;
  }
  .camp-utmfy th {
    padding: 12px 16px; text-align: left;
    font-size: 0.6875rem; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.06em; color: #6b7787; white-space: nowrap;
  }
  .camp-utmfy th.th-num { text-align: right; }
  .camp-tr td { padding: 14px 16px; border-bottom: 1px solid #0f1419; }
  .camp-tr:last-child td { border-bottom: none; }
  .camp-tr:hover td { background: rgba(255,255,255,0.02); }
  .camp-tr-alt td { background: rgba(255,255,255,0.01); }
  .td-status { width: 48px; }
  .td-name { max-width: 280px; }
  .td-num { text-align: right; }
  .camp-status-dot {
    display: inline-block; width: 10px; height: 10px; border-radius: 50%;
    background: #2a3340;
  }
  .camp-status-dot.active {
    background: #02a95c;
    box-shadow: 0 0 0 3px rgba(2,169,92,0.15);
  }
  .camp-name-txt {
    display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    font-weight: 500; color: #c8cdd5; max-width: 260px;
  }
  .camp-val-main {
    display: block; font-weight: 600; color: #e6e9ef;
    font-family: 'JetBrains Mono', monospace; font-size: 0.875rem;
  }
  .camp-val-sub {
    display: block; font-size: 0.675rem; color: #4a5568;
    font-family: 'JetBrains Mono', monospace; margin-top: 1px;
  }
  .camp-val-green { color: #02a95c; }
  .camp-val-red   { color: #ff5b5b; }
  .camp-tr-total td {
    padding: 14px 16px; border-top: 2px solid #1a2332;
    background: #0a0e14;
  }
  .camp-tr-total .camp-val-main { color: #e6e9ef; font-size: 0.9375rem; }
  .camp-utmfy tfoot .td-num { text-align: right; color: #6b7787; font-size: 0.8125rem; }

  /* ── Barras de gasto ── */
  .camp-bars-wrap {
    background: #0d1117; border: 1px solid #1a1f28;
    border-radius: 12px; padding: 20px 20px 12px;
  }
  .camp-bars-title {
    font-size: 0.75rem; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.06em; color: #6b7787; margin: 0 0 16px;
  }
  .camp-bar-row {
    display: grid; grid-template-columns: 200px 1fr 120px;
    align-items: center; gap: 12px; padding: 6px 0;
  }
  .camp-bar-label {
    font-size: 0.75rem; color: #8b94a4; overflow: hidden;
    text-overflow: ellipsis; white-space: nowrap;
  }
  .camp-bar-track {
    height: 8px; background: #1a1f28; border-radius: 4px; overflow: hidden;
  }
  .camp-bar-fill {
    height: 100%; border-radius: 4px;
    background: linear-gradient(90deg, #ff6b35, #ff9800);
    transition: width 0.5s ease;
  }
  .camp-bar-val {
    font-size: 0.8125rem; font-family: 'JetBrains Mono', monospace;
    font-weight: 600; color: #c8cdd5; text-align: right;
  }

  @media (max-width: 768px) {
    /* Campanhas mobile */
    .camp-filterbar { padding: 12px; gap: 10px; }
    .camp-filterbar-right { flex-wrap: wrap; }
    .camp-bar-row { grid-template-columns: 120px 1fr 90px; }
    /* ocultar cols secundárias na tabela UTMfy em mobile */
    .camp-utmfy th.th-num:nth-child(n+5),
    .camp-tr td.td-num:nth-child(n+5) { display: none; }
    .period-label-btn { font-size: 0.75rem; padding: 6px 10px; }
    .country-select-wrap { flex: 1 1 140px; }
  }

  /* ── Taxas form ── */
  .tax-form { display: flex; flex-direction: column; gap: 18px; }
  .tax-field { display: flex; flex-direction: column; gap: 4px; }
  .tax-field label {
    font-size: 0.8125rem; font-weight: 600; color: #d6dae3; letter-spacing: -0.01em;
  }
  .tax-input {
    background: #0a0d12; border: 1px solid #2a3340; color: #e6e9ef;
    padding: 10px 12px; border-radius: 8px; font-size: 0.9375rem;
    font-family: 'JetBrains Mono', monospace; width: 100%; transition: border-color 0.15s;
  }
  .tax-input:focus { outline: none; border-color: #02a95c; }
  .tax-hint { font-size: 0.75rem; color: #8b94a4; }
  .btn-save-tax {
    background: linear-gradient(180deg, #02b864 0%, #02a95c 100%);
    color: #fff; border: none; padding: 12px; border-radius: 10px;
    font-weight: 600; cursor: pointer; font-family: inherit; font-size: 0.9375rem;
    box-shadow: 0 4px 12px rgba(2,169,92,0.3); transition: opacity 0.15s; margin-top: 4px;
  }
  .btn-save-tax:hover { opacity: 0.9; }
  .tax-preview {
    margin-top: 24px; background: #0a0d12; border: 1px solid #1a1f28;
    border-radius: 10px; padding: 16px;
  }
  .tax-preview h3 {
    margin: 0 0 14px; font-size: 0.875rem; color: #8b94a4; font-weight: 500;
  }
</style>
