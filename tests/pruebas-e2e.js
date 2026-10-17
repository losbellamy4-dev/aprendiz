/*
 * Pruebas automáticas de extremo a extremo (opcional, para desarrollo).
 * No hacen falta para usar la aplicación.
 *
 * Requisitos: Node.js 18+ y Playwright con Chromium.
 * Ejecución:  NODE_PATH="$(npm root -g)" node tests/pruebas-e2e.js
 *   Variables opcionales: CHROMIUM_PATH (ruta del navegador), CAPTURAS (carpeta para capturas).
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const PORT = 4173 + Math.floor(Math.random() * 500);
const BASE = 'http://127.0.0.1:' + PORT + '/index.html';
const SHOTS = process.env.CAPTURAS || '';
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'mi-centro-'));

const results = [];
const errors = [];

function check(name, condition, detail) {
  results.push({ name, ok: Boolean(condition), detail: condition ? '' : (detail || '') });
  console.log((condition ? '  ✔ ' : '  ✘ ') + name + (condition || !detail ? '' : ' → ' + detail));
}

async function step(name, fn) {
  console.log('\n▶ ' + name);
  try {
    await fn();
  } catch (err) {
    check(name + ' (sin excepciones)', false, err && err.message ? err.message.split('\n')[0] : String(err));
  }
}

// ---------------------------------------------------------------- Servidor
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  const file = path.join(ROOT, urlPath === '/' ? 'index.html' : urlPath);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('404'); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

// ---------------------------------------------------------------- Ayudas
function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
const dlg = (page) => page.locator('dialog[open]').last();
const panelByTitle = (page, title) => page.locator('.panel').filter({ has: page.locator('.panel-title', { hasText: title }) });
// Campo de la ventana abierta según el texto de su etiqueta (admite el « *» de los obligatorios).
const fieldIn = (page, label) => dlg(page).locator('.field')
  .filter({ has: page.locator('.field-label', { hasText: new RegExp('^' + esc(label) + '( \\*)?( \\(obligatorio\\))?$') }) })
  .locator('input:not([type="hidden"]):not([type="checkbox"]), textarea, select').first();
const toolbarField = (page, label) => page.locator('main .toolbar').getByLabel(label, { exact: true });
async function go(page, route) {
  await page.evaluate((r) => { location.hash = '#/' + r; }, route);
  await page.waitForTimeout(120);
}
async function submit(page) {
  await dlg(page).locator('.modal-footer .btn-primary').click();
  await page.waitForTimeout(120);
}
async function confirmYes(page) { await dlg(page).locator('.modal-footer .btn-danger, .modal-footer .btn-primary').click(); await page.waitForTimeout(120); }
async function stat(page, label) { return (await page.locator('.stat', { hasText: label }).locator('.stat-value').innerText()).trim(); }
const taskCard = (page, title) => page.locator('.task-card').filter({ has: page.getByRole('button', { name: title, exact: true }) });
async function dialogsOpen(page) { return page.locator('dialog[open]').count(); }
async function noHorizontalScroll(page) {
  return page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
}
async function shot(page, name) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, name + '.png'), fullPage: true });
}

/** Comprueba con el protocolo de Chrome que cada botón visible tiene un manejador real. */
async function deadButtons(page) {
  const client = await page.context().newCDPSession(page);
  const { result } = await client.send('Runtime.evaluate', {
    expression: 'Array.from(document.querySelectorAll("button")).filter(b => b.offsetParent !== null || b.closest("dialog[open]"))'
  });
  const props = await client.send('Runtime.getProperties', { objectId: result.objectId, ownProperties: true });
  const dead = [];
  for (const p of props.result) {
    if (!/^\d+$/.test(p.name) || !p.value || !p.value.objectId) continue;
    const { listeners } = await client.send('DOMDebugger.getEventListeners', { objectId: p.value.objectId, depth: 0 });
    const info = await client.send('Runtime.callFunctionOn', {
      objectId: p.value.objectId, returnByValue: true,
      functionDeclaration: 'function(){ return { tag: this.tagName, type: this.type, text: (this.getAttribute("aria-label") || this.textContent || "").trim().slice(0,60), inForm: !!this.form, disabled: this.disabled }; }'
    });
    const v = info.result.value;
    const needed = v.tag === 'SELECT' ? 'change' : 'click';
    const hasHandler = listeners.some((l) => l.type === needed);
    const ok = hasHandler || (v.tag === 'BUTTON' && v.type === 'submit' && v.inForm) || v.disabled;
    if (!ok) dead.push(v.tag + ' «' + v.text + '»');
  }
  await client.detach();
  return dead;
}

