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
      yesterdayOrders,
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
    ] = await Promise.all([
      // 1. Metrik penjualan hari ini (top produk & peringatan bahan)
      getTodayTopSellingData(10),

      // 2. Transaksi lunas kemarin (hanya relevan untuk OWNER & MANAGER)
      (normalizedRole === 'OWNER' || normalizedRole === 'MANAGER')
        ? prisma.order
            .findMany({
              where: { status: { in: ['PAID', 'PREPARING', 'IN_PROGRESS', 'PARTIALLY_READY', 'READY', 'SERVED', 'COMPLETED'] }, createdAt: { gte: startOfYesterday, lte: endOfYesterday } },
              select: { id: true, total: true },
            })
            .catch(() => [])
        : Promise.resolve([]),

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
      const yesterdayRevenue = yesterdayOrders.reduce((sum, o) => sum + parseFloat(o.total || 0), 0);
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
            totalOrders: yesterdayOrders.length,
            totalRevenueFormatted: formatRupiah(yesterdayRevenue),
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
        customerMembersSummary: customerSummary,
        storeProfile: storeProfileObj,
        pendingApprovalsCount,
        generatedAt: new Date().toISOString(),
      };
    }

    // 5. ROLE: OWNER (Akses Penuh Eksekutif & Finansial)
    const yesterdayRevenue = yesterdayOrders.reduce((sum, o) => sum + parseFloat(o.total || 0), 0);
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
          totalOrders: yesterdayOrders.length,
          totalRevenueFormatted: formatRupiah(yesterdayRevenue),
        },
        thisMonth: {
          totalOrders: monthOrders._count.id || 0,
          totalRevenueFormatted: formatRupiah(monthRevenue),
        },
        paymentMethodsToday: paymentBreakdown,
      },
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

  // 9. Intent Omset / Penjualan (Hanya untuk OWNER & MANAGER)
  if (q.includes('omset') || q.includes('omzet') || q.includes('pendapatan') || q.includes('penjualan') || q.includes('transaksi') || q.includes('kemarin')) {
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
