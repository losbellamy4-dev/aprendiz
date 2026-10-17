/*
 * Recursos: páginas web, documentación, tutoriales, vídeos, repositorios,
 * herramientas online y artículos guardados manualmente.
 * La aplicación no navega ni busca por Internet: el botón «Buscar en Google»
 * solo abre la búsqueda en una pestaña nueva del navegador.
 */
(function (App) {
  'use strict';

  const U = App.util;
  const C = App.C;
  const UI = App.ui;
  const S = App.store;
  const h = U.h;
  App.views = App.views || {};

  const filters = { q: '', type: '', category: '', review: '' };

  function typeInfo(id) { return C.RESOURCE_TYPES.find((t) => t.id === id) || C.RESOURCE_TYPES[0]; }

  function resourceFields() {
    return [
      { name: 'title', label: 'Título', required: true, full: true, autofocus: true, maxlength: 200 },
      { name: 'url', label: 'Enlace (URL)', type: 'url', required: true, full: true, hint: 'Copia la dirección completa desde la barra del navegador.' },
      { name: 'type', label: 'Tipo de recurso', type: 'select', options: UI.optionsFrom('RESOURCE_TYPES') },
      { name: 'reviewStatus', label: 'Estado de revisión', type: 'select', options: UI.optionsFrom('REVIEW_STATUS') },
      { name: 'categoryId', label: 'Categoría', type: 'category' },
      { name: 'toolId', label: 'Herramienta relacionada', type: 'select', nullable: true, options: () => [{ value: '', label: 'Ninguna' }].concat(S.all('tools').map((t) => ({ value: t.id, label: t.name }))) },
      { name: 'description', label: 'Descripción', type: 'textarea', full: true, rows: 3, placeholder: '¿Qué contiene y por qué lo has guardado?' }
    ];
  }

  function openResourceForm(resource, presets) {
    const editing = Boolean(resource);
    UI.openForm({
      title: editing ? 'Editar recurso' : 'Nuevo recurso',
      submitLabel: editing ? 'Guardar cambios' : 'Guardar recurso',
      size: 'lg',
      fields: resourceFields(),
      values: editing ? S.get('resources', resource.id) : Object.assign({ type: 'web', reviewStatus: 'pendiente' }, presets),
      onSubmit: (v) => {
        const dup = S.all('resources').find((r) => r.url === v.url && (!editing || r.id !== resource.id));
        if (dup) return 'Ya tienes guardado este enlace como «' + dup.title + '».';
        if (editing) S.update('resources', resource.id, v);
        else S.add('resources', v);
        UI.toast('Recurso «' + v.title + '» guardado.');
      }
    });
  }

  async function deleteResource(r) {
    const ok = await UI.confirm({ title: 'Eliminar recurso', message: '¿Seguro que quieres eliminar el recurso «' + r.title + '»?', details: 'Solo se borra de tu centro; la página web no se ve afectada. Esta acción no se puede deshacer.', confirmLabel: 'Eliminar recurso', danger: true });
    if (!ok) return;
    S.remove('resources', r.id);
    UI.toast('Recurso eliminado.');
  }

  function reviewSelect(r) {
    const id = U.uid('revision');
    return h('div', { class: 'status-control' },
      h('label', { class: 'sr-only', for: id, text: 'Estado de revisión de «' + r.title + '»' }),
      h('select', {
        id, class: ['input', 'input-sm', 'review-select', 'review-' + r.reviewStatus], value: r.reviewStatus, 'data-fk': 'review-' + r.id,
        onChange: (e) => { S.update('resources', r.id, { reviewStatus: e.target.value }); UI.toast('«' + r.title + '»: ' + C.label('REVIEW_STATUS', e.target.value) + '.'); }
      }, C.REVIEW_STATUS.map((s) => h('option', { value: s.id, text: s.label }))));
  }

  function resourceCard(r) {
    const type = typeInfo(r.type);
    const tool = r.toolId ? S.get('tools', r.toolId) : null;
    return h('article', { class: ['card', 'resource-card', r.demo && 'is-demo'] },
      h('div', { class: 'card-head' },
        h('span', { class: 'resource-type' }, U.icon(type.icon), type.label),
        reviewSelect(r)),
      h('h3', { class: 'card-title', text: r.title }),
      h('p', { class: 'link-url', title: r.url, text: r.url }),
      h('div', { class: 'meta-row' },
        r.demo && UI.demoBadge(),
        UI.categoryChip(r.categoryId),
        tool && h('a', { class: 'chip chip-link', href: '#/herramientas/' + tool.id }, U.icon('tools'), tool.name)),
      r.description && h('p', { class: 'pre-wrap clamp-3', text: r.description }),
      h('footer', { class: 'card-foot' },
        UI.linkActions(r.url, r.title),
        h('div', { class: 'card-actions' },
          UI.iconButton({ icon: 'edit', label: 'Editar «' + r.title + '»', fk: 'res-edit-' + r.id, onClick: () => openResourceForm(r) }),
          UI.iconButton({ icon: 'trash', label: 'Eliminar «' + r.title + '»', variant: 'danger-ghost', fk: 'res-del-' + r.id, onClick: () => deleteResource(r) }))));
  }

  function searchHelper() {
    const id = U.uid('google');
    const input = h('input', { id, class: 'input', type: 'search', placeholder: 'Ej.: tutorial HTML para principiantes', autocomplete: 'off', 'data-fk': 'google-q' });
    function open() {
      const q = input.value.trim();
      if (!q) { UI.toast('Escribe qué quieres buscar.', 'error'); input.focus(); return; }
      window.open(U.googleSearchUrl(q), '_blank', 'noopener,noreferrer');
    }
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); open(); } });
    return UI.panel({
      title: 'Buscar recursos en Internet', icon: 'globe',
      body: h('div', {},
        h('p', { class: 'small', text: 'Esta aplicación no busca ni navega por Internet por sí sola (eso requeriría un servidor o una API externa). Como alternativa, escribe tu búsqueda: se abrirá Google en una pestaña nueva y, cuando encuentres algo útil, copia el enlace y guárdalo aquí con «Nuevo recurso».' }),
        h('div', { class: 'with-action' },
          h('label', { class: 'sr-only', for: id, text: 'Qué quieres buscar en Google' }),
          input,
          UI.button({ label: 'Buscar en Google', icon: 'external', fk: 'google-btn', ariaLabel: 'Buscar en Google (se abre en una pestaña nueva)', onClick: open })))
    });
  }

  App.views.recursos = {
    title: 'Recursos',
    newItem: () => openResourceForm(),
    render(root) {
      if (filters.category && !S.get('categories', filters.category)) filters.category = '';
      const results = h('div', { class: 'results' });
      const count = h('p', { class: 'results-count', 'aria-live': 'polite' });
      function renderResults() {
        const all = S.visible('resources');
        const list = all.filter((r) =>
          (!filters.type || r.type === filters.type) &&
          (!filters.category || r.categoryId === filters.category) &&
          (!filters.review || r.reviewStatus === filters.review) &&
          U.matchesQuery(filters.q, r.title, r.description, r.url))
          .sort((a, b) => Number(a.demo) - Number(b.demo) || b.createdAt.localeCompare(a.createdAt));
        count.textContent = 'Mostrando ' + list.length + ' de ' + U.plural(all.length, 'recurso', 'recursos');
        if (!all.length) {
          results.replaceChildren(UI.emptyState({
            icon: 'link', title: 'Todavía no has guardado recursos',
            text: 'Guarda aquí documentación oficial, tutoriales, vídeos o repositorios que te sirvan para aprender.',
            actions: [UI.button({ label: 'Nuevo recurso', icon: 'plus', variant: 'primary', onClick: () => openResourceForm() })]
          }));
        } else if (!list.length) {
          results.replaceChildren(UI.emptyState({ icon: 'search', title: 'Ningún recurso coincide con la búsqueda o los filtros' }));
        } else {
          results.replaceChildren(h('div', { class: 'card-grid' }, list.map(resourceCard)));
        }
      }
      U.mount(root, 
        UI.pageHeader({
          title: 'Recursos', icon: 'link',
          subtitle: 'Páginas web, documentación oficial, tutoriales, vídeos, repositorios de GitHub, herramientas online y artículos.',
          actions: [UI.button({ label: 'Nuevo recurso', icon: 'plus', variant: 'primary', fk: 'new-resource', onClick: () => openResourceForm() })]
        }),
        searchHelper(),
        h('div', { class: 'toolbar', role: 'search', 'aria-label': 'Buscar y filtrar recursos' },
          UI.searchInput({ placeholder: 'Buscar en mis recursos…', label: 'Buscar en mis recursos', value: filters.q, fk: 'res-q', onInput: (v) => { filters.q = v; renderResults(); } }),
          h('div', { class: 'toolbar-filters' },
            UI.selectFilter({ label: 'Tipo', value: filters.type, options: UI.optionsFrom('RESOURCE_TYPES', 'Todos'), fk: 'res-type', onChange: (v) => { filters.type = v; renderResults(); } }),
            UI.selectFilter({ label: 'Categoría', value: filters.category, options: UI.categoryOptions('Todas'), fk: 'res-cat', onChange: (v) => { filters.category = v; renderResults(); } }),
            UI.selectFilter({ label: 'Revisión', value: filters.review, options: UI.optionsFrom('REVIEW_STATUS', 'Todas'), fk: 'res-review', onChange: (v) => { filters.review = v; renderResults(); } }))),
        count, results);
      renderResults();
    }
  };

  App.resources = { openResourceForm };
})(window.App = window.App || {});
