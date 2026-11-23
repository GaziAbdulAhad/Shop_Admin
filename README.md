# ARIFAH Admin — প্রোডাক্ট ও অর্ডার ম্যানেজমেন্ট প্যানেল

The admin panel for [ARIFAH (আরিফাহ)](../Ladies-Fashion-Store) — rebuilt from the original
`Shop-main/shop-6/admin` project on the same design system as the customer site.
Completely separate from the public site; marked `noindex` and never linked publicly.

---

## Quick Start

```bash
cd Ladies-Fashion-Store-admin
node server.js 8082          # auto-increments if busy
# → http://localhost:8082/
```

Or open `index.html` directly — everything is client-side; it talks to the live Google
Apps Script backend over HTTPS.

## Pages

| Page | Purpose |
|---|---|
| `index.html` | **ড্যাশবোর্ড** — order stats (total, today, pending, revenue), recent orders, pending-review alerts, catalog health |
| `add-product.html` | New product + image upload → live site in seconds |
| `manage.html` | Search/edit/delete products · add reviews · approve/reject customer reviews |
| `orders.html` | Full order dashboard — filter by status, search, CSV export, WhatsApp quick-contact, status changes |
| `analytics.html` | **Sales analytics from the live Orders sheet** — revenue (shipped+delivered only), AOV, cancel rate, 14-day chart, top products, district split, order funnel, stock-out alerts, CSV export |
| `finance.html` | **Finance** — expense entries (device-stored), P&L (revenue auto from Orders sheet − product cost % − your expenses), working-capital calculator, loan/EMI calculator |
| `trackers.html` | **Stock · Suppliers · Packaging** — live stock levels with one-click sheet update (sold-out flag syncs to the site), supplier/payable tracker, packaging stock + parcel estimate, margin/courier settings, full data CSV export |

## Architecture

```
assets/js/admin.js   Shared engine: API client · auth gate · sidebar injection · toast · helpers
assets/css/tokens.css  ARIFAH design tokens (same as customer site)
assets/css/admin.css   Admin shell (deep-plum sidebar + light content)
Code.gs              Backend **reference** with the admin password REDACTED —
                     the real backend is already deployed; see "Backend" below
server.js            Zero-dependency static server
```

## Security Model (as it was — preserved intentionally)

- The admin password lives **only in Google Apps Script** (`ADMIN_PASSWORD` in `Code.gs`, never in the frontend).
- Session: password kept in `sessionStorage` per tab; optional "এই ডিভাইসে মনে রাখুন" stores it in `localStorage` (your own phone only).
- Wrong password **8 times → 15-minute lockout** (server-side, via `CacheService`).
- All admin endpoints require the password; customer endpoints (`order`, `track`, `review`, `subscribe`) are the only public ones.
- Pages are `noindex,nofollow`; never link them from the public site.

> ⚠️ PSA: treat your admin password like the shop's bank PIN. If it ever leaked, change `ADMIN_PASSWORD` in the Apps Script editor and redeploy.

## Backend (already live)

Admin panel talks to the **newer** deployment (the one with dashboard/moderation actions):

```
https://script.google.com/macros/s/AKfycbygiqtld8GgbiK5xAk-fKWle4Qs433SzKyoKxMl_YN7caqlCzUsxNutmrO3AEpbNc6s/exec
```

The public customer site talks to the older deployment (`AKfycbxes2…`). Both read/write the
same Google Sheets (products & orders), so admin edits appear on the site immediately.

### API contract

