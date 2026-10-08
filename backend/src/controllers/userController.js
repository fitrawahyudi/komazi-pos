import bcrypt from 'bcryptjs';
import prisma from '../config/db.js';
import { successResponse, errorResponse } from '../utils/response.js';

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
    const { name, username, password, role } = req.body;

    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
      return errorResponse(res, 'Username sudah digunakan', 400);
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await prisma.user.create({
      data: {
        name,
        username,
        password: hashedPassword,
        role: role || 'CASHIER',
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
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

    return successResponse(res, updated, 'User berhasil diperbarui');
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
      data: { password: hashedPassword },
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
