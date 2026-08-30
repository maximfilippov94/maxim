/* ==========================================================================
   Конструктор меню — фронт (PWA). Чистый JS, без сборки.
   Потребляет тот же REST API /api/v1, что и будущее нативное приложение.
   ========================================================================== */
'use strict';

const API = '/index.php?route=/api/v1';
const MEAL_LABELS = {
  breakfast: 'Завтрак', snack1: 'Перекус', lunch: 'Обед', snack2: 'Полдник', dinner: 'Ужин'
};
const MEAL_ORDER = ['breakfast', 'snack1', 'lunch', 'snack2', 'dinner'];
const MEAL_TIMES = { breakfast: '08:00', snack1: '10:30', lunch: '13:00', snack2: '16:30', dinner: '20:00' };
const WEEKDAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const MONTHS_GEN = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
/* Дата дня меню d (1-based) от start_date. Возвращает {wd:'Пн', dt:'26 мая'}. */
function dayLabel(startDate, d) {
  const base = new Date((startDate || new Date().toISOString().slice(0, 10)) + 'T00:00:00');
  if (isNaN(base)) return { wd: 'День', dt: String(d) };
  const dt = new Date(base.getTime() + (d - 1) * 86400000);
  return { wd: WEEKDAYS[dt.getDay()], dt: dt.getDate() + ' ' + MONTHS_GEN[dt.getMonth()] };
}

/* ---------- Состояние ---------- */
const State = {
  token: localStorage.getItem('nutri_token') || null,
  role: localStorage.getItem('nutri_role') || null,
  user: null,
  setAuth(token, role, user) {
    this.token = token; this.role = role; this.user = user;
    localStorage.setItem('nutri_token', token);
    localStorage.setItem('nutri_role', role);
  },
  clear() {
    this.token = this.role = this.user = null;
    localStorage.removeItem('nutri_token');
    localStorage.removeItem('nutri_role');
  }
};

/* ---------- API-клиент ---------- */
async function api(method, path, body) {
  const opts = { method, headers: {} };
  if (State.token) opts.headers['Authorization'] = 'Bearer ' + State.token;
  if (body !== undefined) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
  let resp;
  try {
    resp = await fetch(API + encodeURIComponent(path), opts);
  } catch (e) {
    throw { status: 0, message: 'Нет соединения' };
  }
  let data = null;
  try { data = await resp.json(); } catch (e) { /* пусто */ }
  if (!resp.ok) {
    if (resp.status === 401 && State.token) { State.clear(); location.hash = '#/'; }
    throw { status: resp.status, message: (data && data.error) || 'Ошибка ' + resp.status };
  }
  return data;
}
const GET = (p) => api('GET', p);
const POST = (p, b) => api('POST', p, b || {});
const PATCH = (p, b) => api('PATCH', p, b || {});
const DEL = (p) => api('DELETE', p);

/* ---------- DOM-хелперы ---------- */
function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (v == null) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'value') el.value = v;
    else el.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
  return el;
}
const $app = () => document.getElementById('app');
const $overlay = () => document.getElementById('overlay-root');

function render(node) {
  const app = $app();
  app.innerHTML = '';
  app.appendChild(node);
}

/* ---------- SVG-иконки (Lucide-стиль, без эмодзи) ---------- */
const ICONS = {
  home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/>',
  chart: '<path d="M4 19V5"/><path d="M4 19h16"/><path d="m7 15 3-4 3 2 4-6"/>',
  settings: '<path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-1.7 1.7-.06-.06A1.7 1.7 0 0 0 16.16 18a1.7 1.7 0 0 0-1 .96 1.7 1.7 0 0 0-.16.72V20H11v-.32a1.7 1.7 0 0 0-1.08-1.58 1.7 1.7 0 0 0-1.84.48l-.06.06-1.7-1.7.06-.06A1.7 1.7 0 0 0 6.66 15a1.7 1.7 0 0 0-1.56-1H4v-2h1.1a1.7 1.7 0 0 0 1.56-1 1.7 1.7 0 0 0-.28-1.88l-.06-.06 1.7-1.7.06.06a1.7 1.7 0 0 0 1.84.48A1.7 1.7 0 0 0 11 6.32V6h4v.32a1.7 1.7 0 0 0 1.08 1.58 1.7 1.7 0 0 0 1.84-.48l.06-.06 1.7 1.7-.06.06A1.7 1.7 0 0 0 19.34 11a1.7 1.7 0 0 0 1.56 1H22v2h-1.1a1.7 1.7 0 0 0-1.5 1Z"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
  utensils: '<path d="M3 2v7c0 1.1.9 2 2 2a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/>',
  calendar: '<path d="M8 2v4"/><path d="M16 2v4"/><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18"/>',
  trending: '<path d="M22 7 13.5 15.5 8.5 10.5 2 17"/><path d="M16 7h6v6"/>',
  chat: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z"/>',
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  chevronRight: '<path d="M9 18l6-6-6-6"/>',
  arrowLeft: '<path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/>',
  more: '<circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/><circle cx="5" cy="12" r="1.4"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  checkCircle: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4 12 14.01l-3-3"/>',
  x: '<path d="M18 6 6 18"/><path d="M6 6l12 12"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  share: '<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M16 6l-4-4-4 4"/><path d="M12 2v13"/>',
  scale: '<path d="M16 16l3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1z"/><path d="M2 16l3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  send: '<path d="M22 2 11 13"/><path d="M22 2l-7 20-4-9-9-4z"/>',
  leaf: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/><path d="M2 21c0-3 1.85-5.36 5.08-6"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>',
  edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z"/>',
  trash: '<path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>',
  copy: '<rect x="8" y="8" width="14" height="14" rx="2"/><path d="M4 16a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2"/>',
  layers: '<path d="m12.83 2.18 8.06 4.06a1 1 0 0 1 0 1.79l-8.06 4.06a2 2 0 0 1-1.66 0L3.1 8.03a1 1 0 0 1 0-1.79l8.06-4.06a2 2 0 0 1 1.66 0z"/><path d="m2 12 8.9 4.5a2 2 0 0 0 1.66 0L22 12"/><path d="m2 17 8.9 4.5a2 2 0 0 0 1.66 0L22 17"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  sparkles: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4"/><path d="M9 9l1.5 1.5M13.5 13.5 15 15M15 9l-1.5 1.5M10.5 13.5 9 15"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  note: '<path d="M15.5 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.5z"/><path d="M15 3v6h6"/>',
  star: '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14l-5-4.87 6.91-1.01L12 2z"/>',
};
function ic(name, cls) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'icon' + (cls ? ' ' + cls : ''));
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = ICONS[name] || '';
  return svg;
}

function toast(msg, isErr) {
  const t = h('div', { class: 'toast' + (isErr ? ' err' : '') }, ic(isErr ? 'alert' : 'check'), h('span', {}, msg));
  $overlay().appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .2s'; setTimeout(() => t.remove(), 200); }, 2400);
}

function fmt(n) { return (Math.round(n * 10) / 10).toString(); }
function fmt0(n) { return Math.round(n).toString(); }
function initials(name) {
  return (name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0] ? w[0].toUpperCase() : '').join('') || '?';
}
/* Пищевая ценность с процентами от калорийности (по макету GPT). */
function nutritionBreakdown(n, title) {
  const kcal = n.kcal || 0;
  const pct = (grams, factor) => kcal > 0 ? Math.round(grams * factor / kcal * 100) : 0;
  const row = (label, grams, p, color) => h('div', { class: 'nb-row' },
    h('span', { class: 'nb-dot', style: 'background:' + color }), h('span', { class: 'nb-l' }, label),
    h('span', { class: 'nb-g' }, fmt(grams) + ' г'), h('span', { class: 'nb-p' }, p + '%'));
  return h('div', { class: 'nutri-breakdown' },
    h('div', { class: 'nb-head' }, h('span', { class: 'muted small' }, title || 'Пищевая ценность на порцию'),
      h('span', { class: 'nb-kcal' }, fmt0(kcal) + ' ккал')),
    row('Белки', n.protein || 0, pct(n.protein || 0, 4), 'var(--m-protein)'),
    row('Жиры', n.fat || 0, pct(n.fat || 0, 9), 'var(--m-fat)'),
    row('Углеводы', n.carbs || 0, pct(n.carbs || 0, 4), 'var(--m-carb)'));
}

/* Строка макросов с цветовой кодировкой (Б синий, Ж янтарь, У фиолетовый). */
function macroLine(n, withPortion) {
  const parts = [];
  if (withPortion) parts.push(h('span', { class: 'mp' }, fmt(n.portion_g) + ' г'));
  parts.push(h('span', { class: 'mm b' }, 'Б ' + fmt(n.protein)));
  parts.push(h('span', { class: 'mm f' }, 'Ж ' + fmt(n.fat)));
  parts.push(h('span', { class: 'mm c' }, 'У ' + fmt(n.carbs)));
  return h('div', { class: 'mc-macros' }, ...parts);
}

/* Нижняя шторка (bottom sheet). Возвращает функцию закрытия. */
function sheet(title, contentBuilder, opts = {}) {
  const backdrop = h('div', { class: 'sheet-backdrop' + (opts.modal ? ' modal-backdrop' : '') });
  const panel = h('div', { class: 'sheet' + (opts.modal ? ' sheet-modal' : '') });
  const close = () => backdrop.remove();
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
  panel.appendChild(h('div', { class: 'grabber' }));
  if (title) panel.appendChild(h('h2', {}, title));
  contentBuilder(panel, close);
  backdrop.appendChild(panel);
  $overlay().appendChild(backdrop);
  return close;
}

/* Пункты навигации по роли — общие для нижней панели и sidebar. */
function navItems() {
  return State.role === 'specialist'
    ? [['home', 'home', 'Главная', '#/home'],
       ['clients', 'users', 'Клиенты', '#/clients'],
       ['builder', 'layers', 'Конструктор меню', '#/menu-list'],
       ['base', 'book', 'База блюд', '#/base'],
       ['analytics', 'chart', 'Аналитика', '#/analytics'],
       ['chats', 'chat', 'Чаты', '#/chats'],
       ['profile', 'user', 'Профиль', '#/profile'],
       ['settings', 'settings', 'Настройки', '#/settings']]
    : [['today', 'utensils', 'Сегодня', '#/today'],
       ['week', 'calendar', 'Неделя', '#/week'],
       ['progress', 'trending', 'Прогресс', '#/progress'],
       ['chat', 'chat', 'Чат', '#/client-chat']];
}

/* Общий каркас: sidebar (десктоп) + экран с контентом и нижней навигацией (моб.). */
function shell(active, contentNode, opts = {}) {
  const layout = h('div', { class: 'layout' });
  layout.appendChild(sidebar(active));

  const wrap = h('div', { class: 'screen' });
  if (opts.topbar) {
    const bar = h('div', { class: 'topbar' });
    if (opts.back) bar.appendChild(h('button', { class: 'icon-btn', 'aria-label': 'Назад', onclick: opts.back }, ic('arrowLeft')));
    bar.appendChild(h('h1', {}, opts.topbar));
    if (opts.action) bar.appendChild(opts.action);
    wrap.appendChild(bar);
  }
  wrap.appendChild(contentNode);
  wrap.appendChild(bottomNav(active));
  layout.appendChild(wrap);
  return layout;
}

function navButton(active, key, icon, label, hash, badge) {
  const btn = h('button', { class: key === active ? 'active' : '', onclick: () => location.hash = hash },
    ic(icon), h('span', {}, label));
  if (badge) btn.appendChild(h('span', { class: 'nav-badge' }, String(badge)));
  return btn;
}

function bottomNav(active) {
  const nav = h('div', { class: 'bottom-nav' });
  for (const [key, icon, label, hash] of navItems()) nav.appendChild(navButton(active, key, icon, label, hash));
  return nav;
}

/* Левый sidebar для десктопа (скрыт на мобильном через CSS). */
function sidebar(active) {
  const aside = h('aside', { class: 'sidebar' });
  aside.appendChild(h('div', { class: 'brand', onclick: () => location.hash = defaultRoute(), style: 'cursor:pointer' },
    h('span', { class: 'mark' }, ic('leaf')), h('span', { class: 'name' }, 'NutriMenu')));
  const nav = h('nav', { class: 'nav' });
  for (const [key, icon, label, hash] of navItems()) nav.appendChild(navButton(active, key, icon, label, hash));
  aside.appendChild(nav);

  const u = State.user || {};
  const foot = h('div', { class: 'foot' });
  const ava = h('div', { class: 'avatar' });
  if (u.photo_url) { ava.style.backgroundImage = `url(${u.photo_url})`; ava.style.backgroundSize = 'cover'; ava.textContent = ''; }
  else ava.textContent = initials(u.name || '?');
  foot.appendChild(h('div', { class: 'who' }, ava,
    h('div', { style: 'min-width:0' }, h('div', { class: 'nm' }, u.name || (State.role === 'client' ? 'Клиент' : 'Специалист')),
      h('div', { class: 'sub' }, State.role === 'specialist' ? (u.plan === 'trial' ? 'Пробный период' : 'Тариф ' + (u.plan || '')) : 'Клиент'))));
  aside.appendChild(foot);
  return aside;
}

const isDesktop = () => window.matchMedia('(min-width: 1024px)').matches;

function loading() { render(h('div', { class: 'boot' }, h('div', { class: 'spinner' }))); }

/* Скелет-загрузка списка внутри каркаса. */
function skeletonList(active, topbar, n) {
  const content = h('div', { class: 'content' });
  for (let i = 0; i < (n || 5); i++) content.appendChild(h('div', { class: 'skeleton sk-card' }));
  render(shell(active, content, { topbar }));
}

/* ==========================================================================
   РОУТЕР
   ========================================================================== */
const routes = [];
function route(pattern, handler) {
  const params = [];
  const rx = new RegExp('^' + pattern.replace(/:([\w]+)/g, (_, p) => { params.push(p); return '([^/]+)'; }) + '$');
  routes.push({ rx, params, handler });
}

