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
  var progreso = document.querySelector('#progreso span');
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
        '<h1 class="titulo">Mi diario</h1>' +
        '<div class="adorno"></div>' +
        '<div class="anio">' + new Date(datos.paginas[0].fecha).getFullYear() + '</div>' +
        '<div class="pista">Toca o desliza para abrir</div>';
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
      pie.textContent = String(i);

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
    hoja.style.setProperty('--sombra', String(Math.sin(Math.PI * Math.min(1, -angulo / 180)) * 0.8));
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
    num.textContent = actual === 0 ? 'Portada' : actual + ' de ' + datos.paginas.length;
    progreso.style.width = (actual === 0 ? 0 : 100 * actual / datos.paginas.length) + '%';
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

  // ---------- Ajustes de lectura ----------
  var LETRAS = [
    { id: 'literata', nombre: 'Literata', css: '"Literata", Georgia, serif', escala: 1 },
    { id: 'clasica', nombre: 'Clásica', css: 'Georgia, "Noto Serif", "Times New Roman", serif', escala: 1 },
    { id: 'moderna', nombre: 'Moderna', css: 'Roboto, "Helvetica Neue", Arial, sans-serif', escala: 0.95 },
    { id: 'manuscrita', nombre: 'Manuscrita', css: '"Caveat", "Segoe Print", cursive', escala: 1.3 }
  ];
  var INTERLINEAS = [
    { id: 'junto', nombre: 'Junto', valor: 1.45 },
    { id: 'normal', nombre: 'Normal', valor: 1.75 },
    { id: 'amplio', nombre: 'Amplio', valor: 2.1 }
  ];
  var TINTAS = [
    { id: 'carbon', nombre: 'Carbón' },
    { id: 'azul', nombre: 'Azul' },
    { id: 'sepia', nombre: 'Sepia' },
    { id: 'verde', nombre: 'Verde' },
    { id: 'burdeos', nombre: 'Burdeos' }
  ];
  var PAPELES = [
    { id: 'auto', nombre: 'Auto' },
    { id: 'claro', nombre: 'Claro' },
    { id: 'sepia', nombre: 'Sepia' },
    { id: 'oscuro', nombre: 'Oscuro' }
  ];
  var TAPAS = [
    { id: 'salvia', nombre: 'Salvia', color: '#8b9787' },
    { id: 'pizarra', nombre: 'Pizarra', color: '#6e7f90' },
    { id: 'arcilla', nombre: 'Arcilla', color: '#b0846f' },
    { id: 'rosa', nombre: 'Rosa', color: '#c29a9b' },
    { id: 'grafito', nombre: 'Grafito', color: '#5d5b57' }
  ];
  var AJUSTES_INICIALES = { letra: 'literata', tam: 18, interlinea: 'normal', tinta: 'carbon', papel: 'auto', tapa: 'salvia' };

  function buscar(lista, id) {
    for (var i = 0; i < lista.length; i++) if (lista[i].id === id) return lista[i];
    return lista[0];
  }

  var ajustes = {};
  Object.keys(AJUSTES_INICIALES).forEach(function (k) {
    ajustes[k] = datos.ajustes && datos.ajustes[k] !== undefined ? datos.ajustes[k] : AJUSTES_INICIALES[k];
  });
  datos.ajustes = ajustes;

  var raiz = document.documentElement;
  var modoOscuro = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function aplicarAjustes() {
    var letra = buscar(LETRAS, ajustes.letra);
    raiz.style.setProperty('--letra-texto', letra.css);
    raiz.style.setProperty('--escala-letra', String(letra.escala));
    raiz.style.setProperty('--tam', ajustes.tam + 'px');
    raiz.style.setProperty('--interlinea', String(buscar(INTERLINEAS, ajustes.interlinea).valor));
    raiz.style.setProperty('--tinta-texto', 'var(--tinta-' + buscar(TINTAS, ajustes.tinta).id + ')');
    raiz.style.setProperty('--tapa', buscar(TAPAS, ajustes.tapa).color);
    if (ajustes.papel === 'auto') raiz.removeAttribute('data-papel');
    else raiz.setAttribute('data-papel', ajustes.papel);

    // La barra de estado del móvil toma el color del fondo.
    if (window.AndroidDiario && window.AndroidDiario.colorBarras) {
      var oscuro = ajustes.papel === 'oscuro' || (ajustes.papel === 'auto' && modoOscuro && modoOscuro.matches);
      window.AndroidDiario.colorBarras(getComputedStyle(raiz).getPropertyValue('--fondo').trim(), oscuro);
    }
  }
  if (modoOscuro && modoOscuro.addEventListener) modoOscuro.addEventListener('change', aplicarAjustes);

  function crearOpciones(contenedor, lista, clave, pintar) {
    var botones = lista.map(function (op) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label', op.nombre);
      pintar(b, op);
      b.addEventListener('click', function () {
        ajustes[clave] = op.id;
        marcar();
        aplicarAjustes();
        guardarPronto();
      });
      contenedor.appendChild(b);
      return b;
    });
    function marcar() {
      botones.forEach(function (b, i) { b.setAttribute('aria-pressed', String(lista[i].id === ajustes[clave])); });
    }
    marcar();
  }

  function conNombre(b, op) { b.textContent = op.nombre; }

  crearOpciones(document.getElementById('op-letra'), LETRAS, 'letra', function (b, op) {
    b.textContent = op.nombre;
    b.style.fontFamily = op.css;
    if (op.escala > 1) b.style.fontSize = '17px';
  });
  crearOpciones(document.getElementById('op-interlinea'), INTERLINEAS, 'interlinea', conNombre);
  crearOpciones(document.getElementById('op-tinta'), TINTAS, 'tinta', function (b, op) {
    b.style.background = 'var(--tinta-' + op.id + ')';
  });
  crearOpciones(document.getElementById('op-papel'), PAPELES, 'papel', conNombre);
  crearOpciones(document.getElementById('op-tapa'), TAPAS, 'tapa', function (b, op) {
    b.style.background = op.color;
  });

  var opTam = document.getElementById('op-tam');
  opTam.value = String(ajustes.tam);
  opTam.addEventListener('input', function () {
    ajustes.tam = Number(opTam.value);
    aplicarAjustes();
    guardarPronto();
  });

  var panel = document.getElementById('ajustes');
  var velo = document.getElementById('velo');
  function panelAbierto() { return panel.classList.contains('abierto'); }
  function abrirAjustes() {
    soltarFoco();
    panel.classList.add('abierto');
    velo.classList.add('abierto');
  }
  function cerrarAjustes() {
    panel.classList.remove('abierto');
    velo.classList.remove('abierto');
    guardar();
  }
  document.getElementById('abrir-ajustes').addEventListener('click', function () {
    if (panelAbierto()) cerrarAjustes(); else abrirAjustes();
  });
  document.getElementById('listo').addEventListener('click', cerrarAjustes);
  velo.addEventListener('click', cerrarAjustes);

  aplicarAjustes();

  // ---------- Botones y teclado ----------
  btnSig.addEventListener('click', function () { pasar(1); });
  btnAnt.addEventListener('click', function () { pasar(-1); });
  btnPrimera.addEventListener('click', function () { saltar(0); });
  btnUltima.addEventListener('click', function () { saltar(total() - 1); });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && panelAbierto()) { cerrarAjustes(); return; }
    if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
    if (e.key === 'ArrowRight') pasar(1);
    if (e.key === 'ArrowLeft') pasar(-1);
  });

  // Botón "atrás" de Android: retrocede una hoja; en la portada deja cerrar la app.
  window.atras = function () {
    if (panelAbierto()) { cerrarAjustes(); return true; }
    if (animando) return true;
    if (actual === 0) { guardar(); return false; }
    pasar(-1);
    return true;
  };

  dibujar();
})();
