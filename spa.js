/**
 * FITA site router (History API / BrowserRouter-style).
 * Routes: /, /privacy, /consent — everything else → 404 view.
 */
(function () {
  var ROUTES = {
    '/': 'view-home',
    '/index.html': 'view-home',
    '/privacy': 'view-privacy',
    '/privacy.html': 'view-privacy',
    '/consent': 'view-consent',
    '/consent.html': 'view-consent'
  };

  var CANONICAL = {
    '/index.html': '/',
    '/privacy.html': '/privacy',
    '/consent.html': '/consent'
  };

  function normalizePath(pathname) {
    if (!pathname) return '/';
    var p = pathname.replace(/\/+$/, '') || '/';
    return p;
  }

  function resolve(pathname) {
    var path = normalizePath(pathname);
    if (CANONICAL[path]) {
      path = CANONICAL[path];
    }
    var id = ROUTES[path] || ROUTES[pathname];
    return { path: path, viewId: id || 'view-404', known: !!id };
  }

  function render(pathname, opts) {
    opts = opts || {};
    var resolved = resolve(pathname);
    var path = resolved.path;

    if (opts.replaceCanonical && CANONICAL[normalizePath(pathname)]) {
      history.replaceState(null, '', path);
    }

    var views = document.querySelectorAll('.view');
    for (var i = 0; i < views.length; i++) {
      views[i].classList.toggle('is-active', views[i].id === resolved.viewId);
    }

    var active = document.getElementById(resolved.viewId);
    document.title = (active && active.getAttribute('data-title')) || 'FITA';
    document.body.classList.toggle('route-home', resolved.viewId === 'view-home');
    document.body.classList.toggle('route-doc', resolved.viewId !== 'view-home');

    if (opts.scroll !== false) {
      window.scrollTo(0, 0);
    }
  }

  function navigate(path, replace) {
    var url = path;
    if (replace) history.replaceState(null, '', url);
    else history.pushState(null, '', url);
    render(url);
  }

  function isInternalLink(a) {
    if (!a || a.target === '_blank' || a.hasAttribute('download')) return false;
    var href = a.getAttribute('href');
    if (!href || href.charAt(0) === '#' || href.indexOf('mailto:') === 0 || href.indexOf('tel:') === 0) {
      return false;
    }
    try {
      var url = new URL(a.href, location.origin);
      if (url.origin !== location.origin) return false;
      return true;
    } catch (e) {
      return false;
    }
  }

  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a');
    if (!a || !isInternalLink(a)) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(a.pathname + a.search + a.hash);
  });

  window.addEventListener('popstate', function () {
    render(location.pathname + location.search + location.hash, { scroll: true });
  });

  // Initial route (after possible 404.html sessionStorage restore in index.html)
  render(location.pathname + location.search + location.hash, { replaceCanonical: true });

  window.FITA_NAVIGATE = navigate;
})();
