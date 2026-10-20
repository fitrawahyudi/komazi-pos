import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../services/api';

export const DEFAULT_SETTINGS = {
  storeName: 'Komazi Coffee',
  storeTagline: 'Coffee & Workspace',
  address: 'Jl. Komplek TVRI',
  phone: '0812-6899-7721',
  headerText: '',
  receiptHeader: '',
  wifiName: 'KOMAZI',
  wifiPass: 'americanodingin',
  receiptShowWifi: true,
  wifiNetworks: [
    {
      id: 'wifi-1',
      name: 'KOMAZI',
      password: 'americanodingin',
      location: 'Area Utama & Kasir',
      isDefaultOnReceipt: true,
    },
    {
      id: 'wifi-2',
      name: 'KOMAZI_WORKSPACE_VIP',
      password: 'americanodingin',
      location: 'Lantai 2 Co-Working Space',
      isDefaultOnReceipt: false,
    },
  ],
  receiptFooter: 'Terima kasih atas kunjungan Anda!',
  footerText: 'Terima kasih atas kunjungan Anda!',
  // Receipt Element Visibility Flags
  receiptShowStoreName: true,
  receiptShowTagline: true,
  receiptShowAddress: true,
  receiptShowPhone: true,
  receiptShowHeader: true,
  receiptShowCashier: true,
  receiptShowCustomer: true,
  receiptShowTable: true,
  receiptShowNotes: true,
  receiptShowFooter: true,
  receiptShowQris: true,
  receiptShowBarcode: true,
  taxEnabled: false,
  taxPercentage: 10,
  serviceFeeEnabled: false,
  serviceFeePercentage: 5,
  roundingEnabled: true,
  currency: 'IDR',
  // Bank Transfer Payment Settings
  bankTransferEnabled: true,
  bankName: 'BCA',
  bankAccountNumber: '8291002931',
  bankAccountName: 'KOMAZI COFFEE',
  bankAccounts: [
    {
      id: 'bank-1',
      bankName: 'BCA',
      accountNumber: '8291002931',
      accountName: 'KOMAZI COFFEE',
      isDefault: true,
    },
  ],
  qrisEnabled: true,
  qrisMode: 'compatible',
  qrisIncludeInvoice: false,
  qrisStaticString: '',
  qrisNmid: 'ID1026610590857',
  qrisMerchantName: 'Komazi Coffee',
  qrisMerchantCity: 'Medan',
  qrisPostalCode: '20112',
  qrisImageUrl: '',
  aiGroqConfigured: false,
  aiGroqModel: 'openai/gpt-oss-120b',
  aiOpenRouterConfigured: false,
  aiOpenRouterModel: 'meta-llama/llama-3.3-70b-instruct',
  aiPrimaryProvider: 'groq',
  supervisorPin: '1234',
  // Bot Telegram Notification Settings (Owner / Manager)
  botEnabled: true,
  botNotifyTransaction: true,
  botNotifyShift: true,
  botNotifyLowStock: true,
  botNotifyVoid: true,
  botVoidMinAmount: 100000,
  botNotifyApproval: true,
  botNotifyDailySummary: true,
  botBaristaChatId: '',
  // KDS & BDS Device API Key
  kdsApiKey: 'komazi_kds_live_secure_token_key_2026',
  // HRIS Schedule Guard Enforcement (false = staf bebas presensi & transaksi tanpa jadwal terdaftar)
  enforceScheduleGuard: false,
  // HRIS Attendance Enforcement (true = seluruh staf wajib presensi sebelum buka kasir & bertransaksi; false = opsional/bebas)
  enforceAttendanceGuard: true,
  // Anti-Fraud Presensi Kehadiran Staf
  attendanceGeofenceEnabled: true,
  outletLatitude: '3.598804',
  outletLongitude: '98.7311898',
  attendanceRadiusMeters: 100,
  attendanceSelfieRequired: true,
};

