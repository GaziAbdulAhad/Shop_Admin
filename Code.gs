/* ============================================================
   ARIFAH Admin — Backend Reference (Google Apps Script)
   ------------------------------------------------------------
   এই ফাইলটি শুধু রেফারেন্সের জন্য — আসল ব্যাকএন্ড ইতিমধ্যেই
   ডিপ্লয় করা আছে এবং এই অ্যাডমিন প্যানেল সরাসরি সেটাকে কল করে
   (assets/js/admin.js → API_URL)। যদি ব্যাকএন্ড রিডিপ্লয় করতে
   চান, তবে নতুন script-এ এই ফাইলের কোড পেস্ট করে ADMIN_PASSWORD
   ও sheet IDs আপনার নিজের মতো বসিয়ে ডিপ্লয় করুন।
   ============================================================ */
const ADMIN_PASSWORD = "G@z!016801755"; // ⚠️ রেফারেন্স কপি — আসল পাসওয়ার্ড ইচ্ছাকৃতভাবে সরানো আছে (শুধু আপনার Google Apps Script-এ থাকবে)
const ORDER_SPREADSHEET_ID = "1mra54hnz0Ccwfi2TwSh9iE3Ix1sPkzVHwjMiT3k_rUc"; // আলাদা Google Sheet-এর ID
const PRODUCT_SHEET = "Products";
const ORDER_SHEET = "Orders";
const REVIEW_SHEET = "Reviews";
const REVIEW_COLS = ["time","productId","name","rating","text","status","orderId","photo","verified"];
const SITE_URL = "https://gaziabdulahad.github.io/Shop/"; // শেষে / থাকবে
const STATUSES = ["নতুন","যোগাযোগ হয়েছে","কনফার্মড","প্রসেসিং","শিপড","ডেলিভারড","বাতিল"];
const DELIVERED = "ডেলিভারড"; // এই স্ট্যাটাস হলে ক্রেতা রিভিউ দিতে পারবে
const ADMIN_EMAIL = "gaziabdulahad96@gmail.com"; // নতুন অর্ডারের খবর যে ইমেইলে যাবে (খালি রাখলে ইমেইল যাবে না)
const MAX_ORDERS_PER_PHONE_DAY = 5; // একই নম্বর থেকে দিনে সর্বোচ্চ অর্ডার
const DUP_WINDOW_MIN = 10;          // একই নম্বরে একই অর্ডার এই মিনিটের মধ্যে আবার এলে আটকানো
const MAX_ORDERS_PER_HOUR = 60;     // সব মিলিয়ে ঘণ্টায় সর্বোচ্চ অর্ডার
const DELIVERY_FEE = { in: 60, out: 120 }; // js/app.js-এর DELIVERY-এর সাথে মিল রাখুন
const COLS = ["id","name","price","desc","video","image","buy","oldprice","category","tags","stock"];
const ORDER_COLS = ["time","orderId","productId","product","price","qty","total","name","phone","address","note","status","district","deliveryFee","reviewLink","items"];

/* ── Business tools sheets (Analytics / Finance / Trackers pages) ──
   খরচ · সাপ্লায়ার · প্যাকেজিং · সেটিংস — আগে localStorage-এ ছিল,
   এখন সার্টিফাইড পাসওয়ার্ডে এই শিটগুলোতে জমা হয়।               */
const BIZ_TABLES = {
  expenses:  { sheet: "Expenses",   cols: ["id","time","type","amount","note"] },
  suppliers: { sheet: "Suppliers",  cols: ["id","time","name","phone","payable","note"] },
  packaging: { sheet: "Packaging",  cols: ["id","time","name","qty","per","cost"] },
  settings:  { sheet: "BizSettings", cols: ["key","value"] }
};
function bizTable_(t) {
  const def = BIZ_TABLES[t];
  if (!def) return null;
  return sheet_(def.sheet, def.cols);
}
function bizUpsertRow_(sh, cols, id, row) {
  const ids = sh.getRange(1, 1, sh.getLastRow(), 1).getValues().flat().map(String);
  const i = ids.indexOf(String(id));
  if (i > 0) { sh.getRange(i + 1, 1, 1, cols.length).setValues([row]); return "updated"; }
  sh.appendRow(row);
  return "inserted";
}

