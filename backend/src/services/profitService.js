import prisma from '../config/db.js';
import { calculateProductCogs } from './cogsService.js';

/**
 * Helper to format a date into YYYY-MM-DD in local system timezone (WIB)
 */
function formatDayKey(d) {
  if (!d) return '';
  const dateObj = d instanceof Date ? d : new Date(d);
  if (isNaN(dateObj.getTime())) return '';
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Helper to determine date boundaries in Asia/Jakarta timezone or standard Date
 */
function resolveDateRange(period = 'today', customStart = null, customEnd = null) {
  const now = new Date();
  let start = new Date();
  let end = new Date();

  if (customStart && customEnd) {
    start = new Date(customStart);
    start.setHours(0, 0, 0, 0);
    end = new Date(customEnd);
    end.setHours(23, 59, 59, 999);
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

    // 5. Fetch operational expenses (non-cancelled, matching by incurred date or recording date)
    const expenses = await prisma.expense.findMany({
      where: {
        isCancelled: false,
        OR: [
          { date: { gte: start, lte: end } },
          { createdAt: { gte: start, lte: end } },
        ],
      },
      include: {
        category: { select: { id: true, name: true } },
      },
      orderBy: { date: 'desc' },
    });

    // 6. Fetch asset depreciations for the period
    const startYear = start.getFullYear();
    const endYear = end.getFullYear();
    const startMonth = start.getMonth() + 1;
    const endMonth = end.getMonth() + 1;

    const depreciations = await prisma.assetDepreciation.findMany({
      where: {
        status: 'PROCESSED',
        OR: [
          { createdAt: { gte: start, lte: end } },
          {
            AND: [
              { year: { gte: startYear, lte: endYear } },
              ...(startYear === endYear && startMonth === endMonth ? [{ month: startMonth }] : []),
            ],
          },
        ],
      },
      include: {
        asset: { select: { id: true, code: true, name: true, category: true } },
      },
      orderBy: { createdAt: 'desc' },
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
        if (itemCogs <= 0 && item.productId) {
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

    // Operational Expenses Breakdown:
    let totalOperationalExpenses = 0;
    const expenseCategoryBreakdown = {};
    for (const exp of expenses) {
      const amt = parseFloat(exp.amount || 0);
      totalOperationalExpenses += amt;
      const cat = exp.category?.name || 'Biaya Lainnya';
      expenseCategoryBreakdown[cat] = (expenseCategoryBreakdown[cat] || 0) + amt;
    }
    totalOperationalExpenses = Math.round(totalOperationalExpenses * 100) / 100;

    // Asset Depreciation Breakdown:
    let totalDepreciationCost = 0;
    const depreciationAssetBreakdown = {};
    for (const dep of depreciations) {
      const amt = parseFloat(dep.depreciationAmount || 0);
      totalDepreciationCost += amt;
      const assetName = dep.asset?.name || 'Aset Tetap';
      depreciationAssetBreakdown[assetName] = (depreciationAssetBreakdown[assetName] || 0) + amt;
    }
    totalDepreciationCost = Math.round(totalDepreciationCost * 100) / 100;

    // Total Operating Expenses (Total Beban Operasional Lengkap):
    const totalOperatingExpenses =
      Math.round(
        (totalPettyCashOut +
          totalWasteCost +
          totalLaborCost +
          totalOperationalExpenses +
          totalDepreciationCost) *
          100
      ) / 100;

    // Net Profit (Estimasi Laba Bersih Komprehensif):
    const netProfit = Math.round((grossProfit - totalOperatingExpenses) * 100) / 100;
    const netMarginPct = grossRevenue > 0 ? Math.round((netProfit / grossRevenue) * 1000) / 10 : 0;

    // Day-by-Day Waterfall Summary (for chart / trends)
    const dayMap = {};
    let curDay = new Date(start);
    while (curDay <= end) {
      const dStr = formatDayKey(curDay);
      dayMap[dStr] = {
        date: dStr,
        revenue: 0,
        cogs: 0,
        grossProfit: 0,
        cashOut: 0,
        waste: 0,
        labor: 0,
        operationalExpenses: 0,
        depreciation: 0,
        totalExpenses: 0,
        netProfit: 0,
        ordersCount: 0,
      };
      curDay.setDate(curDay.getDate() + 1);
    }

    orders.forEach((o) => {
      const dStr = formatDayKey(o.createdAt);
      if (dayMap[dStr]) {
        const rev = parseFloat(o.total || 0);
        let cogs = 0;
        (o.items || []).forEach((it) => {
          cogs += parseFloat(it.lineCost || 0);
        });
        dayMap[dStr].revenue += rev;
        dayMap[dStr].cogs += cogs;
        dayMap[dStr].grossProfit += rev - cogs;
        dayMap[dStr].ordersCount += 1;
      }
    });

    cashOutMovements.forEach((cm) => {
      const dStr = formatDayKey(cm.createdAt);
      if (dayMap[dStr]) {
        dayMap[dStr].cashOut += parseFloat(cm.amount || 0);
      }
    });

    wasteMovements.forEach((wm) => {
      const dStr = formatDayKey(wm.createdAt);
      if (dayMap[dStr]) {
        dayMap[dStr].waste += Math.abs(parseFloat(wm.totalCost || 0));
      }
    });

    shifts.forEach((s) => {
      const dStr = formatDayKey(s.openedAt);
      if (dayMap[dStr] && s.cashier) {
        dayMap[dStr].labor += parseFloat(s.cashier.dailyAllowance || 0);
      }
    });

    expenses.forEach((exp) => {
      const dDateStr = formatDayKey(exp.date);
      const dCreatedStr = formatDayKey(exp.createdAt);
      const targetDay = dayMap[dDateStr] ? dDateStr : dayMap[dCreatedStr] ? dCreatedStr : Object.keys(dayMap)[0];
      if (targetDay && dayMap[targetDay]) {
        dayMap[targetDay].operationalExpenses += parseFloat(exp.amount || 0);
      }
    });

    depreciations.forEach((dep) => {
      const dStr = formatDayKey(dep.createdAt || dep.processedAt);
      const targetDay = dayMap[dStr] ? dStr : Object.keys(dayMap)[0];
      if (targetDay && dayMap[targetDay]) {
        dayMap[targetDay].depreciation += parseFloat(dep.depreciationAmount || 0);
      }
    });

    const dailyTrends = Object.values(dayMap).map((d) => {
      const dayTotalExpenses =
        d.cashOut + d.waste + d.labor + d.operationalExpenses + d.depreciation;
      const net = d.grossProfit - dayTotalExpenses;
      return {
        ...d,
        revenue: Math.round(d.revenue),
        cogs: Math.round(d.cogs),
        grossProfit: Math.round(d.grossProfit),
        cashOut: Math.round(d.cashOut),
        waste: Math.round(d.waste),
        labor: Math.round(d.labor),
        operationalExpenses: Math.round(d.operationalExpenses),
        depreciation: Math.round(d.depreciation),
        totalExpenses: Math.round(dayTotalExpenses),
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
          operationalExpenses: totalOperationalExpenses,
          depreciationCost: totalDepreciationCost,
          totalOperatingExpenses,
        },
        netProfit,
        netMarginPct,
        isProfitable: netProfit >= 0,
      },
      breakdowns: {
        pettyCashByReason: Object.entries(pettyCashBreakdown)
          .map(([reason, amount]) => ({
            reason,
            amount,
          }))
          .sort((a, b) => b.amount - a.amount),
        wasteByReason: Object.entries(wasteBreakdown)
          .map(([reason, cost]) => ({
            reason,
            cost,
          }))
          .sort((a, b) => b.cost - a.cost),
        expensesByCategory: Object.entries(expenseCategoryBreakdown)
          .map(([category, amount]) => ({
            category,
            amount: Math.round(amount * 100) / 100,
          }))
          .sort((a, b) => b.amount - a.amount),
        depreciationsByAsset: Object.entries(depreciationAssetBreakdown)
          .map(([asset, amount]) => ({
            asset,
            amount: Math.round(amount * 100) / 100,
          }))
          .sort((a, b) => b.amount - a.amount),
        recentExpenses: expenses.slice(0, 5).map((e) => ({
          id: e.id,
          referenceNo: e.referenceNo,
          description: e.description,
          amount: parseFloat(e.amount),
          category: e.category?.name,
          date: e.date,
        })),
        recentDepreciations: depreciations.slice(0, 5).map((d) => ({
          id: d.id,
          assetName: d.asset?.name,
          assetCode: d.asset?.code,
          year: d.year,
          month: d.month,
          amount: parseFloat(d.depreciationAmount),
          createdAt: d.createdAt,
        })),
        recentPettyCash: cashOutMovements.slice(0, 5),
        recentWaste: wasteMovements.slice(0, 5),
      },
      dailyTrends,
    };
  },
};
