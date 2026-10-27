import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useSettingsStore } from './settingsStore';
import { useOrdersStore, subscribeOrdersChanged } from './ordersStore';
import { usePosStore } from './posStore';

let isSyncingOpenBills = false;

export const useCartStore = create(
  persist(
    (set, get) => ({
      items: [],
      orderType: 'DINE_IN', // 'DINE_IN' | 'TAKE_AWAY'
      tableNo: '-',
      customerName: '',
      selectedCustomerId: null, // ID pelanggan terdaftar yang dipilih (null = tamu/non-member)
      discountType: 'NOMINAL', // 'NOMINAL' | 'PERCENT'
      discountValue: 0,
      appliedPromo: null, // Detail promo/voucher aktif: { code, name, type, value, discountAmount, isPreset }
      redeemedPoints: 0, // Jumlah poin loyalty yang ditukarkan (1 poin = Rp 1.000 diskon)
      attachedWorkspaceSession: null, // If bundled with workspace
      openBills: [], // Array of saved open orders
      currentHoldBillId: null, // ID hold bill yang sedang diedit/direstore (jika ada)
      currentBackendOrderId: null, // ID pesanan MySQL di backend (jika ada)

      setOrderType: (type) => set({ orderType: type }),
      setTableNo: (tableNo) => set({ tableNo }),
      setCustomerName: (customerName) => set({ customerName }),
      // Set customer dari data pelanggan terdaftar
      setSelectedCustomer: (customerId, customerName) =>
        set((state) => ({
          selectedCustomerId: customerId,
          customerName,
          redeemedPoints: customerId ? state.redeemedPoints : 0,
        })),
      
      setDiscount: (type, value) => {
        set({
          discountType: type,
          discountValue: Math.max(0, Number(value) || 0),
          appliedPromo: null, // Reset preset/voucher jika manual input diubah
        });
      },

      applyPresetDiscount: (preset) => {
        if (!preset) return;
        set({
          appliedPromo: {
            id: preset.id,
            name: preset.name,
            shortLabel: preset.shortLabel || preset.name,
            type: preset.type,
            value: Number(preset.value) || 0,
            isPreset: true,
          },
          discountType: preset.type,
          discountValue: Number(preset.value) || 0,
          redeemedPoints: 0, // Reset poin loyalty jika promo diskon dipasang
        });
      },

      applyVoucher: (voucher) => {
        if (!voucher) return;
        set({
          appliedPromo: {
            code: voucher.code,
            name: voucher.name,
            type: voucher.type,
            value: Number(voucher.value) || 0,
            discountAmount: Number(voucher.discountAmount) || 0,
            minSpend: Number(voucher.minSpend) || 0,
            maxDiscount: Number(voucher.maxDiscount) || 0,
            isPreset: false,
          },
          discountType: voucher.type,
          discountValue: Number(voucher.value) || 0,
          redeemedPoints: 0,
        });
      },

      removePromo: () => {
        set({
          appliedPromo: null,
          discountType: 'NOMINAL',
          discountValue: 0,
        });
      },

      setRedeemedPoints: (points) => {
        set({
          redeemedPoints: Math.max(0, Number(points) || 0),
          appliedPromo: null, // Reset promo jika kasir memilih tukar poin
        });
      },

      attachWorkspaceSession: (session) => {
        set({ attachedWorkspaceSession: session });
      },

      clearWorkspaceSession: () => {
        set({ attachedWorkspaceSession: null });
      },

      /**
       * Add product to cart with chosen variant & modifiers & optional custom dynamic price
       */
      addItem: (product, selectedVariant = null, selectedModifiers = [], note = '', customPrice = null) => {
        const state = get();
        const variantPrice = selectedVariant ? Number(selectedVariant.extraPrice || 0) : 0;
        const modifiersPrice = selectedModifiers.reduce((sum, m) => sum + Number(m.price || 0), 0);

        const basePrice = customPrice !== null && customPrice !== undefined && !isNaN(customPrice)
          ? Number(customPrice)
          : Number(product.price);
        const unitPrice = Math.max(0, basePrice + variantPrice + modifiersPrice);

        const isDynamic = Boolean(product.isDynamicPrice || customPrice !== null);

        // Unique key based on product ID, variant ID, selected modifier IDs, custom price, and note
        const modifierIds = selectedModifiers.map((m) => m.id).sort().join('-');
        const priceSuffix = isDynamic ? `dyn_${basePrice}` : 'std';
        const itemKey = `${product.id}_${selectedVariant?.id || 'none'}_${modifierIds}_${priceSuffix}_${note || ''}`;

        const existingIndex = state.items.findIndex((i) => i.key === itemKey);

        if (existingIndex > -1) {
          const updatedItems = [...state.items];
          updatedItems[existingIndex].qty += 1;
          updatedItems[existingIndex].lineTotal = updatedItems[existingIndex].qty * updatedItems[existingIndex].unitPrice;
          set({ items: updatedItems });
        } else {
          const newItem = {
            key: itemKey,
            productId: product.id,
            name: product.name,
            imageUrl: product.imageUrl,
            categoryName: product.categoryName,
            stationId: product.stationId || product.station?.id || null,
            station: product.station || null,
            variant: selectedVariant,
            modifiers: selectedModifiers,
            unitPrice,
            isDynamicPrice: isDynamic,
            baseCustomPrice: customPrice !== null ? basePrice : null,
            qty: 1,
            lineTotal: unitPrice,
            note: note || '',
          };
          set({ items: [...state.items, newItem] });
        }
      },

      updateItemQty: (key, qty) => {
        if (qty <= 0) {
          get().removeItem(key);
          return;
        }
        set((state) => ({
          items: state.items.map((item) =>
            item.key === key
              ? { ...item, qty, lineTotal: qty * item.unitPrice }
              : item
          ),
        }));
      },

      updateItemPrice: (key, newPrice) => {
        const cleanPrice = Math.max(0, Number(newPrice) || 0);
        set((state) => ({
          items: state.items.map((item) => {
            if (item.key === key) {
              return {
                ...item,
                unitPrice: cleanPrice,
                lineTotal: item.qty * cleanPrice,
                isDynamicPrice: true,
              };
            }
            return item;
          }),
        }));
      },

      updateItemNote: (key, note) => {
        set((state) => ({
          items: state.items.map((item) =>
            item.key === key ? { ...item, note } : item
          ),
        }));
      },

      removeItem: (key) => {
        set((state) => ({
          items: state.items.filter((item) => item.key !== key),
        }));
      },

      clearCart: (cancelHoldBackend = false) => {
        const state = get();
        if (cancelHoldBackend && (state.currentHoldBillId || state.currentBackendOrderId)) {
          useOrdersStore.getState().deleteHoldOrder?.(state.currentHoldBillId, state.currentBackendOrderId);
        }
        set({
          items: [],
          tableNo: '',
          customerName: '',
          selectedCustomerId: null,
          discountType: 'NOMINAL',
          discountValue: 0,
          appliedPromo: null,
          redeemedPoints: 0,
          attachedWorkspaceSession: null,
          currentHoldBillId: null,
          currentBackendOrderId: null,
        });
      },

      // Calculate totals
      getCartSummary: () => {
        const { items, discountType, discountValue, appliedPromo, attachedWorkspaceSession } = get();
        const { settings } = useSettingsStore.getState();

        const itemsSubtotal = items.reduce((sum, item) => sum + Number(item.lineTotal || 0), 0);
        const workspaceCharge = attachedWorkspaceSession ? Number(attachedWorkspaceSession.charge || 0) : 0;
        const subtotal = itemsSubtotal + workspaceCharge;

        let discountAmount = 0;
        if (discountType === 'PERCENT') {
          discountAmount = Math.round((subtotal * Math.min(100, discountValue)) / 100);
          if (appliedPromo && appliedPromo.maxDiscount > 0 && discountAmount > appliedPromo.maxDiscount) {
            discountAmount = appliedPromo.maxDiscount;
          }
        } else {
          discountAmount = Math.min(subtotal, discountValue);
        }

        const afterDiscount = Math.max(0, subtotal - discountAmount);

        // Service fee
        let serviceFee = 0;
        if (settings.serviceFeeEnabled) {
          serviceFee = Math.round((afterDiscount * (settings.serviceFeePercentage || 0)) / 100);
        }

        // Tax / PPN
        let tax = 0;
        if (settings.taxEnabled) {
          tax = Math.round(((afterDiscount + serviceFee) * (settings.taxPercentage || 0)) / 100);
        }

        let grandTotal = afterDiscount + serviceFee + tax;
        if (settings.roundingEnabled) {
          // Round to nearest Rp 100
          grandTotal = Math.ceil(grandTotal / 100) * 100;
        }

        return {
          itemsSubtotal,
          workspaceCharge,
          subtotal,
          discountAmount,
          serviceFee,
          tax,
          grandTotal,
          totalQty: items.reduce((sum, item) => sum + item.qty, 0),
          appliedPromo: appliedPromo || null,
        };
      },

      // Open Bills (Simpan Pesanan / Hold Bill) — otomatis masuk KDS & tersimpan di MySQL
      saveCurrentAsOpenBill: async (label = '') => {
        const state = get();
        if (state.items.length === 0 && !state.attachedWorkspaceSession) return null;

        const summary = state.getCartSummary();
        // Gunakan ID hold yang sedang diedit jika ada, atau buat ID baru
        const billId = state.currentHoldBillId || `${Date.now()}`;
        const existingBackendOrderId = state.currentBackendOrderId || null;

        // Inferensi nomor meja dan nama pelanggan dari label jika belum terisi
        let resolvedTableNo = (state.tableNo || '').trim();
        let resolvedCustomerName = (state.customerName || '').trim();

        if (label) {
          if (!resolvedTableNo) {
            const tableMatch = label.match(/meja\s*([0-9a-zA-Z_-]+)/i);
            if (tableMatch) {
              resolvedTableNo = tableMatch[1].trim();
            }
          }
          if (!resolvedCustomerName) {
            resolvedCustomerName = label;
          }
        }

        const openBill = {
          id: `BILL-${billId}`,
          billId,
          backendOrderId: existingBackendOrderId,
          label: label || `Meja ${resolvedTableNo || 'Takeaway'} - ${resolvedCustomerName || 'Tamu'}`,
          items: [...state.items],
          orderType: state.orderType,
          tableNo: resolvedTableNo,
          customerName: resolvedCustomerName,
          selectedCustomerId: state.selectedCustomerId,
          discountType: state.discountType,
          discountValue: state.discountValue,
          appliedPromo: state.appliedPromo || null,
          attachedWorkspaceSession: state.attachedWorkspaceSession,
          savedAt: new Date().toISOString(),
          total: summary.grandTotal,
        };

        // Ambil master products untuk melengkapi categoryName bila belum ada
        const productsMap = (usePosStore.getState().products || []).reduce((acc, p) => {
          acc[p.id] = p;
          return acc;
        }, {});

        // Pastikan nama produk & kategori terisi lengkap untuk stasiun KDS & Bar
        const mappedItems = openBill.items.map((i) => {
          const prod = productsMap[i.productId];
          return {
            productId: i.productId,
            productName: i.name || prod?.name || 'Item',
            name: i.name || prod?.name || 'Item',
            categoryName: i.categoryName || prod?.categoryName || prod?.category?.name || null,
            variantName: i.variant?.name || i.variantName || null,
            modifiers: i.modifiers?.map((m) => m.name).join(', ') || null,
            qty: i.qty,
            unitPrice: i.unitPrice,
            lineTotal: i.lineTotal,
            note: i.note || null,
          };
        });

        // Simpan langsung ke backend MySQL dan sinkronkan ke KDS/BDS
        try {
          const holdOrder = await useOrdersStore.getState().createHoldOrder({
            ...openBill,
            billId,
            backendOrderId: existingBackendOrderId,
            tableNo: resolvedTableNo || null,
            customerName: resolvedCustomerName || 'Tamu',
            type: openBill.orderType,
            items: mappedItems,
          });

          if (holdOrder) {
            const actualBackendId = holdOrder.backendOrderId || (typeof holdOrder.id === 'number' && holdOrder.id < 1000000000000 ? holdOrder.id : null);
            if (actualBackendId) {
              openBill.backendOrderId = actualBackendId;
              openBill.invoiceNo = holdOrder.invoiceNo || openBill.invoiceNo;
            }
          }
        } catch (err) {
          console.warn('[CartStore] createHoldOrder error:', err);
        }

        // Filter bill lama jika ini adalah update dari hold bill yang direstore
        const otherBills = state.openBills.filter((b) => b.billId !== billId && b.id !== openBill.id);
        set({
          openBills: [openBill, ...otherBills],
          currentHoldBillId: null,
          currentBackendOrderId: null,
        });

        state.clearCart();
        return openBill;
      },

      restoreOpenBill: (billId) => {
        const state = get();
        const bill = state.openBills.find((b) => b.id === billId || b.billId === billId);
        if (!bill) return false;

        set({
          items: bill.items,
          orderType: bill.orderType,
          tableNo: bill.tableNo,
          customerName: bill.customerName,
          selectedCustomerId: bill.selectedCustomerId || null,
          discountType: bill.discountType,
          discountValue: bill.discountValue,
          appliedPromo: bill.appliedPromo || null,
          attachedWorkspaceSession: bill.attachedWorkspaceSession,
          currentHoldBillId: bill.billId, // Tandai bahwa cart memuat hold bill ini
          currentBackendOrderId: bill.backendOrderId || null, // Catat ID backend MySQL order
          openBills: state.openBills.filter((b) => b.id !== bill.id && b.billId !== bill.billId),
        });
        return true;
      },

      deleteOpenBill: async (billId) => {
        const state = get();
        const bill = state.openBills.find((b) => b.id === billId || b.billId === billId);
        if (bill) {
          if (typeof useOrdersStore.getState().deleteHoldOrder === 'function') {
            await useOrdersStore.getState().deleteHoldOrder(bill.billId, bill.backendOrderId);
          }
        }

        const isCurrentInCart =
          state.currentHoldBillId === billId ||
          state.currentHoldBillId === bill?.billId ||
          (bill?.backendOrderId && state.currentBackendOrderId === bill?.backendOrderId);

        set((s) => ({
          openBills: s.openBills.filter((b) => b.id !== billId && b.billId !== billId),
          currentHoldBillId: isCurrentInCart ? null : s.currentHoldBillId,
          currentBackendOrderId: isCurrentInCart ? null : s.currentBackendOrderId,
          ...(isCurrentInCart
            ? {
                items: [],
                tableNo: '',
                customerName: '',
                selectedCustomerId: null,
                discountType: 'NOMINAL',
                discountValue: 0,
                attachedWorkspaceSession: null,
              }
            : {}),
        }));
      },

      /**
       * Gabungkan satu atau beberapa open bills ke dalam keranjang saat ini
       * @param {string[]} sourceBillIds - array id atau billId dari tagihan yang digabungkan
       */
      mergeOpenBills: async (sourceBillIds = []) => {
        if (!Array.isArray(sourceBillIds) || sourceBillIds.length === 0) {
          return { success: false, count: 0 };
        }
        const state = get();

        // Cari bills sumber yang cocok
        const sourceBills = state.openBills.filter(
          (b) => sourceBillIds.includes(b.id) || sourceBillIds.includes(b.billId)
        );

        if (sourceBills.length === 0) return { success: false, count: 0 };

        // 1. Kumpulkan item dari seluruh bill sumber
        let updatedItems = [...state.items];
        for (const bill of sourceBills) {
          const incomingItems = bill.items || [];
          for (const incItem of incomingItems) {
            const modifierIds = (incItem.modifiers || []).map((m) => m.id).sort().join('-');
            const itemKey =
              incItem.key ||
              `${incItem.productId}_${incItem.variant?.id || 'none'}_${modifierIds}_${incItem.note || ''}`;

            const existingIdx = updatedItems.findIndex((i) => i.key === itemKey);
            if (existingIdx > -1) {
              const current = updatedItems[existingIdx];
              const newQty = (Number(current.qty) || 0) + (Number(incItem.qty) || 1);
              const unitPrice = Number(current.unitPrice) || Number(incItem.unitPrice) || 0;
              updatedItems[existingIdx] = {
                ...current,
                qty: newQty,
                lineTotal: newQty * unitPrice,
              };
            } else {
              const unitPrice = Number(incItem.unitPrice ?? incItem.price) || 0;
              const qty = Number(incItem.qty) || 1;
              updatedItems.push({
                ...incItem,
                key: itemKey,
                qty,
                unitPrice,
                lineTotal: Number(incItem.lineTotal) || qty * unitPrice,
              });
            }
          }
        }

        // 2. Gabungkan nomor meja
        const currentTables = (state.tableNo || '')
          .split(/[,+]/)
          .map((t) => t.trim())
          .filter(Boolean);
        const incomingTables = sourceBills
          .flatMap((b) => (b.tableNo || '').split(/[,+]/))
          .map((t) => t.trim())
          .filter(Boolean);
        const mergedTables = Array.from(new Set([...currentTables, ...incomingTables])).join(', ');

        // 3. Gabungkan nama pelanggan jika keranjang aktif masih kosong
        let resolvedCustomerName = state.customerName;
        if (!resolvedCustomerName) {
          const customerNames = sourceBills
            .map((b) => (b.customerName || '').trim())
            .filter(Boolean);
          if (customerNames.length > 0) {
            resolvedCustomerName = Array.from(new Set(customerNames)).join(' & ');
          }
        }

        // 4. Hapus bill sumber dari backend hold order
        const deleteHoldOrder = useOrdersStore.getState().deleteHoldOrder;
        for (const bill of sourceBills) {
          if (typeof deleteHoldOrder === 'function') {
            try {
              await deleteHoldOrder(bill.billId, bill.backendOrderId);
            } catch (err) {
              console.warn('[CartStore] Gagal void order sumber gabungan:', err);
            }
          }
        }

        // 5. Update local openBills & keranjang
        const sourceBillIdSet = new Set(
          sourceBills.flatMap((b) => [b.id, b.billId, String(b.backendOrderId)].filter(Boolean))
        );

        set((s) => ({
          items: updatedItems,
          tableNo: mergedTables || s.tableNo,
          customerName: resolvedCustomerName || s.customerName,
          openBills: s.openBills.filter((b) => !sourceBillIdSet.has(b.id) && !sourceBillIdSet.has(b.billId)),
        }));

        return {
          success: true,
          count: sourceBills.length,
          mergedTableNo: mergedTables,
          totalItemsAdded: sourceBills.reduce((acc, b) => acc + (b.items || []).length, 0),
        };
      },

      // Sinkronisasi otomatis open bills dengan pesanan belum lunas di backend MySQL
      syncOpenBillsWithBackendOrders: async (forceFetch = false) => {
        if (isSyncingOpenBills) return;
        isSyncingOpenBills = true;

        try {
          // Ambil dari backend API hanya bila dipanggil dengan forceFetch: true
          if (forceFetch) {
            try {
              await useOrdersStore.getState().fetchOrders?.();
            } catch (err) {
              console.warn('[CartStore] syncOpenBills fetchOrders warning:', err);
            }
          }

          const state = get();
          const orders = useOrdersStore.getState().orders || [];

        // Ambil seluruh order yang belum lunas (bukan PAID, bukan VOIDED/REFUNDED, belum ada pembayaran)
        const isOpenOrder = (o) => {
          if (!o) return false;
          if (o.status === 'PAID' || o.status === 'VOIDED' || o.status === 'REFUNDED') return false;
          if (o.paidAt) return false;
          if (Array.isArray(o.payments) && o.payments.length > 0) return false;
          return true;
        };

        const openOrders = orders.filter(isOpenOrder);
        const currentOpenBills = [...state.openBills];
        let hasChanges = false;

        openOrders.forEach((o) => {
          // Jangan masukkan ke daftar openBills jika pesanan ini sedang aktif diedit di keranjang kasir lokal
          if (
            (state.currentBackendOrderId && Number(state.currentBackendOrderId) === Number(o.id)) ||
            (state.currentHoldBillId && (state.currentHoldBillId === o.billId || state.currentHoldBillId === `hold_${o.billId}`))
          ) {
            return;
          }

          const existingIdx = currentOpenBills.findIndex(
            (b) =>
              (b.backendOrderId && Number(b.backendOrderId) === Number(o.id)) ||
              b.id === `BILL-${o.id}` ||
              b.billId === `${o.id}` ||
              (o.billId && (b.billId === o.billId || b.id === `BILL-${o.billId}`)) ||
              (b.invoiceNo && o.invoiceNo && b.invoiceNo === o.invoiceNo)
          );

          const mappedBill = {
            id: `BILL-${o.id}`,
            billId: `${o.billId || o.id}`,
            backendOrderId: o.id,
            invoiceNo: o.invoiceNo,
            label: `Meja ${o.tableNo || 'Takeaway'} - ${o.customerName || 'Tamu'}`,
            items: (o.items || []).map((i) => ({
              productId: i.productId,
              name: i.productName || i.name || 'Item',
              variant: i.variantName ? { name: i.variantName } : null,
              unitPrice: Number(i.unitPrice) || 0,
              qty: Number(i.qty) || 1,
              lineTotal: Number(i.lineTotal) || (Number(i.qty) * Number(i.unitPrice)),
              note: i.note || '',
            })),
            orderType: o.type || 'DINE_IN',
            tableNo: o.tableNo || '',
            customerName: o.customerName || '',
            selectedCustomerId: o.customerId || null,
            discountType: 'NOMINAL',
            discountValue: Number(o.discount) || 0,
            attachedWorkspaceSession: null,
            savedAt: o.createdAt || new Date().toISOString(),
            total: Number(o.total) || 0,
          };

          if (existingIdx === -1) {
            currentOpenBills.push(mappedBill);
            hasChanges = true;
          } else {
            // Perbarui data jika ada perubahan (misal item bertambah, meja diubah, dsb.)
            const old = currentOpenBills[existingIdx];
            const itemsChanged = JSON.stringify(old.items) !== JSON.stringify(mappedBill.items);
            if (
              itemsChanged ||
              old.total !== mappedBill.total ||
              old.tableNo !== mappedBill.tableNo ||
              old.customerName !== mappedBill.customerName ||
              old.invoiceNo !== mappedBill.invoiceNo
            ) {
              currentOpenBills[existingIdx] = { ...old, ...mappedBill };
              hasChanges = true;
            }
          }
        });

        // Bersihkan bill yang di backend statusnya sudah lunas (PAID), dibatalkan (VOIDED / REFUNDED),
        // atau sedang aktif di keranjang kasir
        const validOpenBills = currentOpenBills.filter((b) => {
          // Jika bill ini sedang aktif di keranjang saat ini, buang dari list modal
          if (
            (b.backendOrderId && state.currentBackendOrderId && Number(b.backendOrderId) === Number(state.currentBackendOrderId)) ||
            (b.billId && state.currentHoldBillId && b.billId === state.currentHoldBillId)
          ) {
            hasChanges = true;
            return false;
          }

          // Cari order terkait di backend orders
          const matchingOrder = orders.find(
            (o) =>
              (b.backendOrderId && Number(o.id) === Number(b.backendOrderId)) ||
              (b.billId && String(o.id) === String(b.billId)) ||
              (o.billId && b.billId && String(o.billId) === String(b.billId)) ||
              (b.invoiceNo && o.invoiceNo && b.invoiceNo === o.invoiceNo)
          );

          if (matchingOrder) {
            if (!isOpenOrder(matchingOrder)) {
              hasChanges = true;
              return false;
            }
          }
          return true;
        });

        if (hasChanges || validOpenBills.length !== state.openBills.length) {
          set({ openBills: validOpenBills });
        }
      } finally {
        isSyncingOpenBills = false;
      }
    },
  }),
  {
    name: 'komazi-cart-storage',
  }
)
);

