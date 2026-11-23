/* ═══════════════════════════════════════════════════════════
   ARIFAH ADMIN — Shared Engine
   Live backend client · auth gate (session/local per choice)
   Sidebar injection · toast · helpers · XSS-safe rendering
   ═══════════════════════════════════════════════════════════ */
'use strict';

const ADM = (() => {
  /* Backend: same Apps Script deployment the original admin used */
  const API_URL = 'https://script.google.com/macros/s/AKfycbxes2VIt7mG_dIT2BMDbxZL1mJd1_pqu3qDCsXIV9S5Bpf89wulIYIrdV0nxKFNUDif/exec';
  const SITE_BASE = 'https://gaziabdulahad.github.io/Shop/';   // live customer site (update when ARIFAH goes live)
  const $  = (s, c) => (c || document).querySelector(s);
  const $$ = (s, c) => [...(c || document).querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  const taka = n => '৳' + Number(n || 0).toLocaleString('en-IN');

  /* ── Google Drive / YouTube helpers ─────────────────── */
  function imgURL(u, w) {
    const m = String(u || '').match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:.*&)?id=|thumbnail\?(?:.*&)?id=)([\w-]+)/);
    return m ? `https://drive.google.com/thumbnail?id=${m[1]}&sz=w${w || 1000}` : u;
  }
  function imgFail(el) {
    if (el.dataset.f) return; el.dataset.f = '1';
    const m = el.src.match(/[?&]id=([\w-]+)/);
    if (m) el.src = 'https://lh3.googleusercontent.com/d/' + m[1] + '=w1600';
    else el.src = 'assets/img/placeholder.svg';
  }
  const imgList = p => String(p.image || '').split(/[\s,|]+/).filter(Boolean);
  const cover = (p, w) => { const f = imgList(p)[0]; return f ? imgURL(f, w || 400) : ''; };
  const ytId = url => { const m = String(url || '').match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([\w-]{11})/); return m ? m[1] : null; };
  const discountPct = p => { const o = Number(p.oldprice), n = Number(p.price); return o > n ? Math.round((o - n) / o * 100) : 0; };
  const isSoldOut = p => { const t = String(p.stock == null ? '' : p.stock).trim().toLowerCase(); return t === '0' || t === 'out' || t === 'শেষ'; };

  /* ── API ───────────────────────────────────────────── */
  let productCache = null;
  async function getProducts(force) {
    if (productCache && !force) return productCache;
    const r = await fetch(API_URL, { method: 'GET' });
    const d = await r.json();
    productCache = Array.isArray(d) ? d : [];
    return productCache;
  }
  async function api(body) {
    const r = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
    return r.json();
  }

  /* ── Auth: pw in sessionStorage (default) or localStorage (remember me) ── */
  const PW_SESSION = 'arifah-admin-pw', PW_LOCAL = 'arifah-admin-remember';
  const getPw = () => sessionStorage.getItem(PW_SESSION) || localStorage.getItem(PW_LOCAL) || '';
  const storePw = (pw, remember) => { try { sessionStorage.removeItem(PW_SESSION); localStorage.removeItem(PW_LOCAL); if (pw) (remember ? localStorage : sessionStorage).setItem(remember ? PW_LOCAL : PW_SESSION, pw); } catch { /* storage blocked */ } };
  const clearPw = () => storePw('', true);

  /** Validate password against a cheap authenticated probe (rate-limited server-side) */
  async function validatePw(pw) {
    const r = await api({ action: 'pendingReviews', password: pw });
    return r && r.ok ? { ok: true, pendingCount: (r.list || []).length } : { ok: false, error: (r && r.error) || 'ভুল পাসওয়ার্ড' };
  }

  /* ── Gate injection (call before any page logic) ── */
  function requireAuth(onReady) {
    const pw = getPw();
    if (pw) { onReady(pw); return; }
    const gate = document.createElement('div');
    gate.className = 'gate';
    gate.innerHTML = `
      <form class="gate-card" id="gateForm" autocomplete="off">
        <div class="mark">A</div>
        <h1>ARIFAH Admin</h1>
        <p>অ্যাডমিন প্যানেলে ঢুকতে পাসওয়ার্ড দিন।<br><span style="font-size:.72rem;color:var(--text-faint)">শুধু অনুমোদিত ব্যক্তির জন্য · ৮ বার ভুল দিলে ১৫ মিনিট বন্ধ</span></p>
        <label class="sr-only" for="gatePw">পাসওয়ার্ড</label>
        <input class="input" id="gatePw" type="password" required autocomplete="current-password" placeholder="অ্যাডমিন পাসওয়ার্ড" style="text-align:center;letter-spacing:.1em">
        <label style="display:flex;gap:.45rem;align-items:center;font-size:.75rem;color:var(--text-muted);margin:.6rem 0 .8rem;cursor:pointer"><input type="checkbox" id="gateRemember" style="accent-color:var(--purple)"> এই ডিভাইসে মনে রাখুন (নিজের ফোনের জন্য)</label>
        <button class="btn btn-primary btn-block" type="submit" id="gateBtn" style="min-height:48px">প্রবেশ করুন</button>
        <p class="gate-error" id="gateError" role="alert"></p>
      </form>`;
    document.body.appendChild(gate);
    document.body.style.overflow = 'hidden';
    const shell = document.querySelector('.shell');
    if (shell) shell.setAttribute('inert', ''); // background page untabbable while locked
    const unlock = () => { gate.remove(); document.body.style.overflow = ''; if (shell) shell.removeAttribute('inert'); };
    $('#gateForm', gate).addEventListener('submit', async e => {
      e.preventDefault();
      const btn = $('#gateBtn', gate), err = $('#gateError', gate);
      const candidate = $('#gatePw', gate).value;
      err.classList.remove('show');
      btn.disabled = true; btn.textContent = 'যাচাই হচ্ছে…';
      try {
        const r = await validatePw(candidate);
        if (!r.ok) { err.textContent = r.error; err.classList.add('show'); btn.disabled = false; btn.textContent = 'প্রবেশ করুন'; return; }
        storePw(candidate, $('#gateRemember', gate).checked);
        unlock();
        onReady(candidate);
      } catch {
        err.textContent = 'সার্ভারে যোগাযোগ করা যায়নি — ইন্টারনেট চেক করুন।';
        err.classList.add('show'); btn.disabled = false; btn.textContent = 'প্রবেশ করুন';
      }
    });
  }

  /* ── Sidebar (inject into #admin-sidebar placeholder) ── */
  const ICON = {
    home: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12l9-9 9 9"/><path d="M9 21V12h6v9"/></svg>',
    plus: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>',
    box: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>',
    cart: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2.5 3h2.7l2.3 11.2a1.6 1.6 0 0 0 1.6 1.3h8.1a1.6 1.6 0 0 0 1.6-1.2L20.5 7H6"/></svg>',
    chart: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="21" x2="21" y2="21"/><rect x="4" y="12" width="3.4" height="8" rx="1"/><rect x="10.3" y="7" width="3.4" height="13" rx="1"/><rect x="16.6" y="3" width="3.4" height="17" rx="1"/></svg>',
    taka: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4h12M6 9h12M6 4c6 0 8 2.5 8 5s-2 5-8 5l8 7"/></svg>',
    truck: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 8h4l3 4v5a1 1 0 0 1-1 1h-2"/><circle cx="8.5" cy="18" r="1.6"/><circle cx="17.5" cy="18" r="1.6"/></svg>',
    factory: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 20h20"/><path d="M4 20V9l5 3V9l5 3V4h4v16"/></svg>',
    box: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.3 7 12 12 20.7 7"/><line x1="12" y1="22" x2="12" y2="12"/></svg>',
    logout: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
    site: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
    menu: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>'
  };
  const PAGES = [
    { href: 'index.html', label: 'ড্যাশবোর্ড', icon: ICON.home },
    { href: 'add-product.html', label: 'প্রোডাক্ট যোগ করুন', icon: ICON.plus },
    { href: 'manage.html', label: 'প্রোডাক্ট ম্যানেজ', icon: ICON.box },
    { href: 'orders.html', label: 'অর্ডার', icon: ICON.cart, badgeId: 'navOrderBadge' },
    { href: 'analytics.html', label: 'Analytics · বিক্রি বিশ্লেষণ', icon: ICON.chart },
    { href: 'finance.html', label: 'Finance · আর্থিক হিসাব', icon: ICON.taka },
    { href: 'trackers.html', label: 'স্টক · সাপ্লায়ার · প্যাকেজিং', icon: ICON.factory }
  ];
  function renderSidebar(active) {
    const here = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    const el = $('#admin-sidebar'); if (!el) return;
    el.innerHTML = `
    <a class="side-brand" href="index.html">
      <span class="mark">A</span>
      <span><b>ARIFAH</b><small>অ্যাডমিন প্যানেল</small></span>
    </a>
    <nav aria-label="অ্যাডমিন নেভিগেশন">
      ${PAGES.map(p => `<a class="nav-btn${(p.href === here || (active === p.href)) ? ' active' : ''}" href="${p.href}">${p.icon}<span>${p.label}</span>${p.badgeId ? `<span class="pill" id="${p.badgeId}" hidden></span>` : ''}</a>`).join('')}
    </nav>
    <div class="side-foot">
      <a class="side-link" href="${SITE_BASE}" target="_blank" rel="noopener">${ICON.site}<span>লাইভ সাইট দেখুন ↗</span></a>
      <button class="side-link danger" id="adminLogout" type="button">${ICON.logout}<span>লগআউট</span></button>
    </div>`;
    $('#adminLogout')?.addEventListener('click', () => { clearPw(); location.reload(); });
    // mobile toggle
    const toggle = $('#sideToggle');
    if (toggle && !toggle.dataset.bound) {
      toggle.dataset.bound = '1';
      toggle.addEventListener('click', () => el.classList.toggle('open'));
      document.addEventListener('click', e => { if (el.classList.contains('open') && !e.target.closest('.sidebar') && !e.target.closest('#sideToggle')) el.classList.remove('open'); });
    }
  }

  /* ── Toast ── */
  function toast(msg, type) {
    let wrap = $('.toast-wrap');
    if (!wrap) { wrap = document.createElement('div'); wrap.className = 'toast-wrap'; document.body.appendChild(wrap); }
    const el = document.createElement('div');
    el.className = 'toast' + (type === 'error' ? ' error' : '');
    el.textContent = msg;
    wrap.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 250); }, 4200);
  }

  /* ── Generic confirm dialog (styled, keyboard accessible) ── */
  function confirmBox(message, okLabel = 'নিশ্চিত করুন') {
    return new Promise(resolve => {
      const ov = document.createElement('div');
      ov.className = 'gate'; ov.style.background = 'rgba(25,17,32,.55)';
      ov.innerHTML = `<div class="gate-card" role="dialog" aria-modal="true" aria-label="নিশ্চিত করুন"><h1 style="font-size:1.05rem">${esc(message)}</h1><div style="display:flex;gap:.5rem;justify-content:center;margin-top:.9rem"><button class="btn btn-outline" data-no>বাতিল</button><button class="btn btn-danger" data-yes>${esc(okLabel)}</button></div></div>`;
      document.body.appendChild(ov);
      const close = v => { ov.remove(); resolve(v); };
      ov.addEventListener('click', e => { if (e.target === ov || e.target.closest('[data-no]')) close(false); else if (e.target.closest('[data-yes]')) close(true); });
      document.addEventListener('keydown', function h(e) { if (e.key === 'Escape') { document.removeEventListener('keydown', h); close(false); } });
      ov.querySelector('[data-yes]').focus();
    });
  }

  /* ══ Local business data (expenses · suppliers · packaging) ═══
     Stored on THIS device (localStorage) — same approach as the
     original Financial Analyzer. No fake server sync.             */
  const BIZ_KEYS = {
    expenses: 'arifah-biz-expenses',
    suppliers: 'arifah-biz-suppliers',
    packaging: 'arifah-biz-packaging',
    settings: 'arifah-biz-settings'
  };
  const bizRead = (k, fb) => { try { return JSON.parse(localStorage.getItem(BIZ_KEYS[k])) ?? fb; } catch { return fb; } };
  const bizWrite = (k, v) => { try { localStorage.setItem(BIZ_KEYS[k], JSON.stringify(v)); return true; } catch { toast('এই ডিভাইসে সেভ করা যায়নি (storage ব্লকড)', 'error'); return false; } };
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  /* ── Biz: Google Sheets first, localStorage as offline cache ──
     Sheets are the source of truth; the local copy lets the page
     render instantly and keep working if the API is unreachable.
     Every write goes to the sheet; if that fails we keep it local
     and tell the admin honestly (no silent data loss).            */
  const listeners = new Set();
  const notify = () => listeners.forEach(fn => { try { fn(); } catch { } });

  const Biz = {
    /* subscribe to remote refreshes — pages re-render when data lands */
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },

    /* ── expenses ── */
    getExpenses: () => bizRead('expenses', []),
    async loadExpenses() {
      try {
        const r = await api({ action: 'bizList', password: getPw(), table: 'expenses' });
        if (r && r.ok && Array.isArray(r.list)) { bizWrite('expenses', r.list); notify(); return r.list; }
      } catch { }
      return bizRead('expenses', []);
    },
    async addExpense(e) {
      const row = { id: uid(), time: dhakaNow(), ...e };
      const local = bizRead('expenses', []); local.unshift(row); bizWrite('expenses', local);
      try {
        const r = await api({ action: 'bizSave', password: getPw(), table: 'expenses', row });
        if (!r || !r.ok) throw new Error((r && r.error) || 'sheet-এ সেভ হয়নি');
        toast('খরচ শিটে সেভ হয়েছে ✓');
        return true;
      } catch (err) {
        toast('শিটে সেভ হয়নি: ' + (err.message || 'অজানা সমস্যা') + ' — প্রথমে Deploy → New version করুন (README দেখুন)', 'error');
        return false;
      } finally { notify(); }
    },
    async removeExpense(id) {
      bizWrite('expenses', bizRead('expenses', []).filter(x => x.id !== id)); notify();
      try { const r = await api({ action: 'bizDelete', password: getPw(), table: 'expenses', id }); return !!(r && r.ok); } catch { return false; }
    },

    /* ── suppliers ── */
    getSuppliers: () => bizRead('suppliers', []),
    async loadSuppliers() {
      try {
        const r = await api({ action: 'bizList', password: getPw(), table: 'suppliers' });
        if (r && r.ok && Array.isArray(r.list)) { bizWrite('suppliers', r.list); notify(); return r.list; }
      } catch { }
      return bizRead('suppliers', []);
    },
    async saveSupplier(s) {
      const isNew = !s.id;
      const row = { ...s, id: s.id || uid(), time: dhakaNow() };
      const local = bizRead('suppliers', []); const i = local.findIndex(x => x.id === row.id);
      if (i >= 0) local[i] = row; else local.unshift(row); bizWrite('suppliers', local); notify();
      try {
        const r = await api({ action: 'bizSave', password: getPw(), table: 'suppliers', row });
        if (!r || !r.ok) throw new Error((r && r.error) || 'সেভ হয়নি');
        toast('সাপ্লায়ার শিটে সেভ হয়েছে ✓'); return true;
      } catch (err) { toast('শিটে সেভ হয়নি: ' + (err.message || 'অজানা সমস্যা'), 'error'); return false; }
    },
    async removeSupplier(id) {
      bizWrite('suppliers', bizRead('suppliers', []).filter(x => x.id !== id)); notify();
      try { const r = await api({ action: 'bizDelete', password: getPw(), table: 'suppliers', id }); return !!(r && r.ok); } catch { return false; }
    },

    /* ── packaging ── */
    getPackaging: () => bizRead('packaging', []),
    async loadPackaging() {
      try {
        const r = await api({ action: 'bizList', password: getPw(), table: 'packaging' });
        if (r && r.ok && Array.isArray(r.list)) { bizWrite('packaging', r.list); notify(); return r.list; }
      } catch { }
      return bizRead('packaging', []);
    },
    async savePackaging(p) {
      const row = { ...p, id: p.id || uid(), time: dhakaNow() };
      const local = bizRead('packaging', []); const i = local.findIndex(x => x.id === row.id);
      if (i >= 0) local[i] = row; else local.unshift(row); bizWrite('packaging', local); notify();
      try {
        const r = await api({ action: 'bizSave', password: getPw(), table: 'packaging', row });
        if (!r || !r.ok) throw new Error((r && r.error) || 'সেভ হয়নি');
        toast('প্যাকেজিং শিটে সেভ হয়েছে ✓'); return true;
      } catch (err) { toast('শিটে সেভ হয়নি: ' + (err.message || 'অজানা সমস্যা'), 'error'); return false; }
    },
    async removePackaging(id) {
      bizWrite('packaging', bizRead('packaging', []).filter(x => x.id !== id)); notify();
      try { const r = await api({ action: 'bizDelete', password: getPw(), table: 'packaging', id }); return !!(r && r.ok); } catch { return false; }
    },

    /* ── settings ── */
    getSettings: () => bizRead('settings', { shippingIn: 60, shippingOut: 120, courierFeeIn: 70, courierFeeOut: 130, cogsPct: 55 }),
    async loadSettings() {
      try {
        const r = await api({ action: 'bizList', password: getPw(), table: 'settings' });
        if (r && r.ok && r.list) {
          const merged = { ...Biz.getSettings(), ...r.list };
          ['cogsPct', 'shippingIn', 'shippingOut', 'courierFeeIn', 'courierFeeOut'].forEach(k => { if (merged[k] != null) merged[k] = Number(merged[k]); });
          bizWrite('settings', merged); notify(); return merged;
        }
      } catch { }
      return Biz.getSettings();
    },
    async saveSettings(s) {
      bizWrite('settings', s); notify();
      try {
        const r = await api({ action: 'bizSave', password: getPw(), table: 'settings', row: s });
        if (!r || !r.ok) throw new Error((r && r.error) || 'সেভ হয়নি');
        toast('সেটিংস শিটে সেভ হয়েছে ✓'); return true;
      } catch (err) { toast('শিটে সেভ হয়নি: ' + (err.message || 'সমস্যা'), 'error'); return false; }
    },

    /* pull everything at once — used by page load & the Sync button */
    async pullAll() {
      await Promise.all([Biz.loadExpenses(), Biz.loadSuppliers(), Biz.loadPackaging(), Biz.loadSettings()]);
    },
    /* push any local-only rows that never made it to the sheet */
    async pushLocal() {
      const jobs = [];
      bizRead('expenses', []).forEach(x => jobs.push(api({ action: 'bizSave', password: getPw(), table: 'expenses', row: x })));
      bizRead('suppliers', []).forEach(x => jobs.push(api({ action: 'bizSave', password: getPw(), table: 'suppliers', row: x })));
      bizRead('packaging', []).forEach(x => jobs.push(api({ action: 'bizSave', password: getPw(), table: 'packaging', row: x })));
      jobs.push(api({ action: 'bizSave', password: getPw(), table: 'settings', row: Biz.getSettings() }));
      const res = await Promise.allSettled(jobs);
      const ok = res.filter(r => r.status === 'fulfilled' && r.value && r.value.ok).length;
      /* collect the REAL reasons so the admin sees why */
      const reasons = [];
      res.forEach(r => {
        if (r.status === 'rejected') reasons.push('নেটওয়ার্ক: ' + (r.reason && r.reason.message || 'যোগাযোগ হয়নি'));
        else if (r.value && !r.value.ok) reasons.push(r.value.error || 'অজানা ভুল');
      });
      return { ok, total: jobs.length, reasons: [...new Set(reasons)] };
    },
    async sync() {
      /* order matters: try push only when there IS local data; then pull fresh */
      let pushed = { ok: 0, total: 0 };
      try { pushed = await Biz.pushLocal(); } catch { /* push skipped */ }
      await Biz.pullAll();
      return pushed;
    },
    clearAll() { try { Object.values(BIZ_KEYS).forEach(k => localStorage.removeItem(k)); } catch { } notify(); }
  };

  /* ── Sync card wiring (shared by Finance & Trackers) ── */
  function wireSync() {
    const st = $('.js-sync-state'), sb = $('.js-sync-pull'), pb = $('.js-sync-push');
    if (!st || !sb || !pb) return;
    const say = (txt, kind) => {
      st.textContent = txt;
      st.style.color = kind === true ? 'var(--success)' : kind === false ? 'var(--danger)' : '';
    };
    const localCount = () => Biz.getExpenses().length + Biz.getSuppliers().length + Biz.getPackaging().length;
    const showState = () => {
      const n = localCount();
      say(n ? `এই ডিভাইসে ${n}টি এন্ট্রি আছে — শিটে পাঠানোর জন্য "⬆️ পাঠান" চাপুন` : 'এই ডিভাইসে কোনো লোকাল এন্ট্রি নেই — সব শিটে আছে', undefined);
    };
    async function run() {
      sb.disabled = pb.disabled = true;
      say('শিটের সাথে মেলানো হচ্ছে…');
      try {
        const r = await Biz.sync();
        if (r.total === 0) {
          say('শিট থেকে সর্বশেষ ডেটা নিয়ে এসেছে ✓ (পাঠানোর মতো লোকাল এন্ট্রি ছিল না)', true);
        } else if (r.ok === r.total) {
          say(`${r.ok}/${r.total} — সব এন্ট্রি শিটে গেছে ✓`, true);
        } else {
          const why = (r.reasons && r.reasons.length) ? ' — কারণ: ' + r.reasons.join(' | ') : '';
          say(`${r.ok}/${r.total} সফল${why}`, false);
        }
      } catch (e) {
        say('Sync ব্যর্থ: ' + (e.message || 'নেটওয়ার্ক সমস্যা'), false);
      }
      sb.disabled = pb.disabled = false;
    }
    sb.addEventListener('click', run);
    pb.addEventListener('click', run);
    showState();
  }

  /* CSV download (semicolon + BOM → Excel-friendly for Bengali) */
  function downloadCSV(filename, headers, rows) {
    const cell = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const csv = '﻿' + [headers.map(cell).join(';'), ...rows.map(r => r.map(cell).join(';'))].join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  /* date helpers — business runs on Asia/Dhaka time */
  const dhakaToday = () => new Date(Date.now() + 6 * 3600e3).toISOString().slice(0, 10);
  const dhakaNow = () => new Date(Date.now() + 6 * 3600e3).toISOString().slice(0, 16).replace('T', ' ');
  const dayOf = t => String(t || '').slice(0, 10);

  return { API_URL, SITE_BASE, $, $$, esc, taka, imgURL, imgFail, imgList, cover, ytId, discountPct, isSoldOut, getProducts, api, validatePw, getPw, storePw, clearPw, requireAuth, renderSidebar, toast, confirmBox, Biz, downloadCSV, dhakaToday, dhakaNow, dayOf, uid, wireSync };
})();
