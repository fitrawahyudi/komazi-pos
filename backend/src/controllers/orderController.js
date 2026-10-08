import prisma from '../config/db.js';
import { generateInvoiceNo } from '../utils/invoice.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { calculateProductCogs } from '../services/cogsService.js';
import { emitToStation, emitOrderEvent } from '../config/socket.js';
import { notifyNewOrder, notifyPaidTransaction } from '../services/telegramService.js';

// Helper: dapatkan station id untuk produk jika belum di-set
async function resolveStationId(product) {
  if (product?.stationId) return product.stationId;
  const catName = (product?.category?.name || '').toLowerCase();
  const isDrink =
    catName.includes('kopi') ||
    catName.includes('drink') ||
    catName.includes('beverage') ||
    catName.includes('minuman') ||
    catName.includes('bar');
  const targetCode = isDrink ? 'BAR_MAIN' : 'KITCHEN_MAIN';
  const targetType = isDrink ? 'BAR' : 'KITCHEN';
  const station = await prisma.station.findFirst({
    where: { OR: [{ code: targetCode }, { type: targetType }] },
  });
  return station?.id || null;
}

// Helper: format order items with categoryName and sanitize cost fields for non-privileged roles
function formatOrderForResponse(order, canViewCost) {
  if (!order) return order;
  const sanitized = { ...order };
  if (sanitized.items) {
    sanitized.items = sanitized.items.map((item) => {
      const categoryName = item.product?.category?.name || item.categoryName || null;
      const { unitCost, lineCost, product, ...rest } = item;
      if (canViewCost) {
        return { ...rest, unitCost, lineCost, categoryName };
      }
      return { ...rest, categoryName };
    });
  }
  return sanitized;
}

function canViewCostData(userRole) {
  return userRole === 'OWNER' || userRole === 'MANAGER';
}

export async function getAllOrders(req, res) {
  try {
    const { status, search, startDate, endDate, page = 1, limit = 50 } = req.query;

    const where = {};
    if (status && status !== 'ALL') where.status = status;
    if (search) {
      where.OR = [
        { invoiceNo: { contains: search } },
        { customerName: { contains: search } },
        { tableNo: { contains: search } },
      ];
    }
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
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
                  category: { select: { id: true, name: true } },
                },
              },
            },
          },
          payments: true,
          cashier: { select: { id: true, name: true, username: true } },
          workspace: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.order.count({ where }),
    ]);

    const canView = canViewCostData(req.user?.role);
    const outputOrders = orders.map((o) => formatOrderForResponse(o, canView));

    return successResponse(
      res,
      outputOrders,
      'Daftar pesanan berhasil diambil',
      200,
      { page: parseInt(page), limit: take, total }
    );
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

export async function getOrderById(req, res) {
  try {
    const id = parseInt(req.params.id);
    const order = await prisma.order.findUnique({
      where: { id },
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
                category: { select: { id: true, name: true } },
              },
            },
          },
        },
        payments: true,
        cashier: { select: { id: true, name: true, username: true } },
        workspace: {
          include: {
            area: true,
            package: true,
          },
        },
      },
    });

    if (!order) {
      return errorResponse(res, 'Pesanan tidak ditemukan', 404);
    }

    const canView = canViewCostData(req.user?.role);
    const outputOrder = formatOrderForResponse(order, canView);

    return successResponse(res, outputOrder, 'Detail pesanan');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