// ---------------------------------------------------------------- Pruebas
async function run() {
  await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, acceptDownloads: true });
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'http://127.0.0.1:' + PORT });
  // Sin acceso a Internet en las pruebas: las pestañas externas reciben una página falsa.
  await context.route(/^https:\/\/(developer\.mozilla\.org|www\.google\.com)\//, (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<p>ok</p>' }));
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  const clip = () => page.evaluate(() => navigator.clipboard.readText());

  await page.goto(BASE);
  await page.waitForSelector('.view');

  await step('1. Todas las secciones se abren desde el menú', async () => {
    const expected = ['Mi Centro de Programación e IA', 'Mis tareas', 'Herramientas', 'Mi aprendizaje', 'Biblioteca de prompts', 'Proyectos', 'Recursos', 'Configuración'];
    const links = page.locator('#nav a');
    check('El menú tiene 8 secciones', (await links.count()) === 8);
    for (let i = 0; i < expected.length; i++) {
      await links.nth(i).click();
      await page.waitForTimeout(100);
      const h1 = (await page.locator('main h1').first().innerText()).trim();
      check('Abre «' + expected[i] + '»', h1 === expected[i], 'título: ' + h1);
      check('Enlace activo marcado con aria-current', (await links.nth(i).getAttribute('aria-current')) === 'page');
    }
    for (const sub of ['aprendizaje/notas', 'aprendizaje/fragmentos', 'prompts/plantilla', 'herramientas/tool-base44', 'proyectos/demo-project-web']) {
      await go(page, sub);
      check('Abre la subsección #/' + sub, (await page.locator('main h1').count()) === 1 && !(await page.locator('main', { hasText: 'Se ha producido un error' }).count()));
    }
  });

  await step('2. Datos iniciales: mis 9 notas, todas pendientes', async () => {
    await go(page, 'inicio');
    await shot(page, 'escritorio-inicio');
    check('Tareas totales = 9', (await stat(page, 'Tareas totales')) === '9');
    check('Pendientes = 9', (await stat(page, 'Pendientes')) === '9');
    check('En progreso = 0', (await stat(page, 'En progreso')) === '0');
    check('Completadas = 0', (await stat(page, 'Completadas')) === '0');
    check('Progreso general = 0 %', (await stat(page, 'Progreso general')) === '0 %');
    await go(page, 'tareas');
    const titles = await page.locator('.task-card .task-title').allInnerTexts();
    const original = ['Empezar', 'Base44', 'Pysint', 'ChatGPT', 'App', 'Prompt: contexto', 'Crear tu app (buscar en Google)', 'Bitbloq', 'Busca en ChatGPT'];
    check('Nombres y orden originales', JSON.stringify(titles.map((t) => t.trim())) === JSON.stringify(original), titles.join(' | '));
    const statuses = await page.locator('.task-card select.status-select').evaluateAll((els) => els.map((e) => e.value));
    check('Ninguna completada por defecto', statuses.every((s) => s === 'pendiente'), statuses.join(','));
  });

  await step('3. Crear, editar y eliminar tareas; contadores', async () => {
    await go(page, 'tareas');
    await page.getByRole('button', { name: 'Nueva tarea' }).first().click();
    check('Se abre el formulario', (await dialogsOpen(page)) === 1);
    await submit(page);
    check('Valida el nombre obligatorio', (await dlg(page).locator('.field-error:not([hidden])').count()) >= 1);
    await fieldIn(page, 'Nombre').fill('Aprender HTML básico');
    await fieldIn(page, 'Descripción').fill('Estructura de una página web');
    await fieldIn(page, 'Prioridad').selectOption('alta');
    await fieldIn(page, 'Categoría').selectOption('cat-web');
    await fieldIn(page, 'Enlace a un recurso').fill('javascript:alert(1)');
    await submit(page);
    check('Rechaza enlaces no seguros (javascript:)', (await dialogsOpen(page)) === 1 && (await dlg(page).locator('.field-error:not([hidden])').count()) >= 1);
    await fieldIn(page, 'Enlace a un recurso').fill('developer.mozilla.org/es/docs/Web/HTML');
    await submit(page);
    check('Formulario cerrado tras guardar', (await dialogsOpen(page)) === 0);
    check('Aparece la tarea nueva', (await taskCard(page, 'Aprender HTML básico').count()) === 1);
    check('Enlace completado con https://', (await taskCard(page, 'Aprender HTML básico').locator('a[target="_blank"]').getAttribute('href')) === 'https://developer.mozilla.org/es/docs/Web/HTML');
    check('Mensaje de confirmación', (await page.locator('.toast', { hasText: 'creada' }).count()) >= 1);

    await taskCard(page, 'Aprender HTML básico').getByRole('button', { name: /^Editar/ }).click();
    await fieldIn(page, 'Nombre').fill('Aprender HTML');
    await fieldIn(page, 'Estado').selectOption('en-progreso');
    await fieldIn(page, 'Próximo paso').fill('Crear index.html');
    await submit(page);
    check('Tarea editada', (await taskCard(page, 'Aprender HTML').count()) === 1);
    check('Estado editado', (await taskCard(page, 'Aprender HTML').locator('select.status-select').inputValue()) === 'en-progreso');

    await taskCard(page, 'Base44').locator('select.status-select').selectOption('completada');
    await page.waitForTimeout(150);
    await go(page, 'inicio');
    check('Total = 10', (await stat(page, 'Tareas totales')) === '10');
    check('Pendientes = 8', (await stat(page, 'Pendientes')) === '8');
    check('En progreso = 1', (await stat(page, 'En progreso')) === '1');
    check('Completadas = 1', (await stat(page, 'Completadas')) === '1');
    check('Progreso = 10 %', (await stat(page, 'Progreso general')) === '10 %');
    check('Barra de progreso al 10 %', (await page.locator('.progress-card .progress').getAttribute('aria-valuenow')) === '10');
    check('Próximo paso visible en el inicio', (await page.locator('.panel', { hasText: 'Próximos pasos' }).getByText('Crear index.html').count()) >= 1);

    await go(page, 'tareas');
    await taskCard(page, 'Aprender HTML').getByRole('button', { name: /^Eliminar/ }).click();
    check('Pide confirmación antes de eliminar', (await dlg(page).locator('.modal-title').innerText()) === 'Eliminar tarea');
    await dlg(page).getByRole('button', { name: 'Cancelar' }).click();
    await page.waitForTimeout(100);
    check('Cancelar no elimina', (await taskCard(page, 'Aprender HTML').count()) === 1);
    await taskCard(page, 'Aprender HTML').getByRole('button', { name: /^Eliminar/ }).click();
    await confirmYes(page);
    check('Confirmar elimina', (await taskCard(page, 'Aprender HTML').count()) === 0);
    await go(page, 'inicio');
    check('Contador vuelve a 9', (await stat(page, 'Tareas totales')) === '9');
    check('Progreso recalculado (1/9 = 11 %)', (await stat(page, 'Progreso general')) === '11 %');
  });

  await step('4. Favoritas, detalles y vista de tablero', async () => {
    await go(page, 'tareas');
    await taskCard(page, 'ChatGPT').locator('.fav-btn').click();
    await page.waitForTimeout(100);
    check('Marcada como favorita', (await taskCard(page, 'ChatGPT').locator('.fav-btn').getAttribute('aria-pressed')) === 'true');
    await taskCard(page, 'Pysint').getByRole('button', { name: 'Detalles' }).click();
    const detailText = await dlg(page).innerText();
    check('Detalles muestran la nota original', detailText.includes('«Pysint»'));
    check('Detalles muestran la fecha de creación', detailText.includes('Creada'));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);
    check('Esc cierra la ventana', (await dialogsOpen(page)) === 0);
    await page.getByRole('button', { name: 'Tablero' }).click();
    await page.waitForTimeout(100);
    check('Tablero con 3 columnas', (await page.locator('.board-col').count()) === 3);
    await page.getByRole('button', { name: 'Mover «Empezar» a En progreso' }).click();
    await page.waitForTimeout(100);
    check('Mover con flechas cambia el estado', (await page.locator('.board-col.status-en-progreso').getByRole('button', { name: 'Empezar', exact: true }).count()) === 1);
    await page.getByRole('button', { name: 'Lista' }).click();
    await go(page, 'inicio');
    check('Favorita visible en el inicio', (await panelByTitle(page, 'Favoritas').getByRole('button', { name: 'ChatGPT', exact: true }).count()) === 1);
  });

  await step('5. Buscador, filtros y orden', async () => {
    await go(page, 'tareas');
    const search = page.locator('main input[type="search"]');
    const visibleTitles = async () => (await page.locator('.task-card .task-title').allInnerTexts()).map((t) => t.trim());
    await search.fill('pysint');
    await page.waitForTimeout(80);
    check('Busca por nombre (sin distinguir mayúsculas)', JSON.stringify(await visibleTitles()) === '["Pysint"]');
    await search.fill('buscar en google');
    await page.waitForTimeout(80);
    check('Busca por varias palabras', JSON.stringify(await visibleTitles()) === '["Crear tu app (buscar en Google)"]');
    await search.fill('');
    await toolbarField(page, 'Estado').selectOption('completada');
    await page.waitForTimeout(80);
    check('Filtro por estado', JSON.stringify(await visibleTitles()) === '["Base44"]');
    await toolbarField(page, 'Estado').selectOption('');
    await toolbarField(page, 'Categoría').selectOption('cat-robotica');
    await page.waitForTimeout(80);
    check('Filtro por categoría', JSON.stringify(await visibleTitles()) === '["Bitbloq"]');
    await toolbarField(page, 'Categoría').selectOption('');
    await toolbarField(page, 'Prioridad').selectOption('alta');
    await page.waitForTimeout(80);
    check('Filtro por prioridad (sin resultados → estado vacío)', (await page.locator('.empty', { hasText: 'Ninguna tarea coincide' }).count()) === 1);
    await page.getByRole('button', { name: 'Limpiar filtros' }).first().click();
    await page.waitForTimeout(80);
    check('Limpiar filtros muestra todo', (await visibleTitles()).length === 9);
    await toolbarField(page, 'Ordenar').selectOption('name');
    await page.waitForTimeout(80);
    check('Orden alfabético', (await visibleTitles())[0] === 'App', (await visibleTitles())[0]);
    await toolbarField(page, 'Ordenar').selectOption('order');
    await page.getByRole('button', { name: 'Solo favoritas' }).click();
    await page.waitForTimeout(80);
    check('Solo favoritas', JSON.stringify(await visibleTitles()) === '["ChatGPT"]');
    await page.getByRole('button', { name: 'Solo favoritas' }).click();
    await go(page, 'inicio');
    const dashSearch = page.locator('main input[type="search"]');
    await dashSearch.fill('bitbloq');
    await page.waitForTimeout(80);
    check('Buscador del panel principal', (await page.locator('.panel-tasks .task-card').count()) === 1);
    await dashSearch.fill('');
    await page.waitForTimeout(80);
  });

  await step('6. Los datos permanecen al recargar', async () => {
    await page.reload();
    await page.waitForSelector('.view');
    check('Completadas sigue en 1', (await stat(page, 'Completadas')) === '1');
    check('En progreso sigue en 1', (await stat(page, 'En progreso')) === '1');
    await go(page, 'tareas');
    check('Favorita conservada', (await taskCard(page, 'ChatGPT').locator('.fav-btn').getAttribute('aria-pressed')) === 'true');
    check('Estado conservado', (await taskCard(page, 'Base44').locator('select.status-select').inputValue()) === 'completada');
  });

  await step('7. Fichas de herramientas', async () => {
    await go(page, 'herramientas');
    const names = (await page.locator('.tool-card .card-title').allInnerTexts()).map((t) => t.trim());
    for (const n of ['Base44', 'Pysint', 'ChatGPT', 'Claude Code', 'Bitbloq', 'Crear una app mediante Google']) check('Ficha «' + n + '»', names.includes(n));
    check('Pysint con aviso «Nombre pendiente de verificar»', (await page.locator('.tool-card', { hasText: 'Pysint' }).getByText('Nombre pendiente de verificar').count()) === 1);
    check('Crear app con Google como investigación pendiente', (await page.locator('.tool-card', { hasText: 'Crear una app mediante Google' }).locator('.badge', { hasText: 'Investigación pendiente' }).count()) === 1);
    await page.getByRole('link', { name: 'Pysint', exact: true }).click();
    await page.waitForTimeout(100);
    check('Detalle de Pysint sin datos inventados', (await page.locator('.panel', { hasText: 'Plan gratuito y precios' }).getByText('Pendiente de comprobar.').count()) === 1);
    check('Aviso destacado en Pysint', (await page.locator('.notice-warning', { hasText: 'Nombre pendiente de verificar' }).count()) === 1);
    const notes = page.locator('textarea[aria-label^="Notas personales"]');
    await notes.fill('Preguntar dónde vi este nombre.');
    await page.waitForTimeout(900);
    await page.reload();
    await page.waitForSelector('.view');
    check('Notas de la ficha se guardan solas', (await page.locator('textarea[aria-label^="Notas personales"]').inputValue()) === 'Preguntar dónde vi este nombre.');
    await page.getByRole('button', { name: 'Editar ficha' }).click();
    check('El formulario recuerda el nombre original', (await dlg(page).innerText()).includes('«Pysint»'));
    await fieldIn(page, 'Enlace de la herramienta encontrada').fill('https://example.org/herramienta');
    await fieldIn(page, 'Conclusiones de mi investigación').fill('Conclusión de prueba.');
    await submit(page);
    check('Enlace y conclusiones guardados', (await page.locator('.panel', { hasText: 'Resultado de mi investigación' }).innerText()).includes('Conclusión de prueba.'));
    await go(page, 'herramientas/tool-base44');
    await page.getByRole('button', { name: 'Añadir a mis tareas' }).first().click();
    check('Formulario rellenado desde la ficha', (await fieldIn(page, 'Nombre').inputValue()) === 'Investigar Base44');
    await submit(page);
    check('La tarea aparece vinculada en la ficha', (await page.locator('.panel', { hasText: 'Tareas vinculadas' }).getByRole('button', { name: 'Investigar Base44' }).count()) === 1);
    const officialLinks = await page.locator('.panel', { hasText: 'Recursos oficiales' }).locator('a[target="_blank"]').evaluateAll((as) => as.map((a) => a.href + '|' + a.rel));
    check('Recursos oficiales con enlaces seguros', officialLinks.length === 3 && officialLinks.every((l) => l.startsWith('https://') && l.includes('noopener')), officialLinks.join(' '));
  });

  await step('8. Mi aprendizaje: conceptos, notas y fragmentos', async () => {
    await go(page, 'aprendizaje/conceptos');
    await page.getByRole('button', { name: 'Nuevo concepto' }).first().click();
    await fieldIn(page, 'Nombre del concepto').fill('Variables');
    await fieldIn(page, 'Nivel de dominio').selectOption('aprendiendo');
    await fieldIn(page, 'Explicación sencilla').fill('Cajas con nombre que guardan datos.');
    await fieldIn(page, 'Código relacionado').fill('let edad = 12;');
    await fieldIn(page, 'Dudas que todavía tengo').fill('¿Diferencia entre let y const?');
    await submit(page);
    check('Concepto creado', (await page.getByRole('button', { name: 'Variables', exact: true }).count()) === 1);
    await page.getByRole('button', { name: 'Variables', exact: true }).click();
    check('Detalle con código', (await dlg(page).locator('pre code').innerText()) === 'let edad = 12;');
    await page.keyboard.press('Escape');

    await go(page, 'aprendizaje/notas');
    await page.getByRole('button', { name: 'Nueva nota' }).first().click();
    await page.waitForTimeout(150);
    const title = page.locator('input[aria-label="Título de la nota"]');
    check('La nota nueva recibe el foco', await title.evaluate((el) => el === document.activeElement));
    await title.fill('Mi primera nota');
    await page.locator('textarea[aria-label="Contenido de la nota"]').fill('## Apuntes\n**importante** y `codigo`\n<img src=x onerror="window.__xss=1">\n[enlace](javascript:alert(1))');
    await page.waitForTimeout(700);
    await page.getByRole('button', { name: 'Vista previa' }).click();
    const preview = page.locator('.note-preview');
    check('Vista previa con formato', (await preview.locator('h4').innerText()) === 'Apuntes' && (await preview.locator('strong').innerText()) === 'importante');
    check('Vista previa segura (sin HTML inyectado)', (await preview.locator('img').count()) === 0 && (await preview.locator('a[href^="javascript"]').count()) === 0 && !(await page.evaluate(() => window.__xss)));
    await page.reload();
    await page.waitForSelector('.view');
    check('Nota guardada tras recargar', (await page.locator('input[aria-label="Título de la nota"]').inputValue()) === 'Mi primera nota');

    await go(page, 'aprendizaje/fragmentos');
    await page.getByRole('button', { name: 'Nuevo fragmento' }).first().click();
    await fieldIn(page, 'Título').fill('Estructura HTML');
    await fieldIn(page, 'Lenguaje').fill('HTML');
    await fieldIn(page, 'Código').fill('<!doctype html>\n<html lang="es"></html>');
    await submit(page);
    check('Fragmento creado', (await page.locator('.snippet-card', { hasText: 'Estructura HTML' }).count()) === 1);
    await page.locator('.snippet-card', { hasText: 'Estructura HTML' }).getByRole('button', { name: 'Copiar código' }).click();
    await page.waitForTimeout(150);
    check('Copiar código al portapapeles', (await clip()) === '<!doctype html>\n<html lang="es"></html>');
  });

  await step('9. Biblioteca de prompts, versiones y plantilla', async () => {
    await go(page, 'prompts');
    check('Ejemplos identificados como «Ejemplo»', (await page.locator('.prompt-card.is-demo .badge-demo').count()) === 3);
    await page.getByRole('button', { name: 'Nuevo prompt' }).first().click();
    await fieldIn(page, 'Título').fill('Revisar mi código');
    await fieldIn(page, 'Herramienta para la que está pensado').fill('Claude Code');
    await fieldIn(page, 'Etiquetas').fill('revisión, código');
    await fieldIn(page, 'Texto completo del prompt').fill('Versión 1 del prompt.');
    await submit(page);
    const card = page.locator('.prompt-card', { hasText: 'Revisar mi código' });
    check('Prompt guardado con fecha y etiquetas', (await card.count()) === 1 && (await card.innerText()).includes('#revisión'));
    await card.getByRole('button', { name: /^Copiar el prompt/ }).click();
    await page.waitForTimeout(150);
    check('Botón copiar', (await clip()) === 'Versión 1 del prompt.');
    await card.getByRole('button', { name: /^Editar/ }).click();
    await fieldIn(page, 'Texto completo del prompt').fill('Versión 2 del prompt.');
    await submit(page);
    check('Edición crea una versión anterior', (await card.innerText()).includes('1 versión anterior'));
    await card.getByRole('button', { name: /^Historial/ }).click();
    check('El historial muestra la versión 1', (await dlg(page).innerText()).includes('Versión 1 del prompt.'));
    await dlg(page).getByRole('button', { name: 'Restaurar' }).click();
    await confirmYes(page);
    check('Restaurar recupera la versión 1', (await card.locator('.prompt-preview').innerText()).trim() === 'Versión 1 del prompt.');
    await card.getByRole('button', { name: /^Duplicar/ }).click();
    check('Duplicar abre la copia para editarla', (await fieldIn(page, 'Título').inputValue()) === 'Copia de Revisar mi código');
    await dlg(page).getByRole('button', { name: 'Cancelar' }).click();
    check('Copia creada en la biblioteca', (await page.locator('.prompt-card', { hasText: 'Copia de Revisar mi código' }).count()) === 1);

    await go(page, 'prompts/plantilla');
    await page.getByLabel('Título (para guardarlo)').fill('Prompt desde plantilla');
    await page.getByLabel('1. Rol que debe asumir la IA').fill('Actúa como profesor.');
    await page.getByLabel('2. Objetivo').fill('Aprender CSS.');
    const previewText = await page.locator('.template-preview').innerText();
    check('La plantilla tiene los 8 apartados', (await page.locator('.template-form textarea').count()) === 8);
    check('Vista previa del prompt', previewText.includes('1. Rol que debe asumir la IA\nActúa como profesor.') && previewText.includes('2. Objetivo\nAprender CSS.'));
    await page.getByRole('button', { name: 'Guardar en mi biblioteca' }).click();
    await go(page, 'prompts');
    check('Guardado en la biblioteca', (await page.locator('.prompt-card', { hasText: 'Prompt desde plantilla' }).count()) === 1);
  });

  await step('10. Proyectos: etapas y relación con tareas', async () => {
    await go(page, 'proyectos');
    check('Vista de 6 etapas', (await page.locator('.pipeline-col').count()) === 6);
    await page.getByRole('button', { name: 'Nuevo proyecto' }).first().click();
    await fieldIn(page, 'Nombre del proyecto').fill('Proyecto de prueba');
    await fieldIn(page, 'Objetivo').fill('Comprobar el planificador.');
    await dlg(page).getByLabel('Claude Code').check();
    await submit(page);
    await page.waitForTimeout(150);
    check('Abre la ficha del proyecto', (await page.locator('main h1').innerText()).trim() === 'Proyecto de prueba');
    await page.getByRole('button', { name: 'Nueva tarea en este proyecto' }).click();
    await fieldIn(page, 'Nombre').fill('Tarea del proyecto');
    await submit(page);
    check('La tarea aparece en la ficha', (await page.locator('.panel', { hasText: 'Tareas del proyecto' }).getByRole('button', { name: 'Tarea del proyecto', exact: true }).count()) === 1);
    await page.getByLabel('Vincular una tarea existente').selectOption({ label: 'Bitbloq' });
    await page.getByRole('button', { name: 'Vincular', exact: true }).click();
    await page.waitForTimeout(100);
    check('Vincular tarea existente', (await page.locator('.panel', { hasText: 'Tareas del proyecto' }).getByRole('button', { name: 'Bitbloq', exact: true }).count()) === 1);
    await page.getByRole('button', { name: 'Avanzar a Investigación' }).click();
    await page.waitForTimeout(100);
    check('Avanza a Investigación', (await page.locator('.step.is-current').innerText()).includes('Investigación'));
    await page.locator('textarea[data-fk="stage-notes-investigacion"]').fill('Notas de investigación.');
    await page.waitForTimeout(800);
    await page.getByRole('button', { name: 'Retroceder a Idea' }).click();
    await page.waitForTimeout(100);
    check('Retrocede a Idea', (await page.locator('.step.is-current').innerText()).includes('Idea'));
    await page.locator('.step-btn', { hasText: 'Investigación' }).click();
    await page.waitForTimeout(100);
    check('No se pierden las notas al retroceder', (await page.locator('textarea[data-fk="stage-notes-investigacion"]').inputValue()) === 'Notas de investigación.');
    check('Historial de etapas', (await page.locator('.history-list li').count()) === 3);
    await go(page, 'inicio');
    check('Tareas del proyecto en el panel general (9 + 1 + 1 = 11)', (await stat(page, 'Tareas totales')) === '11');
    check('Proyecto en el panel del inicio', (await page.locator('.panel', { hasText: 'Proyectos en marcha' }).innerText()).includes('Proyecto de prueba'));
    await go(page, 'tareas');
    await toolbarField(page, 'Proyecto').selectOption({ label: 'Proyecto de prueba' });
    await page.waitForTimeout(80);
    check('Filtro de tareas por proyecto', (await page.locator('.task-card').count()) === 2);
    await page.getByRole('button', { name: 'Limpiar filtros' }).first().click();
  });

  await step('11. Recursos y enlaces', async () => {
    await go(page, 'recursos');
    await page.getByRole('button', { name: 'Nuevo recurso' }).first().click();
    await fieldIn(page, 'Título').fill('Guía de CSS');
    await fieldIn(page, 'Enlace (URL)').fill('developer.mozilla.org/es/docs/Web/CSS');
    await fieldIn(page, 'Tipo de recurso').selectOption('tutorial');
    await submit(page);
    const card = page.locator('.resource-card', { hasText: 'Guía de CSS' });
    const open = card.getByRole('link', { name: /^Abrir/ });
    check('Enlace con https://', (await open.getAttribute('href')) === 'https://developer.mozilla.org/es/docs/Web/CSS');
    check('Se abre en pestaña nueva de forma segura', (await open.getAttribute('target')) === '_blank' && (await open.getAttribute('rel')) === 'noopener noreferrer');
    const [popup] = await Promise.all([context.waitForEvent('page'), open.click()]);
    check('Abrir crea una pestaña nueva con la URL', popup.url().startsWith('https://developer.mozilla.org/es/docs/Web/CSS'), popup.url());
    await popup.close();
    await card.getByRole('button', { name: /^Copiar el enlace/ }).click();
    await page.waitForTimeout(150);
    check('Copiar enlace', (await clip()) === 'https://developer.mozilla.org/es/docs/Web/CSS');
    await page.getByRole('button', { name: 'Nuevo recurso' }).first().click();
    await fieldIn(page, 'Título').fill('Duplicado');
    await fieldIn(page, 'Enlace (URL)').fill('https://developer.mozilla.org/es/docs/Web/CSS');
    await submit(page);
    check('Avisa de enlaces repetidos', (await dlg(page).locator('.form-error:not([hidden])').innerText()).includes('Ya tienes guardado'));
    await dlg(page).getByRole('button', { name: 'Cancelar' }).click();
    if (await dialogsOpen(page)) await confirmYes(page);
    check('Cancelar con cambios pide confirmación y cierra', (await dialogsOpen(page)) === 0);
    await page.getByLabel('Qué quieres buscar en Google').fill('tutorial html');
    const [google] = await Promise.all([context.waitForEvent('page'), page.getByRole('button', { name: /^Buscar en Google/ }).click()]);
    check('«Buscar en Google» abre la búsqueda en otra pestaña', google.url().includes('google.com/search?q=tutorial%20html'), google.url());
    await google.close();
  });

  let exportedPath = '';
  await step('12. Exportar e importar JSON', async () => {
    await go(page, 'configuracion');
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exportar datos (JSON)' }).click()]);
    exportedPath = path.join(TMP, download.suggestedFilename());
    await download.saveAs(exportedPath);
    const json = JSON.parse(fs.readFileSync(exportedPath, 'utf8'));
    check('Nombre de archivo con fecha', /^mi-centro-ia-\d{4}-\d{2}-\d{2}\.json$/.test(download.suggestedFilename()));
    const taskCount = await page.evaluate(() => App.store.all('tasks').length);
    check('Archivo exportado válido y completo', json.schema === 'mi-centro-programacion-ia' && json.version === 1 && json.data.tasks.length === taskCount && json.data.tools.length === 6, json.data.tasks.length + ' / ' + taskCount);

    const badJson = path.join(TMP, 'malo.json');
    fs.writeFileSync(badJson, '{ esto no es json');
    await page.locator('input[type="file"]').setInputFiles(badJson);
    await page.waitForTimeout(200);
    check('Rechaza JSON no válido', (await dlg(page).locator('.modal-title').innerText()) === 'No se puede importar el archivo');
    await dlg(page).getByRole('button', { name: 'Entendido' }).click();
    const otherSchema = path.join(TMP, 'otro.json');
    fs.writeFileSync(otherSchema, JSON.stringify({ schema: 'otra-app', version: 1, data: {} }));
    await page.locator('input[type="file"]').setInputFiles(otherSchema);
    await page.waitForTimeout(200);
    check('Rechaza archivos de otra aplicación', (await dlg(page).innerText()).includes('no es una exportación'));
    await dlg(page).getByRole('button', { name: 'Entendido' }).click();

    // Modificar datos y restaurarlos con la importación.
    await go(page, 'tareas');
    await taskCard(page, 'Empezar').getByRole('button', { name: /^Eliminar/ }).click();
    await confirmYes(page);
    check('Tarea borrada antes de importar', (await taskCard(page, 'Empezar').count()) === 0);
    await go(page, 'configuracion');
    await page.locator('input[type="file"]').setInputFiles(exportedPath);
    await page.waitForTimeout(200);
    check('Muestra un resumen antes de importar', (await dlg(page).locator('.modal-title').innerText()) === 'Revisar la importación' && (await dlg(page).locator('table').innerText()).includes('Tareas'));
    await dlg(page).getByRole('button', { name: 'Cancelar' }).click();
    await page.waitForTimeout(100);
    await go(page, 'tareas');
    check('Cancelar la importación no cambia nada', (await taskCard(page, 'Empezar').count()) === 0);
    await go(page, 'configuracion');
    await page.locator('input[type="file"]').setInputFiles(exportedPath);
    await page.waitForTimeout(200);
    await dlg(page).getByText('Reemplazar todos mis datos').click();
    await dlg(page).getByRole('button', { name: 'Importar' }).click();
    check('Reemplazar pide confirmación', (await dlg(page).locator('.modal-title').innerText()) === 'Reemplazar todos los datos');
    await confirmYes(page);
    await go(page, 'tareas');
    check('La importación restaura los datos', (await taskCard(page, 'Empezar').count()) === 1);
    await go(page, 'configuracion');
    check('Se ha creado la copia automática', (await page.locator('.panel').filter({ has: page.locator('.panel-title', { hasText: 'Copia automática' }) }).innerText()).includes('antes de importar'));
    await page.locator('input[type="file"]').setInputFiles(exportedPath);
    await page.waitForTimeout(200);
    await dlg(page).getByRole('button', { name: 'Importar' }).click();
    await page.waitForTimeout(150);
    check('Combinar no duplica elementos', (await page.locator('.toast', { hasText: 'Importación combinada: 0 elementos añadidos' }).count()) >= 1);
  });

  await step('13. Datos de ejemplo separados de los reales', async () => {
    await go(page, 'configuracion');
    const before = await page.evaluate(() => App.store.countDemo());
    check('Hay 6 ejemplos (3 prompts, 1 concepto, 1 proyecto, 1 recurso)', before === 6, String(before));
    check('Ninguna tarea es de ejemplo', await page.evaluate(() => App.store.all('tasks').every((t) => !t.demo)));
    await go(page, 'inicio');
    const totalBefore = await stat(page, 'Tareas totales');
    await go(page, 'configuracion');
    await page.getByLabel('Mostrar los datos de ejemplo').uncheck();
    await go(page, 'prompts');
    check('Ocultar ejemplos', (await page.locator('.prompt-card.is-demo').count()) === 0);
    await go(page, 'inicio');
    check('Los contadores no cambian al ocultar ejemplos', (await stat(page, 'Tareas totales')) === totalBefore);
    await go(page, 'configuracion');
    await page.getByLabel('Mostrar los datos de ejemplo').check();
    await page.getByRole('button', { name: 'Eliminar todos los ejemplos' }).click();
    await confirmYes(page);
    check('Eliminar ejemplos', (await page.evaluate(() => App.store.countDemo())) === 0);
    await page.getByRole('button', { name: 'Restaurar los ejemplos' }).click();
    check('Restaurar ejemplos', (await page.evaluate(() => App.store.countDemo())) === 6);
  });

  await step('14. Categorías', async () => {
    await go(page, 'configuracion');
    await page.getByRole('button', { name: 'Nueva categoría' }).click();
    await fieldIn(page, 'Nombre').fill('Python');
    await submit(page);
    check('Categoría creada', (await page.locator('.category-row', { hasText: 'Python' }).count()) === 1);
    await go(page, 'tareas');
    await taskCard(page, 'App').getByRole('button', { name: /^Editar/ }).click();
    const options = await fieldIn(page, 'Categoría').locator('option').allInnerTexts();
    check('Disponible al editar una tarea', options.includes('Python'));
    await dlg(page).getByRole('button', { name: 'Crear una categoría nueva' }).click();
    await dlg(page).getByLabel('Nombre de la nueva categoría').fill('Bases de datos');
    await dlg(page).getByRole('button', { name: 'Crear', exact: true }).click();
    check('Crear categoría desde el formulario', (await fieldIn(page, 'Categoría').locator('option:checked').innerText()) === 'Bases de datos');
    await submit(page);
    check('Cambiar la categoría de un elemento', (await taskCard(page, 'App').innerText()).includes('Bases de datos'));
    await go(page, 'configuracion');
    await page.locator('.category-row', { hasText: 'Bases de datos' }).getByRole('button', { name: /^Eliminar/ }).click();
    check('Avisa de los elementos que la usan', (await dlg(page).innerText()).includes('1 elemento usa'));
    await confirmYes(page);
    await go(page, 'tareas');
    check('El elemento queda «Sin categoría»', (await taskCard(page, 'App').innerText()).includes('Sin categoría'));
  });

  await step('15. Teclado y accesibilidad básica', async () => {
    await go(page, 'tareas');
    await page.locator('body').click({ position: { x: 5, y: 700 } });
    await page.keyboard.press('/');
    check('«/» enfoca el buscador', await page.evaluate(() => document.activeElement && document.activeElement.type === 'search'));
    await page.keyboard.press('Escape');
    await page.locator('main h1').focus();
    await page.keyboard.press('n');
    check('«N» abre el formulario de nueva tarea', (await dlg(page).locator('.modal-title').innerText()) === 'Nueva tarea');
    await page.keyboard.type('Algo');
    await page.keyboard.press('Escape');
    check('Esc con cambios pide confirmación', (await dlg(page).locator('.modal-title').innerText()) === '¿Descartar los cambios?');
    await confirmYes(page);
    check('Ventanas cerradas', (await dialogsOpen(page)) === 0);
    await page.goto(BASE + '#/inicio');
    await page.reload();
    await page.waitForSelector('.view');
    await page.keyboard.press('Tab');
    check('Primer Tab: enlace «Saltar al contenido»', (await page.evaluate(() => document.activeElement.className)) === 'skip-link');
    const unnamed = await page.evaluate(() => Array.from(document.querySelectorAll('button, a[href], input, select, textarea')).filter((el) => {
      if (el.type === 'hidden' || el.closest('[hidden]')) return false;
      const label = el.getAttribute('aria-label') || el.textContent.trim() || el.title || (el.labels && el.labels.length) || el.getAttribute('placeholder');
      return !label;
    }).length);
    check('Todos los controles tienen nombre accesible', unnamed === 0, unnamed + ' sin nombre');
  });

  await step('16. Sin botones decorativos', async () => {
    for (const route of ['inicio', 'tareas', 'herramientas', 'herramientas/tool-pysint', 'aprendizaje/conceptos', 'aprendizaje/notas', 'aprendizaje/fragmentos', 'prompts', 'prompts/plantilla', 'proyectos', 'proyectos/demo-project-web', 'recursos', 'configuracion']) {
      await go(page, route);
      const dead = await deadButtons(page);
      check('Todos los botones de #/' + route + ' hacen algo', dead.length === 0, dead.join(', '));
    }
    await go(page, 'tareas');
    await page.getByRole('button', { name: 'Nueva tarea' }).first().click();
    const deadModal = await deadButtons(page);
    check('Botones del formulario de tarea', deadModal.length === 0, deadModal.join(', '));
    await dlg(page).getByRole('button', { name: 'Cancelar' }).click();
  });

  await step('17. Seguridad del contenido', async () => {
    await go(page, 'tareas');
    await page.getByRole('button', { name: 'Nueva tarea' }).first().click();
    await fieldIn(page, 'Nombre').fill('<img src=x onerror="window.__xss2=1">');
    await submit(page);
    check('El HTML de los datos se muestra como texto', (await page.locator('main img').count()) === 0 && !(await page.evaluate(() => window.__xss2)));
    await taskCard(page, '<img src=x onerror="window.__xss2=1">').getByRole('button', { name: /^Eliminar/ }).click();
    await confirmYes(page);
  });

  await step('18. Diseño adaptable', async () => {
    const routes = ['inicio', 'tareas', 'herramientas', 'herramientas/tool-base44', 'aprendizaje/conceptos', 'aprendizaje/notas', 'prompts', 'prompts/plantilla', 'proyectos', 'proyectos/demo-project-web', 'recursos', 'configuracion'];
    for (const vp of [{ w: 1366, h: 768, n: 'chromebook' }, { w: 820, h: 1180, n: 'tablet' }, { w: 375, h: 812, n: 'movil' }]) {
      await page.setViewportSize({ width: vp.w, height: vp.h });
      for (const r of routes) {
        await go(page, r);
        check(vp.n + ' ' + vp.w + 'px: sin desplazamiento horizontal en #/' + r, await noHorizontalScroll(page));
        if (vp.n === 'chromebook') {
          const stray = await page.evaluate(() => (document.querySelector('main').innerText.match(/\b(false|null|undefined|NaN|\[object Object\])\b/) || [])[0]);
          check('Sin textos técnicos sueltos («false», «null»…) en #/' + r, !stray, stray);
        }
        if (['inicio', 'tareas', 'proyectos/demo-project-web', 'herramientas/tool-base44', 'prompts/plantilla'].includes(r)) await shot(page, vp.n + '-' + r.replace(/\//g, '_'));
      }
    }
    await page.setViewportSize({ width: 375, height: 812 });
    await go(page, 'inicio');
    check('En móvil el menú lateral está oculto', !(await page.locator('#sidebar').isVisible()) || (await page.locator('#sidebar').evaluate((el) => el.getBoundingClientRect().right <= 0)));
    await page.getByRole('button', { name: 'Abrir menú' }).click();
    await page.waitForTimeout(300);
    check('El botón de menú lo abre', await page.locator('#sidebar').evaluate((el) => el.classList.contains('open') && el.getBoundingClientRect().left >= 0));
    await shot(page, 'movil-menu');
    await page.locator('#nav a', { hasText: 'Recursos' }).click();
    await page.waitForTimeout(300);
    check('Navega y cierra el menú', (await page.locator('main h1').innerText()).trim() === 'Recursos' && !(await page.locator('#sidebar').evaluate((el) => el.classList.contains('open'))));
    await page.getByRole('button', { name: 'Nuevo recurso' }).first().click();
    check('Formulario usable en móvil', await dlg(page).evaluate((el) => el.getBoundingClientRect().width <= window.innerWidth));
    await shot(page, 'movil-formulario');
    await dlg(page).getByRole('button', { name: 'Cancelar' }).click();
    await page.setViewportSize({ width: 1366, height: 768 });
  });

  await step('19. Sin errores de JavaScript (servidor local)', async () => {
    check('Consola y página sin errores', errors.length === 0, errors.slice(0, 5).join(' | '));
  });

  // -------------------------------------------- Abriendo el archivo directamente
  await step('20. Funciona abriendo index.html directamente (file://)', async () => {
    const fileErrors = [];
    const ctx = await browser.newContext({ acceptDownloads: true });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => fileErrors.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error') fileErrors.push(m.text()); });
    await p.goto('file://' + path.join(ROOT, 'index.html'));
    await p.waitForSelector('.view');
    check('Carga con file:// y muestra 9 tareas', (await stat(p, 'Tareas totales')) === '9');
    await p.getByRole('button', { name: 'Nueva tarea' }).first().click();
    await fieldIn(p, 'Nombre').fill('Tarea en file://');
    await submit(p);
    await p.reload();
    await p.waitForSelector('.view');
    check('Guarda datos con file://', (await stat(p, 'Tareas totales')) === '10');
    await go(p, 'configuracion');
    const [dl] = await Promise.all([p.waitForEvent('download'), p.getByRole('button', { name: 'Exportar datos (JSON)' }).click()]);
    check('Exporta con file://', /\.json$/.test(dl.suggestedFilename()));
    check('Sin errores con file://', fileErrors.length === 0, fileErrors.join(' | '));
    await ctx.close();
  });

  await browser.close();
  server.close();

  const failed = results.filter((r) => !r.ok);
  console.log('\n' + '='.repeat(60));
  console.log('Comprobaciones: ' + results.length + ' · correctas: ' + (results.length - failed.length) + ' · fallidas: ' + failed.length);
  failed.forEach((f) => console.log('  ✘ ' + f.name + (f.detail ? ' → ' + f.detail : '')));
  process.exitCode = failed.length ? 1 : 0;
}

run().catch((err) => {
  console.error(err);
  server.close();
  process.exitCode = 1;
});
