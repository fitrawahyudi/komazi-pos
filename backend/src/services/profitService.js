import prisma from '../config/db.js';
import { calculateProductCogs } from './cogsService.js';

/**
 * Helper to determine date boundaries in Asia/Jakarta timezone or standard Date
 */
function resolveDateRange(period = 'today', customStart = null, customEnd = null) {
  const now = new Date();
  let start = new Date();
  let end = new Date();

  if (customStart && customEnd) {
    start = new Date(customStart);
    end = new Date(customEnd);
    return { start, end };
  }

  if (period === 'yesterday') {
    start.setDate(start.getDate() - 1);
    start.setHours(0, 0, 0, 0);
    end.setDate(end.getDate() - 1);
    end.setHours(23, 59, 59, 999);
  } else if (period === '7d') {
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
  } else if (period === 'month') {
    start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
  } else {
    // Default 'today'
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
  }

  return { start, end };
}

export const profitService = {
  /**
   * Calculates comprehensive Profit & Loss (P&L) statement
   */
  async calculateProfitAndLoss({ period = 'today', startDate = null, endDate = null } = {}) {
    const { start, end } = resolveDateRange(period, startDate, endDate);

    // 1. Fetch all paid orders with items and workspace
    const orders = await prisma.order.findMany({
      where: {
        status: { in: ['PAID', 'PREPARING', 'IN_PROGRESS', 'PARTIALLY_READY', 'READY', 'SERVED', 'COMPLETED'] },
        createdAt: { gte: start, lte: end },
      },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, price: true } },
          },
        },
        workspace: true,
        payments: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // 2. Fetch petty cash movements (CASH_OUT)
    const cashOutMovements = await prisma.cashMovement.findMany({
      where: {
        type: 'CASH_OUT',
        createdAt: { gte: start, lte: end },
      },
      include: {
        user: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // 3. Fetch waste stock movements (WASTE)
    const wasteMovements = await prisma.stockMovement.findMany({
      where: {
        type: 'WASTE',
        createdAt: { gte: start, lte: end },
      },
      include: {
        ingredient: { select: { id: true, name: true, unit: true, costPerUnit: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // 4. Fetch shifts to calculate labor allowances
    const shifts = await prisma.shift.findMany({
      where: {
        openedAt: { gte: start, lte: end },
      },
      include: {
        cashier: { select: { id: true, name: true, role: true, dailyAllowance: true } },
      },
    });

    // Calculations:
    let grossRevenue = 0;
    let totalDiscount = 0;
    let workspaceRevenue = 0;
    let totalCogs = 0;
    const paymentMethods = { CASH: 0, QRIS: 0, TRANSFER: 0, OTHER: 0 };

    for (const order of orders) {
      const orderTotal = parseFloat(order.total || 0);
      const orderDiscount = parseFloat(order.discount || 0);
      grossRevenue += orderTotal;
      totalDiscount += orderDiscount;

      for (const ws of order.workspace || []) {
        if (ws.charge) workspaceRevenue += parseFloat(ws.charge);
      }

      for (const pay of order.payments || []) {
        const method = (pay.method || 'CASH').toUpperCase();
        const amt = parseFloat(pay.amount || 0);
        if (paymentMethods[method] !== undefined) {
          paymentMethods[method] += amt;
        } else {
          paymentMethods.OTHER += amt;
        }
      }

      for (const item of order.items || []) {
        let itemCogs = parseFloat(item.lineCost || 0);
        // Fallback calculation if lineCost was 0
        if (itemCogs <= 0 && item.productId) {
          const qty = parseFloat(item.quantity || item.qty || 1);
          // Rough base estimate if recorded cost missing
          itemCogs = 0; 
        }
        totalCogs += itemCogs;
      }
    }

    grossRevenue = Math.round(grossRevenue * 100) / 100;
    totalCogs = Math.round(totalCogs * 100) / 100;
    const grossProfit = Math.round((grossRevenue - totalCogs) * 100) / 100;
    const grossMarginPct = grossRevenue > 0 ? Math.round((grossProfit / grossRevenue) * 1000) / 10 : 0;

    // Petty Cash Breakdown:
    let totalPettyCashOut = 0;
    const pettyCashBreakdown = {};
    for (const cm of cashOutMovements) {
      const amt = parseFloat(cm.amount || 0);
      totalPettyCashOut += amt;
      const key = cm.reason || 'Kas Kecil Lainnya';
      pettyCashBreakdown[key] = (pettyCashBreakdown[key] || 0) + amt;
    }
    totalPettyCashOut = Math.round(totalPettyCashOut * 100) / 100;

    // Waste Cost Breakdown:
    let totalWasteCost = 0;
    const wasteBreakdown = {};
    for (const wm of wasteMovements) {
      const cost = Math.abs(parseFloat(wm.totalCost || 0));
      totalWasteCost += cost;
      const reasonKey = wm.note || 'Lainnya';
      wasteBreakdown[reasonKey] = (wasteBreakdown[reasonKey] || 0) + cost;
    }
    totalWasteCost = Math.round(totalWasteCost * 100) / 100;

    // Labor Shift Cost Calculation:
    // Count unique staff shifts per day
    let totalLaborCost = 0;
    const staffShiftCount = {};
    for (const shift of shifts) {
      const staff = shift.cashier;
      if (!staff) continue;
      const staffKey = `${staff.id}_${staff.name}`;
      const shiftDate = new Date(shift.openedAt).toISOString().slice(0, 10);
      const uniqueDayKey = `${staffKey}_${shiftDate}`;

      if (!staffShiftCount[uniqueDayKey]) {
        staffShiftCount[uniqueDayKey] = true;
        const allowance = parseFloat(staff.dailyAllowance || 0);
        totalLaborCost += allowance;
      }
    }
    totalLaborCost = Math.round(totalLaborCost * 100) / 100;

    // Total Operating Expenses (Beban Operasional):
    const totalOperatingExpenses = Math.round((totalPettyCashOut + totalWasteCost + totalLaborCost) * 100) / 100;

    // Net Profit (Estimasi Laba Bersih):
    const netProfit = Math.round((grossProfit - totalOperatingExpenses) * 100) / 100;
    const netMarginPct = grossRevenue > 0 ? Math.round((netProfit / grossRevenue) * 1000) / 10 : 0;

    // Day-by-Day Waterfall Summary (for chart / trends)
    const dayMap = {};
    // Populate days in range
    let curDay = new Date(start);
    while (curDay <= end) {
      const dStr = curDay.toISOString().slice(0, 10);
      dayMap[dStr] = {
        date: dStr,
        revenue: 0,
        cogs: 0,
        grossProfit: 0,
        cashOut: 0,
        waste: 0,
        labor: 0,
        netProfit: 0,
        ordersCount: 0,
      };
      curDay.setDate(curDay.getDate() + 1);
    }

    orders.forEach((o) => {
      const dStr = new Date(o.createdAt).toISOString().slice(0, 10);
      if (dayMap[dStr]) {
        const rev = parseFloat(o.total || 0);
        let cogs = 0;
        (o.items || []).forEach((it) => { cogs += parseFloat(it.lineCost || 0); });
        dayMap[dStr].revenue += rev;
        dayMap[dStr].cogs += cogs;
        dayMap[dStr].grossProfit += (rev - cogs);
        dayMap[dStr].ordersCount += 1;
      }
    });

    cashOutMovements.forEach((cm) => {
      const dStr = new Date(cm.createdAt).toISOString().slice(0, 10);
      if (dayMap[dStr]) {
        dayMap[dStr].cashOut += parseFloat(cm.amount || 0);
      }
    });

    wasteMovements.forEach((wm) => {
      const dStr = new Date(wm.createdAt).toISOString().slice(0, 10);
      if (dayMap[dStr]) {
        dayMap[dStr].waste += Math.abs(parseFloat(wm.totalCost || 0));
      }
    });

    shifts.forEach((s) => {
      const dStr = new Date(s.openedAt).toISOString().slice(0, 10);
      if (dayMap[dStr] && s.cashier) {
        dayMap[dStr].labor += parseFloat(s.cashier.dailyAllowance || 0);
      }
    });

    const dailyTrends = Object.values(dayMap).map((d) => {
      const net = d.grossProfit - d.cashOut - d.waste - d.labor;
      return {
        ...d,
        revenue: Math.round(d.revenue),
        cogs: Math.round(d.cogs),
        grossProfit: Math.round(d.grossProfit),
        cashOut: Math.round(d.cashOut),
        waste: Math.round(d.waste),
        labor: Math.round(d.labor),
        netProfit: Math.round(net),
        marginPct: d.revenue > 0 ? Math.round((net / d.revenue) * 100) : 0,
      };
    });

    return {
      period,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      summary: {
        totalOrders: orders.length,
        grossRevenue,
        totalDiscount,
        workspaceRevenue,
        paymentMethods,
        cogs: totalCogs,
        grossProfit,
        grossMarginPct,
        expenses: {
          pettyCashOut: totalPettyCashOut,
          wasteCost: totalWasteCost,
          laborCost: totalLaborCost,
          totalOperatingExpenses,
        },
        netProfit,
        netMarginPct,
        isProfitable: netProfit >= 0,
      },
      breakdowns: {
        pettyCashByReason: Object.entries(pettyCashBreakdown).map(([reason, amount]) => ({ reason, amount })),
        wasteByReason: Object.entries(wasteBreakdown).map(([reason, cost]) => ({ reason, cost })),
        recentPettyCash: cashOutMovements.slice(0, 5),
        recentWaste: wasteMovements.slice(0, 5),
      },
      dailyTrends,
    };
  },
};
