/*
 * Datos iniciales.
 *  - Mis notas de WhatsApp (tareas reales, todas pendientes).
 *  - Categorías de aprendizaje.
 *  - Fichas de herramientas documentadas (con lo no verificado marcado como pendiente).
 *  - Un número limitado de EJEMPLOS (demo: true), separados de los datos reales.
 */
(function (App) {
  'use strict';

  const PENDIENTE = 'Pendiente de comprobar.';

  function categories() {
    return [
      { id: 'cat-web', name: 'Programación web (HTML, CSS y JavaScript)', color: 'cyan' },
      { id: 'cat-ia', name: 'Inteligencia artificial', color: 'violet' },
      { id: 'cat-apps', name: 'Creación de aplicaciones', color: 'blue' },
      { id: 'cat-dev', name: 'Herramientas de desarrollo', color: 'green' },
      { id: 'cat-robotica', name: 'Robótica', color: 'orange' },
      { id: 'cat-prompts', name: 'Diseño de prompts', color: 'rose' },
      { id: 'cat-investigacion', name: 'Investigación tecnológica', color: 'amber' },
      { id: 'cat-ideas', name: 'Ideas futuras', color: 'slate' }
    ];
  }

  /** Mis primeros pasos, con los nombres exactamente como aparecen en la captura. */
  function tasks() {
    const notes = [
      { id: 'task-empezar', title: 'Empezar', categoryId: 'cat-investigacion', toolId: null },
      { id: 'task-base44', title: 'Base44', categoryId: 'cat-apps', toolId: 'tool-base44' },
      {
        id: 'task-pysint', title: 'Pysint', categoryId: 'cat-investigacion', toolId: 'tool-pysint',
        notes: 'Nombre pendiente de verificar: puede estar escrito de forma aproximada. Corrígelo cuando sepas a qué se refiere.'
      },
      { id: 'task-chatgpt', title: 'ChatGPT', categoryId: 'cat-ia', toolId: 'tool-chatgpt' },
      {
        id: 'task-app', title: 'App', categoryId: 'cat-apps', toolId: null,
        notes: 'Término ambiguo: concreta a qué app o idea se refiere esta nota.'
      },
      { id: 'task-prompt-contexto', title: 'Prompt: contexto', categoryId: 'cat-prompts', toolId: null },
      { id: 'task-crear-app-google', title: 'Crear tu app (buscar en Google)', categoryId: 'cat-investigacion', toolId: 'tool-crear-app-google' },
      { id: 'task-bitbloq', title: 'Bitbloq', categoryId: 'cat-robotica', toolId: 'tool-bitbloq' },
      { id: 'task-busca-chatgpt', title: 'Busca en ChatGPT', categoryId: 'cat-ia', toolId: 'tool-chatgpt' }
    ];
    return notes.map((n, i) => ({
      id: n.id,
      title: n.title,
      originalNote: n.title,
      origin: 'nota-inicial',
      description: '',
      categoryId: n.categoryId,
      toolId: n.toolId,
      projectId: null,
      status: 'pendiente',
      priority: 'media',
      favorite: false,
      link: '',
      notes: n.notes || '',
      nextStep: '',
      order: i + 1
    }));
  }

  function tools() {
    return [
      {
        id: 'tool-base44',
        name: 'Base44',
        kind: 'herramienta',
        categoryId: 'cat-apps',
        description: 'Plataforma que genera aplicaciones, sitios web y agentes de IA a partir de una descripción escrita en lenguaje natural, sin programar desde cero. Según su web oficial, incluye el «backend»: base de datos, inicio de sesión de usuarios y alojamiento.',
        utility: 'Convertir una idea en un prototipo o una aplicación web funcional describiéndola en un chat, sin tener que montar por mi cuenta el servidor, la base de datos ni el alojamiento.',
        capabilities: 'Según su documentación oficial: aplicaciones web completas (con base de datos y usuarios), sitios web y agentes de IA.\nQué tipo de aplicaciones concretas me sirve crear: pendiente de comprobar con mis propias pruebas.',
        difficulty: 'principiante',
        requirements: '• Navegador web y una cuenta de Base44.\n• No hace falta saber programar para empezar, pero ayuda saber describir bien lo que quiero (diseño de prompts) y entender qué son una base de datos y los usuarios de una app.\n• Para entender o modificar el código generado necesitaré conocimientos de programación web.',
        pricing: 'Según la página de precios y la documentación oficial (consultadas el 17/10/2026): el plan gratuito incluye 25 créditos de mensaje y 100 créditos de integración al mes, con un máximo de 5 créditos de mensaje al día.\n• Los créditos de mensaje se gastan al crear o editar la app hablando con la IA.\n• Los créditos de integración se gastan cuando la app usa funciones como enviar correos o generar imágenes.\nPendiente de comprobar: precios de los planes de pago (las fuentes no coinciden), número máximo de apps y si el plan gratuito permite exportar el código.',
        pros: '• Backend incluido (base de datos, usuarios y alojamiento), según su web.\n• Permite pasar muy rápido de una idea a un prototipo que funciona.\n• No hay que instalar nada.',
        cons: '• En el plan gratuito los créditos son limitados.\n• La app depende de la plataforma (backend y alojamiento gestionados por Base44).\n• Según su web, la sincronización con GitHub requiere un plan de pago: pendiente de comprobar.\n• Para aprender a programar tendré que revisar y entender el código que genera.',
        researchStatus: 'sin-empezar',
        resources: [
          { label: 'Web oficial', url: 'https://base44.com' },
          { label: 'Planes y precios', url: 'https://base44.com/pricing' },
          { label: 'Documentación', url: 'https://docs.base44.com' }
        ],
        sourceNote: 'Documentado el 17/10/2026 con la web y la documentación oficiales de Base44, consultadas a través de un buscador (la página no pudo abrirse directamente durante el desarrollo). Los planes y los créditos cambian a menudo: compruébalos en la página de precios.'
      },
      {
        id: 'tool-pysint',
        name: 'Pysint',
        originalName: 'Pysint',
        nameUnverified: true,
        kind: 'investigacion',
        categoryId: 'cat-investigacion',
        description: 'Nombre copiado literalmente de mis notas. Todavía no se sabe a qué herramienta corresponde.',
        difficulty: 'pendiente',
        researchStatus: 'sin-empezar',
        resources: [],
        sourceNote: 'No se ha supuesto qué herramienta es. Cuando la identifiques, corrige el nombre, desmarca «Nombre pendiente de verificar» y completa la ficha.'
      },
      {
        id: 'tool-chatgpt',
        name: 'ChatGPT',
        kind: 'herramienta',
        categoryId: 'cat-ia',
        description: 'Asistente conversacional de inteligencia artificial de OpenAI. Responde preguntas, explica conceptos, redacta textos y genera o revisa código a partir de lo que le escribo.',
        utility: 'Cómo usarlo:\n• Aprender programación: pedirle que explique un concepto con palabras sencillas y un ejemplo, y que proponga un ejercicio sin darme la solución hasta que lo intente.\n• Investigar herramientas: preguntar qué es una herramienta, para qué sirve y qué alternativas hay; después contrastarlo en la web oficial, porque puede equivocarse o estar desactualizado.\n• Diseñar aplicaciones: describir la idea y pedir una lista de funciones, pantallas y datos necesarios; usar el resultado en el planificador de proyectos.\n• Depurar errores: pegar el mensaje de error completo y el fragmento de código, y explicar qué esperaba que ocurriera y qué ocurre.\n• Preparar buenos prompts: pedirle que mejore un prompt mío o que me haga preguntas para completar el contexto antes de responder.',
        capabilities: 'Conversación por texto, explicaciones, redacción y generación o revisión de código.\nOtras funciones (archivos, imágenes, voz, análisis de datos) tienen límites distintos según el plan: pendiente de comprobar.',
        difficulty: 'principiante',
        requirements: '• Navegador web o aplicación móvil.\n• Algunas funciones requieren iniciar sesión con una cuenta: pendiente de comprobar cuáles.\n• No hace falta saber programar, pero sí explicar con claridad lo que necesito.',
        pricing: 'Según el centro de ayuda de OpenAI (consultado el 17/10/2026), existe un plan gratuito con chats de texto y límites en la subida de archivos, la creación de imágenes, la voz y el análisis de datos.\nLos modelos disponibles y los límites cambian con frecuencia: pendiente de comprobar en la página de planes.',
        pros: '• Funciona en el navegador, sin instalar nada.\n• Adapta las explicaciones a mi nivel y puedo repreguntar.\n• Útil para revisar código y entender mensajes de error.',
        cons: '• Puede dar respuestas incorrectas con mucha seguridad: hay que verificarlas en fuentes oficiales.\n• Su información puede no estar actualizada.\n• No prueba mi proyecto en mi ordenador: tengo que comprobar yo el código.\n• No debo compartir datos personales ni claves privadas.',
        researchStatus: 'sin-empezar',
        resources: [
          { label: 'ChatGPT', url: 'https://chatgpt.com' },
          { label: 'Planes y precios', url: 'https://chatgpt.com/pricing' },
          { label: 'Centro de ayuda de OpenAI', url: 'https://help.openai.com' }
        ],
        sourceNote: 'Documentado el 17/10/2026 con el centro de ayuda y la página de planes de OpenAI, consultados a través de un buscador. Los modelos y límites cambian a menudo: compruébalos en la web oficial.'
      },
      {
        id: 'tool-claude-code',
        name: 'Claude Code',
        kind: 'herramienta',
        categoryId: 'cat-dev',
        description: 'Herramienta de programación con IA de Anthropic. Según su documentación oficial, lee el código de un proyecto, edita archivos, ejecuta comandos y se integra con herramientas de desarrollo como git. Funciona en la terminal, en editores (VS Code y JetBrains), en una aplicación de escritorio y en el navegador (claude.ai/code).',
        utility: 'Es el entorno con el que desarrollo este centro en HTML. Me ayuda a:\n• Crear: describir una función en lenguaje natural y que escriba el código en los archivos del proyecto.\n• Revisar: pedirle que lea el código y señale errores, partes confusas o problemas de seguridad.\n• Probar: ejecutar comprobaciones y pruebas, y corregir los fallos que aparezcan.\n• Mejorar: reorganizar el código, mejorar el diseño o la accesibilidad y documentar el proyecto.\n• Guardar el historial: preparar commits y ramas con git.',
        capabilities: 'Según la documentación oficial: crear funciones y corregir errores en varios archivos, escribir y ejecutar pruebas, trabajar con git (commits, ramas y solicitudes de cambios) y conectarse con otras herramientas mediante MCP.',
        difficulty: 'intermedio',
        requirements: '• Según la documentación oficial, la mayoría de modalidades requieren una suscripción de Claude o una cuenta de Anthropic Console.\n• La versión web funciona en el navegador sin instalar nada; la de terminal se instala con un comando.\n• Conviene conocer lo básico de archivos, carpetas y git.\nPendiente de comprobar: qué plan necesito y cuál es la mejor forma de usarlo desde mi Chromebook.',
        pricing: 'La documentación indica que la aplicación de escritorio requiere una suscripción de pago. Precios y planes: pendiente de comprobar en la página oficial.',
        pros: '• Trabaja directamente sobre los archivos del proyecto.\n• Puede ejecutar pruebas y comprobar que el código funciona.\n• Se integra con git para guardar el historial de cambios.',
        cons: '• Requiere suscripción o cuenta (plan exacto pendiente de comprobar).\n• Hay que revisar los cambios que hace: no sustituye entender el código.\n• Las instrucciones vagas dan resultados vagos: un prompt con buen contexto marca la diferencia.',
        researchStatus: 'sin-empezar',
        resources: [
          { label: 'Documentación oficial (español)', url: 'https://code.claude.com/docs/es/overview' },
          { label: 'Guía de inicio rápido', url: 'https://code.claude.com/docs/es/quickstart' },
          { label: 'Claude Code en el navegador', url: 'https://claude.ai/code' }
        ],
        sourceNote: 'Documentado el 17/10/2026 con la documentación oficial de Claude Code (code.claude.com/docs).'
      },
      {
        id: 'tool-bitbloq',
        name: 'Bitbloq',
        kind: 'herramienta',
        categoryId: 'cat-robotica',
        description: 'Plataforma educativa de BQ Educación para aprender programación y robótica. Según su web oficial reúne varias herramientas: Bitbloq Robotics Jr, Bitbloq Robotics (programación con bloques o diagramas de flujo, de 9 a 14 años), Bitbloq Robotics Adv (programación con código), Bitbloq 3D (diseño 3D) y Bitbloq Apps (creación de apps).',
        utility: 'En proyectos educativos de robótica sirve para programar una placa controladora y sus componentes (sensores, luces, motores…) uniendo bloques visuales, sin escribir código al principio. La web oficial ofrece actividades guiadas, como una mano robótica o un parking inteligente.',
        capabilities: 'Programar dispositivos compatibles. Según la web oficial:\n• Bitbloq Robotics se orienta a la placa Zum Core 2.0.\n• Bitbloq Robotics Jr se usa con la placa Zum Junior.\n• Bitbloq Robotics Adv permite programar también otras placas, como Arduino UNO.\nLista completa de placas y componentes compatibles: pendiente de comprobar.',
        difficulty: 'principiante',
        requirements: '• Navegador web (la plataforma funciona en línea).\n• Para la robótica física: una placa compatible, componentes y un cable USB para conectarla al ordenador.\nPendiente de comprobar: si desde mi Chromebook puedo cargar el programa en la placa directamente desde el navegador.',
        pricing: 'Según su web oficial, las herramientas pueden usarse gratis en abierto; una cuenta permite, por ejemplo, guardar documentos en la nube, y existe un Plan Docente de pago con funciones para aulas.\nLos precios del Plan Docente aparecen de forma distinta en diferentes páginas: pendiente de comprobar.',
        pros: '• Programación visual por bloques, adecuada para empezar.\n• Pensada para la educación, con actividades guiadas.\n• Reúne robótica, diseño 3D y creación de apps en un mismo sitio.',
        cons: '• Para la robótica física hace falta hardware compatible.\n• Algunas funciones dependen del Plan Docente de pago.\n• Compatibilidad con cada placa y con Chromebook: pendiente de comprobar.',
        researchStatus: 'sin-empezar',
        resources: [
          { label: 'Web oficial', url: 'https://bitbloq.cc' },
          { label: 'Bitbloq Robotics', url: 'https://bitbloq.cc/herramientas/robotics' },
          { label: 'Ventajas de la cuenta', url: 'https://bitbloq.cc/ventajas-cuenta' }
        ],
        sourceNote: 'Documentado el 17/10/2026 con la web oficial de Bitbloq (bitbloq.cc), consultada a través de un buscador. Los precios del Plan Docente no coinciden entre páginas.'
      },
      {
        id: 'tool-crear-app-google',
        name: 'Crear una app mediante Google',
        originalName: 'Crear tu app (buscar en Google)',
        kind: 'investigacion',
        categoryId: 'cat-investigacion',
        description: 'Investigación pendiente a partir de la nota «Crear tu app (buscar en Google)». No se sabe todavía a qué herramienta o servicio se refiere. Busca en Google, guarda aquí el enlace de lo que encuentres y anota tus conclusiones.',
        difficulty: 'pendiente',
        researchStatus: 'sin-empezar',
        resources: [],
        sourceNote: 'Nota convertida en investigación pendiente. No se ha asumido ningún producto concreto.'
      }
    ];
  }

  /** Ejemplos de demostración: pocos y marcados con demo: true. */
  function demoItems() {
    return {
      prompts: [
        {
          id: 'demo-prompt-concepto',
          demo: true,
          title: 'Ejemplo: explicar un concepto paso a paso',
          objective: 'Entender un concepto nuevo de programación con un ejemplo y un ejercicio.',
          tool: 'ChatGPT',
          tags: ['aprendizaje', 'ejemplo'],
          text: 'Actúa como un profesor paciente de programación para principiantes.\n\nExplícame qué es [CONCEPTO] con palabras sencillas, en un máximo de cinco frases.\nDespués, muéstrame un ejemplo práctico en [LENGUAJE] con comentarios en cada línea.\nPor último, proponme un ejercicio corto para practicar y no me des la solución hasta que te la pida.'
        },
        {
          id: 'demo-prompt-error',
          demo: true,
          title: 'Ejemplo: depurar un error',
          objective: 'Encontrar la causa de un error y aprender a evitarlo.',
          tool: 'ChatGPT',
          tags: ['depuración', 'ejemplo'],
          text: 'Tengo un error en mi proyecto [NOMBRE], hecho con [TECNOLOGÍAS].\n\nQué intentaba hacer: [DESCRIBE LA FUNCIÓN]\nQué esperaba que ocurriera: [RESULTADO ESPERADO]\nQué ocurre en realidad: [RESULTADO REAL]\n\nMensaje de error completo:\n[PEGA AQUÍ EL ERROR]\n\nCódigo implicado:\n[PEGA AQUÍ EL FRAGMENTO]\n\nExplícame la causa antes de proponer la solución y dime cómo comprobar que queda corregido.'
        },
        {
          id: 'demo-prompt-claude-code',
          demo: true,
          title: 'Ejemplo: pedir una función nueva a Claude Code',
          objective: 'Añadir una función a un proyecto existente sin romper lo que ya funciona.',
          tool: 'Claude Code',
          tags: ['desarrollo', 'ejemplo'],
          text: 'Examina primero los archivos del proyecto antes de modificar nada.\n\nQuiero añadir [FUNCIÓN] a [SECCIÓN DE LA APP].\nRequisitos:\n- [REQUISITO 1]\n- [REQUISITO 2]\n\nRestricciones: no añadas dependencias nuevas y mantén el estilo del código existente.\nCuando termines, ejecuta las pruebas disponibles y resume qué archivos has cambiado y qué has comprobado.'
        }
      ],
      concepts: [
        {
          id: 'demo-concept-localstorage',
          demo: true,
          name: 'Ejemplo: localStorage',
          categoryId: 'cat-web',
          explanation: 'Es un pequeño almacén del navegador que guarda textos con un nombre (clave). Los datos siguen ahí aunque cierres el navegador, pero solo en ese navegador y en ese equipo.',
          example: 'Este centro guarda tus datos en localStorage: por eso no necesitas cuenta, pero conviene exportar una copia de seguridad de vez en cuando.',
          code: "localStorage.setItem('saludo', 'Hola');\nconst texto = localStorage.getItem('saludo');\nconsole.log(texto); // Muestra: Hola",
          codeLanguage: 'JavaScript',
          doubts: '',
          exercise: 'Abre la consola del navegador (Ctrl + Mayús + J en Chrome), guarda tu nombre con setItem, recarga la página y recupéralo con getItem.',
          mastery: 'sin-empezar'
        }
      ],
      projects: [
        {
          id: 'demo-project-web',
          demo: true,
          name: 'Ejemplo: Mi primera página web',
          objective: 'Ver cómo funciona el planificador con un proyecto de demostración.',
          description: 'Proyecto de ejemplo. Puedes moverlo entre etapas, editarlo o eliminarlo. Para quitar todos los ejemplos a la vez, ve a Configuración → Datos de ejemplo.',
          toolIds: ['tool-claude-code'],
          otherTools: 'Editor de texto y navegador',
          stage: 'planificacion',
          status: 'activo',
          nextStep: 'Ejemplo: crear el archivo index.html con la estructura básica.',
          links: [],
          stageNotes: {
            idea: 'Ejemplo: una página personal sencilla hecha con HTML y CSS.',
            investigacion: 'Ejemplo: repasar la estructura básica de un documento HTML.',
            planificacion: 'Ejemplo: secciones de presentación, intereses y contacto.'
          },
          issues: [
            { id: 'demo-issue-1', problem: 'Ejemplo: la imagen de perfil no se ve.', solution: 'Ejemplo: comprobar que la ruta del archivo es correcta.', solved: false }
          ]
        }
      ],
      resources: [
        {
          id: 'demo-resource-mdn',
          demo: true,
          title: 'Ejemplo: MDN Web Docs – HTML',
          url: 'https://developer.mozilla.org/es/docs/Web/HTML',
          type: 'documentacion',
          categoryId: 'cat-web',
          reviewStatus: 'pendiente',
          description: 'Recurso de ejemplo: documentación de referencia sobre HTML de Mozilla.'
        }
      ]
    };
  }

  /** Estado completo de la primera vez que se abre la aplicación. */
  function createInitialState() {
    const demo = demoItems();
    return {
      categories: categories(),
      tasks: tasks(),
      tools: tools(),
      concepts: demo.concepts,
      notes: [],
      snippets: [],
      prompts: demo.prompts,
      projects: demo.projects,
      resources: demo.resources,
      settings: { showDemo: true, welcomeDismissed: false }
    };
  }

  App.seed = { categories, tasks, tools, demoItems, createInitialState, PENDIENTE };
})(window.App = window.App || {});
