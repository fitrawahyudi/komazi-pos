import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { generateInvoiceNumber, isDrinkItem } from '../utils/format';
import { useRecipeStore } from './useRecipeStore';
import { useShiftStore } from './shiftStore';
import { useStockStore } from './stockStore';
import { api } from '../services/api';
import { getSocket } from '../services/socket';
import { NotificationService } from '../services/notification.service';

// Helper: normalisasi order objek dari backend/socket menjadi format seragam
export function formatSingleOrder(o) {
  if (!o) return null;
  return {
    ...o,
    cashierName: o.cashierName || o.cashier?.name || o.shift?.cashier?.name || 'Kasir',
    total: Number(o.total) || 0,
    subtotal: Number(o.subtotal) || 0,
    discount: Number(o.discount) || 0,
    tax: Number(o.tax) || 0,
    serviceFee: Number(o.serviceFee) || 0,
    items: (o.items || []).map((i) => ({
      ...i,
      categoryName: i.categoryName || i.product?.category?.name || '',
      qty: Number(i.qty) || 1,
      unitPrice: Number(i.unitPrice) || 0,
      lineTotal: Number(i.lineTotal) || 0,
      unitCost: Number(i.unitCost) || 0,
      lineCost: Number(i.lineCost) || 0,
    })),
    kitchenStatus: o.kitchenStatus || 'PENDING',
    barStatus: o.barStatus || 'PENDING',
    status: o.status || 'PAID',
  };
}

// Cross-tab real-time pub/sub synchronization channel
const SYNC_CHANNEL_NAME = 'komazi_orders_sync';
let syncChannel = null;
if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    syncChannel = new BroadcastChannel(SYNC_CHANNEL_NAME);
  } catch (err) {
    console.warn('BroadcastChannel initialization error:', err);
  }
}

export function broadcastOrdersSync(eventDetail) {
  if (typeof window !== 'undefined') {
    // 1. Post to other tabs / windows via BroadcastChannel
    if (syncChannel) {
      try {
        syncChannel.postMessage(eventDetail);
      } catch (err) {
        console.warn('Broadcast error:', err);
      }
    }
    // 2. Dispatch local CustomEvent for same-tab / same-window components
    try {
      window.dispatchEvent(new CustomEvent('komazi:orders-updated', { detail: eventDetail }));
    } catch { }
  }
}

// Same-tab reactive event listeners set (e.g. cartStore open bills auto sync)
const ordersChangedListeners = new Set();
export function subscribeOrdersChanged(listener) {
  ordersChangedListeners.add(listener);
  return () => ordersChangedListeners.delete(listener);
}
export function notifyOrdersChanged(detail) {
  ordersChangedListeners.forEach((fn) => {
    try {
      fn(detail);
    } catch (err) {
      console.warn('[OrdersStore] Listener callback error:', err);
    }
  });
}

// In-flight deduplication promises to prevent duplicate concurrent network requests
let inFlightFetchOrdersPromise = null;
let inFlightFetchBackendOrdersPromise = null;

