import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import WebBluetoothReceiptPrinter from '@point-of-sale/webbluetooth-receipt-printer';
import { toast } from './toastStore';
import { buildTestReceiptEscPos, buildOrderReceiptEscPos, buildKitchenTicketEscPos } from '../utils/escpos';
import { AndroidPrinter } from '../adapters/printer/printer.android';
import { isAndroid, isNative } from '../services/platform';
import { api } from '../services/api';

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
 * Sanitizes hardware and browser Web Bluetooth/Serial error messages
 * into user-friendly Indonesian messages for cashier staff.
 */
function formatFriendlyPrinterError(err) {
  if (!err) return 'Terjadi kendala pada printer.';
  const msg = typeof err === 'string' ? err : err.message || String(err);
  const name = err.name || '';

  if (name === 'NotFoundError' || msg.includes('cancelled') || msg.includes('User cancelled') || msg.includes('No port selected')) {
    return 'Pemilihan perangkat printer dibatalkan.';
  }
  if (msg.includes('adapter not available') || msg.includes('powered off') || msg.includes('Bluetooth adapter not powered')) {
    return 'Bluetooth tidak aktif. Silakan nyalakan Bluetooth pada perangkat Anda.';
  }
  if (msg.includes('GATT Server is disconnected') || msg.includes('gattserverdisconnected') || msg.includes('Connection failed')) {
    return 'Koneksi ke printer terputus. Pastikan printer dalam jangkauan dan daya baterai mencukupi.';
  }
  if (msg.includes('timeout') || msg.includes('timed out')) {
    return 'Batas waktu koneksi terlampaui. Pastikan printer menyala dan tidak sedang terhubung ke perangkat lain.';
  }
  if (msg.includes('SPP') || msg.includes('karakteristik tulis BLE')) {
    return 'Printer tidak mendukung mode transmisi BLE standar. Gunakan kabel USB atau driver sistem.';
  }
  if (msg.includes('Access denied') || msg.includes('Failed to open serial port') || msg.includes('device is already open')) {
    return 'Port printer sedang digunakan aplikasi lain atau akses tidak diizinkan.';
  }

  return `Kendala printer: ${msg}`;
}

/**
 * Lazy initialization of WebBluetoothReceiptPrinter singleton
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
 */
