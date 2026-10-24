/*
 * Corrector de demostraciones por deducción natural (estilo Fitch).
 *
 * Cada línea es { formula, rule, refs }. La profundidad de cada línea se
 * deduce de las reglas: «H» abre una hipótesis e «I→» / «I¬» cierran la
 * hipótesis abierta más interna.
 */
(function (root) {
  'use strict';

  const Logic = root.Logic || (typeof require !== 'undefined' ? require('./logic.js') : null);
  const { parse, equals, toString } = Logic;

  const BASIC_RULES = ['P', 'H', 'It', 'I∧', 'E∧', 'I∨', 'E∨', 'I→', 'E→', 'I¬', 'E¬', 'I↔', 'E↔'];
  const DERIVED_RULES = ['MT', 'SD'];

  const RULE_HELP = {
    'P': { name: 'Premisa', schema: 'Escribe una de las premisas del razonamiento.', refs: 'ninguna' },
    'H': { name: 'Hipótesis', schema: 'Supón cualquier fórmula. Abre un nuevo nivel que se cierra con I→ o I¬.', refs: 'ninguna' },
    'It': { name: 'Iteración', schema: 'A  ⟹  A (repite una fórmula accesible)', refs: 'n' },
    'I∧': { name: 'Introducción de la conjunción', schema: 'A, B  ⟹  A ∧ B', refs: 'n, m' },
    'E∧': { name: 'Eliminación de la conjunción', schema: 'A ∧ B  ⟹  A   (o B)', refs: 'n' },
    'I∨': { name: 'Introducción de la disyunción', schema: 'A  ⟹  A ∨ B   (o B ∨ A)', refs: 'n' },
    'E∨': { name: 'Eliminación de la disyunción', schema: 'A ∨ B, A → C, B → C  ⟹  C', refs: 'n, m, k' },
    'I→': { name: 'Introducción del condicional', schema: '[H: A … B]  ⟹  A → B', refs: 'h-k (hipótesis y última línea)' },
    'E→': { name: 'Eliminación del condicional (modus ponens)', schema: 'A → B, A  ⟹  B', refs: 'n, m' },
    'I¬': { name: 'Introducción de la negación (reducción al absurdo)', schema: '[H: A … B … ¬B]  ⟹  ¬A', refs: 'h-k (hipótesis y última línea)' },
    'E¬': { name: 'Eliminación de la negación', schema: '¬¬A  ⟹  A', refs: 'n' },
    'I↔': { name: 'Introducción del bicondicional', schema: 'A → B, B → A  ⟹  A ↔ B', refs: 'n, m' },
    'E↔': { name: 'Eliminación del bicondicional', schema: 'A ↔ B  ⟹  A → B   (o B → A)', refs: 'n' },
    'MT': { name: 'Modus tollens (derivada)', schema: 'A → B, ¬B  ⟹  ¬A', refs: 'n, m' },
    'SD': { name: 'Silogismo disyuntivo (derivada)', schema: 'A ∨ B, ¬A  ⟹  B', refs: 'n, m' },
  };

  /* «1, 3», «2-5», «2 - 5» → [{from, to}] */
  function parseRefs(src) {
    const s = (src || '').trim();
    if (!s) return [];
    const out = [];
    for (const part of s.replace(/\s*[-–]\s*/g, '-').split(/[\s,;]+/)) {
      if (!part) continue;
      const m = part.match(/^(\d+)\s*(?:[-–]\s*(\d+))?$/);
      if (!m) throw new Error(`Referencia no válida: «${part}». Usa números separados por comas o un rango como 3-5.`);
      out.push({ from: +m[1], to: m[2] ? +m[2] : +m[1], range: !!m[2] });
    }
    return out;
  }

  const isPrefix = (a, b) => a.length <= b.length && a.every((x, i) => x === b[i]);

  /* Calcula pila de hipótesis abiertas y profundidad de cada línea. */
  function layout(lines) {
    let stack = [];
    return lines.map((line, k) => {
      const before = stack;
      let error = null;
      if (line.rule === 'H') stack = [...stack, k];
      else if (line.rule === 'I→' || line.rule === 'I¬') {
        if (stack.length === 0) error = 'No hay ninguna hipótesis abierta que cerrar.';
        else stack = stack.slice(0, -1);
      }
      return { stack, before, depth: stack.length, error };
    });
  }

  function checkProof(rawLines, problem) {
    const { premises, conclusion, derived } = problem;
    const allowed = derived ? [...BASIC_RULES, ...DERIVED_RULES] : BASIC_RULES;
    const lay = layout(rawLines);
    const formulas = [];
    let seenNonPremise = false;

    const results = rawLines.map((line, k) => {
      const n = k + 1;
      const { stack, before } = lay[k];
      const fail = (msg) => { formulas[k] = formulas[k] || null; return { ok: false, msg, depth: lay[k].depth }; };

      let F;
      try { F = parse(line.formula); } catch (e) { formulas[k] = null; return fail(e.message); }
      formulas[k] = F;

      const rule = line.rule;
      if (!rule) return fail('Elige la regla que justifica esta línea.');
      if (!allowed.includes(rule)) {
        return fail(DERIVED_RULES.includes(rule) ? `La regla ${rule} es derivada y no está permitida en este ejercicio.` : `Regla desconocida: ${rule}.`);
      }
      if (lay[k].error) return fail(lay[k].error);

      let refs;
      try { refs = parseRefs(line.refs); } catch (e) { return fail(e.message); }
      for (const r of refs) {
        if (r.from < 1 || r.to < 1) return fail('Las líneas se numeran desde 1.');
        if (r.from >= n || r.to >= n) return fail(`Solo puedes referirte a líneas anteriores a la ${n}.`);
        if (r.to < r.from) return fail(`El rango ${r.from}-${r.to} está al revés.`);
      }

      if (rule !== 'P') seenNonPremise = true;

      /* Comprueba que la línea j (1-based) sea accesible desde una pila dada. */
      const getAccessible = (j, fromStack) => {
        const idx = j - 1;
        if (!formulas[idx]) return { error: `La línea ${j} tiene un error; corrígela primero.` };
        if (!isPrefix(lay[idx].stack, fromStack)) {
          return { error: `La línea ${j} está dentro de una hipótesis ya cerrada y no es accesible desde aquí.` };
        }
        return { f: formulas[idx] };
      };

      const singles = () => {
        if (refs.some((r) => r.range)) return { error: `La regla ${rule} no usa rangos; escribe líneas sueltas separadas por comas.` };
        const fs = [];
        for (const r of refs) {
          const a = getAccessible(r.from, stack);
          if (a.error) return a;
          fs.push(a.f);
        }
        return { fs };
      };
      const need = (count) => {
        if (refs.length !== count) {
          return { error: `La regla ${rule} necesita ${count === 1 ? 'una referencia' : count + ' referencias'}.` };
        }
        return singles();
      };

      /* Prueba todas las ordenaciones de las referencias. */
      const anyOrder = (fs, test) => {
        const perms = (arr) => (arr.length <= 1 ? [arr] : arr.flatMap((x, i) => perms([...arr.slice(0, i), ...arr.slice(i + 1)]).map((p) => [x, ...p])));
        return perms(fs).some((p) => test(...p));
      };

      const wrong = (msg) => fail(msg);
      const okRes = { ok: true, depth: lay[k].depth };

      switch (rule) {
        case 'P': {
          if (refs.length) return fail('Una premisa no lleva referencias.');
          if (seenNonPremise) return fail('Las premisas se escriben al principio, antes que el resto de líneas.');
          if (!premises.some((p) => equals(p, F))) return fail(`«${toString(F)}» no es ninguna de las premisas.`);
          return okRes;
        }
        case 'H': {
          if (refs.length) return fail('Una hipótesis no lleva referencias.');
          return okRes;
        }
        case 'It': {
          const r = need(1); if (r.error) return fail(r.error);
          return equals(r.fs[0], F) ? okRes : wrong('La iteración debe repetir exactamente la fórmula referenciada.');
        }
        case 'I∧': {
          const r = singles(); if (r.error) return fail(r.error);
          if (F.type !== 'and') return wrong('Con I∧ debes obtener una conjunción.');
          if (refs.length === 1) return equals(F.l, r.fs[0]) && equals(F.r, r.fs[0]) ? okRes : wrong('Con una sola referencia solo puedes obtener A ∧ A.');
          if (refs.length !== 2) return fail('La regla I∧ necesita 2 referencias.');
          return anyOrder(r.fs, (a, b) => equals(F.l, a) && equals(F.r, b)) ? okRes
            : wrong('Los miembros de la conjunción no coinciden con las líneas referenciadas.');
        }
        case 'E∧': {
          const r = need(1); if (r.error) return fail(r.error);
          const A = r.fs[0];
          if (A.type !== 'and') return wrong(`La línea ${refs[0].from} no es una conjunción.`);
          return equals(F, A.l) || equals(F, A.r) ? okRes : wrong('Debes escribir uno de los dos miembros de la conjunción.');
        }
        case 'I∨': {
          const r = need(1); if (r.error) return fail(r.error);
          if (F.type !== 'or') return wrong('Con I∨ debes obtener una disyunción.');
          return equals(F.l, r.fs[0]) || equals(F.r, r.fs[0]) ? okRes
            : wrong('Uno de los miembros de la disyunción debe ser la fórmula referenciada.');
        }
        case 'E∨': {
          const r = need(3); if (r.error) return fail(r.error);
          return anyOrder(r.fs, (d, i1, i2) =>
            d.type === 'or' && i1.type === 'imp' && i2.type === 'imp' &&
            equals(i1.l, d.l) && equals(i2.l, d.r) && equals(i1.r, F) && equals(i2.r, F)) ? okRes
            : wrong('E∨ necesita A ∨ B, A → C y B → C, y la línea debe ser C.');
        }
        case 'E→': {
          const r = need(2); if (r.error) return fail(r.error);
          return anyOrder(r.fs, (i, a) => i.type === 'imp' && equals(i.l, a) && equals(i.r, F)) ? okRes
            : wrong('E→ necesita A → B y A, y la línea debe ser B.');
        }
        case 'I→':
        case 'I¬': {
          const h = before[before.length - 1]; // índice 0-based de la hipótesis que se cierra
          const hLine = h + 1;
          let points = [];
          refs.forEach((x) => { points.push(x.from); if (x.range) points.push(x.to); });
          if (!points.length) return fail(`Indica el rango de la hipótesis que cierras, por ejemplo ${hLine}-${n - 1}.`);
          if (points[0] !== hLine) {
            return fail(`La hipótesis abierta más interna está en la línea ${hLine}; el rango debe empezar ahí (${hLine}-${n - 1}).`);
          }
          const A = formulas[h];
          if (!A) return fail(`La línea ${hLine} tiene un error; corrígela primero.`);
          const inSub = (j) => j >= hLine && j <= n - 1;
          for (const j of points) if (!inSub(j)) return fail(`La línea ${j} no está dentro de la hipótesis que empieza en la ${hLine}.`);

          if (rule === 'I→') {
            if (points.length > 2) return fail('I→ se justifica con el rango de la hipótesis, por ejemplo h-k.');
            const last = points[points.length - 1];
            const b = getAccessible(last, before); if (b.error) return fail(b.error);
            if (F.type !== 'imp') return wrong('Con I→ debes obtener un condicional.');
            return equals(F.l, A) && equals(F.r, b.f) ? okRes
              : wrong(`Debería ser ${toString(Logic.bin('imp', A, b.f))}: la hipótesis implica la última línea referenciada.`);
          }

          // I¬
          if (F.type !== 'not' || !equals(F.a, A)) return wrong(`Con I¬ sobre la hipótesis ${toString(A)} debes obtener ${toString(Logic.not(A))}.`);
          let candidates;
          if (points.length === 3) candidates = points.slice(1);
          else if (points.length <= 2) {
            const end = points[points.length - 1];
            candidates = [];
            for (let j = hLine; j <= end; j++) candidates.push(j);
          } else return fail('I¬ se justifica con el rango de la hipótesis (h-k) o con h, i, j.');
          const fs = [];
          for (const j of candidates) {
            const a = getAccessible(j, before);
            if (a.error) { if (points.length === 3) return fail(a.error); continue; }
            fs.push(a.f);
          }
          const contradiction = fs.some((x) => fs.some((y) => y.type === 'not' && equals(y.a, x)));
          return contradiction ? okRes : wrong('Dentro de la hipótesis no hay una fórmula y su negación (B y ¬B).');
        }
        case 'E¬': {
          const r = need(1); if (r.error) return fail(r.error);
          const A = r.fs[0];
          if (A.type !== 'not' || A.a.type !== 'not') return wrong(`La línea ${refs[0].from} no es una doble negación ¬¬A.`);
          return equals(A.a.a, F) ? okRes : wrong(`De ${toString(A)} se obtiene ${toString(A.a.a)}.`);
        }
        case 'I↔': {
          const r = need(2); if (r.error) return fail(r.error);
          if (F.type !== 'iff') return wrong('Con I↔ debes obtener un bicondicional.');
          return anyOrder(r.fs, (a, b) => a.type === 'imp' && b.type === 'imp' &&
            equals(a.l, F.l) && equals(a.r, F.r) && equals(b.l, F.r) && equals(b.r, F.l)) ? okRes
            : wrong('I↔ necesita A → B y B → A, y la línea debe ser A ↔ B.');
        }
        case 'E↔': {
          const r = need(1); if (r.error) return fail(r.error);
          const A = r.fs[0];
          if (A.type !== 'iff') return wrong(`La línea ${refs[0].from} no es un bicondicional.`);
          const ok = F.type === 'imp' && ((equals(F.l, A.l) && equals(F.r, A.r)) || (equals(F.l, A.r) && equals(F.r, A.l)));
          return ok ? okRes : wrong('De A ↔ B se obtiene A → B o B → A.');
        }
        case 'MT': {
          const r = need(2); if (r.error) return fail(r.error);
          return anyOrder(r.fs, (i, nb) => i.type === 'imp' && nb.type === 'not' && equals(nb.a, i.r) && F.type === 'not' && equals(F.a, i.l)) ? okRes
            : wrong('MT necesita A → B y ¬B, y la línea debe ser ¬A.');
        }
        case 'SD': {
          const r = need(2); if (r.error) return fail(r.error);
          return anyOrder(r.fs, (d, na) => d.type === 'or' && na.type === 'not' &&
            ((equals(na.a, d.l) && equals(F, d.r)) || (equals(na.a, d.r) && equals(F, d.l)))) ? okRes
            : wrong('SD necesita A ∨ B y ¬A, y la línea debe ser B.');
        }
      }
      return fail('Regla no reconocida.');
    });

    const allOk = results.length > 0 && results.every((r) => r.ok);
    const last = rawLines.length - 1;
    let status;
    if (!rawLines.length) status = { complete: false, msg: 'Añade líneas a la demostración.' };
    else if (!allOk) status = { complete: false, msg: `Hay ${results.filter((r) => !r.ok).length} línea(s) con errores.` };
    else if (lay[last].depth > 0) status = { complete: false, msg: 'Todas las líneas son correctas, pero quedan hipótesis sin cerrar.' };
    else if (!equals(formulas[last], conclusion)) status = { complete: false, msg: 'Todas las líneas son correctas, pero la última no es la conclusión.' };
    else status = { complete: true, msg: '¡Demostración correcta y completa!' };

    return { lines: results, depths: lay.map((l) => l.depth), ...status };
  }

  const Deduction = { BASIC_RULES, DERIVED_RULES, RULE_HELP, parseRefs, layout, checkProof };

  if (typeof module !== 'undefined' && module.exports) module.exports = Deduction;
  else root.Deduction = Deduction;
})(typeof window !== 'undefined' ? window : globalThis);
