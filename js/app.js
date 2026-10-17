/*
 * Arranque de la aplicación: navegación por secciones (#/ruta), menú lateral,
 * indicador de guardado, avisos generales y atajos de teclado.
 */
(function (App) {
  'use strict';

  const U = App.util;
  const C = App.C;
  const S = App.store;
  const UI = App.ui;
  const h = U.h;

  const NAV = [
    { route: 'inicio', label: 'Inicio', icon: 'home' },
    { route: 'tareas', label: 'Mis tareas', icon: 'tasks', count: () => { const s = S.taskStats(); return s.pendiente + s['en-progreso']; }, countLabel: 'sin completar' },
    { route: 'herramientas', label: 'Herramientas', icon: 'tools' },
    { route: 'aprendizaje', label: 'Aprendizaje', icon: 'book' },
    { route: 'prompts', label: 'Biblioteca de prompts', icon: 'prompt' },
    { route: 'proyectos', label: 'Proyectos', icon: 'projects', count: () => S.visible('projects').filter((p) => p.status === 'activo').length, countLabel: 'activos' },
    { route: 'recursos', label: 'Recursos', icon: 'link' },
    { route: 'configuracion', label: 'Configuración', icon: 'settings' }
  ];

  let current = { route: 'inicio', params: [] };
  let refreshQueued = false;
  const els = {};
  const mobileQuery = window.matchMedia('(max-width: 900px)');

  // --------------------------------------------------------------- Navegación
  function parseHash() {
    const raw = location.hash.replace(/^#\/?/, '');
    const parts = raw.split('/').filter(Boolean).map((p) => { try { return decodeURIComponent(p); } catch (e) { return p; } });
    return { route: parts[0] || 'inicio', params: parts.slice(1) };
  }

  function navigate(path) {
    if (location.hash === '#/' + path) refresh();
    else location.hash = '#/' + path;
  }

  function flushView() {
    const view = App.views[current.route];
    if (view && typeof view.flush === 'function') {
      try { view.flush(); } catch (e) { console.error(e); }
    }
  }

  function closeDialogs() {
    document.querySelectorAll('dialog[open]').forEach((d) => d.close());
  }

  function onHashChange() {
    flushView();
    closeDialogs();
    current = parseHash();
    setNavOpen(false, false);
    render(true);
  }

  // ------------------------------------------------------------------ Render
  function captureFocus() {
    const el = document.activeElement;
    if (!el || !els.main.contains(el) || !el.dataset || !el.dataset.fk) return null;
    return {
      fk: el.dataset.fk,
      start: typeof el.selectionStart === 'number' ? el.selectionStart : null,
      end: typeof el.selectionEnd === 'number' ? el.selectionEnd : null
    };
  }

  function restoreFocus(info) {
    if (!info) return;
    const el = els.main.querySelector('[data-fk="' + CSS.escape(info.fk) + '"]');
    if (!el) return;
    el.focus({ preventScroll: true });
    if (info.start !== null && typeof el.setSelectionRange === 'function') {
      try { el.setSelectionRange(info.start, info.end); } catch (e) { /* algunos tipos de campo no lo admiten */ }
    }
  }

  function viewTitle(view) {
    if (!view) return 'Sección no encontrada';
    return typeof view.title === 'function' ? view.title(current.params) : view.title;
  }

  function render(isNavigation, isInitial) {
    const view = App.views[current.route];
    const scrollY = window.scrollY;
    const focus = isNavigation ? null : captureFocus();
    const root = h('div', { class: ['view', 'view-' + current.route, isNavigation && 'view-enter'] });
    els.main.replaceChildren(root);
    if (!view) {
      U.mount(root, 
        UI.pageHeader({ title: 'Sección no encontrada', icon: 'alert' }),
        UI.emptyState({ icon: 'alert', title: 'La dirección «' + location.hash + '» no corresponde a ninguna sección.', actions: [UI.linkButton({ href: '#/inicio', label: 'Ir al inicio', icon: 'home' })] }));
    } else {
      try {
        view.render(root, current.params);
      } catch (err) {
        console.error(err);
        root.replaceChildren(
          UI.pageHeader({ title: 'No se pudo mostrar esta sección', icon: 'alert' }),
          UI.emptyState({ icon: 'alert', title: 'Se ha producido un error inesperado.', text: String(err && err.message ? err.message : err), actions: [UI.linkButton({ href: '#/inicio', label: 'Volver al inicio', icon: 'home' })] }));
      }
    }
    renderNav();
    const title = viewTitle(view);
    document.title = title + ' · ' + C.APP_NAME;
    els.topTitle.textContent = title;

    if (isNavigation) {
      window.scrollTo(0, 0);
      if (!isInitial) {
        const heading = root.querySelector('.page-title');
        if (heading) heading.focus({ preventScroll: true });
      }
    } else {
      window.scrollTo(0, scrollY);
      restoreFocus(focus);
    }
    if (App.pendingFocus) {
      const pf = App.pendingFocus;
      App.pendingFocus = null;
      const el = els.main.querySelector(pf.selector);
      if (el) {
        el.focus();
        if (pf.select && typeof el.select === 'function') el.select();
      }
    }
  }

  /** Vuelve a dibujar la sección actual (tras un cambio en los datos). */
  function refresh() {
    if (refreshQueued) return;
    refreshQueued = true;
    queueMicrotask(() => {
      refreshQueued = false;
      flushView();
      render(false);
    });
  }

  function renderNav() {
    const list = h('ul', { class: 'nav-list' }, NAV.map((item) => {
      const active = item.route === current.route;
      const count = item.count ? item.count() : null;
      return h('li', {},
        h('a', { class: ['nav-link', active && 'active'], href: '#/' + item.route, 'aria-current': active ? 'page' : undefined },
          U.icon(item.icon),
          h('span', { class: 'nav-label', text: item.label }),
          count ? h('span', { class: 'nav-count', title: count + ' ' + item.countLabel }, String(count), h('span', { class: 'sr-only', text: ' ' + item.countLabel })) : null));
    }));
    els.nav.replaceChildren(list);
  }

  // ---------------------------------------------------------- Menú en móvil
  function setNavOpen(open, moveFocus) {
    const isMobile = mobileQuery.matches;
    const shouldOpen = Boolean(open) && isMobile;
    const wasOpen = els.sidebar.classList.contains('open');
    els.sidebar.classList.toggle('open', shouldOpen);
    els.backdrop.hidden = !shouldOpen;
    els.menuToggle.setAttribute('aria-expanded', String(shouldOpen));
    els.menuToggle.setAttribute('aria-label', shouldOpen ? 'Cerrar menú' : 'Abrir menú');
    els.sidebar.inert = isMobile && !shouldOpen;
    document.body.classList.toggle('nav-open', shouldOpen);
    if (moveFocus !== false) {
      if (shouldOpen) {
        const first = els.nav.querySelector('a');
        if (first) first.focus();
      } else if (wasOpen) {
        els.menuToggle.focus();
      }
    }
  }

  // -------------------------------------------------- Estado de guardado
  let lastError = '';
  function updateSaveStatus(st) {
    const ok = !st.error;
    const text = ok ? (st.lastSaved ? 'Guardado ' + U.formatTime(st.lastSaved) : 'Datos cargados') : 'Sin guardar';
    [els.saveStatus, els.saveStatusMobile].forEach((el) => {
      if (!el) return;
      el.className = 'save-status ' + (ok ? 'is-ok' : 'is-error');
      el.title = ok ? 'Los cambios se guardan automáticamente en este navegador.' : st.error;
      el.replaceChildren(U.icon(ok ? 'checkCircle' : 'alert'), h('span', { text }));
    });
    if (st.error && st.error !== lastError) UI.toast(st.error, 'error', { duration: 10000 });
    lastError = st.error;
  }

  function showBanner(message, kind) {
    const banner = h('div', { class: 'banner banner-' + (kind || 'warning'), role: 'alert' },
      U.icon('alert'),
      h('p', { text: message }),
      UI.button({ label: 'Cerrar aviso', small: true, variant: 'ghost', onClick: () => banner.remove() }));
    els.banner.appendChild(banner);
  }

  // --------------------------------------------------------- Teclado
  function onKeydown(e) {
    if (e.key === 'Escape' && els.sidebar.classList.contains('open')) {
      setNavOpen(false);
      return;
    }
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    if (document.querySelector('dialog[open]') || U.isTypingTarget(document.activeElement)) return;
    if (e.key === '/') {
      const search = els.main.querySelector('[data-search]');
      if (search) { e.preventDefault(); search.focus(); search.select(); }
    } else if (e.key === 'n' || e.key === 'N') {
      const view = App.views[current.route];
      if (view && typeof view.newItem === 'function') { e.preventDefault(); view.newItem(current.params); }
    }
  }

  // ------------------------------------------------------------- Arranque
  function init() {
    els.main = document.getElementById('main');
    els.nav = document.getElementById('nav');
    els.sidebar = document.getElementById('sidebar');
    els.backdrop = document.getElementById('nav-backdrop');
    els.menuToggle = document.getElementById('menu-toggle');
    els.topTitle = document.getElementById('topbar-title');
    els.saveStatus = document.getElementById('save-status');
    els.saveStatusMobile = document.getElementById('save-status-mobile');
    els.banner = document.getElementById('banner');

    els.menuToggle.addEventListener('click', () => setNavOpen(!els.sidebar.classList.contains('open')));
    els.backdrop.addEventListener('click', () => setNavOpen(false));
    els.nav.addEventListener('click', (e) => { if (e.target.closest('a')) setNavOpen(false, false); });
    mobileQuery.addEventListener('change', () => setNavOpen(false, false));
    document.addEventListener('keydown', onKeydown);
    window.addEventListener('hashchange', onHashChange);
    window.addEventListener('pagehide', flushView);
    window.addEventListener('beforeunload', flushView);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushView(); });

    S.onStatus(updateSaveStatus);
    S.load();
    S.subscribe((detail) => {
      if (detail && detail.action === 'external') UI.toast('Datos actualizados desde otra pestaña.', 'info');
      refresh();
    });
    updateSaveStatus(S.status);
    if (S.status.loadWarning) showBanner(S.status.loadWarning);
    if (!S.status.storageAvailable) showBanner('Este navegador no permite guardar datos (¿modo incógnito o almacenamiento bloqueado?). Puedes usar la aplicación, pero los cambios se perderán al cerrar la página. Exporta tus datos desde Configuración.', 'error');

    if (!location.hash || location.hash === '#' || location.hash === '#/') {
      try { history.replaceState(null, '', '#/inicio'); } catch (e) { location.hash = '#/inicio'; }
    }
    current = parseHash();
    setNavOpen(false, false);
    render(true, true);
    document.documentElement.classList.add('app-ready');
  }

  App.navigate = navigate;
  App.refresh = refresh;
  App.pendingFocus = null;

  init();
})(window.App = window.App || {});