// Listener realtime lintas tab & window agar open bills selalu sinkron tanpa refresh
if (typeof window !== 'undefined') {
let debounceTimeout = null;
const triggerDebouncedSync = () => {
  if (debounceTimeout) clearTimeout(debounceTimeout);
  debounceTimeout = setTimeout(() => {
    useCartStore.getState().syncOpenBillsWithBackendOrders?.(false);
  }, 150);
};

// 1. Dengar event komazi:orders-updated lokal (same tab)
window.addEventListener('komazi:orders-updated', (e) => {
  if (e?.detail?.action === 'FETCH_ORDERS') return;
  triggerDebouncedSync();
});

// 2. Dengar broadcast channel lintas tab
try {
  const channel = new BroadcastChannel('komazi_orders_sync');
  channel.addEventListener('message', (e) => {
    if (e?.data?.action === 'FETCH_ORDERS') return;
    triggerDebouncedSync();
  });
} catch (_) {}

// 3. Dengar localStorage storage event
window.addEventListener('storage', (e) => {
  if (e.key === 'komazi-orders-storage') {
    triggerDebouncedSync();
  }
});

// 4. Daftarkan callback langsung ke pub/sub ordersStore
if (typeof subscribeOrdersChanged === 'function') {
  subscribeOrdersChanged((detail) => {
    if (detail?.action === 'FETCH_ORDERS') return;
    triggerDebouncedSync();
  });
}
}
