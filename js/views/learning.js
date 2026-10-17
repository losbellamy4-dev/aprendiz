/*
 * «Mi aprendizaje»: fichas de conceptos, notas con un editor sencillo
 * (Markdown básico y guardado automático) y fragmentos de código.
 */
(function (App) {
  'use strict';

  const U = App.util;
  const C = App.C;
  const UI = App.ui;
  const S = App.store;
  const h = U.h;
  App.views = App.views || {};

  const TABS = [
    { id: 'conceptos', label: 'Conceptos', icon: 'graduation' },
    { id: 'notas', label: 'Notas', icon: 'note' },
    { id: 'fragmentos', label: 'Fragmentos de código', icon: 'code' }
  ];
  const conceptFilters = { q: '', mastery: '', category: '' };
  const snippetFilters = { q: '', language: '' };
  const noteFilters = { q: '' };
  let flushEditor = null;

  // =============================================================== Conceptos
  function conceptFields() {
    return [
      { name: 'name', label: 'Nombre del concepto', required: true, full: true, autofocus: true, maxlength: 150 },
      { name: 'categoryId', label: 'Categoría', type: 'category' },
      { name: 'mastery', label: 'Nivel de dominio', type: 'select', options: UI.optionsFrom('MASTERY') },
      { name: 'explanation', label: 'Explicación sencilla', type: 'textarea', full: true, rows: 3, placeholder: 'Explícalo con tus propias palabras, como si se lo contaras a otra persona.' },
      { name: 'example', label: 'Ejemplo práctico', type: 'textarea', full: true, rows: 3 },
      { name: 'codeLanguage', label: 'Lenguaje del código', type: 'datalist', options: C.SNIPPET_LANGUAGES, placeholder: 'Por ejemplo: JavaScript' },
      { name: 'code', label: 'Código relacionado', type: 'code', full: true, rows: 6, hint: 'Opcional.' },
      { name: 'doubts', label: 'Dudas que todavía tengo', type: 'textarea', full: true, rows: 3 },
      { name: 'exercise', label: 'Ejercicio para practicar', type: 'textarea', full: true, rows: 3 }
    ];
  }

  function openConceptForm(concept) {
    const editing = Boolean(concept);
    UI.openForm({
      title: editing ? 'Editar concepto' : 'Nuevo concepto',
      submitLabel: editing ? 'Guardar cambios' : 'Crear concepto',
      size: 'lg',
      fields: conceptFields(),
      values: editing ? S.get('concepts', concept.id) : { mastery: 'sin-empezar' },
      onSubmit: (v) => {
        if (editing) S.update('concepts', concept.id, v);
        else S.add('concepts', v);
        UI.toast('Concepto «' + v.name + '» guardado.');
      }
    });
  }

  async function deleteConcept(c) {
    const ok = await UI.confirm({ title: 'Eliminar concepto', message: '¿Seguro que quieres eliminar el concepto «' + c.name + '»?', details: 'Esta acción no se puede deshacer.', confirmLabel: 'Eliminar concepto', danger: true });
    if (!ok) return false;
    S.remove('concepts', c.id);
    UI.toast('Concepto eliminado.');
    return true;
  }

  function masterySelect(c) {
    const id = U.uid('dominio');
    return h('div', { class: 'status-control' },
      h('label', { class: 'sr-only', for: id, text: 'Nivel de dominio de «' + c.name + '»' }),
      h('select', {
        id, class: ['input', 'input-sm', 'mastery-select', 'mastery-' + c.mastery], value: c.mastery, 'data-fk': 'mastery-' + c.id,
        onChange: (e) => { S.update('concepts', c.id, { mastery: e.target.value }); UI.toast('«' + c.name + '»: ' + C.label('MASTERY', e.target.value) + '.'); }
      }, C.MASTERY.map((m) => h('option', { value: m.id, text: m.label }))));
  }

  function openConcept(id) {
    const c = S.get('concepts', id);
    if (!c) return;
    const m = UI.modal({
      title: c.name,
      size: 'lg',
      body: h('div', { class: 'detail' },
        h('div', { class: 'meta-row' }, UI.badge(C.label('MASTERY', c.mastery), 'mastery-' + c.mastery), UI.categoryChip(c.categoryId), c.demo && UI.demoBadge()),
        UI.details([
          ['Explicación sencilla', c.explanation, 'Sin explicación todavía.'],
          ['Ejemplo práctico', c.example, 'Sin ejemplo todavía.'],
          ['Código relacionado', c.code ? UI.codeBlock(c.code, c.codeLanguage) : '', 'Sin código.'],
          ['Dudas que todavía tengo', c.doubts, 'Sin dudas anotadas.'],
          ['Ejercicio para practicar', c.exercise, 'Sin ejercicio todavía.'],
          ['Creado', U.formatDateTime(c.createdAt)],
          ['Última modificación', U.formatDateTime(c.updatedAt)]
        ])),
      actions: [
        UI.button({ label: 'Eliminar', icon: 'trash', variant: 'danger-ghost', onClick: async () => { if (await deleteConcept(c)) m.close(); } }),
        UI.button({ label: 'Editar', icon: 'edit', variant: 'primary', onClick: () => { m.close(); openConceptForm(c); } })
      ]
    });
  }

  function conceptCard(c) {
    const flag = (iconName, text) => h('span', { class: 'flag' }, U.icon(iconName), text);
    return h('article', { class: ['card', 'concept-card', 'mastery-card-' + c.mastery, c.demo && 'is-demo'] },
      h('div', { class: 'card-head' },
        h('h3', { class: 'card-title' }, h('button', { type: 'button', class: 'link-like', 'data-fk': 'concept-' + c.id, onClick: () => openConcept(c.id) }, c.name)),
        masterySelect(c)),
      h('div', { class: 'meta-row' }, UI.categoryChip(c.categoryId), c.demo && UI.demoBadge()),
      UI.textBlock(U.truncate(c.explanation, 180), 'Sin explicación todavía.'),
      h('div', { class: 'flags' },
        c.code && flag('code', 'Con código'),
        c.doubts.trim() && flag('alert', 'Tiene dudas'),
        c.exercise.trim() && flag('target', 'Con ejercicio')),
      h('footer', { class: 'card-foot' },
        h('span', { class: 'muted small', text: U.formatDate(c.updatedAt) }),
        h('div', { class: 'card-actions' },
          UI.button({ label: 'Ver', icon: 'eye', small: true, variant: 'ghost', fk: 'concept-view-' + c.id, onClick: () => openConcept(c.id) }),
          UI.iconButton({ icon: 'edit', label: 'Editar «' + c.name + '»', fk: 'concept-edit-' + c.id, onClick: () => openConceptForm(c) }),
          UI.iconButton({ icon: 'trash', label: 'Eliminar «' + c.name + '»', variant: 'danger-ghost', fk: 'concept-del-' + c.id, onClick: () => deleteConcept(c) }))));
  }

  function renderConcepts(container) {
    const results = h('div', { class: 'results' });
    const count = h('p', { class: 'results-count', 'aria-live': 'polite' });
    const all = S.visible('concepts');
    function renderResults() {
      const list = all.filter((c) =>
        (!conceptFilters.mastery || c.mastery === conceptFilters.mastery) &&
        (!conceptFilters.category || c.categoryId === conceptFilters.category) &&
        U.matchesQuery(conceptFilters.q, c.name, c.explanation, c.example, c.doubts, c.code))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      count.textContent = 'Mostrando ' + list.length + ' de ' + U.plural(all.length, 'concepto', 'conceptos');
      if (!all.length) {
        results.replaceChildren(UI.emptyState({
          icon: 'graduation', title: 'Aún no has registrado conceptos',
          text: 'Cada vez que entiendas algo nuevo (por ejemplo, qué es una variable o cómo funciona un prompt con contexto), crea una ficha con tu explicación, un ejemplo y tus dudas.',
          actions: [UI.button({ label: 'Nuevo concepto', icon: 'plus', variant: 'primary', onClick: () => openConceptForm() })]
        }));
      } else if (!list.length) {
        results.replaceChildren(UI.emptyState({ icon: 'search', title: 'Ningún concepto coincide con la búsqueda' }));
      } else {
        results.replaceChildren(h('div', { class: 'card-grid' }, list.map(conceptCard)));
      }
    }
    if (conceptFilters.category && !S.get('categories', conceptFilters.category)) conceptFilters.category = '';
    U.mount(container, 
      h('div', { class: 'section-head' },
        h('div', { class: 'mini-stats' }, C.MASTERY.map((m) => h('span', { class: 'mini-stat mastery-' + m.id }, h('span', { class: 'status-dot', 'aria-hidden': 'true' }), m.label + ': ', h('strong', { text: String(all.filter((c) => c.mastery === m.id).length) })))),
        UI.button({ label: 'Nuevo concepto', icon: 'plus', variant: 'primary', fk: 'new-concept', onClick: () => openConceptForm() })),
      h('div', { class: 'toolbar', role: 'search', 'aria-label': 'Buscar y filtrar conceptos' },
        UI.searchInput({ placeholder: 'Buscar conceptos…', label: 'Buscar conceptos', value: conceptFilters.q, fk: 'concept-q', onInput: (v) => { conceptFilters.q = v; renderResults(); } }),
        h('div', { class: 'toolbar-filters' },
          UI.selectFilter({ label: 'Dominio', value: conceptFilters.mastery, options: UI.optionsFrom('MASTERY', 'Todos'), fk: 'concept-mastery', onChange: (v) => { conceptFilters.mastery = v; renderResults(); } }),
          UI.selectFilter({ label: 'Categoría', value: conceptFilters.category, options: UI.categoryOptions('Todas'), fk: 'concept-cat', onChange: (v) => { conceptFilters.category = v; renderResults(); } }))),
      count, results);
    renderResults();
  }

  // =================================================================== Notas
  function wrapSelection(ta, before, after, placeholder) {
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = ta.value.slice(start, end) || placeholder;
    ta.setRangeText(before + selected + after, start, end, 'end');
    ta.focus();
    ta.setSelectionRange(start + before.length, start + before.length + selected.length);
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function prefixLines(ta, prefix) {
    const start = ta.value.lastIndexOf('\n', ta.selectionStart - 1) + 1;
    const end = ta.selectionEnd;
    const block = ta.value.slice(start, end);
    ta.setRangeText(block.split('\n').map((line) => prefix + line).join('\n'), start, end, 'end');
    ta.focus();
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function newNote() {
    if (flushEditor) flushEditor.flush();
    const note = S.add('notes', { title: 'Nota sin título', body: '' }, { silent: true });
    App.prefs.set('selectedNote', note.id);
    noteFilters.q = '';
    App.pendingFocus = { selector: '[data-fk="note-title-' + note.id + '"]', select: true };
    App.navigate('aprendizaje/notas');
    UI.toast('Nota creada.');
  }

  async function deleteNote(note) {
    const ok = await UI.confirm({ title: 'Eliminar nota', message: '¿Seguro que quieres eliminar la nota «' + note.title + '»?', details: 'Esta acción no se puede deshacer.', confirmLabel: 'Eliminar nota', danger: true });
    if (!ok) return;
    if (flushEditor) flushEditor.cancel();
    flushEditor = null;
    S.remove('notes', note.id);
    UI.toast('Nota eliminada.');
  }

  function renderNotes(container) {
    const sorted = () => S.visible('notes').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    let selectedId = App.prefs.get('selectedNote', null);
    if (!S.get('notes', selectedId)) {
      const first = sorted()[0];
      selectedId = first ? first.id : null;
    }
    const listHost = h('ul', { class: 'note-list' });

    function renderList() {
      const items = sorted().filter((n) => U.matchesQuery(noteFilters.q, n.title, n.body));
      if (!items.length) {
        listHost.replaceChildren(h('li', { class: 'muted small note-list-empty', text: S.visible('notes').length ? 'Ninguna nota coincide.' : 'Todavía no hay notas.' }));
        return;
      }
      listHost.replaceChildren(...items.map((n) => h('li', {},
        h('button', {
          type: 'button', class: ['note-item', n.id === selectedId && 'active'], 'aria-current': n.id === selectedId ? 'true' : undefined,
          'data-fk': 'note-item-' + n.id,
          onClick: () => {
            if (flushEditor) flushEditor.flush();
            App.prefs.set('selectedNote', n.id);
            App.refresh();
          }
        },
        h('span', { class: 'note-item-title', text: n.title }),
        h('span', { class: 'note-item-meta', text: U.formatDateTime(n.updatedAt) }),
        n.body.trim() && h('span', { class: 'note-item-preview', text: U.truncate(n.body.replace(/[#*`[\]()>-]/g, ' ').replace(/\s+/g, ' ').trim(), 70) })))));
    }

    const aside = h('aside', { class: 'notes-aside', 'aria-label': 'Lista de notas' },
      UI.button({ label: 'Nueva nota', icon: 'plus', variant: 'primary', fk: 'new-note', className: 'btn-block', onClick: newNote }),
      UI.searchInput({ placeholder: 'Buscar en mis notas…', label: 'Buscar en mis notas', value: noteFilters.q, fk: 'note-q', onInput: (v) => { noteFilters.q = v; renderList(); } }),
      listHost);

    const note = selectedId ? S.get('notes', selectedId) : null;
    let editor;
    if (!note) {
      flushEditor = null;
      editor = h('div', { class: 'notes-editor' }, UI.emptyState({
        icon: 'note', title: 'Escribe tu primera nota',
        text: 'Las notas sirven para apuntar lo que vas aprendiendo con tus propias palabras. Se guardan solas mientras escribes.',
        actions: [UI.button({ label: 'Nueva nota', icon: 'plus', variant: 'primary', onClick: newNote })]
      }));
    } else {
      const statusEl = h('p', { class: 'save-hint', 'aria-live': 'polite', text: 'Guardado automático · última modificación: ' + U.formatDateTime(note.updatedAt) });
      const titleInput = h('input', { class: 'input note-title-input', type: 'text', value: note.title, maxlength: '150', 'aria-label': 'Título de la nota', 'data-fk': 'note-title-' + note.id });
      const body = h('textarea', {
        class: 'input note-body', value: note.body, rows: '16', spellcheck: 'true', 'aria-label': 'Contenido de la nota', 'data-fk': 'note-body-' + note.id,
        placeholder: 'Escribe aquí… Puedes usar # para títulos, **negrita**, *cursiva*, - para listas y ``` para bloques de código.'
      });
      const preview = h('div', { class: 'note-preview markdown', hidden: true, tabindex: '0', 'aria-label': 'Vista previa de la nota' });
      const save = U.debounce(() => {
        S.update('notes', note.id, { title: titleInput.value.trim() || 'Nota sin título', body: body.value }, { silent: true });
        statusEl.textContent = 'Guardado a las ' + U.formatTime(new Date()) + '.';
        renderList();
      }, 500);
      flushEditor = save;
      const onEdit = () => { statusEl.textContent = 'Guardando…'; save(); };
      titleInput.addEventListener('input', onEdit);
      titleInput.addEventListener('blur', () => save.flush());
      body.addEventListener('input', onEdit);
      body.addEventListener('blur', () => save.flush());

      const editBtn = UI.button({ label: 'Editar', icon: 'edit', small: true, pressed: true, fk: 'note-mode-edit', onClick: () => setMode(false) });
      const previewBtn = UI.button({ label: 'Vista previa', icon: 'eye', small: true, pressed: false, fk: 'note-mode-preview', onClick: () => setMode(true) });
      const formatBar = h('div', { class: 'format-bar', role: 'toolbar', 'aria-label': 'Formato del texto' },
        UI.button({ label: 'Título', small: true, variant: 'ghost', ariaLabel: 'Insertar título', onClick: () => prefixLines(body, '## ') }),
        UI.button({ label: 'Negrita', small: true, variant: 'ghost', ariaLabel: 'Poner en negrita', onClick: () => wrapSelection(body, '**', '**', 'texto') }),
        UI.button({ label: 'Cursiva', small: true, variant: 'ghost', ariaLabel: 'Poner en cursiva', onClick: () => wrapSelection(body, '*', '*', 'texto') }),
        UI.button({ label: 'Lista', small: true, variant: 'ghost', ariaLabel: 'Convertir en lista', onClick: () => prefixLines(body, '- ') }),
        UI.button({ label: 'Código', icon: 'code', small: true, variant: 'ghost', ariaLabel: 'Insertar bloque de código', onClick: () => wrapSelection(body, '\n```\n', '\n```\n', 'código') }),
        UI.button({ label: 'Enlace', icon: 'link', small: true, variant: 'ghost', ariaLabel: 'Insertar enlace', onClick: () => wrapSelection(body, '[', '](https://)', 'texto del enlace') }));
      function setMode(isPreview) {
        editBtn.setAttribute('aria-pressed', String(!isPreview));
        previewBtn.setAttribute('aria-pressed', String(isPreview));
        body.hidden = isPreview;
        formatBar.hidden = isPreview;
        preview.hidden = !isPreview;
        if (isPreview) {
          const html = U.markdownToHtml(body.value);
          // markdownToHtml escapa todo el texto antes de dar formato.
          preview.innerHTML = html || '<p class="muted">La nota está vacía.</p>';
          preview.focus();
        } else {
          body.focus();
        }
      }
      editor = h('div', { class: 'notes-editor' },
        h('div', { class: 'note-editor-head' },
          titleInput,
          h('div', { class: 'note-editor-actions' },
            h('div', { class: 'segmented', role: 'group', 'aria-label': 'Modo del editor' }, editBtn, previewBtn),
            note.demo && UI.demoBadge(),
            UI.iconButton({ icon: 'copy', label: 'Copiar el texto de la nota', fk: 'note-copy', onClick: () => UI.copy(body.value, 'Nota copiada.') }),
            UI.iconButton({ icon: 'trash', label: 'Eliminar esta nota', variant: 'danger-ghost', fk: 'note-delete', onClick: () => { save.flush(); deleteNote(S.get('notes', note.id)); } }))),
        formatBar, body, preview, statusEl);
    }
    renderList();
    U.mount(container, h('div', { class: 'notes-layout' }, aside, editor));
  }

  // ===================================================== Fragmentos de código
  function snippetFields() {
    return [
      { name: 'title', label: 'Título', required: true, full: true, autofocus: true, maxlength: 150 },
      { name: 'language', label: 'Lenguaje', type: 'datalist', options: C.SNIPPET_LANGUAGES, placeholder: 'Por ejemplo: HTML' },
      { name: 'tags', label: 'Etiquetas', type: 'tags' },
      { name: 'description', label: 'Para qué sirve', type: 'textarea', full: true, rows: 2 },
      { name: 'code', label: 'Código', type: 'code', full: true, required: true, rows: 10 }
    ];
  }

  function openSnippetForm(snippet) {
    const editing = Boolean(snippet);
    UI.openForm({
      title: editing ? 'Editar fragmento' : 'Nuevo fragmento de código',
      submitLabel: editing ? 'Guardar cambios' : 'Guardar fragmento',
      size: 'lg',
      fields: snippetFields(),
      values: editing ? S.get('snippets', snippet.id) : {},
      onSubmit: (v) => {
        if (editing) S.update('snippets', snippet.id, v);
        else S.add('snippets', v);
        UI.toast('Fragmento «' + v.title + '» guardado.');
      }
    });
  }

  async function deleteSnippet(s) {
    const ok = await UI.confirm({ title: 'Eliminar fragmento', message: '¿Seguro que quieres eliminar el fragmento «' + s.title + '»?', details: 'Esta acción no se puede deshacer.', confirmLabel: 'Eliminar fragmento', danger: true });
    if (!ok) return;
    S.remove('snippets', s.id);
    UI.toast('Fragmento eliminado.');
  }

  function snippetCard(s) {
    return h('article', { class: ['card', 'snippet-card', s.demo && 'is-demo'] },
      h('div', { class: 'card-head' },
        h('h3', { class: 'card-title', text: s.title }),
        h('div', { class: 'card-actions' },
          UI.iconButton({ icon: 'edit', label: 'Editar «' + s.title + '»', fk: 'snippet-edit-' + s.id, onClick: () => openSnippetForm(s) }),
          UI.iconButton({ icon: 'trash', label: 'Eliminar «' + s.title + '»', variant: 'danger-ghost', fk: 'snippet-del-' + s.id, onClick: () => deleteSnippet(s) }))),
      h('div', { class: 'meta-row' },
        s.language && UI.badge(s.language, 'lang'),
        s.tags.map((t) => UI.badge('#' + t, 'tag')),
        s.demo && UI.demoBadge()),
      s.description && h('p', { class: 'pre-wrap', text: s.description }),
      UI.codeBlock(s.code, s.language),
      h('p', { class: 'muted small', text: 'Guardado el ' + U.formatDate(s.createdAt) }));
  }

  function renderSnippets(container) {
    const results = h('div', { class: 'results' });
    const count = h('p', { class: 'results-count', 'aria-live': 'polite' });
    const all = S.visible('snippets');
    const languages = Array.from(new Set(all.map((s) => s.language).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'es'));
    if (snippetFilters.language && !languages.includes(snippetFilters.language)) snippetFilters.language = '';
    function renderResults() {
      const list = all.filter((s) => (!snippetFilters.language || s.language === snippetFilters.language) &&
        U.matchesQuery(snippetFilters.q, s.title, s.description, s.code, s.tags.join(' ')))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      count.textContent = 'Mostrando ' + list.length + ' de ' + U.plural(all.length, 'fragmento', 'fragmentos');
      if (!all.length) {
        results.replaceChildren(UI.emptyState({
          icon: 'code', title: 'Aún no has guardado fragmentos de código',
          text: 'Guarda aquí trozos de código que te resulten útiles para reutilizarlos y copiarlos con un clic.',
          actions: [UI.button({ label: 'Nuevo fragmento', icon: 'plus', variant: 'primary', onClick: () => openSnippetForm() })]
        }));
      } else if (!list.length) {
        results.replaceChildren(UI.emptyState({ icon: 'search', title: 'Ningún fragmento coincide con la búsqueda' }));
      } else {
        results.replaceChildren(h('div', { class: 'snippet-list' }, list.map(snippetCard)));
      }
    }
    U.mount(container, 
      h('div', { class: 'section-head' },
        h('p', { class: 'muted', text: 'Trozos de código que quieres reutilizar.' }),
        UI.button({ label: 'Nuevo fragmento', icon: 'plus', variant: 'primary', fk: 'new-snippet', onClick: () => openSnippetForm() })),
      h('div', { class: 'toolbar', role: 'search', 'aria-label': 'Buscar fragmentos' },
        UI.searchInput({ placeholder: 'Buscar en título, descripción, código o etiquetas…', label: 'Buscar fragmentos de código', value: snippetFilters.q, fk: 'snippet-q', onInput: (v) => { snippetFilters.q = v; renderResults(); } }),
        h('div', { class: 'toolbar-filters' },
          UI.selectFilter({ label: 'Lenguaje', value: snippetFilters.language, options: [{ value: '', label: 'Todos' }].concat(languages.map((l) => ({ value: l, label: l }))), fk: 'snippet-lang', onChange: (v) => { snippetFilters.language = v; renderResults(); } }))),
      count, results);
    renderResults();
  }

  // ================================================================== Vista
  function currentTab(params) {
    const requested = params && params[0];
    if (TABS.some((t) => t.id === requested)) return requested;
    return App.prefs.get('learningTab', 'conceptos');
  }

  App.views.aprendizaje = {
    title: (params) => {
      const tab = TABS.find((t) => t.id === currentTab(params));
      return (tab ? tab.label + ' · ' : '') + 'Mi aprendizaje';
    },
    newItem: (params) => {
      const tab = currentTab(params);
      if (tab === 'notas') newNote();
      else if (tab === 'fragmentos') openSnippetForm();
      else openConceptForm();
    },
    flush: () => { if (flushEditor) flushEditor.flush(); },
    render(root, params) {
      flushEditor = null;
      const tab = currentTab(params);
      App.prefs.set('learningTab', tab);
      const counts = { conceptos: S.visible('concepts').length, notas: S.visible('notes').length, fragmentos: S.visible('snippets').length };
      const panelId = 'panel-aprendizaje';
      const container = h('div', { class: 'tab-panel', id: panelId, role: 'tabpanel', 'aria-labelledby': 'tab-' + tab });
      U.mount(root, 
        UI.pageHeader({
          title: 'Mi aprendizaje', icon: 'book',
          subtitle: 'Los conceptos y herramientas que voy investigando de verdad: explicaciones con mis palabras, notas y código.'
        }),
        UI.tabs({
          label: 'Apartados de aprendizaje', active: tab,
          tabs: TABS.map((t) => Object.assign({ count: counts[t.id] }, t)),
          onSelect: (id) => App.navigate('aprendizaje/' + id)
        }),
        container);
      if (tab === 'notas') renderNotes(container);
      else if (tab === 'fragmentos') renderSnippets(container);
      else renderConcepts(container);
    }
  };
})(window.App = window.App || {});
