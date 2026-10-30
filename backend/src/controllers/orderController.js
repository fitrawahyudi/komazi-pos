import prisma from '../config/db.js';
import { generateInvoiceNo } from '../utils/invoice.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { calculateProductCogs } from '../services/cogsService.js';
import { emitToStation, emitOrderEvent, emitCustomerEvent } from '../config/socket.js';
import { notifyNewOrder, notifyPaidTransaction } from '../services/telegramService.js';
import { isDrinkItemHelper } from '../services/kdsService.js';
import { deltaInventoryService } from '../services/deltaInventoryService.js';
import { approvalService } from '../services/approval.service.js';
import { dispatchNotification } from '../services/notification.service.js';
import { checkStaffShiftEligibility } from '../services/scheduleGuard.service.js';
import { getSettingsMap } from '../services/settingsCache.service.js';
import { consumeVoucher } from '../services/promoService.js';
import logger from '../utils/logger.js';

// Cached default station lookup
let defaultBarStationId = null;
let defaultKitchenStationId = null;
let stationsCachedAt = 0;

async function getDefaultStationId(isDrink) {
  const now = Date.now();
  if (now - stationsCachedAt > 60000 || !defaultBarStationId || !defaultKitchenStationId) {
    const [bar, kitchen] = await Promise.all([
      prisma.station.findFirst({ where: { OR: [{ code: 'BAR_MAIN' }, { type: 'BAR' }] } }),
      prisma.station.findFirst({ where: { OR: [{ code: 'KITCHEN_MAIN' }, { type: 'KITCHEN' }] } }),
    ]);
    defaultBarStationId = bar?.id || null;
    defaultKitchenStationId = kitchen?.id || null;
    stationsCachedAt = now;
  }
  return isDrink ? defaultBarStationId : defaultKitchenStationId;
}

// Helper: dapatkan station id untuk produk jika belum di-set
async function resolveStationId(product) {
  if (product?.stationId) {
    return product.stationId;
  }

  const isDrink = isDrinkItemHelper(product);
  return await getDefaultStationId(isDrink);
}

/**
 * Batched order items preparer: eliminates N+1 queries by batch fetching products and caching station/COGS lookups
 */
async function prepareOrderItems(items = [], orderId = null) {
  const productIds = [...new Set(items.map((i) => i.productId).filter(Boolean))];
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    include: { category: true, station: true },
  });
  const productMap = new Map(products.map((p) => [p.id, p]));

  let itemsSubtotal = 0;
  const orderItemsData = [];
  const cogsCache = new Map();

  for (const item of items) {
    const lineTotal = item.qty * item.unitPrice - (item.discount || 0);
    itemsSubtotal += lineTotal;

    const product = productMap.get(item.productId);
    const stationId = await resolveStationId(product);

    const cogsKey = `${item.productId}_${item.variantName || ''}`;
    let unitCost = 0;
    if (cogsCache.has(cogsKey)) {
      unitCost = cogsCache.get(cogsKey);
    } else {
      try {
        unitCost = await calculateProductCogs(item.productId, item.variantName || null);
        cogsCache.set(cogsKey, unitCost);
      } catch (e) {
        unitCost = 0;
      }
    }
    const lineCost = Math.round(unitCost * item.qty * 100) / 100;

    const itemRecord = {
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
    };

    if (orderId) {
      itemRecord.orderId = orderId;
    }

    orderItemsData.push(itemRecord);
  }

  return { itemsSubtotal, orderItemsData };
}

