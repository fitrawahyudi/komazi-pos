import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/db.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { passwordResetService } from '../services/passwordReset.service.js';
import logger from '../utils/logger.js';
import { getJwtSecrets } from '../utils/security.js';

export async function login(req, res) {
  try {
    const { username, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user || !user.isActive) {
      logger.auth.warn(`Login failed | username=${username} reason="User not found or inactive"`, { username });
      return errorResponse(res, 'Username atau password salah', 401);
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      logger.auth.warn(`Login failed | username=${username} reason="Invalid password"`, { username });
      return errorResponse(res, 'Username atau password salah', 401);
    }

    const { jwtSecret, jwtRefreshSecret } = getJwtSecrets();

    // Sesi persisten (3650 hari / 10 tahun): Sesi tidak expired selama pengguna belum logout
    // dan akunnya tetap aktif di database (revokasi divalidasi langsung via DB tokenVersion & isActive)
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, tokenVersion: user.tokenVersion || 1 },
      jwtSecret,
      { expiresIn: '3650d' }
    );

    const refreshToken = jwt.sign(
      { id: user.id },
      jwtRefreshSecret,
      { expiresIn: '3650d' }
    );

    const userData = {
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role,
      phone: user.phone || null,
      avatarUrl: user.avatarUrl || null,
      telegramId: user.telegramId || null,
      telegramUsername: user.telegramUsername || null,
      telegramLinkedAt: user.telegramLinkedAt || null,
    };

    logger.auth.success(`Login successful | username=${user.username} role=${user.role}`, {
      userId: user.id,
      username: user.username,
      role: user.role,
    });

    return successResponse(res, { user: userData, token, refreshToken }, 'Login berhasil');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

export async function register(req, res) {
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
      avatarUrl,
    } = req.body;

    // 1. Validasi field wajib
    if (!name || !name.trim()) {
      return errorResponse(res, 'Nama lengkap wajib diisi', 400);
    }
    if (!username || !username.trim()) {
      return errorResponse(res, 'Username login wajib diisi', 400);
    }
    if (!password) {
      return errorResponse(res, 'Kata sandi wajib diisi', 400);
    }

    // 2. Format username: huruf kecil, trim, min 3 karakter, karakter yang diizinkan
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

    // 3. Validasi panjang password
    if (typeof password !== 'string' || password.length < 6) {
      return errorResponse(res, 'Kata sandi minimal 6 karakter', 400);
    }

    // 4. Validasi role
    const validRoles = ['OWNER', 'MANAGER', 'CASHIER', 'KITCHEN', 'BARISTA'];
    const normalizedRole = String(role || 'CASHIER').toUpperCase().trim();
    if (!validRoles.includes(normalizedRole)) {
      return errorResponse(
        res,
        `Role "${role}" tidak valid. Pilihan role yang tersedia: ${validRoles.join(', ')}`,
        400
      );
    }

    // 5. Restriksi hak akses: Non-Owner tidak boleh membuat akun dengan role OWNER
    if (req.user && req.user.role !== 'OWNER' && normalizedRole === 'OWNER') {
      return errorResponse(res, 'Hanya Owner yang berhak mendaftarkan akun dengan hak akses Owner', 403);
    }

    // 6. Cek keunikan username
    const existing = await prisma.user.findUnique({
      where: { username: cleanUsername },
    });
    if (existing) {
      return errorResponse(res, `Username "${cleanUsername}" sudah digunakan, silakan pilih username lain`, 400);
    }

    // 7. Enkripsi password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 8. Tentukan department default sesuai role jika tidak diisi
    let defaultDepartment = 'Operasional';
    if (normalizedRole === 'BARISTA') defaultDepartment = 'Bar & Minuman';
    else if (normalizedRole === 'KITCHEN') defaultDepartment = 'Dapur & Makanan';
    else if (normalizedRole === 'CASHIER') defaultDepartment = 'Kasir';
    else if (normalizedRole === 'MANAGER' || normalizedRole === 'OWNER') defaultDepartment = 'Manajemen';

    // 9. Simpan ke database
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
        avatarUrl: avatarUrl || null,
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

    logger.auth.info(
      `Staff registered successfully | id=${newUser.id} username=${newUser.username} role=${newUser.role} by=${req.user?.username || 'system'}`
    );

    return successResponse(res, newUser, 'Akun staf baru berhasil didaftarkan', 201);
  } catch (err) {
    logger.auth.error(`Staff registration failed: ${err.message}`, { error: err.stack });
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

    // Fetch dynamic PIN otorisasi dari tabel Setting
    const pinSetting = await prisma.setting.findUnique({ where: { key: 'supervisorPin' } });
    if (!pinSetting || !pinSetting.value) {
      return errorResponse(res, 'PIN Otorisasi Outlet belum dikonfigurasi. Hubungi Owner', 403);
    }
    const configuredPin = String(pinSetting.value).trim();
    if (String(securityPin).trim() !== configuredPin) {
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
        telegramId: true,
        telegramUsername: true,
        telegramLinkedAt: true,
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
        telegramId: true,
        telegramUsername: true,
        telegramLinkedAt: true,
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

    const { jwtSecret, jwtRefreshSecret } = getJwtSecrets();
    const decoded = jwt.verify(refreshToken, jwtRefreshSecret, { ignoreExpiration: true });

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
    });

    if (!user || !user.isActive) {
      return errorResponse(res, 'User tidak ditemukan atau telah dinonaktifkan', 401);
    }

    const newToken = jwt.sign(
      { id: user.id, username: user.username, role: user.role, tokenVersion: user.tokenVersion || 1 },
      jwtSecret,
      { expiresIn: '3650d' }
    );

    const newRefreshToken = jwt.sign(
      { id: user.id },
      jwtRefreshSecret,
      { expiresIn: '3650d' }
    );

    return successResponse(res, { token: newToken, refreshToken: newRefreshToken }, 'Token diperbarui');
  } catch (err) {
    return errorResponse(res, 'Refresh token tidak valid', 401);
  }
}

/**
 * Endpoint publik: Verifikasi validitas token reset sebelum user submit form
 */
export async function verifyResetToken(req, res) {
  try {
    const { token } = req.body;
    const result = await passwordResetService.verifyToken(token);
    if (!result.valid) {
      return errorResponse(res, result.message, 400);
    }
    return successResponse(res, result, 'Token valid');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

/**
 * Endpoint publik: Pengguna menyelesaikan reset password menggunakan token sekali pakai
 */
export async function completePasswordReset(req, res) {
  try {
    const { token, newPassword, confirmPassword } = req.body;
    const result = await passwordResetService.completePasswordReset(
      token,
      newPassword,
      confirmPassword
    );
    return successResponse(res, result, result.message);
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
}