async function router() {
  // Закрываем висящие шторки/тосты при смене экрана.
  const ov = $overlay();
  if (ov) ov.innerHTML = '';
  const raw = location.hash.replace(/^#/, '') || '/';
  const qi = raw.indexOf('?');
  const hash = qi >= 0 ? raw.slice(0, qi) : raw;
  State.query = {};
  if (qi >= 0) new URLSearchParams(raw.slice(qi + 1)).forEach((v, k) => State.query[k] = v);
  for (const r of routes) {
    const m = hash.match(r.rx);
    if (m) {
      const args = {};
      r.params.forEach((p, i) => args[p] = decodeURIComponent(m[i + 1]));
      try { await r.handler(args); }
      catch (e) { console.error(e); if (e.status !== 401) toast(e.message || 'Ошибка', true); }
      return;
    }
  }
  location.hash = defaultRoute();
}
function defaultRoute() {
  if (!State.token) return '#/';
  if (State.role === 'admin') return '#/admin/dashboard';
  return State.role === 'specialist' ? '#/clients' : '#/today';
}

window.addEventListener('hashchange', router);

// Перерисовка при пересечении десктоп/мобайл границы (адаптивная раскладка).
let _wasDesktop = null;
window.addEventListener('resize', () => {
  const now = isDesktop();
  if (_wasDesktop === null) { _wasDesktop = now; return; }
  if (now !== _wasDesktop) { _wasDesktop = now; router(); }
});

/* ==========================================================================
   АУТЕНТИФИКАЦИЯ
   ========================================================================== */
function authShell(inner) {
  render(h('div', { class: 'auth-wrap' },
    h('div', { class: 'auth-logo' },
      h('div', { class: 'mark' }, ic('leaf', 'lg')),
      h('h1', {}, 'NutriMenu'),
      h('div', { class: 'tag' }, 'Конструктор меню для нутрициологов')
    ),
    inner
  ));
}

route('/', () => {
  if (State.token) { location.hash = defaultRoute(); return; }
  screenSpecialistLogin();
});

function screenSpecialistLogin() {
  const err = h('div', { class: 'form-err', style: 'display:none' });
  const email = h('input', { type: 'email', placeholder: 'you@example.com', autocomplete: 'username' });
  const pass = h('input', { type: 'password', placeholder: 'Пароль', autocomplete: 'current-password' });
  const submit = async () => {
    err.style.display = 'none';
    try {
      const r = await POST('/auth/specialist/login', { email: email.value.trim(), password: pass.value });
      State.setAuth(r.token, 'specialist', r.user); location.hash = '#/clients';
    } catch (e) { err.textContent = e.message; err.style.display = 'block'; }
  };
  authShell(h('div', { class: 'card' },
    h('label', {}, 'Email'), email,
    h('label', {}, 'Пароль'), pass,
    err,
    h('button', { class: 'btn', style: 'margin-top:14px', onclick: submit }, 'Войти'),
    demoPanel(),
    h('div', { class: 'auth-switch' }, 'Нет аккаунта? ',
      h('a', { href: '#/register' }, 'Регистрация')),
    h('div', { class: 'auth-switch small' },
      h('a', { href: '#/client-login' }, 'Вход для клиента'), '  ·  ',
      h('a', { href: '#/catalog' }, 'Найти нутрициолога'))
  ));
  setTimeout(() => email.focus(), 50);
}

/* Быстрый демо-вход для тестировщиков — без регистрации. */
async function demoLogin(role) {
  const map = {
    specialist: ['/auth/specialist/login', { email: 'nutritionist@test.com', password: '123456' }, 'specialist'],
    client: ['/auth/client/login', { email: 'client@test.com', password: '123456' }, 'client'],
    admin: ['/admin/login', { email: 'admin@test.com', password: '123456' }, 'admin'],
  };
  const [ep, creds, rl] = map[role];
  try {
    const r = await POST(ep, creds);
    State.setAuth(r.token, rl, r.user);
    if (rl === 'client') await afterClientAuth();
    else location.hash = rl === 'admin' ? '#/admin/dashboard' : '#/clients';
  } catch (e) { toast(e.message || 'Демо-аккаунт недоступен', true); }
}

function demoPanel() {
  return h('div', { class: 'demo-panel' },
    h('div', { class: 'dp-title' }, 'Демо-доступ для теста'),
    h('div', { class: 'dp-btns' },
      h('button', { class: 'btn secondary small', onclick: () => demoLogin('specialist') }, ic('user', 'sm'), 'Нутрициолог'),
      h('button', { class: 'btn secondary small', onclick: () => demoLogin('client') }, ic('utensils', 'sm'), 'Клиент'),
      h('button', { class: 'btn secondary small', onclick: () => demoLogin('admin') }, ic('grid', 'sm'), 'Админ')));
}

route('/register', () => {
  const err = h('div', { class: 'form-err', style: 'display:none' });
  const name = h('input', { placeholder: 'Имя и фамилия' });
  const email = h('input', { type: 'email', placeholder: 'you@example.com' });
  const pass = h('input', { type: 'password', placeholder: 'Пароль (мин. 6)' });
  const submit = async () => {
    err.style.display = 'none';
    try {
      const r = await POST('/auth/specialist/register', { name: name.value.trim(), email: email.value.trim(), password: pass.value });
      State.setAuth(r.token, 'specialist', r.user); location.hash = '#/clients';
    } catch (e) { err.textContent = e.message; err.style.display = 'block'; }
  };
  authShell(h('div', { class: 'card' },
    h('label', {}, 'Имя'), name,
    h('label', {}, 'Email'), email,
    h('label', {}, 'Пароль'), pass,
    err,
    h('button', { class: 'btn', style: 'margin-top:14px', onclick: submit }, 'Создать аккаунт'),
    h('div', { class: 'auth-switch' }, 'Уже есть аккаунт? ', h('a', { href: '#/' }, 'Войти'))
  ));
});

route('/client-login', () => {
  const err = h('div', { class: 'form-err', style: 'display:none' });
  const email = h('input', { type: 'email', placeholder: 'Ваш email' });
  const pass = h('input', { type: 'password', placeholder: 'Пароль' });
  const submit = async () => {
    err.style.display = 'none';
    try {
      const r = await POST('/auth/client/login', { email: email.value.trim(), password: pass.value });
      State.setAuth(r.token, 'client', r.user); await afterClientAuth();
    } catch (e) { err.textContent = e.message; err.style.display = 'block'; }
  };
  authShell(h('div', { class: 'card' },
    h('div', { class: 'muted small', style: 'margin-bottom:8px' }, 'Кабинет клиента'),
    h('label', {}, 'Email'), email,
    h('label', {}, 'Пароль'), pass,
    err,
    h('button', { class: 'btn', style: 'margin-top:14px', onclick: submit }, 'Войти'),
    h('div', { class: 'auth-switch' }, h('a', { href: '#/' }, 'Вход для специалиста'))
  ));
});

route('/invite/:token', async (args) => {
  let info;
  try { info = await GET('/invite/' + args.token); }
  catch (e) { authShell(h('div', { class: 'card center' }, 'Приглашение не найдено или устарело.')); return; }

  if (!info.needs_password) {
    authShell(h('div', { class: 'card center' },
      h('p', {}, 'Пароль уже задан. Войдите в кабинет клиента.'),
      h('a', { class: 'btn', href: '#/client-login' }, 'Войти')));
    return;
  }
  const err = h('div', { class: 'form-err', style: 'display:none' });
  const pass = h('input', { type: 'password', placeholder: 'Придумайте пароль (мин. 6)' });
  const submit = async () => {
    err.style.display = 'none';
    try {
      const r = await POST('/invite/' + args.token + '/accept', { password: pass.value });
      State.setAuth(r.token, 'client', r.user); location.hash = '#/intake';
    } catch (e) { err.textContent = e.message; err.style.display = 'block'; }
  };
  authShell(h('div', { class: 'card' },
    info.specialist ? specBadge(info.specialist) : null,
    h('p', {}, 'Здравствуйте, ', h('b', {}, info.name), '! Задайте пароль для входа в кабинет.'),
    h('label', {}, 'Пароль'), pass, err,
    h('button', { class: 'btn', style: 'margin-top:12px', onclick: submit }, 'Продолжить')
  ));
});

/* Плашка «вот твой специалист». */
function specBadge(spec) {
  const ava = h('div', { class: 'ava' });
  if (spec.photo_url) ava.style.backgroundImage = `url(${spec.photo_url})`;
  else ava.textContent = initials(spec.name);
  return h('div', { class: 'spec-badge' }, ava,
    h('div', {}, h('div', { style: 'font-weight:700' }, spec.name),
      spec.specialization ? h('div', { class: 'small muted' }, spec.specialization) : h('div', { class: 'small muted' }, 'Ваш нутрициолог')));
}

/* После входа/регистрации клиента — на анкету, если не пройдена. */
async function afterClientAuth() {
  try { const s = await GET('/me/intake'); location.hash = s.completed ? '#/today' : '#/intake'; }
  catch (e) { location.hash = '#/today'; }
}

/* ==========================================================================
   КЛИЕНТ: АНКЕТА ПРИ СТАРТЕ
   ========================================================================== */
route('/intake', async () => {
  if (!requireRole('client')) return;
  loading();
  const s = await GET('/me/intake');

  const goal = h('textarea', { placeholder: 'Например: сбросить 5 кг, наладить питание…' }, s.goal || '');
  const weight = h('input', { type: 'number', step: '0.1', placeholder: 'кг', value: s.weight_kg || '' });
  const height = h('input', { type: 'number', placeholder: 'см', value: s.height_cm || '' });
  const year = h('input', { type: 'number', placeholder: 'год', value: s.birth_year || '' });

  let sex = s.sex || '';
  const sexSeg = seg([['m', 'Мужской'], ['f', 'Женский']], sex, (v) => sex = v);

  let activity = s.activity_level || '';
  const actSeg = seg([['low', 'Низкая'], ['medium', 'Средняя'], ['high', 'Высокая']], activity, (v) => activity = v);

  const allergies = h('textarea', { placeholder: 'Аллергии и непереносимости (если есть)' }, s.allergies || '');
  const prefs = h('textarea', { placeholder: 'Предпочтения: веган, без свинины и т.п.' }, s.dietary_prefs || '');

  const flags = new Set(s.medical_flags || []);
  const flagDefs = [['pregnancy', 'Беременность / ГВ'], ['diabetes', 'Диабет'], ['gi', 'Заболевания ЖКТ'], ['eating_disorder', 'Расстройство пищевого поведения']];
  const flagBox = h('div', {});
  for (const [val, label] of flagDefs) flagBox.appendChild(checkRow(label, flags.has(val), (on) => on ? flags.add(val) : flags.delete(val)));

  const err = h('div', { class: 'form-err', style: 'display:none' });
  const save = async () => {
    err.style.display = 'none';
    if (!goal.value.trim()) { err.textContent = 'Опишите вашу цель'; err.style.display = 'block'; window.scrollTo(0, 0); return; }
    try {
      await api('PATCH', '/me/intake', {
        goal: goal.value.trim(), weight_kg: weight.value || null, height_cm: height.value || null,
        birth_year: year.value || null, sex: sex || null, activity_level: activity || null,
        allergies: allergies.value || null, dietary_prefs: prefs.value || null, medical_flags: [...flags],
      });
      toast('Анкета сохранена'); location.hash = '#/today';
    } catch (e) { err.textContent = e.message; err.style.display = 'block'; }
  };

  const content = h('div', { class: 'content stagger' },
    h('div', { class: 'card' },
      h('h3', { style: 'margin:0 0 4px' }, 'Расскажите о себе'),
      h('div', { class: 'muted small' }, 'Это поможет специалисту составить меню под вас. Целевые КБЖУ он рассчитает сам.')),
    h('div', { class: 'card' },
      h('label', {}, 'Ваша цель'), goal,
      h('label', {}, 'Пол'), sexSeg,
      h('div', { class: 'field-row' }, h('div', {}, h('label', {}, 'Вес, кг'), weight), h('div', {}, h('label', {}, 'Рост, см'), height)),
      h('label', {}, 'Год рождения'), year,
      h('label', {}, 'Физическая активность'), actSeg),
    h('div', { class: 'card' },
      h('label', {}, 'Аллергии / непереносимости'), allergies,
      h('label', {}, 'Пищевые предпочтения'), prefs),
    h('div', { class: 'card' },
      h('div', { class: 'section-title' }, 'Важно для безопасности'),
      flagBox,
      h('div', { class: 'disclaimer', style: 'margin-top:10px' }, ic('alert'), h('span', {}, 'При отмеченных состояниях меню составляется только после консультации с врачом.'))),
    err,
    h('button', { class: 'btn', onclick: save }, ic('check', 'sm'), 'Сохранить и продолжить'),
    s.completed ? h('button', { class: 'btn ghost', style: 'margin-top:6px', onclick: () => location.hash = '#/today' }, 'Пропустить') : null
  );
  render(shell('today', content, { topbar: 'Анкета' }));
});

/* Сегментированный переключатель. */
function seg(options, current, onChange) {
  const box = h('div', { class: 'seg' });
  for (const [val, label] of options) {
    const b = h('button', { type: 'button', class: val === current ? 'on' : '', onclick: () => {
      box.querySelectorAll('button').forEach(x => x.classList.remove('on'));
      b.classList.add('on'); onChange(val);
    } }, label);
    box.appendChild(b);
  }
  return box;
}

/* Строка-чекбокс. */
function checkRow(label, checked, onChange) {
  let on = !!checked;
  const row = h('div', { class: 'check-row' + (on ? ' on' : '') }, h('span', { class: 'box' }, ic('check', 'sm')), h('span', {}, label));
  row.addEventListener('click', () => { on = !on; row.classList.toggle('on', on); onChange(on); });
  return row;
}

/* ==========================================================================
   СПЕЦИАЛИСТ: ГЛАВНАЯ / АНАЛИТИКА / ЧАТЫ / НАСТРОЙКИ
   ========================================================================== */

/* Иконки причин «Требуют внимания». */
const ATTN_ICON = { message: 'chat', no_menu: 'layers', menu_ending: 'clock', no_logs: 'utensils', no_weight: 'scale', weight_stall: 'trending' };

/* Кнопка быстрого действия. */
function quickAction(icon, label, onclick) {
  return h('button', { class: 'qa-btn', onclick }, h('span', { class: 'qa-ic' }, ic(icon, 'sm')), h('span', {}, label));
}

/* Строка «Требует внимания»: клиент + причины + переход. */
function attentionItem(c) {
  const hasMsg = c.attention.some(a => a.type === 'message');
  return h('div', { class: 'attn-item', onclick: () => location.hash = (hasMsg ? '#/chat/' : '#/client/') + c.id },
    h('div', { class: 'avatar' }, initials(c.name)),
    h('div', { class: 'grow' },
      h('div', { class: 'attn-name' }, c.name),
      h('div', { class: 'attn-reasons' }, ...c.attention.map(a =>
        h('span', { class: 'attn-pill ' + a.type }, ic(ATTN_ICON[a.type] || 'alert', 'xs'), a.text)))
    ),
    h('span', { class: 'attn-cta' }, hasMsg ? 'Открыть чат' : 'Открыть', ic('chevronRight', 'sm'))
  );
}

/* Компактная строка клиента с метриками (Главная и список клиентов). */
function clientRow(c) {
  const delta = c.weight_delta;
  const deltaEl = delta !== null && delta !== undefined
    ? h('span', { class: 'metric-delta ' + (delta < 0 ? 'down' : delta > 0 ? 'up' : '') }, (delta > 0 ? '+' : '') + fmt(delta) + ' кг')
    : null;
  const statusText = c.attention && c.attention.length
    ? c.attention[0].text
    : (c.menu_status === 'published' ? 'В норме' : 'Меню не создано');
  const statusTone = c.attention && c.attention.length ? 'warn' : (c.menu_status === 'published' ? 'ok' : 'muted');
  const metric = (label, value, extra) => h('div', { class: 'cr-metric' }, h('span', {}, label), h('b', {}, value, extra || null));
  return h('div', { class: 'client-row', onclick: () => location.hash = '#/client/' + c.id },
    h('div', { class: 'avatar' }, initials(c.name)),
    h('div', { class: 'cr-main' },
      h('div', { class: 'cr-name' }, c.name),
      h('div', { class: 'cr-goal' }, c.goal || 'Цель не задана')
    ),
    h('div', { class: 'cr-metrics' },
      metric('Вес', c.last_weight_kg ? fmt(c.last_weight_kg) + ' кг' : (c.weight_kg ? fmt(c.weight_kg) + ' кг' : '—'), deltaEl ? h('span', {}, ' ', deltaEl) : null),
      metric('Ккал', c.target_kcal ? fmt0(c.target_kcal) : '—'),
      metric('Соблюдение', c.compliance_pct !== null && c.compliance_pct !== undefined ? c.compliance_pct + '%' : '—')
    ),
    h('div', { class: 'cr-status' }, h('span', { class: 'status-pill ' + statusTone }, statusText), ic('chevronRight', 'chevron sm'))
  );
}

route('/home', async () => {
  if (!requireRole('specialist')) return;
  loading();
  const { items = [] } = await GET('/clients');
  const active = items.filter(x => x.status !== 'archived');
  const published = active.filter(x => x.menu_status === 'published').length;
  const unread = active.reduce((s, c) => s + (c.unread_messages || 0), 0);
  const attn = active.filter(c => c.attention && c.attention.length)
    .sort((a, b) => (a.attention_rank ?? 99) - (b.attention_rank ?? 99));
  const complList = active.filter(c => c.compliance_pct !== null && c.compliance_pct !== undefined);
  const avgCompl = complList.length ? Math.round(complList.reduce((s, c) => s + c.compliance_pct, 0) / complList.length) : 0;
  const hour = new Date().getHours();
  const greet = hour < 6 ? 'Доброй ночи' : hour < 12 ? 'Доброе утро' : hour < 18 ? 'Добрый день' : 'Добрый вечер';

  const attnCard = h('section', { class: 'card attn-card' },
    h('div', { class: 'row-between' },
      h('div', { class: 'attn-head' }, h('h3', {}, 'Требуют внимания'), attn.length ? h('span', { class: 'attn-count' }, String(attn.length)) : null),
      attn.length ? h('a', { class: 'dash-link', href: '#/clients?filter=attention' }, 'Все') : null),
    attn.length
      ? h('div', { class: 'attn-list' }, ...attn.slice(0, 6).map(attentionItem))
      : h('div', { class: 'empty dash-empty' }, ic('checkCircle'), h('div', {}, 'Всё под контролем'), h('div', { class: 'small' }, 'Ни один клиент не требует действий'))
  );

  const clientsCard = h('section', { class: 'card' },
    h('div', { class: 'row-between' }, h('h3', {}, 'Мои клиенты'), h('a', { class: 'dash-link', href: '#/clients' }, 'Все клиенты')),
    active.length
      ? h('div', { class: 'client-rows' }, ...active.slice(0, 6).map(clientRow))
      : h('div', { class: 'empty dash-empty' }, ic('users'), h('div', {}, 'Пока нет клиентов'), h('button', { class: 'btn small', style: 'margin-top:10px', onclick: () => location.hash = '#/client/new' }, ic('plus', 'sm'), 'Добавить клиента'))
  );

  const content = h('div', { class: 'content dashboard-page' },
    h('div', { class: 'dash-head' },
      h('div', {}, h('h2', {}, greet + ', ' + ((State.user && State.user.name) || 'Елена') + '! 👋'), h('p', {}, 'Вот что происходит с вашими клиентами')),
      h('span', { class: 'date-chip' }, new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }))),

    h('div', { class: 'quick-actions' },
      quickAction('plus', 'Новый клиент', () => location.hash = '#/client/new'),
      quickAction('layers', 'Создать меню', () => location.hash = '#/menu-list'),
      quickAction('book', 'Добавить блюдо', () => location.hash = '#/dish/new')),

    h('div', { class: 'kpi-row' },
      h('div', { class: 'mini-kpi' }, h('b', {}, String(active.length)), h('span', {}, plural(active.length, 'Клиент', 'Клиента', 'Клиентов'))),
      h('div', { class: 'mini-kpi' }, h('b', {}, String(published)), h('span', {}, 'Активных меню')),
      h('div', { class: 'mini-kpi' + (unread ? ' accent' : '') }, h('b', {}, String(unread)), h('span', {}, 'Новых сообщений')),
      h('div', { class: 'mini-kpi' }, h('b', {}, avgCompl + '%'), h('span', {}, 'Среднее соблюдение'))),

    h('div', { class: 'home-grid' }, attnCard, clientsCard)
  );
  render(shell('home', content, { topbar: 'Главная' }));
});

/* Простое склонение существительных по числу. */
function plural(n, one, few, many) {
  const m100 = n % 100, m10 = n % 10;
  if (m100 >= 11 && m100 <= 14) return many;
  if (m10 === 1) return one;
  if (m10 >= 2 && m10 <= 4) return few;
  return many;
}

route('/menu-list', async () => {
  if (!requireRole('specialist')) return;
  const { items = [] } = await GET('/clients');
  const content = h('div', { class:'content' }, h('div', { class:'section-intro' }, h('div', {}, h('h2', {}, 'Конструктор меню'), h('p', {}, 'Выберите клиента и откройте его меню')), h('a', { class:'btn small', href:'#/clients' }, 'Выбрать клиента')), h('div', { class:'grid-cards menu-list-grid' }, ...items.filter(c=>c.status!=='archived').map(c=>h('div',{class:'list-item',onclick:()=>location.hash='#/client/'+c.id},h('div',{class:'avatar'},initials(c.name)),h('div',{class:'grow'},h('h3',{},c.name),h('div',{class:'sub'},c.menu_status==='published'?'Меню опубликовано':'Меню не создано'),),ic('chevronRight','sm')))));
  render(shell('builder', content, { topbar:'Конструктор меню' }));
});

route('/analytics', () => {
  if (!requireRole('specialist')) return;
  const content=h('div',{class:'content dashboard-page'},h('div',{class:'dash-head'},h('div',{},h('h2',{},'Аналитика'),h('p',{},'Динамика клиентов и меню'))),h('div',{class:'dashboard-grid analytics-grid'},h('div',{class:'card'},h('h3',{},'Соблюдение плана'),h('div',{class:'big-stat'},'78%'),h('div',{class:'fake-chart large'},h('span',{},'Пн'),h('span',{},'Вт'),h('span',{},'Ср'),h('span',{},'Чт'),h('span',{},'Пт'),h('span',{},'Сб'),h('span',{},'Вс'))),h('div',{class:'card'},h('h3',{},'Изменение веса'),h('div',{class:'big-stat'},'-1.8 кг'),h('p',{class:'muted'},'Среднее изменение за неделю'))));
  render(shell('analytics',content,{topbar:'Аналитика'}));
});

route('/chats', () => {
  if (!requireRole('specialist')) return;
  const content=h('div',{class:'content'},h('div',{class:'empty card'},ic('chat'),h('h3',{},'Чаты с клиентами'),h('p',{class:'muted'},'Откройте клиента, чтобы продолжить переписку.')));
  render(shell('chats',content,{topbar:'Чаты'}));
});

route('/settings', () => {
  if (!requireRole('specialist')) return;
  const content=h('div',{class:'content'},h('div',{class:'card settings-card'},h('h3',{},'Настройки'),h('p',{class:'muted'},'Настройки аккаунта и интерфейса NutriMenu.'),h('button',{class:'btn danger small',onclick:logout},ic('logout','sm'),'Выйти')));
  render(shell('settings',content,{topbar:'Настройки'}));
});

/* ==========================================================================
   СПЕЦИАЛИСТ: КЛИЕНТЫ
   ========================================================================== */
const CLIENT_FILTERS = [
  ['all', 'Все', c => true],
  ['active', 'Активные', c => c.menu_status === 'published'],
  ['attention', 'Требуют внимания', c => c.attention && c.attention.length],
  ['new', 'Новые', c => !c.menu_status],
];

route('/clients', async () => {
  if (!requireRole('specialist')) return;
  skeletonList('clients', 'Клиенты');
  const { items } = await GET('/clients');
  const active = items.filter(x => x.status !== 'archived');
  let filter = State.query.filter && CLIENT_FILTERS.some(f => f[0] === State.query.filter) ? State.query.filter : 'all';
  let term = '';

  const listEl = h('div', { class: 'client-rows card client-list' });
  const empty = h('div', { class: 'empty' }, ic('users'), h('div', {}, 'Никого не найдено'), h('div', { class: 'small' }, 'Измените фильтр или добавьте клиента'));

  const chips = h('div', { class: 'chip-row filter-chips' });
  const chipEls = {};
  const draw = () => {
    const test = CLIENT_FILTERS.find(f => f[0] === filter)[2];
    const rows = active.filter(test).filter(c => !term || c.name.toLowerCase().includes(term));
    if (filter === 'attention') rows.sort((a, b) => (a.attention_rank ?? 99) - (b.attention_rank ?? 99));
    listEl.innerHTML = '';
    if (!rows.length) { listEl.appendChild(empty); return; }
    rows.forEach(c => listEl.appendChild(clientRow(c)));
  };
  CLIENT_FILTERS.forEach(([key, label, test]) => {
    const n = active.filter(test).length;
    const b = h('button', { class: key === filter ? 'active' : '', onclick: () => {
      filter = key; Object.values(chipEls).forEach(x => x.classList.remove('active')); b.classList.add('active'); draw();
    } }, label, n ? h('span', { class: 'chip-count' }, String(n)) : null);
    chipEls[key] = b; chips.appendChild(b);
  });

  const search = h('input', { placeholder: 'Поиск клиента…', value: '' });
  let timer;
  search.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => { term = search.value.trim().toLowerCase(); draw(); }, 180); });

  const content = h('div', { class: 'content clients-page' },
    h('div', { class: 'section-intro' },
      h('div', {}, h('h2', {}, 'Клиенты'), h('p', {}, plural(active.length, 'клиент', 'клиента', 'клиентов') + ' · ' + active.length)),
      h('button', { class: 'btn small', onclick: () => location.hash = '#/client/new' }, ic('plus', 'sm'), 'Добавить')),
    searchField(search),
    chips,
    listEl
  );
  const fab = h('button', { class: 'btn fab', 'aria-label': 'Добавить клиента', onclick: () => location.hash = '#/client/new' }, ic('plus'));
  render(shell('clients', content, { topbar: 'Клиенты' }));
  $app().querySelector('.screen').appendChild(fab);
  draw();
});

route('/client/new', () => {
  if (!requireRole('specialist')) return;
  clientForm(null);
});

function clientForm(client) {
  const f = {};
  const mk = (key, ph, type) => f[key] = h('input', { type: type || 'text', placeholder: ph, value: client ? (client[key] ?? '') : '' });
  mk('name', 'Имя клиента');
  mk('email', 'Email (для входа)', 'email');
  mk('phone', 'Телефон', 'tel');
  const sex = h('select', {}, h('option', { value: '' }, 'Пол'), h('option', { value: 'm' }, 'М'), h('option', { value: 'f' }, 'Ж'));
  if (client && client.sex) sex.value = client.sex;
  mk('birth_year', 'Год рождения', 'number');
  mk('height_cm', 'Рост, см', 'number');
  mk('weight_kg', 'Вес, кг', 'number');
  const activity = h('select', {}, h('option', { value: '' }, 'Активность'),
    h('option', { value: 'low' }, 'Низкая'), h('option', { value: 'medium' }, 'Средняя'), h('option', { value: 'high' }, 'Высокая'));
  if (client && client.activity_level) activity.value = client.activity_level;
  f.goal = h('textarea', { placeholder: 'Цель (свободный текст)' }, client ? (client.goal || '') : '');
  mk('target_kcal', 'Ккал', 'number');
  mk('target_protein', 'Белки, г', 'number');
  mk('target_fat', 'Жиры, г', 'number');
  mk('target_carbs', 'Углеводы, г', 'number');
  f.notes = h('textarea', { placeholder: 'Заметки специалиста' }, client ? (client.notes || '') : '');

  const err = h('div', { class: 'form-err', style: 'display:none' });
  const save = async () => {
    err.style.display = 'none';
    const payload = {
      name: f.name.value.trim(), email: f.email.value.trim() || null, phone: f.phone.value.trim() || null,
      sex: sex.value || null, birth_year: f.birth_year.value || null, height_cm: f.height_cm.value || null,
      weight_kg: f.weight_kg.value || null, activity_level: activity.value || null,
      goal: f.goal.value || null, notes: f.notes.value || null,
      target_kcal: f.target_kcal.value || null, target_protein: f.target_protein.value || null,
      target_fat: f.target_fat.value || null, target_carbs: f.target_carbs.value || null
    };
    if (!payload.name) { err.textContent = 'Введите имя'; err.style.display = 'block'; return; }
    try {
      const r = client ? await PATCH('/clients/' + client.id, payload) : await POST('/clients', payload);
      toast('Сохранено'); location.hash = '#/client/' + r.id;
    } catch (e) { err.textContent = e.message; err.style.display = 'block'; }
  };

  const content = h('div', { class: 'content' },
    h('div', { class: 'card' },
      h('label', {}, 'Имя'), f.name,
      h('label', {}, 'Email'), f.email,
      h('label', {}, 'Телефон'), f.phone,
      h('div', { class: 'field-row' }, h('div', {}, h('label', {}, 'Пол'), sex), h('div', {}, h('label', {}, 'Год рожд.'), f.birth_year)),
      h('div', { class: 'field-row' }, h('div', {}, h('label', {}, 'Рост'), f.height_cm), h('div', {}, h('label', {}, 'Вес'), f.weight_kg)),
      h('label', {}, 'Активность'), activity,
      h('label', {}, 'Цель'), f.goal
    ),
    h('div', { class: 'card' },
      h('div', { class: 'muted small', style: 'margin-bottom:4px' }, 'Целевые КБЖУ (задаёт специалист)'),
      h('div', { class: 'field-row' }, h('div', {}, h('label', {}, 'Ккал'), f.target_kcal), h('div', {}, h('label', {}, 'Белки'), f.target_protein)),
      h('div', { class: 'field-row' }, h('div', {}, h('label', {}, 'Жиры'), f.target_fat), h('div', {}, h('label', {}, 'Углеводы'), f.target_carbs))
    ),
    h('div', { class: 'card' }, h('label', {}, 'Заметки'), f.notes),
    h('div', { class: 'disclaimer' }, ic('alert'), h('span', {}, 'При беременности, диабете, заболеваниях ЖКТ и расстройствах пищевого поведения клиенту необходима консультация врача.')),
    err,
    h('button', { class: 'btn', onclick: save }, client ? 'Сохранить' : 'Добавить клиента')
  );
  render(shell('clients', content, { topbar: client ? 'Редактирование' : 'Новый клиент', back: () => history.back() }));
}

