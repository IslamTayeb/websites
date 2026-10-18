// Inline scripts shared by every page. They run before the body is parsed
// (theme) or right after it (pageview), and are the site's only client code.

export const themeScript = `
(function () {
  function currentTheme() {
    return document.documentElement.classList.contains('dark')
      ? 'dark'
      : 'light';
  }

  var harmoniaOrigin = 'https://islamtayeb.github.io';

  // Harmonia embeds restyle themselves from a postMessage, so a theme change
  // never reloads them. Each embed announces itself once its plot is drawn.
  function postHarmoniaTheme(iframe) {
    var theme = currentTheme();
    iframe.setAttribute('data-harmonia-theme', theme);

    if (iframe.contentWindow) {
      iframe.contentWindow.postMessage({ harmoniaTheme: theme }, harmoniaOrigin);
    }
  }

  function syncHarmoniaIframes() {
    document
      .querySelectorAll('iframe[data-harmonia-iframe="true"]')
      .forEach(postHarmoniaTheme);
  }

  function applySavedTheme() {
    try {
      var saved = window.localStorage.getItem('theme');
      var theme =
        saved === 'light' || saved === 'dark'
          ? saved
          : window.matchMedia('(prefers-color-scheme: dark)').matches
            ? 'dark'
            : 'light';
      var root = document.documentElement;
      root.classList.remove('light', 'dark');
      root.classList.add(theme);
      root.style.colorScheme = theme;
    } catch (_) {
      document.documentElement.classList.add('light');
      document.documentElement.style.colorScheme = 'light';
    }
  }

  applySavedTheme();

  // A page prerendered on hover may open after the theme was toggled.
  document.addEventListener('prerenderingchange', function () {
    applySavedTheme();
    syncHarmoniaIframes();
  });

  window.addEventListener('message', function (event) {
    if (
      event.origin !== harmoniaOrigin ||
      !event.data ||
      event.data.harmoniaReady !== true
    ) {
      return;
    }

    document
      .querySelectorAll('iframe[data-harmonia-iframe="true"]')
      .forEach(function (iframe) {
        if (iframe.contentWindow === event.source) {
          postHarmoniaTheme(iframe);
        }
      });
  });

  function applyTheme(theme) {
    var root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    root.style.colorScheme = theme;
    try {
      window.localStorage.setItem('theme', theme);
    } catch (_) {}
    syncHarmoniaIframes();
  }

  document.addEventListener('click', function (event) {
    if (event.target.closest && event.target.closest('[data-theme-toggle]')) {
      applyTheme(currentTheme() === 'dark' ? 'light' : 'dark');
    }
  });

  // The page stays hidden (see the layout's gate style) until its fonts are
  // in, so the first frame a visitor sees is the finished page instead of a
  // fallback font that re-wraps when Open Sans arrives. Embeds start loading
  // only after that, so they never compete with the fonts for bandwidth, and
  // they get the theme in their URL so they never draw in the wrong one.
  var revealed = false;

  function startHarmoniaIframes() {
    document
      .querySelectorAll('iframe[data-harmonia-src]')
      .forEach(function (iframe) {
        iframe.src =
          iframe.getAttribute('data-harmonia-src') + '?theme=' + currentTheme();
        iframe.removeAttribute('data-harmonia-src');
      });
  }

  function reveal() {
    revealed = true;
    document.documentElement.classList.add('ready');

    if (document.readyState !== 'loading') {
      startHarmoniaIframes();
    }
  }

  window.setTimeout(reveal, 3000);
  document.addEventListener('DOMContentLoaded', function () {
    if (revealed) {
      startHarmoniaIframes();
      return;
    }

    // Lay the page out now so every font it uses has started loading.
    void document.body.offsetHeight;
    document.fonts.ready.then(reveal, reveal);
  });
})();
`;

const endpoint = '/api/pageview';

export const pageviewScript = `
(function () {
  var endpoint = ${JSON.stringify(endpoint)};
  var clientKey = 'site_visit_client_id';
  var sessionKey = 'site_visit_session_id';
  var lastPath = '';
  var firstVisit = false;

  function randomId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }

    return String(Date.now()) + '-' + Math.random().toString(16).slice(2);
  }

  function storedId(storage, key) {
    try {
      var existing = storage.getItem(key);

      if (existing) {
        return existing;
      }

      var next = randomId();
      storage.setItem(key, next);

      if (key === clientKey) {
        firstVisit = true;
      }

      return next;
    } catch (_) {
      return randomId();
    }
  }

  function size(width, height) {
    return Math.round(width) + 'x' + Math.round(height);
  }

  function payload(reason) {
    var clientId = storedId(window.localStorage, clientKey);
    var sessionId = storedId(window.sessionStorage, sessionKey);

    return {
      kind: 'pageview',
      eventId: randomId(),
      path: window.location.pathname + window.location.search,
      title: document.title || 'Untitled',
      referrer: document.referrer || 'direct',
      clientId: clientId,
      sessionId: sessionId,
      firstVisit: firstVisit,
      viewport: size(window.innerWidth || 0, window.innerHeight || 0),
      screen: size(window.screen ? window.screen.width : 0, window.screen ? window.screen.height : 0),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown',
      language: navigator.language || 'unknown',
      reason: reason,
      at: new Date().toISOString()
    };
  }

  function send(reason) {
    var path = window.location.pathname + window.location.search;

    if (document.visibilityState === 'prerender' || path === lastPath) {
      return;
    }

    lastPath = path;

    var body = JSON.stringify(payload(reason));

    if (navigator.sendBeacon) {
      var queued = navigator.sendBeacon(
        endpoint,
        new Blob([body], { type: 'application/json' })
      );

      if (queued) {
        firstVisit = false;
        return;
      }
    }

    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body,
      credentials: 'same-origin',
      keepalive: true
    }).catch(function () {});

    firstVisit = false;
  }

  function schedule(reason) {
    window.setTimeout(function () {
      send(reason);
    }, 0);
  }

  function wrapHistory(method) {
    var original = window.history[method];

    window.history[method] = function () {
      var result = original.apply(this, arguments);
      schedule(method);
      return result;
    };
  }

  wrapHistory('pushState');
  wrapHistory('replaceState');
  window.addEventListener('popstate', function () {
    schedule('popstate');
  });

  function start() {
    // Pages prerendered on hover count only once they are actually opened.
    if (document.prerendering) {
      document.addEventListener(
        'prerenderingchange',
        function () {
          schedule('load');
        },
        { once: true }
      );
    } else {
      schedule('load');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
`;

// Chrome and Edge prerender a site page when its link is hovered or pressed,
// so the click shows the finished page at once. Other browsers ignore this.
export const speculationRules = JSON.stringify({
  prerender: [
    {
      where: {
        and: [
          {
            or: [
              { href_matches: '/' },
              { href_matches: '/blog' },
              { href_matches: '/blog/*' },
            ],
          },
          { not: { href_matches: '/blog/*.xml' } },
        ],
      },
      eagerness: 'moderate',
    },
  ],
});
