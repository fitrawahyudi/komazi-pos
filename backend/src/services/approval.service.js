import prisma from '../config/db.js';
import { events } from '../bot/events.js';

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
          const voidedOrder = await tx.order.update({
            where: { id: existing.orderId },
            data: {
              status: 'VOIDED',
              voidReason: existing.reason,
            },
          });
          events.emit('order.voided', { order: voidedOrder, reason: existing.reason });
        } else if (existing.type === 'DISCOUNT' && existing.payload?.discount) {
          const disc = parseFloat(existing.payload.discount);
          await tx.order.update({
            where: { id: existing.orderId },
            data: {
              discount: disc,
            },
          });
        }
      }

      return { ok: true, request: updated };
    });
  },

  async listPending() {
    return prisma.approvalRequest.findMany({
      where: { status: 'PENDING' },
      include: {
        requester: { select: { id: true, name: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
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
