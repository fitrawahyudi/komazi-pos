package com.komazipos;

import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.core.splashscreen.SplashScreen;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        SplashScreen.installSplashScreen(this);
        registerPlugin(KomaziPrinterPlugin.class);
        super.onCreate(savedInstanceState);

        // Mulai Foreground Service agar koneksi Bluetooth printer dan Socket.IO tetap aktif di latar belakang
        KdsForegroundService.startService(this);
    }

    @Override
    public void onStart() {
        super.onStart();
        if (getBridge() != null && getBridge().getWebView() != null) {
            WebView webView = getBridge().getWebView();
            WebSettings settings = webView.getSettings();
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
            settings.setDomStorageEnabled(true);
            settings.setGeolocationEnabled(true);
            settings.setMediaPlaybackRequiresUserGesture(false);
        }
    }

    @Override
    public void onPause() {
        super.onPause();
        // Pertahankan timer JS dan WebSocket saat aplikasi diminimize atau layar mati
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().resumeTimers();
        }
    }

    @Override
    public void onStop() {
        super.onStop();
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().resumeTimers();
        }
    }

    @Override
    public void onBackPressed() {
        // Jangan hancurkan Activity / koneksi saat pengguna menekan tombol Back di layar utama!
        // Pindahkan task ke latar belakang agar pencetakan otomatis tetap berjalan
        moveTaskToBack(true);
    }
}
