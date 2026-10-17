import prisma from '../config/db.js';
import { events } from '../bot/events.js';
import { deltaInventoryService } from './deltaInventoryService.js';
import { emitOrderEvent, emitToStation } from '../config/socket.js';

export const approvalService = {
  async request({ type, orderId, requesterId, reason, payload = null }) {
    const order = await prisma.order.findUnique({
      where: { id: Number(orderId) },
    });
    if (!order) throw new Error('Pesanan tidak ditemukan');

    const created = await prisma.approvalRequest.create({
      data: {
        type,
        orderId: Number(orderId),
        requesterId: Number(requesterId),
        reason: reason.trim(),
        payload: payload || undefined,
        status: 'PENDING',
      },
      include: {
        requester: { select: { id: true, name: true, role: true } },
      },
    });

    events.emit('approval.requested', { request: created, order });
    return created;
  },

  async decide({ id, deciderId, approve }) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.approvalRequest.findUnique({
        where: { id: Number(id) },
        include: {
          requester: { select: { id: true, name: true, telegramId: true } },
        },
      });

      if (!existing) {
        return { ok: false, message: 'Permintaan persetujuan tidak ditemukan' };
      }

      if (existing.status !== 'PENDING') {
        return {
          ok: false,
          message: `Permintaan ini sudah diputuskan sebelumnya (${existing.status})`,
        };
      }

      const status = approve ? 'APPROVED' : 'REJECTED';
      const updated = await tx.approvalRequest.update({
        where: { id: Number(id) },
        data: {
          deciderId: Number(deciderId),
          status,
          decidedAt: new Date(),
        },
        include: {
          requester: { select: { id: true, name: true, telegramId: true } },
          decider: { select: { id: true, name: true } },
        },
      });

      // Efek samping persetujuan pada Order
      if (approve) {
        if (existing.type === 'VOID_ORDER') {
          // 1. Kembalikan stok bahan baku
          await deltaInventoryService.restoreOrderStock(tx, existing.orderId, `Approval Void: ${existing.reason}`);

          // 2. Tandai item order sebagai CANCELLED
          await tx.orderItem.updateMany({
            where: { orderId: existing.orderId },
            data: { status: 'CANCELLED' },
          });

          // 3. Update order status VOIDED
          const voidedOrder = await tx.order.update({
            where: { id: existing.orderId },
            data: {
              status: 'VOIDED',
              voidReason: existing.reason,
            },
          });

          try {
            emitToStation('KITCHEN_MAIN', 'order:updated', voidedOrder);
            emitToStation('BAR_MAIN', 'order:updated', voidedOrder);
            emitOrderEvent('order:updated', voidedOrder);
            emitOrderEvent('order:voided', { orderId: voidedOrder.id, invoiceNo: voidedOrder.invoiceNo, reason: existing.reason });
          } catch (e) {
            console.warn('[approval.service] Socket emit error:', e);
          }

          events.emit('order.voided', { order: voidedOrder, reason: existing.reason });
        } else if (existing.type === 'DISCOUNT' && existing.payload?.discount) {
          const disc = parseFloat(existing.payload.discount);
          await tx.order.update({
            where: { id: existing.orderId },
            data: {
              discount: disc,
            },
          });
        } else if (existing.type === 'REFUND') {
          const amount = existing.payload?.refundAmount ? Number(existing.payload.refundAmount) : undefined;
          const order = await tx.order.findUnique({ where: { id: existing.orderId } });
          const finalAmount = amount || (order ? Number(order.total) : 0);

          // 1. Kembalikan stok bahan baku jika pesanan di-REFUND
          await deltaInventoryService.restoreOrderStock(tx, existing.orderId, `Approval Refund: ${existing.reason}`);

          // 2. Tandai item order sebagai CANCELLED
          await tx.orderItem.updateMany({
            where: { orderId: existing.orderId },
            data: { status: 'CANCELLED' },
          });

          const refundedOrder = await tx.order.update({
            where: { id: existing.orderId },
            data: {
              status: 'REFUNDED',
              voidReason: `REFUND: ${existing.reason} (Jumlah: ${finalAmount})`,
            },
          });

          await tx.auditLog.create({
            data: {
              userId: Number(deciderId),
              action: 'REFUND_ORDER',
              detail: {
                invoiceNo: order?.invoiceNo,
                reason: existing.reason,
                refundAmount: finalAmount,
                decidedBy: Number(deciderId),
              },
            },
          });

          try {
            emitToStation('KITCHEN_MAIN', 'order:updated', refundedOrder);
            emitToStation('BAR_MAIN', 'order:updated', refundedOrder);
            emitOrderEvent('order:updated', refundedOrder);
            emitOrderEvent('order:refunded', {
              orderId: refundedOrder.id,
              invoiceNo: refundedOrder.invoiceNo,
              reason: existing.reason,
              amount: finalAmount,
            });
          } catch (e) {
            console.warn('[approval.service] Socket emit error:', e);
          }

          events.emit('order.refunded', { order: refundedOrder, reason: existing.reason, amount: finalAmount });
        }
      }

      return { ok: true, request: updated };
    });
  },

  async listPending() {
    const list = await prisma.approvalRequest.findMany({
      where: { status: 'PENDING' },
      include: {
        requester: { select: { id: true, name: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const orderIds = list.map((item) => item.orderId);
    const orders = await prisma.order.findMany({
      where: { id: { in: orderIds } },
      select: { id: true, invoiceNo: true, customerName: true, total: true, status: true, paymentMethod: true },
    });
    const orderMap = new Map(orders.map((o) => [o.id, o]));

    return list.map((item) => ({
      ...item,
      order: orderMap.get(item.orderId) || null,
    }));
  },

  async expireOldApprovals(minutes = 30) {
    const cutoff = new Date(Date.now() - minutes * 60000);
    const result = await prisma.approvalRequest.updateMany({
      where: {
        status: 'PENDING',
        createdAt: { lt: cutoff },
      },
      data: {
        status: 'EXPIRED',
        decidedAt: new Date(),
      },
    });
    return result.count;
  },
};


