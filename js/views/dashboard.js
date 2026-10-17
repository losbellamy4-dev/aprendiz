/*
 * Inicio: panel principal con contadores, progreso, buscador y filtros de
 * tareas, favoritas, próximos pasos, progreso por categoría y resumen general.
 */
(function (App) {
  'use strict';

  const U = App.util;
  const C = App.C;
  const UI = App.ui;
  const S = App.store;
  const h = U.h;
  App.views = App.views || {};

  const DASHBOARD_LIMIT = 6;

  function showTasks(status) {
    App.tasks.resetFilters();
    App.tasks.filters.status = status || '';
    App.navigate('tareas');
  }

  function statCard(o) {
    const content = [
      h('span', { class: 'stat-icon' }, U.icon(o.icon)),
      h('span', { class: 'stat-value', text: String(o.value) }),
      h('span', { class: 'stat-label', text: o.label })
    ];
    if (!o.onClick) return h('div', { class: ['stat', o.className] }, content);
    return h('button', {
      type: 'button', class: ['stat', 'stat-button', o.className], onClick: o.onClick,
      'aria-label': o.ariaLabel, 'data-fk': o.fk
    }, content);
  }

  function welcome() {
    if (S.settings().welcomeDismissed) return null;
    const demoCount = S.countDemo();
    const initialNotes = S.all('tasks').filter((t) => t.origin === 'nota-inicial').length;
    return h('section', { class: 'welcome', 'aria-label': 'Bienvenida' },
      U.icon('info', 'welcome-icon'),
      h('div', { class: 'welcome-text' },
        h('p', { class: 'welcome-title', text: 'Tu centro ya tiene tus primeros pasos' }),
        h('p', {},
          initialNotes ? 'Las ' + initialNotes + ' notas de tu lista de WhatsApp están en «Mis tareas», con su nombre original. ' : '',
          'Las fichas de herramientas indican qué datos están pendientes de comprobar. ',
          demoCount ? 'Los ' + demoCount + ' elementos marcados como «Ejemplo» son de demostración: puedes ocultarlos o eliminarlos en Configuración.' : '')),
      UI.button({ label: 'Entendido', small: true, fk: 'welcome-ok', onClick: () => S.setSetting('welcomeDismissed', true) }));
  }

  function tasksPanel() {
    App.tasks.sanitizeFilters();
    const results = h('div', { class: 'results' });
    const count = h('p', { class: 'results-count', 'aria-live': 'polite' });
    const more = h('div', { class: 'panel-more' });
    function renderResults() {
      const all = S.visible('tasks');
      const list = App.tasks.sortTasks(App.tasks.filterTasks(all), App.tasks.filters.sort);
      count.textContent = App.tasks.hasActiveFilters()
        ? U.plural(list.length, 'tarea coincide', 'tareas coinciden') + ' con la búsqueda'
        : 'Tus tareas (' + all.length + ')';
      if (!list.length) results.replaceChildren(App.tasks.emptyFor(all));
      else results.replaceChildren(h('div', { class: 'task-list' }, list.slice(0, DASHBOARD_LIMIT).map(App.tasks.taskCard)));
      more.replaceChildren(list.length > DASHBOARD_LIMIT
        ? UI.linkButton({ href: '#/tareas', label: 'Ver las ' + list.length + ' tareas en «Mis tareas»', icon: 'arrowRight', small: true })
        : (list.length ? UI.linkButton({ href: '#/tareas', label: 'Abrir «Mis tareas»', icon: 'arrowRight', small: true }) : ''));
    }
    const body = h('div', {},
      App.tasks.filterBar({ compact: true, onChange: renderResults }),
      count, results, more);
    renderResults();
    return UI.panel({
      title: 'Buscar y filtrar tareas', icon: 'search', className: 'panel-tasks',
      actions: [UI.button({ label: 'Nueva tarea', icon: 'plus', small: true, fk: 'dash-new-task-2', onClick: () => App.tasks.openTaskForm() })],
      body
    });
  }

  function favoritesPanel(tasks) {
    const favs = tasks.filter((t) => t.favorite);
    return UI.panel({
      title: 'Favoritas', icon: 'star',
      body: favs.length
        ? h('ul', { class: 'row-list' }, favs.map((t) => App.tasks.taskRow(t, { fkPrefix: 'fav-row-' })))
        : UI.emptyState({ compact: true, icon: 'star', title: 'Sin favoritas', text: 'Pulsa la estrella de una tarea para tenerla siempre a mano aquí.' })
    });
  }

  function nextStepsPanel(tasks) {
    const rank = { alta: 0, media: 1, baja: 2 };
    const items = tasks.filter((t) => t.status !== 'completada' && t.nextStep.trim())
      .sort((a, b) => rank[a.priority] - rank[b.priority] || a.order - b.order).slice(0, 8);
    return UI.panel({
      title: 'Próximos pasos', icon: 'arrowRight',
      body: items.length
        ? h('ul', { class: 'row-list' }, items.map((t) => App.tasks.taskRow(t, { showNext: true, fkPrefix: 'next-row-' })))
        : UI.emptyState({ compact: true, icon: 'flag', title: 'Sin próximos pasos definidos', text: 'Edita una tarea y rellena «Próximo paso» para saber siempre qué hacer después.' })
    });
  }

  function categoryPanel(tasks) {
    const groups = S.all('categories').map((c) => ({ id: c.id, name: c.name, color: c.color, list: tasks.filter((t) => t.categoryId === c.id) }));
    const none = tasks.filter((t) => !t.categoryId);
    if (none.length) groups.push({ id: null, name: 'Sin categoría', color: 'slate', list: none });
    const used = groups.filter((g) => g.list.length);
    return UI.panel({
      title: 'Progreso por categoría', icon: 'target',
      body: used.length
        ? h('ul', { class: 'cat-progress' }, used.map((g) => {
          const done = g.list.filter((t) => t.status === 'completada').length;
          const pct = Math.round((done / g.list.length) * 100);
          return h('li', { class: 'cat-progress-item cat-' + g.color },
            h('div', { class: 'cat-progress-head' },
              h('span', { class: 'cat-progress-name' }, U.icon(UI.categoryIcon(g.id)), g.name),
              h('span', { class: 'muted small', text: done + '/' + g.list.length })),
            UI.progressBar(pct, g.name + ': ' + pct + ' % completado'));
        }))
        : UI.emptyState({ compact: true, icon: 'folder', title: 'Sin tareas todavía' })
    });
  }

  function projectsPanel() {
    const projects = S.visible('projects').filter((p) => p.status === 'activo' || p.status === 'en-pausa');
    const tasks = S.visible('tasks');
    return UI.panel({
      title: 'Proyectos en marcha', icon: 'projects',
      actions: [UI.linkButton({ href: '#/proyectos', label: 'Ver todos', small: true, variant: 'ghost' })],
      body: projects.length
        ? h('ul', { class: 'row-list' }, projects.map((p) => {
          const own = tasks.filter((t) => t.projectId === p.id);
          const done = own.filter((t) => t.status === 'completada').length;
          return h('li', { class: 'project-row' },
            h('div', { class: 'task-row-text' },
              h('a', { href: '#/proyectos/' + p.id, text: p.name }),
              h('span', { class: 'task-row-sub', text: 'Etapa: ' + C.label('STAGES', p.stage) + ' · ' + done + '/' + own.length + ' tareas completadas' })),
            p.demo && UI.demoBadge(),
            UI.badge(C.label('PROJECT_STATUS', p.status), 'project-' + p.status));
        }))
        : UI.emptyState({
          compact: true, icon: 'projects', title: 'Sin proyectos activos',
          actions: [UI.linkButton({ href: '#/proyectos', label: 'Ir a Proyectos', small: true })]
        })
    });
  }

  function summaryPanel() {
    const tools = S.visible('tools');
    const concepts = S.visible('concepts');
    const resources = S.visible('resources');
    const prompts = S.visible('prompts');
    const count = (list, key, value) => list.filter((i) => i[key] === value).length;
    const row = (href, iconName, label, value) => h('li', {},
      h('a', { href, class: 'summary-link' }, U.icon(iconName), h('span', { class: 'summary-label', text: label }), h('strong', { text: value })));
    return UI.panel({
      title: 'Resumen', icon: 'database',
      body: h('ul', { class: 'summary-list' },
        row('#/herramientas', 'tools', 'Herramientas investigadas', count(tools, 'researchStatus', 'completada') + ' de ' + tools.length),
        row('#/herramientas', 'alert', 'Nombres pendientes de verificar', String(tools.filter((t) => t.nameUnverified).length)),
        row('#/aprendizaje/conceptos', 'book', 'Conceptos dominados', count(concepts, 'mastery', 'dominado') + ' de ' + concepts.length),
        row('#/aprendizaje/notas', 'note', 'Notas', String(S.visible('notes').length)),
        row('#/aprendizaje/fragmentos', 'code', 'Fragmentos de código', String(S.visible('snippets').length)),
        row('#/prompts', 'prompt', 'Prompts guardados', String(prompts.length)),
        row('#/recursos', 'link', 'Recursos pendientes de revisar', count(resources, 'reviewStatus', 'pendiente') + ' de ' + resources.length))
    });
  }

  App.views.inicio = {
    title: 'Inicio',
    newItem: () => App.tasks.openTaskForm(),
    render(root) {
      const stats = S.taskStats();
      const tasks = S.visible('tasks');
      U.mount(root, 
        h('section', { class: 'hero' },
          h('div', { class: 'hero-text' },
            h('p', { class: 'eyebrow' }, U.icon('logo'), 'Centro de control personal'),
            h('h1', { class: 'page-title hero-title', tabindex: '-1', text: C.APP_NAME }),
            h('p', { class: 'hero-sub', text: 'Organiza en un solo lugar lo que investigas, aprendes y desarrollas en programación e inteligencia artificial, y retoma cada proyecto donde lo dejaste.' })),
          h('div', { class: 'hero-actions' },
            UI.button({ label: 'Nueva tarea', icon: 'plus', variant: 'primary', fk: 'dash-new-task', onClick: () => App.tasks.openTaskForm() }),
            UI.linkButton({ href: '#/proyectos', label: 'Planificar un proyecto', icon: 'projects' }))),
        welcome(),
        h('section', { class: 'stats', 'aria-label': 'Contadores de tareas' },
          statCard({ icon: 'tasks', value: stats.total, label: 'Tareas totales', fk: 'stat-total', ariaLabel: 'Ver todas las tareas (' + stats.total + ')', onClick: () => showTasks('') }),
          statCard({ icon: 'flag', value: stats.pendiente, label: 'Pendientes', className: 'stat-pendiente', fk: 'stat-pend', ariaLabel: 'Ver tareas pendientes (' + stats.pendiente + ')', onClick: () => showTasks('pendiente') }),
          statCard({ icon: 'bolt', value: stats['en-progreso'], label: 'En progreso', className: 'stat-progreso', fk: 'stat-prog', ariaLabel: 'Ver tareas en progreso (' + stats['en-progreso'] + ')', onClick: () => showTasks('en-progreso') }),
          statCard({ icon: 'checkCircle', value: stats.completada, label: 'Completadas', className: 'stat-completada', fk: 'stat-done', ariaLabel: 'Ver tareas completadas (' + stats.completada + ')', onClick: () => showTasks('completada') }),
          h('div', { class: 'stat stat-progress' },
            h('span', { class: 'stat-icon' }, U.icon('target')),
            h('span', { class: 'stat-value', text: stats.percent + ' %' }),
            h('span', { class: 'stat-label', text: 'Progreso general' }))),
        h('section', { class: 'progress-card', 'aria-label': 'Progreso general' },
          h('div', { class: 'progress-card-head' },
            h('span', { text: 'Progreso general' }),
            h('span', { class: 'muted', text: stats.completada + ' de ' + U.plural(stats.total, 'tarea completada', 'tareas completadas') })),
          UI.progressBar(stats.percent, 'Progreso general: ' + stats.percent + ' % de las tareas completadas'),
          h('div', { class: 'progress-legend' },
            C.TASK_STATUS.map((s) => h('span', { class: 'mini-stat status-' + s.id }, h('span', { class: 'status-dot', 'aria-hidden': 'true' }), s.label + ': ' + stats[s.id])))),
        h('div', { class: 'dash-grid' },
          h('div', { class: 'dash-main' }, tasksPanel()),
          h('div', { class: 'dash-side' }, favoritesPanel(tasks), nextStepsPanel(tasks))),
        h('div', { class: 'dash-grid-3' }, projectsPanel(), categoryPanel(tasks), summaryPanel()));
    }
  };
})(window.App = window.App || {});
