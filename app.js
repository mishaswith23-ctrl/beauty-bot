'use strict';

const query = new URLSearchParams(location.search);
const demo = query.get('demo');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const API_URL = String(window.BEAUTY_API_URL || '').replace(/\/+$/, '');

const stage = document.getElementById('stage');
const tabs = document.getElementById('tabs');

const state = {
  boot: null,
  bootAt: 0,
  stack: [],
  current: null,
  tab: null,
  draft: null,
  masterDate: null,
};

// Слова, которые у мастера и у бани разные. Вид заведения называет сервер (boot.kind).
const WORDS = {
  beauty: {
    tabBook: 'Запись',
    tabMine: 'Мои записи',
    eyebrow: 'Онлайн-запись',
    pick: 'Выберите услугу',
    noServices: ['Услуги скоро появятся', 'Мастер ещё заполняет список.'],
    noSlots: 'Загляните позже или свяжитесь с мастером.',
    askOnce: 'Спрошу один раз. Телефон увидит только мастер.',
    consent: 'Согласен(на) на обработку имени и телефона для записи к мастеру',
    consentNeeded: 'Отметьте согласие — без него запись не сохранится',
    review: 'Проверьте запись',
    yours: 'Ваша запись',
    confirm: 'Подтвердить запись',
    remindBoth: 'Напомню накануне и за 2 часа — в чате с ботом.',
    remind2: 'Напомню за 2 часа до визита — в чате с ботом.',
    remindNone: 'Время и адрес — в «Моих записях».',
    done: 'Вы записаны!',
    mineEmpty: 'Выберите услугу — это займёт минуту.',
    book: 'Записаться',
    cancelTitle: 'Отменить запись?',
    cancelText: 'Время освободится, а мастер получит уведомление.',
    cancelled: 'Запись отменена',
    about: 'Мастер',
    staffLogin: 'Вход для мастера',
    loginHint: 'Кабинет откроется на этом аккаунте Telegram, сюда же будут приходить новые записи.',
    cabinet: 'Кабинет мастера',
    count: ['запись', 'записи', 'записей'],
    dayOff: 'Отдыхайте — записей в этот день нет.',
    dayFree: 'Записей пока нет.',
    staffCancelText: 'Клиент получит уведомление с предложением выбрать другое время.',
    staffCancelled: 'Запись отменена, клиент предупреждён',
    reopened: 'Время снова открыто для записи',
    blockHint: 'Клиенты не смогут записаться на этот промежуток.',
    logoutText: 'Кабинет и уведомления о записях пропадут с этого аккаунта. Вернуться можно по логину и паролю: команда /login в боте.',
  },
  sauna: {
    tabBook: 'Бронь',
    tabMine: 'Мои брони',
    eyebrow: 'Онлайн-бронирование',
    pick: 'Что бронируем?',
    noServices: ['Скоро здесь появится выбор', 'Список ещё заполняется.'],
    noSlots: 'Загляните позже или позвоните нам.',
    askOnce: 'Спросим один раз. Телефон увидит только администратор.',
    consent: 'Согласен(на) на обработку имени и телефона для бронирования',
    consentNeeded: 'Отметьте согласие — без него бронь не сохранится',
    review: 'Проверьте бронь',
    yours: 'Ваша бронь',
    confirm: 'Забронировать',
    remindBoth: 'Напомним накануне и за 2 часа — в чате с ботом.',
    remind2: 'Напомним за 2 часа до визита — в чате с ботом.',
    remindNone: 'Время и адрес — в «Моих бронях».',
    done: 'Забронировано!',
    mineEmpty: 'Выберите время — это займёт минуту.',
    book: 'Забронировать',
    cancelTitle: 'Отменить бронь?',
    cancelText: 'Время освободится, а администратор получит уведомление.',
    cancelled: 'Бронь отменена',
    about: 'О нас',
    staffLogin: 'Вход для администратора',
    loginHint: 'Кабинет откроется на этом аккаунте Telegram, сюда же будут приходить новые брони.',
    cabinet: 'Кабинет администратора',
    count: ['бронь', 'брони', 'броней'],
    dayOff: 'В этот день мы закрыты.',
    dayFree: 'Броней пока нет.',
    staffCancelText: 'Гость получит уведомление с предложением выбрать другое время.',
    staffCancelled: 'Бронь отменена, гость предупреждён',
    reopened: 'Время снова открыто для брони',
    blockHint: 'Гости не смогут забронировать этот промежуток.',
    logoutText: 'Кабинет и уведомления о бронях пропадут с этого аккаунта. Вернуться можно по логину и паролю: команда /login в боте.',
  },
};
let words = WORDS.beauty;

// Telegram

const sdk = () => window.Telegram && window.Telegram.WebApp;
// Своя кнопка «Назад» нужна, только если нет кнопки Telegram
const nativeBack = () => !!(sdk() && sdk().initData);

// Подпись берём у скрипта Telegram, а если он не загрузился — из адреса, куда её кладёт сам Telegram
function initData() {
  const fromSdk = sdk() && sdk().initData;
  if (fromSdk) return fromSdk;
  return new URLSearchParams(location.hash.slice(1)).get('tgWebAppData') || '';
}

function waitForTelegram(ms) {
  return new Promise(resolve => {
    const script = document.getElementById('tg-sdk');
    if (sdk() || !script || script.dataset.failed) return resolve();
    script.addEventListener('load', resolve);
    script.addEventListener('error', resolve);
    setTimeout(resolve, ms);
  });
}

function haptic(kind) {
  const feedback = nativeBack() && sdk().HapticFeedback;
  if (!feedback) return;
  if (kind === 'select') feedback.selectionChanged();
  else if (kind === 'success' || kind === 'error') feedback.notificationOccurred(kind);
  else feedback.impactOccurred('light');
}

// Построение DOM: текст всегда идёт через text-узлы, поэтому имена клиентов не могут стать разметкой

