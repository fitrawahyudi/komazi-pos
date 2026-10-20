package com.komazipos;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.util.Log;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

/**
 * Android Foreground Service untuk menjaga koneksi Bluetooth printer dan Socket.IO
 * tetap aktif di latar belakang saat aplikasi di-minimize atau layar perangkat mati.
 */
public class KdsForegroundService extends Service {
    private static final String TAG = "KdsForegroundService";
    private static final String CHANNEL_ID = "komazi_kds_foreground";
    private static final int NOTIFICATION_ID = 8801;

    private PowerManager.WakeLock wakeLock = null;
    private static boolean isRunning = false;

    public static boolean isServiceRunning() {
        return isRunning;
    }

    public static void startService(Context context) {
        if (context == null || isRunning) return;
        try {
            Intent intent = new Intent(context, KdsForegroundService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent);
            } else {
                context.startService(intent);
            }
        } catch (Throwable e) {
            Log.e(TAG, "Gagal memulai KdsForegroundService: " + e.getMessage());
        }
    }

    public static void stopService(Context context) {
        if (context == null || !isRunning) return;
        try {
            Intent intent = new Intent(context, KdsForegroundService.class);
            context.stopService(intent);
        } catch (Throwable e) {
            Log.e(TAG, "Gagal menghentikan KdsForegroundService: " + e.getMessage());
        }
    }

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        acquireWakeLock();
        isRunning = true;
        Log.d(TAG, "KdsForegroundService dibuat & WakeLock aktif");
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        try {
            Notification notification = buildNotification();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) { // Android 14+ (API 34+)
                int serviceType = ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC;
                // Hanya sertakan FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE jika izin BLUETOOTH_CONNECT telah diberikan
                if (ContextCompat.checkSelfPermission(this, android.Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED) {
                    serviceType |= ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE;
                }
                startForeground(NOTIFICATION_ID, notification, serviceType);
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE);
            } else {
                startForeground(NOTIFICATION_ID, notification);
            }
        } catch (Throwable t) {
            Log.e(TAG, "Gagal menjalankan startForeground (SecurityException / Xiaomi restriction): " + t.getMessage(), t);
            // Matikan service dengan aman agar tidak memicu ANR watchdog OS
            try {
                stopSelf();
            } catch (Throwable ignored) {}
            return START_NOT_STICKY;
        }
        return START_STICKY;
    }

    private void acquireWakeLock() {
        try {
            if (wakeLock == null) {
                PowerManager powerManager = (PowerManager) getSystemService(Context.POWER_SERVICE);
                if (powerManager != null) {
                    wakeLock = powerManager.newWakeLock(
                        PowerManager.PARTIAL_WAKE_LOCK,
                        "KomaziPOS:KdsForegroundWakeLock"
                    );
                    wakeLock.setReferenceCounted(false);
                    // Gunakan timeout 15 menit agar aman dari watchdog baterai Xiaomi MIUI
                    wakeLock.acquire(15 * 60 * 1000L);
                    Log.d(TAG, "WakeLock berhasil di-acquire dengan timeout");
                }
            }
        } catch (Throwable e) {
            Log.w(TAG, "Tidak dapat meng-acquire WakeLock: " + e.getMessage());
        }
    }

    private void releaseWakeLock() {
        try {
            if (wakeLock != null && wakeLock.isHeld()) {
                wakeLock.release();
                wakeLock = null;
                Log.d(TAG, "WakeLock dilepas");
            }
        } catch (Throwable e) {
            Log.w(TAG, "Gagal melepas WakeLock: " + e.getMessage());
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try {
                NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Layanan Cetak Latar Belakang Komazi",
                    NotificationManager.IMPORTANCE_LOW
                );
                channel.setDescription("Menjaga printer Bluetooth dan penerimaan pesanan tetap aktif saat aplikasi di-minimize");
                channel.setShowBadge(false);

                NotificationManager manager = getSystemService(NotificationManager.class);
                if (manager != null) {
                    manager.createNotificationChannel(channel);
                }
            } catch (Throwable t) {
                Log.w(TAG, "Gagal membuat NotificationChannel: " + t.getMessage());
            }
        }
    }

    private Notification buildNotification() {
        Intent notificationIntent = new Intent(this, MainActivity.class);
        notificationIntent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this,
            0,
            notificationIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
        );

        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Komazi POS • Layanan Cetak Latar Belakang")
            .setContentText("Koneksi printer Bluetooth & pesanan aktif di latar belakang.")
            .setSmallIcon(R.drawable.ic_komazi_notification)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build();
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        super.onTaskRemoved(rootIntent);
        Log.w(TAG, "Aplikasi di-swipe dari recent apps. Melepas resource service...");
        try {
            releaseWakeLock();
            stopSelf();
        } catch (Throwable t) {
            Log.e(TAG, "Error saat onTaskRemoved: " + t.getMessage());
        }
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        releaseWakeLock();
        isRunning = false;
        Log.d(TAG, "KdsForegroundService dihentikan");
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}

