/* নতুন পেজ যোগ করতে: ১) নতুন .html ফাইল বানান ২) নিচের PAGES-এ এক লাইন যোগ করুন */
const PAGES=[{href:"index.html",label:"হোম"},{href:"index.html#products",label:"কালেকশন"},{href:"about.html",label:"আমাদের সম্পর্কে"}];
const SHOP_NAME="আমার দোকান";
const SITE_BASE="https://gaziabdulahad.github.io/Shop/"; // অ্যাডমিন repo-তে এখানে মূল সাইটের পুরো ঠিকানা বসে
const API_URL="https://script.google.com/macros/s/AKfycbwVQNjU_ywicX7aVD6sBwtsxChbdVzd5YulQOJuJNn2FaJThgcHfxOFxlDsUMu1K_mQ/exec"; // Apps Script Web App URL
const DELIVERY={in:{label:"ঢাকার ভিতরে",fee:60},out:{label:"ঢাকার বাইরে",fee:120}}; // Code.gs-এর DELIVERY_FEE-এর সাথে মিল রাখুন
const TRUST=[["🚚","সারাদেশে ডেলিভারি"],["💵","ক্যাশ অন ডেলিভারি"],["✅","কোয়ালিটি চেক করা"],["💬","কাস্টমার সাপোর্ট"]]; // নিজের সত্যি তথ্য অনুযায়ী বদলান
const DISTRICTS="ঢাকা,গাজীপুর,নারায়ণগঞ্জ,নরসিংদী,মানিকগঞ্জ,মুন্সীগঞ্জ,কিশোরগঞ্জ,টাঙ্গাইল,ফরিদপুর,গোপালগঞ্জ,মাদারীপুর,রাজবাড়ী,শরীয়তপুর,চট্টগ্রাম,কক্সবাজার,কুমিল্লা,ব্রাহ্মণবাড়িয়া,চাঁদপুর,ফেনী,নোয়াখালী,লক্ষ্মীপুর,খাগড়াছড়ি,রাঙ্গামাটি,বান্দরবান,সিলেট,হবিগঞ্জ,মৌলভীবাজার,সুনামগঞ্জ,রাজশাহী,নাটোর,নওগাঁ,চাঁপাইনবাবগঞ্জ,পাবনা,সিরাজগঞ্জ,বগুড়া,জয়পুরহাট,খুলনা,বাগেরহাট,সাতক্ষীরা,যশোর,ঝিনাইদহ,মাগুরা,নড়াইল,কুষ্টিয়া,চুয়াডাঙ্গা,মেহেরপুর,বরিশাল,ভোলা,পটুয়াখালী,পিরোজপুর,ঝালকাঠি,বরগুনা,রংপুর,দিনাজপুর,গাইবান্ধা,কুড়িগ্রাম,লালমনিরহাট,নীলফামারী,পঞ্চগড়,ঠাকুরগাঁও,ময়মনসিংহ,জামালপুর,নেত্রকোণা,শেরপুর".split(",");

const tk=n=>"৳"+Number(n||0).toLocaleString("en-US");
function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function ytId(url){const m=String(url||"").match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([\w-]{11})/);return m?m[1]:null}
function imgURL(u,w){const m=String(u||"").match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:.*&)?id=|thumbnail\?(?:.*&)?id=)([\w-]+)/);return m?`https://drive.google.com/thumbnail?id=${m[1]}&sz=w${w||1000}`:u}
function imgFail(el){if(el.dataset.f)return;el.dataset.f=1;const m=el.src.match(/[?&]id=([\w-]+)/);if(m)el.src="https://lh3.googleusercontent.com/d/"+m[1]+"=w1600"}
function imgList(p){return String(p.image||"").split(/[\s,|]+/).filter(Boolean)}
function cover(p){const a=imgList(p)[0];if(a)return imgURL(a,700);const v=ytId(p.video);return v?`https://img.youtube.com/vi/${v}/hqdefault.jpg`:""}
function off(p){const o=Number(p.oldprice),n=Number(p.price);return o>n?Math.round((o-n)/o*100):0}
function priceHTML(p){const d=off(p);return `<div class="pr"><span class="price">${tk(p.price)}</span>${d?`<s class="old">${tk(p.oldprice)}</s><span class="off">${d}% OFF</span>`:""}</div>`}

