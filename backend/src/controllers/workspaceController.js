import prisma from '../config/db.js';
import { successResponse, errorResponse } from '../utils/response.js';

export async function getAreas(req, res) {
  try {
    const { page, limit } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const isPaginated = !isNaN(pageNum) && !isNaN(limitNum) && pageNum > 0 && limitNum > 0;

    const [areas, total] = await Promise.all([
      prisma.workspaceArea.findMany({
        include: {
          sessions: {
            where: { status: 'ACTIVE' },
            include: { package: true },
          },
        },
        orderBy: { name: 'asc' },
        ...(isPaginated ? { skip: (pageNum - 1) * limitNum, take: limitNum } : {}),
      }),
      isPaginated ? prisma.workspaceArea.count() : Promise.resolve(0),
    ]);

    if (isPaginated) {
      return successResponse(
        res,
        {
          areas,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum),
          },
        },
        'Daftar area workspace'
      );
    }

    return successResponse(res, areas, 'Daftar area workspace');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

export async function createArea(req, res) {
  try {
    const { name, capacity, isActive = true } = req.body;
    const area = await prisma.workspaceArea.create({
      data: {
        name,
        capacity: capacity ? parseInt(capacity) : 1,
        isActive,
      },
    });
    return successResponse(res, area, 'Area berhasil dibuat', 201);
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

export async function getPackages(req, res) {
  try {
    const packages = await prisma.workspacePackage.findMany({
      where: { isActive: true },
      orderBy: { durationMin: 'asc' },
    });
    return successResponse(res, packages, 'Daftar paket workspace');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

export async function createPackage(req, res) {
  try {
    const { name, durationMin, price, overtimePerHr = 0, isActive = true } = req.body;
    const pkg = await prisma.workspacePackage.create({
      data: {
        name,
        durationMin: parseInt(durationMin),
        price,
        overtimePerHr,
        isActive,
      },
    });
    return successResponse(res, pkg, 'Paket berhasil dibuat', 201);
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

export async function getSessions(req, res) {
  try {
    const { status = 'ACTIVE' } = req.query;
    const sessions = await prisma.workspaceSession.findMany({
      where: { status },
      include: {
        area: true,
        package: true,
      },
      orderBy: { checkInAt: 'desc' },
    });
    return successResponse(res, sessions, 'Daftar sesi workspace');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

export async function checkIn(req, res) {
  try {
    const { areaId, packageId, customerName, phone } = req.body;

    const session = await prisma.$transaction(async (tx) => {
      const area = await tx.workspaceArea.findUnique({
        where: { id: parseInt(areaId) },
        include: {
          sessions: {
            where: { status: 'ACTIVE' },
          },
        },
      });

      if (!area) {
        const notFoundErr = new Error('Area workspace tidak ditemukan');
        notFoundErr.statusCode = 404;
        throw notFoundErr;
      }

      if (!area.isActive) {
        const inactiveErr = new Error('Area workspace sedang nonaktif');
        inactiveErr.statusCode = 400;
        throw inactiveErr;
      }

      const maxCapacity = area.capacity || 1;
      if (area.sessions.length >= maxCapacity) {
        const conflictErr = new Error('Area ini sedang terisi oleh sesi aktif lain');
        conflictErr.statusCode = 400;
        throw conflictErr;
      }

      return tx.workspaceSession.create({
        data: {
          areaId: parseInt(areaId),
          packageId: parseInt(packageId),
          customerName: customerName ? String(customerName).trim() : 'Guest',
          phone: phone || null,
          status: 'ACTIVE',
        },
        include: {
          area: true,
          package: true,
        },
      });
    });

    return successResponse(res, session, 'Check-in berhasil, timer berjalan', 201);
  } catch (err) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
}

export async function checkOut(req, res) {
  try {
    const id = parseInt(req.params.id);

    const session = await prisma.workspaceSession.findUnique({
      where: { id },
      include: {
        package: true,
        area: true,
      },
    });

    if (!session) {
      return errorResponse(res, 'Sesi tidak ditemukan', 404);
    }

    // Calculate duration and overtime
    const checkInTime = new Date(session.checkInAt).getTime();
    const now = Date.now();
    const elapsedMinutes = Math.max(1, Math.round((now - checkInTime) / 60000));

    const baseDuration = session.package.durationMin;
    const overtimeMinutes = Math.max(0, elapsedMinutes - baseDuration);
    const overtimeHours = Math.ceil(overtimeMinutes / 60);

    const baseCharge = parseFloat(session.package.price);
    const overtimeCharge = overtimeHours * parseFloat(session.package.overtimePerHr || 0);
    const totalCharge = baseCharge + overtimeCharge;

    const completed = await prisma.workspaceSession.update({
      where: { id },
      data: {
        checkOutAt: new Date(),
        status: 'COMPLETED',
        charge: totalCharge,
      },
      include: {
        area: true,
        package: true,
      },
    });

    return successResponse(
      res,
      {
        ...completed,
        billingDetails: {
          elapsedMinutes,
          baseDuration,
          overtimeMinutes,
          overtimeHours,
          baseCharge,
          overtimeCharge,
          totalCharge,
        },
      },
      'Check-out berhasil dihitung'
    );
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

export async function updateArea(req, res) {
  try {
    const id = parseInt(req.params.id);
    const { name, capacity, isActive } = req.body;
    const data = {};
    if (name !== undefined) data.name = name.trim();
    if (capacity !== undefined) data.capacity = parseInt(capacity);
    if (isActive !== undefined) data.isActive = Boolean(isActive);

    const area = await prisma.workspaceArea.update({
      where: { id },
      data,
    });
    return successResponse(res, area, 'Area berhasil diperbarui');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

export async function deleteArea(req, res) {
  try {
    const id = parseInt(req.params.id);
    const active = await prisma.workspaceSession.findFirst({
      where: { areaId: id, status: 'ACTIVE' },
    });
    if (active) {
      return errorResponse(res, 'Area tidak dapat dihapus karena sedang ada sesi aktif', 400);
    }
    await prisma.workspaceArea.delete({ where: { id } });
    return successResponse(res, null, 'Area berhasil dihapus');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

export async function updatePackage(req, res) {
  try {
    const id = parseInt(req.params.id);
    const { name, durationMin, price, overtimePerHr, isActive } = req.body;
    const data = {};
    if (name !== undefined) data.name = name.trim();
    if (durationMin !== undefined) data.durationMin = parseInt(durationMin);
    if (price !== undefined) data.price = price;
    if (overtimePerHr !== undefined) data.overtimePerHr = overtimePerHr;
    if (isActive !== undefined) data.isActive = Boolean(isActive);

    const pkg = await prisma.workspacePackage.update({
      where: { id },
      data,
    });
    return successResponse(res, pkg, 'Paket berhasil diperbarui');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

export async function deletePackage(req, res) {
  try {
    const id = parseInt(req.params.id);
    await prisma.workspacePackage.update({
      where: { id },
      data: { isActive: false },
    });
    return successResponse(res, null, 'Paket berhasil dinonaktifkan');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}
