/*
 * Almacén de datos: estado, guardado en localStorage, validación,
 * importación/exportación, copia automática y relaciones entre elementos.
 *
 * Todas las secciones leen y modifican los datos a través de App.store.
 * Cada cambio se guarda al momento y avisa a la interfaz para que se actualice.
 */
(function (App) {
  'use strict';

  const U = App.util;
  const C = App.C;

  const STORAGE_KEY = 'miCentroIA.datos';
  const BACKUP_KEY = 'miCentroIA.copiaAutomatica';
  const SCHEMA = 'mi-centro-programacion-ia';
  const VERSION = 1;
  const MAX_VERSIONS = 50;

  // ------------------------------------------------------------ Normalización
  // Convierte cualquier valor recibido (guardado o importado) en datos con el
  // formato esperado. Lo que no es válido se corrige o se descarta.
  const N = {
    obj: (v) => v !== null && typeof v === 'object' && !Array.isArray(v),
    str: (v) => (typeof v === 'string' ? v : (typeof v === 'number' && isFinite(v) ? String(v) : '')),
    text: (v) => N.str(v).trim(),
    bool: (v) => v === true,
    num: (v, d) => (typeof v === 'number' && isFinite(v) ? v : d),
    oneOf: (v, list, d) => (list.some((o) => o.id === v) ? v : d),
    date: (v, d) => {
      if (typeof v === 'string' || typeof v === 'number') {
        const t = new Date(v);
        if (!isNaN(t.getTime())) return t.toISOString();
      }
      return d;
    },
    ref: (v) => (typeof v === 'string' && v.trim() ? v : null),
    id: (v, prefix) => (typeof v === 'string' && /^[\w.:-]{1,100}$/.test(v) ? v : U.uid(prefix)),
    url: (v) => {
      const s = N.text(v);
      return U.isSafeUrl(s) ? s : '';
    },
    tags: (v) => (Array.isArray(v) ? U.parseTags(v.map(N.str).join(',')) : []),
    links: (v) => (Array.isArray(v)
      ? v.filter(N.obj).map((l) => ({ label: N.text(l.label), url: N.url(l.url) })).filter((l) => l.url)
      : []),
    idList: (v) => (Array.isArray(v) ? Array.from(new Set(v.filter((x) => typeof x === 'string' && x))) : [])
  };

  function base(r, coll, now) {
    const createdAt = N.date(r.createdAt, now);
    return {
      id: N.id(r.id, C.ID_PREFIX[coll]),
      createdAt,
      updatedAt: N.date(r.updatedAt, createdAt),
      demo: N.bool(r.demo)
    };
  }

  const normalizers = {
    categories(r, now) {
      const name = N.text(r.name);
      if (!name) return null;
      return { id: N.id(r.id, 'cat'), name, color: N.oneOf(r.color, C.CATEGORY_COLORS, 'slate'), createdAt: N.date(r.createdAt, now) };
    },
    tasks(r, now) {
      const title = N.text(r.title);
      if (!title) return null;
      const status = N.oneOf(r.status, C.TASK_STATUS, 'pendiente');
      return Object.assign(base(r, 'tasks', now), {
        title,
        description: N.str(r.description),
        categoryId: N.ref(r.categoryId),
        status,
        priority: N.oneOf(r.priority, C.PRIORITY, 'media'),
        completedAt: status === 'completada' ? N.date(r.completedAt, null) : null,
        link: N.url(r.link),
        notes: N.str(r.notes),
        nextStep: N.str(r.nextStep),
        favorite: N.bool(r.favorite),
        projectId: N.ref(r.projectId),
        toolId: N.ref(r.toolId),
        originalNote: N.str(r.originalNote),
        origin: r.origin === 'nota-inicial' ? 'nota-inicial' : 'usuario',
        order: N.num(r.order, 0)
      });
    },
    tools(r, now) {
      const name = N.text(r.name);
      if (!name) return null;
      return Object.assign(base(r, 'tools', now), {
        name,
        originalName: N.str(r.originalName),
        nameUnverified: N.bool(r.nameUnverified),
        kind: N.oneOf(r.kind, C.TOOL_KIND, 'herramienta'),
        categoryId: N.ref(r.categoryId),
        description: N.str(r.description),
        utility: N.str(r.utility),
        capabilities: N.str(r.capabilities),
        difficulty: N.oneOf(r.difficulty, C.DIFFICULTY, 'pendiente'),
        requirements: N.str(r.requirements),
        pricing: N.str(r.pricing),
        pros: N.str(r.pros),
        cons: N.str(r.cons),
        researchStatus: N.oneOf(r.researchStatus, C.RESEARCH_STATUS, 'sin-empezar'),
        resources: N.links(r.resources),
        foundLink: N.url(r.foundLink),
        conclusions: N.str(r.conclusions),
        notes: N.str(r.notes),
        sourceNote: N.str(r.sourceNote)
      });
    },
    concepts(r, now) {
      const name = N.text(r.name);
      if (!name) return null;
      return Object.assign(base(r, 'concepts', now), {
        name,
        categoryId: N.ref(r.categoryId),
        explanation: N.str(r.explanation),
        example: N.str(r.example),
        code: N.str(r.code),
        codeLanguage: N.text(r.codeLanguage),
        doubts: N.str(r.doubts),
        exercise: N.str(r.exercise),
        mastery: N.oneOf(r.mastery, C.MASTERY, 'sin-empezar')
      });
    },
    notes(r, now) {
      if (!N.obj(r)) return null;
      return Object.assign(base(r, 'notes', now), {
        title: N.text(r.title) || 'Nota sin título',
        body: N.str(r.body)
      });
    },
    snippets(r, now) {
      const title = N.text(r.title);
      if (!title) return null;
      return Object.assign(base(r, 'snippets', now), {
        title,
        language: N.text(r.language),
        description: N.str(r.description),
        code: N.str(r.code),
        tags: N.tags(r.tags)
      });
    },
    prompts(r, now) {
      const title = N.text(r.title);
      if (!title) return null;
      const versions = Array.isArray(r.versions) ? r.versions.filter(N.obj).map((v) => ({
        title: N.text(v.title) || title,
        objective: N.str(v.objective),
        tool: N.text(v.tool),
        text: N.str(v.text),
        tags: N.tags(v.tags),
        savedAt: N.date(v.savedAt, now)
      })).slice(0, MAX_VERSIONS) : [];
      return Object.assign(base(r, 'prompts', now), {
        title,
        objective: N.str(r.objective),
        tool: N.text(r.tool),
        text: N.str(r.text),
        tags: N.tags(r.tags),
        versions
      });
    },
    projects(r, now) {
      const name = N.text(r.name);
      if (!name) return null;
      const notesIn = N.obj(r.stageNotes) ? r.stageNotes : {};
      const stageNotes = {};
      C.STAGES.forEach((s) => { stageNotes[s.id] = N.str(notesIn[s.id]); });
      const stageHistory = Array.isArray(r.stageHistory) ? r.stageHistory.filter(N.obj).map((h) => ({
        from: N.oneOf(h.from, C.STAGES, null),
        to: N.oneOf(h.to, C.STAGES, 'idea'),
        at: N.date(h.at, now)
      })) : [];
      const issues = Array.isArray(r.issues) ? r.issues.filter(N.obj).map((i) => ({
        id: N.id(i.id, 'issue'),
        problem: N.str(i.problem),
        solution: N.str(i.solution),
        solved: N.bool(i.solved),
        createdAt: N.date(i.createdAt, now)
      })).filter((i) => i.problem.trim() || i.solution.trim()) : [];
      const meta = base(r, 'projects', now);
      const stage = N.oneOf(r.stage, C.STAGES, 'idea');
      if (!stageHistory.length) stageHistory.push({ from: null, to: stage, at: meta.createdAt });
      return Object.assign(meta, {
        name,
        objective: N.str(r.objective),
        description: N.str(r.description),
        toolIds: N.idList(r.toolIds),
        otherTools: N.str(r.otherTools),
        stage,
        status: N.oneOf(r.status, C.PROJECT_STATUS, 'activo'),
        nextStep: N.str(r.nextStep),
        links: N.links(r.links),
        stageNotes,
        stageHistory,
        issues
      });
    },
    resources(r, now) {
      const title = N.text(r.title);
      const url = N.url(r.url);
      if (!title || !url) return null;
      return Object.assign(base(r, 'resources', now), {
        title,
        url,
        type: N.oneOf(r.type, C.RESOURCE_TYPES, 'web'),
        categoryId: N.ref(r.categoryId),
        toolId: N.ref(r.toolId),
        reviewStatus: N.oneOf(r.reviewStatus, C.REVIEW_STATUS, 'pendiente'),
        description: N.str(r.description)
      });
    }
  };

  function normalizeSettings(r) {
    const s = N.obj(r) ? r : {};
    return { showDemo: s.showDemo !== false, welcomeDismissed: N.bool(s.welcomeDismissed) };
  }

  /** Elimina referencias a elementos que ya no existen (categorías, proyectos, herramientas). */
  function fixReferences(d) {
    const cats = new Set(d.categories.map((c) => c.id));
    const projects = new Set(d.projects.map((p) => p.id));
    const tools = new Set(d.tools.map((t) => t.id));
    const fixCat = (item) => { if (item.categoryId && !cats.has(item.categoryId)) item.categoryId = null; };
    d.tasks.forEach((t) => {
      fixCat(t);
      if (t.projectId && !projects.has(t.projectId)) t.projectId = null;
      if (t.toolId && !tools.has(t.toolId)) t.toolId = null;
    });
    d.tools.forEach(fixCat);
    d.concepts.forEach(fixCat);
    d.resources.forEach((r) => { fixCat(r); if (r.toolId && !tools.has(r.toolId)) r.toolId = null; });
    d.projects.forEach((p) => { p.toolIds = p.toolIds.filter((id) => tools.has(id)); });
  }

  function emptyData() {
    const d = { settings: normalizeSettings({}) };
    C.COLLECTIONS.forEach((coll) => { d[coll] = []; });
    return d;
  }

  /** Normaliza un objeto de datos completo y devuelve los avisos encontrados. */
  function normalizeData(raw) {
    const warnings = [];
    const now = U.nowISO();
    const d = emptyData();
    const src = N.obj(raw) ? raw : {};
    C.COLLECTIONS.forEach((coll) => {
      const list = src[coll];
      if (list === undefined) return;
      const label = C.COLLECTION_LABELS[coll];
      if (!Array.isArray(list)) {
        warnings.push('«' + label + '» no es una lista y se ha ignorado.');
        return;
      }
      const seen = new Set();
      list.forEach((item, i) => {
        const norm = N.obj(item) ? normalizers[coll](item, now) : null;
        if (!norm) {
          warnings.push(label + ': el elemento n.º ' + (i + 1) + ' no tiene los datos obligatorios y se omitirá.');
          return;
        }
        if (seen.has(norm.id)) {
          warnings.push(label + ': el identificador «' + norm.id + '» está repetido; se ha asignado uno nuevo.');
          norm.id = U.uid(C.ID_PREFIX[coll]);
        }
        seen.add(norm.id);
        d[coll].push(norm);
      });
    });
    d.settings = normalizeSettings(src.settings);
    fixReferences(d);
    return { data: d, warnings };
  }

  /** Punto preparado para futuras versiones del formato de datos. */
  function migrate(envelope) {
    // Versión 1: formato actual, no requiere cambios.
    return envelope;
  }

  function fail(error) { return { ok: false, error }; }

  /** Valida un archivo completo (exportado o guardado) sin modificar los datos actuales. */
  function parseEnvelope(raw) {
    if (!N.obj(raw)) return fail('El archivo no tiene el formato esperado.');
    if (raw.schema !== SCHEMA) return fail('Este archivo no es una exportación de «' + C.APP_NAME + '».');
    if (typeof raw.version !== 'number' || raw.version < 1) return fail('El archivo no indica una versión de datos válida.');
    if (raw.version > VERSION) return fail('El archivo procede de una versión más reciente de la aplicación (versión ' + raw.version + ') y no se puede importar con seguridad.');
    if (!N.obj(raw.data)) return fail('El archivo no contiene la sección de datos.');
    const result = normalizeData(migrate(raw).data);
    const summary = C.COLLECTIONS.map((coll) => ({ coll, label: C.COLLECTION_LABELS[coll], count: result.data[coll].length }));
    const total = summary.reduce((sum, s) => sum + s.count, 0);
    if (!total) result.warnings.push('El archivo no contiene ningún elemento.');
    return {
      ok: true,
      data: result.data,
      warnings: result.warnings,
      summary,
      total,
      exportedAt: N.date(raw.exportedAt, N.date(raw.savedAt, null))
    };
  }

  // ------------------------------------------------------------------ Estado
  let data = emptyData();
  const listeners = [];
  const statusListeners = [];
  const status = {
    storageAvailable: true,
    lastSaved: null,
    error: '',
    loadWarning: '',
    firstRun: false
  };

  function storageAvailable() {
    try {
      const key = '__miCentroIA_prueba__';
      localStorage.setItem(key, '1');
      localStorage.removeItem(key);
      return true;
    } catch (e) {
      return false;
    }
  }

  function envelope(extra) {
    return Object.assign({ schema: SCHEMA, version: VERSION, app: C.APP_NAME }, extra, { data });
  }

  function emitStatus() {
    statusListeners.forEach((fn) => { try { fn(status); } catch (e) { console.error(e); } });
  }
  function emit(detail) {
    listeners.forEach((fn) => { try { fn(detail || {}); } catch (e) { console.error(e); } });
  }

  function persist() {
    if (!status.storageAvailable) {
      status.error = 'El navegador no permite guardar datos (localStorage no disponible). Los cambios se perderán al cerrar la página: exporta tus datos.';
      emitStatus();
      return false;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope({ savedAt: U.nowISO() })));
      status.lastSaved = new Date();
      status.error = '';
      emitStatus();
      return true;
    } catch (e) {
      const quota = e && (e.name === 'QuotaExceededError' || e.code === 22);
      status.error = quota
        ? 'No queda espacio en el almacenamiento del navegador. Exporta tus datos y elimina elementos que no necesites.'
        : 'No se pudieron guardar los cambios: ' + (e && e.message ? e.message : 'error desconocido') + '.';
      emitStatus();
      return false;
    }
  }

  function commit(detail, opts) {
    const ok = persist();
    if (!(opts && opts.silent)) emit(detail);
    return ok;
  }

  function load() {
    status.storageAvailable = storageAvailable();
    let raw = null;
    if (status.storageAvailable) {
      try { raw = localStorage.getItem(STORAGE_KEY); } catch (e) { raw = null; }
    }
    if (raw) {
      let parsed;
      try { parsed = parseEnvelope(JSON.parse(raw)); } catch (e) { parsed = fail('el contenido no es JSON válido'); }
      if (parsed.ok) {
        data = parsed.data;
        if (parsed.warnings.length) {
          status.loadWarning = 'Se han corregido algunos datos guardados: ' + parsed.warnings.slice(0, 3).join(' ') + (parsed.warnings.length > 3 ? ' (y ' + (parsed.warnings.length - 3) + ' avisos más)' : '');
        }
        return;
      }
      const rescueKey = STORAGE_KEY + '.danado-' + Date.now();
      let rescued = false;
      try { localStorage.setItem(rescueKey, raw); rescued = true; } catch (e) { rescued = false; }
      status.loadWarning = 'Los datos guardados no se pudieron leer (' + parsed.error + '). ' +
        (rescued ? 'Se ha conservado una copia del contenido original con la clave «' + rescueKey + '». ' : '') +
        'Se han cargado los datos iniciales.';
    } else {
      status.firstRun = true;
    }
    data = normalizeData(App.seed.createInitialState()).data;
    persist();
  }

  // Si se modifica el centro en otra pestaña, esta se actualiza.
  window.addEventListener('storage', (e) => {
    if (e.key !== STORAGE_KEY || !e.newValue) return;
    try {
      const parsed = parseEnvelope(JSON.parse(e.newValue));
      if (parsed.ok) {
        data = parsed.data;
        emit({ action: 'external' });
      }
    } catch (err) { /* se ignora un valor ilegible de otra pestaña */ }
  });

  // ------------------------------------------------------------------ Lectura
  function all(coll) { return data[coll]; }
  function visible(coll) {
    const list = data[coll];
    return data.settings.showDemo ? list.slice() : list.filter((item) => !item.demo);
  }
  function get(coll, id) { return data[coll].find((item) => item.id === id) || null; }
  function settings() { return data.settings; }

  function taskStats(list) {
    const tasks = list || visible('tasks');
    const s = { total: tasks.length, pendiente: 0, 'en-progreso': 0, completada: 0 };
    tasks.forEach((t) => { s[t.status] += 1; });
    s.percent = s.total ? Math.round((s.completada / s.total) * 100) : 0;
    return s;
  }

  /** Cuántos elementos hacen referencia a uno dado (para avisar antes de borrar). */
  function usage(coll, id) {
    if (coll === 'categories') {
      return ['tasks', 'tools', 'concepts', 'resources'].reduce((n, c) => n + data[c].filter((i) => i.categoryId === id).length, 0);
    }
    if (coll === 'projects') return data.tasks.filter((t) => t.projectId === id).length;
    if (coll === 'tools') {
      return data.tasks.filter((t) => t.toolId === id).length +
        data.resources.filter((r) => r.toolId === id).length +
        data.projects.filter((p) => p.toolIds.includes(id)).length;
    }
    return 0;
  }

  // --------------------------------------------------------------- Escritura
  function add(coll, values, opts) {
    const now = U.nowISO();
    const input = Object.assign({}, values, { createdAt: now, updatedAt: now });
    if (!values.id || get(coll, values.id)) delete input.id;
    if (coll === 'tasks') {
      if (typeof input.order !== 'number') input.order = data.tasks.reduce((m, t) => Math.max(m, t.order), 0) + 1;
      if (input.status === 'completada') input.completedAt = now;
    }
    const item = normalizers[coll](input, now);
    if (!item) throw new Error('Faltan datos obligatorios.');
    data[coll].push(item);
    commit({ coll, action: 'add', id: item.id }, opts);
    return item;
  }

  function update(coll, id, patch, opts) {
    const index = data[coll].findIndex((item) => item.id === id);
    if (index === -1) return null;
    const prev = data[coll][index];
    const now = U.nowISO();
    const merged = Object.assign({}, prev, patch, { id, createdAt: prev.createdAt, updatedAt: now });
    if (coll === 'tasks' && patch.status && patch.status !== prev.status) {
      merged.completedAt = patch.status === 'completada' ? now : null;
    }
    const item = normalizers[coll](merged, now);
    if (!item) throw new Error('Faltan datos obligatorios.');
    if (coll === 'categories') item.createdAt = prev.createdAt;
    data[coll][index] = item;
    fixReferences(data);
    commit({ coll, action: 'update', id }, opts);
    return item;
  }

  function detach(id, coll) {
    if (coll === 'categories') {
      ['tasks', 'tools', 'concepts', 'resources'].forEach((c) => data[c].forEach((i) => { if (i.categoryId === id) i.categoryId = null; }));
    } else if (coll === 'projects') {
      data.tasks.forEach((t) => { if (t.projectId === id) t.projectId = null; });
    } else if (coll === 'tools') {
      data.tasks.forEach((t) => { if (t.toolId === id) t.toolId = null; });
      data.resources.forEach((r) => { if (r.toolId === id) r.toolId = null; });
      data.projects.forEach((p) => { p.toolIds = p.toolIds.filter((t) => t !== id); });
    }
  }

  function remove(coll, id) {
    const index = data[coll].findIndex((item) => item.id === id);
    if (index === -1) return false;
    data[coll].splice(index, 1);
    detach(id, coll);
    commit({ coll, action: 'remove', id });
    return true;
  }

  function setSetting(key, value) {
    data.settings[key] = value;
    data.settings = normalizeSettings(data.settings);
    commit({ coll: 'settings', action: 'update' });
  }

  // -------------------------------------------------------- Prompts y versiones
  function snapshot(p) {
    return { title: p.title, objective: p.objective, tool: p.tool, text: p.text, tags: p.tags.slice(), savedAt: p.updatedAt };
  }

  /** Guarda la edición de un prompt conservando la versión anterior en el historial. */
  function savePromptEdit(id, values) {
    const prev = get('prompts', id);
    if (!prev) return null;
    const changed = ['title', 'objective', 'tool', 'text'].some((k) => values[k] !== undefined && values[k] !== prev[k]) ||
      (values.tags !== undefined && values.tags.join(',') !== prev.tags.join(','));
    const versions = changed ? [snapshot(prev)].concat(prev.versions).slice(0, MAX_VERSIONS) : prev.versions;
    const item = update('prompts', id, Object.assign({}, values, { versions }));
    return { item, versioned: changed };
  }

  function restorePromptVersion(id, index) {
    const prev = get('prompts', id);
    if (!prev || !prev.versions[index]) return null;
    const v = prev.versions[index];
    return savePromptEdit(id, { title: v.title, objective: v.objective, tool: v.tool, text: v.text, tags: v.tags });
  }

  function duplicatePrompt(id) {
    const p = get('prompts', id);
    if (!p) return null;
    return add('prompts', { title: 'Copia de ' + p.title, objective: p.objective, tool: p.tool, text: p.text, tags: p.tags, versions: [], demo: false });
  }

  // ---------------------------------------------------------------- Proyectos
  function moveProjectStage(id, stage) {
    const p = get('projects', id);
    if (!p || p.stage === stage || !C.ids('STAGES').includes(stage)) return p;
    const history = p.stageHistory.concat([{ from: p.stage, to: stage, at: U.nowISO() }]);
    return update('projects', id, { stage, stageHistory: history });
  }

  // ------------------------------------------------------- Datos de ejemplo
  function countDemo() {
    return C.COLLECTIONS.reduce((n, coll) => n + data[coll].filter((i) => i.demo).length, 0);
  }

  function removeDemo() {
    let removed = 0;
    C.COLLECTIONS.forEach((coll) => {
      const demoIds = data[coll].filter((i) => i.demo).map((i) => i.id);
      demoIds.forEach((id) => detach(id, coll));
      removed += demoIds.length;
      data[coll] = data[coll].filter((i) => !i.demo);
    });
    commit({ action: 'demo-removed' });
    return removed;
  }

  function restoreDemo() {
    const demo = App.seed.demoItems();
    const now = U.nowISO();
    let added = 0;
    Object.keys(demo).forEach((coll) => {
      demo[coll].forEach((raw) => {
        if (get(coll, raw.id)) return;
        const item = normalizers[coll](Object.assign({}, raw, { createdAt: now, updatedAt: now }), now);
        if (item) { data[coll].push(item); added += 1; }
      });
    });
    data.settings.showDemo = true;
    fixReferences(data);
    commit({ action: 'demo-restored' });
    return added;
  }

  // ---------------------------------------------- Exportar, importar, copias
  function exportJSON() {
    return JSON.stringify(envelope({ exportedAt: U.nowISO() }), null, 2);
  }

  function parseImport(text) {
    let raw;
    try {
      raw = JSON.parse(text);
    } catch (e) {
      return fail('El archivo no contiene JSON válido. Comprueba que es una exportación de esta aplicación.');
    }
    return parseEnvelope(raw);
  }

  function makeBackup(reason) {
    if (!status.storageAvailable) return false;
    try {
      localStorage.setItem(BACKUP_KEY, JSON.stringify({ createdAt: U.nowISO(), reason, payload: envelope({ savedAt: U.nowISO() }) }));
      return true;
    } catch (e) {
      return false;
    }
  }

  function readBackup() {
    if (!status.storageAvailable) return null;
    try {
      const raw = JSON.parse(localStorage.getItem(BACKUP_KEY) || 'null');
      if (!N.obj(raw)) return null;
      const parsed = parseEnvelope(raw.payload);
      if (!parsed.ok) return null;
      return { createdAt: raw.createdAt, reason: N.str(raw.reason), parsed };
    } catch (e) {
      return null;
    }
  }

  /** Aplica una importación ya validada. mode: 'replace' | 'merge'. */
  function applyImport(parsed, mode) {
    const backupOk = makeBackup(mode === 'replace' ? 'Antes de importar (reemplazar)' : 'Antes de importar (combinar)');
    const result = { added: 0, skipped: 0, backupOk };
    if (mode === 'replace') {
      data = normalizeData(JSON.parse(JSON.stringify(parsed.data))).data;
      result.added = parsed.total;
    } else {
      C.COLLECTIONS.forEach((coll) => {
        const ids = new Set(data[coll].map((i) => i.id));
        parsed.data[coll].forEach((item) => {
          if (ids.has(item.id)) { result.skipped += 1; return; }
          data[coll].push(JSON.parse(JSON.stringify(item)));
          result.added += 1;
        });
      });
      fixReferences(data);
    }
    commit({ action: 'import' });
    return result;
  }

  function restoreBackup() {
    const backup = readBackup();
    if (!backup) return false;
    makeBackup('Antes de restaurar la copia automática');
    data = backup.parsed.data;
    commit({ action: 'restore' });
    return true;
  }

  function resetAll() {
    const backupOk = makeBackup('Antes de borrar todos los datos');
    data = normalizeData(App.seed.createInitialState()).data;
    commit({ action: 'reset' });
    return backupOk;
  }

  function storageUsage() {
    try {
      const main = (localStorage.getItem(STORAGE_KEY) || '').length;
      const backup = (localStorage.getItem(BACKUP_KEY) || '').length;
      return { main: main * 2, backup: backup * 2 };
    } catch (e) {
      return { main: 0, backup: 0 };
    }
  }

  /*
   * Preferencias de la interfaz (vista elegida, borrador de la plantilla…).
   * Se guardan aparte porque no son datos del usuario y no se exportan.
   */
  const PREFS_KEY = 'miCentroIA.preferencias';
  let prefsCache = null;
  App.prefs = {
    get(key, fallback) {
      if (!prefsCache) {
        try { prefsCache = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') || {}; } catch (e) { prefsCache = {}; }
      }
      return Object.prototype.hasOwnProperty.call(prefsCache, key) ? prefsCache[key] : fallback;
    },
    set(key, value) {
      App.prefs.get(key);
      prefsCache[key] = value;
      try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefsCache)); } catch (e) { /* preferencia no esencial */ }
    }
  };

  App.store = {
    SCHEMA, VERSION, STORAGE_KEY,
    status,
    load,
    subscribe: (fn) => listeners.push(fn),
    onStatus: (fn) => statusListeners.push(fn),
    all, visible, get, settings, taskStats, usage,
    add, update, remove, setSetting,
    savePromptEdit, restorePromptVersion, duplicatePrompt,
    moveProjectStage,
    countDemo, removeDemo, restoreDemo,
    exportJSON, parseImport, applyImport, readBackup, restoreBackup, resetAll, storageUsage
  };
})(window.App = window.App || {});
