import prisma from '../config/db.js';
import { generateInvoiceNo } from '../utils/invoice.js';
import { calculateProductCogs } from './cogsService.js';
import { events } from '../bot/events.js';
import { emitOrderEvent } from '../config/socket.js';
import { isDrinkItemHelper, isItemForStation } from './kdsService.js';
import { deltaInventoryService } from './deltaInventoryService.js';
import { checkStaffShiftEligibility } from './scheduleGuard.service.js';
import { getSettingsMap } from './settingsCache.service.js';

async function resolveStationId(product) {
  if (product?.stationId) {
    return product.stationId;
  }

  const isDrink = isDrinkItemHelper(product);
  const targetCode = isDrink ? 'BAR_MAIN' : 'KITCHEN_MAIN';
  const targetType = isDrink ? 'BAR' : 'KITCHEN';
  const station = await prisma.station.findFirst({
    where: { OR: [{ code: targetCode }, { type: targetType }] },
  });
  return station?.id || null;
}

export const orderService = {
  async requireOpenShift(cashierId) {
    return prisma.shift.findFirst({
      where: { cashierId, closedAt: null },
    });
  },

  async preview({ items = [], type = 'DINE_IN', discount = 0 }) {
    const settingsMap = await getSettingsMap();

    const taxEnabled = settingsMap['taxEnabled'] === 'true' || settingsMap['taxEnabled'] === true;
    const taxPercentage = taxEnabled ? parseFloat(settingsMap['taxPercentage'] || '10') : 0;
    const serviceFeeEnabled = settingsMap['serviceFeeEnabled'] === 'true' || settingsMap['serviceFeeEnabled'] === true;
    const serviceFeePercentage = serviceFeeEnabled ? parseFloat(settingsMap['serviceFeePercentage'] || '5') : 0;
    const roundingEnabled = settingsMap['roundingEnabled'] === 'true' || settingsMap['roundingEnabled'] === true;

    let subtotal = 0;
    const previewItems = items.map((i) => {
      const lineTotal = Number(i.qty) * Number(i.price);
      subtotal += lineTotal;
      return {
        ...i,
        lineTotal,
      };
    });

    const afterDiscount = Math.max(0, subtotal - parseFloat(discount || 0));
    const serviceFee = serviceFeeEnabled ? Math.round((afterDiscount * serviceFeePercentage) / 100) : 0;
    const tax = taxEnabled ? Math.round(((afterDiscount + serviceFee) * taxPercentage) / 100) : 0;

    let total = afterDiscount + serviceFee + tax;
    if (roundingEnabled) {
      total = Math.ceil(total / 100) * 100;
    }

    return {
      items: previewItems,
      subtotal,
      discount: parseFloat(discount || 0),
      serviceFee,
      tax,
      total,
      type,
    };
  },

  async createFromBot({ cashierId, shiftId, items = [], type = 'DINE_IN', payment = 'CASH', tableNo = null, customerName = null }) {
    // Validasi jadwal kerja staf (Kecuali OWNER)
    const cashierUser = await prisma.user.findUnique({
      where: { id: parseInt(cashierId) },
      select: { role: true },
    });
    if (cashierUser && cashierUser.role !== 'OWNER') {
      const eligibility = await checkStaffShiftEligibility(cashierId, cashierUser.role);
      if (!eligibility.eligible) {
        throw new Error(eligibility.message);
      }
    }

    const preview = await this.preview({ items, type });
    const invoiceNo = await generateInvoiceNo();
    const isPaid = payment !== 'OPEN';

    const orderItemsData = [];
    for (const item of items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
        include: { category: true, station: true },
      });
      const stationId = await resolveStationId(product);

      let unitCost = 0;
      try {
        unitCost = await calculateProductCogs(item.productId, item.variantName || null);
      } catch {
        unitCost = 0;
      }

      orderItemsData.push({
        productId: item.productId,
        stationId,
        status: 'PENDING',
        productName: product ? product.name : item.name,
        variantName: item.variantName || null,
        qty: item.qty,
        unitPrice: item.price,
        unitCost,
        discount: 0,
        note: item.note || null,
        lineTotal: item.qty * item.price,
        lineCost: Math.round(unitCost * item.qty * 100) / 100,
      });
    }

    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          invoiceNo,
          cashierId,
          shiftId: shiftId ? parseInt(shiftId) : null,
          type: type || 'DINE_IN',
          tableNo: type === 'DINE_IN' ? tableNo : null,
          customerName: customerName || null,
          status: isPaid ? 'PAID' : 'OPEN',
          kitchenStatus: 'PENDING',
          barStatus: 'PENDING',
          subtotal: preview.subtotal,
          discount: preview.discount,
          serviceFee: preview.serviceFee,
          tax: preview.tax,
          total: preview.total,
          paidAt: isPaid ? new Date() : null,
          items: {
            create: orderItemsData,
          },
          payments: isPaid
            ? {
                create: [
                  {
                    method: payment === 'QRIS' ? 'QRIS' : payment === 'TRANSFER' ? 'TRANSFER' : 'CASH',
                    amount: preview.total,
                    reference: `BOT-${payment}`,
                  },
                ],
              }
            : undefined,
        },
        include: {
          items: {
            include: {
              station: true,
              product: {
                select: { id: true, name: true, categoryId: true, stationId: true },
              },
            },
          },
          cashier: { select: { id: true, name: true, username: true, telegramId: true } },
          payments: true,
        },
      });

      if (isPaid) {
        await deltaInventoryService.deductNewOrderStock(tx, created.id, created.invoiceNo, items);
      }

      return created;
    });

    // Realtime notification via WebSocket (POS UI)
    try {
      emitOrderEvent('order:created', order);
    } catch {}

    // Emit event for telegram notifier
    events.emit('order.created', order);
    if (isPaid) {
      events.emit('order.paid', order);
    }

    return order;
  },

  async setStatus(orderId, status, updatedById = null) {
    const existing = await prisma.order.findUnique({
      where: { id: Number(orderId) },
      include: {
        items: true,
        cashier: { select: { id: true, name: true, username: true, telegramId: true } },
      },
    });

    if (!existing) {
      return { ok: false, message: 'Pesanan tidak ditemukan' };
    }

    const updated = await prisma.order.update({
      where: { id: Number(orderId) },
      data: {
        status: status === 'PREPARING' ? 'IN_PROGRESS' : status,
        barStatus: status === 'READY' ? 'READY' : status === 'PREPARING' ? 'IN_PROGRESS' : existing.barStatus,
        kitchenStatus: status === 'READY' ? 'READY' : status === 'PREPARING' ? 'IN_PROGRESS' : existing.kitchenStatus,
      },
      include: {
        items: true,
        cashier: { select: { id: true, name: true, username: true, telegramId: true } },
      },
    });

    // Realtime notification via WebSocket
    try {
      emitOrderEvent('order:updated', updated);
    } catch {}

    if (status === 'READY') {
      events.emit('order.ready', updated);
    }

    return { ok: true, order: updated };
  },

  async listOpenBills() {
    return prisma.order.findMany({
      where: { status: { in: ['OPEN', 'PENDING_PAYMENT'] } },
      include: {
        items: true,
        cashier: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  },

  async listQueue(roleScope = 'ALL') {
    const normalizedRole = (roleScope || 'ALL').toUpperCase();

    // 1. Tentukan filter status Prisma
    const whereClause = {
      status: { in: ['PAID', 'OPEN', 'IN_PROGRESS', 'PREPARING'] },
    };

    if (normalizedRole === 'BARISTA' || normalizedRole === 'BAR') {
      whereClause.barStatus = { not: 'READY' };
    } else if (normalizedRole === 'KITCHEN') {
      whereClause.kitchenStatus = { not: 'READY' };
    } else {
      // MANAGER, OWNER, CASHIER, ALL: tampilkan tiket yang belum tuntas di salah satu stasiun
      whereClause.OR = [
        { barStatus: { not: 'READY' } },
        { kitchenStatus: { not: 'READY' } },
      ];
    }

    const orders = await prisma.order.findMany({
      where: whereClause,
      include: {
        items: {
          include: {
            station: true,
            product: { include: { category: true, station: true } },
          },
        },
        cashier: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: 25,
    });

    // 2. Filter item sesuai station role dan buang order yang tidak memiliki item relevan
    const scopedOrders = [];

    for (const order of orders) {
      let filteredItems = order.items.filter((it) => it.status !== 'CANCELLED');

      if (normalizedRole === 'BARISTA' || normalizedRole === 'BAR') {
        filteredItems = filteredItems.filter((it) => isItemForStation(it, 'BAR'));
      } else if (normalizedRole === 'KITCHEN') {
        filteredItems = filteredItems.filter((it) => isItemForStation(it, 'KITCHEN'));
      }

      // Jika role Barista atau Kitchen dan tidak ada item untuk station mereka, jangan tampilkan tiket
      if (
        filteredItems.length === 0 &&
        (normalizedRole === 'BARISTA' || normalizedRole === 'BAR' || normalizedRole === 'KITCHEN')
      ) {
        continue;
      }

      // Tentukan status representatif per stasiun
      let stationStatus = order.status;
      if (normalizedRole === 'BARISTA' || normalizedRole === 'BAR') {
        stationStatus = order.barStatus;
      } else if (normalizedRole === 'KITCHEN') {
        stationStatus = order.kitchenStatus;
      }

      scopedOrders.push({
        ...order,
        status: stationStatus,
        stationStatus,
        items: filteredItems,
      });
    }

    return scopedOrders;
  },

  async getSummary(period = 'today', customRange = null) {
    const now = new Date();
    let startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    let endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    let periodLabel = 'Hari Ini';

    // Mendukung pemanggilan getSummary({ startDate, endDate, label })
    if (typeof period === 'object' && period !== null) {
      customRange = period;
      period = 'custom';
    }

    if (period === 'yesterday') {
      startDate.setDate(startDate.getDate() - 1);
      endDate.setDate(endDate.getDate() - 1);
      periodLabel = 'Kemarin';
    } else if (period === '7d') {
      startDate.setDate(startDate.getDate() - 7);
      startDate.setHours(0, 0, 0, 0);
      periodLabel = '7 Hari Terakhir';
    } else if (period === 'month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      periodLabel = 'Bulan Ini';
    } else if (period === 'custom' && customRange) {
      if (customRange.startDate) {
        startDate = customRange.startDate instanceof Date ? customRange.startDate : new Date(customRange.startDate);
      }
      if (customRange.endDate) {
        endDate = customRange.endDate instanceof Date ? customRange.endDate : new Date(customRange.endDate);
      }
      periodLabel = customRange.label || customRange.periodLabel || 'Kustom';
    }

    const paidOrders = await prisma.order.findMany({
      where: {
        status: { in: ['PAID', 'SERVED', 'COMPLETED'] },
        OR: [
          { paidAt: { gte: startDate, lte: endDate } },
          { createdAt: { gte: startDate, lte: endDate } },
          { payments: { some: { createdAt: { gte: startDate, lte: endDate } } } },
        ],
      },
      include: {
        payments: true,
        items: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalRevenue = paidOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
    const totalTransactions = paidOrders.length;

    // Hitung per metode bayar dengan normalisasi cerdas (QRIS Dinamis, Transfer, Tunai)
    const byMethod = { CASH: 0, QRIS: 0, TRANSFER: 0 };
    for (const order of paidOrders) {
      if (order.payments && order.payments.length > 0) {
        for (const p of order.payments) {
          const m = String(p.method || '').toUpperCase();
          const amt = Number(p.amount) || 0;
          if (m.includes('QRIS')) {
            byMethod.QRIS += amt;
          } else if (m.includes('TRANSFER') || m.includes('TRF')) {
            byMethod.TRANSFER += amt;
          } else {
            byMethod.CASH += amt;
          }
        }
      } else if (['PAID', 'SERVED', 'COMPLETED'].includes(order.status)) {
        // Fallback jika pesanan lunas namun relasi payment belum tersinkron
        const ordTotal = Number(order.total) || 0;
        const refStr = String(order.invoiceNo || '').toUpperCase();
        if (refStr.includes('QRIS')) {
          byMethod.QRIS += ordTotal;
        } else {
          byMethod.CASH += ordTotal;
        }
      }
    }

    // Top menu paling laris
    const productCount = {};
    for (const order of paidOrders) {
      for (const item of (order.items || [])) {
        const key = item.productName || 'Item';
        productCount[key] = (productCount[key] || 0) + (Number(item.qty) || 1);
      }
    }
    const topProducts = Object.entries(productCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, qty]) => ({ name, qty }));

    return {
      period,
      periodLabel,
      startDate,
      endDate,
      totalRevenue,
      totalTransactions,
      byMethod: {
        ...byMethod,
        QRIS_DYNAMIC: byMethod.QRIS, // Alias untuk kemudahan akses QRIS dinamis
      },
      topProducts,
    };
  },
};
