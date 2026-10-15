/**
 * FITA — приглашение на главной: appfita.ru/?ref=CODE (сюда же 404.html
 * уводит /r/CODE).
 *
 * Код берёт analytics.js (только A-Z0-9) и хранит 7 дней в этом браузере.
 * Здесь — показать под кнопками скачивания блок с кодом, проверить код в ядре
 * (GET /v1/referrals/resolve/<code>) и дать ссылку в установленное приложение:
 *   https://link.appfita.ru/r/CODE?visitor_id=UUID
 * visitor_id в ссылке — только чтобы приложение передало его ядру при
 * регистрации; в аналитику этот URL не уходит.
 *
 * Кнопка есть, только если сборка задала data-app-link (FITA_APP_REFERRAL_LINK,
 * по умолчанию выключено: текущее приложение /r/<code> не разбирает). Без неё
 * код просто показан и копируется — без обещаний, что приложение его примет.
 *
 * Чего здесь нет: передачи кода через установку из App Store (deferred deep
 * link). Засчитывает приглашение только ядро — по факту регистрации.
 */
(function (w) {
  'use strict';
  var d = w.document;
  var tag = d.currentScript;
  var a = w.FITA_ANALYTICS;
  var cta = d.querySelector('#view-home .hero-cta');
  var code = a && a.referral();
  if (!cta || !code) return;

  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

  function node(name, attrs, text) {
    var e = d.createElement(name), k;
    for (k in attrs) e.setAttribute(k, attrs[k]);
    if (text) e.textContent = text; // только textContent: код и ответ ядра не попадают в HTML
    return e;
  }

  var box = node('div', { class: 'hero-ref', role: 'status' });
  var title = box.appendChild(node('p', { class: 'hero-meta' }, 'Вас пригласили в ФИТА · код '));
  title.appendChild(node('b', {}, code));
  var row = box.appendChild(node('div', { class: 'hero-cta' }));

  // Шаблон оканчивается на {code} (проверяет сборка); без атрибута кнопки нет.
  var tpl = tag && tag.getAttribute('data-app-link');
  if (tpl) {
    var vid = a.visitorId();
    var href = tpl.replace('{code}', encodeURIComponent(code)) + (vid && UUID.test(vid) ? '?visitor_id=' + vid : '');
    row.appendChild(node('a', { class: 'as', href: href }, 'Открыть в приложении'));
  }
  // Без Clipboard API (http, старые браузеры) кнопки нет: код виден и выделяется.
  if (w.navigator.clipboard && w.isSecureContext) {
    var copy = row.appendChild(node('button', { type: 'button', class: 'more' }, 'Скопировать код'));
    copy.addEventListener('click', function () {
      w.navigator.clipboard.writeText(code).then(function () { copy.textContent = 'Скопировано'; }, function () {});
    });
  }
  var hint = box.appendChild(node('p', { class: 'hero-meta' },
    tpl
      ? 'ФИТА уже установлена — откройте её по кнопке. Ещё нет — установите, вернитесь к этой ссылке и нажмите «Открыть в приложении».'
      : 'Приложение пока не принимает приглашения — это появится в одном из следующих обновлений. Сохраните код, чтобы воспользоваться им позже.'));
  cta.parentNode.insertBefore(box, cta.nextSibling);

  if (!a.api || typeof w.fetch !== 'function') return;
  w.fetch(a.api + '/v1/referrals/resolve/' + encodeURIComponent(code), { credentials: 'omit' })
    .then(function (r) {
      if (r.status !== 404) return;
      a.forgetReferral();
      while (row.firstChild) row.removeChild(row.firstChild);
      title.textContent = 'Это приглашение недействительно или устарело.';
      hint.textContent = 'ФИТА можно установить и без него.';
    })
    .catch(function () {/* ядро недоступно — код всё равно показан */});
})(window);
