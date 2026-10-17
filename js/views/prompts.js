/*
 * Biblioteca de prompts: guardar, copiar, editar (con historial de versiones),
 * duplicar y una plantilla reutilizable para redactar prompts técnicos.
 */
(function (App) {
  'use strict';

  const U = App.util;
  const UI = App.ui;
  const S = App.store;
  const h = U.h;
  App.views = App.views || {};

  const TEMPLATE_SECTIONS = [
    { id: 'rol', label: '1. Rol que debe asumir la IA', hint: 'Ej.: Actúa como desarrollador web experto en HTML, CSS y JavaScript que explica las cosas a principiantes.' },
    { id: 'objetivo', label: '2. Objetivo', hint: 'Qué quieres conseguir, en una o dos frases.' },
    { id: 'contexto', label: '3. Contexto', hint: 'Tu situación: tu nivel, el equipo que usas (por ejemplo, un Chromebook), qué existe ya y para qué lo necesitas.' },
    { id: 'requisitos', label: '4. Requisitos funcionales', hint: 'Lo que debe hacer, una función por línea.' },
    { id: 'diseno', label: '5. Diseño esperado', hint: 'Aspecto visual, estructura, estilo, adaptación a móvil…' },
    { id: 'restricciones', label: '6. Restricciones', hint: 'Lo que NO debe hacer: dependencias, servicios de pago, claves API, límites…' },
    { id: 'pruebas', label: '7. Pruebas y criterios de aceptación', hint: 'Cómo sabrás que está bien hecho: comprobaciones concretas.' },
    { id: 'resultado', label: '8. Resultado final esperado', hint: 'Qué debe entregar: archivos, explicación, resumen de cambios…' }
  ];
  const TABS = [
    { id: 'biblioteca', label: 'Mis prompts', icon: 'prompt' },
    { id: 'plantilla', label: 'Plantilla de prompt técnico', icon: 'sparkles' }
  ];
  const filters = { q: '', tool: '', tag: '' };
  let flushDraft = null;

  function toolSuggestions() {
    const names = ['ChatGPT', 'Claude Code'].concat(S.all('tools').map((t) => t.name), S.all('prompts').map((p) => p.tool));
    return Array.from(new Set(names.filter(Boolean)));
  }

  function promptFields() {
    return [
      { name: 'title', label: 'Título', required: true, full: true, autofocus: true, maxlength: 150 },
      { name: 'tool', label: 'Herramienta para la que está pensado', type: 'datalist', options: toolSuggestions(), placeholder: 'ChatGPT, Claude Code…' },
      { name: 'tags', label: 'Etiquetas', type: 'tags' },
      { name: 'objective', label: 'Objetivo', type: 'textarea', full: true, rows: 2, placeholder: '¿Para qué sirve este prompt?' },
      { name: 'text', label: 'Texto completo del prompt', type: 'code', full: true, required: true, rows: 12 }
    ];
  }

  function openPromptForm(prompt, opts) {
    const o = opts || {};
    const editing = Boolean(prompt);
    UI.openForm({
      title: editing ? (o.title || 'Editar prompt') : 'Nuevo prompt',
      submitLabel: editing ? 'Guardar cambios' : 'Guardar prompt',
      size: 'lg',
      intro: editing ? 'Al guardar, la versión anterior se conservará en el historial.' : undefined,
      fields: promptFields(),
      values: editing ? S.get('prompts', prompt.id) : (o.values || {}),
      onSubmit: (v) => {
        if (editing) {
          const res = S.savePromptEdit(prompt.id, v);
          UI.toast(res && res.versioned ? 'Prompt guardado. La versión anterior está en el historial.' : 'No había cambios que guardar.', res && res.versioned ? 'success' : 'info');
        } else {
          S.add('prompts', v);
          UI.toast('Prompt «' + v.title + '» guardado en la biblioteca.');
        }
      }
    });
  }

  function duplicate(p) {
    const copy = S.duplicatePrompt(p.id);
    if (!copy) return;
    UI.toast('Copia creada: «' + copy.title + '». Ya puedes modificarla sin tocar el original.');
    openPromptForm(copy, { title: 'Editar la copia' });
  }

  async function deletePrompt(p) {
    const ok = await UI.confirm({
      title: 'Eliminar prompt',
      message: '¿Seguro que quieres eliminar el prompt «' + p.title + '»?',
      details: (p.versions.length ? 'También se eliminarán sus ' + U.plural(p.versions.length, 'versión anterior', 'versiones anteriores') + '. ' : '') + 'Esta acción no se puede deshacer.',
      confirmLabel: 'Eliminar prompt',
      danger: true
    });
    if (!ok) return false;
    S.remove('prompts', p.id);
    UI.toast('Prompt eliminado.');
    return true;
  }

  function versionBlock(v, label, actions) {
    return h('li', { class: 'version' },
      h('div', { class: 'version-head' },
        h('div', {},
          h('p', { class: 'version-label', text: label }),
          h('p', { class: 'muted small', text: v.title + (v.tool ? ' · ' + v.tool : '') })),
        h('div', { class: 'card-actions' }, actions)),
      v.objective && h('p', { class: 'small pre-wrap', text: 'Objetivo: ' + v.objective }),
      h('pre', { class: 'prompt-text', tabindex: '0' }, h('code', { text: v.text })));
  }

  function openHistory(id) {
    const p = S.get('prompts', id);
    if (!p) return;
    const m = UI.modal({
      title: 'Historial de versiones: ' + p.title,
      size: 'lg',
      body: h('div', {},
        h('p', { class: 'muted', text: p.versions.length ? 'Cada vez que editas el prompt se guarda aquí la versión anterior (hasta 50). Puedes copiar o restaurar cualquiera.' : 'Este prompt todavía no tiene versiones anteriores. Se crean automáticamente cada vez que lo editas.' }),
        h('ol', { class: 'version-list' },
          versionBlock({ title: p.title, tool: p.tool, objective: p.objective, text: p.text }, 'Versión actual · ' + U.formatDateTime(p.updatedAt),
            [UI.button({ label: 'Copiar', icon: 'copy', small: true, onClick: () => UI.copy(p.text, 'Versión actual copiada.') })]),
          p.versions.map((v, i) => versionBlock(v, 'Versión guardada el ' + U.formatDateTime(v.savedAt), [
            UI.button({ label: 'Copiar', icon: 'copy', small: true, onClick: () => UI.copy(v.text, 'Versión copiada.') }),
            UI.button({
              label: 'Restaurar', icon: 'restore', small: true,
              onClick: async () => {
                const ok = await UI.confirm({ title: 'Restaurar versión', message: '¿Restaurar la versión del ' + U.formatDateTime(v.savedAt) + '?', details: 'La versión actual no se pierde: pasará al historial.', confirmLabel: 'Restaurar' });
                if (!ok) return;
                S.restorePromptVersion(p.id, i);
                m.close();
                UI.toast('Versión restaurada. La anterior se ha guardado en el historial.');
              }
            })
          ])))),
      actions: [UI.button({ label: 'Cerrar', onClick: () => m.close() })]
    });
  }

  function openPrompt(id) {
    const p = S.get('prompts', id);
    if (!p) return;
    const m = UI.modal({
      title: p.title,
      size: 'lg',
      body: h('div', { class: 'detail' },
        h('div', { class: 'meta-row' }, p.tool && UI.badge(p.tool, 'tool'), p.tags.map((t) => UI.badge('#' + t, 'tag')), p.demo && UI.demoBadge()),
        UI.details([
          ['Objetivo', p.objective, 'Sin objetivo definido.'],
          ['Texto completo', h('pre', { class: 'prompt-text', tabindex: '0' }, h('code', { text: p.text }))],
          ['Creado', U.formatDateTime(p.createdAt)],
          ['Última modificación', U.formatDateTime(p.updatedAt)],
          ['Versiones anteriores', String(p.versions.length)]
        ])),
      actions: [
        UI.button({ label: 'Historial', icon: 'history', onClick: () => { m.close(); openHistory(p.id); } }),
        UI.button({ label: 'Editar', icon: 'edit', onClick: () => { m.close(); openPromptForm(p); } }),
        UI.button({ label: 'Copiar prompt', icon: 'copy', variant: 'primary', onClick: () => UI.copy(p.text, 'Prompt copiado.') })
      ]
    });
  }

  function promptCard(p) {
    return h('article', { class: ['card', 'prompt-card', p.demo && 'is-demo'] },
      h('div', { class: 'card-head' },
        h('h3', { class: 'card-title' }, h('button', { type: 'button', class: 'link-like', 'data-fk': 'prompt-' + p.id, onClick: () => openPrompt(p.id) }, p.title)),
        UI.button({ label: 'Copiar', icon: 'copy', small: true, variant: 'primary', fk: 'prompt-copy-' + p.id, ariaLabel: 'Copiar el prompt «' + p.title + '»', onClick: () => UI.copy(p.text, 'Prompt copiado.') })),
      h('div', { class: 'meta-row' },
        p.demo && UI.demoBadge(),
        p.tool && UI.badge(p.tool, 'tool'),
        p.tags.map((t) => UI.badge('#' + t, 'tag'))),
      p.objective && h('p', { class: 'clamp-2', text: p.objective }),
      h('pre', { class: 'prompt-preview' }, h('code', { text: U.truncate(p.text, 320) })),
      h('footer', { class: 'card-foot' },
        h('span', { class: 'muted small', text: 'Creado el ' + U.formatDate(p.createdAt) + (p.versions.length ? ' · ' + U.plural(p.versions.length, 'versión anterior', 'versiones anteriores') : '') }),
        h('div', { class: 'card-actions' },
          UI.iconButton({ icon: 'edit', label: 'Editar «' + p.title + '»', fk: 'prompt-edit-' + p.id, onClick: () => openPromptForm(p) }),
          UI.iconButton({ icon: 'duplicate', label: 'Duplicar «' + p.title + '» antes de modificarlo', fk: 'prompt-dup-' + p.id, onClick: () => duplicate(p) }),
          UI.iconButton({ icon: 'history', label: 'Historial de versiones de «' + p.title + '»', fk: 'prompt-hist-' + p.id, onClick: () => openHistory(p.id) }),
          UI.iconButton({ icon: 'trash', label: 'Eliminar «' + p.title + '»', variant: 'danger-ghost', fk: 'prompt-del-' + p.id, onClick: () => deletePrompt(p) }))));
  }

  function renderLibrary(container) {
    const all = S.visible('prompts');
    const tools = Array.from(new Set(all.map((p) => p.tool).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'es'));
    const tags = Array.from(new Set([].concat(...all.map((p) => p.tags)))).sort((a, b) => a.localeCompare(b, 'es'));
    if (filters.tool && !tools.includes(filters.tool)) filters.tool = '';
    if (filters.tag && !tags.includes(filters.tag)) filters.tag = '';
    const results = h('div', { class: 'results' });
    const count = h('p', { class: 'results-count', 'aria-live': 'polite' });
    function renderResults() {
      const list = all.filter((p) => (!filters.tool || p.tool === filters.tool) && (!filters.tag || p.tags.includes(filters.tag)) &&
        U.matchesQuery(filters.q, p.title, p.objective, p.text, p.tags.join(' ')))
        .sort((a, b) => Number(a.demo) - Number(b.demo) || b.updatedAt.localeCompare(a.updatedAt));
      count.textContent = 'Mostrando ' + list.length + ' de ' + U.plural(all.length, 'prompt', 'prompts');
      if (!all.length) {
        results.replaceChildren(UI.emptyState({
          icon: 'prompt', title: 'Tu biblioteca de prompts está vacía',
          text: 'Guarda aquí los prompts que te funcionen bien con ChatGPT o Claude Code, o redacta uno nuevo con la plantilla.',
          actions: [
            UI.button({ label: 'Nuevo prompt', icon: 'plus', variant: 'primary', onClick: () => openPromptForm() }),
            UI.linkButton({ href: '#/prompts/plantilla', label: 'Usar la plantilla', icon: 'sparkles' })
          ]
        }));
      } else if (!list.length) {
        results.replaceChildren(UI.emptyState({ icon: 'search', title: 'Ningún prompt coincide con la búsqueda' }));
      } else {
        results.replaceChildren(h('div', { class: 'card-grid card-grid-wide' }, list.map(promptCard)));
      }
    }
    U.mount(container, 
      h('div', { class: 'section-head' },
        all.some((p) => p.demo)
          ? h('p', { class: 'muted small' }, U.icon('info'), ' Los prompts marcados como «Ejemplo» son de demostración. Puedes ocultarlos o eliminarlos en Configuración.')
          : h('span'),
        h('div', { class: 'page-actions' },
          UI.linkButton({ href: '#/prompts/plantilla', label: 'Redactar con la plantilla', icon: 'sparkles' }),
          UI.button({ label: 'Nuevo prompt', icon: 'plus', variant: 'primary', fk: 'new-prompt', onClick: () => openPromptForm() }))),
      h('div', { class: 'toolbar', role: 'search', 'aria-label': 'Buscar y filtrar prompts' },
        UI.searchInput({ placeholder: 'Buscar en título, objetivo, texto o etiquetas…', label: 'Buscar prompts', value: filters.q, fk: 'prompt-q', onInput: (v) => { filters.q = v; renderResults(); } }),
        h('div', { class: 'toolbar-filters' },
          UI.selectFilter({ label: 'Herramienta', value: filters.tool, options: [{ value: '', label: 'Todas' }].concat(tools.map((t) => ({ value: t, label: t }))), fk: 'prompt-tool', onChange: (v) => { filters.tool = v; renderResults(); } }),
          UI.selectFilter({ label: 'Etiqueta', value: filters.tag, options: [{ value: '', label: 'Todas' }].concat(tags.map((t) => ({ value: t, label: '#' + t }))), fk: 'prompt-tag', onChange: (v) => { filters.tag = v; renderResults(); } }))),
      count, results);
    renderResults();
  }

  // --------------------------------------------------------------- Plantilla
  function assemble(draft, withPlaceholders) {
    return TEMPLATE_SECTIONS.map((s) => {
      const value = String(draft[s.id] || '').trim();
      if (!value && !withPlaceholders) return null;
      return s.label + '\n' + (value || '[' + s.hint + ']');
    }).filter(Boolean).join('\n\n');
  }

  function renderTemplate(container) {
    const draft = Object.assign({ title: '', tool: '', tags: '' }, App.prefs.get('templateDraft', {}));
    const preview = h('code');
    const previewPre = h('pre', { class: 'prompt-text template-preview', tabindex: '0', 'aria-live': 'off' }, preview);
    const charCount = h('p', { class: 'muted small' });
    const saveDraft = U.debounce(() => App.prefs.set('templateDraft', draft), 400);
    flushDraft = saveDraft.flush;

    function updatePreview() {
      const text = assemble(draft, false);
      preview.textContent = text || 'Rellena los apartados para ver aquí el prompt completo.';
      previewPre.classList.toggle('is-empty', !text);
      charCount.textContent = text ? U.plural(text.length, 'carácter', 'caracteres') : '';
    }
    function bind(input, key) {
      input.addEventListener('input', () => { draft[key] = input.value; saveDraft(); updatePreview(); });
      return input;
    }
    const field = (key, label, control, hint) => {
      control.id = control.id || U.uid('plantilla');
      return h('div', { class: 'field field-full' },
        h('label', { class: 'field-label', for: control.id, text: label }),
        hint && h('p', { class: 'field-hint', text: hint }),
        control);
    };
    const listId = U.uid('herramientas');
    const meta = h('div', { class: 'form-grid' },
      h('div', { class: 'field' },
        h('label', { class: 'field-label', for: 'tpl-title', text: 'Título (para guardarlo)' }),
        bind(h('input', { id: 'tpl-title', class: 'input', value: draft.title, 'data-fk': 'tpl-title', placeholder: 'Ej.: Crear mi centro en HTML' }), 'title')),
      h('div', { class: 'field' },
        h('label', { class: 'field-label', for: 'tpl-tool', text: 'Herramienta' }),
        bind(h('input', { id: 'tpl-tool', class: 'input', value: draft.tool, list: listId, 'data-fk': 'tpl-tool', placeholder: 'ChatGPT, Claude Code…' }), 'tool'),
        h('datalist', { id: listId }, toolSuggestions().map((t) => h('option', { value: t })))),
      h('div', { class: 'field field-full' },
        h('label', { class: 'field-label', for: 'tpl-tags', text: 'Etiquetas' }),
        bind(h('input', { id: 'tpl-tags', class: 'input', value: draft.tags, 'data-fk': 'tpl-tags', placeholder: 'Separadas por comas' }), 'tags')));

    const sections = TEMPLATE_SECTIONS.map((s) => field(s.id, s.label,
      bind(h('textarea', { class: 'input', rows: s.id === 'requisitos' || s.id === 'contexto' ? '5' : '3', value: draft[s.id] || '', placeholder: s.hint, 'data-fk': 'tpl-' + s.id }), s.id)));

    async function saveToLibrary() {
      saveDraft.flush();
      const text = assemble(draft, false);
      if (!text) { UI.toast('Rellena al menos un apartado antes de guardar.', 'error'); return; }
      if (!draft.title.trim()) {
        UI.toast('Escribe un título para guardar el prompt.', 'error');
        const t = document.getElementById('tpl-title');
        if (t) t.focus();
        return;
      }
      S.add('prompts', { title: draft.title.trim(), tool: draft.tool.trim(), tags: U.parseTags(draft.tags), objective: String(draft.objetivo || '').trim(), text });
      UI.toast('Prompt «' + draft.title.trim() + '» guardado en tu biblioteca.');
    }
    async function clearDraft() {
      const ok = await UI.confirm({ title: 'Vaciar la plantilla', message: '¿Borrar todo lo escrito en la plantilla?', details: 'Los prompts que ya guardaste en la biblioteca no se verán afectados.', confirmLabel: 'Vaciar', danger: true });
      if (!ok) return;
      saveDraft.cancel();
      App.prefs.set('templateDraft', {});
      App.refresh();
      UI.toast('Plantilla vaciada.', 'info');
    }

    U.mount(container, 
      h('div', { class: 'notice' }, U.icon('info'),
        h('p', { text: 'Rellena solo los apartados que necesites. El borrador se guarda automáticamente en este navegador hasta que lo vacíes.' })),
      h('div', { class: 'template-layout' },
        h('div', { class: 'template-form' }, meta, sections),
        h('aside', { class: 'template-side', 'aria-label': 'Resultado' },
          h('div', { class: 'panel panel-sticky' },
            h('div', { class: 'panel-head' }, h('h2', { class: 'panel-title' }, U.icon('eye'), h('span', { text: 'Prompt resultante' }))),
            h('div', { class: 'panel-body' },
              previewPre, charCount,
              h('div', { class: 'stack-actions' },
                UI.button({ label: 'Copiar prompt', icon: 'copy', variant: 'primary', fk: 'tpl-copy', onClick: () => { const t = assemble(draft, false); if (t) UI.copy(t, 'Prompt copiado.'); else UI.toast('La plantilla está vacía.', 'error'); } }),
                UI.button({ label: 'Guardar en mi biblioteca', icon: 'download', fk: 'tpl-save', onClick: saveToLibrary }),
                UI.button({ label: 'Copiar plantilla vacía', icon: 'copy', variant: 'ghost', fk: 'tpl-copy-empty', onClick: () => UI.copy(assemble({}, true), 'Plantilla vacía copiada.') }),
                UI.button({ label: 'Vaciar plantilla', icon: 'trash', variant: 'danger-ghost', fk: 'tpl-clear', onClick: clearDraft })))))));
    updatePreview();
  }

  function currentTab(params) {
    return params && params[0] === 'plantilla' ? 'plantilla' : 'biblioteca';
  }

  App.views.prompts = {
    title: (params) => (currentTab(params) === 'plantilla' ? 'Plantilla · ' : '') + 'Biblioteca de prompts',
    newItem: () => openPromptForm(),
    flush: () => { if (flushDraft) flushDraft(); },
    render(root, params) {
      flushDraft = null;
      const tab = currentTab(params);
      const container = h('div', { class: 'tab-panel', role: 'tabpanel', 'aria-labelledby': 'tab-' + tab });
      U.mount(root, 
        UI.pageHeader({
          title: 'Biblioteca de prompts', icon: 'prompt',
          subtitle: 'Los prompts que uso con ChatGPT y Claude Code, con su historial de versiones.'
        }),
        UI.tabs({
          label: 'Apartados de la biblioteca', active: tab,
          tabs: TABS.map((t) => Object.assign({ count: t.id === 'biblioteca' ? S.visible('prompts').length : undefined }, t)),
          onSelect: (id) => App.navigate('prompts/' + id)
        }),
        container);
      if (tab === 'plantilla') renderTemplate(container);
      else renderLibrary(container);
    }
  };

  App.prompts = { TEMPLATE_SECTIONS, assemble };
})(window.App = window.App || {});
