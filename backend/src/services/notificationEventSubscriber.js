import { events } from '../bot/events.js';
import { dispatchNotification } from './notification.service.js';
import logger from '../utils/logger.js';

let isSubscribed = false;

/**
 * Subscribes notification dispatcher to core application event bus.
 * Bridges business events across services seamlessly and non-blockingly.
 */
export function initNotificationEventSubscriber() {
  if (isSubscribed) return;
  isSubscribed = true;

  // 1. Pesanan Baru Masuk
  events.on('order.created', async (order) => {
    try {
      if (!order) return;
      const invoiceNo = order.invoiceNo || order.id || 'Baru';
      const itemsCount = Array.isArray(order.items) ? order.items.length : 1;
      const tableInfo = order.tableNo ? `(Meja ${order.tableNo})` : '(Take Away)';

      await dispatchNotification({
        event: 'NEW_ORDER',
        category: 'ORDERS',
        title: `🔔 Pesanan Baru: #${invoiceNo}`,
        body: `${itemsCount} item ${tableInfo} siap diproses.`,
        data: {
          orderId: order.id,
          invoiceNo: order.invoiceNo,
          tableNo: order.tableNo || '',
          url: '/orders',
        },
        context: {
          hasKitchen: true,
          hasBar: true,
          initiatorId: order.cashierId || order.cashier?.id,
          excludeInitiator: true,
        },
      });
    } catch (err) {
      logger.notification.debug(`order.created event push error: ${err.message}`);
    }
  });

  // 2. Pesanan Siap Saji (Ready to Serve)
  events.on('order.ready', async (order) => {
    try {
      if (!order) return;
      const invoiceNo = order.invoiceNo || order.id || '';
      const tableInfo = order.tableNo ? `ke Meja ${order.tableNo}` : 'ke pelanggan';

      await dispatchNotification({
        event: 'ORDER_READY',
        category: 'ORDERS',
        title: `🍽️ Pesanan Siap Saji: #${invoiceNo}`,
        body: `Pesanan telah siap diantar ${tableInfo}!`,
        data: {
          orderId: order.id,
          invoiceNo: order.invoiceNo,
          url: '/orders',
        },
        context: {
          cashierId: order.cashierId || order.cashier?.id,
        },
      });
    } catch (err) {
      logger.notification.debug(`order.ready event push error: ${err.message}`);
    }
  });

  // 3. Pembatalan Pesanan (VOID)
  events.on('order.voided', async ({ order, reason }) => {
    try {
      if (!order) return;
      const invoiceNo = order.invoiceNo || order.id || '';

      await dispatchNotification({
        event: 'ORDER_VOIDED',
        category: 'ALERTS',
        title: `⚠️ Pesanan Dibatalkan (VOID): #${invoiceNo}`,
        body: `Alasan: "${reason || 'Dibatalkan oleh staf'}"`,
        data: {
          orderId: order.id,
          invoiceNo: order.invoiceNo,
          reason: reason || '',
          url: '/orders',
        },
      });
    } catch (err) {
      logger.notification.debug(`order.voided event push error: ${err.message}`);
    }
  });

  // 4. Pengembalian Dana (Refund)
  events.on('order.refunded', async ({ order, reason, amount }) => {
    try {
      if (!order) return;
      const invoiceNo = order.invoiceNo || order.id || '';
      const formattedAmount = Number(amount || order.total || 0).toLocaleString('id-ID');

      await dispatchNotification({
        event: 'REFUND_REQUEST',
        category: 'ALERTS',
        title: `🛡️ Refund Diproses: #${invoiceNo}`,
        body: `Pengembalian dana Rp${formattedAmount} (${reason || 'Refund'})`,
        data: {
          orderId: order.id,
          invoiceNo: order.invoiceNo,
          amount: String(amount || 0),
          url: '/orders',
        },
      });
    } catch (err) {
      logger.notification.debug(`order.refunded event push error: ${err.message}`);
    }
  });

  // 5. Peringatan Stok Menipis
  events.on('stock.low', async ({ ingredientName, currentStock, minStock, unit }) => {
    try {
      await dispatchNotification({
        event: 'LOW_STOCK',
        category: 'ALERTS',
        title: `⚠️ Stok Menipis: ${ingredientName}`,
        body: `Sisa stok ${currentStock} ${unit || ''} (Batas minimum: ${minStock} ${unit || ''}). Segera restock.`,
        data: {
          ingredientName,
          currentStock: String(currentStock),
          minStock: String(minStock),
          unit: unit || '',
          url: '/stock',
        },
        context: {
          isCoffeeOrDrink: (ingredientName || '').toLowerCase().includes('kopi') ||
            (ingredientName || '').toLowerCase().includes('susu') ||
            (ingredientName || '').toLowerCase().includes('syrup') ||
            (ingredientName || '').toLowerCase().includes('tea'),
        },
      });
    } catch (err) {
      logger.notification.debug(`stock.low event push error: ${err.message}`);
    }
  });

  // 5b. Pembukaan Sesi Kasir (Shift Opened)
  events.on('shift.opened', async ({ shift, cashier, openingCash, register }) => {
    try {
      const cashierName = cashier?.name || shift?.cashier?.name || 'Kasir';
      const regName = register?.name || shift?.register?.name || 'Kasir Utama';
      const initialCash = Number(openingCash !== undefined ? openingCash : (shift?.openingCash || 0)).toLocaleString('id-ID');

      await dispatchNotification({
        event: 'SHIFT_OPENED',
        category: 'OPERATIONAL',
        title: `🟢 Sesi Kasir Dibuka: ${cashierName}`,
        body: `Terminal ${regName} • Modal Kas: Rp${initialCash}`,
        data: {
          cashierName,
          openingCash: String(openingCash || 0),
          url: '/cash-session',
        },
      });
    } catch (err) {
      logger.notification.debug(`shift.opened event push error: ${err.message}`);
    }
  });

  // 6. Penutupan Sif Kasir (Shift Closed)
  events.on('shift.closed', async ({ cashier, summary }) => {
    try {
      const cashierName = cashier?.name || 'Kasir';
      const actualCash = Number(summary?.closingCash || 0).toLocaleString('id-ID');
      const diff = Number(summary?.diff || 0);
      const diffNote = diff === 0 ? 'Kas Imbang' : diff > 0 ? `Lebih +Rp${diff.toLocaleString('id-ID')}` : `Selisih -Rp${Math.abs(diff).toLocaleString('id-ID')}`;

      await dispatchNotification({
        event: 'SHIFT_CLOSED',
        category: 'OPERATIONAL',
        title: `🔒 Sif Kasir Ditutup: ${cashierName}`,
        body: `Total kas Rp${actualCash} • Status: ${diffNote}`,
        data: {
          cashierName,
          closingCash: String(summary?.closingCash || 0),
          diff: String(diff),
          url: '/shift',
        },
      });
    } catch (err) {
      logger.notification.debug(`shift.closed event push error: ${err.message}`);
    }
  });

  // 7. Permintaan Otorisasi / Approval
  events.on('approval.requested', async ({ request, order }) => {
    try {
      const type = request?.type || 'Approval';
      const invoice = order?.invoiceNo ? ` #${order.invoiceNo}` : '';

      await dispatchNotification({
        event: 'APPROVAL_REQUEST',
        category: 'ALERTS',
        title: `🛡️ Butuh Persetujuan: ${type}${invoice}`,
        body: `Permintaan otorisasi ${request?.reason || 'kasir'} menunggu konfirmasi Manager/Owner.`,
        data: {
          requestId: request?.id,
          orderId: order?.id,
          type,
          url: '/orders',
        },
      });
    } catch (err) {
      logger.notification.debug(`approval.requested event push error: ${err.message}`);
    }
  });

  logger.notification.info('Notification event subscribers initialized for core event bus');
}

export default initNotificationEventSubscriber;
