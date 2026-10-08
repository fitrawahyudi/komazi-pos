import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useSettingsStore } from './settingsStore';
import { useOrdersStore } from './ordersStore';
import { usePosStore } from './posStore';

export const useCartStore = create(
  persist(
    (set, get) => ({
      items: [],
      orderType: 'DINE_IN', // 'DINE_IN' | 'TAKE_AWAY'
      tableNo: '',
      customerName: '',
      selectedCustomerId: null, // ID pelanggan terdaftar yang dipilih (null = tamu/non-member)
      discountType: 'NOMINAL', // 'NOMINAL' | 'PERCENT'
      discountValue: 0,
      attachedWorkspaceSession: null, // If bundled with workspace
      openBills: [], // Array of saved open orders
      currentHoldBillId: null, // ID hold bill yang sedang diedit/direstore (jika ada)
      currentBackendOrderId: null, // ID pesanan MySQL di backend (jika ada)

      setOrderType: (type) => set({ orderType: type }),
      setTableNo: (tableNo) => set({ tableNo }),
      setCustomerName: (customerName) => set({ customerName }),
      // Set customer dari data pelanggan terdaftar
      setSelectedCustomer: (customerId, customerName) => set({ selectedCustomerId: customerId, customerName }),
      
      setDiscount: (type, value) => {
        set({
          discountType: type,
          discountValue: Math.max(0, Number(value) || 0),
        });
      },

      attachWorkspaceSession: (session) => {
        set({ attachedWorkspaceSession: session });
      },

      clearWorkspaceSession: () => {
        set({ attachedWorkspaceSession: null });
      },

      /**
       * Add product to cart with chosen variant & modifiers
       */
      addItem: (product, selectedVariant = null, selectedModifiers = [], note = '') => {
        const state = get();
        const variantPrice = selectedVariant ? Number(selectedVariant.extraPrice || 0) : 0;
        const modifiersPrice = selectedModifiers.reduce((sum, m) => sum + Number(m.price || 0), 0);
        const unitPrice = Number(product.price) + variantPrice + modifiersPrice;

        // Unique key based on product ID, variant ID, and selected modifier IDs
        const modifierIds = selectedModifiers.map((m) => m.id).sort().join('-');
        const itemKey = `${product.id}_${selectedVariant?.id || 'none'}_${modifierIds}_${note || ''}`;

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
            variant: selectedVariant,
            modifiers: selectedModifiers,
            unitPrice,
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

      clearCart: () => {
        const state = get();
        if (state.currentHoldBillId || state.currentBackendOrderId) {
          useOrdersStore.getState().deleteHoldOrder?.(state.currentHoldBillId, state.currentBackendOrderId);
        }
        set({
          items: [],
          tableNo: '',
          customerName: '',
          selectedCustomerId: null,
          discountType: 'NOMINAL',
          discountValue: 0,
          attachedWorkspaceSession: null,
          currentHoldBillId: null,
          currentBackendOrderId: null,
        });
      },

      // Calculate totals
      getCartSummary: () => {
        const { items, discountType, discountValue, attachedWorkspaceSession } = get();
        const { settings } = useSettingsStore.getState();

        const itemsSubtotal = items.reduce((sum, item) => sum + Number(item.lineTotal || 0), 0);
        const workspaceCharge = attachedWorkspaceSession ? Number(attachedWorkspaceSession.charge || 0) : 0;
        const subtotal = itemsSubtotal + workspaceCharge;

        let discountAmount = 0;
        if (discountType === 'PERCENT') {
          discountAmount = Math.round((subtotal * Math.min(100, discountValue)) / 100);
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

      // Sinkronisasi otomatis open bills dengan pesanan berstatus OPEN di backend MySQL
      syncOpenBillsWithBackendOrders: () => {
        const state = get();
        const orders = useOrdersStore.getState().orders || [];
        const openOrders = orders.filter((o) => o.status === 'OPEN');

        const currentOpenBills = [...state.openBills];
        let hasChanges = false;

        openOrders.forEach((o) => {
          const exists = currentOpenBills.some(
            (b) => b.backendOrderId === o.id || b.id === `BILL-${o.id}` || b.billId === `${o.id}`
          );
          if (!exists) {
            currentOpenBills.push({
              id: `BILL-${o.id}`,
              billId: `${o.id}`,
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
              selectedCustomerId: null,
              discountType: 'NOMINAL',
              discountValue: Number(o.discount) || 0,
              attachedWorkspaceSession: null,
              savedAt: o.createdAt || new Date().toISOString(),
              total: Number(o.total) || 0,
            });
            hasChanges = true;
          }
        });

        // Bersihkan bill yang di backend statusnya sudah bukan OPEN (sudah PAID / VOIDED)
        const validOpenBills = currentOpenBills.filter((b) => {
          if (!b.backendOrderId) return true;
          const matchingOrder = orders.find((o) => o.id === b.backendOrderId);
          if (matchingOrder && matchingOrder.status !== 'OPEN') {
            hasChanges = true;
            return false;
          }
          return true;
        });

        if (hasChanges) {
          set({ openBills: validOpenBills });
        }
      },
    }),
    {
      name: 'komazi-cart-storage',
    }
  )
);
