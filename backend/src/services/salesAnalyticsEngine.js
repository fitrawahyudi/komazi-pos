import prisma from '../config/db.js';
import { findPosKnowledge } from './ai/posKnowledgeBase.js';

/**
 * Format currency to Indonesian Rupiah string
 */
function formatRupiah(amount) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

/**
 * Helper to fetch today's date range in local time
 */
export function getTodayDateRange() {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);

  const endOfYesterday = new Date(startOfToday);
  endOfYesterday.setMilliseconds(-1);

  return { startOfToday, endOfToday, startOfYesterday, endOfYesterday };
}

/**
 * Aggregate sales for today, top selling products, yesterday comparison, and recipe ingredient stock
 */
export async function getTodayTopSellingData(limit = 5) {
  const { startOfToday, endOfToday, startOfYesterday, endOfYesterday } = getTodayDateRange();

  const PAID_STATUSES = ['PAID', 'PREPARING', 'IN_PROGRESS', 'PARTIALLY_READY', 'READY', 'SERVED', 'COMPLETED'];

  // 1. Ambil seluruh order lunas (PAID) hari ini
  let todayOrders = await prisma.order.findMany({
    where: {
      status: { in: PAID_STATUSES },
      createdAt: { gte: startOfToday, lte: endOfToday },
    },
    include: {
      items: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  // Jika hari ini belum ada transaksi lunas (misal toko baru buka atau data seeder bertanggal lampau),
  // ambil transaksi teranyar agar asisten tetap dapat memberikan insight kontekstual yang bermakna
  let isFallbackToRecent = false;
  if (todayOrders.length === 0) {
    const recentOrders = await prisma.order.findMany({
      where: { status: { in: PAID_STATUSES } },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    if (recentOrders.length > 0) {
      todayOrders = recentOrders;
      isFallbackToRecent = true;
    }
  }

  // 2. Hitung total omzet & total transaksi
  const todayTotalRevenue = todayOrders.reduce((sum, o) => sum + parseFloat(o.total || 0), 0);
  const todayTotalOrders = todayOrders.length;

  // 3. Agregasi kuantitas & omset per produk
  const productMap = new Map();
  const hourlyCount = {};

  for (const order of todayOrders) {
    // Analisis jam pesanan
    const hour = new Date(order.createdAt).getHours();
    const hourKey = `${String(hour).padStart(2, '0')}:00`;
    hourlyCount[hourKey] = (hourlyCount[hourKey] || 0) + 1;

    for (const item of order.items) {
      const pId = item.productId;
      if (!productMap.has(pId)) {
        productMap.set(pId, {
          productId: pId,
          productName: item.productName,
          qtySold: 0,
          revenue: 0,
          variants: {},
        });
      }
      const existing = productMap.get(pId);
      existing.qtySold += item.qty;
      existing.revenue += parseFloat(item.lineTotal || 0);

      if (item.variantName) {
        existing.variants[item.variantName] = (existing.variants[item.variantName] || 0) + item.qty;
      }
    }
  }

  // 4. Urutkan produk terlaris berdasarkan qty sold
  const sortedProducts = Array.from(productMap.values()).sort((a, b) => b.qtySold - a.qtySold);
  const topProductsRaw = sortedProducts.slice(0, limit);

  // 5. Ambil data penjualan kemarin untuk menghitung growth comparison
  let yesterdayMap = new Map();
  if (!isFallbackToRecent) {
    const yesterdayOrders = await prisma.order.findMany({
      where: {
        status: { in: PAID_STATUSES },
        createdAt: { gte: startOfYesterday, lte: endOfYesterday },
      },
      include: { items: true },
    });

    for (const order of yesterdayOrders) {
      for (const item of order.items) {
        const pId = item.productId;
        yesterdayMap.set(pId, (yesterdayMap.get(pId) || 0) + item.qty);
      }
    }
  }

  // 6. Lengkapi metrik produk terlaris
  const topProducts = topProductsRaw.map((p, index) => {
    const revenueShare = todayTotalRevenue > 0
      ? Math.round((p.revenue / todayTotalRevenue) * 1000) / 10
      : 0;
    const yesterdayQty = yesterdayMap.get(p.productId) || 0;
    let growthPercent = 'N/A';
    if (yesterdayQty > 0) {
      const diff = ((p.qtySold - yesterdayQty) / yesterdayQty) * 100;
      growthPercent = `${diff >= 0 ? '+' : ''}${Math.round(diff)}%`;
    }

    return {
      rank: index + 1,
      productId: p.productId,
      productName: p.productName,
      qtySold: p.qtySold,
      revenue: Math.round(p.revenue),
      revenueFormatted: formatRupiah(p.revenue),
      revenueSharePercent: revenueShare,
      yesterdayQty,
      growthPercent,
      variants: p.variants,
    };
  });

  // 7. Cross-reference dengan resep & stok bahan baku untuk menu #1 terlaris
  let ingredientAlerts = [];
  if (topProducts.length > 0) {
    const topProduct = topProducts[0];
    try {
      const recipeItems = await prisma.productRecipeItem.findMany({
        where: { productId: topProduct.productId },
        include: { ingredient: true },
      });

      for (const rItem of recipeItems) {
        if (!rItem.ingredient) continue;
        const currentStock = parseFloat(rItem.ingredient.stock || 0);
        const minStock = parseFloat(rItem.ingredient.minStock || 0);
        const neededPerPortion = parseFloat(rItem.quantity || 0);
        const isLowStock = currentStock <= minStock;
        const portionsLeft = neededPerPortion > 0 ? Math.floor(currentStock / neededPerPortion) : 999;

        ingredientAlerts.push({
          ingredientName: rItem.ingredient.name,
          unit: rItem.ingredient.unit,
          currentStock,
          minStock,
          isLowStock,
          estimatedPortionsLeft: portionsLeft,
        });
      }
    } catch (err) {
      console.warn('[SalesAnalyticsEngine] Gagal mengecek resep bahan:', err.message);
    }
  }

  // 8. Tentukan jam tersibuk (Peak hour)
  let peakHour = '-';
  let maxHourCount = 0;
  for (const [hour, count] of Object.entries(hourlyCount)) {
    if (count > maxHourCount) {
      maxHourCount = count;
      peakHour = `${hour} (dengan ${count} transaksi)`;
    }
  }

  return {
    queryTime: new Date().toISOString(),
    isFallbackToRecent,
    todayTotalOrders,
    todayTotalRevenue: Math.round(todayTotalRevenue),
    todayTotalRevenueFormatted: formatRupiah(todayTotalRevenue),
    topProducts,
    ingredientAlerts,
    peakHour,
  };
}

/**
 * Format Indonesian full date string (Asia/Jakarta timezone)
 */
export function formatIndonesianDate(date) {
  if (!date) return '-';
  const d = new Date(date);
  return d.toLocaleDateString('id-ID', {
    timeZone: 'Asia/Jakarta',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

const BEVERAGE_KEYWORDS = ['kopi', 'coffee', 'espresso', 'latte', 'milk', 'susu', 'oat', 'aren', 'gula', 'syrup', 'sirup', 'matcha', 'cup', 'lid', 'sedotan', 'tea', 'teh', 'es', 'ice'];
const FOOD_KEYWORDS = ['croissant', 'butter', 'roti', 'bread', 'pastry', 'tepung', 'telur', 'daging', 'ayam', 'beef', 'chicken', 'saus', 'sauce', 'nasi', 'rice', 'bumbu', 'keju', 'cheese'];

function isBeverageItem(name) {
  const n = (name || '').toLowerCase();
  return BEVERAGE_KEYWORDS.some((k) => n.includes(k));
}

function isFoodItem(name) {
  const n = (name || '').toLowerCase();
  return FOOD_KEYWORDS.some((k) => n.includes(k));
}

/**
 * Fetch and aggregate complete operational & sales analytics for yesterday
 * Includes fallback to the last active operational day if yesterday had no sales (e.g. day off / closed).
 */
export async function getYesterdayAnalyticsData(limit = 5) {
  const { startOfToday, startOfYesterday, endOfYesterday } = getTodayDateRange();
  const PAID_STATUSES = ['PAID', 'PREPARING', 'IN_PROGRESS', 'PARTIALLY_READY', 'READY', 'SERVED', 'COMPLETED'];
  const dateFormatted = formatIndonesianDate(startOfYesterday);

  // 1. Ambil order lunas kemarin
  const yesterdayOrders = await prisma.order.findMany({
    where: {
      status: { in: PAID_STATUSES },
      createdAt: { gte: startOfYesterday, lte: endOfYesterday },
    },
    include: {
      items: true,
      payments: true,
      cashier: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  }).catch(() => []);

  // 2. Ambil shift kasir yang dibuka/beroperasi kemarin
  const yesterdayShifts = await prisma.shift.findMany({
    where: {
      openedAt: { gte: startOfYesterday, lte: endOfYesterday },
    },
    include: {
      cashier: { select: { id: true, name: true, role: true } },
    },
    orderBy: { openedAt: 'asc' },
  }).catch(() => []);

  // Helper agregasi pesanan
  const aggregateOrdersData = (orders, totalRevNum) => {
    const pMap = new Map();
    const hCount = {};
    const pMethodsMap = new Map();

    for (const order of orders) {
      const hour = new Date(order.createdAt).getHours();
      const hourKey = `${String(hour).padStart(2, '0')}:00`;
      hCount[hourKey] = (hCount[hourKey] || 0) + 1;

      for (const item of (order.items || [])) {
        const pId = item.productId || item.productName || item.name;
        const pName = item.productName || item.name || 'Produk';
        if (!pMap.has(pId)) {
          pMap.set(pId, {
            productId: item.productId,
            productName: pName,
            qtySold: 0,
            revenue: 0,
          });
        }
        const existing = pMap.get(pId);
        existing.qtySold += Number(item.qty || 1);
        existing.revenue += parseFloat(item.lineTotal || 0);
      }

      for (const pay of (order.payments || [])) {
        const m = (pay.method || 'CASH').toUpperCase();
        if (!pMethodsMap.has(m)) {
          pMethodsMap.set(m, { method: m, totalAmount: 0, transactionCount: 0 });
        }
        const ex = pMethodsMap.get(m);
        ex.totalAmount += parseFloat(pay.amount || 0);
        ex.transactionCount += 1;
      }
    }

    const sortedProducts = Array.from(pMap.values()).sort((a, b) => b.qtySold - a.qtySold);
    const topProducts = sortedProducts.slice(0, limit).map((p, idx) => ({
      rank: idx + 1,
      productId: p.productId,
      productName: p.productName,
      qtySold: p.qtySold,
      revenue: Math.round(p.revenue),
      revenueFormatted: formatRupiah(p.revenue),
      revenueSharePercent: totalRevNum > 0 ? Math.round((p.revenue / totalRevNum) * 1000) / 10 : 0,
    }));

    const topBeverages = sortedProducts
      .filter((p) => isBeverageItem(p.productName))
      .slice(0, limit)
      .map((p, idx) => ({
        rank: idx + 1,
        productName: p.productName,
        qtySold: p.qtySold,
        revenue: Math.round(p.revenue),
        revenueFormatted: formatRupiah(p.revenue),
      }));

    const topFood = sortedProducts
      .filter((p) => isFoodItem(p.productName))
      .slice(0, limit)
      .map((p, idx) => ({
        rank: idx + 1,
        productName: p.productName,
        qtySold: p.qtySold,
        revenue: Math.round(p.revenue),
        revenueFormatted: formatRupiah(p.revenue),
      }));

    let peakHour = '-';
    let maxCount = 0;
    for (const [hour, count] of Object.entries(hCount)) {
      if (count > maxCount) {
        maxCount = count;
        peakHour = `${hour} (dengan ${count} transaksi)`;
      }
    }

    const paymentMethods = Array.from(pMethodsMap.values()).map((pm) => ({
      method: pm.method,
      totalAmount: Math.round(pm.totalAmount),
      totalAmountFormatted: formatRupiah(pm.totalAmount),
      transactionCount: pm.transactionCount,
    }));

    return { topProducts, topBeverages, topFood, peakHour, paymentMethods };
  };

  // Jika kemarin ada transaksi lunas
  if (yesterdayOrders.length > 0) {
    const totalRevenue = yesterdayOrders.reduce((sum, o) => sum + parseFloat(o.total || 0), 0);
    const totalOrders = yesterdayOrders.length;
    const averageBasket = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;
    const aggregated = aggregateOrdersData(yesterdayOrders, totalRevenue);

    return {
      hasSales: true,
      dateFormatted,
      totalOrders,
      totalRevenue: Math.round(totalRevenue),
      totalRevenueFormatted: formatRupiah(totalRevenue),
      averageBasket,
      averageBasketFormatted: formatRupiah(averageBasket),
      topProducts: aggregated.topProducts,
      topBeverages: aggregated.topBeverages,
      topFood: aggregated.topFood,
      peakHour: aggregated.peakHour,
      paymentMethods: aggregated.paymentMethods,
      shifts: yesterdayShifts.map((s) => ({
        id: s.id,
        cashierName: s.cashier?.name || 'Kasir',
        openedAt: s.openedAt,
        closedAt: s.closedAt,
        openingCashFormatted: formatRupiah(s.openingCash || 0),
        closingCashFormatted: formatRupiah(s.closingCash || 0),
      })),
      previousActiveDay: null,
    };
  }

  // Jika kemarin 0 transaksi (misal hari libur/kedai tutup), cari hari operasional aktif terakhir sebelum hari ini
  let previousActiveDay = null;
  try {
    const lastPastOrder = await prisma.order.findFirst({
      where: {
        status: { in: PAID_STATUSES },
        createdAt: { lt: startOfToday },
      },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    if (lastPastOrder && lastPastOrder.createdAt) {
      const prevDate = new Date(lastPastOrder.createdAt);
      const startOfPrevDay = new Date(prevDate);
      startOfPrevDay.setHours(0, 0, 0, 0);
      const endOfPrevDay = new Date(prevDate);
      endOfPrevDay.setHours(23, 59, 59, 999);

      const prevOrders = await prisma.order.findMany({
        where: {
          status: { in: PAID_STATUSES },
          createdAt: { gte: startOfPrevDay, lte: endOfPrevDay },
        },
        include: {
          items: true,
          payments: true,
          cashier: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (prevOrders.length > 0) {
        const prevRev = prevOrders.reduce((sum, o) => sum + parseFloat(o.total || 0), 0);
        const prevAgg = aggregateOrdersData(prevOrders, prevRev);
        const daysAgo = Math.max(1, Math.round((startOfToday.getTime() - startOfPrevDay.getTime()) / (1000 * 60 * 60 * 24)));

        previousActiveDay = {
          dateFormatted: formatIndonesianDate(startOfPrevDay),
          daysAgo,
          totalOrders: prevOrders.length,
          totalRevenue: Math.round(prevRev),
          totalRevenueFormatted: formatRupiah(prevRev),
          averageBasketFormatted: formatRupiah(Math.round(prevRev / prevOrders.length)),
          topProducts: prevAgg.topProducts,
          topBeverages: prevAgg.topBeverages,
          topFood: prevAgg.topFood,
          peakHour: prevAgg.peakHour,
          paymentMethods: prevAgg.paymentMethods,
        };
      }
    }
  } catch (err) {
    console.warn('[SalesAnalyticsEngine] Gagal mengambil previousActiveDay:', err.message);
  }

  return {
    hasSales: false,
    dateFormatted,
    totalOrders: 0,
    totalRevenue: 0,
    totalRevenueFormatted: 'Rp 0',
    averageBasket: 0,
    averageBasketFormatted: 'Rp 0',
    topProducts: [],
    topBeverages: [],
    topFood: [],
    peakHour: '-',
    paymentMethods: [],
    shifts: [],
    previousActiveDay,
  };
}

/**
 * Retrieve role-scoped business data across tables based on user role and identity:
 * - OWNER: Full comprehensive access (all revenues, monthly, HPP/costPerUnit, cashier cash audits)
 * - MANAGER: Operational access (today & yesterday, all ingredients without costPerUnit, shift operations)
 * - CASHIER: Front-of-House POS (own shift transactions, low/out-of-stock items, top menu items for upsell)
 * - BARISTA: Beverage Bar (beverage ingredients & menu, zero financial/revenue data)
 * - KITCHEN: Food Kitchen (food ingredients & menu, zero financial/revenue data)
 */
export async function getRoleScopedBusinessContext({ role = 'OWNER', userId = null, userName = '' } = {}) {
  const normalizedRole = (role || 'CASHIER').toUpperCase();
  const { startOfToday, endOfToday, startOfYesterday, endOfYesterday } = getTodayDateRange();

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  try {
    const [
      todayMetrics,
      yesterdayData,
      monthOrders,
      allCategories,
      allIngredients,
      activeShift,
      workspaceAreas,
      workspaceSessions,
      staffMembers,
      todayPayments,
      recentStockMovements,
      cashierPersonalOrders,
      customerMembers,
      publicSettings,
      pendingApprovalsCount,
      monthExpenses,
      assetsList,
      recentShiftDifferences,
    ] = await Promise.all([
      // 1. Metrik penjualan hari ini (top produk & peringatan bahan)
      getTodayTopSellingData(10),

      // 2. Data lengkap analisis penjualan & operasional kemarin (semua role)
      getYesterdayAnalyticsData(10).catch(() => ({
        hasSales: false,
        totalOrders: 0,
        totalRevenue: 0,
        totalRevenueFormatted: 'Rp 0',
        topProducts: [],
        topBeverages: [],
        topFood: [],
        paymentMethods: [],
        shifts: [],
      })),

      // 3. Ringkasan bulan ini (HANYA untuk OWNER)
      normalizedRole === 'OWNER'
        ? prisma.order
            .aggregate({
              where: { status: { in: ['PAID', 'PREPARING', 'IN_PROGRESS', 'PARTIALLY_READY', 'READY', 'SERVED', 'COMPLETED'] }, createdAt: { gte: startOfMonth, lte: endOfToday } },
              _sum: { total: true },
              _count: { id: true },
            })
            .catch(() => ({ _sum: { total: 0 }, _count: { id: 0 } }))
        : Promise.resolve({ _sum: { total: 0 }, _count: { id: 0 } }),

      // 4. Seluruh kategori produk dan menu aktif
      prisma.category
        .findMany({
          include: {
            products: {
              where: { isActive: true },
              include: {
                variants: { select: { id: true, name: true, extraPrice: true } },
                recipeItems: {
                  include: { ingredient: { select: { id: true, name: true, unit: true } } },
                },
              },
              orderBy: { name: 'asc' },
            },
          },
          orderBy: { sortOrder: 'asc' },
        })
        .catch(() => []),

      // 5. Seluruh inventori bahan baku
      prisma.ingredient
        .findMany({
          select: {
            id: true,
            name: true,
            unit: true,
            stock: true,
            minStock: true,
            costPerUnit: normalizedRole === 'OWNER', // Hanya include costPerUnit jika OWNER!
          },
          orderBy: { name: 'asc' },
        })
        .catch(() => []),

      // 6. Shift kasir yang sedang aktif saat ini
      (normalizedRole === 'OWNER' || normalizedRole === 'MANAGER' || normalizedRole === 'CASHIER')
        ? prisma.shift
            .findFirst({
              where: { closedAt: null },
              include: {
                cashier: { select: { id: true, name: true, role: true } },
              },
              orderBy: { openedAt: 'desc' },
            })
            .catch(() => null)
        : Promise.resolve(null),

      // 7. Area workspace dan paket (OWNER, MANAGER, CASHIER)
      (normalizedRole === 'OWNER' || normalizedRole === 'MANAGER' || normalizedRole === 'CASHIER')
        ? prisma.workspaceArea
            .findMany({
              where: { isActive: true },
              include: {
                sessions: {
                  where: { status: 'ACTIVE' },
                  select: { id: true, customerName: true, checkInAt: true },
                },
              },
            })
            .catch(() => [])
        : Promise.resolve([]),

      // 8. Sesi workspace aktif saat ini
      (normalizedRole === 'OWNER' || normalizedRole === 'MANAGER' || normalizedRole === 'CASHIER')
        ? prisma.workspaceSession
            .findMany({
              where: { status: 'ACTIVE' },
              include: {
                area: { select: { name: true } },
                package: { select: { name: true, durationMin: true, price: true } },
              },
            })
            .catch(() => [])
        : Promise.resolve([]),

      // 9. Staf (HANYA OWNER & MANAGER)
      (normalizedRole === 'OWNER' || normalizedRole === 'MANAGER')
        ? prisma.user
            .findMany({
              where: { isActive: true },
              select: { id: true, name: true, role: true },
            })
            .catch(() => [])
        : Promise.resolve([]),

      // 10. Metode pembayaran (OWNER & MANAGER)
      (normalizedRole === 'OWNER' || normalizedRole === 'MANAGER')
        ? prisma.payment
            .groupBy({
              by: ['method'],
              where: {
                createdAt: { gte: startOfToday, lte: endOfToday },
              },
              _sum: { amount: true },
              _count: { id: true },
            })
            .catch(() => [])
        : Promise.resolve([]),

      // 11. Pergerakan stok terakhir (OWNER & MANAGER)
      (normalizedRole === 'OWNER' || normalizedRole === 'MANAGER')
        ? prisma.stockMovement
            .findMany({
              take: 10,
              orderBy: { createdAt: 'desc' },
              include: {
                ingredient: { select: { name: true, unit: true } },
              },
            })
            .catch(() => [])
        : Promise.resolve([]),

      // 12. Transaksi personal kasir hari ini (CASHIER)
      (normalizedRole === 'CASHIER' && userId)
        ? prisma.order
            .findMany({
              where: {
                status: { in: ['PAID', 'PREPARING', 'IN_PROGRESS', 'PARTIALLY_READY', 'READY', 'SERVED', 'COMPLETED'] },
                cashierId: Number(userId),
                createdAt: { gte: startOfToday, lte: endOfToday },
              },
              select: { id: true, total: true },
            })
            .catch(() => [])
        : Promise.resolve([]),

      // 13. Data Member Loyalitas (CRM) - CASHIER, MANAGER, OWNER
      (normalizedRole === 'OWNER' || normalizedRole === 'MANAGER' || normalizedRole === 'CASHIER')
        ? prisma.customer
            .findMany({
              where: { isActive: true },
              select: {
                id: true,
                name: true,
                tier: true,
                points: true,
                visitCount: true,
              },
              orderBy: { points: 'desc' },
              take: 20,
            })
            .catch(() => [])
        : Promise.resolve([]),

      // 14. Profil Publik Kedai (Pengaturan Toko Non-Sensitif) - CASHIER, MANAGER, OWNER
      (normalizedRole === 'OWNER' || normalizedRole === 'MANAGER' || normalizedRole === 'CASHIER')
        ? prisma.setting
            .findMany({
              where: {
                key: {
                  in: [
                    'store_name',
                    'store_address',
                    'store_phone',
                    'receipt_footer',
                    'tax_percentage',
                    'service_percentage',
                  ],
                },
              },
            })
            .catch(() => [])
        : Promise.resolve([]),

      // 15. Jumlah pengajuan otorisasi pending - MANAGER & OWNER
      (normalizedRole === 'OWNER' || normalizedRole === 'MANAGER')
        ? prisma.approvalRequest
            .count({
              where: { status: 'PENDING' },
            })
            .catch(() => 0)
        : Promise.resolve(0),

      // 16. Pengeluaran bulan ini (Hanya OWNER & MANAGER)
      (normalizedRole === 'OWNER' || normalizedRole === 'MANAGER')
        ? prisma.expense
            .findMany({
              where: {
                isCancelled: false,
                date: { gte: startOfMonth, lte: endOfToday },
              },
              select: {
                id: true,
                description: true,
                amount: true,
                category: { select: { name: true } },
                date: true,
              },
              orderBy: { date: 'desc' },
              take: 50,
            })
            .catch(() => [])
        : Promise.resolve([]),

      // 17. Aset fisik kedai & nilai buku (Hanya OWNER & MANAGER)
      (normalizedRole === 'OWNER' || normalizedRole === 'MANAGER')
        ? (prisma.fixedAsset
            ? prisma.fixedAsset
                .findMany({
                  select: {
                    id: true,
                    name: true,
                    category: true,
                    purchasePrice: true,
                    bookValue: true,
                    status: true,
                  },
                  take: 20,
                })
                .catch(() => [])
            : Promise.resolve([]))
        : Promise.resolve([]),

      // 18. Audit riwayat selisih kas shift terakhir (Hanya OWNER & MANAGER)
      (normalizedRole === 'OWNER' || normalizedRole === 'MANAGER')
        ? prisma.shift
            .findMany({
              where: { closedAt: { not: null } },
              select: {
                id: true,
                cashier: { select: { name: true } },
                expectedCash: true,
                closingCash: true,
                closedAt: true,
              },
              orderBy: { closedAt: 'desc' },
              take: 5,
            })
            .catch(() => [])
        : Promise.resolve([]),
    ]);

    // Format Ingredients
    const formattedIngredients = allIngredients.map((ing) => {
      const stockNum = parseFloat(ing.stock || 0);
      const minStockNum = parseFloat(ing.minStock || 0);
      const item = {
        id: ing.id,
        name: ing.name,
        currentStock: stockNum,
        unit: ing.unit,
        minStock: minStockNum,
        isLowStock: stockNum <= minStockNum,
      };
      if (normalizedRole === 'OWNER' && ing.costPerUnit !== undefined) {
        item.costPerUnit = parseFloat(ing.costPerUnit || 0);
      }
      return item;
    });
    const lowStockIngredients = formattedIngredients.filter((i) => i.isLowStock);

    // Menu Katalog Ringkas
    const menuCatalog = allCategories.map((cat) => ({
      categoryName: cat.name,
      productCount: cat.products.length,
      products: cat.products.map((p) => ({
        id: p.id,
        name: p.name,
        price: parseFloat(p.price || 0),
        priceFormatted: formatRupiah(parseFloat(p.price || 0)),
        isSoldOut: p.isSoldOut,
        variants: (p.variants || []).map(
          (v) => `${v.name} (+${formatRupiah(parseFloat(v.extraPrice || 0))})`
        ),
        ingredientsUsed: (p.recipeItems || []).map(
          (r) => `${r.ingredient?.name} (${r.quantity} ${r.ingredient?.unit})`
        ),
      })),
    }));

    // Data Sesi Workspace Aktif
    const activeWorkspaceSummary = (normalizedRole === 'OWNER' || normalizedRole === 'MANAGER' || normalizedRole === 'CASHIER')
      ? {
          totalActiveSessions: workspaceSessions.length,
          sessions: normalizedRole !== 'CASHIER'
            ? workspaceSessions.map((s) => ({
                customerName: s.customerName,
                area: s.area?.name,
                package: s.package?.name,
                checkInAt: s.checkInAt,
              }))
            : [],
          areas: workspaceAreas.map((a) => ({
            name: a.name,
            capacity: a.capacity,
            occupiedCount: a.sessions.length,
          })),
        }
      : null;

    // Format Data Member Loyalitas (CRM) - Tanpa mengekspos PII rahasia
    const customerSummary = (normalizedRole === 'OWNER' || normalizedRole === 'MANAGER' || normalizedRole === 'CASHIER')
      ? {
          totalActiveMembers: customerMembers.length,
          topMembers: customerMembers.slice(0, 10).map((c) => ({
            name: c.name,
            tier: c.tier,
            points: c.points,
            visitCount: c.visitCount,
          })),
        }
      : null;

    // Format Profil Publik Kedai (Pengaturan Toko Non-Sensitif)
    const storeProfileObj = {};
    if (publicSettings && Array.isArray(publicSettings)) {
      publicSettings.forEach((s) => {
        storeProfileObj[s.key] = s.value;
      });
    }

    // Format Pengeluaran & Estimasi Laba Bersih (Hanya OWNER & MANAGER)
    let expensesSummary = null;
    if (normalizedRole === 'OWNER' || normalizedRole === 'MANAGER') {
      const totalExpense = (monthExpenses || []).reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
      const categoryMap = {};
      (monthExpenses || []).forEach((e) => {
        const cat = e.category?.name || 'Lain-lain';
        categoryMap[cat] = (categoryMap[cat] || 0) + parseFloat(e.amount || 0);
      });
      const topCategories = Object.entries(categoryMap)
        .map(([category, amount]) => ({ category, amount, amountFormatted: formatRupiah(amount) }))
        .sort((a, b) => b.amount - a.amount);

      expensesSummary = {
        totalMonthExpense: totalExpense,
        totalMonthExpenseFormatted: formatRupiah(totalExpense),
        expenseCount: (monthExpenses || []).length,
        topCategories,
        recentExpenses: (monthExpenses || []).slice(0, 5).map((e) => ({
          title: e.description || e.title || 'Pengeluaran',
          amountFormatted: formatRupiah(parseFloat(e.amount || 0)),
          category: e.category?.name || 'Umum',
        })),
      };
    }

    // Format Aset & Fasilitas Kedai
    const assetsSummary = (normalizedRole === 'OWNER' || normalizedRole === 'MANAGER') && Array.isArray(assetsList)
      ? {
          totalAssetsCount: assetsList.length,
          totalPurchaseCostFormatted: formatRupiah(assetsList.reduce((sum, a) => sum + parseFloat(a.purchasePrice || a.purchaseCost || 0), 0)),
          totalCurrentValueFormatted: formatRupiah(assetsList.reduce((sum, a) => sum + parseFloat(a.bookValue || a.currentValue || 0), 0)),
          topAssets: assetsList.slice(0, 5).map((a) => ({
            name: a.name,
            currentValueFormatted: formatRupiah(parseFloat(a.bookValue || a.currentValue || 0)),
            category: a.category,
          })),
        }
      : null;

    // Format Audit Selisih Shift Kasir
    const shiftAuditSummary = (normalizedRole === 'OWNER' || normalizedRole === 'MANAGER') && Array.isArray(recentShiftDifferences)
      ? recentShiftDifferences.map((s) => {
          const closing = parseFloat(s.closingCash || 0);
          const expected = parseFloat(s.expectedCash || 0);
          const diff = s.closingCash !== null && s.closingCash !== undefined ? closing - expected : 0;
          return {
            shiftId: s.id,
            cashierName: s.cashier?.name || 'Kasir',
            difference: diff,
            differenceFormatted: (diff >= 0 ? '+' : '') + formatRupiah(diff),
            status: diff === 0 ? 'PAS' : diff > 0 ? 'SURPLUS' : 'DEFISIT',
            closedAt: s.closedAt,
          };
        })
      : null;

    // ─────────────────────────────────────────────────────────────────────────────
    // PEMBAGIAN KONTEKS DATA SESUAI ROLE (RBAC-AI)
    // ─────────────────────────────────────────────────────────────────────────────

    // 1. ROLE: BARISTA (Operasional Bar & Stok Minuman, Zero Finansial)
    if (normalizedRole === 'BARISTA') {
      const beverageIngredients = formattedIngredients.filter((i) => isBeverageItem(i.name));
      const beverageLowStock = beverageIngredients.filter((i) => i.isLowStock);
      const beverageMenuCatalog = menuCatalog.filter(
        (c) => c.categoryName.toLowerCase().includes('kopi') || c.categoryName.toLowerCase().includes('non-kopi')
      );
      const topBeverages = todayMetrics.topProducts.filter((p) => isBeverageItem(p.productName));

      return {
        roleScope: 'BARISTA',
        roleScopeLabel: 'Asisten Barista / Bar Minuman',
        currentUser: { name: userName || 'Barista', role: 'BARISTA' },
        salesSummary: {
          note: 'Akses finansial/omset rupiah ditiadakan untuk Barista (Fokus Bar).',
          topBeveragesToday: topBeverages.map((p) => ({
            productName: p.productName,
            qtySold: p.qtySold,
          })),
          yesterday: {
            hasSales: yesterdayData.hasSales,
            dateFormatted: yesterdayData.dateFormatted,
            topBeverages: yesterdayData.topBeverages,
            previousActiveDay: yesterdayData.previousActiveDay ? {
              dateFormatted: yesterdayData.previousActiveDay.dateFormatted,
              topBeverages: yesterdayData.previousActiveDay.topBeverages,
            } : null,
          },
        },
        inventory: {
          barIngredientsCount: beverageIngredients.length,
          criticalLowStockCount: beverageLowStock.length,
          criticalLowStockItems: beverageLowStock,
          barIngredientsList: beverageIngredients,
        },
        menuCatalog: beverageMenuCatalog,
        currentShift: null,
        workspace: null,
        staff: null,
        customerMembersSummary: null,
        storeProfile: null,
        generatedAt: new Date().toISOString(),
      };
    }

    // 2. ROLE: KITCHEN (Operasional Dapur Makanan & Pastry, Zero Finansial)
    if (normalizedRole === 'KITCHEN') {
      const kitchenIngredients = formattedIngredients.filter((i) => isFoodItem(i.name));
      const kitchenLowStock = kitchenIngredients.filter((i) => i.isLowStock);
      const kitchenMenuCatalog = menuCatalog.filter(
        (c) => c.categoryName.toLowerCase().includes('makan') || c.categoryName.toLowerCase().includes('pastry') || c.categoryName.toLowerCase().includes('snack')
      );
      const topFood = todayMetrics.topProducts.filter((p) => isFoodItem(p.productName));

      return {
        roleScope: 'KITCHEN',
        roleScopeLabel: 'Asisten Dapur Makanan / Kitchen',
        currentUser: { name: userName || 'Kitchen', role: 'KITCHEN' },
        salesSummary: {
          note: 'Akses finansial/omset rupiah ditiadakan untuk Kitchen (Fokus Dapur).',
          topFoodToday: topFood.map((p) => ({
            productName: p.productName,
            qtySold: p.qtySold,
          })),
          yesterday: {
            hasSales: yesterdayData.hasSales,
            dateFormatted: yesterdayData.dateFormatted,
            topFood: yesterdayData.topFood,
            previousActiveDay: yesterdayData.previousActiveDay ? {
              dateFormatted: yesterdayData.previousActiveDay.dateFormatted,
              topFood: yesterdayData.previousActiveDay.topFood,
            } : null,
          },
        },
        inventory: {
          kitchenIngredientsCount: kitchenIngredients.length,
          criticalLowStockCount: kitchenLowStock.length,
          criticalLowStockItems: kitchenLowStock,
          kitchenIngredientsList: kitchenIngredients,
        },
        menuCatalog: kitchenMenuCatalog,
        currentShift: null,
        workspace: null,
        staff: null,
        customerMembersSummary: null,
        storeProfile: null,
        generatedAt: new Date().toISOString(),
      };
    }

    // 3. ROLE: CASHIER (Kasir POS — Rekap Shift Pribadi & Rekomendasi Menu)
    if (normalizedRole === 'CASHIER') {
      const myRevenue = cashierPersonalOrders.reduce((sum, o) => sum + parseFloat(o.total || 0), 0);
      const myOrdersCount = cashierPersonalOrders.length;

      return {
        roleScope: 'CASHIER',
        roleScopeLabel: 'Asisten Kasir Depan (POS)',
        currentUser: { name: userName || 'Kasir', role: 'CASHIER' },
        salesSummary: {
          note: 'Omset global kedai bulanan diredact (Fokus Shift & Pelayanan).',
          topProductsForUpsell: todayMetrics.topProducts.map((p) => ({
            productName: p.productName,
            qtySold: p.qtySold,
            price: p.priceFormatted || formatRupiah(p.price),
          })),
          peakHour: todayMetrics.peakHour,
          myPersonalShiftToday: {
            ordersHandledByMe: myOrdersCount,
            totalRevenueHandledByMe: formatRupiah(myRevenue),
          },
          yesterday: {
            hasSales: yesterdayData.hasSales,
            dateFormatted: yesterdayData.dateFormatted,
            totalOrders: yesterdayData.totalOrders,
            peakHour: yesterdayData.peakHour,
            topProductsForUpsell: (yesterdayData.topProducts || []).map((p) => ({
              productName: p.productName,
              qtySold: p.qtySold,
            })),
            previousActiveDay: yesterdayData.previousActiveDay ? {
              dateFormatted: yesterdayData.previousActiveDay.dateFormatted,
              totalOrders: yesterdayData.previousActiveDay.totalOrders,
              topProductsForUpsell: (yesterdayData.previousActiveDay.topProducts || []).map((p) => ({
                productName: p.productName,
                qtySold: p.qtySold,
              })),
            } : null,
          },
        },
        inventory: {
          criticalLowStockItems: lowStockIngredients.map((i) => ({
            ingredientName: i.name,
            currentStock: i.currentStock,
            unit: i.unit,
            isLowStock: true,
          })),
        },
        menuCatalog,
        currentShift: activeShift
          ? {
              isOpen: true,
              isMyActiveShift: Number(activeShift.cashierId) === Number(userId),
              cashierName: activeShift.cashier?.name,
              openedAt: activeShift.openedAt,
            }
          : { isOpen: false, status: 'Belum ada shift kasir yang dibuka' },
        workspace: activeWorkspaceSummary,
        staff: null,
        customerMembersSummary: customerSummary,
        storeProfile: storeProfileObj,
        pendingApprovalsCount,
        generatedAt: new Date().toISOString(),
      };
    }

    // 4. ROLE: MANAGER (Operasional Harian & Supervisi Tim)
    if (normalizedRole === 'MANAGER') {
      const paymentBreakdown = todayPayments.map((p) => ({
        method: p.method,
        totalAmountFormatted: formatRupiah(parseFloat(p._sum.amount || 0)),
        transactionCount: p._count.id,
      }));

      return {
        roleScope: 'MANAGER',
        roleScopeLabel: 'Asisten Store Manager (Operasional Kedai)',
        currentUser: { name: userName || 'Manager', role: 'MANAGER' },
        salesSummary: {
          today: {
            totalOrders: todayMetrics.todayTotalOrders,
            totalRevenueFormatted: todayMetrics.todayTotalRevenueFormatted,
            peakHour: todayMetrics.peakHour,
            isFallbackToRecent: todayMetrics.isFallbackToRecent,
            topProducts: todayMetrics.topProducts,
          },
          yesterday: {
            hasSales: yesterdayData.hasSales,
            dateFormatted: yesterdayData.dateFormatted,
            totalOrders: yesterdayData.totalOrders,
            totalRevenue: yesterdayData.totalRevenue,
            totalRevenueFormatted: yesterdayData.totalRevenueFormatted,
            averageBasketFormatted: yesterdayData.averageBasketFormatted,
            peakHour: yesterdayData.peakHour,
            topProducts: yesterdayData.topProducts,
            topBeverages: yesterdayData.topBeverages,
            topFood: yesterdayData.topFood,
            paymentMethods: yesterdayData.paymentMethods,
            shifts: yesterdayData.shifts,
            previousActiveDay: yesterdayData.previousActiveDay,
            growthText: yesterdayData.hasSales && todayMetrics.todayTotalRevenue > 0
              ? `${todayMetrics.todayTotalRevenue >= yesterdayData.totalRevenue ? '+' : ''}${Math.round(((todayMetrics.todayTotalRevenue - yesterdayData.totalRevenue) / (yesterdayData.totalRevenue || 1)) * 100)}% vs kemarin`
              : 'N/A',
          },
          paymentMethodsToday: paymentBreakdown,
        },
        inventory: {
          totalIngredientsCount: formattedIngredients.length,
          criticalLowStockCount: lowStockIngredients.length,
          criticalLowStockItems: lowStockIngredients,
          allIngredientsList: formattedIngredients,
          recentMovements: recentStockMovements.map((m) => ({
            type: m.type,
            ingredient: m.ingredient?.name,
            qty: parseFloat(m.qty || 0),
            unit: m.ingredient?.unit,
            date: m.createdAt,
          })),
        },
        menuCatalog,
        currentShift: activeShift
          ? {
              isOpen: true,
              cashierName: activeShift.cashier?.name,
              cashierRole: activeShift.cashier?.role,
              openedAt: activeShift.openedAt,
            }
          : { isOpen: false, status: 'Tidak ada shift kasir yang terbuka' },
        workspace: activeWorkspaceSummary,
        staff: {
          totalActiveStaff: staffMembers.length,
          staffList: staffMembers.map((u) => `${u.name} (${u.role})`),
        },
        expenses: expensesSummary,
        assets: assetsSummary,
        shiftAudit: shiftAuditSummary,
        customerMembersSummary: customerSummary,
        storeProfile: storeProfileObj,
        pendingApprovalsCount,
        generatedAt: new Date().toISOString(),
      };
    }

    // 5. ROLE: OWNER (Akses Penuh Eksekutif & Finansial)
    const monthRevenue = parseFloat(monthOrders._sum.total || 0);
    const paymentBreakdown = todayPayments.map((p) => ({
      method: p.method,
      totalAmountFormatted: formatRupiah(parseFloat(p._sum.amount || 0)),
      transactionCount: p._count.id,
    }));

    return {
      roleScope: 'OWNER',
      roleScopeLabel: 'Asisten Eksekutif Pemilik Kedai (Owner)',
      currentUser: { name: userName || 'Owner', role: 'OWNER' },
      salesSummary: {
        today: {
          totalOrders: todayMetrics.todayTotalOrders,
          totalRevenue: todayMetrics.todayTotalRevenue,
          totalRevenueFormatted: todayMetrics.todayTotalRevenueFormatted,
          peakHour: todayMetrics.peakHour,
          isFallbackToRecent: todayMetrics.isFallbackToRecent,
          topProducts: todayMetrics.topProducts,
        },
        yesterday: {
          hasSales: yesterdayData.hasSales,
          dateFormatted: yesterdayData.dateFormatted,
          totalOrders: yesterdayData.totalOrders,
          totalRevenue: yesterdayData.totalRevenue,
          totalRevenueFormatted: yesterdayData.totalRevenueFormatted,
          averageBasketFormatted: yesterdayData.averageBasketFormatted,
          peakHour: yesterdayData.peakHour,
          topProducts: yesterdayData.topProducts,
          topBeverages: yesterdayData.topBeverages,
          topFood: yesterdayData.topFood,
          paymentMethods: yesterdayData.paymentMethods,
          shifts: yesterdayData.shifts,
          previousActiveDay: yesterdayData.previousActiveDay,
          growthText: yesterdayData.hasSales && todayMetrics.todayTotalRevenue > 0
            ? `${todayMetrics.todayTotalRevenue >= yesterdayData.totalRevenue ? '+' : ''}${Math.round(((todayMetrics.todayTotalRevenue - yesterdayData.totalRevenue) / (yesterdayData.totalRevenue || 1)) * 100)}% vs kemarin`
            : 'N/A',
        },
        thisMonth: {
          totalOrders: monthOrders._count.id || 0,
          totalRevenueFormatted: formatRupiah(monthRevenue),
        },
        netProfitEstimated: {
          amount: monthRevenue - (expensesSummary?.totalMonthExpense || 0),
          amountFormatted: formatRupiah(monthRevenue - (expensesSummary?.totalMonthExpense || 0)),
        },
        paymentMethodsToday: paymentBreakdown,
      },
      expenses: expensesSummary,
      assets: assetsSummary,
      shiftAudit: shiftAuditSummary,
      inventory: {
        totalIngredientsCount: formattedIngredients.length,
        criticalLowStockCount: lowStockIngredients.length,
        criticalLowStockItems: lowStockIngredients,
        allIngredientsList: formattedIngredients, // Menyertakan costPerUnit!
        recentMovements: recentStockMovements.map((m) => ({
          type: m.type,
          ingredient: m.ingredient?.name,
          qty: parseFloat(m.qty || 0),
          unit: m.ingredient?.unit,
          date: m.createdAt,
        })),
      },
      menuCatalog,
      currentShift: activeShift
        ? {
            isOpen: true,
            cashierName: activeShift.cashier?.name,
            cashierRole: activeShift.cashier?.role,
            openedAt: activeShift.openedAt,
            openingCashFormatted: formatRupiah(parseFloat(activeShift.openingCash || 0)),
          }
        : { isOpen: false, status: 'Tidak ada shift kasir yang terbuka' },
      workspace: activeWorkspaceSummary,
      staff: {
        totalActiveStaff: staffMembers.length,
        staffList: staffMembers.map((u) => `${u.name} (${u.role})`),
      },
      customerMembersSummary: customerSummary,
      storeProfile: storeProfileObj,
      pendingApprovalsCount,
      generatedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.warn('[SalesAnalyticsEngine] Error getRoleScopedBusinessContext:', err.message);
    const basicMetrics = await getTodayTopSellingData(5);
    return {
      roleScope: normalizedRole,
      salesSummary: { today: basicMetrics },
      inventory: { criticalLowStockItems: basicMetrics.ingredientAlerts || [] },
      error: err.message,
    };
  }
}

/**
 * Backward-compatible wrapper for getRoleScopedBusinessContext
 */
export async function getComprehensiveBusinessContext(options = {}) {
  return getRoleScopedBusinessContext(options);
}

/**
 * Generate accurate rule-based deterministic narrative (Local Fallback)
 * 100% offline, intent-aware, zero-hallucination, and strictly respects role boundaries
 */
export function generateFallbackNarrative(contextOrMetrics, query = '', userRole = 'CASHIER', userName = '') {
  const q = (query || '').toLowerCase().trim();
  const role = (userRole || contextOrMetrics?.roleScope || 'CASHIER').toUpperCase();
  const effectiveName = userName || contextOrMetrics?.currentUser?.name || '';
  const displayName = effectiveName ? `Kak ${effectiveName}` : (role === 'OWNER' ? 'Owner' : role === 'MANAGER' ? 'Manager' : 'Rekan Komazi');

  const todayMetrics = contextOrMetrics?.salesSummary?.today || contextOrMetrics || {};
  const yesterdayMetrics = contextOrMetrics?.salesSummary?.yesterday || {};
  const inventoryAlerts = contextOrMetrics?.inventory?.criticalLowStockItems || todayMetrics.ingredientAlerts || [];
  const lowStock = inventoryAlerts.filter((i) => i.isLowStock !== false);
  const currentShift = contextOrMetrics?.currentShift || null;
  const workspaceData = contextOrMetrics?.workspace || null;
  const topProducts = todayMetrics.topProducts || [];
  const top1 = topProducts[0] || null;

  // 1. Perlindungan Informasi Sensitif / Rahasia Kedai
  const sensitiveKeywords = ['pin', 'supervisor', 'password', 'sandi', 'kunci', 'secret', 'token', 'apikey', 'api key'];
  if (sensitiveKeywords.some((k) => q.includes(k))) {
    return `Mohon maaf ${displayName}, demi keamanan operasional dan privasi kedai, informasi rahasia seperti PIN otorisasi supervisor, kata sandi, dan kunci keamanan sistem tidak dapat diakses melalui asisten AI.`;
  }

  // 2. Cek Pelanggaran Batasan Hak Akses (Role Boundary Enforcement)
  if (role === 'BARISTA' || role === 'KITCHEN') {
    if (q.includes('omset') || q.includes('omzet') || q.includes('pendapatan') || q.includes('penjualan') || q.includes('transaksi') || q.includes('uang') || q.includes('rupiah') || q.includes('laba') || q.includes('untung')) {
      return `Sebagai asisten operasional **${role === 'BARISTA' ? 'Bar Minuman' : 'Dapur Makanan'}**, saya tidak memiliki akses ke data finansial atau omset rupiah kedai.\n\nSaya dapat membantu Anda memeriksa:\n- Sisa stok bahan ${role === 'BARISTA' ? 'kopi, susu, dan sirup' : 'pastry, makanan, dan bahan dapur'}.\n- Menu ${role === 'BARISTA' ? 'minuman' : 'makanan'} yang paling banyak dipesan untuk persiapan operasional.`;
    }
  }

  if (role === 'CASHIER') {
    if (q.includes('omset kemarin') || q.includes('omset bulan') || q.includes('omzet bulan') || q.includes('laba') || q.includes('profit') || q.includes('margin') || q.includes('hpp') || q.includes('kasir lain')) {
      return `Sebagai asisten kasir, saya **tidak memiliki akses** ke laporan omset bulanan atau data margin finansial kedai.\n\nSilakan hubungi **Store Manager** atau **Owner** untuk mengakses informasi laporan finansial tersebut.`;
    }
  }

  // 2b. Panduan SOP POS Teknis (Knowledge Base Built-in)
  const matchedSop = findPosKnowledge(q);
  if (matchedSop) {
    let sopText = `💡 **${matchedSop.title}**\n\n${matchedSop.summary}\n\n**Langkah-langkah Eksekusi:**\n`;
    matchedSop.steps.forEach((s, idx) => {
      sopText += `${idx + 1}. ${s}\n`;
    });
    if (matchedSop.troubleshooting) {
      sopText += `\n📌 **Tips:** ${matchedSop.troubleshooting}`;
    }
    return sopText;
  }

  // 2c. Resep & Komposisi Menu
  if (q.includes('resep') || q.includes('takaran') || q.includes('komposisi') || q.includes('gramasi')) {
    const catalog = contextOrMetrics?.menuCatalog || [];
    const matchedProducts = [];
    for (const cat of catalog) {
      for (const p of cat.products || []) {
        if (
          p.name &&
          (q.includes(p.name.toLowerCase()) ||
            p.name.toLowerCase().split(' ').some((w) => w.length > 3 && q.includes(w)))
        ) {
          matchedProducts.push(p);
        }
      }
    }
    const toShow =
      matchedProducts.length > 0
        ? matchedProducts.slice(0, 4)
        : catalog.flatMap((c) => c.products || []).slice(0, 3);

    if (toShow.length > 0) {
      let rText = `☕ **Resep & Komposisi Menu:**\n\n`;
      toShow.forEach((p) => {
        rText += `• **${p.name}** (${p.priceFormatted || ''}):\n`;
        if (p.ingredientsUsed && p.ingredientsUsed.length > 0) {
          p.ingredientsUsed.forEach((ing) => {
            rText += `  - ${ing}\n`;
          });
        } else {
          rText += `  - (Resep belum terdaftar di sistem)\n`;
        }
      });
      return rText.trim();
    }
  }

  // 2d. Pengingat & Jadwal (Scheduler)
  if (q.includes('ingatkan') || q.includes('pengingat') || q.includes('jadwalkan') || q.includes('cronjob')) {
    return `⏰ **Sistem Pengingat & Penjadwalan Otomatis Komazi**\n\nPermintaan pengingat operasional Anda telah dipahami oleh sistem. Anda dapat mengonfirmasi pengingat otomatis langsung melalui tombol aksi atau perintah bot Telegram.`;
  }

  // 3. Sapaan / Greeting Intent
  const greetingWords = ['hi', 'halo', 'hello', 'hey', 'pagi', 'siang', 'sore', 'malam', 'assalamualaikum', 'tes', 'test', 'ping', 'bantu'];
  const isGreeting = greetingWords.some((w) => q === w || q.startsWith(`${w} `) || q.endsWith(` ${w}`));

  if (isGreeting || !q) {
    if (role === 'BARISTA') {
      return `Halo ${displayName}! Saya **Komazi AI**, asisten operasional **Bar Minuman** ☕\n\n📌 **Status Bar Saat Ini:**\n- Bahan Menipis: **${lowStock.length > 0 ? `${lowStock.length} bahan bar menipis ⚠️` : 'Stok bahan bar aman ✅'}**\n\nSilakan tanyakan hal seputar bar:\n- *"Berapa sisa stok Fresh Milk dan Biji Kopi?"*\n- *"Minuman apa yang paling banyak dipesan hari ini?"*\n- *"Bahan minuman apa yang perlu di-restock?"*`;
    }

    if (role === 'KITCHEN') {
      return `Halo ${displayName}! Saya **Komazi AI**, asisten operasional **Dapur Makanan** 🥐\n\n📌 **Status Dapur Saat Ini:**\n- Bahan Menipis: **${lowStock.length > 0 ? `${lowStock.length} bahan dapur menipis ⚠️` : 'Stok bahan dapur aman ✅'}**\n\nSilakan tanyakan seputar persiapan dapur:\n- *"Bahan dapur apa yang stoknya paling sedikit?"*\n- *"Makanan atau pastry apa yang paling laku hari ini?"*`;
    }

    if (role === 'CASHIER') {
      const personalShift = contextOrMetrics?.salesSummary?.myPersonalShiftToday;
      const personalText = personalShift
        ? `Transaksi yang Anda tangani: **${personalShift.ordersHandledByMe} pesanan** (${personalShift.totalRevenueHandledByMe}).`
        : 'Shift kasir aktif.';
      return `Halo ${displayName}! Saya **Komazi AI**, asisten kasir POS Anda ☕\n\n📌 **Status Shift Anda:**\n- ${personalText}\n- Ketersediaan Menu: **${lowStock.length > 0 ? `${lowStock.length} bahan menipis ⚠️` : 'Semua menu siap disajikan ✅'}**\n\nSilakan tanyakan:\n- *"Menu apa yang stok bahannya habis?"*\n- *"Menu apa yang paling laku untuk rekomendasi pelanggan?"*\n- *"Berapa sesi workspace yang sedang aktif?"*`;
    }

    // OWNER & MANAGER Greeting
    const shiftText = currentShift?.isOpen
      ? `Kasir aktif: **${currentShift.cashierName || 'Kasir'}**.`
      : 'Belum ada shift kasir yang aktif.';
    const revenueText = todayMetrics.todayTotalRevenueFormatted
      ? `Omset hari ini sementara tercatat **${todayMetrics.todayTotalRevenueFormatted}** (${todayMetrics.todayTotalOrders || 0} transaksi).`
      : 'Belum ada transaksi hari ini.';

    return `Halo ${displayName}! Selamat datang di **Komazi Coffee & Workspace** ☕\n\nSaya **Komazi AI**, asisten manajemen kedai Anda.\n\n📌 **Status Operasional Hari Ini:**\n- ${revenueText}\n- ${shiftText}\n- Kondisi Bahan Baku: **${lowStock.length > 0 ? `${lowStock.length} bahan menipis ⚠️` : 'Aman terkendali ✅'}**\n\nSilakan tanyakan seputar performa penjualan atau operasional kedai.`;
  }

  // 4. Intent Menu Habis / Bahan Kosong
  if (q.includes('habis') || q.includes('tidak bisa dipesan') || q.includes('sold out') || q.includes('kosong')) {
    if (lowStock.length > 0) {
      let text = `⚠️ Terdapat **${lowStock.length} bahan baku** dengan stok menipis/habis:\n\n`;
      lowStock.forEach((i) => {
        const portionText = i.estimatedPortionsLeft ? ` (~${i.estimatedPortionsLeft} porsi lagi)` : '';
        text += `- **${i.name || i.ingredientName}**: Tersisa **${i.currentStock} ${i.unit}** (Batas aman: ${i.minStock || 0} ${i.unit})${portionText}\n`;
      });
      text += `\nDisarankan memeriksa kembali menu yang menggunakan bahan tersebut sebelum ditawarkan ke pelanggan.`;
      return text;
    }
    return `✅ Saat ini seluruh bahan baku dalam kondisi aman dan mencukupi. Semua menu di katalog siap disajikan dan dapat dipesan pelanggan.`;
  }

  // 5. Intent Member / Loyalitas Pelanggan (CRM)
  if (q.includes('member') || q.includes('pelanggan') || q.includes('customer') || q.includes('poin') || q.includes('loyalty')) {
    const memberData = contextOrMetrics?.customerMembersSummary;
    const topMembers = memberData?.topMembers || [];
    const total = memberData?.totalActiveMembers || 0;
    if (topMembers.length > 0) {
      let text = `Ringkasan Member Loyalitas Kedai (${total} pelanggan terdaftar):\n\n**Pelanggan Teratas Berdasarkan Poin:**\n`;
      topMembers.slice(0, 5).forEach((m, idx) => {
        text += `- **#${idx + 1} ${m.name}**: ${m.points} poin (Tier: ${m.tier}, ${m.visitCount} kunjungan)\n`;
      });
      return text;
    }
    return `Saat ini terdapat ${total} pelanggan terdaftar dalam sistem loyalitas kedai.`;
  }

  // 6. Intent Profil / Info Kedai
  if (q.includes('alamat') || q.includes('telepon') || q.includes('profil') || q.includes('pajak') || q.includes('service charge')) {
    const store = contextOrMetrics?.storeProfile || {};
    return `Profil & Pengaturan Kedai:\n\n- Nama Kedai: **${store.store_name || 'Komazi Coffee & Workspace'}**\n- Alamat: ${store.store_address || 'Jl. Komazi No. 1'}\n- Kontak: ${store.store_phone || '-'}\n- Tarif Pajak: ${store.tax_percentage || 0}%\n- Service Charge: ${store.service_percentage || 0}%`;
  }

  // 7. Intent Shift / Kasir / Staf
  if (q.includes('shift') || q.includes('kasir') || q.includes('petugas') || q.includes('staf') || q.includes('pegawai')) {
    if (role === 'CASHIER') {
      const pShift = contextOrMetrics?.salesSummary?.myPersonalShiftToday;
      return `Ringkasan Shift Anda Hari Ini:\n\n- Transaksi yang Anda proses: **${pShift?.ordersHandledByMe || 0} pesanan**\n- Total penjualan shift Anda: **${pShift?.totalRevenueHandledByMe || 'Rp 0'}**\n- Status: Shift aktif di meja kasir.`;
    }
    if (currentShift?.isOpen) {
      const openingCashText = currentShift.openingCashFormatted ? `\n- Kas Awal Modal: ${currentShift.openingCashFormatted}` : '';
      return `Saat ini shift kasir sedang **AKTIF** dengan kasir bertugas: **${currentShift.cashierName}** (${currentShift.cashierRole || 'CASHIER'}).\n\n- Waktu Buka Shift: ${currentShift.openedAt ? new Date(currentShift.openedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}${openingCashText}`;
    }
    return `Saat ini **tidak ada shift kasir yang aktif**. Silakan buka shift kasir di meja kasir untuk mulai mencatat transaksi baru.`;
  }

  // 8. Intent Workspace / Coworking
  if (q.includes('workspace') || q.includes('co-working') || q.includes('coworking') || q.includes('ruangan') || q.includes('meja') || q.includes('sesi')) {
    const activeCount = workspaceData?.totalActiveSessions || workspaceData?.sessions?.length || 0;
    let text = `Status Area Workspace saat ini:\n\n- Sesi Aktif: **${activeCount} pengunjung/pelanggan**.\n`;
    if (workspaceData?.areas && workspaceData.areas.length > 0) {
      text += 'Kapasitas Area:\n';
      workspaceData.areas.forEach((a) => {
        text += `- **${a.name}**: terisi ${a.occupiedCount || 0}/${a.capacity || 0} orang\n`;
      });
    } else {
      text += 'Seluruh area workspace saat ini tersedia untuk pengunjung baru.';
    }
    return text;
  }

  // 9a. Intent Khusus: Data & Penjualan Kemarin
  const isYesterdayQuery = q.includes('kemarin') || q.includes('yesterday') || q.includes('hari lalu');
  if (isYesterdayQuery) {
    if (role === 'BARISTA') {
      const yBev = yesterdayMetrics?.topBeverages || yesterdayMetrics?.previousActiveDay?.topBeverages || [];
      if (yBev.length > 0) {
        let text = `☕ **Minuman Terlaris Kemarin (${yesterdayMetrics?.dateFormatted || 'Kemarin'}):**\n\n`;
        yBev.slice(0, 4).forEach((p, idx) => {
          text += `- **#${idx + 1} ${p.productName}**: terjual **${p.qtySold} cup**\n`;
        });
        text += `\nGunakan data ini sebagai panduan persiapan bar dan bahan minuman hari ini.`;
        return text;
      }
      return `Belum ada data penjualan minuman yang tercatat untuk kemarin.`;
    }

    if (role === 'KITCHEN') {
      const yFood = yesterdayMetrics?.topFood || yesterdayMetrics?.previousActiveDay?.topFood || [];
      if (yFood.length > 0) {
        let text = `🥐 **Makanan/Pastry Terlaris Kemarin (${yesterdayMetrics?.dateFormatted || 'Kemarin'}):**\n\n`;
        yFood.slice(0, 4).forEach((p, idx) => {
          text += `- **#${idx + 1} ${p.productName}**: terjual **${p.qtySold} porsi**\n`;
        });
        text += `\nGunakan data ini untuk memperkirakan porsi persiapan dapur hari ini.`;
        return text;
      }
      return `Belum ada data penjualan makanan yang tercatat untuk kemarin.`;
    }

    if (role === 'CASHIER') {
      const yTop = yesterdayMetrics?.topProducts || yesterdayMetrics?.topProductsForUpsell || yesterdayMetrics?.previousActiveDay?.topProducts || [];
      if (yTop.length > 0) {
        let text = `☕ **Menu Terlaris Kemarin (${yesterdayMetrics?.dateFormatted || 'Kemarin'}):**\n\n`;
        yTop.slice(0, 4).forEach((p, idx) => {
          text += `- **#${idx + 1} ${p.productName}**: terjual **${p.qtySold} porsi/cup**\n`;
        });
        text += `\nMenu di atas sangat direkomendasikan untuk Anda tawarkan (upselling) ke pelanggan hari ini! *(Catatan: Laporan omset global kedai dapat diakses oleh Manager/Owner)*`;
        return text;
      }
      return `Belum ada data menu terlaris kemarin yang tercatat di sistem kasir.`;
    }

    // Role OWNER & MANAGER
    if (yesterdayMetrics?.hasSales) {
      let text = `📊 **Laporan & Data Penjualan Kemarin (${yesterdayMetrics.dateFormatted}):**\n\n`;
      text += `- **Total Omset**: **${yesterdayMetrics.totalRevenueFormatted}**\n`;
      text += `- **Jumlah Transaksi Lunas**: **${yesterdayMetrics.totalOrders} transaksi**\n`;
      if (yesterdayMetrics.averageBasketFormatted) {
        text += `- **Rata-rata per Transaksi**: ${yesterdayMetrics.averageBasketFormatted}\n`;
      }
      if (yesterdayMetrics.peakHour && yesterdayMetrics.peakHour !== '-') {
        text += `- **Jam Sibuk Kemarin**: Pukul ${yesterdayMetrics.peakHour}\n`;
      }
      if (yesterdayMetrics.topProducts && yesterdayMetrics.topProducts.length > 0) {
        text += `\n**Menu Terlaris Kemarin:**\n`;
        yesterdayMetrics.topProducts.slice(0, 3).forEach((p, idx) => {
          text += `- **#${idx + 1} ${p.productName}**: ${p.qtySold} porsi (${p.revenueFormatted})\n`;
        });
      }
      if (yesterdayMetrics.paymentMethods && yesterdayMetrics.paymentMethods.length > 0) {
        text += `\n**Metode Pembayaran Kemarin:**\n`;
        yesterdayMetrics.paymentMethods.forEach((m) => {
          text += `- ${m.method}: ${m.totalAmountFormatted} (${m.transactionCount} transaksi)\n`;
        });
      }
      if (todayMetrics?.todayTotalRevenueFormatted) {
        text += `\n💡 **Perbandingan Hari Ini**: Omset hari ini sementara tercatat **${todayMetrics.todayTotalRevenueFormatted}** (${todayMetrics.todayTotalOrders || 0} transaksi).`;
      }
      return text;
    } else {
      const prev = yesterdayMetrics?.previousActiveDay;
      let text = `📌 **Data Penjualan Kemarin (${yesterdayMetrics?.dateFormatted || 'Kemarin'}):**\n\n`;
      text += `Pada hari kalender kemarin, **tidak tercatat transaksi lunas** di sistem (kedai libur/tutup atau belum ada penjualan).\n\n`;
      if (prev) {
        text += `🔍 **Hari Operasional Aktif Terakhir (${prev.dateFormatted}, ${prev.daysAgo} hari lalu):**\n`;
        text += `- **Total Omset**: **${prev.totalRevenueFormatted}** (${prev.totalOrders} transaksi)\n`;
        if (prev.topProducts && prev.topProducts.length > 0) {
          text += `- **Menu Terlaris**: **${prev.topProducts[0].productName}** (${prev.topProducts[0].qtySold} porsi - ${prev.topProducts[0].revenueFormatted})\n`;
        }
        if (prev.peakHour && prev.peakHour !== '-') {
          text += `- **Jam Tersibuk**: Pukul ${prev.peakHour}\n`;
        }
      }
      if (todayMetrics?.todayTotalRevenueFormatted && todayMetrics.todayTotalOrders > 0) {
        text += `\n💡 **Omset Hari Ini**: Sementara tercatat **${todayMetrics.todayTotalRevenueFormatted}** (${todayMetrics.todayTotalOrders} transaksi).`;
      }
      return text;
    }
  }

  // 9b. Intent Omset / Penjualan Umum (Hanya untuk OWNER & MANAGER)
  if (q.includes('omset') || q.includes('omzet') || q.includes('pendapatan') || q.includes('penjualan') || q.includes('transaksi')) {
    if (role === 'CASHIER') {
      const pShift = contextOrMetrics?.salesSummary?.myPersonalShiftToday;
      return `Ringkasan Penjualan Shift Anda:\n\n- Total pesanan yang Anda layani: **${pShift?.ordersHandledByMe || 0} transaksi**\n- Total rupiah yang Anda proses: **${pShift?.totalRevenueHandledByMe || 'Rp 0'}**\n*(Catatan: Omset global seluruh kedai hanya dapat diakses oleh Manager/Owner)*`;
    }
    let text = `Ringkasan Pendapatan Kedai:\n\n`;
    text += `- **Omset Hari Ini**: **${todayMetrics.todayTotalRevenueFormatted || 'Rp 0'}** (${todayMetrics.todayTotalOrders || 0} transaksi lunas)\n`;
    if (yesterdayMetrics.totalRevenueFormatted) {
      text += `- **Omset Kemarin**: ${yesterdayMetrics.totalRevenueFormatted} (${yesterdayMetrics.totalOrders || 0} transaksi)\n`;
    }
    if (todayMetrics.peakHour && todayMetrics.peakHour !== '-') {
      text += `- Jam Sibuk: Terjadi pada pukul **${todayMetrics.peakHour}**\n`;
    }
    return text;
  }

  // 10. Intent Stok / Bahan Baku
  if (q.includes('stok') || q.includes('bahan') || q.includes('menipis') || q.includes('restock') || q.includes('baku')) {
    if (lowStock.length > 0) {
      let text = `⚠️ **Peringatan Bahan Baku Menipis (${lowStock.length} bahan):**\n\n`;
      lowStock.forEach((i) => {
        const portionText = i.estimatedPortionsLeft ? ` (~${i.estimatedPortionsLeft} porsi lagi)` : '';
        text += `- **${i.name || i.ingredientName}**: Sisa **${i.currentStock} ${i.unit}** (Batas aman: ${i.minStock || 0} ${i.unit})${portionText}\n`;
      });
      text += `\nDisarankan segera membuat purchase order atau restock bahan baku tersebut.`;
      return text;
    }
    return `✅ Seluruh stok bahan baku dalam kondisi aman dan mencukupi untuk operasional kedai saat ini.`;
  }

  // 11. Intent Menu / Terlaris
  if (!top1) {
    return 'Belum ada transaksi berstatus lunas (PAID) tercatat untuk hari ini. Silakan proses transaksi di POS kasir untuk melihat analitik produk.';
  }

  const prefix = todayMetrics.isFallbackToRecent ? 'Berdasarkan data transaksi terbaru' : 'Hari ini';
  let narrative = `${prefix}, menu yang paling laku adalah **${top1.productName}** dengan total penjualan sebanyak **${top1.qtySold} porsi/cup**.\n\n`;

  if (topProducts.length > 1) {
    narrative += '**Urutan Menu Terlaris Berikutnya:**\n';
    topProducts.slice(1, 4).forEach((p) => {
      const revText = (role === 'BARISTA' || role === 'KITCHEN') ? '' : ` (${p.revenueFormatted || formatRupiah(p.revenue)})`;
      narrative += `- **#${p.rank || p.id} ${p.productName}**: terjual ${p.qtySold} porsi${revText}\n`;
    });
    narrative += '\n';
  }

  if (lowStock.length > 0) {
    narrative += `⚠️ **Peringatan Stok Bahan:** Terdapat **${lowStock.length} bahan baku** dengan stok menipis (misal: ${lowStock[0].name || lowStock[0].ingredientName}).`;
  } else {
    narrative += '✅ **Kondisi Bahan Baku**: Stok bahan baku operasional terpantau aman.';
  }

  return narrative;
}
