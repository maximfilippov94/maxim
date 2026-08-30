/* ==========================================================================
   Конструктор меню — фронт (PWA). Чистый JS, без сборки.
   Потребляет тот же REST API /api/v1, что и будущее нативное приложение.
   ========================================================================== */
'use strict';

const API = '/api/v1';
const MEAL_LABELS = {
  breakfast: 'Завтрак', snack1: 'Перекус', lunch: 'Обед', snack2: 'Полдник', dinner: 'Ужин'
};
const MEAL_ORDER = ['breakfast', 'snack1', 'lunch', 'snack2', 'dinner'];

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
    resp = await fetch(API + path, opts);
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
function sheet(title, contentBuilder) {
  const backdrop = h('div', { class: 'sheet-backdrop' });
  const panel = h('div', { class: 'sheet' });
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
    ? [['clients', 'users', 'Клиенты', '#/clients'],
       ['base', 'book', 'База блюд', '#/base'],
       ['profile', 'user', 'Профиль', '#/profile']]
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
  const hash = location.hash.replace(/^#/, '') || '/';
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
    h('div', { class: 'auth-switch' }, 'Нет аккаунта? ',
      h('a', { href: '#/register' }, 'Регистрация')),
    h('div', { class: 'auth-switch small' },
      h('a', { href: '#/client-login' }, 'Вход для клиента'), '  ·  ',
      h('a', { href: '#/catalog' }, 'Найти нутрициолога'))
  ));
  setTimeout(() => email.focus(), 50);
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
   СПЕЦИАЛИСТ: КЛИЕНТЫ
   ========================================================================== */
