/* Pruebas del núcleo lógico: node tests/run.js */
'use strict';
const assert = require('assert');
const Logic = require('../js/logic.js');
globalThis.Logic = Logic;
const Deduction = require('../js/deduction.js');
const Ex = require('../js/exercises.js');

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; } catch (e) { console.error(`✗ ${name}\n  ${e.message}`); process.exitCode = 1; }
}

const P = Logic.parse;
const S = (s) => Logic.toString(P(s));

/* ---- Análisis ---- */
test('precedencia', () => {
  assert.strictEqual(S('P & Q -> R'), '(P ∧ Q) → R');
  assert.strictEqual(S('P -> Q -> R'), 'P → (Q → R)');
  assert.strictEqual(S('~P v Q <-> R'), '(¬P ∨ Q) ↔ R');
  assert.strictEqual(S('¬(P∨Q)'), '¬(P ∨ Q)');
  assert.strictEqual(S('P ∨ Q ∧ R'), 'P ∨ (Q ∧ R)');
});
test('errores de sintaxis', () => {
  for (const bad of ['', 'P ∧', '(P', 'P)', 'p', 'P Q', '∧P']) {
    assert.throws(() => P(bad), Logic.LogicError, bad);
  }
});
test('equivalencias', () => {
  assert.ok(Logic.equivalent(P('P → Q'), P('¬P ∨ Q')).ok);
  assert.ok(!Logic.equivalent(P('P → Q'), P('Q → P')).ok);
  assert.strictEqual(Logic.classify(P('P ∨ ¬P')), 'tautologia');
  assert.strictEqual(Logic.classify(P('P ∧ ¬P')), 'contradiccion');
});

/* ---- Cláusulas ---- */
test('FNC', () => {
  const c = Logic.toClauses(P('P ↔ Q')).map(Logic.clauseToString).sort();
  assert.deepStrictEqual(c, ['P ∨ ¬Q', '¬P ∨ Q']);
  assert.deepStrictEqual(Logic.parseClauses('¬P ∨ Q, R').map(Logic.clauseToString), ['¬P ∨ Q', 'R']);
  assert.throws(() => Logic.parseClauses('P → Q'));
  assert.ok(Logic.clausesEquivalent(Logic.parseClauses('¬P ∨ Q'), P('P → Q')).ok);
});
test('resolventes', () => {
  const r = Logic.resolvents(Logic.parseClause('¬P ∨ Q'), Logic.parseClause('P ∨ R'));
  assert.deepStrictEqual(r.map(Logic.clauseToString), ['Q ∨ R']);
});

/* ---- Ejercicios ---- */
Ex.formalizacion.forEach((ex, i) => test(`formalización ${i + 1}`, () => {
  for (const s of ex.sentences) {
    const f = P(s.answer);
    Logic.atoms(f).forEach((a) => assert.ok(a in ex.atoms, `átomo ${a} fuera del diccionario`));
  }
}));

Ex.tablas.forEach((ex, i) => test(`tabla ${i + 1}`, () => {
  if (ex.formula) P(ex.formula);
  else ex.premises.concat(ex.conclusion).forEach(P);
}));

Ex.resolucion.forEach((ex, i) => test(`resolución ${i + 1}`, () => {
  const prem = ex.premises.map(P);
  const neg = Logic.not(P(ex.conclusion));
  assert.ok(Logic.validity(prem, P(ex.conclusion)).valid, 'el razonamiento no es válido');
  const clauses = [...prem, neg].flatMap(Logic.toClauses);
  assert.ok(Logic.findRefutation(clauses), 'no se encuentra refutación');
}));

Ex.deduccion.forEach((ex, i) => test(`deducción ${i + 1}: ${ex.premises.join(', ')} ⊢ ${ex.conclusion}`, () => {
  const problem = { premises: ex.premises.map(P), conclusion: P(ex.conclusion), derived: false };
  assert.ok(Logic.validity(problem.premises, problem.conclusion).valid, 'no es válido');
  const lines = ex.solution.map(([formula, rule, refs]) => ({ formula, rule, refs }));
  const res = Deduction.checkProof(lines, problem);
  const errs = res.lines.map((l, k) => (l.ok ? null : `${k + 1}: ${l.msg}`)).filter(Boolean);
  assert.ok(res.complete, `${res.msg}\n  ${errs.join('\n  ')}`);
}));

/* ---- El corrector rechaza errores típicos ---- */
const prob = (prem, concl, derived = false) => ({ premises: prem.map(P), conclusion: P(concl), derived });
const L = (arr) => arr.map(([formula, rule, refs]) => ({ formula, rule, refs: refs || '' }));

test('rechaza E→ al revés (falacia)', () => {
  const r = Deduction.checkProof(L([['P → Q', 'P'], ['Q', 'P'], ['P', 'E→', '1, 2']]), prob(['P → Q', 'Q'], 'P'));
  assert.ok(!r.lines[2].ok);
});
test('rechaza usar líneas de una hipótesis cerrada', () => {
  const r = Deduction.checkProof(L([['P', 'P'], ['Q', 'H'], ['P', 'It', '1'], ['Q → P', 'I→', '2-3'], ['Q', 'It', '2']]), prob(['P'], 'Q'));
  assert.ok(r.lines.slice(0, 4).every((l) => l.ok));
  assert.ok(!r.lines[4].ok);
});
test('rechaza hipótesis sin cerrar', () => {
  const r = Deduction.checkProof(L([['P', 'P'], ['Q', 'H'], ['P', 'It', '1']]), prob(['P'], 'P'));
  assert.ok(!r.complete && r.depths[2] === 1);
});
test('rechaza premisa inventada', () => {
  const r = Deduction.checkProof(L([['R', 'P']]), prob(['P'], 'R'));
  assert.ok(!r.lines[0].ok);
});
test('rechaza rango que no empieza en la hipótesis', () => {
  const r = Deduction.checkProof(L([['P', 'P'], ['Q', 'H'], ['P', 'It', '1'], ['Q → P', 'I→', '1-3']]), prob(['P'], 'Q → P'));
  assert.ok(!r.lines[3].ok);
});
test('rechaza I¬ sin contradicción', () => {
  const r = Deduction.checkProof(L([['P', 'P'], ['Q', 'H'], ['P', 'It', '1'], ['¬Q', 'I¬', '2-3']]), prob(['P'], '¬Q'));
  assert.ok(!r.lines[3].ok);
});
test('reglas derivadas solo si se permiten', () => {
  const lines = L([['P → Q', 'P'], ['¬Q', 'P'], ['¬P', 'MT', '1, 2']]);
  assert.ok(!Deduction.checkProof(lines, prob(['P → Q', '¬Q'], '¬P')).complete);
  assert.ok(Deduction.checkProof(lines, prob(['P → Q', '¬Q'], '¬P', true)).complete);
});
test('referencias', () => {
  assert.deepStrictEqual(Deduction.parseRefs('2 - 5'), [{ from: 2, to: 5, range: true }]);
  assert.deepStrictEqual(Deduction.parseRefs('1,3').map((r) => r.from), [1, 3]);
  assert.deepStrictEqual(Deduction.parseRefs('1 3').map((r) => r.from), [1, 3]);
});

console.log(`${passed} pruebas superadas${process.exitCode ? ', con errores' : ''}.`);
