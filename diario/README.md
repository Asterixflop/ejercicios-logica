# Mi Diario (app Android)

Diario con forma de libro y estilo de lector electrónico: hojas limpias, tinta suave, tipografía
Literata y paso de página animado. Sigue el modo claro u oscuro del móvil. Desliza el dedo hacia la izquierda para pasar la hoja (sigue al dedo, como un libro real)
o hacia la derecha para volver; también hay botones abajo y el botón «atrás» de Android retrocede
una hoja.

- Cada página guarda la fecha en que se empezó.
- Al pasar desde la última página con algo escrito se añade una hoja nueva.
- Lo escrito se guarda solo en el móvil, sin conexión ni cuentas.

## Conseguir la APK

GitHub Actions la compila en cada cambio de esta carpeta (`.github/workflows/diario-apk.yml`) y la
deja en la release **diario** del repositorio como `MiDiario.apk`. Ábrela desde el móvil y acepta
instalar apps de origen desconocido.

## Compilar en tu ordenador

Con el SDK de Android instalado:

```sh
cd diario
./gradlew assembleRelease
# app/build/outputs/apk/release/app-release.apk
```

## Estructura

```
app/src/main/assets/       el libro: index.html, style.css, app.js (se puede probar en el navegador)
app/src/main/java/...      MainActivity: WebView a pantalla completa + guardado en el móvil
diario.keystore            clave de firma fija, para actualizar sin perder lo escrito
```

La tipografía [Literata](https://fonts.google.com/specimen/Literata) (licencia SIL Open Font) va
incluida en `assets/fuentes/` para que la app funcione sin conexión.