export async function createOrder(req, res) {
  try {
    const cashierId = req.user.id;
    const {
      type,
      tableNo,
      customerName,
      shiftId,
      items,
      discount = 0,
      payments = [],
      workspaceSessionId,
    } = req.body;

    // Fetch tax & service fee from settings
    const settings = await prisma.setting.findMany();
    const settingsMap = settings.reduce((acc, s) => {
      acc[s.key] = s.value;
      return acc;
    }, {});

    const taxEnabled = settingsMap['taxEnabled'] === 'true' || settingsMap['taxEnabled'] === true;
    const taxPercentage = taxEnabled ? parseFloat(settingsMap['taxPercentage'] || '10') : 0;
    const serviceFeeEnabled = settingsMap['serviceFeeEnabled'] === 'true' || settingsMap['serviceFeeEnabled'] === true;
    const serviceFeePercentage = serviceFeeEnabled ? parseFloat(settingsMap['serviceFeePercentage'] || '5') : 0;
    const roundingEnabled = settingsMap['roundingEnabled'] === 'true' || settingsMap['roundingEnabled'] === true;

    // Calculate item subtotal
    let itemsSubtotal = 0;
    const orderItemsData = [];

    for (const item of items) {
      const lineTotal = item.qty * item.unitPrice - (item.discount || 0);
      itemsSubtotal += lineTotal;

      const product = await prisma.product.findUnique({
        where: { id: item.productId },
        include: { category: true, station: true },
      });

      const stationId = await resolveStationId(product);

      // Calculate HPP snapshot for this item
      let unitCost = 0;
      try {
        unitCost = await calculateProductCogs(item.productId, item.variantName || null);
      } catch (e) {
        // If recipe not set, HPP defaults to 0
        unitCost = 0;
      }
      const lineCost = Math.round(unitCost * item.qty * 100) / 100;

      orderItemsData.push({
        productId: item.productId,
        stationId,
        status: 'PENDING',
        productName: product ? product.name : 'Item',
        variantName: item.variantName || null,
        qty: item.qty,
        unitPrice: item.unitPrice,
        unitCost,
        discount: item.discount || 0,
        note: item.note || null,
        lineTotal,
        lineCost,
      });
    }

    // Include workspace charge if any
    let workspaceCharge = 0;
    let workspaceSession = null;
    if (workspaceSessionId) {
      workspaceSession = await prisma.workspaceSession.findUnique({
        where: { id: workspaceSessionId },
        include: { package: true },
      });
      if (workspaceSession) {
        if (workspaceSession.charge) {
          workspaceCharge = parseFloat(workspaceSession.charge);
        } else if (workspaceSession.package && workspaceSession.package.price) {
          workspaceCharge = parseFloat(workspaceSession.package.price);
        }
      }
    }

    const subtotal = itemsSubtotal + workspaceCharge;
    const afterDiscount = Math.max(0, subtotal - parseFloat(discount));
    const serviceFee = serviceFeeEnabled ? Math.round((afterDiscount * serviceFeePercentage) / 100) : 0;
    const tax = taxEnabled ? Math.round(((afterDiscount + serviceFee) * taxPercentage) / 100) : 0;

    let total = afterDiscount + serviceFee + tax;
    if (roundingEnabled) {
      total = Math.ceil(total / 100) * 100;
    }

    const invoiceNo = await generateInvoiceNo();
    const isPaid = payments && payments.length > 0;

    // Execute Prisma Transaction
    const newOrder = await prisma.$transaction(async (tx) => {
      // Auto-resolve shiftId dari shift yang sedang aktif jika tidak dikirimkan
      let resolvedShiftId = shiftId ? parseInt(shiftId) : null;
      if (!resolvedShiftId) {
        const activeShift = await tx.shift.findFirst({
          where: { closedAt: null },
          orderBy: { openedAt: 'desc' },
          select: { id: true },
        });
        if (activeShift) {
          resolvedShiftId = activeShift.id;
        }
      }

      const order = await tx.order.create({
        data: {
          invoiceNo,
          cashierId,
          shiftId: resolvedShiftId,
          type: type || 'DINE_IN',
          tableNo: type === 'DINE_IN' ? tableNo : null,
          customerName: customerName || null,
          status: isPaid ? 'PAID' : 'OPEN',
          kitchenStatus: 'PENDING',
          barStatus: 'PENDING',
          subtotal,
          discount,
          serviceFee,
          tax,
          total,
          paidAt: isPaid ? new Date() : null,
          items: {
            create: orderItemsData,
          },
          payments: isPaid ? {
            create: payments.map((p) => ({
              method: p.method,
              amount: p.amount,
              reference: p.reference || null,
            })),
          } : undefined,
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
                  category: { select: { id: true, name: true } },
                },
              },
            },
          },
          payments: true,
          cashier: { select: { id: true, name: true, username: true } },
        },
      });

      // If workspace session attached, link and complete it
      if (workspaceSessionId) {
        await tx.workspaceSession.update({
          where: { id: workspaceSessionId },
          data: {
            orderId: order.id,
            status: 'COMPLETED',
            checkOutAt: new Date(),
            ...(workspaceCharge > 0 ? { charge: workspaceCharge } : {}),
          },
        });
      }

      return order;
    });

    const canView = canViewCostData(req.user?.role);
    const outputOrder = formatOrderForResponse(newOrder, canView);

    // Realtime notification via Socket.IO
    try {
      const hasKitchen = (outputOrder.items || []).some((i) => i.station?.type === 'KITCHEN');
      const hasBar = (outputOrder.items || []).some((i) => i.station?.type === 'BAR');
      if (hasKitchen) emitToStation('KITCHEN_MAIN', 'order:new', outputOrder);
      if (hasBar) emitToStation('BAR_MAIN', 'order:new', outputOrder);
      emitOrderEvent('order:new', outputOrder);
    } catch (e) {
      console.warn('[Socket.IO] Emit order:new notice:', e);
    }

    // Notifikasi Telegram jika pesanan berstatus PAID
    if (outputOrder.status === 'PAID') {
      notifyPaidTransaction(outputOrder).catch(() => {});
    }

    return successResponse(res, outputOrder, 'Pesanan berhasil dibuat', 201);
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

