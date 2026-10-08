import prisma from '../config/db.js';
import { emitToStation, emitOrderEvent } from '../config/socket.js';

/**
 * Section 16: Hitung status order keseluruhan berdasarkan status seluruh item aktif
 */
export function calculateOrderStatus(items, isPaid = true) {
  const activeItems = items.filter((item) => item.status !== 'CANCELLED');

  if (activeItems.length === 0) {
    return 'VOIDED';
  }

  if (activeItems.every((item) => item.status === 'SERVED')) {
    return 'SERVED';
  }

  if (activeItems.every((item) => item.status === 'READY')) {
    return 'READY';
  }

  if (
    activeItems.some((item) => item.status === 'READY') &&
    activeItems.some((item) => item.status !== 'READY' && item.status !== 'SERVED')
  ) {
    return 'PARTIALLY_READY';
  }

  if (
    activeItems.some(
      (item) => item.status === 'PREPARING' || item.status === 'ACCEPTED'
    )
  ) {
    return 'IN_PROGRESS';
  }

  return isPaid ? 'PAID' : 'OPEN';
}

/**
 * Hitung status spesifik station (Kitchen atau Bar)
 */
export function calculateStationStatus(itemsForStation) {
  const active = itemsForStation.filter((i) => i.status !== 'CANCELLED');
  if (active.length === 0) return 'SERVED';
  if (active.every((i) => i.status === 'SERVED')) return 'SERVED';
  if (active.every((i) => i.status === 'READY')) return 'READY';
  if (active.some((i) => i.status === 'PREPARING' || i.status === 'ACCEPTED')) return 'IN_PROGRESS';
  return 'PENDING';
}

/**
 * Next status mapping untuk operasi BUMP item
 */
export function getNextItemStatus(currentStatus) {
  switch (currentStatus) {
    case 'PENDING':
      return 'PREPARING';
    case 'ACCEPTED':
      return 'PREPARING';
    case 'PREPARING':
      return 'READY';
    case 'READY':
      return 'SERVED';
    default:
      return currentStatus;
  }
}

/**
 * Update status satu item secara independen (Item-Level Status & Bump)
 */
export async function updateOrderItemStatus({ itemId, newStatus, userId = null }) {
  const validStatuses = ['PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED', 'CANCELLED'];
  if (!validStatuses.includes(newStatus)) {
    throw new Error(`Status item tidak valid: ${newStatus}`);
  }

  const existingItem = await prisma.orderItem.findUnique({
    where: { id: parseInt(itemId) },
    include: {
      order: {
        include: { items: { include: { station: true } } },
      },
      station: true,
    },
  });

  if (!existingItem) {
    throw new Error('Item pesanan tidak ditemukan');
  }

  const timestampData = {};
  const now = new Date();
  if (newStatus === 'ACCEPTED' && !existingItem.acceptedAt) timestampData.acceptedAt = now;
  if (newStatus === 'PREPARING' && !existingItem.preparingAt) timestampData.preparingAt = now;
  if (newStatus === 'READY' && !existingItem.readyAt) timestampData.readyAt = now;
  if (newStatus === 'SERVED' && !existingItem.servedAt) timestampData.servedAt = now;

  // Lakukan Prisma transaction untuk update item dan kalkulasi status order
  const result = await prisma.$transaction(async (tx) => {
    const updatedItem = await tx.orderItem.update({
      where: { id: parseInt(itemId) },
      data: {
        status: newStatus,
        ...timestampData,
      },
      include: { station: true },
    });

    // Ambil seluruh item terbaru dari order ini
    const allItems = await tx.orderItem.findMany({
      where: { orderId: existingItem.orderId },
      include: { station: true },
    });

    const isPaid = existingItem.order.status !== 'OPEN';
    const computedOrderStatus = calculateOrderStatus(allItems, isPaid);

    // Hitung status station dapur & bar
    const kitchenItems = allItems.filter((i) => i.station?.type === 'KITCHEN');
    const barItems = allItems.filter((i) => i.station?.type === 'BAR');

    const newKitchenStatus = kitchenItems.length > 0 ? calculateStationStatus(kitchenItems) : existingItem.order.kitchenStatus;
    const newBarStatus = barItems.length > 0 ? calculateStationStatus(barItems) : existingItem.order.barStatus;

    const updatedOrder = await tx.order.update({
      where: { id: existingItem.orderId },
      data: {
        status: computedOrderStatus,
        kitchenStatus: newKitchenStatus,
        barStatus: newBarStatus,
      },
      include: {
        items: {
          include: {
            station: true,
            product: {
              select: {
                id: true,
                name: true,
                categoryId: true,
                category: { select: { id: true, name: true } },
              },
            },
          },
        },
        payments: true,
        cashier: { select: { id: true, name: true, username: true } },
      },
    });

    // Audit log (Section 25)
    if (userId) {
      await tx.auditLog.create({
        data: {
          userId,
          action: 'UPDATE_ORDER_ITEM_STATUS',
          detail: {
            orderId: existingItem.orderId,
            itemId: existingItem.id,
            productName: existingItem.productName,
            oldStatus: existingItem.status,
            newStatus,
          },
        },
      });
    }

    return { updatedItem, updatedOrder };
  });

  // Emit event realtime via Socket.IO
  const stationCode = existingItem.station?.code || (existingItem.station?.type === 'BAR' ? 'BAR_MAIN' : 'KITCHEN_MAIN');
  emitToStation(stationCode, 'order:item:updated', {
    orderId: existingItem.orderId,
    item: result.updatedItem,
    order: result.updatedOrder,
  });

  emitOrderEvent('order:updated', result.updatedOrder);

  return result;
}

