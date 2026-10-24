(function () {
  'use strict';
  const { h, formulaInput, symbolBar, feedback, panel, statement, fmt } = UI;
  const cs = Logic.clauseToString;

  function render(ex) {
    const premises = ex.premises.map(Logic.parse);
    const conclusion = Logic.parse(ex.conclusion);
    const sources = [
      ...premises.map((f, i) => ({ f, tag: `Premisa ${i + 1}`, support: false })),
      { f: Logic.not(conclusion), tag: 'Negación de la conclusión', support: true },
    ];

    /* ---------- Paso 1: forma clausal ---------- */
    let base = null; // [{ clause, support }]
    const step1Status = h('div', { class: 'feedback' });

    const srcRows = sources.map((src) => {
      const fb = h('div', { class: 'feedback' });
      const input = formulaInput({
        placeholder: 'Cláusulas separadas por comas, p. ej. ¬P ∨ Q, R',
        label: `Cláusulas de ${src.tag}`,
        oninput: () => { feedback(fb, null, null); },
        onkeydown: (e) => { if (e.key === 'Enter') checkStep1(); },
      });
      const showFnc = () => {
        const cl = Logic.toClauses(src.f);
        feedback(fb, 'info', ['Forma clausal: ', h('span', { class: 'formula' }, cl.length ? cl.map(cs).join(',  ') : '(tautología: no aporta cláusulas)')]);
      };
      const el = h('div', { class: 'clause-row' },
        h('div', { class: 'clause-src' }, h('span', { class: 'tag' }, src.tag), fmt(src.f)),
        h('div', {},
          h('div', { class: 'sentence-row' }, input, h('button', { class: 'btn small', onclick: showFnc }, 'Solución')),
          fb));
      return { src, input, fb, el };
    });

    function checkStep1() {
      let ok = true;
      const collected = [];
      for (const row of srcRows) {
        row.input.classList.remove('is-ok', 'is-bad');
        let clauses;
        try { clauses = Logic.parseClauses(row.input.value); } catch (e) {
          ok = false;
          row.input.classList.add('is-bad');
          feedback(row.fb, 'bad', e.message);
          continue;
        }
        const eq = Logic.clausesEquivalent(clauses, row.src.f);
        if (!eq.ok) {
          ok = false;
          row.input.classList.add('is-bad');
          feedback(row.fb, 'bad', `No es equivalente a ${fmt(row.src.f)}: falla con ${Logic.describeValuation(eq.counter)}.`);
          continue;
        }
        row.input.classList.add('is-ok');
        row.input.value = clauses.map(cs).join(', ');
        feedback(row.fb, 'ok', 'Correcto.');
        clauses.forEach((c) => collected.push({ clause: c, support: row.src.support }));
      }
      if (!ok) {
        feedback(step1Status, 'bad', 'Revisa las filas marcadas.');
        return;
      }
      const seen = new Set();
      base = collected.filter((x) => {
        const k = cs(x.clause);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      feedback(step1Status, 'ok', 'Forma clausal correcta. Ahora aplica resolución hasta obtener la cláusula vacía □.');
      renderBase();
    }

    /* ---------- Paso 2: resolución ---------- */
    let steps = [];
    const baseEl = h('ol', { class: 'clauses' });
    const stepsEl = h('div');
    const step2Status = h('div', { class: 'feedback' });
    const step2 = h('div', { class: 'locked' });

    function renderBase() {
      step2.classList.remove('locked');
      baseEl.replaceChildren(...base.map((b, i) => h('li', {},
        h('span', { class: 'n' }, `${i + 1}.`), cs(b.clause),
        b.support ? h('span', { class: 'badge', title: 'Procede de la negación de la conclusión' }, 'apoyo') : null)));
      renderSteps();
    }

    function renderSteps() {
      stepsEl.replaceChildren(
        h('div', { class: 'res-step res-head' }, h('span', {}), h('span', {}, 'Cláusula'), h('span', {}, 'Con'), h('span', {}, 'Resolvente'), h('span', {})),
        ...steps.map((st, i) => {
          const n = base.length + i + 1;
          const a = h('input', { type: 'text', inputmode: 'numeric', value: st.a, 'aria-label': `Paso ${n}: primera cláusula`, oninput: () => { st.a = a.value; } });
          const b = h('input', { type: 'text', inputmode: 'numeric', value: st.b, 'aria-label': `Paso ${n}: segunda cláusula`, oninput: () => { st.b = b.value; } });
          const r = formulaInput({
            value: st.r,
            placeholder: 'Resolvente (□ si es vacía)',
            label: `Resolvente del paso ${n}`,
            oninput: (v) => { st.r = v; },
            onkeydown: (e) => { if (e.key === 'Enter') addStep(); },
          });
          st.msgEl = h('div', { class: 'msg' });
          st.inputEl = r;
          return h('div', { class: 'res-step' },
            h('span', { class: 'n' }, `${n}.`), a, b, h('div', { class: 'res-input' }, r),
            h('button', { class: 'icon-btn', title: 'Borrar paso', 'aria-label': 'Borrar paso', onclick: () => { steps.splice(i, 1); renderSteps(); } }, '✕'),
            st.msgEl);
        }));
      feedback(step2Status, null, null);
    }

    function addStep() {
      steps.push({ a: '', b: '', r: '' });
      renderSteps();
      const last = stepsEl.lastElementChild.querySelector('input');
      if (last) last.focus();
    }

    function checkStep2() {
      const all = base.map((b) => b.clause);
      let allOk = true;
      let empty = false;
      steps.forEach((st, i) => {
        const n = base.length + i + 1;
        const fail = (m) => { allOk = false; st.msgEl.className = 'msg bad'; st.msgEl.textContent = m; st.inputEl.classList.add('is-bad'); all.push(null); };
        st.inputEl.classList.remove('is-ok', 'is-bad');
        const ia = parseInt(st.a, 10);
        const ib = parseInt(st.b, 10);
        if (!(ia >= 1 && ia < n) || !(ib >= 1 && ib < n)) return fail(`Indica dos cláusulas anteriores (números del 1 al ${n - 1}).`);
        const ca = all[ia - 1];
        const cb = all[ib - 1];
        if (!ca || !cb) return fail(`El paso ${!ca ? ia : ib} tiene un error; corrígelo primero.`);
        if (!st.r.trim()) return fail('Escribe la resolvente (usa □ para la cláusula vacía).');
        let r;
        try { r = Logic.parseClause(st.r); } catch (e) { return fail(e.message); }
        const options = Logic.resolvents(ca, cb);
        if (!options.length) return fail(`Las cláusulas ${ia} y ${ib} no tienen ningún par de literales complementarios.`);
        if (!options.some((o) => Logic.sameClause(o, r))) {
          return fail(options.length > 1
            ? 'Incorrecto. Recuerda que solo se elimina un par de literales complementarios en cada paso.'
            : 'Incorrecto: quita el par de literales complementarios y junta el resto de literales de las dos cláusulas.');
        }
        st.msgEl.className = 'msg';
        st.msgEl.textContent = '';
        st.inputEl.value = cs(r);
        st.inputEl.classList.add('is-ok');
        if (!r.length) empty = true;
        all.push(r);
      });
      if (!steps.length) feedback(step2Status, 'info', 'Añade algún paso de resolución.');
      else if (!allOk) feedback(step2Status, 'bad', 'Hay pasos incorrectos.');
      else if (empty) feedback(step2Status, 'ok', '¡Has llegado a la cláusula vacía! El razonamiento es válido.');
      else feedback(step2Status, 'info', 'Los pasos son correctos, pero aún no has llegado a la cláusula vacía □.');
    }

    function showSolution() {
      const found = Logic.findRefutation(base.map((b) => b.clause));
      if (!found) {
        feedback(step2Status, 'bad', 'No se puede llegar a la cláusula vacía: el razonamiento no es válido.');
        return;
      }
      if (steps.some((s) => s.a || s.b || s.r) && !confirm('Se sustituirán tus pasos por la solución. ¿Continuar?')) return;
      steps = found.map((s) => ({ a: String(s.a), b: String(s.b), r: cs(s.clause) }));
      renderSteps();
      checkStep2();
    }

    step2.append(
      h('h3', {}, 'Cláusulas'),
      baseEl,
      h('p', { class: 'muted small' }, 'Consejo: empieza por una cláusula de apoyo y usa cada resolvente en el paso siguiente.'),
      h('h3', { style: 'margin-top:16px' }, 'Pasos de resolución'),
      symbolBar(['□']),
      stepsEl,
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn', onclick: addStep }, '+ Añadir paso'),
        h('button', { class: 'btn primary', onclick: checkStep2 }, 'Comprobar'),
        h('button', { class: 'btn', onclick: showSolution }, 'Ver solución')),
      step2Status);

    const val = Logic.validity(premises, conclusion);

    return [
      panel('Demuestra por resolución',
        statement(ex.premises, ex.conclusion),
        val.valid ? null : h('div', { class: 'feedback bad' },
          `Atención: este razonamiento no es válido (falla con ${Logic.describeValuation(val.counter)}), así que no se llegará a □.`),
        h('p', { class: 'muted small', style: 'margin-top:12px' },
          'Primero pasa cada premisa y la negación de la conclusión a forma clausal. Después resuelve cláusulas hasta obtener la cláusula vacía □.')),
      panel('1. Forma clausal',
        symbolBar(),
        srcRows.map((r) => r.el),
        h('div', { class: 'btn-row' }, h('button', { class: 'btn primary', onclick: checkStep1 }, 'Comprobar forma clausal')),
        step1Status),
      panel('2. Resolución', step2),
    ];
  }

  window.Views = window.Views || {};
  window.Views.resolucion = {
    title: 'Resolución',
    description: 'Pasa a forma clausal y busca la cláusula vacía para probar que un razonamiento es válido.',
    intro: 'Primero escribes la forma clausal de cada premisa y de la conclusión negada. Después aplicas la regla de resolución paso a paso hasta llegar a la cláusula vacía □.',
    exercises: () => Exercises.resolucion,
    listLabel: (ex) => [ex.premises.map(fmt).join(', '), ' ∴ ', fmt(ex.conclusion)].join(''),
    titleOf: (ex, i) => `Resolución ${i + 1}`,
    render,
    own: true,
  };
})();