function stars(n){const r=Math.round(n);return `<span class="stars" aria-label="${n} / 5">${"★".repeat(r)}<i>${"★".repeat(5-r)}</i></span>`}
function ratingHTML(p){return Number(p.rcount)>0?`<div class="rate">${stars(p.rating)} <b>${p.rating}</b> <span>(${p.rcount})</span></div>`:""}
async function getReviews(id){const r=await fetch(API_URL+"?what=reviews&id="+encodeURIComponent(id));const d=await r.json();return Array.isArray(d)?d:[]}
async function getProducts(){const r=await fetch(API_URL);const d=await r.json();return Array.isArray(d)?d:[]}
async function api(body){const r=await fetch(API_URL,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify(body)});return r.json()}
let _c=null;
async function loadAll(force){if(!_c||force)_c=await getProducts();return _c}

function cardHTML(p,admin){
  const c=cover(p),d=off(p),url=SITE_BASE+"product.html?id="+encodeURIComponent(p.id);
  return `<article class="card"><a class="cimg" href="${url}" aria-label="${esc(p.name)}">${c?`<img src="${esc(c)}" alt="${esc(p.name)}" loading="lazy" referrerpolicy="no-referrer" onerror="imgFail(this)">`:""}${d?`<span class="badge">-${d}%</span>`:""}</a>
  <div class="body"><h3><a href="${url}">${esc(p.name)}</a></h3>${ratingHTML(p)}${priceHTML(p)}
  ${admin?`<button class="btn alt" data-del="${esc(p.id)}">মুছে ফেলুন</button>`:`<a class="btn gold" href="${SITE_BASE}order.html?id=${encodeURIComponent(p.id)}">এখনই অর্ডার করুন</a>`}</div></article>`;
}
async function renderList(el,admin,q,cat){
  if(!_c)el.innerHTML=Array(6).fill('<div class="card sk"><div class="sk-i"></div><div class="body"><i></i><i></i><i></i></div></div>').join("");
  try{
    const all=await loadAll(admin),t=(q||"").toLowerCase();
    const l=all.filter(p=>(!cat||p.category===cat)&&(!t||(p.name+" "+(p.desc||"")).toLowerCase().includes(t)));
    el.innerHTML=l.length?l.map(p=>cardHTML(p,admin)).join(""):`<div class="empty" style="grid-column:1/-1">${q||cat?"কোনো প্রোডাক্ট পাওয়া যায়নি।":"এখনও কোনো প্রোডাক্ট নেই।"}</div>`;
  }catch(e){el.innerHTML=`<div class="empty" style="grid-column:1/-1">প্রোডাক্ট লোড করা যায়নি। ইন্টারনেট বা API_URL ঠিক আছে কিনা দেখুন।</div>`}
}
function videoBlock(el,p){
  const v=ytId(p.video);if(!v){el.remove();return}
  const yt="https://www.youtube.com/watch?v="+v;
  el.innerHTML=`<h2 class="sec">প্রোডাক্ট ভিডিও</h2><div class="vbox"><button class="vplay" aria-label="ভিডিও চালান"><img src="https://img.youtube.com/vi/${v}/hqdefault.jpg" alt=""><span class="play big">&#9654;</span></button></div><p class="hint">ভিডিও চলছে না? <a href="${yt}" target="_blank" rel="noopener">YouTube-এ দেখুন</a></p>`;
  el.querySelector(".vplay").onclick=()=>{
    if(location.protocol==="file:"){open(yt,"_blank");return}
    el.querySelector(".vbox").innerHTML=`<iframe src="https://www.youtube-nocookie.com/embed/${v}?autoplay=1" title="${esc(p.name)}" referrerpolicy="strict-origin-when-cross-origin" allow="autoplay; encrypted-media; picture-in-picture; web-share" allowfullscreen></iframe>`;
  };
}
function layout(){
  const cur=location.pathname.split("/").pop()||"index.html";
  document.body.insertAdjacentHTML("afterbegin",`<header class="site"><div class="wrap"><a class="logo" href="${SITE_BASE}index.html">${SHOP_NAME}</a><button class="burger" aria-label="মেনু" aria-expanded="false">☰</button><nav aria-label="প্রধান মেনু">${PAGES.map(p=>`<a href="${SITE_BASE}${p.href}" class="${p.href===cur?"on":""}">${p.label}</a>`).join("")}</nav></div></header>`);
  const b=document.querySelector(".burger");
  b.onclick=()=>{const o=document.body.classList.toggle("menu");b.setAttribute("aria-expanded",o);b.textContent=o?"✕":"☰"};
  document.body.insertAdjacentHTML("beforeend",`<footer class="site"><div class="wrap"><strong>${SHOP_NAME}</strong><br>© ${new Date().getFullYear()} All Rights Reserved</div></footer>`);
}