route('/clients', async () => {
  if (!requireRole('specialist')) return;
  skeletonList('clients', 'Клиенты');
  const { items } = await GET('/clients');
  const active = items.filter(x => x.status !== 'archived');
  const list = h('div', { class: 'content stagger grid-cards' });
  if (!active.length) {
    list.appendChild(h('div', { class: 'empty' }, ic('users'), h('div', {}, 'Пока нет клиентов'), h('div', { class: 'small' }, 'Нажмите +, чтобы добавить первого')));
  }
  for (const c of active) {
    list.appendChild(h('div', { class: 'list-item', onclick: () => location.hash = '#/client/' + c.id },
      h('div', { class: 'avatar' }, initials(c.name)),
      h('div', { class: 'grow' },
        h('h3', {}, c.name),
        h('div', { class: 'sub' },
          h('span', { class: 'status-dot ' + (c.menu_status || 'draft') }),
          [c.goal ? c.goal : 'Цель не задана',
           c.menu_status ? (c.menu_status === 'published' ? 'меню опубликовано' : 'черновик меню') : 'нет меню'].join(' · '))
      ),
      c.unread_messages ? h('span', { class: 'pill', style: 'background:var(--over);color:#fff' }, String(c.unread_messages)) : null,
      ic('chevronRight', 'chevron sm')
    ));
  }
  const fab = h('button', { class: 'btn fab', 'aria-label': 'Добавить клиента', onclick: () => location.hash = '#/client/new' }, ic('plus'));
  render(shell('clients', list, { topbar: 'Клиенты' }));
  $app().querySelector('.screen').appendChild(fab);
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
  const c = await GET('/clients/' + args.id);
  const menus = c.menus || [];

  const menuList = h('div', {});
  if (!menus.length) menuList.appendChild(h('div', { class: 'muted small' }, 'Меню ещё не создано.'));
  for (const m of menus) {
    menuList.appendChild(h('div', { class: 'list-item', onclick: () => location.hash = '#/menu/' + m.id },
      h('div', { class: 'grow' },
        h('h3', {}, m.title || 'Меню'),
        h('div', { class: 'sub' }, h('span', { class: 'status-dot ' + m.status }), (m.status === 'published' ? 'Опубликовано' : 'Черновик') + ' · ' + m.days_count + ' дн. · с ' + m.start_date)),
      ic('chevronRight', 'chevron sm')
    ));
  }

  const targets = (c.target_kcal || c.target_protein) ?
    `${c.target_kcal || '—'} ккал · Б ${c.target_protein || '—'} · Ж ${c.target_fat || '—'} · У ${c.target_carbs || '—'}` :
    'Целевые КБЖУ не заданы';

  const content = h('div', { class: 'content' },
    h('div', { class: 'card' },
      h('div', { class: 'row-between' }, h('h3', { style: 'margin:0' }, c.name),
        h('button', { class: 'btn ghost small', onclick: () => location.hash = '#/client/' + c.id + '/edit' }, 'Изменить')),
      c.goal ? h('div', { class: 'small', style: 'margin-top:8px;display:flex;gap:7px;align-items:center' }, ic('target', 'sm'), h('span', {}, c.goal)) : null,
      h('div', { class: 'small muted', style: 'margin-top:6px' }, targets)
    ),
    intakeCard(c),
    h('div', { class: 'card' },
      h('div', { class: 'row-between' }, h('h3', { style: 'margin:0;font-size:15px' }, 'Меню'),
        h('button', { class: 'btn secondary small', onclick: () => createMenu(c.id) }, ic('plus','sm'), 'Меню')),
      h('div', { class: 'divider' }), menuList
    ),
    h('div', { class: 'btn-row' },
      h('button', { class: 'btn secondary', onclick: () => location.hash = '#/chat/' + c.id }, ic('chat', 'sm'), 'Чат'),
      h('button', { class: 'btn secondary', onclick: () => location.hash = '#/weight/' + c.id }, ic('scale', 'sm'), 'Вес')
    ),
    h('button', { class: 'btn ghost', style: 'margin-top:10px', onclick: () => shareInvite(c.id) }, ic('link', 'sm'), 'Ссылка-приглашение'),
    h('button', { class: 'btn danger', style: 'margin-top:6px', onclick: () => archiveClient(c.id) }, ic('trash','sm'), 'В архив')
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

  const container = h('div', {});

  // Верхняя панель с действиями меню
  const action = h('button', { class: 'icon-btn', 'aria-label': 'Действия с меню', onclick: () => menuActions(data) }, ic('more'));

  // Табы дней (горизонтальный свайп)
  const tabs = h('div', { class: 'day-tabs' });
  for (let d = 1; d <= menu.days_count; d++) {
    tabs.appendChild(h('button', { class: d === currentDay ? 'active' : '', onclick: () => { currentDay = d; renderMenu(menuId); } }, 'День ' + d));
  }
  container.appendChild(tabs);

  const day = data.days.find(x => x.day_number === currentDay) || { meals: [], totals: {}, deviation: null };

  // Липкая плашка итогов дня
  container.appendChild(dayTotalsBar(day, data.targets));

  // Двухпанельная раскладка: слева канвас меню, справа база блюд (десктоп).
  const desktop = isDesktop();
  const wrap = h('div', { class: 'builder-wrap' });
  const main = h('div', { class: 'builder-main' });

  // Приёмы пищи
  const groupsByMeal = {};
  for (const mt of MEAL_ORDER) {
    const meals = day.meals.filter(m => m.meal_type === mt);
    const addBtn = h('button', { class: 'add-inline', 'aria-label': 'Добавить блюдо',
      onclick: () => desktop ? setActiveMeal(mt) : openDishPicker(menuId, mt) }, ic('plus'));
    const group = h('div', { class: 'meal-group', 'data-meal': mt },
      h('h4', {}, MEAL_LABELS[mt], addBtn));
    if (!meals.length) {
      group.appendChild(h('div', { class: 'meal-empty', onclick: () => desktop ? setActiveMeal(mt) : openDishPicker(menuId, mt) }, 'Пусто — нажмите + чтобы добавить блюдо'));
    }
    for (const m of meals) group.appendChild(mealCard(menuId, m));
    groupsByMeal[mt] = { group, addBtn };
    main.appendChild(group);
  }
  wrap.appendChild(main);

  // Правая панель — база блюд (только десктоп)
  let dbApi = null;
  if (desktop) {
    const rail = buildFoodRail(menuId);
    dbApi = rail.api;
    wrap.appendChild(rail.el);
  }
  container.appendChild(wrap);

  // Подсветка активного приёма пищи + синхронизация панели.
  function setActiveMeal(mt) {
    activeMeal = mt;
    for (const key of MEAL_ORDER) {
      groupsByMeal[key].group.classList.toggle('active-target', key === mt);
      groupsByMeal[key].addBtn.classList.toggle('on', key === mt);
    }
    if (dbApi) dbApi.setTarget(mt);
  }

  render(shell('clients', container, { topbar: menu.title || 'Меню', back: () => location.hash = '#/client/' + menu.client_id, action }));
  if (desktop) setActiveMeal(MEAL_ORDER.includes(activeMeal) ? activeMeal : 'breakfast');
}

/* Добавить блюдо в приём пищи текущего дня и перерисовать. */
async function addDishToMeal(menuId, mealType, dishId) {
  try {
    await POST('/menus/' + menuId + '/items', { day_number: currentDay, meal_type: mealType, dish_id: dishId });
    toast('Добавлено'); renderMenu(menuId);
  } catch (e) { toast(e.message, true); }
}

/* Правая панель «База блюд» для десктопного конструктора. */
function buildFoodRail(menuId) {
  const el = h('div', { class: 'builder-db' });
  const target = h('div', { class: 'db-target' });
  const head = h('div', { class: 'db-head' },
    h('h3', {}, 'База блюд'), target);
  const search = h('input', { placeholder: 'Поиск блюда…' });
  head.appendChild(h('div', { class: 'search-field', style: 'margin-top:8px' }, ic('search'), search));
  const body = h('div', { class: 'db-body' });
  el.appendChild(head); el.appendChild(body);

  const load = async () => {
    body.innerHTML = '<div class="muted small">Загрузка…</div>';
    const q = new URLSearchParams();
    if (search.value.trim()) q.set('q', search.value.trim());
    if (activeMeal) q.set('meal_type', activeMeal);
    let data;
    try { data = await GET('/dishes?' + q.toString()); } catch (e) { body.innerHTML = ''; body.appendChild(h('div', { class: 'muted small' }, e.message)); return; }
    body.innerHTML = '';
    if (!data.items.length) { body.appendChild(h('div', { class: 'empty' }, ic('search'), h('div', {}, 'Не найдено'))); return; }
    for (const d of data.items) {
      const thumb = h('div', { class: 'thumb' });
      if (d.photo_url) thumb.style.backgroundImage = `url(${d.photo_url})`;
      body.appendChild(h('div', { class: 'db-food' }, thumb,
        h('div', { class: 'grow' }, h('h4', {}, d.name),
          h('div', { class: 'sub' }, `${fmt0(d.kcal_100 || 0)} ккал/100г · порция ${fmt0(d.base_portion_g || 0)} г`)),
        h('button', { class: 'addb', 'aria-label': 'Добавить', onclick: () => addDishToMeal(menuId, activeMeal, d.id) }, ic('plus'))));
    }
  };
  let timer;
  search.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(load, 250); });

  return {
    el,
    api: {
      setTarget(mt) { target.innerHTML = ''; target.append('Добавить в: ', h('b', {}, MEAL_LABELS[mt])); load(); }
    }
  };
}

