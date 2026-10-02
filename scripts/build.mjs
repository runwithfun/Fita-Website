// Сборка сайта в _site/: по отдельному HTML на каждую страницу.
//
// Исходник остаётся один — index.html со всеми view. Раньше GitHub Pages
// отдавал /space, /privacy и остальные адреса через 404.html (статус 404),
// поэтому ни Яндекс, ни Google их не индексировали. Теперь у каждой страницы
// свой файл со статусом 200, своим <head> и текстом прямо в HTML.
//
// Заодно JSX компилируется здесь, а не в браузере: Babel standalone и React
// с unpkg.com больше не грузятся (unpkg стоит на Cloudflare, который в РФ режут).
// По той же причине шрифты свои, а не с Google Fonts (см. FONTS ниже).

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const Babel = require('@babel/standalone');

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = path.join(ROOT, '_site');
const SITE = 'https://appfita.ru';
const APP_STORE = 'https://apps.apple.com/ru/app/fita/id6794848328';
const APP_STORE_ID = '6794848328';

// keep — какие view попадают в HTML страницы. Раньше на / и /space лежали оба
// view (главная и «Пространство»): у обеих страниц был одинаковый текст и два
// h1, поисковики видели дубли. Теперь на каждой только свой; переход между
// ними — обычная загрузка страницы (spa.js это умеет).
const PAGES = [
  {
    file: 'index.html',
    path: '/',
    view: 'view-home',
    keep: ['view-home'],
    app: true,
    fonts: 'app',
    title: 'ФИТА — ИИ-компаньон здоровья: сон, пульс, восстановление',
    description:
      'Фита разбирает сон, пульс, HRV и нагрузку по данным Apple Watch, Garmin, Oura и Whoop и подсказывает, когда тренироваться, а когда восстановиться.',
    jsonld: true,
  },
  {
    file: 'space.html',
    path: '/space',
    view: 'view-space',
    keep: ['view-space'],
    app: true,
    fonts: 'app',
    title: 'Пространство Фиты — экран, который собирается под тебя',
    description:
      'Виджеты, темы и чат с памятью: Фита собирает домашний экран под твой ритм и помнит прошлые разговоры. Соберите свой экран прямо на сайте.',
  },
  {
    file: 'privacy.html',
    path: '/privacy',
    view: 'view-privacy',
    keep: ['view-privacy'],
    fonts: 'doc',
    title: 'Политика конфиденциальности — ФИТА',
    description:
      'Как приложение ФИТА обрабатывает и защищает персональные данные и данные о здоровье: состав данных, цели, сроки хранения и права пользователя.',
  },
  {
    file: 'consent.html',
    path: '/consent',
    view: 'view-consent',
    keep: ['view-consent'],
    fonts: 'doc',
    title: 'Согласие на обработку персональных данных — ФИТА',
    description:
      'Текст согласия на обработку персональных данных пользователей приложения ФИТА: перечень данных, цели, действия с ними и порядок отзыва.',
  },
  {
    file: 'terms.html',
    path: '/terms',
    view: 'view-terms',
    keep: ['view-terms'],
    fonts: 'doc',
    title: 'Условия использования — ФИТА',
    description:
      'Условия использования приложения ФИТА и правила сообщества: клубы, события, контент пользователей и ответственность сторон.',
  },
  {
    file: '404.html',
    path: null,
    view: 'view-404',
    keep: ['view-404'],
    fonts: 'doc',
    title: 'Страница не найдена — ФИТА',
    description: 'Такой страницы нет.',
    noindex: true,
  },
];

const VIEW_IDS = ['view-home', 'view-space', 'view-privacy', 'view-consent', 'view-terms', 'view-404'];

const hash = (buf) => crypto.createHash('sha256').update(buf).digest('hex').slice(0, 10);
const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

function writeHashed(dir, base, ext, content) {
  const name = `${base}.${hash(content)}.${ext}`;
  fs.mkdirSync(path.join(OUT, dir), { recursive: true });
  fs.writeFileSync(path.join(OUT, dir, name), content);
  return `/${dir}/${name}`;
}

// ── 0. Чистый _site и статика ──────────────────────────────────────────
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT);
fs.cpSync(path.join(ROOT, 'assets'), path.join(OUT, 'assets'), {
  recursive: true,
  filter: (f) => path.basename(f) !== '.DS_Store',
});
// <ключ>.txt в корне — подтверждение ключа IndexNow (см. scripts/indexnow.mjs);
// google*.html и yandex_*.html — подтверждение прав в Search Console и Вебмастере.
// Удалять их нельзя: консоли периодически перепроверяют права.
const verificationFiles = fs
  .readdirSync(ROOT)
  .filter((f) => /^[0-9a-f]{32}\.txt$/.test(f) || /^(google[0-9a-f]+|yandex_[0-9a-f]+)\.html$/.test(f));