export async function updateOrder(req, res) {
  try {
    const id = parseInt(req.params.id);
    const {
      type,
      tableNo,
      customerName,
      shiftId,
      items,
      discount = 0,
      workspaceSessionId,
    } = req.body;

    const existingOrder = await prisma.order.findUnique({ where: { id } });
    if (!existingOrder) return errorResponse(res, 'Pesanan tidak ditemukan', 404);
    if (existingOrder.status !== 'OPEN') {
      return errorResponse(res, 'Hanya pesanan yang belum dibayar (OPEN/HOLD) yang dapat diperbarui', 400);
    }

    const settings = await prisma.setting.findMany();
    const settingsMap = settings.reduce((acc, s) => {
      acc[s.key] = s.value;
      return acc;
    }, {});

    const taxEnabled = settingsMap['taxEnabled'] === 'true' || settingsMap['taxEnabled'] === true;
    const taxPercentage = taxEnabled ? parseFloat(settingsMap['taxPercentage'] || '10') : 0;
    const serviceFeeEnabled = settingsMap['serviceFeeEnabled'] === 'true' || settingsMap['serviceFeeEnabled'] === true;
    const serviceFeePercentage = serviceFeeEnabled ? parseFloat(settingsMap['serviceFeePercentage'] || '5') : 0;
    const roundingEnabled = settingsMap['roundingEnabled'] === 'true' || settingsMap['roundingEnabled'] === true;

    let itemsSubtotal = 0;
    const orderItemsData = [];

    for (const item of items) {
      const lineTotal = item.qty * item.unitPrice - (item.discount || 0);
      itemsSubtotal += lineTotal;

      const product = await prisma.product.findUnique({
        where: { id: item.productId },
        include: { category: true, station: true },
      });

      const stationId = await resolveStationId(product);

      let unitCost = 0;
      try {
        unitCost = await calculateProductCogs(item.productId, item.variantName || null);
      } catch (e) {
        unitCost = 0;
      }
      const lineCost = Math.round(unitCost * item.qty * 100) / 100;

      orderItemsData.push({
        orderId: id,
        productId: item.productId,
        stationId,
        status: 'PENDING',
        productName: product ? product.name : 'Item',
        variantName: item.variantName || null,
        qty: item.qty,
        unitPrice: item.unitPrice,
        unitCost,
        discount: item.discount || 0,
        note: item.note || null,
        lineTotal,
        lineCost,
      });
    }

    let workspaceCharge = 0;
    if (workspaceSessionId) {
      const workspaceSession = await prisma.workspaceSession.findUnique({
        where: { id: workspaceSessionId },
      });
      if (workspaceSession && workspaceSession.charge) {
        workspaceCharge = parseFloat(workspaceSession.charge);
      }
    }

    const subtotal = itemsSubtotal + workspaceCharge;
    const afterDiscount = Math.max(0, subtotal - parseFloat(discount));
    const serviceFee = serviceFeeEnabled ? Math.round((afterDiscount * serviceFeePercentage) / 100) : 0;
    const tax = taxEnabled ? Math.round(((afterDiscount + serviceFee) * taxPercentage) / 100) : 0;

    let total = afterDiscount + serviceFee + tax;
    if (roundingEnabled) {
      total = Math.ceil(total / 100) * 100;
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.orderItem.deleteMany({ where: { orderId: id } });
      await tx.orderItem.createMany({ data: orderItemsData });

      return await tx.order.update({
        where: { id },
        data: {
          type: type || existingOrder.type,
          tableNo: type === 'DINE_IN' ? tableNo : null,
          customerName: customerName || null,
          shiftId: shiftId ? parseInt(shiftId) : existingOrder.shiftId,
          subtotal,
          discount,
          serviceFee,
          tax,
          total,
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
                  category: { select: { id: true, name: true } },
                },
              },
            },
          },
          payments: true,
          cashier: { select: { id: true, name: true, username: true } },
        },
      });
    });

    const canView = canViewCostData(req.user?.role);
    const outputOrder = formatOrderForResponse(updated, canView);

    try {
      const hasKitchen = (outputOrder.items || []).some((i) => i.station?.type === 'KITCHEN');
      const hasBar = (outputOrder.items || []).some((i) => i.station?.type === 'BAR');
      if (hasKitchen) emitToStation('KITCHEN_MAIN', 'order:updated', outputOrder);
      if (hasBar) emitToStation('BAR_MAIN', 'order:updated', outputOrder);
      emitOrderEvent('order:updated', outputOrder);
    } catch (e) {
      console.warn('[Socket.IO] Emit order:updated error:', e);
    }

    return successResponse(res, outputOrder, 'Pesanan berhasil diperbarui');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