function dayTotalsBar(day, targets) {
  const t = day.totals || {};
  const dev = day.deviation;
  const bar = h('div', { class: 'day-totals' });
  const row1 = h('div', { class: 'row1' },
    h('span', { class: 'kcal-big' }, fmt0(t.kcal || 0)),
    h('span', { class: 'target' }, 'ккал' + (targets && targets.target_kcal ? ' / ' + targets.target_kcal : '')));
  if (dev && dev.kcal != null) {
    const over = dev.kcal > 0;
    row1.appendChild(h('span', { class: 'dev-chip' }, (over ? '+' : '') + fmt0(dev.kcal)));
  }
  bar.appendChild(row1);

  const macros = h('div', { class: 'macros' });
  const macroBlock = (label, val, devVal) => {
    const block = h('div', { class: 'macro' },
      h('div', { class: 'lbl' }, label));
    const valRow = h('div', { class: 'val' }, fmt(val || 0) + ' г');
    if (devVal != null) {
      const over = devVal > 0;
      valRow.appendChild(h('span', { class: 'dev' }, (over ? '+' : '') + fmt(devVal)));
    }
    block.appendChild(valRow);
    return block;
  };
  macros.appendChild(macroBlock('Белки', t.protein, dev && dev.protein));
  macros.appendChild(macroBlock('Жиры', t.fat, dev && dev.fat));
  macros.appendChild(macroBlock('Углеводы', t.carbs, dev && dev.carbs));
  bar.appendChild(macros);
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
  const n = m.nutrition;
  const card = h('div', { class: 'meal-card', onclick: () => openPortionEditor(menuId, m) },
    h('div', { class: 'mc-top' },
      h('div', { class: 'mc-name' }, m.dish_name),
      h('div', { class: 'mc-kcal' }, fmt0(n.kcal) + ' ккал')),
    macroLine(n, true),
    m.comment ? h('div', { class: 'comment' }, ic('chat', 'sm'), h('span', {}, m.comment)) : null
  );
  return card;
}

