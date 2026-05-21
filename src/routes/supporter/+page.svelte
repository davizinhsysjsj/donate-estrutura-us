<script lang="ts">
  import { Heart, Download, CheckCircle2, Share2, Instagram, ChevronRight, ArrowLeft, Facebook, Youtube, Twitter, Shield } from 'lucide-svelte';

  let { data } = $props();
  const { amount, dogs, dateStr, orderId } = data;

  const PAGE_URL = 'https://donate-estrutura.vercel.app';
  const shareText = encodeURIComponent(
    `I just helped feed ${dogs} rescue ${dogs === 1 ? 'dog' : 'dogs'} through @pawsco.rescue 🐾 Join me at ${PAGE_URL}`
  );

  const shareLinks = {
    x: `https://twitter.com/intent/tweet?text=${shareText}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${PAGE_URL}&quote=${shareText}`,
    whatsapp: `https://wa.me/?text=${shareText}`
  };

  const bundleItems = [
    { label: 'Personalized PDF Certificate of Appreciation', action: 'Download' },
    { label: 'Rescue Stories Vol. 1 — Digital Ebook', action: 'Download' },
    { label: 'Access to PawsCo Supporter Community', action: 'Open' },
    { label: 'Quarterly Impact Reports', action: 'Sent monthly to your inbox', static: true }
  ];
</script>

<svelte:head>
  <title>Thank you — PawsCo Rescue</title>
</svelte:head>

<header class="header">
  <a href="/" class="header-btn" aria-label="Back" style="text-decoration:none;color:inherit">
    <ArrowLeft size={20} />
  </a>
  <a href="/" class="header-logo">
    <svg class="logo-icon" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M20 4C11.163 4 4 11.163 4 20s7.163 16 16 16 16-7.163 16-16S28.837 4 20 4z" fill="#3B82F6" />
      <path d="M20 8c-1.5 3-5 6-8 7 1 4 4 8 8 9 4-1 7-5 8-9-3-1-6.5-4-8-7z" fill="#DBEAFE" />
      <path d="M20 12c-1 2-3 4-5 5 .7 2.5 2.5 5 5 6 2.5-1 4.3-3.5 5-6-2-1-4-3-5-5z" fill="#3B82F6" />
    </svg>
    <span class="logo-text">pawsco</span>
  </a>
  <span style="width:36px"></span>
</header>