export async function payOrder(req, res) {
  try {
    const id = parseInt(req.params.id);
    const { payments, items, discount, type, tableNo, customerName } = req.body;

    if (!payments || payments.length === 0) {
      return errorResponse(res, 'Rincian pembayaran wajib diisi', 400);
    }

    const order = await prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!order) return errorResponse(res, 'Pesanan tidak ditemukan', 404);
    if (order.status === 'PAID') return errorResponse(res, 'Pesanan sudah dibayar', 400);

    // Jika items dikirimkan saat bayar dan ada perubahan item
    let updatedTotals = null;
    let orderItemsData = null;
    if (items && items.length > 0) {
      const settings = await prisma.setting.findMany();
      const settingsMap = settings.reduce((acc, s) => {
        acc[s.key] = s.value;
        return acc;
      }, {});

      const taxEnabled = settingsMap['taxEnabled'] === 'true' || settingsMap['taxEnabled'] === true;
      const taxPercentage = taxEnabled ? parseFloat(settingsMap['taxPercentage'] || '10') : 0;
      const serviceFeeEnabled = settingsMap['serviceFeeEnabled'] === 'true' || settingsMap['serviceFeeEnabled'] === true;
      const serviceFeePercentage = serviceFeeEnabled ? parseFloat(settingsMap['serviceFeePercentage'] || '5') : 0;
      const roundingEnabled = settingsMap['roundingEnabled'] === 'true' || settingsMap['roundingEnabled'] === true;

      let itemsSubtotal = 0;
      orderItemsData = [];
      for (const item of items) {
        const lineTotal = item.qty * item.unitPrice - (item.discount || 0);
        itemsSubtotal += lineTotal;
        const product = await prisma.product.findUnique({
          where: { id: item.productId },
          include: { category: true, station: true },
        });
        const stationId = await resolveStationId(product);

        let unitCost = 0;
        try {
          unitCost = await calculateProductCogs(item.productId, item.variantName || null);
        } catch (e) {
          unitCost = 0;
        }
        const lineCost = Math.round(unitCost * item.qty * 100) / 100;
        orderItemsData.push({
          orderId: id,
          productId: item.productId,
          stationId,
          status: 'PENDING',
          productName: product ? product.name : 'Item',
          variantName: item.variantName || null,
          qty: item.qty,
          unitPrice: item.unitPrice,
          unitCost,
          discount: item.discount || 0,
          note: item.note || null,
          lineTotal,
          lineCost,
        });
      }

      const disc = discount !== undefined ? parseFloat(discount) : parseFloat(order.discount || 0);
      const subtotal = itemsSubtotal;
      const afterDiscount = Math.max(0, subtotal - disc);
      const serviceFee = serviceFeeEnabled ? Math.round((afterDiscount * serviceFeePercentage) / 100) : 0;
      const tax = taxEnabled ? Math.round(((afterDiscount + serviceFee) * taxPercentage) / 100) : 0;
      let total = afterDiscount + serviceFee + tax;
      if (roundingEnabled) {
        total = Math.ceil(total / 100) * 100;
      }
      updatedTotals = { subtotal, discount: disc, serviceFee, tax, total };
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (orderItemsData) {
        await tx.orderItem.deleteMany({ where: { orderId: id } });
        await tx.orderItem.createMany({ data: orderItemsData });
      }

      await tx.payment.createMany({
        data: payments.map((p) => ({
          orderId: id,
          method: p.method,
          amount: p.amount,
          reference: p.reference || null,
        })),
      });

      let resolvedShiftId = order.shiftId;
      if (!resolvedShiftId) {
        const activeShift = await tx.shift.findFirst({
          where: { closedAt: null },
          orderBy: { openedAt: 'desc' },
          select: { id: true },
        });
        if (activeShift) {
          resolvedShiftId = activeShift.id;
        }
      }

      return await tx.order.update({
        where: { id },
        data: {
          status: 'PAID',
          paidAt: new Date(),
          ...(resolvedShiftId ? { shiftId: resolvedShiftId } : {}),
          ...(tableNo ? { tableNo } : {}),
          ...(customerName ? { customerName } : {}),
          ...(type ? { type } : {}),
          ...(updatedTotals ? updatedTotals : {}),
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
                  category: { select: { id: true, name: true } },
                },
              },
            },
          },
          payments: true,
          cashier: { select: { id: true, name: true, username: true } },
        },
      });
    });

    const canView = canViewCostData(req.user?.role);
    const outputUpdated = formatOrderForResponse(updated, canView);

    try {
      const hasKitchen = (outputUpdated.items || []).some((i) => i.station?.type === 'KITCHEN');
      const hasBar = (outputUpdated.items || []).some((i) => i.station?.type === 'BAR');
      if (hasKitchen) emitToStation('KITCHEN_MAIN', 'order:updated', outputUpdated);
      if (hasBar) emitToStation('BAR_MAIN', 'order:updated', outputUpdated);
      emitOrderEvent('order:updated', outputUpdated);
    } catch (e) {
      console.warn('[Socket.IO] Emit order:updated error on payOrder:', e);
    }

    notifyPaidTransaction(outputUpdated).catch(() => {});

    return successResponse(res, outputUpdated, 'Pembayaran berhasil dikonfirmasi');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

