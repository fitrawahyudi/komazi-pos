import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';

test('Session Persistence: ignores time expiration when ignoreExpiration is true', () => {
  const secret = 'test_secret_key_12345';
  
  // Buat token yang sudah kadaluarsa 1 tahun lalu
  const expiredToken = jwt.sign(
    { id: 42, username: 'kasir_utama', role: 'CASHIER', tokenVersion: 1 },
    secret,
    { expiresIn: '-365d' }
  );

  // Verifikasi standar akan melempar TokenExpiredError
  assert.throws(() => {
    jwt.verify(expiredToken, secret);
  }, { name: 'TokenExpiredError' });

  // Verifikasi dengan ignoreExpiration: true berhasil membaca payload token tanpa error
  const decoded = jwt.verify(expiredToken, secret, { ignoreExpiration: true });
  assert.equal(decoded.id, 42);
  assert.equal(decoded.username, 'kasir_utama');
  assert.equal(decoded.role, 'CASHIER');
});

test('Session Invalidation: rejects deactivated user account regardless of token', () => {
  const mockUserDb = {
    id: 42,
    username: 'kasir_lama',
    isActive: false, // Akun dinonaktifkan oleh owner
    tokenVersion: 1,
  };

  const isSessionAllowed = (user, decodedToken) => {
    if (!user || !user.isActive) return false;
    if (decodedToken.tokenVersion !== undefined && user.tokenVersion !== decodedToken.tokenVersion) return false;
    return true;
  };

  const decoded = { id: 42, tokenVersion: 1 };
  assert.equal(isSessionAllowed(mockUserDb, decoded), false);
});

test('Session Invalidation: rejects token if password was reset (tokenVersion changed)', () => {
  const mockUserDb = {
    id: 42,
    username: 'kasir_utama',
    isActive: true,
    tokenVersion: 2, // Password direset, versi naik ke 2
  };

  const isSessionAllowed = (user, decodedToken) => {
    if (!user || !user.isActive) return false;
    if (decodedToken.tokenVersion !== undefined && user.tokenVersion !== decodedToken.tokenVersion) return false;
    return true;
  };

  const oldTokenDecoded = { id: 42, tokenVersion: 1 }; // Token lama saat versi 1
  assert.equal(isSessionAllowed(mockUserDb, oldTokenDecoded), false);

  const newTokenDecoded = { id: 42, tokenVersion: 2 }; // Token baru saat versi 2
  assert.equal(isSessionAllowed(mockUserDb, newTokenDecoded), true);
});