for (const f of ['CNAME', '.nojekyll', 'robots.txt', 'llms.txt', 'favicon.ico', ...verificationFiles]) {
  fs.copyFileSync(path.join(ROOT, f), path.join(OUT, f));
}

let src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

// ── 1. Шрифты: свои woff2 вместо Google Fonts ─────────────────────────
// Google Fonts — внешний CSS, который блокировал первую отрисовку (и в РФ
// ходит нестабильно). Файлы берём из @fontsource/* (те же woff2, что отдаёт
// Google, лицензия OFL), кладём к себе, @font-face пишем прямо в <head>.
// Браузер скачивает файл, только когда на странице есть символы из его
// unicode-range, поэтому лишние объявления ничего не стоят.
//
// У Instrument Serif, Courier Prime и Archivo нет кириллицы: русский текст
// в них и раньше рисовался запасным шрифтом из стека (Georgia, monospace),
// так что подключаем только их латиницу — вид страницы не меняется.
const FONT_SUBSETS = ['latin', 'latin-ext', 'cyrillic', 'cyrillic-ext'];
const FONTS = {
  // главная и «Пространство»: всё, что просили у Google Fonts
  app: [
    ['instrument-serif', '400'],
    ['instrument-serif', '400-italic'],
    ['courier-prime', '400'],
    ['courier-prime', '700'],
    ['archivo', '600'],
    ['archivo', '700'],
    ['archivo', '800'],
    ['cormorant-garamond', '400'],
    ['cormorant-garamond', '400-italic'],
    ['cormorant-garamond', '500'],
    ['cormorant-garamond', '500-italic'],
  ],
  // правовые страницы и 404: заголовки и машинописные подписи
  doc: [
    ['instrument-serif', '400'],
    ['courier-prime', '400'],
    ['courier-prime', '700'],
  ],
};
// preload шрифтов сейчас выключен намеренно. Пробовали Courier Prime 700
// и Archivo 800 (латиница первого экрана): Lighthouse mobile дал LCP 2.9 с
// и perf 95 против 2.6 с и 96–97 без preload — заголовок первого экрана
// рисуется запасным шрифтом сразу, а предзагрузка лишь конкурирует с HTML
// и CSS за канал. Механизм оставлен: имя файла fontsource без .woff2,
// например 'archivo-latin-800-normal'.
const FONT_PRELOAD = {
  app: [],
  doc: [],
};

const fontUrl = new Map(); // имя файла fontsource → опубликованный путь
function fontFaces(set) {
  const out = [];
  for (const [pkg, variant] of FONTS[set]) {
    const dir = path.dirname(require.resolve(`@fontsource/${pkg}/package.json`));
    const css = fs.readFileSync(path.join(dir, `${variant}.css`), 'utf8');
    for (const block of css.match(/@font-face\s*{[^}]*}/g) || []) {
      const file = block.match(/url\(\.\/files\/([^)]+\.woff2)\)/)[1];
      const subset = FONT_SUBSETS.find((s) => file.startsWith(`${pkg}-${s}-`) && !file.startsWith(`${pkg}-${s}-ext-`));
      if (!subset) continue; // vietnamese, greek и т.п. — не нужны
      if (!fontUrl.has(file)) {
        fontUrl.set(file, writeHashed('assets/fonts', file.replace(/\.woff2$/, ''), 'woff2', fs.readFileSync(path.join(dir, 'files', file))));
      }
      const get = (prop) => block.match(new RegExp(`${prop}:\\s*([^;]+);`))[1].trim();
      out.push(
        `@font-face{font-family:${get('font-family')};font-style:${get('font-style')};font-weight:${get('font-weight')};` +
          `font-display:swap;src:url(${fontUrl.get(file)}) format('woff2');unicode-range:${get('unicode-range')}}`,
      );
    }
  }
  return out.join('\n');
}
const fontHead = {};
for (const set of Object.keys(FONTS)) {
  const css = fontFaces(set);
  const preload = FONT_PRELOAD[set].map((name) => {
    const url = fontUrl.get(`${name}.woff2`);
    if (!url) throw new Error(`шрифт для preload не найден: ${name}`);
    return `<link rel="preload" href="${url}" as="font" type="font/woff2" crossorigin>`;
  });
  fontHead[set] = [...preload, `<style>\n${css}\n</style>`].join('\n');
}

