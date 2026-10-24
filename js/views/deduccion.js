(function () {
  'use strict';
  const { h, formulaInput, symbolBar, feedback, panel, statement, fmt } = UI;
  const BAR = 16; // px por nivel de hipótesis

  function render(ex) {
    const premises = ex.premises.map(Logic.parse);
    const conclusion = Logic.parse(ex.conclusion);
    const initial = () => ex.premises.map((p) => ({ formula: fmt(p), rule: 'P', refs: '' }));
    let lines = initial();
    let derived = false;

    const rowsEl = h('div');
    const status = h('div', { class: 'feedback' });
    let rows = [];

    const rulesList = () => [...Deduction.BASIC_RULES, ...(derived ? Deduction.DERIVED_RULES : [])];

    function clearMarks(row) {
      row.el.classList.remove('row-ok', 'row-bad');
      row.msg.textContent = '';
      row.msg.className = 'nd-msg';
      feedback(status, null, null);
    }

    function relayout() {
      const lay = Deduction.layout(lines);
      rows.forEach((row, i) => {
        row.formulaCell.style.backgroundSize = `${lay[i].depth * BAR}px 100%`;
        row.formulaCell.style.paddingLeft = `${lay[i].depth * BAR + (lay[i].depth ? 4 : 0)}px`;
        row.el.classList.toggle('hyp', lines[i].rule === 'H');
      });
    }

    function makeRow(line, i) {
      const formula = formulaInput({
        value: line.formula,
        placeholder: 'Fórmula',
        label: `Fórmula de la línea ${i + 1}`,
        oninput: (v) => { line.formula = v; clearMarks(row); },
        onkeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); rule.focus(); } },
      });
      const rule = h('select', {
        'aria-label': `Regla de la línea ${i + 1}`,
        onchange: () => { line.rule = rule.value; clearMarks(row); relayout(); },
      },
      h('option', { value: '' }, 'Regla…'),
      rulesList().map((r) => h('option', { value: r, title: Deduction.RULE_HELP[r].name }, r)));
      rule.value = rulesList().includes(line.rule) ? line.rule : '';
      const refs = h('input', {
        type: 'text',
        value: line.refs,
        placeholder: 'Refs.',
        inputmode: 'numeric',
        'aria-label': `Referencias de la línea ${i + 1}`,
        oninput: () => { line.refs = refs.value; clearMarks(row); },
        onkeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); addLine(i + 1); } },
      });
      const formulaCell = h('div', { class: 'nd-formula' }, formula);
      const msg = h('div', { class: 'nd-msg' });
      const el = h('div', { class: 'nd-row' },
        h('div', { class: 'nd-num' }, i + 1),
        formulaCell,
        h('div', { class: 'nd-rule' }, rule),
        h('div', { class: 'nd-refs' }, refs),
        h('div', { class: 'nd-actions' },
          h('button', { class: 'icon-btn', title: 'Insertar una línea debajo', 'aria-label': 'Insertar línea debajo', onclick: () => addLine(i + 1) }, '+'),
          h('button', { class: 'icon-btn', title: 'Borrar esta línea', 'aria-label': 'Borrar línea', onclick: () => removeLine(i) }, '✕')),
        msg);
      const row = { el, msg, formulaCell, formula };
      return row;
    }

    function rebuild() {
      rows = lines.map(makeRow);
      rowsEl.replaceChildren(...rows.map((r) => r.el));
      relayout();
      feedback(status, null, null);
    }

    function addLine(at = lines.length) {
      lines.splice(at, 0, { formula: '', rule: '', refs: '' });
      rebuild();
      rows[at].formula.focus();
    }

    function removeLine(i) {
      lines.splice(i, 1);
      rebuild();
    }

    function check() {
      const res = Deduction.checkProof(lines, { premises, conclusion, derived });
      res.lines.forEach((r, i) => {
        const row = rows[i];
        row.el.classList.toggle('row-ok', r.ok);
        row.el.classList.toggle('row-bad', !r.ok);
        row.msg.className = 'nd-msg ' + (r.ok ? '' : 'bad');
        row.msg.textContent = r.ok ? '' : r.msg;
        if (r.ok) {
          const f = Logic.tryParse(lines[i].formula);
          if (f.ok) { lines[i].formula = fmt(f.f); row.formula.value = lines[i].formula; }
        }
      });
      feedback(status, res.complete ? 'ok' : (res.lines.every((l) => l.ok) ? 'info' : 'bad'), res.msg);
    }

    function showSolution() {
      if (!ex.solution) return;
      const dirty = lines.length !== ex.premises.length || lines.some((l, i) => i >= ex.premises.length || l.rule !== 'P');
      if (dirty && !confirm('Se sustituirá tu demostración por la solución. ¿Continuar?')) return;
      lines = ex.solution.map(([formula, rule, refs]) => ({ formula: fmt(formula), rule, refs }));
      rebuild();
      check();
    }

    function reset() {
      if (!confirm('¿Borrar la demostración y empezar de nuevo?')) return;
      lines = initial();
      rebuild();
    }

    const derivedBox = h('input', {
      type: 'checkbox',
      onchange: (e) => { derived = e.target.checked; rebuild(); },
    });

    let validityNote = null;
    const val = Logic.validity(premises, conclusion);
    if (!val.valid) {
      validityNote = h('div', { class: 'feedback bad' },
        `Atención: este razonamiento no es válido (falla con ${Logic.describeValuation(val.counter)}), así que no se puede demostrar.`);
    }

    rebuild();

    return [
      panel('Demuestra',
        statement(ex.premises, ex.conclusion),
        validityNote,
        h('p', { class: 'muted small', style: 'margin-top:12px' },
          'Las premisas ya están escritas. Añade líneas hasta llegar a la conclusión. Una línea con «H» abre una hipótesis (se dibuja una barra) y se cierra con I→ o I¬ indicando el rango, por ejemplo 3-5. ',
          h('a', { href: '#/ayuda' }, 'Ver las reglas.'))),
      panel(null,
        symbolBar(),
        h('div', { class: 'nd' },
          h('div', { class: 'nd-head' }, h('span', {}, 'Nº'), h('span', {}, 'Fórmula'), h('span', {}, 'Regla'), h('span', {}, 'Refs.'), h('span', {})),
          rowsEl),
        h('div', { class: 'btn-row' },
          h('button', { class: 'btn', onclick: () => addLine() }, '+ Añadir línea'),
          h('button', { class: 'btn primary', onclick: check }, 'Comprobar'),
          ex.solution ? h('button', { class: 'btn', onclick: showSolution }, 'Ver solución') : null,
          h('button', { class: 'btn', onclick: reset }, 'Reiniciar'),
          h('label', { class: 'small muted', style: 'display:inline-flex;gap:6px;align-items:center;margin-left:auto' },
            derivedBox, 'Permitir reglas derivadas (MT, SD)')),
        status),
    ];
  }

  window.Views = window.Views || {};
  window.Views.deduccion = {
    title: 'Deducción natural',
    description: 'Demuestra razonamientos paso a paso con las reglas de introducción y eliminación.',
    intro: 'Construye la demostración línea a línea. Cada línea lleva una fórmula, la regla que la justifica y las líneas a las que se refiere. El corrector revisa cada paso y te dice exactamente qué falla.',
    exercises: () => Exercises.deduccion,
    listLabel: (ex) => [ex.premises.map(fmt).join(', '), ' ∴ ', fmt(ex.conclusion)].join(''),
    titleOf: (ex, i) => `Deducción natural ${i + 1}`,
    render,
    own: true,
  };
})();