export async function voidOrder(req, res) {
  try {
    const id = parseInt(req.params.id);
    const { reason, managerPin } = req.body;
    const userId = req.user.id;

    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) return errorResponse(res, 'Pesanan tidak ditemukan', 404);
    if (order.status === 'VOIDED') return errorResponse(res, 'Pesanan sudah dibatalkan', 400);

    // PRD FR-28: Pembatalan pesanan yang sudah dibayar (PAID) memerlukan role MANAGER atau OWNER, atau PIN Otorisasi Supervisor
    if (order.status === 'PAID' && !['MANAGER', 'OWNER'].includes(req.user.role)) {
      const pinSetting = await prisma.setting.findUnique({ where: { key: 'supervisorPin' } });
      const validPin = pinSetting?.value || '1234';
      if (!managerPin || String(managerPin).trim() !== String(validPin).trim()) {
        return errorResponse(
          res,
          'Akses ditolak: Pembatalan pesanan yang sudah dibayar memerlukan otorisasi Manager atau Owner (PIN salah)',
          403
        );
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.orderItem.updateMany({
        where: { orderId: id },
        data: { status: 'CANCELLED' },
      });

      const vOrder = await tx.order.update({
        where: { id },
        data: {
          status: 'VOIDED',
          voidReason: reason,
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
                  category: { select: { id: true, name: true } },
                },
              },
            },
          },
          payments: true,
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'VOID_ORDER',
          detail: {
            invoiceNo: order.invoiceNo,
            reason,
            total: order.total,
          },
        },
      });

      return vOrder;
    });

    try {
      emitToStation('KITCHEN_MAIN', 'order:updated', updated);
      emitToStation('BAR_MAIN', 'order:updated', updated);
      emitOrderEvent('order:updated', updated);
    } catch (e) {
      console.warn('[Socket.IO] Emit voidOrder error:', e);
    }

    return successResponse(res, updated, 'Pesanan berhasil dibatalkan (VOID)');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

