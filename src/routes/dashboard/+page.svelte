<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  let { data } = $props();

  // ── State ──
  type Tab = 'overview' | 'live' | 'funnel' | 'vsl' | 'heatmap' | 'sessions' | 'revenue' | 'tech' | 'ads' | 'taxas' | 'campanhas' | 'cleaner' | 'contas';
  type Period = 'hoje' | 'ontem' | 'hoje_ontem' | 'ultimos_7d' | 'este_mes';
  let activeTab = $state<Tab>('overview');
  let period = $state<Period>('hoje');
  // win e fbWin são derivados do período unificado
  let win = $state<'2m' | '15m' | '1h' | '6h' | '24h' | '7d'>('24h');
  let pathFilter = $state<'' | '/' | '/donate' | '/vsl'>('');
  let deviceFilter = $state<'' | 'mobile' | 'desktop' | 'tablet'>('');
  let countryFilter = $state('');

  // ── Moeda de exibicao (BRL | USD | EUR) ──
  type DisplayCurrency = 'BRL' | 'EUR' | 'USD';
  let displayCurrency = $state<DisplayCurrency>('BRL');
  const CURRENCY_OPTIONS: { code: DisplayCurrency; symbol: string; label: string }[] = [
    { code: 'BRL', symbol: 'R$', label: 'Real' },
    { code: 'USD', symbol: '$',  label: 'Dólar' },
    { code: 'EUR', symbol: '€',  label: 'Euro' }
  ];
  function selectCurrency(code: DisplayCurrency) {
    displayCurrency = code;
    try { localStorage.setItem('vitrack_currency', code); } catch {}
  }

  // ── Período colapsável ──
  let periodOpen = $state(false);
  let currencyMenuOpen = $state(false);
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
      // Atualiza analytics + FB Ads (account) + campanhas (se estiver na aba).
      // Cache 5min do backend e respeitado — nao forca nocache=1.
      const tasks: Promise<any>[] = [pull(), pullFbAds()];
      if (activeTab === 'campanhas') tasks.push(pullCampaigns());
      await Promise.all(tasks);
    } catch (e) {
      console.warn('[dashboard] refresh failed', e);
    } finally {
      refreshing = false;
    }
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
  // Formatadores base por moeda
  const fmtEurRaw = (n: number) => '€' + n.toFixed(2).replace('.', ',');
  const fmtUsdRaw = (n: number) => '$' + n.toFixed(2);
  const fmtBrlRaw = (n: number) => 'R$ ' + n.toFixed(2).replace('.', ',');
  // fmtBrl converte valor em BRL pra moeda selecionada (BRL/USD/EUR).
  // Reativo via displayCurrency — toda chamada dentro de derived/template
  // recalcula quando user troca a moeda.
  function fmtBrl(brl: number): string {
    if (displayCurrency === 'USD') return fmtUsdRaw(brl / activeUsdToBrl);
    if (displayCurrency === 'EUR') return fmtEurRaw(brl / activeEurToBrl);
    return fmtBrlRaw(brl);
  }
  // fmtEur converte valor em EUR pra moeda selecionada.
  function fmtEur(eur: number): string {
    if (displayCurrency === 'USD') return fmtUsdRaw(eur * (activeEurToBrl / activeUsdToBrl));
    if (displayCurrency === 'BRL') return fmtBrlRaw(eur * activeEurToBrl);
    return fmtEurRaw(eur);
  }
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

  // ── Seletor de conta de anúncio (estilo UTMfy) ──
  interface FbAccount {
    id: string;          // act_XXXXX
    accountId: string;   // XXXXX
    name: string;
    status: string;
    statusCode: number;
    currency: string;
    business: string | null;
    businessId: string | null;
    source: string;
    timezone: string | null;
    amountSpent: number;
  }
  let fbAccounts = $state<FbAccount[]>([]);
  let fbBusinesses = $state<{ id: string; name: string }[]>([]);
  let fbAccountId = $state<string>('');     // '' = padrão (FB_ADS_ACCOUNT_ID server-side)
  let fbAccountsLoading = $state(false);
  let fbAccountsError = $state('');
  let accountMenuOpen = $state(false);
  let accountSearch = $state('');

  // ── Token FB configuravel ──
  let tokenPanelOpen = $state(false);
  type TokenStatus = {
    source: string;
    masked: string;
    length: number;
    updatedAt: number | null;
    defaultAccount: string;
    expiresAt?: number | null;
    daysLeft?: number | null;
    kind?: string | null;
    needsRefresh?: boolean;
    oauthConfigured?: boolean;
    authorizeUrl?: string | null;
  };
  let tokenStatus = $state<TokenStatus | null>(null);
  let tokenInput = $state('');
  let tokenSaving = $state(false);
  let tokenError = $state('');
  let tokenSuccessMsg = $state('');
  let fbDebug = $state<any>(null);
  let debugLoading = $state(false);
  let refreshingToken = $state(false);

  async function loadTokenStatus() {
    try {
      const r = await fetch('/api/fb-ads/oauth/status', { cache: 'no-store' });
      if (r.ok) tokenStatus = await r.json();
    } catch {}
  }

  // Abre OAuth FB em popup centralizado. Listener message reage no mount.
  let oauthPopup: Window | null = null;
  let oauthInProgress = $state(false);
  function openOAuthPopup() {
    if (!tokenStatus?.oauthConfigured) return;
    const w = 600, h = 700;
    const left = Math.max(0, (window.screen.width - w) / 2);
    const top  = Math.max(0, (window.screen.height - h) / 2);
    oauthInProgress = true;
    tokenError = '';
    tokenSuccessMsg = '';
    oauthPopup = window.open(
      '/api/fb-ads/oauth/start',
      'fb-oauth',
      `width=${w},height=${h},left=${left},top=${top},popup=yes`
    );
    if (!oauthPopup) {
      oauthInProgress = false;
      tokenError = 'Popup bloqueado pelo navegador. Permita popups para este site e tente de novo.';
    }
  }

  async function refreshTokenNow() {
    refreshingToken = true;
    tokenError = '';
    tokenSuccessMsg = '';
    try {
      const r = await fetch('/api/fb-ads/token/refresh', { method: 'POST' });
      const d = await r.json();
      if (r.ok && d.ok) {
        tokenStatus = { ...(tokenStatus || {}), ...d.status } as TokenStatus;
        const days = d.status?.daysLeft;
        tokenSuccessMsg = `✓ Token renovado (vale por mais ${days} dias)`;
        setTimeout(() => { tokenSuccessMsg = ''; }, 4000);
      } else {
        tokenError = d.error || 'Falha ao renovar';
      }
    } catch (e: any) {
      tokenError = e?.message || 'erro de rede';
    }
    refreshingToken = false;
  }

  async function saveToken() {
    if (!tokenInput.trim()) {
      tokenError = 'Cole o token primeiro';
      return;
    }
    tokenSaving = true;
    tokenError = '';
    tokenSuccessMsg = '';
    try {
      const r = await fetch('/api/fb-ads/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tokenInput.trim() }),
      });
      const d = await r.json();
      if (r.ok && d.ok) {
        tokenSuccessMsg = `✓ Token salvo (${d.fbUser?.name || d.fbUser?.id})`;
        tokenStatus = d.status;
        tokenInput = '';
        // Recarrega contas com novo token
        await loadFbAccounts(true);
        setTimeout(() => { tokenSuccessMsg = ''; }, 4000);
      } else {
        tokenError = d.error || 'Falha ao salvar';
      }
    } catch (e: any) {
      tokenError = e?.message || 'erro de rede';
    }
    tokenSaving = false;
  }

  async function clearStoredToken() {
    if (!confirm('Remover token salvo e voltar pro padrão (env)?')) return;
    try {
      const r = await fetch('/api/fb-ads/token', { method: 'DELETE' });
      const d = await r.json();
      if (r.ok && d.ok) {
        tokenStatus = d.status;
        tokenSuccessMsg = '✓ Token removido, usando padrão';
        await loadFbAccounts(true);
        setTimeout(() => { tokenSuccessMsg = ''; }, 4000);
      }
    } catch {}
  }

  async function runDebug() {
    debugLoading = true;
    fbDebug = null;
    try {
      const r = await fetch('/api/fb-ads/debug', { cache: 'no-store' });
      if (r.ok) fbDebug = await r.json();
      else fbDebug = { error: 'HTTP ' + r.status };
    } catch (e: any) {
      fbDebug = { error: e?.message };
    }
    debugLoading = false;
  }

  // Filtro + agrupamento por BM (igual UTMfy)
  const fbAccountsFiltered = $derived.by(() => {
    const q = accountSearch.trim().toLowerCase();
    if (!q) return fbAccounts;
    return fbAccounts.filter((a) =>
      a.name.toLowerCase().includes(q) ||
      a.id.toLowerCase().includes(q) ||
      (a.business || '').toLowerCase().includes(q) ||
      a.currency.toLowerCase().includes(q)
    );
  });

  const fbAccountsGrouped = $derived.by(() => {
    const groups = new Map<string, { id: string; name: string; accounts: FbAccount[] }>();
    for (const acc of fbAccountsFiltered) {
      const key = acc.businessId || '__personal__';
      const name = acc.business || 'Conta pessoal (sem BM)';
      if (!groups.has(key)) {
        groups.set(key, { id: key, name, accounts: [] });
      }
      groups.get(key)!.accounts.push(acc);
    }
    // Ordena grupos: pessoal por último, BMs por nome
    return [...groups.values()].sort((a, b) => {
      if (a.id === '__personal__') return 1;
      if (b.id === '__personal__') return -1;
      return a.name.localeCompare(b.name);
    });
  });

  const fbAccountQuery = $derived(fbAccountId ? `&account_id=${encodeURIComponent(fbAccountId)}` : '');
  const fbActiveAccount = $derived(
    fbAccounts.find((a) => a.id === fbAccountId) || null
  );
  const fbActiveAccountLabel = $derived(
    fbActiveAccount ? fbActiveAccount.name : (fbAccountId ? fbAccountId : 'Conta padrão')
  );

  async function loadFbAccounts(force = false) {
    fbAccountsLoading = true;
    fbAccountsError = '';
    try {
      const r = await fetch(`/api/fb-ads/accounts${force ? '?force=1' : ''}`, { cache: 'no-store' });
      if (r.ok) {
        const d = await r.json();
        fbAccounts = d.accounts || [];
        fbBusinesses = d.businesses || [];
        // Se não tem conta selecionada, usa o padrão do server
        if (!fbAccountId && d.defaultAccount) {
          // Tenta restaurar do localStorage
          try {
            const saved = localStorage.getItem('vitrack_fb_account_id');
            if (saved && fbAccounts.some((a: FbAccount) => a.id === saved)) {
              fbAccountId = saved;
            } else {
              fbAccountId = d.defaultAccount;
            }
          } catch {
            fbAccountId = d.defaultAccount;
          }
        }
        if (d.errors?.length) fbAccountsError = d.errors[0];
        else if (d._error) fbAccountsError = d._error;
      } else {
        const err = await r.json().catch(() => ({}));
        fbAccountsError = err.error || `HTTP ${r.status}`;
      }
    } catch (e: any) {
      fbAccountsError = e?.message || 'erro de rede';
    }
    fbAccountsLoading = false;
  }

  function selectFbAccount(id: string) {
    fbAccountId = id;
    accountMenuOpen = false;
    try { localStorage.setItem('vitrack_fb_account_id', id); } catch {}
    // Trigger refetch
    pullFbAds();
    if (activeTab === 'campanhas') pullCampaigns();
  }

  // Svelte action: fecha o menu de contas se clicar fora
  function clickOutsideAccount(node: HTMLElement) {
    function onDown(e: MouseEvent) {
      if (!accountMenuOpen) return;
      if (!node.contains(e.target as Node)) {
        accountMenuOpen = false;
      }
    }
    document.addEventListener('mousedown', onDown);
    return {
      destroy() { document.removeEventListener('mousedown', onDown); }
    };
  }
  function clickOutsidePeriod(node: HTMLElement) {
    function onDown(e: MouseEvent) {
      if (!periodOpen) return;
      if (!node.contains(e.target as Node)) periodOpen = false;
    }
    document.addEventListener('mousedown', onDown);
    return { destroy() { document.removeEventListener('mousedown', onDown); } };
  }
  function clickOutsideCurrency(node: HTMLElement) {
    function onDown(e: MouseEvent) {
      if (!currencyMenuOpen) return;
      if (!node.contains(e.target as Node)) currencyMenuOpen = false;
    }
    document.addEventListener('mousedown', onDown);
    return { destroy() { document.removeEventListener('mousedown', onDown); } };
  }

  async function pullFbAds() {
    fbLoading = true;
    try {
      const r = await fetch(`/api/fb-ads?window=${fbWin}${fbAccountQuery}`, { cache: 'no-store' });
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
    const _acc = fbAccountId;
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
  // Tamanho dos cards: 'small' (1 col) ou 'large' (2 cols / linha inteira no mobile)
  type CardSize = 'small' | 'large';
  let cardSizes = $state<Record<string, CardSize>>({});
  function getCardSize(id: CardId): CardSize {
    return cardSizes[id] || 'small';
  }
  function setCardSize(id: CardId, size: CardSize) {
    cardSizes = { ...cardSizes, [id]: size };
    try { localStorage.setItem('vitrack_card_sizes', JSON.stringify(cardSizes)); } catch {}
  }
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
    // Carrega moeda preferida
    try {
      const cur = localStorage.getItem('vitrack_currency') as DisplayCurrency | null;
      if (cur === 'BRL' || cur === 'USD' || cur === 'EUR') displayCurrency = cur;
    } catch {}
    // Carrega tamanho dos cards
    try {
      const sizes = localStorage.getItem('vitrack_card_sizes');
      if (sizes) cardSizes = JSON.parse(sizes);
    } catch {}
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
    // Carrega lista de contas de anúncio disponíveis no perfil
    loadFbAccounts();
    // Carrega status do token FB
    loadTokenStatus();

    // Listener do popup OAuth — recebe postMessage do callback
    const onOAuthMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const data: any = e.data;
      if (!data || data.type !== 'fb-oauth-result') return;
      oauthInProgress = false;
      try { oauthPopup?.close(); } catch {}
      oauthPopup = null;
      if (data.payload?.ok) {
        tokenSuccessMsg = '✓ Conectado ao Facebook! Token renova sozinho.';
        setTimeout(() => { tokenSuccessMsg = ''; }, 5000);
        loadTokenStatus();
        loadFbAccounts(true);
      } else {
        tokenError = data.payload?.error || 'Falha no OAuth';
      }
    };
    window.addEventListener('message', onOAuthMessage);
    return () => window.removeEventListener('message', onOAuthMessage);
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

  // ── Resize: drag horizontal na alca direita pra alternar small/large ──
  let resizeCardId: CardId | null = null;
  let resizeStartX = 0;
  let resizeStartSize: CardSize = 'small';
  const RESIZE_THRESHOLD = 40; // px de drag pra ativar mudanca

  function handleResizeDown(e: PointerEvent, id: CardId) {
    e.preventDefault();
    e.stopPropagation();
    const target = e.currentTarget as HTMLElement;
    try { target.setPointerCapture(e.pointerId); } catch {}
    resizeCardId = id;
    resizeStartX = e.clientX;
    resizeStartSize = getCardSize(id);
  }

  function handleResizeMove(e: PointerEvent) {
    if (!resizeCardId) return;
    e.preventDefault();
    const dx = e.clientX - resizeStartX;
    // dx > threshold pra direita = vira large; dx < -threshold = vira small
    if (resizeStartSize === 'small' && dx > RESIZE_THRESHOLD) {
      setCardSize(resizeCardId, 'large');
      if (navigator.vibrate) navigator.vibrate(10);
      resizeStartSize = 'large';
      resizeStartX = e.clientX;
    } else if (resizeStartSize === 'large' && dx < -RESIZE_THRESHOLD) {
      setCardSize(resizeCardId, 'small');
      if (navigator.vibrate) navigator.vibrate(10);
      resizeStartSize = 'small';
      resizeStartX = e.clientX;
    }
  }

  function handleResizeUp(e: PointerEvent) {
    const target = e.currentTarget as HTMLElement;
    try { target.releasePointerCapture(e.pointerId); } catch {}
    // Click simples sem drag: alterna o tamanho
    if (resizeCardId) {
      const dx = Math.abs(e.clientX - resizeStartX);
      if (dx < 5 && resizeStartSize === getCardSize(resizeCardId)) {
        const next: CardSize = resizeStartSize === 'small' ? 'large' : 'small';
        setCardSize(resizeCardId, next);
      }
    }
    resizeCardId = null;
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

  // Densidade da tabela de campanhas — usuario escolhe
  type CampView = 'essential' | 'funnel' | 'full';
  let campView = $state<CampView>('funnel');
  let campActionOpenId = $state<string | null>(null);
  let campActionBusyId = $state<string | null>(null);
  let campEditBudgetId = $state<string | null>(null);
  let campEditBudgetValue = $state('');
  let campDuplicateConfirmId = $state<string | null>(null);
  let campErrorMsg = $state('');
  let campSuccessMsg = $state('');

  async function pullCampaigns(force = false) {
    campaignsLoading = true;
    fbCampaigns = [];
    try {
      const nocache = force ? '&nocache=1' : '';
      const r = await fetch(`/api/fb-ads?window=${fbWin}&campaigns=1${fbAccountQuery}${nocache}`, { cache: 'no-store' });
      if (r.ok) {
        const d = await r.json();
        fbCampaigns = d.campaigns || [];
      }
    } catch {}
    campaignsLoading = false;
  }

  async function patchCampaign(id: string, body: Record<string, any>): Promise<boolean> {
    campActionBusyId = id;
    campErrorMsg = '';
    try {
      const r = await fetch(`/api/fb-ads/campaign/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) throw new Error(d.error || `HTTP ${r.status}`);
      campSuccessMsg = '✓ Campanha atualizada';
      setTimeout(() => (campSuccessMsg = ''), 3500);
      await pullCampaigns();  // recarrega pra refletir
      return true;
    } catch (e: any) {
      campErrorMsg = e?.message || 'Erro desconhecido';
      return false;
    } finally {
      campActionBusyId = null;
    }
  }

  async function toggleCampaign(c: any) {
    const newStatus = c.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    if (newStatus === 'PAUSED' && !confirm(`Pausar campanha "${c.name}"?`)) return;
    await patchCampaign(c.id, { status: newStatus });
  }

  function openEditBudget(c: any) {
    campEditBudgetId = c.id;
    campEditBudgetValue = c.dailyBudget ? String(c.dailyBudget) : '';
  }

  async function saveBudget(id: string) {
    const num = parseFloat(campEditBudgetValue.replace(',', '.'));
    if (!num || num <= 0) {
      campErrorMsg = 'Orçamento inválido';
      return;
    }
    const ok = await patchCampaign(id, { dailyBudget: num });
    if (ok) campEditBudgetId = null;
  }

  async function duplicateCampaign(id: string) {
    campActionBusyId = id;
    campErrorMsg = '';
    try {
      const r = await fetch(`/api/fb-ads/campaign/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'duplicate' }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) throw new Error(d.error || `HTTP ${r.status}`);
      campSuccessMsg = '✓ Campanha duplicada (criada pausada)';
      setTimeout(() => (campSuccessMsg = ''), 5000);
      await pullCampaigns();
    } catch (e: any) {
      campErrorMsg = e?.message || 'Erro ao duplicar';
    } finally {
      campActionBusyId = null;
      campDuplicateConfirmId = null;
      campActionOpenId = null;
    }
  }

  function clickOutsideAction(node: HTMLElement) {
    const handler = (e: MouseEvent) => {
      if (!node.contains(e.target as Node)) campActionOpenId = null;
    };
    document.addEventListener('click', handler);
    return { destroy() { document.removeEventListener('click', handler); } };
  }

  $effect(() => {
    if (!data.authed) return;
    if (activeTab === 'campanhas') {
      const _w = fbWin;
      const _acc = fbAccountId;
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

  // ─── Cleaner (Burlador Meta Ads) ───
  let cleanerVideoFile = $state<File | null>(null);
  let cleanerImageFile = $state<File | null>(null);
  let cleanerImagePreview = $state<string | null>(null);
  let cleanerTargetDuration = $state(360); // 6 min
  let cleanerIntensity = $state<'normal' | 'aggressive'>('normal');
  let cleanerStatus = $state<'idle' | 'uploading' | 'processing' | 'done' | 'error'>('idle');
  let cleanerProgress = $state(0);
  let cleanerError = $state('');
  let cleanerResultUrl = $state<string | null>(null);
  let cleanerResultName = $state('');
  let cleanerStartedAt = $state(0);
  let cleanerElapsed = $state(0);
  let cleanerElapsedTimer: ReturnType<typeof setInterval> | null = null;

  function pickCleanerVideo(e: Event) {
    const inp = e.currentTarget as HTMLInputElement;
    const f = inp.files?.[0];
    cleanerVideoFile = f ?? null;
  }
  function pickCleanerImage(e: Event) {
    const inp = e.currentTarget as HTMLInputElement;
    const f = inp.files?.[0];
    cleanerImageFile = f ?? null;
    if (cleanerImagePreview) URL.revokeObjectURL(cleanerImagePreview);
    cleanerImagePreview = f ? URL.createObjectURL(f) : null;
  }
  function resetCleaner() {
    cleanerVideoFile = null;
    cleanerImageFile = null;
    if (cleanerImagePreview) URL.revokeObjectURL(cleanerImagePreview);
    cleanerImagePreview = null;
    cleanerStatus = 'idle';
    cleanerProgress = 0;
    cleanerError = '';
    if (cleanerResultUrl) URL.revokeObjectURL(cleanerResultUrl);
    cleanerResultUrl = null;
    cleanerResultName = '';
    cleanerElapsed = 0;
    if (cleanerElapsedTimer) { clearInterval(cleanerElapsedTimer); cleanerElapsedTimer = null; }
  }

  async function runCleaner() {
    if (!cleanerVideoFile) { cleanerError = 'Selecione um video'; return; }
    cleanerError = '';
    cleanerStatus = 'uploading';
    cleanerProgress = 0;
    cleanerStartedAt = Date.now();
    cleanerElapsed = 0;

    if (cleanerElapsedTimer) clearInterval(cleanerElapsedTimer);
    cleanerElapsedTimer = setInterval(() => {
      cleanerElapsed = Math.round((Date.now() - cleanerStartedAt) / 1000);
    }, 1000);

    const form = new FormData();
    form.append('video', cleanerVideoFile);
    if (cleanerImageFile) form.append('image', cleanerImageFile);
    form.append('targetDuration', String(cleanerTargetDuration));
    form.append('intensity', cleanerIntensity);

    try {
      // Usa XHR pra ter progresso de upload
      const result = await new Promise<Blob>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/clean-video');
        xhr.responseType = 'blob';
        xhr.upload.onprogress = (evt) => {
          if (evt.lengthComputable) {
            cleanerProgress = Math.round((evt.loaded / evt.total) * 100);
            if (cleanerProgress >= 100) cleanerStatus = 'processing';
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(xhr.response as Blob);
          } else {
            // Tenta ler mensagem de erro do blob
            const r = new FileReader();
            r.onload = () => {
              try {
                const j = JSON.parse(r.result as string);
                reject(new Error(j.message || `HTTP ${xhr.status}`));
              } catch {
                reject(new Error(r.result as string || `HTTP ${xhr.status}`));
              }
            };
            r.onerror = () => reject(new Error(`HTTP ${xhr.status}`));
            r.readAsText(xhr.response);
          }
        };
        xhr.onerror = () => reject(new Error('Erro de rede'));
        xhr.ontimeout = () => reject(new Error('Timeout'));
        xhr.timeout = 10 * 60 * 1000; // 10 min
        xhr.send(form);
      });

      cleanerResultUrl = URL.createObjectURL(result);
      cleanerResultName = `video-limpo-${Date.now()}.mp4`;
      cleanerStatus = 'done';
    } catch (e: any) {
      cleanerError = e?.message || 'Erro desconhecido';
      cleanerStatus = 'error';
    } finally {
      if (cleanerElapsedTimer) { clearInterval(cleanerElapsedTimer); cleanerElapsedTimer = null; }
    }
  }

  function fmtBytes(n: number): string {
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1024 / 1024).toFixed(1) + ' MB';
  }
  function fmtSecs(n: number): string {
    const m = Math.floor(n / 60);
    const s = n % 60;
    return m > 0 ? `${m}m${String(s).padStart(2, '0')}s` : `${s}s`;
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
        { id: 'overview', label: 'Visão geral', icon: '⌂' },
        { id: 'live', label: 'Live', icon: '⚡︎' },
        { id: 'funnel', label: 'Funil', icon: '▽' },
        { id: 'campanhas', label: 'Campanhas', icon: 'f' },
        { id: 'contas', label: 'Contas', icon: '⊞' },
        { id: 'taxas', label: 'Taxas', icon: '%' },
        { id: 'vsl', label: 'VSL', icon: '▶' },
        { id: 'sessions', label: 'Sessões', icon: '☰' },
        { id: 'revenue', label: 'Receita', icon: '$' },
        { id: 'tech', label: 'Performance', icon: '⏱︎' },
        { id: 'cleaner', label: 'Burlador Meta', icon: '⌽' }
      ] as item}
        <button class="nav-item" data-tab={item.id} class:active={activeTab === item.id} onclick={() => { activeTab = item.id as Tab; mobileMenuOpen = false; }}>
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
          <span class="status status-inline">
            <span class="status-dot" class:on={updateAgoSec < 6}></span>
            <span class="status-text">
              {updateAgoSec < 6 ? 'live' : 'há ' + fmtAgo(updateAgoSec)}
            </span>
          </span>
        </div>
        <button class="filters-toggle" aria-label="filtros" onclick={() => (mobileFiltersOpen = !mobileFiltersOpen)}>
          {mobileFiltersOpen ? '✕' : '⌥'}
        </button>
        <!-- Cluster de seletores (conta + periodo + moeda) ao lado de "Dashboard" -->
        <div class="topbar-selectors" class:mobile-open={mobileFiltersOpen}>
          <!-- Seletor de conta de anúncio (estilo UTMfy) -->
        <div class="account-switch" use:clickOutsideAccount>
          <button
            class="account-btn"
            class:active={accountMenuOpen}
            onclick={() => (accountMenuOpen = !accountMenuOpen)}
            title={fbActiveAccount ? `${fbActiveAccount.name} · ${fbActiveAccount.currency}` : 'Selecionar conta'}
          >
            <span class="account-btn-icon">⌬</span>
            <span class="account-btn-label">
              {fbAccountsLoading && !fbAccounts.length ? 'Carregando…' : fbActiveAccountLabel}
            </span>
            {#if fbActiveAccount}
              <span class="account-btn-currency">{fbActiveAccount.currency}</span>
            {/if}
            <span class="account-chevron" class:open={accountMenuOpen}>▾</span>
          </button>
          {#if accountMenuOpen}
            <div class="account-menu account-menu-compact">
              <div class="account-menu-head">
                <span>{fbAccounts.length} contas</span>
                <button class="account-refresh" onclick={() => loadFbAccounts(true)} disabled={fbAccountsLoading} title="Atualizar">
                  {fbAccountsLoading ? '…' : '↻'}
                </button>
              </div>
              {#if fbAccounts.length > 8}
                <div class="account-menu-search-wrap">
                  <input
                    type="text"
                    class="account-menu-search"
                    placeholder="Buscar conta ou ID…"
                    bind:value={accountSearch}
                  />
                </div>
              {/if}
              {#if fbAccountsError}
                <div class="account-menu-error" title={fbAccountsError}>⚠ {fbAccountsError}</div>
              {/if}
              {#if !fbAccountsFiltered.length && !fbAccountsLoading}
                <div class="account-menu-empty">
                  {fbAccounts.length === 0
                    ? 'Nenhuma conta. Conecte na aba Contas.'
                    : 'Nenhuma conta bate com a busca'}
                </div>
              {/if}
              <div class="account-menu-list">
                {#each fbAccountsFiltered as acc (acc.id)}
                  <button
                    type="button"
                    class="account-menu-item account-menu-item-flat"
                    class:active={acc.id === fbAccountId}
                    class:disabled={acc.statusCode !== 1}
                    onclick={() => selectFbAccount(acc.id)}
                  >
                    <div class="account-menu-item-main">
                      <span class="account-menu-item-name">{acc.name}</span>
                      <span class="account-menu-item-id">{acc.business || acc.id}</span>
                    </div>
                    <span class="account-menu-item-currency">{acc.currency}</span>
                  </button>
                {/each}
              </div>
              <button
                class="account-menu-manage"
                onclick={() => { activeTab = 'contas'; accountMenuOpen = false; }}
              >
                <span>⊞ Gerenciar contas</span>
                <span>→</span>
              </button>
            </div>
          {/if}
        </div>
        <!-- Período de visualização colapsável -->
        <div class="selector-wrap" use:clickOutsidePeriod>
          <button class="selector-btn period-label-btn" class:active={periodOpen} onclick={() => (periodOpen = !periodOpen)}>
            <span class="selector-icon">📅</span>
            <span class="selector-label">Período</span>
            <span class="selector-value">{PERIOD_LABELS[period]}</span>
            <span class="selector-chevron" class:open={periodOpen}>▾</span>
          </button>
          {#if periodOpen}
            <div class="selector-menu period-menu">
              {#each (['hoje','ontem','hoje_ontem','ultimos_7d','este_mes'] as Period[]) as p}
                <button
                  class="selector-menu-item"
                  class:active={period === p}
                  onclick={() => { period = p; periodOpen = false; }}
                >{PERIOD_LABELS[p]}</button>
              {/each}
            </div>
          {/if}
        </div>
        <!-- Seletor de moeda como dropdown -->
        <div class="selector-wrap" use:clickOutsideCurrency>
          <button class="selector-btn" class:active={currencyMenuOpen} onclick={() => (currencyMenuOpen = !currencyMenuOpen)}>
            <span class="selector-icon">$</span>
            <span class="selector-label">Moeda</span>
            <span class="selector-value">{displayCurrency}</span>
            <span class="selector-chevron" class:open={currencyMenuOpen}>▾</span>
          </button>
          {#if currencyMenuOpen}
            <div class="selector-menu currency-menu">
              {#each CURRENCY_OPTIONS as opt}
                <button
                  type="button"
                  class="selector-menu-item"
                  class:active={displayCurrency === opt.code}
                  onclick={() => { selectCurrency(opt.code); currencyMenuOpen = false; }}
                >
                  <span class="selector-menu-symbol">{opt.symbol}</span>
                  <span class="selector-menu-text">{opt.code}</span>
                  <span class="selector-menu-hint">{opt.label}</span>
                </button>
              {/each}
            </div>
          {/if}
        </div>
        </div>
      </div>
      <div class="topbar-right" class:mobile-open={mobileFiltersOpen}>
        <!-- Personalizar / Concluir edicao (so desktop; mobile usa long-press) -->
        {#if activeTab === 'overview'}
          {#if editMode}
            <button class="btn-customize btn-customize-exit topbar-customize" onclick={exitEditMode}>
              ✓ Concluir
            </button>
          {:else}
            <button class="btn-customize btn-customize-desktop topbar-customize" onclick={() => (customizeOpen = !customizeOpen)}>
              {customizeOpen ? '✕ Fechar' : '⊙ Personalizar'}
            </button>
          {/if}
        {/if}
        <button
          class="btn-update topbar-update"
          onclick={refresh}
          disabled={refreshing}
        >{refreshing ? 'Atualizando' : '↻ Atualizar'}</button>
        <button class="btn-reset" onclick={resetData} disabled={resetting} title="Zerar todos os dados">
          {resetting ? '…' : 'Reset'}
        </button>
      </div>
    </header>

    {#if toastMsg}
      <div class="toast">{toastMsg}</div>
    {/if}

    {#if activeTab === 'cleaner'}
      <div class="tab-content">
        <div class="cleaner-wrap">
          <header class="cleaner-head">
            <h2 class="cleaner-title">⌽ Burlador Meta Ads</h2>
            <p class="cleaner-sub">
              Limpa metadata + aplica transformacoes pesadas pra burlar a deteccao de repost do Facebook/Meta Ads.
              Visualmente identico, fingerprint totalmente diferente.
            </p>
          </header>

          <div class="cleaner-grid">
            <div class="cleaner-form">
              <!-- Upload da imagem (vem ANTES do video) -->
              <label class="cleaner-field">
                <span class="cleaner-label">1. Imagem de capa <em>(opcional, vira frame inicial + preenche final ate completar a duracao alvo)</em></span>
                <input type="file" accept="image/*" onchange={pickCleanerImage} class="cleaner-input-file" />
                {#if cleanerImageFile}
                  <span class="cleaner-file-info">
                    ▸ <strong>{cleanerImageFile.name}</strong> · {fmtBytes(cleanerImageFile.size)}
                  </span>
                  {#if cleanerImagePreview}
                    <img src={cleanerImagePreview} alt="preview" class="cleaner-image-preview" />
                  {/if}
                {/if}
              </label>

              <!-- Upload do video -->
              <label class="cleaner-field">
                <span class="cleaner-label">2. Video original <em>(obrigatorio, max 200MB)</em></span>
                <input type="file" accept="video/*" onchange={pickCleanerVideo} class="cleaner-input-file" />
                {#if cleanerVideoFile}
                  <span class="cleaner-file-info">
                    ▸ <strong>{cleanerVideoFile.name}</strong> · {fmtBytes(cleanerVideoFile.size)}
                  </span>
                {/if}
              </label>

              <!-- Duracao alvo -->
              <label class="cleaner-field">
                <span class="cleaner-label">3. Duracao final (segundos)</span>
                <div class="cleaner-duration-row">
                  <input
                    type="number"
                    min="10"
                    max="3600"
                    bind:value={cleanerTargetDuration}
                    class="cleaner-input-num"
                  />
                  <span class="cleaner-duration-hint">= {fmtSecs(cleanerTargetDuration)}</span>
                  <button type="button" class="cleaner-preset" onclick={() => cleanerTargetDuration = 60}>1m</button>
                  <button type="button" class="cleaner-preset" onclick={() => cleanerTargetDuration = 180}>3m</button>
                  <button type="button" class="cleaner-preset" onclick={() => cleanerTargetDuration = 360}>6m</button>
                  <button type="button" class="cleaner-preset" onclick={() => cleanerTargetDuration = 600}>10m</button>
                </div>
              </label>

              <!-- Intensidade -->
              <label class="cleaner-field">
                <span class="cleaner-label">4. Intensidade dos efeitos</span>
                <div class="cleaner-intensity-row">
                  <button
                    type="button"
                    class="cleaner-intensity-btn"
                    class:active={cleanerIntensity === 'normal'}
                    onclick={() => cleanerIntensity = 'normal'}
                  >
                    <strong>Normal</strong>
                    <small>+2% speed, crop 8px, noise leve</small>
                  </button>
                  <button
                    type="button"
                    class="cleaner-intensity-btn"
                    class:active={cleanerIntensity === 'aggressive'}
                    onclick={() => cleanerIntensity = 'aggressive'}
                  >
                    <strong>Agressivo</strong>
                    <small>+4% speed, crop 12px, noise medio</small>
                  </button>
                </div>
              </label>

              <!-- Botoes -->
              <div class="cleaner-actions">
                <button
                  type="button"
                  class="btn-cleaner-go"
                  disabled={!cleanerVideoFile || cleanerStatus === 'uploading' || cleanerStatus === 'processing'}
                  onclick={runCleaner}
                >
                  {#if cleanerStatus === 'uploading'}
                    Enviando… {cleanerProgress}%
                  {:else if cleanerStatus === 'processing'}
                    Processando… {fmtSecs(cleanerElapsed)}
                  {:else}
                    ▶ Converter
                  {/if}
                </button>
                {#if cleanerStatus !== 'idle'}
                  <button type="button" class="btn-cleaner-reset" onclick={resetCleaner}>
                    Limpar
                  </button>
                {/if}
              </div>

              <!-- Status -->
              {#if cleanerStatus === 'uploading' || cleanerStatus === 'processing'}
                <div class="cleaner-progress-wrap">
                  <div class="cleaner-progress-track">
                    <div
                      class="cleaner-progress-fill"
                      class:processing={cleanerStatus === 'processing'}
                      style="width: {cleanerStatus === 'uploading' ? cleanerProgress : 100}%"
                    ></div>
                  </div>
                  <div class="cleaner-progress-text">
                    {#if cleanerStatus === 'uploading'}
                      Enviando arquivo… {cleanerProgress}%
                    {:else}
                      Processando no servidor (ffmpeg)… isso pode levar 1-3min pra videos longos.
                    {/if}
                  </div>
                </div>
              {/if}

              {#if cleanerStatus === 'error'}
                <div class="cleaner-error">
                  <strong>Erro:</strong> {cleanerError}
                </div>
              {/if}

              {#if cleanerStatus === 'done' && cleanerResultUrl}
                <div class="cleaner-success">
                  <strong>✓ Video processado em {fmtSecs(cleanerElapsed)}</strong>
                  <a href={cleanerResultUrl} download={cleanerResultName} class="btn-cleaner-download">
                    ⤓ Baixar video limpo
                  </a>
                  <video src={cleanerResultUrl} controls class="cleaner-preview"></video>
                </div>
              {/if}
            </div>

            <!-- Painel lateral: explicacao -->
            <aside class="cleaner-info">
              <h3>O que e feito</h3>
              <ul>
                <li><strong>Metadata strip:</strong> remove tudo (title, encoder, GPS, creation_time, comment)</li>
                <li><strong>Crop + rescale:</strong> tira 8-12px das bordas e reescala pra 1080x1920 — quebra phash visual</li>
                <li><strong>Eq color shift:</strong> ajusta brightness +2-3%, contrast +3-5%, saturation +5-8%</li>
                <li><strong>Noise injection:</strong> grao temporal aleatorio em todos os frames</li>
                <li><strong>Unsharp:</strong> filtro de nitidez leve que muda gradientes</li>
                <li><strong>Speed shift:</strong> +2% (normal) ou +4% (agressivo) — quebra hash temporal</li>
                <li><strong>Audio pitch:</strong> pitch shift ~0.5% via asetrate</li>
                <li><strong>Re-encode:</strong> H264 preset veryfast, CRF 23-24, GOP 48</li>
                <li><strong>Audio re-encode:</strong> AAC 96kbps, 44.1kHz (novo fingerprint)</li>
                <li><strong>Estrutura:</strong> imagem (1 frame) + video + tela preta 2s + imagem ate completar duracao alvo</li>
              </ul>
              <h3>Limites</h3>
              <ul>
                <li>Upload max: 200MB</li>
                <li>Duracao alvo max: 1h</li>
                <li>Timeout processamento: 5min</li>
                <li>Saida sempre: 1080x1920, H264+AAC, mp4</li>
              </ul>
            </aside>
          </div>
        </div>
      </div>
    {:else if !snap}
      <div class="loading">
        <div class="spinner"></div>
        <span>Carregando dados…</span>
      </div>
    {:else}

      {#if activeTab === 'overview'}
      <div class="tab-content">
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
              class:kpi-large={getCardSize(cardId) === 'large'}
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
              {#if editMode}
                <button
                  type="button"
                  class="kpi-resize-handle"
                  aria-label="Redimensionar card"
                  title={getCardSize(cardId) === 'large' ? 'Diminuir' : 'Aumentar'}
                  onpointerdown={(e) => handleResizeDown(e, cardId)}
                  onpointermove={handleResizeMove}
                  onpointerup={handleResizeUp}
                  onpointercancel={handleResizeUp}
                >{getCardSize(cardId) === 'large' ? '↤' : '↦'}</button>
              {/if}
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

        {#if campaignsLoading}
          <div class="loading"><div class="spinner"></div><span>Carregando campanhas…</span></div>
        {:else if fbCampaigns.length === 0}
          <div class="empty"><span class="empty-emoji">◎</span><p>Sem campanhas no período. Tente outro intervalo.</p></div>
        {:else}
          <!-- Toggle de densidade -->
          <div class="camp-view-toggle">
            <span class="camp-view-label">Visualização:</span>
            <button class="camp-view-pill" class:active={campView === 'essential'} onclick={() => (campView = 'essential')}>Essencial</button>
            <button class="camp-view-pill" class:active={campView === 'funnel'} onclick={() => (campView = 'funnel')}>Funil completo</button>
            <button class="camp-view-pill" class:active={campView === 'full'} onclick={() => (campView = 'full')}>Tudo</button>
          </div>

          {#if campSuccessMsg}<div class="camp-flash success">{campSuccessMsg}</div>{/if}
          {#if campErrorMsg}<div class="camp-flash error">⚠ {campErrorMsg} <button onclick={() => (campErrorMsg = '')}>✕</button></div>{/if}

          <!-- Tabela estilo UTMfy -->
          {@const campTotalSpend  = fbCampaigns.reduce((s, c) => s + c.spend, 0)}
          {@const campTotalImpr   = fbCampaigns.reduce((s, c) => s + c.impressions, 0)}
          {@const campTotalClicks = fbCampaigns.reduce((s, c) => s + c.clicks, 0)}
          {@const campTotalPurch  = fbCampaigns.reduce((s, c) => s + (c.purchases || 0), 0)}
          {@const campTotalRev    = fbCampaigns.reduce((s, c) => s + (c.purchaseValue || 0), 0)}
          {@const campTotalLPV    = fbCampaigns.reduce((s, c) => s + (c.landingPageViews || 0), 0)}
          {@const campTotalIC     = fbCampaigns.reduce((s, c) => s + (c.initiateCheckout || 0), 0)}
          {@const campTotalATC    = fbCampaigns.reduce((s, c) => s + (c.addToCart || 0), 0)}
          <div class="camp-utmfy-wrap">
            <table class="camp-utmfy camp-utmfy-{campView}">
              <thead>
                <tr>
                  <th class="th-toggle">Status</th>
                  <th class="th-name">Campanha</th>
                  <th class="th-num">Orçamento</th>
                  <th class="th-num">Gastos</th>
                  <th class="th-num">Impressões</th>
                  {#if campView === 'full'}
                    <th class="th-num">Alcance</th>
                    <th class="th-num">Freq.</th>
                  {/if}
                  <th class="th-num">CTR</th>
                  <th class="th-num">Cliques no link</th>
                  <th class="th-num">CPC</th>
                  {#if campView !== 'essential'}
                    <th class="th-num">Visualizações da página</th>
                    <th class="th-num">Finalizações de compra</th>
                  {/if}
                  {#if campView === 'full'}
                    <th class="th-num">Add to cart</th>
                  {/if}
                  <th class="th-num">ROAS</th>
                  <th class="th-num">Resultados</th>
                  <th class="th-num">Custo por resultado</th>
                  {#if campView === 'full'}
                    <th class="th-num">CPM</th>
                  {/if}
                </tr>
              </thead>
              <tbody>
                {#each [...fbCampaigns].sort((a, b) => b.spend - a.spend) as c, i (c.id || c.name)}
                <tr class="camp-tr" class:camp-tr-alt={i % 2 !== 0} class:camp-tr-paused={c.status === 'PAUSED'}>
                  <!-- TOGGLE ON/OFF -->
                  <td class="td-toggle">
                    <button
                      class="camp-switch"
                      class:active={c.status === 'ACTIVE'}
                      onclick={() => toggleCampaign(c)}
                      disabled={campActionBusyId === c.id || !c.status}
                      title={c.status === 'ACTIVE' ? 'Pausar campanha' : 'Ativar campanha'}
                    >
                      <span class="camp-switch-track">
                        <span class="camp-switch-thumb"></span>
                      </span>
                    </button>
                  </td>
                  <!-- NOME -->
                  <td class="td-name">
                    <span class="camp-name-txt" title={c.name}>{c.name}</span>
                    {#if c.objective}<span class="camp-objective">{c.objective.replace('OUTCOME_','').toLowerCase()}</span>{/if}
                  </td>
                  <!-- ORÇAMENTO inline -->
                  <td class="td-num td-budget" data-label="Orçamento">
                    {#if campEditBudgetId === c.id}
                      <div class="camp-edit-budget">
                        <input
                          type="number"
                          step="0.01"
                          min="1"
                          bind:value={campEditBudgetValue}
                          class="camp-edit-budget-input"
                          placeholder="USD"
                          autofocus
                        />
                        <button class="camp-action-save" onclick={() => saveBudget(c.id)} disabled={campActionBusyId === c.id} title="Salvar">
                          {campActionBusyId === c.id ? '…' : '✓'}
                        </button>
                        <button class="camp-action-cancel" onclick={() => (campEditBudgetId = null)} title="Cancelar">✕</button>
                      </div>
                    {:else if c.dailyBudget}
                      <button class="camp-budget-btn" onclick={() => openEditBudget(c)} title="Clique para editar">
                        <span class="camp-val-main">{fmtSpendDisplay(c.dailyBudget)}</span>
                        <span class="camp-val-sub">Diário</span>
                      </button>
                    {:else if c.lifetimeBudget}
                      <button class="camp-budget-btn" onclick={() => openEditBudget(c)} title="Clique para editar">
                        <span class="camp-val-main">{fmtSpendDisplay(c.lifetimeBudget)}</span>
                        <span class="camp-val-sub">Total</span>
                      </button>
                    {:else}
                      <button class="camp-budget-btn camp-budget-empty" onclick={() => openEditBudget(c)} title="Definir orçamento">—</button>
                    {/if}
                  </td>
                  <!-- GASTOS -->
                  <td class="td-num" data-label="Gastos">
                    <span class="camp-val-main">{fmtSpendDisplay(c.spend)}</span>
                    <span class="camp-val-sub">{fmtSpendSub(c.spend)}</span>
                  </td>
                  <td class="td-num" data-label="Impressões"><span class="camp-val-main">{fmtNum(c.impressions)}</span></td>
                  {#if campView === 'full'}
                    <td class="td-num" data-label="Alcance"><span class="camp-val-main">{fmtNum(c.reach)}</span></td>
                    <td class="td-num" data-label="Frequência"><span class="camp-val-main">{c.frequency ? c.frequency.toFixed(2) : '—'}</span></td>
                  {/if}
                  <td class="td-num" data-label="CTR">
                    <span class="camp-val-main {c.ctr > 2 ? 'camp-val-green' : c.ctr < 1 ? 'camp-val-red' : ''}">{fmtPct2(c.ctr)}</span>
                    <span class="camp-val-sub">Por impressões</span>
                  </td>
                  <td class="td-num" data-label="Cliques no link">
                    <span class="camp-val-main">{fmtNum(c.clicks)}</span>
                    <span class="camp-val-sub">Total</span>
                  </td>
                  <td class="td-num" data-label="CPC">
                    <span class="camp-val-main">{fmtSpendDisplay(c.cpc)}</span>
                    <span class="camp-val-sub">Por clique</span>
                  </td>
                  {#if campView !== 'essential'}
                    <td class="td-num" data-label="Visualizações da página">
                      <span class="camp-val-main">{fmtNum(c.landingPageViews || 0)}</span>
                      <span class="camp-val-sub">Total</span>
                    </td>
                    <td class="td-num" data-label="Finalizações de compra">
                      <span class="camp-val-main">{fmtNum(c.initiateCheckout || 0)}</span>
                      <span class="camp-val-sub">Total</span>
                    </td>
                  {/if}
                  {#if campView === 'full'}
                    <td class="td-num" data-label="Add to cart">
                      <span class="camp-val-main">{fmtNum(c.addToCart || 0)}</span>
                      <span class="camp-val-sub">Total</span>
                    </td>
                  {/if}
                  <td class="td-num" data-label="ROAS">
                    <span class="camp-val-main camp-val-green">{c.roas ? c.roas.toFixed(2) : '—'}</span>
                    <span class="camp-val-sub">Retorno</span>
                  </td>
                  <td class="td-num" data-label="Resultados">
                    <span class="camp-val-main camp-val-green">{fmtNum(c.purchases || 0)}</span>
                    <span class="camp-val-sub">Compras</span>
                  </td>
                  <td class="td-num" data-label="Custo por resultado">
                    <span class="camp-val-main">{c.cpa > 0 ? fmtSpendDisplay(c.cpa) : '—'}</span>
                    <span class="camp-val-sub">Por compra</span>
                  </td>
                  {#if campView === 'full'}
                    <td class="td-num" data-label="CPM">
                      <span class="camp-val-main">{fmtSpendDisplay(c.cpm / 1000)}</span>
                      <span class="camp-val-sub">Por mil</span>
                    </td>
                  {/if}
                </tr>
                {/each}
              </tbody>
              <tfoot>
                <tr class="camp-tr-total">
                  <td></td>
                  <td class="td-name"><strong>{fbCampaigns.length} campanha{fbCampaigns.length !== 1 ? 's' : ''}</strong></td>
                  <td class="td-num">—</td>
                  <td class="td-num"><strong>{fmtSpendDisplay(campTotalSpend)}</strong><span class="camp-val-sub">{fmtSpendSub(campTotalSpend)}</span></td>
                  <td class="td-num"><strong>{fmtNum(campTotalImpr)}</strong></td>
                  {#if campView === 'full'}<td class="td-num">—</td><td class="td-num">—</td>{/if}
                  <td class="td-num"><strong>{campTotalImpr > 0 ? (campTotalClicks / campTotalImpr * 100).toFixed(2) + '%' : '—'}</strong><span class="camp-val-sub">Por impressões</span></td>
                  <td class="td-num"><strong>{fmtNum(campTotalClicks)}</strong><span class="camp-val-sub">Total</span></td>
                  <td class="td-num"><strong>{campTotalClicks > 0 ? fmtSpendDisplay(campTotalSpend / campTotalClicks) : '—'}</strong><span class="camp-val-sub">Por clique</span></td>
                  {#if campView !== 'essential'}
                    <td class="td-num"><strong>{fmtNum(campTotalLPV)}</strong><span class="camp-val-sub">Total</span></td>
                    <td class="td-num"><strong>{fmtNum(campTotalIC)}</strong><span class="camp-val-sub">Total</span></td>
                  {/if}
                  {#if campView === 'full'}<td class="td-num"><strong>{fmtNum(campTotalATC)}</strong><span class="camp-val-sub">Total</span></td>{/if}
                  <td class="td-num"><strong>{campTotalSpend > 0 ? (campTotalRev / campTotalSpend).toFixed(2) : '—'}</strong><span class="camp-val-sub">Média</span></td>
                  <td class="td-num"><strong>{fmtNum(campTotalPurch)}</strong><span class="camp-val-sub">Compras</span></td>
                  <td class="td-num"><strong>{campTotalPurch > 0 ? fmtSpendDisplay(campTotalSpend / campTotalPurch) : '—'}</strong><span class="camp-val-sub">Por compra</span></td>
                  {#if campView === 'full'}<td class="td-num">—</td>{/if}
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

      {#if activeTab === 'contas'}
      <div class="tab-content">
        <div class="contas-header">
          <h2 class="contas-title">Contas de Anúncios</h2>
          <p class="contas-subtitle">Conecte o Facebook, gerencie permissões e veja todos os Business Managers e contas que você tem acesso.</p>
        </div>

        <!-- Card 1: Conexao Facebook -->
        <div class="contas-card">
          <div class="contas-card-head">
            <span class="contas-card-icon" style="background:#1877f2">f</span>
            <div>
              <h3 class="contas-card-title">Conexão com Facebook</h3>
              <p class="contas-card-desc">
                {#if tokenStatus?.kind === 'oauth'}
                  Conectado via OAuth. Token renova automaticamente.
                {:else if tokenStatus?.kind === 'manual'}
                  Token manual salvo. Conecte via OAuth para renovação automática.
                {:else}
                  Use o login do Facebook para acesso completo a todos os seus BMs.
                {/if}
              </p>
            </div>
          </div>

          {#if tokenStatus}
            <div class="contas-status-grid">
              <div class="contas-status-cell">
                <span class="contas-status-label">Status</span>
                <span class="contas-status-val">
                  {#if tokenStatus.kind === 'oauth'}
                    <span class="dot-green"></span> Conectado (OAuth)
                  {:else if tokenStatus.source === 'disk'}
                    <span class="dot-yellow"></span> Token manual
                  {:else}
                    <span class="dot-red"></span> Não conectado
                  {/if}
                </span>
              </div>
              {#if tokenStatus.expiresAt && tokenStatus.daysLeft !== null}
                <div class="contas-status-cell">
                  <span class="contas-status-label">Expira em</span>
                  <span class="contas-status-val" class:warn={tokenStatus.needsRefresh}>
                    {tokenStatus.daysLeft! > 0
                      ? `${tokenStatus.daysLeft} dias`
                      : 'Expirado'}
                  </span>
                </div>
              {/if}
              <div class="contas-status-cell">
                <span class="contas-status-label">Token</span>
                <span class="contas-status-val mono">{tokenStatus.masked}</span>
              </div>
              {#if tokenStatus.updatedAt}
                <div class="contas-status-cell">
                  <span class="contas-status-label">Atualizado</span>
                  <span class="contas-status-val">{new Date(tokenStatus.updatedAt).toLocaleDateString('pt-BR')}</span>
                </div>
              {/if}
            </div>
          {/if}

          <div class="contas-actions">
            {#if tokenStatus?.oauthConfigured}
              <button class="account-token-oauth" onclick={openOAuthPopup} disabled={oauthInProgress}>
                <span class="oauth-icon">f</span>
                {oauthInProgress ? 'Aguardando autorização…' : (tokenStatus.kind === 'oauth' ? 'Reconectar com Facebook' : 'Conectar com Facebook')}
              </button>
              {#if tokenStatus.kind === 'oauth'}
                <button class="account-token-refresh" onclick={refreshTokenNow} disabled={refreshingToken}>
                  {refreshingToken ? 'Renovando…' : '↻ Renovar agora'}
                </button>
              {/if}
              {#if tokenStatus.source === 'disk'}
                <button class="account-token-clear" onclick={clearStoredToken}>Desconectar</button>
              {/if}
            {:else}
              <div class="account-token-oauth-disabled">
                ⚠ OAuth não configurado. Defina <code>FB_APP_ID</code> e <code>FB_APP_SECRET</code> nas env vars do Railway.
              </div>
            {/if}
          </div>

          {#if tokenSuccessMsg}<div class="account-token-success">{tokenSuccessMsg}</div>{/if}
          {#if tokenError}<div class="account-menu-error">{tokenError}</div>{/if}

          <details class="contas-advanced">
            <summary>Avançado — colar token manual ou diagnosticar</summary>
            <div class="contas-advanced-body">
              <textarea
                class="account-token-input"
                placeholder="Cole um User Access Token do Facebook (começa com EAA...)"
                bind:value={tokenInput}
                rows="3"
              ></textarea>
              <div class="account-token-actions">
                <button class="account-token-save" onclick={saveToken} disabled={tokenSaving || !tokenInput.trim()}>
                  {tokenSaving ? 'Validando…' : 'Salvar token manual'}
                </button>
                <button class="account-token-debug" onclick={runDebug} disabled={debugLoading}>
                  {debugLoading ? '…' : '🔍 Diagnosticar permissões'}
                </button>
              </div>
              {#if fbDebug}
                <div class="account-token-debug-result">
                  {#if fbDebug.error}
                    <div class="account-menu-error">Erro: {fbDebug.error}</div>
                  {:else}
                    <div class="debug-section">
                      <strong>Diagnóstico:</strong>
                      {#each fbDebug.diagnosis as line}<div class="debug-line">{line}</div>{/each}
                    </div>
                    {#if fbDebug.permissions?.granted?.length}
                      <div class="debug-section">
                        <strong>Permissões:</strong> {fbDebug.permissions.granted.join(', ')}
                      </div>
                    {/if}
                  {/if}
                </div>
              {/if}
            </div>
          </details>
        </div>

        <!-- Card 2: BMs e contas -->
        <div class="contas-card">
          <div class="contas-card-head">
            <span class="contas-card-icon" style="background:#02a95c">⊞</span>
            <div style="flex:1">
              <h3 class="contas-card-title">Business Managers e Contas ({fbAccounts.length})</h3>
              <p class="contas-card-desc">
                {fbBusinesses.length} BM{fbBusinesses.length === 1 ? '' : 's'} · {fbAccounts.length} conta{fbAccounts.length === 1 ? '' : 's'} acessíveis
              </p>
            </div>
            <button class="account-refresh contas-refresh" onclick={() => loadFbAccounts(true)} disabled={fbAccountsLoading}>
              {fbAccountsLoading ? '…' : '↻ Atualizar'}
            </button>
          </div>

          {#if fbAccountsError}
            <div class="account-menu-error contas-error">⚠ {fbAccountsError}</div>
          {/if}

          {#if !fbAccounts.length && !fbAccountsLoading}
            <div class="contas-empty">
              <p>Nenhuma conta encontrada.</p>
              <p>Conecte-se ao Facebook acima para puxar todas as suas contas e BMs.</p>
            </div>
          {/if}

          <div class="contas-bm-list">
            {#each fbAccountsGrouped as group (group.id)}
              <div class="contas-bm-block">
                <div class="contas-bm-head">
                  <span class="contas-bm-icon">{group.id === '__personal__' ? '👤' : '🏢'}</span>
                  <span class="contas-bm-name">{group.name}</span>
                  <span class="contas-bm-count">{group.accounts.length} conta{group.accounts.length === 1 ? '' : 's'}</span>
                </div>
                <table class="contas-bm-table">
                  <thead>
                    <tr>
                      <th>Conta</th>
                      <th>ID</th>
                      <th>Moeda</th>
                      <th>Status</th>
                      <th class="num">Gasto lifetime</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {#each group.accounts as acc (acc.id)}
                      <tr class:active-row={acc.id === fbAccountId}>
                        <td class="contas-acc-name">{acc.name}</td>
                        <td class="contas-acc-id mono">{acc.id}</td>
                        <td>{acc.currency}</td>
                        <td>
                          <span class="contas-acc-status status-{acc.status}">{acc.status}</span>
                        </td>
                        <td class="num">
                          {#if acc.amountSpent > 0}
                            {acc.currency} {acc.amountSpent.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                          {:else}—{/if}
                        </td>
                        <td>
                          {#if acc.id === fbAccountId}
                            <span class="contas-acc-current">✓ Selecionada</span>
                          {:else if acc.statusCode === 1}
                            <button class="contas-acc-select" onclick={() => selectFbAccount(acc.id)}>Selecionar</button>
                          {/if}
                        </td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            {/each}
          </div>
        </div>
      </div><!-- /tab-content contas -->
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
  .nav-icon {
    font-size: 1rem; width: 18px; text-align: center;
    font-variant-emoji: text; /* forca modo texto = monocromatico */
  }
  /* Icone "f" de facebook em campanhas — bold italic/serif (vira tipo logo) */
  .nav-item[data-tab="campanhas"] .nav-icon {
    font-family: Georgia, 'Times New Roman', serif;
    font-weight: 700; font-style: italic;
    font-size: 1.1rem;
  }
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
  .topbar-left {
    display: flex; align-items: center; gap: 12px;
    flex-wrap: wrap; flex: 1 1 auto; min-width: 0;
  }
  .page-title {
    margin: 0; font-size: 1.5rem; font-weight: 700;
    letter-spacing: -0.025em; text-transform: capitalize;
    line-height: 1.2;
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
    padding: 6px 16px; border-radius: 8px; font-size: 0.8125rem; font-weight: 600;
    font-family: inherit; cursor: pointer; transition: background 0.15s, opacity 0.15s;
    white-space: nowrap;
  }
  /* Status inline na topbar-left (sem o botao Atualizar) */
  .status-inline { display: inline-flex; align-items: center; gap: 6px; }
  /* Botoes que vivem dentro do topbar-right */
  .topbar-customize, .topbar-update {
    flex-shrink: 0;
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
    gap: 16px; margin-bottom: 16px; align-items: stretch;
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

  /* Card Online Agora (PC) — compacto pra bater altura dos outros cards */
  .kpi-online-hero {
    position: relative;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    margin: 4px 0 2px;
    padding: 4px 0 0;
  }
  .kpi-online-number {
    font-family: 'JetBrains Mono', ui-monospace, monospace;
    font-size: 2rem; font-weight: 700; letter-spacing: -0.03em;
    color: #02a95c;
    line-height: 1;
    /* Glow puro no numero — sem container box visivel */
    text-shadow:
      0 0 10px rgba(2,169,92,0.55),
      0 0 24px rgba(2,169,92,0.3),
      0 0 48px rgba(2,169,92,0.15);
  }
  .kpi-online-caption {
    color: #8b94a4; font-size: 0.65rem; margin-top: 4px;
    text-align: center; letter-spacing: 0.02em;
  }
  .kpi-breakdown-online {
    justify-content: center; gap: 6px; margin-top: 6px;
    flex-wrap: wrap;
  }
  .kpi-breakdown-online .kpi-chip {
    padding: 3px 7px;
    font-size: 0.7rem;
    background: linear-gradient(180deg, #11161d 0%, #0a0d12 100%);
  }
  .kpi-breakdown-online .kpi-chip strong { font-size: 0.7rem; }

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
      flex-direction: column; align-items: stretch; gap: 10px;
      margin-bottom: 16px;
      position: sticky; top: 0; z-index: 50;
      background: linear-gradient(180deg, #0a0d12 75%, rgba(10,13,18,0));
      padding-top: 8px; margin-top: -8px;
    }
    .topbar-left {
      display: flex; flex-wrap: wrap; align-items: center; gap: 8px; width: 100%;
    }
    /* Linha 1: ☰ + título compacto + ⌥ */
    .hamburger { order: 1; }
    .topbar-title-block {
      order: 2; flex: 1; min-width: 0;
      display: inline-flex; align-items: baseline; gap: 8px;
    }
    .page-title { font-size: 1.125rem; }
    .filters-toggle { order: 3; }
    .status { font-size: 0.75rem; }
    .status-text { white-space: nowrap; }
    .btn-update { padding: 5px 14px; font-size: 0.8125rem; }

    /* Linha 2 (mobile): seletores em scroll horizontal sem quebrar.
       IMPORTANTE: overflow-x: clip (em vez de auto) permite que dropdowns
       filhos com position:absolute apareçam pra fora verticalmente.
       Com 'auto', overflow-y vira hidden implicito e os dropdowns somem. */
    .topbar-selectors {
      order: 4; width: 100%;
      display: flex; flex-wrap: nowrap;
      gap: 6px;
      overflow-x: auto;
      overflow-y: visible;        /* explicito: permite dropdown cair pra baixo */
      -webkit-overflow-scrolling: touch;
      scrollbar-width: none;
      padding-bottom: 2px;
    }
    .topbar-selectors::-webkit-scrollbar { display: none; }
    .selector-btn { padding: 7px 10px; font-size: 0.75rem; flex-shrink: 0; }
    .selector-value { font-size: 0.6875rem; padding: 1px 6px; }

    /* Dropdowns no mobile: position:fixed pra escapar do overflow do
       .topbar-selectors (que tem overflow-x: auto e corta o menu).
       Aparecem ANCORADOS no topo, logo abaixo dos botoes seletores. */
    .selector-menu {
      position: fixed !important;
      top: 100px;            /* abaixo da topbar (titulo + linha de seletores) */
      bottom: auto;
      left: 12px; right: 12px;
      width: auto; max-width: none;
      min-width: 0;
      z-index: 300;
      max-height: calc(100vh - 120px); overflow-y: auto;
      border-radius: 12px;
      padding: 6px;
      animation: dropdownIn 0.18s ease-out;
      box-shadow: 0 12px 40px rgba(0,0,0,0.6);
    }
    .selector-menu-item {
      padding: 12px 14px;     /* touch friendly */
      font-size: 0.9375rem;
    }
    .account-menu {
      position: fixed !important;
      top: 100px;
      bottom: auto;
      left: 12px; right: 12px;
      min-width: 0; max-width: none;
      max-height: calc(100vh - 120px);
      border-radius: 12px;
      animation: dropdownIn 0.18s ease-out;
      box-shadow: 0 12px 40px rgba(0,0,0,0.6);
    }
    @keyframes dropdownIn {
      from { opacity: 0; transform: translateY(-8px); }
      to { opacity: 1; transform: translateY(0); }
    }

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

    /* KPIs mobile — grid 2 colunas. Cards tem altura natural (compacta).
       ONLINE AGORA (kpi-live) ocupa span 2 = full width — assim nao
       sobra espaço vazio do amigo curto ao lado. */
    .kpi-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      grid-auto-flow: dense;
      gap: 10px;
      align-items: stretch;     /* cards da mesma LINHA com mesma altura */
    }
    .kpi-grid > .kpi {
      margin: 0;
      display: flex;
      flex-direction: column;
      width: auto;
      grid-column: span 1;
    }
    /* Cards que sao por natureza maiores ocupam 2 colunas no mobile */
    .kpi-grid > .kpi.kpi-live {
      grid-column: span 2;
    }
    .kpi-grid > .kpi.kpi-large {
      grid-column: span 2;
    }
    /* Mobile: esconde TODO sub-texto embaixo do valor
       (descricoes, conversoes EUR/USD, deltas). So fica label + valor. */
    .kpi-grid > .kpi .kpi-sub { display: none; }
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
    .kpi-grid { gap: 8px; }
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

  /* Alca de redimensionar — borda direita do card no modo edit */
  /* Alca de resize horizontal — borda direita INFERIOR do card
     pra nao conflitar visualmente com a alca de drag (canto superior). */
  .kpi-resize-handle {
    position: absolute; bottom: 6px; right: 6px;
    width: 28px; height: 28px;
    display: inline-flex; align-items: center; justify-content: center;
    background: rgba(2,169,92,0.18); border: 1px solid rgba(2,169,92,0.5);
    color: #02a95c; font-size: 0.95rem; line-height: 1;
    cursor: ew-resize; user-select: none;
    touch-action: none;
    -webkit-tap-highlight-color: transparent;
    border-radius: 8px;
    transition: background 0.15s;
    z-index: 3;
  }
  .kpi-resize-handle:hover, .kpi-resize-handle:active {
    background: rgba(2,169,92,0.35);
  }
  @media (max-width: 640px) {
    .kpi-resize-handle {
      width: 34px; height: 34px; font-size: 1.05rem;
      bottom: 6px; right: 6px;
    }
  }
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

  /* ── Cluster de seletores na topbar (estilo UTMfy/Hotmart) ── */
  .topbar-selectors {
    display: inline-flex; align-items: center; gap: 8px;
    flex-wrap: wrap;
  }
  .selector-wrap { position: relative; display: inline-block; }
  .selector-btn {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 8px 12px;
    background: #11161d; border: 1px solid #1f2630; border-radius: 10px;
    color: #c5cad3; font-family: inherit; font-size: 0.8125rem; font-weight: 500;
    cursor: pointer; transition: border-color 0.15s, background 0.15s;
    -webkit-tap-highlight-color: transparent;
    white-space: nowrap;
  }
  .selector-btn:hover { border-color: #2e3a4a; color: #e6e9ef; }
  .selector-btn.active { border-color: #02a95c; background: rgba(2,169,92,0.08); }
  .selector-icon { font-size: 0.9rem; opacity: 0.85; }
  .selector-label { color: #8b94a4; font-weight: 500; }
  .selector-btn.active .selector-label { color: #02a95c; }
  .selector-value {
    font-weight: 700; color: #02a95c;
    background: rgba(2,169,92,0.1); padding: 2px 8px; border-radius: 5px;
    font-size: 0.75rem;
  }
  .selector-chevron { font-size: 0.6rem; color: #6b7787; transition: transform 0.2s; }
  .selector-chevron.open { transform: rotate(180deg); }

  .selector-menu {
    position: absolute; top: calc(100% + 6px); left: 0;
    min-width: 200px;
    background: #0d1117; border: 1px solid #1f2630; border-radius: 12px;
    box-shadow: 0 12px 32px rgba(0,0,0,0.5);
    z-index: 200; padding: 5px;
    display: flex; flex-direction: column; gap: 2px;
  }
  .currency-menu { min-width: 180px; }
  .period-menu { min-width: 200px; }
  .selector-menu-item {
    display: flex; align-items: center; gap: 10px;
    padding: 9px 12px;
    background: transparent; border: none; border-radius: 7px;
    color: #c5cad3; font-family: inherit; font-size: 0.8125rem;
    cursor: pointer; text-align: left;
    transition: background 0.12s, color 0.12s;
  }
  .selector-menu-item:hover { background: #141a23; color: #e6e9ef; }
  .selector-menu-item.active {
    background: rgba(2,169,92,0.12);
    color: #02a95c; font-weight: 600;
  }
  .selector-menu-symbol {
    font-family: 'JetBrains Mono', monospace; font-size: 0.9rem; font-weight: 700;
    min-width: 18px; text-align: center;
  }
  .selector-menu-text { font-weight: 600; flex: 1; }
  .selector-menu-hint { color: #6b7787; font-size: 0.75rem; }
  .selector-menu-item.active .selector-menu-hint { color: rgba(2,169,92,0.6); }

  /* Legado — usado em outras tabs (Ads, Campanhas) */
  .period-label-btn { /* alias do selector-btn */ }

  /* ── Seletor de Conta de Anúncio (estilo UTMfy) ── */
  .account-switch { position: relative; display: inline-block; }
  .account-btn {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 8px 12px;
    background: #11161d; border: 1px solid #1f2630; border-radius: 10px;
    color: #c5cad3; font-family: inherit; font-size: 0.8125rem; font-weight: 500;
    cursor: pointer; transition: border-color 0.15s, background 0.15s;
    -webkit-tap-highlight-color: transparent;
    max-width: 240px;
  }
  .account-btn:hover { border-color: #2e3a4a; color: #e6e9ef; }
  .account-btn.active { border-color: #02a95c; background: rgba(2,169,92,0.08); }
  .account-btn-icon { font-size: 0.875rem; color: #02a95c; }
  .account-btn-label {
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    max-width: 140px; font-weight: 600;
  }
  .account-btn-currency {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.6875rem; font-weight: 700;
    color: #02a95c; background: rgba(2,169,92,0.12);
    padding: 2px 6px; border-radius: 4px;
  }
  .account-chevron { font-size: 0.6rem; color: #6b7787; transition: transform 0.2s; }
  .account-chevron.open { transform: rotate(180deg); }

  .account-menu {
    position: absolute; top: calc(100% + 6px); right: 0;
    min-width: 340px; max-width: 420px;
    background: #0d1117; border: 1px solid #1f2630; border-radius: 12px;
    box-shadow: 0 12px 32px rgba(0,0,0,0.5);
    z-index: 200; padding: 6px;
    max-height: 480px; overflow: hidden;
    display: flex; flex-direction: column;
  }
  .account-menu-head {
    display: flex; align-items: center; justify-content: space-between;
    padding: 8px 10px 10px;
    font-size: 0.6875rem; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.06em; color: #6b7787;
    border-bottom: 1px solid #1a1f28;
    margin-bottom: 6px;
  }
  .account-refresh {
    background: transparent; border: 1px solid #1f2630; border-radius: 6px;
    color: #8b94a4; padding: 3px 8px; cursor: pointer; font-size: 0.75rem;
    transition: border-color 0.15s, color 0.15s;
  }
  .account-refresh:hover { border-color: #02a95c; color: #02a95c; }
  .account-refresh:disabled { opacity: 0.5; cursor: not-allowed; }
  .account-menu-error {
    font-size: 0.75rem; color: #f87171;
    padding: 6px 10px; margin-bottom: 4px;
    background: rgba(248,113,113,0.08); border-radius: 6px;
  }
  .account-menu-empty {
    font-size: 0.8125rem; color: #6b7787;
    padding: 16px 10px; text-align: center;
  }
  .account-menu-search-wrap { padding: 4px 6px 6px; }
  .account-menu-search {
    width: 100%;
    background: #0a0d12; border: 1px solid #1f2630; border-radius: 8px;
    color: #e6e9ef; font-family: inherit; font-size: 0.8125rem;
    padding: 8px 12px;
    transition: border-color 0.15s;
  }
  .account-menu-search::placeholder { color: #6b7787; }
  .account-menu-search:focus { outline: none; border-color: #02a95c; }

  .account-menu-list { overflow-y: auto; flex: 1; }

  /* Dropdown compacto (topbar) */
  .account-menu-compact .account-menu-item-flat {
    grid-template-columns: 1fr auto;
    padding: 8px 10px;
  }
  .account-menu-manage {
    display: flex; align-items: center; justify-content: space-between;
    width: 100%; padding: 10px 12px;
    background: transparent; border: none; border-top: 1px solid #1a1f28;
    color: #02a95c; font-family: inherit; font-size: 0.75rem; font-weight: 600;
    cursor: pointer; transition: background 0.15s;
  }
  .account-menu-manage:hover { background: #141a23; }

  /* ─── Aba CONTAS ─── */
  .contas-header { margin-bottom: 24px; }
  .contas-title { font-size: 1.5rem; font-weight: 700; margin: 0 0 4px; color: #e6e9ef; }
  .contas-subtitle { color: #8b94a4; font-size: 0.875rem; margin: 0; max-width: 620px; line-height: 1.5; }

  .contas-card {
    background: #11151c;
    border: 1px solid #1f2630;
    border-radius: 12px;
    padding: 20px 24px;
    margin-bottom: 18px;
  }
  .contas-card-head {
    display: flex; align-items: flex-start; gap: 14px;
    margin-bottom: 16px;
  }
  .contas-card-icon {
    width: 40px; height: 40px; border-radius: 10px;
    display: inline-flex; align-items: center; justify-content: center;
    color: #fff; font-family: Georgia, serif; font-weight: 900; font-size: 1.25rem;
    flex-shrink: 0;
  }
  .contas-card-title { margin: 0 0 4px; font-size: 1rem; font-weight: 700; color: #e6e9ef; }
  .contas-card-desc { margin: 0; font-size: 0.8125rem; color: #8b94a4; line-height: 1.5; }

  .contas-status-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 12px;
    padding: 14px 16px;
    background: #0a0d12;
    border: 1px solid #1a1f28;
    border-radius: 8px;
    margin-bottom: 14px;
  }
  .contas-status-cell { display: flex; flex-direction: column; gap: 3px; }
  .contas-status-label {
    font-size: 0.6875rem; text-transform: uppercase; letter-spacing: 0.05em;
    color: #6b7787; font-weight: 600;
  }
  .contas-status-val {
    font-size: 0.8125rem; color: #e6e9ef; font-weight: 600;
    display: inline-flex; align-items: center; gap: 6px;
  }
  .contas-status-val.warn { color: #fbbf24; }
  .contas-status-val.mono {
    font-family: 'JetBrains Mono', monospace; font-size: 0.75rem; font-weight: 500;
  }
  .dot-green, .dot-yellow, .dot-red {
    display: inline-block; width: 8px; height: 8px; border-radius: 50%;
  }
  .dot-green { background: #02a95c; box-shadow: 0 0 0 3px rgba(2,169,92,0.15); }
  .dot-yellow { background: #fbbf24; box-shadow: 0 0 0 3px rgba(251,191,36,0.15); }
  .dot-red { background: #dc2626; box-shadow: 0 0 0 3px rgba(220,38,38,0.15); }

  .contas-actions {
    display: flex; flex-wrap: wrap; gap: 10px;
    align-items: center;
  }
  .contas-actions .account-token-oauth { flex: 1 1 240px; max-width: 320px; }

  .contas-advanced { margin-top: 18px; border-top: 1px solid #1a1f28; padding-top: 14px; }
  .contas-advanced summary {
    cursor: pointer; font-size: 0.8125rem; color: #8b94a4; padding: 4px 0;
  }
  .contas-advanced summary:hover { color: #e6e9ef; }
  .contas-advanced-body { display: flex; flex-direction: column; gap: 10px; margin-top: 12px; }

  .contas-refresh { margin-left: auto; flex-shrink: 0; padding: 6px 12px; font-size: 0.75rem; }
  .contas-error { margin-bottom: 12px; }
  .contas-empty {
    text-align: center; padding: 30px 20px;
    color: #6b7787; font-size: 0.875rem; line-height: 1.6;
  }
  .contas-empty p { margin: 0 0 4px; }

  /* Listagem BMs */
  .contas-bm-list { display: flex; flex-direction: column; gap: 20px; margin-top: 8px; }
  .contas-bm-block { background: #0a0d12; border: 1px solid #1a1f28; border-radius: 8px; overflow: hidden; }
  .contas-bm-head {
    display: flex; align-items: center; gap: 10px;
    padding: 10px 14px;
    background: #11151c;
    border-bottom: 1px solid #1a1f28;
  }
  .contas-bm-icon { font-size: 1rem; }
  .contas-bm-name { font-weight: 700; color: #e6e9ef; font-size: 0.875rem; flex: 1; }
  .contas-bm-count {
    font-size: 0.6875rem; color: #6b7787;
    background: #0a0d12; padding: 3px 8px; border-radius: 10px;
    font-weight: 600;
  }
  .contas-bm-table {
    width: 100%; border-collapse: collapse;
    font-size: 0.8125rem;
  }
  .contas-bm-table th {
    text-align: left; padding: 8px 12px;
    color: #6b7787; font-weight: 600; font-size: 0.6875rem;
    text-transform: uppercase; letter-spacing: 0.05em;
    border-bottom: 1px solid #1a1f28;
    background: #0d1117;
  }
  .contas-bm-table th.num { text-align: right; }
  .contas-bm-table td {
    padding: 10px 12px;
    border-bottom: 1px solid #11151c;
    color: #c5cad3;
    vertical-align: middle;
  }
  .contas-bm-table td.num { text-align: right; }
  .contas-bm-table tr:last-child td { border-bottom: none; }
  .contas-bm-table tr.active-row { background: rgba(2,169,92,0.06); }
  .contas-acc-name { font-weight: 600; color: #e6e9ef; }
  .contas-acc-id { font-size: 0.75rem; color: #8b94a4; }
  .mono { font-family: 'JetBrains Mono', monospace; }
  .contas-acc-status {
    font-size: 0.6875rem; padding: 2px 8px; border-radius: 4px;
    text-transform: uppercase; letter-spacing: 0.03em; font-weight: 700;
  }
  .contas-acc-status.status-active { background: rgba(2,169,92,0.12); color: #02a95c; }
  .contas-acc-status.status-disabled { background: rgba(220,38,38,0.12); color: #dc2626; }
  .contas-acc-status.status-pending_review,
  .contas-acc-status.status-pending_settlement,
  .contas-acc-status.status-in_grace_period { background: rgba(251,191,36,0.12); color: #fbbf24; }
  .contas-acc-status.status-closed,
  .contas-acc-status.status-pending_closure { background: rgba(107,119,135,0.12); color: #6b7787; }
  .contas-acc-current {
    font-size: 0.75rem; color: #02a95c; font-weight: 600;
  }
  .contas-acc-select {
    background: transparent; border: 1px solid #2a3340;
    color: #c5cad3; font-family: inherit; font-size: 0.75rem;
    padding: 5px 12px; border-radius: 6px;
    cursor: pointer; transition: all 0.15s;
  }
  .contas-acc-select:hover { border-color: #02a95c; color: #02a95c; }

  .account-menu-group { margin-bottom: 4px; }
  .account-menu-group:last-child { margin-bottom: 0; }
  .account-menu-group-head {
    display: flex; align-items: center; gap: 8px;
    padding: 8px 10px 6px;
    font-size: 0.6875rem; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.06em;
    color: #8b94a4;
    position: sticky; top: 0;
    background: #0d1117;
    z-index: 2;
  }
  .account-menu-group-icon { font-size: 0.875rem; opacity: 0.8; }
  .account-menu-group-name {
    flex: 1;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .account-menu-group-count {
    font-family: 'JetBrains Mono', monospace; color: #6b7787;
    background: #11161d; padding: 1px 6px; border-radius: 4px;
    font-size: 0.625rem;
  }
  .account-menu-item-spent {
    font-family: 'JetBrains Mono', monospace; font-weight: 600;
    color: #c5cad3;
  }

  /* ── Painel de token FB ── */
  .account-token-section {
    border-top: 1px solid #1a1f28;
    border-bottom: 1px solid #1a1f28;
    margin: 4px 0;
  }
  .account-token-toggle {
    display: flex; align-items: center; gap: 8px;
    width: 100%; padding: 10px 12px;
    background: transparent; border: none;
    color: #c5cad3; font-family: inherit; font-size: 0.8125rem; font-weight: 600;
    cursor: pointer; text-align: left;
    transition: background 0.15s;
  }
  .account-token-toggle:hover { background: #141a23; }
  .account-token-toggle > span:first-child { flex: 1; }
  .account-token-source {
    font-size: 0.6875rem; font-weight: 500;
    color: #6b7787;
    background: #11161d;
    padding: 2px 8px; border-radius: 4px;
  }
  .account-token-body {
    padding: 4px 10px 12px;
    display: flex; flex-direction: column; gap: 8px;
  }
  .account-token-info {
    display: flex; align-items: center; justify-content: space-between; gap: 8px;
    font-size: 0.75rem; color: #8b94a4;
  }
  .account-token-info code {
    font-family: 'JetBrains Mono', monospace;
    color: #02a95c; background: rgba(2,169,92,0.08);
    padding: 1px 6px; border-radius: 4px;
  }
  .account-token-clear {
    background: transparent; border: 1px solid #2a3340;
    color: #f87171; font-size: 0.6875rem;
    padding: 4px 10px; border-radius: 6px;
    cursor: pointer; transition: background 0.15s;
  }
  .account-token-clear:hover { background: rgba(248,113,113,0.08); }

  /* ── Expiry badge ── */
  .account-token-expiry {
    font-size: 0.75rem; color: #02a95c;
    padding: 6px 10px;
    background: rgba(2,169,92,0.08); border-radius: 6px;
    border: 1px solid rgba(2,169,92,0.2);
  }
  .account-token-expiry.warn {
    color: #fbbf24;
    background: rgba(251,191,36,0.08);
    border-color: rgba(251,191,36,0.25);
  }
  .account-token-expiry strong { font-weight: 700; }

  /* ── OAuth button (estilo botao FB) ── */
  .account-token-oauth {
    display: flex; align-items: center; justify-content: center; gap: 10px;
    background: #1877f2;
    color: #fff !important;
    text-decoration: none;
    border-radius: 8px;
    padding: 10px 14px;
    font-weight: 600; font-size: 0.875rem;
    transition: background 0.15s;
  }
  .account-token-oauth:hover { background: #166fe5; }
  .account-token-oauth .oauth-icon {
    width: 22px; height: 22px; border-radius: 4px;
    background: #fff; color: #1877f2;
    display: inline-flex; align-items: center; justify-content: center;
    font-family: Georgia, serif; font-weight: 900; font-size: 1.1rem;
    line-height: 1;
  }
  .account-token-refresh {
    background: transparent; border: 1px dashed #2a3340;
    color: #8b94a4; font-family: inherit; font-size: 0.75rem;
    padding: 6px 10px; border-radius: 6px;
    cursor: pointer; transition: all 0.15s;
  }
  .account-token-refresh:hover:not(:disabled) { color: #02a95c; border-color: #02a95c; }
  .account-token-refresh:disabled { opacity: 0.5; cursor: not-allowed; }
  .account-token-oauth-disabled {
    font-size: 0.75rem; color: #fbbf24;
    background: rgba(251,191,36,0.08);
    border: 1px solid rgba(251,191,36,0.25);
    padding: 8px 10px; border-radius: 6px;
    line-height: 1.4;
  }
  .account-token-oauth-disabled code {
    background: rgba(0,0,0,0.3); padding: 1px 4px; border-radius: 3px;
    font-family: 'JetBrains Mono', monospace; font-size: 0.6875rem;
  }
  .account-token-divider {
    display: flex; align-items: center; gap: 8px;
    color: #5a6577; font-size: 0.6875rem;
    text-transform: uppercase; letter-spacing: 0.05em;
    margin: 4px 0;
  }
  .account-token-divider::before,
  .account-token-divider::after {
    content: ''; flex: 1; height: 1px; background: #1f2630;
  }

  .account-token-input {
    width: 100%; box-sizing: border-box;
    background: #0a0d12; border: 1px solid #1f2630; border-radius: 8px;
    color: #e6e9ef; font-family: 'JetBrains Mono', monospace; font-size: 0.6875rem;
    padding: 8px 10px; resize: vertical; min-height: 60px;
    transition: border-color 0.15s;
  }
  .account-token-input:focus { outline: none; border-color: #02a95c; }
  .account-token-actions {
    display: flex; gap: 8px;
  }
  .account-token-save {
    flex: 1;
    background: linear-gradient(180deg, #02b864 0%, #02a95c 100%);
    color: #fff; border: none;
    padding: 8px 12px; border-radius: 8px;
    font-family: inherit; font-size: 0.8125rem; font-weight: 600;
    cursor: pointer; transition: opacity 0.15s;
  }
  .account-token-save:hover:not(:disabled) { opacity: 0.92; }
  .account-token-save:disabled { opacity: 0.4; cursor: not-allowed; }
  .account-token-debug {
    background: transparent; border: 1px solid #2a3340;
    color: #c5cad3; font-family: inherit; font-size: 0.8125rem;
    padding: 8px 12px; border-radius: 8px;
    cursor: pointer; transition: border-color 0.15s;
  }
  .account-token-debug:hover:not(:disabled) { border-color: #02a95c; color: #02a95c; }
  .account-token-debug:disabled { opacity: 0.5; cursor: not-allowed; }
  .account-token-success {
    font-size: 0.75rem; color: #02a95c;
    padding: 6px 10px;
    background: rgba(2,169,92,0.08); border-radius: 6px;
  }
  .account-token-help {
    font-size: 0.75rem; color: #8b94a4;
  }
  .account-token-help summary {
    cursor: pointer; padding: 6px 0;
    color: #6b7787; user-select: none;
  }
  .account-token-help summary:hover { color: #c5cad3; }
  .account-token-help ol {
    margin: 6px 0 0; padding-left: 22px;
    display: flex; flex-direction: column; gap: 4px;
    line-height: 1.4;
  }
  .account-token-help a { color: #02a95c; text-decoration: none; }
  .account-token-help a:hover { text-decoration: underline; }
  .account-token-help code {
    font-family: 'JetBrains Mono', monospace; font-size: 0.6875rem;
    background: #11161d; padding: 1px 5px; border-radius: 3px;
    color: #c5cad3;
  }
  .account-token-debug-result {
    display: flex; flex-direction: column; gap: 8px;
    font-size: 0.75rem; color: #c5cad3;
    background: #0a0d12; border: 1px solid #1a1f28; border-radius: 8px;
    padding: 10px;
  }
  .debug-section { display: flex; flex-direction: column; gap: 4px; }
  .debug-section strong { color: #e6e9ef; font-size: 0.75rem; }
  .debug-line { padding-left: 4px; line-height: 1.4; }
  .debug-bm {
    display: flex; align-items: center; justify-content: space-between; gap: 8px;
    padding: 4px 8px;
    background: #11161d; border-radius: 5px;
    font-size: 0.6875rem;
  }
  .debug-bm-stats {
    font-family: 'JetBrains Mono', monospace;
    color: #02a95c; font-weight: 600;
  }
  .account-menu-item {
    display: flex; flex-direction: column; gap: 4px;
    width: 100%; text-align: left;
    padding: 10px 12px;
    background: transparent; border: 1px solid transparent; border-radius: 8px;
    color: #c5cad3; font-family: inherit;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
  }
  .account-menu-item:hover { background: #141a23; }
  .account-menu-item.active {
    background: rgba(2,169,92,0.1);
    border-color: rgba(2,169,92,0.35);
  }
  .account-menu-item.disabled { opacity: 0.55; }
  .account-menu-item-main {
    display: flex; align-items: baseline; justify-content: space-between; gap: 10px;
  }
  .account-menu-item-name {
    font-weight: 600; font-size: 0.875rem; color: #e6e9ef;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    flex: 1;
  }
  .account-menu-item.active .account-menu-item-name { color: #02a95c; }
  .account-menu-item-id {
    font-family: 'JetBrains Mono', monospace; font-size: 0.6875rem;
    color: #6b7787;
  }
  .account-menu-item-meta {
    display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
    font-size: 0.6875rem;
  }
  .account-menu-item-currency {
    font-family: 'JetBrains Mono', monospace; font-weight: 700;
    color: #8b94a4; background: #11161d;
    padding: 2px 6px; border-radius: 4px;
  }
  .account-menu-item-status {
    text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em;
    padding: 2px 6px; border-radius: 4px;
  }
  .account-menu-item-status.status-active { color: #02a95c; background: rgba(2,169,92,0.12); }
  .account-menu-item-status.status-disabled,
  .account-menu-item-status.status-closed,
  .account-menu-item-status.status-pending_closure { color: #f87171; background: rgba(248,113,113,0.1); }
  .account-menu-item-status.status-unsettled,
  .account-menu-item-status.status-pending_review,
  .account-menu-item-status.status-pending_settlement,
  .account-menu-item-status.status-in_grace_period { color: #fbbf24; background: rgba(251,191,36,0.1); }
  .account-menu-item-biz {
    color: #6b7787; font-style: italic;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    max-width: 140px;
  }

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
  .camp-status-dot.paused {
    background: #fbbf24;
    box-shadow: 0 0 0 3px rgba(251,191,36,0.15);
  }
  .camp-tr-paused { opacity: 0.65; }
  .camp-objective {
    display: block;
    font-size: 0.6875rem; color: #6b7787;
    text-transform: lowercase; margin-top: 2px;
  }

  /* Toggle de view */
  .camp-view-toggle {
    display: flex; align-items: center; gap: 6px;
    margin-bottom: 14px;
  }
  .camp-view-label {
    font-size: 0.75rem; color: #8b94a4; margin-right: 6px; font-weight: 600;
  }
  .camp-view-pill {
    background: #0d1117; border: 1px solid #1f2630;
    color: #c5cad3; font-family: inherit; font-size: 0.75rem;
    padding: 5px 12px; border-radius: 6px;
    cursor: pointer; transition: all 0.15s;
  }
  .camp-view-pill:hover { border-color: #2a3340; color: #e6e9ef; }
  .camp-view-pill.active {
    background: rgba(2,169,92,0.1);
    border-color: #02a95c;
    color: #02a95c;
  }

  /* Flash messages */
  .camp-flash {
    padding: 10px 14px; border-radius: 8px; font-size: 0.8125rem;
    margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between;
  }
  .camp-flash.success { background: rgba(2,169,92,0.08); color: #02a95c; border: 1px solid rgba(2,169,92,0.2); }
  .camp-flash.error { background: rgba(220,38,38,0.08); color: #f87171; border: 1px solid rgba(220,38,38,0.2); }
  .camp-flash button { background: none; border: none; color: inherit; cursor: pointer; font-size: 1rem; opacity: 0.7; }
  .camp-flash button:hover { opacity: 1; }

  /* Toggle ON/OFF estilo UTMfy */
  .th-toggle { width: 70px; text-align: center; }
  .td-toggle { width: 70px; text-align: center; }
  .camp-switch {
    background: none; border: none; cursor: pointer; padding: 4px;
    display: inline-block;
  }
  .camp-switch:disabled { cursor: not-allowed; opacity: 0.5; }
  .camp-switch-track {
    display: inline-block; position: relative;
    width: 38px; height: 22px;
    background: #2a3340;
    border-radius: 11px;
    transition: background 0.2s;
  }
  .camp-switch-thumb {
    position: absolute; top: 2px; left: 2px;
    width: 18px; height: 18px;
    background: #fff;
    border-radius: 50%;
    transition: transform 0.2s;
    box-shadow: 0 1px 3px rgba(0,0,0,0.2);
  }
  .camp-switch.active .camp-switch-track { background: #1877f2; }
  .camp-switch.active .camp-switch-thumb { transform: translateX(16px); }
  .camp-switch:hover:not(:disabled) .camp-switch-track {
    box-shadow: 0 0 0 3px rgba(24,119,242,0.15);
  }

  /* Orcamento clicavel */
  .td-budget { min-width: 130px; }
  .camp-budget-btn {
    background: transparent; border: 1px dashed transparent;
    color: inherit; cursor: pointer;
    padding: 6px 10px; border-radius: 6px;
    font-family: inherit; text-align: right;
    display: inline-flex; flex-direction: column; align-items: flex-end;
    transition: all 0.15s;
  }
  .camp-budget-btn:hover {
    border-color: #2a3340; background: #141a23;
  }
  .camp-budget-empty {
    color: #6b7787; font-size: 1.25rem; padding: 8px 14px;
  }
  .camp-edit-budget {
    display: inline-flex; align-items: center; gap: 4px;
    background: #0d1117; border: 1px solid #02a95c;
    border-radius: 6px; padding: 2px;
  }
  .camp-edit-budget-input {
    background: transparent; border: none; color: #e6e9ef;
    font-family: inherit; font-size: 0.8125rem;
    width: 70px; padding: 4px 6px; outline: none;
  }
  .camp-action-save {
    background: #02a95c; color: #fff; border: none;
    width: 24px; height: 24px; border-radius: 4px;
    cursor: pointer; font-size: 0.75rem; font-weight: 700;
  }
  .camp-action-save:hover:not(:disabled) { background: #029b54; }
  .camp-action-save:disabled { opacity: 0.5; cursor: not-allowed; }
  .camp-action-cancel {
    background: transparent; color: #8b94a4; border: 1px solid #2a3340;
    width: 24px; height: 24px; border-radius: 4px;
    cursor: pointer; font-size: 0.75rem;
  }
  .camp-action-cancel:hover { color: #f87171; border-color: #f87171; }
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
    /* ── Toggle view (Essencial/Funil/Tudo) compacto ── */
    .camp-view-toggle { flex-wrap: wrap; }
    .camp-view-pill { padding: 6px 10px; font-size: 0.6875rem; }

    /* ── Bars (distribuição) ── */
    .camp-bar-row { grid-template-columns: 1fr; gap: 4px; padding: 8px 0; }
    .camp-bar-label { font-size: 0.75rem; }

    /* ── Conta mobile: dropdown alinhado a esquerda ── */
    .account-btn { padding: 7px 10px; font-size: 0.75rem; max-width: 180px; }
    .account-btn-label { max-width: 90px; }
    .account-menu {
      left: 0; right: auto;
      min-width: 280px; max-width: calc(100vw - 24px);
      max-height: 70vh;
    }

    /* ════════════════════════════════════════════════════════════
       TABELA CAMPANHAS — vira CARDS no mobile
       Escopo apenas em .camp-utmfy-wrap pra nao afetar OUTRAS tabelas
       que tambem usam classe .camp-utmfy (ex: tabela de Receita).
       ════════════════════════════════════════════════════════════ */
    .camp-utmfy-wrap {
      border: none; background: transparent; padding: 0; overflow: visible;
    }
    .camp-utmfy-wrap .camp-utmfy,
    .camp-utmfy-wrap .camp-utmfy thead,
    .camp-utmfy-wrap .camp-utmfy tbody,
    .camp-utmfy-wrap .camp-utmfy tfoot,
    .camp-utmfy-wrap .camp-utmfy tr,
    .camp-utmfy-wrap .camp-utmfy td { display: block; width: 100%; }

    .camp-utmfy-wrap .camp-utmfy thead { display: none; }

    .camp-utmfy-wrap .camp-utmfy tr.camp-tr {
      background: #11151c;
      border: 1px solid #1f2630;
      border-radius: 12px;
      padding: 12px 14px;
      margin-bottom: 12px;
      box-shadow: 0 2px 6px rgba(0,0,0,0.15);
    }
    .camp-utmfy-wrap .camp-utmfy tr.camp-tr.camp-tr-alt { background: #11151c; }
    .camp-utmfy-wrap .camp-utmfy tr.camp-tr-paused { opacity: 0.7; }

    /* Header do card: toggle | nome ocupando 1ª linha */
    .camp-utmfy-wrap .camp-utmfy td.td-toggle {
      display: inline-flex; width: auto; vertical-align: middle;
      padding: 0; margin-right: 12px;
    }
    .camp-utmfy-wrap .camp-utmfy td.td-name {
      display: inline-flex; flex-direction: column;
      width: calc(100% - 60px); vertical-align: middle;
      padding: 0 0 12px 0;
      border-bottom: 1px solid #1a1f28;
      margin-bottom: 10px;
    }
    .camp-utmfy-wrap .camp-utmfy td.td-name .camp-name-txt {
      max-width: 100%; white-space: normal; overflow: visible;
      font-size: 0.9375rem; font-weight: 600;
    }
    .camp-utmfy-wrap .camp-utmfy td.td-name .camp-objective { margin-top: 4px; }

    /* Orcamento — card destacado embaixo do header */
    .camp-utmfy-wrap .camp-utmfy td.td-budget {
      display: flex; justify-content: space-between; align-items: center;
      padding: 10px 12px;
      background: rgba(24,119,242,0.08);
      border: 1px solid rgba(24,119,242,0.2);
      border-radius: 8px;
      margin-bottom: 12px;
      text-align: left;
    }
    .camp-utmfy-wrap .camp-utmfy td.td-budget::before {
      content: attr(data-label);
      font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em;
      color: #8b94a4; font-weight: 700;
      margin-right: auto; padding-right: 0;
    }
    .camp-utmfy-wrap .camp-utmfy td.td-budget .camp-budget-btn {
      flex-direction: row; gap: 6px; align-items: baseline;
      padding: 0; border: none;
    }
    .camp-utmfy-wrap .camp-utmfy td.td-budget .camp-budget-btn:hover { background: transparent; }
    .camp-utmfy-wrap .camp-utmfy td.td-budget .camp-val-sub { font-size: 0.75rem; }

    /* Demais células — linha "label  :  valor sub-label"
       ::before vai a esquerda com margin-right: auto.
       Spans (val-main + val-sub) ficam agrupados na direita. */
    .camp-utmfy-wrap .camp-utmfy td.td-num {
      display: flex; align-items: baseline; gap: 6px;
      padding: 8px 0;
      border-bottom: 1px solid #1a1f28;
      text-align: left;
    }
    .camp-utmfy-wrap .camp-utmfy td.td-num:last-child { border-bottom: none; }
    .camp-utmfy-wrap .camp-utmfy td.td-num::before {
      content: attr(data-label);
      font-size: 0.75rem; color: #8b94a4; font-weight: 500;
      letter-spacing: 0.01em;
      margin-right: auto;            /* empurra spans pra direita */
      padding-right: 12px;
      flex-shrink: 0;
    }
    .camp-utmfy-wrap .camp-utmfy td.td-num .camp-val-main {
      display: inline; font-size: 0.9375rem; font-weight: 700;
      color: #e6e9ef;
    }
    .camp-utmfy-wrap .camp-utmfy td.td-num .camp-val-sub {
      display: inline; font-size: 0.6875rem;
      color: #6b7787; font-weight: 500;
    }

    /* Footer totals — card destacado */
    .camp-utmfy-wrap .camp-utmfy tr.camp-tr-total {
      background: #0d1117;
      border: 1px solid #02a95c33;
      border-radius: 12px;
      padding: 12px 14px;
      margin-top: 6px;
    }
    .camp-utmfy-wrap .camp-utmfy tr.camp-tr-total td:first-child { display: none; }
    .camp-utmfy-wrap .camp-utmfy tr.camp-tr-total td.td-name {
      width: 100%; padding: 0 0 10px 0;
      border-bottom: 1px solid #1a2330; margin-bottom: 8px;
      font-size: 0.9375rem;
    }
    .camp-utmfy-wrap .camp-utmfy tr.camp-tr-total td.td-num {
      display: flex; justify-content: space-between;
      padding: 6px 0; border-bottom: 1px dashed #1a1f28;
    }

    /* Switch um pouco maior pra touch */
    .camp-switch-track { width: 44px; height: 26px; border-radius: 13px; }
    .camp-switch-thumb { width: 22px; height: 22px; top: 2px; left: 2px; }
    .camp-switch.active .camp-switch-thumb { transform: translateX(18px); }
  }

  @media (max-width: 480px) {
    .camp-view-label { display: none; }  /* economiza espaço em telas bem pequenas */
    .camp-view-pill { flex: 1; text-align: center; }
  }

  /* ════════════════════════════════════════════════════════════
     ABA CONTAS — mobile
     ════════════════════════════════════════════════════════════ */
  @media (max-width: 768px) {
    .contas-title { font-size: 1.25rem; }
    .contas-subtitle { font-size: 0.8125rem; }
    .contas-card { padding: 16px; border-radius: 10px; }
    .contas-card-head { flex-wrap: wrap; }
    .contas-card-head > div { flex: 1; min-width: 0; }
    .contas-refresh { width: 100%; margin-top: 8px; }
    .contas-status-grid { grid-template-columns: 1fr 1fr; gap: 10px; padding: 12px; }
    .contas-actions { flex-direction: column; align-items: stretch; }
    .contas-actions .account-token-oauth { flex: 1 1 100%; max-width: 100%; }

    /* Tabela BMs vira cards */
    .contas-bm-table thead { display: none; }
    .contas-bm-table, .contas-bm-table tbody, .contas-bm-table tr, .contas-bm-table td {
      display: block; width: 100%;
    }
    .contas-bm-table tr {
      padding: 12px 14px;
      border-bottom: 1px solid #1a1f28;
    }
    .contas-bm-table tr:last-child { border-bottom: none; }
    .contas-bm-table td {
      padding: 4px 0; text-align: left; border: none;
      display: flex; justify-content: space-between; align-items: center;
    }
    .contas-bm-table td.contas-acc-name {
      font-size: 0.9375rem;
      padding: 0 0 8px 0;
      border-bottom: 1px solid #1a1f28;
      margin-bottom: 8px;
      justify-content: flex-start;
    }
    .contas-bm-table td.contas-acc-id::before { content: 'ID'; color: #6b7787; font-size: 0.75rem; }
    .contas-bm-table td.num::before {
      content: 'Gasto lifetime'; color: #6b7787; font-size: 0.75rem;
    }
    .contas-bm-table td:nth-child(3)::before { content: 'Moeda'; color: #6b7787; font-size: 0.75rem; }
    .contas-bm-table td:nth-child(4)::before { content: 'Status'; color: #6b7787; font-size: 0.75rem; }
    .contas-bm-table td:last-child {
      padding-top: 8px; margin-top: 8px;
      border-top: 1px solid #1a1f28;
      justify-content: stretch;
    }
    .contas-bm-table td:last-child::before { content: none; }
    .contas-acc-select { width: 100%; padding: 10px; font-size: 0.875rem; }
  }

  /* ════════════════════════════════════════════════════════════
     TOPBAR mobile — polimento dos seletores ja com nowrap
     ════════════════════════════════════════════════════════════ */
  @media (max-width: 768px) {
    .selector-btn { padding: 7px 10px; font-size: 0.75rem; }
    .selector-label { display: none; }
    .selector-value { font-size: 0.75rem; }
  }

  /* Tablets (768-1200) — reduz fonte da tabela campanhas pra caber */
  @media (max-width: 1200px) and (min-width: 769px) {
    .camp-utmfy-wrap .camp-utmfy { font-size: 0.75rem; }
    .camp-utmfy-wrap .camp-utmfy th,
    .camp-utmfy-wrap .camp-utmfy td { padding: 10px 8px; }
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

  /* ─── Cleaner (Burlador Meta) ─── */
  .cleaner-wrap { max-width: 1200px; margin: 0 auto; }
  .cleaner-head { margin-bottom: 24px; }
  .cleaner-title {
    font-size: 1.5rem; font-weight: 600; color: #f0f4fa;
    margin: 0 0 6px;
  }
  .cleaner-sub {
    font-size: 0.875rem; color: #8b94a4; margin: 0; max-width: 720px; line-height: 1.5;
  }
  .cleaner-grid {
    display: grid; gap: 24px;
    grid-template-columns: 1fr 320px;
  }
  @media (max-width: 900px) {
    .cleaner-grid { grid-template-columns: 1fr; }
  }
  .cleaner-form {
    background: #0a0d12; border: 1px solid #1a1f28;
    border-radius: 12px; padding: 24px;
    display: flex; flex-direction: column; gap: 20px;
  }
  .cleaner-field { display: flex; flex-direction: column; gap: 8px; }
  .cleaner-label {
    font-size: 0.8125rem; color: #e0e5ed; font-weight: 500;
  }
  .cleaner-label em {
    font-style: normal; color: #6b7280; font-weight: 400; font-size: 0.75rem;
  }
  .cleaner-input-file {
    background: #131820; border: 1px dashed #2a3140; color: #cdd5e0;
    padding: 12px; border-radius: 8px; cursor: pointer; font-family: inherit;
    font-size: 0.8125rem;
  }
  .cleaner-input-file::file-selector-button {
    background: #1f2733; color: #e0e5ed; border: 0; padding: 8px 14px;
    border-radius: 6px; cursor: pointer; font-family: inherit;
    margin-right: 10px;
  }
  .cleaner-file-info {
    font-size: 0.75rem; color: #02b864;
  }
  .cleaner-duration-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .cleaner-input-num {
    background: #131820; border: 1px solid #2a3140; color: #f0f4fa;
    padding: 8px 12px; border-radius: 8px; width: 100px;
    font-family: inherit; font-size: 0.875rem;
  }
  .cleaner-duration-hint { color: #8b94a4; font-size: 0.8125rem; margin-right: 12px; }
  .cleaner-preset {
    background: #1f2733; border: 1px solid #2a3140; color: #cdd5e0;
    padding: 6px 12px; border-radius: 6px; cursor: pointer;
    font-family: inherit; font-size: 0.75rem;
  }
  .cleaner-preset:hover { background: #2a3140; }
  .cleaner-intensity-row { display: flex; gap: 12px; flex-wrap: wrap; }
  .cleaner-intensity-btn {
    background: #131820; border: 1.5px solid #2a3140; color: #cdd5e0;
    padding: 12px 16px; border-radius: 10px; cursor: pointer; flex: 1;
    font-family: inherit; text-align: left; min-width: 180px;
    display: flex; flex-direction: column; gap: 4px;
  }
  .cleaner-intensity-btn strong { font-size: 0.875rem; color: #f0f4fa; }
  .cleaner-intensity-btn small { font-size: 0.75rem; color: #8b94a4; }
  .cleaner-intensity-btn.active {
    border-color: #02b864; background: rgba(2,184,100,0.08);
  }
  .cleaner-intensity-btn.active strong { color: #02b864; }
  .cleaner-actions { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 4px; }
  .btn-cleaner-go {
    background: linear-gradient(180deg, #02b864 0%, #02a95c 100%);
    color: #fff; border: none; padding: 12px 22px; border-radius: 10px;
    font-weight: 600; cursor: pointer; font-family: inherit; font-size: 0.9375rem;
    box-shadow: 0 4px 12px rgba(2,169,92,0.3); transition: opacity 0.15s;
    min-width: 200px;
  }
  .btn-cleaner-go:disabled { opacity: 0.55; cursor: not-allowed; }
  .btn-cleaner-go:hover:not(:disabled) { opacity: 0.92; }
  .btn-cleaner-reset {
    background: #1f2733; color: #cdd5e0; border: 1px solid #2a3140;
    padding: 12px 18px; border-radius: 10px; cursor: pointer;
    font-family: inherit; font-size: 0.875rem;
  }
  .cleaner-progress-wrap { margin-top: 8px; }
  .cleaner-progress-track {
    height: 8px; background: #131820; border-radius: 999px; overflow: hidden;
  }
  .cleaner-progress-fill {
    height: 100%; background: #02b864; border-radius: 999px; transition: width 0.2s;
  }
  .cleaner-progress-fill.processing {
    background: linear-gradient(90deg, #02b864, #6366f1, #02b864);
    background-size: 200% 100%;
    animation: cleaner-stripe 1.4s linear infinite;
  }
  @keyframes cleaner-stripe {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
  .cleaner-progress-text {
    font-size: 0.75rem; color: #8b94a4; margin-top: 8px;
  }
  .cleaner-error {
    background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.3);
    color: #fca5a5; padding: 12px 16px; border-radius: 10px;
    font-size: 0.8125rem;
  }
  .cleaner-success {
    background: rgba(2,184,100,0.06); border: 1px solid rgba(2,184,100,0.3);
    border-radius: 12px; padding: 18px; display: flex; flex-direction: column; gap: 14px;
  }
  .cleaner-success strong { color: #02b864; font-size: 0.9375rem; }
  .btn-cleaner-download {
    display: inline-block; background: #02b864; color: #fff; text-decoration: none;
    padding: 12px 22px; border-radius: 10px; font-weight: 600; font-size: 0.9375rem;
    text-align: center; transition: opacity 0.15s; align-self: flex-start;
  }
  .btn-cleaner-download:hover { opacity: 0.92; }
  .cleaner-preview {
    width: 100%; max-width: 360px; border-radius: 10px;
    background: #000; align-self: flex-start;
  }
  .cleaner-info {
    background: #0a0d12; border: 1px solid #1a1f28;
    border-radius: 12px; padding: 20px;
    align-self: start;
  }
  .cleaner-info h3 {
    margin: 0 0 12px; font-size: 0.8125rem; color: #8b94a4;
    font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px;
  }
  .cleaner-info h3:not(:first-child) { margin-top: 18px; }
  .cleaner-info ul {
    list-style: none; padding: 0; margin: 0;
    display: flex; flex-direction: column; gap: 8px;
  }
  .cleaner-info li {
    font-size: 0.75rem; color: #cdd5e0; line-height: 1.5;
    padding-left: 12px; position: relative;
  }
  .cleaner-info li::before {
    content: '▸'; color: #02b864; position: absolute; left: 0;
  }
  .cleaner-info strong { color: #f0f4fa; font-weight: 500; }
  .cleaner-image-preview {
    max-width: 200px; max-height: 280px; margin-top: 8px;
    border: 1px solid #2a3140; border-radius: 6px; object-fit: contain;
    background: #14181f;
  }
</style>