export const useSettingsStore = create(
  persist(
    (set, get) => ({
      settings: DEFAULT_SETTINGS,
      isLoading: false,

      fetchSettings: async () => {
        try {
          set({ isLoading: true });
          const res = await api.settings.get();
          if (res && res.success && res.data) {
            const serverData = res.data;

            let parsedWifiNetworks = DEFAULT_SETTINGS.wifiNetworks;
            if (serverData.wifiNetworks) {
              try {
                parsedWifiNetworks =
                  typeof serverData.wifiNetworks === 'string'
                    ? JSON.parse(serverData.wifiNetworks)
                    : serverData.wifiNetworks;
              } catch {
                parsedWifiNetworks = DEFAULT_SETTINGS.wifiNetworks;
              }
            } else if (serverData.wifiName) {
              parsedWifiNetworks = [
                {
                  id: 'wifi-1',
                  name: serverData.wifiName,
                  password: serverData.wifiPass || '',
                  location: 'Area Utama & Kasir',
                  isDefaultOnReceipt: true,
                },
              ];
            }

            let parsedBankAccounts = DEFAULT_SETTINGS.bankAccounts;
            if (serverData.bankAccounts) {
              try {
                parsedBankAccounts =
                  typeof serverData.bankAccounts === 'string'
                    ? JSON.parse(serverData.bankAccounts)
                    : serverData.bankAccounts;
              } catch {
                parsedBankAccounts = DEFAULT_SETTINGS.bankAccounts;
              }
            } else if (serverData.bankAccountNumber) {
              parsedBankAccounts = [
                {
                  id: 'bank-1',
                  bankName: serverData.bankName || 'BCA',
                  accountNumber: serverData.bankAccountNumber,
                  accountName: serverData.bankAccountName || 'KOMAZI COFFEE',
                  isDefault: true,
                },
              ];
            }

            const activeDefaultBank = parsedBankAccounts.find((b) => b.isDefault) || parsedBankAccounts[0];

            const activeDefaultWifi = parsedWifiNetworks.find((w) => w.isDefaultOnReceipt) || parsedWifiNetworks[0];

            const parsed = {
              storeName: serverData.storeName !== undefined ? serverData.storeName : DEFAULT_SETTINGS.storeName,
              storeTagline: serverData.storeTagline !== undefined ? serverData.storeTagline : DEFAULT_SETTINGS.storeTagline,
              address: serverData.address !== undefined ? serverData.address : DEFAULT_SETTINGS.address,
              phone: serverData.phone !== undefined ? serverData.phone : DEFAULT_SETTINGS.phone,
              headerText: serverData.headerText !== undefined ? serverData.headerText : (serverData.receiptHeader !== undefined ? serverData.receiptHeader : ''),
              receiptHeader: serverData.receiptHeader !== undefined ? serverData.receiptHeader : (serverData.headerText !== undefined ? serverData.headerText : ''),
              wifiName: serverData.wifiName !== undefined ? serverData.wifiName : (activeDefaultWifi?.name || DEFAULT_SETTINGS.wifiName),
              wifiPass: serverData.wifiPass !== undefined ? serverData.wifiPass : (activeDefaultWifi?.password || ''),
              // Bank Transfer Payment Settings
              bankTransferEnabled:
                serverData.bankTransferEnabled !== undefined
                  ? serverData.bankTransferEnabled === 'true' || serverData.bankTransferEnabled === true
                  : true,
              bankName: serverData.bankName !== undefined ? serverData.bankName : (activeDefaultBank?.bankName || DEFAULT_SETTINGS.bankName),
              bankAccountNumber: serverData.bankAccountNumber !== undefined ? serverData.bankAccountNumber : (activeDefaultBank?.accountNumber || DEFAULT_SETTINGS.bankAccountNumber),
              bankAccountName: serverData.bankAccountName !== undefined ? serverData.bankAccountName : (activeDefaultBank?.accountName || DEFAULT_SETTINGS.bankAccountName),
              bankAccounts: parsedBankAccounts,
              receiptShowWifi:
                serverData.receiptShowWifi !== undefined
                  ? serverData.receiptShowWifi === 'true' || serverData.receiptShowWifi === true
                  : true,
              receiptShowStoreName:
                serverData.receiptShowStoreName !== undefined
                  ? serverData.receiptShowStoreName === 'true' || serverData.receiptShowStoreName === true
                  : true,
              receiptShowTagline:
                serverData.receiptShowTagline !== undefined
                  ? serverData.receiptShowTagline === 'true' || serverData.receiptShowTagline === true
                  : true,
              receiptShowAddress:
                serverData.receiptShowAddress !== undefined
                  ? serverData.receiptShowAddress === 'true' || serverData.receiptShowAddress === true
                  : true,
              receiptShowPhone:
                serverData.receiptShowPhone !== undefined
                  ? serverData.receiptShowPhone === 'true' || serverData.receiptShowPhone === true
                  : true,
              receiptShowHeader:
                serverData.receiptShowHeader !== undefined
                  ? serverData.receiptShowHeader === 'true' || serverData.receiptShowHeader === true
                  : true,
              receiptShowCashier:
                serverData.receiptShowCashier !== undefined
                  ? serverData.receiptShowCashier === 'true' || serverData.receiptShowCashier === true
                  : true,
              receiptShowCustomer:
                serverData.receiptShowCustomer !== undefined
                  ? serverData.receiptShowCustomer === 'true' || serverData.receiptShowCustomer === true
                  : true,
              receiptShowTable:
                serverData.receiptShowTable !== undefined
                  ? serverData.receiptShowTable === 'true' || serverData.receiptShowTable === true
                  : true,
              receiptShowNotes:
                serverData.receiptShowNotes !== undefined
                  ? serverData.receiptShowNotes === 'true' || serverData.receiptShowNotes === true
                  : true,
              receiptShowFooter:
                serverData.receiptShowFooter !== undefined
                  ? serverData.receiptShowFooter === 'true' || serverData.receiptShowFooter === true
                  : true,
              receiptShowQris:
                serverData.receiptShowQris !== undefined
                  ? serverData.receiptShowQris === 'true' || serverData.receiptShowQris === true
                  : true,
              receiptShowBarcode:
                serverData.receiptShowBarcode !== undefined
                  ? serverData.receiptShowBarcode === 'true' || serverData.receiptShowBarcode === true
                  : true,
              wifiNetworks: parsedWifiNetworks,
              receiptFooter: serverData.receiptFooter !== undefined ? serverData.receiptFooter : (serverData.footerText !== undefined ? serverData.footerText : DEFAULT_SETTINGS.receiptFooter),
              footerText: serverData.footerText !== undefined ? serverData.footerText : (serverData.receiptFooter !== undefined ? serverData.receiptFooter : DEFAULT_SETTINGS.receiptFooter),
              taxEnabled: serverData.taxEnabled === 'true' || serverData.taxEnabled === true,
              taxPercentage: Number(serverData.taxPercentage ?? DEFAULT_SETTINGS.taxPercentage),
              serviceFeeEnabled: serverData.serviceFeeEnabled === 'true' || serverData.serviceFeeEnabled === true,
              serviceFeePercentage: Number(serverData.serviceFeePercentage ?? DEFAULT_SETTINGS.serviceFeePercentage),
              roundingEnabled: serverData.roundingEnabled === 'true' || serverData.roundingEnabled === true,
              currency: serverData.currency || DEFAULT_SETTINGS.currency,
              qrisEnabled:
                serverData.qrisEnabled !== undefined
                  ? serverData.qrisEnabled === 'true' || serverData.qrisEnabled === true
                  : DEFAULT_SETTINGS.qrisEnabled,
              qrisMode: serverData.qrisMode || DEFAULT_SETTINGS.qrisMode || 'compatible',
              qrisIncludeInvoice:
                serverData.qrisIncludeInvoice !== undefined
                  ? serverData.qrisIncludeInvoice === 'true' || serverData.qrisIncludeInvoice === true
                  : DEFAULT_SETTINGS.qrisIncludeInvoice || false,
              qrisStaticString: serverData.qrisStaticString !== undefined ? serverData.qrisStaticString : DEFAULT_SETTINGS.qrisStaticString,
              qrisNmid: serverData.qrisNmid !== undefined ? serverData.qrisNmid : DEFAULT_SETTINGS.qrisNmid,
              qrisMerchantName: serverData.qrisMerchantName !== undefined ? serverData.qrisMerchantName : DEFAULT_SETTINGS.qrisMerchantName,
              qrisMerchantCity: serverData.qrisMerchantCity !== undefined ? serverData.qrisMerchantCity : DEFAULT_SETTINGS.qrisMerchantCity,
              qrisPostalCode: serverData.qrisPostalCode !== undefined ? serverData.qrisPostalCode : DEFAULT_SETTINGS.qrisPostalCode,
              qrisImageUrl: serverData.qrisImageUrl !== undefined ? serverData.qrisImageUrl : '',
              aiGroqConfigured:
                serverData.aiGroqConfigured !== undefined
                  ? serverData.aiGroqConfigured
                  : DEFAULT_SETTINGS.aiGroqConfigured,
              aiGroqModel: serverData.aiGroqModel || DEFAULT_SETTINGS.aiGroqModel,
              aiOpenRouterConfigured:
                serverData.aiOpenRouterConfigured !== undefined
                  ? serverData.aiOpenRouterConfigured
                  : DEFAULT_SETTINGS.aiOpenRouterConfigured,
              aiOpenRouterModel: serverData.aiOpenRouterModel || DEFAULT_SETTINGS.aiOpenRouterModel,
              aiPrimaryProvider: serverData.aiPrimaryProvider || DEFAULT_SETTINGS.aiPrimaryProvider || 'groq',
              supervisorPin: serverData.supervisorPin || DEFAULT_SETTINGS.supervisorPin || '1234',
              botEnabled:
                serverData.botEnabled !== undefined
                  ? serverData.botEnabled === 'true' || serverData.botEnabled === true
                  : DEFAULT_SETTINGS.botEnabled,
              botNotifyTransaction:
                serverData.botNotifyTransaction !== undefined
                  ? serverData.botNotifyTransaction === 'true' || serverData.botNotifyTransaction === true
                  : DEFAULT_SETTINGS.botNotifyTransaction,
              botNotifyShift:
                serverData.botNotifyShift !== undefined
                  ? serverData.botNotifyShift === 'true' || serverData.botNotifyShift === true
                  : DEFAULT_SETTINGS.botNotifyShift,
              botNotifyLowStock:
                serverData.botNotifyLowStock !== undefined
                  ? serverData.botNotifyLowStock === 'true' || serverData.botNotifyLowStock === true
                  : DEFAULT_SETTINGS.botNotifyLowStock,
              botNotifyVoid:
                serverData.botNotifyVoid !== undefined
                  ? serverData.botNotifyVoid === 'true' || serverData.botNotifyVoid === true
                  : DEFAULT_SETTINGS.botNotifyVoid,
              botVoidMinAmount: Number(serverData.botVoidMinAmount ?? DEFAULT_SETTINGS.botVoidMinAmount),
              botNotifyApproval:
                serverData.botNotifyApproval !== undefined
                  ? serverData.botNotifyApproval === 'true' || serverData.botNotifyApproval === true
                  : DEFAULT_SETTINGS.botNotifyApproval,
              botNotifyDailySummary:
                serverData.botNotifyDailySummary !== undefined
                  ? serverData.botNotifyDailySummary === 'true' || serverData.botNotifyDailySummary === true
                  : DEFAULT_SETTINGS.botNotifyDailySummary,
              botBaristaChatId:
                serverData.botBaristaChatId !== undefined ? serverData.botBaristaChatId : DEFAULT_SETTINGS.botBaristaChatId,
            };

            set((state) => ({
              settings: { ...state.settings, ...parsed },
              isLoading: false,
            }));
            return { success: true, data: parsed };
          }
        } catch (err) {
          console.warn('[SettingsStore] Failed to fetch settings from backend:', err);
        } finally {
          set({ isLoading: false });
        }
        return { success: false };
      },

      updateSettings: async (newSettings) => {
        const cleaned = { ...newSettings };
        delete cleaned.groqApiKey;
        delete cleaned.openrouterApiKey;

        // Ensure aliases stay in sync
        if (cleaned.headerText !== undefined && cleaned.receiptHeader === undefined) {
          cleaned.receiptHeader = cleaned.headerText;
        } else if (cleaned.receiptHeader !== undefined && cleaned.headerText === undefined) {
          cleaned.headerText = cleaned.receiptHeader;
        }

        if (cleaned.footerText !== undefined && cleaned.receiptFooter === undefined) {
          cleaned.receiptFooter = cleaned.footerText;
        } else if (cleaned.receiptFooter !== undefined && cleaned.footerText === undefined) {
          cleaned.footerText = cleaned.receiptFooter;
        }

        // If wifiNetworks is present, stringify for persistent backend storage
        if (cleaned.wifiNetworks && typeof cleaned.wifiNetworks !== 'string') {
          cleaned.wifiNetworks = JSON.stringify(cleaned.wifiNetworks);
        }

        // If bankAccounts is present, stringify for persistent backend storage
        if (cleaned.bankAccounts && typeof cleaned.bankAccounts !== 'string') {
          cleaned.bankAccounts = JSON.stringify(cleaned.bankAccounts);
        }

        set((state) => ({
          settings: {
            ...state.settings,
            ...newSettings,
            headerText: newSettings.headerText !== undefined ? newSettings.headerText : (newSettings.receiptHeader !== undefined ? newSettings.receiptHeader : state.settings.headerText),
            receiptHeader: newSettings.receiptHeader !== undefined ? newSettings.receiptHeader : (newSettings.headerText !== undefined ? newSettings.headerText : state.settings.receiptHeader),
            footerText: newSettings.footerText !== undefined ? newSettings.footerText : (newSettings.receiptFooter !== undefined ? newSettings.receiptFooter : state.settings.footerText),
            receiptFooter: newSettings.receiptFooter !== undefined ? newSettings.receiptFooter : (newSettings.footerText !== undefined ? newSettings.footerText : state.settings.receiptFooter),
            wifiNetworks: Array.isArray(newSettings.wifiNetworks)
              ? newSettings.wifiNetworks
              : state.settings.wifiNetworks,
            bankAccounts: Array.isArray(newSettings.bankAccounts)
              ? newSettings.bankAccounts
              : state.settings.bankAccounts,
          },
        }));

        try {
          const res = await api.settings.update(cleaned);
          if (res && res.success) {
            return { success: true, message: res.message };
          }
        } catch (err) {
          console.warn('[SettingsStore] Backend sync failed, kept in local storage:', err);
        }
        return { success: true, message: 'Disimpan di penyimpanan lokal' };
      },

      // -------------------------------------------------------------
      // WIFI NETWORKS CRUD
      // -------------------------------------------------------------

      addWifiNetwork: async (networkData) => {
        const currentList = get().settings.wifiNetworks || [];
        const isDefault = Boolean(networkData.isDefaultOnReceipt) || currentList.length === 0;

        const newNetwork = {
          id: 'wifi-' + Date.now(),
          name: networkData.name.trim(),
          password: networkData.password || '',
          location: networkData.location?.trim() || 'Area Outlet',
          isDefaultOnReceipt: isDefault,
        };

        const updatedList = isDefault
          ? currentList.map((w) => ({ ...w, isDefaultOnReceipt: false })).concat([newNetwork])
          : [...currentList, newNetwork];

        const updates = {
          wifiNetworks: updatedList,
        };

        if (isDefault) {
          updates.wifiName = newNetwork.name;
          updates.wifiPass = newNetwork.password;
        }

        return await get().updateSettings(updates);
      },

      updateWifiNetwork: async (id, updatedData) => {
        const currentList = get().settings.wifiNetworks || [];
        const isDefault = Boolean(updatedData.isDefaultOnReceipt);

        const updatedList = currentList.map((item) => {
          if (item.id === id) {
            return {
              ...item,
              name: updatedData.name !== undefined ? updatedData.name.trim() : item.name,
              password: updatedData.password !== undefined ? updatedData.password : item.password,
              location: updatedData.location !== undefined ? updatedData.location.trim() : item.location,
              isDefaultOnReceipt: isDefault,
            };
          }
          return isDefault ? { ...item, isDefaultOnReceipt: false } : item;
        });

        const updates = {
          wifiNetworks: updatedList,
        };

        const activeItem = updatedList.find((w) => w.id === id);
        if (isDefault && activeItem) {
          updates.wifiName = activeItem.name;
          updates.wifiPass = activeItem.password;
        }

        return await get().updateSettings(updates);
      },

      deleteWifiNetwork: async (id) => {
        const currentList = get().settings.wifiNetworks || [];
        const deletedItem = currentList.find((w) => w.id === id);
        let updatedList = currentList.filter((w) => w.id !== id);

        const updates = {
          wifiNetworks: updatedList,
        };

        // If the deleted item was the default, make the first remaining network the default
        if (deletedItem?.isDefaultOnReceipt && updatedList.length > 0) {
          updatedList[0].isDefaultOnReceipt = true;
          updates.wifiName = updatedList[0].name;
          updates.wifiPass = updatedList[0].password;
        } else if (updatedList.length === 0) {
          updates.wifiName = '';
          updates.wifiPass = '';
        }

        return await get().updateSettings(updates);
      },

      setDefaultWifiOnReceipt: async (id) => {
        const currentList = get().settings.wifiNetworks || [];
        const target = currentList.find((w) => w.id === id);
        if (!target) return;

        const updatedList = currentList.map((w) => ({
          ...w,
          isDefaultOnReceipt: w.id === id,
        }));

        return await get().updateSettings({
          wifiNetworks: updatedList,
          wifiName: target.name,
          wifiPass: target.password,
        });
      },

      // -------------------------------------------------------------
      // BANK ACCOUNTS CRUD (Transfer Bank)
      // -------------------------------------------------------------

      setBankTransferEnabled: async (enabled) => {
        return await get().updateSettings({ bankTransferEnabled: Boolean(enabled) });
      },

      addBankAccount: async (bankData) => {
        const currentList = get().settings.bankAccounts || [];
        const isDefault = Boolean(bankData.isDefault) || currentList.length === 0;

        const newAccount = {
          id: 'bank-' + Date.now(),
          bankName: bankData.bankName?.trim() || 'BCA',
          accountNumber: bankData.accountNumber?.trim() || '',
          accountName: bankData.accountName?.trim() || '',
          isDefault,
        };

        const updatedList = isDefault
          ? currentList.map((b) => ({ ...b, isDefault: false })).concat([newAccount])
          : [...currentList, newAccount];

        const updates = {
          bankAccounts: updatedList,
        };

        if (isDefault) {
          updates.bankName = newAccount.bankName;
          updates.bankAccountNumber = newAccount.accountNumber;
          updates.bankAccountName = newAccount.accountName;
        }

        return await get().updateSettings(updates);
      },

      updateBankAccount: async (id, updatedData) => {
        const currentList = get().settings.bankAccounts || [];
        const isDefault = Boolean(updatedData.isDefault);

        const updatedList = currentList.map((item) => {
          if (item.id === id) {
            return {
              ...item,
              bankName: updatedData.bankName !== undefined ? updatedData.bankName.trim() : item.bankName,
              accountNumber: updatedData.accountNumber !== undefined ? updatedData.accountNumber.trim() : item.accountNumber,
              accountName: updatedData.accountName !== undefined ? updatedData.accountName.trim() : item.accountName,
              isDefault,
            };
          }
          return isDefault ? { ...item, isDefault: false } : item;
        });

        const updates = {
          bankAccounts: updatedList,
        };

        const activeItem = updatedList.find((b) => b.id === id);
        if (isDefault && activeItem) {
          updates.bankName = activeItem.bankName;
          updates.bankAccountNumber = activeItem.accountNumber;
          updates.bankAccountName = activeItem.accountName;
        }

        return await get().updateSettings(updates);
      },

      deleteBankAccount: async (id) => {
        const currentList = get().settings.bankAccounts || [];
        const deletedItem = currentList.find((b) => b.id === id);
        let updatedList = currentList.filter((b) => b.id !== id);

        const updates = {
          bankAccounts: updatedList,
        };

        if (deletedItem?.isDefault && updatedList.length > 0) {
          updatedList[0].isDefault = true;
          updates.bankName = updatedList[0].bankName;
          updates.bankAccountNumber = updatedList[0].accountNumber;
          updates.bankAccountName = updatedList[0].accountName;
        } else if (updatedList.length === 0) {
          updates.bankName = '';
          updates.bankAccountNumber = '';
          updates.bankAccountName = '';
        }

        return await get().updateSettings(updates);
      },

      setDefaultBankAccount: async (id) => {
        const currentList = get().settings.bankAccounts || [];
        const target = currentList.find((b) => b.id === id);
        if (!target) return;

        const updatedList = currentList.map((b) => ({
          ...b,
          isDefault: b.id === id,
        }));

        return await get().updateSettings({
          bankAccounts: updatedList,
          bankName: target.bankName,
          bankAccountNumber: target.accountNumber,
          bankAccountName: target.accountName,
        });
      },

      resetToDefault: () => {
        set({ settings: DEFAULT_SETTINGS });
      },
    }),
    {
      name: 'komazi-settings-storage',
    }
  )
);
