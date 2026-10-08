import prisma from '../config/db.js';
import { successResponse, errorResponse } from '../utils/response.js';
import {
  getStationOrders,
  updateOrderItemStatus,
  bumpOrderItem,
  bumpTicket,
} from '../services/kdsService.js';

// ─── KDS Controllers (Kitchen Display System) ─────────────────────────────────
export async function getKdsOrders(req, res) {
  try {
    const { status = 'ACTIVE' } = req.query;
    const orders = await getStationOrders({ stationType: 'KITCHEN', status });
    return successResponse(res, orders, 'Daftar pesanan Kitchen berhasil diambil');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

// ─── BDS Controllers (Bar Display System) ─────────────────────────────────────
export async function getBdsOrders(req, res) {
  try {
    const { status = 'ACTIVE' } = req.query;
    const orders = await getStationOrders({ stationType: 'BAR', status });
    return successResponse(res, orders, 'Daftar pesanan Barista berhasil diambil');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

// ─── Item Status & Bump Controllers ──────────────────────────────────────────
export async function updateItemStatus(req, res) {
  try {
    const itemId = parseInt(req.params.itemId);
    const { status } = req.body;
    const userId = req.user?.id;

    if (!status) {
      return errorResponse(res, 'Status item wajib disertakan', 400);
    }

    const result = await updateOrderItemStatus({
      itemId,
      newStatus: status,
      userId,
    });

    return successResponse(res, result, 'Status item berhasil diperbarui');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

export async function bumpItem(req, res) {
  try {
    const itemId = parseInt(req.params.itemId);
    const userId = req.user?.id;

    const result = await bumpOrderItem({ itemId, userId });
    return successResponse(res, result, 'Item berhasil di-bump ke status berikutnya');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

export async function bumpKdsTicket(req, res) {
  try {
    const orderId = parseInt(req.params.orderId);
    const userId = req.user?.id;

    const result = await bumpTicket({ orderId, stationType: 'KITCHEN', userId });
    return successResponse(res, result, 'Tiket Kitchen berhasil di-bump');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

export async function bumpBdsTicket(req, res) {
  try {
    const orderId = parseInt(req.params.orderId);
    const userId = req.user?.id;

    const result = await bumpTicket({ orderId, stationType: 'BAR', userId });
    return successResponse(res, result, 'Tiket Barista berhasil di-bump');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

// ─── Station Management Controllers ───────────────────────────────────────────
export async function getStations(req, res) {
  try {
    const stations = await prisma.station.findMany({
      include: {
        _count: {
          select: { products: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    return successResponse(res, stations, 'Daftar station berhasil diambil');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

export async function createStation(req, res) {
  try {
    const { name, code, type, isActive = true } = req.body;
    if (!name || !code || !type) {
      return errorResponse(res, 'Name, code, dan type wajib diisi', 400);
    }

    const station = await prisma.station.create({
      data: {
        name,
        code: code.toUpperCase().trim(),
        type,
        isActive,
      },
    });

    return successResponse(res, station, 'Station baru berhasil dibuat', 201);
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

export async function updateStation(req, res) {
  try {
    const id = parseInt(req.params.id);
    const { name, code, type, isActive } = req.body;

    const station = await prisma.station.update({
      where: { id },
      data: {
        ...(name ? { name } : {}),
        ...(code ? { code: code.toUpperCase().trim() } : {}),
        ...(type ? { type } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      },
    });

    return successResponse(res, station, 'Station berhasil diperbarui');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

export async function deleteStation(req, res) {
  try {
    const id = parseInt(req.params.id);
    await prisma.station.delete({ where: { id } });
    return successResponse(res, null, 'Station berhasil dihapus');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}