route('/client/:id', async (args) => {
  if (!requireRole('specialist')) return;
  loading();
  const [c, weightData] = await Promise.all([
    GET('/clients/' + args.id),
    GET('/clients/' + args.id + '/weight').catch(() => ({ items: [] }))
  ]);
  const menus = c.menus || [];
  const weights = weightData.items || [];
  const latestWeight = weights.length ? weights[weights.length - 1] : null;
  const previousWeight = weights.length > 1 ? weights[weights.length - 2] : null;
  const weightDelta = latestWeight && previousWeight ? Number(latestWeight.weight_kg) - Number(previousWeight.weight_kg) : null;
  const activeMenu = menus.find(m => m.status === 'published') || menus[0] || null;
  const menuLabel = activeMenu ? (activeMenu.status === 'published' ? 'Активно' : 'Черновик') : 'Нет меню';
  const menuLabelClass = activeMenu && activeMenu.status === 'published' ? 'success' : 'warn';

  const stat = (label, value, meta, tone) => h('div', { class: 'client-stat' },
    h('div', { class: 'client-stat-label' }, label),
    h('div', { class: 'client-stat-value' + (tone ? ' ' + tone : '') }, value),
    meta ? h('div', { class: 'client-stat-meta' }, meta) : null
  );

  const menuList = h('div', { class: 'client-menu-list' });
  if (!menus.length) {
    menuList.appendChild(h('div', { class: 'client-empty' },
      h('div', { class: 'client-empty-icon' }, ic('layers')),
      h('div', {}, h('b', {}, 'Меню ещё не создано'), h('span', {}, 'Соберите первый рацион на неделю')),
      h('button', { class: 'btn small', onclick: () => createMenu(c.id) }, ic('plus','sm'), 'Создать меню')
    ));
  }
  for (const m of menus) {
    menuList.appendChild(h('div', { class: 'client-menu-row', onclick: () => location.hash = '#/menu/' + m.id },
      h('div', { class: 'client-menu-icon' }, ic('layers','sm')),
      h('div', { class: 'grow' },
        h('div', { class: 'client-menu-title' }, m.title || 'Меню на неделю'),
        h('div', { class: 'client-menu-meta' },
          h('span', { class: 'status-dot ' + m.status }),
          m.status === 'published' ? 'Опубликовано' : 'Черновик',
          ' · ' + m.days_count + ' дн. · с ' + fmtDate(m.start_date)
        )
      ),
      h('span', { class: 'client-menu-arrow' }, ic('chevronRight','sm'))
    ));
  }

  const targetItems = [
    ['Калории', c.target_kcal ? fmt0(c.target_kcal) + ' ккал' : '—'],
    ['Белки', c.target_protein ? fmt(c.target_protein) + ' г' : '—'],
    ['Жиры', c.target_fat ? fmt(c.target_fat) + ' г' : '—'],
    ['Углеводы', c.target_carbs ? fmt(c.target_carbs) + ' г' : '—']
  ];

  const targets = h('div', { class: 'client-target-grid' }, ...targetItems.map(([label, value]) =>
    h('div', { class: 'client-target' }, h('span', {}, label), h('b', {}, value))));

  const intake = intakeCard(c);
  intake.classList.add('client-intake-card');

  const actions = h('div', { class: 'client-actions' },
    h('button', { class: 'btn', onclick: () => activeMenu ? location.hash = '#/menu/' + activeMenu.id : createMenu(c.id) }, ic('layers','sm'), activeMenu ? 'Открыть меню' : 'Собрать меню'),
    h('button', { class: 'btn secondary', onclick: () => location.hash = '#/chat/' + c.id }, ic('chat','sm'), 'Написать'),
    h('button', { class: 'btn secondary', onclick: () => location.hash = '#/weight/' + c.id }, ic('scale','sm'), 'История веса')
  );

  const content = h('div', { class: 'content client-page' },
    h('div', { class: 'client-hero' },
      h('div', { class: 'client-hero-main' },
        h('div', { class: 'client-avatar-xl' }, initials(c.name)),
        h('div', { class: 'client-hero-copy' },
          h('div', { class: 'client-kicker' }, 'КЛИЕНТ'),
          h('h2', {}, c.name),
          h('div', { class: 'client-goal' }, c.goal || 'Цель не указана'),
          h('div', { class: 'client-status-line' },
            h('span', { class: 'status-pill ' + menuLabelClass }, menuLabel),
            c.intake_completed ? h('span', { class: 'status-pill neutral' }, ic('check','sm'), 'Анкета заполнена') : h('span', { class: 'status-pill warn' }, 'Анкета не заполнена')
          )
        )
      ),
      h('div', { class: 'client-hero-actions' },
        h('button', { class: 'icon-btn', title: 'Изменить', onclick: () => location.hash = '#/client/' + c.id + '/edit' }, ic('edit','sm')),
        h('button', { class: 'icon-btn', title: 'Действия', onclick: () => shareInvite(c.id) }, ic('link','sm'))
      )
    ),

    h('div', { class: 'client-stats' },
      stat('Вес', latestWeight ? fmt(latestWeight.weight_kg) + ' кг' : (c.weight_kg ? fmt(c.weight_kg) + ' кг' : '—'), latestWeight ? 'последний замер' : 'нет замеров'),
      stat('Цель', c.target_kcal ? fmt0(c.target_kcal) + ' ккал' : 'Не задана', c.target_kcal ? 'дневная норма' : 'укажите в профиле'),
      stat('Меню', activeMenu ? activeMenu.days_count + ' дней' : 'Нет', activeMenu ? (activeMenu.status === 'published' ? 'опубликовано' : 'черновик') : 'требует действия'),
      stat('Изменение веса', weightDelta !== null ? (weightDelta > 0 ? '+' : '') + fmt(weightDelta) + ' кг' : '—', previousWeight ? 'с последнего замера' : 'нужно 2 замера', weightDelta !== null && weightDelta < 0 ? 'positive' : '')
    ),

    actions,

    h('div', { class: 'client-grid' },
      h('div', { class: 'client-main-col' },
        h('section', { class: 'card client-section' },
          h('div', { class: 'section-head' },
            h('div', {}, h('h3', {}, 'Меню'), h('p', {}, activeMenu ? 'Рацион клиента и его текущий статус' : 'У клиента пока нет активного меню')),
            h('button', { class: 'btn secondary small', onclick: () => createMenu(c.id) }, ic('plus','sm'), 'Новое меню')
          ),
          menuList
        ),
        h('section', { class: 'card client-section' },
          h('div', { class: 'section-head' },
            h('div', {}, h('h3', {}, 'Цели по КБЖУ'), h('p', {}, 'Дневные ориентиры для составления меню')),
            h('button', { class: 'btn ghost small', onclick: () => location.hash = '#/client/' + c.id + '/edit' }, 'Изменить')
          ),
          targets
        )
      ),
      h('div', { class: 'client-side-col' },
        intake,
        h('section', { class: 'card client-section client-weight-preview' },
          h('div', { class: 'section-head' },
            h('div', {}, h('h3', {}, 'Вес'), h('p', {}, latestWeight ? 'Последние измерения клиента' : 'Пока нет истории веса')),
            h('button', { class: 'btn ghost small', onclick: () => location.hash = '#/weight/' + c.id }, 'Открыть')
          ),
          latestWeight ? h('div', { class: 'weight-highlight' }, h('b', {}, fmt(latestWeight.weight_kg) + ' кг'), h('span', {}, latestWeight.measured_on || 'Последний замер')) :
            h('div', { class: 'client-empty compact' }, h('div', { class: 'client-empty-icon' }, ic('scale')), h('span', {}, 'Добавьте первый замер веса'))
        )
      )
    ),

    h('div', { class: 'client-footer-actions' },
      h('button', { class: 'btn ghost', onclick: () => shareInvite(c.id) }, ic('link','sm'), 'Ссылка-приглашение'),
      h('button', { class: 'btn ghost danger-text', onclick: () => archiveClient(c.id) }, ic('trash','sm'), 'В архив')
    )
  );

  render(shell('clients', content, { topbar: c.name, back: () => location.hash = '#/clients' }));
});

/* Карточка «Анкета клиента» на странице специалиста. */
const MEDICAL_LABELS = { pregnancy: 'Беременность / ГВ', diabetes: 'Диабет', gi: 'Заболевания ЖКТ', eating_disorder: 'РПП' };
function intakeCard(c) {
  const card = h('div', { class: 'card' });
  card.appendChild(h('div', { class: 'row-between' },
    h('h3', { style: 'margin:0;font-size:15px' }, 'Анкета клиента'),
    c.intake_completed ? h('span', { class: 'info-chip' }, ic('check', 'sm'), 'заполнена') : h('span', { class: 'info-chip warn' }, 'не заполнена')));
  if (!c.intake_completed && !c.allergies && !(c.medical_flags && c.medical_flags.length)) {
    card.appendChild(h('div', { class: 'muted small', style: 'margin-top:8px' }, 'Клиент ещё не прошёл анкету. Отправьте ему ссылку-приглашение.'));
    return card;
  }
  const rows = [];
  if (c.allergies) rows.push(['Аллергии', c.allergies]);
  if (c.dietary_prefs) rows.push(['Предпочтения', c.dietary_prefs]);
  for (const [k, v] of rows) {
    card.appendChild(h('div', { class: 'small', style: 'margin-top:8px' }, h('b', {}, k + ': '), v));
  }
  if (c.medical_flags && c.medical_flags.length) {
    const chips = h('div', { class: 'tag-list', style: 'margin-top:10px' });
    for (const f of c.medical_flags) chips.appendChild(h('span', { class: 'info-chip warn' }, ic('alert', 'sm'), MEDICAL_LABELS[f] || f));
    card.appendChild(chips);
  }
  return card;
}

route('/client/:id/edit', async (args) => {
  if (!requireRole('specialist')) return;
  loading();
  const c = await GET('/clients/' + args.id);
  clientForm(c);
});

async function shareInvite(clientId) {
  try {
    const r = await POST('/clients/' + clientId + '/invite', {});
    const url = location.origin + r.invite_path;
    sheet('Приглашение клиента', (panel, close) => {
      panel.appendChild(h('p', { class: 'small muted' }, 'Отправьте клиенту эту ссылку. Он задаст пароль и получит доступ к меню.'));
      const inp = h('input', { value: url, readonly: 'readonly' });
      panel.appendChild(inp);
      panel.appendChild(h('button', { class: 'btn', style: 'margin-top:12px', onclick: async () => {
        try { await navigator.clipboard.writeText(url); toast('Ссылка скопирована'); }
        catch (e) { inp.select(); document.execCommand && document.execCommand('copy'); toast('Скопировано'); }
      } }, 'Скопировать ссылку'));
      if (navigator.share) panel.appendChild(h('button', { class: 'btn secondary', style: 'margin-top:8px', onclick: () => navigator.share({ url, title: 'Приглашение' }) }, 'Поделиться'));
    });
  } catch (e) { toast(e.message, true); }
}

async function archiveClient(clientId) {
  if (!confirm('Переместить клиента в архив?')) return;
  await DEL('/clients/' + clientId);
  toast('В архиве'); location.hash = '#/clients';
}

async function createMenu(clientId) {
  sheet('Новое меню', (panel, close) => {
    const title = h('input', { placeholder: 'Название (напр. «Неделя 1»)' });
    const date = h('input', { type: 'date', value: new Date().toISOString().slice(0, 10) });
    const days = h('input', { type: 'number', value: '7', min: '1', max: '31' });
    panel.appendChild(h('label', {}, 'Название')); panel.appendChild(title);
    panel.appendChild(h('label', {}, 'Дата начала')); panel.appendChild(date);
    panel.appendChild(h('label', {}, 'Дней')); panel.appendChild(days);
    panel.appendChild(h('button', { class: 'btn', style: 'margin-top:14px', onclick: async () => {
      try {
        const r = await POST('/menus', { client_id: clientId, title: title.value || null, start_date: date.value, days_count: parseInt(days.value) || 7 });
        close(); location.hash = '#/menu/' + r.menu.id;
      } catch (e) { toast(e.message, true); }
    } }, 'Создать'));
  });
}

/* ==========================================================================
   СПЕЦИАЛИСТ: КОНСТРУКТОР МЕНЮ  (ЯДРО ПРОДУКТА)
   ========================================================================== */
let currentDay = 1;
let activeMeal = 'breakfast';

route('/menu/:id', async (args) => {
  if (!requireRole('specialist')) return;
  await renderMenu(parseInt(args.id));
});

async function renderMenu(menuId) {
  loading();
  const data = await GET('/menus/' + menuId);
  const menu = data.menu;
  if (currentDay > menu.days_count) currentDay = 1;
  let client = null;
  try { client = await GET('/clients/' + menu.client_id); } catch (_) {}

  const container = h('div', {});
  const action = h('button', { class: 'icon-btn', 'aria-label': 'Действия с меню', onclick: () => menuActions(data) }, ic('more'));
  const desktop = isDesktop();
  const wrap = h('div', { class: 'builder-wrap' });
  const main = h('div', { class: 'builder-main' });

  const day = data.days.find(x => x.day_number === currentDay) || { meals: [], totals: {}, deviation: null };
  const dlCurrent = dayLabel(menu.start_date, currentDay);
  const status = menu.status === 'published' ? 'Опубликовано' : 'Черновик';
  const menuMeta = h('div', { class: 'builder-context' },
    h('div', { class: 'builder-context-title' }, menu.title || 'Меню на неделю'),
    h('div', { class: 'builder-context-meta' },
      client?.name || 'Клиент', ' · ', `${dayLabel(menu.start_date, 1).dt} — ${dayLabel(menu.start_date, menu.days_count).dt}`,
      h('span', { class: 'builder-status ' + (menu.status === 'published' ? 'published' : 'draft') }, status)
    ),
    h('div', { class: 'builder-context-day' }, dlCurrent.wd, ' · ', dlCurrent.dt)
  );
  main.appendChild(menuMeta);

  const tabs = h('div', { class: 'day-tabs' });
  for (let d = 1; d <= menu.days_count; d++) {
    const dl = dayLabel(menu.start_date, d);
    const dday = data.days.find(x => x.day_number === d) || {};
    const hasMeals = (dday.meals || []).length > 0;
    tabs.appendChild(h('button', { class: d === currentDay ? 'active' : '', onclick: () => { currentDay = d; renderMenu(menuId); } },
      h('span', { class: 'wd' }, dl.wd), h('span', { class: 'dt' }, dl.dt),
      h('span', { class: 'day-state ' + (hasMeals ? 'has' : '') }, hasMeals ? '●' : '—')));
  }
  main.appendChild(tabs);
  main.appendChild(dayTotalsBar(day, data.targets));

  const groupsByMeal = {};
  for (const mt of MEAL_ORDER) {
    const meals = day.meals.filter(m => m.meal_type === mt);
    const addBtn = h('button', { class: 'add-inline', 'aria-label': 'Добавить блюдо',
      onclick: () => openDishPicker(menuId, mt) }, ic('plus'));
    const count = meals.length ? h('span', { class: 'meal-count' }, meals.length + ' ' + (meals.length === 1 ? 'блюдо' : (meals.length < 5 ? 'блюда' : 'блюд'))) : null;
    const copyBtn = meals.length && menu.days_count > 1
      ? h('button', { class: 'add-inline meal-copy', title: 'Скопировать приём в другие дни', onclick: () => copyMealSheet(menu, currentDay, mt) }, ic('copy', 'sm'))
      : null;
    const group = h('div', { class: 'meal-group', 'data-meal': mt },
      h('h4', {}, h('span', { class: 'mtime' }, MEAL_TIMES[mt]), MEAL_LABELS[mt], count, h('span', { class: 'spacer' }), copyBtn, addBtn)
    );
    if (!meals.length) {
      group.appendChild(h('div', { class: 'meal-empty', onclick: () => openDishPicker(menuId, mt) },
        h('span', { class: 'empty-plus' }, '+'), h('span', {}, 'Добавить блюдо')));
    }
    for (const m of meals) group.appendChild(mealCard(menuId, m));
    groupsByMeal[mt] = { group, addBtn };
    main.appendChild(group);
  }
  wrap.appendChild(main);

  container.appendChild(wrap);

  const menuTopbar = client && client.name ? client.name : (menu.title || 'Меню');
  render(shell('builder', container, { topbar: menuTopbar, back: () => location.hash = '#/client/' + menu.client_id, action }));
}

/* Добавить блюдо в приём пищи текущего дня и перерисовать. */
async function addDishToMeal(menuId, mealType, dishId, portion_g) {
  try {
    const payload = { day_number: currentDay, meal_type: mealType, dish_id: dishId };
    if (portion_g != null) payload.portion_g = Number(portion_g);
    await POST('/menus/' + menuId + '/items', payload);
    toast('Добавлено'); renderMenu(menuId);
  } catch (e) { toast(e.message, true); }
}

async function moveMenuItem(menuId, itemId, mealType) {
  try {
    await PATCH('/menus/' + menuId + '/items/' + itemId, { meal_type: mealType });
    toast('Приём пищи изменён'); renderMenu(menuId);
  } catch (e) { toast(e.message, true); }
}

/* Правая панель «База блюд» для десктопного конструктора. */
function buildFoodRail(menuId) {
  const el = h('div', { class: 'builder-db' });
  const target = h('div', { class: 'db-target' });
  const filterBar = h('div', { class: 'db-filters' });
  const search = h('input', { placeholder: 'Найти блюдо…' });
  const head = h('div', { class: 'db-head' },
    h('div', { class: 'db-head-row' }, h('div', {}, h('h3', {}, 'Добавить блюдо'), target), h('span', { class: 'db-count' }, 'База')),
    h('div', { class: 'search-field' }, ic('search'), search), filterBar
  );
  const body = h('div', { class: 'db-body' });
  const detail = h('div', { class: 'dish-detail' });
  el.appendChild(head); el.appendChild(body); el.appendChild(detail);

  let selected = null;
  let selectedPortion = 0;
  let activeFilter = 'all';
  const filterDefs = [['all','Все'],['breakfast','Завтрак'],['snack','Перекус'],['lunch','Обед'],['dinner','Ужин']];
  filterDefs.forEach(([key,label]) => {
    const b = h('button', { class: key === 'all' ? 'active' : '', onclick: () => { activeFilter = key; filterBar.querySelectorAll('button').forEach(x=>x.classList.remove('active')); b.classList.add('active'); load(); } }, label);
    filterBar.appendChild(b);
  });

  function showEmptyDetail() {
    detail.innerHTML = '';
    detail.appendChild(h('div', { class: 'detail-empty-icon' }, ic('layers')));
    detail.appendChild(h('h4', {}, 'Выберите блюдо'));
    detail.appendChild(h('p', {}, 'Нажмите на блюдо в списке, чтобы настроить порцию и добавить его в текущий приём пищи.'));
  }

  function showDetail(d) {
    selected = d;
    selectedPortion = parseFloat(d.base_portion_g || 180);
    detail.innerHTML = '';
    detail.appendChild(h('div', { class: 'detail-kicker' }, 'Блюдо из базы'));
    detail.appendChild(h('div', { class: 'detail-title-row' },
      h('div', { class: 'detail-title-wrap' }, h('h4', {}, d.name), h('span', { class: 'detail-base' }, fmt0(d.base_portion_g || 0) + ' г базовая порция')),
      h('button', { class: 'detail-close', 'aria-label': 'Снять выбор', onclick: () => { selected = null; showEmptyDetail(); load(); } }, ic('x', 'sm'))
    ));
    const portion = h('div', { class: 'portion-value' },
      h('span', {}, 'Порция'),
      h('div', { class: 'portion-input-wrap' },
        h('input', { class: 'rail-portion-input', type: 'number', min: '10', max: '2000', step: '5', value: String(Math.round(selectedPortion)), 'aria-label': 'Порция в граммах' }),
        h('span', {}, 'г')
      )
    );
    const input = portion.querySelector('.rail-portion-input');
    const range = h('input', { class:'portion-range', type:'range', min:'50', max:'600', step:'10', value:String(selectedPortion) });
    const nutri = h('div', { class:'detail-nutri' });
    const redraw = () => {
      selectedPortion = Math.max(10, Math.min(2000, parseFloat(input.value) || 0));
      input.value = String(Math.round(selectedPortion));
      range.value = String(Math.min(600, Math.max(50, selectedPortion)));
      const x = { kcal:(d.kcal_100||0)*selectedPortion/100, protein:(d.protein_100||0)*selectedPortion/100, fat:(d.fat_100||0)*selectedPortion/100, carbs:(d.carbs_100||0)*selectedPortion/100 };
      nutri.innerHTML='';
      [['Калории',x.kcal,'ккал'],['Белки',x.protein,'г'],['Жиры',x.fat,'г'],['Углеводы',x.carbs,'г']].forEach(r=>nutri.appendChild(h('div',{class:'row'},h('span',{},r[0]),h('b',{},fmt0(r[1])+' '+r[2]))));
    };
    range.addEventListener('input', () => { input.value = range.value; redraw(); });
    input.addEventListener('input', redraw);
    input.addEventListener('click', e => e.stopPropagation());
    detail.appendChild(portion);
    detail.appendChild(range);
    detail.appendChild(nutri);
    const actions=h('div',{class:'detail-actions'},
      h('button',{class:'btn',onclick:()=>addDishToMeal(menuId,activeMeal,d.id,selectedPortion)},ic('plus','sm'),'Добавить в ' + MEAL_LABELS[activeMeal].toLowerCase()),
      h('button',{class:'btn ghost',onclick:async(e)=>{e.stopPropagation();try{if(d.is_favorite){await DEL('/dishes/'+d.id+'/favorite');d.is_favorite=false;toast('Убрано из избранного');}else{await POST('/dishes/'+d.id+'/favorite');d.is_favorite=true;toast('В избранном');}}catch(err){toast(err.message,true);}}},'В избранное')
    );
    detail.appendChild(actions);
    redraw();
  }

  showEmptyDetail();

  const load = async () => {
    body.innerHTML = '<div class="muted small db-loading">Загрузка…</div>';
    const q = new URLSearchParams();
    if (search.value.trim()) q.set('q', search.value.trim());
    if (activeFilter !== 'all') q.set('meal_type', activeFilter);
    let data;
    try { data = await GET('/dishes?' + q.toString()); }
    catch (e) { body.innerHTML = ''; body.appendChild(h('div', { class: 'muted small' }, e.message)); return; }
    body.innerHTML = '';
    const count = data.items?.length || 0;
    const countEl = head.querySelector('.db-count'); if (countEl) countEl.textContent = count + ' блюд';
    if (!count) { body.appendChild(h('div', { class: 'empty' }, ic('search'), h('div', {}, 'Ничего не найдено'))); return; }
    for (const d of data.items) {
      const thumb = h('div', { class: 'thumb' });
      if (d.photo_url) thumb.style.backgroundImage = `url(${d.photo_url})`;
      const row=h('div', { class: 'db-food' + (selected?.id === d.id ? ' selected' : ''), onclick:()=>{ body.querySelectorAll('.db-food').forEach(x=>x.classList.remove('selected')); row.classList.add('selected'); showDetail(d); } }, thumb,
        h('div', { class: 'grow' }, h('h4', {}, d.name), h('div', { class: 'sub' }, `${fmt0(d.kcal_100 || 0)} ккал/100 г · ${fmt0(d.base_portion_g || 0)} г`)),
        h('button', { class: 'addb', 'aria-label': 'Добавить', onclick: (e) => { e.stopPropagation(); addDishToMeal(menuId, activeMeal, d.id); } }, ic('plus')));
      body.appendChild(row);
    }
  };
  let timer;
  search.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(load, 220); });
  return { el, api: { setTarget(mt) { target.innerHTML=''; target.append('Добавить в: ', h('b',{},MEAL_LABELS[mt])); load(); } } };
}

