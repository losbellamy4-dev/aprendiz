# Mi Centro de Programación e IA

Centro de control personal para organizar mis primeros pasos en programación,
inteligencia artificial y creación de aplicaciones: tareas, fichas de
herramientas, conceptos aprendidos, notas, fragmentos de código, prompts,
proyectos y recursos, todo en un único lugar.

Funciona directamente en el navegador, **sin instalar nada, sin cuenta y sin
claves API**. Los datos se guardan automáticamente en el propio navegador.

---

## Cómo abrirla

### En el Chromebook (o cualquier ordenador)

1. Descarga la carpeta del proyecto (en GitHub: botón **Code → Download ZIP**) y descomprímela.
2. Abre la carpeta en la aplicación **Archivos**.
3. Haz doble clic en **`index.html`** (o clic derecho → *Abrir con* → *Chrome*).

No hace falta conexión a Internet para usarla. Solo la necesitarás para abrir
los enlaces externos.

> Abre siempre la aplicación desde el **mismo sitio** y con el **mismo navegador**.
> Antes de mover la carpeta, cambiar de navegador o de equipo, exporta tus datos
> (Configuración → Exportar) para poder importarlos después.

### Opcional: con un servidor local

Si prefieres abrirla con una dirección `http://`, desde la carpeta del proyecto:

```bash
python3 -m http.server 8000
```

y abre `http://localhost:8000` en el navegador. Ten en cuenta que los datos
guardados con `http://localhost` y con el archivo abierto directamente son
independientes.

---

## Qué incluye

| Sección | Para qué sirve |
| --- | --- |
| **Inicio** | Contadores (totales, pendientes, en progreso, completadas), porcentaje y barra de progreso, buscador y filtros de tareas, favoritas, próximos pasos, progreso por categoría y resumen general. |
| **Mis tareas** | Crear, editar, eliminar (con confirmación), cambiar estado, marcar favoritas, ver detalles, buscar, filtrar (estado, categoría, prioridad, proyecto, favoritas) y ordenar. Vista de lista o de tablero (arrastrar o usar las flechas). |
| **Herramientas** | Fichas de Base44, Pysint, ChatGPT, Claude Code, Bitbloq y «Crear una app mediante Google», con descripción, utilidad, dificultad, requisitos, plan gratuito, ventajas, limitaciones, estado de investigación, recursos oficiales y notas. Botón para añadirlas a mis tareas. |
| **Aprendizaje** | Fichas de conceptos (explicación, ejemplo, código, dudas, ejercicio y nivel de dominio), un editor de notas con formato sencillo y vista previa, y una colección de fragmentos de código. |
| **Biblioteca de prompts** | Guardar, copiar, editar (con historial de versiones y restauración) y duplicar prompts. Plantilla de prompt técnico con 8 apartados y vista previa. |
| **Proyectos** | Vista por etapas (Idea → Investigación → Planificación → Desarrollo → Pruebas → Finalizado), ficha con tareas vinculadas, notas por etapa, problemas y soluciones, enlaces e historial. |
| **Recursos** | Páginas, documentación, tutoriales, vídeos, repositorios, herramientas y artículos con botones *Abrir* (pestaña nueva) y *Copiar*. |
| **Configuración** | Exportar e importar (JSON, con validación y opción de cancelar), copia automática, categorías, datos de ejemplo, almacenamiento, atajos de teclado y limitaciones. |

### Mis datos iniciales

- Las **9 notas** de mi lista de WhatsApp están en *Mis tareas* con su nombre
  original y **todas pendientes**. Se puede corregir cualquier nombre: la nota
  original se conserva.
- **Pysint** aparece tal cual, con el aviso «Nombre pendiente de verificar».
- **Crear tu app (buscar en Google)** es una investigación pendiente: no se ha
  supuesto ningún producto.
- Las fichas de herramientas se documentaron el **17/10/2026** con fuentes
  oficiales. Lo que no se pudo verificar aparece como **«Pendiente de comprobar»**.

### Datos de ejemplo

