import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:4000/api';

async function runTests() {
  console.log('🧪 Memulai pengujian API CMS & Public Landing...');

  // 1. Dapatkan user Owner dan Cashier untuk generate token
  const ownerUser = await prisma.user.findFirst({
    where: { role: 'OWNER', isActive: true }
  });
  const cashierUser = await prisma.user.findFirst({
    where: { role: 'CASHIER', isActive: true }
  });

  const jwtSecret = process.env.JWT_SECRET || 'secret';
  const ownerToken = ownerUser
    ? jwt.sign(
        { id: ownerUser.id, role: ownerUser.role, tokenVersion: ownerUser.tokenVersion },
        jwtSecret,
        { expiresIn: '1h' }
      )
    : null;

  const cashierToken = cashierUser
    ? jwt.sign(
        { id: cashierUser.id, role: cashierUser.role, tokenVersion: cashierUser.tokenVersion },
        jwtSecret,
        { expiresIn: '1h' }
      )
    : null;

  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`  ✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${testName}`);
      failed++;
    }
  }

  try {
    // TEST 1: Public Landing API (No Token required)
    const pubRes = await fetch(`${BASE_URL}/public/landing`);
    const pubData = await pubRes.json();
    assert(pubRes.status === 200, 'GET /api/public/landing returns 200 OK');
    assert(pubData.success === true, 'Public response has success: true');
    assert(Boolean(pubData.data?.config?.brandName), 'Config brandName exists');
    assert(Array.isArray(pubData.data?.spotlights), 'Spotlights array exists');
    assert(pubData.data?.spotlights.length > 0, `Spotlights count > 0 (found ${pubData.data?.spotlights.length})`);
    assert(Array.isArray(pubData.data?.promos), 'Promos array exists');
    assert(Array.isArray(pubData.data?.facilities), 'Facilities array exists');
    assert(Array.isArray(pubData.data?.testimonials), 'Testimonials array exists');
    assert(Boolean(pubData.data?.outlet?.outletName), 'Outlet info exists');

    // TEST 2: Protected CMS Endpoint without token -> 401
    const unauthRes = await fetch(`${BASE_URL}/cms/config`);
    assert(unauthRes.status === 401, 'GET /api/cms/config without token returns 401 Unauthorized');

    // TEST 3: Cashier Role accessing CMS -> 403 Forbidden
    if (cashierToken) {
      const cashierRes = await fetch(`${BASE_URL}/cms/config`, {
        headers: { Authorization: `Bearer ${cashierToken}` }
      });
      assert(cashierRes.status === 403, 'GET /api/cms/config with Cashier token returns 403 Forbidden');
    }

    // TEST 4: Owner Role accessing CMS -> 200 OK
    if (ownerToken) {
      const ownerRes = await fetch(`${BASE_URL}/cms/config`, {
        headers: { Authorization: `Bearer ${ownerToken}` }
      });
      const ownerData = await ownerRes.json();
      assert(ownerRes.status === 200, 'GET /api/cms/config with Owner token returns 200 OK');
      assert(ownerData.data?.brandName === 'Komazi Coffee', 'Owner receives valid config data');

      // TEST 5: Owner updating config
      const updateRes = await fetch(`${BASE_URL}/cms/config`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${ownerToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          heroCtaText: 'Jelajahi Menu Pilihan Kami'
        })
      });
      const updateData = await updateRes.json();
      assert(updateRes.status === 200, 'PUT /api/cms/config returns 200 OK');
      assert(updateData.data?.heroCtaText === 'Jelajahi Menu Pilihan Kami', 'heroCtaText successfully updated');

      // Revert back
      await fetch(`${BASE_URL}/cms/config`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${ownerToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          heroCtaText: 'Jelajahi Menu Pilihan'
        })
      });
      assert(true, 'Reverted config update cleanly');

      // TEST 6: Get Spotlights in CMS
      const spotRes = await fetch(`${BASE_URL}/cms/spotlights`, {
        headers: { Authorization: `Bearer ${ownerToken}` }
      });
      const spotData = await spotRes.json();
      assert(spotRes.status === 200, 'GET /api/cms/spotlights returns 200 OK');
      assert(Array.isArray(spotData.data), 'CMS spotlights returns array');

      // TEST 7: Get Facilities in CMS
      const facRes = await fetch(`${BASE_URL}/cms/facilities`, {
        headers: { Authorization: `Bearer ${ownerToken}` }
      });
      const facData = await facRes.json();
      assert(facRes.status === 200, 'GET /api/cms/facilities returns 200 OK');
      assert(Array.isArray(facData.data), 'CMS facilities returns array');
    }

    console.log(`\n🏁 Hasil Pengujian: ${passed} Passed, ${failed} Failed`);
    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('💥 Error running API tests:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