function h(tag, props, ...kids) {
  const [name, ...classes] = tag.split('.');
  const el = document.createElement(name || 'div');
  if (classes.length) el.className = classes.join(' ');
  const isProps = props && typeof props === 'object' && !(props instanceof Node) && !Array.isArray(props);
  if (isProps) {
    for (const [key, value] of Object.entries(props)) {
      if (value === undefined || value === null || value === false) continue;
      if (key.startsWith('on')) el.addEventListener(key.slice(2), value);
      // Дописываем, а не заменяем: порядок style и i в объекте не важен
      else if (key === 'style') el.style.cssText += `;${value}`;
      else if (key === 'i') el.style.setProperty('--i', value);
      else if (key === 'vars') for (const [name, v] of Object.entries(value)) el.style.setProperty(name, v);
      else if (key in el && key !== 'list') el[key] = value;
      else el.setAttribute(key, value);
    }
  } else if (props !== undefined) {
    kids.unshift(props);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid !== null && kid !== undefined && kid !== false) el.append(kid);
  }
  return el;
}

const ICONS = {
  back: '<path d="M15 5l-7 7 7 7"/>',
  arrow: '<path d="M9 5l7 7-7 7"/>',
  spark: '<path d="M12 3l1.9 5.6 5.6 1.9-5.6 1.9L12 18l-1.9-5.6-5.6-1.9 5.6-1.9z"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="4.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  pin: '<path d="M12 21s7-6.1 7-11.5A7 7 0 0 0 5 9.5C5 14.9 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  phone: '<path d="M6.5 3.5h3l1.5 5-2.2 1.6a12 12 0 0 0 5.1 5.1l1.6-2.2 5 1.5v3a2 2 0 0 1-2.2 2A17 17 0 0 1 4.5 5.7a2 2 0 0 1 2-2.2z"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5c1-4 4-5.5 7.5-5.5s6.5 1.5 7.5 5.5"/>',
  list: '<path d="M9 6.5h11M9 12h11M9 17.5h11"/><circle cx="4.8" cy="6.5" r="1"/><circle cx="4.8" cy="12" r="1"/><circle cx="4.8" cy="17.5" r="1"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  lock: '<rect x="5" y="11" width="14" height="9.5" rx="3"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  chart: '<path d="M5 20V11M12 20V4M19 20v-6"/>',
  alert: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5V13M12 16.5h.01"/>',
  polish: '<path d="M10 2.5h4v5h-4z"/><path d="M8.5 7.5h7A2.5 2.5 0 0 1 18 10v8.5a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3V10a2.5 2.5 0 0 1 2.5-2.5z"/><path d="M9.5 14h5"/>',
  lotus: '<path d="M12 20c-4.5 0-8-2.6-8.5-6.5 2.4-.2 4.6.5 6.2 2C9 12 10 8.7 12 6c2 2.7 3 6 2.3 9.5 1.6-1.5 3.8-2.2 6.2-2C20 17.4 16.5 20 12 20z"/><path d="M12 20v-4.5"/>',
  drop: '<path d="M12 3.2s6 6.3 6 10.6a6 6 0 0 1-12 0C6 9.5 12 3.2 12 3.2z"/><path d="M9.2 14.6a2.9 2.9 0 0 0 2.6 2.7"/>',
  lash: '<path d="M2.5 12.5s3.5-5 9.5-5 9.5 5 9.5 5-3.5 5-9.5 5-9.5-5-9.5-5z"/><circle cx="12" cy="12.5" r="2.6"/><path d="M12 4.5v2M6.8 5.8l1 1.7M17.2 5.8l-1 1.7"/>',
  sparkle: '<path d="M12 3l1.9 5.6 5.6 1.9-5.6 1.9L12 18l-1.9-5.6-5.6-1.9 5.6-1.9z"/><path d="M19 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/>',
  steam: '<path d="M7.5 19c-1.6-1.8 1.6-3.7 0-5.5s1.6-3.7 0-5.5"/><path d="M12 20.5c-1.6-1.8 1.6-3.7 0-5.5s1.6-3.7 0-5.5 1.6-3.7 0-5.5"/><path d="M16.5 19c-1.6-1.8 1.6-3.7 0-5.5s1.6-3.7 0-5.5"/>',
  flame: '<path d="M12 21c-3.6 0-6-2.5-6-5.8 0-3.2 2.2-5.1 3.4-7.4.5 1.6 1.4 2.6 2.4 3.1-.3-3 1-6 3.2-7.9.4 2.9 1.4 4.4 2.6 6.1A7.6 7.6 0 0 1 18 15.2C18 18.5 15.6 21 12 21z"/><path d="M12 21c-1.5 0-2.6-1.1-2.6-2.6 0-1.7 1.3-2.6 2.1-3.9.9 1.3 3.1 2.2 3.1 3.9 0 1.5-1.1 2.6-2.6 2.6z"/>',
  leaf: '<path d="M5 19c0-8 5-13.5 14-14 0 9-5.5 14-14 14z"/><path d="M5 19c3-3.5 6-6.5 9.5-9"/>',
  snow: '<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9"/><path d="M9.5 4.5L12 7l2.5-2.5M9.5 19.5L12 17l2.5 2.5"/>',
  cup: '<path d="M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z"/><path d="M16 10.5h1.5a2.5 2.5 0 0 1 0 5H16"/><path d="M8.5 3.5c-.8 1 .8 1.6 0 2.6M12 3.5c-.8 1 .8 1.6 0 2.6"/>',
  sunrise: '<path d="M3.5 18.5h17M7 18.5a5 5 0 0 1 10 0"/><path d="M12 6v3M5.6 9.6l1.8 1.8M18.4 9.6l-1.8 1.8"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6L7 7M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/>',
  moon: '<path d="M19.5 14.6A7.5 7.5 0 0 1 9.4 4.5a7.5 7.5 0 1 0 10.1 10.1z"/>',
};
const SERVICE_ICONS = ['polish', 'lotus', 'drop', 'lash', 'sparkle', 'steam', 'flame', 'leaf', 'snow', 'cup'];

