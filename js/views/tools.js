/*
 * Herramientas: fichas de investigación (Base44, Pysint, ChatGPT, Claude Code,
 * Bitbloq…). Lista con filtros y página de detalle editable.
 */
(function (App) {
  'use strict';

  const U = App.util;
  const C = App.C;
  const UI = App.ui;
  const S = App.store;
  const h = U.h;
  App.views = App.views || {};

  const PENDING = 'Pendiente de comprobar.';
  const listFilters = { q: '', research: '', category: '', kind: '' };
  let flushNotes = null;

  function toolFields(tool) {
    const fields = [];
    if (tool && tool.originalName && tool.originalName !== tool.name) {
      fields.push({ type: 'info', icon: 'note', text: 'Nombre original en mis notas: «' + tool.originalName + '». Se conserva aunque cambies el nombre.' });
    } else if (tool && tool.originalName) {
      fields.push({ type: 'info', icon: 'note', text: 'Nombre tal como aparece en mis notas: «' + tool.originalName + '». Si descubres que está mal escrito, corrígelo aquí.' });
    }
    return fields.concat([
      { name: 'name', label: 'Nombre', required: true, full: true, autofocus: true, maxlength: 120 },
      { name: 'nameUnverified', label: 'Nombre pendiente de verificar', type: 'checkbox', full: true },
      { name: 'kind', label: 'Tipo de ficha', type: 'select', options: UI.optionsFrom('TOOL_KIND') },
      { name: 'categoryId', label: 'Categoría', type: 'category' },
      { name: 'difficulty', label: 'Nivel de dificultad orientativo', type: 'select', options: UI.optionsFrom('DIFFICULTY') },
      { name: 'researchStatus', label: 'Estado de mi investigación', type: 'select', options: UI.optionsFrom('RESEARCH_STATUS') },
      { name: 'description', label: 'Descripción', type: 'textarea', full: true, rows: 3 },
      { name: 'utility', label: 'Utilidad (para qué me sirve)', type: 'textarea', full: true, rows: 4 },
      { name: 'capabilities', label: 'Qué permite crear o hacer', type: 'textarea', full: true, rows: 3 },
      { name: 'requirements', label: 'Requisitos y conocimientos necesarios', type: 'textarea', full: true, rows: 3 },
      { name: 'pricing', label: 'Plan gratuito y precios', type: 'textarea', full: true, rows: 3, hint: 'Anota la fecha en la que lo compruebas: los precios y los límites cambian.' },
      { name: 'pros', label: 'Ventajas', type: 'textarea', rows: 4 },
      { name: 'cons', label: 'Limitaciones', type: 'textarea', rows: 4 },
      { name: 'resources', label: 'Recursos oficiales', type: 'links', full: true, rows: 3, hint: 'Un enlace por línea con el formato: Título | https://…', placeholder: 'Web oficial | https://…' },
      { name: 'foundLink', label: 'Enlace de la herramienta encontrada', type: 'url', full: true, hint: 'Para investigaciones pendientes: guarda aquí el enlace de lo que encuentres.' },
      { name: 'conclusions', label: 'Conclusiones de mi investigación', type: 'textarea', full: true, rows: 3 },
      { name: 'notes', label: 'Notas personales', type: 'textarea', full: true, rows: 3 },
      { name: 'sourceNote', label: 'Fuentes y verificación de los datos', type: 'textarea', full: true, rows: 2, hint: 'De dónde sale la información y qué falta por comprobar.' }
    ]);
  }

  function openToolForm(tool) {
    const editing = Boolean(tool);
    UI.openForm({
      title: editing ? 'Editar ficha: ' + tool.name : 'Nueva ficha de herramienta',
      submitLabel: editing ? 'Guardar cambios' : 'Crear ficha',
      size: 'lg',
      fields: toolFields(tool),
      values: editing ? S.get('tools', tool.id) : { kind: 'herramienta', difficulty: 'pendiente', researchStatus: 'sin-empezar', resources: [] },
      onSubmit: (v) => {
        const dup = S.all('tools').find((t) => U.normalizeText(t.name) === U.normalizeText(v.name) && (!editing || t.id !== tool.id));
        if (dup) return 'Ya existe una ficha llamada «' + dup.name + '».';
        if (editing) {
          S.update('tools', tool.id, v);
          UI.toast('Ficha «' + v.name + '» guardada.');
        } else {
          const created = S.add('tools', v);
          UI.toast('Ficha «' + created.name + '» creada.');
          App.navigate('herramientas/' + created.id);
        }
      }
    });
  }

  function addToTasks(tool) {
    const linked = S.all('tasks').filter((t) => t.toolId === tool.id).length;
    App.tasks.openTaskForm(null, {
      title: 'Investigar ' + tool.name,
      categoryId: tool.categoryId,
      toolId: tool.id,
      link: tool.foundLink || (tool.resources[0] ? tool.resources[0].url : '')
    }, linked
      ? 'Ya tienes ' + U.plural(linked, 'tarea vinculada', 'tareas vinculadas') + ' a «' + tool.name + '». Revisa los datos antes de crear otra.'
      : 'La tarea quedará vinculada a la ficha «' + tool.name + '». Puedes cambiar el nombre y los demás datos.');
  }

  async function deleteTool(tool) {
    const used = S.usage('tools', tool.id);
    const ok = await UI.confirm({
      title: 'Eliminar ficha',
      message: '¿Seguro que quieres eliminar la ficha «' + tool.name + '»?',
      details: (used ? 'Hay ' + U.plural(used, 'elemento vinculado', 'elementos vinculados') + ' (tareas, recursos o proyectos): no se borrarán, solo perderán el vínculo. ' : '') + 'Esta acción no se puede deshacer.',
      confirmLabel: 'Eliminar ficha',
      danger: true
    });
    if (!ok) return;
    S.remove('tools', tool.id);
    UI.toast('Ficha «' + tool.name + '» eliminada.');
    App.navigate('herramientas');
  }

  function googleButton(query, label) {
    return UI.linkButton({ href: U.googleSearchUrl(query), label: label || 'Buscar en Google', icon: 'search', ariaLabel: 'Buscar «' + query + '» en Google (se abre en una pestaña nueva)' });
  }

  function toolBadges(t) {
    return [
      t.nameUnverified && UI.badge('Nombre pendiente de verificar', 'warning'),
      t.kind === 'investigacion' && UI.badge('Investigación pendiente', 'info'),
      t.demo && UI.demoBadge()
    ];
  }

  // ------------------------------------------------------------------ Lista
  function toolCard(t) {
    const cat = t.categoryId ? S.get('categories', t.categoryId) : null;
    const linked = S.all('tasks').filter((task) => task.toolId === t.id).length;
    return h('article', { class: ['card', 'tool-card', t.demo && 'is-demo'] },
      h('div', { class: 'tool-card-head' },
        h('span', { class: ['tool-icon', 'cat-' + (cat ? cat.color : 'slate')] }, U.icon(UI.categoryIcon(t.categoryId))),
        h('div', {},
          h('h3', { class: 'card-title' }, h('a', { href: '#/herramientas/' + t.id, 'data-fk': 'tool-' + t.id, text: t.name })),
          h('div', { class: 'meta-row' }, toolBadges(t)))),
      UI.textBlock(U.truncate(t.description, 200), 'Descripción pendiente de investigar.'),
      h('dl', { class: 'mini-details' },
        h('div', {}, h('dt', { text: 'Dificultad' }), h('dd', { text: C.label('DIFFICULTY', t.difficulty) })),
        h('div', {}, h('dt', { text: 'Mi investigación' }), h('dd', {}, UI.badge(C.label('RESEARCH_STATUS', t.researchStatus), 'research-' + t.researchStatus))),
        h('div', {}, h('dt', { text: 'Tareas vinculadas' }), h('dd', { text: String(linked) }))),
      h('footer', { class: 'card-foot' },
        UI.categoryChip(t.categoryId),
        h('div', { class: 'card-actions' },
          UI.linkButton({ href: '#/herramientas/' + t.id, label: 'Ver ficha', icon: 'eye', small: true, variant: 'ghost' }),
          UI.button({ label: 'Añadir a mis tareas', icon: 'plus', small: true, fk: 'tool-add-' + t.id, onClick: () => addToTasks(t) }))));
  }

  function renderList(root) {
    const grid = h('div', { class: 'results' });
    const count = h('p', { class: 'results-count', 'aria-live': 'polite' });
    function renderResults() {
      const all = S.visible('tools');
      const list = all.filter((t) =>
        (!listFilters.research || t.researchStatus === listFilters.research) &&
        (!listFilters.category || t.categoryId === listFilters.category) &&
        (!listFilters.kind || t.kind === listFilters.kind) &&
        U.matchesQuery(listFilters.q, t.name, t.originalName, t.description, t.utility));
      count.textContent = 'Mostrando ' + list.length + ' de ' + U.plural(all.length, 'ficha', 'fichas');
      if (!all.length) {
        grid.replaceChildren(UI.emptyState({ icon: 'tools', title: 'No tienes fichas de herramientas', text: 'Crea una ficha para cada herramienta que quieras investigar.', actions: [UI.button({ label: 'Nueva ficha', icon: 'plus', variant: 'primary', onClick: () => openToolForm() })] }));
      } else if (!list.length) {
        grid.replaceChildren(UI.emptyState({ icon: 'search', title: 'Ninguna ficha coincide con la búsqueda', text: 'Prueba con otras palabras o cambia los filtros.' }));
      } else {
        grid.replaceChildren(h('div', { class: 'card-grid' }, list.map(toolCard)));
      }
    }
    if (listFilters.category && !S.get('categories', listFilters.category)) listFilters.category = '';
    U.mount(root, 
      UI.pageHeader({
        title: 'Herramientas', icon: 'tools',
        subtitle: 'Fichas para investigar cada herramienta de mis notas: qué es, para qué sirve y qué falta por comprobar.',
        actions: [UI.button({ label: 'Nueva ficha', icon: 'plus', variant: 'primary', fk: 'new-tool', onClick: () => openToolForm() })]
      }),
      h('div', { class: 'notice' }, U.icon('info'),
        h('p', { text: 'La información de las fichas se documentó el 17/10/2026 a partir de fuentes oficiales. Lo que no se pudo verificar aparece como «Pendiente de comprobar». Los precios y las funciones cambian: confírmalos siempre en los recursos oficiales.' })),
      h('div', { class: 'toolbar', role: 'search', 'aria-label': 'Buscar y filtrar herramientas' },
        UI.searchInput({ placeholder: 'Buscar herramientas…', label: 'Buscar herramientas', value: listFilters.q, fk: 'tool-q', onInput: (v) => { listFilters.q = v; renderResults(); } }),
        h('div', { class: 'toolbar-filters' },
          UI.selectFilter({ label: 'Mi investigación', value: listFilters.research, options: UI.optionsFrom('RESEARCH_STATUS', 'Todas'), fk: 'tool-research', onChange: (v) => { listFilters.research = v; renderResults(); } }),
          UI.selectFilter({ label: 'Tipo', value: listFilters.kind, options: UI.optionsFrom('TOOL_KIND', 'Todos'), fk: 'tool-kind', onChange: (v) => { listFilters.kind = v; renderResults(); } }),
          UI.selectFilter({ label: 'Categoría', value: listFilters.category, options: UI.categoryOptions('Todas'), fk: 'tool-cat', onChange: (v) => { listFilters.category = v; renderResults(); } }))),
      count, grid);
    renderResults();
  }

  // ---------------------------------------------------------------- Detalle
  function section(title, iconName, body, className) {
    return UI.panel({ title, icon: iconName, body, className: ['panel-sm', className].filter(Boolean).join(' ') });
  }

  function renderDetail(root, id) {
    const t = S.get('tools', id);
    if (!t) {
      U.mount(root, 
        UI.pageHeader({ title: 'Ficha no encontrada', icon: 'alert', back: { href: '#/herramientas', label: 'Herramientas' } }),
        UI.emptyState({ icon: 'alert', title: 'Esta ficha no existe o se ha eliminado.', actions: [UI.linkButton({ href: '#/herramientas', label: 'Volver a Herramientas' })] }));
      return;
    }
    const linkedTasks = S.visible('tasks').filter((task) => task.toolId === t.id);
    const linkedResources = S.visible('resources').filter((r) => r.toolId === t.id);
    const linkedProjects = S.visible('projects').filter((p) => p.toolIds.includes(t.id));

    // Notas personales con guardado automático.
    const statusId = U.uid('estado-notas');
    const notesStatus = h('p', { class: 'save-hint', id: statusId, 'aria-live': 'polite', text: 'Se guarda automáticamente mientras escribes.' });
    const notesArea = h('textarea', { class: 'input', rows: '6', value: t.notes, 'aria-label': 'Notas personales sobre ' + t.name, 'aria-describedby': statusId, 'data-fk': 'tool-notes-' + t.id, placeholder: 'Lo que voy descubriendo, dudas, enlaces…' });
    const saveNotes = U.debounce(() => {
      S.update('tools', t.id, { notes: notesArea.value }, { silent: true });
      notesStatus.textContent = 'Guardado a las ' + U.formatTime(new Date()) + '.';
    }, 600);
    notesArea.addEventListener('input', () => { notesStatus.textContent = 'Guardando…'; saveNotes(); });
    notesArea.addEventListener('blur', () => saveNotes.flush());
    flushNotes = saveNotes.flush;

    const researchId = U.uid('investigacion');
    const showResearch = t.kind === 'investigacion' || t.foundLink || t.conclusions;

    U.mount(root, 
      UI.pageHeader({
        title: t.name, icon: UI.categoryIcon(t.categoryId),
        back: { href: '#/herramientas', label: 'Herramientas' },
        badges: [UI.categoryChip(t.categoryId)].concat(toolBadges(t)),
        actions: [
          UI.button({ label: 'Editar ficha', icon: 'edit', fk: 'tool-edit', onClick: () => openToolForm(t) }),
          UI.button({ label: 'Añadir a mis tareas', icon: 'plus', variant: 'primary', fk: 'tool-add', onClick: () => addToTasks(t) })
        ]
      }),
      t.nameUnverified && h('div', { class: 'notice notice-warning', role: 'note' }, U.icon('alert'),
        h('div', {},
          h('p', { class: 'notice-title', text: 'Nombre pendiente de verificar' }),
          h('p', { text: 'El nombre «' + (t.originalName || t.name) + '» se ha copiado tal cual de mis notas y puede estar escrito de forma aproximada. No se ha supuesto qué herramienta es: búscalo y, cuando lo sepas, edita la ficha para corregir el nombre y desmarcar este aviso.' }),
          h('div', { class: 'notice-actions' }, googleButton(t.originalName || t.name)))),
      h('div', { class: 'tool-status-bar' },
        h('div', { class: 'field-inline' },
          h('label', { for: researchId, class: 'field-inline-label', text: 'Estado de mi investigación' }),
          h('select', {
            id: researchId, class: 'input', value: t.researchStatus, 'data-fk': 'tool-research-status',
            onChange: (e) => { S.update('tools', t.id, { researchStatus: e.target.value }); UI.toast('Estado de la investigación: ' + C.label('RESEARCH_STATUS', e.target.value) + '.'); }
          }, C.RESEARCH_STATUS.map((s) => h('option', { value: s.id, text: s.label })))),
        h('p', { class: 'tool-difficulty' }, 'Nivel de dificultad orientativo: ', h('strong', { text: C.label('DIFFICULTY', t.difficulty) })),
        !t.nameUnverified && googleButton(t.name)),
      h('div', { class: 'tool-grid' },
        section('Descripción', 'info', UI.textBlock(t.description, PENDING)),
        section('Utilidad', 'target', UI.textBlock(t.utility, PENDING)),
        section('Qué permite crear o hacer', 'app', UI.textBlock(t.capabilities, PENDING)),
        section('Requisitos y conocimientos necesarios', 'graduation', UI.textBlock(t.requirements, PENDING)),
        section('Plan gratuito y precios', 'tag', UI.textBlock(t.pricing, PENDING)),
        section('Recursos oficiales', 'link', UI.linkList(t.resources, 'Sin recursos oficiales verificados. Añádelos al editar la ficha.')),
        section('Ventajas', 'checkCircle', UI.textBlock(t.pros, PENDING)),
        section('Limitaciones', 'alert', UI.textBlock(t.cons, PENDING)),
        showResearch && section('Resultado de mi investigación', 'search', h('div', {},
          h('p', { class: 'field-label', text: 'Enlace de la herramienta encontrada' }),
          t.foundLink ? h('div', {}, h('p', { class: 'link-url', text: t.foundLink }), UI.linkActions(t.foundLink, t.name)) : UI.textBlock('', 'Todavía no has guardado ningún enlace. Usa «Buscar en Google» y después «Editar ficha» para guardarlo.'),
          h('p', { class: 'field-label', text: 'Conclusiones' }),
          UI.textBlock(t.conclusions, 'Sin conclusiones todavía.')), 'panel-wide'),
        section('Notas personales', 'note', h('div', {}, notesArea, notesStatus), 'panel-wide'),
        section('Tareas vinculadas', 'tasks', h('div', {},
          linkedTasks.length
            ? h('ul', { class: 'row-list' }, linkedTasks.map((task) => App.tasks.taskRow(task, { fkPrefix: 'tool-task-' })))
            : UI.textBlock('', 'Ninguna tarea vinculada.'),
          UI.button({ label: 'Añadir a mis tareas', icon: 'plus', small: true, fk: 'tool-add-2', onClick: () => addToTasks(t) }))),
        section('Recursos y proyectos relacionados', 'projects', h('div', {},
          linkedResources.length
            ? h('ul', { class: 'row-list' }, linkedResources.map((r) => h('li', { class: 'task-row' }, h('div', { class: 'task-row-text' }, h('span', { text: r.title }), h('span', { class: 'task-row-sub', text: U.hostOf(r.url) })), UI.linkActions(r.url, r.title))))
            : UI.textBlock('', 'Ningún recurso guardado con esta herramienta.'),
          linkedProjects.length > 0 && h('p', { class: 'small' }, 'Proyectos que la usan: ',
            linkedProjects.map((p, i) => [i ? ', ' : '', h('a', { href: '#/proyectos/' + p.id, text: p.name })])))),
        section('Fuentes y verificación', 'checkCircle', h('div', {},
          UI.textBlock(t.sourceNote, 'Sin información sobre las fuentes.'),
          h('p', { class: 'muted small', text: 'Ficha creada el ' + U.formatDate(t.createdAt) + ' · última modificación: ' + U.formatDateTime(t.updatedAt) })), 'panel-wide')),
      h('div', { class: 'danger-row' },
        UI.button({ label: 'Eliminar esta ficha', icon: 'trash', variant: 'danger-ghost', fk: 'tool-delete', onClick: () => deleteTool(t) })));
  }

  App.views.herramientas = {
    title: (params) => {
      const t = params && params[0] ? S.get('tools', params[0]) : null;
      return t ? t.name + ' · Herramientas' : 'Herramientas';
    },
    newItem: () => openToolForm(),
    flush: () => { if (flushNotes) flushNotes(); },
    render(root, params) {
      flushNotes = null;
      if (params && params[0]) renderDetail(root, params[0]);
      else renderList(root);
    }
  };

  App.tools = { openToolForm, addToTasks };
})(window.App = window.App || {});
