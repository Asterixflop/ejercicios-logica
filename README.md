# Lógica Libre

Web libre y gratuita para practicar **lógica de enunciados** con corrección automática, al estilo de los
ejercicios de la asignatura de Lógica de Ingeniería Informática.

- **Formalización**: traduce frases a fórmulas. Se acepta cualquier fórmula equivalente y, si fallas,
  te muestra una interpretación en la que tu fórmula y la frase no coinciden.
- **Deducción natural**: demostraciones línea a línea (estilo Fitch) con las reglas P, H, It, I∧, E∧, I∨,
  E∨, I→, E→, I¬, E¬, I↔, E↔ y, si quieres, las derivadas MT y SD. El corrector revisa cada paso, las
  hipótesis abiertas y qué líneas son accesibles.
- **Resolución**: forma clausal de las premisas y de la conclusión negada, y pasos de resolución hasta □.
- **Tablas de verdad**: rellenar la tabla, clasificar fórmulas y decidir si un razonamiento es válido.

En cada apartado puedes crear **ejercicios propios** escribiendo tus premisas y tu conclusión.
No hay registro ni se guarda nada: todo se corrige en el navegador.

## Usarla

No necesita instalación: abre `index.html` en el navegador.

Para publicarla gratis con **GitHub Pages**: *Settings → Pages → Deploy from a branch*, elige la rama y
la carpeta `/ (root)`.

## Escribir fórmulas

| Símbolo | Teclea  |
|---------|---------|
| ¬       | `~` `!` |
| ∧       | `&` `^` |
| ∨       | `v` `\|` |
| →       | `->`    |
| ↔       | `<->`   |

Los átomos son letras mayúsculas (`P`, `Q`, `P1`…). Prioridad: ¬, ∧, ∨, →, ↔.

## Estructura

```
index.html
css/styles.css
js/logic.js         análisis de fórmulas, tablas, FNC y resolución
js/deduction.js     corrector de deducción natural
js/exercises.js     banco de ejercicios (añade aquí los tuyos)
js/ui.js            utilidades de interfaz
js/views/*.js       una vista por tipo de ejercicio
js/app.js           rutas y páginas
tests/run.js        pruebas (node tests/run.js)
```

### Añadir ejercicios

Edita `js/exercises.js`. Las pruebas comprueban que cada razonamiento sea válido y que las
soluciones de deducción natural sean correctas:

```sh
node tests/run.js
```

## Pendiente

- Lógica de predicados (formalización, deducción natural y resolución).

## Licencia

MIT
