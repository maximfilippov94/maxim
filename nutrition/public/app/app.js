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

function toast(msg, isErr) {
  const t = h('div', { class: 'toast' + (isErr ? ' err' : '') }, msg);
  $overlay().appendChild(t);
  setTimeout(() => t.remove(), 2600);
}

function fmt(n) { return (Math.round(n * 10) / 10).toString(); }
function fmt0(n) { return Math.round(n).toString(); }

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

/* Общий каркас: контент + нижняя навигация по роли. */
function shell(active, contentNode, opts = {}) {
  const wrap = h('div', { class: 'screen' });
  if (opts.topbar) {
    const bar = h('div', { class: 'topbar' });
    if (opts.back) bar.appendChild(h('button', { class: 'back', onclick: opts.back }, '‹'));
    bar.appendChild(h('h1', {}, opts.topbar));
    if (opts.action) bar.appendChild(opts.action);
    wrap.appendChild(bar);
  }
  wrap.appendChild(contentNode);
  wrap.appendChild(bottomNav(active));
  return wrap;
}

function navButton(active, key, icon, label, hash, badge) {
  const btn = h('button', { class: key === active ? 'active' : '', onclick: () => location.hash = hash },
    h('span', { class: 'ico' }, icon), label);
  if (badge) btn.appendChild(h('span', { class: 'badge' }, String(badge)));
  return btn;
}

function bottomNav(active) {
  const nav = h('div', { class: 'bottom-nav' });
  if (State.role === 'specialist') {
    nav.appendChild(navButton(active, 'clients', '👥', 'Клиенты', '#/clients'));
    nav.appendChild(navButton(active, 'base', '📖', 'База блюд', '#/base'));
    nav.appendChild(navButton(active, 'profile', '⚙️', 'Профиль', '#/profile'));
  } else {
    nav.appendChild(navButton(active, 'today', '🍽', 'Сегодня', '#/today'));
    nav.appendChild(navButton(active, 'week', '🗓', 'Неделя', '#/week'));
    nav.appendChild(navButton(active, 'progress', '📈', 'Прогресс', '#/progress'));
    nav.appendChild(navButton(active, 'chat', '💬', 'Чат', '#/client-chat'));
  }
  return nav;
}

function loading() { render(h('div', { class: 'boot' }, 'Загрузка…')); }

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
  return State.role === 'specialist' ? '#/clients' : '#/today';
}

window.addEventListener('hashchange', router);

/* ==========================================================================
   АУТЕНТИФИКАЦИЯ
   ========================================================================== */
function authShell(inner) {
  render(h('div', { class: 'auth-wrap' },
    h('div', { class: 'auth-logo' },
      h('div', { class: 'mark' }, '🥗'),
      h('h1', {}, 'Конструктор меню'),
      h('div', { class: 'muted' }, 'для нутрициологов')
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
      h('a', { href: '#/client-login' }, 'Вход для клиента'))
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
      State.setAuth(r.token, 'client', r.user); location.hash = '#/today';
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
      State.setAuth(r.token, 'client', r.user); location.hash = '#/today';
    } catch (e) { err.textContent = e.message; err.style.display = 'block'; }
  };
  authShell(h('div', { class: 'card' },
    h('p', {}, 'Здравствуйте, ', h('b', {}, info.name), '! Задайте пароль для входа в кабинет.'),
    h('label', {}, 'Пароль'), pass, err,
    h('button', { class: 'btn', style: 'margin-top:12px', onclick: submit }, 'Продолжить')
  ));
});

/* ==========================================================================
   СПЕЦИАЛИСТ: КЛИЕНТЫ
   ========================================================================== */