function dayTotalsBar(day, targets) {
  const t = day.totals || {};
  const tg = targets || {};
  const kcal = t.kcal || 0;
  const targetKcal = tg.target_kcal || 0;
  const ratio = targetKcal ? Math.round(kcal / targetKcal * 100) : 0;
  const dev = day.deviation;
  const over = dev && dev.kcal > 0;
  const bar = h('div', { class: 'day-totals' });
  const hero = h('div', { class: 'day-kcal' },
    h('div', { class:'eyebrow' }, 'На сегодня'),
    h('div', { class:'kcal-line' }, h('strong', { class:'kcal-big' }, fmt0(kcal)), h('span', { class:'target' }, targetKcal ? ' / ' + fmt0(targetKcal) + ' ккал' : ' ккал')),
    h('div', { class:'kcal-progress' }, h('span', { style:'width:'+Math.min(100,ratio)+'%' }))
  );
  const statusText = !targetKcal ? 'Цель не задана' : ratio > 105 ? 'Выше цели' : ratio >= 90 ? 'Цель почти достигнута' : 'Можно добавить';
  hero.appendChild(h('div', { class:'day-goal-status ' + (over ? 'over' : '') }, statusText, targetKcal ? ' · ' + ratio + '%' : ''));
  bar.appendChild(hero);
  const macros = h('div', { class: 'macros' });
  const macroTile = (label, val, target, cls, unit='г') => {
    const v = val || 0; const frac = target ? Math.min(1, v / target) : 0;
    return h('div', { class: 'macro ' + cls },
      h('div', { class:'macro-top' }, h('span',{class:'lbl'},label), h('span',{class:'macro-val'},fmt(v)+' '+unit)),
      h('div', { class:'macro-sub' }, target ? 'цель ' + fmt0(target) + ' г' : 'цель не задана'),
      h('div', { class:'bar' }, h('span', { style:'width:'+(frac*100)+'%' }))
    );
  };
  macros.appendChild(macroTile('Белки', t.protein, tg.target_protein, 'protein'));
  macros.appendChild(macroTile('Жиры', t.fat, tg.target_fat, 'fat'));
  macros.appendChild(macroTile('Углеводы', t.carbs, tg.target_carbs, 'carb'));
  bar.appendChild(macros);
  if (dev && dev.kcal != null) bar.appendChild(h('div',{class:'dev-chip '+(over?'over':'under')},(over?'+':'')+fmt0(dev.kcal)+' ккал'));
  return bar;
}

/* Поле поиска с иконкой. */
function searchField(input) {
  return h('div', { class: 'search-box' }, h('div', { class: 'search-field' }, ic('search'), input));
}

/* Загрузка изображения: File -> base64 -> /uploads/image -> url. */
function uploadImageFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) return reject({ message: 'Файл не выбран' });
    if (file.size > 3_000_000) return reject({ message: 'Файл больше 3 МБ' });
    const reader = new FileReader();
    reader.onload = async () => {
      try { const r = await POST('/uploads/image', { data: reader.result }); resolve(r.url); }
      catch (e) { reject(e); }
    };
    reader.onerror = () => reject({ message: 'Не удалось прочитать файл' });
    reader.readAsDataURL(file);
  });
}

/* Кнопка выбора/замены фото. onChange(url) вызывается после загрузки. */
function photoPicker(currentUrl, onChange, shape) {
  const preview = h('div', { class: 'photo-preview ' + (shape || 'square') });
  const setImg = (url) => { preview.style.backgroundImage = url ? `url(${url})` : 'none'; preview.classList.toggle('empty', !url); if (!url) preview.appendChild(ic('user')); };
  setImg(currentUrl);
  const input = h('input', { type: 'file', accept: 'image/*', style: 'display:none' });
  input.addEventListener('change', async () => {
    const f = input.files[0]; if (!f) return;
    preview.classList.add('loading');
    try { const url = await uploadImageFile(f); preview.innerHTML = ''; setImg(url); onChange(url); toast('Фото загружено'); }
    catch (e) { toast(e.message || 'Ошибка загрузки', true); }
    finally { preview.classList.remove('loading'); }
  });
  const wrap = h('div', { class: 'photo-picker', onclick: () => input.click() }, preview, h('span', { class: 'photo-hint' }, 'Изменить фото'), input);
  return wrap;
}

/* Звёзды рейтинга (только показ). */
function starsDisplay(avg, count) {
  const wrap = h('div', { class: 'stars' });
  const full = Math.round(avg || 0);
  for (let i = 1; i <= 5; i++) {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('class', 'icon sm star' + (i <= full ? ' on' : ''));
    s.innerHTML = '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>';
    wrap.appendChild(s);
  }
  if (avg != null) wrap.appendChild(h('span', { class: 'stars-num' }, fmt(avg) + (count != null ? ` · ${count}` : '')));
  else wrap.appendChild(h('span', { class: 'stars-num muted' }, 'нет отзывов'));
  return wrap;
}

/* Интерактивный выбор звёзд. onPick(value). */
function starsInput(value, onPick) {
  const wrap = h('div', { class: 'stars input' });
  const paint = (v) => wrap.querySelectorAll('svg').forEach((s, i) => s.classList.toggle('on', i < v));
  for (let i = 1; i <= 5; i++) {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('class', 'icon lg star');
    s.innerHTML = '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>';
    s.addEventListener('click', () => { value = i; paint(i); onPick(i); });
    wrap.appendChild(s);
  }
  paint(value || 0);
  return wrap;
}

function mealCard(menuId, m) {
  const n = m.nutrition || {};
  const thumb = h('div', { class: 'mc-thumb' });
  if (m.photo_url) thumb.style.backgroundImage = `url(${m.photo_url})`;

  const editBtn = h('button', { class: 'icon-btn', 'aria-label': 'Изменить порцию', onclick: (e) => { e.stopPropagation(); openPortionEditor(menuId, m); } }, ic('edit', 'sm'));
  const delBtn = h('button', { class: 'icon-btn', 'aria-label': 'Удалить', onclick: async (e) => {
    e.stopPropagation();
    try { await DEL('/menus/' + menuId + '/items/' + m.id); toast('Удалено'); renderMenu(menuId); } catch (err) { toast(err.message, true); }
  } }, ic('trash', 'sm'));

  return h('div', { class: 'meal-card' },
    h('div', { class: 'mc-top', onclick: () => openPortionEditor(menuId, m) },
      thumb,
      h('div', { class: 'mc-copy' },
        h('div', { class: 'mc-name' }, m.dish_name),
        h('div', { class: 'mc-meta-line' },
          h('span', { class: 'portion-static' }, fmt0(m.portion_g || 0) + ' г'),
          h('span', { class: 'dot-sep' }, '·'),
          macroLine(n, false)
        )
      ),
      h('div', { class: 'mc-kcal' }, fmt0(n.kcal) + ' ккал'),
      h('div', { class: 'mc-actions' }, editBtn, delBtn)
    ),
    m.comment ? h('div', { class: 'comment' }, ic('chat', 'sm'), h('span', {}, m.comment)) : null
  );
}

/* Выбор блюда — «не больше двух тапов»: открыть шторку, тап по блюду = добавлено. */
async function openDishPicker(menuId, mealType) {
  sheet('Добавить блюдо · ' + MEAL_LABELS[mealType], async (panel, close) => {
    panel.classList.add('dish-picker-modal');
    const intro = h('div', { class: 'modal-intro' }, 'Выберите блюдо, чтобы указать размер порции.');
    const search = h('input', { placeholder: 'Поиск блюда…' });
    panel.appendChild(intro);
    panel.appendChild(searchField(search));
    const results = h('div', { class: 'dish-picker-results' });
    panel.appendChild(results);

    let timer = null;
    const load = async () => {
      results.innerHTML = '<div class="muted small">Загрузка…</div>';
      const q = new URLSearchParams();
      if (search.value.trim()) q.set('q', search.value.trim());
      q.set('meal_type', mealType);
      let data;
      try { data = await GET('/dishes?' + q.toString()); }
      catch (e) { results.innerHTML = ''; results.appendChild(h('div', { class: 'muted small' }, e.message)); return; }
      results.innerHTML = '';
      if (!data.items.length) { results.appendChild(h('div', { class: 'empty' }, ic('search'), h('div', {}, 'Ничего не найдено'))); return; }
      for (const d of data.items) {
        const item = h('button', { class: 'pick-item dish-picker-row', type: 'button', onclick: () => {
          close();
          openNewDishPortionEditor(menuId, mealType, d);
        } },
          d.photo_url ? h('div', { class: 'pick-thumb', style: `background-image:url(${d.photo_url})` }) : h('div', { class: 'pick-thumb' }),
          h('div', { class: 'grow' },
            h('h3', {}, d.name),
            h('div', { class: 'sub' }, `${fmt0(d.kcal_100 || 0)} ккал/100 г · базовая порция ${fmt0(d.base_portion_g || 0)} г`),
            (d.tags && d.tags.length) ? h('div', { class: 'tag-list' }, d.tags.slice(0, 3).map(t => h('span', { class: 'pill tag' }, t))) : null
          ),
          h('span', { class: 'chevron' }, ic('chevron', 'sm'))
        );
        results.appendChild(item);
      }
    };
    search.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(load, 220); });
    load();
  }, { modal: true });
}

async function openNewDishPortionEditor(menuId, mealType, d) {
  let dish = d;
  try { dish = await GET('/dishes/' + d.id); } catch (_) {}
  sheet('Добавить блюдо', (panel, close) => {
    const base = Math.max(10, Math.round(dish.base_portion_g || 180));
    let portion = base;
    const totals = dish?.nutrition?.totals || {
      kcal: (dish.kcal_100 || 0) * base / 100,
      protein: (dish.protein_100 || 0) * base / 100,
      fat: (dish.fat_100 || 0) * base / 100,
      carbs: (dish.carbs_100 || 0) * base / 100
    };
    const title = h('div', { class: 'modal-dish-title' },
      dish.photo_url ? h('div', { class: 'modal-dish-thumb', style: `background-image:url(${dish.photo_url})` }) : null,
      h('div', {}, h('h2', {}, dish.name), h('div', { class: 'muted small' }, MEAL_LABELS[mealType] + ' · базовая порция ' + base + ' г'))
    );
    panel.appendChild(title);

    const value = h('div', { class: 'portion-modal-value' }, String(portion), h('span', {}, 'г'));
    const sliderMin = 50;
    const sliderMax = Math.max(600, Math.min(2000, Math.round(base * 2.2)));
    const slider = h('input', { class: 'portion-modal-range', type: 'range', min: String(sliderMin), max: String(sliderMax), step: '5', value: String(Math.max(sliderMin, Math.min(sliderMax, portion))), 'aria-label': 'Размер порции в граммах' });
    const rangeLabels = h('div', { class: 'portion-range-labels' }, h('span', {}, sliderMin + ' г'), h('span', {}, sliderMax + ' г'));
    const quick = h('div', { class: 'portion-quick' });
    const nutrition = h('div', {});
    const renderPreview = () => {
      const raw = parseFloat(slider.value);
      portion = Math.max(10, Math.min(2000, Number.isFinite(raw) ? raw : base));
      portion = Math.round(portion / 5) * 5;
      slider.value = String(Math.max(sliderMin, Math.min(sliderMax, portion)));
      value.firstChild.textContent = String(portion);
      const k = base ? portion / base : 1;
      nutrition.innerHTML = '';
      nutrition.appendChild(nutritionBreakdown({
        kcal: (totals.kcal || 0) * k,
        protein: (totals.protein || 0) * k,
        fat: (totals.fat || 0) * k,
        carbs: (totals.carbs || 0) * k
      }));
    };
    slider.addEventListener('input', () => renderPreview());
    quick.append(
      ...[base * .5, base, base * 1.5, base * 2].map((v, i) => h('button', { class: 'btn secondary small', type: 'button', onclick: () => { slider.value = String(Math.max(sliderMin, Math.min(sliderMax, Math.round(v / 5) * 5))); renderPreview(); } }, ['½ порции', '1 порция', '1½ порции', '2 порции'][i]))
    );
    panel.appendChild(h('div', { class: 'portion-modal' },
      h('div', { class: 'muted small center' }, 'Размер порции'),
      value,
      h('div', { class: 'portion-range-wrap' }, slider, rangeLabels),
      quick
    ));
    panel.appendChild(nutrition);
    renderPreview();

    const add = h('button', { class: 'btn', type: 'button', onclick: async () => {
      try {
        await POST('/menus/' + menuId + '/items', { day_number: currentDay, meal_type: mealType, dish_id: dish.id, portion_g: portion });
        close(); toast('Блюдо добавлено'); renderMenu(menuId);
      } catch (e) { toast(e.message, true); }
    } }, ic('plus', 'sm'), 'Добавить в ' + MEAL_LABELS[mealType].toLowerCase());
    panel.appendChild(add);
  }, { modal: true });
}

/* Редактор порции — слайдер, КБЖУ пересчитывается «на лету» на бэке. */
async function openPortionEditor(menuId, m) {
  loading();
  // Тянем состав блюда, чтобы показать ингредиенты и дать override.
  let dish;
  try { dish = await GET('/dishes/' + m.dish_id); } catch (e) { dish = null; }
  renderMenu(menuId); // вернуть фон

  sheet(m.dish_name, (panel, close) => {
    let portion = Math.round(m.portion_g);
    const base = dish ? (dish.base_portion_g || portion) : portion;
    const maxP = Math.max(base * 3, portion * 2, 100);

    if (dish && dish.photo_url) panel.appendChild(h('img', { class: 'dish-hero', src: dish.photo_url, alt: m.dish_name }));

    const valEl = h('div', { class: 'val' }, portion, h('span', {}, ' г'));
    const slider = h('input', { type: 'range', min: '10', max: String(Math.round(maxP)), step: '5', value: String(portion) });
    const nbBox = h('div', {}, nutritionBreakdown(m.nutrition));

    // Предпросчёт на клиенте (для отзывчивости), правда придёт из API при сохранении.
    const preview = () => {
      const k = base > 0 ? portion / base : 0;
      const whole = dish && dish.nutrition ? dish.nutrition.totals : null;
      const n = whole ? { kcal: whole.kcal * k, protein: whole.protein * k, fat: whole.fat * k, carbs: whole.carbs * k } : m.nutrition;
      nbBox.innerHTML = ''; nbBox.appendChild(nutritionBreakdown(n));
      valEl.firstChild.textContent = portion;
    };
    slider.addEventListener('input', () => { portion = parseInt(slider.value); preview(); });
    preview();

    // Быстрые кнопки
    const quick = h('div', { class: 'btn-row', style: 'margin:8px 0' },
      ...[base * 0.5, base, base * 1.5].map((v, i) =>
        h('button', { class: 'btn secondary small', onclick: () => { portion = Math.round(v); slider.value = String(portion); preview(); } },
          ['½ порции', '1 порция', '1½ порции'][i])));

    const comment = h('textarea', { placeholder: 'Комментарий клиенту (необязательно)' }, m.comment || '');

    panel.appendChild(h('div', { class: 'portion-edit' }, h('div', { class: 'muted small', style: 'text-align:center' }, 'Размер порции'), valEl, slider, quick));
    panel.appendChild(nbBox);
    panel.appendChild(h('label', {}, 'Комментарий')); panel.appendChild(comment);

    // Состав + точечная правка (override)
    if (dish && dish.ingredients && dish.ingredients.length) {
      panel.appendChild(h('div', { class: 'divider' }));
      panel.appendChild(h('div', { class: 'muted small', style: 'margin-bottom:6px' }, 'Состав (в сыром виде)'));
      for (const ing of dish.ingredients) {
        panel.appendChild(h('div', { class: 'row-between small', style: 'padding:3px 0' },
          h('span', {}, ing.name), h('span', { class: 'muted' }, fmt(ing.grams) + ' г')));
      }
    }

    const save = h('button', { class: 'btn', style: 'margin-top:14px', onclick: async () => {
      try {
        await PATCH('/menus/' + menuId + '/items/' + m.id, { portion_g: portion, comment: comment.value || null });
        close(); toast('Сохранено'); renderMenu(menuId);
      } catch (e) { toast(e.message, true); }
    } }, ic('check', 'sm'), 'Сохранить');
    const del = h('button', { class: 'btn danger', style: 'margin-top:8px', onclick: async () => {
      try { await DEL('/menus/' + menuId + '/items/' + m.id); close(); toast('Удалено'); renderMenu(menuId); }
      catch (e) { toast(e.message, true); }
    } }, ic('trash', 'sm'), 'Убрать из меню');
    panel.appendChild(save); panel.appendChild(del);
  }, { modal: true });
}

function menuActions(data) {
  const menu = data.menu;
  sheet('Действия с меню', (panel, close) => {
    const published = menu.status === 'published';
    panel.appendChild(h('button', { class: 'btn', onclick: async () => {
      try { await POST('/menus/' + menu.id + '/publish', { status: published ? 'draft' : 'published' });
        close(); toast(published ? 'Снято с публикации' : 'Опубликовано'); renderMenu(menu.id); }
      catch (e) { toast(e.message, true); }
    } }, published ? null : ic('checkCircle', 'sm'), published ? 'Снять с публикации' : 'Опубликовать клиенту'));

    panel.appendChild(h('button', { class: 'btn secondary', style: 'margin-top:8px', onclick: () => { close(); openShoppingList(menu.id); } }, ic('inbox', 'sm'), 'Список покупок'));
    panel.appendChild(h('button', { class: 'btn secondary', style: 'margin-top:8px', onclick: () => { close(); copyDaySheet(menu); } }, ic('copy', 'sm'), 'Скопировать день'));
    panel.appendChild(h('button', { class: 'btn secondary', style: 'margin-top:8px', onclick: async () => {
      try { const r = await POST('/menus/' + menu.id + '/duplicate', {}); close(); toast('Меню продублировано'); location.hash = '#/menu/' + r.menu.id; }
      catch (e) { toast(e.message, true); }
    } }, ic('layers', 'sm'), 'Дублировать на след. неделю'));

    panel.appendChild(h('div', { class: 'divider' }));
    panel.appendChild(h('button', { class: 'btn danger', onclick: async () => {
      if (!confirm('Удалить меню целиком?')) return;
      await DEL('/menus/' + menu.id); close(); toast('Удалено'); location.hash = '#/client/' + menu.client_id;
    } }, ic('trash', 'sm'), 'Удалить меню'));
  });
}

/* Список покупок из меню. Отметки «куплено» хранятся локально у зрителя. */
async function openShoppingList(menuId) {
  let data;
  try { data = await GET('/menus/' + menuId + '/shopping-list'); }
  catch (e) { toast(e.message, true); return; }

  const storeKey = 'nutri_shop_' + menuId;
  let checked = {};
  try { checked = JSON.parse(localStorage.getItem(storeKey) || '{}'); } catch (e) { checked = {}; }
  const persist = () => { try { localStorage.setItem(storeKey, JSON.stringify(checked)); } catch (e) {} };

  sheet('Список покупок', (panel, close) => {
    if (!data.groups.length) { panel.appendChild(h('div', { class: 'empty' }, ic('inbox'), h('div', {}, 'В меню пока нет блюд'))); return; }
    panel.appendChild(h('div', { class: 'muted small', style: 'margin-bottom:4px' }, data.total_items + ' позиций · дни ' + data.from_day + '–' + data.to_day));
    for (const g of data.groups) {
      panel.appendChild(h('div', { class: 'shop-cat' }, g.category));
      for (const it of g.items) {
        const key = String(it.ingredient_id);
        const row = h('div', { class: 'shop-item' + (checked[key] ? ' checked' : '') },
          h('span', { class: 'box' }, ic('check', 'sm')),
          h('span', { class: 'nm' }, it.name),
          h('span', { class: 'qty' }, it.display));
        row.addEventListener('click', () => {
          checked[key] = !checked[key];
          row.classList.toggle('checked', checked[key]);
          persist();
        });
        panel.appendChild(row);
      }
    }
  });
}

function copyDaySheet(menu) {
  sheet('Скопировать день', (panel, close) => {
    const from = h('select', {});
    const to = h('select', {});
    for (let d = 1; d <= menu.days_count; d++) {
      from.appendChild(h('option', { value: String(d) }, 'День ' + d));
      to.appendChild(h('option', { value: String(d) }, 'День ' + d));
    }
    from.value = String(currentDay);
    to.value = String(Math.min(currentDay + 1, menu.days_count));
    panel.appendChild(h('div', { class: 'field-row' },
      h('div', {}, h('label', {}, 'Откуда'), from),
      h('div', {}, h('label', {}, 'Куда'), to)));
    panel.appendChild(h('div', { class: 'muted small', style: 'margin-top:6px' }, 'Целевой день будет перезаписан.'));
    panel.appendChild(h('button', { class: 'btn', style: 'margin-top:12px', onclick: async () => {
      try { await POST('/menus/' + menu.id + '/copy-day', { from_day: parseInt(from.value), to_day: parseInt(to.value) });
        currentDay = parseInt(to.value); close(); toast('Скопировано'); renderMenu(menu.id); }
      catch (e) { toast(e.message, true); }
    } }, 'Скопировать'));
  });
}

/* Скопировать один приём пищи в выбранные дни (чекбоксы). */
function copyMealSheet(menu, fromDay, mealType) {
  sheet('Скопировать ' + (MEAL_LABELS[mealType] || 'приём'), (panel, close) => {
    panel.appendChild(h('div', { class: 'muted small', style: 'margin-bottom:8px' },
      MEAL_LABELS[mealType] + ' из «' + dayLabel(menu.start_date, fromDay).wd + ' · ' + dayLabel(menu.start_date, fromDay).dt + '» будет скопирован в выбранные дни (перезапишет их).'));
    const chosen = new Set();
    for (let d = 1; d <= menu.days_count; d++) {
      if (d === fromDay) continue;
      const dl = dayLabel(menu.start_date, d);
      panel.appendChild(checkRow(dl.wd + ' · ' + dl.dt, false, (on) => { on ? chosen.add(d) : chosen.delete(d); }));
    }
    const selectAll = h('button', { class: 'btn ghost small', style: 'margin-top:8px', onclick: () => {
      panel.querySelectorAll('.check-row:not(.on)').forEach(r => r.click());
    } }, 'Выбрать все дни');
    panel.appendChild(selectAll);
    panel.appendChild(h('button', { class: 'btn', style: 'margin-top:10px', onclick: async () => {
      if (!chosen.size) { toast('Выберите хотя бы один день', true); return; }
      try {
        await POST('/menus/' + menu.id + '/copy-meal', { from_day: fromDay, meal_type: mealType, to_days: [...chosen] });
        close(); toast('Скопировано в ' + chosen.size + ' ' + plural(chosen.size, 'день', 'дня', 'дней')); renderMenu(menu.id);
      } catch (e) { toast(e.message, true); }
    } }, ic('copy', 'sm'), 'Скопировать'));
  });
}

/* ==========================================================================
   СПЕЦИАЛИСТ: БАЗА БЛЮД
   ========================================================================== */
const TAG_LABEL = { высокобелковое: 'Высокобелковое', безлактозное: 'Без лактозы', безглютеновое: 'Без глютена', вегетарианское: 'Вегетарианское', веган: 'Веган', быстро: 'Быстро', бюджетно: 'Бюджетно' };
/* Фильтры базы: смешанный ряд «тип приёма + диета», как в макете. */
const BASE_FILTERS = [
  { key: 'all', label: 'Все' },
  { key: 'meal:breakfast', label: 'Завтрак' },
  { key: 'meal:snack1', label: 'Перекус' },
  { key: 'meal:lunch', label: 'Обед' },
  { key: 'meal:dinner', label: 'Ужин' },
  { key: 'tag:высокобелковое', label: 'Высокобелковое' },
  { key: 'lowcal', label: 'Низкокалорийное' },
  { key: 'tag:вегетарианское', label: 'Вегетарианское' },
  { key: 'tag:безлактозное', label: 'Без лактозы' },
  { key: 'tag:безглютеновое', label: 'Без глютена' },
];
const BASE_SCOPES = [['', 'Все блюда'], ['mine', 'Мои'], ['favorites', 'Избранное']];

