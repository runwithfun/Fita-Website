// Сообщает Яндексу и Bing (через IndexNow) об изменившихся страницах.
//
// Запускается в CI после деплоя: node scripts/indexnow.mjs <старый sitemap> <новый sitemap>
// Старый sitemap скачивается с сайта до деплоя. Отправляются только адреса,
// у которых изменился lastmod или которых раньше не было: IndexNow просит
// не слать неизменившиеся страницы.
//
// Ключ подтверждается файлом /<ключ>.txt в корне сайта.

import fs from 'node:fs';
import path from 'node:path';

const HOST = 'appfita.ru';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const ENDPOINTS = ['https://yandex.com/indexnow', 'https://api.indexnow.org/indexnow'];

const [prevFile, nextFile] = process.argv.slice(2);

function parse(file) {
  if (!file || !fs.existsSync(file)) return new Map();
  const xml = fs.readFileSync(file, 'utf8');
  const map = new Map();
  for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g)) map.set(m[1], m[2]);
  return map;
}

const prev = parse(prevFile);
const next = parse(nextFile);
const changed = [...next].filter(([url, mod]) => prev.get(url) !== mod).map(([url]) => url);

if (!changed.length) {
  console.log('IndexNow: изменений нет');
  process.exit(0);
}

const keyFile = fs.readdirSync(ROOT).find((f) => /^[0-9a-f]{32}\.txt$/.test(f));
if (!keyFile) throw new Error('IndexNow: нет файла ключа <ключ>.txt в корне');
const key = keyFile.slice(0, -4);

const body = JSON.stringify({
  host: HOST,
  key,
  keyLocation: `https://${HOST}/${keyFile}`,
  urlList: changed,
});

console.log(`IndexNow: ${changed.length} адрес(ов)\n${changed.join('\n')}`);
for (const url of ENDPOINTS) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body,
  });
  // 200 и 202 — принято; 202 значит, что ключ ещё проверяется.
  console.log(`${url} → ${res.status}`);
}