route('/clients', async () => {
  if (!requireRole('specialist')) return;
  loading();
  const { items } = await GET('/clients');
  const list = h('div', { class: 'content' });
  if (!items.length) {
    list.appendChild(h('div', { class: 'empty' }, 'Пока нет клиентов. Нажмите + чтобы добавить.'));
  }
  for (const c of items.filter(x => x.status !== 'archived')) {
    list.appendChild(h('div', { class: 'list-item', onclick: () => location.hash = '#/client/' + c.id },
      h('div', { class: 'grow' },
        h('h3', {}, c.name),
        h('div', { class: 'sub' }, [
          c.goal ? c.goal : 'Цель не задана',
          c.menu_status ? ' · меню: ' + (c.menu_status === 'published' ? 'опубликовано' : 'черновик') : ' · нет меню'
        ].join(''))
      ),
      c.unread_messages ? h('span', { class: 'badge', style: 'position:static' }, String(c.unread_messages)) : null,
      h('span', { class: 'chevron' }, '›')
    ));
  }
  const fab = h('button', { class: 'btn fab', onclick: () => location.hash = '#/client/new' }, '+');
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
    h('div', { class: 'disclaimer' }, 'При беременности, диабете, заболеваниях ЖКТ и расстройствах пищевого поведения клиенту необходима консультация врача.'),
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
      h('span', { class: 'chevron' }, '›')
    ));
  }

  const targets = (c.target_kcal || c.target_protein) ?
    `${c.target_kcal || '—'} ккал · Б ${c.target_protein || '—'} · Ж ${c.target_fat || '—'} · У ${c.target_carbs || '—'}` :
    'Целевые КБЖУ не заданы';

  const content = h('div', { class: 'content' },
    h('div', { class: 'card' },
      h('div', { class: 'row-between' }, h('h3', { style: 'margin:0' }, c.name),
        h('button', { class: 'btn ghost small', onclick: () => location.hash = '#/client/' + c.id + '/edit' }, 'Изменить')),
      c.goal ? h('div', { class: 'small', style: 'margin-top:6px' }, '🎯 ' + c.goal) : null,
      h('div', { class: 'small muted', style: 'margin-top:6px' }, targets)
    ),
    h('div', { class: 'card' },
      h('div', { class: 'row-between' }, h('h3', { style: 'margin:0;font-size:15px' }, 'Меню'),
        h('button', { class: 'btn secondary small', onclick: () => createMenu(c.id) }, '+ Меню')),
      h('div', { class: 'divider' }), menuList
    ),
    h('div', { class: 'btn-row' },
      h('button', { class: 'btn secondary', onclick: () => location.hash = '#/chat/' + c.id }, '💬 Чат'),
      h('button', { class: 'btn secondary', onclick: () => location.hash = '#/weight/' + c.id }, '📈 Вес')
    ),
    h('button', { class: 'btn ghost', style: 'margin-top:10px', onclick: () => shareInvite(c.id) }, '🔗 Ссылка-приглашение'),
    h('button', { class: 'btn danger', style: 'margin-top:6px', onclick: () => archiveClient(c.id) }, 'В архив')
  );
  render(shell('clients', content, { topbar: c.name, back: () => location.hash = '#/clients' }));
});

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
  const action = h('button', { class: 'btn ghost small', onclick: () => menuActions(data) }, '•••');

  // Табы дней (горизонтальный свайп)
  const tabs = h('div', { class: 'day-tabs' });
  for (let d = 1; d <= menu.days_count; d++) {
    tabs.appendChild(h('button', { class: d === currentDay ? 'active' : '', onclick: () => { currentDay = d; renderMenu(menuId); } }, 'День ' + d));
  }
  container.appendChild(tabs);

  const day = data.days.find(x => x.day_number === currentDay) || { meals: [], totals: {}, deviation: null };

  // Липкая плашка итогов дня
  container.appendChild(dayTotalsBar(day, data.targets));

  // Приёмы пищи
  const body = h('div', { class: 'content' });
  for (const mt of MEAL_ORDER) {
    const meals = day.meals.filter(m => m.meal_type === mt);
    const group = h('div', { class: 'meal-group' },
      h('h4', {}, MEAL_LABELS[mt], h('span', { class: 'add-inline', onclick: () => openDishPicker(menuId, mt) }, '+')));
    if (!meals.length) {
      group.appendChild(h('div', { class: 'muted small', style: 'padding:2px 2px 8px' }, '—'));
    }
    for (const m of meals) {
      group.appendChild(mealCard(menuId, m));
    }
    body.appendChild(group);
  }
  container.appendChild(body);

  render(shell('clients', container, { topbar: menu.title || 'Меню', back: () => location.hash = '#/client/' + menu.client_id, action }));
}