// Ссылки на Google Fonts в исходнике остаются — с ними index.html можно открыть
// напрямую, без сборки. В опубликованные страницы они не попадают.
const googleFonts = /<link rel="preconnect" href="https:\/\/fonts\.(googleapis|gstatic)\.com"[^>]*>\s*|<link href="https:\/\/fonts\.googleapis\.com\/[^"]+" rel="stylesheet">\s*/g;
if ((src.match(googleFonts) || []).length !== 3) throw new Error('index.html: не нашёл ссылки на Google Fonts');
src = src.replace(googleFonts, '<!--FONTS-->\n');

// ── 2. Встроенные base64-картинки → файлы ──────────────────────────────
const MIME_EXT = { png: 'png', jpeg: 'jpg', webp: 'webp', gif: 'gif', 'svg+xml': 'svg' };
src = src.replace(/data:image\/(png|jpeg|webp|gif|svg\+xml);base64,([A-Za-z0-9+/=]+)/g, (m, sub, b64) => {
  if (m.length < 4096) return m; // мелочь (иконки) пусть остаётся inline
  return writeHashed('assets/inline', 'img', MIME_EXT[sub], Buffer.from(b64, 'base64'));
});

// ── 3. JSX → JS ────────────────────────────────────────────────────────
// Раньше настройки повторяли Babel standalone в браузере: preset env без
// targets, то есть всё в ES5. Теперь env знает целевые браузеры (Safari/iOS 12+,
// Chrome 64+, Firefox 67+) и оставляет стрелки, деструктуризацию, spread и
// шаблонные строки как есть — меньше кода и нет «устаревшего JS».
// browserslist-запросы в standalone-сборке Babel не работают, поэтому версии
// перечислены явно.
//
// transform-block-scoping оставлен намеренно: JSX-блоки — обычные скрипты
// с общей глобальной областью, и в двух из них объявлено
// `const { P, SF, … } = window.FITA`. С настоящими const второй блок упал бы
// с «Identifier has already been declared»; с var (как было) — работает.
const BABEL_OPTS = {
  filename: 'Inline Babel script',
  presets: ['react', ['env', { targets: { chrome: '64', edge: '79', firefox: '67', safari: '12', ios: '12', samsung: '9' }, bugfixes: true }]],
  plugins: ['transform-block-scoping', 'transform-flow-strip-types'],
  // без пробелов и комментариев: исходник читаемый лежит в index.html
  minified: true,
  comments: false,
  sourceMaps: false,
};
const appScripts = [];
src = src.replace(/<script type="text\/babel">([\s\S]*?)<\/script>\s*/g, (m, code) => {
  const out = Babel.transform(code, BABEL_OPTS).code;
  appScripts.push(writeHashed('assets/js', `app-${appScripts.length}`, 'js', out));
  return '';
});

// React: production-сборки со своего домена вместо development с unpkg.
src = src.replace(/<script src="https:\/\/unpkg\.com\/[^"]+"[^>]*><\/script>\s*/g, '');
// umd/ не перечислен в exports пакетов, поэтому путь — от package.json.
const pkgFile = (pkg, file) => path.join(path.dirname(require.resolve(`${pkg}/package.json`)), file);
const vendor = [
  ['react', 'umd/react.production.min.js'],
  ['react-dom', 'umd/react-dom.production.min.js'],
].map(([pkg, file]) => writeHashed('assets/vendor', path.basename(file, '.js'), 'js', fs.readFileSync(pkgFile(pkg, file))));

// Babel выполнял JSX-блоки после разбора документа, когда все обычные
// скрипты уже отработали. defer в конце body даёт тот же порядок.
const appTags = [...vendor, ...appScripts].map((s) => `<script src="${s}" defer></script>`).join('\n');

// Восстановление пути после старого 404-редиректа больше не нужно.
src = src.replace(/<script>\s*\/\* Restore path after GitHub Pages 404[\s\S]*?<\/script>\s*/, '');

// ── 4. Разрезаем body на view ──────────────────────────────────────────
const bodyOpen = src.indexOf('<body');
const footerStart = src.indexOf('<footer class="site-footer">');
const scriptsStart = src.indexOf('<script src="spa.js">');
const bodyEnd = src.lastIndexOf('</body>');
if ([bodyOpen, footerStart, scriptsStart, bodyEnd].some((i) => i < 0)) {
  throw new Error('index.html: не нашёл ожидаемую разметку (body/footer/spa.js)');
}