| Action | Auth | Purpose |
|---|---|---|
| `orders` | pw | Last 300 orders (orderId, product, total, name, phone, address, district, note, status) |
| `setStatus` | pw | orderId + status → update order (customer's tracker updates too) |
| `add` / `update` / `delete` | pw | Product CRUD |
| `upload` | pw | base64 image → Google Drive shareable link |
| `addReview` | pw | Add review directly (e.g., WhatsApp feedback) |
| `pendingReviews` | pw | List reviews awaiting moderation |
| `moderate` | pw | row + `approved`/`rejected` |
| `order` / `track` / `review` / `subscribe` | public | Used by the customer site only |

## Business tools (Analytics / Finance / Trackers)

Built after reviewing your existing tools (`Documents/Linux/Business Monitoring` and
`Business_Financial_Analyzer`). What fits a one-owner COD fashion shop was ported in;
what did not apply was deliberately left out.

**Kept** — daily/weekly sales view, order-status funnel, product-wise sales, district split,
expenses, suppliers with payables, packaging stock, inventory levels, P&L, working capital,
loan/EMI, CSV export.

**Dropped (not relevant to your shop)** — live-selling sessions, social-media tracker,
website analytics, launch planner, goals/habits, sales pipeline, KPI dashboard,
quarter-comparison, time sheet, customer tracker (the Orders sheet already has every
customer), photo tracker (product editing covers it), and the Analyzer's manual re-entry
of business profile / product list / channels (your real data already lives in the sheets,
so the numbers are computed instead of typed).

**Honesty note:** revenue, AOV, funnel, top products and district splits are computed from
your **real Orders sheet** — no handwritten sample numbers and no invented KPIs.
Expenses, suppliers and packaging are stored on the admin device (localStorage), exactly
like the original Analyzer; CSV export covers backups.

## Notable improvements over the original admin

- Same design system as the new ARIFAH customer site (fonts, colors, components) instead of the old dark ad-hoc CSS
- Real **dashboard home page** with stats + alerts (the original had none)
- Sidebar with logout; mobile drawer; keyboard-accessible modals; no more `alert()`/`confirm()`
- Product search, order search + CSV export, review photo upload preserved
- Syntax-checked, E2E-verified in headless Edge
- **Sheet-backed business tools:** expenses / suppliers / packaging / settings now live in
  Google Sheets (bizSave / bizList / bizDelete), with local cache + honest "not saved to
  sheet" toast + CSV backup when offline or before the one-time redeploy above

## ⚠️ একবারের কাজ: Business sheets চালু করতে হবে (আপনার নিজ হাতে)

খরচ / সাপ্লায়ার / প্যাকেজিং / সেটিংস এখন **Google Sheet-এ** জমা হয় — কিন্তু নতুন
`bizSave`, `bizList`, `bizDelete` actions এখনও আপনার লাইভ deployment-এ নেই।
তাই **একবার** এই ৫ ধাপ করতে হবে (৫ মিনিট):

1. https://script.google.com খুলুন → আপনার shop-এর project-এ ঢুকুন।
2. বাঁ দিকে **`Code.gs`** ফাইল খুলে সব সিলেক্ট করে (Ctrl+A) মুছে দিন।
3. এই project folder-এর **`Code.gs`** ফাইলটা খুলে পুরোটা কপি করুন → পেস্ট করুন।
4. উপরে `const ADMIN_PASSWORD = "এখানে-নিজের-পাসওয়ার্ড-দিন";` লাইনটা খুঁজে
   **আপনার আসল পাসওয়ার্ড** বসান (রেফারেন্স কপি থেকে নিরাপত্তার জন্য সরানো হয়েছিল)।
5. **Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy**।
   (URL অপরিবর্তিত থাকবে, তাই সাইট/অ্যাডমিনে কিছু বদলাতে হবে না।)

এরপর প্রথমবার কোনো খরচ/সাপ্লায়ার সেভ করলে Google Sheet-এ স্বয়ংক্রিয়ভাবে
**Expenses**, **Suppliers**, **Packaging**, **BizSettings** নামে ৪টা শিট তৈরি হবে।

> ✅ এর আগেও অ্যাডমিন প্যানেল ভাঙবে না — শিটে সেভ না হলে ডেটা এই ডিভাইসে থাকে
> এবং "শিটে সেভ হয়নি" না-ভাবানো বার্তা দেখায়। CSV backup-ও কাজ করে।

### কী কী কোথায় জমা হয়

| অ্যাডমিন পেজ | লেখা হয় | Sheet |
|---|---|---|
| Finance → খরচ যোগ | `bizSave` / `bizDelete` | **Expenses** |
| Trackers → সাপ্লায়ার | `bizSave` / `bizDelete` | **Suppliers** |
| Trackers → প্যাকেজিং | `bizSave` / `bizDelete` | **Packaging** |
| Trackers → মার্জিন সেটিংস | `bizSave` | **BizSettings** |
| Trackers → স্টক সংখ্যা | `update` (আগের মতোই) | **Products** |
| সব পেজ load-এ | `bizList` | শিট থেকে পড়ে |

## Deploying for real

Host this folder anywhere static (GitHub Pages repo, Netlify, cPanel…). The password is
verified server-side, so a public host is fine — just don't link the URL anywhere.
Update `SITE_BASE` in `assets/js/admin.js` if the customer site ever moves.

---
*Built November 2026 · ARIFAH · BDT (৳)*