function dayTotalsBar(day, targets) {
  const t = day.totals || {};
  const dev = day.deviation;
  const bar = h('div', { class: 'day-totals' });
  const row1 = h('div', { class: 'row1' },
    h('span', { class: 'kcal-big' }, fmt0(t.kcal || 0)),
    h('span', { class: 'target' }, 'ккал' + (targets && targets.target_kcal ? ' из ' + targets.target_kcal : '')));
  if (dev && dev.kcal != null) {
    const over = dev.kcal > 0;
    row1.appendChild(h('span', { class: 'deviation-chip ' + (over ? '' : ''), style: 'margin-left:auto' },
      (over ? '+' : '') + fmt0(dev.kcal)));
  }
  bar.appendChild(row1);
  const macros = h('div', { class: 'macros' });
  const macroSpan = (label, val, devVal) => {
    const parts = [h('b', {}, fmt(val || 0) + ' г'), ' ' + label];
    const span = h('span', {}, ...parts);
    if (devVal != null) {
      const over = devVal > 0;
      span.appendChild(h('span', { class: 'dev ' + (over ? 'over' : 'under') }, ' (' + (over ? '+' : '') + fmt(devVal) + ')'));
    }
    return span;
  };
  macros.appendChild(macroSpan('Б', t.protein, dev && dev.protein));
  macros.appendChild(macroSpan('Ж', t.fat, dev && dev.fat));
  macros.appendChild(macroSpan('У', t.carbs, dev && dev.carbs));
  bar.appendChild(macros);
  return bar;
}

function mealCard(menuId, m) {
  const n = m.nutrition;
  const card = h('div', { class: 'meal-card', onclick: () => openPortionEditor(menuId, m) },
    h('div', { class: 'mc-top' },
      h('div', { class: 'mc-name' }, m.dish_name),
      h('div', { class: 'mc-kcal' }, fmt0(n.kcal) + ' ккал')),
    h('div', { class: 'mc-macros' }, `${fmt(n.portion_g)} г · Б ${fmt(n.protein)} · Ж ${fmt(n.fat)} · У ${fmt(n.carbs)}`),
    m.comment ? h('div', { class: 'comment' }, '💬 ' + m.comment) : null
  );
  return card;
}

