(function () {
  'use strict';
  const { h, formulaInput, symbolBar, feedback, panel, fmt } = UI;

  function checkSentence(input, sentence, dict, fb) {
    const src = input.value.trim();
    input.classList.remove('is-ok', 'is-bad');
    let f;
    try { f = Logic.parse(src); } catch (e) {
      input.classList.add('is-bad');
      feedback(fb, 'bad', e.message);
      return false;
    }
    const unknown = Logic.atoms(f).filter((a) => !(a in dict));
    if (unknown.length) {
      input.classList.add('is-bad');
      feedback(fb, 'bad', `Usa solo los átomos del diccionario (${Object.keys(dict).join(', ')}). Sobra: ${unknown.join(', ')}.`);
      return false;
    }
    const expected = Logic.parse(sentence.answer);
    const eq = Logic.equivalent(f, expected);
    if (eq.ok) {
      input.value = fmt(f);
      input.classList.add('is-ok');
      const same = Logic.equals(f, expected);
      feedback(fb, 'ok', same ? '¡Correcto!' : `¡Correcto! Es equivalente a la formalización propuesta: ${fmt(expected)}`);
      return true;
    }
    input.classList.add('is-bad');
    const v = eq.counter;
    feedback(fb, 'bad',
      `No es equivalente. Por ejemplo, si ${Logic.describeValuation(v)}, tu fórmula es ${Logic.tv(Logic.evaluate(f, v))} ` +
      `pero el enunciado es ${Logic.tv(Logic.evaluate(expected, v))}.`);
    return false;
  }

  function render(ex) {
    const items = ex.sentences.map((s, i) => {
      const fb = h('div', { class: 'feedback' });
      const input = formulaInput({
        placeholder: 'Escribe la fórmula…',
        label: `Formalización de la frase ${i + 1}`,
        onkeydown: (e) => { if (e.key === 'Enter') checkSentence(input, s, ex.atoms, fb); },
      });
      const item = h('div', { class: 'sentence' },
        h('div', { class: 'sentence-text' }, h('strong', {}, `${i + 1}. `), s.text),
        h('div', { class: 'sentence-row' },
          input,
          h('button', { class: 'btn', onclick: () => checkSentence(input, s, ex.atoms, fb) }, 'Comprobar'),
          h('button', {
            class: 'btn small',
            onclick: () => feedback(fb, 'info', ['Solución: ', h('span', { class: 'formula' }, fmt(s.answer))]),
          }, 'Solución')),
        fb);
      return { item, check: () => checkSentence(input, s, ex.atoms, fb) };
    });

    const summary = h('div', { class: 'feedback' });
    const checkAll = () => {
      const n = items.filter((x) => x.check()).length;
      feedback(summary, n === items.length ? 'ok' : 'info', `${n} de ${items.length} frases correctas.`);
    };

    return [
      panel('Diccionario',
        h('p', { class: 'muted small' }, 'Formaliza cada frase usando solo estos átomos. Se acepta cualquier fórmula equivalente.'),
        h('dl', { class: 'dict' }, Object.entries(ex.atoms).flatMap(([k, v]) => [h('dt', {}, k), h('dd', {}, v)]))),
      panel('Frases',
        symbolBar(),
        items.map((x) => x.item),
        h('div', { class: 'btn-row' }, h('button', { class: 'btn primary', onclick: checkAll }, 'Comprobar todas')),
        summary),
    ];
  }

  window.Views = window.Views || {};
  window.Views.formalizacion = {
    title: 'Formalización',
    description: 'Traduce frases del lenguaje natural a fórmulas de la lógica de enunciados.',
    intro: 'Cada ejercicio tiene un diccionario de átomos y varias frases. Escribe la fórmula de cada una: se corrige comprobando que sea equivalente a la respuesta, así que no hace falta que coincida letra a letra.',
    exercises: () => Exercises.formalizacion,
    listLabel: (ex) => `${ex.title} — ${ex.sentences.length} frases`,
    titleOf: (ex, i) => `Formalización ${i + 1}: ${ex.title}`,
    render,
    own: false,
  };
})();