const views = {};
const starts = VIEW_IDS.map((id) => {
  const i = src.indexOf(`<div id="${id}"`);
  if (i < 0) throw new Error(`index.html: нет #${id}`);
  return [id, i];
}).sort((a, b) => a[1] - b[1]);
starts.forEach(([id, i], n) => {
  views[id] = src.slice(i, n + 1 < starts.length ? starts[n + 1][1] : footerStart);
});

const head = src.slice(0, bodyOpen);
const footer = src.slice(footerStart, scriptsStart);
const tailScripts = src.slice(scriptsStart, bodyEnd);

// ── 5. head для каждой страницы ────────────────────────────────────────
const decode = (s) =>
  s
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&laquo;/g, '«')
    .replace(/&raquo;/g, '»')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

// FAQ для разметки берём из самой страницы: вопросы и ответы в JSON-LD обязаны
// совпадать с видимым текстом, а так они не разойдутся при правках.
const faq = [...views['view-home'].matchAll(/<div class="faq-item">\s*<h3>([\s\S]*?)<\/h3>\s*<p>([\s\S]*?)<\/p>\s*<\/div>/g)].map(
  (m) => ({ q: decode(m[1]), a: decode(m[2]) }),
);
if (faq.length < 6) throw new Error(`index.html: в блоке FAQ ${faq.length} вопросов, ожидалось 6+`);

function jsonLd() {
  const data = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${SITE}/#org`,
        name: 'ФИТА',
        alternateName: ['FITA', 'Фита'],
        url: `${SITE}/`,
        logo: `${SITE}/assets/fita-logo.jpg`,
        email: 'support@appfita.ru',
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE}/#website`,
        url: `${SITE}/`,
        name: 'ФИТА',
        inLanguage: 'ru-RU',
        publisher: { '@id': `${SITE}/#org` },
      },
      {
        '@type': 'MobileApplication',
        '@id': `${SITE}/#app`,
        name: 'ФИТА',
        alternateName: 'FITA',
        description:
          'ИИ-компаньон здоровья: разбирает сон, пульс, HRV, стресс и тренировочную нагрузку по данным Apple Watch, Garmin, Oura, Whoop и Fitbit, собирает домашний экран под пользователя и подключается к ИИ-ассистентам через MCP.',
        applicationCategory: 'HealthApplication',
        operatingSystem: 'iOS 16+, Android, Windows, macOS, Linux',
        inLanguage: 'ru',
        url: `${SITE}/`,
        installUrl: APP_STORE,
        downloadUrl: [APP_STORE, 'https://releases.appfita.ru/'],
        sameAs: [APP_STORE],
        isAccessibleForFree: true,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'RUB' },
        image: `${SITE}/assets/og.jpg`,
        publisher: { '@id': `${SITE}/#org` },
      },
      {
        '@type': 'FAQPage',
        '@id': `${SITE}/#faq`,
        inLanguage: 'ru-RU',
        mainEntity: faq.map(({ q, a }) => ({
          '@type': 'Question',
          name: q,
          acceptedAnswer: { '@type': 'Answer', text: a },
        })),
      },
    ],
  };
  return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;
}

// GitHub Pages не знает /space/ (со слэшем) и отдаёт 404. Для известных
// страниц 404.html сразу уводит на адрес без слэша.
const known = PAGES.filter((p) => p.path && p.path !== '/').map((p) => p.path);
const slashRedirect = `<script>(function(){var k=${JSON.stringify(known)},p=location.pathname.replace(/\\/+$/,'');if(p!==location.pathname&&k.indexOf(p)>=0)location.replace(p+location.search+location.hash);})();</script>`;

function headFor(page) {
  const url = page.path ? `${SITE}${page.path}` : null;
  const meta = [
    `<title>${esc(page.title)}</title>`,
    `<meta name="description" content="${esc(page.description)}">`,
    page.noindex ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${url}">`,
    page.noindex ? slashRedirect : '',
    page.app ? `<meta name="apple-itunes-app" content="app-id=${APP_STORE_ID}">` : '',
    '<meta property="og:type" content="website">',
    '<meta property="og:site_name" content="ФИТА">',
    '<meta property="og:locale" content="ru_RU">',
    `<meta property="og:title" content="${esc(page.title)}">`,
    `<meta property="og:description" content="${esc(page.description)}">`,
    url ? `<meta property="og:url" content="${url}">` : '',
    `<meta property="og:image" content="${SITE}/assets/og.jpg">`,
    '<meta property="og:image:width" content="1200">',
    '<meta property="og:image:height" content="675">',
    '<meta name="twitter:card" content="summary_large_image">',
    page.jsonld ? jsonLd() : '',
  ]
    .filter(Boolean)
    .join('\n');
  let h = head.replace(/<title>[\s\S]*?<\/title>/, meta);
  if (h === head) throw new Error('index.html: нет <title>');
  h = h.replace('<!--FONTS-->', fontHead[page.fonts]);
  return h;
}

