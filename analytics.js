/**
 * FITA — лёгкая аналитика сайта (свой код, без Umami-скрипта и сторонних доменов).
 *
 * События уходят в ядро FITA: POST {api}/v1/analytics/public, оттуда сервер
 * сам пересылает их в приватный Umami. Отправляем только:
 *   page_view, download_clicked, referral_link_opened;
 *   path — нормализованный pathname известной маркетинговой страницы (без query/hash);
 *   source/medium/campaign — utm_* этой загрузки, только slug;
 *   referrer_host — хост внешнего referrer, без пути;
 *   referral_code — код приглашения из ?ref= (appfita.ru/?ref=CODE), только A-Z0-9;
 *   visit facts (visitContext): ad click id, in-app browser, visit number, landing page,
 *   landing parameter names (never values) and the first touch of this browser.
 * Ни email, ни текста, ни данных здоровья здесь нет и быть не должно.
 *
 * Всё best effort: ошибки сети, CORS и хранилища глотаются, на клики
 * и загрузки (переход в App Store, на релизы) скрипт никогда не влияет.
 * Публичные события не засчитывают приглашение: это делает только ядро
 * по факту регистрации в приложении.
 *
 * Настройка — атрибуты тега, их ставит scripts/build.mjs:
 *   data-api="https://api.appfita.ru"  — ядро (нужно и referral.js: resolve кода);
 *   data-collect="1"                   — включить отправку (в превью-сборке нет).
 * Плюс отправка идёт только с боевых хостов (HOSTS): localhost и превью молчат.
 */