/* Выбор блюда — «не больше двух тапов»: открыть шторку, тап по блюду = добавлено. */
async function openDishPicker(menuId, mealType) {
  sheet('Добавить: ' + MEAL_LABELS[mealType], async (panel, close) => {
    const search = h('input', { placeholder: 'Поиск блюда…' });
    panel.appendChild(h('div', { class: 'search-box' }, search));
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
      if (!data.items.length) { results.appendChild(h('div', { class: 'empty' }, 'Ничего не найдено')); return; }
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
          h('span', { class: 'chevron' }, '+')
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
    const kcalEl = h('div', { class: 'center', style: 'margin:4px 0 10px;font-weight:700;color:var(--green-dark)' }, fmt0(m.nutrition.kcal) + ' ккал');
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
    } }, 'Сохранить');
    const del = h('button', { class: 'btn danger', style: 'margin-top:8px', onclick: async () => {
      try { await DEL('/menus/' + menuId + '/items/' + m.id); close(); toast('Удалено'); renderMenu(menuId); }
      catch (e) { toast(e.message, true); }
    } }, 'Убрать из меню');
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
    } }, published ? 'Снять с публикации' : '✅ Опубликовать клиенту'));

    panel.appendChild(h('button', { class: 'btn secondary', style: 'margin-top:8px', onclick: () => { close(); copyDaySheet(menu); } }, 'Скопировать день → день'));
    panel.appendChild(h('button', { class: 'btn secondary', style: 'margin-top:8px', onclick: async () => {
      try { const r = await POST('/menus/' + menu.id + '/duplicate', {}); close(); toast('Меню продублировано'); location.hash = '#/menu/' + r.menu.id; }
      catch (e) { toast(e.message, true); }
    } }, 'Дублировать меню (след. неделя)'));

    panel.appendChild(h('div', { class: 'divider' }));
    panel.appendChild(h('button', { class: 'btn danger', onclick: async () => {
      if (!confirm('Удалить меню целиком?')) return;
      await DEL('/menus/' + menu.id); close(); toast('Удалено'); location.hash = '#/client/' + menu.client_id;
    } }, 'Удалить меню'));
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
  const results = h('div', {});
  let mealFilter = '';

  const load = async () => {
    results.innerHTML = '<div class="muted small">Загрузка…</div>';
    const q = new URLSearchParams();
    if (search.value.trim()) q.set('q', search.value.trim());
    if (mealFilter) q.set('meal_type', mealFilter);
    const data = await GET('/dishes?' + q.toString());
    results.innerHTML = '';
    if (!data.items.length) { results.appendChild(h('div', { class: 'empty' }, 'Ничего не найдено')); return; }
    for (const d of data.items) {
      results.appendChild(h('div', { class: 'list-item', onclick: () => location.hash = '#/dish/' + d.id },
        h('div', { class: 'grow' },
          h('h3', {}, d.name),
          h('div', { class: 'sub' }, `${fmt0(d.kcal_100 || 0)} ккал/100г · порция ${fmt0(d.base_portion_g || 0)} г`)),
        h('span', { class: 'chevron' }, '›')));
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

  content.appendChild(h('div', { class: 'search-box' }, search));
  content.appendChild(chips);
  content.appendChild(results);
  const fab = h('button', { class: 'btn fab', onclick: () => location.hash = '#/dish/new' }, '+');
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
    h('div', { class: 'card' },
      h('h3', { style: 'margin:0 0 8px' }, d.name),
      h('div', { class: 'kbju' },
        h('span', { class: 'pill k' }, fmt0(n.kcal_100) + ' ккал/100г'),
        h('span', { class: 'pill b' }, 'Б ' + fmt(n.protein_100)),
        h('span', { class: 'pill f' }, 'Ж ' + fmt(n.fat_100)),
        h('span', { class: 'pill c' }, 'У ' + fmt(n.carbs_100))),
      h('div', { class: 'muted small', style: 'margin-top:8px' }, 'Базовая порция: ' + fmt0(d.base_portion_g) + ' г' + (d.cook_minutes ? ' · ⏱ ' + d.cook_minutes + ' мин' : '')),
      (d.tags && d.tags.length) ? h('div', { class: 'tag-list', style: 'margin-top:8px' }, d.tags.map(t => h('span', { class: 'pill tag' }, t))) : null
    ),
    h('div', { class: 'card' },
      h('div', { class: 'muted small', style: 'margin-bottom:6px' }, 'Состав (сырой вес)'),
      ...d.ingredients.map(ing => h('div', { class: 'row-between small', style: 'padding:4px 0;border-bottom:1px solid var(--line)' },
        h('span', {}, ing.name), h('span', { class: 'muted' }, fmt(ing.grams) + ' г')))
    ),
    d.instructions ? h('div', { class: 'card' }, h('div', { class: 'muted small', style: 'margin-bottom:6px' }, 'Рецепт'), h('div', {}, d.instructions)) : null,
    canEdit ? h('div', { class: 'btn-row' },
      h('button', { class: 'btn secondary', onclick: () => dishForm(d) }, 'Редактировать'),
      h('button', { class: 'btn danger', onclick: async () => { if (confirm('Удалить блюдо?')) { try { await DEL('/dishes/' + d.id); toast('Удалено'); location.hash = '#/base'; } catch (e) { toast(e.message, true); } } } }, 'Удалить')
    ) : h('div', { class: 'muted small center' }, 'Блюдо из общей базы — доступно только для чтения. Скопируйте его как своё, чтобы менять.')
  );
  render(shell('base', content, { topbar: 'Блюдо', back: () => location.hash = '#/base' }));
});