// ── 6. Сборка страниц ──────────────────────────────────────────────────
const bodyClass = (view) =>
  view === 'view-home' ? 'route-home' : view === 'view-space' ? 'route-space' : 'route-doc';

for (const page of PAGES) {
  const body = page.keep
    .map((id) => {
      let v = views[id].replace(/ is-active"/, '"');
      if (id === page.view) v = v.replace(/class="view ([^"]*)"/, 'class="view $1 is-active"');
      // spa.js берёт document.title из data-title при переходах внутри страницы.
      const p = PAGES.find((x) => x.view === id);
      return v.replace(/data-title="[^"]*"/, `data-title="${esc(p.title)}"`);
    })
    .join('');

  // Правовые страницы и 404 — чистый текст, скрипты им не нужны.
  const scripts = page.app ? `${tailScripts}${appTags}\n` : '';

  const html =
    headFor(page) +
    `<body class="${bodyClass(page.view)}">\n` +
    body +
    footer +
    scripts +
    '</body>\n</html>\n';
  const h1 = (html.match(/<h1[\s>]/g) || []).length;
  if (h1 !== 1) throw new Error(`${page.file}: h1 должен быть ровно один, а их ${h1}`);
  fs.writeFileSync(path.join(OUT, page.file), html);
}

fs.copyFileSync(path.join(ROOT, 'spa.js'), path.join(OUT, 'spa.js'));

// ── 7. sitemap.xml ─────────────────────────────────────────────────────
// lastmod должен меняться, только когда меняется страница: дату сборки
// Google считает недостоверной и перестаёт учитывать lastmod у всего сайта.
//
// Правовые страницы берут дату из «Редакция от ДД.ММ.ГГГГ». Для главной
// и «Пространства» сравниваем видимый текст (+ title и description) новой
// сборки с тем, что сейчас на сайте: совпал — оставляем lastmod из живого
// sitemap, нет — ставим текущее время. Если сайт недоступен (сборка без
// сети) — дата последнего коммита по исходникам (в CI нужен fetch-depth: 0).
const textOf = (html) =>
  html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/g, ' ')
    .replace(/<title>([\s\S]*?)<\/title>/, ' $1 ')
    .replace(/<meta name="description" content="([^"]*)"[^>]*>/, ' $1 ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const textHash = (html) => crypto.createHash('sha256').update(textOf(html)).digest('hex');

async function fetchText(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
}

function gitDate(paths) {
  try {
    const d = execFileSync('git', ['log', '-1', '--format=%cI', '--', ...paths], { cwd: ROOT, encoding: 'utf8' }).trim();
    if (d) return d;
  } catch {}
  return new Date().toISOString().replace(/\.\d{3}Z$/, '+00:00');
}

const liveSitemap = await fetchText(`${SITE}/sitemap.xml`);
const liveLastmod = new Map(
  [...(liveSitemap ?? '').matchAll(/<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g)].map((m) => [m[1], m[2]]),
);
const now = new Date().toISOString().replace(/\.\d{3}Z$/, '+00:00');

async function lastmod(page) {
  const m = views[page.view].match(/Редакция от (\d{2})\.(\d{2})\.(\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  const url = `${SITE}${page.path}`;
  const live = liveLastmod.has(url) ? await fetchText(url) : null;
  if (!live) return gitDate(['index.html', 'spa.js', 'assets']);
  const fresh = fs.readFileSync(path.join(OUT, page.file), 'utf8');
  return textHash(live) === textHash(fresh) ? liveLastmod.get(url) : now;
}

const urls = [];
for (const p of PAGES.filter((x) => x.path)) {
  const mod = await lastmod(p);
  urls.push(`  <url><loc>${SITE}${p.path}</loc><lastmod>${mod}</lastmod></url>`);
  console.log(`sitemap ${p.path}: ${mod}`);
}
fs.writeFileSync(
  path.join(OUT, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`,
);

const size = (f) => (fs.statSync(path.join(OUT, f)).size / 1024).toFixed(0) + ' КБ';
console.log(PAGES.map((p) => `${p.file}: ${size(p.file)}`).join('\n'));
