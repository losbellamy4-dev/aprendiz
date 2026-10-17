/*
 * Listas de valores (estados, prioridades, etapas…) usadas en toda la aplicación.
 * Cambiar una etiqueta aquí la actualiza en todas las secciones.
 */
(function (App) {
  'use strict';

  const C = {
    APP_NAME: 'Mi Centro de Programación e IA',

    TASK_STATUS: [
      { id: 'pendiente', label: 'Pendiente' },
      { id: 'en-progreso', label: 'En progreso' },
      { id: 'completada', label: 'Completada' }
    ],
    PRIORITY: [
      { id: 'baja', label: 'Baja' },
      { id: 'media', label: 'Media' },
      { id: 'alta', label: 'Alta' }
    ],
    DIFFICULTY: [
      { id: 'pendiente', label: 'Pendiente de valorar' },
      { id: 'principiante', label: 'Principiante' },
      { id: 'intermedio', label: 'Intermedio' },
      { id: 'avanzado', label: 'Avanzado' }
    ],
    RESEARCH_STATUS: [
      { id: 'sin-empezar', label: 'Sin empezar' },
      { id: 'investigando', label: 'Investigando' },
      { id: 'completada', label: 'Investigación completada' }
    ],
    TOOL_KIND: [
      { id: 'herramienta', label: 'Herramienta' },
      { id: 'investigacion', label: 'Investigación pendiente' }
    ],
    MASTERY: [
      { id: 'sin-empezar', label: 'Sin empezar' },
      { id: 'aprendiendo', label: 'Aprendiendo' },
      { id: 'dominado', label: 'Dominado' }
    ],
    STAGES: [
      { id: 'idea', label: 'Idea' },
      { id: 'investigacion', label: 'Investigación' },
      { id: 'planificacion', label: 'Planificación' },
      { id: 'desarrollo', label: 'Desarrollo' },
      { id: 'pruebas', label: 'Pruebas' },
      { id: 'finalizado', label: 'Finalizado' }
    ],
    PROJECT_STATUS: [
      { id: 'activo', label: 'Activo' },
      { id: 'en-pausa', label: 'En pausa' },
      { id: 'terminado', label: 'Terminado' },
      { id: 'archivado', label: 'Archivado' }
    ],
    RESOURCE_TYPES: [
      { id: 'web', label: 'Página web', icon: 'globe' },
      { id: 'documentacion', label: 'Documentación oficial', icon: 'book' },
      { id: 'tutorial', label: 'Tutorial', icon: 'graduation' },
      { id: 'video', label: 'Vídeo', icon: 'video' },
      { id: 'repositorio', label: 'Repositorio de GitHub', icon: 'repo' },
      { id: 'herramienta', label: 'Herramienta online', icon: 'tools' },
      { id: 'articulo', label: 'Artículo', icon: 'article' }
    ],
    REVIEW_STATUS: [
      { id: 'pendiente', label: 'Pendiente de revisar' },
      { id: 'en-revision', label: 'En revisión' },
      { id: 'revisado', label: 'Revisado' }
    ],
    CATEGORY_COLORS: [
      { id: 'cyan', label: 'Cian' },
      { id: 'blue', label: 'Azul' },
      { id: 'violet', label: 'Violeta' },
      { id: 'green', label: 'Verde' },
      { id: 'amber', label: 'Ámbar' },
      { id: 'orange', label: 'Naranja' },
      { id: 'rose', label: 'Rosa' },
      { id: 'slate', label: 'Gris' }
    ],
    // Icono de las categorías iniciales; las nuevas usan «folder».
    CATEGORY_ICONS: {
      'cat-web': 'code',
      'cat-ia': 'cpu',
      'cat-apps': 'app',
      'cat-dev': 'terminal',
      'cat-robotica': 'robot',
      'cat-prompts': 'sparkles',
      'cat-investigacion': 'globe',
      'cat-ideas': 'lightbulb'
    },
    SNIPPET_LANGUAGES: ['HTML', 'CSS', 'JavaScript', 'JSON', 'Python', 'Arduino (C++)', 'Bash', 'Markdown', 'Otro'],

    COLLECTIONS: ['categories', 'tasks', 'tools', 'concepts', 'notes', 'snippets', 'prompts', 'projects', 'resources'],
    COLLECTION_LABELS: {
      categories: 'Categorías',
      tasks: 'Tareas',
      tools: 'Fichas de herramientas',
      concepts: 'Conceptos',
      notes: 'Notas',
      snippets: 'Fragmentos de código',
      prompts: 'Prompts',
      projects: 'Proyectos',
      resources: 'Recursos'
    },
    ID_PREFIX: {
      categories: 'cat', tasks: 'task', tools: 'tool', concepts: 'concept', notes: 'note',
      snippets: 'snippet', prompts: 'prompt', projects: 'project', resources: 'res'
    }
  };

  /** Etiqueta legible de un valor: C.label('TASK_STATUS', 'en-progreso') → «En progreso». */
  C.label = function (listName, id) {
    const item = (C[listName] || []).find((o) => o.id === id);
    return item ? item.label : id;
  };
  C.ids = function (listName) {
    return (C[listName] || []).map((o) => o.id);
  };

  App.C = C;
})(window.App = window.App || {});
