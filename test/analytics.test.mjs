// Проверка analytics.js и referral.js в node: настоящие файлы сайта
// выполняются в vm с поддельными window/document/localStorage/fetch/таймерами.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const ROOT = new URL('..', import.meta.url);
const ANALYTICS = fs.readFileSync(new URL('analytics.js', ROOT), 'utf8');
const REFERRAL = fs.readFileSync(new URL('referral.js', ROOT), 'utf8');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const tick = () => new Promise((r) => setImmediate(r));

function memoryStorage(map = new Map()) {
  return {
    map,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

function page({ url = 'https://appfita.ru/', referrer = '', storage = memoryStorage(), collect = true, api = 'https://api.appfita.ru', respond = () => ({ status: 204 }) } = {}) {
  const loc = new URL(url);
  const calls = [];
  const timers = [];
  const listeners = [];
  const elements = {};
  const attrs = { 'data-api': api, 'data-collect': collect ? '1' : null };
  const document = {
    referrer,
    visibilityState: 'visible',
    currentScript: { getAttribute: (k) => attrs[k] ?? null },
    addEventListener: (type, fn, capture) => listeners.push({ on: 'document', type, fn, capture }),
    getElementById: (id) => elements[id] || null,
  };
  const win = {
    document,
    location: { href: loc.href, pathname: loc.pathname, search: loc.search, hash: loc.hash, hostname: loc.hostname },
    URL,
    URLSearchParams,
    JSON,
    Date,
    Math,
    Uint8Array,
    crypto: globalThis.crypto,
    isSecureContext: true,
    navigator: {},
    addEventListener: (type, fn) => listeners.push({ on: 'window', type, fn }),
    setTimeout: (fn, ms) => timers.push({ fn, ms }),
    fetch: (u, opts) => {
      calls.push({ url: u, opts, body: opts && opts.body ? JSON.parse(opts.body) : null });
      const r = respond(u, opts);
      if (r instanceof Error) return Promise.reject(r);
      return Promise.resolve({ status: r.status, ok: r.status >= 200 && r.status < 300, json: async () => r.json });
    },
  };
  if (storage === 'throws') {
    Object.defineProperty(win, 'localStorage', { get() { throw new Error('SecurityError'); } });
  } else if (storage) {
    win.localStorage = storage;
  }
  win.window = win;
  const ctx = vm.createContext(win);
  const run = (code, scriptAttrs = {}) => {
    Object.assign(attrs, scriptAttrs);
    vm.runInContext(code, ctx);
  };
  const runTimers = async () => {
    while (timers.length) {
      timers.shift().fn();
      await tick();
    }
  };
  const click = (href) => {
    const a = { href: new URL(href, loc.href).href };
    let prevented = false;
    const e = { target: { closest: (sel) => (sel === 'a[href]' ? a : null) }, preventDefault: () => (prevented = true) };
    for (const l of listeners.filter((l) => l.type === 'click')) l.fn(e);
    return prevented;
  };
  const events = () => calls.filter((c) => c.url.endsWith('/v1/analytics/public')).flatMap((c) => c.body.events);
  return { win, calls, timers, listeners, elements, run, runTimers, click, events };
}

async function load(opts) {
  const p = page(opts);
  p.run(ANALYTICS);
  await p.runTimers();
  return p;
}

test('page_view: только pathname, slug-метки, хост referrer и код приглашения', async () => {
  const p = await load({
    url: 'https://appfita.ru/index.html?utm_source=Telegram&utm_medium=post&utm_campaign=spring-26&utm_term=secret&utm_content=x&email=a@b.ru&ref=abcd2345#faq',
    referrer: 'https://t.me/some/channel?post=1',
  });
  assert.equal(p.calls.length, 1);
  const { url, opts, body } = p.calls[0];
  assert.equal(url, 'https://api.appfita.ru/v1/analytics/public');
  assert.equal(opts.method, 'POST');
  assert.equal(opts.keepalive, true);
  assert.equal(opts.credentials, 'omit');
  assert.equal(opts.headers, undefined); // text/plain: без CORS-preflight
  assert.match(body.visitor_id, UUID);
  assert.deepEqual(Object.keys(body).sort(), ['events', 'visitor_id']);
  const props = { source: 'telegram', medium: 'post', campaign: 'spring-26', referrer_host: 't.me', referral_code: 'ABCD2345' };
  assert.deepEqual(body.events.map((e) => [e.name, e.path, e.properties]), [
    ['page_view', '/', props],
    ['referral_link_opened', '/', props],
  ]);
  for (const e of body.events) {
    assert.match(e.event_id, UUID);
    assert.deepEqual(Object.keys(e).sort(), ['event_id', 'name', 'path', 'properties']);
  }
  assert.notEqual(body.events[0].event_id, body.events[1].event_id);
  assert.doesNotMatch(opts.body, /[?#@]|utm_|secret|channel|faq/);
});

test('мусор в метках, referrer и коде отбрасывается', async () => {
  const p = await load({
    url: 'https://appfita.ru/space/?utm_source=a%20b&utm_medium=x@y.ru&utm_campaign=' + 'a'.repeat(65) + '&ref=<script>',
    referrer: 'https://appfita.ru/',
  });
  assert.deepEqual(p.events().map((e) => [e.name, e.path, e.properties]), [['page_view', '/space', {}]]);
  for (const referrer of ['http://localhost:3000/', 'https://192.168.0.1/', 'not a url', 'https://www.fita.fit/x']) {
    const q = await load({ url: 'https://appfita.ru/', referrer });
    assert.deepEqual(q.events()[0].properties, {}, referrer);
  }
});

test('кривой код в ?ref= игнорируется; /r и /r/<code> не отслеживаются (их уводит 404.html)', async () => {
  for (const url of ['https://appfita.ru/?ref=ab', 'https://appfita.ru/?ref=ABCD-2345', 'https://appfita.ru/?ref=' + 'A'.repeat(17), 'https://appfita.ru/?ref=%3Cscript%3E']) {
    const q = await load({ url });
    assert.deepEqual(q.events().map((e) => e.name), ['page_view'], url);
    assert.equal(q.win.FITA_ANALYTICS.referral(), null);
  }
  for (const url of ['https://appfita.ru/r/ABCD2345', 'https://appfita.ru/r?ref=ABCD2345']) {
    assert.equal((await load({ url })).calls.length, 0, url);
  }
});

test('код приглашения живёт 7 дней и не порождает повторный referral_link_opened', async () => {
  const storage = memoryStorage();
  await load({ url: 'https://appfita.ru/?ref=WXYZ2345', storage });
  const later = await load({ url: 'https://appfita.ru/space', storage });
  assert.deepEqual(later.events().map((e) => [e.name, e.properties.referral_code]), [['page_view', 'WXYZ2345']]);
  storage.setItem('fita_ref', JSON.stringify({ c: 'WXYZ2345', t: Date.now() - 8 * 864e5 }));
  const expired = await load({ url: 'https://appfita.ru/', storage });
  assert.deepEqual(expired.events()[0].properties, {});
  assert.equal(storage.getItem('fita_ref'), null);
});

test('правовые страницы, превью-хосты и сборка без сбора ничего не отправляют', async () => {
  for (const url of ['https://appfita.ru/privacy', 'https://appfita.ru/terms', 'https://appfita.ru/consent', 'https://appfita.ru/auth', 'https://appfita.ru/panel', 'https://appfita.ru/nope']) {
    const p = await load({ url });
    assert.equal(p.calls.length, 0, url);
    assert.equal(p.listeners.length, 0, url);
  }
  for (const url of ['http://localhost:4190/', 'https://runwithfun.github.io/', 'http://appfita.ru.evil.test/']) {
    assert.equal((await load({ url })).calls.length, 0, url);
  }
  assert.equal((await load({ collect: false })).calls.length, 0);
  assert.equal((await load({ api: '' })).calls.length, 0);
  // код приглашения сохраняется и без сбора (превью), но visitor_id не заводится
  const preview = await load({ url: 'http://localhost:4190/?ref=ABCD2345', collect: false });
  assert.equal(preview.win.FITA_ANALYTICS.referral(), 'ABCD2345');
  assert.equal(preview.win.FITA_ANALYTICS.visitorId(), null);
  assert.equal(preview.win.localStorage.getItem('fita_vid'), null);
});

test('visitor_id: один на браузер; без localStorage — один на загрузку', async () => {
  const storage = memoryStorage();
  const a = await load({ storage });
  const b = await load({ storage });
  assert.match(a.calls[0].body.visitor_id, UUID);
  assert.equal(a.calls[0].body.visitor_id, b.calls[0].body.visitor_id);

  const c = await load({ storage: 'throws', url: 'https://appfita.ru/?ref=ABCD2345' });
  c.click('https://releases.appfita.ru/');
  await c.runTimers();
  const ids = new Set(c.calls.map((x) => x.body.visitor_id));
  assert.equal(ids.size, 1);
  assert.match([...ids][0], UUID);
  assert.equal(c.events().length, 3);
  assert.equal((await load({ storage: null })).calls.length, 1);
});

test('скачивание: одно событие на клик, повторный скрипт не добавляет слушатель, переход не блокируется', async () => {
  const p = await load();
  p.run(ANALYTICS); // второй экземпляр на той же странице
  assert.equal(p.listeners.filter((l) => l.type === 'click').length, 1);
  assert.equal(p.listeners.find((l) => l.type === 'click').capture, true);
  assert.equal(p.click('https://apps.apple.com/ru/app/fita/id6794848328'), false);
  assert.equal(p.click('https://apps.apple.com/ru/app/fita/id6794848328'), false); // двойной клик
  p.click('https://releases.appfita.ru/#v1.2');
  p.click('/space');
  p.click('mailto:support@appfita.ru');
  await p.runTimers();
  assert.deepEqual(p.events().map((e) => e.name), ['page_view', 'download_clicked', 'download_clicked']);
  // клик по скачиванию отправляет сразу, с keepalive — до ухода со страницы
  assert.ok(p.calls.slice(1).every((c) => c.opts.keepalive));
});

test('пачки не больше 20 событий; при уходе со страницы очередь уходит целиком', async () => {
  const p = page();
  p.run(ANALYTICS);
  for (let i = 0; i < 80; i++) p.click(`https://releases.appfita.ru/#${i}`);
  await p.runTimers();
  assert.ok(p.calls.every((c) => c.body.events.length <= 20));
  assert.equal(p.events().length, 81);

  // page_view ждёт таймера; pagehide отправляет его сразу, с keepalive
  const q = page();
  q.run(ANALYTICS);
  assert.equal(q.calls.length, 0);
  q.listeners.find((l) => l.type === 'pagehide').fn();
  assert.equal(q.calls.length, 1);
  assert.equal(q.calls[0].opts.keepalive, true);
  await q.runTimers();
  assert.equal(q.calls.length, 1); // повторно не уходит
});

test('ошибки сети: повтор с паузой, после трёх неудач тишина; 4xx не повторяется; сбой fetch не роняет страницу', async () => {
  const p = await load({ respond: () => new Error('offline') });
  assert.equal(p.calls.length, 3);
  assert.equal(p.calls[0].body.events[0].event_id, p.calls[2].body.events[0].event_id); // тот же event_id: сервер дедуплицирует
  p.click('https://releases.appfita.ru/');
  await p.runTimers();
  assert.equal(p.calls.length, 3);

  const q = await load({ respond: () => ({ status: 422 }) });
  assert.equal(q.calls.length, 1);
  const r = await load({ respond: () => ({ status: 503 }) });
  assert.equal(r.calls.length, 3);
  const s = await load({ respond: (u, o) => (o.keepalive ? ({ status: 429 }) : ({ status: 204 })) });
  assert.equal(s.calls.length, 3);

  const t = page();
  t.win.fetch = () => { throw new TypeError('blocked'); };
  t.run(ANALYTICS);
  await t.runTimers();
  assert.doesNotThrow(() => t.click('https://apps.apple.com/'));
});

// Мини-DOM: ровно то, что трогает referral.js.
function el(tag) {
  return {
    tag, attrs: {}, children: [], handlers: {}, textContent: '', parentNode: null,
    setAttribute(k, v) { this.attrs[k] = String(v); },
    appendChild(c) { c.parentNode = this; this.children.push(c); return c; },
    removeChild(c) { this.children.splice(this.children.indexOf(c), 1); return c; },
    get firstChild() { return this.children[0] || null; },
    get nextSibling() { const k = this.parentNode.children; return k[k.indexOf(this) + 1] || null; },
    insertBefore(c, ref) { c.parentNode = this; const k = this.children; k.splice(ref ? k.indexOf(ref) : k.length, 0, c); return c; },
    addEventListener(t, fn) { this.handlers[t] = fn; },
  };
}
const walk = (n) => [n, ...n.children.flatMap(walk)];
const text = (n) => walk(n).map((x) => x.textContent).join(' ');

function referralPage(url, respond, attrs = { 'data-app-link': 'https://link.appfita.ru/r/{code}' }, opts = {}) {
  const p = page({ url, respond, ...opts });
  const hero = el('main');
  const cta = hero.appendChild(el('div'));
  hero.appendChild(el('section'));
  p.win.document.createElement = el;
  p.win.document.querySelector = (sel) => (sel === '#view-home .hero-cta' ? cta : null);
  p.win.navigator.clipboard = { writeText: async (t) => (p.copied = t) };
  p.run(ANALYTICS);
  p.run(REFERRAL, attrs);
  p.box = hero.children.find((c) => c.attrs.class === 'hero-ref') || null;
  assert.ok(!p.box || hero.children[1] === p.box); // сразу под кнопками скачивания
  p.links = () => (p.box ? walk(p.box).filter((x) => x.tag === 'a') : []);
  return p;
}

test('главная с ?ref=: блок с кодом, ссылка в приложение с visitor_id, проверка кода в ядре', async () => {
  const ok = referralPage('https://appfita.ru/?ref=abcd2345', () => ({ status: 204 }));
  await tick(); await tick();
  assert.equal(ok.box.attrs.class, 'hero-ref');
  assert.match(text(ok.box), /ABCD2345/);
  const vid = ok.win.FITA_ANALYTICS.visitorId();
  assert.match(vid, UUID);
  assert.deepEqual(ok.links().map((a) => a.attrs.href), [`https://link.appfita.ru/r/ABCD2345?visitor_id=${vid}`]);
  assert.ok(ok.calls.some((c) => c.url === 'https://api.appfita.ru/v1/referrals/resolve/ABCD2345' && c.opts.credentials === 'omit'));
  // ссылка в приложение (и visitor_id в ней) в аналитику не попадает
  for (const c of ok.calls.filter((c) => c.url.endsWith('/analytics/public'))) assert.doesNotMatch(c.opts.body, /link\.appfita|visitor_id=/);
  const copy = walk(ok.box).find((x) => x.tag === 'button');
  copy.handlers.click();
  await tick();
  assert.equal(ok.copied, 'ABCD2345');

  // испорченный visitor_id в хранилище заменяется новым, в ссылку не идёт
  const storage = memoryStorage();
  storage.setItem('fita_vid', 'not-a-uuid"><script>');
  const fixed = referralPage('https://appfita.ru/?ref=ABCD2345', () => ({ status: 204 }), undefined, { storage });
  assert.match(fixed.links()[0].attrs.href, /^https:\/\/link\.appfita\.ru\/r\/ABCD2345\?visitor_id=[0-9a-f-]{36}$/);
  assert.doesNotMatch(fixed.links()[0].attrs.href, /script/);

  // сбор выключен (превью): ссылка без visitor_id
  const off = referralPage('https://appfita.ru/?ref=ABCD2345', () => ({ status: 204 }), undefined, { collect: false });
  assert.equal(off.links()[0].attrs.href, 'https://link.appfita.ru/r/ABCD2345');

  // по умолчанию (сборка без FITA_APP_REFERRAL_LINK): кнопки и visitor_id нет,
  // код копируется, обещаний про ввод кода в приложении нет
  const noLink = referralPage('https://appfita.ru/?ref=ABCD2345', () => ({ status: 204 }), {});
  assert.equal(noLink.links().length, 0);
  assert.match(text(noLink.box), /ABCD2345/);
  assert.match(text(noLink.box), /следующих обновлений/);
  assert.doesNotMatch(text(noLink.box), /регистрац|visitor_id|Открыть в приложении/);
  assert.ok(walk(noLink.box).some((x) => x.tag === 'button'));
});

test('недействительный код забывается, без кода блока нет', async () => {
  const bad = referralPage('https://appfita.ru/?ref=ZZZZ9999', (u) => (u.includes('/resolve/') ? { status: 404 } : { status: 204 }));
  await tick(); await tick();
  assert.match(text(bad.box), /недействительно/);
  assert.equal(bad.links().length, 0);
  assert.equal(bad.win.FITA_ANALYTICS.referral(), null);
  assert.equal(bad.win.localStorage.getItem('fita_ref'), null);

  const offline = referralPage('https://appfita.ru/?ref=ABCD2345', () => new Error('offline'));
  await tick(); await tick();
  assert.match(text(offline.box), /ABCD2345/);

  const none = referralPage('https://appfita.ru/', () => ({ status: 204 }));
  assert.equal(none.box, null);
  assert.ok(!none.calls.some((c) => c.url.includes('/resolve/')));
});
