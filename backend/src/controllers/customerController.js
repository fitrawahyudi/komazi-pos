import prisma from '../config/db.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { emitCustomerEvent } from '../config/socket.js';

/**
 * GET /api/customers
 * Mengambil daftar seluruh pelanggan dengan filter pencarian, tier, dan pagination.
 */
export async function getAllCustomers(req, res) {
  try {
    const { search, tier, page = 1, limit = 50, sortBy = 'recent', includeInactive } = req.query;

    const where = {};
    if (includeInactive !== 'true') {
      where.isActive = true;
    }

    if (tier && tier !== 'ALL') {
      where.tier = tier;
    }

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { name: { contains: q } },
        { phone: { contains: q } },
        { email: { contains: q } },
      ];
    }

    let orderBy = { createdAt: 'desc' };
    if (sortBy === 'points') {
      orderBy = { points: 'desc' };
    } else if (sortBy === 'spent') {
      orderBy = { totalSpent: 'desc' };
    } else if (sortBy === 'visits') {
      orderBy = { visitCount: 'desc' };
    } else if (sortBy === 'name') {
      orderBy = { name: 'asc' };
    }

    const take = Math.min(Math.max(parseInt(limit) || 200, 1), 500);
    const skip = (Math.max(parseInt(page) || 1, 1) - 1) * take;

    const [customers, totalCount, aggregateStats] = await Promise.all([
      prisma.customer.findMany({
        where,
        orderBy,
        skip,
        take,
        include: {
          _count: {
            select: { orders: true, workspaceSessions: true },
          },
        },
      }),
      prisma.customer.count({ where }),
      prisma.customer.aggregate({
        where,
        _sum: { points: true, totalSpent: true },
        _count: { id: true },
      }),
    ]);

    // Hitung perbandingan tier secara konsisten dengan status aktif
    const baseWhere = { ...(includeInactive !== 'true' ? { isActive: true } : {}) };
    const [silverCount, goldCount, platinumCount] = await Promise.all([
      prisma.customer.count({ where: { ...baseWhere, tier: 'SILVER' } }),
      prisma.customer.count({ where: { ...baseWhere, tier: 'GOLD' } }),
      prisma.customer.count({ where: { ...baseWhere, tier: 'PLATINUM' } }),
    ]);

    const stats = {
      totalCustomers: aggregateStats._count.id || 0,
      totalPoints: aggregateStats._sum.points || 0,
      totalSpent: aggregateStats._sum.totalSpent || 0,
      tierDistribution: {
        silver: silverCount,
        gold: goldCount,
        platinum: platinumCount,
      },
    };

    return successResponse(
      res,
      {
        customers,
        total: totalCount,
        page: parseInt(page) || 1,
        limit: take,
        totalPages: Math.ceil(totalCount / take),
        stats,
      },
      'Daftar pelanggan berhasil dimuat'
    );
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

/**
 * GET /api/customers/:id
 * Mengambil detail pelanggan spesifik beserta riwayat pesanan & workspace.
 */
export async function getCustomerById(req, res) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return errorResponse(res, 'ID pelanggan tidak valid', 400);

    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        orders: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            invoiceNo: true,
            total: true,
            status: true,
            createdAt: true,
          },
        },
        workspaceSessions: {
          take: 5,
          orderBy: { checkInAt: 'desc' },
          select: {
            id: true,
            checkInAt: true,
            checkOutAt: true,
            status: true,
            charge: true,
          },
        },
        _count: {
          select: { orders: true, workspaceSessions: true },
        },
      },
    });

    if (!customer) {
      return errorResponse(res, 'Pelanggan tidak ditemukan', 404);
    }

    return successResponse(res, customer, 'Detail pelanggan berhasil dimuat');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

/**
 * POST /api/customers
 * Mendaftarkan pelanggan baru.
 */
