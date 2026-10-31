import prisma from '../config/db.js';
import { emitToStation, emitOrderEvent } from '../config/socket.js';

/**
 * Helper: Deteksi apakah item atau produk tergolong kategori Minuman / Bar (BDS)
 */
export function isDrinkItemHelper(item) {
  if (!item) return false;
  const cat = (
    item.categoryName ||
    item.category?.name ||
    item.product?.category?.name ||
    item.category ||
    ''
  ).toLowerCase();
  const name = (
    item.name ||
    item.productName ||
    item.product?.name ||
    ''
  ).toLowerCase();

  return (
    cat.includes('kopi') ||
    cat.includes('coffee') ||
    cat.includes('non-coffee') ||
    cat.includes('drink') ||
    cat.includes('beverage') ||
    cat.includes('minuman') ||
    cat.includes('bar') ||
    cat.includes('barista') ||
    cat.includes('non-kopi') ||
    cat.includes('tea') ||
    cat.includes('teh') ||
    cat.includes('mocktail') ||
    name.includes('latte') ||
    name.includes('espresso') ||
    name.includes('cappuccino') ||
    name.includes('americano') ||
    name.includes('macchiato') ||
    name.includes('affogato') ||
    name.includes('frappe') ||
    name.includes('brew') ||
    name.includes('tea') ||
    name.includes('teh') ||
    name.includes('matcha') ||
    name.includes('juice') ||
    name.includes('jus') ||
    name.includes('smoothie') ||
    name.includes('milkshake') ||
    name.includes('kopi') ||
    name.includes('coffee') ||
    name.includes('susu') ||
    name.includes('chocolate') ||
    name.includes('cokelat') ||
    name.includes('mocktail') ||
    name.includes('soda') ||
    name.includes('lemonade') ||
    name.includes('air mineral') ||
    name.includes('taro') ||
    name.includes('red velvet') ||
    name.includes('boba') ||
    name.includes('cincau') ||
    name.includes('aren') ||
    name.includes('sanger')
  );
}

/**
 * Helper: Cek apakah item ditujukan untuk station tertentu
 */
export function isItemForStation(item, stationType) {
  if (!stationType || stationType === 'ALL') return true;
  const stationTypeVal = item.station?.type || item.product?.station?.type;
  const stationCodeVal = item.station?.code || item.product?.station?.code;
  const stationNameVal = (item.station?.name || item.product?.station?.name || '').toLowerCase();

  let isBar = false;
  if (stationTypeVal === 'BAR' || stationCodeVal === 'BAR_MAIN' || stationNameVal.includes('bar')) {
    isBar = true;
  } else if (stationTypeVal === 'KITCHEN' || stationCodeVal === 'KITCHEN_MAIN' || stationNameVal.includes('kitchen') || stationNameVal.includes('dapur')) {
    isBar = false;
  } else {
    isBar = isDrinkItemHelper(item);
  }

  if (stationType === 'BAR') return isBar;
  if (stationType === 'KITCHEN') return !isBar;
  return true;
}

/**
 * Section 16: Hitung status order keseluruhan berdasarkan status seluruh item aktif
 */
export function calculateOrderStatus(itemsOrOrder, isPaid = true) {
  const items = Array.isArray(itemsOrOrder) ? itemsOrOrder : (itemsOrOrder?.items || []);
  const paid = Array.isArray(itemsOrOrder)
    ? Boolean(isPaid)
    : (Boolean(itemsOrOrder?.paidAt) || itemsOrOrder?.status === 'PAID' || Boolean(isPaid));

  const activeItems = items.filter((item) => item.status !== 'CANCELLED');

  if (activeItems.length === 0) {
    return 'VOIDED';
  }

  // Jika pesanan belum dibayar (Hold Bill / Open Order), status finansial tetap 'OPEN'
  if (!paid) {
    return 'OPEN';
  }

  // Status finansial pesanan yang sudah dibayar tetap 'PAID' agar laporan penjualan,
  // omzet, gross profit, dan rekonsiliasi kas shift selalu akurat.
  // Progres penyajian dapur dan bar dipantau terpisah di 'kitchenStatus' dan 'barStatus'.
  return 'PAID';
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
        include: {
          items: { include: { station: true } },
          payments: true,
        },
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

    const isPaid = Boolean(
      existingItem.order.paidAt ||
      (existingItem.order.payments && existingItem.order.payments.length > 0) ||
      existingItem.order.status === 'PAID'
    );
    const computedOrderStatus = calculateOrderStatus(allItems, isPaid);

    // Hitung status station dapur & bar
    const kitchenItems = allItems.filter((i) => !isItemForStation(i, 'BAR'));
    const barItems = allItems.filter((i) => isItemForStation(i, 'BAR'));

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

    return {
      updatedItem,
      updatedOrder,
      item: updatedItem,
      order: updatedOrder,
    };
  });

  // Emit event realtime via Socket.IO
  const isTargetBar = isItemForStation(existingItem, 'BAR');
  const stationCode = isTargetBar ? 'BAR_MAIN' : 'KITCHEN_MAIN';
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
    include: {
      items: {
        include: {
          station: true,
          product: {
            include: { category: true },
          },
        },
      },
      payments: true,
    },
  });
  if (!order) throw new Error('Pesanan tidak ditemukan');

  // Filter item yang sesuai stationType (KITCHEN atau BAR)
  const targetItems = order.items.filter((item) => {
    if (item.status === 'SERVED' || item.status === 'CANCELLED') return false;
    if (stationType) {
      return isItemForStation(item, stationType);
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
      include: {
        station: true,
        product: {
          include: { category: true },
        },
      },
    });

    const isPaid = Boolean(
      order.paidAt ||
      (order.payments && order.payments.length > 0) ||
      order.status === 'PAID'
    );
    const computedOrderStatus = calculateOrderStatus(allItems, isPaid);

    const kitchenItems = allItems.filter((i) => !isItemForStation(i, 'BAR'));
    const barItems = allItems.filter((i) => isItemForStation(i, 'BAR'));

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
  const isTargetBar = stationType === 'BAR';

  const orders = await prisma.order.findMany({
    where: {
      status: {
        in: status === 'ACTIVE' ? ['OPEN', 'PAID', 'IN_PROGRESS', 'PARTIALLY_READY', 'READY'] : ['SERVED', 'COMPLETED'],
      },
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
              stationId: true,
              station: true,
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

  // Filter item pesanan yang sesuai dengan station
  const stationOrders = orders
    .map((order) => {
      const stationItems = (order.items || []).filter((item) => {
        return isItemForStation(item, stationType);
      });

      return {
        ...order,
        items: stationItems,
      };
    })
    .filter((order) => {
      if (!order.items || order.items.length === 0) return false;
      if (status === 'ACTIVE') {
        return order.items.some((i) => i.status !== 'SERVED' && i.status !== 'CANCELLED');
      }
      return true;
    });

  return stationOrders;
}
