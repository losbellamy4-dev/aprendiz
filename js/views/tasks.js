/*
 * «Mis tareas»: lista y tablero, búsqueda, filtros, orden, formulario,
 * detalles y eliminación. El panel de inicio reutiliza estas piezas (App.tasks).
 */
(function (App) {
  'use strict';

  const U = App.util;
  const C = App.C;
  const UI = App.ui;
  const S = App.store;
  const h = U.h;
  App.views = App.views || {};

  // Estado de los filtros, compartido entre el inicio y «Mis tareas».
  const filters = { q: '', status: '', category: '', priority: '', project: '', favorites: false, sort: 'order' };

  const SORTS = [
    { value: 'order', label: 'Orden de mi lista' },
    { value: 'recent', label: 'Más recientes primero' },
    { value: 'oldest', label: 'Más antiguas primero' },
    { value: 'priority', label: 'Prioridad (alta primero)' },
    { value: 'status', label: 'Estado' },
    { value: 'name', label: 'Nombre (A-Z)' },
    { value: 'favorites', label: 'Favoritas primero' }
  ];
  const PRIORITY_RANK = { alta: 0, media: 1, baja: 2 };
  const STATUS_RANK = { 'en-progreso': 0, pendiente: 1, completada: 2 };

  let dragId = null;

  function hasActiveFilters() {
    return Boolean(filters.q.trim() || filters.status || filters.category || filters.priority || filters.project || filters.favorites);
  }
  function resetFilters() {
    Object.assign(filters, { q: '', status: '', category: '', priority: '', project: '', favorites: false });
  }
  /** Quita filtros que apuntan a categorías o proyectos que ya no existen. */
  function sanitizeFilters() {
    if (filters.category && filters.category !== 'none' && !S.get('categories', filters.category)) filters.category = '';
    if (filters.project && filters.project !== 'none' && !S.get('projects', filters.project)) filters.project = '';
  }

  function filterTasks(list) {
    return list.filter((t) => {
      if (filters.status && t.status !== filters.status) return false;
      if (filters.priority && t.priority !== filters.priority) return false;
      if (filters.category === 'none' ? t.categoryId : (filters.category && t.categoryId !== filters.category)) return false;
      if (filters.project === 'none' ? t.projectId : (filters.project && t.projectId !== filters.project)) return false;
      if (filters.favorites && !t.favorite) return false;
      return U.matchesQuery(filters.q, t.title, t.originalNote, t.description);
    });
  }

  function sortTasks(list, sort) {
    const byOrder = (a, b) => a.order - b.order;
    const compare = {
      order: byOrder,
      recent: (a, b) => b.createdAt.localeCompare(a.createdAt) || b.order - a.order,
      oldest: (a, b) => a.createdAt.localeCompare(b.createdAt) || byOrder(a, b),
      priority: (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || byOrder(a, b),
      status: (a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || byOrder(a, b),
      name: (a, b) => a.title.localeCompare(b.title, 'es', { sensitivity: 'base' }),
      favorites: (a, b) => Number(b.favorite) - Number(a.favorite) || byOrder(a, b)
    }[sort] || byOrder;
    return list.slice().sort(compare);
  }

  // ------------------------------------------------------------ Acciones
  function setStatus(id, status) {
    const t = S.update('tasks', id, { status });
    if (t) UI.toast('«' + t.title + '» ahora está: ' + C.label('TASK_STATUS', status) + '.');
  }

  function toggleFavorite(task) {
    const t = S.update('tasks', task.id, { favorite: !task.favorite });
    if (t) UI.toast(t.favorite ? '«' + t.title + '» añadida a favoritas.' : '«' + t.title + '» ya no es favorita.', 'info');
  }

  async function confirmDelete(task) {
    const ok = await UI.confirm({
      title: 'Eliminar tarea',
      message: '¿Seguro que quieres eliminar la tarea «' + task.title + '»?',
      details: 'Esta acción no se puede deshacer. Si quieres conservar una copia, exporta tus datos desde Configuración.',
      confirmLabel: 'Eliminar tarea',
      danger: true
    });
    if (!ok) return false;
    S.remove('tasks', task.id);
    UI.toast('Tarea «' + task.title + '» eliminada.');
    return true;
  }

  function projectOptions() {
    return [{ value: '', label: 'Sin proyecto' }].concat(S.all('projects').map((p) => ({ value: p.id, label: p.name })));
  }
  function toolOptions() {
    return [{ value: '', label: 'Ninguna' }].concat(S.all('tools').map((t) => ({ value: t.id, label: t.name })));
  }

  function taskFields(task) {
    const fields = [];
    if (task && task.originalNote) {
      fields.push({ type: 'info', icon: 'note', text: 'Nota original de mi lista: «' + task.originalNote + '». Puedes corregir el nombre: la nota original se conserva.' });
    }
    return fields.concat([
      { name: 'title', label: 'Nombre', required: true, full: true, autofocus: true, maxlength: 200 },
      { name: 'description', label: 'Descripción', type: 'textarea', full: true, rows: 3, placeholder: '¿De qué trata esta tarea?' },
      { name: 'categoryId', label: 'Categoría', type: 'category' },
      { name: 'status', label: 'Estado', type: 'select', options: UI.optionsFrom('TASK_STATUS') },
      { name: 'priority', label: 'Prioridad', type: 'select', options: UI.optionsFrom('PRIORITY') },
      { name: 'projectId', label: 'Proyecto', type: 'select', nullable: true, options: projectOptions },
      { name: 'toolId', label: 'Herramienta relacionada', type: 'select', nullable: true, options: toolOptions },
      { name: 'link', label: 'Enlace a un recurso', type: 'url', hint: 'Opcional. Por ejemplo, la web de la herramienta o un tutorial.' },
      { name: 'nextStep', label: 'Próximo paso', full: true, placeholder: '¿Qué es lo siguiente que debo hacer?' },
      { name: 'notes', label: 'Notas personales', type: 'textarea', full: true, rows: 4 },
      { name: 'favorite', label: 'Marcar como favorita', type: 'checkbox', full: true }
    ]);
  }

  /** Abre el formulario de tarea. Sin «task» crea una nueva con los valores de «presets». */
  function openTaskForm(task, presets, intro) {
    const editing = Boolean(task);
    const current = editing ? S.get('tasks', task.id) || task : null;
    const values = editing ? current : Object.assign({ status: 'pendiente', priority: 'media', categoryId: null, projectId: null, toolId: null, favorite: false }, presets);
    UI.openForm({
      title: editing ? 'Editar tarea' : 'Nueva tarea',
      submitLabel: editing ? 'Guardar cambios' : 'Crear tarea',
      size: 'lg',
      intro,
      fields: taskFields(current),
      values,
      onSubmit: (v) => {
        if (editing) {
          S.update('tasks', current.id, v);
          UI.toast('Tarea «' + v.title + '» guardada.');
        } else {
          S.add('tasks', Object.assign({ origin: 'usuario' }, v));
          UI.toast('Tarea «' + v.title + '» creada.');
        }
      }
    });
  }

  function openDetails(id) {
    const t = S.get('tasks', id);
    if (!t) return;
    const project = t.projectId ? S.get('projects', t.projectId) : null;
    const tool = t.toolId ? S.get('tools', t.toolId) : null;
    const body = h('div', { class: 'detail' },
      h('div', { class: 'meta-row' },
        UI.statusBadge(t.status), UI.priorityBadge(t.priority), UI.categoryChip(t.categoryId),
        t.favorite && UI.badge('Favorita', 'fav'),
        t.origin === 'nota-inicial' && UI.badge('Nota inicial', 'origin')),
      UI.details([
        ['Descripción', t.description, 'Sin descripción.'],
        ['Próximo paso', t.nextStep, 'Sin definir.'],
        ['Notas personales', t.notes, 'Sin notas.'],
        ['Enlace', t.link ? h('div', {}, h('p', { class: 'link-url', text: t.link }), UI.linkActions(t.link, t.title)) : '', 'Sin enlace.'],
        ['Proyecto', project ? h('a', { href: '#/proyectos/' + project.id, text: project.name }) : '', 'Sin proyecto.'],
        ['Herramienta', tool ? h('a', { href: '#/herramientas/' + tool.id, text: tool.name }) : '', 'Sin herramienta relacionada.'],
        t.originalNote && ['Nota original', '«' + t.originalNote + '» (lista inicial de WhatsApp)'],
        ['Creada', U.formatDateTime(t.createdAt)],
        ['Última modificación', U.formatDateTime(t.updatedAt)],
        t.completedAt && ['Completada', U.formatDateTime(t.completedAt)]
      ]));
    const m = UI.modal({
      title: t.title,
      body,
      size: 'md',
      actions: [
        UI.button({ label: 'Eliminar', icon: 'trash', variant: 'danger-ghost', onClick: async () => { if (await confirmDelete(t)) m.close(); } }),
        UI.button({ label: t.favorite ? 'Quitar de favoritas' : 'Marcar como favorita', icon: 'star', onClick: () => { m.close(); toggleFavorite(t); } }),
        UI.button({ label: 'Editar', icon: 'edit', variant: 'primary', onClick: () => { m.close(); openTaskForm(t); } })
      ]
    });
  }

  // ----------------------------------------------------------- Componentes
  function statusSelect(t) {
    const id = U.uid('estado');
    return h('div', { class: 'status-control' },
      h('label', { class: 'sr-only', for: id, text: 'Estado de «' + t.title + '»' }),
      h('select', {
        id, class: ['input', 'input-sm', 'status-select', 'status-' + t.status], value: t.status,
        'data-fk': 'status-' + t.id, onChange: (e) => setStatus(t.id, e.target.value)
      }, C.TASK_STATUS.map((s) => h('option', { value: s.id, text: s.label }))));
  }

  function favButton(t) {
    return UI.iconButton({
      icon: 'star', label: t.favorite ? 'Quitar «' + t.title + '» de favoritas' : 'Marcar «' + t.title + '» como favorita',
      pressed: t.favorite, className: 'fav-btn', fk: 'fav-' + t.id, onClick: () => toggleFavorite(t)
    });
  }

  function relationChips(t) {
    const project = t.projectId ? S.get('projects', t.projectId) : null;
    const tool = t.toolId ? S.get('tools', t.toolId) : null;
    return [
      project && h('a', { class: 'chip chip-link', href: '#/proyectos/' + project.id, title: 'Proyecto' }, U.icon('projects'), project.name),
      tool && h('a', { class: 'chip chip-link', href: '#/herramientas/' + tool.id, title: 'Herramienta' }, U.icon('tools'), tool.name)
    ];
  }

  function taskCard(t) {
    return h('article', { class: ['card', 'task-card', 'status-' + t.status, t.favorite && 'is-favorite'] },
      h('div', { class: 'task-main' },
        favButton(t),
        h('div', { class: 'task-body' },
          h('h3', { class: 'task-title' },
            h('button', { type: 'button', class: 'link-like', 'data-fk': 'open-' + t.id, onClick: () => openDetails(t.id) }, t.title)),
          h('div', { class: 'meta-row' },
            UI.categoryChip(t.categoryId), UI.priorityBadge(t.priority), relationChips(t),
            t.origin === 'nota-inicial' && UI.badge('Nota inicial', 'origin', 'Procede de mi lista inicial de WhatsApp')),
          t.description && h('p', { class: 'task-desc clamp-2', text: t.description }),
          t.nextStep && h('p', { class: 'task-next' }, U.icon('arrowRight'), h('span', { class: 'sr-only', text: 'Próximo paso: ' }), t.nextStep)),
        statusSelect(t)),
      h('footer', { class: 'card-foot' },
        h('span', { class: 'muted small', text: 'Creada el ' + U.formatDate(t.createdAt) }),
        h('div', { class: 'card-actions' },
          t.link && UI.linkActions(t.link, t.title),
          UI.button({ label: 'Detalles', icon: 'eye', small: true, variant: 'ghost', fk: 'det-' + t.id, onClick: () => openDetails(t.id) }),
          UI.iconButton({ icon: 'edit', label: 'Editar «' + t.title + '»', fk: 'edit-' + t.id, onClick: () => openTaskForm(t) }),
          UI.iconButton({ icon: 'trash', label: 'Eliminar «' + t.title + '»', variant: 'danger-ghost', fk: 'del-' + t.id, onClick: () => confirmDelete(t) }))));
  }

  /** Fila compacta para listas secundarias (favoritas, próximos pasos, proyectos). */
  function taskRow(t, opts) {
    const o = opts || {};
    return h('li', { class: ['task-row', 'status-' + t.status] },
      h('span', { class: 'status-dot', title: C.label('TASK_STATUS', t.status), 'aria-hidden': 'true' }),
      h('div', { class: 'task-row-text' },
        h('button', { type: 'button', class: 'link-like', 'data-fk': (o.fkPrefix || 'row-') + t.id, onClick: () => openDetails(t.id) }, t.title),
        o.showNext && t.nextStep && h('span', { class: 'task-row-sub', text: t.nextStep })),
      o.statusControl ? statusSelect(t) : UI.statusBadge(t.status),
      o.extra);
  }

  function board(list) {
    return h('div', { class: 'board' }, C.TASK_STATUS.map((s, idx) => {
      const items = list.filter((t) => t.status === s.id);
      const col = h('section', { class: ['board-col', 'status-' + s.id], 'aria-label': s.label + ': ' + U.plural(items.length, 'tarea', 'tareas') },
        h('h2', { class: 'board-title' }, h('span', { class: 'status-dot', 'aria-hidden': 'true' }), s.label, h('span', { class: 'count', text: String(items.length) })),
        h('div', { class: 'board-list' }, items.length ? items.map((t) => boardCard(t, idx)) : h('p', { class: 'board-empty', text: 'Sin tareas' })));
      col.addEventListener('dragover', (e) => { if (dragId) { e.preventDefault(); col.classList.add('drop-target'); } });
      col.addEventListener('dragleave', (e) => { if (!col.contains(e.relatedTarget)) col.classList.remove('drop-target'); });
      col.addEventListener('drop', (e) => {
        e.preventDefault();
        col.classList.remove('drop-target');
        const id = dragId;
        dragId = null;
        const t = id && S.get('tasks', id);
        if (t && t.status !== s.id) setStatus(id, s.id);
      });
      return col;
    }));
  }

  function boardCard(t, idx) {
    const prev = C.TASK_STATUS[idx - 1];
    const next = C.TASK_STATUS[idx + 1];
    const card = h('article', { class: ['card', 'board-card', t.favorite && 'is-favorite'], draggable: 'true' },
      h('div', { class: 'board-card-head' },
        h('button', { type: 'button', class: 'link-like task-title', 'data-fk': 'open-' + t.id, onClick: () => openDetails(t.id) }, t.title),
        favButton(t)),
      h('div', { class: 'meta-row' }, UI.categoryChip(t.categoryId), UI.priorityBadge(t.priority)),
      t.nextStep && h('p', { class: 'task-next small' }, U.icon('arrowRight'), h('span', { class: 'sr-only', text: 'Próximo paso: ' }), t.nextStep),
      h('div', { class: 'board-card-actions' },
        prev ? UI.iconButton({ icon: 'chevronLeft', label: 'Mover «' + t.title + '» a ' + prev.label, fk: 'prev-' + t.id, onClick: () => setStatus(t.id, prev.id) }) : h('span'),
        h('div', { class: 'card-actions' },
          UI.iconButton({ icon: 'edit', label: 'Editar «' + t.title + '»', fk: 'edit-' + t.id, onClick: () => openTaskForm(t) }),
          UI.iconButton({ icon: 'trash', label: 'Eliminar «' + t.title + '»', variant: 'danger-ghost', fk: 'del-' + t.id, onClick: () => confirmDelete(t) })),
        next ? UI.iconButton({ icon: 'chevronRight', label: 'Mover «' + t.title + '» a ' + next.label, fk: 'next-' + t.id, onClick: () => setStatus(t.id, next.id) }) : h('span')));
    card.addEventListener('dragstart', (e) => {
      dragId = t.id;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', t.id);
      card.classList.add('dragging');
    });
    card.addEventListener('dragend', () => { dragId = null; card.classList.remove('dragging'); });
    return card;
  }

  /** Barra de búsqueda y filtros. compact: versión del panel de inicio. */
  function filterBar(o) {
    const suffix = o.compact ? '-inicio' : '';
    const categoryOpts = [{ value: '', label: 'Todas' }].concat(UI.categoryOptions(), [{ value: 'none', label: 'Sin categoría' }]);
    const favBtn = UI.button({
      label: 'Solo favoritas', icon: 'star', small: true, pressed: filters.favorites, className: 'toggle-btn', fk: 'task-fav' + suffix,
      onClick: () => {
        filters.favorites = !filters.favorites;
        favBtn.setAttribute('aria-pressed', String(filters.favorites));
        o.onChange();
      }
    });
    return h('div', { class: ['toolbar', o.compact && 'toolbar-compact'], role: 'search', 'aria-label': 'Buscar y filtrar tareas' },
      UI.searchInput({
        placeholder: 'Buscar por nombre o descripción…', label: 'Buscar tareas por nombre o descripción', value: filters.q,
        fk: 'task-q' + suffix, onInput: (v) => { filters.q = v; o.onChange(); }
      }),
      h('div', { class: 'toolbar-filters' },
        UI.selectFilter({ label: 'Estado', value: filters.status, options: UI.optionsFrom('TASK_STATUS', 'Todos'), fk: 'task-status' + suffix, onChange: (v) => { filters.status = v; o.onChange(); } }),
        UI.selectFilter({ label: 'Categoría', value: filters.category, options: categoryOpts, fk: 'task-cat' + suffix, onChange: (v) => { filters.category = v; o.onChange(); } }),
        UI.selectFilter({ label: 'Prioridad', value: filters.priority, options: UI.optionsFrom('PRIORITY', 'Todas'), fk: 'task-prio' + suffix, onChange: (v) => { filters.priority = v; o.onChange(); } }),
        !o.compact && UI.selectFilter({
          label: 'Proyecto', value: filters.project, fk: 'task-proj',
          options: [{ value: '', label: 'Todos' }, { value: 'none', label: 'Sin proyecto' }].concat(S.visible('projects').map((p) => ({ value: p.id, label: p.name }))),
          onChange: (v) => { filters.project = v; o.onChange(); }
        }),
        !o.compact && UI.selectFilter({ label: 'Ordenar', value: filters.sort, options: SORTS, fk: 'task-sort', onChange: (v) => { filters.sort = v; o.onChange(); } }),
        favBtn));
  }

  function emptyFor(all) {
    if (!all.length) {
      return UI.emptyState({
        icon: 'tasks', title: 'Todavía no tienes tareas',
        text: 'Crea una tarea para registrar el próximo paso que quieras dar.',
        actions: [UI.button({ label: 'Nueva tarea', icon: 'plus', variant: 'primary', onClick: () => openTaskForm() })]
      });
    }
    return UI.emptyState({
      icon: 'search', title: 'Ninguna tarea coincide con la búsqueda o los filtros',
      text: 'Prueba con otras palabras o limpia los filtros.',
      actions: [UI.button({ label: 'Limpiar filtros', icon: 'close', onClick: () => { resetFilters(); App.refresh(); } })]
    });
  }

  // ------------------------------------------------------------------ Vista
  App.views.tareas = {
    title: 'Mis tareas',
    newItem: () => openTaskForm(),
    render(root) {
      sanitizeFilters();
      const mode = App.prefs.get('taskView', 'list');
      const results = h('div', { class: 'results' });
      const count = h('p', { class: 'results-count', 'aria-live': 'polite' });
      const clearBtn = UI.button({ label: 'Limpiar filtros', icon: 'close', small: true, variant: 'ghost', fk: 'task-clear', onClick: () => { resetFilters(); App.refresh(); } });

      function renderResults() {
        const all = S.visible('tasks');
        const list = sortTasks(filterTasks(all), filters.sort);
        count.textContent = 'Mostrando ' + list.length + ' de ' + U.plural(all.length, 'tarea', 'tareas');
        clearBtn.hidden = !hasActiveFilters();
        if (!list.length) results.replaceChildren(emptyFor(all));
        else if (mode === 'board') results.replaceChildren(board(list));
        else results.replaceChildren(h('div', { class: 'task-list' }, list.map(taskCard)));
      }

      const setMode = (m) => { App.prefs.set('taskView', m); App.refresh(); };
      const viewToggle = h('div', { class: 'segmented', role: 'group', 'aria-label': 'Tipo de vista' },
        UI.button({ label: 'Lista', icon: 'list', small: true, pressed: mode === 'list', fk: 'view-list', onClick: () => setMode('list') }),
        UI.button({ label: 'Tablero', icon: 'board', small: true, pressed: mode === 'board', fk: 'view-board', onClick: () => setMode('board') }));

      const stats = S.taskStats();
      U.mount(root, 
        UI.pageHeader({
          title: 'Mis tareas', icon: 'tasks',
          subtitle: 'Registra cada paso, cambia su estado y anota lo siguiente que debes hacer.',
          actions: [viewToggle, UI.button({ label: 'Nueva tarea', icon: 'plus', variant: 'primary', fk: 'new-task', onClick: () => openTaskForm() })]
        }),
        h('div', { class: 'mini-stats' },
          C.TASK_STATUS.map((s) => h('span', { class: ['mini-stat', 'status-' + s.id] }, h('span', { class: 'status-dot', 'aria-hidden': 'true' }), s.label + ': ', h('strong', { text: String(stats[s.id]) }))),
          h('span', { class: 'mini-stat' }, 'Progreso: ', h('strong', { text: stats.percent + ' %' }))),
        filterBar({ onChange: renderResults }),
        h('div', { class: 'results-bar' }, count, clearBtn),
        mode === 'board' && h('p', { class: 'hint small', text: 'Consejo: arrastra una tarjeta a otra columna o usa las flechas para cambiar su estado.' }),
        results);
      renderResults();
    }
  };

  App.tasks = {
    filters, resetFilters, hasActiveFilters, sanitizeFilters, filterTasks, sortTasks,
    filterBar, taskCard, taskRow, statusSelect,
    openTaskForm, openDetails, confirmDelete, setStatus, toggleFavorite, emptyFor
  };
})(window.App = window.App || {});
