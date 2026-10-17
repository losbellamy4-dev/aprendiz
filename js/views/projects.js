/*
 * Planificador de proyectos: vista por etapas (Idea → … → Finalizado),
 * ficha de cada proyecto con tareas relacionadas, notas por etapa,
 * problemas y soluciones, enlaces e historial.
 */
(function (App) {
  'use strict';

  const U = App.util;
  const C = App.C;
  const UI = App.ui;
  const S = App.store;
  const h = U.h;
  App.views = App.views || {};

  const filters = { q: '', status: '' };
  let selectedStage = { projectId: null, stage: null };
  let flushStageNotes = null;

  function stageIndex(stage) { return C.STAGES.findIndex((s) => s.id === stage); }

  function projectTasks(p) { return S.visible('tasks').filter((t) => t.projectId === p.id); }

  function taskProgress(p) {
    const list = projectTasks(p);
    const done = list.filter((t) => t.status === 'completada').length;
    return { total: list.length, done, percent: list.length ? Math.round((done / list.length) * 100) : 0 };
  }

  function projectFields() {
    return [
      { name: 'name', label: 'Nombre del proyecto', required: true, full: true, autofocus: true, maxlength: 150 },
      { name: 'objective', label: 'Objetivo', type: 'textarea', full: true, rows: 2, placeholder: '¿Qué quieres conseguir con este proyecto?' },
      { name: 'description', label: 'Descripción', type: 'textarea', full: true, rows: 3 },
      { name: 'stage', label: 'Etapa', type: 'select', options: UI.optionsFrom('STAGES') },
      { name: 'status', label: 'Estado del proyecto', type: 'select', options: UI.optionsFrom('PROJECT_STATUS') },
      { name: 'toolIds', label: 'Herramientas necesarias (de mis fichas)', type: 'multicheck', full: true, options: () => S.all('tools').map((t) => ({ value: t.id, label: t.name })), emptyText: 'No hay fichas de herramientas.' },
      { name: 'otherTools', label: 'Otras herramientas', full: true, placeholder: 'Por ejemplo: editor de texto, navegador, una placa Arduino…' },
      { name: 'nextStep', label: 'Próximo paso', full: true },
      { name: 'links', label: 'Enlaces al código o al repositorio', type: 'links', full: true, rows: 3, hint: 'Un enlace por línea con el formato: Título | https://…', placeholder: 'Repositorio | https://github.com/…' }
    ];
  }

  function openProjectForm(project) {
    const editing = Boolean(project);
    UI.openForm({
      title: editing ? 'Editar proyecto' : 'Nuevo proyecto',
      submitLabel: editing ? 'Guardar cambios' : 'Crear proyecto',
      size: 'lg',
      intro: editing ? undefined : 'Convierte una idea en un proyecto organizado. Podrás añadir tareas, notas por etapa y problemas desde su ficha.',
      fields: projectFields(),
      values: editing ? S.get('projects', project.id) : { stage: 'idea', status: 'activo', toolIds: [], links: [] },
      onSubmit: (v) => {
        if (editing) {
          const prev = S.get('projects', project.id);
          const stage = v.stage;
          delete v.stage;
          S.update('projects', project.id, v);
          if (stage !== prev.stage) S.moveProjectStage(project.id, stage);
          UI.toast('Proyecto «' + v.name + '» guardado.');
        } else {
          const created = S.add('projects', v);
          UI.toast('Proyecto «' + created.name + '» creado.');
          App.navigate('proyectos/' + created.id);
        }
      }
    });
  }

  async function deleteProject(p) {
    const n = S.all('tasks').filter((t) => t.projectId === p.id).length;
    const ok = await UI.confirm({
      title: 'Eliminar proyecto',
      message: '¿Seguro que quieres eliminar el proyecto «' + p.name + '»?',
      details: (n ? 'Sus ' + U.plural(n, 'tarea', 'tareas') + ' no se eliminarán: quedarán sin proyecto. ' : '') + 'Se perderán las notas por etapa, los problemas registrados y el historial. Esta acción no se puede deshacer.',
      confirmLabel: 'Eliminar proyecto',
      danger: true
    });
    if (!ok) return;
    S.remove('projects', p.id);
    UI.toast('Proyecto eliminado.');
    App.navigate('proyectos');
  }

  function moveStage(p, stage) {
    S.moveProjectStage(p.id, stage);
    selectedStage = { projectId: p.id, stage };
    UI.toast('«' + p.name + '» pasa a la etapa: ' + C.label('STAGES', stage) + '.');
  }

  // ------------------------------------------------------------------ Lista
  function projectCard(p, withStageButtons) {
    const prog = taskProgress(p);
    const i = stageIndex(p.stage);
    const prev = C.STAGES[i - 1];
    const next = C.STAGES[i + 1];
    return h('article', { class: ['card', 'project-card', 'project-status-' + p.status, p.demo && 'is-demo'] },
      h('h3', { class: 'card-title' }, h('a', { href: '#/proyectos/' + p.id, 'data-fk': 'project-' + p.id, text: p.name })),
      h('div', { class: 'meta-row' },
        UI.badge(C.label('PROJECT_STATUS', p.status), 'project-' + p.status),
        !withStageButtons && UI.badge('Etapa: ' + C.label('STAGES', p.stage), 'stage'),
        p.demo && UI.demoBadge()),
      p.objective && h('p', { class: 'clamp-2 small', text: p.objective }),
      h('div', { class: 'project-progress' },
        h('span', { class: 'small muted', text: prog.total ? prog.done + ' de ' + U.plural(prog.total, 'tarea completada', 'tareas completadas') : 'Sin tareas' }),
        prog.total > 0 && UI.progressBar(prog.percent, 'Tareas completadas de ' + p.name + ': ' + prog.percent + ' %')),
      p.nextStep && h('p', { class: 'task-next small' }, U.icon('arrowRight'), h('span', { class: 'sr-only', text: 'Próximo paso: ' }), p.nextStep),
      withStageButtons && h('div', { class: 'board-card-actions' },
        prev ? UI.iconButton({ icon: 'chevronLeft', label: 'Retroceder «' + p.name + '» a ' + prev.label, fk: 'pprev-' + p.id, onClick: () => moveStage(p, prev.id) }) : h('span'),
        UI.linkButton({ href: '#/proyectos/' + p.id, label: 'Abrir', small: true, variant: 'ghost' }),
        next ? UI.iconButton({ icon: 'chevronRight', label: 'Avanzar «' + p.name + '» a ' + next.label, fk: 'pnext-' + p.id, onClick: () => moveStage(p, next.id) }) : h('span')));
  }

  function renderList(root) {
    const mode = App.prefs.get('projectView', 'stages');
    const results = h('div', { class: 'results' });
    const count = h('p', { class: 'results-count', 'aria-live': 'polite' });
    function renderResults() {
      const all = S.visible('projects');
      const list = all.filter((p) => (!filters.status || p.status === filters.status) && U.matchesQuery(filters.q, p.name, p.objective, p.description))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      count.textContent = 'Mostrando ' + list.length + ' de ' + U.plural(all.length, 'proyecto', 'proyectos');
      if (!all.length) {
        results.replaceChildren(UI.emptyState({
          icon: 'projects', title: 'Todavía no tienes proyectos',
          text: 'Convierte una idea en un proyecto: define el objetivo, las herramientas y las tareas, y avanza por etapas.',
          actions: [UI.button({ label: 'Nuevo proyecto', icon: 'plus', variant: 'primary', onClick: () => openProjectForm() })]
        }));
      } else if (!list.length) {
        results.replaceChildren(UI.emptyState({ icon: 'search', title: 'Ningún proyecto coincide con la búsqueda' }));
      } else if (mode === 'list') {
        results.replaceChildren(h('div', { class: 'card-grid' }, list.map((p) => projectCard(p, false))));
      } else {
        results.replaceChildren(h('div', { class: 'pipeline', role: 'list', 'aria-label': 'Proyectos por etapa' },
          C.STAGES.map((s, i) => {
            const items = list.filter((p) => p.stage === s.id);
            return h('section', { class: 'pipeline-col', role: 'listitem', 'aria-label': s.label + ': ' + U.plural(items.length, 'proyecto', 'proyectos') },
              h('h2', { class: 'board-title' }, h('span', { class: 'stage-num', text: String(i + 1) }), s.label, h('span', { class: 'count', text: String(items.length) })),
              h('div', { class: 'board-list' }, items.length ? items.map((p) => projectCard(p, true)) : h('p', { class: 'board-empty', text: 'Sin proyectos' })));
          })));
      }
    }
    const setMode = (m) => { App.prefs.set('projectView', m); App.refresh(); };
    U.mount(root, 
      UI.pageHeader({
        title: 'Proyectos', icon: 'projects',
        subtitle: 'Transforma una idea en un proyecto organizado: Idea → Investigación → Planificación → Desarrollo → Pruebas → Finalizado.',
        actions: [
          h('div', { class: 'segmented', role: 'group', 'aria-label': 'Tipo de vista' },
            UI.button({ label: 'Etapas', icon: 'board', small: true, pressed: mode === 'stages', fk: 'pview-stages', onClick: () => setMode('stages') }),
            UI.button({ label: 'Lista', icon: 'list', small: true, pressed: mode === 'list', fk: 'pview-list', onClick: () => setMode('list') })),
          UI.button({ label: 'Nuevo proyecto', icon: 'plus', variant: 'primary', fk: 'new-project', onClick: () => openProjectForm() })
        ]
      }),
      h('div', { class: 'toolbar', role: 'search', 'aria-label': 'Buscar y filtrar proyectos' },
        UI.searchInput({ placeholder: 'Buscar proyectos…', label: 'Buscar proyectos', value: filters.q, fk: 'project-q', onInput: (v) => { filters.q = v; renderResults(); } }),
        h('div', { class: 'toolbar-filters' },
          UI.selectFilter({ label: 'Estado', value: filters.status, options: UI.optionsFrom('PROJECT_STATUS', 'Todos'), fk: 'project-status', onChange: (v) => { filters.status = v; renderResults(); } }))),
      count, results);
    renderResults();
  }

  // ---------------------------------------------------------------- Detalle
  function stepper(p, viewStage) {
    const current = stageIndex(p.stage);
    return h('ol', { class: 'stepper', 'aria-label': 'Etapas del proyecto' }, C.STAGES.map((s, i) => h('li', {
      class: ['step', i < current && 'is-done', i === current && 'is-current', s.id === viewStage && 'is-viewing']
    }, h('button', {
      type: 'button', class: 'step-btn', 'data-fk': 'step-' + s.id,
      'aria-current': i === current ? 'step' : undefined,
      'aria-pressed': String(s.id === viewStage),
      'aria-label': s.label + (i === current ? ' (etapa actual)' : i < current ? ' (superada)' : '') + '. Ver sus notas',
      onClick: () => { flushNotes(); selectedStage = { projectId: p.id, stage: s.id }; App.refresh(); }
    }, h('span', { class: 'step-num', text: String(i + 1) }), h('span', { class: 'step-label', text: s.label })))));
  }

  function flushNotes() { if (flushStageNotes) flushStageNotes(); }

  function issueForm(p, issue) {
    UI.openForm({
      title: issue ? 'Editar problema' : 'Registrar un problema',
      submitLabel: issue ? 'Guardar' : 'Añadir',
      fields: [
        { name: 'problem', label: 'Problema encontrado', type: 'textarea', full: true, required: true, rows: 3, autofocus: true },
        { name: 'solution', label: 'Soluciones probadas', type: 'textarea', full: true, rows: 3, placeholder: 'Qué has probado y qué resultado ha dado.' },
        { name: 'solved', label: 'Problema resuelto', type: 'checkbox', full: true }
      ],
      values: issue || {},
      onSubmit: (v) => {
        const current = S.get('projects', p.id);
        const issues = issue
          ? current.issues.map((i) => (i.id === issue.id ? Object.assign({}, i, v) : i))
          : current.issues.concat([Object.assign({ id: U.uid('issue'), createdAt: U.nowISO() }, v)]);
        S.update('projects', p.id, { issues });
        UI.toast(issue ? 'Problema actualizado.' : 'Problema registrado.');
      }
    });
  }

  async function deleteIssue(p, issue) {
    const ok = await UI.confirm({ title: 'Eliminar problema', message: '¿Eliminar este problema y sus soluciones?', details: U.truncate(issue.problem, 120), confirmLabel: 'Eliminar', danger: true });
    if (!ok) return;
    S.update('projects', p.id, { issues: S.get('projects', p.id).issues.filter((i) => i.id !== issue.id) });
    UI.toast('Problema eliminado.');
  }

  function issuesPanel(p) {
    const list = p.issues.slice().sort((a, b) => Number(a.solved) - Number(b.solved) || b.createdAt.localeCompare(a.createdAt));
    return UI.panel({
      title: 'Problemas encontrados y soluciones probadas', icon: 'alert', className: 'panel-wide',
      actions: [UI.button({ label: 'Registrar problema', icon: 'plus', small: true, fk: 'issue-new', onClick: () => issueForm(p) })],
      body: list.length
        ? h('ul', { class: 'issue-list' }, list.map((i) => {
          const checkId = U.uid('resuelto');
          return h('li', { class: ['issue', i.solved && 'is-solved'] },
            h('div', { class: 'issue-body' },
              h('p', { class: 'issue-label', text: 'Problema' }),
              h('p', { class: 'pre-wrap', text: i.problem || '—' }),
              h('p', { class: 'issue-label', text: 'Soluciones probadas' }),
              UI.textBlock(i.solution, 'Todavía no has anotado soluciones.')),
            h('div', { class: 'issue-side' },
              h('label', { class: 'check', for: checkId },
                h('input', {
                  id: checkId, type: 'checkbox', checked: i.solved, 'data-fk': 'issue-solved-' + i.id,
                  onChange: (e) => {
                    const issues = S.get('projects', p.id).issues.map((x) => (x.id === i.id ? Object.assign({}, x, { solved: e.target.checked }) : x));
                    S.update('projects', p.id, { issues });
                    UI.toast(e.target.checked ? 'Problema marcado como resuelto.' : 'Problema marcado como pendiente.', 'info');
                  }
                }), h('span', { text: 'Resuelto' })),
              h('div', { class: 'card-actions' },
                UI.iconButton({ icon: 'edit', label: 'Editar problema', fk: 'issue-edit-' + i.id, onClick: () => issueForm(p, i) }),
                UI.iconButton({ icon: 'trash', label: 'Eliminar problema', variant: 'danger-ghost', fk: 'issue-del-' + i.id, onClick: () => deleteIssue(p, i) }))));
        }))
        : UI.emptyState({ compact: true, icon: 'checkCircle', title: 'Sin problemas registrados', text: 'Cuando algo no funcione, anótalo aquí junto con lo que has probado: te ahorrará tiempo más adelante.' })
    });
  }

  function tasksPanel(p) {
    const list = projectTasks(p).sort((a, b) => a.order - b.order);
    const prog = taskProgress(p);
    const others = S.visible('tasks').filter((t) => t.projectId !== p.id);
    const linkId = U.uid('vincular');
    const linkSelect = h('select', { id: linkId, class: 'input', 'data-fk': 'link-task-select' },
      h('option', { value: '', text: others.length ? 'Elige una tarea…' : 'No hay otras tareas' }),
      others.map((t) => h('option', { value: t.id, text: t.title + (t.projectId ? ' (en otro proyecto)' : '') })));
    return UI.panel({
      title: 'Tareas del proyecto', icon: 'tasks', className: 'panel-wide',
      actions: [UI.button({ label: 'Nueva tarea en este proyecto', icon: 'plus', small: true, variant: 'primary', fk: 'project-new-task', onClick: () => App.tasks.openTaskForm(null, { projectId: p.id }, 'La tarea se añadirá al proyecto «' + p.name + '».') })],
      body: h('div', {},
        h('div', { class: 'project-progress' },
          h('span', { class: 'small', text: prog.total ? prog.done + ' de ' + U.plural(prog.total, 'tarea completada', 'tareas completadas') + ' (' + prog.percent + ' %)' : 'Este proyecto todavía no tiene tareas.' }),
          prog.total > 0 && UI.progressBar(prog.percent, 'Tareas completadas: ' + prog.percent + ' %')),
        list.length > 0 && h('ul', { class: 'row-list' }, list.map((t) => App.tasks.taskRow(t, {
          statusControl: true, fkPrefix: 'ptask-',
          extra: UI.iconButton({
            icon: 'close', label: 'Quitar «' + t.title + '» del proyecto (la tarea no se borra)', fk: 'unlink-' + t.id,
            onClick: () => { S.update('tasks', t.id, { projectId: null }); UI.toast('«' + t.title + '» ya no forma parte del proyecto.', 'info'); }
          })
        }))),
        h('div', { class: 'inline-add link-existing' },
          h('label', { class: 'field-inline-label', for: linkId, text: 'Vincular una tarea existente' }),
          h('div', { class: 'with-action' }, linkSelect,
            UI.button({
              label: 'Vincular', icon: 'link', small: true, fk: 'link-task-btn', disabled: !others.length,
              onClick: () => {
                const id = linkSelect.value;
                if (!id) { UI.toast('Elige primero una tarea de la lista.', 'error'); linkSelect.focus(); return; }
                const t = S.update('tasks', id, { projectId: p.id });
                UI.toast('«' + t.title + '» añadida al proyecto.');
              }
            }))))
    });
  }

  function renderDetail(root, id) {
    const p = S.get('projects', id);
    if (!p) {
      U.mount(root, 
        UI.pageHeader({ title: 'Proyecto no encontrado', icon: 'alert', back: { href: '#/proyectos', label: 'Proyectos' } }),
        UI.emptyState({ icon: 'alert', title: 'Este proyecto no existe o se ha eliminado.', actions: [UI.linkButton({ href: '#/proyectos', label: 'Volver a Proyectos' })] }));
      return;
    }
    if (selectedStage.projectId !== p.id || stageIndex(selectedStage.stage) < 0) selectedStage = { projectId: p.id, stage: p.stage };
    const viewStage = selectedStage.stage || p.stage;
    const i = stageIndex(p.stage);
    const prev = C.STAGES[i - 1];
    const next = C.STAGES[i + 1];

    // Notas de la etapa seleccionada (guardado automático).
    const notesStatus = h('p', { class: 'save-hint', 'aria-live': 'polite', text: 'Se guarda automáticamente. Las notas de cada etapa se conservan al avanzar o retroceder.' });
    const notesArea = h('textarea', {
      class: 'input', rows: '5', value: p.stageNotes[viewStage] || '', 'data-fk': 'stage-notes-' + viewStage,
      'aria-label': 'Notas de la etapa ' + C.label('STAGES', viewStage), placeholder: 'Qué has hecho o decidido en esta etapa…'
    });
    const save = U.debounce(() => {
      const current = S.get('projects', p.id);
      if (!current) return;
      const stageNotes = Object.assign({}, current.stageNotes, { [viewStage]: notesArea.value });
      S.update('projects', p.id, { stageNotes }, { silent: true });
      notesStatus.textContent = 'Guardado a las ' + U.formatTime(new Date()) + '.';
    }, 600);
    flushStageNotes = save.flush;
    notesArea.addEventListener('input', () => { notesStatus.textContent = 'Guardando…'; save(); });
    notesArea.addEventListener('blur', () => save.flush());

    const statusId = U.uid('estado-proyecto');
    const tools = p.toolIds.map((tid) => S.get('tools', tid)).filter(Boolean);

    U.mount(root, 
      UI.pageHeader({
        title: p.name, icon: 'projects',
        back: { href: '#/proyectos', label: 'Proyectos' },
        badges: [UI.badge('Etapa: ' + C.label('STAGES', p.stage), 'stage'), UI.badge(C.label('PROJECT_STATUS', p.status), 'project-' + p.status), p.demo && UI.demoBadge()],
        actions: [UI.button({ label: 'Editar proyecto', icon: 'edit', fk: 'project-edit', onClick: () => openProjectForm(p) })]
      }),
      h('section', { class: 'panel stage-panel', 'aria-label': 'Etapas del desarrollo' },
        stepper(p, viewStage),
        h('div', { class: 'stage-controls' },
          prev ? UI.button({ label: 'Retroceder a ' + prev.label, icon: 'chevronLeft', fk: 'stage-prev', onClick: () => { flushNotes(); moveStage(p, prev.id); } }) : h('span'),
          viewStage !== p.stage
            ? UI.button({ label: 'Mover el proyecto a «' + C.label('STAGES', viewStage) + '»', icon: 'flag', variant: 'primary', fk: 'stage-move', onClick: () => { flushNotes(); moveStage(p, viewStage); } })
            : h('span', { class: 'muted small', text: 'Etapa actual: ' + C.label('STAGES', p.stage) }),
          next ? UI.button({ label: 'Avanzar a ' + next.label, icon: 'chevronRight', variant: viewStage === p.stage ? 'primary' : undefined, fk: 'stage-next', onClick: () => { flushNotes(); moveStage(p, next.id); } }) : h('span')),
        h('div', { class: 'field' },
          h('p', { class: 'field-label', text: 'Notas de la etapa «' + C.label('STAGES', viewStage) + '»' + (viewStage === p.stage ? ' (actual)' : '') }),
          notesArea, notesStatus)),
      h('div', { class: 'tool-grid' },
        UI.panel({ title: 'Objetivo', icon: 'target', className: 'panel-sm', body: UI.textBlock(p.objective, 'Sin objetivo definido.') }),
        UI.panel({
          title: 'Estado y próximo paso', icon: 'flag', className: 'panel-sm',
          body: h('div', {},
            h('div', { class: 'field-inline' },
              h('label', { class: 'field-inline-label', for: statusId, text: 'Estado del proyecto' }),
              h('select', {
                id: statusId, class: 'input', value: p.status, 'data-fk': 'project-status-select',
                onChange: (e) => { S.update('projects', p.id, { status: e.target.value }); UI.toast('Estado del proyecto: ' + C.label('PROJECT_STATUS', e.target.value) + '.'); }
              }, C.PROJECT_STATUS.map((s) => h('option', { value: s.id, text: s.label })))),
            h('p', { class: 'field-label', text: 'Próximo paso' }),
            UI.textBlock(p.nextStep, 'Sin definir. Edita el proyecto para añadirlo.'))
        }),
        UI.panel({ title: 'Descripción', icon: 'note', className: 'panel-wide', body: UI.textBlock(p.description, 'Sin descripción.') }),
        UI.panel({
          title: 'Herramientas necesarias', icon: 'tools', className: 'panel-sm',
          body: h('div', {},
            tools.length ? h('div', { class: 'meta-row' }, tools.map((t) => h('a', { class: 'chip chip-link', href: '#/herramientas/' + t.id }, U.icon('tools'), t.name))) : null,
            p.otherTools ? h('p', { class: 'pre-wrap', text: 'Otras: ' + p.otherTools }) : null,
            !tools.length && !p.otherTools && UI.textBlock('', 'Sin herramientas indicadas.'))
        }),
        UI.panel({ title: 'Enlaces al código o repositorio', icon: 'repo', className: 'panel-sm', body: UI.linkList(p.links, 'Sin enlaces. Edita el proyecto para añadir el repositorio.') }),
        tasksPanel(p),
        issuesPanel(p),
        UI.panel({
          title: 'Historial de etapas', icon: 'history', className: 'panel-wide',
          body: h('ol', { class: 'history-list' }, p.stageHistory.slice().reverse().map((e) => h('li', {},
            h('span', { class: 'muted small', text: U.formatDateTime(e.at) }),
            h('span', { text: e.from ? C.label('STAGES', e.from) + ' → ' + C.label('STAGES', e.to) : 'Creado en la etapa «' + C.label('STAGES', e.to) + '»' }))))
        })),
      h('div', { class: 'danger-row' },
        h('span', { class: 'muted small', text: 'Creado el ' + U.formatDate(p.createdAt) + ' · última modificación: ' + U.formatDateTime(p.updatedAt) }),
        UI.button({ label: 'Eliminar proyecto', icon: 'trash', variant: 'danger-ghost', fk: 'project-delete', onClick: () => deleteProject(p) })));
  }

  App.views.proyectos = {
    title: (params) => {
      const p = params && params[0] ? S.get('projects', params[0]) : null;
      return p ? p.name + ' · Proyectos' : 'Proyectos';
    },
    newItem: () => openProjectForm(),
    flush: flushNotes,
    render(root, params) {
      flushStageNotes = null;
      if (params && params[0]) renderDetail(root, params[0]);
      else renderList(root);
    }
  };

  App.projects = { openProjectForm };
})(window.App = window.App || {});