// Helper: format order items with categoryName and sanitize cost fields for non-privileged roles
function formatOrderForResponse(order, canViewCost) {
  if (!order) return order;
  const sanitized = { ...order };
  // Ensure cashierName is explicitly set for frontend displays, receipt print, and owner/manager audits
  sanitized.cashierName = order.cashierName || order.cashier?.name || order.shift?.cashier?.name || null;
  if (sanitized.items) {
    sanitized.items = sanitized.items.filter((item) => item.status !== 'CANCELLED').map((item) => {
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
    const {
      status,
      search,
      startDate,
      endDate,
      cashierId,
      shiftId,
      paymentMethod,
      page = 1,
      limit = 50,
    } = req.query;

    const where = {};
    if (status && status !== 'ALL') where.status = status;
    if (cashierId && cashierId !== 'ALL') where.cashierId = parseInt(cashierId);
    if (shiftId && shiftId !== 'ALL') where.shiftId = parseInt(shiftId);
    if (paymentMethod && paymentMethod !== 'ALL') {
      where.payments = { some: { method: paymentMethod } };
    }
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

    const safeLimit = Math.min(100, Math.max(1, parseInt(limit) || 50));
    const safePage = Math.max(1, parseInt(page) || 1);
    const skip = (safePage - 1) * safeLimit;
    const take = safeLimit;

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          items: {
            where: { status: { not: 'CANCELLED' } },
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
          shift: {
            include: {
              cashier: { select: { id: true, name: true, username: true } },
            },
          },
          workspace: true,
          customer: { select: { id: true, name: true, phone: true, tier: true, points: true } },
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
        shift: {
          include: {
            cashier: { select: { id: true, name: true, username: true } },
          },
        },
        customer: { select: { id: true, name: true, phone: true, tier: true, points: true } },
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
      customerId,
      shiftId,
      items,
      discount = 0,
      payments = [],
      workspaceSessionId,
      promoCode,
      promoName,
    } = req.body;

    // Validasi jadwal kerja & presensi staf: Staf wajib presensi sebelum bertransaksi
    const eligibility = await checkStaffShiftEligibility(cashierId, req.user.role);
    if (!eligibility.eligible) {
      return errorResponse(res, eligibility.message, 403);
    }

    // 0. Wajib ada sesi kasir (shift) aktif sebelum pesanan dapat dibuat
    let activeShift = null;
    if (shiftId) {
      activeShift = await prisma.shift.findFirst({
        where: { id: parseInt(shiftId), closedAt: null },
        select: { id: true },
      });
    }
    if (!activeShift) {
      activeShift = await prisma.shift.findFirst({
        where: { cashierId: req.user.id, closedAt: null },
        orderBy: { openedAt: 'desc' },
        select: { id: true },
      });
    }
    if (!activeShift) {
      activeShift = await prisma.shift.findFirst({
        where: { closedAt: null },
        orderBy: { openedAt: 'desc' },
        select: { id: true },
      });
    }

    if (!activeShift) {
      return errorResponse(
        res,
        'Tidak dapat membuat pesanan: Sesi kasir (shift) belum dibuka atau sudah ditutup. Silakan buka sesi kasir terlebih dahulu.',
        400
      );
    }

    // Fetch tax & service fee from settings cache
    const settingsMap = await getSettingsMap();

    const taxEnabled = settingsMap['taxEnabled'] === 'true' || settingsMap['taxEnabled'] === true;
    const taxPercentage = taxEnabled ? parseFloat(settingsMap['taxPercentage'] || '10') : 0;
    const serviceFeeEnabled = settingsMap['serviceFeeEnabled'] === 'true' || settingsMap['serviceFeeEnabled'] === true;
    const serviceFeePercentage = serviceFeeEnabled ? parseFloat(settingsMap['serviceFeePercentage'] || '5') : 0;
    const roundingEnabled = settingsMap['roundingEnabled'] === 'true' || settingsMap['roundingEnabled'] === true;

    // Batched preparation of items and subtotal (eliminates N+1 queries)
    const { itemsSubtotal, orderItemsData } = await prepareOrderItems(items);

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

    const isPaid = payments && payments.length > 0;
    let updatedCustForEmit = null;

    // Execute Prisma Transaction with retry for rare invoiceNo collision under high concurrency
    let newOrder = null;
    let lastError = null;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const invoiceNo = await generateInvoiceNo(null, attempt);

        newOrder = await prisma.$transaction(async (tx) => {
          const resolvedShiftId = activeShift.id;

          const order = await tx.order.create({
            data: {
              invoiceNo,
              cashierId,
              shiftId: resolvedShiftId,
              type: type || 'DINE_IN',
              tableNo: type === 'DINE_IN' ? tableNo : null,
              customerName: customerName || null,
              customerId: customerId ? parseInt(customerId) : null,
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
            where: { status: { not: 'CANCELLED' } },
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
              customer: { select: { id: true, name: true, phone: true, tier: true, points: true } },
            },
          });

          // Update customer loyalty points jika order langsung PAID
          if (customerId && isPaid) {
            const targetCustId = parseInt(customerId);
            const paidSpent = parseFloat(total) || 0;
            const pointsEarned = Math.floor(paidSpent / 10000);
            const currentCust = await tx.customer.findUnique({ where: { id: targetCustId } });
            if (currentCust) {
              const newPoints = currentCust.points + pointsEarned;
              const newSpent = parseFloat(currentCust.totalSpent) + paidSpent;
              const newVisits = currentCust.visitCount + 1;
              let newTier = 'SILVER';
              if (newPoints >= 500) newTier = 'PLATINUM';
              else if (newPoints >= 200) newTier = 'GOLD';

              updatedCustForEmit = await tx.customer.update({
                where: { id: targetCustId },
                data: {
                  points: newPoints,
                  totalSpent: newSpent,
                  visitCount: newVisits,
                  tier: newTier,
                },
              });
            }
          }

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

          // Immediate BOM Deduction: Potong stok bahan baku seketika (baik status OPEN / Hold Bill maupun PAID)
          await deltaInventoryService.deductNewOrderStock(
            tx,
            order.id,
            order.invoiceNo,
            items
          );

          return order;
        });

        if (newOrder) break;
      } catch (err) {
        lastError = err;
        // Jika collision invoiceNo, ulangi ke attempt berikutnya
        if (err.code === 'P2002' && (err.meta?.target?.includes?.('invoiceNo') || err.message?.includes?.('invoiceNo'))) {
          logger.warn(`Invoice number collision detected, retrying (attempt ${attempt + 1})...`);
          continue;
        }
        throw err;
      }
    }

    if (!newOrder) {
      throw lastError || new Error('Gagal membuat pesanan setelah beberapa percobaan');
    }

    const canView = canViewCostData(req.user?.role);
    const outputOrder = formatOrderForResponse(newOrder, canView);
    if (promoCode) outputOrder.promoCode = promoCode;
    if (promoName) outputOrder.promoName = promoName;

    // Catat pemakaian voucher promo & audit log
    if (promoCode) {
      consumeVoucher(promoCode).catch((err) => {
        logger.warn(`Failed to consume promo voucher "${promoCode}": ${err.message}`);
      });
    }

    if (promoCode || promoName) {
      prisma.auditLog.create({
        data: {
          userId: req.user.id,
          action: 'ORDER_PROMO_APPLIED',
          detail: {
            orderId: newOrder.id,
            invoiceNo: newOrder.invoiceNo,
            promoCode: promoCode || null,
            promoName: promoName || null,
            discountAmount: parseFloat(discount) || 0,
          },
        },
      }).catch(() => { });
    }

    const hasKitchen = (outputOrder.items || []).some((i) => !(i.station?.type === 'BAR' || isDrinkItemHelper(i)));
    const hasBar = (outputOrder.items || []).some((i) => i.station?.type === 'BAR' || isDrinkItemHelper(i));

    // Realtime notification via Socket.IO (Broadcast sekali ke seluruh terminal)
    try {
      emitOrderEvent('order:new', outputOrder);

      if (updatedCustForEmit) {
        emitCustomerEvent('customer:updated', updatedCustForEmit);
        emitCustomerEvent('customers:changed', { action: 'ORDER_PAID', customerId: updatedCustForEmit.id });
      }

      logger.order.info(`Order created | orderId=${outputOrder.invoiceNo}`, {
        orderId: outputOrder.invoiceNo,
        total: outputOrder.total,
        status: outputOrder.status,
      });

      if (hasKitchen) {
        logger.kds.info(`Order dispatched to kitchen | orderId=${outputOrder.invoiceNo}`, {
          orderId: outputOrder.invoiceNo,
        });
      }

      if (hasBar) {
        logger.bds.info(`Order dispatched to bar | orderId=${outputOrder.invoiceNo}`, {
          orderId: outputOrder.invoiceNo,
        });
      }

      if (outputOrder.status === 'PAID') {
        logger.payment.success(`Payment confirmed | orderId=${outputOrder.invoiceNo} amount=${outputOrder.total}`, {
          orderId: outputOrder.invoiceNo,
          amount: outputOrder.total,
        });
      }
    } catch (e) {
      logger.warn(`[Socket.IO] Emit order:new notice: ${e.message}`);
    }

    // Notifikasi Telegram jika pesanan berstatus PAID
    if (outputOrder.status === 'PAID') {
      notifyPaidTransaction(outputOrder).catch(() => { });
    }

    // Role-based Android Push & In-App Notification (NEW_ORDER)
    dispatchNotification({
      event: 'NEW_ORDER',
      category: 'ORDERS',
      title: `🔔 Pesanan Baru: #${outputOrder.invoiceNo}`,
      body: `${outputOrder.items?.length || 1} item ${outputOrder.tableNo ? `(Meja ${outputOrder.tableNo})` : '(Take Away)'}`,
      data: {
        orderId: outputOrder.id,
        invoiceNo: outputOrder.invoiceNo,
        tableNo: outputOrder.tableNo || '',
        url: '/orders',
      },
      context: {
        hasKitchen,
        hasBar,
        initiatorId: req.user?.id,
        excludeInitiator: true,
      },
    }).catch(() => { });

    return successResponse(res, outputOrder, 'Pesanan berhasil dibuat', 201);
  } catch (err) {
    return errorResponse(res, err.message, err.statusCode || 500);
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

    // Validasi jadwal kerja & presensi staf: Staf wajib presensi sebelum bertransaksi
    const eligibility = await checkStaffShiftEligibility(req.user.id, req.user.role);
    if (!eligibility.eligible) {
      return errorResponse(res, eligibility.message, 403);
    }

    const existingOrder = await prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!existingOrder) return errorResponse(res, 'Pesanan tidak ditemukan', 404);
    if (existingOrder.status !== 'OPEN') {
      return errorResponse(res, 'Hanya pesanan yang belum dibayar (OPEN/HOLD) yang dapat diperbarui', 400);
    }

    // Role & Ownership check: Cashier can only edit their own OPEN order
    const isOwnerOrManager = ['OWNER', 'MANAGER'].includes(req.user.role);
    if (!isOwnerOrManager && existingOrder.cashierId && existingOrder.cashierId !== req.user.id) {
      return errorResponse(res, 'Pesanan milik kasir lain hanya dapat dilihat.', 403);
    }

    const settingsMap = await getSettingsMap();

    const taxEnabled = settingsMap['taxEnabled'] === 'true' || settingsMap['taxEnabled'] === true;
    const taxPercentage = taxEnabled ? parseFloat(settingsMap['taxPercentage'] || '10') : 0;
    const serviceFeeEnabled = settingsMap['serviceFeeEnabled'] === 'true' || settingsMap['serviceFeeEnabled'] === true;
    const serviceFeePercentage = serviceFeeEnabled ? parseFloat(settingsMap['serviceFeePercentage'] || '5') : 0;
    const roundingEnabled = settingsMap['roundingEnabled'] === 'true' || settingsMap['roundingEnabled'] === true;

    // Batched preparation of items and subtotal (eliminates N+1 queries)
    const { itemsSubtotal, orderItemsData } = await prepareOrderItems(items, id);

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
      // Re-verify order status inside transaction to prevent race conditions
      const lockedOrder = await tx.order.findUnique({ where: { id } });
      if (!lockedOrder || lockedOrder.status !== 'OPEN') {
        throw new Error('Pesanan yang sudah dibayar tidak dapat diedit');
      }

      // 1. Eksekusi mutasi delta inventori bahan baku (BOM)
      await deltaInventoryService.processOrderDelta(
        tx,
        id,
        existingOrder.invoiceNo,
        existingOrder.items,
        items
      );

      // 2. Update OrderItem secara in-place tanpa merusak status pengerjaan dapur (PREPARING/READY)
      const buildKey = (item) => `${item.productId}_${(item.variantName || '').toLowerCase().trim()}`;
      const activeExistingMap = new Map();
      for (const item of existingOrder.items) {
        if (item.status !== 'CANCELLED') {
          activeExistingMap.set(buildKey(item), item);
        }
      }

      const incomingKeys = new Set();
      for (const incoming of orderItemsData) {
        const key = buildKey(incoming);
        incomingKeys.add(key);
        const existingItem = activeExistingMap.get(key);

        if (existingItem) {
          // Update item yang sudah ada, pertahankan status dapur saat ini (misal PREPARING atau READY)
          await tx.orderItem.update({
            where: { id: existingItem.id },
            data: {
              qty: incoming.qty,
              unitPrice: incoming.unitPrice,
              unitCost: incoming.unitCost,
              discount: incoming.discount,
              note: incoming.note,
              lineTotal: incoming.lineTotal,
              lineCost: incoming.lineCost,
              stationId: incoming.stationId,
            },
          });
        } else {
          // Tambahkan item baru dengan status awal PENDING
          await tx.orderItem.create({
            data: incoming,
          });
        }
      }

      // Tandai CANCELLED untuk item lama yang dihilangkan dari pesanan
      for (const [key, existingItem] of activeExistingMap) {
        if (!incomingKeys.has(key)) {
          await tx.orderItem.update({
            where: { id: existingItem.id },
            data: { status: 'CANCELLED' },
          });
        }
      }

      // 3. Update data header Order
      const updatedOrderHeader = await tx.order.update({
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
            where: { status: { not: 'CANCELLED' } },
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

      // Catat jejak audit trail perubahan pesanan terbuka
      await tx.auditLog.create({
        data: {
          userId: req.user.id,
          action: 'UPDATE_OPEN_ORDER',
          detail: {
            orderId: id,
            invoiceNo: existingOrder.invoiceNo,
            previousTotal: existingOrder.total,
            newTotal: total,
            itemCount: orderItemsData.length,
          },
        },
      });

      return updatedOrderHeader;
    });

    const canView = canViewCostData(req.user?.role);
    const outputOrder = formatOrderForResponse(updated, canView);

    try {
      const hasKitchen = (outputOrder.items || []).some((i) => !(i.station?.type === 'BAR' || isDrinkItemHelper(i)));
      const hasBar = (outputOrder.items || []).some((i) => i.station?.type === 'BAR' || isDrinkItemHelper(i));
      if (hasKitchen) emitToStation('KITCHEN_MAIN', 'order:updated', outputOrder);
      if (hasBar) emitToStation('BAR_MAIN', 'order:updated', outputOrder);
      emitOrderEvent('order:updated', outputOrder);
    } catch (e) {
      console.warn('[Socket.IO] Emit order:updated error:', e);
    }

    return successResponse(res, outputOrder, 'Pesanan berhasil diperbarui');
  } catch (err) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
}