/* Кнопка-звезда «в избранное» с оптимистичным переключением. */
function favStar(d) {
  const btn = h('button', { class: 'fav-star' + (d.is_favorite ? ' on' : ''), title: d.is_favorite ? 'В избранном' : 'В избранное' }, ic('star', 'sm'));
  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const next = !d.is_favorite;
    d.is_favorite = next; btn.classList.toggle('on', next);
    try {
      if (next) await POST('/dishes/' + d.id + '/favorite'); else await DEL('/dishes/' + d.id + '/favorite');
    } catch (err) { d.is_favorite = !next; btn.classList.toggle('on', !next); toast(err.message, true); }
  });
  return btn;
}

/* Карточка блюда для базы. */
function dishCard(d) {
  const mm = (label, val, cls) => h('span', { class: 'mm ' + cls }, label + ' ' + fmt(val || 0));
  return h('div', { class: 'dish-card', onclick: () => location.hash = '#/dish/' + d.id },
    h('div', { class: 'dish-card-head' },
      h('div', { class: 'dish-thumb' }, d.photo_url ? h('img', { src: d.photo_url, alt: '' }) : ic('utensils')),
      favStar(d)),
    h('div', { class: 'dish-name' }, d.name),
    h('div', { class: 'dish-kcal' }, fmt0(d.kcal_100 || 0), h('span', {}, ' ккал / 100 г')),
    h('div', { class: 'dish-macros' }, mm('Б', d.protein_100, 'b'), mm('Ж', d.fat_100, 'f'), mm('У', d.carbs_100, 'c')),
    h('div', { class: 'dish-foot' },
      h('span', { class: 'dish-portion' }, 'Порция ' + fmt0(d.base_portion_g || 0) + ' г'),
      d.is_mine ? h('span', { class: 'dish-mine' }, 'Моё') : null),
    d.tags && d.tags.length ? h('div', { class: 'dish-tags' }, ...d.tags.slice(0, 3).map(t => h('span', { class: 'dish-tag' }, TAG_LABEL[t] || t))) : null
  );
}

route('/base', async () => {
  if (!requireRole('specialist')) return;
  loading();
  let scope = '';
  let filter = 'all';
  let favCount = 0;

  const results = h('div', { class: 'dish-grid' });
  const countEl = h('p', {}, '');
  const search = h('input', { placeholder: 'Поиск блюда…' });
  const tabs = h('div', { class: 'seg base-scopes' });
  const chips = h('div', { class: 'chip-row filter-chips' });

  const load = async () => {
    results.innerHTML = '<div class="muted small" style="padding:10px">Загрузка…</div>';
    const q = new URLSearchParams();
    if (search.value.trim()) q.set('q', search.value.trim());
    if (scope) q.set('scope', scope);
    if (filter.startsWith('meal:')) q.set('meal_type', filter.slice(5));
    if (filter.startsWith('tag:')) q.set('tag', filter.slice(4));
    const data = await GET('/dishes?' + q.toString());
    favCount = data.favorites_count || 0;
    let items = data.items;
    if (filter === 'lowcal') items = items.filter(d => (d.kcal_100 || 0) <= 120);
    results.innerHTML = '';
    countEl.textContent = plural(items.length, 'блюдо', 'блюда', 'блюд') + ' · ' + items.length;
    if (!items.length) { results.appendChild(h('div', { class: 'empty' }, ic('search'), h('div', {}, 'Ничего не найдено'), h('div', { class: 'small' }, 'Измените фильтр или добавьте блюдо'))); return; }
    items.forEach(d => results.appendChild(dishCard(d)));
  };

  BASE_SCOPES.forEach(([val, label]) => {
    const b = h('button', { class: val === scope ? 'active' : '', onclick: () => {
      scope = val; tabs.querySelectorAll('button').forEach(x => x.classList.remove('active')); b.classList.add('active'); load();
    } }, label);
    tabs.appendChild(b);
  });
  BASE_FILTERS.forEach(({ key, label }) => {
    const b = h('button', { class: key === filter ? 'active' : '', onclick: () => {
      filter = key; chips.querySelectorAll('button').forEach(x => x.classList.remove('active')); b.classList.add('active'); load();
    } }, label);
    chips.appendChild(b);
  });

  let timer;
  search.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(load, 220); });

  const content = h('div', { class: 'content base-page' },
    h('div', { class: 'section-intro' },
      h('div', {}, h('h2', {}, 'База блюд'), countEl),
      h('button', { class: 'btn small', onclick: () => location.hash = '#/dish/new' }, ic('plus', 'sm'), 'Добавить блюдо')),
    searchField(search),
    tabs,
    chips,
    results
  );
  const fab = h('button', { class: 'btn fab', 'aria-label': 'Новое блюдо', onclick: () => location.hash = '#/dish/new' }, ic('plus'));
  render(shell('base', content, { topbar: 'База блюд' }));
  $app().querySelector('.screen').appendChild(fab);
  load();
});

route('/dish/new', () => { if (!requireRole('specialist')) return; dishForm(null); });

route('/dish/:id', async (args) => {
  if (!requireRole('specialist')) return;
  loading();
  const d = await GET('/dishes/' + args.id);
  const n = d.nutrition;
  const canEdit = d.created_by != null; // общую базу редактировать нельзя
  const content = h('div', { class: 'content' },
    d.photo_url ? h('img', { class: 'dish-hero', src: d.photo_url, alt: d.name }) : null,
    h('div', { class: 'card' },
      h('h3', { style: 'margin:0 0 8px' }, d.name),
      h('div', { class: 'kbju' },
        h('span', { class: 'pill k' }, fmt0(n.kcal_100) + ' ккал/100г'),
        h('span', { class: 'pill b' }, 'Б ' + fmt(n.protein_100)),
        h('span', { class: 'pill f' }, 'Ж ' + fmt(n.fat_100)),
        h('span', { class: 'pill c' }, 'У ' + fmt(n.carbs_100))),
      h('div', { class: 'muted small', style: 'margin-top:8px;display:flex;gap:6px;align-items:center;flex-wrap:wrap' },
        h('span', {}, 'Базовая порция: ' + fmt0(d.base_portion_g) + ' г'),
        d.cook_minutes ? h('span', { style: 'display:flex;gap:4px;align-items:center' }, ic('clock', 'sm'), fmt0(d.cook_minutes) + ' мин') : null),
      (d.tags && d.tags.length) ? h('div', { class: 'tag-list', style: 'margin-top:8px' }, d.tags.map(t => h('span', { class: 'pill tag' }, t))) : null
    ),
    h('div', { class: 'card' },
      h('div', { class: 'muted small', style: 'margin-bottom:6px' }, 'Состав (сырой вес)'),
      ...d.ingredients.map(ing => h('div', { class: 'row-between small', style: 'padding:4px 0;border-bottom:1px solid var(--line)' },
        h('span', {}, ing.name), h('span', { class: 'muted' }, fmt(ing.grams) + ' г')))
    ),
    recipeStepsView(d),
    canEdit ? h('div', { class: 'btn-row' },
      h('button', { class: 'btn secondary', onclick: () => dishForm(d) }, ic('edit', 'sm'), 'Изменить'),
      h('button', { class: 'btn danger', onclick: async () => { if (confirm('Удалить блюдо?')) { try { await DEL('/dishes/' + d.id); toast('Удалено'); location.hash = '#/base'; } catch (e) { toast(e.message, true); } } } }, ic('trash', 'sm'), 'Удалить')
    ) : h('div', { class: 'muted small center' }, 'Блюдо из общей базы — доступно только для чтения. Скопируйте его как своё, чтобы менять.')
  );
  render(shell('base', content, { topbar: 'Блюдо', back: () => location.hash = '#/base' }));
});

/* Показ рецепта: пошагово с отметкой «готово», либо цельным текстом. */
function recipeStepsView(d) {
  const steps = Array.isArray(d.recipe_steps) && d.recipe_steps.length ? d.recipe_steps
    : (d.instructions ? [d.instructions] : []);
  if (!steps.length) return null;
  const card = h('div', { class: 'card' });
  card.appendChild(h('div', { class: 'section-title' }, 'Рецепт'));
  steps.forEach((txt, i) => {
    const step = h('div', { class: 'recipe-step' },
      h('span', { class: 'n' }, String(i + 1)),
      h('span', { class: 'txt' }, txt));
    step.querySelector('.txt').addEventListener('click', () => step.classList.toggle('done'));
    step.querySelector('.n').addEventListener('click', () => step.classList.toggle('done'));
    card.appendChild(step);
  });
  return card;
}

async function dishForm(dish) {
  loading();
  const name = h('input', { placeholder: 'Название блюда', value: dish ? dish.name : '' });
  const cook = h('input', { type: 'number', placeholder: 'Время готовки, мин', value: dish ? (dish.cook_minutes || '') : '' });
  const tags = h('input', { placeholder: 'Теги через запятую (веган, быстро…)', value: dish && dish.tags ? dish.tags.join(', ') : '' });

  // Фото блюда
  let photoUrl = dish ? (dish.photo_url || null) : null;
  const photo = photoPicker(photoUrl, (url) => photoUrl = url, 'square');

  // Пошаговый рецепт
  const steps = dish && Array.isArray(dish.recipe_steps) ? [...dish.recipe_steps] : [];
  if (!steps.length && dish && dish.instructions) steps.push(dish.instructions);
  const stepsBox = h('div', {});
  const redrawSteps = () => {
    stepsBox.innerHTML = '';
    steps.forEach((txt, i) => {
      const ta = h('textarea', { placeholder: 'Шаг ' + (i + 1) }, txt);
      ta.addEventListener('input', () => steps[i] = ta.value);
      stepsBox.appendChild(h('div', { class: 'step-edit' },
        h('span', { class: 'n' }, String(i + 1)), ta,
        h('button', { class: 'icon-btn', 'aria-label': 'Удалить шаг', onclick: () => { steps.splice(i, 1); redrawSteps(); } }, ic('x', 'sm'))));
    });
    if (!steps.length) stepsBox.appendChild(h('div', { class: 'muted small' }, 'Добавьте шаги приготовления.'));
  };
  redrawSteps();
  const addStepBtn = h('button', { class: 'btn secondary small', onclick: () => { steps.push(''); redrawSteps(); } }, ic('plus', 'sm'), 'Шаг');

  const mealChecks = {};
  const mealBox = h('div', { class: 'chip-row', style: 'flex-wrap:wrap' });
  const selected = new Set(dish && dish.meal_types ? dish.meal_types : []);
  for (const mt of MEAL_ORDER) {
    const b = h('button', { type: 'button', class: selected.has(mt) ? 'active' : '', onclick: () => {
      if (selected.has(mt)) { selected.delete(mt); b.classList.remove('active'); }
      else { selected.add(mt); b.classList.add('active'); }
    } }, MEAL_LABELS[mt]);
    mealBox.appendChild(b);
  }

  // Ингредиенты блюда
  const compRows = h('div', {});
  const composition = dish && dish.ingredients ? dish.ingredients.map(i => ({ ingredient_id: i.ingredient_id, name: i.name, grams: i.grams })) : [];

  const nutriPreview = h('div', { class: 'card', style: 'position:sticky;bottom:0' });

  const redrawComp = () => {
    compRows.innerHTML = '';
    for (const [idx, row] of composition.entries()) {
      const g = h('input', { type: 'number', value: String(row.grams), style: 'width:80px' });
      g.addEventListener('input', () => { row.grams = parseFloat(g.value) || 0; });
      compRows.appendChild(h('div', { class: 'row-between', style: 'padding:6px 0;border-bottom:1px solid var(--line)' },
        h('span', { class: 'grow small' }, row.name),
        g, h('span', { class: 'small muted' }, 'г'),
        h('button', { class: 'icon-btn', 'aria-label': 'Убрать', onclick: () => { composition.splice(idx, 1); redrawComp(); } }, ic('x', 'sm'))));
    }
    if (!composition.length) compRows.appendChild(h('div', { class: 'muted small' }, 'Добавьте ингредиенты.'));
  };
  redrawComp();

  const addIngBtn = h('button', { class: 'btn secondary small', onclick: () => openIngredientPicker((ing) => {
    composition.push({ ingredient_id: ing.id, name: ing.name, grams: 100 }); redrawComp();
  }) }, '+ Ингредиент');

  const err = h('div', { class: 'form-err', style: 'display:none' });
  const save = async () => {
    err.style.display = 'none';
    const cleanSteps = steps.map(s => s.trim()).filter(Boolean);
    const payload = {
      name: name.value.trim(),
      meal_types: [...selected],
      cook_minutes: cook.value || null,
      recipe_steps: cleanSteps,
      instructions: cleanSteps.join('\n') || null,
      photo_url: photoUrl,
      tags: tags.value.split(',').map(s => s.trim()).filter(Boolean),
      ingredients: composition.map((r, i) => ({ ingredient_id: r.ingredient_id, grams: r.grams, sort_order: i }))
    };
    if (!payload.name) { err.textContent = 'Введите название'; err.style.display = 'block'; return; }
    if (!payload.ingredients.length) { err.textContent = 'Добавьте хотя бы один ингредиент'; err.style.display = 'block'; return; }
    try {
      const r = dish ? await PATCH('/dishes/' + dish.id, payload) : await POST('/dishes', payload);
      toast('Сохранено'); location.hash = '#/dish/' + r.id;
    } catch (e) { err.textContent = e.message; err.style.display = 'block'; }
  };

  const content = h('div', { class: 'content' },
    h('div', { class: 'card center' }, photo),
    h('div', { class: 'card' },
      h('label', {}, 'Название'), name,
      h('label', {}, 'Для приёмов пищи'), mealBox,
      h('label', {}, 'Время готовки'), cook,
      h('label', {}, 'Теги'), tags
    ),
    h('div', { class: 'card' },
      h('div', { class: 'row-between' }, h('div', { class: 'muted small' }, 'Состав (сырой вес)'), addIngBtn),
      h('div', { class: 'divider' }), compRows
    ),
    h('div', { class: 'card' },
      h('div', { class: 'row-between' }, h('div', { class: 'muted small' }, 'Рецепт по шагам'), addStepBtn),
      h('div', { class: 'divider' }), stepsBox
    ),
    err,
    h('button', { class: 'btn', onclick: save }, dish ? 'Сохранить блюдо' : 'Создать блюдо')
  );
  render(shell('base', content, { topbar: dish ? 'Редактирование блюда' : 'Новое блюдо', back: () => history.back() }));
}

function openIngredientPicker(onPick) {
  sheet('Ингредиент', async (panel, close) => {
    const search = h('input', { placeholder: 'Поиск ингредиента…' });
    panel.appendChild(searchField(search));
    const results = h('div', {});
    panel.appendChild(results);
    let timer;
    const load = async () => {
      const q = new URLSearchParams();
      if (search.value.trim()) q.set('q', search.value.trim());
      const data = await GET('/ingredients?' + q.toString());
      results.innerHTML = '';
      for (const ing of data.items) {
        results.appendChild(h('div', { class: 'pick-item', onclick: () => { onPick(ing); close(); } },
          h('div', { class: 'grow' }, h('h3', {}, ing.name),
            h('div', { class: 'sub' }, `${fmt0(ing.kcal)} ккал · Б ${fmt(ing.protein)} Ж ${fmt(ing.fat)} У ${fmt(ing.carbs)} /100г`)),
          h('span', { class: 'plus' }, ic('plus'))));
      }
      if (!data.items.length) results.appendChild(h('div', { class: 'empty' }, ic('search'), h('div', {}, 'Не найдено')));
    };
    search.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(load, 250); });
    load();
  });
}

/* ==========================================================================
   СПЕЦИАЛИСТ: ЧАТ, ВЕС, ПРОФИЛЬ
   ========================================================================== */
route('/chat/:id', async (args) => {
  if (!requireRole('specialist')) return;
  await renderChat('/clients/' + args.id + '/messages', 'specialist', '#/client/' + args.id, 'Чат с клиентом');
});

route('/client-chat', async () => {
  if (!requireRole('client')) return;
  await renderChat('/me/messages', 'client', null, 'Чат со специалистом', 'chat');
});

async function renderChat(endpoint, myType, back, title, navKey) {
  loading();
  const { items } = await GET(endpoint);
  const thread = h('div', { class: 'chat-thread' });
  const paint = (msgs) => {
    thread.innerHTML = '';
    for (const m of msgs) {
      const mine = m.author_type === myType;
      thread.appendChild(h('div', { class: 'bubble ' + (mine ? 'me' : 'them') },
        m.body, h('span', { class: 'time' }, new Date(m.created_at).toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }))));
    }
  };
  paint(items);
  const input = h('input', { placeholder: 'Сообщение…' });
  const send = async () => {
    const body = input.value.trim();
    if (!body) return;
    input.value = '';
    try { await POST(endpoint, { body }); const r = await GET(endpoint); paint(r.items); scrollBottom(); }
    catch (e) { toast(e.message, true); }
  };
  const bar = h('div', { class: 'chat-input' }, input, h('button', { class: 'btn', 'aria-label': 'Отправить', onclick: send }, ic('send', 'sm')));
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });

  const content = h('div', { class: 'content', style: 'padding-bottom:80px' }, thread);
  const opts = { topbar: title };
  if (back) opts.back = () => location.hash = back;
  render(shell(navKey || 'clients', content, opts));
  $app().querySelector('.screen').appendChild(bar);
  scrollBottom();
}
function scrollBottom() { setTimeout(() => window.scrollTo(0, document.body.scrollHeight), 50); }

route('/weight/:id', async (args) => {
  if (!requireRole('specialist')) return;
  loading();
  const { items } = await GET('/clients/' + args.id + '/weight');
  const content = h('div', { class: 'content' },
    h('div', { class: 'card' }, h('h3', { style: 'margin:0 0 10px;font-size:15px' }, 'График веса'), weightChart(items)),
    weightTable(items)
  );
  render(shell('clients', content, { topbar: 'Вес клиента', back: () => location.hash = '#/client/' + args.id }));
});

route('/profile', async () => {
  if (!requireRole('specialist')) return;
  loading();
  const p = await GET('/profile');
  let photoUrl = p.photo_url || null;

  const name = h('input', { placeholder: 'Имя и фамилия', value: p.name || '' });
  const spec = h('input', { placeholder: 'Специализация (напр. Снижение веса, ЖКТ)', value: p.specialization || '' });
  const city = h('input', { placeholder: 'Город', value: p.city || '' });
  const bio = h('textarea', { placeholder: 'О себе, подход к работе' }, p.bio || '');
  const cred = h('textarea', { placeholder: 'Образование, сертификаты' }, p.credentials || '');
  const exp = h('input', { type: 'number', placeholder: 'лет', value: p.experience_years || '' });
  const price = h('input', { type: 'number', placeholder: '₽', value: p.price_from || '' });

  let listed = !!p.is_listed;
  const listedRow = checkRow('Показывать меня в публичном каталоге', listed, (on) => listed = on);

  const save = async (goCatalog) => {
    try {
      const r = await PATCH('/profile', {
        name: name.value.trim(), specialization: spec.value || null, city: city.value || null,
        bio: bio.value || null, credentials: cred.value || null,
        experience_years: exp.value || null, price_from: price.value || null,
        photo_url: photoUrl, is_listed: listed,
      });
      State.user = { ...State.user, name: r.name, photo_url: r.photo_url };
      toast('Профиль сохранён');
      if (goCatalog && r.slug) location.hash = '#/n/' + r.slug;
    } catch (e) { toast(e.message, true); }
  };

  const rating = p.rating || { average: null, count: 0 };
  const content = h('div', { class: 'content stagger' },
    h('div', { class: 'card center' },
      photoPicker(photoUrl, (url) => photoUrl = url, 'round'),
      h('div', { style: 'margin-top:8px' }, starsDisplay(rating.average, rating.count)),
      h('div', { class: 'muted small', style: 'margin-top:6px' }, p.email + ' · клиентов: ' + (p.clients_count || 0))),
    h('div', { class: 'card' },
      h('label', {}, 'Имя'), name,
      h('label', {}, 'Специализация'), spec,
      h('div', { class: 'field-row' }, h('div', {}, h('label', {}, 'Город'), city), h('div', {}, h('label', {}, 'Опыт, лет'), exp)),
      h('label', {}, 'Стоимость, ₽ (от)'), price,
      h('label', {}, 'О себе'), bio,
      h('label', {}, 'Образование и сертификаты'), cred),
    h('div', { class: 'card' },
      h('div', { class: 'section-title' }, 'Публичная страница'),
      listedRow,
      p.slug ? h('button', { class: 'btn ghost small', style: 'margin-top:4px', onclick: () => location.hash = '#/n/' + p.slug }, ic('link', 'sm'), 'Открыть мою страницу') : h('div', { class: 'muted small' }, 'Включите каталог и сохраните — появится ваша публичная страница.')),
    h('button', { class: 'btn', onclick: () => save(false) }, ic('check', 'sm'), 'Сохранить'),
    h('div', { class: 'card', style: 'margin-top:14px' },
      h('div', { class: 'small', style: 'margin-bottom:8px' }, 'Тариф: ' + (p.plan === 'trial' ? 'пробный' : p.plan) + (p.plan_expires_at ? ' до ' + p.plan_expires_at.slice(0, 10) : '')),
      h('button', { class: 'btn danger', onclick: logout }, ic('logout', 'sm'), 'Выйти'))
  );
  render(shell('profile', content, { topbar: 'Мой профиль' }));
});

async function logout() {
  try { await POST('/auth/logout', {}); } catch (e) {}
  State.clear(); location.hash = '#/';
}

/* ==========================================================================
   ПУБЛИЧНЫЙ КАТАЛОГ НУТРИЦИОЛОГОВ
   ========================================================================== */

/* Каркас для публичных страниц (без нижней навигации). */
function publicShell(content, opts = {}) {
  const wrap = h('div', { class: 'screen', style: 'padding-bottom:24px' });
  const bar = h('div', { class: 'topbar' });
  bar.appendChild(h('button', { class: 'icon-btn', 'aria-label': 'Назад', onclick: opts.back || (() => history.back()) }, ic('arrowLeft')));
  bar.appendChild(h('h1', {}, opts.topbar || ''));
  wrap.appendChild(bar);
  wrap.appendChild(content);
  render(wrap);
}

