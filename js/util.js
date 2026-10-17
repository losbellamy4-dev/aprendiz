/*
 * Utilidades generales: creación segura de elementos, fechas, URLs,
 * portapapeles, descargas, búsqueda sin tildes y un Markdown sencillo.
 *
 * Regla de seguridad: los datos del usuario se insertan siempre como texto
 * (textContent). El único HTML generado a partir de datos del usuario es el
 * de markdownToHtml(), que escapa todo antes de aplicar el formato.
 */
(function (App) {
  'use strict';

  // Propiedades que deben asignarse como propiedad del elemento (no como atributo).
  const PROPS = new Set(['value', 'checked', 'disabled', 'selected', 'hidden', 'required', 'multiple', 'readOnly', 'open', 'indeterminate']);

  /**
   * Crea un elemento del DOM.
   * attrs admite: class (texto o lista), text, dataset, style (objeto),
   * eventos con prefijo on (onClick, onInput…) y cualquier atributo.
   */
  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    if (attrs) setAttrs(el, attrs);
    append(el, children);
    // value se aplica al final para que funcione en <select> con opciones hijas.
    if (attrs && attrs.value !== undefined && attrs.value !== null) el.value = attrs.value;
    return el;
  }

  function setAttrs(el, attrs) {
    Object.keys(attrs).forEach((key) => {
      const value = attrs[key];
      if (value === undefined || value === null || key === 'value') return;
      if (key === 'class') {
        el.className = Array.isArray(value) ? value.filter(Boolean).join(' ') : value;
      } else if (key === 'text') {
        el.textContent = value;
      } else if (key === 'dataset') {
        Object.keys(value).forEach((k) => { if (value[k] !== undefined && value[k] !== null) el.dataset[k] = value[k]; });
      } else if (key === 'style' && typeof value === 'object') {
        Object.assign(el.style, value);
      } else if (key.slice(0, 2) === 'on' && typeof value === 'function') {
        el.addEventListener(key.slice(2).toLowerCase(), value);
      } else if (PROPS.has(key)) {
        el[key] = value;
      } else if (value === false) {
        // Atributo booleano desactivado: no se añade.
      } else if (key === 'href') {
        el.setAttribute('href', safeHref(value));
      } else {
        el.setAttribute(key, value === true ? '' : String(value));
      }
    });
  }

  function append(el, children) {
    children.forEach((child) => {
      if (child === null || child === undefined || child === false || child === true) return;
      if (Array.isArray(child)) { append(el, child); return; }
      el.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
    });
  }

  /** Añade hijos a un elemento ignorando valores vacíos (null, false…), a diferencia de Element.append. */
  function mount(el, ...children) {
    append(el, children);
    return el;
  }

  /** Icono SVG decorativo (aria-hidden). El contenido viene de App.ICONS, nunca del usuario. */
  function icon(name, extraClass) {
    const span = document.createElement('span');
    span.className = 'icon' + (extraClass ? ' ' + extraClass : '');
    span.setAttribute('aria-hidden', 'true');
    span.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" focusable="false">' +
      (App.ICONS[name] || App.ICONS.dot) + '</svg>';
    return span;
  }

  // ---------------------------------------------------------------- Fechas
  const fmtDate = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  const fmtDateTime = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const fmtTime = new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' });

  function toDate(value) {
    if (!value) return null;
    const d = value instanceof Date ? value : new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  function formatDate(value) { const d = toDate(value); return d ? fmtDate.format(d) : '—'; }
  function formatDateTime(value) { const d = toDate(value); return d ? fmtDateTime.format(d) : '—'; }
  function formatTime(value) { const d = toDate(value); return d ? fmtTime.format(d) : '—'; }
  function nowISO() { return new Date().toISOString(); }
  function todayStamp() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  // --------------------------------------------------------- Identificadores
  function uid(prefix) {
    let rand;
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      rand = window.crypto.randomUUID().replace(/-/g, '').slice(0, 12);
    } else {
      rand = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    }
    return (prefix || 'id') + '-' + rand;
  }

  // ------------------------------------------------------------------ Texto
  /** Minúsculas y sin tildes, para que «investigacion» encuentre «investigación». */
  function normalizeText(value) {
    return String(value || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }
  function matchesQuery(query, ...fields) {
    const q = normalizeText(query).trim();
    if (!q) return true;
    const haystack = normalizeText(fields.join(' \u0001 '));
    return q.split(/\s+/).every((word) => haystack.includes(word));
  }
  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function plural(n, singular, pluralForm) { return n + ' ' + (n === 1 ? singular : pluralForm); }
  function truncate(value, max) {
    const s = String(value || '');
    return s.length > max ? s.slice(0, max - 1).trimEnd() + '…' : s;
  }

  // ------------------------------------------------------------------- URLs
  /** Solo se aceptan enlaces http(s) con dominio. Bloquea javascript:, data:, etc. */
  function isSafeUrl(value) {
    if (typeof value !== 'string' || !value.trim()) return false;
    try {
      const url = new URL(value.trim());
      return (url.protocol === 'http:' || url.protocol === 'https:') && Boolean(url.hostname);
    } catch (e) {
      return false;
    }
  }
  function safeHref(value) {
    const s = String(value || '').trim();
    if (s.charAt(0) === '#') return s;
    return isSafeUrl(s) ? s : '#';
  }
  /** Completa «www.ejemplo.com» como «https://www.ejemplo.com». */
  function normalizeUrlInput(value) {
    const s = String(value || '').trim();
    if (!s) return '';
    if (!/^[a-z][a-z0-9+.-]*:/i.test(s) && /^[\w-]+(\.[\w-]+)+([/?#].*)?$/.test(s)) return 'https://' + s;
    return s;
  }
  function hostOf(value) {
    try { return new URL(value).hostname.replace(/^www\./, ''); } catch (e) { return ''; }
  }
  function googleSearchUrl(query) {
    return 'https://www.google.com/search?q=' + encodeURIComponent(query);
  }

  /** Convierte líneas «Título | https://…» (o solo la URL) en enlaces. */
  function parseLinks(text) {
    const links = [];
    const errors = [];
    String(text || '').split('\n').forEach((raw, i) => {
      const line = raw.trim();
      if (!line) return;
      const sep = line.lastIndexOf('|');
      let label = '';
      let url = line;
      if (sep !== -1) {
        label = line.slice(0, sep).trim();
        url = line.slice(sep + 1).trim();
      }
      url = normalizeUrlInput(url);
      if (isSafeUrl(url)) links.push({ label: label || hostOf(url), url });
      else errors.push('Línea ' + (i + 1) + ': «' + truncate(line, 60) + '» no contiene un enlace válido (debe empezar por https:// o http://).');
    });
    return { links, errors };
  }
  function formatLinks(links) {
    return (links || []).map((l) => (l.label ? l.label + ' | ' : '') + l.url).join('\n');
  }
  function parseTags(text) {
    const seen = new Set();
    return String(text || '').split(',').map((t) => t.trim()).filter((t) => {
      const key = normalizeText(t);
      if (!t || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  // ------------------------------------------------- Portapapeles y archivos
  async function copyText(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (e) { /* se intenta el método alternativo */ }
    try {
      // Dentro de un diálogo modal el resto de la página es inerte: se usa el diálogo como contenedor.
      const host = document.querySelector('dialog[open]') || document.body;
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '0';
      ta.style.opacity = '0';
      host.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch (e) {
      return false;
    }
  }

  function downloadFile(filename, text, mime) {
    const blob = new Blob([text], { type: (mime || 'application/json') + ';charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function readFileAsText(file) {
    if (file && typeof file.text === 'function') return file.text();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }

  // ------------------------------------------------------------------ Varios
  /** Retrasa la ejecución; permite forzarla con .flush() y cancelarla con .cancel(). */
  function debounce(fn, wait) {
    let timer = null;
    let lastArgs = null;
    function debounced(...args) {
      lastArgs = args;
      clearTimeout(timer);
      timer = setTimeout(run, wait);
    }
    function run() {
      timer = null;
      const args = lastArgs;
      lastArgs = null;
      if (args) fn(...args);
    }
    debounced.flush = () => { if (timer) { clearTimeout(timer); run(); } };
    debounced.cancel = () => { clearTimeout(timer); timer = null; lastArgs = null; };
    debounced.pending = () => timer !== null;
    return debounced;
  }

  function isTypingTarget(el) {
    if (!el) return false;
    const tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
  }

  function byId(list) {
    const map = new Map();
    (list || []).forEach((item) => map.set(item.id, item));
    return map;
  }

  // -------------------------------------------------------- Markdown sencillo
  /*
   * Admite: # títulos, **negrita**, *cursiva*, `código`, bloques ```,
   * listas con - o 1., enlaces [texto](https://…) y párrafos.
   * Todo el texto se escapa antes de aplicar el formato.
   */
  function inlineMarkdown(text) {
    const codes = [];
    let s = escapeHtml(text);
    s = s.replace(/`([^`]+)`/g, (m, code) => { codes.push(code); return '\u0000' + (codes.length - 1) + '\u0000'; });
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^*\w])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    s = s.replace(/\u0000(\d+)\u0000/g, (m, i) => '<code>' + codes[Number(i)] + '</code>');
    return s;
  }

  function markdownToHtml(source) {
    const lines = String(source || '').replace(/\r\n?/g, '\n').split('\n');
    let html = '';
    let list = null;
    let inCode = false;
    let code = [];
    let para = [];
    const flushPara = () => {
      if (para.length) html += '<p>' + para.map(inlineMarkdown).join('<br>') + '</p>';
      para = [];
    };
    const closeList = () => {
      if (list) html += '</' + list + '>';
      list = null;
    };
    lines.forEach((line) => {
      if (inCode) {
        if (/^\s*```/.test(line)) {
          html += '<pre><code>' + escapeHtml(code.join('\n')) + '</code></pre>';
          inCode = false;
          code = [];
        } else {
          code.push(line);
        }
        return;
      }
      if (/^\s*```/.test(line)) { flushPara(); closeList(); inCode = true; return; }
      const heading = /^(#{1,3})\s+(.*)$/.exec(line);
      if (heading) {
        flushPara(); closeList();
        const level = heading[1].length + 2;
        html += '<h' + level + '>' + inlineMarkdown(heading[2]) + '</h' + level + '>';
        return;
      }
      const ul = /^\s*[-*]\s+(.*)$/.exec(line);
      const ol = /^\s*\d+[.)]\s+(.*)$/.exec(line);
      if (ul || ol) {
        flushPara();
        const type = ul ? 'ul' : 'ol';
        if (list !== type) { closeList(); html += '<' + type + '>'; list = type; }
        html += '<li>' + inlineMarkdown((ul || ol)[1]) + '</li>';
        return;
      }
      if (!line.trim()) { flushPara(); closeList(); return; }
      closeList();
      para.push(line);
    });
    if (inCode) html += '<pre><code>' + escapeHtml(code.join('\n')) + '</code></pre>';
    flushPara();
    closeList();
    return html;
  }

  App.util = {
    h, icon, append, mount,
    toDate, formatDate, formatDateTime, formatTime, nowISO, todayStamp,
    uid, normalizeText, matchesQuery, escapeHtml, plural, truncate,
    isSafeUrl, safeHref, normalizeUrlInput, hostOf, googleSearchUrl, parseLinks, formatLinks, parseTags,
    copyText, downloadFile, readFileAsText,
    debounce, isTypingTarget, byId,
    markdownToHtml
  };
})(window.App = window.App || {});