export async function createCustomer(req, res) {
  try {
    const { name, phone, email, notes } = req.body;

    const cleanPhone = phone.trim().replace(/[-\s]/g, '');

    // Cek duplikasi nomor HP
    const existing = await prisma.customer.findUnique({
      where: { phone: cleanPhone },
    });

    if (existing) {
      if (!existing.isActive) {
        // Re-aktivasi customer yang sebelumnya dinonaktifkan
        const reactivated = await prisma.customer.update({
          where: { id: existing.id },
          data: {
            name: name.trim(),
            email: email?.trim() || null,
            notes: notes?.trim() || null,
            isActive: true,
          },
        });
        try {
          emitCustomerEvent('customer:created', reactivated);
          emitCustomerEvent('customers:changed', { action: 'CREATED', id: reactivated.id });
        } catch (e) {
          console.warn('[Socket.IO] Emit customer:created error:', e);
        }
        return successResponse(
          res,
          reactivated,
          `Pelanggan "${reactivated.name}" berhasil diaktifkan kembali (+10 Poin Selamat Datang!)`,
          201
        );
      }
      return errorResponse(
        res,
        `Nomor WhatsApp/HP ${cleanPhone} sudah terdaftar atas nama "${existing.name}"`,
        400
      );
    }

    const customer = await prisma.customer.create({
      data: {
        name: name.trim(),
        phone: cleanPhone,
        email: email?.trim() || null,
        notes: notes?.trim() || null,
        points: 0,
        tier: 'SILVER',
        totalSpent: 0,
        visitCount: 0,
      },
    });

    try {
      emitCustomerEvent('customer:created', customer);
      emitCustomerEvent('customers:changed', { action: 'CREATED', id: customer.id });
    } catch (e) {
      console.warn('[Socket.IO] Emit customer:created error:', e);
    }

    return successResponse(
      res,
      customer,
      `Pelanggan "${customer.name}" berhasil didaftarkan (+10 Poin Selamat Datang!)`,
      201
    );
  } catch (err) {
    if (err.code === 'P2002') {
      return errorResponse(res, 'Nomor telepon sudah terdaftar', 400);
    }
    return errorResponse(res, err.message, 500);
  }
}

/**
 * PUT /api/customers/:id
 * Memperbarui profil pelanggan.
 */
export async function updateCustomer(req, res) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return errorResponse(res, 'ID pelanggan tidak valid', 400);

    const { name, phone, email, notes, tier, isActive } = req.body;

    const existing = await prisma.customer.findUnique({ where: { id } });
    if (!existing) return errorResponse(res, 'Pelanggan tidak ditemukan', 404);

    const data = {};
    if (name !== undefined) data.name = name.trim();
    if (phone !== undefined) {
      const cleanPhone = phone.trim().replace(/[-\s]/g, '');
      if (cleanPhone !== existing.phone) {
        const duplicate = await prisma.customer.findUnique({
          where: { phone: cleanPhone },
        });
        if (duplicate) {
          return errorResponse(
            res,
            `Nomor ${cleanPhone} sudah digunakan oleh pelanggan lain (${duplicate.name})`,
            400
          );
        }
      }
      data.phone = cleanPhone;
    }
    if (email !== undefined) data.email = email?.trim() || null;
    if (notes !== undefined) data.notes = notes?.trim() || null;
    if (tier !== undefined) data.tier = tier;
    if (isActive !== undefined) data.isActive = Boolean(isActive);

    const updated = await prisma.customer.update({
      where: { id },
      data,
    });

    try {
      emitCustomerEvent('customer:updated', updated);
      emitCustomerEvent('customers:changed', { action: 'UPDATED', id: updated.id });
    } catch (e) {
      console.warn('[Socket.IO] Emit customer:updated error:', e);
    }

    return successResponse(res, updated, `Data member "${updated.name}" berhasil diperbarui`);
  } catch (err) {
    if (err.code === 'P2002') {
      return errorResponse(res, 'Nomor telepon sudah digunakan pelanggan lain', 400);
    }
    return errorResponse(res, err.message, 500);
  }
}