route('/catalog', async () => {
  loading();
  const content = h('div', { class: 'content' });
  const search = h('input', { placeholder: 'Имя или специализация…' });
  const results = h('div', { class: 'stagger catalog-grid' });

  const load = async () => {
    results.innerHTML = '';
    for (let i = 0; i < 4; i++) results.appendChild(h('div', { class: 'skeleton sk-card' }));
    const q = new URLSearchParams();
    if (search.value.trim()) q.set('q', search.value.trim());
    let data;
    try { data = await GET('/catalog?' + q.toString()); } catch (e) { results.innerHTML = ''; results.appendChild(h('div', { class: 'empty' }, e.message)); return; }
    results.innerHTML = '';
    if (!data.items.length) { results.appendChild(h('div', { class: 'empty' }, ic('users'), h('div', {}, 'Пока никого не найдено'))); return; }
    for (const s of data.items) {
      const ava = h('div', { class: 'ava' });
      if (s.photo_url) ava.style.backgroundImage = `url(${s.photo_url})`; else ava.textContent = initials(s.name);
      results.appendChild(h('div', { class: 'list-item', onclick: () => location.hash = '#/n/' + s.slug },
        h('div', { class: 'catalog-card', style: 'flex:1' }, ava,
          h('div', { class: 'grow' },
            h('h3', { style: 'margin:0' }, s.name),
            s.specialization ? h('div', { class: 'spec' }, s.specialization) : null,
            h('div', { class: 'meta' },
              starsDisplay(s.avg_rating, s.reviews_count),
              s.city ? h('span', {}, s.city) : null,
              s.price_from ? h('span', {}, 'от ' + s.price_from + ' ₽') : null))),
        ic('chevronRight', 'chevron sm')));
    }
  };
  let timer;
  search.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(load, 250); });
  content.appendChild(searchField(search));
  content.appendChild(results);
  publicShell(content, { topbar: 'Каталог нутрициологов', back: () => location.hash = State.token ? defaultRoute() : '#/' });
  load();
});

route('/n/:slug', async (args) => {
  loading();
  let p;
  try { p = await GET('/catalog/' + args.slug); }
  catch (e) { publicShell(h('div', { class: 'empty' }, ic('search'), h('div', {}, 'Специалист не найден')), { topbar: '' }); return; }

  const ava = h('div', { class: 'ava' });
  if (p.photo_url) ava.style.backgroundImage = `url(${p.photo_url})`; else ava.textContent = initials(p.name);

  const meta = h('div', { class: 'meta', style: 'justify-content:center;margin-top:8px' });
  if (p.city) meta.appendChild(h('span', { class: 'info-chip' }, p.city));
  if (p.experience_years) meta.appendChild(h('span', { class: 'info-chip' }, ic('clock', 'sm'), 'опыт ' + p.experience_years + ' лет'));
  if (p.price_from) meta.appendChild(h('span', { class: 'info-chip' }, 'от ' + p.price_from + ' ₽'));

  const content = h('div', { class: 'content stagger' },
    h('div', { class: 'profile-head' },
      ava,
      h('h2', {}, p.name),
      p.specialization ? h('div', { class: 'muted' }, p.specialization) : null,
      h('div', { style: 'display:flex;justify-content:center;margin-top:8px' }, starsDisplay(p.rating.average, p.rating.count)),
      meta),
    p.bio ? h('div', { class: 'card' }, h('div', { class: 'section-title' }, 'О специалисте'), h('div', {}, p.bio)) : null,
    p.credentials ? h('div', { class: 'card' }, h('div', { class: 'section-title' }, 'Образование'), h('div', {}, p.credentials)) : null,
    reviewsCard(p.reviews)
  );
  publicShell(content, { topbar: '', back: () => history.length > 1 ? history.back() : (location.hash = '#/catalog') });
});

function reviewsCard(reviews) {
  const card = h('div', { class: 'card' });
  card.appendChild(h('div', { class: 'section-title' }, 'Отзывы (' + reviews.length + ')'));
  if (!reviews.length) { card.appendChild(h('div', { class: 'muted small' }, 'Отзывов пока нет.')); return card; }
  for (const r of reviews) {
    card.appendChild(h('div', { class: 'review' },
      h('div', { class: 'who' }, h('span', {}, r.client_name), starsDisplay(r.rating, null)),
      r.body ? h('div', { class: 'body' }, r.body) : null));
  }
  return card;
}

/* ==========================================================================
   КЛИЕНТ: СЕГОДНЯ / НЕДЕЛЯ / ПРОГРЕСС
   ========================================================================== */
function currentDayNumber(menu) {
  // День меню на сегодня относительно start_date.
  const start = new Date(menu.start_date + 'T00:00:00');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.floor((today - start) / 86400000) + 1;
  return Math.min(Math.max(diff, 1), menu.days_count);
}

route('/today', async () => {
  if (!requireRole('client')) return;
  loading();
  const data = await GET('/me/menu');
  if (!data.menu) {
    render(shell('today', h('div', { class: 'empty' }, ic('inbox'), h('div', {}, 'Меню ещё не назначено'), h('div', { class: 'small' }, 'Загляните позже')), { topbar: 'Сегодня' }));
    return;
  }
  const dayNum = currentDayNumber(data.menu);
  renderClientDay(data, dayNum, 'today', 'Сегодня');
});

route('/week', async () => {
  if (!requireRole('client')) return;
  loading();
  const data = await GET('/me/menu');
  if (!data.menu) { render(shell('week', h('div', { class: 'empty' }, ic('inbox'), h('div', {}, 'Меню ещё не назначено')), { topbar: 'Неделя' })); return; }
  const content = h('div', {});
  const tabs = h('div', { class: 'day-tabs' });
  const bodyWrap = h('div', {});
  const showDay = (d) => {
    tabs.querySelectorAll('button').forEach((b, i) => b.classList.toggle('active', i + 1 === d));
    bodyWrap.innerHTML = '';
    bodyWrap.appendChild(clientDayBody(data, d));
  };
  for (let d = 1; d <= data.menu.days_count; d++) {
    tabs.appendChild(h('button', { onclick: () => showDay(d) }, 'День ' + d));
  }
  content.appendChild(tabs);
  content.appendChild(bodyWrap);
  const shopBtn = h('button', { class: 'icon-btn', 'aria-label': 'Список покупок', onclick: () => openShoppingList(data.menu.id) }, ic('inbox'));
  render(shell('week', content, { topbar: data.menu.title || 'Меню на неделю', action: shopBtn }));
  showDay(currentDayNumber(data.menu));
});

function renderClientDay(data, dayNum, navKey, title) {
  const day = data.days.find(x => x.day_number === dayNum) || { meals: [], totals: {}, deviation: null };
  const content = h('div', {});
  content.appendChild(dayTotalsBar(day, data.targets));
  content.appendChild(clientDayBody(data, dayNum));
  render(shell(navKey, content, { topbar: title + ' · День ' + dayNum }));
}

function clientDayBody(data, dayNum) {
  const day = data.days.find(x => x.day_number === dayNum) || { meals: [] };
  const body = h('div', { class: 'content' });
  if (!day.meals.length) { body.appendChild(h('div', { class: 'empty' }, ic('utensils'), h('div', {}, 'На этот день блюд нет'))); return body; }
  for (const mt of MEAL_ORDER) {
    const meals = day.meals.filter(m => m.meal_type === mt);
    if (!meals.length) continue;
    body.appendChild(h('h4', { class: 'meal-head' }, h('span', { class: 'mtime' }, MEAL_TIMES[mt]), MEAL_LABELS[mt]));
    for (const m of meals) body.appendChild(clientMealCard(data.menu.id, m));
  }
  return body;
}

function clientMealCard(menuId, m) {
  const n = m.nutrition;
  const eaten = m.log && m.log.status === 'eaten';
  const skipped = m.log && m.log.status === 'skipped';
  const card = h('div', { class: 'meal-card' + (eaten ? ' eaten' : '') + (skipped ? ' skipped' : '') });
  const thumb = h('div', { class: 'mc-thumb' });
  if (m.photo_url) thumb.style.backgroundImage = `url(${m.photo_url})`;
  card.appendChild(h('div', { class: 'mc-top', onclick: () => showDishForClient(m) },
    thumb,
    h('div', { style: 'flex:1;min-width:0' }, h('div', { class: 'mc-name' }, m.dish_name), macroLine(n, true)),
    h('div', { class: 'mc-kcal' }, fmt0(n.kcal) + ' ккал')));
  if (m.comment) card.appendChild(h('div', { class: 'comment' }, ic('chat', 'sm'), h('span', {}, m.comment)));
  const actions = h('div', { class: 'btn-row', style: 'margin-top:10px' },
    h('button', { class: 'btn ' + (eaten ? '' : 'tonal') + ' small', onclick: () => logMeal(menuId, m, 'eaten') }, eaten ? ic('check', 'sm') : null, eaten ? 'Съедено' : 'Съел'),
    h('button', { class: 'btn ' + (skipped ? 'danger' : 'tonal') + ' small', onclick: () => logMeal(menuId, m, 'skipped') }, 'Пропустил'));
  card.appendChild(actions);
  return card;
}

async function logMeal(menuId, m, status) {
  try {
    // Повторное нажатие того же статуса — снять отметку.
    if (m.log && m.log.status === status) { await DEL('/menu-items/' + m.id + '/log'); }
    else { await POST('/menu-items/' + m.id + '/log', { status }); }
    toast('Отмечено');
    // Перерисовать текущий экран
    router();
  } catch (e) { toast(e.message, true); }
}

function showDishForClient(m) {
  sheet(m.dish_name, async (panel, close) => {
    if (m.photo_url) panel.appendChild(h('img', { class: 'dish-hero', src: m.photo_url, alt: m.dish_name }));
    panel.appendChild(h('div', { class: 'muted small', style: 'margin-bottom:8px' }, 'Порция: ' + fmt(m.nutrition.portion_g) + ' г'));
    panel.appendChild(nutritionBreakdown(m.nutrition));
    if (m.comment) panel.appendChild(h('div', { class: 'comment', style: 'margin-top:8px' }, ic('chat', 'sm'), h('span', {}, m.comment)));
    try {
      const d = await GET('/dishes/' + m.dish_id);
      panel.appendChild(h('div', { class: 'divider' }));
      panel.appendChild(h('div', { class: 'section-title', style: 'margin-bottom:6px' }, 'Состав'));
      for (const ing of d.ingredients) {
        panel.appendChild(h('div', { class: 'row-between small', style: 'padding:3px 0' },
          h('span', {}, ing.name), h('span', { class: 'muted' }, fmt(ing.grams) + ' г')));
      }
      const rv = recipeStepsView(d);
      if (rv) { rv.style.padding = '0'; rv.style.boxShadow = 'none'; rv.style.border = 'none'; rv.style.margin = '10px 0 0'; panel.appendChild(rv); }
    } catch (e) { /* блюдо может быть из общей базы, доступно */ }
  });
}

route('/progress', async () => {
  if (!requireRole('client')) return;
  loading();
  const p = await GET('/me/progress');
  const content = h('div', { class: 'content' },
    h('div', { class: 'card' },
      h('div', { class: 'ring-wrap' },
        complianceRing(p.compliance),
        h('div', {},
          h('div', { class: 'muted small' }, 'Соблюдение меню'),
          h('div', {}, `Съедено: ${p.eaten} · Пропущено: ${p.skipped}`),
          h('div', { class: 'small muted' }, `Всего блюд: ${p.total_items}`)))),
    h('div', { class: 'card' },
      h('div', { class: 'row-between' },
        h('h3', { style: 'margin:0;font-size:15px' }, 'Вес'),
        h('button', { class: 'btn secondary small', onclick: () => addWeightSheet() }, ic('plus','sm'), 'Замер')),
      p.current_weight ? h('div', { style: 'font-size:24px;font-weight:800;color:var(--brand-700);margin:6px 0;font-family:var(--font-display)' }, fmt(p.current_weight) + ' кг') : h('div', { class: 'muted small' }, 'Нет замеров'),
      weightChart(p.weight_series)),
    weightTable(p.weight_series),
    h('button', { class: 'btn secondary', onclick: openReviewSheet }, ic('sparkles', 'sm'), 'Оценить специалиста')
  );
  render(shell('progress', content, { topbar: 'Прогресс' }));
});

/* Клиент оставляет/меняет отзыв о своём специалисте. */
async function openReviewSheet() {
  let data;
  try { data = await GET('/me/review'); } catch (e) { toast(e.message, true); return; }
  sheet('Отзыв о специалисте', (panel, close) => {
    if (data.specialist) {
      panel.appendChild(specBadge(data.specialist));
    }
    let rating = data.review ? data.review.rating : 0;
    panel.appendChild(h('div', { class: 'center', style: 'margin:10px 0' }, starsInput(rating, (v) => rating = v)));
    const body = h('textarea', { placeholder: 'Поделитесь впечатлением (необязательно)' }, data.review ? (data.review.body || '') : '');
    panel.appendChild(body);
    panel.appendChild(h('button', { class: 'btn', style: 'margin-top:12px', onclick: async () => {
      if (!rating) { toast('Поставьте оценку', true); return; }
      try { await POST('/me/review', { rating, body: body.value || null }); close(); toast('Спасибо за отзыв!'); }
      catch (e) { toast(e.message, true); }
    } }, ic('check', 'sm'), data.review ? 'Обновить отзыв' : 'Отправить отзыв'));
    if (data.specialist && data.specialist.slug) {
      panel.appendChild(h('button', { class: 'btn ghost', style: 'margin-top:6px', onclick: () => { close(); location.hash = '#/n/' + data.specialist.slug; } }, 'Страница специалиста'));
    }
  });
}

function complianceRing(pct) {
  const p = pct == null ? 0 : pct;
  const r = 42, c = 2 * Math.PI * r;
  const off = c * (1 - p / 100);
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 100 100'); svg.setAttribute('class', 'ring');
  svg.innerHTML = `
    <defs>
      <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="var(--g1)"/><stop offset="100%" stop-color="var(--g2)"/>
      </linearGradient>
    </defs>
    <circle class="track" cx="50" cy="50" r="${r}" fill="none" stroke-width="11"/>
    <circle class="prog" cx="50" cy="50" r="${r}" fill="none" stroke-width="11"
      stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c}"
      transform="rotate(-90 50 50)"/>
    <text x="50" y="57" text-anchor="middle" class="num">${pct == null ? '—' : p + '%'}</text>`;
  // Анимация заполнения после вставки.
  requestAnimationFrame(() => { const prog = svg.querySelector('.prog'); if (prog) prog.setAttribute('stroke-dashoffset', String(off)); });
  return svg;
}

function addWeightSheet() {
  sheet('Новый замер веса', (panel, close) => {
    const w = h('input', { type: 'number', step: '0.1', placeholder: 'Вес, кг' });
    const d = h('input', { type: 'date', value: new Date().toISOString().slice(0, 10) });
    panel.appendChild(h('label', {}, 'Вес, кг')); panel.appendChild(w);
    panel.appendChild(h('label', {}, 'Дата')); panel.appendChild(d);
    panel.appendChild(h('button', { class: 'btn', style: 'margin-top:12px', onclick: async () => {
      if (!w.value) return;
      try { await POST('/me/weight', { weight_kg: parseFloat(w.value), measured_on: d.value }); close(); toast('Записано'); router(); }
      catch (e) { toast(e.message, true); }
    } }, 'Сохранить'));
  });
}

function weightChart(series) {
  const wrap = h('div', { class: 'chart' });
  if (!series || series.length < 2) { wrap.appendChild(h('div', { class: 'muted small center', style: 'padding:30px 0' }, 'Недостаточно данных для графика')); return wrap; }
  const W = 720, H = 220, padX = 42, padY = 28;
  const vals = series.map(s => s.weight_kg);
  const min = Math.min(...vals), max = Math.max(...vals);
  const range = (max - min) || 1;
  const rangePad = Math.max(range * 0.16, 0.6);
  const lo = min - rangePad, hi = max + rangePad, span = hi - lo;
  const x = (i) => padX + (i / (series.length - 1)) * (W - padX * 2);
  const y = (v) => padY + (1 - (v - lo) / span) * (H - padY * 2);
  const coords = series.map((s, i) => [x(i), y(s.weight_kg)]);
  const smoothPath = (pts) => {
    if (pts.length < 2) return '';
    let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
      const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
    }
    return d;
  };
  const linePath = smoothPath(coords);
  const dots = series.map((s, i) => `<circle cx="${x(i)}" cy="${y(s.weight_kg)}" r="4.5" fill="var(--surface)" stroke="var(--brand)" stroke-width="3"/>`).join('');
  const grid = [0.25, 0.5, 0.75].map(r => `<line x1="${padX}" y1="${(padY + r*(H-padY*2)).toFixed(1)}" x2="${W-padX}" y2="${(padY + r*(H-padY*2)).toFixed(1)}" stroke="var(--line)" stroke-width="1" stroke-dasharray="4 5"/>`).join('');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.innerHTML = `
    <defs>
      <linearGradient id="wArea" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="var(--brand)" stop-opacity="0.28"/>
        <stop offset="100%" stop-color="var(--brand)" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="wLine" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="var(--g1)"/><stop offset="100%" stop-color="var(--g2)"/>
      </linearGradient>
    </defs>
    ${grid}
    <path d="${linePath} L ${x(series.length - 1)} ${H-padY} L ${padX} ${H-padY} Z" fill="url(#wArea)"/>
    <path d="${linePath}" fill="none" stroke="url(#wLine)" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>
    ${dots}
    <text x="${padX}" y="16" font-size="12" font-weight="600" fill="var(--faint)">${fmt(max)} кг</text>
    <text x="${padX}" y="${H - 7}" font-size="12" font-weight="600" fill="var(--faint)">${fmt(min)} кг</text>`;
  wrap.appendChild(svg);
  return wrap;
}

function weightTable(series) {
  if (!series || !series.length) return h('div', {});
  const card = h('div', { class: 'card' });
  card.appendChild(h('div', { class: 'muted small', style: 'margin-bottom:6px' }, 'Замеры'));
  for (const s of [...series].reverse()) {
    card.appendChild(h('div', { class: 'row-between small', style: 'padding:4px 0;border-bottom:1px solid var(--line)' },
      h('span', {}, s.measured_on), h('b', {}, fmt(s.weight_kg) + ' кг')));
  }
  return card;
}

/* ==========================================================================
   Утилиты доступа
   ========================================================================== */
function requireRole(role) {
  if (!State.token) { location.hash = '#/'; return false; }
  if (State.role !== role) { location.hash = defaultRoute(); return false; }
  return true;
}

/* ==========================================================================
   BOOTSTRAP
   ========================================================================== */
/* ==========================================================================
   ADMIN PANEL — внутренний SaaS control center владельца платформы.
   ========================================================================== */
Object.assign(ICONS, {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>',
  creditCard: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
  tag: '<path d="M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.8 8.8a2 2 0 0 0 2.8 0l6.4-6.4a2 2 0 0 0 0-2.8z"/><path d="M7 7h.01"/>',
  cog: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  lifebuoy: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><path d="M4.93 4.93l4.24 4.24M14.83 14.83l4.24 4.24M14.83 9.17l4.24-4.24M14.83 9.17l3.53-3.53M4.93 19.07l4.24-4.24"/>',
  chart: '<path d="M3 3v18h18"/><rect x="7" y="10" width="3" height="7"/><rect x="12" y="6" width="3" height="11"/><rect x="17" y="13" width="3" height="4"/>',
  ban: '<circle cx="12" cy="12" r="10"/><path d="M4.9 4.9l14.2 14.2"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c6.5 0 10 7 10 7a13.2 13.2 0 0 1-1.67 2.68"/><path d="M6.6 6.6A13.3 13.3 0 0 0 2 12s3.5 7 10 7a9.1 9.1 0 0 0 5.4-1.6"/><path d="M14.1 14.1a3 3 0 0 1-4.2-4.2"/><path d="M2 2l20 20"/>',
});