(function (w) {
  'use strict';
  // Второй экземпляр скрипта не вешает второй слушатель кликов.
  if (w.FITA_ANALYTICS) return;

  var d = w.document;
  var tag = d.currentScript;
  var API = (tag && tag.getAttribute('data-api')) || '';
  var COLLECT = !!tag && tag.getAttribute('data-collect') === '1';

  var HOSTS = ['appfita.ru', 'www.appfita.ru', 'fita.fit', 'www.fita.fit'];
  // Только маркетинговые страницы; правовые, 404 и всё прочее — никогда.
  var PAGES = { '/': '/', '/index.html': '/', '/space': '/space', '/space.html': '/space' };
  // App Store Connect provider token. Empty keeps App Store links unchanged.
  var APP_STORE_PROVIDER_TOKEN = '';
  // Те же шаблоны, что проверяет сервер (server/app/routes/analytics.py).
  var CODE = /^[A-Za-z0-9]{4,16}$/;
  var HOST = /^[a-z0-9]([a-z0-9-]{0,62}\.)+[a-z]{2,63}$/;
  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

  var MAX_QUEUE = 50; // больше за одну загрузку страницы не бывает; лишнее отбрасываем
  // The server takes 20 events and 16 KB per request; 5 of the largest possible events
  // (with the visit facts of visitContext) stay under 16 KB, 20 would not.
  var BATCH = 5;
  var MAX_FAILURES = 3; // подряд — дальше молчим до следующей загрузки
  var REF_TTL = 7 * 864e5; // временная атрибуция на сайте, не в приложении
  var VID_KEY = 'fita_vid';
  var REF_KEY = 'fita_ref';

  function get(k) {
    try { return w.localStorage.getItem(k); } catch (e) { return null; }
  }
  function put(k, v) {
    try {
      if (v == null) w.localStorage.removeItem(k);
      else w.localStorage.setItem(k, v);
    } catch (e) {}
  }

  function uuid() {
    var c = w.crypto;
    try { if (c && c.randomUUID) return c.randomUUID(); } catch (e) {}
    var b = new Uint8Array(16), i, s = '';
    if (c && c.getRandomValues) c.getRandomValues(b);
    else for (i = 0; i < 16; i++) b[i] = (Math.random() * 256) | 0;
    b[6] = (b[6] & 15) | 64;
    b[8] = (b[8] & 63) | 128;
    for (i = 0; i < 16; i++) s += (b[i] + 256).toString(16).slice(1) + (i === 3 || i === 5 || i === 7 || i === 9 ? '-' : '');
    return s;
  }

  // Без localStorage (приватный режим, запрет cookies) id живёт до конца загрузки страницы.
  var memVid = null;
  function visitorId() {
    var v = get(VID_KEY);
    if (v && UUID.test(v)) return v;
    v = memVid || uuid();
    memVid = v;
    put(VID_KEY, v);
    return v;
  }

  function pagePath(pathname) {
    return PAGES[String(pathname || '/').replace(/\/+$/, '') || '/'] || null;
  }

  function normCode(c) {
    return typeof c === 'string' && CODE.test(c) ? c.toUpperCase() : null;
  }

  function params(search) {
    try { return new w.URLSearchParams(search || ''); } catch (e) { return { get: function () { return null; } }; }
  }

  function refFromUrl(loc) {
    return normCode(params(loc.search).get('ref'));
  }

  function storedRef(now) {
    try {
      var r = JSON.parse(get(REF_KEY) || 'null');
      if (r && normCode(r.c) && now - r.t >= 0 && now - r.t < REF_TTL) return r.c;
    } catch (e) {}
    put(REF_KEY, null);
    return null;
  }

  function referrerHost(ref, ownHost) {
    try {
      var h = new w.URL(ref).hostname.toLowerCase();
      return h !== ownHost && HOSTS.indexOf(h) < 0 && h.length <= 253 && HOST.test(h) ? h : null;
    } catch (e) {
      return null;
    }
  }

  // Only campaign slugs are retained. A visit expires after 30 minutes of inactivity;
  // a newly tagged landing replaces the complete campaign, never mixes two campaigns.
  var UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
  var CAMPAIGN_TTL = 30 * 60 * 1000;
  var campaign = {}, campaignAt = 0, campaignSearch = null;
  function campaignSlug(value) {
    return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/.test(value) ? value.toLowerCase() : null;
  }
  function cleanCampaign(value) {
    var out = {};
    UTM_KEYS.forEach(function (key) {
      var v = campaignSlug(value && value[key]);
      if (v) out[key] = v;
    });
    return out;
  }
  try {
    var savedCampaign = JSON.parse(w.sessionStorage.getItem('fita_acquisition_v1') || 'null');
    if (savedCampaign && Date.now() >= savedCampaign.at && Date.now() - savedCampaign.at < CAMPAIGN_TTL) {
      campaign = cleanCampaign(savedCampaign.values);
      campaignAt = savedCampaign.at;
    }
  } catch (e) {}
  function campaignContext() {
    var now = Date.now(), search = w.location.search || '';
    if (now < campaignAt || now - campaignAt >= CAMPAIGN_TTL) campaign = {};
    if (search !== campaignSearch) {
      var values = {}, tagged = false;
      try {
        var query = new w.URLSearchParams(search);
        UTM_KEYS.forEach(function (key) {
          if (query.has(key)) tagged = true;
          values[key] = query.get(key);
        });
      } catch (e) {}
      if (tagged) campaign = cleanCampaign(values);
      // A new invite is a new arrival. The server resolves its code before assigning a channel.
      else if (refFromUrl(w.location)) campaign = {};
      campaignSearch = search;
    }
    campaignAt = now;
    try { w.sessionStorage.setItem('fita_acquisition_v1', JSON.stringify({ at: now, values: campaign })); } catch (e) {}
    return cleanCampaign(campaign);
  }

  // Everything else a visit can tell about where it came from, kept raw so channels can be
  // decided later: ad click ids (the visit came from an ad even when its UTM got lost), the
  // in-app browser (those apps usually strip the referrer), the very first touch of this
  // browser, the visit number and the names (not values) of the landing link's parameters.
  // A click id never becomes a campaign source. The server checks the same shapes
  // (PublicProps in server/app/routes/analytics.py) and refuses a whole batch for one bad value.
  var CLICK_IDS = ['gclid', 'gbraid', 'wbraid', 'fbclid', 'ttclid', 'msclkid', 'twclid', 'rdt_cid', 'li_fat_id',
                   'igsh', 'yclid', 'epik', 'sccid', 'dclid', 'oppref', 'olref'];  // oppref/olref: ChatGPT ads
  var CLICK_VALUE = /^[A-Za-z0-9_.-]{1,300}$/;
  var PARAM_NAMES = /^[a-z0-9_.-]{1,40}(,[a-z0-9_.-]{1,40}){0,11}$/;
  var LOWER_SLUG = /^[a-z0-9][a-z0-9_.-]{0,63}$/;
  var IN_APP = [[/Instagram/, 'instagram'], [/FBAN|FBAV|FB_IAB/, 'facebook'], [/Barcelona/, 'threads'],
                [/musical_ly|BytedanceWebview|TikTok/i, 'tiktok'], [/Twitter/, 'x'], [/Reddit/i, 'reddit'],
                [/LinkedInApp/, 'linkedin'], [/Snapchat/, 'snapchat'], [/Pinterest/, 'pinterest'],
                [/\bLine\//, 'line'], [/Telegram/, 'telegram'], [/GSA\//, 'google_app']];
  var VISIT_TTL = 30 * 60 * 1000;
  var MAX_COUNT = 999999999;
  function inAppBrowser() {
    var ua = (w.navigator && w.navigator.userAgent) || '';
    for (var i = 0; i < IN_APP.length; i++) if (IN_APP[i][0].test(ua)) return IN_APP[i][1];
    return '';
  }
  // The storage is named, not passed: reading w.localStorage itself throws where storage is blocked.
  function storedJSON(store, key) { try { return JSON.parse(w[store].getItem(key) || 'null'); } catch (e) { return null; } }
  function saveJSON(store, key, value) { try { w[store].setItem(key, JSON.stringify(value)); } catch (e) {} }
  // Empty or a string of that shape; a number would pass a bare regex test and fail the server.
  function fits(re, v) { return v === '' || (typeof v === 'string' && re.test(v)); }
  function isHost(v) { return typeof v === 'string' && v.length <= 253 && HOST.test(v); }
  function isCount(v) { return typeof v === 'number' && v % 1 === 0 && v >= 1 && v <= MAX_COUNT; }
  function isSource(v) {
    return typeof v === 'string' && (v.indexOf('click:') === 0 ? CLICK_IDS.indexOf(v.slice(6)) >= 0 : LOWER_SLUG.test(v) || isHost(v));
  }
  // Stored facts are checked again before use: anything malformed starts afresh.
  function validVisit(v) {
    return !!v && typeof v.at === 'number' && isCount(v.number) && pagePath(v.landing) === v.landing &&
      (v.click === '' ? v.clickId === '' : CLICK_IDS.indexOf(v.click) >= 0 && fits(CLICK_VALUE, v.clickId) && v.clickId !== '') &&
      fits(PARAM_NAMES, v.params) && (v.referrer === '' || isHost(v.referrer));
  }
  function validFirst(f) {
    return !!f && typeof f.at === 'number' && f.at > 0 && isFinite(f.at) && isSource(f.source) &&
      fits(LOWER_SLUG, f.medium) && fits(LOWER_SLUG, f.campaign) &&
      (f.referrer === '' || isHost(f.referrer)) && pagePath(f.landing) === f.landing;
  }
  // A visit starts after 30 minutes without events; its landing facts are fixed for the visit.
  // The page keeps its own copy too, so blocked storage does not start a new visit on every event.
  var pageVisit = null, pageFirst = null;
  function visitContext(values, landing, referrer) {
    var now = Date.now(), visit = storedJSON('sessionStorage', 'fita_visit_v1') || pageVisit;
    if (!validVisit(visit) || now < visit.at || now - visit.at >= VISIT_TTL) {
      var count = parseInt(get('fita_visits') || '0', 10);
      count = count >= 0 && count < MAX_COUNT ? count + 1 : 1;
      put('fita_visits', String(count));
      var click = '', clickId = '', keys = [];
      try {
        var q = new w.URLSearchParams(w.location.search);
        q.forEach(function (value, key) {
          key = /^[A-Za-z0-9_.-]{1,40}$/.test(key) ? key.toLowerCase() : '';
          if (key && keys.length < 12 && keys.indexOf(key) < 0) keys.push(key);
        });
        for (var i = 0; i < CLICK_IDS.length && !click; i++) {
          var v = q.get(CLICK_IDS[i]);
          if (v && CLICK_VALUE.test(v)) { click = CLICK_IDS[i]; clickId = v; }
        }
      } catch (e) {}
      visit = { number: count, click: click, clickId: clickId, params: keys.join(','), landing: landing, referrer: referrer || '' };
    }
    visit.at = now;
    saveJSON('sessionStorage', 'fita_visit_v1', pageVisit = visit);
    var first = storedJSON('localStorage', 'fita_first_touch_v1') || pageFirst;
    if (!validFirst(first)) {
      first = { at: now, source: values.utm_source || (visit.click ? 'click:' + visit.click : '') || visit.referrer || 'direct',
                medium: values.utm_medium || '', campaign: values.utm_campaign || '', referrer: visit.referrer, landing: visit.landing };
      saveJSON('localStorage', 'fita_first_touch_v1', first);
    }
    pageFirst = first;
    var out = { visit_number: visit.number, landing_path: visit.landing,
                days_since_first_visit: Math.min(100000, Math.max(0, Math.floor((now - first.at) / 864e5))) };
    if (visit.params) out.landing_params = visit.params;
    if (visit.click) { out.click_id_type = visit.click; out.click_id = visit.clickId; }
    var app = inAppBrowser();
    if (app) out.in_app_browser = app;
    ['source', 'medium', 'campaign', 'referrer', 'landing'].forEach(function (key) {
      if (first[key]) out['first_' + key] = first[key];
    });
    return out;
  }

  // Refresh campaign expiry for each event, including clicks on a long-open page.
  function context(loc, referrer, ref) {
    var out = {}, values = campaignContext(), v, k;
    UTM_KEYS.forEach(function (key) {
      if (values[key]) out[key === 'utm_term' || key === 'utm_content' ? key : key.slice(4)] = values[key];
    });
    v = referrerHost(referrer, String(loc.hostname || '').toLowerCase());
    if (v) out.referrer_host = v;
    if (ref) out.referral_code = ref;
    // Only a collecting page counts visits: previews and other hosts leave no trace in storage.
    if (enabled) {
      var facts = visitContext(values, path, v);
      for (k in facts) if (Object.prototype.hasOwnProperty.call(facts, k)) out[k] = facts[k];
    }
    return out;
  }

  // ── состояние ────────────────────────────────────────────────────────
  var loc = w.location;
  var now = Date.now();
  var urlRef = refFromUrl(loc);
  if (urlRef) put(REF_KEY, JSON.stringify({ c: urlRef, t: now }));
  var ref = urlRef || storedRef(now);
  var path = pagePath(loc.pathname);
  var enabled = COLLECT && /^https:\/\/[^/]+$/.test(API) && !!path && HOSTS.indexOf(loc.hostname) >= 0 && typeof w.fetch === 'function';
  var hasVisitor = enabled; // enabled гаснет после сбоев сети, а id для приложения остаётся
  var ctx = context(loc, d.referrer, ref);
  var queue = [];
  var timer = null;
  var busy = false;
  var failures = 0;
  var lastDownload = { href: '', at: 0 };

  function track(name, properties) {
    if (!enabled || queue.length >= MAX_QUEUE) return;
    ctx = context(loc, d.referrer, ref);
    var props = {}, k;
    for (k in ctx) props[k] = ctx[k];
    if (properties && properties.store) props.store = properties.store;
    queue.push({ event_id: uuid(), name: name, path: path, properties: props });
    schedule(1000);
  }

  function schedule(ms) {
    if (timer) return;
    timer = w.setTimeout(function () {
      timer = null;
      flush(false);
    }, ms);
  }

  function send(batch, final) {
    var body = JSON.stringify({ visitor_id: visitorId(), events: batch });
    function done(retry) {
      if (!final) busy = false;
      if (retry && ++failures < MAX_FAILURES) {
        queue = batch.concat(queue).slice(0, MAX_QUEUE);
        if (!final) schedule(2000 * failures);
        return;
      }
      if (retry) {
        enabled = false; // сервер лежит — не долбим его с каждой страницы дальше
        queue = [];
        return;
      }
      failures = 0;
      if (queue.length && !final) schedule(0);
    }
    try {
      // Строка уходит как text/plain — простой запрос без CORS-preflight.
      // keepalive: запрос доживает, даже если пользователь ушёл в App Store.
      w.fetch(API + '/v1/analytics/public', { method: 'POST', body: body, keepalive: true, credentials: 'omit' }).then(
        function (r) { done(r.status === 429 || r.status >= 500); }, // 4xx — наша ошибка, повтор не поможет
        function () { done(true); }
      );
    } catch (e) {
      done(true);
    }
  }

  // final — уход со страницы: отправляем всё сразу, не дожидаясь ответа на прошлый запрос.
  function flush(final) {
    if (!enabled || !queue.length || (busy && !final)) return;
    if (final) {
      while (queue.length) send(queue.splice(0, BATCH), true);
      return;
    }
    busy = true;
    send(queue.splice(0, BATCH), false);
  }

  function downloadStore(a) {
    try {
      var url = new w.URL(a.href, loc.href);
      if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
      if (url.hostname === 'releases.appfita.ru') return 'apk';
      if (url.hostname === 'apps.apple.com' && /\/id6794848328\/?$/.test(url.pathname)) return 'app_store';
    } catch (e) {}
    return null;
  }

  // Hash the tuple, not its ambiguous joined label; keep ct within Apple's 40-character limit.
  function appleCampaignTag(source, campaign) {
    var ct = [source, campaign].filter(Boolean).join('-'), hash = 2166136261;
    if (!ct) return '';
    var tuple = JSON.stringify([source || '', campaign || '']);
    for (var i = 0; i < tuple.length; i++) hash = Math.imul(hash ^ tuple.charCodeAt(i), 16777619);
    return ct.slice(0, 31) + '-' + ('00000000' + (hash >>> 0).toString(16)).slice(-8);
  }

  var downloadLinks = new WeakMap();
  function decorateDownload(a, store) {
    if (store === 'app_store' && !/^[0-9]{1,32}$/.test(APP_STORE_PROVIDER_TOKEN)) return;
    try {
      var saved = downloadLinks.get(a);
      var original = saved && a.href === saved.decorated ? saved.original : a.href;
      var url = new w.URL(original, loc.href), values = campaignContext();
      if (store === 'apk' && Object.keys(values).length) {
        Array.from(url.searchParams.keys()).forEach(function (key) {
          if (/^utm_(source|medium|campaign|term|content)$/i.test(key)) url.searchParams.delete(key);
        });
        UTM_KEYS.forEach(function (key) { if (values[key]) url.searchParams.set(key, values[key]); });
      } else if (store === 'app_store') {
        var ct = appleCampaignTag(values.utm_source, values.utm_campaign);
        if (ct) {
          url.searchParams.set('pt', APP_STORE_PROVIDER_TOKEN);
          url.searchParams.set('ct', ct);
        }
      }
      if (url.href !== a.href) a.href = url.href;
      downloadLinks.set(a, { original: original, decorated: a.href });
    } catch (e) {}
  }

  if (enabled) {
    // capture: событие фиксируется до того, как чужой обработчик что-то отменит.
    function downloadClick(e) {
      try {
        if (e.type === 'auxclick' && e.button !== 1) return;
        var a = e.target && e.target.closest && e.target.closest('a[href]');
        var store = a && downloadStore(a);
        if (!store) return;
        decorateDownload(a, store);
        var t = Date.now();
        if (a.href === lastDownload.href && t - lastDownload.at < 1000) return; // двойной клик — одно событие
        lastDownload = { href: a.href, at: t };
        track('download_clicked', { store: store });
        flush(true);
      } catch (err) {}
    }
    d.addEventListener('click', downloadClick, true);
    d.addEventListener('auxclick', downloadClick, true);
    w.addEventListener('pagehide', function () { flush(true); });
    d.addEventListener('visibilitychange', function () {
      if (d.visibilityState === 'hidden') flush(true);
    });
    track('page_view');
    if (urlRef) track('referral_link_opened');
  }

  w.FITA_ANALYTICS = {
    api: API,
    referral: function () { return ref; },
    // Для ссылки в приложение: только когда сбор включён, иначе id не заводим.
    visitorId: function () { return hasVisitor ? visitorId() : null; },
    forgetReferral: function () {
      ref = null;
      delete ctx.referral_code;
      put(REF_KEY, null);
    },
  };
})(window);