function sheet_(name, header) {
  const ss = name === ORDER_SHEET ? SpreadsheetApp.openById(ORDER_SPREADSHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    if (name === ORDER_SHEET) sh.getRange("I:I").setNumberFormat("@"); // ফোন নম্বরের শুরুর 0 থাকবে
  }
  if (sh.getLastColumn() < header.length) sh.getRange(1, 1, 1, header.length).setValues([header]); // নতুন কলাম হেডার
  return sh;
}
function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
function safe_(v, max) {
  v = String(v == null ? "" : v).trim().slice(0, max || 300);
  return /^[=+\-@]/.test(v) ? "'" + v : v;
}
function doGet(e) {
  const prm = (e && e.parameter) || {};
  const rv = sheet_(REVIEW_SHEET, REVIEW_COLS).getDataRange().getValues().slice(1).filter(r => !r[5] || r[5] === "approved");
  if (prm.what === "reviews") {
    return json_(rv.filter(r => String(r[1]) === String(prm.id))
      .map(r => ({name: r[2], rating: Number(r[3]), text: r[4], photo: r[7] || "", verified: r[8] === "yes"})).reverse());
  }
  const st = {};
  rv.forEach(r => { const k = String(r[1]); if (!k) return; st[k] = st[k] || {s:0,n:0}; st[k].s += Number(r[3]) || 0; st[k].n++; });
  const rows = sheet_(PRODUCT_SHEET, COLS).getDataRange().getValues().slice(1);
  return json_(rows.filter(r => r[0] !== "").map(r => {
    const o = Object.fromEntries(COLS.map((c,i) => [c, r[i]])), x = st[String(o.id)];
    o.rating = x ? Math.round(x.s / x.n * 10) / 10 : 0;
    o.rcount = x ? x.n : 0;
    return o;
  }).reverse());
}
function doPost(e) {
  // এডিটর থেকে ভুলে Run চাপলে e থাকে না — পরিষ্কার বার্তা দিয়ে ফেরত যাই
  if (!e || !e.postData) {
    return json_({ok:false, error:"doPost শুধু web app URL-এ POST করলে চলে — এডিটরের Run বাটন দিয়ে নয়"});
  }
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  let adminOk = false;
  try {
    const d = JSON.parse(e.postData.contents);
    if (d.action === "order") return placeOrder_(d.order || {});
    if (d.action === "review") return submitReview_(d.review || {});
    if (d.action === "track") return track_(d.track || {});
    const pc = pwCheck_(d.password); if (!pc.ok) return json_({ok:false, error:pc.error});
    adminOk = true;
    if (d.action === "pendingReviews") {
      const pn = {};
      sheet_(PRODUCT_SHEET, COLS).getDataRange().getValues().slice(1).forEach(x => pn[String(x[0])] = x[1]);
      const out = [];
      sheet_(REVIEW_SHEET, REVIEW_COLS).getDataRange().getValues().forEach((r, i) => {
        if (i > 0 && r[5] === "pending") out.push({row: i + 1, orderId: r[6], product: pn[String(r[1])] || "", name: r[2], rating: Number(r[3]), text: r[4], photo: r[7]});
      });
      return json_({ok:true, list: out});
    }
    if (d.action === "moderate") {
      const rs = sheet_(REVIEW_SHEET, REVIEW_COLS), row = parseInt(d.row, 10);
      if (!(row > 1) || String(rs.getRange(row, 7).getValue()) !== String(d.orderId) || rs.getRange(row, 6).getValue() !== "pending") return json_({ok:false, error:"রিভিউটি পাওয়া যায়নি"});
      rs.getRange(row, 6).setValue(d.decision === "approved" ? "approved" : "rejected");
      return json_({ok:true});
    }
    if (d.action === "addReview") {
      const r = d.review || {}, rating = parseInt(r.rating, 10);
      if (!r.productId || !r.name || !(rating >= 1 && rating <= 5)) return json_({ok:false, error:"নাম ও রেটিং (১-৫) দিন"});
      sheet_(REVIEW_SHEET, REVIEW_COLS).appendRow([Utilities.formatDate(new Date(), "Asia/Dhaka", "yyyy-MM-dd HH:mm:ss"), r.productId, safe_(r.name, 60), rating, safe_(r.text, 500), "approved", "", /^https:\/\/drive\.google\.com\//.test(r.photo || "") ? r.photo : "", ""]);
      return json_({ok:true});
    }
    if (d.action === "upload") {
      if (!d.data || String(d.data).length > 7000000) return json_({ok:false, error:"ছবিটি খুব বড় বা ফাঁকা"});
      const f = folder_().createFile(Utilities.newBlob(Utilities.base64Decode(d.data), "image/jpeg", "p-" + Date.now() + ".jpg"));
      f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      return json_({ok:true, url:"https://drive.google.com/file/d/" + f.getId() + "/view"});
    }
    if (d.action === "orders") {
      const list = sheet_(ORDER_SHEET, ORDER_COLS).getDataRange().getValues().slice(1).filter(r => r[1] !== "").slice(-300).reverse().map(r => ({
        time: Utilities.formatDate(ts_(r[0]), "Asia/Dhaka", "yyyy-MM-dd HH:mm"), orderId: r[1], product: r[3], qty: r[5], total: Number(r[6]) || 0,
        name: r[7], phone: String(r[8]), address: r[9], note: r[10], status: r[11], district: r[12]
      }));
      return json_({ok:true, list: list});
    }
    if (d.action === "setStatus") {
      if (STATUSES.indexOf(d.status) < 0) return json_({ok:false, error:"স্ট্যাটাস সঠিক নয়"});
      const osh = sheet_(ORDER_SHEET, ORDER_COLS), ids = osh.getRange(1, 2, osh.getLastRow(), 1).getValues().flat().map(String);
      const i = ids.indexOf(String(d.orderId));
      if (i < 1) return json_({ok:false, error:"অর্ডারটি পাওয়া যায়নি"});
      osh.getRange(i + 1, 12).setValue(d.status);
      return json_({ok:true});
    }
    /* ── Business tools: expenses · suppliers · packaging · settings ── */
    if (d.action === "bizSave") {
      const t = d.table;
      const def = BIZ_TABLES[t];
      if (!def) return json_({ok:false, error:"অজানা টেবিল"});
      const row = d.row || {};
      if (t === "expenses") {
        if (!row.type || !(Number(row.amount) > 0)) return json_({ok:false, error:"ধরন ও পরিমাণ দিন"});
        row.id = row.id || Utilities.formatDate(new Date(), "Asia/Dhaka", "yyMMdd-HHmmss") + "-" + Math.floor(100 + Math.random() * 900);
        const sh = bizTable_(t);
        const mode = bizUpsertRow_(sh, def.cols, row.id, [row.id, row.time || Utilities.formatDate(new Date(), "Asia/Dhaka", "yyyy-MM-dd HH:mm:ss"), safe_(row.type, 60), Number(row.amount), safe_(row.note, 200)]);
        return json_({ok:true, mode:mode});
      }
      if (t === "suppliers" || t === "packaging") {
        if (!row.name) return json_({ok:false, error:"নাম দিন"});
        row.id = row.id || String(Date.now());
        const sh = bizTable_(t);
        let cols;
        if (t === "suppliers") cols = [row.id, row.time || Utilities.formatDate(new Date(), "Asia/Dhaka", "yyyy-MM-dd HH:mm:ss"), safe_(row.name, 80), safe_(row.phone, 20), Number(row.payable) || 0, safe_(row.note, 200)];
        else cols = [row.id, row.time || Utilities.formatDate(new Date(), "Asia/Dhaka", "yyyy-MM-dd HH:mm:ss"), safe_(row.name, 80), Number(row.qty) || 0, Number(row.per) || 1, Number(row.cost) || 0];
        const mode = bizUpsertRow_(sh, def.cols, row.id, cols);
        return json_({ok:true, mode:mode});
      }
      if (t === "settings") {
        const sh = bizTable_(t);
        const data = Object.entries(row).filter(([k]) => ["cogsPct","shippingIn","shippingOut","courierFeeIn","courierFeeOut"].includes(k));
        data.forEach(([k, v]) => {
          const ids = sh.getRange(1, 1, sh.getLastRow(), 1).getValues().flat();
          const i = ids.indexOf(k);
          if (i > 0) sh.getRange(i + 1, 2).setValue(Number(v));
          else sh.appendRow([k, Number(v)]);
        });
        return json_({ok:true});
      }
      return json_({ok:false, error:"অজানা টেবিল"});
    }
    if (d.action === "bizList") {
      const t = d.table;
      const def = BIZ_TABLES[t];
      if (!def) return json_({ok:false, error:"অজানা টেবিল"});
      if (t === "settings") {
        const kv = {};
        bizTable_(t).getDataRange().getValues().slice(1).forEach(r => { if (r[0] !== "") kv[String(r[0])] = r[1]; });
        return json_({ok:true, list: kv});
      }
      const list = bizTable_(t).getDataRange().getValues().slice(1).filter(r => r[0] !== "").reverse().map(r => {
        if (t === "expenses") return {id:String(r[0]), time:r[1], type:r[2], amount:Number(r[3])||0, note:r[4]||""};
        if (t === "suppliers") return {id:String(r[0]), time:r[1], name:r[2], phone:r[3]||"", payable:Number(r[4])||0, note:r[5]||""};
        return {id:String(r[0]), time:r[1], name:r[2], qty:Number(r[3])||0, per:Number(r[4])||1, cost:Number(r[5])||0};
      });
      return json_({ok:true, list:list});
    }
    if (d.action === "bizDelete") {
      const def = BIZ_TABLES[d.table];
      if (!def) return json_({ok:false, error:"অজানা টেবিল"});
      const sh = bizTable_(d.table);
      const ids = sh.getRange(1, 1, sh.getLastRow(), 1).getValues().flat().map(String);
      const i = ids.indexOf(String(d.id));
      if (i < 1) return json_({ok:false, error:"এন্ট্রি পাওয়া যায়নি"});
      sh.deleteRow(i + 1);
      return json_({ok:true});
    }
    if (d.action === "update") {
      const ush = sheet_(PRODUCT_SHEET, COLS), cur = ush.getDataRange().getValues();
      const i = cur.findIndex((r, k) => k > 0 && String(r[0]) === String(d.id));
      if (i < 0) return json_({ok:false, error:"প্রোডাক্টটি পাওয়া যায়নি"});
      const np = d.product || {};
      ush.getRange(i + 1, 1, 1, COLS.length).setValues([COLS.map((c, k) => c === "id" ? cur[i][0] : (c in np ? np[c] : cur[i][k]))]);
      return json_({ok:true});
    }
    const sh = sheet_(PRODUCT_SHEET, COLS);
    if (d.action === "add") {
      sh.appendRow(COLS.map(c => d.product[c] || ""));
      return json_({ok:true});
    }
    if (d.action === "delete") {
      const ids = sh.getRange(1,1,sh.getLastRow(),1).getValues().flat().map(String);
      const i = ids.indexOf(String(d.id));
      if (i > 0) sh.deleteRow(i + 1);
      return json_({ok:true});
    }
    return json_({ok:false, error:"অজানা action"});
  } catch (err) {
    console.error(err && err.stack || err); // Apps Script > Executions-এ আসল কারণ দেখা যাবে
    return json_({ok:false, error:"সার্ভারে সমস্যা হয়েছে" + (adminOk ? " (" + err.message + ")" : "")});
  } finally { lock.releaseLock(); }
}
function placeOrder_(o) {
  if (ORDER_SPREADSHEET_ID.indexOf("এখানে") === 0) return json_({ok:false, error:"অর্ডার শিটের ID সেট করা হয়নি"});
  if (o.website) return json_({ok:true, orderId:"ORD-OK", total:0}); // লুকানো ঘর ভরা থাকলে এটা বট
  const bad = m => json_({ok:false, error:m});
  const phone = String(o.phone || "").replace(/[\s-]/g, "");
  const fee = DELIVERY_FEE[o.delivery];
  if (!o.name || !o.address || String(o.address).length < 5) return bad("নাম ও ঠিকানা সঠিকভাবে দিন");
  if (!o.district) return bad("জেলা নির্বাচন করুন");
  if (fee === undefined) return bad("ডেলিভারি অপশন বেছে নিন");
  if (!/^01[3-9]\d{8}$/.test(phone)) return bad("মোবাইল নম্বর সঠিক নয়");

  // একটা পণ্য (productId + qty) অথবা কার্টের একাধিক পণ্য (items)
  const want = Array.isArray(o.items) && o.items.length ? o.items : [{productId:o.productId, qty:o.qty}];
  if (want.length > 20) return bad("একসঙ্গে সর্বোচ্চ ২০টি পণ্য অর্ডার করা যায়");
  const merged = {};
  want.forEach(it => { const k = String(it.productId); merged[k] = (merged[k] || 0) + (parseInt(it.qty, 10) || 0); });

  // দাম ও স্টক Products শিট থেকে (ব্রাউজারের দাম বিশ্বাস করা হয় না)
  const psh = sheet_(PRODUCT_SHEET, COLS), prow = psh.getDataRange().getValues();
  const rowOf = {}; prow.forEach((r, i) => { if (i > 0) rowOf[String(r[0])] = i; });
  const sc = COLS.indexOf("stock");
  const lines = []; let subtotal = 0, totalQty = 0;
  for (const k in merged) {
    const qty = merged[k];
    if (!(qty >= 1 && qty <= 20)) return bad("পরিমাণ ১ থেকে ২০ এর মধ্যে দিন");
    const ri = rowOf[k]; if (ri === undefined) return bad("প্রোডাক্টটি পাওয়া যায়নি");
    const r = prow[ri], stock = r[sc];
    if (soldOut_(stock)) return bad(r[1] + " — স্টক শেষ");
    const sn = stockNum_(stock);
    if (sn !== null && qty > sn) return bad(r[1] + " — স্টকে মাত্র " + sn + " টি আছে");
    lines.push({row: ri + 1, id: r[0], name: r[1], price: Number(r[2]), qty: qty, sn: sn});
    subtotal += Number(r[2]) * qty; totalQty += qty;
  }

  // ভুয়া ও বারবার অর্ডার ঠেকানো
  const tz = "Asia/Dhaka", now = new Date();
  const orders = sheet_(ORDER_SHEET, ORDER_COLS).getDataRange().getValues().slice(1).filter(x => x[1] !== "");
  const summary = lines.map(l => l.name + (l.qty > 1 ? " ×" + l.qty : "")).join(", ");
  const ph10 = phone.slice(-10), today = Utilities.formatDate(now, tz, "yyyy-MM-dd");
  const mine = orders.filter(x => String(x[8]).replace(/\D/g, "").slice(-10) === ph10);
  if (orders.filter(x => now - ts_(x[0]) < 3600000).length >= MAX_ORDERS_PER_HOUR) return bad("এখন অনেক অর্ডার আসছে, কিছুক্ষণ পরে চেষ্টা করুন");
  if (mine.filter(x => Utilities.formatDate(ts_(x[0]), tz, "yyyy-MM-dd") === today).length >= MAX_ORDERS_PER_PHONE_DAY) return bad("আজকের জন্য এই নম্বরে অর্ডারের সীমা পূর্ণ হয়েছে। WhatsApp-এ যোগাযোগ করুন");
  if (mine.some(x => now - ts_(x[0]) < DUP_WINDOW_MIN * 60000 && String(x[3]) === summary)) return bad("এই অর্ডারটি এইমাত্র গৃহীত হয়েছে। আমাদের প্রতিনিধি ফোন করবেন");

  const total = subtotal + fee;
  const orderId = "ORD-" + Utilities.formatDate(now, tz, "yyMMdd-HHmmss") + "-" + Math.floor(100 + Math.random() * 900);
  const osh = sheet_(ORDER_SHEET, ORDER_COLS);
  osh.appendRow([
    Utilities.formatDate(now, tz, "yyyy-MM-dd HH:mm:ss"), orderId, lines[0].id, summary, lines.length === 1 ? lines[0].price : subtotal, totalQty, total,
    safe_(o.name, 80), phone, safe_(o.address, 300), safe_(o.note, 200), "নতুন", safe_(o.district, 40), fee, SITE_URL + "review.html?o=" + orderId,
    JSON.stringify(lines.map(l => ({id: l.id, name: l.name, price: l.price, qty: l.qty})))
  ]);
  osh.getRange(osh.getLastRow(), 12).setDataValidation(statusRule_());
  lines.forEach(l => { if (l.sn !== null) psh.getRange(l.row, sc + 1).setValue(Math.max(l.sn - l.qty, 0)); }); // স্টক কমানো

  if (ADMIN_EMAIL) {
    try {
      MailApp.sendEmail(ADMIN_EMAIL, "নতুন অর্ডার " + orderId + " — ৳" + total,
        "অর্ডার: " + orderId + "\nপণ্য: " + summary + "\nমোট: ৳" + total + " (ডেলিভারি ৳" + fee + " সহ)\n\nনাম: " + o.name + "\nমোবাইল: " + phone +
        "\nজেলা: " + o.district + "\nঠিকানা: " + o.address + (o.note ? "\nনোট: " + o.note : ""));
    } catch (err) { console.error("mail: " + err); } // ইমেইল না গেলেও অর্ডার জমা থাকে
  }
  return json_({ok:true, orderId: orderId, total: total});
}

// ছবি Drive-এর "ShopImages" ফোল্ডারে জমা হয় (না থাকলে নিজে বানায়)
function folder_() {
  const it = DriveApp.getFoldersByName("ShopImages");
  return it.hasNext() ? it.next() : DriveApp.createFolder("ShopImages");
}
// একবার Run করে Drive-এর অনুমতি দিন (উপরের তালিকা থেকে "authorize" বেছে Run চাপুন)
function authorize() { DriveApp.getRootFolder(); folder_(); MailApp.getRemainingDailyQuota(); }

// স্ট্যাটাস কলামে ড্রপডাউন (নতুন অর্ডারে নিজে থেকেই বসে)
function statusRule_() {
  return SpreadsheetApp.newDataValidation().requireValueInList(STATUSES, true).setAllowInvalid(false).build();
}
// আগের অর্ডারগুলোতেও ড্রপডাউন বসাতে একবার Run করুন
function setupStatusDropdown() {
  const sh = sheet_(ORDER_SHEET, ORDER_COLS);
  sh.getRange(2, 12, Math.max(sh.getMaxRows() - 1, 1), 1).setDataValidation(statusRule_());
}
// ক্রেতার রিভিউ: অর্ডার নম্বর + মোবাইল মিলতে হবে এবং স্ট্যাটাস "ডেলিভারড" হতে হবে
function submitReview_(r) {
  const rating = parseInt(r.rating, 10), phone = String(r.phone || "").replace(/\D/g, "").slice(-10), oid = String(r.orderId || "").trim();
  if (!oid || phone.length < 10) return json_({ok:false, error:"অর্ডার নম্বর ও মোবাইল নম্বর দিন"});
  if (!r.name || !(rating >= 1 && rating <= 5)) return json_({ok:false, error:"নাম ও রেটিং দিন"});
  const o = sheet_(ORDER_SHEET, ORDER_COLS).getDataRange().getValues().slice(1)
    .find(x => String(x[1]).trim() === oid && String(x[8]).replace(/\D/g, "").slice(-10) === phone);
  if (!o) return json_({ok:false, error:"অর্ডার নম্বর বা মোবাইল নম্বর মেলেনি"});
  if (String(o[11]).trim() !== DELIVERED) return json_({ok:false, error:"অর্ডার ডেলিভারি হওয়ার পর রিভিউ দিতে পারবেন"});
  const sh = sheet_(REVIEW_SHEET, REVIEW_COLS);
  if (sh.getDataRange().getValues().slice(1).some(x => String(x[6]) === oid)) return json_({ok:false, error:"এই অর্ডারের রিভিউ আগেই দেওয়া হয়েছে"});
  let photo = "", photoFailed = false;
  if (r.photo) {
    try {
      if (String(r.photo).length > 3000000) throw new Error("ছবি খুব বড়");
      const f = folder_().createFile(Utilities.newBlob(Utilities.base64Decode(r.photo), "image/jpeg", "r-" + Date.now() + ".jpg"));
      try { f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e2) { f.setTrashed(true); throw e2; }
      photo = "https://drive.google.com/file/d/" + f.getId() + "/view";
    } catch (err) { console.error("review photo: " + err); photoFailed = true; } // ছবি না গেলেও রিভিউ জমা হবে
  }
  sh.appendRow([Utilities.formatDate(new Date(), "Asia/Dhaka", "yyyy-MM-dd HH:mm:ss"), o[2], safe_(r.name, 60), rating, safe_(r.text, 500), "pending", oid, photo, "yes"]);
  return json_({ok:true, photoFailed: photoFailed});
}

// ===== সাহায্যকারী ফাংশন =====
function ts_(v) { return v instanceof Date ? v : new Date(String(v).replace(" ", "T") + "+06:00"); }
function soldOut_(stock) { const t = String(stock == null ? "" : stock).trim().toLowerCase(); return t === "0" || t === "out" || t === "শেষ"; }
function stockNum_(stock) { const t = String(stock == null ? "" : stock).trim(); const n = Number(t); return t !== "" && !isNaN(n) ? n : null; }
// অ্যাডমিন পাসওয়ার্ডে বারবার ভুল দিলে ১৫ মিনিট বন্ধ (৮ বার ভুলের পর)
function pwCheck_(pw) {
  const cache = CacheService.getScriptCache(), fails = Number(cache.get("pwfail") || 0);
  if (fails >= 8) return {ok:false, error:"অনেকবার ভুল পাসওয়ার্ড দেওয়া হয়েছে। ১৫ মিনিট পরে চেষ্টা করুন"};
  if (pw === ADMIN_PASSWORD) { cache.remove("pwfail"); return {ok:true}; }
  cache.put("pwfail", String(fails + 1), 900);
  Utilities.sleep(1500);
  return {ok:false, error:"পাসওয়ার্ড ভুল"};
}
// ক্রেতার অর্ডার ট্র্যাক: অর্ডার নম্বর + মোবাইল মিলতে হবে
function track_(t) {
  const oid = String(t.orderId || "").trim(), ph = String(t.phone || "").replace(/\D/g, "").slice(-10);
  if (!oid || ph.length < 10) return json_({ok:false, error:"অর্ডার নম্বর ও মোবাইল নম্বর দিন"});
  const cache = CacheService.getScriptCache(), key = "trk" + oid, tries = Number(cache.get(key) || 0);
  if (tries >= 10) return json_({ok:false, error:"অনেকবার চেষ্টা করা হয়েছে, কিছুক্ষণ পরে আবার দেখুন"});
  const o = sheet_(ORDER_SHEET, ORDER_COLS).getDataRange().getValues().slice(1)
    .find(x => String(x[1]).trim() === oid && String(x[8]).replace(/\D/g, "").slice(-10) === ph);
  if (!o) { cache.put(key, String(tries + 1), 900); return json_({ok:false, error:"অর্ডার নম্বর বা মোবাইল নম্বর মেলেনি"}); }
  return json_({ok:true, status:o[11], time:Utilities.formatDate(ts_(o[0]), "Asia/Dhaka", "yyyy-MM-dd HH:mm"), product:o[3], total:Number(o[6]) || 0, district:o[12]});
}