const PLAN_LABEL = { trial: 'Trial', pro: 'Pro', business: 'Business', enterprise: 'Enterprise', owner: 'Owner', admin: 'Admin', support: 'Support', content: 'Content' };
const STATUS_LABEL = {
  active: 'Активен', trial: 'Trial', inactive: 'Неактивен', blocked: 'Заблокирован', overdue: 'Просрочен',
  paid: 'Оплачен', pending: 'Ожидает', failed: 'Ошибка', refunded: 'Возврат', cancelled: 'Отменён',
  published: 'Опубликован', hidden: 'Скрыт', rejected: 'Отклонён', draft: 'Черновик',
  new: 'Новое', in_progress: 'В работе', waiting: 'Ждёт ответа', resolved: 'Решено',
  nutritionist: 'Нутрициолог', client: 'Клиент', admin: 'Админ',
};
function badge(status) { return h('span', { class: 'badge ' + status }, STATUS_LABEL[status] || status); }
function fmtDate(s) { return s ? new Date(s).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'; }
function timeAgo(s) {
  if (!s) return '';
  const d = Math.floor((Date.now() - new Date(s).getTime()) / 60000);
  if (d < 1) return 'только что'; if (d < 60) return d + ' мин назад';
  const hraw = Math.floor(d / 60); if (hraw < 24) return hraw + ' ч назад';
  return Math.floor(hraw / 24) + ' дн назад';
}

/* --- Мини-графики --- */
function sparkline(series, down) {
  const w = 100, hgt = 34, min = Math.min(...series), max = Math.max(...series), rng = (max - min) || 1;
  const x = (i) => i / (series.length - 1) * w;
  const y = (v) => hgt - ((v - min) / rng) * (hgt - 4) - 2;
  const pts = series.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const col = down ? 'var(--danger)' : 'var(--brand)';
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${w} ${hgt}`); svg.setAttribute('preserveAspectRatio', 'none');
  svg.innerHTML = `<polyline points="${pts}" fill="none" stroke="${col}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
  return svg;
}
function barsEl(series) {
  const max = Math.max(...series) || 1;
  const box = h('div', { class: 'bars' });
  for (const v of series) { const b = h('div', { class: 'bar' }); b.style.height = (v / max * 100) + '%'; box.appendChild(b); }
  return box;
}
function donut(nutri, clients) {
  const total = nutri + clients || 1, c = 2 * Math.PI * 52;
  const nFrac = nutri / total, off = c * nFrac;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 128 128'); svg.setAttribute('class', 'donut');
  svg.innerHTML = `
    <circle cx="64" cy="64" r="52" fill="none" stroke="#3B82F6" stroke-width="16"/>
    <circle cx="64" cy="64" r="52" fill="none" stroke="#8B5CF6" stroke-width="16"
      stroke-dasharray="${off} ${c}" transform="rotate(-90 64 64)"/>
    <text x="64" y="60" text-anchor="middle" class="center" font-size="22" fill="var(--text)">${total}</text>
    <text x="64" y="80" text-anchor="middle" font-size="11" fill="var(--muted)">всего</text>`;
  return svg;
}
function lineChart(series, height) {
  const w = 300, hgt = height || 150, pad = 8, min = Math.min(...series), max = Math.max(...series), rng = (max - min) || 1;
  const x = (i) => pad + i / (series.length - 1) * (w - pad * 2);
  const y = (v) => pad + (1 - (v - min) / rng) * (hgt - pad * 2);
  const pts = series.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = `${pad},${hgt - pad} ${pts} ${w - pad},${hgt - pad}`;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${w} ${hgt}`); svg.setAttribute('preserveAspectRatio', 'none');
  svg.style.width = '100%'; svg.style.height = hgt + 'px';
  svg.innerHTML = `
    <defs><linearGradient id="lc" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="var(--brand)" stop-opacity="0.25"/><stop offset="100%" stop-color="var(--brand)" stop-opacity="0"/></linearGradient></defs>
    <polygon points="${area}" fill="url(#lc)"/>
    <polyline points="${pts}" fill="none" stroke="var(--brand)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;
  return svg;
}

/* --- Таблица --- */
function dtable(columns, rows, opts = {}) {
  const table = h('table', { class: 'dtable' });
  const thead = h('thead', {}, h('tr', {}, ...columns.map(c => h('th', { style: c.thStyle || null }, c.label))));
  const tbody = h('tbody', {});
  if (!rows.length) {
    tbody.appendChild(h('tr', {}, h('td', { colspan: String(columns.length), style: 'text-align:center;padding:28px;color:var(--muted)' }, 'Ничего не найдено')));
  }
  for (const row of rows) {
    const tr = h('tr', opts.onRow ? { onclick: (e) => { if (!e.target.closest('.row-actions')) opts.onRow(row); } } : {});
    for (const c of columns) tr.appendChild(h('td', { style: c.tdStyle || null }, c.render ? c.render(row) : (row[c.key] ?? '—')));
    tbody.appendChild(tr);
  }
  table.appendChild(thead); table.appendChild(tbody);
  return h('div', { class: 'dtable-wrap' }, h('div', { class: 'dtable-scroll' }, table));
}
function avatarCell(name, photo) {
  const a = h('div', { class: 'avatar' });
  if (photo) { a.style.backgroundImage = `url(${photo})`; a.style.backgroundSize = 'cover'; } else a.textContent = initials(name);
  return h('div', { class: 'u' }, a, h('span', {}, name));
}

/* --- Admin shell --- */
const ADMIN_NAV = [
  ['dashboard', 'grid', 'Dashboard', '#/admin/dashboard'],
  ['users', 'users', 'Пользователи', '#/admin/users'],
  ['nutritionists', 'user', 'Нутрициологи', '#/admin/nutritionists'],
  ['clients', 'chat', 'Клиенты', '#/admin/clients'],
  ['subscriptions', 'creditCard', 'Подписки', '#/admin/subscriptions'],
  ['payments', 'creditCard', 'Платежи', '#/admin/payments'],
  ['plans', 'tag', 'Тарифы', '#/admin/plans'],
  ['food', 'book', 'База блюд', '#/admin/food'],
  ['reviews', 'lifebuoy', 'Отзывы', '#/admin/reviews'],
  ['support', 'chat', 'Поддержка', '#/admin/support'],
  ['feedback', 'lifebuoy', 'Обратная связь', '#/admin/feedback'],
  ['analytics', 'chart', 'Аналитика', '#/admin/analytics'],
  ['settings', 'cog', 'Настройки', '#/admin/settings'],
];
function adminShell(active, contentNode, opts = {}) {
  const layout = h('div', { class: 'layout admin' });
  // Sidebar
  const aside = h('aside', { class: 'sidebar admin' });
  aside.appendChild(h('div', { class: 'brand', onclick: () => location.hash = '#/admin/dashboard', style: 'cursor:pointer' },
    h('span', { class: 'mark' }, ic('leaf')),
    h('span', {}, h('span', { class: 'name', style: 'display:block' }, 'NutriMenu'), h('span', { class: 'sub' }, 'Admin Panel'))));
  const nav = h('nav', { class: 'nav' });
  for (const [key, icon, label, hash] of ADMIN_NAV) nav.appendChild(navButton(active, key, icon, label, hash));
  aside.appendChild(nav);
  const u = State.user || {};
  aside.appendChild(h('div', { class: 'foot' }, h('div', { class: 'who' },
    h('div', { class: 'avatar' }, initials(u.name || 'A')),
    h('div', { style: 'min-width:0' }, h('div', { class: 'nm' }, u.name || 'Владелец'), h('div', { class: 'sub' }, 'Owner')))));
  layout.appendChild(aside);

  // Main
  const screen = h('div', { class: 'screen', style: 'max-width:none;margin:0;padding:0;width:100%' });
  const bar = h('div', { class: 'admin-topbar' });
  bar.appendChild(h('button', { class: 'icon-btn admin-hamburger', 'aria-label': 'Меню', onclick: () => layout.classList.toggle('drawer-open') }, ic('grid')));
  bar.appendChild(h('div', { class: 'hi' }, h('h1', {}, opts.title || 'Admin'), opts.sub ? h('div', { class: 'sub' }, opts.sub) : null));
  bar.appendChild(h('div', { class: 'spacer' }));
  if (opts.action) bar.appendChild(opts.action);
  bar.appendChild(h('button', { class: 'icon-btn', 'aria-label': 'Уведомления' }, ic('bell')));
  bar.appendChild(h('div', { class: 'admin-user' }, h('div', { class: 'avatar' }, initials(u.name || 'A')),
    h('div', {}, h('div', { class: 'nm' }, (u.name || 'Владелец').split(' ')[0]), h('div', { class: 'role' }, 'Owner'))));
  screen.appendChild(bar);
  screen.appendChild(contentNode);
  layout.appendChild(screen);
  layout.addEventListener('click', (e) => { if (layout.classList.contains('drawer-open') && (e.target === layout)) layout.classList.remove('drawer-open'); });
  return layout;
}
function requireAdmin() {
  if (!State.token) { location.hash = '#/admin'; return false; }
  if (State.role !== 'admin') { location.hash = defaultRoute(); return false; }
  return true;
}

/* --- Admin login --- */
route('/admin', () => {
  if (State.token && State.role === 'admin') { location.hash = '#/admin/dashboard'; return; }
  const err = h('div', { class: 'form-err', style: 'display:none' });
  const email = h('input', { type: 'email', placeholder: 'owner@nutrimenu.app', value: 'owner@nutrimenu.app' });
  const pass = h('input', { type: 'password', placeholder: 'Пароль' });
  const submit = async () => {
    err.style.display = 'none';
    try { const r = await POST('/admin/login', { email: email.value.trim(), password: pass.value });
      State.setAuth(r.token, 'admin', r.user); location.hash = '#/admin/dashboard';
    } catch (e) { err.textContent = e.message; err.style.display = 'block'; }
  };
  render(h('div', { class: 'auth-wrap' },
    h('div', { class: 'auth-logo' }, h('div', { class: 'mark' }, ic('grid', 'lg')), h('h1', {}, 'NutriMenu'), h('div', { class: 'tag' }, 'Admin Panel · вход для владельца')),
    h('div', { class: 'card auth-card' },
      h('label', {}, 'Email'), email, h('label', {}, 'Пароль'), pass, err,
      h('button', { class: 'btn', style: 'margin-top:14px', onclick: submit }, 'Войти в панель'),
      h('div', { class: 'auth-switch small' }, h('a', { href: '#/' }, '← На сайт')))
  ));
  pass.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
});

/* --- Dashboard --- */
route('/admin/dashboard', async () => {
  if (!requireAdmin()) return;
  loading();
  const s = await GET('/admin/stats');
  const u = State.user || {};

  const kpiGrid = h('div', { class: 'kpi-grid' });
  for (const k of s.kpis) {
    const up = k.delta >= 0; const good = k.invert ? !up : up;
    kpiGrid.appendChild(h('div', { class: 'kpi' },
      h('div', { class: 'lbl' }, k.label),
      h('div', { class: 'row' },
        h('span', { class: 'val' }, (k.unit === '€' ? '€' : '') + fmtNum(k.value) + (k.unit === '%' ? '%' : '')),
        h('span', { class: 'delta ' + (good ? 'up' : 'down') }, (up ? '+' : '') + k.delta + '%')),
      h('div', { class: 'spark' }, sparkline(k.spark, k.invert ? up : !up && false))));
  }

  // Row 2: revenue, distribution, conversion, subscriptions
  const dist = s.distribution;
  const row2 = h('div', { class: 'admin-cols c4' },
    h('div', { class: 'panel' }, h('div', { class: 'ph' }, h('h3', {}, 'Выручка'), h('span', { class: 'muted small' }, 'MRR')),
      h('div', { class: 'val', style: 'font-family:var(--font-display);font-size:26px;font-weight:800' }, '€' + fmtNum(s.revenue.total)),
      h('div', { style: 'margin-top:8px' }, lineChart(s.revenue.week, 150))),
    h('div', { class: 'panel' }, h('div', { class: 'ph' }, h('h3', {}, 'Пользователи')),
      h('div', { class: 'donut-wrap' }, donut(dist.nutritionists, dist.clients),
        h('div', { class: 'legend' },
          h('div', { class: 'li' }, h('span', { class: 'dot', style: 'background:#8B5CF6' }), h('span', {}, 'Нутрициологи ', h('b', {}, String(dist.nutritionists)))),
          h('div', { class: 'li' }, h('span', { class: 'dot', style: 'background:#3B82F6' }), h('span', {}, 'Клиенты ', h('b', {}, String(dist.clients))))))),
    h('div', { class: 'panel' }, h('div', { class: 'ph' }, h('h3', {}, 'Trial → Paid')),
      h('div', { class: 'conv-big' }, s.conversion.rate + '%'),
      h('div', { class: 'muted small' }, 'конверсия'),
      h('div', { class: 'conv-bar' }, (() => { const sp = h('span', {}); sp.style.width = s.conversion.rate + '%'; return sp; })()),
      h('div', { class: 'row-between small muted' }, h('span', {}, 'Оплатили: ' + s.conversion.paid), h('span', {}, 'Trial: ' + s.conversion.trial))),
    h('div', { class: 'panel' }, h('div', { class: 'ph' }, h('h3', {}, 'Подписки'), h('span', { class: 'link', onclick: () => location.hash = '#/admin/subscriptions' }, 'Перейти')),
      ...s.plans.map(p => h('div', { class: 'row-between', style: 'padding:7px 0;border-bottom:1px solid var(--line);font-size:13px' },
        h('span', {}, PLAN_LABEL[p.code]), h('span', { class: 'muted' }, '€' + p.price + '/мес'),
        h('span', { class: (p.delta >= 0 ? 'delta up' : 'delta down'), style: 'font-family:var(--font-display);font-weight:700;font-size:12px' }, (p.delta >= 0 ? '+' : '') + p.delta))),
      h('div', { class: 'row-between', style: 'padding-top:10px;font-weight:700' }, h('span', {}, 'Активных'), h('span', { class: 'num' }, fmtNum(s.active_subs_total)))));

  // Row 3: recent registrations, recent nutritionists, support
  const regList = h('div', { class: 'mini-list' });
  for (const r of s.recent_registrations) regList.appendChild(h('div', { class: 'mi' }, h('div', { class: 'avatar' }, initials(r.name)),
    h('div', { class: 'grow' }, h('div', { class: 't' }, r.name), h('div', { class: 's' }, STATUS_LABEL[r.role] || r.role)),
    h('div', { class: 'r' }, timeAgo(r.created_at))));

  const nutriTable = dtable([
    { label: 'Нутрициолог', render: r => avatarCell(r.name) },
    { label: 'Тариф', render: r => badge(r.plan === 'trial' ? 'trial' : 'active') },
    { label: 'Клиенты', tdStyle: 'text-align:center', render: r => h('span', { class: 'num' }, String(r.clients_count)) },
    { label: 'Активность', render: r => h('span', { class: 'muted' }, timeAgo(r.last_active_at)) },
    { label: 'Статус', render: r => badge(r.status) },
  ], s.recent_nutritionists, { onRow: r => location.hash = '#/admin/nutritionist/' + r.id });

  const supportList = h('div', { class: 'mini-list' });
  for (const t of s.support) supportList.appendChild(h('div', { class: 'mi' }, h('div', { class: 'avatar' }, initials(t.user_name)),
    h('div', { class: 'grow' }, h('div', { class: 't' }, t.subject), h('div', { class: 's' }, t.user_name)),
    badge(t.status)));

  const row3 = h('div', { class: 'admin-cols c3' },
    h('div', { class: 'panel' }, h('div', { class: 'ph' }, h('h3', {}, 'Новые регистрации'), h('span', { class: 'link', onclick: () => location.hash = '#/admin/users' }, 'Все')), regList),
    h('div', { class: 'panel' }, h('div', { class: 'ph' }, h('h3', {}, 'Активные нутрициологи'), h('span', { class: 'link', onclick: () => location.hash = '#/admin/nutritionists' }, 'Все')), nutriTable),
    h('div', { class: 'panel' }, h('div', { class: 'ph' }, h('h3', {}, 'Обращения в поддержку'), h('span', { class: 'link', onclick: () => location.hash = '#/admin/support' }, 'Все')), supportList));

  // Row 4: popular dishes, revenue by period, activity, quick actions
  const popular = h('div', { class: 'mini-list' });
  for (const d of s.popular_dishes) { const th = h('div', { class: 'thumb' }); if (d.photo_url) th.style.backgroundImage = `url(${d.photo_url})`;
    popular.appendChild(h('div', { class: 'mi' }, th, h('div', { class: 'grow' }, h('div', { class: 't' }, d.name), h('div', { class: 's' }, 'Добавлено ' + d.uses + ' раз')))); }

  const activity = h('div', { class: 'mini-list' });
  const actIcon = { nutritionist: 'user', payment: 'creditCard', support: 'chat' };
  for (const e of s.activity) activity.appendChild(h('div', { class: 'mi' },
    h('div', { class: 'qa-ic', style: 'width:32px;height:32px;border-radius:8px;background:var(--surface-2);display:grid;place-items:center;color:var(--muted);flex:0 0 auto' }, ic(actIcon[e.type] || 'grid', 'sm')),
    h('div', { class: 'grow' }, h('div', { class: 't', style: 'font-weight:500;white-space:normal' }, e.text)), h('div', { class: 'r' }, timeAgo(e.at))));

  const qa = h('div', { class: 'qa-grid' },
    h('div', { class: 'qa', onclick: () => location.hash = '#/admin/nutritionists' }, h('span', { class: 'ic' }, ic('user', 'sm')), 'Добавить нутрициолога'),
    h('div', { class: 'qa', onclick: () => location.hash = '#/admin/users' }, h('span', { class: 'ic' }, ic('users', 'sm')), 'Пользователи'),
    h('div', { class: 'qa', onclick: () => location.hash = '#/admin/food' }, h('span', { class: 'ic' }, ic('book', 'sm')), 'Модерация блюд'),
    h('div', { class: 'qa', onclick: () => location.hash = '#/admin/support' }, h('span', { class: 'ic' }, ic('chat', 'sm')), 'Поддержка'),
    h('div', { class: 'qa full', onclick: () => exportPayments() }, h('span', { class: 'ic' }, ic('download', 'sm')), 'Экспорт платежей (CSV)'));

  const row4 = h('div', { class: 'admin-cols c4b' },
    h('div', { class: 'panel' }, h('div', { class: 'ph' }, h('h3', {}, 'Популярные блюда')), popular),
    h('div', { class: 'panel' }, h('div', { class: 'ph' }, h('h3', {}, 'Выручка по периодам'), h('span', { class: 'muted small' }, '30 дней')),
      h('div', { class: 'val', style: 'font-family:var(--font-display);font-size:22px;font-weight:800;margin-bottom:8px' }, '€' + fmtNum(s.revenue.total)),
      barsEl(s.revenue.days)),
    h('div', { class: 'panel' }, h('div', { class: 'ph' }, h('h3', {}, 'Активность системы')), activity),
    h('div', { class: 'panel' }, h('div', { class: 'ph' }, h('h3', {}, 'Быстрые действия')), qa));

  const page = h('div', { class: 'admin-page' }, kpiGrid, row2, row3, row4);
  render(adminShell('dashboard', page, { title: 'Добрый день, ' + (u.name || 'Владелец').split(' ')[0] + '! 👋', sub: 'Вот что происходит с NutriMenu сегодня' }));
});

function fmtNum(n) { return Number(n).toLocaleString('ru-RU'); }

async function exportPayments() {
  try {
    const r = await GET('/admin/payments/export');
    const blob = new Blob(["﻿" + r.csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = r.filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('CSV выгружен');
  } catch (e) { toast(e.message, true); }
}

/* --- Универсальный табличный экран с тулбаром и пагинацией --- */
function adminTableScreen(active, opts) {
  // opts: { title, sub, endpoint, columns, tabs?, filters?, onRow, search, extraAction }
  let offset = 0; const limit = 25;
  let q = ''; let tab = opts.tabs ? opts.tabs[0][0] : null; const filterVals = {};
  const container = h('div', {});

  const load = async () => {
    container.innerHTML = '<div class="skeleton sk-card" style="height:300px"></div>';
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (q) params.set('q', q);
    if (tab) params.set('tab', tab);
    for (const [k, v] of Object.entries(filterVals)) if (v) params.set(k, v);
    let data;
    try { data = await GET(opts.endpoint + '?' + params.toString()); } catch (e) { container.innerHTML = ''; container.appendChild(h('div', { class: 'empty' }, e.message)); return; }
    container.innerHTML = '';
    if (opts.renderHead) container.appendChild(opts.renderHead(data));
    container.appendChild(dtable(opts.columns, data.items, { onRow: opts.onRow }));
    const from = data.total ? offset + 1 : 0, to = Math.min(offset + limit, data.total);
    container.appendChild(h('div', { class: 'pager' },
      h('span', {}, `${from}–${to} из ${data.total}`),
      h('div', { class: 'btns' },
        h('button', { class: 'btn tonal small', onclick: () => { if (offset > 0) { offset -= limit; load(); } } }, 'Назад'),
        h('button', { class: 'btn tonal small', onclick: () => { if (offset + limit < data.total) { offset += limit; load(); } } }, 'Далее'))));
  };

  const toolbar = h('div', { class: 'toolbar' });
  if (opts.tabs) {
    const tabsEl = h('div', { class: 'tabs' });
    for (const [val, label] of opts.tabs) {
      const btn = h('button', { class: val === tab ? 'active' : '' }, label);
      btn.addEventListener('click', () => {
        tab = val; offset = 0;
        tabsEl.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active'); load();
      });
      tabsEl.appendChild(btn);
    }
    toolbar.appendChild(tabsEl);
  }
  if (opts.search !== false) {
    const si = h('input', { placeholder: 'Поиск…' });
    let t; si.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { q = si.value.trim(); offset = 0; load(); }, 250); });
    toolbar.appendChild(h('div', { class: 'searchbox' }, ic('search'), si));
  }
  for (const f of (opts.filters || [])) {
    const sel = h('select', {}, h('option', { value: '' }, f.label), ...f.options.map(o => h('option', { value: o[0] }, o[1])));
    sel.addEventListener('change', () => { filterVals[f.key] = sel.value; offset = 0; load(); });
    toolbar.appendChild(sel);
  }

  const page = h('div', { class: 'admin-page' }, toolbar, container);
  render(adminShell(active, page, { title: opts.title, sub: opts.sub, action: opts.extraAction }));
  load();
}

/* --- Нутрициологи --- */
route('/admin/nutritionists', () => {
  if (!requireAdmin()) return;
  adminTableScreen('nutritionists', {
    title: 'Нутрициологи', endpoint: '/admin/nutritionists',
    filters: [
      { key: 'plan', label: 'Тариф', options: [['trial', 'Trial'], ['pro', 'Pro'], ['business', 'Business'], ['enterprise', 'Enterprise']] },
      { key: 'status', label: 'Статус', options: [['active', 'Активен'], ['trial', 'Trial'], ['overdue', 'Просрочен'], ['blocked', 'Заблокирован'], ['inactive', 'Неактивен']] },
    ],
    columns: [
      { label: 'Нутрициолог', render: r => avatarCell(r.name, r.photo_url) },
      { label: 'Email', render: r => h('span', { class: 'muted' }, r.email) },
      { label: 'Тариф', render: r => badge(r.plan === 'trial' ? 'trial' : 'active') },
      { label: 'Клиенты', tdStyle: 'text-align:center', render: r => h('span', { class: 'num' }, String(r.clients_count)) },
      { label: 'Рейтинг', render: r => r.rating ? h('span', { class: 'num' }, '★ ' + r.rating) : h('span', { class: 'muted' }, '—') },
      { label: 'Регистрация', render: r => h('span', { class: 'muted' }, fmtDate(r.created_at)) },
      { label: 'Статус', render: r => badge(r.status) },
      { label: 'Оплата', render: r => r.last_payment ? badge(r.last_payment.status) : h('span', { class: 'muted' }, '—') },
    ],
    onRow: r => location.hash = '#/admin/nutritionist/' + r.id,
  });
});

route('/admin/nutritionist/:id', async (args) => {
  if (!requireAdmin()) return;
  loading();
  const p = await GET('/admin/nutritionists/' + args.id);
  const refresh = () => location.reload ? renderAdminNutri(args.id) : null;

  const stat = (k, v) => h('div', { class: 'stat' }, h('div', { class: 'k' }, k), h('div', { class: 'v' }, v));
  const stats = h('div', { class: 'stat-grid' },
    stat('Клиентов', String(p.clients_count)), stat('Меню', String(p.menus_count)),
    stat('Своих блюд', String(p.dishes_count)), stat('Соблюдение', p.avg_adherence != null ? p.avg_adherence + '%' : '—'),
    stat('Выручка', '€' + fmtNum(p.revenue)), stat('Рейтинг', p.rating ? '★ ' + p.rating + ' (' + p.reviews_count + ')' : '—'),
    stat('Тариф', PLAN_LABEL[p.plan] || p.plan), stat('Статус', STATUS_LABEL[p.status] || p.status));

  const payTable = dtable([
    { label: 'Дата', render: r => fmtDate(r.created_at) },
    { label: 'Тариф', render: r => PLAN_LABEL[r.plan_code] },
    { label: 'Сумма', render: r => h('span', { class: 'num' }, '€' + r.amount) },
    { label: 'Способ', render: r => h('span', { class: 'muted' }, r.method) },
    { label: 'Статус', render: r => badge(r.status) },
  ], p.payments);

  const clientsTable = dtable([
    { label: 'Клиент', render: r => r.name },
    { label: 'Цель', render: r => h('span', { class: 'muted' }, r.goal || '—') },
    { label: 'Добавлен', render: r => fmtDate(r.created_at) },
  ], p.clients);

  const changePlan = h('select', {}, ...['trial', 'pro', 'business', 'enterprise'].map(c => h('option', { value: c, selected: c === p.plan ? 'selected' : null }, PLAN_LABEL[c])));
  changePlan.value = p.plan;
  const isBlocked = !!p.blocked_at;

  const actions = h('div', { class: 'panel', style: 'margin-bottom:14px' },
    h('div', { class: 'ph' }, h('h3', {}, 'Управление аккаунтом')),
    h('div', { class: 'toolbar', style: 'margin:0' },
      h('div', {}, h('label', { style: 'margin:0 0 4px' }, 'Тариф'), changePlan),
      h('button', { class: 'btn small', style: 'align-self:flex-end', onclick: async () => {
        try { await PATCH('/admin/nutritionists/' + p.id, { plan: changePlan.value }); toast('Тариф изменён'); location.hash = '#/admin/nutritionist/' + p.id; renderAdminNutri(p.id); } catch (e) { toast(e.message, true); }
      } }, 'Сохранить тариф'),
      h('button', { class: 'btn ' + (isBlocked ? 'secondary' : 'danger') + ' small', style: 'align-self:flex-end', onclick: async () => {
        try { await PATCH('/admin/nutritionists/' + p.id, { blocked: !isBlocked }); toast(isBlocked ? 'Разблокирован' : 'Заблокирован'); renderAdminNutri(p.id); } catch (e) { toast(e.message, true); }
      } }, isBlocked ? 'Разблокировать' : 'Заблокировать'),
      h('button', { class: 'btn tonal small', style: 'align-self:flex-end', onclick: () => toast('Функция в разработке') }, 'Написать')));

  const head = h('div', { class: 'panel', style: 'margin-bottom:14px;display:flex;align-items:center;gap:16px' },
    (() => { const a = h('div', { class: 'avatar', style: 'width:64px;height:64px;font-size:24px' }); if (p.photo_url) { a.style.backgroundImage = `url(${p.photo_url})`; a.style.backgroundSize = 'cover'; } else a.textContent = initials(p.name); return a; })(),
    h('div', { class: 'grow' }, h('h2', { style: 'margin:0' }, p.name),
      h('div', { class: 'muted small' }, p.email + (p.city ? ' · ' + p.city : '') + ' · с ' + fmtDate(p.created_at)),
      p.specialization ? h('div', { class: 'small', style: 'margin-top:4px' }, p.specialization) : null),
    badge(p.status));

  const page = h('div', { class: 'admin-page' }, head, actions, stats,
    h('div', { class: 'admin-cols', style: 'grid-template-columns:1.3fr 1fr' },
      h('div', { class: 'panel' }, h('div', { class: 'ph' }, h('h3', {}, 'История платежей')), payTable),
      h('div', { class: 'panel' }, h('div', { class: 'ph' }, h('h3', {}, 'Клиенты')), clientsTable)));

  render(adminShell('nutritionists', page, { title: p.name, sub: 'Профиль нутрициолога',
    action: h('button', { class: 'btn tonal small', style: 'width:auto', onclick: () => location.hash = '#/admin/nutritionists' }, ic('arrowLeft', 'sm'), 'К списку') }));
});
function renderAdminNutri(id) { location.hash = '#/admin/nutritionist/' + id; router(); }

