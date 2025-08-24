// Utilities
const $ = (sel, parent = document) => parent.querySelector(sel);
const $$ = (sel, parent = document) => Array.from(parent.querySelectorAll(sel));

/* ---------- Toast ---------- */
function toast(message){
  const t = document.createElement('div');
  t.textContent = message;
  Object.assign(t.style,{
    position:'fixed', inset:'auto 16px 16px auto',
    background:'linear-gradient(135deg, #00c853, #00a147)',
    color:'#07140c', padding:'10px 14px', borderRadius:'12px',
    boxShadow:'0 10px 24px rgba(0,200,83,.25)', zIndex:2000, fontWeight:'700'
  });
  document.body.appendChild(t);
  setTimeout(()=>{ t.style.transition='opacity .3s ease'; t.style.opacity='0'; }, 1400);
  setTimeout(()=> t.remove(), 1750);
}

/* ---------- Sidebar ---------- */
const sidebar = $('#sidebar');
const toolsBtn = $('#toolsBtn');
const closeSidebarBtn = $('#closeSidebar');
const openTools2 = $('#openTools2');
const openTools3 = $('#openTools3');

function openSidebar(){
  sidebar.classList.add('show');
  sidebar.setAttribute('aria-hidden','false');
  toolsBtn?.setAttribute('aria-expanded','true');
  // Immediate price check when opening wishlist
  simulatePriceTick();
  // Gently request notifications on first open
  if('Notification' in window && Notification.permission === 'default'){
    Notification.requestPermission().then(p=>{ if(p === 'granted') toast('Notifications enabled'); });
  }
}
function hideSidebar(){
  sidebar.classList.remove('show');
  sidebar.setAttribute('aria-hidden','true');
  toolsBtn?.setAttribute('aria-expanded','false');
}
toolsBtn?.addEventListener('click', openSidebar);
openTools2?.addEventListener('click', openSidebar);
openTools3?.addEventListener('click', openSidebar);
closeSidebarBtn?.addEventListener('click', hideSidebar);
window.addEventListener('keydown', (e)=>{ if(e.key==='Escape') hideSidebar(); });

/* ---------- Contact Form ---------- */
const contactForm = $('#contactForm');
contactForm?.addEventListener('submit', (e)=>{
  e.preventDefault();
  const name = $('#name').value.trim();
  const email = $('#email').value.trim();
  const message = $('#message').value.trim();
  const fm = $('#formMessage');

  if(!name || !email || !message){
    fm.textContent = '⚠️ All fields are required.';
    fm.style.color = '#ffb4b4';
    return;
  }
  const emailOk = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email);
  if(!emailOk){
    fm.textContent = '⚠️ Please enter a valid email address.';
    fm.style.color = '#ffb4b4';
    return;
  }
  fm.textContent = '✅ Message sent successfully!';
  fm.style.color = '#b6f3c9';
  contactForm.reset();
});

/* ---------- Image fallback loader (for card images) ---------- */
function loadWithFallback(imgEl){
  let list = [];
  try { list = JSON.parse(imgEl.getAttribute('data-srcs')); } catch(e) { return; }
  if (!Array.isArray(list) || !list.length) return;

  let i = 0;
  const tryNext = () => {
    if (i >= list.length) return; // give up silently
    const test = new Image();
    test.onload = () => { imgEl.src = list[i]; };
    test.onerror = () => { i++; tryNext(); };
    test.referrerPolicy = 'no-referrer';
    test.src = list[i];
  };
  tryNext();
}
document.querySelectorAll('.remote-img').forEach(loadWithFallback);

/* ---------- IntersectionObserver reveals (animations) ---------- */
const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if(!prefersReduced){
  const io = new IntersectionObserver((entries)=>{
    entries.forEach(entry=>{
      if(entry.isIntersecting){
        entry.target.classList.add('reveal-in');
        io.unobserve(entry.target);
      }
    });
  }, {threshold: 0.18});
  $$('.hero-img, .status, .reveal').forEach(el => io.observe(el));
  setTimeout(()=> { if (document.hasFocus()) toast("Welcome to ProGadget ✨"); }, 600);
}