async function dishForm(dish) {
  loading();
  const name = h('input', { placeholder: 'Название блюда', value: dish ? dish.name : '' });
  const cook = h('input', { type: 'number', placeholder: 'Время готовки, мин', value: dish ? (dish.cook_minutes || '') : '' });
  const instr = h('textarea', { placeholder: 'Рецепт / инструкция' }, dish ? (dish.instructions || '') : '');
  const tags = h('input', { placeholder: 'Теги через запятую (веган, быстро…)', value: dish && dish.tags ? dish.tags.join(', ') : '' });

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
        h('button', { class: 'btn ghost small', onclick: () => { composition.splice(idx, 1); redrawComp(); } }, '✕')));
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
    const payload = {
      name: name.value.trim(),
      meal_types: [...selected],
      cook_minutes: cook.value || null,
      instructions: instr.value || null,
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
    h('div', { class: 'card' }, h('label', {}, 'Рецепт'), instr),
    err,
    h('button', { class: 'btn', onclick: save }, dish ? 'Сохранить блюдо' : 'Создать блюдо')
  );
  render(shell('base', content, { topbar: dish ? 'Редактирование блюда' : 'Новое блюдо', back: () => history.back() }));
}

function openIngredientPicker(onPick) {
  sheet('Ингредиент', async (panel, close) => {
    const search = h('input', { placeholder: 'Поиск ингредиента…' });
    panel.appendChild(h('div', { class: 'search-box' }, search));
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
          h('span', { class: 'chevron' }, '+')));
      }
      if (!data.items.length) results.appendChild(h('div', { class: 'empty' }, 'Не найдено'));
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
  const bar = h('div', { class: 'chat-input' }, input, h('button', { class: 'btn', onclick: send }, '➤'));
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

route('/profile', () => {
  if (!requireRole('specialist')) return;
  const u = State.user || {};
  const content = h('div', { class: 'content' },
    h('div', { class: 'card' },
      h('h3', { style: 'margin:0' }, u.name || 'Специалист'),
      h('div', { class: 'muted small' }, u.email || ''),
      h('div', { class: 'small', style: 'margin-top:8px' }, 'Тариф: ' + (u.plan === 'trial' ? 'пробный' : u.plan) + (u.plan_expires_at ? ' до ' + u.plan_expires_at.slice(0, 10) : ''))),
    h('button', { class: 'btn danger', onclick: logout }, 'Выйти')
  );
  render(shell('profile', content, { topbar: 'Профиль' }));
});

async function logout() {
  try { await POST('/auth/logout', {}); } catch (e) {}
  State.clear(); location.hash = '#/';
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
    render(shell('today', h('div', { class: 'empty' }, 'Меню ещё не назначено. Загляните позже.'), { topbar: 'Сегодня' }));
    return;
  }
  const dayNum = currentDayNumber(data.menu);
  renderClientDay(data, dayNum, 'today', 'Сегодня');
});

