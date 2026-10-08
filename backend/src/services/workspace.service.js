import prisma from '../config/db.js';

export const workspaceService = {
  async listAvailableAreas() {
    const areas = await prisma.workspaceArea.findMany({
      where: { isActive: true },
      include: {
        sessions: {
          where: { status: 'ACTIVE' },
        },
      },
      orderBy: { name: 'asc' },
    });
    return areas.filter((a) => a.sessions.length === 0);
  },

  async listAllAreasWithStatus() {
    return prisma.workspaceArea.findMany({
      where: { isActive: true },
      include: {
        sessions: {
          where: { status: 'ACTIVE' },
          include: { package: true },
        },
      },
      orderBy: { name: 'asc' },
    });
  },

  async listPackages() {
    return prisma.workspacePackage.findMany({
      where: { isActive: true },
      orderBy: { durationMin: 'asc' },
    });
  },

  async checkIn({ areaId, packageId, customerName, phone = null }) {
    const active = await prisma.workspaceSession.findFirst({
      where: {
        areaId: Number(areaId),
        status: 'ACTIVE',
      },
    });

    if (active) {
      throw new Error('Area ini sedang terisi sesi aktif lain');
    }

    const session = await prisma.workspaceSession.create({
      data: {
        areaId: Number(areaId),
        packageId: Number(packageId),
        customerName: customerName.trim(),
        phone: phone || null,
        status: 'ACTIVE',
      },
      include: {
        area: true,
        package: true,
      },
    });

    const endsAt = new Date(new Date(session.checkInAt).getTime() + session.package.durationMin * 60000);
    const endsAtLabel = new Intl.DateTimeFormat('id-ID', {
      timeStyle: 'short',
      timeZone: 'Asia/Jakarta',
    }).format(endsAt);

    return {
      ...session,
      endsAt,
      endsAtLabel,
    };
  },

  async getActiveSessions() {
    const sessions = await prisma.workspaceSession.findMany({
      where: { status: 'ACTIVE' },
      include: {
        area: true,
        package: true,
      },
      orderBy: { checkInAt: 'asc' },
    });

    const now = Date.now();
    return sessions.map((s) => {
      const checkInTime = new Date(s.checkInAt).getTime();
      const elapsedMinutes = Math.max(1, Math.round((now - checkInTime) / 60000));
      const remainingMinutes = s.package.durationMin - elapsedMinutes;
      const isOvertime = remainingMinutes < 0;

      return {
        ...s,
        elapsedMinutes,
        remainingMinutes,
        isOvertime,
      };
    });
  },

  async checkOut(sessionId) {
    const session = await prisma.workspaceSession.findUnique({
      where: { id: Number(sessionId) },
      include: {
        package: true,
        area: true,
      },
    });

    if (!session) {
      throw new Error('Sesi workspace tidak ditemukan');
    }

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
      where: { id: Number(sessionId) },
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

    return {
      ...completed,
      elapsedMinutes,
      baseDuration,
      overtimeMinutes,
      overtimeHours,
      baseCharge,
      overtimeCharge,
      totalCharge,
    };
  },

  async listExpiringSessions(withinMinutes = 10) {
    const activeSessions = await this.getActiveSessions();
    return activeSessions.filter((s) => s.remainingMinutes > 0 && s.remainingMinutes <= withinMinutes);
  },
};
