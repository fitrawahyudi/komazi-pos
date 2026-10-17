import prisma from '../src/config/db.js';

const BASE_URL = 'http://localhost:4000/api/v1';

async function testPasswordResetE2E() {
  console.log('======================================================');
  console.log('🚀 RUNNING COMPREHENSIVE PASSWORD RESET E2E TEST');
  console.log('======================================================');

  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (condition) {
      console.log(`   ✅ PASS [${total}]: ${message}`);
      passed++;
    } else {
      console.error(`   ❌ FAIL [${total}]: ${message}`);
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  try {
    // 0. Ensure kasir has password123 before starting test
    const bcrypt = (await import('bcryptjs')).default;
    const initialSalt = await bcrypt.genSalt(10);
    const initialHash = await bcrypt.hash('password123', initialSalt);
    await prisma.user.updateMany({
      where: { username: 'kasir' },
      data: { password: initialHash },
    });

    // 1. Login as OWNER (owner)
    console.log('1️⃣  Logging in as OWNER...');
    const ownerLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'owner', password: 'password123' }),
    });
    const ownerLoginData = await ownerLoginRes.json();
    assert(ownerLoginRes.status === 200 && ownerLoginData.data?.token, 'Owner login successful');
    const ownerToken = ownerLoginData.data.token;

    // 2. Login as CASHIER (kasir) to get active JWT session
    console.log('2️⃣  Logging in as CASHIER (kasir)...');
    const cashierLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'kasir', password: 'password123' }),
    });
    const cashierLoginData = await cashierLoginRes.json();
    assert(cashierLoginRes.status === 200 && cashierLoginData.data?.token, 'Cashier login successful');
    const oldCashierJwt = cashierLoginData.data.token;
    const cashierId = cashierLoginData.data.user.id;

    // 3. Test RBAC: Cashier attempts to issue reset token for another user -> MUST BE 403
    console.log('3️⃣  Testing RBAC: Non-owner attempts to issue reset token...');
    const forbiddenRes = await fetch(`${BASE_URL}/users/${cashierId}/password-reset-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${oldCashierJwt}`,
      },
    });
    assert(forbiddenRes.status === 403, 'Non-owner rejected with HTTP 403 Forbidden');

    // 4. Owner creates password reset token for Cashier
    console.log('4️⃣  Owner generates password reset token for Cashier...');
    const issueRes = await fetch(`${BASE_URL}/users/${cashierId}/password-reset-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
    });
    const issueData = await issueRes.json();
    assert(issueRes.status === 201, 'Token issued successfully (HTTP 201)');
    assert(issueData.data?.rawToken && issueData.data?.rawToken.length === 64, 'Raw token is 64-char hex string');
    assert(issueData.data?.resetUrl.includes('/reset-password?token='), 'Reset URL generated with trusted base URL');
    const rawResetToken = issueData.data.rawToken;

    // 5. Verify Database stores ONLY hash, never raw token
    console.log('5️⃣  Checking database storage: only hash is stored...');
    const storedToken = await prisma.passwordResetToken.findFirst({
      where: { userId: cashierId, usedAt: null, revokedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    assert(storedToken !== null, 'Token record exists in DB');
    assert(storedToken.tokenHash !== rawResetToken, 'Token is NOT stored raw in DB');
    assert(storedToken.tokenHash.length === 64, 'Token is stored as 64-character SHA-256 hash');

    // 6. Public token verification check
    console.log('6️⃣  Testing public token verification endpoint...');
    const verifyRes = await fetch(`${BASE_URL}/auth/password-reset/verify-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: rawResetToken }),
    });
    const verifyData = await verifyRes.json();
    assert(verifyRes.status === 200 && verifyData.data?.valid === true, 'Token verified as valid');
    assert(verifyData.data?.username === 'kasir', 'Token correctly bound to target user');

    // 7. Test Mismatched confirmPassword
    console.log('7️⃣  Testing submission with mismatched confirmPassword...');
    const mismatchRes = await fetch(`${BASE_URL}/auth/password-reset/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: rawResetToken,
        newPassword: 'PasswordBaru123!',
        confirmPassword: 'PasswordBeda456!',
      }),
    });
    assert(mismatchRes.status === 400, 'Mismatched passwords rejected (HTTP 400)');

    // 8. Test Short password (< 8 chars)
    console.log('8️⃣  Testing submission with password too short (< 8 chars)...');
    const shortRes = await fetch(`${BASE_URL}/auth/password-reset/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: rawResetToken,
        newPassword: 'short',
        confirmPassword: 'short',
      }),
    });
    assert(shortRes.status === 400, 'Short password rejected (HTTP 400)');

    // 9. Successfully complete password reset
    console.log('9️⃣  Completing password reset with valid new password...');
    const completeRes = await fetch(`${BASE_URL}/auth/password-reset/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: rawResetToken,
        newPassword: 'BaruPassword2026!',
        confirmPassword: 'BaruPassword2026!',
      }),
    });
    const completeData = await completeRes.json();
    assert(completeRes.status === 200 && completeData.success, 'Password successfully reset in DB');

    // 10. Test Token Replay Attack (token already used)
    console.log('🔟 Testing token replay attack (used token)...');
    const replayRes = await fetch(`${BASE_URL}/auth/password-reset/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: rawResetToken,
        newPassword: 'AnotherPassword999!',
        confirmPassword: 'AnotherPassword999!',
      }),
    });
    assert(replayRes.status === 400, 'Reused token correctly rejected (Single-use enforced)');

    // 11. Old password fails login
    console.log('1️⃣1️⃣ Testing old password login failure...');
    const oldLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'kasir', password: 'password123' }),
    });
    assert(oldLoginRes.status === 401, 'Old password fails login (HTTP 401)');

    // 12. New password succeeds login
    console.log('1️⃣2️⃣ Testing new password login success...');
    const newLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'kasir', password: 'BaruPassword2026!' }),
    });
    const newLoginData = await newLoginRes.json();
    assert(newLoginRes.status === 200 && newLoginData.data?.token, 'New password login succeeds (HTTP 200)');

    // 13. SESSIONS REVOCATION: Test that old JWT session is now rejected due to tokenVersion increment
    console.log('1️⃣3️⃣ Testing session revocation of old JWT issued before reset...');
    const oldJwtAuthCheck = await fetch(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${oldCashierJwt}` },
    });
    assert(oldJwtAuthCheck.status === 401, 'Old JWT session rejected because tokenVersion incremented!');

    // 14. Test Token Revocation by Owner
    console.log('1️⃣4️⃣ Testing token revocation by Owner...');
    // Generate new token
    const newIssueRes = await fetch(`${BASE_URL}/users/${cashierId}/password-reset-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
    });
    const newIssueData = await newIssueRes.json();
    const tokenToRevoke = newIssueData.data.rawToken;

    // Check status
    const statusRes = await fetch(`${BASE_URL}/users/${cashierId}/password-reset-status`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    const statusData = await statusRes.json();
    assert(statusData.data?.hasActiveToken === true, 'Status endpoint indicates active token');

    // Revoke token
    const revokeRes = await fetch(`${BASE_URL}/users/${cashierId}/password-reset-token`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    assert(revokeRes.status === 200, 'Owner successfully revoked active token');

    // Verify revoked token fails
    const verifyRevokedRes = await fetch(`${BASE_URL}/auth/password-reset/verify-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: tokenToRevoke }),
    });
    assert(verifyRevokedRes.status === 400, 'Revoked token rejected during verification');

    // 15. Verify Audit Logs
    console.log('1️⃣5️⃣ Verifying AuditLog trail in database...');
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        action: {
          in: ['PASSWORD_RESET_TOKEN_CREATED', 'PASSWORD_RESET_COMPLETED', 'PASSWORD_RESET_TOKEN_REVOKED'],
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    assert(auditLogs.length >= 3, 'Audit logs recorded for token creation, reset completion, and revocation');
    console.log('   Found audit actions:', auditLogs.map((l) => l.action).join(', '));

    // Reset cashier's password back to 'password123' so normal fixtures continue to work
    const resetBackSalt = await (await import('bcryptjs')).default.genSalt(10);
    const resetBackHash = await (await import('bcryptjs')).default.hash('password123', resetBackSalt);
    await prisma.user.update({
      where: { id: cashierId },
      data: { password: resetBackHash, tokenVersion: { increment: 1 } },
    });

    console.log('======================================================');
    console.log(`🎉 ALL ${passed}/${total} PASSWORD RESET E2E TESTS PASSED 100%!`);
    console.log('======================================================');
  } catch (err) {
    console.error('❌ E2E Test Error:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testPasswordResetE2E();
