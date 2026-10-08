import prisma from '../config/db.js';
import { successResponse, errorResponse } from '../utils/response.js';

/**
 * Handle incoming Payment Webhooks from:
 * 1. Midtrans QRIS Notification
 * 2. Xendit QRIS Callback
 * 3. DANA Bisnis via Android Notification Forwarder / MacroDroid / Tasker
 * 4. Generic Payment Webhooks
 */
export async function handlePaymentWebhook(req, res) {
  try {
    const payload = req.body || {};
    console.log('[Payment Webhook] Received payload:', JSON.stringify(payload));

    let invoiceNo =
      payload.order_id ||
      payload.external_id ||
      payload.invoiceNo ||
      payload.orderId ||
      null;

    let amount = parseFloat(payload.gross_amount || payload.amount || 0);
    let isSuccess = false;
    let paymentRef = payload.transaction_id || payload.id || `WH-${Date.now()}`;

    // 1. Midtrans detection
    if (payload.transaction_status) {
      const status = payload.transaction_status;
      if (status === 'settlement' || status === 'capture') {
        isSuccess = true;
      } else if (status === 'pending') {
        return successResponse(res, null, 'Transaksi pending');
      } else {
        return successResponse(res, null, `Status transaksi: ${status}`);
      }
    }
    // 2. Xendit detection
    else if (payload.status) {
      const status = String(payload.status).toUpperCase();
      if (status === 'COMPLETED' || status === 'PAID' || status === 'SUCCESS') {
        isSuccess = true;
      }
    }
    // 3. DANA / Android Notification Forwarder
    else if (payload.source === 'DANA' || payload.rawText) {
      isSuccess = true;
      if (!amount && payload.rawText) {
        // Extract "Rp 45.000" or similar from notification text
        const match = payload.rawText.match(/Rp\s*([\d\.,]+)/i);
        if (match) {
          amount = parseFloat(match[1].replace(/\./g, '').replace(/,/g, '.'));
        }
      }
    }
    // 4. Generic fallback: if amount > 0, assume incoming payment notification
    else if (amount > 0) {
      isSuccess = true;
    }

    if (!isSuccess) {
      return successResponse(res, null, 'Payload diterima namun bukan status pembayaran berhasil');
    }

    // 2. Find matching order in database
    let order = null;

    if (invoiceNo) {
      order = await prisma.order.findUnique({
        where: { invoiceNo },
        include: { items: true, payments: true },
      });
    }

    // Fallback: If not found by invoiceNo (e.g. DANA app notification only carries amount):
    // Match the most recent OPEN order within last 30 minutes matching the amount
    if (!order && amount > 0) {
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
      const candidates = await prisma.order.findMany({
        where: {
          status: 'OPEN',
          createdAt: { gte: thirtyMinutesAgo },
        },
        include: { items: true, payments: true },
        orderBy: { createdAt: 'desc' },
      });

      order = candidates.find((c) => Math.round(parseFloat(c.total)) === Math.round(amount));
    }

    if (!order) {
      console.warn(`[Payment Webhook] No matching OPEN order found for invoice=${invoiceNo}, amount=${amount}`);
      return successResponse(
        res,
        { matched: false },
        'Webhook diterima, tetapi tidak ada pesanan OPEN yang cocok',
        200
      );
    }

    // If order is already PAID, return success idempotent
    if (order.status === 'PAID') {
      return successResponse(
        res,
        { matched: true, orderId: order.id, invoiceNo: order.invoiceNo, status: 'PAID' },
        'Pesanan sudah berstatus PAID sebelumnya'
      );
    }

    // 3. Update Order to PAID
    const updatedOrder = await prisma.$transaction(async (tx) => {
      await tx.payment.create({
        data: {
          orderId: order.id,
          method: 'QRIS',
          amount: order.total,
          reference: paymentRef,
        },
      });

      return await tx.order.update({
        where: { id: order.id },
        data: {
          status: 'PAID',
          paidAt: new Date(),
        },
        include: { items: true, payments: true },
      });
    });

    console.log(`[Payment Webhook] ✓ Order ${updatedOrder.invoiceNo} successfully updated to PAID!`);

    return successResponse(
      res,
      {
        matched: true,
        orderId: updatedOrder.id,
        invoiceNo: updatedOrder.invoiceNo,
        status: 'PAID',
        paidAt: updatedOrder.paidAt,
      },
      'Pembayaran berhasil dikonfirmasi dan status order diubah ke PAID'
    );
  } catch (err) {
    console.error('[Payment Webhook Error]:', err);
    return errorResponse(res, err.message, 500);
  }
}

