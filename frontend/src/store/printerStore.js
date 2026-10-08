import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import WebBluetoothReceiptPrinter from '@point-of-sale/webbluetooth-receipt-printer';
import { toast } from './toastStore';
import { buildTestReceiptEscPos, buildOrderReceiptEscPos } from '../utils/escpos';
import { AndroidPrinter } from '../adapters/printer/printer.android';
import { isAndroid, isNative } from '../services/platform';

// Known Bluetooth thermal printer service UUIDs (standard & vendor custom)
export const BT_PRINTER_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb', // Standard POS print service
  '6e400001-b5a3-f393-e0a9-e50e24dcca9e', // Nordic UART Service (Goojprt, MPT-II, PT-210, POS-58, Xprinter)
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC transparent UART (very common on Chinese printers)
  '49535343-1e4d-4bd9-ba61-23c647249616', // ISSC alternative
  '0000ff00-0000-1000-8000-00805f9b34fb', // Generic thermal printer
  '0000ffe0-0000-1000-8000-00805f9b34fb', // HM-10 / CC2541 / BLE Serial module
  '0000fee7-0000-1000-8000-00805f9b34fb', // Tencent / IoT printer
  '0000fff0-0000-1000-8000-00805f9b34fb', // Generic printer alt
  '0000ae00-0000-1000-8000-00805f9b34fb',
  '0000af00-0000-1000-8000-00805f9b34fb',
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
  'de5bf728-d711-4e47-af26-65e3012a5dc7',
];

// Hardware singletons kept in module memory
let receiptPrinterInstance = null;
let hasWebBluetoothConnected = false;
let activeBluetoothDevice = null;
let activeGattServer = null;
let activeCharacteristic = null;
let activeSerialPort = null;

/**
 * Lazy initialization of WebBluetoothReceiptPrinter singleton
 * Safely guards against non-browser / non-WebBluetooth environments
 */
function getWebBluetoothPrinter(set, get) {
  if (typeof window === 'undefined' || !navigator?.bluetooth) return null;
  if (!receiptPrinterInstance) {
    try {
      receiptPrinterInstance = new WebBluetoothReceiptPrinter();

      // Listen for successful connection event from the package
      receiptPrinterInstance.addEventListener('connected', (device) => {
        hasWebBluetoothConnected = true;
        set({
          isConnected: true,
          isConnecting: false,
          connectionType: 'BLUETOOTH',
          connectedDeviceName: device.name || 'Printer Bluetooth',
        });
        toast.success(`Berhasil terhubung ke: ${device.name || 'Printer Bluetooth'}`);
      });

      // Listen for disconnection event from the package
      receiptPrinterInstance.addEventListener('disconnected', () => {
        hasWebBluetoothConnected = false;
        set({
          isConnected: false,
          isConnecting: false,
          connectedDeviceName: null,
        });
        toast.warning('Koneksi printer Bluetooth terputus.');
      });
    } catch (err) {
      console.warn('[PrinterStore] Failed to initialize WebBluetoothReceiptPrinter:', err);
    }
  }
  return receiptPrinterInstance;
}

/**
 * Robust fallback scanner to resolve writable BLE characteristic
 * on non-standard Chinese thermal printers (SPP/UART)
 */
async function resolveWritableCharacteristic(server) {
  // Method 1: Query primary services
  try {
    const services = await server.getPrimaryServices();
    for (const service of services) {
      try {
        const chars = await service.getCharacteristics();
        const writable = chars.find(
          (c) => c.properties.write || c.properties.writeWithoutResponse
        );
        if (writable) return writable;
      } catch {}
    }
  } catch {}

  // Method 2: Try known thermal printer UUID list
  for (const uuid of BT_PRINTER_SERVICES) {
    try {
      const service = await server.getPrimaryService(uuid);
      const chars = await service.getCharacteristics();
      const writable = chars.find(
        (c) => c.properties.write || c.properties.writeWithoutResponse
      );
      if (writable) return writable;
    } catch {}
  }

  return null;
}