function openLightbox(urls,start){
  let k=start,z=false;
  const lb=document.createElement("div");lb.className="lb";lb.setAttribute("role","dialog");lb.setAttribute("aria-label","ছবি জুম");
  lb.innerHTML=`<button class="lbx" aria-label="বন্ধ করুন">&times;</button>${urls.length>1?'<button class="nav prev" aria-label="আগের">&#10094;</button><button class="nav next" aria-label="পরের">&#10095;</button>':''}<div class="lbimg"><img alt=""></div>`;
  document.body.appendChild(lb);document.body.style.overflow="hidden";
  const box=lb.querySelector(".lbimg"),im=lb.querySelector("img");
  function set(n){k=(n+urls.length)%urls.length;z=false;delete im.dataset.f;im.classList.remove("z");im.style.transformOrigin="";im.src=imgURL(urls[k],2000)}
  function close(){lb.remove();document.body.style.overflow="";document.removeEventListener("keydown",key)}
  function key(e){if(e.key==="Escape")close();else if(e.key==="ArrowLeft")set(k-1);else if(e.key==="ArrowRight")set(k+1)}
  im.addEventListener("click",()=>{z=!z;im.classList.toggle("z",z)});
  box.addEventListener("pointermove",e=>{if(!z)return;const r=box.getBoundingClientRect();im.style.transformOrigin=((e.clientX-r.left)/r.width*100)+"% "+((e.clientY-r.top)/r.height*100)+"%"});
  lb.addEventListener("click",e=>{if(e.target.closest(".prev"))set(k-1);else if(e.target.closest(".next"))set(k+1);else if(e.target.closest(".lbx"))close()});
  im.onerror=()=>imgFail(im);document.addEventListener("keydown",key);set(k);
}
function initGallery(root,p){
  const items=[],v=ytId(p.video);
  if(v)items.push({t:"v",id:v});
  imgList(p).forEach(u=>items.push({t:"i",u}));
  if(!items.length){root.innerHTML=`<div class="empty" style="border:0">ছবি/ভিডিও নেই</div>`;return}
  const many=items.length>1,hasImg=items.some(x=>x.t==="i");
  root.className="gal";
  root.innerHTML=`<div class="stage"><div class="view"></div>${many?'<button class="nav prev" aria-label="আগের">&#10094;</button><button class="nav next" aria-label="পরের">&#10095;</button>':''}</div>`+
   (many?`<div class="thumbs">${items.map((it,n)=>`<button class="th" data-n="${n}" aria-label="মিডিয়া ${n+1}">${it.t==="v"?`<img src="https://img.youtube.com/vi/${it.id}/mqdefault.jpg" alt=""><span class="play">&#9654;</span>`:`<img src="${esc(imgURL(it.u,300))}" alt="" loading="lazy" onerror="imgFail(this)">`}</button>`).join("")}</div>`:"")+
   '<p class="hint"></p>';
  const view=root.querySelector(".view"),hint=root.querySelector(".hint"),tb=root.querySelector(".thumbs"),ths=root.querySelectorAll(".th");let i=0;
  function show(n){
    i=(n+items.length)%items.length;const it=items[i];
    const yt=it.t==="v"?"https://www.youtube.com/watch?v="+it.id:"";
    view.innerHTML=it.t==="v"?(location.protocol==="file:"?`<a class="ytposter" href="${yt}" target="_blank" rel="noopener"><img src="https://img.youtube.com/vi/${it.id}/hqdefault.jpg" alt="${esc(p.name)}"><span class="play big">&#9654;</span></a>`:`<iframe src="https://www.youtube-nocookie.com/embed/${it.id}" title="${esc(p.name)}" referrerpolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`):`<img src="${esc(imgURL(it.u,1000))}" alt="${esc(p.name)}" referrerpolicy="no-referrer" style="cursor:zoom-in" onerror="imgFail(this)">`;
    hint.innerHTML=it.t==="v"?`ভিডিও চলছে না? <a href="${yt}" target="_blank" rel="noopener">YouTube-এ দেখুন</a>`:"জুম করতে ছবিতে ক্লিক করুন";
    ths.forEach((b,k)=>b.classList.toggle("on",k===i));
    if(tb)tb.scrollTo({left:ths[i].offsetLeft-tb.clientWidth/2+ths[i].clientWidth/2,behavior:"smooth"});
  }
  root.addEventListener("click",e=>{
    const t=e.target.closest(".th");
    if(t)show(+t.dataset.n);
    else if(e.target.closest(".prev"))show(i-1);
    else if(e.target.closest(".next"))show(i+1);
    else if(e.target.tagName==="IMG"&&items[i].t==="i"&&view.contains(e.target)){const urls=items.filter(x=>x.t==="i").map(x=>x.u);openLightbox(urls,urls.indexOf(items[i].u))}
  });
  show(0);
}

layout();
