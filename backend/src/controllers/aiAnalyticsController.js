import { successResponse, errorResponse } from '../utils/response.js';
import { getTodayTopSellingData, getRoleScopedBusinessContext } from '../services/salesAnalyticsEngine.js';
import { generateSalesAnalyticsNarrative, getAiSettings } from '../services/aiService.js';

// In-memory cache: queryKey -> { data, timestamp }
const analyticsCache = new Map();
const CACHE_TTL_MS = 60 * 1000; // 60 detik

function getCacheKey(query, role, userId) {
  const normalized = (query || '').toLowerCase().trim();
  const now = new Date();
  const timeWindow = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}-${now.getMinutes()}`;
  return `${normalized}__r_${role}_u${userId || 0}__${timeWindow}`;
}

/**
 * Handle Natural Language Query for Sales Analytics with Role-Based Knowledge Scoping
 */
export async function askAi(req, res) {
  try {
    const { query = 'Menu apa yang paling laku hari ini?', history = [] } = req.body || {};
    const userRole = (req.user?.role || 'CASHIER').toUpperCase();
    const userId = req.user?.id || null;

    const isMultiTurn = Array.isArray(history) && history.length > 0;
    const cacheKey = isMultiTurn
      ? `${getCacheKey(query, userRole, userId)}__h${history.length}_${(history[history.length - 1]?.text || '').slice(0, 20)}`
      : getCacheKey(query, userRole, userId);

    // 1. Cek In-Memory Cache (hanya jika pesan pertama tanpa history bertingkat)
    if (!isMultiTurn) {
      const cached = analyticsCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return successResponse(
          res,
          { ...cached.data, fromCache: true },
          'Analisis AI berhasil (diambil dari cache memory)'
        );
      }
    }

    // 2. Ambil data konteks bisnis yang telah difilter ketat per role (Zero Data Leakage)
    const businessContext = await getRoleScopedBusinessContext({ role: userRole, userId });

    // 3. Panggil AI Service dengan system prompt dinamis per role
    const aiResult = await generateSalesAnalyticsNarrative(query, businessContext, history, userRole);

    const todaySales = businessContext.salesSummary?.today || {};
    const yesterdaySales = businessContext.salesSummary?.yesterday || {};
    const thisMonthSales = businessContext.salesSummary?.thisMonth || {};
    const inventoryData = businessContext.inventory || {};

    const responsePayload = {
      query,
      answer: aiResult.text,
      roleScope: userRole,
      provider: aiResult.provider,
      model: aiResult.model || 'Komazi AI',
      latencyTier: aiResult.latencyTier || 'Komazi AI',
      metrics: {
        todayTotalOrders: todaySales.totalOrders || 0,
        todayTotalRevenue: todaySales.totalRevenue || 0,
        todayTotalRevenueFormatted: todaySales.totalRevenueFormatted || null,
        yesterdayTotalRevenueFormatted: yesterdaySales.totalRevenueFormatted || null,
        monthTotalRevenueFormatted: thisMonthSales.totalRevenueFormatted || null,
        isFallbackToRecent: todaySales.isFallbackToRecent || false,
        peakHour: todaySales.peakHour || null,
        topProducts: todaySales.topProducts || todaySales.topProductsForUpsell || [],
        ingredientAlerts: (inventoryData.criticalLowStockItems || []).map((i) => ({
          ingredientName: i.name || i.ingredientName,
          currentStock: i.currentStock,
          unit: i.unit,
          isLowStock: true,
          estimatedPortionsLeft: i.currentStock,
        })),
        activeShiftsCount: businessContext.currentShift?.isOpen ? 1 : 0,
        activeWorkspaceCount: businessContext.workspace?.totalActiveSessions || 0,
      },
      followUps: [],
      generatedAt: new Date().toISOString(),
    };

    // Simpan ke cache jika pertanyaan pertama
    if (!isMultiTurn) {
      analyticsCache.set(cacheKey, {
        data: responsePayload,
        timestamp: Date.now(),
      });
    }

    return successResponse(res, responsePayload, 'Analisis AI penjualan & operasional berhasil dibuat');
  } catch (err) {
    console.error('[AIAnalyticsController] Error askAi:', err);
    return errorResponse(res, `Gagal memproses analitik AI: ${err.message}`, 500);
  }
}

/**
 * Quick summary endpoint for widgets and dashboard banners
 */
export async function getQuickSalesInsight(req, res) {
  try {
    const metricsData = await getTodayTopSellingData(3);
    const top1 = metricsData.topProducts?.[0] || null;

    const summary = {
      hasSales: metricsData.todayTotalOrders > 0,
      isFallbackToRecent: metricsData.isFallbackToRecent,
      todayRevenue: metricsData.todayTotalRevenueFormatted,
      todayOrders: metricsData.todayTotalOrders,
      topProduct: top1 ? {
        id: top1.productId,
        name: top1.productName,
        qty: top1.qtySold,
        revenue: top1.revenueFormatted,
        share: `${top1.revenueSharePercent}%`,
      } : null,
      lowStockAlertCount: (metricsData.ingredientAlerts || []).filter(i => i.isLowStock).length,
    };

    return successResponse(res, summary, 'Ringkasan insight penjualan terkini');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

/**
 * Health-check & connection test for AI providers (Groq, Gemini, OpenRouter)
 */
export async function testAiConnection(req, res) {
  try {
    const settings = await getAiSettings();
    const result = {
      groqConfigured: !!settings.groqApiKey,
      groqModel: settings.groqModel,
      geminiConfigured: !!settings.geminiApiKey,
      geminiModel: settings.geminiModel,
      openrouterConfigured: !!settings.openrouterApiKey,
      openrouterModel: settings.openrouterModel,
      primaryProvider: settings.primaryProvider,
      tiers: [
        'Tier 1: Groq Cloud LPU (Ultra-Fast ~300ms)',
        'Tier 2: Google Gemini Cloud AI (Generative Flash Model)',
        'Tier 3: OpenRouter AI Cloud (High-Availability LLM)',
        'Tier 4: Komazi Deterministic Engine (Offline Local Fallback)',
      ],
      source: '.env',
    };

    return successResponse(res, result, 'Status konfigurasi AI provider via .env');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}