/* Выбор блюда — «не больше двух тапов»: открыть шторку, тап по блюду = добавлено. */
async function openDishPicker(menuId, mealType) {
  sheet('Добавить: ' + MEAL_LABELS[mealType], async (panel, close) => {
    const search = h('input', { placeholder: 'Поиск блюда…' });
    panel.appendChild(searchField(search));
    const results = h('div', {});
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
        results.appendChild(h('div', { class: 'pick-item', onclick: async () => {
          try {
            await POST('/menus/' + menuId + '/items', { day_number: currentDay, meal_type: mealType, dish_id: d.id });
            close(); toast('Добавлено'); renderMenu(menuId);
          } catch (e) { toast(e.message, true); }
        } },
          h('div', { class: 'grow' },
            h('h3', {}, d.name),
            h('div', { class: 'sub' }, `${fmt0(d.kcal_100 || 0)} ккал/100г · порция ${fmt0(d.base_portion_g || 0)} г`),
            (d.tags && d.tags.length) ? h('div', { class: 'tag-list' }, d.tags.map(t => h('span', { class: 'pill tag' }, t))) : null),
          h('span', { class: 'plus' }, ic('plus'))
        ));
      }
    };
    search.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(load, 250); });
    load();
  });
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

    const valEl = h('div', { class: 'val' }, portion, h('span', {}, ' г'));
    const kcalEl = h('div', { class: 'center kcal-live', style: 'margin:4px 0 10px' }, fmt0(m.nutrition.kcal) + ' ккал');
    const macroEl = h('div', { class: 'center muted small' }, '');
    const slider = h('input', { type: 'range', min: '10', max: String(Math.round(maxP)), step: '5', value: String(portion) });

    // Предпросчёт на клиенте (для отзывчивости), правда придёт из API при сохранении.
    const preview = () => {
      const k = base > 0 ? portion / base : 0;
      const whole = dish && dish.nutrition ? dish.nutrition.totals : null;
      if (whole) {
        kcalEl.textContent = fmt0(whole.kcal * k) + ' ккал';
        macroEl.textContent = `Б ${fmt(whole.protein * k)} · Ж ${fmt(whole.fat * k)} · У ${fmt(whole.carbs * k)}`;
      }
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

    panel.appendChild(h('div', { class: 'portion-edit' }, valEl, kcalEl, macroEl, slider, quick));
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
  });
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

/* ==========================================================================
   СПЕЦИАЛИСТ: БАЗА БЛЮД
   ========================================================================== */
route('/base', async () => {
  if (!requireRole('specialist')) return;
  loading();
  const content = h('div', { class: 'content' });
  const search = h('input', { placeholder: 'Поиск блюда…' });
  const chips = h('div', { class: 'chip-row' });
  const results = h('div', { class: 'grid-cards' });
  let mealFilter = '';

  const load = async () => {
    results.innerHTML = '<div class="muted small">Загрузка…</div>';
    const q = new URLSearchParams();
    if (search.value.trim()) q.set('q', search.value.trim());
    if (mealFilter) q.set('meal_type', mealFilter);
    const data = await GET('/dishes?' + q.toString());
    results.innerHTML = '';
    if (!data.items.length) { results.appendChild(h('div', { class: 'empty' }, ic('search'), h('div', {}, 'Ничего не найдено'))); return; }
    for (const d of data.items) {
      results.appendChild(h('div', { class: 'list-item', onclick: () => location.hash = '#/dish/' + d.id },
        h('div', { class: 'grow' },
          h('h3', {}, d.name),
          h('div', { class: 'sub' }, `${fmt0(d.kcal_100 || 0)} ккал/100г · порция ${fmt0(d.base_portion_g || 0)} г`)),
        ic('chevronRight', 'chevron sm')));
    }
  };

  const chipDefs = [['', 'Все'], ...MEAL_ORDER.map(mt => [mt, MEAL_LABELS[mt]])];
  for (const [val, label] of chipDefs) {
    const b = h('button', { class: val === mealFilter ? 'active' : '', onclick: () => {
      mealFilter = val;
      chips.querySelectorAll('button').forEach(x => x.classList.remove('active'));
      b.classList.add('active'); load();
    } }, label);
    chips.appendChild(b);
  }

  let timer;
  search.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(load, 250); });

  content.appendChild(searchField(search));
  content.appendChild(chips);
  content.appendChild(results);
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
    body.appendChild(h('h4', { class: '', style: 'margin:14px 2px 6px;color:var(--muted);font-size:13px;text-transform:uppercase' }, MEAL_LABELS[mt]));
    for (const m of meals) body.appendChild(clientMealCard(data.menu.id, m));
  }
  return body;
}