function icon(name, size = 22) {
  const span = document.createElement('span');
  span.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.spark}</svg>`;
  return span.firstChild;
}

const serviceIcon = name => (SERVICE_ICONS.includes(name) ? name : 'sparkle');
const rub = n => `${Number(n).toLocaleString('ru-RU')} ₽`;

function plural(n, one, few, many) {
  const tens = n % 100;
  const units = n % 10;
  if (tens >= 11 && tens <= 14) return many;
  if (units === 1) return one;
  if (units >= 2 && units <= 4) return few;
  return many;
}

// «45 мин», «1 час», «2 часа», «1 ч 30 мин»
function duration(minutes) {
  if (minutes < 60) return `${minutes} мин`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} ч ${rest} мин` : `${hours} ${plural(hours, 'час', 'часа', 'часов')}`;
}

// Длительность, если её нет в названии: «Баня на 2 часа» и так говорит, сколько это
const durationNote = service => {
  const text = duration(service.duration_min);
  return service.name.includes(text) ? null : text;
};

function countdown(daysLeft) {
  if (daysLeft <= 0) return 'Сегодня';
  if (daysLeft === 1) return 'Завтра';
  return `Через ${daysLeft} ${plural(daysLeft, 'день', 'дня', 'дней')}`;
}

let toastTimer;
function toast(text, kind = 'ok') {
  const el = document.getElementById('toast');
  el.className = kind;
  el.replaceChildren(icon(kind === 'error' ? 'alert' : 'check', 20), h('span', text));
  clearTimeout(toastTimer);
  // Таймер — только после показа: в свёрнутом приложении кадр приходит позже, и тост остался бы на экране
  requestAnimationFrame(() => {
    el.classList.add('show');
    toastTimer = setTimeout(() => el.classList.remove('show'), 3800);
  });
}