async function resolveWritableCharacteristic(server) {
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
      // Local Hardware Configuration & Connection Status
      connectionType: 'BROWSER', // 'BROWSER' | 'BLUETOOTH' | 'USB' | 'NETWORK'
      paperWidth: '58mm', // '58mm' | '80mm'
      autoPrintOnCheckout: false,
      autoPrintKitchenOnCheckout: false,
      printCopies: 1,
      kickCashDrawer: true,

      isConnected: false,
      isConnecting: false,
      connectedDeviceName: null,
      connectedDeviceAddress: null,
      lastTestedAt: null,

      pairedDevices: [],
      isLoadingPairedDevices: false,

      // Database Profiles & Settings
      profiles: [],
      isLoadingProfiles: false,
      activeReceiptPrinter: null,
      activeKitchenPrinter: null,

      receiptSettings: null,
      isLoadingReceiptSettings: false,

      kitchenRoutes: [],
      isLoadingKitchenRoutes: false,

      printJobs: [],
      printJobsMeta: { page: 1, limit: 20, total: 0, totalPages: 1 },
      isLoadingPrintJobs: false,

      isPrinting: false,
      error: null,

      // Local Setters
      setPaperWidth: (paperWidth) => set({ paperWidth }),
      setConnectionType: (connectionType) => set({ connectionType }),
      setAutoPrintOnCheckout: (autoPrintOnCheckout) => set({ autoPrintOnCheckout }),
      setAutoPrintKitchenOnCheckout: (autoPrintKitchenOnCheckout) => set({ autoPrintKitchenOnCheckout }),
      setPrintCopies: (printCopies) => set({ printCopies }),
      setKickCashDrawer: (kickCashDrawer) => set({ kickCashDrawer }),

      // -------------------------------------------------------------
      // BACKEND API INTEGRATIONS
      // -------------------------------------------------------------

      // 1. Fetch Printer Profiles
      fetchProfiles: async () => {
        try {
          set({ isLoadingProfiles: true, error: null });
          const res = await api.printers.getAll();
          if (res && res.success && Array.isArray(res.data)) {
            const profiles = res.data;
            const defaultReceipt = profiles.find((p) => p.isDefaultReceipt && p.isActive);
            const defaultKitchen = profiles.find((p) => p.isDefaultKitchen && p.isActive);

            set({
              profiles,
              activeReceiptPrinter: defaultReceipt || null,
              activeKitchenPrinter: defaultKitchen || null,
              isLoadingProfiles: false,
            });

            // Sync paper width with default receipt profile if present
            if (defaultReceipt && defaultReceipt.paperWidthMm) {
              set({ paperWidth: `${defaultReceipt.paperWidthMm}mm` });
            }

            return profiles;
          }
          set({ isLoadingProfiles: false });
          return get().profiles;
        } catch (err) {
          console.error('[PrinterStore] fetchProfiles error:', err);
          set({ isLoadingProfiles: false, error: err.message });
          return get().profiles;
        }
      },

      // 2. Create Printer Profile
      createProfile: async (profileData) => {
        try {
          set({ isLoadingProfiles: true });
          const res = await api.printers.create(profileData);
          if (res && res.success && res.data) {
            toast.success(`Profil printer "${res.data.name}" berhasil dibuat`);
            await get().fetchProfiles();
            return res.data;
          }
          throw new Error(res?.message || 'Gagal menambahkan profil printer');
        } catch (err) {
          set({ isLoadingProfiles: false });
          toast.error(err.message);
          throw err;
        }
      },

      // 3. Update Printer Profile
      updateProfile: async (id, profileData) => {
        try {
          set({ isLoadingProfiles: true });
          const res = await api.printers.update(id, profileData);
          if (res && res.success && res.data) {
            toast.success(`Profil printer "${res.data.name}" diperbarui`);
            await get().fetchProfiles();
            return res.data;
          }
          throw new Error(res?.message || 'Gagal memperbarui profil printer');
        } catch (err) {
          set({ isLoadingProfiles: false });
          toast.error(err.message);
          throw err;
        }
      },

      // 4. Delete Printer Profile
      deleteProfile: async (id) => {
        try {
          set({ isLoadingProfiles: true });
          const res = await api.printers.delete(id);
          if (res && res.success) {
            toast.success('Profil printer berhasil dihapus');
            await get().fetchProfiles();
            return true;
          }
          throw new Error(res?.message || 'Gagal menghapus profil printer');
        } catch (err) {
          set({ isLoadingProfiles: false });
          toast.error(err.message);
          throw err;
        }
      },

      // 5. Fetch Receipt Settings
      fetchReceiptSettings: async () => {
        try {
          set({ isLoadingReceiptSettings: true });
          const res = await api.printerSettings.getReceipt();
          if (res && res.success && res.data) {
            set({ receiptSettings: res.data, isLoadingReceiptSettings: false });
            return res.data;
          }
          set({ isLoadingReceiptSettings: false });
          return get().receiptSettings;
        } catch (err) {
          console.error('[PrinterStore] fetchReceiptSettings error:', err);
          set({ isLoadingReceiptSettings: false });
          return get().receiptSettings;
        }
      },

      // 6. Save Receipt Settings
      saveReceiptSettings: async (settingsData) => {
        try {
          set({ isLoadingReceiptSettings: true });
          const res = await api.printerSettings.updateReceipt(settingsData);
          if (res && res.success && res.data) {
            set({ receiptSettings: res.data, isLoadingReceiptSettings: false });
            toast.success('Pengaturan format struk berhasil disimpan');
            return res.data;
          }
          throw new Error(res?.message || 'Gagal menyimpan pengaturan struk');
        } catch (err) {
          set({ isLoadingReceiptSettings: false });
          toast.error(err.message);
          throw err;
        }
      },

      // 7. Fetch Kitchen Routes
      fetchKitchenRoutes: async () => {
        try {
          set({ isLoadingKitchenRoutes: true });
          const res = await api.kitchenRoutes.getAll();
          if (res && res.success && Array.isArray(res.data)) {
            set({ kitchenRoutes: res.data, isLoadingKitchenRoutes: false });
            return res.data;
          }
          set({ isLoadingKitchenRoutes: false });
          return get().kitchenRoutes;
        } catch (err) {
          console.error('[PrinterStore] fetchKitchenRoutes error:', err);
          set({ isLoadingKitchenRoutes: false });
          return get().kitchenRoutes;
        }
      },

      // 8. Save Kitchen Routes
      saveKitchenRoutes: async (routes) => {
        try {
          set({ isLoadingKitchenRoutes: true });
          const res = await api.kitchenRoutes.update({ routes });
          if (res && res.success && Array.isArray(res.data)) {
            set({ kitchenRoutes: res.data, isLoadingKitchenRoutes: false });
            toast.success('Rute printer dapur berhasil diperbarui');
            return res.data;
          }
          throw new Error(res?.message || 'Gagal menyimpan rute printer dapur');
        } catch (err) {
          set({ isLoadingKitchenRoutes: false });
          toast.error(err.message);
          throw err;
        }
      },

      // 9. Fetch Print Jobs History
      fetchPrintJobs: async (params = {}) => {
        try {
          set({ isLoadingPrintJobs: true });
          const res = await api.printJobs.getAll(params);
          if (res && res.success && res.data) {
            set({
              printJobs: res.data.jobs || [],
              printJobsMeta: res.data.meta || {
                page: res.data.page || 1,
                limit: res.data.limit || 20,
                total: res.data.total ?? (res.data.jobs?.length || 0),
                totalPages: res.data.totalPages || 1,
              },
              isLoadingPrintJobs: false,
            });
            return res.data;
          }
          set({ isLoadingPrintJobs: false });
          return { jobs: [], meta: {} };
        } catch (err) {
          console.error('[PrinterStore] fetchPrintJobs error:', err);
          set({ isLoadingPrintJobs: false });
          return { jobs: [], meta: {} };
        }
      },

      // 10. Record Print Job to Backend Audit Log
      recordPrintJob: async (jobData) => {
        try {
          const res = await api.printJobs.create(jobData);
          if (res && res.success) {
            return res.data;
          }
        } catch (err) {
          console.warn('[PrinterStore] recordPrintJob warning:', err);
        }
        return null;
      },

      // 11. Retry Print Job
      retryPrintJob: async (id) => {
        try {
          const res = await api.printJobs.retry(id);
          if (res && res.success) {
            toast.success('Pekerjaan cetak dijadwalkan ulang');
            await get().fetchPrintJobs();
            return res.data;
          }
          throw new Error(res?.message || 'Gagal mencoba kembali cetak');
        } catch (err) {
          toast.error(err.message);
          throw err;
        }
      },

      // 12. Reprint Print Job
      reprintPrintJob: async (id) => {
        try {
          const res = await api.printJobs.reprint(id);
          if (res && res.success) {
            toast.success('Struk berhasil didaftarkan untuk cetak ulang');
            await get().fetchPrintJobs();
            return res.data;
          }
          throw new Error(res?.message || 'Gagal mencetak ulang');
        } catch (err) {
          toast.error(err.message);
          throw err;
        }
      },

      // -------------------------------------------------------------
      // TRANSACTIONAL PRINT ACTIONS (RECEIPT & KITCHEN TICKET)
      // -------------------------------------------------------------

      // Print Receipt For Completed Order
      printReceiptForOrder: async (order, options = {}) => {
        if (!order) return { success: false, message: 'Data pesanan kosong' };
        const { isConnected, paperWidth, sendRawData, activeReceiptPrinter, receiptSettings, recordPrintJob } = get();

        const effectivePaperWidth = activeReceiptPrinter?.paperWidthMm
          ? `${activeReceiptPrinter.paperWidthMm}mm`
          : paperWidth;

        let printSuccess = false;
        let errorMessage = null;

        try {
          // If direct hardware is connected, build ESC/POS payload & print
          if (isConnected) {
            const rawBytes = buildOrderReceiptEscPos(order, {
              paperWidth: effectivePaperWidth,
              storeSettings: receiptSettings || {},
              ...options,
            });

            printSuccess = await sendRawData(rawBytes);
          } else {
            // Not physically connected (browser mode / waiting)
            printSuccess = false;
            errorMessage = 'Printer fisik tidak terhubung (Gunakan cetak browser)';
          }
        } catch (err) {
          console.error('[PrinterStore] printReceiptForOrder error:', err);
          printSuccess = false;
          errorMessage = err.message || 'Gagal transmisi data cetak';
        }

        // Always record print job to backend for full audit trail
        try {
          await recordPrintJob({
            printerProfileId: activeReceiptPrinter?.id || null,
            orderId: order.id,
            documentType: 'RECEIPT',
            status: printSuccess ? 'PRINTED' : 'FAILED',
            errorCode: printSuccess ? null : 'ERR_PRINTER_OFFLINE',
            errorMessage,
            requestedBy: options.requestedBy || 'Kasir',
          });
        } catch {}

        return { success: printSuccess, message: errorMessage };
      },

      // Print Kitchen Ticket For Completed Order
      printKitchenTicketForOrder: async (order, options = {}) => {
        if (!order) return { success: false, message: 'Data pesanan kosong' };
        const { isConnected, sendRawData, activeKitchenPrinter, recordPrintJob } = get();

        const effectivePaperWidth = activeKitchenPrinter?.paperWidthMm
          ? `${activeKitchenPrinter.paperWidthMm}mm`
          : '58mm';

        let printSuccess = false;
        let errorMessage = null;

        try {
          if (isConnected) {
            const rawBytes = buildKitchenTicketEscPos(order, {
              paperWidth: effectivePaperWidth,
              ...options,
            });

            printSuccess = await sendRawData(rawBytes);
          } else {
            printSuccess = false;
            errorMessage = 'Printer dapur tidak terhubung';
          }
        } catch (err) {
          console.error('[PrinterStore] printKitchenTicketForOrder error:', err);
          printSuccess = false;
          errorMessage = err.message || 'Gagal transmisi tiket dapur';
        }

        // Record print job audit log
        try {
          await recordPrintJob({
            printerProfileId: activeKitchenPrinter?.id || null,
            orderId: order.id,
            documentType: 'KITCHEN_TICKET',
            status: printSuccess ? 'PRINTED' : 'FAILED',
            errorCode: printSuccess ? null : 'ERR_KITCHEN_PRINTER_OFFLINE',
            errorMessage,
            requestedBy: options.requestedBy || 'Sistem POS',
          });
        } catch {}

        return { success: printSuccess, message: errorMessage };
      },

      // -------------------------------------------------------------
      // HARDWARE CONNECTION METHODS
      // -------------------------------------------------------------

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

      // Direct Bluetooth Connection
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
            const friendly = formatFriendlyPrinterError(err);
            toast.error(friendly);
            return { success: false, message: friendly };
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
          const friendly = formatFriendlyPrinterError(err);
          toast.error(friendly);
          return { success: false, message: friendly };
        }
      },

      // Scan and Connect via Bluetooth
      connectBluetooth: async (options = {}) => {
        // A. Jalur Native Android APK
        if (isAndroid || isNative) {
          if (get().isConnecting) return { success: false, message: 'Sedang menghubungkan...' };

          if (options.address || options.device) {
            return await get().connectBluetoothDevice(options.device || options.address);
          }

          set({ isConnecting: true });
          try {
            const devices = await AndroidPrinter.getDevices();
            set({ pairedDevices: devices, isConnecting: false });

            if (devices.length === 1) {
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

            return {
              success: false,
              needSelectDevice: true,
              devices,
              message: 'Pilih printer dari daftar perangkat yang tersedia.',
            };
          } catch (err) {
            set({ isConnecting: false });
            const friendly = formatFriendlyPrinterError(err);
            toast.error(friendly);
            return { success: false, message: friendly };
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
          if (err.name === 'NotFoundError' || err.message?.includes('cancelled')) {
            return { success: false, cancelled: true };
          }
          const friendly = formatFriendlyPrinterError(err);
          toast.error(friendly);
          return { success: false, message: friendly };
        }
      },

      // Connect via Web Serial (USB Thermal Printer)
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
          if (err.name === 'NotFoundError' || err.message?.includes('cancelled') || err.message?.includes('No port selected')) {
            return { success: false, cancelled: true };
          }
          const friendly = formatFriendlyPrinterError(err);
          toast.error(friendly);
          return { success: false, message: friendly };
        }
      },

      // Disconnect Printer Cleanly
      disconnectPrinter: async () => {
        if (isAndroid || isNative) {
          try {
            await AndroidPrinter.disconnect();
          } catch (e) {
            console.warn('[PrinterStore] Android disconnect error:', e);
          }
        }

        if (receiptPrinterInstance && hasWebBluetoothConnected) {
          try {
            await receiptPrinterInstance.disconnect();
          } catch (e) {
            console.warn('[PrinterStore] Error disconnecting WebBluetoothReceiptPrinter:', e);
          }
        }
        hasWebBluetoothConnected = false;

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

      // Send Raw Binary ESC/POS Data
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

      // Trigger Test Print
      testPrint: async (storeSettings = {}) => {
        const { connectionType, paperWidth, isConnected, sendRawData, recordPrintJob, activeReceiptPrinter } = get();

        if ((connectionType === 'BLUETOOTH' || connectionType === 'USB') && isConnected) {
          try {
            toast.info('Mengirim data uji coba ke printer...');
            const bytes = buildTestReceiptEscPos(paperWidth, storeSettings);
            const ok = await sendRawData(bytes);
            if (ok) {
              set({ lastTestedAt: new Date().toISOString() });
              toast.success('Struk uji coba berhasil dicetak ke printer fisik!');

              // Log test print job
              await recordPrintJob({
                printerProfileId: activeReceiptPrinter?.id || null,
                documentType: 'TEST',
                status: 'PRINTED',
                requestedBy: 'Pengaturan POS',
              });

              return true;
            }
          } catch (err) {
            const friendly = formatFriendlyPrinterError(err);
            toast.error(friendly);
            await recordPrintJob({
              printerProfileId: activeReceiptPrinter?.id || null,
              documentType: 'TEST',
              status: 'FAILED',
              errorCode: 'ERR_TEST_PRINT',
              errorMessage: err.message,
              requestedBy: 'Pengaturan POS',
            });
            return false;
          }
        }

        return false;
      },

      // Direct Paper Feed (Feed / Test Response)
      feedPaper: async (lines = 3) => {
        const { connectionType, isConnected, sendRawData, recordPrintJob, activeReceiptPrinter } = get();
        if (isConnected) {
          try {
            const feedLines = Math.min(Math.max(1, Number(lines) || 3), 10);
            // ESC d n: Print and feed n lines (0x1B, 0x64, n)
            const feedBytes = new Uint8Array([0x1B, 0x64, feedLines]);
            const ok = await sendRawData(feedBytes);
            if (ok) {
              set({ lastTestedAt: new Date().toISOString() });
              toast.success(`Feed kertas (${feedLines} baris) berhasil dikirim ke printer`);
              await recordPrintJob({
                printerProfileId: activeReceiptPrinter?.id || null,
                documentType: 'TEST',
                status: 'PRINTED',
                requestedBy: 'Tes Feed Kasir',
              });
              return true;
            }
          } catch (err) {
            const friendly = formatFriendlyPrinterError(err);
            toast.error(friendly);
            return false;
          }
        }
        toast.warning('Printer fisik belum terhubung. Silakan hubungkan printer atau atur jalur koneksi/port.');
        return false;
      },

      // Auto-Reconnect
      autoConnectPrinter: async (silent = true) => {
        const { isConnected, isConnecting, connectedDeviceAddress } = get();
        if (isConnected || isConnecting) return { success: true };

        if (isAndroid || isNative) {
          try {
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
        autoPrintKitchenOnCheckout: state.autoPrintKitchenOnCheckout,
        printCopies: state.printCopies,
        kickCashDrawer: state.kickCashDrawer,
        connectedDeviceName: state.connectedDeviceName,
        connectedDeviceAddress: state.connectedDeviceAddress,
        lastTestedAt: state.lastTestedAt,
      }),
    }
  )
);
