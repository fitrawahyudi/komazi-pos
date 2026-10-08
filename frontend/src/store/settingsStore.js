import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../services/api';

export const DEFAULT_SETTINGS = {
  storeName: 'Komazi Coffee',
  storeTagline: 'Coffee & Collaborative Workspace',
  address: 'Jl. Diponegoro No. 42, Medan Petisah, Kota Medan',
  phone: '0812-6899-7721',
  wifiName: 'KOMAZI_HIGH_SPEED',
  wifiPass: 'kopikomazi2026',
  receiptFooter: 'Terima kasih atas kunjungan Anda!\nFollow IG: @komazi.coffee',
  taxEnabled: false,
  taxPercentage: 10,
  serviceFeeEnabled: false,
  serviceFeePercentage: 5,
  roundingEnabled: true,
  currency: 'IDR',
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
            const parsed = {
              storeName: serverData.storeName || DEFAULT_SETTINGS.storeName,
              storeTagline: serverData.storeTagline || DEFAULT_SETTINGS.storeTagline,
              address: serverData.address || DEFAULT_SETTINGS.address,
              phone: serverData.phone || DEFAULT_SETTINGS.phone,
              wifiName: serverData.wifiName || DEFAULT_SETTINGS.wifiName,
              wifiPass: serverData.wifiPass || DEFAULT_SETTINGS.wifiPass,
              receiptFooter: serverData.receiptFooter || DEFAULT_SETTINGS.receiptFooter,
              taxEnabled: serverData.taxEnabled === 'true' || serverData.taxEnabled === true,
              taxPercentage: Number(serverData.taxPercentage ?? DEFAULT_SETTINGS.taxPercentage),
              serviceFeeEnabled: serverData.serviceFeeEnabled === 'true' || serverData.serviceFeeEnabled === true,
              serviceFeePercentage: Number(serverData.serviceFeePercentage ?? DEFAULT_SETTINGS.serviceFeePercentage),
              roundingEnabled: serverData.roundingEnabled === 'true' || serverData.roundingEnabled === true,
              currency: serverData.currency || DEFAULT_SETTINGS.currency,
              qrisEnabled: serverData.qrisEnabled !== undefined ? (serverData.qrisEnabled === 'true' || serverData.qrisEnabled === true) : DEFAULT_SETTINGS.qrisEnabled,
              qrisMode: serverData.qrisMode || DEFAULT_SETTINGS.qrisMode || 'compatible',
              qrisIncludeInvoice: serverData.qrisIncludeInvoice !== undefined ? (serverData.qrisIncludeInvoice === 'true' || serverData.qrisIncludeInvoice === true) : (DEFAULT_SETTINGS.qrisIncludeInvoice || false),
              qrisStaticString: serverData.qrisStaticString || DEFAULT_SETTINGS.qrisStaticString,
              qrisNmid: serverData.qrisNmid || DEFAULT_SETTINGS.qrisNmid,
              qrisMerchantName: serverData.qrisMerchantName || DEFAULT_SETTINGS.qrisMerchantName,
              qrisMerchantCity: serverData.qrisMerchantCity || DEFAULT_SETTINGS.qrisMerchantCity,
              qrisPostalCode: serverData.qrisPostalCode || DEFAULT_SETTINGS.qrisPostalCode,
              qrisImageUrl: serverData.qrisImageUrl || DEFAULT_SETTINGS.qrisImageUrl || '',
              aiGroqConfigured: serverData.aiGroqConfigured !== undefined ? serverData.aiGroqConfigured : DEFAULT_SETTINGS.aiGroqConfigured,
              aiGroqModel: serverData.aiGroqModel || DEFAULT_SETTINGS.aiGroqModel,
              aiOpenRouterConfigured: serverData.aiOpenRouterConfigured !== undefined ? serverData.aiOpenRouterConfigured : DEFAULT_SETTINGS.aiOpenRouterConfigured,
              aiOpenRouterModel: serverData.aiOpenRouterModel || DEFAULT_SETTINGS.aiOpenRouterModel,
              aiPrimaryProvider: serverData.aiPrimaryProvider || DEFAULT_SETTINGS.aiPrimaryProvider || 'groq',
              supervisorPin: serverData.supervisorPin || DEFAULT_SETTINGS.supervisorPin || '1234',
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

        set((state) => ({
          settings: { ...state.settings, ...cleaned },
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

      resetToDefault: () => {
        set({ settings: DEFAULT_SETTINGS });
      },
    }),
    {
      name: 'komazi-settings-storage',
    }
  )
);