Hay **6 elementos de ejemplo** (3 prompts, 1 concepto, 1 proyecto y 1 recurso)
marcados con la etiqueta **«Ejemplo»** y un borde discontinuo. No hay tareas de
ejemplo, así que no alteran los contadores. Se pueden ocultar, eliminar o
restaurar en *Configuración → Datos de ejemplo*.

### Atajos de teclado

| Tecla | Acción |
| --- | --- |
| `/` | Ir al buscador de la sección |
| `N` | Crear un elemento nuevo en la sección |
| `Esc` | Cerrar la ventana o el menú |
| `Ctrl + Intro` | Guardar el formulario abierto |

---

## Copias de seguridad (importante)

Los datos se guardan en el `localStorage` del navegador: **solo existen en ese
navegador y en ese equipo**. Si borras los datos de navegación, se pierden.

- **Exportar**: *Configuración → Exportar datos (JSON)* descarga un archivo
  `mi-centro-ia-AAAA-MM-DD.json`. Guárdalo en Google Drive o en un USB.
- **Importar**: *Configuración → Importar datos…*. El archivo se valida y se
  muestra un resumen antes de aplicar nada; puedes **combinar** (solo añade lo
  nuevo) o **reemplazar** (pide confirmación), o cancelar.
- **Copia automática**: antes de importar, restaurar o borrar todo se guarda
  una copia de los datos actuales que puedes restaurar o descargar.

---

## Limitaciones

- No busca ni navega por Internet automáticamente. El botón «Buscar en Google»
  solo abre la búsqueda en una pestaña nueva; los enlaces útiles se guardan a mano.
- No sincroniza entre dispositivos (usa Exportar/Importar).
- Las fichas de herramientas reflejan la información disponible el 17/10/2026;
  precios y funciones pueden cambiar.
- Si el navegador bloquea el almacenamiento (por ejemplo, en modo incógnito),
  la aplicación lo avisa: se puede usar, pero hay que exportar antes de cerrar.

---

## Estructura del código

```
index.html            Estructura de la página y orden de carga de los scripts
css/styles.css        Estilos (tema oscuro, diseño adaptable, animaciones)
js/icons.js           Iconos SVG
js/util.js            Utilidades: creación segura de elementos, fechas, URLs, Markdown…
js/constants.js       Estados, prioridades, etapas, tipos de recurso…
js/seed.js            Datos iniciales (mis notas, categorías, fichas y ejemplos)
js/store.js           Datos: guardado, validación, importación/exportación y copias
js/ui.js              Componentes: botones, ventanas, avisos, formularios
js/views/*.js         Una sección por archivo (tareas, inicio, herramientas…)
js/app.js             Arranque, navegación y atajos de teclado
tests/pruebas-e2e.js  Pruebas automáticas (opcional, para desarrollo)
```

Se usan **scripts clásicos** (no módulos) para que la aplicación funcione al
abrir `index.html` directamente. El orden de carga está en `index.html`.

### Cómo añadir cosas

- **Una sección nueva**: crea `js/views/mi-seccion.js` registrando
  `App.views['mi-seccion'] = { title, render(root, params) }`, añádelo en
  `index.html` antes de `js/app.js` y añade la entrada al menú (`NAV` en `js/app.js`).
- **Un tipo de dato nuevo**: añade la colección en `js/constants.js`
  (`COLLECTIONS`, `COLLECTION_LABELS`, `ID_PREFIX`) y su normalizador en
  `js/store.js`. La validación, la exportación y la importación lo incluirán.
- **Un estado o etapa nuevos**: edita la lista correspondiente en `js/constants.js`.

Todo el texto introducido se muestra como texto (nunca como HTML) y solo se
aceptan enlaces `http://` y `https://`.

### Pruebas automáticas (opcional)

Requieren Node.js y Playwright con Chromium (no son necesarias para usar la app):

```bash
NODE_PATH="$(npm root -g)" node tests/pruebas-e2e.js
```

Recorren todas las secciones en un navegador real: crear, editar y eliminar,
contadores, filtros, persistencia tras recargar, exportar/importar, enlaces,
diseño en móvil, tablet y Chromebook, botones sin función, seguridad del
contenido y apertura directa con `file://`.
