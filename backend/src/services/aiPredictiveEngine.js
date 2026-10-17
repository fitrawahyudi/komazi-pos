import prisma from '../config/db.js';
import { generateSalesAnalyticsNarrative } from './aiService.js';

/**
 * Helper to format currency in Indonesian Rupiah
 */
export function formatRupiah(amount) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(amount || 0));
}

/**
 * Safe division helper to avoid division by zero or NaN
 */
function safeDivide(numerator, denominator, fallback = 0) {
  if (!denominator || isNaN(denominator) || denominator === 0) return fallback;
  const result = numerator / denominator;
  return isNaN(result) || !isFinite(result) ? fallback : result;
}

/**
 * Get start and end of today in local time
 */
export function getTodayDateBounds(referenceDate = new Date()) {
  const startOfToday = new Date(referenceDate);
  startOfToday.setHours(0, 0, 0, 0);

  const endOfToday = new Date(referenceDate);
  endOfToday.setHours(23, 59, 59, 999);

  return { startOfToday, endOfToday };
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. STOCK RUNOUT & BURN-RATE FORECASTING ENGINE
 * ─────────────────────────────────────────────────────────────────────────────
 * Menghitung laju pemakaian bahan baku per jam (burn rate) hari ini
 * dan mengestimasikan sisa waktu sebelum stok habis (runout countdown)
 */
export async function calculateStockRunoutForecast(referenceDate = new Date()) {
  const { startOfToday, endOfToday } = getTodayDateBounds(referenceDate);
  const now = new Date(referenceDate);

  // Ambil semua bahan baku aktif beserta resep produk terkait
  const ingredients = await prisma.ingredient.findMany({
    include: {
      recipeItems: {
        include: {
          product: true,
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  // Ambil pesanan yang telah dibayar (PAID) hari ini
  const todayOrders = await prisma.order.findMany({
    where: {
      status: { in: ['PAID', 'PREPARING', 'IN_PROGRESS', 'PARTIALLY_READY', 'READY', 'SERVED', 'COMPLETED'] },
      createdAt: { gte: startOfToday, lte: endOfToday },
    },
    include: {
      items: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  // Tentukan jam mulai operasional hari ini
  // Default jam 08:00 pagi atau waktu transaksi pertama jika lebih pagi
  const defaultOpenTime = new Date(startOfToday);
  defaultOpenTime.setHours(8, 0, 0, 0);

  const firstOrderTime = todayOrders.length > 0 ? new Date(todayOrders[0].createdAt) : now;
  const storeStartTime = firstOrderTime < defaultOpenTime ? firstOrderTime : defaultOpenTime;

  // Durasi jam toko beroperasi hari ini (minimal 0.75 jam / 45 menit untuk menghindari lonjakan deviasi awal)
  const hoursElapsed = Math.max(0.75, (now.getTime() - storeStartTime.getTime()) / (1000 * 60 * 60));

  // Hitung total penggunaan bahan hari ini berdasarkan item pesanan dan BOM (Bill of Materials)
  const ingredientUsageMap = new Map();

  for (const order of todayOrders) {
    for (const item of order.items) {
      const pId = item.productId;
      const vName = item.variantName;
      const qtySold = item.qty || 1;

      // Cari resep untuk produk ini
      for (const ing of ingredients) {
        for (const recipe of ing.recipeItems) {
          if (recipe.productId === pId) {
            // Jika ada varian spesifik atau produk reguler
            const matchesVariant = !recipe.variantId || (recipe.variant && recipe.variant.name === vName);
            if (matchesVariant) {
              const portionQty = parseFloat(recipe.quantity || 0);
              const totalUsedForItem = portionQty * qtySold;
              const currentUsage = ingredientUsageMap.get(ing.id) || 0;
              ingredientUsageMap.set(ing.id, currentUsage + totalUsedForItem);
            }
          }
        }
      }
    }
  }

  // Jika hari ini belum banyak order tapi ada data StockMovement type 'SALE', kombinasikan
  const saleMovements = await prisma.stockMovement.findMany({
    where: {
      type: 'SALE',
      createdAt: { gte: startOfToday, lte: endOfToday },
    },
  });

  for (const sm of saleMovements) {
    const qty = Math.abs(parseFloat(sm.qty || 0));
    const currentUsage = ingredientUsageMap.get(sm.ingredientId) || 0;
    // Ambil nilai terbesar antara kalkulasi resep vs movement log
    if (qty > currentUsage) {
      ingredientUsageMap.set(sm.ingredientId, qty);
    }
  }

  const items = [];
  let criticalCount = 0;
  let outOfStockCount = 0;

  for (const ing of ingredients) {
    const currentStock = parseFloat(ing.stock || 0);
    const minStock = parseFloat(ing.minStock || 0);
    const totalUsedToday = ingredientUsageMap.get(ing.id) || 0;

    // Laju konsumsi bahan per jam
    const burnRatePerHour = safeDivide(totalUsedToday, hoursElapsed, 0);

    let hoursUntilStockout = Infinity;
    let estimatedRunoutTime = null;
    let riskLevel = 'SAFE';

    if (currentStock <= 0) {
      riskLevel = 'OUT_OF_STOCK';
      hoursUntilStockout = 0;
      outOfStockCount++;
    } else if (burnRatePerHour > 0) {
      hoursUntilStockout = safeDivide(currentStock, burnRatePerHour, Infinity);

      if (hoursUntilStockout !== Infinity) {
        estimatedRunoutTime = new Date(now.getTime() + hoursUntilStockout * 3600 * 1000);

        // Kategori resiko
        if (hoursUntilStockout <= 2.5) {
          riskLevel = 'CRITICAL_RUNOUT'; // Bahaya: akan habis < 2.5 jam
          criticalCount++;
        } else if (hoursUntilStockout <= 5.0 || currentStock <= minStock) {
          riskLevel = 'LOW_STOCK_SOON'; // Perlu dipantau: habis dalam 2.5 - 5 jam
        } else {
          riskLevel = 'SAFE';
        }
      }
    } else if (currentStock <= minStock) {
      riskLevel = 'LOW_STOCK_SOON';
    }

    // Rekomendasi kuantitas restock darurat (buffer 8 jam operasional ke depan)
    let recommendedRestock = 0;
    if (burnRatePerHour > 0) {
      const neededFor8Hours = burnRatePerHour * 8;
      const deficit = neededFor8Hours - currentStock;
      recommendedRestock = deficit > 0 ? Math.ceil(deficit * 1.2) : Math.ceil(minStock);
    } else if (currentStock <= minStock) {
      recommendedRestock = Math.ceil(Math.max(1, (minStock * 2) - currentStock));
    }

    items.push({
      id: ing.id,
      name: ing.name,
      unit: ing.unit,
      currentStock: Math.round(currentStock * 100) / 100,
      minStock: Math.round(minStock * 100) / 100,
      totalUsedToday: Math.round(totalUsedToday * 100) / 100,
      burnRatePerHour: Math.round(burnRatePerHour * 100) / 100,
      hoursUntilStockout: isFinite(hoursUntilStockout) ? Math.round(hoursUntilStockout * 10) / 10 : null,
      estimatedRunoutTime: estimatedRunoutTime
        ? estimatedRunoutTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB'
        : null,
      riskLevel,
      recommendedRestock,
    });
  }

  // Urutkan item dari yang paling kritis
  const riskPriority = { OUT_OF_STOCK: 1, CRITICAL_RUNOUT: 2, LOW_STOCK_SOON: 3, SAFE: 4 };
  items.sort((a, b) => {
    const pDiff = (riskPriority[a.riskLevel] || 99) - (riskPriority[b.riskLevel] || 99);
    if (pDiff !== 0) return pDiff;
    return (a.hoursUntilStockout || 999) - (b.hoursUntilStockout || 999);
  });

  const criticalItems = items.filter(
    (i) => i.riskLevel === 'OUT_OF_STOCK' || i.riskLevel === 'CRITICAL_RUNOUT' || i.riskLevel === 'LOW_STOCK_SOON'
  );

  return {
    calculatedAt: now.toISOString(),
    hoursElapsed: Math.round(hoursElapsed * 10) / 10,
    totalIngredientsCount: ingredients.length,
    criticalCount,
    outOfStockCount,
    hasCriticalRisk: criticalCount > 0 || outOfStockCount > 0,
    criticalItems,
    allItems: items,
  };
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * 2. PEAK HOUR & SALES FORECASTING ENGINE
 * ─────────────────────────────────────────────────────────────────────────────
 * Menganalisis historis transaksi per jam pada hari yang sama (4 minggu terakhir)
 * untuk memproyeksikan jam sibuk dan estimasi omset penutupan hari ini.
 */
export async function calculatePeakHourAndRevenueForecast(referenceDate = new Date()) {
  const { startOfToday, endOfToday } = getTodayDateBounds(referenceDate);
  const now = new Date(referenceDate);

  // 1. Ambil transaksi PAID hari ini
  const todayOrders = await prisma.order.findMany({
    where: {
      status: { in: ['PAID', 'PREPARING', 'IN_PROGRESS', 'PARTIALLY_READY', 'READY', 'SERVED', 'COMPLETED'] },
      createdAt: { gte: startOfToday, lte: endOfToday },
    },
    include: { items: true },
    orderBy: { createdAt: 'asc' },
  });

  const todayRevenue = todayOrders.reduce((sum, o) => sum + parseFloat(o.total || 0), 0);
  const todayOrderCount = todayOrders.length;

  // 2. Ambil transaksi kemarin (full day)
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const endOfYesterday = new Date(startOfToday);
  endOfYesterday.setMilliseconds(-1);

  const yesterdayOrders = await prisma.order.findMany({
    where: {
      status: { in: ['PAID', 'PREPARING', 'IN_PROGRESS', 'PARTIALLY_READY', 'READY', 'SERVED', 'COMPLETED'] },
      createdAt: { gte: startOfYesterday, lte: endOfYesterday },
    },
    include: { items: true },
  });

  const yesterdayRevenue = yesterdayOrders.reduce((sum, o) => sum + parseFloat(o.total || 0), 0);
  const yesterdayOrderCount = yesterdayOrders.length;

  // 3. Ambil data historis 30 hari terakhir untuk mendapatkan pola transaksi & jam sibuk riil
  const past30DaysStart = new Date(startOfToday);
  past30DaysStart.setDate(past30DaysStart.getDate() - 30);

  const pastOrders = await prisma.order.findMany({
    where: {
      status: { in: ['PAID', 'PREPARING', 'IN_PROGRESS', 'PARTIALLY_READY', 'READY', 'SERVED', 'COMPLETED'] },
      createdAt: { gte: past30DaysStart, lte: endOfToday },
    },
    include: { items: true },
    orderBy: { createdAt: 'desc' },
  });

  // Agregasi kurva per jam dari data riil
  const hourlyCount = {};
  for (let h = 0; h < 24; h++) hourlyCount[h] = 0;
  for (const o of pastOrders) {
    const h = new Date(o.createdAt).getHours();
    hourlyCount[h] = (hourlyCount[h] || 0) + 1;
  }

  // Tentukan jam sibuk riil dari database
  // Pisahkan jam sore (13:00 - 17:00) dan malam (18:00 - 23:00)
  const afternoonHours = [13, 14, 15, 16, 17].filter((h) => hourlyCount[h] > 0);
  const eveningHours = [18, 19, 20, 21, 22].filter((h) => hourlyCount[h] > 0);

  let primaryPeakWindow = '18:00 - 22:00 WIB';
  let secondaryPeakWindow = '14:00 - 17:00 WIB';

  if (eveningHours.length > 0) {
    const minH = Math.min(...eveningHours);
    const maxH = Math.max(...eveningHours) + 1;
    primaryPeakWindow = `${String(minH).padStart(2, '0')}:00 - ${String(maxH).padStart(2, '0')}:00 WIB`;
  }

  if (afternoonHours.length > 0) {
    const minH = Math.min(...afternoonHours);
    const maxH = Math.max(...afternoonHours) + 1;
    secondaryPeakWindow = `${String(minH).padStart(2, '0')}:00 - ${String(maxH).padStart(2, '0')}:00 WIB`;
  }

  // 4. Hitung omzet 7 hari terakhir dan rata-rata harian
  const past7DaysStart = new Date(startOfToday);
  past7DaysStart.setDate(past7DaysStart.getDate() - 7);
  const past7DaysOrders = pastOrders.filter((o) => new Date(o.createdAt) >= past7DaysStart);
  const past7DaysRevenue = past7DaysOrders.reduce((sum, o) => sum + parseFloat(o.total || 0), 0);

  const distinctDays = new Set(past7DaysOrders.map((o) => new Date(o.createdAt).toISOString().slice(0, 10))).size;
  const daysDivisor = Math.max(1, distinctDays);
  const historicalDailyAverage = Math.round(past7DaysRevenue / daysDivisor);

  // 5. Proyeksi Target Omset yang realistis
  let projectedTotalRevenue = 0;
  const currentHour = now.getHours();

  if (todayRevenue > 0) {
    const hoursOpen = Math.max(1, currentHour - 8);
    const hourlyRate = todayRevenue / hoursOpen;
    const remainingHours = Math.max(1, 22 - currentHour);
    const estimatedExtra = hourlyRate * remainingHours;
    projectedTotalRevenue = Math.max(todayRevenue + estimatedExtra, historicalDailyAverage * 1.1);
  } else {
    const baseTarget = yesterdayRevenue > 0 ? (yesterdayRevenue * 0.6 + historicalDailyAverage * 0.4) : historicalDailyAverage;
    projectedTotalRevenue = Math.max(baseTarget * 1.15, 200000);
  }
  projectedTotalRevenue = Math.round(projectedTotalRevenue);

  // 6. Menu terlaris 7 hari terakhir dari database riil
  const productCountMap = new Map();
  for (const o of past7DaysOrders) {
    for (const item of o.items) {
      const cur = productCountMap.get(item.productName) || { qty: 0, revenue: 0 };
      cur.qty += (item.qty || 1);
      cur.revenue += parseFloat(item.lineTotal || (item.price * item.qty) || 0);
      productCountMap.set(item.productName, cur);
    }
  }

  const topProducts = Array.from(productCountMap.entries())
    .map(([name, data]) => ({ name, qty: data.qty, revenue: data.revenue }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);

  const topProductsList = topProducts.length > 0
    ? topProducts.map((p, i) => `${i + 1}. ${p.name} (${p.qty} terjual)`).join(', ')
    : 'Belum ada transaksi';

  // 7. Cek stok bahan kritis riil
  const allIngredients = await prisma.ingredient.findMany({
    select: { name: true, stock: true, minStock: true, unit: true },
  });
  const criticalStockItems = allIngredients.filter((i) => Number(i.stock) <= Number(i.minStock));
  const criticalStockSummary = criticalStockItems.length > 0
    ? criticalStockItems.map((i) => `${i.name} (sisa ${i.stock} ${i.unit})`).join(', ')
    : 'Semua bahan baku utama dalam kondisi aman';

  // 8. Actionable prep advice dinamis berbasis data riil
  const prepAdvice = [];
  if (topProducts.length > 0) {
    const topNames = topProducts.slice(0, 2).map((p) => p.name).join(' & ');
    prepAdvice.push(`Siapkan bahan ekstra untuk menu terfavorit: ${topNames}.`);
  }
  prepAdvice.push(`Fokuskan kesiapan staf barista & kasir menjelang jam ramai (${primaryPeakWindow}).`);
  if (criticalStockItems.length > 0) {
    prepAdvice.push(`⚠️ Restock segera: ${criticalStockItems[0].name} (stok kritis).`);
  } else {
    prepAdvice.push('Pemeriksaan kebersihan meja & koneksi Wi-Fi area workspace.');
  }

  return {
    referenceDate: now.toISOString(),
    dayName: now.toLocaleDateString('id-ID', { weekday: 'long' }),
    currentRevenue: todayRevenue,
    currentRevenueFormatted: formatRupiah(todayRevenue),
    todayOrderCount,
    yesterdayRevenue,
    yesterdayRevenueFormatted: formatRupiah(yesterdayRevenue),
    yesterdayOrderCount,
    recent7DaysRevenue: past7DaysRevenue,
    recent7DaysRevenueFormatted: formatRupiah(past7DaysRevenue),
    historicalDailyAverage,
    historicalDailyAverageFormatted: formatRupiah(historicalDailyAverage),
    projectedTotalRevenue,
    projectedRevenueFormatted: formatRupiah(projectedTotalRevenue),
    confidenceLevel: 'DATA_DRIVEN_REALTIME',
    primaryPeakWindow,
    secondaryPeakWindow,
    topProducts,
    topProductsList,
    criticalStockItems,
    criticalStockSummary,
    prepAdvice,
  };
}

/**
 * Menghasilkan narasi analisis prediksi real-time menggunakan AI LLM (Groq / Gemini)
 * berdasarkan data statistik transaksi aktual dan metrik kedai hari ini.
 * @param {object} forecast - Hasil dari calculatePeakHourAndRevenueForecast()
 * @returns {Promise<string>} Analisis eksekutif tajam dan anti-template
 */
export async function generateRealAiPredictionAnalysis(forecast) {
  const systemPrompt = `Anda adalah Komazi AI — Chief Intelligence Officer untuk kedai kopi & workspace "Komazi".
Tugas Anda memberikan analisis prediksi bisnis harian (executive predictive briefing) untuk Owner secara REAL, berbasis data aktual toko, tajam, profesional, dan anti-template.
DILARANG menggunakan kata-kata klise/template generic.
Format output HTML Telegram:
- Gunakan tag <b>bold</b> untuk penekanan angka dan insight penting
- Berikan analisis bernilai tinggi: proyeksi omset, pola jam sibuk riil, strategi menu primadona, dan rekomendasi operasional taktis hari ini.
- Batasi panjang output agar nyaman dibaca di Telegram (maksimal 3 paragraf padat).`;

  const prompt = `Data transaksi riil kedai Komazi saat ini:
- Hari/Tanggal: ${forecast.dayName}, ${new Date().toLocaleDateString('id-ID', { dateStyle: 'full' })}
- Omzet hari ini: ${forecast.currentRevenueFormatted} (${forecast.todayOrderCount} transaksi)
- Omzet kemarin: ${forecast.yesterdayRevenueFormatted} (${forecast.yesterdayOrderCount} transaksi)
- Rata-rata harian 7 hari: ${forecast.historicalDailyAverageFormatted} (Total 7 hari: ${forecast.recent7DaysRevenueFormatted})
- Target proyeksi hari ini: ${forecast.projectedRevenueFormatted}
- Jam ramai riil: ${forecast.primaryPeakWindow} dan ${forecast.secondaryPeakWindow}
- Menu terlaris 7 hari: ${forecast.topProductsList}
- Status stok bahan baku: ${forecast.criticalStockSummary}

Berikan analisis prediksi bisnis harian yang tajam untuk Owner hari ini.`;

  try {
    const aiResult = await generateSalesAnalyticsNarrative(prompt, {}, [], 'OWNER', 'Owner', { systemPrompt });
    if (aiResult?.text) {
      return aiResult.text.trim();
    }
  } catch (err) {
    console.warn('[AIPredictiveEngine] AI LLM error, generating dynamic fallback:', err.message);
  }

  // Dynamic fallback berbasis data nyata (BUKAN template statis)
  return `
• <b>Proyeksi Omzet:</b> Target hari ini dipatok <b>${forecast.projectedRevenueFormatted}</b>. Berdasarkan pencapaian kemarin (${forecast.yesterdayRevenueFormatted} dari ${forecast.yesterdayOrderCount} transaksi), kedai berpeluang melampaui rata-rata harian (${forecast.historicalDailyAverageFormatted}).
• <b>Jam Sibuk:</b> Puncak trafik riil diperkirakan terjadi pada <b>${forecast.primaryPeakWindow}</b> dan <b>${forecast.secondaryPeakWindow}</b>. Pastikan tim kasir dan barista dalam kondisi siaga penuh.
• <b>Menu Primadona:</b> Penjualan didorong oleh <b>${forecast.topProductsList}</b>. Pastikan bahan baku racikan menu tersebut tersedia melimpah sebelum jam sibuk tiba.
• <b>Langkah Taktis:</b> Tawarkan bundling minuman primadona dengan pastry/snack untuk menaikkan Average Order Value (AOV).
  `.trim();
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * 3. DAILY CLOSING WRAP-UP & COMPARISON ENGINE
 * ─────────────────────────────────────────────────────────────────────────────
 * Membandingkan performa omset penutupan vs proyeksi awal hari
 * dan menyajikan ringkasan efisiensi penjualan.
 */
export async function generateClosingComparison(referenceDate = new Date()) {
  const { startOfToday, endOfToday } = getTodayDateBounds(referenceDate);
  const now = new Date(referenceDate);

  // Ambil transaksi hari ini
  const todayOrders = await prisma.order.findMany({
    where: {
      status: { in: ['PAID', 'PREPARING', 'IN_PROGRESS', 'PARTIALLY_READY', 'READY', 'SERVED', 'COMPLETED'] },
      createdAt: { gte: startOfToday, lte: endOfToday },
    },
    include: { items: true },
  });

  const actualTotalRevenue = todayOrders.reduce((sum, o) => sum + parseFloat(o.total || 0), 0);
  const totalTransactions = todayOrders.length;

  // Ambil forecast baseline
  const forecast = await calculatePeakHourAndRevenueForecast(referenceDate);
  const projectedRevenue = forecast.projectedTotalRevenue || actualTotalRevenue;

  // Variansi & tingkat ketercapaian target
  const revenueVariance = actualTotalRevenue - projectedRevenue;
  const achievementRatePct = Math.round(safeDivide(actualTotalRevenue, projectedRevenue, 1) * 100);

  let performanceBadge = 'TARGET_ACHIEVED';
  let badgeLabel = 'Sesuai Target ✅';
  if (achievementRatePct >= 110) {
    performanceBadge = 'EXCEEDED_TARGET';
    badgeLabel = 'Melampaui Target 🔥';
  } else if (achievementRatePct < 85) {
    performanceBadge = 'BELOW_TARGET';
    badgeLabel = 'Di Bawah Target ⚠️';
  }

  // Rekap menu terlaris
  const productCountMap = new Map();
  for (const o of todayOrders) {
    for (const item of o.items) {
      const cur = productCountMap.get(item.productName) || { qty: 0, revenue: 0 };
      cur.qty += item.qty;
      cur.revenue += parseFloat(item.lineTotal || 0);
      productCountMap.set(item.productName, cur);
    }
  }

  const topProducts = Array.from(productCountMap.entries())
    .map(([name, data]) => ({ name, qty: data.qty, revenue: data.revenue }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 3);

  // Ambil status stok kritis saat ini
  const stockForecast = await calculateStockRunoutForecast(referenceDate);

  return {
    closedAt: now.toISOString(),
    dateFormatted: now.toLocaleDateString('id-ID', { dateStyle: 'full' }),
    actualRevenue: actualTotalRevenue,
    actualRevenueFormatted: formatRupiah(actualTotalRevenue),
    projectedRevenue,
    projectedRevenueFormatted: formatRupiah(projectedRevenue),
    revenueVariance,
    varianceFormatted: (revenueVariance >= 0 ? '+' : '') + formatRupiah(revenueVariance),
    achievementRatePct,
    performanceBadge,
    badgeLabel,
    totalTransactions,
    topProducts,
    remainingCriticalStockCount: stockForecast.criticalCount + stockForecast.outOfStockCount,
    criticalItemsSummary: stockForecast.criticalItems.slice(0, 3),
  };
}
