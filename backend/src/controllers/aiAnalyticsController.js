import { successResponse, errorResponse } from '../utils/response.js';
import { getTodayTopSellingData, getRoleScopedBusinessContext } from '../services/salesAnalyticsEngine.js';
import { generateSalesAnalyticsNarrative, getAiSettings } from '../services/aiService.js';
import {
  calculateStockRunoutForecast,
  calculatePeakHourAndRevenueForecast,
  generateClosingComparison,
} from '../services/aiPredictiveEngine.js';
import {
  dispatchMorningBriefing,
  dispatchEveningWrapup,
  dispatchStockoutAlert,
} from '../services/aiProactiveScheduler.js';
import {
  classifyIntent,
  resolveActionHint,
  composeUnifiedSystemPrompt,
} from '../services/ai/aiPromptComposer.js';
import { getUnifiedAiContext } from '../services/ai/komaziAiContextAggregator.js';
import { universalSchedulerAgent } from '../services/ai/universalSchedulerAgent.js';
import { parseNaturalScheduleText } from '../services/cron/naturalScheduleParser.js';

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
    const { query = 'Menu apa yang paling laku hari ini?', history = [], userName: bodyUserName } = req.body || {};
    const userRole = (req.user?.role || 'CASHIER').toUpperCase();
    const userId = req.user?.id || null;
    const userName = req.user?.name || req.user?.username || bodyUserName || '';

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

    // 2. Pemeriksaan Penjadwalan & Perintah Cron Job via Percakapan AI
    const qLower = (query || '').toLowerCase().trim();
    const isScheduleQuery =
      qLower.includes('jadwal') ||
      qLower.includes('cron') ||
      qLower.includes('ingatkan') ||
      qLower.includes('reminder') ||
      qLower.includes('setiap jam') ||
      qLower.includes('tiap jam') ||
      qLower.includes('setiap hari') ||
      qLower.includes('tiap hari');

    if (isScheduleQuery) {
      const isManagerOrOwner = userRole === 'OWNER' || userRole === 'MANAGER';
      if (!isManagerOrOwner) {
        return successResponse(
          res,
          {
            query,
            answer: `Maaf ${userName ? `Kak ${userName}` : 'Rekan Kasir'}, pembuatan tugas otomatis dan pengaturan cron job memerlukan otorisasi **Owner** atau **Manager**. Silakan hubungi Owner/Manager untuk mengatur jadwal ini ya.`,
            roleScope: userRole,
            provider: 'SCHEDULE_SECURITY',
            model: 'Komazi AI',
            latencyTier: 'Zero-Latency Guard',
            intent: 'SCHEDULE_FORBIDDEN',
            generatedAt: new Date().toISOString(),
          },
          'Otorisasi jadwal ditolak untuk role non-manajerial'
        );
      }

      // Kasus A: Permintaan melihat daftar jadwal aktif
      if (
        qLower.includes('daftar jadwal') ||
        qLower.includes('list jadwal') ||
        qLower.includes('jadwal aktif') ||
        qLower.includes('cron job aktif') ||
        qLower.includes('apa saja jadwal') ||
        qLower.includes('lihat jadwal') ||
        qLower.includes('jadwal saya')
      ) {
        const listText = await universalSchedulerAgent.listActiveSchedulesNatural({
          id: userId,
          role: userRole,
          name: userName,
        });
        const cleanMarkdown = listText
          .replace(/<b>/g, '**')
          .replace(/<\/b>/g, '**')
          .replace(/<i>/g, '*')
          .replace(/<\/i>/g, '*');

        return successResponse(
          res,
          {
            query,
            answer: cleanMarkdown,
            roleScope: userRole,
            provider: 'UNIVERSAL_SCHEDULER',
            model: 'Komazi AI',
            latencyTier: 'Direct DB Agent',
            intent: 'LIST_SCHEDULES',
            generatedAt: new Date().toISOString(),
          },
          'Daftar jadwal aktif berhasil dimuat'
        );
      }

      // Kasus B: Pembuatan / Penjadwalan Cron Job Otomatis
      const parsedSchedule = parseNaturalScheduleText(query);
      if (parsedSchedule) {
        const scheduleResult = await universalSchedulerAgent.executeSchedule(
          parsedSchedule,
          { id: userId, role: userRole, name: userName }
        );
        const cleanMarkdown = (scheduleResult.message || '')
          .replace(/<b>/g, '**')
          .replace(/<\/b>/g, '**')
          .replace(/<i>/g, '*')
          .replace(/<\/i>/g, '*');

        return successResponse(
          res,
          {
            query,
            answer: cleanMarkdown,
            roleScope: userRole,
            provider: 'UNIVERSAL_SCHEDULER',
            model: 'Komazi AI',
            latencyTier: 'Direct Action Agent',
            intent: 'CREATE_SCHEDULE',
            data: scheduleResult.data,
            generatedAt: new Date().toISOString(),
          },
          'Jadwal otomatis berhasil diproses'
        );
      }
    }

    // 3. Klasifikasi intent pertanyaan dan pemetaan Action Hint
    const classification = classifyIntent(query);
    const actionHint = resolveActionHint({
      intent: classification.intent,
      matchedSop: classification.matchedSop,
      query,
    });

    // 3. Ambil data konteks operasional terpadu (Role-Scoped Zero Data Leakage)
    const unifiedContext = await getUnifiedAiContext({
      user: { id: userId, role: userRole, name: userName },
      userQuery: query,
    });
    const businessContext = unifiedContext.businessContext;

    // 4. Susun system prompt terpadu (Unified System Prompt)
    const systemPrompt = composeUnifiedSystemPrompt({
      user: { id: userId, role: userRole, name: userName },
      userQuery: query,
      unifiedContext,
      intent: classification.intent,
      matchedSop: classification.matchedSop,
    });

    // 5. Panggil AI Service dengan multi-tier fallback
    const aiResult = await generateSalesAnalyticsNarrative(
      query,
      businessContext,
      history,
      userRole,
      userName,
      { systemPrompt, matchedSop: classification.matchedSop }
    );

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
      intent: classification.intent,
      intentMeta: classification.meta,
      actionHint: actionHint || null,
      matchedSop: classification.matchedSop
        ? { id: classification.matchedSop.id, title: classification.matchedSop.title }
        : null,
      metrics: {
        todayTotalOrders: todaySales.totalOrders || 0,
        todayTotalRevenue: todaySales.totalRevenue || 0,
        todayTotalRevenueFormatted: todaySales.totalRevenueFormatted || null,
        yesterdayTotalOrders: yesterdaySales.totalOrders || 0,
        yesterdayTotalRevenue: yesterdaySales.totalRevenue || 0,
        yesterdayTotalRevenueFormatted: yesterdaySales.totalRevenueFormatted || null,
        yesterdayHasSales: yesterdaySales.hasSales || false,
        yesterdayDateFormatted: yesterdaySales.dateFormatted || null,
        yesterdayPeakHour: yesterdaySales.peakHour || null,
        yesterdayTopProducts: yesterdaySales.topProducts || yesterdaySales.topProductsForUpsell || [],
        previousActiveDay: yesterdaySales.previousActiveDay || null,
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
    const isFallback = Boolean(metricsData.isFallbackToRecent);
    const top1 = (!isFallback && metricsData.topProducts?.[0]) ? metricsData.topProducts[0] : null;

    const summary = {
      hasSales: !isFallback && metricsData.todayTotalOrders > 0,
      isFallbackToRecent: isFallback,
      todayRevenue: isFallback ? 'Rp 0' : metricsData.todayTotalRevenueFormatted,
      todayOrders: isFallback ? 0 : metricsData.todayTotalOrders,
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
      ezkielynaConfigured: !!settings.ezkielynaApiKey,
      ezkielynaModel: settings.ezkielynaModel,
      openrouterConfigured: !!settings.openrouterApiKey,
      openrouterModel: settings.openrouterModel,
      primaryProvider: settings.primaryProvider,
      tiers: [
        'Tier 1: Groq Cloud LPU (Ultra-Fast ~300ms)',
        'Tier 2: Google Gemini Cloud AI (Generative Flash Model)',
        'Tier 3: Ezkielyna AI Cloud (High-Speed DeepSeek/GLM/Kimi)',
        'Tier 4: OpenRouter AI Cloud (High-Availability LLM)',
        'Tier 5: Komazi Deterministic Engine (Offline Local Fallback)',
      ],
      source: '.env',
    };

    return successResponse(res, result, 'Status konfigurasi AI provider via .env');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

/**
 * Mendapatkan data kalkulasi analitik prediktif & stok runout secara lengkap
 */
export async function getAiForecast(req, res) {
  try {
    const [stockRunout, peakForecast, closingWrapup] = await Promise.all([
      calculateStockRunoutForecast(),
      calculatePeakHourAndRevenueForecast(),
      generateClosingComparison(),
    ]);

    const result = {
      stockRunout,
      peakForecast,
      closingWrapup,
    };

    return successResponse(res, result, 'Data analitik prediktif dan estimasi stok berhasil diambil');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

/**
 * Memicu pengiriman kartu visual notifikasi proaktif Telegram secara instan (Testing / Manual Action)
 */
export async function triggerProactiveTelegram(req, res) {
  try {
    const { type = 'morning', targetChatId = null, force = true } = req.body || {};

    let result = null;
    if (type === 'morning') {
      result = await dispatchMorningBriefing(targetChatId);
    } else if (type === 'evening') {
      result = await dispatchEveningWrapup(targetChatId);
    } else if (type === 'stockout') {
      result = await dispatchStockoutAlert(force, targetChatId);
    } else {
      return errorResponse(res, `Tipe trigger '${type}' tidak valid. Gunakan 'morning', 'evening', atau 'stockout'.`, 400);
    }

    if (!result.success) {
      return errorResponse(res, result.error || 'Gagal mengirim notifikasi proaktif', 500);
    }

    return successResponse(res, result, `Pemicu notifikasi proaktif (${type}) berhasil dikirim ke Telegram`);
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}
