import prisma from '../config/db.js';
import { successResponse, errorResponse } from '../utils/response.js';

export async function getCurrentShift(req, res) {
  try {
    const cashierId = req.user.id;
    const isPrivileged = req.user.role === 'OWNER' || req.user.role === 'MANAGER';

    // 1. Prioritaskan shift aktif milik user yang sedang login
    let currentShift = await prisma.shift.findFirst({
      where: {
        cashierId,
        closedAt: null,
      },
      include: {
        cashier: { select: { id: true, name: true, username: true, role: true } },
        orders: {
          include: { payments: true },
        },
      },
    });

    // 2. Jika user adalah Owner/Manager dan belum membuka shift sendiri, tampilkan shift aktif outlet yang sedang berjalan
    if (!currentShift && isPrivileged) {
      currentShift = await prisma.shift.findFirst({
        where: {
          closedAt: null,
        },
        include: {
          cashier: { select: { id: true, name: true, username: true, role: true } },
          orders: {
            include: { payments: true },
          },
        },
        orderBy: { openedAt: 'desc' },
      });
    }

    if (!currentShift) {
      return successResponse(res, null, 'Tidak ada shift aktif saat ini');
    }

    // Hitung total penjualan tunai & non-tunai dari pesanan berstatus PAID
    let cashSales = 0;
    let nonCashSales = 0;

    for (const order of currentShift.orders) {
      if (order.status === 'PAID') {
        for (const payment of order.payments) {
          const amount = parseFloat(payment.amount || 0);
          if (payment.method === 'CASH') {
            cashSales += amount;
          } else {
            nonCashSales += amount;
          }
        }
      }
    }

    const openingCash = parseFloat(currentShift.openingCash || 0);
    const expectedCash = openingCash + cashSales;

    const formattedShift = {
      id: currentShift.id,
      cashierId: currentShift.cashierId,
      cashierName: currentShift.cashier?.name || 'Kasir',
      openedAt: currentShift.openedAt,
      closedAt: currentShift.closedAt,
      openingCash,
      closingCash: currentShift.closingCash ? parseFloat(currentShift.closingCash) : null,
      expectedCash,
      totalCashSales: cashSales,
      totalNonCashSales: nonCashSales,
      totalSales: cashSales + nonCashSales,
      ordersCount: currentShift.orders.length,
      isClosed: false,
    };

    return successResponse(res, formattedShift, 'Shift aktif ditemukan');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

export async function openShift(req, res) {
  try {
    const cashierId = req.user.id;
    const { openingCash } = req.body;

    const parsedOpeningCash = parseFloat(openingCash) || 0;

    // Periksa apakah user atau outlet sudah memiliki shift aktif yang belum ditutup
    const existingActive = await prisma.shift.findFirst({
      where: {
        cashierId,
        closedAt: null,
      },
      include: {
        cashier: { select: { id: true, name: true, username: true } },
      },
    });

    if (existingActive) {
      return errorResponse(res, 'Anda masih memiliki shift yang sedang aktif. Silakan tutup shift terlebih dahulu.', 400);
    }

    const shift = await prisma.shift.create({
      data: {
        cashierId,
        openingCash: parsedOpeningCash,
      },
      include: {
        cashier: { select: { id: true, name: true, username: true } },
      },
    });

    const formatted = {
      id: shift.id,
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
      ordersCount: 0,
      isClosed: false,
    };

    return successResponse(res, formatted, 'Shift berhasil dibuka di database', 201);
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

export async function closeShift(req, res) {
  try {
    const cashierId = req.user.id;
    const isPrivileged = req.user.role === 'OWNER' || req.user.role === 'MANAGER';
    const { closingCash, notes } = req.body;

    // Cari shift aktif kasir yang bersangkutan
    let activeShift = await prisma.shift.findFirst({
      where: {
        cashierId,
        closedAt: null,
      },
      include: {
        cashier: { select: { id: true, name: true, username: true } },
        orders: {
          include: { payments: true },
        },
      },
    });

    // Fallback: Jika Owner/Manager menutup shift aktif outlet
    if (!activeShift && isPrivileged) {
      activeShift = await prisma.shift.findFirst({
        where: { closedAt: null },
        include: {
          cashier: { select: { id: true, name: true, username: true } },
          orders: {
            include: { payments: true },
          },
        },
        orderBy: { openedAt: 'desc' },
      });
    }

    if (!activeShift) {
      return errorResponse(res, 'Tidak ada shift aktif yang ditemukan untuk ditutup', 404);
    }

    // PRD Section 11: Validasi tidak boleh menutup shift jika masih ada open bills
    const openOrdersCount = await prisma.order.count({
      where: {
        shiftId: activeShift.id,
        status: { in: ['OPEN', 'PENDING_PAYMENT'] },
      },
    });

    if (openOrdersCount > 0) {
      return errorResponse(
        res,
        `Tidak dapat menutup shift: Masih ada ${openOrdersCount} pesanan berstatus OPEN / belum dibayar. Selesaikan pembayaran atau batalkan pesanan terlebih dahulu.`,
        400
      );
    }

    // Hitung total penjualan tunai & non-tunai
    let cashSales = 0;
    let nonCashSales = 0;

    for (const order of activeShift.orders) {
      if (order.status === 'PAID') {
        for (const payment of order.payments) {
          const amount = parseFloat(payment.amount || 0);
          if (payment.method === 'CASH') {
            cashSales += amount;
          } else {
            nonCashSales += amount;
          }
        }
      }
    }

    const openingCash = parseFloat(activeShift.openingCash || 0);
    const expectedCash = openingCash + cashSales;
    const actualCash = parseFloat(closingCash) || 0;
    const difference = actualCash - expectedCash;

    const completed = await prisma.shift.update({
      where: { id: activeShift.id },
      data: {
        closingCash: actualCash,
        expectedCash,
        closedAt: new Date(),
      },
      include: {
        cashier: { select: { id: true, name: true, username: true } },
      },
    });

    const result = {
      id: completed.id,
      cashierId: completed.cashierId,
      cashierName: completed.cashier?.name,
      openedAt: completed.openedAt,
      closedAt: completed.closedAt,
      openingCash,
      closingCash: actualCash,
      expectedCash,
      difference,
      totalCashSales: cashSales,
      totalNonCashSales: nonCashSales,
      totalSales: cashSales + nonCashSales,
      ordersCount: activeShift.orders.length,
      notes: notes || null,
      isClosed: true,
    };

    return successResponse(res, result, 'Shift berhasil ditutup dan disinkronkan ke database');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

export async function getShiftHistory(req, res) {
  try {
    const { limit = 30, page = 1 } = req.query;
    const take = parseInt(limit);
    const skip = (parseInt(page) - 1) * take;

    const [shifts, total] = await Promise.all([
      prisma.shift.findMany({
        where: { closedAt: { not: null } },
        include: {
          cashier: { select: { id: true, name: true, username: true } },
          orders: {
            include: { payments: true },
          },
        },
        orderBy: { closedAt: 'desc' },
        skip,
        take,
      }),
      prisma.shift.count({ where: { closedAt: { not: null } } }),
    ]);

    const formatted = shifts.map((s) => {
      let cashSales = 0;
      let nonCashSales = 0;

      for (const order of s.orders) {
        if (order.status === 'PAID') {
          for (const payment of order.payments) {
            const amount = parseFloat(payment.amount || 0);
            if (payment.method === 'CASH') {
              cashSales += amount;
            } else {
              nonCashSales += amount;
            }
          }
        }
      }

      const openingCash = parseFloat(s.openingCash || 0);
      const closingCash = s.closingCash ? parseFloat(s.closingCash) : 0;
      const expectedCash = s.expectedCash ? parseFloat(s.expectedCash) : openingCash + cashSales;
      const difference = closingCash - expectedCash;

      return {
        id: s.id,
        cashierId: s.cashierId,
        cashierName: s.cashier?.name || 'Kasir',
        openedAt: s.openedAt,
        closedAt: s.closedAt,
        openingCash,
        closingCash,
        expectedCash,
        difference,
        totalCashSales: cashSales,
        totalNonCashSales: nonCashSales,
        totalSales: cashSales + nonCashSales,
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
