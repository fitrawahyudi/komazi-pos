import prisma from '../config/db.js';

export const shiftService = {
  async getCurrent(userId) {
    return prisma.shift.findFirst({
      where: {
        cashierId: userId,
        closedAt: null,
      },
      include: {
        orders: {
          include: { payments: true },
        },
      },
    });
  },

  async open(userId, openingCash) {
    const existing = await this.getCurrent(userId);
    if (existing) {
      throw new Error('Anda masih memiliki shift yang sedang aktif');
    }

    return prisma.shift.create({
      data: {
        cashierId: userId,
        openingCash,
      },
      include: {
        cashier: { select: { id: true, name: true, username: true, role: true } },
      },
    });
  },

  async close(userId, actualCash, notes = null) {
    const shift = await this.getCurrent(userId);
    if (!shift) {
      throw new Error('Tidak ada shift aktif yang ditemukan');
    }

    // Periksa apakah masih ada open bills di shift ini
    const openOrdersCount = await prisma.order.count({
      where: {
        shiftId: shift.id,
        status: { in: ['OPEN', 'PENDING_PAYMENT'] },
      },
    });

    if (openOrdersCount > 0) {
      throw new Error(`Masih ada ${openOrdersCount} pesanan berstatus Open Bill. Selesaikan atau void sebelum tutup shift.`);
    }

    // Hitung total penjualan tunai & non-tunai
    let cashSales = 0;
    let nonCashSales = 0;

    for (const order of shift.orders) {
      if (order.status === 'PAID') {
        for (const payment of order.payments) {
          const amount = parseFloat(payment.amount);
          if (payment.method === 'CASH') {
            cashSales += amount;
          } else {
            nonCashSales += amount;
          }
        }
      }
    }

    const openingCash = parseFloat(shift.openingCash);
    const expectedCash = openingCash + cashSales;
    const closingCash = parseFloat(actualCash);
    const diff = closingCash - expectedCash;

    const closed = await prisma.shift.update({
      where: { id: shift.id },
      data: {
        closedAt: new Date(),
        closingCash,
        expectedCash,
      },
      include: {
        cashier: { select: { id: true, name: true, username: true } },
      },
    });

    return {
      shift: closed,
      openingCash,
      closingCash,
      expectedCash,
      cashSales,
      nonCashSales,
      diff,
      notes,
    };
  },
};
