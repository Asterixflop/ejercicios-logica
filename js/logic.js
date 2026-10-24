/*
 * Núcleo de lógica de enunciados: análisis de fórmulas, evaluación,
 * tablas de verdad, forma normal conjuntiva y resolución.
 * Funciona en el navegador (window.Logic) y en Node (require).
 */
(function (root) {
  'use strict';

  const SYM = { not: '¬', and: '∧', or: '∨', imp: '→', iff: '↔' };

  class LogicError extends Error {
    constructor(message, pos) {
      super(message);
      this.pos = pos;
    }
  }

  /* ---------- Constructores ---------- */

  const atom = (name) => ({ type: 'atom', name });
  const not = (a) => ({ type: 'not', a });
  const bin = (type, l, r) => ({ type, l, r });

  /* ---------- Análisis léxico y sintáctico ---------- */

  const TOKEN_RULES = [
    [/^(<->|<=>|↔|≡)/, 'iff'],
    [/^(->|=>|→|⊃)/, 'imp'],
    [/^(&&|&|∧|\^)/, 'and'],
    [/^(\|\||\||∨|v)/, 'or'],
    [/^(¬|~|!|-)/, 'not'],
    [/^[([]/, 'lparen'],
    [/^[)\]]/, 'rparen'],
    [/^[A-Z][0-9']*/, 'atom'],
  ];

  function tokenize(src) {
    const tokens = [];
    let i = 0;
    while (i < src.length) {
      if (/\s/.test(src[i])) { i++; continue; }
      const rest = src.slice(i);
      let matched = false;
      for (const [re, t] of TOKEN_RULES) {
        const m = rest.match(re);
        if (m) {
          tokens.push({ t, v: m[0], pos: i });
          i += m[0].length;
          matched = true;
          break;
        }
      }
      if (!matched) {
        if (/[a-z]/.test(src[i])) {
          throw new LogicError(`Los átomos se escriben en mayúscula: usa «${src[i].toUpperCase()}» en lugar de «${src[i]}».`, i);
        }
        throw new LogicError(`Símbolo no reconocido: «${src[i]}».`, i);
      }
    }
    return tokens;
  }

  /*
   * Precedencia (de más a menos fuerte): ¬, ∧, ∨, →, ↔.
   * → asocia por la derecha; ∧, ∨ y ↔ por la izquierda.
   */
  function parse(src) {
    if (typeof src !== 'string' || !src.trim()) throw new LogicError('Escribe una fórmula.', 0);
    const tokens = tokenize(src);
    let p = 0;
    const peek = () => tokens[p];
    const eat = (t) => (tokens[p] && tokens[p].t === t ? tokens[p++] : null);

    function parseIff() {
      let l = parseImp();
      while (eat('iff')) l = bin('iff', l, parseImp());
      return l;
    }
    function parseImp() {
      const l = parseOr();
      if (eat('imp')) return bin('imp', l, parseImp());
      return l;
    }
    function parseOr() {
      let l = parseAnd();
      while (eat('or')) l = bin('or', l, parseAnd());
      return l;
    }
    function parseAnd() {
      let l = parseUnary();
      while (eat('and')) l = bin('and', l, parseUnary());
      return l;
    }
    function parseUnary() {
      const tok = peek();
      if (!tok) throw new LogicError('La fórmula está incompleta.', src.length);
      if (eat('not')) return not(parseUnary());
      if (eat('lparen')) {
        const f = parseIff();
        if (!eat('rparen')) throw new LogicError('Falta cerrar un paréntesis.', peek() ? peek().pos : src.length);
        return f;
      }
      if (tok.t === 'atom') { p++; return atom(tok.v); }
      throw new LogicError(`No esperaba «${tok.v}» en esta posición.`, tok.pos);
    }

    const f = parseIff();
    if (p < tokens.length) {
      const tok = tokens[p];
      throw new LogicError(
        tok.t === 'rparen' ? 'Sobra un paréntesis de cierre.' : `No esperaba «${tok.v}» en esta posición.`,
        tok.pos
      );
    }
    return f;
  }

  function tryParse(src) {
    try { return { ok: true, f: parse(src) }; } catch (e) { return { ok: false, error: e.message }; }
  }

  /* ---------- Utilidades sobre fórmulas ---------- */

  function toString(f, top = true) {
    switch (f.type) {
      case 'atom': return f.name;
      case 'not': return SYM.not + toString(f.a, false);
      default: {
        const s = `${toString(f.l, false)} ${SYM[f.type]} ${toString(f.r, false)}`;
        return top ? s : `(${s})`;
      }
    }
  }

  function equals(a, b) {
    if (!a || !b || a.type !== b.type) return false;
    if (a.type === 'atom') return a.name === b.name;
    if (a.type === 'not') return equals(a.a, b.a);
    return equals(a.l, b.l) && equals(a.r, b.r);
  }

  function atoms(fs) {
    const set = new Set();
    const walk = (f) => {
      if (f.type === 'atom') set.add(f.name);
      else if (f.type === 'not') walk(f.a);
      else { walk(f.l); walk(f.r); }
    };
    (Array.isArray(fs) ? fs : [fs]).forEach(walk);
    return [...set].sort((x, y) => x.localeCompare(y, 'es', { numeric: true }));
  }

  function evaluate(f, v) {
    switch (f.type) {
      case 'atom': return !!v[f.name];
      case 'not': return !evaluate(f.a, v);
      case 'and': return evaluate(f.l, v) && evaluate(f.r, v);
      case 'or': return evaluate(f.l, v) || evaluate(f.r, v);
      case 'imp': return !evaluate(f.l, v) || evaluate(f.r, v);
      case 'iff': return evaluate(f.l, v) === evaluate(f.r, v);
    }
    throw new Error('Tipo de fórmula desconocido');
  }

  /* Interpretaciones en el orden habitual: la primera fila es todo V. */
  function valuations(names) {
    const rows = [];
    const n = names.length;
    for (let i = 0; i < 1 << n; i++) {
      const v = {};
      names.forEach((name, j) => { v[name] = ((i >> (n - 1 - j)) & 1) === 0; });
      rows.push(v);
    }
    return rows;
  }

  /* Subfórmulas no atómicas, sin repetir, de las más simples a las más complejas. */
  function subformulas(fs) {
    const seen = new Set();
    const out = [];
    const walk = (f) => {
      if (f.type === 'atom') return;
      if (f.type === 'not') walk(f.a);
      else { walk(f.l); walk(f.r); }
      const key = toString(f);
      if (!seen.has(key)) { seen.add(key); out.push(f); }
    };
    (Array.isArray(fs) ? fs : [fs]).forEach(walk);
    return out;
  }

  const tv = (b) => (b ? 'V' : 'F');

  function describeValuation(v) {
    return Object.keys(v).map((k) => `${k} = ${tv(v[k])}`).join(', ');
  }

  function equivalent(a, b) {
    const names = atoms([a, b]);
    for (const v of valuations(names)) {
      if (evaluate(a, v) !== evaluate(b, v)) return { ok: false, counter: v };
    }
    return { ok: true };
  }

  function validity(premises, conclusion) {
    const names = atoms([...premises, conclusion]);
    for (const v of valuations(names)) {
      if (premises.every((p) => evaluate(p, v)) && !evaluate(conclusion, v)) return { valid: false, counter: v };
    }
    return { valid: true };
  }

  function classify(f) {
    const vals = valuations(atoms(f)).map((v) => evaluate(f, v));
    if (vals.every(Boolean)) return 'tautologia';
    if (!vals.some(Boolean)) return 'contradiccion';
    return 'contingente';
  }

  /* ---------- Cláusulas y forma normal conjuntiva ---------- */

  const lit = (name, neg) => (neg ? SYM.not : '') + name;
  const complement = (l) => (l.startsWith(SYM.not) ? l.slice(1) : SYM.not + l);
  const litAtom = (l) => (l.startsWith(SYM.not) ? l.slice(1) : l);

  function normClause(lits) {
    return [...new Set(lits)].sort((a, b) => {
      const d = litAtom(a).localeCompare(litAtom(b), 'es', { numeric: true });
      return d !== 0 ? d : a.length - b.length;
    });
  }
  const clauseKey = (c) => normClause(c).join('|');
  const isTautological = (c) => c.some((l) => c.includes(complement(l)));
  const clauseToString = (c) => (c.length ? normClause(c).join(` ${SYM.or} `) : '□');
  const sameClause = (a, b) => clauseKey(a) === clauseKey(b);

  /* Forma normal negativa sin → ni ↔. */
  function nnf(f, neg = false) {
    switch (f.type) {
      case 'atom': return neg ? not(f) : f;
      case 'not': return nnf(f.a, !neg);
      case 'and': return neg ? bin('or', nnf(f.l, true), nnf(f.r, true)) : bin('and', nnf(f.l), nnf(f.r));
      case 'or': return neg ? bin('and', nnf(f.l, true), nnf(f.r, true)) : bin('or', nnf(f.l), nnf(f.r));
      case 'imp': return neg ? bin('and', nnf(f.l), nnf(f.r, true)) : bin('or', nnf(f.l, true), nnf(f.r));
      case 'iff': return neg
        ? bin('and', bin('or', nnf(f.l), nnf(f.r)), bin('or', nnf(f.l, true), nnf(f.r, true)))
        : bin('and', bin('or', nnf(f.l, true), nnf(f.r)), bin('or', nnf(f.l), nnf(f.r, true)));
    }
    throw new Error('Tipo de fórmula desconocido');
  }

  function clausesOfNnf(f) {
    switch (f.type) {
      case 'atom': return [[lit(f.name, false)]];
      case 'not': return [[lit(f.a.name, true)]];
      case 'and': return [...clausesOfNnf(f.l), ...clausesOfNnf(f.r)];
      case 'or': {
        const out = [];
        for (const a of clausesOfNnf(f.l)) for (const b of clausesOfNnf(f.r)) out.push([...a, ...b]);
        return out;
      }
    }
    throw new Error('Fórmula no está en forma normal negativa');
  }

  /* Quita cláusulas repetidas, tautológicas y subsumidas. */
  function simplifyClauses(clauses) {
    const uniq = [];
    const keys = new Set();
    for (const c of clauses.map(normClause)) {
      if (isTautological(c)) continue;
      const k = clauseKey(c);
      if (!keys.has(k)) { keys.add(k); uniq.push(c); }
    }
    return uniq.filter((c, i) => !uniq.some((d, j) => j !== i && d.length < c.length && d.every((l) => c.includes(l))));
  }

  function toClauses(f) {
    return simplifyClauses(clausesOfNnf(nnf(f)));
  }

  /* Lee un conjunto de cláusulas: «¬P ∨ Q, R» o «(¬P ∨ Q) ∧ R». */
  function parseClauses(src) {
    if (!src || !src.trim()) throw new LogicError('Escribe al menos una cláusula.', 0);
    const parts = src.split(/[,;]/).map((s) => s.trim());
    const out = [];
    for (const part of parts) {
      if (!part) throw new LogicError('Hay una cláusula vacía entre comas.', 0);
      if (part === '□' || part === '[]') { out.push([]); continue; }
      const f = parse(part);
      const conj = [];
      const flatAnd = (g) => (g.type === 'and' ? (flatAnd(g.l), flatAnd(g.r)) : conj.push(g));
      flatAnd(f);
      for (const c of conj) out.push(clauseFromFormula(c));
    }
    return out.map(normClause);
  }

  function clauseFromFormula(f) {
    const lits = [];
    const walk = (g) => {
      if (g.type === 'or') { walk(g.l); walk(g.r); }
      else if (g.type === 'atom') lits.push(lit(g.name, false));
      else if (g.type === 'not' && g.a.type === 'atom') lits.push(lit(g.a.name, true));
      else throw new LogicError(`«${toString(f)}» no es una cláusula (disyunción de literales).`, 0);
    };
    walk(f);
    return normClause(lits);
  }

  function parseClause(src) {
    const s = (src || '').trim();
    if (s === '□' || s === '[]' || s === '') return [];
    return clauseFromFormula(parse(s));
  }

  function evalClauses(clauses, v) {
    return clauses.every((c) => c.some((l) => (l.startsWith(SYM.not) ? !v[litAtom(l)] : !!v[l])));
  }

  function clausesEquivalent(clauses, f) {
    const names = atoms(f);
    clauses.forEach((c) => c.forEach((l) => { if (!names.includes(litAtom(l))) names.push(litAtom(l)); }));
    names.sort();
    for (const v of valuations(names)) {
      if (evalClauses(clauses, v) !== evaluate(f, v)) return { ok: false, counter: v };
    }
    return { ok: true };
  }

  /* Todas las resolventes posibles de dos cláusulas. */
  function resolvents(a, b) {
    const out = [];
    for (const l of a) {
      if (b.includes(complement(l))) {
        out.push(normClause([...a.filter((x) => x !== l), ...b.filter((x) => x !== complement(l))]));
      }
    }
    return out;
  }

  /*
   * Busca una refutación por saturación. Devuelve los pasos necesarios
   * (índices sobre la lista original + derivadas) o null.
   */
  function findRefutation(clauses, limit = 3000) {
    const list = clauses.map((c) => ({ c: normClause(c), parents: null }));
    const keys = new Set(list.map((x) => clauseKey(x.c)));
    let emptyIdx = list.findIndex((x) => x.c.length === 0);
    for (let i = 0; emptyIdx < 0 && i < list.length && list.length < limit; i++) {
      for (let j = 0; emptyIdx < 0 && j < i; j++) {
        for (const r of resolvents(list[j].c, list[i].c)) {
          if (isTautological(r)) continue;
          const k = clauseKey(r);
          if (keys.has(k)) continue;
          keys.add(k);
          list.push({ c: r, parents: [j, i] });
          if (r.length === 0) { emptyIdx = list.length - 1; break; }
        }
      }
    }
    if (emptyIdx < 0) return null;
    const needed = new Set();
    const mark = (i) => {
      if (needed.has(i) || !list[i].parents) return;
      needed.add(i);
      list[i].parents.forEach(mark);
    };
    mark(emptyIdx);
    const order = [...needed].sort((x, y) => x - y);
    const number = new Map();
    clauses.forEach((_, i) => number.set(i, i + 1));
    order.forEach((idx, n) => number.set(idx, clauses.length + n + 1));
    return order.map((idx) => ({
      a: number.get(list[idx].parents[0]),
      b: number.get(list[idx].parents[1]),
      clause: list[idx].c,
    }));
  }

  const Logic = {
    SYM, LogicError,
    atom, not, bin,
    tokenize, parse, tryParse, toString, equals, atoms, evaluate, valuations, subformulas,
    tv, describeValuation, equivalent, validity, classify,
    complement, normClause, clauseToString, sameClause, isTautological,
    nnf, toClauses, simplifyClauses, parseClauses, parseClause, clausesEquivalent, evalClauses,
    resolvents, findRefutation,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Logic;
  else root.Logic = Logic;
})(typeof window !== 'undefined' ? window : globalThis);