/**
 * DELETE /api/customers/:id
 * Menghapus pelanggan atau menonaktifkan jika ada riwayat transaksi.
 */
export async function deleteCustomer(req, res) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return errorResponse(res, 'ID pelanggan tidak valid', 400);

    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        _count: { select: { orders: true, workspaceSessions: true } },
      },
    });

    if (!customer) return errorResponse(res, 'Pelanggan tidak ditemukan', 404);

    const forceDelete = req.query.force === 'true';

    // Jika memiliki riwayat pesanan/workspace dan bukan force, nonaktifkan alih-alih hard delete
    if (!forceDelete && (customer._count.orders > 0 || customer._count.workspaceSessions > 0)) {
      const deactivated = await prisma.customer.update({
        where: { id },
        data: { isActive: false },
      });
      try {
        emitCustomerEvent('customer:deleted', { id, name: customer.name });
        emitCustomerEvent('customers:changed', { action: 'DEACTIVATED', id });
      } catch (e) {
        console.warn('[Socket.IO] Emit customer:deleted error:', e);
      }
      return successResponse(
        res,
        { id, isDeactivated: true },
        `Member "${customer.name}" dinonaktifkan karena memiliki riwayat transaksi`
      );
    }

    // Hard delete: jika ada relasi transaksi, putuskan foreign key terlebih dahulu untuk mencegah FK constraint failure (P2003)
    if (customer._count.orders > 0 || customer._count.workspaceSessions > 0) {
      await prisma.order.updateMany({
        where: { customerId: id },
        data: { customerId: null },
      });
      await prisma.workspaceSession.updateMany({
        where: { customerId: id },
        data: { customerId: null },
      });
    }

    // Hard delete jika belum ada riwayat atau dipaksa (force)
    await prisma.customer.delete({ where: { id } });
    try {
      emitCustomerEvent('customer:deleted', { id, name: customer.name });
      emitCustomerEvent('customers:changed', { action: 'DELETED', id });
    } catch (e) {
      console.warn('[Socket.IO] Emit customer:deleted error:', e);
    }
    return successResponse(res, { id, isDeleted: true }, `Member "${customer.name}" berhasil dihapus`);
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

/**
 * POST /api/customers/:id/redeem
 * Menukarkan poin loyalty reward member.
 */
export async function redeemCustomerPoints(req, res) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return errorResponse(res, 'ID pelanggan tidak valid', 400);

    const { points, note } = req.body;
    const pointsToRedeem = parseInt(points);

    if (isNaN(pointsToRedeem) || pointsToRedeem <= 0) {
      return errorResponse(res, 'Jumlah poin yang ditukarkan harus lebih dari 0', 400);
    }

    const customer = await prisma.customer.findUnique({ where: { id } });
    if (!customer) return errorResponse(res, 'Pelanggan tidak ditemukan', 404);

    if (customer.points < pointsToRedeem) {
      return errorResponse(
        res,
        `Poin tidak mencukupi. Saldo saat ini: ${customer.points} poin, ditukarkan: ${pointsToRedeem} poin`,
        400
      );
    }

    const remainingPoints = customer.points - pointsToRedeem;

    const updated = await prisma.customer.update({
      where: { id },
      data: { points: remainingPoints },
    });

    try {
      emitCustomerEvent('customer:updated', updated);
      emitCustomerEvent('customer:points_redeemed', { id, points: pointsToRedeem, remainingPoints });
      emitCustomerEvent('customers:changed', { action: 'POINTS_REDEEMED', id });
    } catch (e) {
      console.warn('[Socket.IO] Emit customer:points_redeemed error:', e);
    }

    // Catat log audit
    if (req.user?.id) {
      await prisma.auditLog.create({
        data: {
          userId: req.user.id,
          action: 'CUSTOMER_POINTS_REDEEM',
          detail: {
            customerId: id,
            customerName: customer.name,
            pointsRedeemed: pointsToRedeem,
            remainingPoints,
            note: note || 'Penukaran reward loyalty',
          },
        },
      });
    }

    return successResponse(
      res,
      updated,
      `Berhasil menukar ${pointsToRedeem} poin untuk "${customer.name}". Sisa poin: ${remainingPoints}`
    );
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

