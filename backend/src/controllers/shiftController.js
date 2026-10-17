import prisma from '../config/db.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { emitOrderEvent } from '../config/socket.js';
import { shiftService } from '../services/shift.service.js';
import { checkStaffShiftEligibility } from '../services/scheduleGuard.service.js';
import { events } from '../bot/events.js';

/**
 * 1. Ambil daftar register/terminal yang aktif beserta status sesi aktifnya
 */
export async function getRegisters(req, res) {
  try {
    let registers = await prisma.register.findMany({
      where: { isActive: true },
      include: {
        shifts: {
          where: { closedAt: null },
          include: {
            cashier: { select: { id: true, name: true, username: true } },
          },
          take: 1,
        },
      },
      orderBy: { id: 'asc' },
    });

    // Jika belum ada register sama sekali, buatkan default register
    if (registers.length === 0) {
      const defaultReg = await prisma.register.create({
        data: { name: 'Kasir Utama', code: 'REG-01', isActive: true },
      });
      registers = [{ ...defaultReg, shifts: [] }];
    }

    const formatted = registers.map((reg) => {
      const activeShift = reg.shifts?.[0] || null;
      return {
        id: reg.id,
        name: reg.name,
        code: reg.code,
        isActive: reg.isActive,
        hasActiveShift: Boolean(activeShift),
        activeShift: activeShift
          ? {
              id: activeShift.id,
              cashierId: activeShift.cashierId,
              cashierName: activeShift.cashier?.name || 'Kasir',
              openedAt: activeShift.openedAt,
              openingCash: parseFloat(activeShift.openingCash || 0),
            }
          : null,
      };
    });

    return successResponse(res, formatted, 'Daftar register POS berhasil diambil');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

/**
 * 2. Ambil shift aktif untuk register saat ini atau shift aktif pertama yang tersedia
 */
export async function getCurrentShift(req, res) {
  try {
    const registerId = req.query.registerId ? parseInt(req.query.registerId) : null;
    const currentShift = await shiftService.getCurrent(registerId);

    if (!currentShift) {
      return successResponse(res, null, 'Tidak ada sesi kasir aktif saat ini');
    }

    const metrics = shiftService.calculateShiftMetrics(currentShift);

    const formattedShift = {
      id: currentShift.id,
      registerId: currentShift.registerId,
      registerName: currentShift.register?.name || 'Kasir Utama',
      registerCode: currentShift.register?.code || 'REG-01',
      cashierId: currentShift.cashierId,
      cashierName: currentShift.cashier?.name || 'Kasir',
      openedAt: currentShift.openedAt,
      closedAt: currentShift.closedAt,
      openingCash: metrics.openingCash,
      closingCash: currentShift.closingCash ? parseFloat(currentShift.closingCash) : null,
      expectedCash: metrics.expectedCash,
      totalCashSales: metrics.cashSales,
      totalNonCashSales: metrics.nonCashSales,
      totalSales: metrics.totalSales,
      totalCashIn: metrics.cashIn,
      totalCashOut: metrics.cashOut,
      totalCashDrop: metrics.cashDrop,
      totalCashRefund: metrics.cashRefunds,
      paymentMethodsSummary: metrics.paymentMethods,
      cashMovements: (currentShift.cashMovements || []).map((m) => ({
        id: m.id,
        type: m.type,
        amount: parseFloat(m.amount || 0),
        reason: m.reason,
        userId: m.userId,
        userName: m.user?.name || 'Kasir',
        createdAt: m.createdAt,
      })),
      cashiers: metrics.cashiers,
      ordersCount: currentShift.orders.length,
      isClosed: false,
    };

    return successResponse(res, formattedShift, 'Sesi kasir aktif ditemukan');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

/**
 * 3. Buka shift kasir baru pada register
 */
export async function openShift(req, res) {
  try {
    const cashierId = req.user.id;
    const { openingCash, registerId } = req.body;

    // Validasi kelayakan staf: Jadwal kerja (jika aktif) & Wajib presensi sebelum buka kasir
    const eligibility = await checkStaffShiftEligibility(cashierId, req.user.role);
    if (!eligibility.eligible) {
      return errorResponse(res, eligibility.message, 403);
    }

    const parsedOpeningCash = parseFloat(openingCash) || 0;
    const shift = await shiftService.open(cashierId, parsedOpeningCash, registerId);

    const formatted = {
      id: shift.id,
      registerId: shift.registerId,
      registerName: shift.register?.name || 'Kasir Utama',
      registerCode: shift.register?.code || 'REG-01',
      cashierId: shift.cashierId,
      cashierName: shift.cashier?.name || req.user.name,
      openedAt: shift.openedAt,
      closedAt: null,
      openingCash: parsedOpeningCash,
      closingCash: null,
      expectedCash: parsedOpeningCash,
      totalCashSales: 0,
      totalNonCashSales: 0,
      totalSales: 0,
      totalCashIn: 0,
      totalCashOut: 0,
      totalCashDrop: 0,
      totalCashRefund: 0,
      cashMovements: [],
      ordersCount: 0,
      isClosed: false,
    };

    try {
      emitOrderEvent('shift:opened', formatted);
      events.emit('shift.opened', {
        shift,
        cashier: { id: cashierId, name: formatted.cashierName },
        openingCash: parsedOpeningCash,
        register: { id: formatted.registerId, name: formatted.registerName, code: formatted.registerCode },
      });
    } catch (e) {
      console.warn('[Events] Emit shift:opened notice:', e);
    }

    return successResponse(res, formatted, 'Sesi kasir berhasil dibuka di database', 201);
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
}

/**
 * 4. Tutup shift kasir dan rekonsiliasi kas fisik
 */
export async function closeShift(req, res) {
  try {
    const userId = req.user.id;
    const { closingCash, notes, shiftId } = req.body;

    const eligibility = await checkStaffShiftEligibility(userId, req.user.role);
    if (!eligibility.eligible) {
      return errorResponse(res, eligibility.message, 403);
    }

    const result = await shiftService.close(userId, closingCash, notes, shiftId);

    const formattedResult = {
      id: result.shift.id,
      registerId: result.shift.registerId,
      registerName: result.shift.register?.name || 'Kasir Utama',
      cashierId: result.shift.cashierId,
      cashierName: result.shift.cashier?.name,
      closedByUserId: result.shift.closedByUserId,
      closedByName: result.shift.closedByUser?.name || req.user.name,
      openedAt: result.shift.openedAt,
      closedAt: result.shift.closedAt,
      openingCash: result.openingCash,
      closingCash: result.closingCash,
      expectedCash: result.expectedCash,
      difference: result.difference,
      totalCashSales: result.cashSales,
      totalNonCashSales: result.nonCashSales,
      totalSales: result.totalSales,
      totalCashIn: result.cashIn,
      totalCashOut: result.cashOut,
      totalCashDrop: result.cashDrop,
      totalCashRefund: result.cashRefunds,
      paymentMethodsSummary: result.paymentMethods,
      cashiers: result.cashiers,
      notes: result.notes || null,
      isClosed: true,
    };

    try {
      emitOrderEvent('shift:closed', formattedResult);
      events.emit('shift.closed', {
        cashier: result.shift.cashier || req.user,
        summary: {
          ...formattedResult,
          diff: formattedResult.difference,
        },
      });
    } catch (e) {
      console.warn('[Events] Emit shift:closed notice:', e);
    }

    return successResponse(res, formattedResult, 'Sesi kasir berhasil ditutup dan direkonsiliasi');
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
}

/**
 * 5. Catat arus kas masuk / keluar / drop pada sesi kasir aktif
 */
export async function createCashMovement(req, res) {
  try {
    const userId = req.user.id;
    const { type, amount, reason, shiftId } = req.body;

    const eligibility = await checkStaffShiftEligibility(userId, req.user.role);
    if (!eligibility.eligible) {
      return errorResponse(res, eligibility.message, 403);
    }

    const targetShiftId = req.params.id ? parseInt(req.params.id) : shiftId;

    const movement = await shiftService.addMovement(userId, {
      type,
      amount,
      reason,
      shiftId: targetShiftId,
    });

    const formatted = {
      id: movement.id,
      shiftId: movement.shiftId,
      userId: movement.userId,
      userName: movement.user?.name || req.user.name,
      type: movement.type,
      amount: parseFloat(movement.amount || 0),
      reason: movement.reason,
      createdAt: movement.createdAt,
    };

    try {
      emitOrderEvent('shift:movement_added', formatted);
    } catch (e) {
      console.warn('[Socket.IO] Emit shift:movement_added notice:', e);
    }

    return successResponse(res, formatted, 'Arus kas berhasil dicatat di database', 201);
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
}

/**
 * 6. Ambil riwayat arus kas pada shift tertentu
 */
export async function getCashMovements(req, res) {
  try {
    const shiftId = parseInt(req.params.id);
    const movements = await prisma.cashMovement.findMany({
      where: { shiftId },
      include: {
        user: { select: { id: true, name: true, username: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const formatted = movements.map((m) => ({
      id: m.id,
      shiftId: m.shiftId,
      userId: m.userId,
      userName: m.user?.name || 'Kasir',
      type: m.type,
      amount: parseFloat(m.amount || 0),
      reason: m.reason,
      createdAt: m.createdAt,
    }));

    return successResponse(res, formatted, 'Daftar arus kas berhasil diambil');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

/**
 * 7. Ambil riwayat sesi kasir (Shift History) dengan filter
 */
export async function getShiftHistory(req, res) {
  try {
    const isManagerOrOwner = ['MANAGER', 'OWNER'].includes(req.user?.role);
    if (!isManagerOrOwner) {
      return errorResponse(res, 'Akses ditolak: Kasir dilarang melihat riwayat sesi kasir', 403);
    }

    const { limit = 50, page = 1, registerId, cashierId, startDate, endDate, search } = req.query;
    const take = parseInt(limit);
    const skip = (parseInt(page) - 1) * take;

    const where = {
      closedAt: { not: null },
      ...(registerId ? { registerId: parseInt(registerId) } : {}),
      ...(cashierId ? { cashierId: parseInt(cashierId) } : {}),
    };

    if (search) {
      where.cashier = {
        name: { contains: search },
      };
    }

    if (startDate || endDate) {
      where.closedAt = { not: null };
      if (startDate) where.closedAt.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.closedAt.lte = end;
      }
    }

    const [shifts, total] = await Promise.all([
      prisma.shift.findMany({
        where,
        include: {
          register: true,
          cashier: { select: { id: true, name: true, username: true } },
          closedByUser: { select: { id: true, name: true, username: true } },
          cashMovements: true,
          orders: {
            include: { payments: true },
          },
        },
        orderBy: { closedAt: 'desc' },
        skip,
        take,
      }),
      prisma.shift.count({ where }),
    ]);

    const formatted = shifts.map((s) => {
      const metrics = shiftService.calculateShiftMetrics(s);
      const closingCash = s.closingCash ? parseFloat(s.closingCash) : 0;
      const difference = closingCash - metrics.expectedCash;

      const durationMs = s.closedAt ? Math.max(0, new Date(s.closedAt).getTime() - new Date(s.openedAt).getTime()) : 0;
      const durationMinutes = Math.floor(durationMs / 60000);
      const hours = Math.floor(durationMinutes / 60);
      const mins = durationMinutes % 60;
      const workDurationFormatted = `${hours}j ${mins}m`;

      return {
        id: s.id,
        registerId: s.registerId,
        registerName: s.register?.name || 'Kasir Utama',
        registerCode: s.register?.code || 'REG-01',
        cashierId: s.cashierId,
        cashierName: s.cashier?.name || 'Kasir',
        closedByUserId: s.closedByUserId,
        closedByName: s.closedByUser?.name || s.cashier?.name,
        openedAt: s.openedAt,
        closedAt: s.closedAt,
        workDurationMinutes: durationMinutes,
        workDurationFormatted,
        openingCash: metrics.openingCash,
        closingCash,
        expectedCash: metrics.expectedCash,
        difference,
        notes: s.notes || null,
        totalCashSales: metrics.cashSales,
        totalNonCashSales: metrics.nonCashSales,
        totalSales: metrics.totalSales,
        totalCashIn: metrics.cashIn,
        totalCashOut: metrics.cashOut,
        totalCashDrop: metrics.cashDrop,
        totalCashRefund: metrics.cashRefunds,
        ordersCount: s.orders.length,
        isClosed: true,
      };
    });

    return successResponse(res, formatted, 'Daftar riwayat shift berhasil diambil', 200, {
      page: parseInt(page),
      limit: take,
      total,
    });
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

/**
 * 8. Ambil detail sesi shift lengkap untuk audit & laporan penutupan (Z-Report)
 */
export async function getShiftDetail(req, res) {
  try {
    const id = parseInt(req.params.id);
    const isManagerOrOwner = ['MANAGER', 'OWNER'].includes(req.user?.role);

    const shift = await prisma.shift.findUnique({
      where: { id },
      include: {
        register: true,
        cashier: { select: { id: true, name: true, username: true, role: true } },
        closedByUser: { select: { id: true, name: true, username: true, role: true } },
        cashMovements: {
          include: { user: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'desc' },
        },
        orders: {
          include: {
            cashier: { select: { id: true, name: true } },
            payments: true,
            items: {
              select: {
                id: true,
                productName: true,
                variantName: true,
                qty: true,
                lineTotal: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!shift) {
      return errorResponse(res, 'Sesi shift tidak ditemukan', 404);
    }

    if (!isManagerOrOwner && shift.cashierId !== req.user.id && shift.closedByUserId !== req.user.id) {
      return errorResponse(res, 'Anda tidak memiliki akses untuk melihat sesi kasir ini', 403);
    }

    const metrics = shiftService.calculateShiftMetrics(shift);
    const closingCash = shift.closingCash ? parseFloat(shift.closingCash) : null;
    const difference = closingCash !== null ? closingCash - metrics.expectedCash : null;

    const durationMs = shift.closedAt ? Math.max(0, new Date(shift.closedAt).getTime() - new Date(shift.openedAt).getTime()) : 0;
    const durationMinutes = Math.floor(durationMs / 60000);
    const hours = Math.floor(durationMinutes / 60);
    const mins = durationMinutes % 60;
    const workDurationFormatted = `${hours}j ${mins}m`;

    const formatted = {
      id: shift.id,
      registerId: shift.registerId,
      registerName: shift.register?.name || 'Kasir Utama',
      registerCode: shift.register?.code || 'REG-01',
      cashierId: shift.cashierId,
      cashierName: shift.cashier?.name || 'Kasir',
      cashierUsername: shift.cashier?.username,
      closedByUserId: shift.closedByUserId,
      closedByName: shift.closedByUser?.name,
      openedAt: shift.openedAt,
      closedAt: shift.closedAt,
      workDurationMinutes: durationMinutes,
      workDurationFormatted,
      openingCash: metrics.openingCash,
      closingCash,
      expectedCash: metrics.expectedCash,
      difference,
      notes: shift.notes || null,
      totalCashSales: metrics.cashSales,
      totalNonCashSales: metrics.nonCashSales,
      totalSales: metrics.totalSales,
      totalCashIn: metrics.cashIn,
      totalCashOut: metrics.cashOut,
      totalCashDrop: metrics.cashDrop,
      totalCashRefund: metrics.cashRefunds,
      paymentMethodsSummary: metrics.paymentMethods,
      cashiers: metrics.cashiers,
      cashMovements: (shift.cashMovements || []).map((m) => ({
        id: m.id,
        type: m.type,
        amount: parseFloat(m.amount || 0),
        reason: m.reason,
        userId: m.userId,
        userName: m.user?.name || 'Kasir',
        createdAt: m.createdAt,
      })),
      ordersCount: shift.orders.length,
      isClosed: Boolean(shift.closedAt),
      orders: shift.orders.map((o) => ({
        id: o.id,
        invoiceNo: o.invoiceNo,
        customerName: o.customerName || 'Tamu',
        tableNo: o.tableNo || '-',
        type: o.type,
        status: o.status,
        cashierId: o.cashierId,
        cashierName: o.cashier?.name || 'Kasir',
        total: parseFloat(o.total || 0),
        createdAt: o.createdAt,
        itemsCount: o.items.length,
        payments: o.payments,
      })),
    };

    return successResponse(res, formatted, 'Detail sesi shift berhasil diambil');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}