/* --- Пользователи --- */
route('/admin/users', () => {
  if (!requireAdmin()) return;
  adminTableScreen('users', {
    title: 'Пользователи', endpoint: '/admin/users',
    tabs: [['all', 'Все'], ['nutritionists', 'Нутрициологи'], ['clients', 'Клиенты'], ['admins', 'Администраторы']],
    columns: [
      { label: 'Пользователь', render: r => avatarCell(r.name) },
      { label: 'Роль', render: r => badge(r.role) },
      { label: 'Email', render: r => h('span', { class: 'muted' }, r.email || '—') },
      { label: 'Тариф', render: r => r.plan ? (PLAN_LABEL[r.plan] || r.plan) : '—' },
      { label: 'Регистрация', render: r => h('span', { class: 'muted' }, fmtDate(r.created_at)) },
      { label: 'Активность', render: r => h('span', { class: 'muted' }, r.last_active_at ? timeAgo(r.last_active_at) : '—') },
      { label: 'Статус', render: r => badge(r.status) },
    ],
    onRow: r => { if (r.role === 'nutritionist') location.hash = '#/admin/nutritionist/' + r.id; },
  });
});

/* --- Клиенты --- */
route('/admin/clients', () => {
  if (!requireAdmin()) return;
  adminTableScreen('clients', {
    title: 'Клиенты', endpoint: '/admin/clients',
    columns: [
      { label: 'Клиент', render: r => avatarCell(r.name) },
      { label: 'Нутрициолог', render: r => h('span', { class: 'muted' }, r.nutritionist || '—') },
      { label: 'Цель', render: r => r.goal || '—' },
      { label: 'Последнее меню', render: r => h('span', { class: 'muted' }, r.last_menu ? fmtDate(r.last_menu) : '—') },
      { label: 'Регистрация', render: r => h('span', { class: 'muted' }, fmtDate(r.created_at)) },
      { label: 'Статус', render: r => badge(r.status === 'active' ? 'active' : 'inactive') },
    ],
  });
});

/* --- Подписки --- */
route('/admin/subscriptions', () => {
  if (!requireAdmin()) return;
  adminTableScreen('subscriptions', {
    title: 'Подписки и платежи', endpoint: '/admin/subscriptions', search: false,
    renderHead: (data) => { const k = data.kpis; return h('div', { class: 'stat-grid', style: 'grid-template-columns:repeat(7,1fr)' },
      h('div', { class: 'stat' }, h('div', { class: 'k' }, 'Активные'), h('div', { class: 'v' }, fmtNum(k.active))),
      h('div', { class: 'stat' }, h('div', { class: 'k' }, 'Trial'), h('div', { class: 'v' }, fmtNum(k.trial))),
      h('div', { class: 'stat' }, h('div', { class: 'k' }, 'Отменённые'), h('div', { class: 'v' }, fmtNum(k.cancelled))),
      h('div', { class: 'stat' }, h('div', { class: 'k' }, 'Просрочка'), h('div', { class: 'v' }, fmtNum(k.past_due))),
      h('div', { class: 'stat' }, h('div', { class: 'k' }, 'MRR'), h('div', { class: 'v' }, '€' + fmtNum(k.mrr))),
      h('div', { class: 'stat' }, h('div', { class: 'k' }, 'ARR'), h('div', { class: 'v' }, '€' + fmtNum(k.arr))),
      h('div', { class: 'stat' }, h('div', { class: 'k' }, 'Churn'), h('div', { class: 'v' }, k.churn + '%'))); },
    columns: [
      { label: 'Пользователь', render: r => avatarCell(r.name) },
      { label: 'Тариф', render: r => PLAN_LABEL[r.plan] || r.plan },
      { label: 'Стоимость', render: r => h('span', { class: 'num' }, r.price ? '€' + r.price + '/мес' : '—') },
      { label: 'Начало', render: r => h('span', { class: 'muted' }, fmtDate(r.created_at)) },
      { label: 'След. платёж', render: r => h('span', { class: 'muted' }, fmtDate(r.plan_expires_at)) },
      { label: 'Посл. платёж', render: r => h('span', { class: 'muted' }, fmtDate(r.last_payment)) },
      { label: 'Статус', render: r => badge(r.status) },
    ],
    onRow: r => location.hash = '#/admin/nutritionist/' + r.id,
  });
});

/* --- Платежи --- */
route('/admin/payments', () => {
  if (!requireAdmin()) return;
  adminTableScreen('payments', {
    title: 'Платежи', endpoint: '/admin/payments',
    extraAction: h('button', { class: 'btn small', style: 'width:auto', onclick: exportPayments }, ic('download', 'sm'), 'Экспорт CSV'),
    filters: [{ key: 'status', label: 'Статус', options: [['paid', 'Оплачен'], ['pending', 'Ожидает'], ['failed', 'Ошибка'], ['refunded', 'Возврат']] }],
    renderHead: (data) => h('div', { class: 'stat-grid', style: 'grid-template-columns:repeat(2,220px)' },
      h('div', { class: 'stat' }, h('div', { class: 'k' }, 'Всего платежей'), h('div', { class: 'v' }, fmtNum(data.total))),
      h('div', { class: 'stat' }, h('div', { class: 'k' }, 'Сумма (оплачено)'), h('div', { class: 'v' }, '€' + fmtNum(data.sum_paid)))),
    columns: [
      { label: 'Дата', render: r => fmtDate(r.created_at) },
      { label: 'Пользователь', render: r => avatarCell(r.user_name) },
      { label: 'Сумма', render: r => h('span', { class: 'num' }, '€' + r.amount) },
      { label: 'Тариф', render: r => PLAN_LABEL[r.plan_code] || r.plan_code },
      { label: 'Способ', render: r => h('span', { class: 'muted' }, r.method) },
      { label: 'ID', render: r => h('span', { class: 'muted', style: 'font-family:monospace;font-size:12px' }, r.external_id) },
      { label: 'Статус', render: r => badge(r.status) },
    ],
  });
});

/* --- Тарифы --- */
route('/admin/plans', async () => {
  if (!requireAdmin()) return;
  loading();
  const { items } = await GET('/admin/plans');
  const grid = h('div', { class: 'plan-grid' });
  for (const p of items) grid.appendChild(h('div', { class: 'plan-card' },
    h('h3', {}, p.name),
    h('div', { class: 'price' }, '€' + p.price, h('small', {}, '/' + (p.period === 'month' ? 'мес' : p.period))),
    h('ul', {}, ...p.features.map(f => h('li', {}, ic('check', 'sm'), f))),
    h('div', { class: 'small muted' }, 'Лимит клиентов: ' + (p.client_limit ?? '∞')),
    h('div', { class: 'pfoot' }, h('span', {}, p.users + ' польз.'), h('span', { class: 'num' }, 'MRR €' + fmtNum(p.mrr)))));
  const page = h('div', { class: 'admin-page' },
    h('div', { class: 'toolbar' }, h('div', { style: 'flex:1' }), h('button', { class: 'btn small', style: 'width:auto', onclick: () => toast('Функция в разработке') }, ic('plus', 'sm'), 'Добавить тариф')),
    grid);
  render(adminShell('plans', page, { title: 'Тарифы', sub: 'Управление подписками и лимитами' }));
});

/* --- Отзывы (модерация) --- */
route('/admin/reviews', () => {
  if (!requireAdmin()) return;
  const reload = () => location.hash === '#/admin/reviews' && router();
  adminTableScreen('reviews', {
    title: 'Отзывы и каталог', sub: 'Модерация публичных отзывов', endpoint: '/admin/reviews', search: false,
    columns: [
      { label: 'Нутрициолог', render: r => r.nutritionist },
      { label: 'Автор', render: r => h('span', { class: 'muted' }, r.author) },
      { label: 'Оценка', render: r => h('span', { class: 'num' }, '★ ' + r.rating) },
      { label: 'Отзыв', tdStyle: 'max-width:340px', render: r => h('span', {}, r.body || '—') },
      { label: 'Дата', render: r => h('span', { class: 'muted' }, fmtDate(r.created_at)) },
      { label: 'Статус', render: r => badge(r.status) },
      { label: '', render: r => h('div', { class: 'row-actions' },
        h('button', { class: 'icon-btn', title: r.status === 'hidden' ? 'Показать' : 'Скрыть', onclick: async () => {
          await POST('/admin/reviews/' + r.id + '/moderate', { action: r.status === 'hidden' ? 'approve' : 'hide' }); toast('Обновлено'); router();
        } }, ic(r.status === 'hidden' ? 'eye' : 'eyeOff', 'sm')),
        h('button', { class: 'icon-btn', title: 'Удалить', onclick: async () => {
          if (!confirm('Удалить отзыв?')) return; await POST('/admin/reviews/' + r.id + '/moderate', { action: 'delete' }); toast('Удалён'); router();
        } }, ic('trash', 'sm'))) },
    ],
  });
});

/* --- Поддержка --- */
route('/admin/support', () => {
  if (!requireAdmin()) return;
  adminTableScreen('support', {
    title: 'Поддержка', endpoint: '/admin/tickets', search: false,
    filters: [{ key: 'status', label: 'Статус', options: [['new', 'Новые'], ['in_progress', 'В работе'], ['waiting', 'Ждут'], ['resolved', 'Решены']] }],
    renderHead: (data) => h('div', { class: 'stat-grid' },
      h('div', { class: 'stat' }, h('div', { class: 'k' }, 'Новые'), h('div', { class: 'v' }, String(data.counts.new))),
      h('div', { class: 'stat' }, h('div', { class: 'k' }, 'В работе'), h('div', { class: 'v' }, String(data.counts.in_progress))),
      h('div', { class: 'stat' }, h('div', { class: 'k' }, 'Ждут ответа'), h('div', { class: 'v' }, String(data.counts.waiting))),
      h('div', { class: 'stat' }, h('div', { class: 'k' }, 'Решены'), h('div', { class: 'v' }, String(data.counts.resolved)))),
    columns: [
      { label: 'Пользователь', render: r => avatarCell(r.user_name) },
      { label: 'Тема', render: r => r.subject },
      { label: 'Канал', render: r => h('span', { class: 'muted' }, r.channel) },
      { label: 'Приоритет', render: r => r.priority === 'high' ? badge('high') : h('span', { class: 'muted' }, r.priority) },
      { label: 'Дата', render: r => h('span', { class: 'muted' }, fmtDate(r.created_at)) },
      { label: 'Статус', render: r => badge(r.status) },
    ],
    onRow: r => openTicket(r.id),
  });
});
async function openTicket(id) {
  const t = await GET('/admin/tickets/' + id);
  sheet('Обращение #' + id, (panel, close) => {
    panel.appendChild(h('div', { class: 'row-between' }, h('h3', { style: 'margin:0' }, t.subject), badge(t.status)));
    panel.appendChild(h('div', { class: 'muted small', style: 'margin:4px 0 12px' }, t.user_name + ' · ' + t.channel + ' · ' + fmtDate(t.created_at)));
    const thread = h('div', { class: 'chat-thread', style: 'margin-bottom:12px' });
    if (!t.messages.length) thread.appendChild(h('div', { class: 'muted small' }, 'Переписки пока нет.'));
    for (const m of t.messages) thread.appendChild(h('div', { class: 'bubble ' + (m.author_type === 'admin' ? 'me' : 'them') }, m.body));
    panel.appendChild(thread);
    const reply = h('textarea', { placeholder: 'Ответ пользователю…' });
    panel.appendChild(reply);
    panel.appendChild(h('button', { class: 'btn', style: 'margin-top:10px', onclick: async () => {
      if (!reply.value.trim()) return;
      await PATCH('/admin/tickets/' + id, { reply: reply.value.trim() }); close(); toast('Ответ отправлен'); router();
    } }, ic('send', 'sm'), 'Ответить'));
    const statuses = [['in_progress', 'В работу'], ['waiting', 'Ждёт ответа'], ['resolved', 'Решено']];
    panel.appendChild(h('div', { class: 'btn-row', style: 'margin-top:8px' }, ...statuses.map(([v, l]) =>
      h('button', { class: 'btn tonal small', onclick: async () => { await PATCH('/admin/tickets/' + id, { status: v }); close(); toast('Статус: ' + l); router(); } }, l))));
  });
}

/* --- Модерация блюд --- */
route('/admin/food', () => {
  if (!requireAdmin()) return;
  adminTableScreen('food', {
    title: 'База блюд', sub: 'Модерация пользовательских блюд', endpoint: '/admin/food', search: false,
    filters: [{ key: 'status', label: 'Статус', options: [['published', 'Опубликованы'], ['pending', 'На модерации'], ['rejected', 'Отклонены']] }],
    columns: [
      { label: 'Блюдо', render: r => { const th = h('div', { class: 'thumb', style: 'width:32px;height:32px;border-radius:7px;background:var(--surface-3) center/cover' }); if (r.photo_url) th.style.backgroundImage = `url(${r.photo_url})`; return h('div', { class: 'u' }, th, h('span', {}, r.name)); } },
      { label: 'Автор', render: r => h('span', { class: 'muted' }, r.author || 'Общая база') },
      { label: 'Ккал/100г', render: r => h('span', { class: 'num' }, fmt0(r.kcal_100 || 0)) },
      { label: 'Исп.', tdStyle: 'text-align:center', render: r => h('span', { class: 'num' }, String(r.uses)) },
      { label: 'Дата', render: r => h('span', { class: 'muted' }, fmtDate(r.created_at)) },
      { label: 'Статус', render: r => badge(r.status) },
      { label: '', render: r => h('div', { class: 'row-actions' },
        h('button', { class: 'icon-btn', title: 'Одобрить', onclick: async () => { await POST('/admin/food/' + r.id + '/moderate', { action: 'approve' }); toast('Одобрено'); router(); } }, ic('check', 'sm')),
        h('button', { class: 'icon-btn', title: 'Отклонить', onclick: async () => { await POST('/admin/food/' + r.id + '/moderate', { action: 'reject' }); toast('Отклонено'); router(); } }, ic('x', 'sm'))) },
    ],
  });
});

/* --- Обратная связь тестировщиков --- */
route('/admin/feedback', async () => {
  if (!requireAdmin()) return;
  loading();
  const data = await GET('/admin/feedback');
  const head = h('div', { class: 'stat-grid', style: 'grid-template-columns:repeat(2,220px)' },
    h('div', { class: 'stat' }, h('div', { class: 'k' }, 'Отзывов'), h('div', { class: 'v' }, String(data.total))),
    h('div', { class: 'stat' }, h('div', { class: 'k' }, 'Средняя оценка'), h('div', { class: 'v' }, data.avg_rating != null ? '★ ' + data.avg_rating : '—')));
  const rows = data.items.map(f => h('div', { class: 'panel', style: 'margin-bottom:12px' },
    h('div', { class: 'row-between', style: 'margin-bottom:6px' },
      h('div', {}, h('b', {}, f.user_name || 'Аноним'), h('span', { class: 'muted small' }, ' · ' + (STATUS_LABEL[f.user_type] || f.user_type) + ' · ' + fmtDate(f.created_at) + ' · ' + (f.page || ''))),
      f.rating ? h('span', { class: 'num', style: 'color:#F5B301;font-weight:800' }, '★ ' + f.rating) : null),
    ...[['Понравилось', f.liked], ['Непонятно', f.unclear], ['Изменил бы', f.suggest], ['Не хватает', f.missing]]
      .filter(([, v]) => v).map(([k, v]) => h('div', { class: 'small', style: 'margin-top:3px' }, h('b', {}, k + ': '), v))));
  const page = h('div', { class: 'admin-page' }, head,
    data.items.length ? h('div', {}, ...rows) : h('div', { class: 'empty' }, ic('chat'), h('div', {}, 'Отзывов пока нет')));
  render(adminShell('feedback', page, { title: 'Обратная связь', sub: 'Отзывы тестировщиков MVP' }));
});

/* --- Аналитика / Настройки (заглушки-панели) --- */
route('/admin/analytics', async () => {
  if (!requireAdmin()) return;
  loading();
  const s = await GET('/admin/stats');
  const metric = (k, v, spark) => h('div', { class: 'panel' }, h('div', { class: 'ph' }, h('h3', {}, k)),
    h('div', { class: 'val', style: 'font-family:var(--font-display);font-size:24px;font-weight:800' }, v),
    h('div', { class: 'spark', style: 'height:44px' }, sparkline(spark || s.revenue.days)));
  const page = h('div', { class: 'admin-page' },
    h('div', { class: 'admin-cols c3' },
      metric('MRR', '€' + fmtNum(s.revenue.total), s.kpis[0].spark),
      metric('Активные клиенты', fmtNum(s.distribution.clients), s.kpis[3].spark),
      metric('Trial → Paid', s.conversion.rate + '%', s.kpis[1].spark)),
    h('div', { class: 'panel', style: 'margin-top:14px' }, h('div', { class: 'ph' }, h('h3', {}, 'Выручка за период')), lineChart(s.revenue.days, 220)),
    h('div', { class: 'muted small', style: 'margin-top:12px' }, 'Расширенная аналитика (DAU/WAU/MAU, retention, LTV, ARPU) — в разработке.'));
  render(adminShell('analytics', page, { title: 'Аналитика', sub: 'Ключевые метрики платформы' }));
});
route('/admin/settings', () => {
  if (!requireAdmin()) return;
  const sections = ['General', 'Brand', 'Тарифы', 'Роли и права', 'Уведомления', 'Email', 'Интеграции', 'Безопасность', 'Приватность', 'Feature flags'];
  const page = h('div', { class: 'admin-page' },
    h('div', { class: 'admin-cols c3' }, ...sections.map(sec => h('div', { class: 'panel', style: 'cursor:pointer', onclick: () => toast(sec + ' — в разработке') },
      h('h3', { style: 'margin:0 0 4px' }, sec), h('div', { class: 'muted small' }, 'Настройки раздела')))),
    h('div', { class: 'panel', style: 'margin-top:14px' }, h('div', { class: 'ph' }, h('h3', {}, 'Роли и права')),
      h('div', { class: 'muted small' }, 'Owner — полный доступ · Admin — управление платформой · Support — пользователи и обращения · Content — контент, блюда, отзывы · Nutritionist — свой кабинет · Client — свой кабинет.')),
    h('button', { class: 'btn danger', style: 'margin-top:14px;max-width:240px', onclick: logout }, ic('logout', 'sm'), 'Выйти'));
  render(adminShell('settings', page, { title: 'Настройки', sub: 'Конфигурация платформы' }));
});

/* ==========================================================================
   ТЕСТ-РЕЖИМ: индикатор версии + сбор обратной связи
   ========================================================================== */
function mountTestBadge() {
  if (document.querySelector('.test-badge')) return;
  const badge = h('div', { class: 'test-badge' },
    h('span', { class: 'tag' }, 'MVP TEST'),
    h('button', { class: 'fb', onclick: openFeedback }, ic('chat', 'sm'), 'Отзыв'));
  document.body.appendChild(badge);
}

function openFeedback() {
  sheet('Оставить отзыв', (panel, close) => {
    panel.appendChild(h('div', { class: 'muted small', style: 'margin-bottom:10px' }, 'Спасибо, что тестируете NutriMenu! Ваш отзыв поможет нам сделать сервис лучше.'));
    const liked = h('textarea', { placeholder: 'Что вам понравилось?' });
    const unclear = h('textarea', { placeholder: 'Что было непонятно?' });
    const suggest = h('textarea', { placeholder: 'Что бы вы изменили?' });
    const missing = h('textarea', { placeholder: 'Чего не хватает?' });
    let rating = 0;
    panel.appendChild(h('label', {}, 'Что понравилось')); panel.appendChild(liked);
    panel.appendChild(h('label', {}, 'Что было непонятно')); panel.appendChild(unclear);
    panel.appendChild(h('label', {}, 'Что бы вы изменили')); panel.appendChild(suggest);
    panel.appendChild(h('label', {}, 'Чего не хватает')); panel.appendChild(missing);
    panel.appendChild(h('label', {}, 'Оценка'));
    panel.appendChild(h('div', { style: 'display:flex;justify-content:center;margin:4px 0 6px' }, starsInput(0, (v) => rating = v)));
    panel.appendChild(h('button', { class: 'btn', style: 'margin-top:12px', onclick: async () => {
      const payload = {
        liked: liked.value || null, unclear: unclear.value || null,
        suggest: suggest.value || null, missing: missing.value || null,
        rating: rating || null, page: location.hash || '#/',
      };
      // Локальная копия на случай оффлайна.
      try { const arr = JSON.parse(localStorage.getItem('nutri_feedback') || '[]'); arr.push({ ...payload, at: new Date().toISOString() }); localStorage.setItem('nutri_feedback', JSON.stringify(arr)); } catch (e) {}
      try { await POST('/feedback', payload); } catch (e) { /* уже сохранено локально */ }
      close(); toast('Спасибо за отзыв!');
    } }, ic('send', 'sm'), 'Отправить'));
  });
}

async function boot() {
  if (State.token) {
    try {
      const me = await GET('/me');
      State.user = me.user; State.role = me.type;
      localStorage.setItem('nutri_role', me.type);
    } catch (e) { State.clear(); }
  }
  if (!location.hash) location.hash = defaultRoute();
  mountTestBadge();
  router();
}
boot();
