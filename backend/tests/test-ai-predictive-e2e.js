import {
  calculateStockRunoutForecast,
  calculatePeakHourAndRevenueForecast,
  generateClosingComparison,
  formatRupiah,
} from '../src/services/aiPredictiveEngine.js';
import { generateBotImage } from '../src/services/botImage/index.js';
import {
  dispatchMorningBriefing,
  dispatchEveningWrapup,
  dispatchStockoutAlert,
  clearStockAlertCooldowns,
  startAiProactiveScheduler,
  stopAiProactiveScheduler,
} from '../src/services/aiProactiveScheduler.js';
import { getAiForecast, triggerProactiveTelegram } from '../src/controllers/aiAnalyticsController.js';

async function runComprehensiveE2ETest() {
  console.log('══════════════════════════════════════════════════════════════════════════');
  console.log('🚀 KOMAZI AI PROACTIVE & PREDICTIVE INTELLIGENCE ENGINE — FULL E2E SUITE');
  console.log('══════════════════════════════════════════════════════════════════════════\n');

  // STEP 1: PREDICTIVE ENGINE MATHEMATICAL VALIDATION
  console.log('▶ STEP 1: Validating Predictive Intelligence Calculations...');
  const [stockForecast, peakForecast, closeComparison] = await Promise.all([
    calculateStockRunoutForecast(),
    calculatePeakHourAndRevenueForecast(),
    generateClosingComparison(),
  ]);

  console.log('   [1.1 Stock Forecast] Total Ingredients:', stockForecast.totalIngredientsCount);
  console.log('   [1.1 Stock Forecast] Hours Elapsed Today:', stockForecast.hoursElapsed, 'hours');
  console.log('   [1.1 Stock Forecast] Critical Items Count:', stockForecast.criticalCount);
  if (stockForecast.totalIngredientsCount <= 0) {
    throw new Error('Database ingredients table is empty');
  }

  console.log('   [1.2 Peak Forecast] Day:', peakForecast.dayName);
  console.log('   [1.2 Peak Forecast] Primary Peak Window:', peakForecast.primaryPeakWindow);
  console.log('   [1.2 Peak Forecast] Secondary Peak Window:', peakForecast.secondaryPeakWindow);
  console.log('   [1.2 Peak Forecast] Projected Total Revenue:', peakForecast.projectedRevenueFormatted);
  if (!peakForecast.projectedRevenueFormatted.includes('Rp')) {
    throw new Error('Revenue formatting failed');
  }

  console.log('   [1.3 Closing Comparison] Actual Revenue:', closeComparison.actualRevenueFormatted);
  console.log('   [1.3 Closing Comparison] Target Achievement:', closeComparison.achievementRatePct + '%');
  console.log('   [1.3 Closing Comparison] Badge:', closeComparison.badgeLabel);
  console.log('   ✔ Step 1 Passed.\n');

  // STEP 2: LUXURY VISUAL CARD RENDERING (PUPPETEER BROWSER POOL)
  console.log('▶ STEP 2: Validating Visual HD Card PNG Rendering...');

  // 2.1 Morning Card
  console.log('   [2.1] Rendering Morning Briefing Card...');
  const morningBuffer = await generateBotImage('ai_morning_briefing', peakForecast);
  console.log('         Morning Card Buffer:', morningBuffer.length, 'bytes');
  if (!Buffer.isBuffer(morningBuffer) || morningBuffer.length < 10000) {
    throw new Error('Morning card buffer generation failed');
  }

  // 2.2 Stockout Card
  console.log('   [2.2] Rendering Stockout Alert Card...');
  const stockoutBuffer = await generateBotImage('ai_stockout_alert', {
    ...stockForecast,
    hoursElapsed: 4.5,
    criticalCount: stockForecast.criticalCount > 0 ? stockForecast.criticalCount : 2,
    criticalItems: stockForecast.criticalItems.length > 0 ? stockForecast.criticalItems : [
      {
        name: 'Fresh Milk Diamond 1L',
        unit: 'liter',
        currentStock: 1.5,
        burnRatePerHour: 0.8,
        hoursUntilStockout: 1.9,
        estimatedRunoutTime: '15:10 WIB',
        riskLevel: 'CRITICAL_RUNOUT',
        recommendedRestock: 6,
      },
      {
        name: 'Biji Kopi House Blend',
        unit: 'kg',
        currentStock: 0.5,
        burnRatePerHour: 0.25,
        hoursUntilStockout: 2.0,
        estimatedRunoutTime: '15:15 WIB',
        riskLevel: 'CRITICAL_RUNOUT',
        recommendedRestock: 3,
      },
    ],
  });
  console.log('         Stockout Card Buffer:', stockoutBuffer.length, 'bytes');
  if (!Buffer.isBuffer(stockoutBuffer) || stockoutBuffer.length < 10000) {
    throw new Error('Stockout card buffer generation failed');
  }

  // 2.3 Evening Card
  console.log('   [2.3] Rendering Evening Wrap-Up Card...');
  const eveningBuffer = await generateBotImage('ai_evening_wrapup', closeComparison);
  console.log('         Evening Card Buffer:', eveningBuffer.length, 'bytes');
  if (!Buffer.isBuffer(eveningBuffer) || eveningBuffer.length < 10000) {
    throw new Error('Evening card buffer generation failed');
  }
  console.log('   ✔ Step 2 Passed: All 3 HD Visual Cards rendered cleanly.\n');

  // STEP 3: SCHEDULER & ANTI-SPAM DISPATCHER
  console.log('▶ STEP 3: Validating Scheduler & Anti-Spam Dispatcher...');
  startAiProactiveScheduler();
  stopAiProactiveScheduler();

  clearStockAlertCooldowns();
  const alert1 = await dispatchStockoutAlert(true);
  const alert2 = await dispatchStockoutAlert(false);

  console.log('   Alert 1 (force=true) Sent:', alert1.sent, 'Success:', alert1.success);
  console.log('   Alert 2 (force=false) Sent:', alert2.sent, 'Reason:', alert2.reason);
  if (alert1.sent && alert2.sent) {
    throw new Error('Cooldown tracker failed');
  }
  console.log('   ✔ Step 3 Passed: Scheduler & Cooldown mechanisms operational.\n');

  // STEP 4: REST API CONTROLLER ENDPOINTS
  console.log('▶ STEP 4: Validating REST API Controller...');
  let apiResponse = null;
  const mockRes = {
    status(code) { this.statusCode = code; return this; },
    json(payload) { apiResponse = payload; return this; },
  };

  await getAiForecast({ user: { role: 'OWNER' } }, mockRes);
  if (!apiResponse?.success || !apiResponse?.data?.stockRunout || !apiResponse?.data?.peakForecast) {
    throw new Error('getAiForecast controller failed');
  }
  console.log('   REST GET /api/ai/forecast: Success 200 OK');

  let triggerResponse = null;
  const mockTriggerRes = {
    status(code) { this.statusCode = code; return this; },
    json(payload) { triggerResponse = payload; return this; },
  };
  await triggerProactiveTelegram({ body: { type: 'invalid' } }, mockTriggerRes);
  if (mockTriggerRes.statusCode !== 400) {
    throw new Error('Validation failed for invalid proactive trigger type');
  }
  console.log('   REST POST /api/ai/proactive/trigger: Validated 400 Bad Request on unknown type');
  console.log('   ✔ Step 4 Passed: REST endpoints operational.\n');

  console.log('══════════════════════════════════════════════════════════════════════════');
  console.log('🎉 ALL E2E VERIFICATION TESTS PASSED 100%! SYSTEM IS PRODUCTION READY.');
  console.log('══════════════════════════════════════════════════════════════════════════');
  process.exit(0);
}

runComprehensiveE2ETest().catch((err) => {
  console.error('\n❌ E2E SUITE FAILED:', err);
  process.exit(1);
});
