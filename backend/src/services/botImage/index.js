import { renderHtmlToImageBuffer } from './browserPool.js';
import { generateReceiptImageBuffer } from '../receiptCanvasService.js';

import {
  renderShiftOpenCard,
  renderShiftClosedCard,
} from './templates/shiftTemplate.js';

import {
  renderKitchenTicketCard,
  renderQueueDashboardCard,
  renderOrderReadyCard,
} from './templates/kitchenTemplate.js';

import {
  renderWorkspaceMatrixCard,
  renderWorkspaceAccessPassCard,
  renderWorkspaceExpiryAlertCard,
  renderWorkspaceBillingCard,
} from './templates/workspaceTemplate.js';

import {
  renderInventoryCriticalCard,
  renderGoodsReceiptCard,
  renderMenuAvailabilityCard,
} from './templates/inventoryTemplate.js';

import {
  renderApprovalRequestCard,
  renderApprovalResultCard,
  renderSecurityAlertCard,
} from './templates/approvalTemplate.js';

import {
  renderRealtimeSalesCard,
  renderSalesReportCard,
  renderDailyCloseBookCard,
} from './templates/executiveTemplate.js';

import {
  renderWelcomeHeroCard,
  renderMenuNavigationCard,
  renderStaffBadgeCard,
  renderStaffInvitationCard,
  renderQuickOrderSummaryCard,
  renderOpenBillListCard,
  renderBotStatusCard,
} from './templates/commonTemplate.js';

import {
  renderAiMorningBriefingCard,
  renderAiStockoutAlertCard,
  renderAiEveningWrapupCard,
} from './templates/aiPredictiveTemplate.js';

/**
 * Unified Bot Image Generator
 * Generates an HD PNG buffer for any of the 25 Telegram Bot Card types
 *
 * @param {string} cardType - Name of the card (e.g. 'shift_open', 'kitchen_ticket', 'realtime_sales')
 * @param {Object} data - Data payload for the card template
 * @param {Object} [options] - Additional render options (width, height, scale)
 * @returns {Promise<Buffer>}
 */
export async function generateBotImage(cardType, data = {}, options = {}) {
  // If card is the luxury receipt, delegate directly to receiptCanvasService
  if (cardType === 'receipt' || cardType === 'CardReceiptLuxury') {
    return generateReceiptImageBuffer(data);
  }

  let html = '';
  let defaultHeight = 750;

  switch (cardType) {
    // 1. Shift Kasir
    case 'shift_open':
    case 'CardShiftOpen':
      html = renderShiftOpenCard(data);
      defaultHeight = 650;
      break;

    case 'shift_closed':
    case 'CardShiftClosed':
      html = renderShiftClosedCard(data);
      defaultHeight = 850;
      break;

    // 2. Kitchen & Barista KDS
    case 'kitchen_ticket':
    case 'CardKitchenTicket':
      html = renderKitchenTicketCard(data);
      defaultHeight = 800;
      break;

    case 'queue_dashboard':
    case 'CardQueueDashboard':
      html = renderQueueDashboardCard(data);
      defaultHeight = 750;
      break;

    case 'order_ready':
    case 'CardOrderReady':
      html = renderOrderReadyCard(data);
      defaultHeight = 600;
      break;

    // 3. Workspace & Coworking
    case 'workspace_matrix':
    case 'CardWorkspaceMatrix':
      html = renderWorkspaceMatrixCard(data);
      defaultHeight = 800;
      break;

    case 'workspace_pass':
    case 'CardWorkspaceAccessPass':
      html = renderWorkspaceAccessPassCard(data);
      defaultHeight = 700;
      break;

    case 'workspace_expiry':
    case 'CardWorkspaceExpiryAlert':
      html = renderWorkspaceExpiryAlertCard(data);
      defaultHeight = 600;
      break;

    case 'workspace_billing':
    case 'CardWorkspaceBilling':
      html = renderWorkspaceBillingCard(data);
      defaultHeight = 650;
      break;

    // 4. Inventory & Stock
    case 'inventory_critical':
    case 'CardInventoryCritical':
      html = renderInventoryCriticalCard(data);
      defaultHeight = 750;
      break;

    case 'goods_receipt':
    case 'CardGoodsReceipt':
      html = renderGoodsReceiptCard(data);
      defaultHeight = 650;
      break;

    case 'menu_availability':
    case 'CardMenuAvailability':
      html = renderMenuAvailabilityCard(data);
      defaultHeight = 700;
      break;

    // 5. Approval & Security
    case 'approval_request':
    case 'CardApprovalRequest':
      html = renderApprovalRequestCard(data);
      defaultHeight = 700;
      break;

    case 'approval_result':
    case 'CardApprovalResult':
      html = renderApprovalResultCard(data);
      defaultHeight = 600;
      break;

    case 'security_alert':
    case 'CardSecurityAlert':
      html = renderSecurityAlertCard(data);
      defaultHeight = 650;
      break;

    // 6. Executive & Reports
    case 'realtime_sales':
    case 'CardRealtimeSales':
      html = renderRealtimeSalesCard(data);
      defaultHeight = 800;
      break;

    case 'sales_report':
    case 'CardSalesReport':
      html = renderSalesReportCard(data);
      defaultHeight = 850;
      break;

    case 'daily_close_book':
    case 'CardDailyCloseBook':
      html = renderDailyCloseBookCard(data);
      defaultHeight = 850;
      break;

    // 7. Common & Onboarding
    case 'welcome':
    case 'CardWelcomeHero':
      html = renderWelcomeHeroCard(data);
      defaultHeight = 600;
      break;

    case 'menu':
    case 'CardMenuNavigation':
      html = renderMenuNavigationCard(data);
      defaultHeight = 750;
      break;

    case 'whoami':
    case 'CardStaffBadge':
      html = renderStaffBadgeCard(data);
      defaultHeight = 650;
      break;

    case 'staff_invitation':
    case 'CardStaffInvitation':
      html = renderStaffInvitationCard(data);
      defaultHeight = 650;
      break;

    case 'quick_order':
    case 'CardQuickOrderSummary':
      html = renderQuickOrderSummaryCard(data);
      defaultHeight = 650;
      break;

    case 'open_bills':
    case 'CardOpenBillList':
      html = renderOpenBillListCard(data);
      defaultHeight = 750;
      break;

    case 'bot_info':
    case 'CardBotStatus':
      html = renderBotStatusCard(data);
      defaultHeight = 850;
      break;

    // 8. Komazi AI Autonomous Predictive & Proactive Cards
    case 'ai_morning_briefing':
    case 'CardAiMorningBriefing':
      html = renderAiMorningBriefingCard(data);
      defaultHeight = 850;
      break;

    case 'ai_stockout_alert':
    case 'CardAiStockoutAlert':
      html = renderAiStockoutAlertCard(data);
      defaultHeight = 800;
      break;

    case 'ai_evening_wrapup':
    case 'CardAiEveningWrapup':
      html = renderAiEveningWrapupCard(data);
      defaultHeight = 850;
      break;

    default:
      throw new Error(`[BotImage] Unknown cardType: ${cardType}`);
  }

  return renderHtmlToImageBuffer(html, {
    width: options.width || 1200,
    height: options.height || defaultHeight,
    deviceScaleFactor: options.deviceScaleFactor || 1.5,
    selector: '#bot-card',
  });
}
