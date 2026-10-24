/* Utilidades de interfaz compartidas por todas las vistas. */
(function () {
  'use strict';

  /* h('div', { class: 'x', onclick: fn }, 'texto', otroNodo, [más, nodos]) */
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k in el && typeof v !== 'string') el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    const add = (c) => {
      if (c == null || c === false) return;
      if (Array.isArray(c)) c.forEach(add);
      else el.append(c instanceof Node ? c : document.createTextNode(String(c)));
    };
    kids.forEach(add);
    return el;
  }

  /* Convierte lo que se teclea en símbolos lógicos. */
  function normalizeTyping(s) {
    return s
      .replace(/<->|<=>/g, '↔')
      .replace(/->|=>/g, '→')
      .replace(/&&?/g, '∧')
      .replace(/\^/g, '∧')
      .replace(/\|\|?/g, '∨')
      .replace(/[~!]/g, '¬')
      .replace(/v/g, '∨')
      .replace(/[a-uw-z]/g, (c) => c.toUpperCase());
  }

  let lastFormulaInput = null;

  function formulaInput(attrs = {}) {
    const input = h('input', {
      type: 'text',
      class: 'formula-input ' + (attrs.class || ''),
      autocomplete: 'off',
      autocapitalize: 'characters',
      spellcheck: 'false',
      placeholder: attrs.placeholder || '',
      value: attrs.value || '',
      'aria-label': attrs.label || 'Fórmula',
    });
    input.addEventListener('focus', () => { lastFormulaInput = input; });
    input.addEventListener('input', () => {
      const pos = input.selectionStart;
      const before = normalizeTyping(input.value.slice(0, pos));
      const after = normalizeTyping(input.value.slice(pos));
      if (before + after !== input.value) {
        input.value = before + after;
        input.setSelectionRange(before.length, before.length);
      }
      input.classList.remove('is-ok', 'is-bad');
      if (attrs.oninput) attrs.oninput(input.value);
    });
    if (attrs.onkeydown) input.addEventListener('keydown', attrs.onkeydown);
    return input;
  }

  function insertSymbol(sym) {
    const input = lastFormulaInput && document.body.contains(lastFormulaInput) ? lastFormulaInput : null;
    if (!input) return;
    const s = input.selectionStart ?? input.value.length;
    const e = input.selectionEnd ?? input.value.length;
    input.value = input.value.slice(0, s) + sym + input.value.slice(e);
    input.focus();
    input.setSelectionRange(s + sym.length, s + sym.length);
    input.dispatchEvent(new Event('input'));
  }

  function symbolBar(extra = []) {
    const syms = ['¬', '∧', '∨', '→', '↔', '(', ')', ...extra];
    return h('div', { class: 'symbols' },
      h('span', { class: 'label' }, 'Símbolos:'),
      syms.map((s) => h('button', {
        type: 'button',
        class: 'sym-btn',
        title: `Insertar ${s}`,
        onmousedown: (ev) => ev.preventDefault(),
        onclick: () => insertSymbol(s),
      }, s)),
      h('span', { class: 'hint-keys' },
        ' o teclea ', h('code', {}, '~'), ' ', h('code', {}, '&'), ' ', h('code', {}, 'v'), ' ',
        h('code', {}, '->'), ' ', h('code', {}, '<->'))
    );
  }

  const fmt = (f) => Logic.toString(typeof f === 'string' ? Logic.parse(f) : f);

  function statement(premises, conclusion) {
    return h('div', { class: 'statement' },
      premises.length ? premises.map(fmt).join(',  ') : '',
      h('span', { class: 'therefore' }, premises.length ? ' ∴ ' : '⊢ '),
      fmt(conclusion));
  }

  const levelDots = (n) => h('span', { class: 'level', title: `Dificultad ${n} de 3` }, '●'.repeat(n) + '○'.repeat(3 - n));

  function feedback(el, kind, content) {
    el.className = 'feedback ' + (kind || '');
    el.replaceChildren(...(content == null ? [] : [].concat(content)));
  }

  /* Cabecera de un ejercicio con migas y navegación anterior/siguiente. */
  function exerciseHeader({ section, sectionTitle, index, total, title, level }) {
    const nav = h('div', { class: 'btn-row', style: 'margin:0' },
      index > 0 ? h('a', { class: 'btn small', href: `#/${section}/${index}` }, '← Anterior') : null,
      index != null && index < total - 1 ? h('a', { class: 'btn small', href: `#/${section}/${index + 2}` }, 'Siguiente →') : null);
    return [
      h('div', { class: 'crumbs' }, h('a', { href: '#/' }, 'Inicio'), ' / ', h('a', { href: `#/${section}` }, sectionTitle)),
      h('div', { class: 'page-head' },
        h('h1', {}, title, level ? ' ' : '', level ? levelDots(level) : null),
        index != null ? nav : null),
    ];
  }

  function panel(title, ...body) {
    return h('section', { class: 'panel' },
      title ? h('div', { class: 'panel-head' }, title) : null,
      h('div', { class: 'panel-body' }, ...body));
  }

  /* Formulario de «ejercicio propio»: premisas y conclusión. */
  function ownReasoningForm(section, { allowFormula = false } = {}) {
    const prem = formulaInput({ placeholder: 'P → Q, P', label: 'Premisas' });
    const concl = formulaInput({ placeholder: allowFormula ? 'Q   (o una fórmula sola sin premisas)' : 'Q', label: 'Conclusión' });
    const fb = h('div', { class: 'feedback' });
    const go = () => {
      const ps = prem.value.split(',').map((s) => s.trim()).filter(Boolean);
      const c = concl.value.trim();
      try {
        ps.forEach(Logic.parse);
        Logic.parse(c);
      } catch (e) {
        feedback(fb, 'bad', e.message);
        return;
      }
      const q = new URLSearchParams();
      if (ps.length) q.set('p', ps.join(','));
      q.set('c', c);
      location.hash = `#/${section}/propio?${q}`;
    };
    const onkeydown = (e) => { if (e.key === 'Enter') go(); };
    prem.addEventListener('keydown', onkeydown);
    concl.addEventListener('keydown', onkeydown);
    return panel('Ejercicio propio',
      h('p', { class: 'muted small' }, allowFormula
        ? 'Escribe una fórmula para estudiarla, o un razonamiento: premisas separadas por comas y la conclusión.'
        : 'Escribe las premisas separadas por comas y la conclusión.'),
      symbolBar(),
      h('div', { class: 'own-form' },
        h('label', {}, 'Premisas', prem),
        h('label', {}, allowFormula ? 'Conclusión o fórmula' : 'Conclusión', concl)),
      h('div', { class: 'btn-row' }, h('button', { class: 'btn primary', onclick: go }, 'Empezar')),
      fb);
  }

  /* Lee premisas/conclusión de la URL del ejercicio propio. */
  function readOwn(query) {
    const ps = (query.get('p') || '').split(',').map((s) => s.trim()).filter(Boolean);
    const c = query.get('c') || '';
    return { premises: ps, conclusion: c };
  }

  window.UI = {
    h, normalizeTyping, formulaInput, insertSymbol, symbolBar, fmt, statement, levelDots,
    feedback, exerciseHeader, panel, ownReasoningForm, readOwn,
  };
})();
