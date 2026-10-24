(function () {
  'use strict';

  // ---------- Guardado ----------
  // En la APK se guarda con el puente nativo (AndroidDiario); en un navegador, en localStorage.
  var CLAVE = 'diario-libro';

  function leerGuardado() {
    try {
      var json = window.AndroidDiario ? window.AndroidDiario.cargar() : localStorage.getItem(CLAVE);
      if (json) return JSON.parse(json);
    } catch (e) { /* datos dañados o sin acceso: se empieza de cero */ }
    return null;
  }

  var datos = leerGuardado() || { paginas: [] };
  if (!Array.isArray(datos.paginas)) datos.paginas = [];
  if (datos.paginas.length === 0) datos.paginas.push(paginaNueva());

  function paginaNueva() { return { fecha: Date.now(), texto: '' }; }

  var temporizador = null;
  function guardar() {
    clearTimeout(temporizador);
    temporizador = null;
    var json = JSON.stringify(datos);
    try {
      if (window.AndroidDiario) window.AndroidDiario.guardar(json);
      else localStorage.setItem(CLAVE, json);
    } catch (e) { /* sin almacenamiento disponible */ }
  }
  function guardarPronto() {
    clearTimeout(temporizador);
    temporizador = setTimeout(guardar, 400);
  }
  window.guardar = guardar;
  window.addEventListener('pagehide', guardar);
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) guardar();
  });

  // ---------- Estado ----------
  // Hoja 0 = portada; hoja i (i >= 1) = datos.paginas[i - 1].
  var libro = document.getElementById('libro');
  var num = document.getElementById('num');
  var btnPrimera = document.getElementById('primera');
  var btnAnt = document.getElementById('ant');
  var btnSig = document.getElementById('sig');
  var btnUltima = document.getElementById('ultima');

  var actual = 0;
  var animando = false;
  var hojas = {}; // índice -> elemento .hoja que está en el DOM

  function total() { return datos.paginas.length + 1; }

  var formatoFecha;
  try {
    formatoFecha = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  } catch (e) { formatoFecha = null; }
  function textoFecha(ms) {
    var d = new Date(ms);
    return formatoFecha ? formatoFecha.format(d) : d.toLocaleDateString();
  }

  // ---------- Construcción de hojas ----------
  function crearHoja(i) {
    var hoja = document.createElement('div');
    hoja.className = 'hoja';
    hoja.style.zIndex = String(total() - i);

    var frente = document.createElement('div');
    var reverso = document.createElement('div');
    reverso.className = 'cara reverso';

    if (i === 0) {
      frente.className = 'cara portada';
      frente.innerHTML =
        '<div class="marco">' +
        '<h1 class="titulo">Mi Diario</h1>' +
        '<div class="adorno">✦ ✦ ✦</div>' +
        '</div>' +
        '<div class="pista">Desliza o toca para abrir</div>';
      frente.addEventListener('click', function () {
        if (!arrastre || !arrastre.movido) pasar(1);
      });
    } else {
      var pagina = datos.paginas[i - 1];
      frente.className = 'cara pagina';

      var fecha = document.createElement('div');
      fecha.className = 'fecha';
      fecha.textContent = textoFecha(pagina.fecha);

      var texto = document.createElement('textarea');
      texto.className = 'texto';
      texto.value = pagina.texto;
      texto.placeholder = i === 1 && !pagina.texto ? 'Querido diario…' : '';
      texto.spellcheck = false;
      texto.addEventListener('input', function () {
        pagina.texto = texto.value;
        guardarPronto();
        actualizarBarra();
      });

      var pie = document.createElement('div');
      pie.className = 'pie';
      pie.textContent = '— ' + i + ' —';

      frente.appendChild(fecha);
      frente.appendChild(texto);
      frente.appendChild(pie);
    }

    hoja.appendChild(frente);
    hoja.appendChild(reverso);
    return hoja;
  }

  function ponerAngulo(hoja, angulo) {
    hoja.style.transform = 'rotateY(' + angulo + 'deg)';
    hoja.style.setProperty('--sombra', String(Math.sin(Math.PI * Math.min(1, -angulo / 180)) * 0.9));
    // Una hoja ya pasada queda fuera del libro: se oculta para que no asome por la izquierda.
    hoja.style.visibility = angulo <= -179.5 ? 'hidden' : 'visible';
  }

  // Deja en el DOM solo la hoja actual y sus vecinas (o las indicadas).
  function mostrar(indices) {
    libro.innerHTML = '';
    hojas = {};
    indices.forEach(function (i) {
      if (i < 0 || i >= total()) return;
      var hoja = crearHoja(i);
      ponerAngulo(hoja, i < actual ? -180 : 0);
      libro.appendChild(hoja);
      hojas[i] = hoja;
    });
    actualizarBarra();
  }

  function dibujar() { mostrar([actual - 1, actual, actual + 1]); }

  function actualizarBarra() {
    num.textContent = actual === 0 ? 'Portada' : 'Página ' + actual + ' de ' + datos.paginas.length;
    btnPrimera.disabled = actual === 0;
    btnAnt.disabled = actual === 0;
    btnUltima.disabled = actual === total() - 1;
  }

  // ---------- Animación ----------
  function animar(hoja, desde, hasta, alTerminar) {
    animando = true;
    var ms = 120 + 650 * Math.abs(hasta - desde) / 180;
    var inicio = null;
    function paso(t) {
      if (inicio === null) inicio = t;
      var k = Math.min(1, (t - inicio) / ms);
      var e = 1 - Math.pow(1 - k, 3);
      ponerAngulo(hoja, desde + (hasta - desde) * e);
      if (k < 1) {
        requestAnimationFrame(paso);
      } else {
        animando = false;
        if (alTerminar) alTerminar();
      }
    }
    requestAnimationFrame(paso);
  }

  function rebote(hoja, haciaAtras) {
    if (!hoja) return;
    var tope = haciaAtras ? -168 : -14;
    var reposo = haciaAtras ? -180 : 0;
    animar(hoja, reposo, tope, function () { animar(hoja, tope, reposo); });
  }

  // Antes de avanzar desde la última página se añade una en blanco, salvo que ya esté vacía.
  function puedeAvanzar() {
    if (actual < total() - 1) return true;
    var ultima = datos.paginas[datos.paginas.length - 1];
    if (!ultima.texto.trim()) return false;
    datos.paginas.push(paginaNueva());
    guardar();
    var nueva = crearHoja(total() - 1);
    ponerAngulo(nueva, 0);
    libro.insertBefore(nueva, libro.firstChild);
    hojas[total() - 1] = nueva;
    actualizarBarra();
    return true;
  }

  function soltarFoco() {
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  }

  // Pasa una hoja hacia delante (+1) o hacia atrás (-1) con animación.
  function pasar(dir) {
    if (animando) return;
    soltarFoco();
    if (dir > 0) {
      if (!puedeAvanzar()) { rebote(hojas[actual], false); return; }
      animar(hojas[actual], 0, -180, function () { actual++; dibujar(); });
    } else {
      if (actual === 0) return;
      animar(hojas[actual - 1], -180, 0, function () { actual--; dibujar(); });
    }
  }

  // Salta a otra hoja pasando una sola, con la hoja de destino ya preparada debajo.
  function saltar(destino) {
    if (animando || destino === actual) return;
    if (Math.abs(destino - actual) === 1) { pasar(destino - actual); return; }
    soltarFoco();
    var origen = actual;
    if (destino > origen) {
      mostrar([destino, origen]);
      hojas[destino].style.zIndex = '0';
      animar(hojas[origen], 0, -180, function () { actual = destino; dibujar(); });
    } else {
      actual = destino;
      mostrar([origen, destino]);
      hojas[destino].style.zIndex = String(total() + 1);
      ponerAngulo(hojas[destino], -180);
      animar(hojas[destino], -180, 0, function () { dibujar(); });
    }
  }

  // ---------- Arrastrar con el dedo ----------
  var arrastre = null;

  libro.addEventListener('pointerdown', function (e) {
    if (animando || (e.pointerType === 'mouse' && e.button !== 0)) return;
    arrastre = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), modo: null, movido: false, p: 0, hoja: null };
  });

  libro.addEventListener('pointermove', function (e) {
    if (!arrastre || e.pointerId !== arrastre.id) return;
    var dx = e.clientX - arrastre.x;
    var dy = e.clientY - arrastre.y;

    if (arrastre.modo === null) {
      if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        arrastre.movido = true;
        if (dx < 0 && puedeAvanzar()) {
          arrastre.modo = 'sig';
          arrastre.hoja = hojas[actual];
        } else if (dx > 0 && actual > 0) {
          arrastre.modo = 'ant';
          arrastre.hoja = hojas[actual - 1];
        } else {
          arrastre.modo = 'nada';
          rebote(hojas[actual], false);
          return;
        }
        soltarFoco();
        try { libro.setPointerCapture(e.pointerId); } catch (err) { /* sin captura */ }
      } else if (Math.abs(dy) > 12) {
        arrastre.modo = 'nada';
      }
      return;
    }

    if (arrastre.modo === 'nada') return;
    e.preventDefault();
    var ancho = libro.clientWidth * 0.9;
    if (arrastre.modo === 'sig') {
      arrastre.p = Math.max(0, Math.min(1, -dx / ancho));
      ponerAngulo(arrastre.hoja, -180 * arrastre.p);
    } else {
      arrastre.p = Math.max(0, Math.min(1, dx / ancho));
      ponerAngulo(arrastre.hoja, -180 * (1 - arrastre.p));
    }
    arrastre.velocidad = Math.abs(dx) / Math.max(1, performance.now() - arrastre.t);
  });

  function terminarArrastre() {
    var a = arrastre;
    if (!a) return;
    // Se deja "arrastre" un instante para que el click que sigue a un deslizamiento no abra la portada.
    setTimeout(function () { if (arrastre === a) arrastre = null; }, 0);
    if (a.modo !== 'sig' && a.modo !== 'ant') return;

    var completar = a.p > 0.35 || (a.p > 0.08 && a.velocidad > 0.6);
    if (a.modo === 'sig') {
      var angulo = -180 * a.p;
      if (completar) animar(a.hoja, angulo, -180, function () { actual++; dibujar(); });
      else animar(a.hoja, angulo, 0);
    } else {
      var anguloAtras = -180 * (1 - a.p);
      if (completar) animar(a.hoja, anguloAtras, 0, function () { actual--; dibujar(); });
      else animar(a.hoja, anguloAtras, -180);
    }
  }

  libro.addEventListener('pointerup', terminarArrastre);
  libro.addEventListener('pointercancel', terminarArrastre);

  // ---------- Botones y teclado ----------
  btnSig.addEventListener('click', function () { pasar(1); });
  btnAnt.addEventListener('click', function () { pasar(-1); });
  btnPrimera.addEventListener('click', function () { saltar(0); });
  btnUltima.addEventListener('click', function () { saltar(total() - 1); });

  document.addEventListener('keydown', function (e) {
    if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
    if (e.key === 'ArrowRight') pasar(1);
    if (e.key === 'ArrowLeft') pasar(-1);
  });

  // Botón "atrás" de Android: retrocede una hoja; en la portada deja cerrar la app.
  window.atras = function () {
    if (animando) return true;
    if (actual === 0) { guardar(); return false; }
    pasar(-1);
    return true;
  };

  dibujar();
})();