<div class="page">
  <div class="container-app">
    <!-- Thank you hero -->
    <section class="section" style="text-align:center; padding-top: 32px;">
      <div style="display:inline-flex;width:72px;height:72px;border-radius:50%;background:var(--primary-light);color:var(--primary-dark);align-items:center;justify-content:center;margin-bottom:16px">
        <Heart size={36} fill="currentColor" />
      </div>
      <h1 style="font-size:1.5rem;font-weight:700;line-height:1.2;margin-bottom:10px">Thank you, friend.</h1>
      <p style="font-size:0.9375rem;color:var(--muted-fg);line-height:1.55;max-width:340px;margin:0 auto">
        Your <strong style="color:var(--fg)">€{amount}</strong> contribution will feed
        <strong style="color:var(--primary)">{dogs}</strong>
        rescue {dogs === 1 ? 'dog' : 'dogs'} this week. We mean it: this changes lives.
      </p>
    </section>

    <!-- Receipt -->
    <section class="section">
      <div class="section-eyebrow">Receipt</div>
      <div class="support-card" style="background:var(--muted)">
        <div class="support-receipt-row">
          <span class="support-receipt-label">Order ID</span>
          <span class="support-receipt-value" style="display:flex;align-items:center;gap:8px">
            {orderId}
            <span class="badge-protected"><Shield size={12} /> Paid</span>
          </span>
        </div>
        <div class="support-receipt-row">
          <span class="support-receipt-label">Date</span>
          <span class="support-receipt-value">{dateStr}</span>
        </div>
        <div class="support-receipt-row">
          <span class="support-receipt-label">Amount</span>
          <span class="support-receipt-value">€{amount}.00</span>
        </div>
        <div class="support-receipt-row">
          <span class="support-receipt-label">Email</span>
          <span class="support-receipt-value" style="font-weight:500">your-email@example.com</span>
        </div>
      </div>
    </section>

    <!-- Bundle -->
    <section class="section">
      <div class="section-eyebrow">Your bundle</div>
      <h2 class="section-title">Your supporter bundle is ready.</h2>
      {#each bundleItems as item}
        <div class="bundle-item">
          <div class="bundle-check"><CheckCircle2 size={18} /></div>
          <span class="bundle-label">{item.label}</span>
          {#if item.static}
            <span class="bundle-static">{item.action}</span>
          {:else}
            <button class="bundle-action">
              {#if item.action === 'Download'}
                <Download size={12} style="display:inline;margin-right:4px;vertical-align:-2px" />
              {/if}
              {item.action}
            </button>
          {/if}
        </div>
      {/each}
    </section>

    <!-- Share -->
    <section class="section">
      <div class="section-eyebrow">Want to help more?</div>
      <h2 class="section-title">Share your impact.</h2>
      <p style="font-size:0.875rem;color:var(--muted-fg);line-height:1.5;margin-bottom:14px">
        Word of mouth feeds more dogs than any ad we could buy. Tell one friend.
      </p>
      <div class="share-grid">
        <a href={shareLinks.whatsapp} target="_blank" rel="noopener" class="share-btn">
          <div class="share-icon" style="background:#DBEAFE">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="#25D366">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
              <path d="M11.997 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.878-1.417A9.944 9.944 0 0 0 11.997 22C17.52 22 22 17.523 22 12c0-5.522-4.48-10-10.003-10zm0 18.18a8.154 8.154 0 0 1-4.158-1.138l-.297-.178-3.087.897.923-3.01-.196-.309A8.145 8.145 0 0 1 3.817 12c0-4.516 3.664-8.18 8.18-8.18s8.18 3.664 8.18 8.18c0 4.517-3.664 8.18-8.18 8.18z" />
            </svg>
          </div>
          <span class="share-label">WhatsApp</span>
        </a>
        <a href={shareLinks.facebook} target="_blank" rel="noopener" class="share-btn">
          <div class="share-icon" style="background:#DBEAFE"><Facebook size={22} color="#1877F2" /></div>
          <span class="share-label">Facebook</span>
        </a>
        <a href={shareLinks.x} target="_blank" rel="noopener" class="share-btn">
          <div class="share-icon" style="background:#EFF6FF">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#000"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
          </div>
          <span class="share-label">X / Twitter</span>
        </a>
      </div>
    </section>

    <!-- Follow IG -->
    <section class="section">
      <div class="section-eyebrow">Stay close</div>
      <h2 class="section-title">Follow our work.</h2>
      <p style="font-size:0.875rem;color:var(--muted-fg);line-height:1.5;margin-bottom:14px">
        See the dogs you helped, before-and-after stories, weekly updates from the shelters.
      </p>
      <a href="https://instagram.com/pawsco.rescue" target="_blank" rel="noopener" class="btn btn-primary" style="text-decoration:none;width:100%">
        <Instagram size={18} />
        Follow @pawsco.rescue
      </a>
    </section>

    <!-- Quote -->
    <section style="padding: 0 16px 8px; background: var(--bg);">
      <div class="quote-card">
        <p class="quote-text">"We don't see ourselves as a charity. We see ourselves as the bridge between people who care and dogs who need it most."</p>
        <p class="quote-author">— Aoife Murphy, Founder</p>
      </div>
    </section>

    <!-- Footer -->
    <footer class="footer">
      <div class="footer-social">
        <a href="#" aria-label="Facebook"><Facebook size={20} /></a>
        <a href="#" aria-label="YouTube"><Youtube size={20} /></a>
        <a href="#" aria-label="Twitter"><Twitter size={20} /></a>
        <a href="#" aria-label="Instagram"><Instagram size={20} /></a>
      </div>
      <div class="footer-copy">© 2026 PawsCo Rescue</div>
      <div class="footer-links">
        <a href="/">Back to campaign</a>
        <a href="mailto:hello@pawsco.com">hello@pawsco.com</a>
      </div>
    </footer>
  </div>
</div>

<!-- Sticky bar pra voltar pra home -->
<div class="sticky-bar">
  <a href="/" class="btn btn-primary" style="text-decoration:none;flex:1">
    Back to campaign
    <ChevronRight size={16} />
  </a>
</div>
