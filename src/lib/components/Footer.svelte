<script lang="ts">
  import Logo from './Logo.svelte';
  import { Mail, Instagram } from 'lucide-svelte';
</script>

<footer class="bg-warm-charcoal/40 border-t border-white/5 mt-16">
  <div class="container-narrow py-16 md:py-20">
    <div class="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-12">
      <div>
        <Logo />
        <p class="mt-4 text-sm text-muted leading-relaxed max-w-xs">
          A grassroots fundraising initiative supporting verified Irish rescue partners.
        </p>
        <p class="mt-6 text-xs text-muted leading-relaxed">
          77 Camden Street Lower<br />
          Saint Kevin's, Dublin 2<br />
          D02 XE80, Ireland
        </p>
      </div>

      <div>
        <h4 class="text-xs uppercase tracking-[0.18em] text-snow font-semibold mb-4">Pages</h4>
        <ul class="space-y-2 text-sm">
          <li><a href="#tiers" class="text-muted hover:text-amber-accent transition-colors">Support a paw</a></li>
          <li><a href="/supporter?tier=50" class="text-muted hover:text-amber-accent transition-colors">Supporter area</a></li>
          <li><a href="#trust" class="text-muted hover:text-amber-accent transition-colors">FAQ</a></li>
          <li><a href="/privacy" class="text-muted hover:text-amber-accent transition-colors">Privacy</a></li>
          <li><a href="/terms" class="text-muted hover:text-amber-accent transition-colors">Terms</a></li>
          <li><a href="/refund" class="text-muted hover:text-amber-accent transition-colors">Refund Policy</a></li>
        </ul>
      </div>

      <div>
        <h4 class="text-xs uppercase tracking-[0.18em] text-snow font-semibold mb-4">Contact</h4>
        <ul class="space-y-3 text-sm">
          <li>
            <a href="mailto:hello@pawsco.com" class="inline-flex items-center gap-2 text-muted hover:text-amber-accent transition-colors">
              <Mail size={14} />
              hello@pawsco.com
            </a>
          </li>
          <li>
            <a href="https://instagram.com/pawsco.rescue" target="_blank" rel="noopener" class="inline-flex items-center gap-2 text-muted hover:text-amber-accent transition-colors">
              <Instagram size={14} />
              @pawsco.rescue
            </a>
          </li>
        </ul>
      </div>
    </div>

    <div class="border-t border-white/5 mt-12 pt-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs text-muted">
      <span>© 2026 PawsCo. A grassroots fundraising initiative.</span>
      <a href="/" class="hover:text-amber-accent transition-colors">PawsCo main brand →</a>
    </div>
  </div>
</footer>