/* ============================================================
   SMART WISHLIST / PRICE TRACKER (localStorage + simulated feed)
   ============================================================ */
const WL_KEY = 'progadget.wishlist.v1';
const wishlistEl = $('#wishlist');
const addCustomBtn = $('#addCustom');
const refreshBtn = $('#refreshPrices');
const clearBtn = $('#clearWishlist');
const notifBtn = $('#enableNotifs');

// helpers
const rupee = (n) => `₹${Number(n).toLocaleString('en-IN')}`;
const nowTs = () => new Date().toISOString();

function loadWishlist(){ return JSON.parse(localStorage.getItem(WL_KEY) || '[]'); }
function saveWishlist(items){ localStorage.setItem(WL_KEY, JSON.stringify(items)); }

function iconFor(imgKey){
  const map = { smartphone:'📱', headphones:'🎧', laptop:'💻', watch:'⌚', cable:'🔌' };
  return map[imgKey] || '🛒';
}

function upsertItem(item){
  const list = loadWishlist();
  const idx = list.findIndex(x => x.id === item.id);
  if(idx >= 0){ list[idx] = {...list[idx], ...item}; }
  else { list.push(item); }
  saveWishlist(list);
  renderWishlist();
}

function removeItem(id){
  const list = loadWishlist().filter(x => x.id !== id);
  saveWishlist(list);
  renderWishlist();
}

function renderWishlist(){
  const list = loadWishlist();
  wishlistEl.innerHTML = '';
  if(list.length === 0){
    const li = document.createElement('li');
    li.className = 'helper';
    li.style.listStyle = 'none';
    li.textContent = 'Your wishlist is empty. Add from product cards or create a custom item.';
    wishlistEl.appendChild(li);
    return;
  }

  list.forEach(item => {
    const li = document.createElement('li');
    li.className = 'wl-item';
    li.innerHTML = `
      <div class="thumb">${iconFor(item.img)}</div>
      <div class="name">${item.name}</div>
      <div class="curr" title="Current price">${rupee(item.currentPrice)}</div>
      <div class="target">
        <input type="number" min="0" value="${item.targetPrice}" aria-label="Target price for ${item.name}">
      </div>
      <div class="actions">
        <button class="btn del">Delete</button>
      </div>
    `;
    li.querySelector('.del').addEventListener('click', () => removeItem(item.id));
    li.querySelector('input').addEventListener('change', (e) => {
      const next = {...item, targetPrice: Number(e.target.value || 0)};
      upsertItem(next);
      simulatePriceTick(); // immediate check on target change
    });

    if(item.currentPrice <= item.targetPrice && item.targetPrice > 0){
      const drop = document.createElement('div');
      drop.className = 'drop';
      drop.textContent = 'Price reached!';
      li.appendChild(drop);
    }
    wishlistEl.appendChild(li);
  });
}

/* ---------- Add from cards ---------- */
$$('.add-wishlist').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    const id = btn.dataset.id;
    const name = btn.dataset.name;
    const img = btn.dataset.img;
    const basePrice = Number(btn.dataset.price);
    const item = {
      id, name, img,
      currentPrice: basePrice,
      targetPrice: Math.round(basePrice * 0.9), // default target = 10% off
      lastUpdated: nowTs()
    };
    upsertItem(item);
    toast(`Added to wishlist: ${name}`);
    openSidebar();
    simulatePriceTick(); // immediate check after adding
  });
});

