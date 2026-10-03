/**
 * Site search, progressive enhancement.
 *
 * The header ships a real <form> that GETs to /search/, so search works with
 * JavaScript disabled. This script upgrades it to an instant dropdown, and on
 * /search/ it takes over filtering the results list without a page load.
 *
 * No framework, no dependencies. The index is fetched once from
 * /search-index.json on first use.
 */
(function () {
  'use strict';

  function norm(s) {
    return s
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s/-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  var LABELS = { service: 'Service', family: 'Service', post: 'Blog', suburb: 'Suburb' };

  // The index is ~115 KB, far too big to inline into all 2,800+ pages. Fetch it
  // once on first interaction; every surface shares the same promise so the
  // navbar dropdown and the /search/ page never fetch twice.
  var indexPromise = null;
  function loadIndex() {
    if (!indexPromise) {
      indexPromise = fetch('/search-index.json')
        .then(function (r) {
          if (!r.ok) throw new Error('search index ' + r.status);
          return r.json();
        })
        .catch(function () {
          indexPromise = null;
          return [];
        });
    }
    return indexPromise;
  }

  function score(hit, tokens, q) {
    var s = 0;
    for (var i = 0; i < tokens.length; i++) {
      if (hit.t.toLowerCase().indexOf(tokens[i]) !== -1) s += 5;
      if (hit.k.indexOf(tokens[i]) !== -1) s += 2;
      if (hit.u.indexOf(tokens[i]) !== -1) s += 1;
    }
    if (hit.t.toLowerCase().indexOf(q) === 0) s += 4;
    return s;
  }

  // ---------------------------------------------------------------- navbar
  function initNavbar() {
    // Desktop and mobile each have their own form, so wire up every one
    // instead of only the first.
    var forms = document.querySelectorAll('[data-search-form]');
    for (var i = 0; i < forms.length; i++) initOne(forms[i]);
  }

  function initOne(form) {
    var input = form.querySelector('input[type="search"]');
    // Each form owns its results panel; querying the document would bind both
    // inputs to the desktop panel.
    var results = form.querySelector('[data-search-results]');
    if (!input || !results) return;

    var timer = null;
    var active = -1;

    function close() {
      results.hidden = true;
      results.innerHTML = '';
      active = -1;
      input.setAttribute('aria-expanded', 'false');
    }

    function render(q, index) {
      var tokens = q.split(' ').filter(function (t) {
        return t.length >= 2;
      });
      if (tokens.length === 0) return close();

      var nq = norm(q);
      var scored = index
        .map(function (h) {
          var s = score(h, tokens, nq);
          return s > 0 ? { h: h, s: s } : null;
        })
        .filter(Boolean)
        .sort(function (a, b) {
          return b.s - a.s;
        })
        .slice(0, 7);

      if (!scored.length) {
        results.hidden = false;
        input.setAttribute('aria-expanded', 'true');
        results.innerHTML =
          '<p class="px-4 py-3 text-sm text-ink-500">No match. Try "virus", "slow", or "data recovery".</p>';
        return;
      }

      var html = '';
      for (var i = 0; i < scored.length; i++) {
        var h = scored[i].h;
        html +=
          '<li><a href="' +
          h.u +
          '" class="flex items-baseline justify-between gap-3 px-4 py-2.5 hover:bg-brand-500/10">' +
          '<span class="text-sm font-semibold text-ink-900">' +
          h.t +
          '</span><span class="shrink-0 text-xs text-ink-400">' +
          (LABELS[h.ty] || '') +
          '</span></a></li>';
      }
      html +=
        '<li><a href="/search/?q=' +
        encodeURIComponent(q) +
        '" class="block px-4 py-2.5 text-center text-sm font-semibold text-brand-300 hover:bg-brand-500/10">All results</a></li>';
      results.innerHTML = '<ul class="py-1">' + html + '</ul>';
      results.hidden = false;
      input.setAttribute('aria-expanded', 'true');
      active = -1;
    }

    input.addEventListener('input', function () {
      var q = input.value;
      clearTimeout(timer);
      timer = setTimeout(function () {
        if (q.trim().length < 2) return close();
        loadIndex().then(function (index) {
          if (input.value.trim().length >= 2) render(q, index);
        });
      }, 120);
    });

    input.addEventListener('focus', function () {
      if (input.value.trim().length >= 2) {
        loadIndex().then(function (index) {
          render(input.value, index);
        });
      }
    });

    input.addEventListener('keydown', function (e) {
      var links = results.querySelectorAll('a');
      if (e.key === 'Escape') {
        close();
        // Focus may be on a result link that is about to be hidden.
        input.focus();
        return;
      }
      if (!links.length) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        active += e.key === 'ArrowDown' ? 1 : -1;
        if (active < 0) active = links.length - 1;
        if (active >= links.length) active = 0;
        for (var i = 0; i < links.length; i++) links[i].classList.remove('bg-brand-500/10');
        links[active].classList.add('bg-brand-500/10');
        links[active].focus();
      }
    });

    document.addEventListener('click', function (e) {
      if (!form.contains(e.target) && !results.contains(e.target)) close();
    });

    form.addEventListener('submit', function (e) {
      // Let the form navigate when JS has nothing to show, otherwise take over.
      if (results.hidden || !input.value.trim()) return;
      e.preventDefault();
      window.location.href = '/search/?q=' + encodeURIComponent(input.value.trim());
    });
  }

  // -------------------------------------------------------- /search/ page
  function initSearchPage() {
    var page = document.querySelector('[data-search-page]');
    if (!page) return;
    var input = page.querySelector('input[type="search"]');
    var list = page.querySelector('[data-search-list]');
    var status = page.querySelector('[data-search-status]');
    var count = page.querySelector('[data-search-count]');
    if (!input || !list) return;

    var params = new URLSearchParams(window.location.search);
    var initial = params.get('q') || '';
    input.value = initial;

    function run(q, index) {
      var nq = norm(q);
      var tokens = nq.split(' ').filter(function (t) {
        return t.length >= 2;
      });

      if (tokens.length === 0) {
        list.innerHTML = '';
        if (count) count.textContent = '';
        if (status) status.textContent = 'Type at least two characters.';
        return;
      }

      var scored = index
        .map(function (h) {
          var s = score(h, tokens, nq);
          return s > 0 ? { h: h, s: s } : null;
        })
        .filter(Boolean)
        .sort(function (a, b) {
          return b.s - a.s;
        });

      if (count) count.textContent = String(scored.length);
      if (!scored.length) {
        list.innerHTML = '';
        if (status) {
          status.textContent = 'Nothing matched. Try a different word, or browse all services.';
        }
        return;
      }

      var html = '';
      for (var i = 0; i < scored.length; i++) {
        var h = scored[i].h;
        var d = h.d
          ? '<p class="mt-1 text-sm text-ink-600">' +
            h.d.replace(/<[^>]+>/g, '').slice(0, 160) +
            '</p>'
          : '';
        html +=
          '<li class="rounded-card border border-ink-200 bg-white/[0.06] p-5">' +
          '<div class="flex flex-wrap items-baseline justify-between gap-2">' +
          '<a href="' + h.u + '" class="text-lg font-bold text-ink-900 hover:text-brand-300">' + h.t + '</a>' +
          '<span class="text-xs font-semibold text-ink-400">' + (LABELS[h.ty] || '') + '</span>' +
          '</div>' + d + '</li>';
      }
      list.innerHTML = html;
      if (status) status.textContent = '';
    }

    var t = null;
    input.addEventListener('input', function () {
      var q = input.value;
      clearTimeout(t);
      t = setTimeout(function () {
        loadIndex().then(function (index) {
          run(q, index);
          var u = new URL(window.location.href);
          if (q) u.searchParams.set('q', q);
          else u.searchParams.delete('q');
          window.history.replaceState({}, '', u);
        });
      }, 140);
    });

    loadIndex().then(function (index) {
      run(initial, index);
    });
  }

  initNavbar();
  initSearchPage();
})();