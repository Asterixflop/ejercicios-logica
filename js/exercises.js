/*
 * Banco de ejercicios. Las fórmulas se escriben con los símbolos
 * ¬ ∧ ∨ → ↔ (también se aceptan ~ & | -> <->).
 */
(function (root) {
  'use strict';

  const formalizacion = [
    {
      title: 'Primeros pasos',
      level: 1,
      atoms: { P: 'llueve', Q: 'hace frío', R: 'voy al cine' },
      sentences: [
        { text: 'Llueve y hace frío.', answer: 'P ∧ Q' },
        { text: 'Si llueve, voy al cine.', answer: 'P → R' },
        { text: 'No llueve, pero hace frío.', answer: '¬P ∧ Q' },
        { text: 'Ni llueve ni hace frío.', answer: '¬P ∧ ¬Q' },
        { text: 'No es verdad que llueva y haga frío.', answer: '¬(P ∧ Q)' },
      ],
    },
    {
      title: 'Condiciones necesarias y suficientes',
      level: 1,
      atoms: { E: 'estudio', A: 'apruebo', T: 'tengo tiempo' },
      sentences: [
        { text: 'Es suficiente estudiar para aprobar.', answer: 'E → A' },
        { text: 'Es necesario estudiar para aprobar.', answer: 'A → E' },
        { text: 'Apruebo solo si estudio.', answer: 'A → E' },
        { text: 'Apruebo si estudio.', answer: 'E → A' },
        { text: 'Estudio si y solo si tengo tiempo.', answer: 'E ↔ T' },
      ],
    },
    {
      title: '«A menos que» y negaciones',
      level: 2,
      atoms: { E: 'estudio', A: 'apruebo', T: 'tengo tiempo' },
      sentences: [
        { text: 'No apruebo a menos que estudie.', answer: '¬A ∨ E' },
        { text: 'Si no tengo tiempo, ni estudio ni apruebo.', answer: '¬T → (¬E ∧ ¬A)' },
        { text: 'No es cierto que, si tengo tiempo, estudie.', answer: '¬(T → E)' },
        { text: 'Estudio cuando tengo tiempo, y solo entonces.', answer: 'E ↔ T' },
        { text: 'Tener tiempo no es suficiente para aprobar.', answer: '¬(T → A)' },
      ],
    },
    {
      title: 'El servidor',
      level: 2,
      atoms: { S: 'el servidor funciona', B: 'la base de datos responde', W: 'la web carga', A: 'hay un ataque' },
      sentences: [
        { text: 'La web carga si el servidor funciona y la base de datos responde.', answer: '(S ∧ B) → W' },
        { text: 'Si hay un ataque, el servidor no funciona.', answer: 'A → ¬S' },
        { text: 'La web carga solo si el servidor funciona.', answer: 'W → S' },
        { text: 'La base de datos responde siempre que el servidor funcione.', answer: 'S → B' },
        { text: 'O el servidor funciona o hay un ataque, pero no las dos cosas.', answer: '(S ∨ A) ∧ ¬(S ∧ A)' },
      ],
    },
    {
      title: 'Compilar y desplegar',
      level: 2,
      atoms: { C: 'compilo', E: 'hay errores', T: 'paso los tests', D: 'despliego' },
      sentences: [
        { text: 'Si compilo y no hay errores, paso los tests.', answer: '(C ∧ ¬E) → T' },
        { text: 'Solo despliego si paso los tests.', answer: 'D → T' },
        { text: 'No despliego a menos que compile.', answer: '¬D ∨ C' },
        { text: 'Si hay errores, ni paso los tests ni despliego.', answer: 'E → (¬T ∧ ¬D)' },
        { text: 'Paso los tests si y solo si no hay errores.', answer: 'T ↔ ¬E' },
      ],
    },
    {
      title: 'Quién viene a la fiesta',
      level: 3,
      atoms: { A: 'Ana viene', B: 'Berta viene', C: 'Carlos viene' },
      sentences: [
        { text: 'Al menos uno de los tres viene.', answer: 'A ∨ B ∨ C' },
        { text: 'Ana y Berta no vienen las dos.', answer: '¬(A ∧ B)' },
        { text: 'Si viene Carlos, también viene Ana o Berta.', answer: 'C → (A ∨ B)' },
        { text: 'Carlos viene únicamente si no viene Berta.', answer: 'C → ¬B' },
        { text: 'Viene exactamente una de las dos: Ana o Berta.', answer: '(A ∨ B) ∧ ¬(A ∧ B)' },
        { text: 'Ninguno de los tres viene.', answer: '¬A ∧ ¬B ∧ ¬C' },
      ],
    },
    {
      title: 'Formalizar un razonamiento',
      level: 3,
      atoms: { L: 'la luz está encendida', I: 'el interruptor está activado', K: 'hay corriente', B: 'la bombilla funciona' },
      sentences: [
        { text: 'La luz está encendida si y solo si el interruptor está activado, hay corriente y la bombilla funciona.', answer: 'L ↔ (I ∧ K ∧ B)' },
        { text: 'Cuando no hay corriente, la luz está apagada.', answer: '¬K → ¬L' },
        { text: 'La bombilla no funciona, a no ser que la luz esté encendida.', answer: '¬B ∨ L' },
        { text: 'El interruptor está activado y la luz está apagada.', answer: 'I ∧ ¬L' },
        { text: 'Por lo tanto, o no hay corriente o la bombilla no funciona.', answer: '¬K ∨ ¬B' },
      ],
    },
  ];

  /* Cada línea de la solución: [fórmula, regla, referencias]. */
  const deduccion = [
    { premises: ['P ∧ Q'], conclusion: 'Q ∧ P', level: 1,
      solution: [['P ∧ Q', 'P', ''], ['P', 'E∧', '1'], ['Q', 'E∧', '1'], ['Q ∧ P', 'I∧', '3, 2']] },
    { premises: ['P → Q', 'Q → R', 'P'], conclusion: 'R', level: 1,
      solution: [['P → Q', 'P', ''], ['Q → R', 'P', ''], ['P', 'P', ''], ['Q', 'E→', '1, 3'], ['R', 'E→', '2, 4']] },
    { premises: ['P ↔ Q', 'P'], conclusion: 'Q', level: 1,
      solution: [['P ↔ Q', 'P', ''], ['P', 'P', ''], ['P → Q', 'E↔', '1'], ['Q', 'E→', '3, 2']] },
    { premises: ['P ↔ Q'], conclusion: 'Q ↔ P', level: 1,
      solution: [['P ↔ Q', 'P', ''], ['P → Q', 'E↔', '1'], ['Q → P', 'E↔', '1'], ['Q ↔ P', 'I↔', '3, 2']] },
    { premises: ['P ∨ Q', 'P → R', 'Q → R'], conclusion: 'R', level: 1,
      solution: [['P ∨ Q', 'P', ''], ['P → R', 'P', ''], ['Q → R', 'P', ''], ['R', 'E∨', '1, 2, 3']] },
    { premises: ['P'], conclusion: 'Q → P', level: 2,
      solution: [['P', 'P', ''], ['Q', 'H', ''], ['P', 'It', '1'], ['Q → P', 'I→', '2-3']] },
    { premises: ['P → Q', 'Q → R'], conclusion: 'P → R', level: 2,
      solution: [['P → Q', 'P', ''], ['Q → R', 'P', ''], ['P', 'H', ''], ['Q', 'E→', '1, 3'], ['R', 'E→', '2, 4'], ['P → R', 'I→', '3-5']] },
    { premises: ['(P ∨ Q) → R'], conclusion: 'P → R', level: 2,
      solution: [['(P ∨ Q) → R', 'P', ''], ['P', 'H', ''], ['P ∨ Q', 'I∨', '2'], ['R', 'E→', '1, 3'], ['P → R', 'I→', '2-4']] },
    { premises: ['P → Q', '¬Q'], conclusion: '¬P', level: 2,
      solution: [['P → Q', 'P', ''], ['¬Q', 'P', ''], ['P', 'H', ''], ['Q', 'E→', '1, 3'], ['¬Q', 'It', '2'], ['¬P', 'I¬', '3-5']] },
    { premises: ['(P → Q) ∧ (P → R)'], conclusion: 'P → (Q ∧ R)', level: 2,
      solution: [['(P → Q) ∧ (P → R)', 'P', ''], ['P → Q', 'E∧', '1'], ['P → R', 'E∧', '1'], ['P', 'H', ''],
        ['Q', 'E→', '2, 4'], ['R', 'E→', '3, 4'], ['Q ∧ R', 'I∧', '5, 6'], ['P → (Q ∧ R)', 'I→', '4-7']] },
    { premises: ['(P ∧ Q) → R'], conclusion: 'P → (Q → R)', level: 2,
      solution: [['(P ∧ Q) → R', 'P', ''], ['P', 'H', ''], ['Q', 'H', ''], ['P ∧ Q', 'I∧', '2, 3'], ['R', 'E→', '1, 4'],
        ['Q → R', 'I→', '3-5'], ['P → (Q → R)', 'I→', '2-6']] },
    { premises: ['P → (Q → R)'], conclusion: '(P ∧ Q) → R', level: 2,
      solution: [['P → (Q → R)', 'P', ''], ['P ∧ Q', 'H', ''], ['P', 'E∧', '2'], ['Q', 'E∧', '2'], ['Q → R', 'E→', '1, 3'],
        ['R', 'E→', '5, 4'], ['(P ∧ Q) → R', 'I→', '2-6']] },
    { premises: ['P'], conclusion: '¬¬P', level: 2,
      solution: [['P', 'P', ''], ['¬P', 'H', ''], ['P', 'It', '1'], ['¬P', 'It', '2'], ['¬¬P', 'I¬', '2-4']] },
    { premises: ['P ∨ Q'], conclusion: 'Q ∨ P', level: 3,
      solution: [['P ∨ Q', 'P', ''], ['P', 'H', ''], ['Q ∨ P', 'I∨', '2'], ['P → (Q ∨ P)', 'I→', '2-3'], ['Q', 'H', ''],
        ['Q ∨ P', 'I∨', '5'], ['Q → (Q ∨ P)', 'I→', '5-6'], ['Q ∨ P', 'E∨', '1, 4, 7']] },
    { premises: ['¬(P ∨ Q)'], conclusion: '¬P', level: 3,
      solution: [['¬(P ∨ Q)', 'P', ''], ['P', 'H', ''], ['P ∨ Q', 'I∨', '2'], ['¬(P ∨ Q)', 'It', '1'], ['¬P', 'I¬', '2-4']] },
    { premises: ['P → Q'], conclusion: '¬Q → ¬P', level: 3,
      solution: [['P → Q', 'P', ''], ['¬Q', 'H', ''], ['P', 'H', ''], ['Q', 'E→', '1, 3'], ['¬Q', 'It', '2'],
        ['¬P', 'I¬', '3-5'], ['¬Q → ¬P', 'I→', '2-6']] },
    { premises: ['P ∨ Q', '¬P'], conclusion: 'Q', level: 3,
      solution: [['P ∨ Q', 'P', ''], ['¬P', 'P', ''], ['P', 'H', ''], ['¬Q', 'H', ''], ['P', 'It', '3'], ['¬P', 'It', '2'],
        ['¬¬Q', 'I¬', '4-6'], ['Q', 'E¬', '7'], ['P → Q', 'I→', '3-8'], ['Q', 'H', ''], ['Q → Q', 'I→', '10-10'],
        ['Q', 'E∨', '1, 9, 11']] },
    { premises: ['¬P ∧ ¬Q'], conclusion: '¬(P ∨ Q)', level: 3,
      solution: [['¬P ∧ ¬Q', 'P', ''], ['¬P', 'E∧', '1'], ['¬Q', 'E∧', '1'], ['P ∨ Q', 'H', ''], ['P', 'H', ''],
        ['P → P', 'I→', '5-5'], ['Q', 'H', ''], ['¬P', 'H', ''], ['Q', 'It', '7'], ['¬Q', 'It', '3'], ['¬¬P', 'I¬', '8-10'],
        ['P', 'E¬', '11'], ['Q → P', 'I→', '7-12'], ['P', 'E∨', '4, 6, 13'], ['¬P', 'It', '2'], ['¬(P ∨ Q)', 'I¬', '4-15']] },
  ];

  const resolucion = [
    { premises: ['P → Q', 'P'], conclusion: 'Q', level: 1 },
    { premises: ['P ∨ Q', '¬P'], conclusion: 'Q', level: 1 },
    { premises: ['P → Q', '¬Q'], conclusion: '¬P', level: 1 },
    { premises: ['(P ∧ Q) → R', 'P', 'Q'], conclusion: 'R', level: 2 },
    { premises: ['P → Q', 'Q → R'], conclusion: 'P → R', level: 2 },
    { premises: ['P ∨ Q', 'P → R', 'Q → R'], conclusion: 'R', level: 2 },
    { premises: ['¬(P ∧ Q)', 'P ∨ R', 'Q'], conclusion: 'R', level: 2 },
    { premises: ['P ↔ Q', 'Q → R', '¬R'], conclusion: '¬P', level: 3 },
    { premises: ['S → (T ∨ U)', '¬T', 'U → V'], conclusion: 'S → V', level: 3 },
    { premises: ['(P ∨ Q) → (R ∧ S)', '¬S'], conclusion: '¬P ∧ ¬Q', level: 3 },
  ];

  /* Formulas sueltas (clasificar) o razonamientos (validez). */
  const tablas = [
    { formula: '(P ∧ Q) → P', level: 1 },
    { formula: '(P ∨ Q) → (P ∧ Q)', level: 1 },
    { formula: 'P → (Q → P)', level: 1 },
    { formula: '(P → Q) ∧ P ∧ ¬Q', level: 2 },
    { formula: '¬(P ∨ Q) ↔ (¬P ∧ ¬Q)', level: 2 },
    { formula: '((P → Q) → P) → P', level: 3 },
    { premises: ['P → Q', 'Q'], conclusion: 'P', level: 1 },
    { premises: ['P ∨ Q', '¬P'], conclusion: 'Q', level: 1 },
    { premises: ['P → Q', '¬P'], conclusion: '¬Q', level: 2 },
    { premises: ['P → Q', 'Q → R'], conclusion: 'P → R', level: 2 },
    { premises: ['(P ∧ Q) → R', '¬R'], conclusion: '¬P ∨ ¬Q', level: 3 },
    { premises: ['P ∨ Q', 'Q → R'], conclusion: 'P ∨ R', level: 3 },
  ];

  const Exercises = { formalizacion, deduccion, resolucion, tablas };

  if (typeof module !== 'undefined' && module.exports) module.exports = Exercises;
  else root.Exercises = Exercises;
})(typeof window !== 'undefined' ? window : globalThis);
