package com.komazipos;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.util.Base64;
import android.util.Log;
import android.webkit.WebView;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.IOException;
import java.io.OutputStream;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(
    name = "KomaziPrinter",
    permissions = {
        @Permission(
            alias = "bluetooth",
            strings = {
                Manifest.permission.BLUETOOTH,
                Manifest.permission.BLUETOOTH_ADMIN,
                Manifest.permission.ACCESS_FINE_LOCATION
            }
        ),
        @Permission(
            alias = "bluetoothConnect",
            strings = {
                Manifest.permission.BLUETOOTH_CONNECT,
                Manifest.permission.BLUETOOTH_SCAN
            }
        )
    }
)
public class KomaziPrinterPlugin extends Plugin {
    private static final String TAG = "KomaziPrinter";
    private static final String PREF_NAME = "KomaziPrinterPrefs";
    private static final String KEY_LAST_ADDRESS = "last_printer_address";
    private static final String KEY_LAST_NAME = "last_printer_name";

    // Standard Bluetooth Serial Port Profile (SPP) UUID for ESC/POS Thermal Printers
    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");

    private BluetoothSocket socket = null;
    private OutputStream outputStream = null;
    private String connectedAddress = null;
    private String connectedName = null;

    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    private boolean hasBluetoothPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            return ContextCompat.checkSelfPermission(getContext(), Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED;
        }
        return ContextCompat.checkSelfPermission(getContext(), Manifest.permission.BLUETOOTH) == PackageManager.PERMISSION_GRANTED;
    }

    private synchronized boolean connectInternal(String address) {
        try {
            BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
            if (adapter == null || !adapter.isEnabled()) {
                Log.w(TAG, "Bluetooth tidak aktif di HP");
                return false;
            }

            disconnectInternal();

            BluetoothDevice device = adapter.getRemoteDevice(address);
            if (device == null) {
                Log.w(TAG, "Device tidak ditemukan: " + address);
                return false;
            }

            Log.d(TAG, "Menghubungkan ke Bluetooth RFCOMM: " + device.getName() + " (" + address + ")");
            adapter.cancelDiscovery();

            BluetoothSocket newSocket = device.createRfcommSocketToServiceRecord(SPP_UUID);
            newSocket.connect();

            socket = newSocket;
            outputStream = socket.getOutputStream();
            connectedAddress = address;
            connectedName = device.getName() != null ? device.getName() : "Printer Thermal";

            // Simpan ke SharedPreferences agar persist antar sesi/kill apps
            SharedPreferences prefs = getContext().getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
            prefs.edit()
                .putString(KEY_LAST_ADDRESS, address)
                .putString(KEY_LAST_NAME, connectedName)
                .apply();

            Log.d(TAG, "Sukses terhubung dan tersimpan: " + connectedName + " [" + connectedAddress + "]");
            return true;
        } catch (Exception e) {
            Log.e(TAG, "Gagal connectInternal: " + e.getMessage());
            disconnectInternal();
            return false;
        }
    }

    private synchronized void disconnectInternal() {
        try {
            if (outputStream != null) {
                outputStream.close();
            }
        } catch (Exception ignored) {}
        try {
            if (socket != null) {
                socket.close();
            }
        } catch (Exception ignored) {}
        socket = null;
        outputStream = null;
        connectedAddress = null;
        connectedName = null;
    }

    @PluginMethod
    public void getPairedPrinters(PluginCall call) {
        if (!hasBluetoothPermission()) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                requestPermissionForAlias("bluetoothConnect", call, "permissionCallback");
            } else {
                requestPermissionForAlias("bluetooth", call, "permissionCallback");
            }
            return;
        }

        try {
            BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
            if (adapter == null) {
                call.reject("Perangkat HP tidak memiliki modul Bluetooth");
                return;
            }

            if (!adapter.isEnabled()) {
                call.reject("Bluetooth di HP Anda belum aktif. Silakan nyalakan Bluetooth terlebih dahulu.");
                return;
            }

            Set<BluetoothDevice> pairedDevices = adapter.getBondedDevices();
            JSArray list = new JSArray();

            SharedPreferences prefs = getContext().getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
            String lastSavedAddress = prefs.getString(KEY_LAST_ADDRESS, "");

            if (pairedDevices != null) {
                for (BluetoothDevice device : pairedDevices) {
                    JSObject item = new JSObject();
                    item.put("name", device.getName() != null ? device.getName() : "Printer Bluetooth");
                    item.put("address", device.getAddress());
                    item.put("type", device.getType());
                    item.put("isLastConnected", device.getAddress().equalsIgnoreCase(lastSavedAddress));
                    list.put(item);
                }
            }

            JSObject ret = new JSObject();
            ret.put("devices", list);
            ret.put("count", list.length());
            ret.put("lastConnectedAddress", lastSavedAddress);
            call.resolve(ret);
        } catch (SecurityException se) {
            call.reject("Izin akses Bluetooth ditolak: " + se.getMessage());
        } catch (Exception e) {
            call.reject("Gagal membaca daftar perangkat Bluetooth: " + e.getMessage());
        }
    }

    @PermissionCallback
    private void permissionCallback(PluginCall call) {
        if (hasBluetoothPermission()) {
            getPairedPrinters(call);
        } else {
            call.reject("Izin Bluetooth diperlukan untuk menghubungkan printer thermal.");
        }
    }

    @PermissionCallback
    private void connectPermissionCallback(PluginCall call) {
        if (hasBluetoothPermission()) {
            connect(call);
        } else {
            call.reject("Izin Bluetooth diperlukan untuk menghubungkan printer thermal.");
        }
    }

    @PermissionCallback
    private void autoConnectPermissionCallback(PluginCall call) {
        if (hasBluetoothPermission()) {
            autoConnect(call);
        } else {
            call.reject("Izin Bluetooth belum aktif");
        }
    }

    @PluginMethod
    public void connect(PluginCall call) {
        String address = call.getString("address");
        if (address == null || address.trim().isEmpty()) {
            // Coba gunakan address terakhir dari preferences
            SharedPreferences prefs = getContext().getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
            address = prefs.getString(KEY_LAST_ADDRESS, null);
            if (address == null) {
                call.reject("Alamat MAC printer (address) tidak valid dan belum ada perangkat yang tersimpan");
                return;
            }
        }

        if (!hasBluetoothPermission()) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                requestPermissionForAlias("bluetoothConnect", call, "connectPermissionCallback");
            } else {
                requestPermissionForAlias("bluetooth", call, "connectPermissionCallback");
            }
            return;
        }

        final String targetAddress = address;
        executor.execute(() -> {
            boolean ok = connectInternal(targetAddress);
            if (ok) {
                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("name", connectedName);
                ret.put("address", connectedAddress);
                call.resolve(ret);
            } else {
                call.reject("Gagal terhubung ke printer. Pastikan printer menyala dan dalam jangkauan.");
            }
        });
    }

    @PluginMethod
    public void autoConnect(PluginCall call) {
        if (socket != null && socket.isConnected() && outputStream != null) {
            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("name", connectedName);
            ret.put("address", connectedAddress);
            ret.put("alreadyConnected", true);
            call.resolve(ret);
            return;
        }

        if (!hasBluetoothPermission()) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                requestPermissionForAlias("bluetoothConnect", call, "autoConnectPermissionCallback");
            } else {
                requestPermissionForAlias("bluetooth", call, "autoConnectPermissionCallback");
            }
            return;
        }

        executor.execute(() -> {
            SharedPreferences prefs = getContext().getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
            String lastAddress = prefs.getString(KEY_LAST_ADDRESS, null);
            if (lastAddress == null) {
                call.reject("Belum ada printer yang tersimpan untuk dihubungkan ulang");
                return;
            }

            boolean ok = connectInternal(lastAddress);
            if (ok) {
                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("name", connectedName);
                ret.put("address", connectedAddress);
                call.resolve(ret);
            } else {
                call.reject("Printer terakhir (" + lastAddress + ") tidak merespons. Pastikan printer menyala.");
            }
        });
    }

    @PluginMethod
    public void getLastConnectedDevice(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        String lastAddress = prefs.getString(KEY_LAST_ADDRESS, null);
        String lastName = prefs.getString(KEY_LAST_NAME, null);

        JSObject ret = new JSObject();
        ret.put("hasDevice", lastAddress != null);
        ret.put("address", lastAddress);
        ret.put("name", lastName);
        call.resolve(ret);
    }

    @PluginMethod
    public void disconnect(PluginCall call) {
        executor.execute(() -> {
            disconnectInternal();
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        });
    }

    @PluginMethod
    public void isConnected(PluginCall call) {
        boolean connected = socket != null && socket.isConnected() && outputStream != null;
        JSObject ret = new JSObject();
        ret.put("connected", connected);
        ret.put("name", connectedName);
        ret.put("address", connectedAddress);
        call.resolve(ret);
    }

    @PluginMethod
    public void printRaw(PluginCall call) {
        String base64Data = call.getString("data");
        if (base64Data == null || base64Data.isEmpty()) {
            call.reject("Data cetak tidak boleh kosong");
            return;
        }

        executor.execute(() -> {
            // Auto-reconnect jika socket mati tapi printer pernah terhubung
            if (socket == null || !socket.isConnected() || outputStream == null) {
                SharedPreferences prefs = getContext().getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
                String lastAddress = prefs.getString(KEY_LAST_ADDRESS, null);
                if (lastAddress != null) {
                    Log.d(TAG, "Socket terputus, mencoba auto-reconnect cepat sebelum cetak ke: " + lastAddress);
                    boolean reconnected = connectInternal(lastAddress);
                    if (!reconnected) {
                        call.reject("Printer terputus dan gagal menyambung kembali. Pastikan printer menyala.");
                        return;
                    }
                } else {
                    call.reject("Printer belum terhubung. Silakan sambungkan printer terlebih dahulu.");
                    return;
                }
            }

            try {
                byte[] bytes = Base64.decode(base64Data, Base64.DEFAULT);
                outputStream.write(bytes);
                outputStream.flush();

                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("bytesWritten", bytes.length);
                call.resolve(ret);
            } catch (IOException e) {
                Log.e(TAG, "Gagal mengirim data ke printer: " + e.getMessage(), e);
                disconnectInternal();
                call.reject("Koneksi printer terputus saat mencetak: " + e.getMessage());
            } catch (Exception e) {
                Log.e(TAG, "Kesalahan cetak: " + e.getMessage(), e);
                call.reject("Gagal mencetak: " + e.getMessage());
            }
        });
    }

    @PluginMethod
    public void printSystem(PluginCall call) {
        String htmlContent = call.getString("html");
        String jobName = call.getString("jobName", "Struk_Komazi_POS");

        if (htmlContent == null || htmlContent.isEmpty()) {
            call.reject("Konten HTML struk tidak boleh kosong");
            return;
        }

        getActivity().runOnUiThread(() -> {
            try {
                WebView printWebView = new WebView(getContext());
                printWebView.loadDataWithBaseURL(null, htmlContent, "text/html", "utf-8", null);

                PrintManager printManager = (PrintManager) getActivity().getSystemService(Context.PRINT_SERVICE);
                if (printManager == null) {
                    call.reject("Layanan PrintManager sistem Android tidak tersedia.");
                    return;
                }

                PrintDocumentAdapter printAdapter = printWebView.createPrintDocumentAdapter(jobName);
                PrintAttributes.Builder builder = new PrintAttributes.Builder();
                builder.setColorMode(PrintAttributes.COLOR_MODE_MONOCHROME);
                builder.setMediaSize(PrintAttributes.MediaSize.UNKNOWN_PORTRAIT);

                printManager.print(jobName, printAdapter, builder.build());

                JSObject ret = new JSObject();
                ret.put("success", true);
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("Gagal membuka dialog cetak Android: " + e.getMessage());
            }
        });
    }
}
