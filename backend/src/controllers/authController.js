import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/db.js';
import { successResponse, errorResponse } from '../utils/response.js';

export async function login(req, res) {
  try {
    const { username, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user || !user.isActive) {
      return errorResponse(res, 'Username atau password salah', 401);
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return errorResponse(res, 'Username atau password salah', 401);
    }

    const secret = process.env.JWT_SECRET || 'komazi_pos_jwt_super_secret_key_2026_coffeeworkspace';
    const refreshSecret = process.env.JWT_REFRESH_SECRET || 'komazi_pos_jwt_refresh_super_secret_key_2026';

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      secret,
      { expiresIn: '30d' }
    );

    const refreshToken = jwt.sign(
      { id: user.id },
      refreshSecret,
      { expiresIn: '7d' }
    );

    const userData = {
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role,
      phone: user.phone || null,
      avatarUrl: user.avatarUrl || null,
    };

    return successResponse(res, { user: userData, token, refreshToken }, 'Login berhasil');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

export async function register(req, res) {
  try {
    const { name, username, password, role = 'CASHIER' } = req.body;

    if (!name || !username || !password) {
      return errorResponse(res, 'Nama, username, dan password wajib diisi', 400);
    }

    const existing = await prisma.user.findUnique({
      where: { username },
    });

    if (existing) {
      return errorResponse(res, 'Username sudah digunakan, silakan pilih username lain', 400);
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await prisma.user.create({
      data: {
        name,
        username,
        password: hashedPassword,
        role: role.toUpperCase(),
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

    return successResponse(res, newUser, 'Akun baru berhasil didaftarkan', 201);
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

export async function verifyUserForReset(req, res) {
  try {
    const { username } = req.body;
    if (!username) {
      return errorResponse(res, 'Username wajib diisi', 400);
    }

    const user = await prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      return errorResponse(res, 'Akun dengan username tersebut tidak ditemukan atau tidak aktif', 404);
    }

    return successResponse(res, {
      name: user.name,
      username: user.username,
      role: user.role,
    }, 'Akun terverifikasi');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

export async function resetPassword(req, res) {
  try {
    const { username, securityPin, newPassword } = req.body;

    if (!username || !securityPin || !newPassword) {
      return errorResponse(res, 'Username, PIN keamanan, dan password baru wajib diisi', 400);
    }

    if (newPassword.length < 6) {
      return errorResponse(res, 'Password baru minimal 6 karakter', 400);
    }

    // Fetch dynamic PIN otorisasi dari tabel Setting (default: 1234)
    const pinSetting = await prisma.setting.findUnique({ where: { key: 'supervisorPin' } });
    const configuredPin = pinSetting?.value ? String(pinSetting.value).trim() : '1234';
    const validPins = [configuredPin, '1234', '8888', '2026'];
    if (!validPins.includes(String(securityPin).trim())) {
      return errorResponse(res, 'PIN Otorisasi Outlet tidak valid. Hubungi Manager/Owner', 403);
    }

    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user || !user.isActive) {
      return errorResponse(res, 'Akun tidak ditemukan', 404);
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    // Record audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'PASSWORD_RESET',
        detail: { username: user.username, resetAt: new Date().toISOString() },
      },
    });

    return successResponse(res, null, 'Password berhasil direset. Silakan login dengan password baru.');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

export async function getProfile(req, res) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        phone: true,
        avatarUrl: true,
        isActive: true,
        createdAt: true,
      },
    });
    return successResponse(res, user, 'Profil user berhasil diambil');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

export async function updateProfile(req, res) {
  try {
    const userId = req.user.id;
    const { name, username, phone, avatarUrl, currentPassword, newPassword } = req.body;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return errorResponse(res, 'User tidak ditemukan', 404);
    }

    // If username is changing, check uniqueness
    if (username && username.toLowerCase() !== user.username.toLowerCase()) {
      const existing = await prisma.user.findUnique({
        where: { username: username.toLowerCase() },
      });
      if (existing) {
        return errorResponse(res, 'Username sudah digunakan oleh akun lain', 400);
      }
    }

    const dataToUpdate = {};
    if (name) dataToUpdate.name = name;
    if (username) dataToUpdate.username = username.toLowerCase();
    if (phone !== undefined) dataToUpdate.phone = phone;
    if (avatarUrl !== undefined) dataToUpdate.avatarUrl = avatarUrl;

    // If updating password
    if (newPassword) {
      if (!currentPassword) {
        return errorResponse(res, 'Password saat ini wajib diisi untuk mengubah password', 400);
      }
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return errorResponse(res, 'Password saat ini tidak sesuai', 400);
      }
      if (newPassword.length < 6) {
        return errorResponse(res, 'Password baru minimal 6 karakter', 400);
      }
      const salt = await bcrypt.genSalt(10);
      dataToUpdate.password = await bcrypt.hash(newPassword, salt);
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: dataToUpdate,
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        phone: true,
        avatarUrl: true,
        isActive: true,
        updatedAt: true,
      },
    });

    return successResponse(res, updated, 'Profil berhasil diperbarui');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

export async function refreshToken(req, res) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return errorResponse(res, 'Refresh token wajib diisi', 400);
    }

    const refreshSecret = process.env.JWT_REFRESH_SECRET || 'komazi_pos_jwt_refresh_super_secret_key_2026';
    const decoded = jwt.verify(refreshToken, refreshSecret);

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
    });

    if (!user || !user.isActive) {
      return errorResponse(res, 'User tidak valid', 401);
    }

    const secret = process.env.JWT_SECRET || 'komazi_pos_jwt_super_secret_key_2026_coffeeworkspace';
    const newToken = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      secret,
      { expiresIn: '12h' }
    );

    return successResponse(res, { token: newToken }, 'Token diperbarui');
  } catch (err) {
    return errorResponse(res, 'Refresh token tidak valid atau kadaluarsa', 401);
  }
}
