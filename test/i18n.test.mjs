// Схема словаря и механизм перевода (scripts/i18n.mjs) без сборки.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { translateHtml, babelTranslate, checkTranslation } from '../scripts/i18n.mjs';

const require = createRequire(import.meta.url);
const Babel = require('@babel/standalone');

test('словарь: перевод не может принести разметку, код или чужие ссылки', () => {
  const ru = 'Для iPhone — в <a href="https://apps.apple.com/x" target="_blank">App Store</a>.';
  assert.equal(checkTranslation(ru, 'For iPhone — on the <a href="https://apps.apple.com/x" target="_blank">App Store</a>.', 'html'), null);
  for (const [bad, why] of [
    ['On the <a href="https://evil.test/" target="_blank">App Store</a>.', 'ссылка подменена'],
    ['On the <a href="https://apps.apple.com/x" target="_blank" onclick="x()">App Store</a>.', 'обработчик'],
    ['On the <a href="https://apps.apple.com/x" target="_blank">App Store</a>.<script>x()</script>', 'script'],
    ['On the App Store.', 'тег потерян'],
    ['На <a href="https://apps.apple.com/x" target="_blank">App Store</a>.', 'кириллица'],
    [' On the <a href="https://apps.apple.com/x" target="_blank">App Store</a>.', 'пробел по краю'],
  ]) assert.notEqual(checkTranslation(ru, bad, 'html'), null, why);
  assert.notEqual(checkTranslation('Шаги', 'Steps {alert(1)}', 'js'), null);
  assert.notEqual(checkTranslation('Шаги', 'Steps <img src=x>', 'js'), null);
  assert.notEqual(checkTranslation('Шаги', 'Steps &amp; more', 'js'), null);
  assert.notEqual(checkTranslation('Шаги', 'javascript:alert(1)', 'attr'), null);
  assert.notEqual(checkTranslation('П|В', 'M|T|W', 'array'), null);
  assert.equal(checkTranslation('П|В', 'M|T', 'array'), null);
  assert.equal(checkTranslation('сон&nbsp;и пульс', 'sleep&nbsp;and heart rate', 'html'), null);
});

test('готовый словарь i18n/en.json проходит схему целиком', () => {
  const dict = JSON.parse(fs.readFileSync(new URL('../i18n/en.json', import.meta.url), 'utf8'));
  for (const [k, v] of Object.entries(dict)) {
    assert.equal(checkTranslation(k, v, k.startsWith('array:') ? 'array' : 'html'), null, k.slice(0, 60));
  }
});

test('HTML: фраза со строчными тегами — одна единица, script/style/комментарии не трогаются', () => {
  const seen = [];
  const out = translateHtml('<div><p>Привет, <b>мир</b>!</p><img alt="Логотип"><script>var a="Да"</script><!-- Нет --></div>', (k) => {
    seen.push(k);
    return { 'Привет, <b>мир</b>!': 'Hello, <b>world</b>!', 'Логотип': 'Logo' }[k];
  });
  assert.deepEqual(seen.sort(), ['Логотип', 'Привет, <b>мир</b>!']);
  assert.equal(out, '<div><p>Hello, <b>world</b>!</p><img alt="Logo"><script>var a="Да"</script><!-- Нет --></div>');
});

test('JS: строки, JSX-текст, шаблоны, массивы целиком и числа в русской записи', () => {
  const dict = { 'Шаги': 'Steps', 'осталось': 'left', 'array:П|В|С': 'M|T|W', '8 432': '8,432', 'Сон': 'Sleep' };
  const code = Babel.transform("const a=<p>Шаги {n}</p>; const b=`${n} осталось`; const c=['П','В','С']; const d='8 432'; const e='0 0 400 10'; const f={label:'Сон'};", {
    presets: ['react'],
    plugins: [babelTranslate((k, kind, optional) => (Object.hasOwn(dict, k) ? dict[k] : optional ? null : `MISSING:${k}`))],
  }).code;
  for (const s of ['"Steps "', '} left`', '["M", "T", "W"]', '"8,432"', "'0 0 400 10'", 'label: "Sleep"']) assert.ok(code.includes(s), s);
  assert.doesNotMatch(code, /MISSING|[А-Яа-я]/);
});
