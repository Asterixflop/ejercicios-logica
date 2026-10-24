(function () {
  'use strict';
  const { h, panel, levelDots, exerciseHeader, ownReasoningForm, readOwn } = UI;
  const app = document.getElementById('app');
  const ORDER = ['formalizacion', 'deduccion', 'resolucion', 'tablas'];
  const MAX_ATOMS = 6;

  function home() {
    return [
      h('div', { class: 'hero' },
        h('h1', {}, 'Practica lógica con corrección automática'),
        h('p', {},
          'Ejercicios de lógica de enunciados: ',
          'formalización, deducción natural, resolución y tablas de verdad. Escribes tu respuesta y se corrige al momento, ',
          'paso a paso. Es libre, gratuito y no necesita registro.')),
      h('h2', { class: 'section-title' }, 'Lógica de enunciados'),
      h('div', { class: 'grid' }, ORDER.map((key) => {
        const v = Views[key];
        return h('a', { class: 'card', href: `#/${key}` },
          h('div', { class: 'panel-head' }, v.title),
          h('div', { class: 'card-body' }, v.description),
          h('div', { class: 'card-foot' },
            h('span', { class: 'btn small' }, `Ver ${v.exercises().length} ejercicios`)));
      })),
      h('h2', { class: 'section-title' }, 'Lógica de predicados'),
      h('div', { class: 'grid' },
        ['Formalización', 'Deducción natural', 'Resolución'].map((t) => h('div', { class: 'card disabled', 'aria-disabled': 'true' },
          h('div', { class: 'panel-head' }, t),
          h('div', { class: 'card-body' }, 'Próximamente.')))),
    ];
  }

  function list(key) {
    const v = Views[key];
    const exs = v.exercises();
    const groups = new Map();
    exs.forEach((ex, i) => {
      const g = v.groupOf ? v.groupOf(ex) : null;
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push(i);
    });
    return [
      h('div', { class: 'crumbs' }, h('a', { href: '#/' }, 'Inicio'), ' / ', v.title),
      h('h1', {}, v.title),
      h('p', { class: 'muted', style: 'max-width:75ch' }, v.intro),
      h('section', { class: 'panel' },
        h('div', { class: 'panel-head' }, `Ejercicios propuestos (${exs.length})`),
        [...groups].map(([g, idxs]) => [
          g ? h('div', { class: 'panel-sub' }, `${g} (${idxs.length})`) : null,
          h('ul', { class: 'ex-list' }, idxs.map((i) => h('li', {},
            h('a', { href: `#/${key}/${i + 1}` },
              h('span', { class: 'ex-num' }, `${i + 1}.`),
              h('span', { class: 'ex-text formula' }, v.listLabel(exs[i])),
              levelDots(exs[i].level))))),
        ])),
      v.own ? ownReasoningForm(key, { allowFormula: !!v.ownAllowsFormula }) : null,
    ];
  }

  function exercise(key, n) {
    const v = Views[key];
    const exs = v.exercises();
    const i = n - 1;
    if (!(i >= 0 && i < exs.length)) return notFound();
    return [
      ...exerciseHeader({ section: key, sectionTitle: v.title, index: i, total: exs.length, title: v.titleOf(exs[i], i), level: exs[i].level }),
      ...v.render(exs[i]),
    ];
  }

  function own(key, query) {
    const v = Views[key];
    if (!v.own) return notFound();
    const data = readOwn(query);
    const ex = v.fromOwn ? v.fromOwn(data) : data;
    const header = exerciseHeader({ section: key, sectionTitle: v.title, title: `${v.title}: ejercicio propio` });
    try {
      const fs = [...data.premises, data.conclusion].map(Logic.parse);
      if (Logic.atoms(fs).length > MAX_ATOMS) {
        throw new Error(`Usa como máximo ${MAX_ATOMS} átomos distintos.`);
      }
    } catch (e) {
      return [...header, panel(null, h('div', { class: 'feedback bad' }, e.message), h('a', { class: 'btn', href: `#/${key}` }, 'Volver'))];
    }
    return [...header, ...v.render(ex)];
  }

  function help() {
    const ruleRows = [...Deduction.BASIC_RULES, ...Deduction.DERIVED_RULES].map((r) => {
      const info = Deduction.RULE_HELP[r];
      return h('tr', {}, h('td', {}, r), h('td', {}, info.name), h('td', { class: 'schema' }, info.schema), h('td', {}, info.refs));
    });
    return [
      h('div', { class: 'crumbs' }, h('a', { href: '#/' }, 'Inicio'), ' / Reglas y ayuda'),
      h('h1', {}, 'Reglas y ayuda'),
      panel('Cómo escribir fórmulas',
        h('p', {}, 'Los átomos son letras mayúsculas (P, Q, R…, también P1, P2…). Puedes usar los botones de símbolos o teclear:'),
        h('div', { class: 'table-scroll' }, h('table', { class: 'rules' },
          h('thead', {}, h('tr', {}, h('th', {}, 'Símbolo'), h('th', {}, 'Nombre'), h('th', {}, 'Puedes teclear'))),
          h('tbody', {},
            [['¬', 'Negación', '~  o  !'], ['∧', 'Conjunción', '&  o  ^'], ['∨', 'Disyunción', 'v  o  |'],
              ['→', 'Condicional', '->'], ['↔', 'Bicondicional', '<->']]
              .map(([s, n, k]) => h('tr', {}, h('td', {}, s), h('td', {}, n), h('td', { class: 'schema' }, k)))))),
        h('p', { style: 'margin-top:12px' },
          'Orden de prioridad, de más fuerte a más débil: ¬, ∧, ∨, →, ↔. Así, ', h('span', { class: 'formula' }, 'P ∧ Q → R'),
          ' se lee ', h('span', { class: 'formula' }, '(P ∧ Q) → R'), '. Ante la duda, usa paréntesis.')),
      panel('Reglas de la deducción natural',
        h('div', { class: 'table-scroll' }, h('table', { class: 'rules' },
          h('thead', {}, h('tr', {}, h('th', {}, 'Regla'), h('th', {}, 'Nombre'), h('th', {}, 'Esquema'), h('th', {}, 'Referencias'))),
          h('tbody', {}, ruleRows))),
        h('p', { style: 'margin-top:12px' },
          'Una hipótesis (H) abre un nuevo nivel. Solo se cierra con I→ o I¬, y entonces las líneas de dentro dejan de ser accesibles. ',
          'Las referencias se escriben separadas por comas (1, 3) y los rangos de hipótesis con guion (3-6). ',
          'Las reglas derivadas (MT y SD) solo se aceptan si activas la casilla en el ejercicio.')),
      panel('Resolución',
        h('ol', {},
          h('li', {}, 'Niega la conclusión.'),
          h('li', {}, 'Pasa cada premisa y la conclusión negada a forma normal conjuntiva: elimina ↔ y →, lleva las negaciones a los átomos (De Morgan) y distribuye ∨ sobre ∧.'),
          h('li', {}, 'Cada conjunción da una cláusula. Escríbelas separadas por comas: ', h('span', { class: 'formula' }, '¬P ∨ Q, R'), '.'),
          h('li', {}, 'Resuelve pares de cláusulas que tengan un literal y su negación: se elimina ese par y se juntan los demás literales.'),
          h('li', {}, 'Si llegas a la cláusula vacía □, el razonamiento es válido.'))),
      panel('Tablas de verdad',
        h('p', {}, 'Una fórmula es tautología si es V en todas las filas, contradicción si es F en todas, y contingente en otro caso. ',
          'Un razonamiento es válido si en ninguna fila las premisas son todas V y la conclusión F.')),
    ];
  }

  function notFound() {
    return [h('h1', {}, 'Página no encontrada'), h('p', {}, h('a', { href: '#/' }, 'Volver al inicio'))];
  }

  function route() {
    const raw = location.hash.replace(/^#\/?/, '');
    const [path, qs] = raw.split('?');
    const parts = path.split('/').filter(Boolean);
    const query = new URLSearchParams(qs || '');
    let view;
    if (!parts.length) view = home();
    else if (parts[0] === 'ayuda') view = help();
    else if (ORDER.includes(parts[0])) {
      if (parts.length === 1) view = list(parts[0]);
      else if (parts[1] === 'propio') view = own(parts[0], query);
      else view = exercise(parts[0], parseInt(parts[1], 10));
    } else view = notFound();

    app.replaceChildren(...view.filter(Boolean));
    document.querySelectorAll('#nav a').forEach((a) => a.classList.toggle('active', a.dataset.route === (parts[0] || '')));
    const h1 = app.querySelector('h1');
    document.title = h1 && parts.length ? `${h1.firstChild.textContent.trim()} · Lógica Libre` : 'Lógica Libre';
    window.scrollTo(0, 0);
  }

  window.addEventListener('hashchange', route);
  route();
})();
