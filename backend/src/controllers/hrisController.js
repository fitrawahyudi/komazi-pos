import bcrypt from 'bcryptjs';
import prisma from '../config/db.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { emitForceLogout } from '../config/socket.js';
import { checkStaffScheduleToday, checkStaffAttendanceToday, checkStaffShiftEligibility, SCHEDULE_BLOCKED_MESSAGE } from '../services/scheduleGuard.service.js';
import { getSettingsMap } from '../services/settingsCache.service.js';
import { verifyAttendanceAntiFraud, saveAttendancePhoto } from '../services/attendanceAntiFraud.service.js';

// ─────────────────────────────────────────────────────────────
// AUDIT LOG HELPER
// ─────────────────────────────────────────────────────────────
async function logHrisAudit(userId, action, entityType, entityId, details, req) {
  try {
    const ip = req?.headers['x-forwarded-for'] || req?.socket?.remoteAddress || null;
    await prisma.hrisAuditLog.create({
      data: {
        userId,
        action,
        entityType,
        entityId: entityId ? Number(entityId) : null,
        details: typeof details === 'object' ? JSON.stringify(details) : details,
        ipAddress: ip,
      },
    });
  } catch (e) {
    console.error('Failed to log HR audit:', e.message);
  }
}

// ─────────────────────────────────────────────────────────────
// 1. OVERVIEW & STATS
// ─────────────────────────────────────────────────────────────
export async function getHrisOverview(req, res) {
  try {
    const today = new Date().toISOString().split('T')[0];

    const [
      totalStaff,
      activeStaff,
      presentToday,
      scheduledToday,
      pendingLeaves,
      pendingCorrections,
      pendingOvertimes,
      latestPayroll,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.staffAttendance.count({ where: { date: today } }),
      prisma.staffSchedule.count({ where: { date: today } }),
      prisma.staffLeave.count({ where: { status: 'PENDING' } }),
      prisma.staffAttendanceCorrection.count({ where: { status: 'PENDING' } }),
      prisma.staffOvertime.count({ where: { status: 'PENDING' } }),
      prisma.payrollPeriod.findFirst({ orderBy: { createdAt: 'desc' } }),
    ]);

    return successResponse(
      res,
      {
        totalStaff,
        activeStaff,
        presentToday,
        scheduledToday,
        pendingLeaves,
        pendingCorrections,
        pendingOvertimes,
        latestPayroll: latestPayroll
          ? {
              id: latestPayroll.id,
              name: latestPayroll.name,
              status: latestPayroll.status,
              totalPayout: Number(latestPayroll.totalPayout),
            }
          : null,
        today,
      },
      'Ringkasan HRIS berhasil dimuat'
    );
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

// ─────────────────────────────────────────────────────────────
// 2. STAF (STAFF MANAGEMENT)
// ─────────────────────────────────────────────────────────────
export async function getStaffList(req, res) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const isOwner = req.user?.role === 'OWNER';

    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        phone: true,
        avatarUrl: true,
        isActive: true,
        department: true,
        jobTitle: true,
        employmentType: true,
        joinDate: true,
        // Sensitive salary fields only accessible to OWNER
        baseSalary: isOwner,
        dailyAllowance: isOwner,
        hourlyOvertimeRate: isOwner,
        createdAt: true,
        attendances: {
          where: { date: today },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const staffWithStatus = users.map((u) => {
      const todayAtt = u.attendances[0];
      let attendanceStatus = 'ABSENT';
      if (todayAtt) {
        attendanceStatus = todayAtt.clockOut ? 'COMPLETED' : 'CLOCKED_IN';
      }
      return {
        ...u,
        baseSalary: isOwner ? Number(u.baseSalary || 0) : undefined,
        dailyAllowance: isOwner ? Number(u.dailyAllowance || 0) : undefined,
        hourlyOvertimeRate: isOwner ? Number(u.hourlyOvertimeRate || 0) : undefined,
        todayAttendance: todayAtt || null,
        attendanceStatus,
      };
    });

    return successResponse(res, staffWithStatus, 'Daftar staf berhasil dimuat');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

export async function createStaff(req, res) {
  try {
    const {
      name,
      username,
      password,
      role = 'CASHIER',
      phone,
      department,
      jobTitle,
      employmentType,
      joinDate,
      baseSalary,
      dailyAllowance,
      hourlyOvertimeRate,
    } = req.body;

    if (!name || !name.trim()) {
      return errorResponse(res, 'Nama lengkap wajib diisi', 400);
    }
    if (!username || !username.trim()) {
      return errorResponse(res, 'Username login wajib diisi', 400);
    }
    if (!password) {
      return errorResponse(res, 'Kata sandi wajib diisi', 400);
    }

    const cleanUsername = username.trim().toLowerCase();
    if (cleanUsername.length < 3) {
      return errorResponse(res, 'Username minimal 3 karakter', 400);
    }
    if (!/^[a-z0-9_.-]+$/.test(cleanUsername)) {
      return errorResponse(
        res,
        'Username hanya boleh berisi huruf kecil, angka, titik, strip (-), atau garis bawah (_)',
        400
      );
    }

    if (typeof password !== 'string' || password.length < 6) {
      return errorResponse(res, 'Kata sandi minimal 6 karakter', 400);
    }

    const validRoles = ['OWNER', 'MANAGER', 'CASHIER', 'KITCHEN', 'BARISTA'];
    const normalizedRole = String(role || 'CASHIER').toUpperCase().trim();
    if (!validRoles.includes(normalizedRole)) {
      return errorResponse(
        res,
        `Peran "${role}" tidak valid. Pilihan peran yang tersedia: ${validRoles.join(', ')}`,
        400
      );
    }

    if (req.user && req.user.role !== 'OWNER' && normalizedRole === 'OWNER') {
      return errorResponse(res, 'Hanya Owner yang berhak mendaftarkan akun Owner baru', 403);
    }

    const existing = await prisma.user.findUnique({ where: { username: cleanUsername } });
    if (existing) {
      return errorResponse(res, `Username "${cleanUsername}" sudah digunakan oleh staf lain`, 400);
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    let defaultDepartment = 'Operasional';
    if (normalizedRole === 'BARISTA') defaultDepartment = 'Bar & Minuman';
    else if (normalizedRole === 'KITCHEN') defaultDepartment = 'Dapur & Makanan';
    else if (normalizedRole === 'CASHIER') defaultDepartment = 'Kasir';
    else if (normalizedRole === 'MANAGER' || normalizedRole === 'OWNER') defaultDepartment = 'Manajemen';

    const isOwner = req.user?.role === 'OWNER';

    const newStaff = await prisma.user.create({
      data: {
        name: name.trim(),
        username: cleanUsername,
        password: hashedPassword,
        role: normalizedRole,
        phone: phone ? String(phone).trim() : null,
        department: department?.trim() || defaultDepartment,
        jobTitle: jobTitle?.trim() || null,
        employmentType: employmentType || 'FULL_TIME',
        joinDate: joinDate || new Date().toISOString().split('T')[0],
        baseSalary: isOwner && baseSalary ? Number(baseSalary) : 0,
        dailyAllowance: isOwner && dailyAllowance ? Number(dailyAllowance) : 0,
        hourlyOvertimeRate: isOwner && hourlyOvertimeRate ? Number(hourlyOvertimeRate) : 0,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        phone: true,
        department: true,
        jobTitle: true,
        employmentType: true,
        joinDate: true,
        isActive: true,
        createdAt: true,
      },
    });

    await logHrisAudit(req.user.id, 'STAFF_CREATE', 'STAFF', newStaff.id, { username: cleanUsername, role: normalizedRole }, req);

    return successResponse(res, newStaff, 'Akun staf berhasil dibuat', 201);
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

export async function bulkCreateStaff(req, res) {
  try {
    const { staff = [] } = req.body;
    if (!Array.isArray(staff) || staff.length === 0) {
      return errorResponse(res, 'Daftar staf tidak valid atau kosong', 400);
    }

    const isOwner = req.user?.role === 'OWNER';
    const validRoles = ['OWNER', 'MANAGER', 'CASHIER', 'KITCHEN', 'BARISTA'];
    const createdList = [];
    const skippedList = [];

    await prisma.$transaction(async (tx) => {
      for (const item of staff) {
        const name = String(item.name || '').trim();
        const username = String(item.username || '').trim().toLowerCase();
        const password = String(item.password || '').trim();

        if (!name || !username || !password || password.length < 6) {
          skippedList.push({ username: username || name, reason: 'Data nama/username/password tidak lengkap atau password < 6 karakter' });
          continue;
        }

        let role = String(item.role || 'CASHIER').toUpperCase().trim();
        if (!validRoles.includes(role)) role = 'CASHIER';

        if (!isOwner && role === 'OWNER') {
          role = 'CASHIER';
        }

        const existing = await tx.user.findUnique({ where: { username } });
        if (existing) {
          skippedList.push({ username, reason: 'Username sudah digunakan' });
          continue;
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newStaff = await tx.user.create({
          data: {
            name,
            username,
            password: hashedPassword,
            role,
            phone: item.phone ? String(item.phone).trim() : null,
            department: item.department ? String(item.department).trim() : 'Operasional',
            jobTitle: item.jobTitle ? String(item.jobTitle).trim() : null,
            employmentType: item.employmentType || 'FULL_TIME',
            joinDate: item.joinDate || new Date().toISOString().split('T')[0],
            baseSalary: isOwner && item.baseSalary ? Number(item.baseSalary) : 0,
            dailyAllowance: isOwner && item.dailyAllowance ? Number(item.dailyAllowance) : 0,
            hourlyOvertimeRate: isOwner && item.hourlyOvertimeRate ? Number(item.hourlyOvertimeRate) : 0,
            isActive: true,
          },
          select: {
            id: true,
            name: true,
            username: true,
            role: true,
            phone: true,
            department: true,
            jobTitle: true,
            isActive: true,
          },
        });

        createdList.push(newStaff);
      }
    });

    if (req.user?.id) {
      await logHrisAudit(req.user.id, 'STAFF_BULK_CREATE', 'STAFF', null, { createdCount: createdList.length, skippedCount: skippedList.length }, req);
    }

    return successResponse(
      res,
      { created: createdList, skipped: skippedList, count: createdList.length },
      `Berhasil mengimpor ${createdList.length} staf baru` + (skippedList.length > 0 ? ` (${skippedList.length} dilewati)` : ''),
      201
    );
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

export async function updateStaff(req, res) {
  try {
    const { id } = req.params;
    const {
      name,
      role,
      phone,
      password,
      isActive,
      department,
      jobTitle,
      employmentType,
      joinDate,
      baseSalary,
      dailyAllowance,
      hourlyOvertimeRate,
    } = req.body;

    const existing = await prisma.user.findUnique({ where: { id: Number(id) } });
    if (!existing) {
      return errorResponse(res, 'Staf tidak ditemukan', 404);
    }

    // Role safety: Manager cannot edit or deactivate Owner
    if (existing.role === 'OWNER' && req.user.role !== 'OWNER') {
      return errorResponse(res, 'Hanya Owner yang dapat mengubah data akun Owner', 403);
    }

    const updateData = {};
    if (name) updateData.name = name.trim();
    if (role) updateData.role = role;
    if (phone !== undefined) updateData.phone = phone ? phone.trim() : null;
    if (department !== undefined) updateData.department = department;
    if (jobTitle !== undefined) updateData.jobTitle = jobTitle;
    if (employmentType !== undefined) updateData.employmentType = employmentType;
    if (joinDate !== undefined) updateData.joinDate = joinDate;

    // Only owner can update salary figures
    if (req.user.role === 'OWNER') {
      if (baseSalary !== undefined) updateData.baseSalary = Number(baseSalary);
      if (dailyAllowance !== undefined) updateData.dailyAllowance = Number(dailyAllowance);
      if (hourlyOvertimeRate !== undefined) updateData.hourlyOvertimeRate = Number(hourlyOvertimeRate);
    }

    if (typeof isActive === 'boolean') {
      // Prevent owner from deactivating their own account
      if (existing.id === req.user.id && !isActive) {
        return errorResponse(res, 'Anda tidak dapat menonaktifkan akun yang sedang Anda gunakan', 400);
      }
      updateData.isActive = isActive;
    }

    if (password && password.trim().length >= 6) {
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(password.trim(), salt);
    }

    const updated = await prisma.user.update({
      where: { id: Number(id) },
      data: updateData,
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        phone: true,
        department: true,
        jobTitle: true,
        employmentType: true,
        joinDate: true,
        isActive: true,
        updatedAt: true,
      },
    });

    await logHrisAudit(req.user.id, 'STAFF_UPDATE', 'STAFF', updated.id, updateData, req);

    // Jika akun dinonaktifkan, paksa logout sesi aktif user tersebut secara real-time
    if (updateData.isActive === false) {
      emitForceLogout(updated.id, 'Akun Anda telah dinonaktifkan oleh pemilik kedai. Silakan hubungi manager.');
    }

    return successResponse(res, updated, 'Data staf berhasil diperbarui');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

export async function deleteStaff(req, res) {
  try {
    const { id } = req.params;
    const staffId = Number(id);

    if (staffId === req.user.id) {
      return errorResponse(res, 'Anda tidak dapat menghapus akun Anda sendiri', 400);
    }

    const existing = await prisma.user.findUnique({
      where: { id: staffId },
      include: {
        _count: {
          select: {
            orders: true,
            shifts: true,
            shiftsClosed: true,
            cashMovements: true,
            attendances: true,
            payslips: true,
            expensesCreated: true,
            expensesUpdated: true,
            assetsCreated: true,
            depreciationsProcessed: true,
            createdPayrollPeriods: true,
            approvalsRequested: true,
            approvalsDecided: true,
          },
        },
      },
    });

    if (!existing) {
      return errorResponse(res, 'Staf tidak ditemukan', 404);
    }

    const hasHistory =
      (existing._count?.orders || 0) > 0 ||
      (existing._count?.shifts || 0) > 0 ||
      (existing._count?.shiftsClosed || 0) > 0 ||
      (existing._count?.cashMovements || 0) > 0 ||
      (existing._count?.attendances || 0) > 0 ||
      (existing._count?.payslips || 0) > 0 ||
      (existing._count?.expensesCreated || 0) > 0 ||
      (existing._count?.expensesUpdated || 0) > 0 ||
      (existing._count?.assetsCreated || 0) > 0 ||
      (existing._count?.depreciationsProcessed || 0) > 0 ||
      (existing._count?.createdPayrollPeriods || 0) > 0 ||
      (existing._count?.approvalsRequested || 0) > 0 ||
      (existing._count?.approvalsDecided || 0) > 0;

    if (hasHistory) {
      // Soft-deactivate to preserve historical transactions, cash shifts, and audit trails
      await prisma.user.update({
        where: { id: staffId },
        data: { isActive: false },
      });

      await logHrisAudit(req.user.id, 'STAFF_DEACTIVATE', 'STAFF', staffId, { name: existing.name }, req);
      emitForceLogout(staffId, 'Akun Anda telah dinonaktifkan oleh pemilik kedai.');

      return successResponse(
        res,
        { id: staffId, isSoftDeleted: true, isHardDeleted: false },
        'Akun staf dinonaktifkan secara aman karena memiliki riwayat transaksi/presensi/pembukuan.'
      );
    }

    // Hard-delete: Staf belum memiliki riwayat transaksi/presensi apa pun
    // Bersihkan audit log yang mereferensikan user ini tanpa cascade
    await prisma.auditLog.deleteMany({ where: { userId: staffId } });

    await prisma.user.delete({
      where: { id: staffId },
    });

    await logHrisAudit(req.user.id, 'STAFF_DELETE', 'STAFF', staffId, { name: existing.name }, req);
    emitForceLogout(staffId, 'Akun Anda telah dihapus oleh pemilik kedai.');

    return successResponse(
      res,
      { id: staffId, isHardDeleted: true, isSoftDeleted: false },
      'Akun staf berhasil dihapus permanen dari sistem.'
    );
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

// ─────────────────────────────────────────────────────────────
// 3. KEHADIRAN (ATTENDANCE) & KOREKSI ABSENSI
// ─────────────────────────────────────────────────────────────
export async function getAttendanceList(req, res) {
  try {
    const { date, staffId, startDate, endDate } = req.query;
    const isManagerOrOwner = req.user.role === 'OWNER' || req.user.role === 'MANAGER';

    const where = {};

    // IDOR Protection: Staff can only view their own attendance
    if (!isManagerOrOwner) {
      where.userId = req.user.id;
    } else if (staffId && staffId !== 'ALL' && staffId !== 'undefined' && staffId !== 'null' && !isNaN(Number(staffId))) {
      where.userId = Number(staffId);
    }

    if (date) {
      where.date = date;
    } else if (startDate && endDate) {
      where.date = { gte: startDate, lte: endDate };
    }

    const attendances = await prisma.staffAttendance.findMany({
      where,
      include: {
        user: {
          select: { id: true, name: true, username: true, role: true, department: true },
        },
      },
      orderBy: [{ date: 'desc' }, { clockIn: 'desc' }],
    });

    const formattedAttendances = attendances.map((item) => {
      let meta = null;
      let displayNotes = item.notes;
      if (item.notes && item.notes.startsWith('{')) {
        try {
          meta = JSON.parse(item.notes);
          displayNotes = meta.userNote || null;
        } catch (e) {}
      }

      return {
        ...item,
        notes: displayNotes,
        verification: meta,
        photoUrl: meta?.photoUrl || null,
        distanceMeters: meta?.distanceMeters ?? null,
        verifiedLocation: meta?.verifiedLocation ?? null,
        latitude: meta?.latitude ?? null,
        longitude: meta?.longitude ?? null,
        accuracy: meta?.accuracy ?? null,
        clockOutPhotoUrl: meta?.clockOutVerification?.photoUrl || null,
        clockOutDistanceMeters: meta?.clockOutVerification?.distanceMeters ?? null,
        clockOutLatitude: meta?.clockOutVerification?.latitude ?? null,
        clockOutLongitude: meta?.clockOutVerification?.longitude ?? null,
      };
    });

    return successResponse(res, formattedAttendances, 'Daftar presensi berhasil dimuat');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

export async function clockIn(req, res) {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();

    // Validasi jadwal kerja: Staf tidak bisa presensi jika jadwal belum diatur
    const scheduleCheck = await checkStaffScheduleToday(userId, userRole);
    if (!scheduleCheck.isScheduled) {
      return errorResponse(
        res,
        'Jadwal kerja Anda belum diatur untuk hari ini. Silakan hubungi Owner atau Manajer untuk mengatur jadwal kerja sebelum melakukan presensi.',
        403
      );
    }

    const existing = await prisma.staffAttendance.findFirst({
      where: { userId, date: today },
    });

    if (existing) {
      return errorResponse(res, 'Anda sudah melakukan Clock-In untuk hari ini', 400);
    }

    // Anti-Fraud Verification: Geofencing GPS & Foto Selfie Kehadiran
    const settingsMap = await getSettingsMap().catch(() => ({}));
    const { latitude, longitude, accuracy, photo, notes, deviceInfo } = req.body;

    const antiFraud = await verifyAttendanceAntiFraud({
      userId,
      userRole,
      latitude,
      longitude,
      accuracy,
      photo,
      settingsMap,
    });

    if (!antiFraud.valid) {
      return errorResponse(res, antiFraud.error, antiFraud.statusCode || 400);
    }

    // Check scheduled shift to calculate late status
    const scheduledShift = scheduleCheck.schedule;

    let status = 'PRESENT';
    let lateMinutes = 0;

    if (scheduledShift && scheduledShift.startTime) {
      const [schedHour, schedMin] = scheduledShift.startTime.split(':').map(Number);
      const shiftStartTime = new Date(now);
      shiftStartTime.setHours(schedHour, schedMin, 0, 0);

      if (now > shiftStartTime) {
        lateMinutes = Math.floor((now - shiftStartTime) / (1000 * 60));
        if (lateMinutes > 15) {
          status = 'LATE';
        }
      }
    }

    // Siapkan metadata anti-fraud dalam format JSON untuk disimpan di notes
    const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || null;
    const attendanceMetadata = {
      userNote: typeof notes === 'string' && !notes.startsWith('{') ? notes.trim() : null,
      photoUrl: antiFraud.photoUrl || null,
      latitude: latitude !== undefined && latitude !== null ? parseFloat(latitude) : null,
      longitude: longitude !== undefined && longitude !== null ? parseFloat(longitude) : null,
      distanceMeters: antiFraud.verifiedDistance,
      accuracy: accuracy !== undefined && accuracy !== null ? parseFloat(accuracy) : null,
      verifiedLocation: antiFraud.verifiedLocation,
      deviceInfo: typeof deviceInfo === 'string' ? deviceInfo : null,
      ip: clientIp,
      clockInTime: now.toISOString(),
    };

    const record = await prisma.staffAttendance.create({
      data: {
        userId,
        date: today,
        clockIn: now,
        status,
        lateMinutes,
        notes: JSON.stringify(attendanceMetadata),
      },
      include: {
        user: { select: { id: true, name: true, role: true } },
      },
    });

    await logHrisAudit(
      userId,
      'ATTENDANCE_CLOCK_IN',
      'ATTENDANCE',
      record.id,
      {
        date: today,
        status,
        distanceMeters: antiFraud.verifiedDistance,
        hasPhoto: Boolean(antiFraud.photoUrl),
      },
      req
    );

    const formattedRecord = {
      ...record,
      notes: attendanceMetadata.userNote,
      photoUrl: antiFraud.photoUrl || null,
      distanceMeters: antiFraud.verifiedDistance,
      verifiedLocation: antiFraud.verifiedLocation,
      verification: attendanceMetadata,
    };

    return successResponse(res, formattedRecord, 'Clock-In berhasil dicatat pada server', 201);
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

export async function clockOut(req, res) {
  try {
    const userId = req.user.id;
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();

    const attendance = await prisma.staffAttendance.findFirst({
      where: { userId, date: today },
      orderBy: { id: 'desc' },
    });

    if (!attendance) {
      return errorResponse(res, 'Anda belum melakukan Clock-In hari ini', 400);
    }

    if (attendance.clockOut) {
      return errorResponse(res, 'Anda sudah melakukan Clock-Out hari ini', 400);
    }

    // 4. Periksa apakah karyawan memiliki sesi kasir aktif yang menjadi tanggung jawabnya
    // Sesuai Aturan Bisnis: Presensi independen per-karyawan, jangan memblokir karena sesi karyawan lain
    const activeShift = await prisma.shift.findFirst({
      where: {
        cashierId: userId,
        closedAt: null,
      },
      include: {
        register: { select: { id: true, name: true, code: true } },
      },
    });

    if (activeShift) {
      return errorResponse(
        res,
        'Anda masih memiliki sesi kasir aktif. Tutup sesi atau selesaikan serah terima sebelum presensi pulang.',
        400,
        {
          code: 'ACTIVE_CASHIER_SESSION_EXISTS',
          shiftId: activeShift.id,
          registerId: activeShift.registerId,
          registerName: activeShift.register?.name || 'Kasir Utama',
          openedAt: activeShift.openedAt,
        }
      );
    }

    const workMinutes = Math.max(0, Math.round((now - new Date(attendance.clockIn)) / (1000 * 60)));

    // Anti-Fraud Verification untuk Clock-Out (Selfie Pulang & Geofencing GPS)
    const settingsMap = await getSettingsMap().catch(() => ({}));
    const { latitude, longitude, accuracy, photo, notes, deviceInfo } = req.body;

    const antiFraud = await verifyAttendanceAntiFraud({
      userId,
      userRole: req.user.role,
      latitude,
      longitude,
      accuracy,
      photo,
      settingsMap,
      type: 'out',
    });

    if (!antiFraud.valid) {
      return errorResponse(res, antiFraud.error, antiFraud.statusCode || 400);
    }

    const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || null;

    let meta = {};
    try {
      if (attendance.notes && attendance.notes.startsWith('{')) {
        meta = JSON.parse(attendance.notes);
      }
    } catch (e) {}

    meta.clockOutVerification = {
      photoUrl: antiFraud.photoUrl || null,
      latitude: latitude !== undefined && latitude !== null ? parseFloat(latitude) : null,
      longitude: longitude !== undefined && longitude !== null ? parseFloat(longitude) : null,
      distanceMeters: antiFraud.verifiedDistance,
      accuracy: accuracy !== undefined && accuracy !== null ? parseFloat(accuracy) : null,
      verifiedLocation: antiFraud.verifiedLocation,
      deviceInfo: typeof deviceInfo === 'string' ? deviceInfo : null,
      ip: clientIp,
      clockOutTime: now.toISOString(),
      userNote: typeof notes === 'string' && !notes.startsWith('{') ? notes.trim() : null,
    };

    // Cegah duplikasi & race condition presensi pulang ganda menggunakan atomic check dalam transaksi database
    const updated = await prisma.$transaction(async (tx) => {
      const currentAtt = await tx.staffAttendance.findUnique({
        where: { id: attendance.id },
      });

      if (!currentAtt || currentAtt.clockOut !== null) {
        throw new Error('Anda sudah melakukan Clock-Out hari ini');
      }

      return tx.staffAttendance.update({
        where: { id: attendance.id },
        data: {
          clockOut: now,
          workMinutes,
          notes: JSON.stringify(meta),
        },
        include: {
          user: { select: { id: true, name: true, role: true } },
        },
      });
    });

    await logHrisAudit(
      userId,
      'ATTENDANCE_CLOCK_OUT',
      'ATTENDANCE',
      updated.id,
      {
        workMinutes,
        distanceMeters: antiFraud.verifiedDistance,
        hasPhoto: Boolean(antiFraud.photoUrl),
      },
      req
    );

    const formattedUpdated = {
      ...updated,
      notes: meta.userNote || null,
      verification: meta,
      photoUrl: meta?.photoUrl || null,
      distanceMeters: meta?.distanceMeters ?? null,
      verifiedLocation: meta?.verifiedLocation ?? null,
      latitude: meta?.latitude ?? null,
      longitude: meta?.longitude ?? null,
      accuracy: meta?.accuracy ?? null,
      clockOutPhotoUrl: meta?.clockOutVerification?.photoUrl || null,
      clockOutDistanceMeters: meta?.clockOutVerification?.distanceMeters ?? null,
      clockOutLatitude: meta?.clockOutVerification?.latitude ?? null,
      clockOutLongitude: meta?.clockOutVerification?.longitude ?? null,
    };

    return successResponse(res, formattedUpdated, 'Clock-Out berhasil dicatat');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

export async function createManualAttendance(req, res) {
  try {
    const { userId, date, clockIn, clockOut, status, notes } = req.body;

    if (!userId || !date) {
      return errorResponse(res, 'User ID dan tanggal wajib diisi', 400);
    }

    const clockInDate = clockIn ? new Date(clockIn) : new Date();
    const clockOutDate = clockOut ? new Date(clockOut) : null;
    let workMinutes = 0;

    if (clockOutDate && clockInDate) {
      workMinutes = Math.max(0, Math.round((clockOutDate - clockInDate) / (1000 * 60)));
    }

    const record = await prisma.staffAttendance.create({
      data: {
        userId: Number(userId),
        date,
        clockIn: clockInDate,
        clockOut: clockOutDate,
        workMinutes,
        status: status || 'PRESENT',
        notes: notes || 'Entri manual oleh Manager/Owner',
      },
      include: {
        user: { select: { id: true, name: true, role: true } },
      },
    });

    await logHrisAudit(req.user.id, 'ATTENDANCE_MANUAL_ENTRY', 'ATTENDANCE', record.id, { userId, date }, req);

    return successResponse(res, record, 'Kehadiran manual berhasil disimpan', 201);
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

export async function deleteAttendance(req, res) {
  try {
    const { id } = req.params;
    await prisma.staffAttendance.delete({ where: { id: Number(id) } });
    await logHrisAudit(req.user.id, 'ATTENDANCE_DELETE', 'ATTENDANCE', Number(id), null, req);
    return successResponse(res, null, 'Catatan presensi berhasil dihapus');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

// Koreksi Absensi (Maker-Checker Compliant)
export async function getAttendanceCorrections(req, res) {
  try {
    const isManagerOrOwner = req.user.role === 'OWNER' || req.user.role === 'MANAGER';
    const where = {};

    if (!isManagerOrOwner) {
      where.userId = req.user.id;
    }

    const corrections = await prisma.staffAttendanceCorrection.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, username: true, role: true } },
        reviewedBy: { select: { id: true, name: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return successResponse(res, corrections, 'Daftar pengajuan koreksi absensi berhasil dimuat');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

export async function createAttendanceCorrection(req, res) {
  try {
    const { attendanceId, date, requestedClockIn, requestedClockOut, reason } = req.body;
    const userId = req.user.id;

    if (!date || !reason) {
      return errorResponse(res, 'Tanggal dan alasan koreksi wajib diisi', 400);
    }

    const correction = await prisma.staffAttendanceCorrection.create({
      data: {
        attendanceId: attendanceId ? Number(attendanceId) : null,
        userId,
        date,
        requestedClockIn: requestedClockIn ? new Date(requestedClockIn) : null,
        requestedClockOut: requestedClockOut ? new Date(requestedClockOut) : null,
        reason: reason.trim(),
        status: 'PENDING',
      },
      include: {
        user: { select: { id: true, name: true, role: true } },
      },
    });

    await logHrisAudit(userId, 'CORRECTION_REQUEST', 'CORRECTION', correction.id, { date, reason }, req);

    return successResponse(res, correction, 'Permohonan koreksi absensi berhasil diajukan', 201);
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

export async function reviewAttendanceCorrection(req, res) {
  try {
    const { id } = req.params;
    let { status, reviewNotes } = req.body; // APPROVED or REJECTED
    if (status === 'SETUJUI') status = 'APPROVED';
    if (status === 'DITOLAK') status = 'REJECTED';

    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return errorResponse(res, 'Status harus berupa APPROVED atau REJECTED', 400);
    }

    const correction = await prisma.staffAttendanceCorrection.findUnique({
      where: { id: Number(id) },
    });

    if (!correction) {
      return errorResponse(res, 'Pengajuan koreksi tidak ditemukan', 404);
    }

    // Maker-Checker Protection: Reviewer CANNOT be the requester!
    if (correction.userId === req.user.id) {
      return errorResponse(
        res,
        'Akses ditolak (Prinsip Maker-Checker): Anda dilarang menyetujui koreksi absensi Anda sendiri',
        403
      );
    }

    const updated = await prisma.staffAttendanceCorrection.update({
      where: { id: Number(id) },
      data: {
        status,
        reviewedById: req.user.id,
        reviewedAt: new Date(),
        reviewNotes: reviewNotes || null,
      },
    });

    // If approved, update or create the corresponding StaffAttendance record
    if (status === 'APPROVED') {
      const clockIn = correction.requestedClockIn || new Date();
      const clockOut = correction.requestedClockOut || null;
      let workMinutes = 0;
      if (clockIn && clockOut) {
        workMinutes = Math.max(0, Math.round((new Date(clockOut) - new Date(clockIn)) / (1000 * 60)));
      }

      if (correction.attendanceId) {
        await prisma.staffAttendance.update({
          where: { id: correction.attendanceId },
          data: {
            clockIn,
            clockOut,
            workMinutes,
            notes: `Dikoreksi oleh supervisor (Tiket #${correction.id})`,
          },
        });
      } else {
        await prisma.staffAttendance.create({
          data: {
            userId: correction.userId,
            date: correction.date,
            clockIn,
            clockOut,
            workMinutes,
            status: 'PRESENT',
            notes: `Hasil koreksi absensi #${correction.id}`,
          },
        });
      }
    }

    await logHrisAudit(req.user.id, `CORRECTION_${status}`, 'CORRECTION', Number(id), { status }, req);

    return successResponse(res, updated, `Pengajuan koreksi absensi berhasil di-${status.toLowerCase()}`);
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

// ─────────────────────────────────────────────────────────────
// 4. JADWAL KERJA (SHIFTS & SCHEDULES)
// ─────────────────────────────────────────────────────────────
export async function getScheduleList(req, res) {
  try {
    const { startDate, endDate, staffId } = req.query;
    const isManagerOrOwner = req.user.role === 'OWNER' || req.user.role === 'MANAGER';
    const where = {};

    if (!isManagerOrOwner) {
      where.userId = req.user.id;
    } else if (staffId && staffId !== 'ALL' && staffId !== 'undefined' && staffId !== 'null' && !isNaN(Number(staffId))) {
      where.userId = Number(staffId);
    }

    if (startDate && endDate) {
      where.date = { gte: startDate, lte: endDate };
    }

    const schedules = await prisma.staffSchedule.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, username: true, role: true, department: true } },
      },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });

    return successResponse(res, schedules, 'Jadwal kerja berhasil dimuat');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

export async function createSchedule(req, res) {
  try {
    const { userId, date, shiftName, startTime, endTime, notes, status } = req.body;

    if (!userId || !date || !startTime || !endTime) {
      return errorResponse(res, 'Staf, tanggal, jam mulai, dan jam selesai wajib diisi', 400);
    }

    // Schedule Conflict Check: Prevent overlapping shifts on the same day for same staff
    const conflicting = await prisma.staffSchedule.findFirst({
      where: {
        userId: Number(userId),
        date,
        startTime: { lte: endTime },
        endTime: { gte: startTime },
      },
    });

    if (conflicting) {
      return errorResponse(
        res,
        `Konflik Jadwal: Staf sudah memiliki shift ${conflicting.shiftName} (${conflicting.startTime} - ${conflicting.endTime}) pada tanggal ini`,
        400
      );
    }

    const schedule = await prisma.staffSchedule.create({
      data: {
        userId: Number(userId),
        date,
        shiftName: shiftName || 'PAGI',
        startTime,
        endTime,
        status: status || 'PUBLISHED',
        notes: notes || null,
      },
      include: {
        user: { select: { id: true, name: true, role: true } },
      },
    });

    await logHrisAudit(req.user.id, 'SCHEDULE_CREATE', 'SCHEDULE', schedule.id, { userId, date, shiftName }, req);

    return successResponse(res, schedule, 'Jadwal shift berhasil ditambahkan', 201);
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

export async function deleteSchedule(req, res) {
  try {
    const { id } = req.params;
    await prisma.staffSchedule.delete({ where: { id: Number(id) } });
    await logHrisAudit(req.user.id, 'SCHEDULE_DELETE', 'SCHEDULE', Number(id), null, req);
    return successResponse(res, null, 'Jadwal berhasil dihapus');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

export async function getMyTodaySchedule(req, res) {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const result = await checkStaffScheduleToday(userId, userRole);
    const eligibility = await checkStaffShiftEligibility(userId, userRole);
    const attendanceCheck = await checkStaffAttendanceToday(userId, userRole);

    // Ambil sesi kasir aktif yang menjadi tanggung jawab karyawan ini
    const activeShift = await prisma.shift.findFirst({
      where: { cashierId: userId, closedAt: null },
      include: {
        register: { select: { id: true, name: true, code: true } },
      },
    });

    const hasActiveShift = Boolean(activeShift);
    const shiftActionMessage = hasActiveShift
      ? 'Anda masih memiliki sesi kasir aktif. Tutup sesi atau selesaikan serah terima sebelum presensi pulang.'
      : 'Anda dapat melakukan presensi pulang. Sesi kasir milik karyawan lain tidak terpengaruh.';

    return successResponse(
      res,
      {
        ...result,
        hasClockedIn: userRole === 'OWNER' ? true : (!attendanceCheck.isEnforced ? true : Boolean(eligibility.attendance?.clockIn)),
        isAttendanceEnforced: attendanceCheck.isEnforced,
        canTransact: eligibility.eligible,
        isClockedOut: Boolean(eligibility.attendance?.clockOut),
        attendance: eligibility.attendance || null,
        eligibility,
        hasActiveShift,
        shiftActionMessage,
        activeShift: activeShift
          ? {
              id: activeShift.id,
              registerId: activeShift.registerId,
              registerName: activeShift.register?.name || 'Kasir Utama',
              registerCode: activeShift.register?.code || 'REG-01',
              openedAt: activeShift.openedAt,
              openingCash: parseFloat(activeShift.openingCash || 0),
            }
          : null,
      },
      result.isScheduled ? 'Jadwal kerja aktif ditemukan' : 'Jadwal kerja belum diatur'
    );
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

export async function getMyAttendanceStatus(req, res) {
  return getMyTodaySchedule(req, res);
}

// ─────────────────────────────────────────────────────────────
// 5. PENGAJUAN CUTI & LEMBUR (LEAVES & OVERTIME)
// ─────────────────────────────────────────────────────────────
export async function getLeaveList(req, res) {
  try {
    const isManagerOrOwner = req.user.role === 'OWNER' || req.user.role === 'MANAGER';
    const where = {};

    if (!isManagerOrOwner) {
      where.userId = req.user.id;
    }

    const leaves = await prisma.staffLeave.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, username: true, role: true, department: true } },
        approvedBy: { select: { id: true, name: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return successResponse(res, leaves, 'Daftar pengajuan cuti berhasil dimuat');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

export async function createLeaveRequest(req, res) {
  try {
    const { type, startDate, endDate, days, reason } = req.body;
    const userId = req.user.id;

    if (!startDate || !endDate || !reason) {
      return errorResponse(res, 'Tanggal mulai, tanggal selesai, dan alasan wajib diisi', 400);
    }

    const leave = await prisma.staffLeave.create({
      data: {
        userId,
        type: type || 'ANNUAL',
        startDate,
        endDate,
        days: days ? Number(days) : 1,
        reason: reason.trim(),
        status: 'PENDING',
      },
      include: {
        user: { select: { id: true, name: true, role: true } },
      },
    });

    await logHrisAudit(userId, 'LEAVE_REQUEST', 'LEAVE', leave.id, { startDate, endDate, type }, req);

    return successResponse(res, leave, 'Pengajuan cuti berhasil dikirim', 201);
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

export async function updateLeaveStatus(req, res) {
  try {
    const { id } = req.params;
    let { status, notes } = req.body;
    if (status === 'SETUJUI') status = 'APPROVED';
    if (status === 'DITOLAK') status = 'REJECTED';

    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return errorResponse(res, 'Status harus berupa APPROVED atau REJECTED', 400);
    }

    const leave = await prisma.staffLeave.findUnique({ where: { id: Number(id) } });
    if (!leave) {
      return errorResponse(res, 'Pengajuan cuti tidak ditemukan', 404);
    }

    // Maker-Checker Protection: Reviewer CANNOT approve their own leave request!
    if (leave.userId === req.user.id) {
      return errorResponse(
        res,
        'Akses ditolak (Prinsip Maker-Checker): Anda dilarang menyetujui pengajuan cuti Anda sendiri',
        403
      );
    }

    const updated = await prisma.staffLeave.update({
      where: { id: Number(id) },
      data: {
        status,
        approvedById: req.user.id,
        notes: notes || null,
      },
    });

    await logHrisAudit(req.user.id, `LEAVE_${status}`, 'LEAVE', Number(id), { status }, req);

    return successResponse(res, updated, `Pengajuan cuti berhasil di-${status.toLowerCase()}`);
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

export async function deleteLeave(req, res) {
  try {
    const { id } = req.params;
    const leave = await prisma.staffLeave.findUnique({ where: { id: Number(id) } });
    if (!leave) {
      return errorResponse(res, 'Pengajuan cuti tidak ditemukan', 404);
    }

    // Only owner/manager or the leave owner can cancel/delete
    const isOwnerOrManager = req.user.role === 'OWNER' || req.user.role === 'MANAGER';
    if (!isOwnerOrManager && leave.userId !== req.user.id) {
      return errorResponse(res, 'Akses ditolak', 403);
    }

    await prisma.staffLeave.delete({ where: { id: Number(id) } });
    await logHrisAudit(req.user.id, 'LEAVE_CANCEL', 'LEAVE', Number(id), null, req);

    return successResponse(res, null, 'Pengajuan cuti berhasil dibatalkan');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

// Lembur (Overtime)
export async function getOvertimeList(req, res) {
  try {
    const isManagerOrOwner = req.user.role === 'OWNER' || req.user.role === 'MANAGER';
    const where = {};

    if (!isManagerOrOwner) {
      where.userId = req.user.id;
    }

    const overtimes = await prisma.staffOvertime.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, username: true, role: true, department: true } },
        approvedBy: { select: { id: true, name: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return successResponse(
      res,
      overtimes.map((o) => ({ ...o, durationHours: Number(o.durationHours) })),
      'Daftar pengajuan lembur berhasil dimuat'
    );
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

export async function createOvertimeRequest(req, res) {
  try {
    const { date, durationHours, reason } = req.body;
    const userId = req.user.id;

    if (!date || !durationHours || !reason) {
      return errorResponse(res, 'Tanggal, durasi jam, dan alasan lembur wajib diisi', 400);
    }

    const overtime = await prisma.staffOvertime.create({
      data: {
        userId,
        date,
        durationHours: Number(durationHours),
        reason: reason.trim(),
        status: 'PENDING',
      },
      include: {
        user: { select: { id: true, name: true, role: true } },
      },
    });

    await logHrisAudit(userId, 'OVERTIME_REQUEST', 'OVERTIME', overtime.id, { date, durationHours }, req);

    return successResponse(
      res,
      { ...overtime, durationHours: Number(overtime.durationHours) },
      'Pengajuan lembur berhasil dikirim',
      201
    );
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

export async function reviewOvertime(req, res) {
  try {
    const { id } = req.params;
    let { status, notes } = req.body;
    if (status === 'SETUJUI') status = 'APPROVED';
    if (status === 'DITOLAK') status = 'REJECTED';

    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return errorResponse(res, 'Status harus berupa APPROVED atau REJECTED', 400);
    }

    const overtime = await prisma.staffOvertime.findUnique({ where: { id: Number(id) } });
    if (!overtime) {
      return errorResponse(res, 'Pengajuan lembur tidak ditemukan', 404);
    }

    // Maker-Checker Protection: Cannot approve own overtime request
    if (overtime.userId === req.user.id) {
      return errorResponse(
        res,
        'Akses ditolak (Prinsip Maker-Checker): Anda dilarang menyetujui pengajuan lembur Anda sendiri',
        403
      );
    }

    const updated = await prisma.staffOvertime.update({
      where: { id: Number(id) },
      data: {
        status,
        approvedById: req.user.id,
        approvedAt: new Date(),
        notes: notes || null,
      },
    });

    await logHrisAudit(req.user.id, `OVERTIME_${status}`, 'OVERTIME', Number(id), { status }, req);

    return successResponse(res, updated, `Pengajuan lembur berhasil di-${status.toLowerCase()}`);
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

// ─────────────────────────────────────────────────────────────
// 6. PAYROLL & SLIP GAJI
// ─────────────────────────────────────────────────────────────
export async function getPayrollPeriods(req, res) {
  try {
    const periods = await prisma.payrollPeriod.findMany({
      include: {
        createdBy: { select: { id: true, name: true } },
        _count: { select: { payslips: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return successResponse(
      res,
      periods.map((p) => ({
        ...p,
        totalPayout: Number(p.totalPayout),
      })),
      'Daftar periode payroll berhasil dimuat'
    );
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

export async function createPayrollPeriod(req, res) {
  try {
    const { name, startDate, endDate } = req.body;

    if (!name || !startDate || !endDate) {
      return errorResponse(res, 'Nama periode, tanggal mulai, dan tanggal selesai wajib diisi', 400);
    }

    const period = await prisma.payrollPeriod.create({
      data: {
        name: name.trim(),
        startDate,
        endDate,
        createdById: req.user.id,
        status: 'DRAFT',
      },
    });

    await logHrisAudit(req.user.id, 'PAYROLL_PERIOD_CREATE', 'PAYROLL', period.id, { name }, req);

    return successResponse(res, period, 'Periode payroll berhasil dibuat', 201);
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

export async function calculatePayrollPeriod(req, res) {
  try {
    const { id } = req.params;
    const period = await prisma.payrollPeriod.findUnique({ where: { id: Number(id) } });

    if (!period) {
      return errorResponse(res, 'Periode payroll tidak ditemukan', 404);
    }

    if (period.status === 'FINALIZED' || period.status === 'PUBLISHED') {
      return errorResponse(res, 'Periode payroll yang sudah difinalisasi tidak dapat dihitung ulang', 400);
    }

    // Get all active staff
    const activeStaff = await prisma.user.findMany({
      where: { isActive: true },
    });

    const staffIds = activeStaff.map((s) => s.id);

    // Batch query attendances and overtimes for all active staff in period (eliminates N+1 queries)
    const [allAttendances, allOvertimes] = await Promise.all([
      prisma.staffAttendance.findMany({
        where: {
          userId: { in: staffIds },
          date: { gte: period.startDate, lte: period.endDate },
        },
      }),
      prisma.staffOvertime.findMany({
        where: {
          userId: { in: staffIds },
          date: { gte: period.startDate, lte: period.endDate },
          status: 'APPROVED',
        },
      }),
    ]);

    // Group by userId for O(1) in-memory lookup
    const attendanceMap = new Map();
    for (const att of allAttendances) {
      if (!attendanceMap.has(att.userId)) attendanceMap.set(att.userId, []);
      attendanceMap.get(att.userId).push(att);
    }

    const overtimeMap = new Map();
    for (const ot of allOvertimes) {
      if (!overtimeMap.has(ot.userId)) overtimeMap.set(ot.userId, []);
      overtimeMap.get(ot.userId).push(ot);
    }

    let totalPayout = 0;

    for (const staff of activeStaff) {
      // 1. Calculate attendance in period
      const attendances = attendanceMap.get(staff.id) || [];
      const presentDays = attendances.length;
      const totalLateMinutes = attendances.reduce((acc, curr) => acc + (curr.lateMinutes || 0), 0);

      // 2. Calculate approved overtime in period
      const overtimes = overtimeMap.get(staff.id) || [];
      const totalOvertimeHours = overtimes.reduce((acc, curr) => acc + Number(curr.durationHours || 0), 0);

      // 3. Formula calculations
      const baseSalary = Number(staff.baseSalary || 0);
      const allowances = Number(staff.dailyAllowance || 0) * presentDays;
      const overtimePay = Number(staff.hourlyOvertimeRate || 0) * totalOvertimeHours;

      // Late deduction: Rp 500 per late minute above 15 mins (or customizable)
      const deductions = Math.max(0, Math.floor(totalLateMinutes / 15) * 5000);
      const bonus = 0;
      const netSalary = Math.max(0, baseSalary + allowances + overtimePay + bonus - deductions);

      totalPayout += netSalary;

      // Upsert payslip for staff in this period
      await prisma.staffPayslip.upsert({
        where: {
          periodId_userId: {
            periodId: period.id,
            userId: staff.id,
          },
        },
        create: {
          periodId: period.id,
          userId: staff.id,
          baseSalary,
          allowances,
          overtimePay,
          bonus,
          deductions,
          netSalary,
          presentDays,
          overtimeHours: totalOvertimeHours,
          lateMinutes: totalLateMinutes,
          status: 'DRAFT',
        },
        update: {
          baseSalary,
          allowances,
          overtimePay,
          bonus,
          deductions,
          netSalary,
          presentDays,
          overtimeHours: totalOvertimeHours,
          lateMinutes: totalLateMinutes,
        },
      });
    }

    const updatedPeriod = await prisma.payrollPeriod.update({
      where: { id: period.id },
      data: {
        totalPayout,
        status: 'CALCULATED',
      },
    });

    await logHrisAudit(req.user.id, 'PAYROLL_CALCULATE', 'PAYROLL', period.id, { totalPayout }, req);

    return successResponse(
      res,
      { ...updatedPeriod, totalPayout: Number(updatedPeriod.totalPayout) },
      'Kalkulasi payroll berhasil diselesaikan'
    );
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

export async function finalizePayrollPeriod(req, res) {
  try {
    const { id } = req.params;
    const period = await prisma.payrollPeriod.findUnique({ where: { id: Number(id) } });

    if (!period) {
      return errorResponse(res, 'Periode payroll tidak ditemukan', 404);
    }

    const updated = await prisma.payrollPeriod.update({
      where: { id: Number(id) },
      data: {
        status: 'FINALIZED',
        finalizedAt: new Date(),
      },
    });

    await logHrisAudit(req.user.id, 'PAYROLL_FINALIZE', 'PAYROLL', Number(id), null, req);

    return successResponse(res, updated, 'Periode payroll berhasil difinalisasi');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

export async function publishPayrollPeriod(req, res) {
  try {
    const { id } = req.params;
    const period = await prisma.payrollPeriod.findUnique({ where: { id: Number(id) } });

    if (!period) {
      return errorResponse(res, 'Periode payroll tidak ditemukan', 404);
    }

    // Publish all payslips in this period
    await prisma.staffPayslip.updateMany({
      where: { periodId: Number(id) },
      data: { status: 'PUBLISHED' },
    });

    const updated = await prisma.payrollPeriod.update({
      where: { id: Number(id) },
      data: { status: 'PUBLISHED' },
    });

    await logHrisAudit(req.user.id, 'PAYROLL_PUBLISH', 'PAYROLL', Number(id), null, req);

    return successResponse(res, updated, 'Slip gaji untuk seluruh staf berhasil dipublikasikan');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

export async function getPeriodPayslips(req, res) {
  try {
    const { id } = req.params;

    const payslips = await prisma.staffPayslip.findMany({
      where: { periodId: Number(id) },
      include: {
        user: { select: { id: true, name: true, username: true, role: true, department: true, jobTitle: true } },
      },
    });

    return successResponse(
      res,
      payslips.map((p) => ({
        ...p,
        baseSalary: Number(p.baseSalary),
        allowances: Number(p.allowances),
        overtimePay: Number(p.overtimePay),
        bonus: Number(p.bonus),
        deductions: Number(p.deductions),
        netSalary: Number(p.netSalary),
        overtimeHours: Number(p.overtimeHours),
      })),
      'Daftar slip gaji periode berhasil dimuat'
    );
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

// Employee Self-Service (ESS): Staf Kasir/Barista/Dapur hanya melihat slip gaji sendiri!
export async function getMyPayslips(req, res) {
  try {
    const userId = req.user.id;

    const payslips = await prisma.staffPayslip.findMany({
      where: {
        userId,
        status: 'PUBLISHED', // Only published payslips are visible to employees
      },
      include: {
        period: { select: { id: true, name: true, startDate: true, endDate: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return successResponse(
      res,
      payslips.map((p) => ({
        ...p,
        baseSalary: Number(p.baseSalary),
        allowances: Number(p.allowances),
        overtimePay: Number(p.overtimePay),
        bonus: Number(p.bonus),
        deductions: Number(p.deductions),
        netSalary: Number(p.netSalary),
        overtimeHours: Number(p.overtimeHours),
      })),
      'Daftar slip gaji Anda berhasil dimuat'
    );
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

export async function getMyPayslipDetail(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const isOwner = req.user.role === 'OWNER';

    const payslip = await prisma.staffPayslip.findUnique({
      where: { id: Number(id) },
      include: {
        period: true,
        user: { select: { id: true, name: true, role: true, department: true, jobTitle: true } },
      },
    });

    if (!payslip) {
      return errorResponse(res, 'Slip gaji tidak ditemukan', 404);
    }

    // IDOR Protection: Staff can ONLY access their own payslip
    if (!isOwner && payslip.userId !== userId) {
      return errorResponse(res, 'Akses ditolak: Anda tidak memiliki izin melihat slip gaji staf lain', 403);
    }

    return successResponse(
      res,
      {
        ...payslip,
        baseSalary: Number(payslip.baseSalary),
        allowances: Number(payslip.allowances),
        overtimePay: Number(payslip.overtimePay),
        bonus: Number(payslip.bonus),
        deductions: Number(payslip.deductions),
        netSalary: Number(payslip.netSalary),
        overtimeHours: Number(payslip.overtimeHours),
      },
      'Detail slip gaji berhasil dimuat'
    );
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

// ─────────────────────────────────────────────────────────────
// 7. HR AUDIT LOGS
// ─────────────────────────────────────────────────────────────
export async function getHrisAuditLogs(req, res) {
  try {
    const { limit = 50, entityType } = req.query;
    const where = {};
    if (entityType) where.entityType = entityType;

    const logs = await prisma.hrisAuditLog.findMany({
      where,
      take: Number(limit),
      include: {
        user: { select: { id: true, name: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return successResponse(res, logs, 'Histori audit log HR berhasil dimuat');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

// ─────────────────────────────────────────────────────────────
// 8. ROLES & RBAC MATRIX (5 EXISTING ROLES ONLY)
// ─────────────────────────────────────────────────────────────
export async function getRolesList(req, res) {
  try {
    const rolesMatrix = [
      {
        role: 'OWNER',
        label: 'Owner / Pemilik',
        description: 'Akses penuh dan tertinggi ke seluruh operasional bisnis, konfigurasi finansial, gaji & master data.',
        permissions: [
          'hr.dashboard.view',
          'employees.view_all',
          'employees.manage',
          'employees.manage_salary',
          'attendance.view_all',
          'attendance.manage',
          'attendance.correction_approve',
          'shifts.view_all',
          'shifts.manage',
          'shifts.publish',
          'leave.view_all',
          'leave.approve',
          'overtime.view_all',
          'overtime.approve',
          'payroll.manage',
          'payroll.calculate',
          'payroll.finalize',
          'payroll.publish',
          'audit.view_all',
        ],
      },
      {
        role: 'MANAGER',
        label: 'Store Manager',
        description: 'Mengelola operasional staf, shift kerja harian, persetujuan absensi & cuti bawahan.',
        permissions: [
          'hr.dashboard.view',
          'employees.view_all',
          'employees.manage_operational',
          'attendance.view_all',
          'attendance.correction_approve',
          'shifts.view_all',
          'shifts.manage',
          'shifts.publish',
          'leave.view_all',
          'leave.approve_subordinate',
          'overtime.view_all',
          'overtime.approve_subordinate',
          'payroll.view_summary',
        ],
      },
      {
        role: 'CASHIER',
        label: 'Kasir',
        description: 'Employee Self-Service (ESS) untuk absensi mandiri, melihat jadwal kerja, cuti, lembur, dan slip gaji.',
        permissions: [
          'attendance.clock_self',
          'shifts.view_self',
          'leave.request_self',
          'overtime.request_self',
          'attendance.correction_request_self',
          'payslips.view_self',
        ],
      },
      {
        role: 'BARISTA',
        label: 'Barista',
        description: 'Employee Self-Service (ESS) untuk absensi mandiri, melihat jadwal shift bar, permohonan izin & slip gaji.',
        permissions: [
          'attendance.clock_self',
          'shifts.view_self',
          'leave.request_self',
          'overtime.request_self',
          'attendance.correction_request_self',
          'payslips.view_self',
        ],
      },
      {
        role: 'KITCHEN',
        label: 'Staff Dapur',
        description: 'Employee Self-Service (ESS) untuk absensi mandiri, melihat jadwal shift kitchen, permohonan izin & slip gaji.',
        permissions: [
          'attendance.clock_self',
          'shifts.view_self',
          'leave.request_self',
          'overtime.request_self',
          'attendance.correction_request_self',
          'payslips.view_self',
        ],
      },
    ];

    const staffCounts = await prisma.user.groupBy({
      by: ['role'],
      _count: { id: true },
    });

    const result = rolesMatrix.map((r) => {
      const found = staffCounts.find((c) => c.role === r.role);
      return {
        ...r,
        userCount: found ? found._count.id : 0,
      };
    });

    return successResponse(res, result, 'Matriks peran berhasil dimuat');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}
