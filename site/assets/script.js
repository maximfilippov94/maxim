// ── Яндекс.Метрика — цели ──────────────────────────────────────────────
function ymGoal(target, params){
  try {
    if(typeof ym === 'function') ym(109475188, 'reachGoal', target, params||{});
  } catch(e){}
}

let cart = JSON.parse(localStorage.getItem('luka_cart') || '[]');
const fmt = n => new Intl.NumberFormat('ru-RU').format(Number(n || 0)) + ' ₽';
function saveCart(){ localStorage.setItem('luka_cart', JSON.stringify(cart)); renderCart(); }
function showToast(message='Добавлено в корзину'){ const t=document.getElementById('cartToast'); if(!t) return; t.textContent=message; t.classList.add('show'); clearTimeout(window.__cartToastTimer); window.__cartToastTimer=setTimeout(()=>t.classList.remove('show'),1800); }
function addToCart(p, btn){
  const item=cart.find(x=>String(x.id)===String(p.id));
  if(item) item.qty++; else cart.push({...p, qty:1});
  saveCart();
  ymGoal('add_to_cart', {product_id: p.id, product_name: p.name, price: p.price});
  if(btn){
    const orig=btn.innerHTML;
    const h=btn.offsetHeight;
    btn.style.height=h+'px';
    btn.style.minHeight=h+'px';
    const isSticky=btn.closest('.stickyBuy');
    btn.innerHTML=isSticky?'✓ Добавлено':'✓';
    btn.classList.add('btn--added');
    btn.disabled=true;
    setTimeout(()=>{
      btn.innerHTML=orig;
      btn.classList.remove('btn--added');
      btn.style.height='';
      btn.style.minHeight='';
      btn.disabled=false;
    },2400);
  } else {
    showToast('Добавлено в корзину');
  }
}
function renderCart(){ 
  const el=document.getElementById('cartItems'), count=document.getElementById('cartCount'), totalEl=document.getElementById('cartTotal'); 
  if(!el||!totalEl) return; 
  let total=0, qty=0; 
  el.innerHTML=''; 
  if(cart.length===0) el.innerHTML='<p class="muted">Корзина пустая. Добавьте товар из каталога.</p>'; 
  cart.forEach((i,idx)=>{ 
    total+=Number(i.price||0)*Number(i.qty||1); 
    qty+=Number(i.qty||1); 
    el.insertAdjacentHTML('beforeend',`<div class="cartItem"><img src="${i.image||'/assets/images/hero.webp'}" loading="lazy"><div><b>${i.name}</b><br><small>${fmt(i.price)} × ${i.qty}</small></div><button type="button" onclick="cart[${idx}].qty=Math.max(1,cart[${idx}].qty-1);saveCart()">−</button><button type="button" onclick="cart[${idx}].qty++;saveCart()">+</button><button type="button" onclick="cart.splice(${idx},1);saveCart()">×</button></div>`); 
  }); 
  if(count) count.textContent=qty; 
  totalEl.textContent=fmt(total); 
  // Кнопка / ссылка на checkout
  const checkoutBtn=document.getElementById('checkoutBtn');
  if(checkoutBtn){
    checkoutBtn.style.display = cart.length > 0 ? 'flex' : 'none';
  }
}
function goCheckout(){
  if(cart.length===0){ showToast('Добавьте товар в корзину'); return; }
  ymGoal('begin_checkout', {cart_total: cart.reduce((s,i)=>s+Number(i.price||0)*Number(i.qty||1),0)});
  location.href='/checkout.php';
}
function openCart(){ document.getElementById('cartPanel')?.classList.add('open'); document.getElementById('shade')?.classList.add('show'); }
function closeCart(){ document.getElementById('cartPanel')?.classList.remove('open'); document.getElementById('shade')?.classList.remove('show'); }
function openMenu(){
  document.getElementById('mobileMenu')?.classList.add('open');
  document.getElementById('mobileMenuShade')?.classList.add('open');
  document.body.style.overflow='hidden';
}
function closeMenu(){
  document.getElementById('mobileMenu')?.classList.remove('open');
  document.getElementById('mobileMenuShade')?.classList.remove('open');
  document.body.style.overflow='';
}
function updateConfig(){ const size=document.getElementById('cfgSize'); if(!size) return; let total=+size.value; let parts=[size.options[size.selectedIndex].text.split(' — ')[0]]; document.querySelectorAll('.cfgExtra:checked').forEach(e=>{ total+=+e.value; parts.push(e.dataset.name); }); document.getElementById('cfgText')&&(document.getElementById('cfgText').textContent=parts.join(' + ')); document.getElementById('cfgTotal')&&(document.getElementById('cfgTotal').textContent=fmt(total)); }
function addConfigToCart(){ const size=document.getElementById('cfgSize'); if(!size) return; let total=+size.value, name='Комплект '+size.options[size.selectedIndex].text.split(' — ')[0]; document.querySelectorAll('.cfgExtra:checked').forEach(e=>{ total+=+e.value; name+=' + '+e.dataset.name; }); addToCart({id:'cfg-'+Date.now(),name,price:total,image:'assets/images/hero.webp'}); }
document.querySelectorAll('#cfgSize,.cfgExtra').forEach(e=>e.addEventListener('change',updateConfig));
document.addEventListener('click',e=>{ const btn=e.target.closest('.chip'); if(!btn) return; e.preventDefault(); document.querySelectorAll('.chip').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); const f=String(btn.dataset.filter||'all').toLowerCase(); document.querySelectorAll('.productsGrid .product').forEach(card=>card.classList.toggle('is-filter-hidden',!(f==='all'||String(card.dataset.category||'').toLowerCase()===f))); });
// UTM — читаем из URL и сохраняем в sessionStorage
(function(){
  const p = new URLSearchParams(location.search);
  const keys = ['utm_source','utm_medium','utm_campaign','utm_content','utm_term'];
  const utm = {};
  keys.forEach(k=>{ if(p.get(k)) utm[k]=p.get(k); });
  if(Object.keys(utm).length) sessionStorage.setItem('luka_utm', JSON.stringify(utm));
})();
function getUtmFields(){
  const utm = JSON.parse(sessionStorage.getItem('luka_utm')||'{}');
  return utm;
}
function getYmUid(){
  try {
    const m = document.cookie.match(/_ym_uid=([^;]+)/);
    return m ? m[1] : '';
  } catch(e){ return ''; }
}

function appendUtmToFormData(fd){
  const utm = getUtmFields();
  Object.entries(utm).forEach(([k,v])=>fd.append(k,v));
  fd.append('page_referer', document.referrer||'');
  fd.append('ym_uid', getYmUid());
}

renderCart(); updateConfig();