async function api(path, { method = 'GET', body } = {}) {
  if (!API_URL || API_URL.includes('PROJECT_REF')) {
    throw Object.assign(new Error('Приложение ещё не подключено к серверу: впишите адрес функции в config.js.'), { status: 0 });
  }
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (demo) headers['X-Demo-User'] = demo;
  else headers['X-Telegram-Init-Data'] = initData();
  let response;
  try {
    response = await fetch(`${API_URL}/${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw Object.assign(new Error('Нет связи. Проверьте интернет и попробуйте ещё раз.'), { status: 0 });
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data.error || 'Что-то пошло не так'), { status: response.status });
  return data;
}

async function refreshBoot(maxAgeMs) {
  if (state.boot && Date.now() - state.bootAt < maxAgeMs) return state.boot;
  state.boot = await api('bootstrap');
  state.bootAt = Date.now();
  return state.boot;
}

// Наклон карточки за пальцем или курсором

function tilt(el) {
  el.classList.add('tilt');
  if (reducedMotion) return el;
  const move = event => {
    const box = el.getBoundingClientRect();
    const x = (event.clientX - box.left) / box.width;
    const y = (event.clientY - box.top) / box.height;
    el.style.setProperty('--rx', `${(0.5 - y) * 6}deg`);
    el.style.setProperty('--ry', `${(x - 0.5) * 6}deg`);
    el.style.setProperty('--gx', `${x * 100}%`);
    el.style.setProperty('--gy', `${y * 100}%`);
    el.style.setProperty('--glare', 1);
  };
  const reset = () => ['--rx', '--ry', '--glare'].forEach(name => el.style.removeProperty(name));
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerdown', move);
  el.addEventListener('pointerleave', reset);
  el.addEventListener('pointerup', reset);
  el.addEventListener('pointercancel', reset);
  return el;
}

// Навигация с объёмным переходом между экранами

const EASE = 'cubic-bezier(.22,.9,.24,1)';
const MOTION = {
  forward: {
    out: [{ transform: 'none', opacity: 1 }, { transform: 'translate3d(-18%,0,-150px) rotateY(9deg)', opacity: 0 }],
    in: [{ transform: 'translate3d(28%,0,-150px) rotateY(-12deg)', opacity: 0 }, { transform: 'none', opacity: 1 }],
  },
  back: {
    out: [{ transform: 'none', opacity: 1 }, { transform: 'translate3d(28%,0,-150px) rotateY(-12deg)', opacity: 0 }],
    in: [{ transform: 'translate3d(-18%,0,-150px) rotateY(9deg)', opacity: 0 }, { transform: 'none', opacity: 1 }],
  },
  tab: {
    out: [{ transform: 'none', opacity: 1 }, { transform: 'translateZ(-80px)', opacity: 0 }],
    in: [{ transform: 'translateZ(60px)', opacity: 0 }, { transform: 'none', opacity: 1 }],
  },
};

function swapScreen(next, direction) {
  const previous = [...stage.children];
  stage.append(next);
  if (reducedMotion || !previous.length) {
    previous.forEach(el => el.remove());
    return;
  }
  const motion = MOTION[direction];
  previous.forEach(el => {
    el.style.pointerEvents = 'none';
    el.animate(motion.out, { duration: 320, easing: 'ease-in', fill: 'forwards' }).finished
      .then(() => el.remove(), () => el.remove());
  });
  next.animate(motion.in, { duration: 560, easing: EASE });
}

function skeleton() {
  return h('.inner', h('.skeleton', { style: 'height:170px' }), h('.skeleton'), h('.skeleton'));
}

async function show(route, direction) {
  state.current = route;
  document.body.classList.toggle('flow', state.stack.length > 0);
  syncBackButton();
  renderTabs();
  const screen = h('section.screen', skeleton());
  swapScreen(screen, direction);
  await fill(screen, route);
}

async function fill(screen, route) {
  try {
    const content = await SCREENS[route.name](route.params || {}, screen);
    if (state.current === route) screen.replaceChildren(h('.inner', content));
  } catch (error) {
    if (state.current !== route) return;
    screen.replaceChildren(h('.inner', h('.card.empty.rise',
      h('.empty-icon', icon('alert', 26)),
      h('p', error.message),
      h('button.btn.ghost', { style: 'margin-top:18px', onclick: () => fill(screen, route) }, 'Повторить'),
    )));
  }
}

function push(name, params) {
  state.stack.push(state.current);
  haptic();
  show({ name, params }, 'forward');
}

function back() {
  if (!state.stack.length) return;
  haptic();
  show(state.stack.pop(), 'back');
}

function resetTo(name) {
  state.stack = [];
  state.tab = name;
  haptic('select');
  show({ name }, 'tab');
}

// Обновляет открытый экран без анимации: после изменений и при возвращении в приложение
function softRefresh() {
  const route = state.current;
  if (!route || !['mine', 'schedule', 'home'].includes(route.name)) return;
  state.bootAt = 0;
  const screen = stage.lastElementChild;
  const top = screen.scrollTop;
  screen.classList.add('quiet');
  fill(screen, route).then(() => { screen.scrollTop = top; });
}

function syncBackButton() {
  if (!nativeBack()) return;
  if (state.stack.length) sdk().BackButton.show();
  else sdk().BackButton.hide();
}

function topbar(title) {
  return h('.topbar.rise', { i: 0 },
    nativeBack() ? null : h('button.back', { onclick: back, 'aria-label': 'Назад' }, icon('back', 20)),
    h('h1.title', title),
  );
}

// Полоска шагов записи: «Время → Контакты → Проверка»
function stepper(name) {
  const steps = state.boot.client ? ['Время', 'Проверка'] : ['Время', 'Контакты', 'Проверка'];
  const index = name === 'datetime' ? 0 : name === 'contact' ? 1 : steps.length - 1;
  return h('.rise', { i: 0 },
    h('.stepper', steps.map((_, i) => h(`i${i < index ? '.done' : i === index ? '.now' : ''}`))),
    h('.step-label', `Шаг ${index + 1} из ${steps.length} · ${steps[index]}`),
  );
}

const tabGlow = h('.tab-glow');

function renderTabs() {
  const items = [
    ['home', words.tabBook, 'spark'],
    ['mine', words.tabMine, 'list'],
    ['about', 'Контакты', 'pin'],
  ];
  if (state.boot.is_master) items.unshift(['schedule', 'Кабинет', 'chart']);
  const index = items.findIndex(([name]) => name === state.tab);
  // Подсветка остаётся тем же элементом, поэтому плавно переезжает к новой вкладке
  if (tabGlow.parentNode !== tabs) tabs.prepend(tabGlow);
  while (tabs.lastChild && tabs.lastChild !== tabGlow) tabs.lastChild.remove();
  tabs.style.setProperty('--count', items.length);
  tabs.style.setProperty('--index', Math.max(index, 0));
  tabGlow.style.opacity = index < 0 ? 0 : 1;
  tabs.append(...items.map(([name, label, glyph]) =>
    h(`button.tab${state.tab === name ? '.active' : ''}`, {
      onclick: () => { if (state.tab !== name || state.stack.length) resetTo(name); },
    }, icon(glyph), label)));
}

// Шторка снизу

function openSheet(build) {
  return new Promise(resolve => {
    const close = value => {
      document.removeEventListener('keydown', onKey);
      overlay.classList.add('closing');
      setTimeout(() => overlay.remove(), 250);
      resolve(value);
    };
    const onKey = event => { if (event.key === 'Escape') close(null); };
    const sheet = h('.sheet', { role: 'dialog', 'aria-modal': 'true' });
    const overlay = h('.overlay', { onclick: event => { if (event.target === overlay) close(null); } }, sheet);
    sheet.append(...[build(close)].flat());
    document.addEventListener('keydown', onKey);
    document.body.append(overlay);
  });
}

function confirmSheet({ title, text, confirm, danger }) {
  return openSheet(close => [
    h('h2', title),
    h('p', text),
    h('.sheet-actions',
      h(`button.btn${danger ? '.danger' : ''}`, { onclick: () => close(true) }, confirm),
      h('button.btn.ghost', { onclick: () => close(false) }, 'Назад'),
    ),
  ]);
}

function emptyState(glyph, title, text, ...extra) {
  return h('.card.empty.rise', { i: 1 },
    h('.empty-icon', icon(glyph, 26)),
    h('.empty-title', title),
    text && h('p', text),
    extra,
  );
}

// Лента дней: общая для клиента и мастера

function dayStrip(days, selected, onPick, extra) {
  const strip = h('.days.rise', { i: 1 }, days.map(day => {
    const info = extra(day);
    return h(`button.day${day.date === selected ? '.active' : ''}`, {
      disabled: info.disabled,
      onclick: click => {
        strip.querySelectorAll('.day').forEach(el => el.classList.toggle('active', el === click.currentTarget));
        haptic('select');
        onPick(day);
      },
    },
      h('span.day-week', day.today ? 'Сегодня' : day.tomorrow ? 'Завтра' : day.weekday),
      h('span.day-num', String(day.day)),
      h('span.day-month', day.month),
      info.count ? h('span.day-count', String(info.count)) : h(`span.day-dot${info.dot ? '.on' : ''}`),
    );
  }));
  requestAnimationFrame(() => {
    const active = strip.querySelector('.active');
    if (active) strip.scrollLeft = active.offsetLeft - strip.clientWidth / 2 + active.clientWidth / 2;
  });
  return strip;
}

const PARTS = [['morning', 'Утро', 'sunrise'], ['day', 'День', 'sun'], ['evening', 'Вечер', 'moon']];

// Только части дня, где есть время: пустые не попадают в replaceChildren, иначе там напишется «null»
function slotGroups(slots, selectedTs, onPick) {
  let index = 0;
  return PARTS.filter(([part]) => slots.some(slot => slot.part === part)).map(([part, label, glyph]) => {
    const group = slots.filter(slot => slot.part === part);
    return h('.part',
      h('.part-head', icon(glyph, 18), label),
      h('.slots', group.map(slot => {
        const button = h(`button.slot.pop${slot.ts === selectedTs ? '.active' : ''}`, {
          i: index++,
          onclick: () => onPick(slot, button),
        }, slot.label);
        return button;
      })),
    );
  });
}

const SCREENS = {
  // Клиент: главная и услуги

  async home() {
    const boot = await refreshBoot(20000);
    const { master } = boot;
    const next = boot.upcoming[0];
    return [
      tilt(h('.card.hero.resting.rise', { i: 0 },
        h('.hero-top',
          h('.avatar', master.name.slice(0, 1)),
          h('div', h('.eyebrow', words.eyebrow), h('h1.title', master.name)),
        ),
        h('p.lead', master.about),
      )),
      next && h('.rise', { i: 1, style: 'margin-top:12px' }, tilt(h('button.card.next-card', { onclick: () => resetTo('mine') },
        h('.next-head', h('span.pill', countdown(next.days_left)), icon('arrow', 18)),
        h('.next-title', next.service_name),
        h('.next-when', icon('calendar', 18), next.when),
      ))),
      h('h2.section.rise', { i: 2 }, words.pick),
      boot.services.length
        ? h('.stack', boot.services.map((service, index) => tilt(h('button.card.service.rise', {
            i: index + 3,
            onclick: () => startBooking(service),
          },
            h(`.plate.tint-${serviceIcon(service.icon)}`, icon(serviceIcon(service.icon), 24)),
            h('div',
              h('.service-name', service.name),
              durationNote(service) && h('.service-meta', durationNote(service)),
            ),
            h('.price', rub(service.price)),
            service.next_slot
              ? h('span.chip', icon('clock', 15), 'Ближайшее: ', h('b', service.next_slot))
              : h('span.chip', 'Свободных окон пока нет'),
          ))))
        : emptyState('spark', ...words.noServices),
    ];
  },

  // Клиент: день и время

  async datetime() {
    const draft = state.draft;
    const { service } = draft;
    const data = await api(`services/${service.id}/days${draft.date ? `?date=${draft.date}` : ''}`);
    if (!data.selected) {
      return [
        topbar(service.name),
        stepper('datetime'),
        emptyState('calendar', 'Свободных окон нет', words.noSlots),
      ];
    }

    const slotBox = h('div');
    const hint = h('.hint', 'Выберите время');
    const continueBtn = h('button.btn', { disabled: true, onclick: () => push(state.boot.client ? 'review' : 'contact') }, 'Продолжить');
    const labelOf = day => (day.today ? 'Сегодня' : day.tomorrow ? 'Завтра' : `${day.weekday}, ${day.day} ${day.month}`);

    const pickSlot = (slot, button) => {
      slotBox.querySelectorAll('.slot').forEach(el => el.classList.remove('active'));
      button.classList.add('active');
      draft.ts = slot.ts;
      draft.time = slot.label;
      continueBtn.disabled = false;
      hint.textContent = `${draft.dayLabel}, ${slot.label}`;
      haptic('select');
    };

    const renderSlots = slots => {
      const keep = slots.find(slot => slot.ts === draft.ts);
      if (!keep) draft.ts = null;
      continueBtn.disabled = !keep;
      hint.textContent = keep ? `${draft.dayLabel}, ${keep.label}` : 'Выберите время';
      slotBox.replaceChildren(...(slots.length
        ? slotGroups(slots, draft.ts, pickSlot)
        : [emptyState('calendar', 'На этот день всё занято', 'Выберите другой день.')]));
    };

    const loadDay = async day => {
      draft.date = day.date;
      draft.dayLabel = labelOf(day);
      draft.ts = null;
      renderSlots([]);
      slotBox.replaceChildren(h('.skeleton', { style: 'height:120px' }));
      try {
        const { slots } = await api(`services/${service.id}/slots?date=${day.date}`);
        if (draft.date === day.date) renderSlots(slots);
      } catch (error) {
        toast(error.message, 'error');
      }
    };

    const selected = data.days.find(day => day.date === data.selected);
    draft.date = selected.date;
    draft.dayLabel = labelOf(selected);
    renderSlots(data.slots);

    return [
      topbar(service.name),
      stepper('datetime'),
      h('p.muted.rise', { i: 1 }, [durationNote(service), rub(service.price)].filter(Boolean).join(' · ')),
      dayStrip(data.days, data.selected, loadDay, day => ({ disabled: day.slots === 0, dot: day.slots > 0 })),
      h('.rise', { i: 2 }, slotBox),
      h('.cta', h('.inner', hint, continueBtn)),
    ];
  },

  // Клиент: контакты при первой записи

  async contact() {
    const draft = state.draft;
    const name = h('input', { type: 'text', autocomplete: 'given-name', maxLength: 60, value: draft.name || state.boot.first_name || '' });
    const phone = h('input', { type: 'tel', autocomplete: 'tel', inputMode: 'tel', placeholder: '+7 900 123-45-67', value: draft.phone || '' });
    const consent = h('input', { type: 'checkbox', checked: !!draft.consent });
    const submit = () => {
      if (!name.value.trim()) return toast('Напишите, как к вам обращаться', 'error');
      // Как на сервере: от 10 цифр, а номер с кодом 7 — ровно 11
      const digits = phone.value.replace(/\D/g, '');
      if (digits.length < 10 || (digits[0] === '7' && digits.length !== 11)) return toast('Проверьте номер телефона', 'error');
      if (!consent.checked) return toast(words.consentNeeded, 'error');
      Object.assign(draft, { name: name.value.trim(), phone: phone.value.trim(), consent: true });
      push('review');
    };
    return [
      topbar('Ваши контакты'),
      stepper('contact'),
      h('p.muted.rise', { i: 1, style: 'margin-bottom:16px' }, words.askOnce),
      h('.card.rise', { i: 2 },
        h('label.field', h('span', 'Имя'), name),
        h('label.field', h('span', 'Телефон'), phone),
        h('label.consent', consent, h('span', words.consent)),
      ),
      h('.cta', h('.inner', h('button.btn', { onclick: submit }, 'Продолжить'))),
    ];
  },

  // Клиент: проверка и подтверждение

  async review() {
    const draft = state.draft;
    const { service, dayLabel, time, ts } = draft;
    const client = state.boot.client || { name: draft.name, phone: draft.phone };
    const confirm = h('button.btn', {
      onclick: async () => {
        confirm.disabled = true;
        const body = { service_id: service.id, start_ts: ts };
        if (!state.boot.client) Object.assign(body, { name: draft.name, phone: draft.phone, consent: draft.consent });
        let booking;
        try {
          booking = await api('bookings', { method: 'POST', body });
        } catch (error) {
          confirm.disabled = false;
          haptic('error');
          toast(error.message, 'error');
          if (error.status === 409) {
            // Время заняли: возвращаемся к выбору, там уже будет свежий список
            draft.ts = null;
            while (state.stack.length && state.current.name !== 'datetime') state.current = state.stack.pop();
            show(state.current, 'back');
          } else if (error.status === 400 && !state.boot.client) {
            back();
          }
          return;
        }
        haptic('success');
        // Запись уже создана; если обновить данные не вышло, обновим их позже
        state.bootAt = 0;
        await refreshBoot(0).catch(() => {});
        state.stack = [];
        state.tab = 'home';
        show({ name: 'success', params: { booking } }, 'forward');
      },
    }, words.confirm);
    return [
      topbar(words.review),
      stepper('review'),
      h('.ticket-wrap', h('.card.ticket.floating',
        h('.eyebrow', words.yours),
        h('.ticket-name', service.name),
        h('.row', icon('calendar'), h('span', `${dayLabel}, ${time}`)),
        durationNote(service) && h('.row', icon('clock'), h('span', durationNote(service))),
        h('.row', icon('pin'), h('span', state.boot.master.address)),
        h('.row', icon('user'), h('span', `${client.name}, ${client.phone}`)),
        h('.ticket-foot', h('span', 'Стоимость'), h('span.price', rub(service.price))),
      )),
      h('.cta', h('.inner', confirm)),
    ];
  },

  async success({ booking }) {
    document.body.classList.add('flow');
    // Цвета искр — из темы в style.css
    const colors = getComputedStyle(document.documentElement).getPropertyValue('--sparks').trim().split(/\s+/);
    // Напоминания, чьё время уже прошло, сервер не шлёт — обещаем только те, что придут
    const hoursLeft = (booking.ts * 1000 - Date.now()) / 3_600_000;
    const reminders = hoursLeft > 24 ? words.remindBoth : hoursLeft > 2 ? words.remind2 : words.remindNone;
    return [
      h('.done-mark',
        h('.check', icon('check', 36)),
        Array.from({ length: 14 }, (_, i) => h('i.spark', {
          vars: { '--a': `${i * (360 / 14)}deg`, '--d': `${58 + (i % 3) * 16}px`, '--delay': `${280 + (i % 4) * 40}ms`, '--spark': colors[i % colors.length] },
        })),
      ),
      h('h1.title.center.rise', { i: 1 }, words.done),
      h('p.lead.center.rise', { i: 2, style: 'margin-bottom:22px' }, reminders),
      h('.ticket-wrap', h('.card.ticket.floating',
        h('.eyebrow', 'До встречи'),
        h('.ticket-name', booking.service_name),
        h('.row', icon('calendar'), h('span', booking.when)),
        h('.row', icon('pin'), h('span', state.boot.master.address)),
        h('.ticket-foot', h('span', 'Стоимость'), h('span.price', rub(booking.price))),
      )),
      h('.rise', { i: 4, style: 'margin-top:24px' },
        h('button.btn', { onclick: () => resetTo('mine') }, words.tabMine),
        nativeBack() && h('button.btn.link', { style: 'margin:8px auto 0;display:flex', onclick: () => sdk().close() }, 'Закрыть'),
      ),
    ];
  },

  // Клиент: мои записи

  async mine() {
    const bookings = await api('bookings');
    const title = h('h1.title.rise', { i: 0, style: 'margin-bottom:16px' }, words.tabMine);
    if (!bookings.length) {
      return [title, emptyState('calendar', 'Пока пусто', words.mineEmpty,
        h('button.btn', { style: 'margin-top:18px', onclick: () => resetTo('home') }, words.book))];
    }
    return [
      title,
      h('.stack', bookings.map((booking, index) => tilt(h('.card.rise', { i: index + 1 },
        h('.booking-head', h('span.pill', countdown(booking.days_left)), h('span.price', rub(booking.price))),
        h('.booking-when', { style: 'margin-top:12px' }, booking.when),
        h('.booking-name.muted', booking.service_name),
        h('.row.muted.small', icon('pin', 18), h('span', state.boot.master.address)),
        h('.booking-actions', h('button.btn.link.bad', {
          onclick: async () => {
            const yes = await confirmSheet({
              title: words.cancelTitle,
              text: `${booking.when} — ${booking.service_name}. ${words.cancelText}`,
              confirm: 'Да, отменить',
              danger: true,
            });
            if (!yes) return;
            try {
              await api(`bookings/${booking.id}/cancel`, { method: 'POST' });
              toast(words.cancelled);
            } catch (error) {
              toast(error.message, 'error');
            }
            softRefresh();
          },
        }, 'Отменить')),
      )))),
    ];
  },

  // Контакты мастера

  async about() {
    const { master } = state.boot;
    return [
      tilt(h('.card.hero.resting.rise', { i: 0 },
        h('.hero-top',
          h('.avatar', master.name.slice(0, 1)),
          h('div', h('.eyebrow', words.about), h('h1.title', master.name)),
        ),
        h('p.lead', master.about),
      )),
      h('.stack', { style: 'margin-top:12px' },
        h('.card.rise', { i: 1 },
          h('.row', icon('pin'), h('span', master.address)),
          h('a.row', { href: `tel:${master.phone.replace(/[^\d+]/g, '')}` }, icon('phone'), h('span', master.phone)),
        ),
        h('.card.rise', { i: 2 },
          h('.eyebrow', { style: 'margin-bottom:8px' }, 'График'),
          master.schedule.map(row => h('.row', { style: 'justify-content:space-between;padding:5px 0' },
            h(row.today ? 'b' : 'span', row.today ? `${row.day} · сегодня` : row.day),
            h(row.hours ? 'span' : 'span.muted', row.hours || 'выходной'),
          )),
        ),
      ),
      !state.boot.is_master && h('.rise', { i: 3, style: 'margin-top:10px' },
        h('button.btn.link', { style: 'margin:0 auto;display:flex', onclick: () => push('login') }, icon('lock', 18), words.staffLogin)),
    ];
  },

  // Вход в кабинет по логину и паролю
  async login() {
    const login = h('input', { type: 'text', autocomplete: 'username', autocapitalize: 'off', spellcheck: false, maxLength: 32 });
    const password = h('input', {
      type: 'password', autocomplete: 'current-password', maxLength: 72,
      onkeydown: event => { if (event.key === 'Enter') submit.click(); },
    });
    const submit = h('button.btn', {
      onclick: async () => {
        if (!login.value.trim() || !password.value) return toast('Введите логин и пароль', 'error');
        submit.disabled = true;
        try {
          await api('master/login', { method: 'POST', body: { login: login.value, password: password.value } });
        } catch (error) {
          submit.disabled = false;
          password.value = '';
          haptic('error');
          return toast(error.message, 'error');
        }
        haptic('success');
        await refreshBoot(0).catch(() => {});
        toast('Вы вошли в кабинет');
        resetTo('schedule');
      },
    }, 'Войти');
    return [
      topbar(words.staffLogin),
      h('p.muted.rise', { i: 1, style: 'margin-bottom:16px' },
        words.loginHint),
      h('.card.rise', { i: 2 },
        h('label.field', h('span', 'Логин'), login),
        h('label.field', h('span', 'Пароль'), password),
      ),
      h('.cta', h('.inner', submit)),
    ];
  },

  // Кабинет мастера

  async schedule() {
    let data;
    try {
      data = await api(`master/overview${state.masterDate ? `?date=${state.masterDate}` : ''}`);
    } catch (error) {
      if (error.status !== 403) throw error;
      // Кабинет открыли на другом аккаунте: убираем вкладку и уходим на главную
      await refreshBoot(0).catch(() => {});
      toast('Кабинет открыт на другом аккаунте', 'error');
      resetTo('home');
      return [];
    }
    state.masterDate = data.day.date;
    const dayBox = h('.stack', renderDay(data.day));

    const loadDay = async day => {
      state.masterDate = day.date;
      try {
        const result = await api(`master/day?date=${day.date}`);
        if (state.masterDate === day.date) dayBox.replaceChildren(...renderDay(result));
      } catch (error) {
        toast(error.message, 'error');
      }
    };

    const week = data.days.slice(0, 7);
    const peak = Math.max(1, ...week.map(day => day.count));
    return [
      h('.rise', { i: 0, style: 'margin-bottom:16px' }, h('.eyebrow', words.cabinet), h('h1.title', 'Расписание')),
      h('.stats',
        tilt(h('.card.resting.rise', { i: 0 },
          h('.stat-value', String(data.week.count)),
          h('.stat-label', `${plural(data.week.count, ...words.count)} за 7 дней`),
          h('.bars', week.map((day, i) => h(`.bar${day.today ? '.today' : ''}`,
            h('.bar-track', h('i', { i, style: `height:${day.count ? Math.max(14, (day.count / peak) * 100) : 8}%` })),
            h('span', day.weekday.slice(0, 1)),
          ))),
        )),
        tilt(h('.card.revenue.resting.rise', { i: 1 },
          h('.stat-label', 'Ожидаемая выручка'),
          h('.stat-value', rub(data.week.sum)),
          h('.stat-label', 'за неделю'),
        )),
      ),
      dayStrip(data.days, state.masterDate, loadDay, day => ({ count: day.count })),
      h('.rise', { i: 2 }, dayBox),
      h('.rise', { i: 3, style: 'margin-top:14px' },
        h('button.btn.ghost', { onclick: () => blockSheet(state.masterDate) }, icon('lock', 20), 'Закрыть время')),
      h('.rise', { i: 4, style: 'margin-top:10px' },
        h('button.btn.link', { style: 'margin:0 auto;display:flex', onclick: accessSheet }, icon('user', 18), 'Вход и пароль')),
    ];
  },
};

function renderDay(day) {
  const parts = [];
  const summary = day.count ? `${day.count} ${plural(day.count, ...words.count)} · ${rub(day.sum)}` : '';
  parts.push(h('.day-title', h('strong', day.label), h('span.muted.small', summary)));
  if (!day.bookings.length && !day.blocks.length) {
    parts.push(day.off
      ? emptyState('moon', 'Выходной', words.dayOff)
      : emptyState('sun', 'Свободный день', words.dayFree));
  }
  day.bookings.forEach((booking, index) => {
    parts.push(tilt(h('.card.pop', { i: index },
      h('.booking-head',
        h('span.timeline-time', booking.start, ' ', h('small', `– ${booking.end}`)),
        booking.past
          ? h('span.badge.past', 'Прошла')
          : booking.confirmed && h('span.badge', icon('check', 14), 'Придёт'),
      ),
      h('.booking-name', `${booking.service_name} · ${rub(booking.price)}`),
      h('.muted', booking.client_name),
      h('a.client-link', { href: `tel:${booking.client_phone}` }, icon('phone', 18), booking.client_phone),
      !booking.past && h('.booking-actions', h('button.btn.link.bad', {
        onclick: async () => {
          const yes = await confirmSheet({
            title: words.cancelTitle,
            text: `${booking.start}, ${booking.client_name}. ${words.staffCancelText}`,
            confirm: 'Да, отменить',
            danger: true,
          });
          if (!yes) return;
          try {
            await api(`master/bookings/${booking.id}/cancel`, { method: 'POST' });
            toast(words.staffCancelled);
          } catch (error) {
            toast(error.message, 'error');
          }
          softRefresh();
        },
      }, 'Отменить')),
    )));
  });
  day.blocks.forEach(block => {
    parts.push(h('.card.block-card.pop',
      icon('lock', 20),
      h('span.grow', block.whole_day ? 'Весь день закрыт' : `Закрыто ${block.start}–${block.end}`),
      h('button.btn.link', {
        onclick: async () => {
          try {
            await api(`master/blocks/${block.id}`, { method: 'DELETE' });
            toast(words.reopened);
          } catch (error) {
            toast(error.message, 'error');
          }
          softRefresh();
        },
      }, 'Открыть'),
    ));
  });
  return parts;
}

function blockSheet(date) {
  const start = h('input', { type: 'time', value: '14:00', step: 300 });
  const end = h('input', { type: 'time', value: '16:00', step: 300 });
  const submit = async (close, body, button) => {
    button.disabled = true;
    try {
      await api('master/blocks', { method: 'POST', body: { date, ...body } });
      close();
      haptic('success');
      toast('Время закрыто');
      softRefresh();
    } catch (error) {
      button.disabled = false;
      haptic('error');
      toast(error.message, 'error');
    }
  };
  openSheet(close => {
    const part = h('button.btn', { onclick: () => submit(close, { start: start.value, end: end.value }, part) }, 'Закрыть промежуток');
    const whole = h('button.btn.ghost', { onclick: () => submit(close, {}, whole) }, 'Закрыть весь день');
    return [
      h('h2', 'Закрыть время'),
      h('p', words.blockHint),
      h('.two', { style: 'margin-top:18px' }, h('label.field', h('span', 'С'), start), h('label.field', h('span', 'До'), end)),
      h('.sheet-actions', part, whole),
    ];
  });
}

// Логин и пароль, с которыми кабинет открывается на любом аккаунте Telegram
async function accessSheet() {
  let access;
  try {
    access = await api('master/access');
  } catch (error) {
    return toast(error.message, 'error');
  }
  const hasPassword = !!access.login;
  const login = h('input', {
    type: 'text', autocomplete: 'username', autocapitalize: 'off', spellcheck: false, maxLength: 32, value: access.login || '',
  });
  const current = h('input', { type: 'password', autocomplete: 'current-password', maxLength: 72 });
  const password = h('input', { type: 'password', autocomplete: 'new-password', maxLength: 72 });
  openSheet(close => {
    const save = h('button.btn', {
      onclick: async () => {
        if (password.value.length < 8) return toast('Пароль — от 8 символов', 'error');
        save.disabled = true;
        try {
          await api('master/credentials', {
            method: 'POST',
            body: { login: login.value, password: password.value, current_password: current.value },
          });
        } catch (error) {
          save.disabled = false;
          haptic('error');
          return toast(error.message, 'error');
        }
        close();
        haptic('success');
        toast(hasPassword ? 'Пароль изменён' : 'Логин и пароль сохранены');
      },
    }, hasPassword ? 'Сменить пароль' : 'Сохранить');
    const logout = hasPassword && h('button.btn.link.bad', {
      style: 'margin:0 auto;display:flex',
      onclick: async () => {
        close();
        const yes = await confirmSheet({
          title: 'Выйти из кабинета?',
          text: words.logoutText,
          confirm: 'Выйти',
          danger: true,
        });
        if (!yes) return;
        try {
          await api('master/logout', { method: 'POST' });
        } catch (error) {
          return toast(error.message, 'error');
        }
        await refreshBoot(0).catch(() => {});
        toast('Вы вышли из кабинета');
        resetTo('home');
      },
    }, 'Выйти из кабинета');
    return [
      h('h2', 'Вход в кабинет'),
      h('p', hasPassword
        ? `С этим логином и паролем кабинет откроется на любом аккаунте Telegram: команда /login в боте или «Контакты» → «${words.staffLogin}».`
        : 'Задайте логин и пароль — с ними кабинет можно открыть на любом аккаунте Telegram через команду /login в боте.'),
      h('div', { style: 'margin-top:18px' },
        h('label.field', h('span', 'Логин'), login),
        hasPassword && h('label.field', h('span', 'Текущий пароль'), current),
        h('label.field', h('span', hasPassword ? 'Новый пароль' : 'Пароль, от 8 символов'), password),
      ),
      h('.sheet-actions', save, logout),
    ];
  });
}

// Слова и цвета под вид заведения; шапку Telegram красим в цвет фона темы
function applyKind(kind) {
  const known = Object.hasOwn(WORDS, kind) ? kind : 'beauty';
  words = WORDS[known];
  document.documentElement.dataset.kind = known;
  const tg = nativeBack() ? sdk() : null;
  if (!tg) return;
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  try {
    tg.setHeaderColor(bg);
    tg.setBackgroundColor(bg);
  } catch {
    // старые версии Telegram не умеют красить шапку — это не мешает работе
  }
}

function startBooking(service) {
  state.draft = { service };
  push('datetime');
}

async function main() {
  await waitForTelegram(3000);
  // Вне Telegram (браузер, демо) скрипт есть, но кнопки и цвета ему недоступны
  const tg = nativeBack() ? sdk() : null;
  if (tg) {
    tg.ready();
    tg.expand();
    try {
      tg.setHeaderColor('#110e13');
      tg.setBackgroundColor('#110e13');
      if (tg.disableVerticalSwipes) tg.disableVerticalSwipes();
    } catch {
      // старые версии Telegram не умеют красить шапку — это не мешает работе
    }
    tg.BackButton.onClick(back);
    tg.onEvent('activated', softRefresh);
  }
  if (demo) window.addEventListener('message', event => { if (event.data === 'refresh') softRefresh(); });

  try {
    await refreshBoot(0);
  } catch (error) {
    tabs.style.display = 'none';
    stage.replaceChildren(h('section.screen', h('.inner', h('.card.empty.rise',
      h('.empty-icon', icon('alert', 26)),
      h('p', error.message),
    ))));
    return;
  }

  applyKind(state.boot.kind);
  document.title = state.boot.master.name;
  const deepLink = state.boot.services.find(service => service.id === query.get('service'));
  if (state.boot.is_master && !deepLink) {
    state.tab = 'schedule';
    show({ name: 'schedule' }, 'tab');
  } else if (query.get('screen') === 'login') {
    // Из команды /login: экран входа поверх «Контактов», чтобы «Назад» вёл туда
    state.tab = 'about';
    state.stack = [{ name: 'about' }];
    show({ name: 'login' }, 'forward');
  } else {
    state.tab = 'home';
    show({ name: 'home' }, 'tab');
    if (deepLink) startBooking(deepLink);
  }
}

main();