export async function payOrder(req, res) {
  try {
    const id = parseInt(req.params.id);
    const { payments, items, discount, type, tableNo, customerName, customerId, promoCode, promoName } = req.body;

    // Validasi jadwal kerja & presensi staf: Staf wajib presensi sebelum bertransaksi
    const eligibility = await checkStaffShiftEligibility(req.user.id, req.user.role);
    if (!eligibility.eligible) {
      return errorResponse(res, eligibility.message, 403);
    }

    if (!payments || payments.length === 0) {
      return errorResponse(res, 'Rincian pembayaran wajib diisi', 400);
    }

    const order = await prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!order) return errorResponse(res, 'Pesanan tidak ditemukan', 404);
    if (order.status === 'PAID') return errorResponse(res, 'Pesanan sudah dibayar', 400);
    if (order.status === 'VOIDED' || order.status === 'REFUNDED') {
      return errorResponse(res, 'Pesanan yang telah dibatalkan atau di-refund tidak dapat dibayar', 400);
    }

    // Jika items dikirimkan saat bayar dan ada perubahan item
    let updatedTotals = null;
    let orderItemsData = null;
    if (items && items.length > 0) {
      const settingsMap = await getSettingsMap();

      const taxEnabled = settingsMap['taxEnabled'] === 'true' || settingsMap['taxEnabled'] === true;
      const taxPercentage = taxEnabled ? parseFloat(settingsMap['taxPercentage'] || '10') : 0;
      const serviceFeeEnabled = settingsMap['serviceFeeEnabled'] === 'true' || settingsMap['serviceFeeEnabled'] === true;
      const serviceFeePercentage = serviceFeeEnabled ? parseFloat(settingsMap['serviceFeePercentage'] || '5') : 0;
      const roundingEnabled = settingsMap['roundingEnabled'] === 'true' || settingsMap['roundingEnabled'] === true;

      const prepared = await prepareOrderItems(items, id);
      const itemsSubtotal = prepared.itemsSubtotal;
      orderItemsData = prepared.orderItemsData;

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

    // Validasi kecukupan nominal pembayaran (Payment Tampering Defense)
    const expectedTotal = updatedTotals ? updatedTotals.total : parseFloat(order.total);
    const totalPaid = payments.reduce((acc, p) => acc + (parseFloat(p.amount) || 0), 0);
    if (totalPaid < expectedTotal) {
      return errorResponse(
        res,
        `Total pembayaran (Rp ${totalPaid.toLocaleString('id-ID')}) kurang dari jumlah tagihan (Rp ${expectedTotal.toLocaleString('id-ID')})`,
        400
      );
    }

    let updatedCustForPayEmit = null;

    const updated = await prisma.$transaction(async (tx) => {
      // Validasi status pesanan di dalam transaksi untuk mencegah race condition
      const lockedOrder = await tx.order.findUnique({ where: { id } });
      if (!lockedOrder || lockedOrder.status !== 'OPEN') {
        throw new Error('Pesanan sudah dibayar atau tidak lagi terbuka');
      }

      // 1. Jika ada perubahan items saat pembayaran kasir, jalankan delta in-place update
      if (orderItemsData && items && items.length > 0) {
        await deltaInventoryService.processOrderDelta(
          tx,
          id,
          order.invoiceNo,
          order.items,
          items
        );

        const buildKey = (item) => `${item.productId}_${(item.variantName || '').toLowerCase().trim()}`;
        const activeExistingMap = new Map();
        for (const item of order.items) {
          if (item.status !== 'CANCELLED') {
            activeExistingMap.set(buildKey(item), item);
          }
        }

        const incomingKeys = new Set();
        for (const incoming of orderItemsData) {
          const key = buildKey(incoming);
          incomingKeys.add(key);
          const existingItem = activeExistingMap.get(key);

          if (existingItem) {
            await tx.orderItem.update({
              where: { id: existingItem.id },
              data: {
                qty: incoming.qty,
                unitPrice: incoming.unitPrice,
                unitCost: incoming.unitCost,
                discount: incoming.discount,
                note: incoming.note,
                lineTotal: incoming.lineTotal,
                lineCost: incoming.lineCost,
                stationId: incoming.stationId,
              },
            });
          } else {
            await tx.orderItem.create({ data: incoming });
          }
        }

        for (const [key, existingItem] of activeExistingMap) {
          if (!incomingKeys.has(key)) {
            await tx.orderItem.update({
              where: { id: existingItem.id },
              data: { status: 'CANCELLED' },
            });
          }
        }
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
        const myActiveShift = await tx.shift.findFirst({
          where: { cashierId: req.user.id, closedAt: null },
          orderBy: { openedAt: 'desc' },
          select: { id: true },
        });
        const activeShift = myActiveShift || (await tx.shift.findFirst({
          where: { closedAt: null },
          orderBy: { openedAt: 'desc' },
          select: { id: true },
        }));
        if (activeShift) {
          resolvedShiftId = activeShift.id;
        } else {
          throw new Error('Tidak dapat memproses pembayaran: Sesi kasir (shift) belum dibuka.');
        }
      }

      const resolvedCustomerId = customerId ? parseInt(customerId) : (order.customerId || null);

      const updatedOrder = await tx.order.update({
        where: { id },
        data: {
          status: 'PAID',
          paidAt: new Date(),
          ...(resolvedShiftId ? { shiftId: resolvedShiftId } : {}),
          ...(tableNo ? { tableNo } : {}),
          ...(customerName ? { customerName } : {}),
          ...(resolvedCustomerId ? { customerId: resolvedCustomerId } : {}),
          ...(type ? { type } : {}),
          ...(updatedTotals ? updatedTotals : {}),
        },
        include: {
          items: {
            where: { status: { not: 'CANCELLED' } },
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
          customer: { select: { id: true, name: true, phone: true, tier: true, points: true } },
        },
      });

      // Update customer loyalty points saat pembayaran lunas
      if (resolvedCustomerId) {
        const finalSpent = parseFloat(updatedTotals?.total || order.total) || 0;
        const pointsEarned = Math.floor(finalSpent / 10000);
        const currentCust = await tx.customer.findUnique({ where: { id: resolvedCustomerId } });
        if (currentCust) {
          const newPoints = currentCust.points + pointsEarned;
          const newSpent = parseFloat(currentCust.totalSpent) + finalSpent;
          const newVisits = currentCust.visitCount + 1;
          let newTier = 'SILVER';
          if (newPoints >= 500) newTier = 'PLATINUM';
          else if (newPoints >= 200) newTier = 'GOLD';

          updatedCustForPayEmit = await tx.customer.update({
            where: { id: resolvedCustomerId },
            data: {
              points: newPoints,
              totalSpent: newSpent,
              visitCount: newVisits,
              tier: newTier,
            },
          });
        }
      }

      // ZERO DOUBLE-DEDUCTION GUARANTEE:
      // Cek apakah pesanan ini sudah pernah dipotong stoknya (saat Hold Bill dibuat / diedit)
      const existingSaleMovement = await tx.stockMovement.findFirst({
        where: {
          note: { contains: `Order #${id}` },
          type: 'SALE',
        },
      });

      // Jika belum pernah dipotong sama sekali (misal legacy order), potong sekali saja
      if (!existingSaleMovement) {
        const activeItems = (order.items || []).filter((i) => i.status !== 'CANCELLED');
        await deltaInventoryService.deductNewOrderStock(
          tx,
          order.id,
          order.invoiceNo,
          activeItems
        );
      }
      // Jika sudah ada pergerakan SALE sebelumnya, STOK TIDAK DIPOTONG LAGI!

      // Audit trail: Catat pelunasan transaksi dan kasir pelaksana secara atomik
      await tx.auditLog.create({
        data: {
          userId: req.user.id,
          action: 'PAY_ORDER',
          detail: {
            orderId: updatedOrder.id,
            invoiceNo: updatedOrder.invoiceNo,
            total: updatedOrder.total,
            paymentMethods: (payments || []).map((p) => p.method),
            shiftId: resolvedShiftId,
          },
        },
      });

      return updatedOrder;
    });

    const canView = canViewCostData(req.user?.role);
    const outputUpdated = formatOrderForResponse(updated, canView);

    try {
      const hasKitchen = (outputUpdated.items || []).some((i) => !(i.station?.type === 'BAR' || isDrinkItemHelper(i)));
      const hasBar = (outputUpdated.items || []).some((i) => i.station?.type === 'BAR' || isDrinkItemHelper(i));
      if (hasKitchen) emitToStation('KITCHEN_MAIN', 'order:updated', outputUpdated);
      if (hasBar) emitToStation('BAR_MAIN', 'order:updated', outputUpdated);
      emitOrderEvent('order:updated', outputUpdated);

      if (updatedCustForPayEmit) {
        emitCustomerEvent('customer:updated', updatedCustForPayEmit);
        emitCustomerEvent('customers:changed', { action: 'ORDER_PAID', customerId: updatedCustForPayEmit.id });
      }
    } catch (e) {
      console.warn('[Socket.IO] Emit order:updated error on payOrder:', e);
    }

    notifyPaidTransaction(outputUpdated).catch(() => { });

    // Role-based Android Push & In-App Notification (ORDER_PAID)
    dispatchNotification({
      event: 'ORDER_PAID',
      category: 'ORDERS',
      title: `💰 Pembayaran Lunas: #${outputUpdated.invoiceNo}`,
      body: `Total Rp${Number(outputUpdated.total).toLocaleString('id-ID')} (${(payments || []).map((p) => p.method).join(', ') || 'Tunai'})`,
      data: {
        orderId: outputUpdated.id,
        invoiceNo: outputUpdated.invoiceNo,
        total: String(outputUpdated.total),
        url: '/orders',
      },
      context: { initiatorId: req.user?.id },
    }).catch(() => { });

    logger.payment.success(`Payment confirmed | orderId=${outputUpdated.invoiceNo} amount=${outputUpdated.total}`, {
      orderId: outputUpdated.invoiceNo,
      amount: outputUpdated.total,
      methods: (payments || []).map((p) => p.method).join(', '),
    });

    // Catat pemakaian voucher promo & audit log jika ada promo
    if (promoCode) {
      consumeVoucher(promoCode).catch((err) => {
        logger.warn(`Failed to consume promo voucher "${promoCode}": ${err.message}`);
      });
    }

    if (promoCode || promoName) {
      prisma.auditLog.create({
        data: {
          userId: req.user.id,
          action: 'ORDER_PROMO_APPLIED',
          detail: {
            orderId: outputUpdated.id,
            invoiceNo: outputUpdated.invoiceNo,
            promoCode: promoCode || null,
            promoName: promoName || null,
            discountAmount: parseFloat(discount) || 0,
          },
        },
      }).catch(() => { });
    }

    return successResponse(res, outputUpdated, 'Pembayaran berhasil dikonfirmasi');
  } catch (err) {
    return errorResponse(res, err.message, err.statusCode || 500);
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
    if (order.status === 'REFUNDED') return errorResponse(res, 'Pesanan sudah di-refund dan tidak dapat dibatalkan (void)', 400);

    // PRD FR-28: Pembatalan pesanan yang sudah dibayar (PAID) memerlukan role MANAGER atau OWNER, atau PIN Otorisasi Supervisor
    if (order.status === 'PAID' && !['MANAGER', 'OWNER'].includes(req.user.role)) {
      const pinSetting = await prisma.setting.findUnique({ where: { key: 'supervisorPin' } });
      const validPin = pinSetting?.value ? String(pinSetting.value).trim() : null;
      if (!validPin) {
        return errorResponse(
          res,
          'Akses ditolak: PIN Supervisor belum dikonfigurasi oleh Owner/Manager',
          403
        );
      }
      if (!managerPin || String(managerPin).trim() !== validPin) {
        return errorResponse(
          res,
          'Akses ditolak: Pembatalan pesanan yang sudah dibayar memerlukan otorisasi Manager atau Owner (PIN salah)',
          403
        );
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      // Re-verify status dalam transaksi untuk mencegah race condition
      const lockedOrder = await tx.order.findUnique({ where: { id } });
      if (!lockedOrder || lockedOrder.status === 'VOIDED' || lockedOrder.status === 'REFUNDED') {
        throw new Error('Pesanan sudah dibatalkan atau di-refund');
      }

      // 1. Kembalikan seluruh stok bahan baku dari item aktif sebelum ditandai CANCELLED
      await deltaInventoryService.restoreOrderStock(tx, order.id, reason);

      // 2. Tandai seluruh item sebagai CANCELLED
      await tx.orderItem.updateMany({
        where: { orderId: id },
        data: { status: 'CANCELLED' },
      });

      // 3. Update status pesanan menjadi VOIDED
      const vOrder = await tx.order.update({
        where: { id },
        data: {
          status: 'VOIDED',
          voidReason: reason,
        },
        include: {
          items: {
            where: { status: { not: 'CANCELLED' } },
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
      emitOrderEvent('order:voided', { orderId: updated.id, invoiceNo: updated.invoiceNo, reason });
    } catch (e) {
      console.warn('[Socket.IO] Emit voidOrder error:', e);
    }

    // Role-based Android Push & In-App Notification (ORDER_VOIDED)
    dispatchNotification({
      event: 'ORDER_VOIDED',
      category: 'ALERTS',
      title: `⚠️ Pesanan Dibatalkan (VOID): #${updated.invoiceNo}`,
      body: `Alasan: "${reason}" oleh ${req.user.name}`,
      data: {
        orderId: updated.id,
        invoiceNo: updated.invoiceNo,
        reason,
        url: '/orders',
      },
      context: { initiatorId: req.user?.id },
    }).catch(() => { });

    logger.order.warn(`Order voided | orderId=${updated.invoiceNo} reason="${reason}"`, {
      orderId: updated.invoiceNo,
      reason,
      total: updated.total,
    });

    return successResponse(res, updated, 'Pesanan berhasil dibatalkan (VOID)');
  } catch (err) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
}

export async function refundOrder(req, res) {
  try {
    const id = parseInt(req.params.id);
    const { reason, refundAmount } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    const order = await prisma.order.findUnique({
      where: { id },
      include: { payments: true },
    });
    if (!order) return errorResponse(res, 'Pesanan tidak ditemukan', 404);
    if (order.status === 'REFUNDED') return errorResponse(res, 'Pesanan sudah di-refund sebelumnya', 400);
    if (order.status === 'VOIDED') return errorResponse(res, 'Pesanan sudah dibatalkan (void) dan tidak dapat di-refund', 400);
    if (order.status !== 'PAID') return errorResponse(res, 'Hanya pesanan yang sudah dibayar (PAID) yang dapat di-refund', 400);

    const amount = refundAmount !== undefined ? Number(refundAmount) : Number(order.total);
    if (isNaN(amount) || amount <= 0 || amount > Number(order.total)) {
      return errorResponse(res, 'Nominal refund tidak valid atau melebihi total tagihan pesanan', 400);
    }

    // Cegah duplikasi pengajuan refund yang masih PENDING ke Owner
    const existingPending = await prisma.approvalRequest.findFirst({
      where: { orderId: order.id, type: 'REFUND', status: 'PENDING' },
    });
    if (existingPending) {
      return errorResponse(
        res,
        'Permintaan refund untuk pesanan ini sudah diajukan dan sedang menunggu persetujuan Owner',
        400
      );
    }

    // 1. Jika pengguna adalah OWNER: proses langsung disetujui seketika
    if (userRole === 'OWNER') {
      const updated = await prisma.$transaction(async (tx) => {
        const lockedOrder = await tx.order.findUnique({ where: { id } });
        if (!lockedOrder || lockedOrder.status !== 'PAID') {
          throw new Error('Pesanan sudah tidak berstatus PAID atau telah di-refund');
        }

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
              decidedDirectlyByOwner: true,
            },
          },
        });

        // 1. Pengembalian stok bahan baku jika pesanan di-REFUND
        await deltaInventoryService.restoreOrderStock(tx, order.id, `Refund: ${reason}`);

        // 2. Tandai item order sebagai CANCELLED
        await tx.orderItem.updateMany({
          where: { orderId: id },
          data: { status: 'CANCELLED' },
        });

        return rOrder;
      });

      try {
        emitToStation('KITCHEN_MAIN', 'order:updated', updated);
        emitToStation('BAR_MAIN', 'order:updated', updated);
        emitOrderEvent('order:updated', updated);
        emitOrderEvent('order:refunded', { orderId: updated.id, invoiceNo: updated.invoiceNo, reason, amount });
      } catch (e) {
        console.warn('[Socket.IO] Emit refundOrder error:', e);
      }

      logger.payment.warn(`Order refunded | orderId=${updated.invoiceNo} amount=${amount} reason="${reason}"`, {
        orderId: updated.invoiceNo,
        amount,
        reason,
      });

      return successResponse(res, updated, 'Pengembalian dana (Refund) berhasil disetujui langsung oleh Owner');
    }

    // 2. Jika CASHIER atau MANAGER: 100% BERHASIL DIAJUKAN KE OWNER TANPA PERLU PIN/OTORISASI!
    const approvalReq = await approvalService.request({
      type: 'REFUND',
      orderId: order.id,
      requesterId: userId,
      reason: reason.trim(),
      payload: {
        refundAmount: amount,
        invoiceNo: order.invoiceNo,
        customerName: order.customerName,
        paymentMethod: order.payments?.[0]?.method || 'TUNAI',
      },
    });

    await prisma.auditLog.create({
      data: {
        userId,
        action: 'REQUEST_REFUND',
        detail: {
          invoiceNo: order.invoiceNo,
          reason,
          refundAmount: amount,
          approvalRequestId: approvalReq.id,
        },
      },
    });

    try {
      emitOrderEvent('approval:requested', {
        type: 'REFUND',
        requestId: approvalReq.id,
        orderId: order.id,
        invoiceNo: order.invoiceNo,
        amount,
        reason,
        requesterName: req.user.name,
      });
    } catch (e) {
      console.warn('[Socket.IO] Emit approval:requested error:', e);
    }

    return successResponse(
      res,
      {
        orderId: order.id,
        invoiceNo: order.invoiceNo,
        approvalRequestId: approvalReq.id,
        status: 'PENDING_OWNER_APPROVAL',
        refundAmount: amount,
        reason,
        pendingApproval: true,
      },
      'Permintaan pengembalian dana (Refund) berhasil diajukan! Menunggu persetujuan Owner.'
    );
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

    // Role-based Android Push & In-App Notification jika status pesanan menjadi READY
    if (status === 'READY') {
      dispatchNotification({
        event: 'ORDER_READY',
        category: 'ORDERS',
        title: `🍽️ Pesanan Siap Saji: #${outputOrder.invoiceNo}`,
        body: `Pesanan ${outputOrder.tableNo ? `Meja ${outputOrder.tableNo}` : 'pelanggan'} sudah siap diantar!`,
        data: {
          orderId: outputOrder.id,
          invoiceNo: outputOrder.invoiceNo,
          url: '/orders',
        },
        context: { cashierId: outputOrder.cashierId },
      }).catch(() => { });
    }

    // Broadcast realtime event ke semua stasiun KDS & monitor POS
    emitToStation('KITCHEN_MAIN', 'order:updated', outputOrder);
    emitToStation('BAR_MAIN', 'order:updated', outputOrder);
    emitOrderEvent('order:updated', outputOrder);

    return successResponse(res, outputOrder, 'Status dapur/bar berhasil diperbarui');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