route('/week', async () => {
  if (!requireRole('client')) return;
  loading();
  const data = await GET('/me/menu');
  if (!data.menu) { render(shell('week', h('div', { class: 'empty' }, 'Меню ещё не назначено.'), { topbar: 'Неделя' })); return; }
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
  render(shell('week', content, { topbar: data.menu.title || 'Меню на неделю' }));
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
  if (!day.meals.length) { body.appendChild(h('div', { class: 'empty' }, 'На этот день блюд нет.')); return body; }
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
  card.appendChild(h('div', { class: 'mc-macros' }, `${fmt(n.portion_g)} г · Б ${fmt(n.protein)} · Ж ${fmt(n.fat)} · У ${fmt(n.carbs)}`));
  if (m.comment) card.appendChild(h('div', { class: 'comment' }, '💬 ' + m.comment));
  const actions = h('div', { class: 'btn-row', style: 'margin-top:10px' },
    h('button', { class: 'btn ' + (eaten ? '' : 'secondary') + ' small', onclick: () => logMeal(menuId, m, 'eaten') }, eaten ? '✓ Съедено' : 'Съел'),
    h('button', { class: 'btn ' + (skipped ? 'danger' : 'secondary') + ' small', onclick: () => logMeal(menuId, m, 'skipped') }, 'Пропустил'));
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
    panel.appendChild(h('div', { class: 'kbju', style: 'margin-bottom:10px' },
      h('span', { class: 'pill k' }, fmt0(m.nutrition.kcal) + ' ккал'),
      h('span', { class: 'pill b' }, 'Б ' + fmt(m.nutrition.protein)),
      h('span', { class: 'pill f' }, 'Ж ' + fmt(m.nutrition.fat)),
      h('span', { class: 'pill c' }, 'У ' + fmt(m.nutrition.carbs))));
    panel.appendChild(h('div', { class: 'muted small' }, 'Порция: ' + fmt(m.nutrition.portion_g) + ' г'));
    if (m.comment) panel.appendChild(h('div', { class: 'comment', style: 'margin-top:8px' }, '💬 ' + m.comment));
    try {
      const d = await GET('/dishes/' + m.dish_id);
      panel.appendChild(h('div', { class: 'divider' }));
      panel.appendChild(h('div', { class: 'muted small', style: 'margin-bottom:6px' }, 'Состав'));
      for (const ing of d.ingredients) {
        panel.appendChild(h('div', { class: 'row-between small', style: 'padding:3px 0' },
          h('span', {}, ing.name), h('span', { class: 'muted' }, fmt(ing.grams) + ' г')));
      }
      if (d.instructions) { panel.appendChild(h('div', { class: 'divider' })); panel.appendChild(h('div', {}, d.instructions)); }
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
        h('button', { class: 'btn secondary small', onclick: () => addWeightSheet() }, '+ Замер')),
      p.current_weight ? h('div', { style: 'font-size:22px;font-weight:800;color:var(--green-dark);margin:6px 0' }, fmt(p.current_weight) + ' кг') : h('div', { class: 'muted small' }, 'Нет замеров'),
      weightChart(p.weight_series)),
    weightTable(p.weight_series)
  );
  render(shell('progress', content, { topbar: 'Прогресс' }));
});

function complianceRing(pct) {
  const p = pct == null ? 0 : pct;
  const r = 40, c = 2 * Math.PI * r;
  const off = c * (1 - p / 100);
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 96 96'); svg.setAttribute('class', 'ring');
  svg.innerHTML = `
    <circle cx="48" cy="48" r="${r}" fill="none" stroke="#e7f4ec" stroke-width="10"/>
    <circle cx="48" cy="48" r="${r}" fill="none" stroke="#228b57" stroke-width="10"
      stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${off}"
      transform="rotate(-90 48 48)"/>
    <text x="48" y="55" text-anchor="middle" class="num">${pct == null ? '—' : p + '%'}</text>`;
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
  const dots = series.map((s, i) => `<circle cx="${x(i)}" cy="${y(s.weight_kg)}" r="3.5" fill="#228b57"/>`).join('');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.innerHTML = `
    <polyline points="${pts}" fill="none" stroke="#228b57" stroke-width="2.5" stroke-linejoin="round"/>
    ${dots}
    <text x="${pad}" y="14" font-size="11" fill="#6b7785">${fmt(max)} кг</text>
    <text x="${pad}" y="${H - 4}" font-size="11" fill="#6b7785">${fmt(min)} кг</text>`;
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
