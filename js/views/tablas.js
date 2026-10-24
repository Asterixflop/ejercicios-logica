(function () {
  'use strict';
  const { h, feedback, panel, statement, fmt } = UI;
  const NEXT = { '': 'V', V: 'F', F: '' };

  function render(ex) {
    const isReasoning = !ex.formula;
    const premises = isReasoning ? ex.premises.map(Logic.parse) : [];
    const conclusion = Logic.parse(isReasoning ? ex.conclusion : ex.formula);
    const mains = [...premises, conclusion];
    const mainKeys = new Set(mains.map((f) => Logic.toString(f)));

    const names = Logic.atoms(mains);
    const vals = Logic.valuations(names);
    const cols = Logic.subformulas(mains);
    const values = vals.map(() => cols.map(() => ''));
    const cells = vals.map(() => []);

    function setCell(r, c, v) {
      values[r][c] = v;
      const btn = cells[r][c];
      btn.textContent = v;
      btn.className = 'tt-cell';
      btn.setAttribute('aria-label', `Fila ${r + 1}, ${Logic.toString(cols[c])}: ${v || 'vacía'}`);
      tbody.querySelectorAll('tr.counter').forEach((tr) => tr.classList.remove('counter'));
      feedback(status, null, null);
    }

    function focusCell(r, c) {
      if (r >= vals.length) { r = 0; c++; }
      if (r < 0) { r = vals.length - 1; c--; }
      if (c < 0 || c >= cols.length) return;
      cells[r][c].focus();
    }

    const tbody = h('tbody', {}, vals.map((v, r) => h('tr', {},
      names.map((n) => h('td', { class: 'atom' }, Logic.tv(v[n]))),
      cols.map((col, c) => {
        const btn = h('button', {
          type: 'button',
          class: 'tt-cell',
          'aria-label': `Fila ${r + 1}, ${Logic.toString(col)}: vacía`,
          onclick: () => setCell(r, c, NEXT[values[r][c]]),
          onkeydown: (e) => {
            const k = e.key.toLowerCase();
            if (k === 'v' || k === '1') { setCell(r, c, 'V'); focusCell(r + 1, c); }
            else if (k === 'f' || k === '0') { setCell(r, c, 'F'); focusCell(r + 1, c); }
            else if (k === 'backspace' || k === 'delete') setCell(r, c, '');
            else if (k === 'arrowdown') focusCell(r + 1, c);
            else if (k === 'arrowup') focusCell(r - 1, c);
            else if (k === 'arrowright') focusCell(r, c + 1);
            else if (k === 'arrowleft') focusCell(r, c - 1);
            else return;
            e.preventDefault();
          },
        });
        cells[r][c] = btn;
        return h('td', { class: c === 0 ? 'sep' : '' }, btn);
      }))));

    const table = h('table', { class: 'tt' },
      h('thead', {}, h('tr', {},
        names.map((n) => h('th', { class: 'atom' + (mainKeys.has(n) ? ' main' : '') }, n)),
        cols.map((col, c) => h('th', {
          class: (mainKeys.has(Logic.toString(col)) ? 'main' : '') + (c === 0 ? ' sep' : ''),
        }, Logic.toString(col))))),
      tbody);

    /* Pregunta final */
    const choiceName = 'tt-answer-' + Math.random().toString(36).slice(2);
    const options = isReasoning
      ? [['valido', 'Válido'], ['no-valido', 'No válido']]
      : [['tautologia', 'Tautología'], ['contingente', 'Contingente'], ['contradiccion', 'Contradicción']];
    const radios = options.map(([value, label]) => {
      const input = h('input', { type: 'radio', name: choiceName, value, onchange: () => feedback(status, null, null) });
      return { value, input, label: h('label', {}, input, label) };
    });
    const answer = () => (radios.find((r) => r.input.checked) || {}).value;
    const correctAnswer = isReasoning
      ? (Logic.validity(premises, conclusion).valid ? 'valido' : 'no-valido')
      : Logic.classify(conclusion);

    const status = h('div', { class: 'feedback' });

    function check() {
      let wrong = 0;
      let missing = 0;
      vals.forEach((v, r) => cols.forEach((col, c) => {
        const expected = Logic.tv(Logic.evaluate(col, v));
        const btn = cells[r][c];
        if (!values[r][c]) { missing++; btn.className = 'tt-cell missing'; }
        else if (values[r][c] !== expected) { wrong++; btn.className = 'tt-cell bad'; }
        else btn.className = 'tt-cell ok';
      }));
      const msgs = [];
      if (missing) msgs.push(`Faltan ${missing} casillas por rellenar.`);
      if (wrong) msgs.push(`Hay ${wrong} casillas incorrectas (en rojo).`);
      if (!missing && !wrong) msgs.push('La tabla es correcta.');

      const a = answer();
      if (!a) msgs.push(isReasoning ? 'Indica si el razonamiento es válido.' : 'Indica cómo se clasifica la fórmula.');
      else if (a !== correctAnswer) msgs.push('La respuesta a la pregunta no es correcta.');
      else if (isReasoning) {
        if (correctAnswer === 'valido') msgs.push('Correcto: en todas las filas en que las premisas son V, la conclusión también es V.');
        else {
          const rows = [];
          vals.forEach((v, r) => {
            if (premises.every((p) => Logic.evaluate(p, v)) && !Logic.evaluate(conclusion, v)) {
              rows.push(r + 1);
              tbody.rows[r].classList.add('counter');
            }
          });
          msgs.push(`Correcto: no es válido. ${rows.length > 1 ? 'Las filas' : 'La fila'} ${rows.join(', ')} ${rows.length > 1 ? 'son contraejemplos' : 'es un contraejemplo'} (premisas V y conclusión F).`);
        }
      } else {
        msgs.push({
          tautologia: 'Correcto: es V en todas las filas.',
          contradiccion: 'Correcto: es F en todas las filas.',
          contingente: 'Correcto: es V en unas filas y F en otras.',
        }[correctAnswer]);
      }
      const allGood = !missing && !wrong && a === correctAnswer;
      feedback(status, allGood ? 'ok' : (wrong || (a && a !== correctAnswer) ? 'bad' : 'info'), msgs.join(' '));
    }

    function showSolution() {
      vals.forEach((v, r) => cols.forEach((col, c) => setCell(r, c, Logic.tv(Logic.evaluate(col, v)))));
      radios.forEach((r) => { r.input.checked = r.value === correctAnswer; });
      check();
    }

    function clearAll() {
      vals.forEach((_, r) => cols.forEach((__, c) => setCell(r, c, '')));
      radios.forEach((r) => { r.input.checked = false; });
    }

    return [
      panel(isReasoning ? 'Estudia la validez del razonamiento' : 'Clasifica la fórmula',
        isReasoning ? statement(ex.premises, ex.conclusion) : h('div', { class: 'statement' }, fmt(conclusion)),
        h('p', { class: 'muted small', style: 'margin-top:12px' },
          'Pulsa una casilla para alternar entre V, F y vacía, o selecciónala y teclea V / F (el cursor baja solo). Las columnas destacadas son ',
          isReasoning ? 'las premisas y la conclusión.' : 'la fórmula completa.')),
      panel(null,
        h('div', { class: 'tt-wrap' }, table),
        h('div', { class: 'choices', role: 'radiogroup', 'aria-label': 'Respuesta' },
          h('strong', {}, isReasoning ? 'El razonamiento es:' : 'La fórmula es:'),
          radios.map((r) => r.label)),
        h('div', { class: 'btn-row' },
          h('button', { class: 'btn primary', onclick: check }, 'Comprobar'),
          h('button', { class: 'btn', onclick: showSolution }, 'Ver solución'),
          h('button', { class: 'btn', onclick: clearAll }, 'Borrar')),
        status),
    ];
  }

  window.Views = window.Views || {};
  window.Views.tablas = {
    title: 'Tablas de verdad',
    description: 'Rellena tablas de verdad, clasifica fórmulas y comprueba la validez de razonamientos.',
    intro: 'Rellena la tabla columna a columna, empezando por las subfórmulas más simples. Después clasifica la fórmula (tautología, contingente o contradicción) o decide si el razonamiento es válido.',
    exercises: () => Exercises.tablas,
    listLabel: (ex) => (ex.formula ? fmt(ex.formula) : [ex.premises.map(fmt).join(', '), ' ∴ ', fmt(ex.conclusion)].join('')),
    titleOf: (ex, i) => `Tabla de verdad ${i + 1}`,
    groupOf: (ex) => (ex.formula ? 'Clasificar fórmulas' : 'Validez de razonamientos'),
    render,
    own: true,
    ownAllowsFormula: true,
    fromOwn: ({ premises, conclusion }) => (premises.length ? { premises, conclusion } : { formula: conclusion }),
  };
})();