/**
 * BUMP satu item ke status berikutnya
 */
export async function bumpOrderItem({ itemId, userId = null }) {
  const existingItem = await prisma.orderItem.findUnique({
    where: { id: parseInt(itemId) },
  });
  if (!existingItem) throw new Error('Item tidak ditemukan');

  const nextStatus = getNextItemStatus(existingItem.status);
  return await updateOrderItemStatus({ itemId, newStatus: nextStatus, userId });
}

/**
 * BUMP seluruh item tiket pesanan untuk station tertentu
 */
export async function bumpTicket({ orderId, stationType = null, userId = null }) {
  const order = await prisma.order.findUnique({
    where: { id: parseInt(orderId) },
    include: { items: { include: { station: true } } },
  });
  if (!order) throw new Error('Pesanan tidak ditemukan');

  // Filter item yang sesuai stationType (KITCHEN atau BAR)
  const targetItems = order.items.filter((item) => {
    if (item.status === 'SERVED' || item.status === 'CANCELLED') return false;
    if (stationType) {
      return item.station?.type === stationType;
    }
    return true;
  });

  if (targetItems.length === 0) {
    return { success: true, message: 'Seluruh item station ini sudah selesai disajikan' };
  }

  // Tentukan next status tertinggi untuk batch bump
  // Jika ada yang belum READY -> jadikan READY. Jika semua sudah READY -> jadikan SERVED.
  const allReady = targetItems.every((i) => i.status === 'READY');
  const targetStatus = allReady ? 'SERVED' : 'READY';

  const now = new Date();
  const timestampField = targetStatus === 'READY' ? { readyAt: now } : { servedAt: now };

  const updatedOrder = await prisma.$transaction(async (tx) => {
    await tx.orderItem.updateMany({
      where: {
        id: { in: targetItems.map((i) => i.id) },
      },
      data: {
        status: targetStatus,
        ...timestampField,
      },
    });

    const allItems = await tx.orderItem.findMany({
      where: { orderId: parseInt(orderId) },
      include: { station: true },
    });

    const isPaid = order.status !== 'OPEN';
    const computedOrderStatus = calculateOrderStatus(allItems, isPaid);

    const kitchenItems = allItems.filter((i) => i.station?.type === 'KITCHEN');
    const barItems = allItems.filter((i) => i.station?.type === 'BAR');

    const newKitchenStatus = kitchenItems.length > 0 ? calculateStationStatus(kitchenItems) : order.kitchenStatus;
    const newBarStatus = barItems.length > 0 ? calculateStationStatus(barItems) : order.barStatus;

    const resOrder = await tx.order.update({
      where: { id: parseInt(orderId) },
      data: {
        status: computedOrderStatus,
        kitchenStatus: newKitchenStatus,
        barStatus: newBarStatus,
      },
      include: {
        items: {
          include: {
            station: true,
            product: {
              select: {
                id: true,
                name: true,
                categoryId: true,
                category: { select: { id: true, name: true } },
              },
            },
          },
        },
        payments: true,
        cashier: { select: { id: true, name: true, username: true } },
      },
    });

    if (userId) {
      await tx.auditLog.create({
        data: {
          userId,
          action: 'BUMP_TICKET',
          detail: {
            orderId: parseInt(orderId),
            stationType,
            targetStatus,
            itemCount: targetItems.length,
          },
        },
      });
    }

    return resOrder;
  });

  const stationCode = stationType === 'BAR' ? 'BAR_MAIN' : 'KITCHEN_MAIN';
  emitToStation(stationCode, 'order:updated', updatedOrder);
  emitOrderEvent('order:updated', updatedOrder);

  return { success: true, order: updatedOrder };
}

/**
 * Mengambil pesanan aktif untuk Station tertentu (KDS atau BDS)
 */
export async function getStationOrders({ stationType, status = 'ACTIVE' }) {
  const whereClause = {
    status: {
      in: status === 'ACTIVE' ? ['OPEN', 'PAID', 'IN_PROGRESS', 'PARTIALLY_READY', 'READY'] : ['SERVED', 'COMPLETED'],
    },
    items: {
      some: {
        station: { type: stationType },
        ...(status === 'ACTIVE' ? { status: { notIn: ['SERVED', 'CANCELLED'] } } : {}),
      },
    },
  };

  const orders = await prisma.order.findMany({
    where: whereClause,
    include: {
      items: {
        where: {
          station: { type: stationType },
        },
        include: {
          station: true,
          product: {
            select: {
              id: true,
              name: true,
              categoryId: true,
              category: { select: { id: true, name: true } },
            },
          },
        },
      },
      payments: true,
      cashier: { select: { id: true, name: true, username: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  return orders;
}
