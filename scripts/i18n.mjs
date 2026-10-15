// Перевод сборки: словарь i18n/<locale>.json «русская строка → перевод»
// применяется к готовому HTML и к JS-литералам во время сборки. Исходник
// остаётся один (index.html, referral.js), перевод в браузере не грузится.
//
// Единица перевода:
//   HTML — текст между блочными тегами вместе со строчными (<b>, <a>, <br>…),
//          чтобы фраза со ссылкой переводилась целиком, плюс значения атрибутов
//          (alt, aria-label, content…) у остальных тегов;
//   JS   — строковые литералы, части шаблонных строк и текст внутри JSX.
// Ключ — строка без крайних пробелов; пробелы вокруг сохраняются.

export const CYR = /[А-Яа-яЁё]/;

const INLINE = new Set(['a', 'b', 'i', 'em', 'strong', 'br', 'span', 'small', 'code', 'sup', 'sub', 'nobr', 's', 'u', 'mark', 'abbr', 'time', 'q', 'wbr']);
const SKIP = /<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>|<!--[\s\S]*?-->/gi;
const TAG = /<\/?([a-zA-Z][\w:-]*)\b(?:[^>"']|"[^"]*"|'[^']*')*>/g;

const tagName = (t) => t.match(/^<\/?([a-zA-Z][\w:-]*)/)[1].toLowerCase();
const isClose = (t) => t.startsWith('</');
const isVoid = (t) => /^<(br|wbr)\b/i.test(t) || t.endsWith('/>');

// Обрезает с краёв пробелы и строчные теги без пары внутри фрагмента.
function trimRun(tokens) {
  const paired = (i) => {
    const t = tokens[i];
    if (isVoid(t.s)) return true;
    const name = tagName(t.s);
    let depth = 0;
    if (isClose(t.s)) {
      for (let j = i; j >= 0; j--) if (tokens[j].tag && tagName(tokens[j].s) === name) { depth += isClose(tokens[j].s) ? 1 : -1; if (!depth) return true; }
    } else {
      for (let j = i; j < tokens.length; j++) if (tokens[j].tag && tagName(tokens[j].s) === name) { depth += isClose(tokens[j].s) ? -1 : 1; if (!depth) return true; }
    }
    return false;
  };
  let a = 0, b = tokens.length;
  for (let changed = true; changed && a < b; ) {
    changed = false;
    const blank = (t) => !t.tag && !t.s.trim();
    if (blank(tokens[a]) || (tokens[a].tag && (isClose(tokens[a].s) || !paired(a)))) { a++; changed = true; continue; }
    if (blank(tokens[b - 1]) || (tokens[b - 1].tag && (!isClose(tokens[b - 1].s) ? !isVoid(tokens[b - 1].s) : !paired(b - 1)))) { b--; changed = true; }
  }
  return [a, b];
}

function translateRegion(html, fn) {
  // атрибуты блочных тегов
  html = html.replace(TAG, (t) => {
    if (INLINE.has(tagName(t))) return t;
    return t.replace(/(\s[\w:-]+=)"([^"]*)"/g, (m, k, v) => {
      if (!CYR.test(v)) return m;
      const r = fn(v.trim(), 'attr');
      return r == null ? m : k + '"' + v.replace(v.trim(), r.replace(/"/g, '&quot;')) + '"';
    });
  });
  // текстовые фрагменты
  const tokens = [];
  let last = 0;
  for (const m of html.matchAll(TAG)) {
    if (m.index > last) tokens.push({ s: html.slice(last, m.index) });
    tokens.push({ s: m[0], tag: true });
    last = m.index + m[0].length;
  }
  if (last < html.length) tokens.push({ s: html.slice(last) });
  let out = '';
  let run = [];
  const flush = () => {
    if (!run.length) return;
    const [a, b] = trimRun(run);
    const mid = run.slice(a, b).map((t) => t.s).join('');
    const key = mid.trim();
    const r = key && CYR.test(key) ? fn(key, 'html') : null;
    out += run.slice(0, a).map((t) => t.s).join('') + (r == null ? mid : mid.replace(key, () => r)) + run.slice(b).map((t) => t.s).join('');
    run = [];
  };
  for (const t of tokens) {
    if (t.tag && !INLINE.has(tagName(t.s))) {
      flush();
      out += t.s;
    } else run.push(t);
  }
  flush();
  return out;
}

// HTML-документ или его часть: script/style/комментарии не трогаем.
export function translateHtml(html, fn) {
  let out = '';
  let last = 0;
  for (const m of html.matchAll(SKIP)) {
    out += translateRegion(html.slice(last, m.index), fn) + m[0];
    last = m.index + m[0].length;
  }
  return out + translateRegion(html.slice(last), fn);
}

// Babel-плагин: те же замены для JS/JSX. fn(key) → перевод или null.
export function babelTranslate(fn) {
  const swap = (s, set) => {
    const key = s.trim();
    if (!key) return;
    // числа в русской записи без кириллицы («8 432»): только если есть в словаре
    if (!CYR.test(key)) {
      const r = /\d/.test(key) && key.length < 40 ? fn(key, 'js', true) : null;
      if (r != null) set(s.replace(key, () => r));
      return;
    }
    // целая HTML-разметка в строке (srcdoc у iframe) — переводим её по фрагментам
    if (/<(style|div|body|p|section|span)\b/i.test(key)) return set(translateHtml(s, fn));
    const r = fn(key, 'js');
    if (r != null) set(s.replace(key, () => r));
  };
  return () => ({
    visitor: {
      // Массив коротких строк, который нельзя перевести поэлементно
      // (['П','В','С','Ч','П','С','В'] — П это и пн, и пт): ключ «array:П|В|…».
      ArrayExpression(p) {
        const els = p.node.elements;
        if (!els.length || !els.every((e) => e && e.type === 'StringLiteral') || !els.some((e) => CYR.test(e.value))) return;
        const r = fn('array:' + els.map((e) => e.value).join('|'), 'array', true);
        if (r == null) return;
        const parts = r.split('|');
        if (parts.length !== els.length) throw new Error(`перевод массива: ${els.length} элементов, а в переводе ${parts.length}`);
        els.forEach((e, i) => { e.value = parts[i]; delete e.extra; });
        p.skip();
      },
      StringLiteral(p) {
        swap(p.node.value, (v) => { p.node.value = v; delete p.node.extra; });
      },
      JSXText(p) {
        swap(p.node.value, (v) => { p.node.value = v; delete p.node.extra; });
      },
      TemplateElement(p) {
        swap(p.node.value.cooked, (v) => { p.node.value = { cooked: v, raw: v.replace(/\\|`|\$\{/g, (c) => '\\' + c) }; });
      },
    },
  });
}

// Схема словаря. Перевод попадает в HTML и JS как есть, поэтому он не может
// принести свою разметку или код: теги — байт в байт как в оригинале, вне
// тегов столько же символов {}<>, сущности только из оригинала. Возвращает
// текст ошибки или null.
export function checkTranslation(ru, en, kind) {
  if (typeof en !== 'string' || !en.trim()) return 'пустой перевод';
  if (en !== en.trim()) return 'пробелы по краям';
  if (CYR.test(en)) return 'кириллица в переводе';
  if (/javascript:|\son\w+\s*=|<\/?script|<\/?style|<iframe/i.test(en) && !/javascript:|\son\w+\s*=|<\/?script|<\/?style|<iframe/i.test(ru)) return 'код в переводе';
  const tags = (x) => [...x.matchAll(TAG)].map((m) => m[0]).sort().join('\n');
  if (tags(ru) !== tags(en)) return 'теги или атрибуты отличаются от оригинала';
  const loose = (x) => (x.replace(TAG, '').match(/[{}<>`|]/g) || []).sort().join('');
  if (loose(ru) !== loose(en)) return 'лишние {}<>`| вне тегов';
  const ents = (x) => x.match(/&#?\w+;/g) || [];
  if (ents(en).some((e) => !ents(ru).includes(e))) return 'сущность, которой нет в оригинале';
  if (kind === 'array' && en.split('|').length !== ru.split('|').length) return 'другое число элементов массива';
  return null;
}

export function sameMarkup(ru, en) {
  const tags = (s) => [...s.matchAll(TAG)].map((m) => tagName(m[0]) + (isClose(m[0]) ? '/' : '')).sort().join(',');
  const hrefs = (s) => [...s.matchAll(/href="([^"]*)"/g)].map((m) => m[1]).sort().join(',');
  return tags(ru) === tags(en) && hrefs(ru) === hrefs(en);
}