export const usePrinterStore = create(
  persist(
    (set, get) => ({
      // Printer Configuration
      connectionType: 'BROWSER', // 'BROWSER' | 'BLUETOOTH' | 'USB'
      paperWidth: '58mm', // '58mm' | '80mm'
      autoPrintOnCheckout: false,
      printCopies: 1,
      kickCashDrawer: true,

      // Connection Status
      isConnected: false,
      isConnecting: false,
      connectedDeviceName: null,
      connectedDeviceAddress: null,
      lastTestedAt: null,

      // Android Paired Devices List
      pairedDevices: [],
      isLoadingPairedDevices: false,

      // Setters
      setPaperWidth: (paperWidth) => set({ paperWidth }),
      setConnectionType: (connectionType) => set({ connectionType }),
      setAutoPrintOnCheckout: (autoPrintOnCheckout) => set({ autoPrintOnCheckout }),
      setPrintCopies: (printCopies) => set({ printCopies }),
      setKickCashDrawer: (kickCashDrawer) => set({ kickCashDrawer }),

      // Load Paired Bluetooth Devices on Android
      loadPairedDevices: async () => {
        if (isAndroid || isNative) {
          set({ isLoadingPairedDevices: true });
          try {
            const devices = await AndroidPrinter.getDevices();
            set({ pairedDevices: devices, isLoadingPairedDevices: false });
            return devices;
          } catch (err) {
            set({ isLoadingPairedDevices: false });
            return [];
          }
        }
        return [];
      },

      // 1. Direct Connection (Android Native address or Web GATT device)
      connectBluetoothDevice: async (device) => {
        if (!device) return { success: false, message: 'Tidak ada perangkat yang dipilih' };
        if (get().isConnecting) return { success: false, message: 'Proses koneksi sedang berjalan' };

        // A. Android Native Platform
        if (isAndroid || isNative) {
          set({ isConnecting: true });
          const address = typeof device === 'string' ? device : (device?.address || device?.id);
          const name = device?.name || 'Printer Bluetooth';
          try {
            const res = await AndroidPrinter.connect(address);
            if (res.success) {
              set({
                isConnected: true,
                isConnecting: false,
                connectionType: 'BLUETOOTH',
                connectedDeviceName: res.name || name,
                connectedDeviceAddress: res.address || address,
              });
              toast.success(`Berhasil terhubung ke: ${res.name || name}`);
              return { success: true, name: res.name || name };
            }
            set({ isConnecting: false });
            toast.error(res.message || 'Gagal menyambungkan ke printer');
            return res;
          } catch (err) {
            set({ isConnecting: false });
            toast.error(`Koneksi Bluetooth gagal: ${err.message}`);
            return { success: false, message: err.message };
          }
        }

        // B. Web GATT
        set({ isConnecting: true });
        try {
          const connectPromise = device.gatt.connect();
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(
              () =>
                reject(
                  new Error(
                    'Koneksi timeout (8 detik). Pastikan printer menyala, dalam jangkauan, dan tidak terhubung ke HP lain.'
                  )
                ),
              8000
            )
          );

          const server = await Promise.race([connectPromise, timeoutPromise]);
          activeGattServer = server;
          activeBluetoothDevice = device;

          const writable = await resolveWritableCharacteristic(server);
          if (!writable) {
            try {
              if (server.connected) server.disconnect();
            } catch {}
            throw new Error(
              'Printer terhubung tetapi tidak memiliki karakteristik tulis BLE (SPP). Jika ini printer Bluetooth Classic, gunakan mode "Driver Windows / Mac" atau port USB.'
            );
          }

          activeCharacteristic = writable;

          const onDisconnected = () => {
            activeBluetoothDevice = null;
            activeGattServer = null;
            activeCharacteristic = null;
            set({
              isConnected: false,
              isConnecting: false,
              connectedDeviceName: null,
              connectedDeviceAddress: null,
            });
            toast.warning('Koneksi printer Bluetooth terputus.');
          };

          device.removeEventListener('gattserverdisconnected', onDisconnected);
          device.addEventListener('gattserverdisconnected', onDisconnected);

          set({
            isConnected: true,
            isConnecting: false,
            connectionType: 'BLUETOOTH',
            connectedDeviceName: device.name || 'Printer Bluetooth',
          });

          toast.success(`Berhasil terhubung ke: ${device.name || 'Printer Bluetooth'}`);
          return { success: true, name: device.name };
        } catch (err) {
          set({ isConnecting: false });
          activeBluetoothDevice = null;
          activeGattServer = null;
          activeCharacteristic = null;
          toast.error(`Koneksi Bluetooth gagal: ${err.message}`);
          return { success: false, message: err.message };
        }
      },

      // 2. Scan and Connect via Bluetooth
      connectBluetooth: async (options = {}) => {
        // A. Jalur Native Android APK
        if (isAndroid || isNative) {
          if (get().isConnecting) return { success: false, message: 'Sedang menghubungkan...' };

          // Jika ada perangkat spesifik
          if (options.address || options.device) {
            return await get().connectBluetoothDevice(options.device || options.address);
          }

          set({ isConnecting: true });
          try {
            const devices = await AndroidPrinter.getDevices();
            set({ pairedDevices: devices, isConnecting: false });

            if (devices.length === 1) {
              // Jika hanya ada 1 printer yang ter-pair di HP: langsung connect!
              return await get().connectBluetoothDevice(devices[0]);
            }

            if (devices.length === 0) {
              toast.error(
                'Tidak ada printer Bluetooth yang dipasangkan. Buka Pengaturan Bluetooth HP Anda lalu pasangkan (Pair) printer kasir terlebih dahulu.'
              );
              return {
                success: false,
                needPairing: true,
                message: 'Silakan pasangkan printer di menu Bluetooth HP terlebih dahulu.',
              };
            }

            // Lebih dari 1 perangkat, minta user memilih
            return {
              success: false,
              needSelectDevice: true,
              devices,
              message: 'Pilih printer dari daftar perangkat yang tersedia.',
            };
          } catch (err) {
            set({ isConnecting: false });
            toast.error(`Gagal mencari perangkat: ${err.message}`);
            return { success: false, message: err.message };
          }
        }

        // B. Jalur Web Browser (Chrome/Edge Web Bluetooth)
        if (typeof navigator === 'undefined' || !navigator.bluetooth) {
          toast.error(
            'Browser Anda belum mendukung Web Bluetooth. Gunakan Google Chrome atau Edge melalui koneksi HTTPS.'
          );
          return { success: false, message: 'Web Bluetooth not supported' };
        }

        if (window.isSecureContext === false) {
          toast.error(
            'Web Bluetooth memerlukan koneksi aman (HTTPS atau localhost). Gunakan mode Driver Windows untuk mencetak di HTTP.'
          );
          return { success: false, message: 'Insecure context' };
        }

        if (get().isConnecting) return { success: false, message: 'Sedang menghubungkan...' };

        set({ isConnecting: true });

        const printer = getWebBluetoothPrinter(set, get);

        if (printer && !options.useBroadScan) {
          try {
            await printer.connect();
            if (get().isConnected) {
              set({ isConnecting: false });
              return { success: true, name: get().connectedDeviceName };
            }
          } catch (err) {
            if (err.name === 'NotFoundError') {
              set({ isConnecting: false });
              return { success: false, cancelled: true };
            }
            console.warn('[PrinterStore] Package connect did not finish, attempting broad BLE scan:', err);
          }
        }

        try {
          const device = await navigator.bluetooth.requestDevice({
            acceptAllDevices: true,
            optionalServices: BT_PRINTER_SERVICES,
          });

          if (!device) {
            set({ isConnecting: false });
            return { success: false, message: 'Batal memilih perangkat' };
          }

          return await get().connectBluetoothDevice(device);
        } catch (err) {
          set({ isConnecting: false });
          if (err.name === 'NotFoundError') {
            return { success: false, cancelled: true };
          }
          toast.error(`Gagal menghubungkan printer: ${err.message || 'Periksa koneksi Bluetooth'}`);
          return { success: false, message: err.message };
        }
      },

      // 3. Connect via Web Serial (USB Thermal Printer)
      connectUsb: async () => {
        if (!navigator?.serial) {
          toast.error(
            'Web Serial API tidak didukung pada browser ini. Gunakan Google Chrome/Edge di desktop.'
          );
          return { success: false, message: 'Web Serial not supported' };
        }

        set({ isConnecting: true });
        try {
          const port = await navigator.serial.requestPort();
          await port.open({ baudRate: 9600 });

          activeSerialPort = port;

          set({
            isConnected: true,
            isConnecting: false,
            connectionType: 'USB',
            connectedDeviceName: 'Printer Thermal USB (COM)',
          });

          toast.success('Berhasil terhubung ke Printer USB!');
          return { success: true };
        } catch (err) {
          set({ isConnecting: false });
          if (err.name === 'NotFoundError') return { success: false, cancelled: true };
          toast.error(`Gagal koneksi USB: ${err.message}`);
          return { success: false, message: err.message };
        }
      },

      // 4. Disconnect Printer Cleanly
      disconnectPrinter: async () => {
        // Android Native disconnect
        if (isAndroid || isNative) {
          try {
            await AndroidPrinter.disconnect();
          } catch (e) {
            console.warn('[PrinterStore] Android disconnect error:', e);
          }
        }

        // Disconnect WebBluetoothReceiptPrinter package instance if active
        if (receiptPrinterInstance && hasWebBluetoothConnected) {
          try {
            await receiptPrinterInstance.disconnect();
          } catch (e) {
            console.warn('[PrinterStore] Error disconnecting WebBluetoothReceiptPrinter:', e);
          }
        }
        hasWebBluetoothConnected = false;

        // Disconnect direct GATT or USB handles
        try {
          if (activeGattServer && activeGattServer.connected) {
            activeGattServer.disconnect();
          }
          if (activeBluetoothDevice && activeBluetoothDevice.gatt?.connected) {
            activeBluetoothDevice.gatt.disconnect();
          }
          if (activeSerialPort) {
            activeSerialPort.close().catch(() => {});
          }
        } catch {}

        activeBluetoothDevice = null;
        activeGattServer = null;
        activeCharacteristic = null;
        activeSerialPort = null;

        set({
          isConnected: false,
          isConnecting: false,
          connectedDeviceName: null,
          connectedDeviceAddress: null,
          connectionType: 'BROWSER',
        });
        toast.info('Printer diputus.');
      },

      // 5. Send Raw Binary ESC/POS Data
      sendRawData: async (uint8Data) => {
        const { connectionType } = get();

        // A. Bluetooth transmission
        if (connectionType === 'BLUETOOTH') {
          // Native Android Plugin (SPP Serial RFCOMM)
          if (isAndroid || isNative) {
            try {
              const res = await AndroidPrinter.printRaw(uint8Data);
              if (res && res.success) {
                return true;
              }
              throw new Error('Gagal mengirim data cetak ke printer');
            } catch (nativeErr) {
              console.error('[PrinterStore] Android native print error:', nativeErr);
              throw nativeErr;
            }
          }

          // Web Bluetooth: Priority 1 - Package queue
          if (receiptPrinterInstance && hasWebBluetoothConnected) {
            try {
              await receiptPrinterInstance.print(uint8Data);
              return true;
            } catch (printErr) {
              console.warn('[PrinterStore] WebBluetoothReceiptPrinter.print failed, attempting direct characteristic fallback:', printErr);
            }
          }

          // Web Bluetooth: Priority 2 - Direct BLE GATT
          if (!activeCharacteristic && activeGattServer && activeGattServer.connected) {
            activeCharacteristic = await resolveWritableCharacteristic(activeGattServer);
          }

          if (!activeCharacteristic) {
            set({ isConnected: false });
            throw new Error('Printer tidak terhubung atau karakteristik tulis tidak ditemukan.');
          }

          try {
            const chunkSize = 20;
            for (let i = 0; i < uint8Data.length; i += chunkSize) {
              const chunk = uint8Data.slice(i, i + chunkSize);
              if (activeCharacteristic.writeValueWithoutResponse) {
                await activeCharacteristic.writeValueWithoutResponse(chunk);
              } else {
                await activeCharacteristic.writeValue(chunk);
              }
              await new Promise((r) => setTimeout(r, 15));
            }
            return true;
          } catch (writeErr) {
            activeCharacteristic = null;
            set({ isConnected: false });
            throw new Error(`Gagal mengirim data ke printer Bluetooth: ${writeErr.message}`);
          }
        }

        // B. USB Serial transmission
        if (connectionType === 'USB' && activeSerialPort && activeSerialPort.writable) {
          const writer = activeSerialPort.writable.getWriter();
          await writer.write(uint8Data);
          writer.releaseLock();
          return true;
        }

        return false;
      },

      // 6. Trigger Test Print (Encodes test receipt with esc-pos-encoder & prints)
      testPrint: async (storeSettings = {}) => {
        const { connectionType, paperWidth, isConnected, sendRawData } = get();

        if ((connectionType === 'BLUETOOTH' || connectionType === 'USB') && isConnected) {
          try {
            toast.info('Mengirim data uji coba ke printer...');
            const bytes = buildTestReceiptEscPos(paperWidth, storeSettings);
            const ok = await sendRawData(bytes);
            if (ok) {
              set({ lastTestedAt: new Date().toISOString() });
              toast.success('Struk uji coba berhasil dicetak ke printer fisik!');
              return true;
            }
          } catch (err) {
            toast.error(`Gagal test print: ${err.message}`);
            return false;
          }
        }

        return false;
      },

      // 7. Auto-Reconnect to Last Connected Printer (On App Start / App Resume)
      autoConnectPrinter: async (silent = true) => {
        const { isConnected, isConnecting, connectedDeviceAddress, connectionType } = get();
        if (isConnected || isConnecting) return { success: true };

        if (isAndroid || isNative) {
          try {
            // Priority 1: Native plugin auto-connect (reads last saved SharedPreferences MAC)
            const res = await AndroidPrinter.autoConnect();
            if (res && res.success) {
              set({
                isConnected: true,
                isConnecting: false,
                connectionType: 'BLUETOOTH',
                connectedDeviceName: res.name || get().connectedDeviceName || 'Printer Bluetooth',
                connectedDeviceAddress: res.address || connectedDeviceAddress,
              });
              if (!silent) toast.success(`Printer otomatis terhubung: ${res.name || 'Printer Bluetooth'}`);
              return { success: true, name: res.name };
            }

            // Priority 2: Direct connection via stored address in zustand state
            if (connectedDeviceAddress) {
              const directRes = await AndroidPrinter.connect(connectedDeviceAddress);
              if (directRes && directRes.success) {
                set({
                  isConnected: true,
                  isConnecting: false,
                  connectionType: 'BLUETOOTH',
                  connectedDeviceName: directRes.name,
                  connectedDeviceAddress: directRes.address,
                });
                if (!silent) toast.success(`Printer otomatis terhubung: ${directRes.name}`);
                return { success: true, name: directRes.name };
              }
            }
          } catch (err) {
            console.warn('[PrinterStore] autoConnectPrinter notice:', err);
          }
        }
        return { success: false };
      },
    }),
    {
      name: 'komazi-printer-storage',
      partialize: (state) => ({
        connectionType: state.connectionType,
        paperWidth: state.paperWidth,
        autoPrintOnCheckout: state.autoPrintOnCheckout,
        printCopies: state.printCopies,
        kickCashDrawer: state.kickCashDrawer,
        connectedDeviceName: state.connectedDeviceName,
        connectedDeviceAddress: state.connectedDeviceAddress,
        lastTestedAt: state.lastTestedAt,
      }),
    }
  )
);
