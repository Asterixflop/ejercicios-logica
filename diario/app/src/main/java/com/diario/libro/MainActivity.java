package com.diario.libro;

import android.app.Activity;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/** Muestra el diario (assets/index.html) a pantalla completa y le da un sitio donde guardar. */
public class MainActivity extends Activity {

    private WebView web;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        web = new WebView(this);
        WebSettings ajustes = web.getSettings();
        ajustes.setJavaScriptEnabled(true);
        ajustes.setDomStorageEnabled(true);
        ajustes.setTextZoom(100);

        web.addJavascriptInterface(new Almacen(getSharedPreferences("diario", MODE_PRIVATE)), "AndroidDiario");
        web.setWebViewClient(new WebViewClient());
        setContentView(web);

        web.loadUrl("file:///android_asset/index.html");
    }

    @Override
    protected void onPause() {
        web.evaluateJavascript("window.guardar && window.guardar()", null);
        super.onPause();
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        // El botón atrás pasa la página hacia atrás; en la portada cierra la app.
        web.evaluateJavascript("window.atras ? window.atras() : false", valor -> {
            if (!"true".equals(valor)) {
                MainActivity.super.onBackPressed();
            }
        });
    }

    /** Puente que usa app.js para leer y escribir las páginas del diario y ajustar las barras del sistema. */
    class Almacen {
        private final SharedPreferences prefs;

        Almacen(SharedPreferences prefs) {
            this.prefs = prefs;
        }

        @JavascriptInterface
        public String cargar() {
            return prefs.getString("paginas", null);
        }

        @JavascriptInterface
        public void guardar(String json) {
            prefs.edit().putString("paginas", json).apply();
        }

        @JavascriptInterface
        @SuppressWarnings("deprecation")
        public void colorBarras(String color, boolean oscuro) {
            final int valor;
            try {
                valor = Color.parseColor(color);
            } catch (IllegalArgumentException e) {
                return;
            }
            runOnUiThread(() -> {
                getWindow().setStatusBarColor(valor);
                getWindow().setNavigationBarColor(valor);
                int iconosOscuros = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
                View decor = getWindow().getDecorView();
                int flags = decor.getSystemUiVisibility();
                decor.setSystemUiVisibility(oscuro ? flags & ~iconosOscuros : flags | iconosOscuros);
            });
        }
    }
}
