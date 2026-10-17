/*
 * Configuración: copias de seguridad (exportar/importar JSON), copia automática,
 * categorías, datos de ejemplo, almacenamiento, atajos y limitaciones.
 */
(function (App) {
  'use strict';

  const U = App.util;
  const C = App.C;
  const UI = App.ui;
  const S = App.store;
  const h = U.h;
  App.views = App.views || {};

  const MAX_IMPORT_BYTES = 15 * 1024 * 1024;

  // ------------------------------------------------------ Exportar e importar
  function exportData() {
    U.downloadFile('mi-centro-ia-' + U.todayStamp() + '.json', S.exportJSON());
    App.prefs.set('lastExport', U.nowISO());
    UI.toast('Datos exportados. Encontrarás el archivo en la carpeta Descargas.');
  }

  function showImportError(message) {
    const m = UI.modal({
      title: 'No se puede importar el archivo',
      size: 'sm',
      body: h('div', {},
        h('div', { class: 'notice notice-error' }, U.icon('alert'), h('p', { text: message })),
        h('p', { text: 'Tus datos actuales no se han modificado.' })),
      actions: [UI.button({ label: 'Entendido', variant: 'primary', onClick: () => m.close() })]
    });
  }

  async function handleFile(file) {
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) {
      showImportError('El archivo es demasiado grande (más de 15 MB) para ser una exportación de esta aplicación.');
      return;
    }
    let text;
    try {
      text = await U.readFileAsText(file);
    } catch (e) {
      showImportError('No se pudo leer el archivo.');
      return;
    }
    const parsed = S.parseImport(text);
    if (!parsed.ok) { showImportError(parsed.error); return; }
    reviewImport(parsed, file.name);
  }

  function radio(name, value, label, description, checked) {
    const id = U.uid('modo');
    return h('label', { class: 'radio-card', for: id },
      h('input', { id, type: 'radio', name, value, checked }),
      h('span', { class: 'radio-text' }, h('strong', { text: label }), h('span', { class: 'small muted', text: description })));
  }

  function reviewImport(parsed, filename) {
    const name = U.uid('modo-importacion');
    const table = h('table', { class: 'table' },
      h('caption', { class: 'sr-only', text: 'Comparación entre tus datos actuales y el archivo' }),
      h('thead', {}, h('tr', {}, h('th', { scope: 'col', text: 'Elemento' }), h('th', { scope: 'col', text: 'Ahora tienes' }), h('th', { scope: 'col', text: 'En el archivo' }))),
      h('tbody', {}, parsed.summary.map((s) => h('tr', {},
        h('th', { scope: 'row', text: s.label }),
        h('td', { text: String(S.all(s.coll).length) }),
        h('td', { text: String(s.count) })))));
    const body = h('div', { class: 'import-review' },
      h('p', {}, 'Archivo: ', h('strong', { text: filename })),
      parsed.exportedAt && h('p', { class: 'muted small', text: 'Exportado el ' + U.formatDateTime(parsed.exportedAt) }),
      h('div', { class: 'notice notice-success' }, U.icon('checkCircle'), h('p', { text: 'El archivo es válido. Revisa el contenido antes de importarlo.' })),
      table,
      parsed.warnings.length > 0 && h('details', { class: 'warnings' },
        h('summary', { text: U.plural(parsed.warnings.length, 'aviso', 'avisos') + ' sobre el archivo' }),
        h('ul', {}, parsed.warnings.map((w) => h('li', { text: w })))),
      h('fieldset', { class: 'radio-group' },
        h('legend', { class: 'field-label', text: '¿Cómo quieres importarlo?' }),
        radio(name, 'merge', 'Combinar con mis datos', 'Añade los elementos del archivo que no tengas. Tus datos actuales se conservan sin cambios.', true),
        radio(name, 'replace', 'Reemplazar todos mis datos', 'Borra tus datos actuales y deja solo los del archivo.', false)),
      h('div', { class: 'notice' }, U.icon('info'),
        h('div', {},
          h('p', { text: 'Antes de importar se guardará automáticamente una copia de tus datos actuales, que podrás restaurar desde esta misma página.' }),
          h('div', { class: 'notice-actions' }, UI.button({ label: 'Exportar también mis datos actuales', icon: 'download', small: true, onClick: exportData })))));
    const m = UI.modal({
      title: 'Revisar la importación',
      size: 'md',
      body,
      closeOnBackdrop: false,
      actions: [
        UI.button({ label: 'Cancelar', onClick: () => { m.close(); UI.toast('Importación cancelada. No se ha modificado nada.', 'info'); } }),
        UI.button({
          label: 'Importar', icon: 'upload', variant: 'primary', fk: 'import-confirm',
          onClick: async () => {
            const mode = body.querySelector('input[name="' + name + '"]:checked').value;
            if (mode === 'replace') {
              const ok = await UI.confirm({
                title: 'Reemplazar todos los datos',
                message: 'Se sustituirán todos tus datos actuales por los del archivo.',
                details: 'Podrás deshacerlo restaurando la copia automática desde Configuración.',
                confirmLabel: 'Reemplazar mis datos',
                danger: true
              });
              if (!ok) return;
            }
            const res = S.applyImport(parsed, mode);
            m.close();
            UI.toast(mode === 'replace'
              ? 'Datos importados: ' + U.plural(res.added, 'elemento', 'elementos') + '.'
              : 'Importación combinada: ' + U.plural(res.added, 'elemento añadido', 'elementos añadidos') + (res.skipped ? '; ' + U.plural(res.skipped, 'ya existía y se ha conservado', 'ya existían y se han conservado') : '') + '.');
            if (!res.backupOk) UI.toast('Aviso: no se pudo guardar la copia automática previa.', 'error');
          }
        })
      ]
    });
  }

  function backupPanel() {
    const fileId = U.uid('importar');
    const fileInput = h('input', {
      id: fileId, type: 'file', accept: 'application/json,.json', class: 'sr-only', tabindex: '-1', 'aria-hidden': 'true',
      onChange: (e) => { const file = e.target.files[0]; e.target.value = ''; handleFile(file); }
    });
    const lastExport = App.prefs.get('lastExport', null);
    return UI.panel({
      title: 'Copia de seguridad', icon: 'download',
      body: h('div', {},
        h('p', { text: 'Exporta todos tus datos a un archivo JSON para guardarlos en Google Drive, en un USB o para pasarlos a otro navegador. Después podrás importarlos aquí.' }),
        h('p', { class: 'muted small', text: 'Última exportación desde este navegador: ' + (lastExport ? U.formatDateTime(lastExport) : 'nunca') + '.' }),
        h('div', { class: 'stack-actions row' },
          UI.button({ label: 'Exportar datos (JSON)', icon: 'download', variant: 'primary', fk: 'export-btn', onClick: exportData }),
          UI.button({ label: 'Importar datos…', icon: 'upload', fk: 'import-btn', onClick: () => fileInput.click() }),
          fileInput),
        h('p', { class: 'muted small', text: 'Antes de importar se comprueba que el archivo es válido y se muestra un resumen: podrás cancelar sin que cambie nada.' }))
    });
  }

  function autoBackupPanel() {
    const b = S.readBackup();
    return UI.panel({
      title: 'Copia automática', icon: 'restore',
      body: b
        ? h('div', {},
          h('p', {}, 'Última copia automática: ', h('strong', { text: U.formatDateTime(b.createdAt) }), ' (' + b.reason.toLowerCase() + ').'),
          h('p', { class: 'muted small', text: 'Contiene ' + U.plural(b.parsed.total, 'elemento', 'elementos') + ': ' + b.parsed.summary.filter((s) => s.count).map((s) => s.label.toLowerCase() + ' (' + s.count + ')').join(', ') + '.' }),
          h('div', { class: 'stack-actions row' },
            UI.button({
              label: 'Restaurar esta copia', icon: 'restore', fk: 'backup-restore',
              onClick: async () => {
                const ok = await UI.confirm({ title: 'Restaurar la copia automática', message: '¿Sustituir tus datos actuales por la copia del ' + U.formatDateTime(b.createdAt) + '?', details: 'Tus datos actuales se guardarán a su vez como nueva copia automática.', confirmLabel: 'Restaurar copia', danger: true });
                if (!ok) return;
                if (S.restoreBackup()) UI.toast('Copia restaurada.');
                else UI.toast('No se pudo restaurar la copia.', 'error');
              }
            }),
            UI.button({
              label: 'Descargar esta copia', icon: 'download', variant: 'ghost', fk: 'backup-download',
              onClick: () => {
                U.downloadFile('mi-centro-ia-copia-automatica-' + U.todayStamp() + '.json',
                  JSON.stringify({ schema: S.SCHEMA, version: S.VERSION, app: C.APP_NAME, exportedAt: b.createdAt, data: b.parsed.data }, null, 2));
                UI.toast('Copia automática descargada.');
              }
            })))
        : h('p', { class: 'muted', text: 'Todavía no hay ninguna copia automática. Se crea sola antes de importar datos, restaurar una copia o borrar todos los datos.' })
    });
  }

  // ------------------------------------------------------------- Categorías
  function openCategoryForm(cat) {
    const editing = Boolean(cat);
    UI.openForm({
      title: editing ? 'Editar categoría' : 'Nueva categoría',
      submitLabel: editing ? 'Guardar' : 'Crear categoría',
      size: 'sm',
      fields: [
        { name: 'name', label: 'Nombre', required: true, full: true, autofocus: true, maxlength: 80 },
        { name: 'color', label: 'Color', type: 'select', full: true, options: UI.optionsFrom('CATEGORY_COLORS') }
      ],
      values: editing ? cat : { color: C.CATEGORY_COLORS[S.all('categories').length % C.CATEGORY_COLORS.length].id },
      onSubmit: (v) => {
        const dup = S.all('categories').find((c) => U.normalizeText(c.name) === U.normalizeText(v.name) && (!editing || c.id !== cat.id));
        if (dup) return 'Ya existe una categoría llamada «' + dup.name + '».';
        if (editing) S.update('categories', cat.id, v);
        else S.add('categories', v);
        UI.toast('Categoría «' + v.name + '» guardada.');
      }
    });
  }

  async function deleteCategory(cat) {
    const used = S.usage('categories', cat.id);
    const ok = await UI.confirm({
      title: 'Eliminar categoría',
      message: '¿Eliminar la categoría «' + cat.name + '»?',
      details: used ? U.plural(used, 'elemento usa', 'elementos usan') + ' esta categoría: no se borrarán, quedarán como «Sin categoría».' : 'Ningún elemento usa esta categoría.',
      confirmLabel: 'Eliminar categoría',
      danger: true
    });
    if (!ok) return;
    S.remove('categories', cat.id);
    UI.toast('Categoría eliminada.');
  }

  function categoriesPanel() {
    const cats = S.all('categories');
    return UI.panel({
      title: 'Categorías de aprendizaje', icon: 'folder',
      actions: [UI.button({ label: 'Nueva categoría', icon: 'plus', small: true, fk: 'cat-new', onClick: () => openCategoryForm() })],
      body: cats.length
        ? h('ul', { class: 'row-list' }, cats.map((c) => {
          const used = S.usage('categories', c.id);
          return h('li', { class: 'category-row' },
            h('span', { class: 'chip cat-' + c.color }, U.icon(UI.categoryIcon(c.id)), c.name),
            h('span', { class: 'muted small', text: U.plural(used, 'elemento', 'elementos') }),
            h('div', { class: 'card-actions' },
              UI.iconButton({ icon: 'edit', label: 'Editar la categoría «' + c.name + '»', fk: 'cat-edit-' + c.id, onClick: () => openCategoryForm(c) }),
              UI.iconButton({ icon: 'trash', label: 'Eliminar la categoría «' + c.name + '»', variant: 'danger-ghost', fk: 'cat-del-' + c.id, onClick: () => deleteCategory(c) })));
        }))
        : UI.emptyState({ compact: true, icon: 'folder', title: 'No hay categorías', actions: [UI.button({ label: 'Nueva categoría', icon: 'plus', onClick: () => openCategoryForm() })] })
    });
  }

  // -------------------------------------------------------- Datos de ejemplo
  function demoPanel() {
    const count = S.countDemo();
    const show = S.settings().showDemo;
    const id = U.uid('mostrar-ejemplos');
    return UI.panel({
      title: 'Datos de ejemplo', icon: 'eye',
      body: h('div', {},
        h('p', { text: 'Algunos elementos son de demostración y llevan la etiqueta «Ejemplo» y un borde discontinuo: prompts de ejemplo, un concepto, un proyecto y un recurso. No hay tareas de ejemplo, así que no alteran los contadores del inicio. Tus notas iniciales de WhatsApp y las fichas de herramientas son datos reales.' }),
        h('p', {}, 'Ejemplos guardados ahora: ', h('strong', { text: String(count) }), '.'),
        h('label', { class: 'check switch', for: id },
          h('input', {
            id, type: 'checkbox', checked: show, 'data-fk': 'demo-toggle',
            onChange: (e) => { S.setSetting('showDemo', e.target.checked); UI.toast(e.target.checked ? 'Los ejemplos vuelven a mostrarse.' : 'Ejemplos ocultos. Puedes volver a mostrarlos aquí.', 'info'); }
          }),
          h('span', { text: 'Mostrar los datos de ejemplo' })),
        h('div', { class: 'stack-actions row' },
          UI.button({
            label: 'Eliminar todos los ejemplos', icon: 'trash', variant: 'danger-ghost', disabled: !count, fk: 'demo-remove',
            onClick: async () => {
              const ok = await UI.confirm({ title: 'Eliminar los ejemplos', message: '¿Eliminar los ' + count + ' elementos de ejemplo?', details: 'Tus datos reales no se tocan. Si alguna tarea tuya estaba en el proyecto de ejemplo, quedará sin proyecto. Podrás restaurar los ejemplos cuando quieras.', confirmLabel: 'Eliminar ejemplos', danger: true });
              if (!ok) return;
              const removed = S.removeDemo();
              UI.toast(U.plural(removed, 'ejemplo eliminado', 'ejemplos eliminados') + '.');
            }
          }),
          UI.button({
            label: 'Restaurar los ejemplos', icon: 'restore', variant: 'ghost', fk: 'demo-restore',
            onClick: () => {
              const added = S.restoreDemo();
              UI.toast(added ? U.plural(added, 'ejemplo restaurado', 'ejemplos restaurados') + '.' : 'Los ejemplos ya estaban todos.', added ? 'success' : 'info');
            }
          })))
    });
  }

  // ---------------------------------------------------- Almacenamiento y más
  function storagePanel() {
    const st = S.status;
    const usage = S.storageUsage();
    const kb = (bytes) => (bytes / 1024).toLocaleString('es-ES', { maximumFractionDigits: 1 }) + ' KB';
    return UI.panel({
      title: 'Almacenamiento', icon: 'database',
      body: h('div', {},
        st.storageAvailable
          ? h('p', { text: 'Los datos se guardan automáticamente en este navegador (localStorage), sin cuenta y sin conexión a Internet.' })
          : h('div', { class: 'notice notice-error' }, U.icon('alert'), h('p', { text: 'Este navegador no permite guardar datos (¿modo incógnito o almacenamiento bloqueado?). Los cambios se perderán al cerrar la página: exporta tus datos.' })),
        UI.details([
          ['Último guardado', st.lastSaved ? U.formatDateTime(st.lastSaved) : 'Todavía no se ha guardado nada en esta sesión.'],
          ['Espacio usado', kb(usage.main) + ' (datos) · ' + kb(usage.backup) + ' (copia automática)'],
          ['Elementos', C.COLLECTIONS.map((c) => C.COLLECTION_LABELS[c] + ': ' + S.all(c).length).join(' · ')]
        ]),
        h('div', { class: 'notice notice-warning' }, U.icon('alert'),
          h('p', { text: 'Importante: los datos solo están en este navegador y en este equipo. Si borras los datos de navegación de este sitio, los perderás. Exporta una copia de seguridad con regularidad.' })))
    });
  }

  function shortcutsPanel() {
    const rows = [
      ['/', 'Ir al buscador de la sección actual'],
      ['N', 'Crear un elemento nuevo en la sección actual'],
      ['Esc', 'Cerrar la ventana abierta o el menú'],
      ['Ctrl + Intro', 'Guardar el formulario abierto'],
      ['Tab / Mayús + Tab', 'Moverse entre botones y campos'],
      ['← →', 'Cambiar de pestaña cuando una pestaña tiene el foco']
    ];
    return UI.panel({
      title: 'Atajos de teclado', icon: 'keyboard',
      body: h('dl', { class: 'shortcuts' }, rows.map((r) => h('div', { class: 'shortcut' }, h('dt', {}, h('kbd', { text: r[0] })), h('dd', { text: r[1] }))))
    });
  }

  function aboutPanel() {
    return UI.panel({
      title: 'Cómo funciona y limitaciones', icon: 'info',
      body: h('ul', { class: 'plain-list' },
        h('li', { text: 'Funciona directamente en el navegador, sin instalar nada, sin cuenta y sin claves API.' }),
        h('li', { text: 'No busca ni navega por Internet automáticamente. El botón «Buscar en Google» solo abre la búsqueda en una pestaña nueva.' }),
        h('li', { text: 'No sincroniza entre dispositivos. Para pasar tus datos a otro equipo, usa Exportar e Importar.' }),
        h('li', { text: 'Las fichas de herramientas se documentaron el 17/10/2026. Precios, planes y funciones cambian: compruébalos en los recursos oficiales.' }),
        h('li', { text: 'Los enlaces externos necesitan conexión a Internet para abrirse.' }))
    });
  }

  function dangerPanel() {
    return UI.panel({
      title: 'Zona peligrosa', icon: 'alert', className: 'panel-danger',
      body: h('div', {},
        h('p', { text: 'Borra todos tus datos y vuelve al estado inicial (tus 9 notas de WhatsApp, las fichas de herramientas y los ejemplos). Antes se guardará una copia automática.' }),
        UI.button({
          label: 'Borrar todos mis datos', icon: 'trash', variant: 'danger', fk: 'reset-all',
          onClick: async () => {
            const ok = await UI.confirm({
              title: 'Borrar todos los datos',
              message: 'Se eliminarán todas tus tareas, fichas, conceptos, notas, fragmentos, prompts, proyectos y recursos.',
              details: 'Se guardará una copia automática que podrás restaurar desde esta página, pero te recomendamos exportar antes tus datos.',
              confirmLabel: 'Borrar todo',
              danger: true,
              requireText: 'BORRAR'
            });
            if (!ok) return;
            S.resetAll();
            UI.toast('Datos borrados. Se han restablecido los datos iniciales.');
            App.navigate('inicio');
          }
        }))
    });
  }

  App.views.configuracion = {
    title: 'Configuración',
    render(root) {
      U.mount(root, 
        UI.pageHeader({ title: 'Configuración', icon: 'settings', subtitle: 'Copias de seguridad, categorías, datos de ejemplo y almacenamiento.' }),
        h('div', { class: 'settings-grid' },
          backupPanel(),
          autoBackupPanel(),
          categoriesPanel(),
          demoPanel(),
          storagePanel(),
          shortcutsPanel(),
          aboutPanel(),
          dangerPanel()));
    }
  };

  App.settingsView = { exportData, handleFile };
})(window.App = window.App || {});
