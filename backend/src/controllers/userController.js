import bcrypt from 'bcryptjs';
import prisma from '../config/db.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { passwordResetService } from '../services/passwordReset.service.js';
import { emitForceLogout } from '../config/socket.js';

export async function getAllUsers(req, res) {
  try {
    const { page, limit } = req.query;
    const total = await prisma.user.count();

    const findArgs = {
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        isActive: true,
        createdAt: true,
        telegramId: true,
        telegramUsername: true,
        telegramLinkedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    };

    if (page || limit) {
      const currentPage = Math.max(1, parseInt(page) || 1);
      const perPage = Math.max(1, parseInt(limit) || 10);
      findArgs.skip = (currentPage - 1) * perPage;
      findArgs.take = perPage;
      const users = await prisma.user.findMany(findArgs);
      return successResponse(res, users, 'Daftar user berhasil diambil', 200, {
        page: currentPage,
        limit: perPage,
        total,
        totalPages: Math.ceil(total / perPage) || 1,
      });
    }

    const users = await prisma.user.findMany(findArgs);
    return successResponse(res, users, 'Daftar user berhasil diambil', 200, { total });
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

export async function createUser(req, res) {
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
      return errorResponse(res, 'Nama wajib diisi', 400);
    }
    if (!username || !username.trim()) {
      return errorResponse(res, 'Username wajib diisi', 400);
    }
    if (!password) {
      return errorResponse(res, 'Password wajib diisi', 400);
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
      return errorResponse(res, 'Password minimal 6 karakter', 400);
    }

    const validRoles = ['OWNER', 'MANAGER', 'CASHIER', 'KITCHEN', 'BARISTA'];
    const normalizedRole = String(role || 'CASHIER').toUpperCase().trim();
    if (!validRoles.includes(normalizedRole)) {
      return errorResponse(
        res,
        `Role "${role}" tidak valid. Pilihan role: ${validRoles.join(', ')}`,
        400
      );
    }

    const existing = await prisma.user.findUnique({ where: { username: cleanUsername } });
    if (existing) {
      return errorResponse(res, 'Username sudah digunakan', 400);
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    let defaultDepartment = 'Operasional';
    if (normalizedRole === 'BARISTA') defaultDepartment = 'Bar & Minuman';
    else if (normalizedRole === 'KITCHEN') defaultDepartment = 'Dapur & Makanan';
    else if (normalizedRole === 'CASHIER') defaultDepartment = 'Kasir';
    else if (normalizedRole === 'MANAGER' || normalizedRole === 'OWNER') defaultDepartment = 'Manajemen';

    const newUser = await prisma.user.create({
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
        baseSalary: baseSalary ? Number(baseSalary) : 0,
        dailyAllowance: dailyAllowance ? Number(dailyAllowance) : 0,
        hourlyOvertimeRate: hourlyOvertimeRate ? Number(hourlyOvertimeRate) : 0,
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

    return successResponse(res, newUser, 'User berhasil dibuat', 201);
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

export async function updateUser(req, res) {
  try {
    const id = parseInt(req.params.id);
    const { name, password, role, isActive } = req.body;

    const dataToUpdate = {};
    if (name) dataToUpdate.name = name;
    if (role) dataToUpdate.role = role;
    if (isActive !== undefined) dataToUpdate.isActive = isActive;
    if (password) {
      const salt = await bcrypt.genSalt(10);
      dataToUpdate.password = await bcrypt.hash(password, salt);
    }

    const updated = await prisma.user.update({
      where: { id },
      data: dataToUpdate,
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        isActive: true,
        updatedAt: true,
      },
    });

    // Jika akun dinonaktifkan, paksa logout sesi aktif user tersebut secara real-time
    if (dataToUpdate.isActive === false) {
      emitForceLogout(updated.id, 'Akun Anda telah dinonaktifkan oleh pemilik kedai. Silakan hubungi manager.');
    }

    return successResponse(res, updated, 'User berhasil diperbarui');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

export async function createPasswordResetToken(req, res) {
  try {
    const targetUserId = parseInt(req.params.id);
    const ownerId = req.user.id;

    const result = await passwordResetService.createResetToken(targetUserId, ownerId);
    return successResponse(
      res,
      result,
      'Token reset password berhasil diterbitkan. Salin dan sampaikan tautan/kode secara privat.',
      201
    );
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
}

export async function revokePasswordResetToken(req, res) {
  try {
    const targetUserId = parseInt(req.params.id);
    const ownerId = req.user.id;

    const result = await passwordResetService.revokeActiveToken(targetUserId, ownerId);
    return successResponse(res, result, 'Token reset aktif berhasil dibatalkan');
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
}

export async function getPasswordResetStatus(req, res) {
  try {
    const targetUserId = parseInt(req.params.id);
    const result = await passwordResetService.getActiveTokenStatus(targetUserId);
    return successResponse(res, result, 'Status token reset berhasil diambil');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

export async function resetPasswordByOwner(req, res) {
  try {
    const id = parseInt(req.params.id);
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return errorResponse(res, 'Password baru minimal 6 karakter', 400);
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await prisma.user.update({
      where: { id },
      data: {
        password: hashedPassword,
        tokenVersion: { increment: 1 },
      },
    });

    return successResponse(res, null, 'Password user berhasil direset oleh Owner');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

export async function deleteUser(req, res) {
  try {
    const id = parseInt(req.params.id);
    await prisma.user.delete({ where: { id } });
    return successResponse(res, null, 'Akun user berhasil dihapus');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}