function clientMealCard(menuId, m) {
  const n = m.nutrition;
  const eaten = m.log && m.log.status === 'eaten';
  const skipped = m.log && m.log.status === 'skipped';
  const card = h('div', { class: 'meal-card' + (eaten ? ' eaten' : '') + (skipped ? ' skipped' : '') });
  card.appendChild(h('div', { class: 'mc-top' },
    h('div', { class: 'mc-name', onclick: () => showDishForClient(m) }, m.dish_name),
    h('div', { class: 'mc-kcal' }, fmt0(n.kcal) + ' ккал')));
  card.appendChild(macroLine(n, true));
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
    panel.appendChild(h('div', { class: 'kbju', style: 'margin-bottom:10px' },
      h('span', { class: 'pill k' }, fmt0(m.nutrition.kcal) + ' ккал'),
      h('span', { class: 'pill b' }, 'Б ' + fmt(m.nutrition.protein)),
      h('span', { class: 'pill f' }, 'Ж ' + fmt(m.nutrition.fat)),
      h('span', { class: 'pill c' }, 'У ' + fmt(m.nutrition.carbs))));
    panel.appendChild(h('div', { class: 'muted small' }, 'Порция: ' + fmt(m.nutrition.portion_g) + ' г'));
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
  const W = 320, H = 160, pad = 24;
  const vals = series.map(s => s.weight_kg);
  const min = Math.min(...vals), max = Math.max(...vals);
  const range = (max - min) || 1;
  const x = (i) => pad + (i / (series.length - 1)) * (W - pad * 2);
  const y = (v) => pad + (1 - (v - min) / range) * (H - pad * 2);
  const pts = series.map((s, i) => `${x(i)},${y(s.weight_kg)}`).join(' ');
  const area = `${pad},${H - pad} ` + pts + ` ${x(series.length - 1)},${H - pad}`;
  const dots = series.map((s, i) => `<circle cx="${x(i)}" cy="${y(s.weight_kg)}" r="3.5" fill="var(--surface)" stroke="var(--brand)" stroke-width="2.5"/>`).join('');
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
    <polygon points="${area}" fill="url(#wArea)"/>
    <polyline points="${pts}" fill="none" stroke="url(#wLine)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
    ${dots}
    <text x="${pad}" y="14" font-size="11" fill="var(--faint)">${fmt(max)} кг</text>
    <text x="${pad}" y="${H - 6}" font-size="11" fill="var(--faint)">${fmt(min)} кг</text>`;
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
      h('button', { class: 'btn tonal small', style: 'align-self:flex-end', onclick: () => toast('Сообщение отправлено (демо)') }, 'Написать')));

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
    h('div', { class: 'toolbar' }, h('div', { style: 'flex:1' }), h('button', { class: 'btn small', style: 'width:auto', onclick: () => toast('Создание тарифа (демо)') }, ic('plus', 'sm'), 'Добавить тариф')),
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

async function boot() {
  if (State.token) {
    try {
      const me = await GET('/me');
      State.user = me.user; State.role = me.type;
      localStorage.setItem('nutri_role', me.type);
    } catch (e) { State.clear(); }
  }
  if (!location.hash) location.hash = defaultRoute();
  router();
}
boot();
