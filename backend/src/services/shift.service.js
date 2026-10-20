import prisma from '../config/db.js';
import { checkStaffShiftEligibility } from './scheduleGuard.service.js';

export const shiftService = {
  /**
   * Ambil shift aktif untuk register tertentu, atau shift aktif milik kasir, atau shift aktif pertama yang tersedia
   */
  async getCurrent(registerId = null, cashierId = null) {
    const shiftInclude = {
      register: true,
      cashier: { select: { id: true, name: true, username: true, role: true } },
      closedByUser: { select: { id: true, name: true, username: true, role: true } },
      cashMovements: {
        include: { user: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
      },
      orders: {
        include: {
          payments: true,
          cashier: { select: { id: true, name: true, username: true } },
        },
      },
    };

    if (registerId) {
      return prisma.shift.findFirst({
        where: { registerId: parseInt(registerId), closedAt: null },
        orderBy: { openedAt: 'desc' },
        include: shiftInclude,
      });
    }

    if (cashierId) {
      const cashierShift = await prisma.shift.findFirst({
        where: { cashierId: parseInt(cashierId), closedAt: null },
        orderBy: { openedAt: 'desc' },
        include: shiftInclude,
      });
      if (cashierShift) return cashierShift;
    }

    return prisma.shift.findFirst({
      where: { closedAt: null },
      orderBy: { openedAt: 'desc' },
      include: shiftInclude,
    });
  },

  /**
   * Hitung cash flow dan expected cash dari database secara akurat
   */
  calculateShiftMetrics(shift) {
    let cashSales = 0;
    let nonCashSales = 0;
    let cashRefunds = 0;
    const paymentMethods = { CASH: 0, CARD: 0, QRIS: 0, TRANSFER: 0, OTHER: 0 };
    const cashierSalesMap = {};

    for (const order of shift.orders || []) {
      const orderCashierId = order.cashierId;
      const orderCashierName = order.cashier?.name || 'Kasir';

      if (!cashierSalesMap[orderCashierId]) {
        cashierSalesMap[orderCashierId] = {
          id: orderCashierId,
          name: orderCashierName,
          ordersCount: 0,
          cashSales: 0,
          totalSales: 0,
        };
      }

      const isPaidOrder =
        order.status === 'PAID' ||
        (order.paidAt && order.status !== 'VOIDED' && order.status !== 'REFUNDED') ||
        ['PREPARING', 'IN_PROGRESS', 'PARTIALLY_READY', 'READY', 'SERVED', 'COMPLETED'].includes(order.status);

      if (isPaidOrder) {
        cashierSalesMap[orderCashierId].ordersCount += 1;
        const paymentsList =
          order.payments && order.payments.length > 0
            ? order.payments
            : order.paymentMethod
            ? [{ method: order.paymentMethod, amount: parseFloat(order.total || 0) }]
            : [];

        for (const payment of paymentsList) {
          const amount = parseFloat(payment.amount || 0);
          const methodUpper = String(payment.method || '').toUpperCase();
          if (methodUpper === 'CASH') {
            cashSales += amount;
            paymentMethods.CASH = (paymentMethods.CASH || 0) + amount;
            cashierSalesMap[orderCashierId].cashSales += amount;
            cashierSalesMap[orderCashierId].totalSales += amount;
          } else {
            nonCashSales += amount;
            if (['CARD', 'DEBIT', 'CREDIT', 'EDC'].includes(methodUpper)) {
              paymentMethods.CARD = (paymentMethods.CARD || 0) + amount;
            } else if (methodUpper.includes('QRIS') || methodUpper.includes('QR')) {
              paymentMethods.QRIS = (paymentMethods.QRIS || 0) + amount;
            } else if (methodUpper.includes('TRANSFER')) {
              paymentMethods.TRANSFER = (paymentMethods.TRANSFER || 0) + amount;
            } else {
              paymentMethods.OTHER = (paymentMethods.OTHER || 0) + amount;
            }
            cashierSalesMap[orderCashierId].totalSales += amount;
          }
        }
      } else if (order.status === 'REFUNDED') {
        for (const payment of order.payments || []) {
          const amount = parseFloat(payment.amount || 0);
          if (payment.method === 'CASH') {
            cashRefunds += amount;
          }
        }
      }
    }

    let cashIn = 0;
    let cashOut = 0;
    let cashDrop = 0;

    for (const mov of shift.cashMovements || []) {
      const amount = parseFloat(mov.amount || 0);
      if (mov.type === 'CASH_IN') cashIn += amount;
      else if (mov.type === 'CASH_OUT') cashOut += amount;
      else if (mov.type === 'CASH_DROP') cashDrop += amount;
    }

    const openingCash = parseFloat(shift.openingCash || 0);
    const expectedCash = openingCash + cashSales + cashIn - cashOut - cashDrop - cashRefunds;

    return {
      openingCash,
      cashSales,
      nonCashSales,
      totalSales: cashSales + nonCashSales,
      cashIn,
      cashOut,
      cashDrop,
      cashRefunds,
      expectedCash,
      paymentMethods,
      cashiers: Object.values(cashierSalesMap),
    };
  },

  /**
   * Buka shift kasir baru dengan locking transaksi untuk mencegah double open
   */
  async open(userId, openingCash, registerId = null) {
    return prisma.$transaction(async (tx) => {
      let resolvedRegisterId = registerId ? parseInt(registerId) : 1;
      let register = await tx.register.findUnique({ where: { id: resolvedRegisterId } });
      if (!register) {
        register = await tx.register.findFirst();
        if (!register) {
          register = await tx.register.create({
            data: { name: 'Kasir Utama', code: 'REG-01', isActive: true },
          });
        }
        resolvedRegisterId = register.id;
      }

      // Pastikan belum ada shift aktif pada register ini
      const active = await tx.shift.findFirst({
        where: { registerId: resolvedRegisterId, closedAt: null },
      });

      if (active) {
        throw new Error('Register ini sudah memiliki sesi kasir yang sedang aktif. Silakan tutup sesi terlebih dahulu.');
      }

      // Pastikan jadwal kerja staf sudah diatur dan staf sudah presensi (Kecuali OWNER)
      const user = await tx.user.findUnique({
        where: { id: parseInt(userId) },
        select: { id: true, role: true },
      });
      if (user && user.role !== 'OWNER') {
        const eligibility = await checkStaffShiftEligibility(user.id, user.role);
        if (!eligibility.eligible) {
          throw new Error(eligibility.message);
        }
      }

      const newShift = await tx.shift.create({
        data: {
          registerId: resolvedRegisterId,
          cashierId: userId,
          openingCash: parseFloat(openingCash) || 0,
        },
        include: {
          register: true,
          cashier: { select: { id: true, name: true, username: true, role: true } },
        },
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          userId,
          action: 'SHIFT_OPEN',
          detail: {
            shiftId: newShift.id,
            registerId: resolvedRegisterId,
            openingCash: parseFloat(openingCash) || 0,
          },
        },
      });

      return newShift;
    });
  },

  /**
   * Tutup shift kasir dan rekap selisih kas secara atomik
   */
  async close(userId, actualCash, notes = null, shiftId = null, userRole = null) {
    return prisma.$transaction(async (tx) => {
      let shift = null;
      if (shiftId) {
        shift = await tx.shift.findUnique({
          where: { id: parseInt(shiftId) },
          include: {
            register: true,
            cashier: { select: { id: true, name: true, username: true } },
            cashMovements: {
              include: { user: { select: { id: true, name: true } } },
            },
            orders: {
              include: {
                payments: true,
                cashier: { select: { id: true, name: true } },
              },
            },
          },
        });
      } else {
        // Prioritaskan shift aktif milik kasir yang sedang login
        shift = await tx.shift.findFirst({
          where: { cashierId: userId, closedAt: null },
          orderBy: { openedAt: 'desc' },
          include: {
            register: true,
            cashier: { select: { id: true, name: true, username: true } },
            cashMovements: {
              include: { user: { select: { id: true, name: true } } },
            },
            orders: {
              include: {
                payments: true,
                cashier: { select: { id: true, name: true } },
              },
            },
          },
        });
      }

      if (!shift || shift.closedAt !== null) {
        throw new Error('Tidak ada shift aktif yang ditemukan untuk ditutup.');
      }

      // Verifikasi otorisasi: Kasir tidak boleh menutup sesi kasir lain tanpa hak
      const isOwnShift = shift.cashierId === userId;
      const isSupervisor = ['OWNER', 'MANAGER'].includes(userRole);

      if (!isOwnShift && !isSupervisor) {
        const err = new Error('Anda tidak memiliki izin untuk menutup sesi kasir milik karyawan lain.');
        err.statusCode = 403;
        throw err;
      }

      // Validasi tidak boleh menutup shift jika masih ada open bills
      const openOrdersCount = await tx.order.count({
        where: {
          shiftId: shift.id,
          status: { in: ['OPEN', 'PENDING_PAYMENT'] },
        },
      });

      if (openOrdersCount > 0) {
        throw new Error(
          `Tidak dapat menutup shift: Masih ada ${openOrdersCount} pesanan berstatus OPEN / belum dibayar. Selesaikan pembayaran atau batalkan pesanan terlebih dahulu.`
        );
      }

      const metrics = this.calculateShiftMetrics(shift);
      const countedCash = parseFloat(actualCash) || 0;
      const difference = countedCash - metrics.expectedCash;

      // Cegah race condition: updateMany atomik memastikan hanya 1 penutupan berhasil
      const updateResult = await tx.shift.updateMany({
        where: {
          id: shift.id,
          closedAt: null,
        },
        data: {
          closedAt: new Date(),
          closedByUserId: userId,
          closingCash: countedCash,
          expectedCash: metrics.expectedCash,
          notes: notes || null,
        },
      });

      if (updateResult.count === 0) {
        throw new Error('Sesi kasir ini sudah ditutup sebelumnya atau tidak lagi aktif.');
      }

      const closed = await tx.shift.findUnique({
        where: { id: shift.id },
        include: {
          register: true,
          cashier: { select: { id: true, name: true, username: true } },
          closedByUser: { select: { id: true, name: true, username: true } },
        },
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          userId,
          action: isOwnShift ? 'SHIFT_CLOSE' : 'SHIFT_CLOSE_BY_SUPERVISOR',
          detail: {
            shiftId: closed.id,
            registerId: closed.registerId,
            cashierId: shift.cashierId,
            closedByUserId: userId,
            isOwnShift,
            closedBySupervisor: !isOwnShift,
            openingCash: metrics.openingCash,
            closingCash: countedCash,
            expectedCash: metrics.expectedCash,
            difference,
            notes: notes || null,
          },
        },
      });

      return {
        shift: closed,
        ...metrics,
        closingCash: countedCash,
        difference,
        notes,
      };
    });
  },

  /**
   * Catat arus kas (CASH_IN, CASH_OUT, CASH_DROP) ke database
   */
  async addMovement(userId, { type, amount, reason, shiftId = null, userRole = null }) {
    return prisma.$transaction(async (tx) => {
      let targetShiftId = shiftId ? parseInt(shiftId) : null;
      if (!targetShiftId) {
        // Prioritaskan shift aktif milik kasir yang bersangkutan terlebih dahulu
        let active = await tx.shift.findFirst({
          where: { cashierId: userId, closedAt: null },
          orderBy: { openedAt: 'desc' },
          select: { id: true, cashierId: true },
        });
        if (!active) {
          active = await tx.shift.findFirst({
            where: { closedAt: null },
            orderBy: { openedAt: 'desc' },
            select: { id: true, cashierId: true },
          });
        }
        if (!active) {
          throw new Error('Tidak ada shift aktif untuk mencatat arus kas.');
        }
        targetShiftId = active.id;
      }

      const shift = await tx.shift.findUnique({
        where: { id: targetShiftId },
        select: { id: true, closedAt: true, cashierId: true },
      });

      if (!shift || shift.closedAt !== null) {
        throw new Error('Sesi kasir sudah ditutup. Tidak dapat mencatat arus kas pada sesi ini.');
      }

      // Pastikan kasir tidak mencatat arus kas ke shift kasir lain kecuali MANAGER atau OWNER
      const isManagerOrOwner = ['MANAGER', 'OWNER'].includes(userRole);
      if (userRole && !isManagerOrOwner && shift.cashierId !== userId) {
        const error = new Error('Akses ditolak: Anda hanya dapat mencatat arus kas pada sesi kasir Anda sendiri.');
        error.statusCode = 403;
        throw error;
      }

      const parsedAmount = Math.max(0, parseFloat(amount) || 0);
      if (parsedAmount <= 0) {
        throw new Error('Nominal arus kas harus lebih dari Rp 0.');
      }

      // Validasi proteksi setor brankas (CASH_DROP) agar tidak melebihi uang kas fisik di laci
      if (type === 'CASH_DROP') {
        const fullShift = await tx.shift.findUnique({
          where: { id: targetShiftId },
          include: {
            cashMovements: true,
            orders: {
              include: { payments: true },
            },
          },
        });
        if (fullShift) {
          const metrics = shiftService.calculateShiftMetrics(fullShift);
          if (parsedAmount > metrics.expectedCash) {
            const formattedExpected = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(metrics.expectedCash);
            const formattedDrop = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(parsedAmount);
            throw new Error(`Setor brankas (${formattedDrop}) tidak boleh melebihi saldo kas fisik yang ada di laci (${formattedExpected}).`);
          }
        }
      }

      const movement = await tx.cashMovement.create({
        data: {
          shiftId: targetShiftId,
          userId,
          type,
          amount: parsedAmount,
          reason: reason.trim(),
        },
        include: {
          user: { select: { id: true, name: true, username: true } },
        },
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          userId,
          action: 'CASH_MOVEMENT',
          detail: {
            shiftId: targetShiftId,
            movementId: movement.id,
            type,
            amount: parsedAmount,
            reason: reason.trim(),
          },
        },
      });

      return movement;
    });
  },
};
