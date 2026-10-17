/*
 * Componentes de interfaz reutilizables: botones, insignias, ventanas,
 * confirmaciones, avisos (toasts) y un generador de formularios.
 */
(function (App) {
  'use strict';

  const U = App.util;
  const C = App.C;
  const h = U.h;

  // --------------------------------------------------------------- Botones
  function button(o) {
    return h('button', {
      type: o.type || 'button',
      class: ['btn', o.variant && 'btn-' + o.variant, o.small && 'btn-sm', o.className],
      onClick: o.onClick,
      title: o.title,
      'aria-label': o.ariaLabel,
      'aria-pressed': o.pressed === undefined ? undefined : String(Boolean(o.pressed)),
      'data-fk': o.fk,
      disabled: o.disabled
    }, o.icon && U.icon(o.icon), o.label && h('span', { class: 'btn-label', text: o.label }));
  }

  function iconButton(o) {
    return h('button', {
      type: 'button',
      class: ['btn', 'btn-icon', o.variant && 'btn-' + o.variant, o.className],
      onClick: o.onClick,
      title: o.label,
      'aria-label': o.label,
      'aria-pressed': o.pressed === undefined ? undefined : String(Boolean(o.pressed)),
      'data-fk': o.fk,
      disabled: o.disabled
    }, U.icon(o.icon));
  }

  /** Enlace con aspecto de botón. Los externos se abren en una pestaña nueva. */
  function linkButton(o) {
    const external = /^https?:/i.test(o.href);
    return h('a', {
      class: ['btn', o.variant && 'btn-' + o.variant, o.small && 'btn-sm'],
      href: o.href,
      target: external ? '_blank' : undefined,
      rel: external ? 'noopener noreferrer' : undefined,
      'aria-label': o.ariaLabel || (external && o.label ? o.label + ' (se abre en una pestaña nueva)' : undefined),
      'data-fk': o.fk
    }, o.icon && U.icon(o.icon), o.label && h('span', { class: 'btn-label', text: o.label }));
  }

  // ------------------------------------------------------ Insignias y chips
  function badge(text, variant, title) {
    return h('span', { class: ['badge', variant && 'badge-' + variant], title }, text);
  }
  function statusBadge(status) { return badge(C.label('TASK_STATUS', status), 'status-' + status); }
  function priorityBadge(priority) { return badge('Prioridad ' + C.label('PRIORITY', priority).toLowerCase(), 'prio-' + priority); }
  function demoBadge() { return badge('Ejemplo', 'demo', 'Dato de demostración: no forma parte de tus datos reales'); }

  function categoryChip(categoryId) {
    const cat = categoryId ? App.store.get('categories', categoryId) : null;
    if (!cat) return h('span', { class: 'chip chip-muted' }, U.icon('folder'), 'Sin categoría');
    return h('span', { class: 'chip cat-' + cat.color }, U.icon(C.CATEGORY_ICONS[cat.id] || 'folder'), cat.name);
  }
  function categoryIcon(categoryId) {
    return C.CATEGORY_ICONS[categoryId] || 'folder';
  }

  // -------------------------------------------------- Controles de filtros
  function searchInput(o) {
    const id = U.uid('buscar');
    return h('div', { class: ['search', o.className] },
      h('label', { class: 'sr-only', for: id, text: o.label || o.placeholder }),
      U.icon('search'),
      h('input', {
        id, type: 'search', class: 'input', placeholder: o.placeholder, value: o.value || '',
        autocomplete: 'off', spellcheck: 'false', 'data-search': '', 'data-fk': o.fk,
        onInput: (e) => o.onInput(e.target.value)
      }));
  }

  function selectFilter(o) {
    const id = U.uid('filtro');
    return h('div', { class: ['field-inline', o.className] },
      h('label', { for: id, class: 'field-inline-label', text: o.label }),
      h('select', {
        id, class: 'input', value: o.value, 'data-fk': o.fk,
        onChange: (e) => o.onChange(e.target.value)
      }, o.options.map((opt) => h('option', { value: opt.value, text: opt.label }))));
  }

  /** Opciones {value,label} a partir de una lista de constantes, con una opción inicial opcional. */
  function optionsFrom(listName, first) {
    const opts = C[listName].map((o) => ({ value: o.id, label: o.label }));
    return first ? [{ value: '', label: first }].concat(opts) : opts;
  }
  function categoryOptions(first) {
    const opts = App.store.all('categories').map((c) => ({ value: c.id, label: c.name }));
    return first ? [{ value: '', label: first }].concat(opts) : opts;
  }

  // -------------------------------------------------------- Bloques comunes
  function pageHeader(o) {
    return h('header', { class: 'page-header' },
      o.back && h('a', { class: 'back-link', href: o.back.href }, U.icon('arrowLeft'), o.back.label),
      h('div', { class: 'page-header-row' },
        h('div', { class: 'page-heading' },
          o.icon && U.icon(o.icon, 'page-icon'),
          h('div', { class: 'page-heading-text' },
            h('h1', { class: 'page-title', tabindex: '-1', text: o.title }),
            o.badges && h('div', { class: 'page-badges' }, o.badges),
            o.subtitle && h('p', { class: 'page-subtitle', text: o.subtitle }))),
        o.actions && h('div', { class: 'page-actions' }, o.actions)));
  }

  function panel(o) {
    const titleId = U.uid('panel');
    return h('section', { class: ['panel', o.className], 'aria-labelledby': titleId },
      h('div', { class: 'panel-head' },
        h('h2', { class: 'panel-title', id: titleId }, o.icon && U.icon(o.icon), h('span', { text: o.title })),
        o.actions && h('div', { class: 'panel-actions' }, o.actions)),
      h('div', { class: 'panel-body' }, o.body));
  }

  function emptyState(o) {
    return h('div', { class: ['empty', o.compact && 'empty-compact'] },
      U.icon(o.icon || 'info', 'empty-icon'),
      h('p', { class: 'empty-title', text: o.title }),
      o.text && h('p', { class: 'empty-text', text: o.text }),
      o.actions && h('div', { class: 'empty-actions' }, o.actions));
  }

  function textBlock(text, emptyText) {
    if (!text || !String(text).trim()) return h('p', { class: 'pending', text: emptyText || 'Pendiente de completar.' });
    return h('p', { class: 'pre-wrap', text });
  }

  function progressBar(percent, label) {
    const value = Math.max(0, Math.min(100, Math.round(percent)));
    return h('div', {
      class: 'progress', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100',
      'aria-valuenow': String(value), 'aria-label': label
    }, h('div', { class: 'progress-fill', style: { width: value + '%' } }));
  }

  async function copy(text, successMessage) {
    const ok = await U.copyText(text);
    toast(ok ? (successMessage || 'Copiado al portapapeles.') : 'No se pudo copiar. Selecciona el texto y pulsa Ctrl + C.', ok ? 'success' : 'error');
    return ok;
  }

  /** Botones «Abrir» (pestaña nueva) y «Copiar» para un enlace. */
  function linkActions(url, name) {
    if (!U.isSafeUrl(url)) return null;
    const label = name || U.hostOf(url);
    return h('div', { class: 'link-actions' },
      h('a', {
        class: 'btn btn-sm', href: url, target: '_blank', rel: 'noopener noreferrer',
        'aria-label': 'Abrir ' + label + ' en una pestaña nueva', title: url
      }, U.icon('external'), h('span', { class: 'btn-label', text: 'Abrir' })),
      button({ label: 'Copiar', icon: 'copy', small: true, ariaLabel: 'Copiar el enlace de ' + label, onClick: () => copy(url, 'Enlace copiado.') }));
  }

  function linkList(links, emptyText) {
    if (!links || !links.length) return textBlock('', emptyText || 'Sin enlaces todavía.');
    return h('ul', { class: 'link-list' }, links.map((l) => h('li', { class: 'link-item' },
      h('div', { class: 'link-text' },
        h('span', { class: 'link-label', text: l.label || U.hostOf(l.url) }),
        h('span', { class: 'link-url', text: l.url })),
      linkActions(l.url, l.label))));
  }

  function codeBlock(code, language) {
    return h('div', { class: 'code-block' },
      h('div', { class: 'code-head' },
        h('span', { class: 'code-lang', text: language || 'Código' }),
        button({ label: 'Copiar código', icon: 'copy', small: true, variant: 'ghost', onClick: () => copy(code, 'Código copiado.') })),
      h('pre', { tabindex: '0' }, h('code', { text: code })));
  }

  function details(rows) {
    return h('dl', { class: 'details' }, rows.filter(Boolean).map((row) => h('div', { class: 'details-row' },
      h('dt', { text: row[0] }),
      h('dd', {}, row[1] instanceof Node ? row[1] : textBlock(row[1], row[2])))));
  }

  /** Pestañas accesibles (flechas izquierda/derecha para moverse). */
  function tabs(o) {
    const list = h('div', { class: 'tabs', role: 'tablist', 'aria-label': o.label });
    o.tabs.forEach((t) => {
      const selected = t.id === o.active;
      list.appendChild(h('button', {
        type: 'button', role: 'tab', class: 'tab', id: 'tab-' + t.id,
        'aria-selected': String(selected), tabindex: selected ? '0' : '-1', 'data-fk': 'tab-' + t.id,
        onClick: () => o.onSelect(t.id)
      }, t.icon && U.icon(t.icon), h('span', { text: t.label }), t.count !== undefined && h('span', { class: 'tab-count', text: String(t.count) })));
    });
    list.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const items = Array.from(list.querySelectorAll('[role="tab"]'));
      const i = items.indexOf(document.activeElement);
      if (i === -1) return;
      e.preventDefault();
      const next = items[(i + (e.key === 'ArrowRight' ? 1 : -1) + items.length) % items.length];
      next.focus();
      next.click();
    });
    return list;
  }

  // ------------------------------------------------------------------ Avisos
  function toast(message, type, opts) {
    const kind = type || 'success';
    const options = opts || {};
    const el = h('div', { class: 'toast toast-' + kind, role: kind === 'error' ? 'alert' : 'status' },
      U.icon(kind === 'error' ? 'alert' : (kind === 'info' ? 'info' : 'checkCircle')),
      h('span', { class: 'toast-text', text: message }),
      iconButton({ icon: 'close', label: 'Cerrar aviso', className: 'toast-close', onClick: () => dismiss() }));
    let timer = null;
    // Se monta un instante después: si el aviso nace al guardar un formulario,
    // la ventana ya se habrá cerrado y el aviso irá a la página.
    setTimeout(() => {
      // Si sigue abierta una ventana, el aviso se muestra dentro para que sea visible.
      const dialogs = document.querySelectorAll('dialog[open]');
      const dialog = dialogs[dialogs.length - 1];
      let host = document.getElementById('toasts');
      if (dialog) {
        host = dialog.querySelector('.toasts');
        if (!host) {
          host = h('div', { class: 'toasts', 'aria-live': 'polite' });
          dialog.appendChild(host);
        }
      }
      host.appendChild(el);
      timer = setTimeout(dismiss, options.duration || (kind === 'error' ? 8000 : 3500));
    }, 0);
    el.addEventListener('mouseenter', () => clearTimeout(timer));
    el.addEventListener('mouseleave', () => { timer = setTimeout(dismiss, 2000); });
    function dismiss() {
      clearTimeout(timer);
      el.classList.add('toast-leaving');
      setTimeout(() => el.remove(), 180);
    }
    return { dismiss };
  }

  // ---------------------------------------------------------------- Ventanas
  /**
   * Ventana modal basada en <dialog> (Esc cierra, el foco queda dentro).
   * guard: función asíncrona que decide si se puede cerrar (p. ej. cambios sin guardar).
   */
  function modal(o) {
    const previous = document.activeElement;
    const previousKey = previous && previous.dataset ? previous.dataset.fk : null;
    const titleId = U.uid('ventana');
    const dialog = h('dialog', { class: ['modal', 'modal-' + (o.size || 'md'), o.className], 'aria-labelledby': titleId });
    let closing = false;

    async function attemptClose() {
      if (closing) return;
      if (o.guard) {
        closing = true;
        const ok = await o.guard();
        closing = false;
        if (!ok) return;
      }
      dialog.close();
    }

    const header = h('header', { class: 'modal-header' },
      h('h2', { class: 'modal-title', id: titleId, text: o.title }),
      iconButton({ icon: 'close', label: 'Cerrar ventana', variant: 'ghost', onClick: attemptClose }));
    dialog.append(header, h('div', { class: 'modal-body' }, o.body));
    if (o.actions && o.actions.length) dialog.appendChild(h('footer', { class: 'modal-footer' }, o.actions));

    dialog.addEventListener('cancel', (e) => {
      if (o.guard) { e.preventDefault(); attemptClose(); }
    });
    if (o.closeOnBackdrop !== false) {
      dialog.addEventListener('click', (e) => { if (e.target === dialog) attemptClose(); });
    }
    dialog.addEventListener('close', () => {
      // Los avisos que estaban dentro de la ventana pasan a la página.
      const pageToasts = document.getElementById('toasts');
      dialog.querySelectorAll('.toasts .toast').forEach((t) => pageToasts.appendChild(t));
      dialog.remove();
      if (o.onClose) o.onClose();
      let target = previous && previous.isConnected ? previous : null;
      if (!target && previousKey) target = document.querySelector('[data-fk="' + CSS.escape(previousKey) + '"]');
      if (target && typeof target.focus === 'function' && !document.querySelector('dialog[open]')) target.focus();
    });

    document.body.appendChild(dialog);
    dialog.showModal();
    const focusTarget = o.initialFocus ||
      dialog.querySelector('[autofocus]') ||
      dialog.querySelector('.modal-body input:not([type="hidden"]):not([tabindex="-1"]), .modal-body select, .modal-body textarea') ||
      dialog.querySelector('.modal-footer .btn-primary') ||
      header.querySelector('button');
    if (focusTarget) focusTarget.focus();
    return { el: dialog, close: () => dialog.close(), attemptClose };
  }

  /** Confirmación. Devuelve una promesa con true (confirmar) o false (cancelar). */
  function confirmDialog(o) {
    return new Promise((resolve) => {
      let result = false;
      const children = [h('p', { class: 'confirm-message', text: o.message })];
      if (o.details) children.push(o.details instanceof Node ? o.details : h('p', { class: 'muted', text: o.details }));
      let input = null;
      const error = h('p', { class: 'field-error', role: 'alert', hidden: true });
      if (o.requireText) {
        const id = U.uid('confirmar');
        input = h('input', { id, class: 'input', autocomplete: 'off', spellcheck: 'false' });
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); accept(); } });
        children.push(h('div', { class: 'field' },
          h('label', { for: id, class: 'field-label', text: 'Escribe ' + o.requireText + ' para confirmar' }), input, error));
      }
      function accept() {
        if (input && input.value.trim().toUpperCase() !== o.requireText) {
          error.textContent = 'Escribe exactamente «' + o.requireText + '».';
          error.hidden = false;
          input.focus();
          return;
        }
        result = true;
        m.close();
      }
      const cancelBtn = button({ label: o.cancelLabel || 'Cancelar', onClick: () => m.close() });
      const confirmBtn = button({ label: o.confirmLabel || 'Confirmar', variant: o.danger ? 'danger' : 'primary', onClick: accept });
      const m = modal({
        title: o.title, size: 'sm', body: h('div', { class: 'confirm-body' }, children),
        actions: [cancelBtn, confirmBtn],
        initialFocus: input || (o.danger ? cancelBtn : confirmBtn),
        onClose: () => resolve(result)
      });
    });
  }

  // ------------------------------------------------------------- Formularios
  /*
   * Tipos de campo: text, url, textarea, code, select, checkbox, tags, links,
   * multicheck, category, datalist e info. Opciones: name, label, required,
   * placeholder, hint, rows, full (ancho completo), options, nullable.
   */
  function form(fields, values) {
    const vals = values || {};
    const controls = [];
    const grid = h('div', { class: 'form-grid' });
    fields.forEach((f) => {
      if (f.type === 'info') {
        grid.appendChild(h('div', { class: ['form-info', 'field-full', f.variant && 'form-info-' + f.variant] }, U.icon(f.icon || 'info'), h('p', { text: f.text })));
        return;
      }
      const c = createControl(f, vals[f.name]);
      controls.push(c);
      grid.appendChild(c.wrapper);
    });
    const getValues = () => {
      const out = {};
      controls.forEach((c) => { out[c.field.name] = c.get(); });
      return out;
    };
    const validate = () => {
      let first = null;
      controls.forEach((c) => {
        const err = c.validate();
        c.showError(err);
        if (err && !first) first = c;
      });
      if (first) first.focus();
      return !first;
    };
    const initial = JSON.stringify(getValues());
    return { el: grid, getValues, validate, isDirty: () => JSON.stringify(getValues()) !== initial };
  }

  function createControl(f, value) {
    const id = U.uid('campo');
    const hintId = id + '-ayuda';
    const errorId = id + '-error';
    const error = h('p', { class: 'field-error', id: errorId, hidden: true });
    const hint = f.hint ? h('p', { class: 'field-hint', id: hintId, text: f.hint }) : null;
    const describedBy = [hint && hintId, errorId].filter(Boolean).join(' ');
    let input;
    let node;
    let get;
    let extraValidate = () => '';

    switch (f.type) {
      case 'textarea':
      case 'code':
      case 'links': {
        const initial = f.type === 'links' ? U.formatLinks(value) : (value || '');
        input = h('textarea', {
          id, class: ['input', f.type === 'code' && 'mono'], rows: String(f.rows || (f.type === 'code' ? 8 : 4)),
          placeholder: f.placeholder, value: initial, spellcheck: f.type === 'code' || f.type === 'links' ? 'false' : undefined
        });
        node = input;
        if (f.type === 'links') {
          get = () => U.parseLinks(input.value).links;
          extraValidate = () => U.parseLinks(input.value).errors.join(' ');
        } else {
          get = () => input.value;
        }
        break;
      }
      case 'select': {
        const opts = typeof f.options === 'function' ? f.options() : f.options;
        input = h('select', { id, class: 'input', value: value === null || value === undefined ? '' : value },
          opts.map((o) => h('option', { value: o.value, text: o.label })));
        node = input;
        get = () => (f.nullable && !input.value ? null : input.value);
        break;
      }
      case 'category': {
        const cat = categoryControl(id, value);
        input = cat.select;
        node = cat.node;
        get = () => input.value || null;
        break;
      }
      case 'checkbox': {
        input = h('input', { id, type: 'checkbox', checked: Boolean(value) });
        node = h('label', { class: 'check', for: id }, input, h('span', { text: f.checkLabel || f.label }));
        get = () => input.checked;
        break;
      }
      case 'multicheck': {
        const opts = typeof f.options === 'function' ? f.options() : f.options;
        const selected = new Set(value || []);
        const boxes = opts.map((o) => {
          const boxId = U.uid('opcion');
          const box = h('input', { id: boxId, type: 'checkbox', value: o.value, checked: selected.has(o.value) });
          return { box, el: h('label', { class: 'check', for: boxId }, box, h('span', { text: o.label })) };
        });
        input = boxes.length ? boxes[0].box : h('span');
        node = h('fieldset', { class: 'multicheck', 'aria-describedby': describedBy },
          h('legend', { class: 'sr-only', text: f.label }),
          boxes.length ? boxes.map((b) => b.el) : h('p', { class: 'muted', text: f.emptyText || 'No hay opciones disponibles.' }));
        get = () => boxes.filter((b) => b.box.checked).map((b) => b.box.value);
        break;
      }
      case 'tags': {
        input = h('input', { id, type: 'text', class: 'input', value: (value || []).join(', '), placeholder: f.placeholder || 'Separadas por comas' });
        node = input;
        get = () => U.parseTags(input.value);
        break;
      }
      case 'datalist': {
        const listId = id + '-lista';
        const opts = typeof f.options === 'function' ? f.options() : f.options;
        input = h('input', { id, type: 'text', class: 'input', value: value || '', placeholder: f.placeholder, list: listId, autocomplete: 'off' });
        node = h('div', {}, input, h('datalist', { id: listId }, opts.map((o) => h('option', { value: o }))));
        get = () => input.value.trim();
        break;
      }
      case 'url': {
        input = h('input', { id, type: 'url', class: 'input', value: value || '', placeholder: f.placeholder || 'https://…', inputmode: 'url', spellcheck: 'false' });
        input.addEventListener('blur', () => { input.value = U.normalizeUrlInput(input.value); });
        node = input;
        get = () => U.normalizeUrlInput(input.value);
        extraValidate = () => {
          const v = get();
          return v && !U.isSafeUrl(v) ? 'Escribe un enlace completo que empiece por https:// o http://' : '';
        };
        break;
      }
      default: {
        input = h('input', { id, type: 'text', class: 'input', value: value || '', placeholder: f.placeholder, maxlength: f.maxlength ? String(f.maxlength) : undefined });
        node = input;
        get = () => input.value.trim();
      }
    }

    if (f.type !== 'multicheck') input.setAttribute('aria-describedby', describedBy);
    if (f.autofocus) input.setAttribute('autofocus', '');

    const label = f.type === 'checkbox' || f.type === 'multicheck'
      ? (f.type === 'multicheck' ? h('span', { class: 'field-label', text: f.label }) : null)
      : h('label', { class: 'field-label', for: id }, f.label, f.required && h('span', { class: 'required', 'aria-hidden': 'true', text: ' *' }), f.required && h('span', { class: 'sr-only', text: ' (obligatorio)' }));
    if (f.required && f.type !== 'checkbox') input.setAttribute('aria-required', 'true');

    const wrapper = h('div', { class: ['field', f.full && 'field-full', f.type === 'checkbox' && 'field-check'] }, label, hint, node, error);

    return {
      field: f,
      wrapper,
      get,
      focus: () => input.focus(),
      validate: () => {
        const v = get();
        if (f.required && (v === null || v === undefined || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && !v.length))) {
          return 'Este campo es obligatorio.';
        }
        return extraValidate();
      },
      showError: (msg) => {
        error.textContent = msg || '';
        error.hidden = !msg;
        if (f.type !== 'multicheck') input.setAttribute('aria-invalid', msg ? 'true' : 'false');
      }
    };
  }

  /** Selector de categoría con opción para crear una nueva sin salir del formulario. */
  function categoryControl(id, value) {
    const select = h('select', { id, class: 'input' });
    const fill = (selected) => {
      select.replaceChildren(h('option', { value: '', text: 'Sin categoría' }),
        ...App.store.all('categories').map((c) => h('option', { value: c.id, text: c.name })));
      select.value = selected || '';
    };
    fill(value);
    const nameId = U.uid('nueva-categoria');
    const nameInput = h('input', { id: nameId, class: 'input', type: 'text', placeholder: 'Nombre de la nueva categoría', autocomplete: 'off' });
    const addRow = h('div', { class: 'inline-add', hidden: true },
      h('label', { class: 'sr-only', for: nameId, text: 'Nombre de la nueva categoría' }),
      nameInput,
      button({ label: 'Crear', small: true, variant: 'primary', onClick: create }),
      button({ label: 'Cancelar', small: true, variant: 'ghost', onClick: () => { addRow.hidden = true; toggle.focus(); } }));
    const toggle = button({
      label: 'Nueva', icon: 'plus', small: true, variant: 'ghost', ariaLabel: 'Crear una categoría nueva',
      onClick: () => { addRow.hidden = false; nameInput.focus(); }
    });
    nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); create(); }
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); addRow.hidden = true; toggle.focus(); }
    });
    function create() {
      const name = nameInput.value.trim();
      if (!name) { nameInput.focus(); return; }
      const existing = App.store.all('categories').find((c) => U.normalizeText(c.name) === U.normalizeText(name));
      const colors = C.CATEGORY_COLORS;
      const cat = existing || App.store.add('categories', { name, color: colors[App.store.all('categories').length % colors.length].id });
      fill(cat.id);
      nameInput.value = '';
      addRow.hidden = true;
      select.focus();
      toast(existing ? 'La categoría «' + cat.name + '» ya existía y ha quedado seleccionada.' : 'Categoría «' + cat.name + '» creada.', existing ? 'info' : 'success');
    }
    return { select, node: h('div', { class: 'category-control' }, h('div', { class: 'with-action' }, select, toggle), addRow) };
  }

  /** Abre un formulario en una ventana. onSubmit puede devolver un texto de error o false para no cerrar. */
  function openForm(o) {
    const f = form(o.fields, o.values);
    const errorBox = h('div', { class: 'form-error', role: 'alert', hidden: true });
    let busy = false;
    const formEl = h('form', { class: 'form', novalidate: true, onSubmit: (e) => { e.preventDefault(); submit(); } },
      o.intro && h('p', { class: 'form-intro', text: o.intro }),
      errorBox,
      f.el,
      h('button', { type: 'submit', class: 'sr-only', tabindex: '-1', 'aria-hidden': 'true', text: o.submitLabel || 'Guardar' }));
    formEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); submit(); }
    });
    const m = modal({
      title: o.title,
      size: o.size || 'md',
      body: formEl,
      closeOnBackdrop: false,
      guard: async () => !f.isDirty() || confirmDialog({
        title: '¿Descartar los cambios?',
        message: 'Has modificado el formulario y los cambios no se han guardado.',
        confirmLabel: 'Descartar cambios',
        cancelLabel: 'Seguir editando',
        danger: true
      }),
      actions: [
        button({ label: 'Cancelar', onClick: () => m.attemptClose() }),
        button({ label: o.submitLabel || 'Guardar', icon: 'check', variant: 'primary', onClick: submit })
      ]
    });
    async function submit() {
      if (busy) return;
      errorBox.hidden = true;
      if (!f.validate()) return;
      busy = true;
      try {
        const res = await o.onSubmit(f.getValues());
        if (typeof res === 'string') {
          errorBox.textContent = res;
          errorBox.hidden = false;
          return;
        }
        if (res !== false) m.close();
      } catch (err) {
        console.error(err);
        errorBox.textContent = 'No se pudo guardar: ' + (err && err.message ? err.message : 'error desconocido') + '.';
        errorBox.hidden = false;
      } finally {
        busy = false;
      }
    }
    return m;
  }

  App.ui = {
    button, iconButton, linkButton,
    badge, statusBadge, priorityBadge, demoBadge, categoryChip, categoryIcon,
    searchInput, selectFilter, optionsFrom, categoryOptions,
    pageHeader, panel, emptyState, textBlock, progressBar, copy, linkActions, linkList, codeBlock, details, tabs,
    toast, modal, confirm: confirmDialog, form, openForm
  };
})(window.App = window.App || {});
