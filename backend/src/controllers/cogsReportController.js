import prisma from '../config/db.js';
import { successResponse, errorResponse } from '../utils/response.js';

/**
 * GET /api/reports/cogs
 * COGS (HPP) & Gross Profit report.
 * Query params: startDate, endDate
 * Protected: OWNER only (or OWNER + MANAGER depending on config)
 */
export async function getCogsReport(req, res) {
  try {
    const { startDate, endDate } = req.query;

    const where = { status: 'PAID' };

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    } else {
      // Default: today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      where.createdAt = { gte: today };
    }

    const orders = await prisma.order.findMany({
      where,
      include: {
        items: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    let totalRevenue = 0;
    let totalCogs = 0;
    const productMap = {};
    const dailyMap = {};

    for (const order of orders) {
      const orderRevenue = parseFloat(order.total);
      totalRevenue += orderRevenue;

      let orderCogs = 0;

      for (const item of order.items) {
        const itemCost = parseFloat(item.lineCost || 0);
        orderCogs += itemCost;

        // Aggregate per product
        const key = item.productId;
        if (!productMap[key]) {
          productMap[key] = {
            productId: item.productId,
            name: item.productName,
            qtySold: 0,
            revenue: 0,
            totalCogs: 0,
          };
        }
        productMap[key].qtySold += item.qty;
        productMap[key].revenue += parseFloat(item.lineTotal);
        productMap[key].totalCogs += itemCost;
      }

      totalCogs += orderCogs;

      // Aggregate per day
      const dayKey = order.createdAt.toISOString().slice(0, 10);
      if (!dailyMap[dayKey]) {
        dailyMap[dayKey] = { date: dayKey, revenue: 0, cogs: 0, profit: 0 };
      }
      dailyMap[dayKey].revenue += orderRevenue;
      dailyMap[dayKey].cogs += orderCogs;
    }

    const grossProfit = totalRevenue - totalCogs;
    const grossProfitMargin = totalRevenue > 0
      ? Math.round((grossProfit / totalRevenue) * 10000) / 100
      : 0;

    // Top profit products, sorted by profit desc
    const topProfitProducts = Object.values(productMap)
      .map((p) => ({
        ...p,
        revenue: Math.round(p.revenue),
        totalCogs: Math.round(p.totalCogs),
        profit: Math.round(p.revenue - p.totalCogs),
        margin: p.revenue > 0
          ? Math.round(((p.revenue - p.totalCogs) / p.revenue) * 10000) / 100
          : 0,
      }))
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 10);

    // Daily trend
    const dailyTrend = Object.values(dailyMap).map((d) => ({
      ...d,
      revenue: Math.round(d.revenue),
      cogs: Math.round(d.cogs),
      profit: Math.round(d.revenue - d.cogs),
    }));

    return successResponse(res, {
      totalRevenue: Math.round(totalRevenue),
      totalCogs: Math.round(totalCogs),
      grossProfit: Math.round(grossProfit),
      grossProfitMargin,
      topProfitProducts,
      dailyTrend,
    }, 'Laporan HPP & Laba Kotor');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}