/**
 * Check payment status for polling by frontend PaymentModal
 */
export async function checkPaymentStatus(req, res) {
  try {
    const { invoiceNo } = req.params;
    const amount = req.query.amount ? parseFloat(req.query.amount) : null;

    let order = null;

    if (invoiceNo && invoiceNo !== 'undefined' && invoiceNo !== 'null') {
      order = await prisma.order.findUnique({
        where: { invoiceNo },
        include: { items: true, payments: true },
      });
    }

    // Fallback search by recent order with same amount
    if (!order && amount) {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      const recent = await prisma.order.findMany({
        where: {
          createdAt: { gte: tenMinutesAgo },
        },
        include: { items: true, payments: true },
        orderBy: { createdAt: 'desc' },
      });

      order = recent.find((r) => Math.round(parseFloat(r.total)) === Math.round(amount));
    }

    if (!order) {
      return successResponse(res, { isPaid: false, status: 'OPEN' }, 'Pesanan sedang berlangsung');
    }

    return successResponse(res, {
      isPaid: order.status === 'PAID',
      status: order.status,
      order,
    });
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

/**
 * Simulate payment success (test button for cashier/owner)
 */
export async function simulatePaymentSuccess(req, res) {
  try {
    const { invoiceNo, amount } = req.body;
    let order = null;

    if (invoiceNo) {
      order = await prisma.order.findUnique({
        where: { invoiceNo },
        include: { items: true, payments: true },
      });
    }

    if (!order && amount) {
      order = await prisma.order.findFirst({
        where: {
          status: 'OPEN',
          total: { equals: amount },
        },
        include: { items: true, payments: true },
        orderBy: { createdAt: 'desc' },
      });
    }

    // If still no order, find any latest OPEN order
    if (!order) {
      order = await prisma.order.findFirst({
        where: { status: 'OPEN' },
        include: { items: true, payments: true },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (!order) {
      return errorResponse(res, 'Tidak ada transaksi dengan status OPEN yang dapat disimulasikan', 404);
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.payment.create({
        data: {
          orderId: order.id,
          method: 'QRIS',
          amount: order.total,
          reference: `SIMULASI-${Date.now()}`,
        },
      });

      return await tx.order.update({
        where: { id: order.id },
        data: {
          status: 'PAID',
          paidAt: new Date(),
        },
        include: { items: true, payments: true },
      });
    });

    return successResponse(
      res,
      { isPaid: true, status: 'PAID', order: updated },
      `Simulasi sukses: Pesanan ${updated.invoiceNo} berhasil diubah menjadi PAID!`
    );
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

/**
 * Provide webhook configuration info
 */
export async function getWebhookInfo(req, res) {
  try {
    const host = req.get('host');
    const protocol = req.protocol;
    const webhookUrl = `${protocol}://${host}/api/v1/payments/webhook`;

    return successResponse(res, {
      webhookUrl,
      providers: [
        {
          name: 'DANA Bisnis (via Android Notification Forwarder)',
          method: 'POST',
          payloadExample: { source: 'DANA', amount: 45000, rawText: 'Kamu menerima pembayaran sebesar Rp 45.000...' },
        },
        {
          name: 'Midtrans QRIS',
          method: 'POST',
          payloadExample: { order_id: 'KMZ-20261007-0001', transaction_status: 'settlement', gross_amount: '45000.00' },
        },
        {
          name: 'Xendit QRIS',
          method: 'POST',
          payloadExample: { external_id: 'KMZ-20261007-0001', status: 'COMPLETED', amount: 45000 },
        },
      ],
    });
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}