export const useOrdersStore = create(
  persist(
    (set, get) => ({
      orders: [],
      invoiceSequence: 1,
      auditLogs: [],
      isLoading: false,

      // Handler untuk pesanan baru via Socket.IO realtime
      handleIncomingOrder: (rawOrder) => {
        const formatted = formatSingleOrder(rawOrder);
        if (!formatted) return;

        set((state) => {
          const existsIndex = state.orders.findIndex(
            (o) => String(o.id) === String(formatted.id) || (o.invoiceNo && o.invoiceNo === formatted.invoiceNo)
          );

          if (existsIndex >= 0) {
            const updated = [...state.orders];
            updated[existsIndex] = { ...updated[existsIndex], ...formatted };
            return { orders: updated };
          } else {
            return { orders: [formatted, ...state.orders] };
          }
        });

        // Picu sinkronisasi open bills dan dispatch notifikasi realtime
        notifyOrdersChanged({ action: 'INCOMING_ORDER', order: formatted });
        broadcastOrdersSync({
          type: 'ORDER_CHANGED',
          action: 'INCOMING_ORDER',
          order: formatted,
        });
      },

      // Handler untuk update status pesanan via Socket.IO realtime
      handleUpdatedOrder: (rawOrder) => {
        const formatted = formatSingleOrder(rawOrder);
        if (!formatted) return;

        set((state) => {
          const existsIndex = state.orders.findIndex(
            (o) => String(o.id) === String(formatted.id) || (o.invoiceNo && o.invoiceNo === formatted.invoiceNo)
          );

          if (existsIndex >= 0) {
            const updated = [...state.orders];
            updated[existsIndex] = { ...updated[existsIndex], ...formatted };
            return { orders: updated };
          } else {
            return { orders: [formatted, ...state.orders] };
          }
        });

        // Picu sinkronisasi open bills dan dispatch notifikasi realtime
        notifyOrdersChanged({ action: 'UPDATED_ORDER', order: formatted });
        broadcastOrdersSync({
          type: 'ORDER_CHANGED',
          action: 'UPDATED_ORDER',
          order: formatted,
        });
      },

      fetchOrders: async (options = {}) => {
        if (!options || Object.keys(options).length === 0) {
          if (inFlightFetchOrdersPromise) {
            return inFlightFetchOrdersPromise;
          }
        }

        const runFetch = (async () => {
          try {
            set({ isLoading: true });
            const res = await api.orders.getAll(options);
            if (res && res.success && Array.isArray(res.data)) {
              const formatted = res.data.map((o) => ({
                ...o,
                cashierName: o.cashierName || o.cashier?.name || o.shift?.cashier?.name || 'Kasir',
                total: Number(o.total) || 0,
                subtotal: Number(o.subtotal) || 0,
                discount: Number(o.discount) || 0,
                tax: Number(o.tax) || 0,
                serviceFee: Number(o.serviceFee) || 0,
                items: (o.items || []).map((i) => ({
                  ...i,
                  categoryName: i.categoryName || i.product?.category?.name || '',
                  qty: Number(i.qty) || 1,
                  unitPrice: Number(i.unitPrice) || 0,
                  lineTotal: Number(i.lineTotal) || 0,
                  unitCost: Number(i.unitCost) || 0,
                  lineCost: Number(i.lineCost) || 0,
                })),
                kitchenStatus: o.kitchenStatus || 'PENDING',
                barStatus: o.barStatus || 'PENDING',
                status: o.status || 'PAID',
              }));
              set({ orders: formatted, isLoading: false });
              // Pure query: DO NOT broadcast mutation events (which causes feedback loops)
              return formatted;
            }
          } catch (err) {
            console.error('[OrdersStore] Error fetching orders:', err);
          } finally {
            set({ isLoading: false });
            inFlightFetchOrdersPromise = null;
          }
          return get().orders;
        })();

        if (!options || Object.keys(options).length === 0) {
          inFlightFetchOrdersPromise = runFetch;
        }
        return runFetch;
      },

      fetchBackendOrders: async (options = {}) => {
        if (inFlightFetchBackendOrdersPromise) {
          return inFlightFetchBackendOrdersPromise;
        }

        inFlightFetchBackendOrdersPromise = (async () => {
          const state = get();
          try {
            set({ isLoading: true });
            const res = await api.orders.getAll(options);
            if (res && res.success && Array.isArray(res.data)) {
              const formatted = res.data.map((o) => ({
                ...o,
                cashierName: o.cashierName || o.cashier?.name || o.shift?.cashier?.name || 'Kasir',
                total: Number(o.total) || 0,
                subtotal: Number(o.subtotal) || 0,
                discount: Number(o.discount) || 0,
                tax: Number(o.tax) || 0,
                serviceFee: Number(o.serviceFee) || 0,
                items: (o.items || []).map((i) => ({
                  ...i,
                  categoryName: i.categoryName || i.product?.category?.name || '',
                  qty: Number(i.qty) || 1,
                  unitPrice: Number(i.unitPrice) || 0,
                  lineTotal: Number(i.lineTotal) || 0,
                  unitCost: Number(i.unitCost) || 0,
                  lineCost: Number(i.lineCost) || 0,
                  status: i.status || 'PENDING',
                })),
                kitchenStatus: o.kitchenStatus || 'PENDING',
                barStatus: o.barStatus || 'PENDING',
                status: o.status || 'PAID',
              }));
              set({ orders: formatted, isLoading: false });
              // Pure query: DO NOT broadcast mutation events (which causes feedback loops)
              return { success: true, count: formatted.length, orders: formatted };
            }
          } catch (err) {
            console.warn('[OrdersStore] fetchBackendOrders error:', err);
          } finally {
            set({ isLoading: false });
            inFlightFetchBackendOrdersPromise = null;
          }
          return { success: false, count: 0, orders: state.orders };
        })();

        return inFlightFetchBackendOrdersPromise;
      },

      createOrder: async (orderPayload) => {
        const state = get();
        const invoiceNo = generateInvoiceNumber(state.invoiceSequence);

        // Snapshot HPP per item from recipe store
        const itemsWithCost = (orderPayload.items || []).map((item) => {
          let unitCost = item.unitCost;
          if (unitCost === undefined || unitCost === null) {
            try {
              unitCost = useRecipeStore.getState().calculateProductHpp(item.productId);
            } catch {
              unitCost = 0;
            }
          }
          const lineCost = Math.round((Number(unitCost) || 0) * (Number(item.qty) || 1) * 100) / 100;
          return {
            ...item,
            unitCost: Number(unitCost) || 0,
            lineCost,
          };
        });

        // Bersihkan payments agar bebas dari object event / DOM
        const cleanPayments = (orderPayload.payments || [
          { method: orderPayload.paymentMethod || 'CASH', amount: Number(orderPayload.total) || 0 }
        ]).map((p) => ({
          method: typeof p.method === 'string' ? p.method : 'CASH',
          amount: Number(p.amount) || 0,
          tendered: Number(p.tendered) || Number(p.amount) || 0,
          change: Number(p.change) || 0,
          reference: typeof p.reference === 'string' && p.reference.trim() ? p.reference.trim() : null,
        }));

        const cleanTableNo = orderPayload.tableNo ? String(orderPayload.tableNo) : null;
        const cleanCustomerName = orderPayload.customerName ? String(orderPayload.customerName) : null;

        let newOrder = {
          ...orderPayload,
          cashierName: orderPayload.cashierName || orderPayload.cashier?.name || 'Kasir',
          tableNo: cleanTableNo,
          customerName: cleanCustomerName,
          items: itemsWithCost,
          payments: cleanPayments,
          id: Date.now(),
          invoiceNo,
          status: 'PAID',
          kitchenStatus: 'PENDING', // stasiun dapur (makanan)
          barStatus: 'PENDING',     // stasiun bar (minuman)
          createdAt: new Date().toISOString(),
          paidAt: new Date().toISOString(),
        };

        // Persist order to MySQL backend
        try {
          const validOrderItems = itemsWithCost
            .map((i) => ({
              productId: Number(i.productId || i.id),
              variantName: i.variantName ? String(i.variantName) : null,
              qty: Number(i.qty) || 1,
              unitPrice: Number(i.price || i.unitPrice) || 0,
              discount: Number(i.discount) || 0,
              note: i.note ? String(i.note) : null,
            }))
            .filter((i) => !isNaN(i.productId) && i.productId > 0);

          const apiRes = await api.orders.create({
            type: orderPayload.type || 'DINE_IN',
            tableNo: cleanTableNo,
            customerName: cleanCustomerName,
            customerId: orderPayload.customerId ? Number(orderPayload.customerId) : null,
            shiftId: orderPayload.shiftId ? Number(orderPayload.shiftId) : null,
            items: validOrderItems,
            discount: Number(orderPayload.discount) || 0,
            payments: cleanPayments,
            workspaceSessionId: (orderPayload.workspaceSessionId ?? orderPayload.workspaceSession?.id)
              ? Number(orderPayload.workspaceSessionId ?? orderPayload.workspaceSession?.id)
              : null,
            promoCode: orderPayload.promoCode || null,
            promoName: orderPayload.promoName || null,
          });

          if (apiRes && !apiRes.success) {
            const errorDetails = Array.isArray(apiRes.errors) && apiRes.errors.length > 0
              ? apiRes.errors.map((e) => `${e.field}: ${e.message}`).join(', ')
              : null;
            const errMsg = errorDetails
              ? `${apiRes.message || 'Validasi gagal'} (${errorDetails})`
              : (apiRes.message || 'Gagal membuat pesanan');
            throw new Error(errMsg);
          }

          if (apiRes && apiRes.success && apiRes.data) {
            newOrder = {
              ...newOrder,
              ...apiRes.data,
              cashierName: apiRes.data.cashierName || apiRes.data.cashier?.name || newOrder.cashierName || 'Kasir',
              items: (apiRes.data.items || newOrder.items).map((i, idx) => ({
                ...i,
                categoryName: i.categoryName || newOrder.items[idx]?.categoryName || i.product?.category?.name || '',
              })),
              total: Number(apiRes.data.total),
              subtotal: Number(apiRes.data.subtotal),
              kitchenStatus: apiRes.data.kitchenStatus || 'PENDING',
              barStatus: apiRes.data.barStatus || 'PENDING',
            };
          }
        } catch (err) {
          console.warn('[OrdersStore] Backend order create error:', err);
          throw err;
        }

        const nextOrders = [newOrder, ...state.orders];
        const nextSeq = state.invoiceSequence + 1;

        set({
          orders: nextOrders,
          invoiceSequence: nextSeq,
        });

        broadcastOrdersSync({
          type: 'ORDER_CHANGED',
          action: 'ORDER_CREATED',
          order: newOrder,
          state: {
            orders: nextOrders,
            invoiceSequence: nextSeq,
            auditLogs: state.auditLogs,
          },
        });

        return newOrder;
      },

      // Buat / perbarui hold order (bill ditahan) langsung masuk ke KDS / BDS & tersimpan di MySQL backend
      createHoldOrder: async (billPayload) => {
        const state = get();
        const billId = billPayload.billId || Date.now();
        const holdId = `hold_${billId}`;

        // Cari order hold yang sudah ada (via holdId, billId, atau backendOrderId)
        const existingHold = state.orders.find(
          (o) => o.id === holdId || o.billId === billId || (billPayload.backendOrderId && o.id === billPayload.backendOrderId) || o.backendOrderId === billPayload.backendOrderId
        );
        const existingBackendId = billPayload.backendOrderId || existingHold?.backendOrderId || (typeof existingHold?.id === 'number' && existingHold.id < 1000000000000 ? existingHold.id : null);

        const oldItems = existingHold?.items || [];
        const newItems = billPayload.items || [];

        const oldHadFood = oldItems.some((i) => !isDrinkItem(i));
        const newHasFood = newItems.some((i) => !isDrinkItem(i));
        const oldHadDrinks = oldItems.some(isDrinkItem);
        const newHasDrinks = newItems.some(isDrinkItem);

        let resolvedKitchenStatus = existingHold?.kitchenStatus || 'PENDING';
        if (!oldHadFood && newHasFood) {
          resolvedKitchenStatus = 'PENDING';
        } else if (resolvedKitchenStatus === 'SERVED' && newHasFood && newItems.length > oldItems.length) {
          resolvedKitchenStatus = 'PENDING';
        }

        let resolvedBarStatus = existingHold?.barStatus || existingHold?.kitchenStatus || 'PENDING';
        if (!oldHadDrinks && newHasDrinks) {
          resolvedBarStatus = 'PENDING';
        } else if (resolvedBarStatus === 'SERVED' && newHasDrinks && newItems.length > oldItems.length) {
          resolvedBarStatus = 'PENDING';
        }

        const cleanTableNo = billPayload.tableNo ? String(billPayload.tableNo) : null;
        const cleanCustomerName = billPayload.customerName ? String(billPayload.customerName) : null;

        const payloadItems = (billPayload.items || []).map((i) => ({
          productId: Number(i.productId),
          variantName: i.variant?.name || i.variantName ? String(i.variant?.name || i.variantName) : null,
          qty: Number(i.qty) || 1,
          unitPrice: Number(i.unitPrice ?? i.price) || 0,
          discount: Number(i.discount) || 0,
          note: i.note ? String(i.note) : null,
          categoryName: i.categoryName || null,
          productName: i.name || i.productName || 'Item',
          name: i.name || i.productName || 'Item',
        }));

        const backendPayload = {
          type: billPayload.type || billPayload.orderType || 'DINE_IN',
          tableNo: cleanTableNo,
          customerName: cleanCustomerName,
          customerId: (billPayload.customerId ?? billPayload.selectedCustomerId)
            ? Number(billPayload.customerId ?? billPayload.selectedCustomerId)
            : null,
          shiftId: billPayload.shiftId ? Number(billPayload.shiftId) : null,
          items: payloadItems,
          discount: Number(billPayload.discount || billPayload.discountValue) || 0,
          payments: [], // Kosong menandakan order belum dibayar / OPEN
          workspaceSessionId: billPayload.attachedWorkspaceSession?.id ? Number(billPayload.attachedWorkspaceSession.id) : null,
        };

        let savedBackendOrder = null;
        try {
          if (existingBackendId) {
            const res = await api.orders.update(existingBackendId, backendPayload);
            if (res && res.success && res.data) {
              savedBackendOrder = res.data;
            }
          } else {
            const res = await api.orders.create(backendPayload);
            if (res && res.success && res.data) {
              savedBackendOrder = res.data;
            }
          }
        } catch (err) {
          console.warn('[OrdersStore] Backend hold order sync warning:', err);
        }

        const assignedId = savedBackendOrder?.id || existingBackendId || holdId;
        const assignedInvoice = savedBackendOrder?.invoiceNo || existingHold?.invoiceNo || billPayload.invoiceNo || `HOLD-${generateInvoiceNumber(state.invoiceSequence)}`;

        const holdOrder = {
          ...billPayload,
          ...(savedBackendOrder || {}),
          id: assignedId,
          backendOrderId: savedBackendOrder?.id || existingBackendId || null,
          billId,
          invoiceNo: assignedInvoice,
          status: 'OPEN',
          kitchenStatus: savedBackendOrder?.kitchenStatus || resolvedKitchenStatus,
          barStatus: savedBackendOrder?.barStatus || resolvedBarStatus,
          tableNo: cleanTableNo,
          customerName: cleanCustomerName,
          items: (savedBackendOrder?.items || payloadItems).map((i, idx) => ({
            ...i,
            categoryName: i.categoryName || i.product?.category?.name || payloadItems[idx]?.categoryName || '',
            qty: Number(i.qty) || 1,
            unitPrice: Number(i.unitPrice) || 0,
            lineTotal: Number(i.lineTotal) || (Number(i.qty) * Number(i.unitPrice)),
          })),
          createdAt: savedBackendOrder?.createdAt || existingHold?.createdAt || billPayload.savedAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const remainingOrders = state.orders.filter(
          (o) => o.id !== holdId && o.id !== assignedId && o.billId !== billId && (!existingBackendId || o.id !== existingBackendId)
        );
        const nextOrders = [holdOrder, ...remainingOrders];
        const nextSeq = savedBackendOrder ? state.invoiceSequence : state.invoiceSequence + 1;

        set({
          orders: nextOrders,
          invoiceSequence: nextSeq,
        });

        notifyOrdersChanged({
          action: 'HOLD_ORDER_CREATED',
          order: holdOrder,
        });

        broadcastOrdersSync({
          type: 'ORDER_CHANGED',
          action: 'HOLD_ORDER_CREATED',
          order: holdOrder,
          state: {
            orders: nextOrders,
            invoiceSequence: nextSeq,
            auditLogs: state.auditLogs,
          },
        });

        return holdOrder;
      },

      // Hapus / batalkan hold order (sinkron ke backend VOID & hapus tiket dari KDS)
      deleteHoldOrder: async (billId, knownBackendId = null) => {
        const state = get();
        const holdId = `hold_${billId}`;
        const holdOrder = state.orders.find(
          (o) => o.billId === billId || o.id === holdId || (knownBackendId && o.id === knownBackendId) || o.backendOrderId === knownBackendId
        );
        const actualBackendId = knownBackendId || holdOrder?.backendOrderId || (typeof holdOrder?.id === 'number' && holdOrder.id < 1000000000000 ? holdOrder.id : null);

        if (actualBackendId) {
          try {
            await api.orders.void(actualBackendId, 'Pesanan tertahan (Hold Bill) dibatalkan oleh kasir');
          } catch (err) {
            console.warn('[OrdersStore] Backend void hold order warning:', err);
          }
        }

        const nextOrders = state.orders.filter(
          (o) => o.id !== holdId && o.id !== actualBackendId && o.billId !== billId && (!knownBackendId || o.id !== knownBackendId)
        );

        set({ orders: nextOrders });

        // Jika pesanan tertahan ini sedang dibuka di keranjang kasir, kosongkan juga dari keranjang
        try {
          const { useCartStore } = await import('./cartStore');
          const cartState = useCartStore.getState();
          if (
            cartState.currentHoldBillId === billId ||
            (actualBackendId && cartState.currentBackendOrderId === actualBackendId)
          ) {
            cartState.clearCart();
          }
          // Pastikan dihapus juga dari list openBills di cartStore
          useCartStore.setState((s) => ({
            openBills: s.openBills.filter(
              (b) => b.id !== billId && b.billId !== billId && (!actualBackendId || b.backendOrderId !== actualBackendId)
            ),
          }));
        } catch (_) { }

        notifyOrdersChanged({
          action: 'ORDER_DELETED',
          billId,
          orderId: actualBackendId,
        });

        broadcastOrdersSync({
          type: 'ORDER_CHANGED',
          action: 'ORDER_DELETED',
          billId,
          state: {
            orders: nextOrders,
            invoiceSequence: state.invoiceSequence,
            auditLogs: state.auditLogs,
          },
        });
      },

      // Ketika hold bill dibayar: update status hold order ke PAID, hubungkan ke backend
      upgradeHoldToPaid: async (billId, paidOrderPayload, knownBackendId = null) => {
        const state = get();
        const holdId = `hold_${billId}`;
        const oldHold = state.orders.find(
          (o) => o.billId === billId || o.id === holdId || (knownBackendId && o.id === knownBackendId) || o.backendOrderId === billId
        );
        const actualBackendId = knownBackendId || oldHold?.backendOrderId || (typeof oldHold?.id === 'number' && oldHold.id < 1000000000000 ? oldHold.id : null);

        const oldItems = oldHold?.items || [];
        const newItems = paidOrderPayload.items || [];
        const oldHadFood = oldItems.some((i) => !isDrinkItem(i));
        const newHasFood = newItems.some((i) => !isDrinkItem(i));
        const oldHadDrinks = oldItems.some(isDrinkItem);
        const newHasDrinks = newItems.some(isDrinkItem);

        let resolvedKitchenStatus = oldHold?.kitchenStatus || 'PENDING';
        if (!oldHadFood && newHasFood) {
          resolvedKitchenStatus = 'PENDING';
        } else if (resolvedKitchenStatus === 'SERVED' && newHasFood && newItems.length > oldItems.length) {
          resolvedKitchenStatus = 'PENDING';
        }

        let resolvedBarStatus = oldHold?.barStatus || oldHold?.kitchenStatus || 'PENDING';
        if (!oldHadDrinks && newHasDrinks) {
          resolvedBarStatus = 'PENDING';
        } else if (resolvedBarStatus === 'SERVED' && newHasDrinks && newItems.length > oldItems.length) {
          resolvedBarStatus = 'PENDING';
        }

        const cleanPayments = (paidOrderPayload.payments || [
          { method: paidOrderPayload.paymentMethod || 'CASH', amount: Number(paidOrderPayload.total) || 0 }
        ]).map((p) => ({
          method: typeof p.method === 'string' ? p.method : 'CASH',
          amount: Number(p.amount) || 0,
          tendered: Number(p.tendered) || Number(p.amount) || 0,
          change: Number(p.change) || 0,
          reference: typeof p.reference === 'string' && p.reference.trim() ? p.reference.trim() : null,
        }));

        const cleanTableNo = paidOrderPayload.tableNo ? String(paidOrderPayload.tableNo) : null;
        const cleanCustomerName = paidOrderPayload.customerName ? String(paidOrderPayload.customerName) : null;

        const payloadItems = (paidOrderPayload.items || []).map((i) => ({
          productId: Number(i.productId),
          variantName: i.variant?.name || i.variantName ? String(i.variant?.name || i.variantName) : null,
          qty: Number(i.qty) || 1,
          unitPrice: Number(i.price || i.unitPrice) || 0,
          discount: Number(i.discount) || 0,
          note: i.note ? String(i.note) : null,
          categoryName: i.categoryName || null,
          productName: i.name || i.productName || 'Item',
          name: i.name || i.productName || 'Item',
        }));

        let paidOrderBackend = null;
        try {
          if (actualBackendId) {
            const payRes = await api.orders.pay(actualBackendId, {
              payments: cleanPayments,
              items: payloadItems,
              discount: Number(paidOrderPayload.discount) || 0,
              type: paidOrderPayload.type || 'DINE_IN',
              tableNo: cleanTableNo,
              customerName: cleanCustomerName,
              customerId: paidOrderPayload.customerId ? Number(paidOrderPayload.customerId) : null,
              promoCode: paidOrderPayload.promoCode || null,
              promoName: paidOrderPayload.promoName || null,
            });
            if (payRes && !payRes.success) {
              const errorDetails = Array.isArray(payRes.errors) && payRes.errors.length > 0
                ? payRes.errors.map((e) => `${e.field}: ${e.message}`).join(', ')
                : null;
              throw new Error(errorDetails ? `${payRes.message || 'Gagal memproses pembayaran'} (${errorDetails})` : (payRes.message || 'Gagal memproses pembayaran'));
            }
            if (payRes && payRes.success && payRes.data) {
              paidOrderBackend = payRes.data;
            }
          } else {
            const createRes = await api.orders.create({
              type: paidOrderPayload.type || 'DINE_IN',
              tableNo: cleanTableNo,
              customerName: cleanCustomerName,
              customerId: paidOrderPayload.customerId ? Number(paidOrderPayload.customerId) : null,
              shiftId: paidOrderPayload.shiftId ? Number(paidOrderPayload.shiftId) : null,
              items: payloadItems,
              discount: Number(paidOrderPayload.discount) || 0,
              payments: cleanPayments,
              workspaceSessionId: paidOrderPayload.workspaceSessionId ? Number(paidOrderPayload.workspaceSessionId) : null,
              promoCode: paidOrderPayload.promoCode || null,
              promoName: paidOrderPayload.promoName || null,
            });
            if (createRes && !createRes.success) {
              const errorDetails = Array.isArray(createRes.errors) && createRes.errors.length > 0
                ? createRes.errors.map((e) => `${e.field}: ${e.message}`).join(', ')
                : null;
              throw new Error(errorDetails ? `${createRes.message || 'Validasi gagal'} (${errorDetails})` : (createRes.message || 'Gagal membuat pesanan'));
            }
            if (createRes && createRes.success && createRes.data) {
              paidOrderBackend = createRes.data;
            }
          }
        } catch (err) {
          console.warn('[OrdersStore] Backend pay order error:', err);
          throw err;
        }

        const invoiceNo = paidOrderBackend?.invoiceNo || oldHold?.invoiceNo || generateInvoiceNumber(state.invoiceSequence);
        const finalId = paidOrderBackend?.id || actualBackendId || Date.now();

        const paidOrder = {
          ...paidOrderPayload,
          ...(paidOrderBackend || {}),
          id: finalId,
          invoiceNo,
          tableNo: cleanTableNo,
          customerName: cleanCustomerName,
          payments: cleanPayments,
          status: 'PAID',
          kitchenStatus: resolvedKitchenStatus,
          barStatus: resolvedBarStatus,
          items: (paidOrderBackend?.items || payloadItems).map((i, idx) => ({
            ...i,
            categoryName: i.categoryName || i.product?.category?.name || payloadItems[idx]?.categoryName || '',
            qty: Number(i.qty) || 1,
            unitPrice: Number(i.unitPrice) || 0,
            lineTotal: Number(i.lineTotal) || (Number(i.qty) * Number(i.unitPrice)),
          })),
          createdAt: oldHold?.createdAt || paidOrderBackend?.createdAt || new Date().toISOString(),
          paidAt: new Date().toISOString(),
        };

        const withoutHold = state.orders.filter(
          (o) => o.id !== holdId && o.id !== finalId && o.billId !== billId && (!actualBackendId || o.id !== actualBackendId)
        );
        const nextOrders = [paidOrder, ...withoutHold];
        const nextSeq = paidOrderBackend ? state.invoiceSequence : state.invoiceSequence + 1;

        set({
          orders: nextOrders,
          invoiceSequence: nextSeq,
        });

        notifyOrdersChanged({
          action: 'HOLD_UPGRADED_TO_PAID',
          order: paidOrder,
        });

        broadcastOrdersSync({
          type: 'ORDER_CHANGED',
          action: 'HOLD_UPGRADED_TO_PAID',
          order: paidOrder,
          state: {
            orders: nextOrders,
            invoiceSequence: nextSeq,
            auditLogs: state.auditLogs,
          },
        });

        return paidOrder;
      },

      updateKitchenStatus: (orderId, newStatus, station = null) => {
        const state = get();
        const nextOrders = state.orders.map((o) => {
          if (o.id !== orderId) return o;
          if (station === 'BAR') {
            const hasKitchenItems = (o.items || []).some((item) => !isDrinkItem(item));
            return {
              ...o,
              barStatus: newStatus,
              // Bila pesanan hanya berisi minuman (tanpa makanan), selaraskan juga kitchenStatus utama
              kitchenStatus: hasKitchenItems ? o.kitchenStatus : newStatus,
            };
          } else if (station === 'KITCHEN') {
            const hasBarItems = (o.items || []).some(isDrinkItem);
            return {
              ...o,
              kitchenStatus: newStatus,
              // Bila pesanan hanya berisi makanan (tanpa minuman), selaraskan juga barStatus
              barStatus: hasBarItems ? (o.barStatus || o.kitchenStatus) : newStatus,
            };
          } else {
            return {
              ...o,
              kitchenStatus: newStatus,
              barStatus: newStatus,
            };
          }
        });

        set({ orders: nextOrders });

        // Asynchronously persist to backend database
        if (typeof orderId === 'number' && orderId < 1000000000000) {
          api.orders.updateKitchenStatus(orderId, { status: newStatus, station }).catch((err) => {
            console.warn('[OrdersStore] Backend kitchen status update warning:', err);
          });
        }

        broadcastOrdersSync({
          type: 'ORDER_CHANGED',
          action: 'KITCHEN_STATUS_UPDATED',
          orderId,
          newStatus,
          station,
          state: {
            orders: nextOrders,
            invoiceSequence: state.invoiceSequence,
            auditLogs: state.auditLogs,
          },
        });
      },

      applySocketNewOrder: (order) => {
        const state = get();
        if (!order || !order.id) return;
        const exists = state.orders.some((o) => o.id === order.id);
        if (exists) {
          get().applySocketOrderUpdated(order);
          return;
        }
        const formatted = {
          ...order,
          total: Number(order.total) || 0,
          subtotal: Number(order.subtotal) || 0,
          items: (order.items || []).map((i) => ({
            ...i,
            categoryName: i.categoryName || i.product?.category?.name || '',
            qty: Number(i.qty) || 1,
            unitPrice: Number(i.unitPrice) || 0,
            status: i.status || 'PENDING',
          })),
        };
        const nextOrders = [formatted, ...state.orders];
        set({ orders: nextOrders });
        broadcastOrdersSync({
          type: 'ORDER_CHANGED',
          action: 'ORDER_CREATED',
          order: formatted,
          state: { orders: nextOrders, invoiceSequence: state.invoiceSequence, auditLogs: state.auditLogs },
        });
      },

      applySocketItemUpdated: ({ orderId, item, order }) => {
        const state = get();
        const nextOrders = state.orders.map((o) => {
          if (o.id !== orderId) return o;
          if (order) {
            return {
              ...o,
              ...order,
              items: (order.items || []).map((i) => ({
                ...i,
                categoryName: i.categoryName || i.product?.category?.name || '',
                status: i.status || 'PENDING',
              })),
            };
          }
          return {
            ...o,
            items: (o.items || []).map((it) => (it.id === item.id ? { ...it, ...item } : it)),
          };
        });
        set({ orders: nextOrders });
        broadcastOrdersSync({
          type: 'ORDER_CHANGED',
          action: 'ITEM_UPDATED',
          orderId,
          item,
          state: { orders: nextOrders, invoiceSequence: state.invoiceSequence, auditLogs: state.auditLogs },
        });
      },

      applySocketOrderUpdated: (updatedOrder) => {
        if (!updatedOrder) return;
        const state = get();
        const nextOrders = state.orders.map((o) => {
          if (o.id !== updatedOrder.id) return o;
          return {
            ...o,
            ...updatedOrder,
            items: (updatedOrder.items || o.items || []).map((i) => ({
              ...i,
              categoryName: i.categoryName || i.product?.category?.name || '',
              status: i.status || 'PENDING',
            })),
          };
        });
        set({ orders: nextOrders });
        broadcastOrdersSync({
          type: 'ORDER_CHANGED',
          action: 'ORDER_UPDATED',
          order: updatedOrder,
          state: { orders: nextOrders, invoiceSequence: state.invoiceSequence, auditLogs: state.auditLogs },
        });
      },

      bumpItem: async (itemId, stationType = 'KITCHEN') => {
        const isBar = stationType === 'BAR';
        const client = isBar ? api.bds : api.kds;
        try {
          const res = await client.bumpItem(itemId);
          if (res && res.success && res.data) {
            const item = res.data.item || res.data.updatedItem;
            const order = res.data.order || res.data.updatedOrder;
            get().applySocketItemUpdated({
              orderId: order?.id,
              item,
              order,
            });
            return { success: true, item, order };
          }
        } catch (err) {
          console.warn('[OrdersStore] bumpItem error:', err);
        }
        return { success: false };
      },

      bumpTicket: async (orderId, stationType = null) => {
        const isBar = stationType === 'BAR';
        const client = isBar ? api.bds : api.kds;
        try {
          const res = await client.bumpTicket(orderId);
          if (res && res.success && res.data?.order) {
            get().applySocketOrderUpdated(res.data.order);
            return { success: true, order: res.data.order };
          }
        } catch (err) {
          console.warn('[OrdersStore] bumpTicket error:', err);
        }
        return { success: false };
      },

      voidOrder: async (orderId, reason, authorizedBy, managerPin) => {
        const state = get();
        const order = state.orders.find((o) => o.id === orderId);
        if (!order) return { success: false, message: 'Pesanan tidak ditemukan' };

        // Sync to backend MySQL database if backend ID exists
        const backendId = (typeof orderId === 'number' && orderId < 1000000000000) ? orderId : order.backendOrderId;
        let serverOrder = null;
        if (backendId) {
          try {
            const res = await api.orders.void(backendId, reason, managerPin);
            if (res && res.success && res.data) {
              serverOrder = res.data;
            }
          } catch (err) {
            console.warn('[OrdersStore] Backend void order error:', err);
          }
        }

        const updatedOrder = {
          ...order,
          ...(serverOrder || {}),
          status: 'VOIDED',
          voidReason: reason,
          voidedBy: authorizedBy,
          voidedAt: new Date().toISOString(),
        };

        const audit = {
          id: Date.now(),
          action: 'VOID_ORDER',
          targetInvoice: order.invoiceNo,
          performedBy: authorizedBy,
          reason,
          createdAt: new Date().toISOString(),
        };

        const nextOrders = state.orders.map((o) => (o.id === orderId ? updatedOrder : o));
        const nextAudit = [audit, ...state.auditLogs];

        set({
          orders: nextOrders,
          auditLogs: nextAudit,
        });

        broadcastOrdersSync({
          type: 'ORDER_CHANGED',
          action: 'ORDER_VOIDED',
          order: updatedOrder,
          state: {
            orders: nextOrders,
            invoiceSequence: state.invoiceSequence,
            auditLogs: nextAudit,
          },
        });

        return { success: true, order: updatedOrder };
      },

      refundOrder: async (orderId, reason, refundAmount, authorizedBy) => {
        const state = get();
        const order = state.orders.find((o) => o.id === orderId);
        if (!order) return { success: false, message: 'Pesanan tidak ditemukan' };

        const finalAmount = Number(refundAmount) || Number(order.total) || 0;
        const backendId = (typeof orderId === 'number' && orderId < 1000000000000) ? orderId : order.backendOrderId;
        let serverOrder = null;
        let isPendingApproval = false;

        if (backendId) {
          try {
            const res = await api.orders.refund(backendId, reason, finalAmount);
            if (res && res.success && res.data) {
              serverOrder = res.data;
              if (res.data.pendingApproval || res.data.status === 'PENDING_OWNER_APPROVAL') {
                isPendingApproval = true;
              }
            } else if (res && res.success === false) {
              throw new Error(res.message || 'Gagal memproses refund');
            }
          } catch (err) {
            console.warn('[OrdersStore] Backend refund order error:', err);
            throw err;
          }
        }

        if (isPendingApproval) {
          const updatedOrder = {
            ...order,
            refundPending: true,
            refundReason: reason,
            refundAmount: finalAmount,
            refundRequestedBy: authorizedBy,
            refundRequestedAt: new Date().toISOString(),
          };

          const audit = {
            id: Date.now(),
            action: 'REQUEST_REFUND',
            targetInvoice: order.invoiceNo,
            performedBy: authorizedBy,
            reason,
            amount: finalAmount,
            createdAt: new Date().toISOString(),
          };

          const nextOrders = state.orders.map((o) => (o.id === orderId ? updatedOrder : o));
          const nextAudit = [audit, ...state.auditLogs];

          set({
            orders: nextOrders,
            auditLogs: nextAudit,
          });

          return {
            success: true,
            pendingApproval: true,
            order: updatedOrder,
            message: 'Permintaan refund berhasil diajukan! Menunggu persetujuan Owner.',
          };
        }

        const updatedOrder = {
          ...order,
          ...(serverOrder || {}),
          status: 'REFUNDED',
          refundReason: reason,
          refundAmount: finalAmount,
          refundedBy: authorizedBy,
          refundedAt: new Date().toISOString(),
        };

        const audit = {
          id: Date.now(),
          action: 'REFUND_ORDER',
          targetInvoice: order.invoiceNo,
          performedBy: authorizedBy,
          reason,
          amount: finalAmount,
          createdAt: new Date().toISOString(),
        };

        const nextOrders = state.orders.map((o) => (o.id === orderId ? updatedOrder : o));
        const nextAudit = [audit, ...state.auditLogs];

        set({
          orders: nextOrders,
          auditLogs: nextAudit,
        });

        broadcastOrdersSync({
          type: 'ORDER_CHANGED',
          action: 'ORDER_REFUNDED',
          order: updatedOrder,
          state: {
            orders: nextOrders,
            invoiceSequence: state.invoiceSequence,
            auditLogs: nextAudit,
          },
        });

        return { success: true, order: updatedOrder };
      },

      // Reset semua pesanan demo/tersimpan kembali ke antrean PENDING
      resetKdsOrders: () => {
        const state = get();
        const baseOrders = state.orders;
        const nextOrders = baseOrders.map((o) => ({
          ...o,
          status: o.status === 'VOIDED' || o.status === 'REFUNDED' ? o.status : 'PAID',
          kitchenStatus: 'PENDING',
          barStatus: 'PENDING',
          createdAt: new Date().toISOString(),
        }));

        set({ orders: nextOrders });

        broadcastOrdersSync({
          type: 'ORDER_CHANGED',
          action: 'ORDER_CREATED',
          state: {
            orders: nextOrders,
            invoiceSequence: state.invoiceSequence,
            auditLogs: state.auditLogs,
          },
        });

        return nextOrders;
      },

      // Buat pesanan contoh baru instan untuk tes alur KDS / BDS
      createSampleKdsOrder: () => {
        const state = get();
        const invoiceNo = generateInvoiceNumber(state.invoiceSequence);
        const sampleOrder = {
          id: Date.now(),
          invoiceNo,
          cashierId: 1,
          cashierName: 'Kasir Utama',
          shiftId: 1,
          type: 'DINE_IN',
          tableNo: String(Math.floor(Math.random() * 12) + 1).padStart(2, '0'),
          customerName: ['Dimas Arya', 'Nadia Putri', 'Rizky Ramadhan', 'Siti Rahma'][Math.floor(Math.random() * 4)],
          status: 'PAID',
          kitchenStatus: 'PENDING',
          barStatus: 'PENDING',
          items: [
            {
              id: Date.now() + 1,
              productId: 1,
              name: 'Komazi Aren Latte',
              productName: 'Komazi Aren Latte',
              categoryName: 'Coffee',
              station: { id: 2, name: 'Bar Utama', code: 'BAR_MAIN', type: 'BAR' },
              variantName: 'Iced',
              qty: 2,
              unitPrice: 28000,
              lineTotal: 56000,
              note: 'Less ice, normal sugar',
            },
            {
              id: Date.now() + 2,
              productId: 11,
              name: 'Artisan Butter Croissant',
              productName: 'Artisan Butter Croissant',
              categoryName: 'Snack & Pastry',
              station: { id: 1, name: 'Kitchen Utama', code: 'KITCHEN_MAIN', type: 'KITCHEN' },
              variantName: 'Original Butter',
              qty: 1,
              unitPrice: 22000,
              lineTotal: 22000,
              note: 'Tolong hangatkan',
            },
          ],
          subtotal: 78000,
          discount: 0,
          serviceFee: 0,
          tax: 8580,
          total: 86580,
          paymentMethod: 'QRIS',
          createdAt: new Date().toISOString(),
          paidAt: new Date().toISOString(),
        };

        const nextOrders = [sampleOrder, ...state.orders];
        const nextSeq = state.invoiceSequence + 1;

        set({
          orders: nextOrders,
          invoiceSequence: nextSeq,
        });

        broadcastOrdersSync({
          type: 'ORDER_CHANGED',
          action: 'ORDER_CREATED',
          order: sampleOrder,
          state: {
            orders: nextOrders,
            invoiceSequence: nextSeq,
            auditLogs: state.auditLogs,
          },
        });

        return sampleOrder;
      },
    }),
    {
      name: 'komazi-orders-storage',
      version: 3,
      migrate: (persistedState, version) => {
        if (version < 3) {
          return {
            orders: [],
            invoiceSequence: 1,
            auditLogs: [],
          };
        }
        return persistedState;
      },
    }
  )
);

// Cross-tab broadcast listener & localStorage fallback listener
if (typeof window !== 'undefined') {
  if (syncChannel) {
    syncChannel.onmessage = (event) => {
      if (event?.data?.type === 'ORDER_CHANGED') {
        if (event.data.state?.orders) {
          useOrdersStore.setState({
            orders: event.data.state.orders,
            invoiceSequence: event.data.state.invoiceSequence || useOrdersStore.getState().invoiceSequence,
            auditLogs: event.data.state.auditLogs || useOrdersStore.getState().auditLogs,
          });
        } else {
          useOrdersStore.persist.rehydrate();
        }
        window.dispatchEvent(new CustomEvent('komazi:orders-updated', { detail: event.data }));
      }
    };
  }

  window.addEventListener('storage', (e) => {
    if (e.key === 'komazi-orders-storage') {
      useOrdersStore.persist.rehydrate();
      window.dispatchEvent(new CustomEvent('komazi:orders-updated', { detail: { type: 'STORAGE_SYNC' } }));
    }
  });
}

// Socket.IO Real-time Synchronization Listener
let isSocketSyncBound = false;

export function initOrdersSocketSync() {
  if (typeof window === 'undefined' || isSocketSyncBound) return;
  try {
    const socket = getSocket();
    if (!socket) return;

    socket.on('order:new', (order) => {
      useOrdersStore.getState().fetchBackendOrders?.();
      if (order) {
        NotificationService.notifyNewOrder?.(order)?.catch?.(() => { });
      }
    });

    socket.on('order:created', (order) => {
      useOrdersStore.getState().fetchBackendOrders?.();
      useShiftStore.getState().fetchActiveShift?.();
      if (order) {
        NotificationService.notifyNewOrder?.(order)?.catch?.(() => { });
      }
    });

    socket.on('order:updated', (order) => {
      useOrdersStore.getState().fetchBackendOrders?.();
      useShiftStore.getState().fetchActiveShift?.();
      if (order && (order.status === 'READY' || order.kitchenStatus === 'READY' || order.barStatus === 'READY')) {
        NotificationService.notifyOrderReady?.(order)?.catch?.(() => { });
      }
    });

    socket.on('approval:requested', (approval) => {
      if (approval) {
        NotificationService.notifyApprovalRequired?.(approval)?.catch?.(() => { });
      }
    });

    socket.on('order:voided', (order) => {
      useOrdersStore.getState().fetchBackendOrders?.();
      useShiftStore.getState().fetchActiveShift?.();
      useStockStore.getState().fetchIngredients?.();
    });

    socket.on('order:refunded', (order) => {
      useOrdersStore.getState().handleUpdatedOrder(order);
      useShiftStore.getState().fetchActiveShift?.();
      useStockStore.getState().fetchIngredients?.();
    });

    socket.on('shift:opened', () => {
      useShiftStore.getState().fetchActiveShift?.();
      useShiftStore.getState().fetchShiftHistory?.();
    });

    socket.on('shift:closed', () => {
      useShiftStore.getState().fetchActiveShift?.();
      useShiftStore.getState().fetchShiftHistory?.();
    });

    // Auto-refresh orders & shifts upon socket connect / reconnect
    socket.on('connect', () => {
      useOrdersStore.getState().fetchOrders?.();
      useShiftStore.getState().fetchActiveShift?.();
      useStockStore.getState().fetchIngredients?.();
    });

    socket.on('reconnect', () => {
      useOrdersStore.getState().fetchOrders?.();
      useShiftStore.getState().fetchActiveShift?.();
      useStockStore.getState().fetchIngredients?.();
    });

    isSocketSyncBound = true;
  } catch (err) {
    console.warn('[OrdersStore] Failed to bind socket listeners:', err);
  }
}

// Auto-bind immediately in browser environment
if (typeof window !== 'undefined') {
  initOrdersSocketSync();
}

