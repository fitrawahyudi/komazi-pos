import prisma from '../src/config/db.js';
import { withLoadingAnimation, generateLoadingBarFrames } from '../src/bot/utils/loading.js';
import { buildPaginatedNumericKeyboard, formatPaginatedList } from '../src/bot/keyboards/pagination.js';
import { ROLE_COMMANDS } from '../src/bot/commands.js';
import { stockService } from '../src/services/stock.service.js';
import { menuService } from '../src/services/menu.service.js';
import { orderService } from '../src/services/order.service.js';
import { workspaceService } from '../src/services/workspace.service.js';

async function testTelegramBotE2E() {
  console.log('======================================================');
  console.log('🤖 RUNNING COMPREHENSIVE TELEGRAM BOT ASSISTANT E2E TEST');
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
    // 1. Uji Helper withLoadingAnimation
    console.log('1️⃣  Testing withLoadingAnimation utility...');
    const fakeChatActions = [];
    const fakeMessages = [];
    const fakeEdits = [];
    const fakeDeletes = [];

    const mockCtx = {
      replyWithChatAction: async (action) => fakeChatActions.push(action),
      reply: async (text) => {
        const msg = { chat: { id: 12345 }, message_id: 999, text };
        fakeMessages.push(msg);
        return msg;
      },
      api: {
        editMessageText: async (chatId, msgId, text) => fakeEdits.push({ chatId, msgId, text }),
        deleteMessage: async (chatId, msgId) => fakeDeletes.push({ chatId, msgId }),
      },
    };

    const workerResult = await withLoadingAnimation(
      mockCtx,
      {
        chatAction: 'typing',
        frames: [
          '⏳ Frame 1 Inisialisasi...',
          '📊 Frame 2 Pengolahan Data...',
        ],
      },
      async () => {
        return { success: true, count: 42 };
      }
    );

    assert(workerResult.success === true && workerResult.count === 42, 'Worker function executes and returns result');
    assert(fakeChatActions.includes('typing'), 'Chat action "typing" dispatched');
    assert(fakeMessages.length === 1 && fakeMessages[0].text.includes('Frame 1'), 'Initial loading frame sent to user');
    assert(fakeDeletes.length === 1 && fakeDeletes[0].msgId === 999, 'Loading placeholder message deleted after completion');

    // 1b. Uji generateLoadingBarFrames & withLoadingAnimation default loading bar
    console.log('1️⃣b Testing generateLoadingBarFrames & default loading bar behavior...');
    const defaultBars = generateLoadingBarFrames();
    assert(Array.isArray(defaultBars) && defaultBars.length === 6, 'generateLoadingBarFrames produces 6 progression steps');
    assert(defaultBars[0].includes('<code>[██░░░░░░░░] 15%</code>'), 'Initial bar step is 15% monospaced bar');
    assert(defaultBars[defaultBars.length - 1].includes('<code>[██████████] 100%</code>'), 'Final bar step is 100% full bar');

    const barMessages = [];
    const mockBarCtx = {
      replyWithChatAction: async () => {},
      reply: async (text) => {
        const msg = { chat: { id: 12345 }, message_id: 888, text };
        barMessages.push(msg);
        return msg;
      },
      api: {
        editMessageText: async () => {},
        deleteMessage: async () => {},
      },
    };
    await withLoadingAnimation(mockBarCtx, { chatAction: 'upload_photo' }, async () => {
      return 'done';
    });
    assert(barMessages.length === 1 && barMessages[0].text.includes('<code>['), 'Default withLoadingAnimation displays clean loading bar frame');

    // 2. Uji buildPaginatedNumericKeyboard (10 item layout)
    console.log('2️⃣  Testing buildPaginatedNumericKeyboard (10 items on page)...');
    const mock10Items = Array.from({ length: 10 }, (_, i) => ({ id: 100 + i + 1, name: `Item ${i + 1}` }));
    const kb10 = buildPaginatedNumericKeyboard('stk', mock10Items, 1, 3, 'stock');

    assert(kb10 && kb10.inline_keyboard, 'InlineKeyboard generated');
    const rows = kb10.inline_keyboard;
    assert(rows.length >= 4, 'Keyboard has at least 4 rows (Numbers 1-5, Numbers 6-10, Navigation, Controls)');

    // Row 1: [ 1 ] s/d [ 5 ]
    const row1 = rows[0];
    assert(row1.length === 5, 'Row 1 has 5 numeric buttons');
    assert(row1[0].text === '[ 1 ]' && row1[0].callback_data === 'sel:stk:101', 'Button [ 1 ] binds to sel:stk:101');
    assert(row1[4].text === '[ 5 ]' && row1[4].callback_data === 'sel:stk:105', 'Button [ 5 ] binds to sel:stk:105');

    // Row 2: [ 6 ] s/d [ 10 ]
    const row2 = rows[1];
    assert(row2.length === 5, 'Row 2 has 5 numeric buttons');
    assert(row2[0].text === '[ 6 ]' && row2[0].callback_data === 'sel:stk:106', 'Button [ 6 ] binds to sel:stk:106');
    assert(row2[4].text === '[ 10 ]' && row2[4].callback_data === 'sel:stk:110', 'Button [ 10 ] binds to sel:stk:110');

    // Row 3: Navigasi Halaman (Halaman 1 dari 3)
    const rowNav = rows[2];
    const navTexts = rowNav.map((b) => b.text);
    assert(navTexts.includes('Selanjutnya ➡️') && !navTexts.includes('⬅️ Sebelumnya'), 'Page 1 has "Selanjutnya ➡️" and NO "⬅️ Sebelumnya"');

    // 3. Uji buildPaginatedNumericKeyboard di Halaman Tengah (Page 2 dari 3)
    console.log('3️⃣  Testing buildPaginatedNumericKeyboard (Middle page 2/3)...');
    const kbMiddle = buildPaginatedNumericKeyboard('stk', mock10Items, 2, 3, 'stock');
    const middleNavTexts = kbMiddle.inline_keyboard[2].map((b) => b.text);
    assert(middleNavTexts.includes('⬅️ Sebelumnya') && middleNavTexts.includes('Selanjutnya ➡️'), 'Middle page 2 has both previous and next buttons');

    // 4. Uji buildPaginatedNumericKeyboard di Halaman Terakhir dengan < 5 item
    console.log('4️⃣  Testing buildPaginatedNumericKeyboard (Last page with 3 items)...');
    const mock3Items = Array.from({ length: 3 }, (_, i) => ({ id: 201 + i, name: `Sisa ${i + 1}` }));
    const kbLast = buildPaginatedNumericKeyboard('stk', mock3Items, 3, 3, 'stock');
    const lastRows = kbLast.inline_keyboard;
    assert(lastRows[0].length === 3, 'Last page with 3 items renders only 3 numeric buttons in Row 1');
    const lastNavTexts = lastRows[1].map((b) => b.text);
    assert(lastNavTexts.includes('⬅️ Sebelumnya') && !lastNavTexts.includes('Selanjutnya ➡️'), 'Last page has "⬅️ Sebelumnya" and NO "Selanjutnya ➡️"');

    // 5. Uji formatPaginatedList
    console.log('5️⃣  Testing formatPaginatedList string generator...');
    const formattedText = formatPaginatedList({
      title: 'STOK BAHAN BAKU',
      items: mock3Items,
      formatItem: (it, idx) => `[ ${idx + 1} ] ${it.name}`,
      currentPage: 3,
      totalPages: 3,
      totalCount: 23,
    });
    assert(formattedText.includes('STOK BAHAN BAKU'), 'Header title rendered');
    assert(formattedText.includes('Halaman 3/3'), 'Page info rendered');
    assert(formattedText.includes('[ 1 ] Sisa 1'), 'Item 1 formatted with [ 1 ] index');
    assert(formattedText.includes('[ 3 ] Sisa 3'), 'Item 3 formatted with [ 3 ] index');

    // 6. Uji Database: Querying Stok Bahan Baku via Prisma
    console.log('6️⃣  Testing database integration: Stock Ingredients list...');
    const ingredients = await stockService.listAll();
    assert(Array.isArray(ingredients), 'Stock service returns ingredient array from MySQL');
    console.log(`   Found ${ingredients.length} total ingredients in database.`);

    // 7. Uji Database: Querying Open Bills via OrderService
    console.log('7️⃣  Testing database integration: Open Bills list...');
    const openOrders = await orderService.listOpenBills();
    assert(Array.isArray(openOrders), 'Order service returns open bills array from MySQL');
    console.log(`   Found ${openOrders.length} active open bills in database.`);

    // 8. Uji Database: Querying Menu Products for Toggle
    console.log('8️⃣  Testing database integration: Menu Products for Sold-Out Toggle...');
    const products = await menuService.listAllForToggle();
    assert(Array.isArray(products) && products.length > 0, 'Menu service returns products from MySQL');
    const sampleProduct = products[0];
    const initialSoldOut = sampleProduct.isSoldOut;

    // Toggle sold out
    const toggled = await menuService.toggleSoldOut(sampleProduct.id);
    assert(toggled.isSoldOut === !initialSoldOut, 'Product isSoldOut successfully toggled in database');

    // Toggle back to original state
    const reverted = await menuService.toggleSoldOut(sampleProduct.id);
    assert(reverted.isSoldOut === initialSoldOut, 'Product isSoldOut reverted to original state');

    // 9. Uji Database: Workspace Sessions
    console.log('9️⃣  Testing database integration: Workspace Sessions...');
    const activeSessions = await workspaceService.getActiveSessions();
    assert(Array.isArray(activeSessions), 'Workspace service returns active sessions array from MySQL');
    console.log(`   Found ${activeSessions.length} active workspace sessions.`);

    // 10. Uji RBAC: Verifikasi Role Commands Mapping untuk semua 5 role
    console.log('🔟 Testing Role-Based Command mappings for all 5 roles...');
    assert(Array.isArray(ROLE_COMMANDS.OWNER) && ROLE_COMMANDS.OWNER.some((c) => c.command === 'ringkasan'), 'OWNER has /ringkasan command');
    assert(ROLE_COMMANDS.OWNER.some((c) => c.command === 'prediksi'), 'OWNER has /prediksi AI command');
    assert(ROLE_COMMANDS.OWNER.some((c) => c.command === 'cek_stok_kritis'), 'OWNER has /cek_stok_kritis AI command');
    assert(ROLE_COMMANDS.OWNER.some((c) => c.command === 'tautkan'), 'OWNER has /tautkan command');

    assert(Array.isArray(ROLE_COMMANDS.MANAGER) && ROLE_COMMANDS.MANAGER.some((c) => c.command === 'approval'), 'MANAGER has /approval command');
    assert(ROLE_COMMANDS.MANAGER.some((c) => c.command === 'stok'), 'MANAGER has /stok command');
    assert(ROLE_COMMANDS.MANAGER.some((c) => c.command === 'habis'), 'MANAGER has /habis command');

    assert(Array.isArray(ROLE_COMMANDS.CASHIER) && ROLE_COMMANDS.CASHIER.some((c) => c.command === 'buka_shift'), 'CASHIER has /buka_shift command');
    assert(ROLE_COMMANDS.CASHIER.some((c) => c.command === 'tutup_shift'), 'CASHIER has /tutup_shift command');
    assert(ROLE_COMMANDS.CASHIER.some((c) => c.command === 'pesanan'), 'CASHIER has /pesanan command');
    assert(ROLE_COMMANDS.CASHIER.some((c) => c.command === 'checkout'), 'CASHIER has /checkout command');

    assert(Array.isArray(ROLE_COMMANDS.BARISTA) && ROLE_COMMANDS.BARISTA.some((c) => c.command === 'antrean'), 'BARISTA has /antrean command');
    assert(Array.isArray(ROLE_COMMANDS.KITCHEN) && ROLE_COMMANDS.KITCHEN.some((c) => c.command === 'antrean'), 'KITCHEN has /antrean command');

    // 11. Uji OpenClaw AI: Role Mapping Commands
    console.log('1️⃣1️⃣ Testing OpenClaw AI: Role commands registration...');
    assert(ROLE_COMMANDS.OWNER.some((c) => c.command === 'ai'), 'OWNER has /ai command registered');
    assert(ROLE_COMMANDS.MANAGER.some((c) => c.command === 'ai'), 'MANAGER has /ai command registered');
    assert(!ROLE_COMMANDS.CASHIER.some((c) => c.command === 'ai'), 'CASHIER does NOT have /ai command');
    assert(!ROLE_COMMANDS.BARISTA.some((c) => c.command === 'ai'), 'BARISTA does NOT have /ai command');

    // 12. Uji OpenClaw Config & Safe Masking
    console.log('1️⃣2️⃣ Testing OpenClaw AI: Config & Safe Masking...');
    const { getOpenclawConfig, getSafeOpenclawConfig, isOpenClawAvailable } = await import('../src/bot/ai/openclawConfig.js');
    const initialConfig = getOpenclawConfig();
    assert(typeof initialConfig.enabled === 'boolean', 'Config enabled is boolean');
    assert(Array.isArray(initialConfig.allowedRoles), 'Config allowedRoles is array');
    const safeConfig = getSafeOpenclawConfig();
    assert(!safeConfig.token, 'Safe config does not expose raw token');
    assert(typeof safeConfig.tokenMasked === 'string', 'Safe config exposes tokenMasked');

    // 13. Uji In-Memory Session Manager
    console.log('1️⃣3️⃣ Testing OpenClaw AI: In-Memory Multi-Turn Session Manager...');
    const { appendTurn, getHistory, clearSession, getSessionStats } = await import('../src/bot/ai/aiSessionManager.js');
    const testUserId = 999888;
    clearSession(testUserId);
    assert(getHistory(testUserId).length === 0, 'New session history is empty');

    // Tambah 11 pasang giliran dialog (melebihi batas MAX_TURNS = 10)
    for (let i = 1; i <= 11; i++) {
      appendTurn(testUserId, `Halo ${i}`, `Jawab ${i}`);
    }

    const history = getHistory(testUserId);
    assert(history.length === 20, 'History is strictly capped to last 10 pairs (20 messages)');
    assert(history[0].content === 'Halo 2', 'Oldest turn (Halo 1) was pruned correctly');
    assert(history[history.length - 1].content === 'Jawab 11', 'Latest turn is preserved');
    clearSession(testUserId);
    assert(getHistory(testUserId).length === 0, 'Session cleared successfully');

    // 14. Uji Business Context Aggregator
    console.log('1️⃣4️⃣ Testing OpenClaw AI: Business Context Aggregator...');
    const { getTodaySalesSummary, getCriticalStockOverview, buildAiSystemContext } = await import('../src/bot/ai/aiContextService.js');
    const salesSummary = await getTodaySalesSummary();
    assert(typeof salesSummary.totalOrders === 'number', 'Sales summary returns totalOrders count');
    assert(typeof salesSummary.totalRevenue === 'number', 'Sales summary returns totalRevenue');

    const criticalStock = await getCriticalStockOverview();
    assert(Array.isArray(criticalStock), 'Critical stock returns array');

    const systemPrompt = await buildAiSystemContext({ name: 'Fitra Owner', role: 'OWNER' });
    assert(typeof systemPrompt === 'string' && systemPrompt.includes('Komazi Coffee & Workspace'), 'System prompt contains outlet identity');
    assert(systemPrompt.includes('ATURAN DAN PEDOMAN MENJAWAB'), 'System prompt enforces strict safety guidelines');

    // 15. Uji Middleware aiLimiter (RBAC & Concurrency Lock)
    console.log('1️⃣5️⃣ Testing OpenClaw AI: aiLimiter Middleware RBAC & Locks...');
    const { aiLimiter, resetLimiterState } = await import('../src/bot/middlewares/aiLimiter.js');
    resetLimiterState();

    // Skenario A: Unauthenticated user
    let unauthReplied = '';
    const mockCtxUnauth = {
      user: null,
      reply: (t) => { unauthReplied = t; },
    };
    await aiLimiter(mockCtxUnauth, async () => {});
    assert(unauthReplied.includes('Akses Ditolak'), 'Unauthenticated user rejected');

    // Skenario B: Unauthorized role (CASHIER)
    let cashierReplied = '';
    const mockCtxCashier = {
      user: { id: 101, role: 'CASHIER', name: 'Kasir Budi' },
      reply: (t) => { cashierReplied = t; },
    };
    await aiLimiter(mockCtxCashier, async () => {});
    assert(cashierReplied.includes('Akses Terbatas'), 'Cashier role rejected with restricted access message');

    // Skenario C: Authorized role (OWNER) & Concurrency Lock
    let nextCalled = false;
    let lockBlocked = '';
    const mockCtxOwner = {
      user: { id: 202, role: 'OWNER', name: 'Owner Fitra' },
      reply: (t) => { lockBlocked = t; },
    };

    // Panggil pertama kali dengan delay simulasi
    const firstCallPromise = aiLimiter(mockCtxOwner, async () => {
      nextCalled = true;
      // Simulasi panggilan paralel dari user yang sama saat panggilan pertama berjalan
      await aiLimiter(mockCtxOwner, async () => {});
      return 'ok';
    });
    await firstCallPromise;
    assert(nextCalled === true, 'Authorized OWNER allowed through limiter');
    assert(lockBlocked.includes('Permintaan Sedang Diproses'), 'Parallel request blocked by Concurrency Lock');

    // 16. Uji OpenClaw Client: Disabled & Offline Resilience
    console.log('1️⃣6️⃣ Testing OpenClaw AI: Client offline resilience & error handling...');
    const { sendOpenClawChat, OpenClawError } = await import('../src/bot/ai/openclawClient.js');

    // Uji saat AI_ENABLED=false
    const prevAiEnabled = process.env.AI_ENABLED;
    process.env.AI_ENABLED = 'false';
    let caughtDisabledError = null;
    try {
      await sendOpenClawChat({ messages: [{ role: 'user', content: 'Halo' }] });
    } catch (err) {
      caughtDisabledError = err;
    }
    process.env.AI_ENABLED = prevAiEnabled;
    assert(caughtDisabledError instanceof OpenClawError, 'Client throws OpenClawError when AI is disabled');
    assert(caughtDisabledError.code === 'AI_DISABLED', 'Error code is AI_DISABLED');

    // 17. Uji Handler /ai: Full Interaction Flow & Mock Gateway
    console.log('1️⃣7️⃣ Testing OpenClaw AI: Full Handler Flow with Mock Gateway...');
    const http = await import('http');
    const { registerAiHandler } = await import('../src/bot/handlers/ai.js');

    // Buat mock bot untuk merekam registrasi command 'ai'
    let registeredAiCallback = null;
    let registeredAiMiddleware = null;
    const mockBot = {
      command: (name, middleware, handler) => {
        if (name === 'ai' || (Array.isArray(name) && name.includes('ai'))) {
          registeredAiMiddleware = middleware;
          registeredAiCallback = handler;
        }
      },
      callbackQuery: (pattern, middleware, handler) => {},
    };
    registerAiHandler(mockBot);
    assert(typeof registeredAiCallback === 'function', 'Handler /ai registered successfully on bot');

    // Skenario 1: /ai tanpa parameter -> Tampilkan panduan penggunaan
    let helpReplied = '';
    const ctxNoMatch = {
      match: '',
      user: { id: 701, role: 'OWNER', name: 'Owner Fitra' },
      reply: (t) => { helpReplied = t; },
    };
    await registeredAiCallback(ctxNoMatch);
    assert(helpReplied.includes('KOMAZI AI ASSISTANT') && helpReplied.includes('Contoh Pertanyaan'), 'Empty query returns helpful usage guide');

    // Skenario 2: /ai reset -> Reset riwayat sesi
    let resetReplied = '';
    const ctxReset = {
      match: 'reset',
      user: { id: 701, role: 'OWNER', name: 'Owner Fitra' },
      reply: (t) => { resetReplied = t; },
    };
    await registeredAiCallback(ctxReset);
    assert(resetReplied.includes('Riwayat Sesi Direset'), '/ai reset confirms session cleared');

    // Skenario 3: /ai dengan query saat AI_ENABLED=false -> Pesan nonaktif ramah
    const prevEnv3 = process.env.AI_ENABLED;
    process.env.AI_ENABLED = 'false';
    let disabledReplied = '';
    const ctxDisabled = {
      match: 'berapa omset hari ini?',
      user: { id: 701, role: 'OWNER', name: 'Owner Fitra' },
      reply: (t) => { disabledReplied = t; },
    };
    await registeredAiCallback(ctxDisabled);
    process.env.AI_ENABLED = prevEnv3;
    assert(disabledReplied.includes('dinonaktifkan') || disabledReplied.includes('Layanan AI Nonaktif'), 'Query returns friendly disabled notice when AI_ENABLED=false');

    // Skenario 4: Simulasi AI_ENABLED=true dengan Mock OpenClaw Gateway Server
    const mockPort = 18799;
    const mockServer = http.createServer((req, res) => {
      if (req.url === '/v1/chat/completions' && req.method === 'POST') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          model: 'openclaw-mock-v1',
          choices: [{
            message: {
              role: 'assistant',
              content: 'Omset hari ini terpantau stabil dengan **total 0 transaksi** (toko baru buka).',
            },
          }],
        }));
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    await new Promise((resolve) => mockServer.listen(mockPort, resolve));

    process.env.AI_ENABLED = 'true';
    process.env.OPENCLAW_BASE_URL = `http://127.0.0.1:${mockPort}`;
    process.env.OPENCLAW_GATEWAY_TOKEN = 'test-mock-token-123';

    let successAiReply = '';
    const mockCtxSuccess = {
      match: 'bagaimana kondisi penjualan hari ini?',
      user: { id: 701, role: 'OWNER', name: 'Owner Fitra' },
      replyWithChatAction: async () => {},
      reply: async (t) => {
        // Simpan pesan terakhir yang bukan loading frame
        if (!t.includes('Menghubungi') && !t.includes('Menganalisis') && !t.includes('<code>[')) {
          successAiReply = t;
        }
        return { message_id: 111, chat: { id: 701 } };
      },
      api: {
        editMessageText: async () => {},
        deleteMessage: async () => {},
      },
    };

    try {
      await registeredAiCallback(mockCtxSuccess);
      assert(successAiReply.includes('Omset hari ini terpantau stabil'), 'Mock AI reply content returned correctly');
      assert(successAiReply.includes('<b>total 0 transaksi</b>'), 'Markdown bold **bold** converted to Telegram <b>bold</b>');

      // Verifikasi riwayat tersimpan di aiSessionManager
      const sessionHistory = getHistory(701);
      assert(sessionHistory.length >= 2, 'Session history successfully stored user & assistant turn');
    } finally {
      // Kembalikan environment ke default aman (AI_ENABLED=false)
      process.env.AI_ENABLED = 'false';
      mockServer.close();
    }

    // 18. Uji Toggle Direct Chat Mode (Chat tanpa prefix /ai)
    console.log('1️⃣8️⃣ Testing OpenClaw AI: Direct Chat Mode Toggle (/ai on & /ai off)...');
    const { isAiDirectChatMode, setAiDirectChatMode, toggleAiDirectChatMode } = await import('../src/bot/ai/aiSessionManager.js');
    const { buildAiControlKeyboard } = await import('../src/bot/handlers/ai.js');

    assert(ROLE_COMMANDS.OWNER.some((c) => c.command === 'ai_mode'), 'OWNER has /ai_mode command');
    assert(ROLE_COMMANDS.MANAGER.some((c) => c.command === 'ai_mode'), 'MANAGER has /ai_mode command');

    const testToggleUser = 555666;
    setAiDirectChatMode(testToggleUser, false);
    assert(isAiDirectChatMode(testToggleUser) === false, 'Initial direct chat mode is false');

    // Aktifkan mode via setAiDirectChatMode
    setAiDirectChatMode(testToggleUser, true);
    assert(isAiDirectChatMode(testToggleUser) === true, 'Direct chat mode activated');

    // Toggle balik menjadi false
    const toggledOff = toggleAiDirectChatMode(testToggleUser);
    assert(toggledOff === false && isAiDirectChatMode(testToggleUser) === false, 'Direct chat mode toggled off');

    // Subcommand /ai on
    let onReplyText = '';
    let onKeyboard = null;
    const ctxAiOn = {
      match: 'on',
      user: { id: testToggleUser, role: 'OWNER', name: 'Owner Fitra' },
      reply: (t, opt) => {
        onReplyText = t;
        onKeyboard = opt?.reply_markup;
      },
    };
    await registeredAiCallback(ctxAiOn);
    assert(onReplyText.includes('Mode Chat AI Langsung DIAKTIFKAN'), '/ai on confirms activation');
    assert(isAiDirectChatMode(testToggleUser) === true, 'User is now in direct chat mode');

    // Subcommand /ai off
    let offReplyText = '';
    const ctxAiOff = {
      match: 'off',
      user: { id: testToggleUser, role: 'OWNER', name: 'Owner Fitra' },
      reply: (t) => { offReplyText = t; },
    };
    await registeredAiCallback(ctxAiOff);
    assert(offReplyText.includes('Mode Chat AI Langsung DINONAKTIFKAN'), '/ai off confirms deactivation');
    assert(isAiDirectChatMode(testToggleUser) === false, 'User direct chat mode deactivated');

    // Verifikasi keyboard kontrol toggle
    const controlKb = buildAiControlKeyboard(testToggleUser);
    assert(controlKb && typeof controlKb.text === 'function', 'buildAiControlKeyboard generates valid InlineKeyboard');

    // 19. Uji Dedicated Staff Persistent Reply Keyboard (Tombol Bawah Layar) & Penghapusan Katalog/Member
    console.log('1️⃣9️⃣ Testing Dedicated Staff Reply Keyboard & Removal of Customer Catalog/Member...');
    const replyKbModule = await import('../src/bot/keyboards/replyKeyboard.js');
    assert(replyKbModule.buildCustomerReplyKeyboard === undefined, 'buildCustomerReplyKeyboard is completely removed');
    const { buildStaffReplyKeyboard } = replyKbModule;

    // Uji keyboard operasional staf untuk OWNER
    const ownerKb = buildStaffReplyKeyboard('OWNER');
    assert(ownerKb.is_persistent === true && ownerKb.resize_keyboard === true, 'Owner keyboard configured with resize and persistent');
    assert(ownerKb.keyboard.some(r => r.some(b => b.text === '📊 Ringkasan Omzet')), 'Owner staff keyboard has Ringkasan Omzet');
    assert(ownerKb.keyboard.some(r => r.some(b => b.text === '✅ Approval')), 'Owner staff keyboard has Approval');
    assert(!ownerKb.keyboard.some(r => r.some(b => b.text.includes('Katalog') || b.text.includes('Member'))), 'Owner staff keyboard has NO catalog or member toggle button');

    // Uji keyboard operasional staf untuk MANAGER
    const managerKb = buildStaffReplyKeyboard('MANAGER');
    assert(managerKb.keyboard.some(r => r.some(b => b.text === '📊 Laporan Hari Ini')), 'Manager staff keyboard has Laporan Hari Ini');
    assert(managerKb.keyboard.some(r => r.some(b => b.text === '🚫 Menu Habis')), 'Manager staff keyboard has Menu Habis');

    // Uji keyboard operasional staf untuk CASHIER
    const cashierKb = buildStaffReplyKeyboard('CASHIER');
    assert(cashierKb.keyboard.some(r => r.some(b => b.text === '🧾 Pesanan Baru')), 'Cashier staff keyboard has Pesanan Baru');
    assert(cashierKb.keyboard.some(r => r.some(b => b.text === '⏱ Shift Kasir')), 'Cashier staff keyboard has Shift Kasir');

    // Uji keyboard operasional staf untuk BARISTA & KITCHEN
    const baristaKb = buildStaffReplyKeyboard('BARISTA');
    assert(baristaKb.keyboard.some(r => r.some(b => b.text === '☕ Antrean Barista')), 'Barista staff keyboard has Antrean Barista');
    const kitchenKb = buildStaffReplyKeyboard('KITCHEN');
    assert(kitchenKb.keyboard.some(r => r.some(b => b.text === '🍳 Antrean Dapur')), 'Kitchen staff keyboard has Antrean Dapur');

    // Uji registrasi handler staff menu operasional
    const { registerStaffMenu } = await import('../src/bot/handlers/staffMenu.js');
    const mockHearsList = [];
    const testBotMock = {
      hears: (pattern) => mockHearsList.push(pattern),
      callbackQuery: () => {},
    };
    registerStaffMenu(testBotMock);
    assert(mockHearsList.length >= 12, 'Staff operational menu registers all staff button listener triggers');

    console.log('======================================================');
    console.log(`🎉 ALL ${passed}/${total} TELEGRAM BOT ASSISTANT E2E TESTS PASSED 100%!`);
    console.log('======================================================');

  } catch (err) {
    console.error('❌ E2E Test Error:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testTelegramBotE2E();