export async function refundOrder(req, res) {
  try {
    const id = parseInt(req.params.id);
    const { reason, refundAmount, managerPin } = req.body;
    const userId = req.user.id;

    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) return errorResponse(res, 'Pesanan tidak ditemukan', 404);
    if (order.status !== 'PAID') return errorResponse(res, 'Hanya pesanan yang sudah dibayar yang dapat di-refund', 400);

    if (!['MANAGER', 'OWNER'].includes(req.user.role)) {
      const pinSetting = await prisma.setting.findUnique({ where: { key: 'supervisorPin' } });
      const validPin = pinSetting?.value || '1234';
      if (!managerPin || String(managerPin).trim() !== String(validPin).trim()) {
        return errorResponse(
          res,
          'Akses ditolak: Pengembalian dana memerlukan otorisasi Manager atau Owner (PIN salah)',
          403
        );
      }
    }

    const amount = refundAmount || order.total;

    const updated = await prisma.$transaction(async (tx) => {
      const rOrder = await tx.order.update({
        where: { id },
        data: {
          status: 'REFUNDED',
          voidReason: `REFUND: ${reason} (Jumlah: ${amount})`,
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'REFUND_ORDER',
          detail: {
            invoiceNo: order.invoiceNo,
            reason,
            refundAmount: amount,
          },
        },
      });

      return rOrder;
    });

    return successResponse(res, updated, 'Pengembalian dana (Refund) berhasil dicatat');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

export async function updateKitchenStatus(req, res) {
  try {
    const id = parseInt(req.params.id);
    const { status, station } = req.body;

    if (!['PENDING', 'IN_PROGRESS', 'READY', 'SERVED'].includes(status)) {
      return errorResponse(res, 'Status tidak valid', 400);
    }

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: {
              include: { category: true },
            },
          },
        },
      },
    });

    if (!order) {
      return errorResponse(res, 'Pesanan tidak ditemukan', 404);
    }

    const dataToUpdate = {};
    if (station === 'BAR') {
      dataToUpdate.barStatus = status;
      // If order contains no food items, align kitchenStatus too
      const hasFood = order.items.some((i) => {
        const cat = (i.product?.category?.name || '').toLowerCase();
        return !cat.includes('kopi') && !cat.includes('drink') && !cat.includes('beverage') && !cat.includes('minuman') && !cat.includes('non-kopi');
      });
      if (!hasFood) {
        dataToUpdate.kitchenStatus = status;
      }
    } else if (station === 'KITCHEN') {
      dataToUpdate.kitchenStatus = status;
      // If order contains no drink items, align barStatus too
      const hasDrinks = order.items.some((i) => {
        const cat = (i.product?.category?.name || '').toLowerCase();
        return cat.includes('kopi') || cat.includes('drink') || cat.includes('beverage') || cat.includes('minuman') || cat.includes('non-kopi');
      });
      if (!hasDrinks) {
        dataToUpdate.barStatus = status;
      }
    } else {
      dataToUpdate.kitchenStatus = status;
      dataToUpdate.barStatus = status;
    }

    const updated = await prisma.order.update({
      where: { id },
      data: dataToUpdate,
      include: {
        items: {
          include: {
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

    const canView = canViewCostData(req.user?.role);
    const outputOrder = formatOrderForResponse(updated, canView);
    return successResponse(res, outputOrder, 'Status dapur/bar berhasil diperbarui');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