/**
 * POST /api/customers/:id/adjust-points
 * Penyesuaian poin manual oleh Manager/Owner.
 */
export async function adjustCustomerPoints(req, res) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return errorResponse(res, 'ID pelanggan tidak valid', 400);

    const { points, reason } = req.body;
    const delta = parseInt(points);

    if (isNaN(delta) || delta === 0) {
      return errorResponse(res, 'Nilai penyesuaian poin tidak boleh 0', 400);
    }

    const customer = await prisma.customer.findUnique({ where: { id } });
    if (!customer) return errorResponse(res, 'Pelanggan tidak ditemukan', 404);

    const newPoints = Math.max(0, customer.points + delta);

    // Perbarui tier jika ada peningkatan/penurunan signifikan
    let newTier = customer.tier;
    if (newPoints >= 500) newTier = 'PLATINUM';
    else if (newPoints >= 200) newTier = 'GOLD';
    else newTier = 'SILVER';

    const updated = await prisma.customer.update({
      where: { id },
      data: { points: newPoints, tier: newTier },
    });

    try {
      emitCustomerEvent('customer:updated', updated);
      emitCustomerEvent('customer:points_adjusted', { id, delta, newPoints, newTier });
      emitCustomerEvent('customers:changed', { action: 'POINTS_ADJUSTED', id });
    } catch (e) {
      console.warn('[Socket.IO] Emit customer:points_adjusted error:', e);
    }

    // Catat log audit
    if (req.user?.id) {
      await prisma.auditLog.create({
        data: {
          userId: req.user.id,
          action: 'CUSTOMER_POINTS_ADJUST',
          detail: {
            customerId: id,
            customerName: customer.name,
            delta,
            previousPoints: customer.points,
            newPoints,
            reason: reason || 'Koreksi manual Manager/Owner',
          },
        },
      });
    }

    return successResponse(
      res,
      updated,
      `Poin "${customer.name}" berhasil disesuaikan (${delta > 0 ? '+' : ''}${delta}). Saldo sekarang: ${newPoints} poin`
    );
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

/**
 * POST /api/customers/sync-batch
 * Memungkinkan migrasi data dari LocalStorage ke database secara mulus.
 */
export async function syncBatchCustomers(req, res) {
  try {
    const { customers } = req.body;
    if (!Array.isArray(customers) || customers.length === 0) {
      return errorResponse(res, 'Data pelanggan kosong', 400);
    }

    let inserted = 0;
    let skipped = 0;

    for (const item of customers) {
      if (!item.name || !item.phone) {
        skipped++;
        continue;
      }

      const cleanPhone = String(item.phone).trim().replace(/[-\s]/g, '');
      const existing = await prisma.customer.findUnique({
        where: { phone: cleanPhone },
      });

      if (existing) {
        skipped++;
        continue;
      }

      await prisma.customer.create({
        data: {
          name: String(item.name).trim(),
          phone: cleanPhone,
          email: item.email ? String(item.email).trim() : null,
          points: Number(item.points) || 10,
          tier: ['SILVER', 'GOLD', 'PLATINUM'].includes(item.tier) ? item.tier : 'SILVER',
          totalSpent: Number(item.totalSpent) || 0,
          visitCount: Number(item.visitCount) || 0,
        },
      });
      inserted++;
    }

    return successResponse(
      res,
      { inserted, skipped },
      `Sinkronisasi selesai: ${inserted} pelanggan baru disimpan, ${skipped} diabaikan (duplikat/tidak valid)`
    );
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}
