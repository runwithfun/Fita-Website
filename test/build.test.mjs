// Сборка обеих версий: русская (appfita.ru, _site) и английская (fita.fit,
// _site-en). Проверяем SEO-разметку, ссылки, аналитику и что в английской
// версии не осталось русского вне текста правовых документов.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { loadContent } from '../scripts/content-pages.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const build = (env = {}) =>
  execFileSync(process.execPath, ['scripts/build.mjs'], { cwd: ROOT, env: { ...process.env, FITA_LOCALE: '', FITA_HREFLANG: '', FITA_APP_REFERRAL_LINK: '', FITA_ANALYTICS: '', FITA_BUILD_OFFLINE: '1', ...env }, stdio: 'pipe' });
const read = (dir, f) => fs.readFileSync(path.join(ROOT, dir, f), 'utf8');
const CYR = /[А-Яа-яЁё]/;
const hrefs = (html) => [...new Set([...html.matchAll(/<(?:a|link)\b[^>]*?\shref="([^"]+)"/g)].map((m) => m[1]).filter((h) => !h.startsWith('/assets/') && !h.startsWith('/favicon')))].sort();
const jsonLd = (html) => JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
const scriptTag = (html, name) => (html.match(new RegExp(`<script src="/assets/js/${name}\\.[0-9a-f]+\\.js"[^>]*>`)) || [null])[0];

build();
build({ FITA_LOCALE: 'en' });
const PAGES = ['index.html', 'space.html', 'privacy.html', 'consent.html', 'terms.html', '404.html'];
const ru = Object.fromEntries(PAGES.map((f) => [f, read('_site', f)]));
const en = Object.fromEntries(PAGES.map((f) => [f, read('_site-en', f)]));

test('русская версия: appfita.ru, без hreflang по умолчанию', () => {
  assert.match(ru['index.html'], /<html lang="ru">/);
  assert.match(ru['index.html'], /<link rel="canonical" href="https:\/\/appfita.ru\/">/);
  for (const f of PAGES) assert.doesNotMatch(ru[f], /hreflang|fita\.fit/, f);
  assert.ok(fs.existsSync(path.join(ROOT, '_site', 'CNAME')));
});

test('английская версия: lang, canonical, OG, hreflang, JSON-LD', () => {
  for (const [f, p] of [['index.html', '/'], ['space.html', '/space']]) {
    const h = en[f];
    assert.match(h, /<html lang="en">/, f);
    assert.ok(h.includes(`<link rel="canonical" href="https://fita.fit${p}">`), f);
    assert.ok(h.includes(`<meta property="og:url" content="https://fita.fit${p}">`), f);
    assert.ok(h.includes('<meta property="og:locale" content="en_US">'), f);
    assert.ok(h.includes(`<link rel="alternate" hreflang="ru" href="https://appfita.ru${p}">`), f);
    assert.ok(h.includes(`<link rel="alternate" hreflang="en" href="https://fita.fit${p}">`), f);
    assert.ok(h.includes(`<link rel="alternate" hreflang="x-default" href="https://fita.fit${p}">`), f);
    assert.doesNotMatch(h, /og:image" content="https:\/\/appfita/, f);
  }
  const ld = jsonLd(en['index.html'])['@graph'];
  assert.ok(ld.every((n) => !n.url || n.url.startsWith('https://fita.fit/')));
  const faq = ld.find((n) => n['@type'] === 'FAQPage');
  assert.equal(faq.inLanguage, 'en');
  assert.equal(faq.mainEntity.length, jsonLd(ru['index.html'])['@graph'].find((n) => n['@type'] === 'FAQPage').mainEntity.length);
  assert.ok(!CYR.test(JSON.stringify(ld)));
  assert.match(en['404.html'], /<meta name="robots" content="noindex">/);
});

test('английская версия: правовые документы русские, с пометкой и canonical на appfita.ru', () => {
  for (const f of ['privacy', 'consent', 'terms']) {
    const h = en[`${f}.html`];
    assert.ok(h.includes(`<link rel="canonical" href="https://appfita.ru/${f}">`), f);
    assert.match(h, new RegExp(`<div id="view-${f}" lang="ru" class="view`), f);
    assert.match(h, /This document is available in Russian only/, f);
    assert.doesNotMatch(h, /rel="alternate" hreflang/, f);
    // сам документ — дословно русский текст из исходника
    const doc = (s) => s.slice(s.indexOf('<main class="policy">'), s.indexOf('<footer'));
    assert.equal(doc(h), doc(ru[`${f}.html`]), f);
  }
  const sitemap = read('_site-en', 'sitemap.xml');
  assert.deepEqual([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]), ['https://fita.fit/', 'https://fita.fit/space', ...loadContent(ROOT).map(p => `https://fita.fit/${p.slug}`)]);
});

test('английская версия: ни одного русского слова вне правовых документов', () => {
  for (const f of PAGES) {
    const visible = en[f]
      .replace(/<div id="view-[a-z]+" lang="ru"[\s\S]*?(?=<footer class="site-footer">)/, '')
      .replace(/data:[a-z/+]+;base64,[A-Za-z0-9+/=]+/g, '');
    assert.ok(!CYR.test(visible), `${f}: ${(visible.match(/[^<>"]*[А-Яа-яЁё][^<>"]*/) || [''])[0].slice(0, 80)}`);
  }
  for (const f of fs.readdirSync(path.join(ROOT, '_site-en', 'assets', 'js'))) {
    assert.ok(!CYR.test(read('_site-en', `assets/js/${f}`)), f);
  }
  for (const f of ['robots.txt', 'llms.txt', 'spa.js']) assert.ok(!CYR.test(read('_site-en', f)), f);
  assert.match(read('_site-en', 'robots.txt'), /^Sitemap: https:\/\/fita\.fit\/sitemap\.xml$/m);
  for (const f of ['CNAME', 'yandex_05b92f09f6b3d057.html']) {
    assert.ok(!fs.existsSync(path.join(ROOT, '_site-en', f)), f);
  }
  // Файл Google выдан на аккаунт, ключ IndexNow — на владельца: оба годятся и для fita.fit.
  for (const f of ['google0e397b29f133d71b.html', 'BingSiteAuth.xml', '14365f8de00c67b810d8f563c4f7b2ab.txt']) {
    assert.ok(fs.existsSync(path.join(ROOT, '_site-en', f)), f);
  }
});

const RU_STORE = 'https://apps.apple.com/ru/app/fita/id6794848328';
const EN_STORE = 'https://apps.apple.com/app/fita/id6794848328';

test('ссылки: английская версия ведёт туда же, что русская; App Store — без страны', () => {
  for (const f of PAGES) {
    const own = (h) => !h.startsWith('https://fita.fit') && !h.startsWith('https://appfita.ru');
    assert.deepEqual(hrefs(en[f]).filter(own), hrefs(ru[f]).filter(own).map((h) => (h === RU_STORE ? EN_STORE : h)), f);
    assert.ok(!en[f].includes(RU_STORE), f);
  }
  assert.ok(hrefs(ru['index.html']).includes(RU_STORE));
  assert.ok(!ru['index.html'].includes(EN_STORE));
  assert.ok(hrefs(en['index.html']).includes(EN_STORE));
  assert.ok(hrefs(en['index.html']).includes('https://releases.appfita.ru/'));
  const app = jsonLd(en['index.html'])['@graph'].find((n) => n['@type'] === 'MobileApplication');
  assert.equal(app.installUrl, EN_STORE);
  assert.equal(jsonLd(ru['index.html'])['@graph'].find((n) => n['@type'] === 'MobileApplication').installUrl, RU_STORE);
  assert.ok(read('_site-en', 'llms.txt').includes(EN_STORE));
});

test('английская версия не обещает английское приложение; числа в английской записи', () => {
  assert.match(en['index.html'], /app interface in Russian/);
  assert.match(en['index.html'], /The app interface is currently in Russian\./); // FAQ «где скачать»
  assert.match(en['space.html'], /the app itself is currently in Russian/);
  const faq = jsonLd(en['index.html'])['@graph'].find((n) => n['@type'] === 'FAQPage');
  assert.ok(faq.mainEntity.some((q) => /currently in Russian/.test(q.acceptedAnswer.text)));
  const js = fs.readdirSync(path.join(ROOT, '_site-en', 'assets', 'js')).map((f) => read('_site-en', `assets/js/${f}`)).join('\n');
  assert.ok(js.includes('"8,432 / 10,000"') && js.includes('"1,240 XP"'));
  assert.ok(!/"8[ \u00a0\u202f]432/.test(js));
});

test('аналитика и приглашения одинаковы в обеих версиях: тот же сборщик, кнопка приложения выключена', () => {
  for (const site of [ru, en]) {
    for (const f of ['index.html', 'space.html']) {
      assert.match(scriptTag(site[f], 'analytics'), /data-api="https:\/\/api\.appfita\.ru" data-collect="1"/, f);
    }
    assert.ok(scriptTag(site['index.html'], 'referral'));
    assert.doesNotMatch(scriptTag(site['index.html'], 'referral'), /data-app-link/);
    for (const f of ['privacy.html', 'consent.html', 'terms.html', '404.html']) assert.equal(scriptTag(site[f], 'analytics'), null, f);
  }
  // в английском referral.js — английский текст про ожидаемое обновление
  const js = read('_site-en', scriptTag(en['index.html'], 'referral').match(/src="\/([^"]+)"/)[1]);
  assert.match(js, /future update/i);
  assert.match(read('_site-en', scriptTag(en['index.html'], 'analytics').match(/src="\/([^"]+)"/)[1]), /fita\.fit/);
});

test('переключатели сборки: hreflang в русской, сбор и кнопка приложения в английской', () => {
  build({ FITA_HREFLANG: '1' });
  assert.ok(read('_site', 'index.html').includes('<link rel="alternate" hreflang="en" href="https://fita.fit/">'));
  assert.doesNotMatch(read('_site', 'privacy.html'), /hreflang/);
  build({ FITA_LOCALE: 'en', FITA_ANALYTICS: '0', FITA_APP_REFERRAL_LINK: 'https://link.appfita.ru/r/{code}' });
  const h = read('_site-en', 'index.html');
  assert.doesNotMatch(scriptTag(h, 'analytics'), /data-collect/);
  assert.match(scriptTag(h, 'referral'), /data-app-link="https:\/\/link\.appfita\.ru\/r\/\{code\}"/);
  build(); // вернуть обычные сборки
  build({ FITA_LOCALE: 'en' });
});

const CONTENT_PAGES = loadContent(ROOT);
test('content routes have complete SSR, reciprocal languages and matching structured data', () => {
  for (const lang of ['ru','en']) for (const page of CONTENT_PAGES) {
    const site = lang === 'ru' ? 'https://appfita.ru' : 'https://fita.fit';
    const html = read(lang === 'ru' ? '_site' : '_site-en', `${page.slug}.html`);
    assert.equal((html.match(/<h1[\s>]/g)||[]).length, 1, page.slug);
    assert.ok(html.includes(`<link rel="canonical" href="${site}/${page.slug}">`));
    assert.match(html, /hreflang="ru"/); assert.match(html, /hreflang="en"/); assert.match(html, /hreflang="x-default"/);
    const graph = jsonLd(html)['@graph'];
    assert.ok(graph.some(n=>n['@type']==='WebPage'));
    assert.ok(graph.some(n=>n['@type']==='BreadcrumbList'));
    const faq=graph.find(n=>n['@type']==='FAQPage');
    assert.equal(faq.mainEntity.length,page[lang].faq.length);
    for(const item of page[lang].faq){assert.ok(html.includes(item.q.replaceAll('&','&amp;').replaceAll('"','&quot;')));}
    const visible=html.replace(/<script[^>]*>[\s\S]*?<\/script>/g,'');
    assert.ok(visible.includes('<h2>'));assert.ok(visible.includes('MCP'));
    assert.ok(visible.includes(page[lang].lead.replaceAll('&','&amp;').replaceAll('"','&quot;')));
    assert.ok(visible.includes(lang==='ru'?'не являются медицинской консультацией':'not medical advice'));
    assert.ok(!html.includes('type="text/babel"'));
    if(page.calculator){assert.doesNotMatch(html,/<form\b/i);assert.ok(html.includes('<button type="button">'));}
    if(lang==='en')assert.ok(!CYR.test(html),page.slug);
    const sitemap=read(lang==='ru'?'_site':'_site-en','sitemap.xml');
    assert.ok(sitemap.includes(`<loc>${site}/${page.slug}</loc>`));
    assert.ok(read(lang==='ru'?'_site':'_site-en','llms.txt').includes(`${site}/${page.slug}`));
  }
});
test('home first screen remains in source and free tools link every calculator',()=>{
  for (const lang of ['ru','en']) {const html=(lang==='ru'?ru:en)['index.html'];
    assert.ok(html.includes('class="seo-tools"'));
    for(const page of CONTENT_PAGES.filter(p=>p.calculator))assert.ok(html.includes(`href="/${page.slug}"`));
  }
});
