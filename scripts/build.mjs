// Сборка сайта в _site/: по отдельному HTML на каждую страницу.
//
// Исходник остаётся один — index.html со всеми view. Раньше GitHub Pages
// отдавал /space, /privacy и остальные адреса через 404.html (статус 404),
// поэтому ни Яндекс, ни Google их не индексировали. Теперь у каждой страницы
// свой файл со статусом 200, своим <head> и текстом прямо в HTML.
//
// Заодно JSX компилируется здесь, а не в браузере: Babel standalone и React
// с unpkg.com больше не грузятся (unpkg стоит на Cloudflare, который в РФ режут).

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

const PAGES = [
  {
    file: 'index.html',
    path: '/',
    view: 'view-home',
    keep: ['view-home', 'view-space'],
    app: true,
    title: 'ФИТА — ИИ-компаньон здоровья: сон, пульс, восстановление',
    description:
      'Фита разбирает сон, пульс, HRV и нагрузку по данным Apple Watch, Garmin, Oura и Whoop и подсказывает, когда тренироваться, а когда восстановиться.',
    jsonld: true,
  },
  {
    file: 'space.html',
    path: '/space',
    view: 'view-space',
    keep: ['view-home', 'view-space'],
    app: true,
    title: 'Пространство Фиты — экран, который собирается под тебя',
    description:
      'Виджеты, темы и чат с памятью: Фита собирает домашний экран под твой ритм и помнит прошлые разговоры. Соберите свой экран прямо на сайте.',
  },
  {
    file: 'privacy.html',
    path: '/privacy',
    view: 'view-privacy',
    keep: ['view-privacy'],
    title: 'Политика конфиденциальности — ФИТА',
    description:
      'Как приложение ФИТА обрабатывает и защищает персональные данные и данные о здоровье: состав данных, цели, сроки хранения и права пользователя.',
  },
  {
    file: 'consent.html',
    path: '/consent',
    view: 'view-consent',
    keep: ['view-consent'],
    title: 'Согласие на обработку персональных данных — ФИТА',
    description:
      'Текст согласия на обработку персональных данных пользователей приложения ФИТА: перечень данных, цели, действия с ними и порядок отзыва.',
  },
  {
    file: 'terms.html',
    path: '/terms',
    view: 'view-terms',
    keep: ['view-terms'],
    title: 'Условия использования — ФИТА',
    description:
      'Условия использования приложения ФИТА и правила сообщества: клубы, события, контент пользователей и ответственность сторон.',
  },
  {
    file: '404.html',
    path: null,
    view: 'view-404',
    keep: ['view-404'],
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

// ── 1. Встроенные base64-картинки → файлы ──────────────────────────────
const MIME_EXT = { png: 'png', jpeg: 'jpg', webp: 'webp', gif: 'gif', 'svg+xml': 'svg' };
src = src.replace(/data:image\/(png|jpeg|webp|gif|svg\+xml);base64,([A-Za-z0-9+/=]+)/g, (m, sub, b64) => {
  if (m.length < 4096) return m; // мелочь (иконки) пусть остаётся inline
  return writeHashed('assets/inline', 'img', MIME_EXT[sub], Buffer.from(b64, 'base64'));
});

// ── 2. JSX → JS с теми же настройками, что у Babel standalone в браузере ──
// Пресеты и плагины скопированы из buildBabelOptions() @babel/standalone 7.29,
// чтобы результат совпадал с тем, что раньше выполнялось на странице.
const BABEL_OPTS = {
  filename: 'Inline Babel script',
  presets: ['react', 'env'],
  plugins: ['transform-class-properties', 'transform-object-rest-spread', 'transform-flow-strip-types'],
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

// ── 3. Разрезаем body на view ──────────────────────────────────────────
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

// ── 4. head для каждой страницы ────────────────────────────────────────
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
        operatingSystem: 'iOS, Android, Windows, macOS, Linux',
        inLanguage: 'ru',
        url: `${SITE}/`,
        downloadUrl: 'https://releases.appfita.ru/',
        image: `${SITE}/assets/og.jpg`,
        publisher: { '@id': `${SITE}/#org` },
      },
    ],
  };
  return `<script type="application/ld+json">${JSON.stringify(data)}</script>`;
}

function headFor(page) {
  const url = page.path ? `${SITE}${page.path}` : null;
  const meta = [
    `<title>${esc(page.title)}</title>`,
    `<meta name="description" content="${esc(page.description)}">`,
    page.noindex ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${url}">`,
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
  const h = head.replace(/<title>[\s\S]*?<\/title>/, meta);
  if (h === head) throw new Error('index.html: нет <title>');
  return h;
}

// ── 5. Сборка страниц ──────────────────────────────────────────────────
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
  fs.writeFileSync(path.join(OUT, page.file), html);
}

fs.copyFileSync(path.join(ROOT, 'spa.js'), path.join(OUT, 'spa.js'));

// ── 6. sitemap.xml ─────────────────────────────────────────────────────
// lastmod должен меняться, только когда меняется страница: дату сборки
// Google считает недостоверной и перестаёт учитывать lastmod у всего сайта.
// Правовые страницы берут дату из «Редакция от ДД.ММ.ГГГГ», остальные —
// из последнего коммита, который трогал их исходники (в CI нужен fetch-depth: 0).
const today = new Date().toISOString().slice(0, 10);
function gitDate(paths) {
  try {
    return execFileSync('git', ['log', '-1', '--format=%cI', '--', ...paths], { cwd: ROOT, encoding: 'utf8' }).trim() || today;
  } catch {
    return today;
  }
}
function lastmod(page) {
  const m = views[page.view].match(/Редакция от (\d{2})\.(\d{2})\.(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : gitDate(['index.html', 'spa.js', 'assets']);
}
const urls = PAGES.filter((p) => p.path)
  .map((p) => `  <url><loc>${SITE}${p.path}</loc><lastmod>${lastmod(p)}</lastmod></url>`)
  .join('\n');
fs.writeFileSync(
  path.join(OUT, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
);

const size = (f) => (fs.statSync(path.join(OUT, f)).size / 1024).toFixed(0) + ' КБ';
console.log(PAGES.map((p) => `${p.file}: ${size(p.file)}`).join('\n'));
