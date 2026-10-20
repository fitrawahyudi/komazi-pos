package com.komazipos;

import android.os.Bundle;
import android.util.Log;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.core.splashscreen.SplashScreen;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "MainActivity";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Safe SplashScreen initialization to prevent crashes on custom vendor themes (e.g., Xiaomi MIUI/HyperOS)
        try {
            SplashScreen.installSplashScreen(this);
        } catch (Throwable t) {
            Log.w(TAG, "SplashScreen installation warning: " + t.getMessage());
        }

        // Register custom Komazi thermal printer plugin
        try {
            registerPlugin(KomaziPrinterPlugin.class);
        } catch (Throwable t) {
            Log.e(TAG, "Failed to register KomaziPrinterPlugin: " + t.getMessage(), t);
        }

        super.onCreate(savedInstanceState);

        // CATATAN PENTING:
        // KdsForegroundService TIDAK BOLEH dijalankan otomatis di sini saat onCreate()!
        // Di Android 14+ dan Xiaomi MIUI/HyperOS, memulai Foreground Service tanpa izin runtime BLUETOOTH_CONNECT
        // atau sebelum interaksi UI menyebabkan SecurityException / ForegroundServiceStartNotAllowedException
        // yang membuat aplikasi langsung 'force close' (aplikasi terus berhenti).
        // Service hanya akan dipicu dari UI/plugin ketika printer Bluetooth benar-benar terhubung.
    }

    @Override
    public void onStart() {
        super.onStart();
        try {
            if (getBridge() != null && getBridge().getWebView() != null) {
                WebView webView = getBridge().getWebView();
                WebSettings settings = webView.getSettings();
                settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
                settings.setDomStorageEnabled(true);
                settings.setDatabaseEnabled(true);
                settings.setGeolocationEnabled(true);
                settings.setMediaPlaybackRequiresUserGesture(false);
                // Cache mode: Gunakan LOAD_DEFAULT agar aset live termuat instan dari cache dan di-revalidate di background
                settings.setCacheMode(WebSettings.LOAD_DEFAULT);
            }
        } catch (Throwable t) {
            Log.w(TAG, "Failed to configure WebSettings: " + t.getMessage());
        }
    }

    @Override
    public void onPause() {
        super.onPause();
        // Pertahankan timer JS dan WebSocket saat aplikasi diminimize atau layar mati
        try {
            if (getBridge() != null && getBridge().getWebView() != null) {
                getBridge().getWebView().resumeTimers();
            }
        } catch (Throwable t) {
            Log.w(TAG, "onPause error: " + t.getMessage());
        }
    }

    @Override
    public void onStop() {
        super.onStop();
        try {
            if (getBridge() != null && getBridge().getWebView() != null) {
                getBridge().getWebView().resumeTimers();
            }
        } catch (Throwable t) {
            Log.w(TAG, "onStop error: " + t.getMessage());
        }
    }

    @Override
    public void onBackPressed() {
        // Navigasi back cerdas di Live Mode: jika riwayat halaman ada, kembali. Jika di home, minimize ke background
        try {
            if (getBridge() != null && getBridge().getWebView() != null && getBridge().getWebView().canGoBack()) {
                getBridge().getWebView().goBack();
            } else {
                moveTaskToBack(true);
            }
        } catch (Throwable t) {
            super.onBackPressed();
        }
    }
}