/* ---------- Add custom from sidebar ---------- */
addCustomBtn?.addEventListener('click', ()=>{
  const name = $('#wlName').value.trim();
  const price = Number($('#wlPrice').value);
  const target = Number($('#wlTarget').value);
  if(!name || !price){
    toast('Enter name and current price'); return;
  }
  const id = `custom_${Date.now()}`;
  upsertItem({
    id, name, img:'watch',
    currentPrice: price,
    targetPrice: target || Math.round(price * 0.9),
    lastUpdated: nowTs()
  });
  $('#wlName').value = ''; $('#wlPrice').value = ''; $('#wlTarget').value = '';
  simulatePriceTick(); // immediate
});

/* ---------- Clear all ---------- */
clearBtn?.addEventListener('click', ()=>{
  saveWishlist([]);
  renderWishlist();
  toast('Wishlist cleared');
});

/* ---------- Adjustable ticker (Fast Mode supported) ---------- */
let tickMs = 5000;         // default: 5s checks
let driftMax = 0.05;       // default: ±5% movement
let tickTimer = null;

function startTicker(){
  if(tickTimer) clearInterval(tickTimer);
  tickTimer = setInterval(simulatePriceTick, tickMs);
}

/* ---------- Simulated price feed ---------- */
function simulatePriceTick(){
  const list = loadWishlist();
  let changed = false;
  const next = list.map(item=>{
    const drift = (Math.random() * 2 * driftMax) - driftMax; // -driftMax .. +driftMax
    const newPrice = Math.max(1, Math.round(item.currentPrice * (1 + drift)));
    if(newPrice !== item.currentPrice){ changed = true; }
    return {...item, currentPrice: newPrice, lastUpdated: nowTs()};
  });
  if(changed){
    saveWishlist(next);
    renderWishlist();
    next.forEach(item=>{
      if(item.targetPrice > 0 && item.currentPrice <= item.targetPrice){
        alertUser(`Price drop: ${item.name} is now ${rupee(item.currentPrice)} (target ${rupee(item.targetPrice)})`);
      }
    });
  }
}

function alertUser(message){
  toast(message);
  if('Notification' in window && Notification.permission === 'granted'){
    try { new Notification('ProGadget Price Alert', { body: message }); } catch {}
  }
}

/* ---------- Manual refresh + start ticker ---------- */
refreshBtn?.addEventListener('click', simulatePriceTick);
renderWishlist();
startTicker(); // start background checks

/* ---------- Notifications permission ---------- */
notifBtn?.addEventListener('click', async ()=>{
  if(!('Notification' in window)) { toast('Notifications not supported'); return; }
  if(Notification.permission === 'denied'){ toast('Notifications are blocked in the browser'); return; }
  const perm = await Notification.requestPermission();
  if(perm === 'granted'){ toast('Notifications enabled'); }
  else { toast('Notifications not enabled'); }
});

/* ---------- Fast Mode + Test Alert ---------- */
const fastMode = $('#fastMode');
fastMode?.addEventListener('change', ()=>{
  if(fastMode.checked){
    tickMs = 2000;      // 2s
    driftMax = 0.15;    // ±15% for quicker drops
    toast('Fast Mode ON');
  } else {
    tickMs = 5000;      // 5s
    driftMax = 0.05;    // ±5%
    toast('Fast Mode OFF');
  }
  startTicker();
  simulatePriceTick();  // immediate check
});

const testBtn = $('#testAlert');
testBtn?.addEventListener('click', ()=>{
  let list = loadWishlist();
  if(list.length === 0){
    list = [{
      id: 'demo_item',
      name: 'ProGadget Demo',
      img: 'smartphone',
      currentPrice: 4999,
      targetPrice: 4500,
      lastUpdated: nowTs()
    }];
  }
  // Force a drop on the first item
  list[0].targetPrice = list[0].targetPrice || Math.round(list[0].currentPrice * 0.95);
  list[0].currentPrice = Math.max(1, list[0].targetPrice - 1);
  saveWishlist(list);
  renderWishlist();
  alertUser(`Price drop: ${list[0].name} is now ${rupee(list[0].currentPrice)} (target ${rupee(list[0].targetPrice)})`);
});
