import prisma from '../config/db.js';
import { getBotMode } from '../bot/index.js';

/**
 * Mengambil ringkasan komprehensif seluruh status sistem, performa server,
 * konektivitas database MySQL, statistik staf, dan modul operasional bot.
 */
export async function getBotStatusData() {
  const uptimeSeconds = Math.floor(process.uptime());
  const days = Math.floor(uptimeSeconds / 86400);
  const hours = Math.floor((uptimeSeconds % 86400) / 3600);
  const minutes = Math.floor((uptimeSeconds % 3600) / 60);
  const seconds = uptimeSeconds % 60;

  let uptimeFormatted = '';
  if (days > 0) uptimeFormatted += `${days}h `;
  if (hours > 0 || days > 0) uptimeFormatted += `${hours}j `;
  uptimeFormatted += `${minutes}m ${seconds}d`;

  // Pemantauan Memori (RAM)
  const mem = process.memoryUsage();
  const rssMb = (mem.rss / 1024 / 1024).toFixed(1);
  const heapUsedMb = (mem.heapUsed / 1024 / 1024).toFixed(1);
  const heapTotalMb = (mem.heapTotal / 1024 / 1024).toFixed(1);

  // Uji Ping & Latensi MySQL Database
  let dbStatus = 'CONNECTED';
  let dbLatencyMs = 0;
  const t0 = performance.now();
  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    dbLatencyMs = Math.round(performance.now() - t0);
  } catch (err) {
    dbStatus = 'ERROR';
    console.warn('[BotStatus] MySQL ping failed:', err.message);
  }

  // Agregasi Data Operasional secara Paralel
  const [
    totalUsers,
    linkedUsers,
    usersByRole,
    linkedByRole,
    totalProducts,
    allIngredients,
    totalOrders,
    openShifts,
    activeWorkspaces,
    settingsList,
  ] = await Promise.all([
    prisma.user.count({ where: { isActive: true } }).catch(() => 0),
    prisma.user.count({ where: { telegramId: { not: null }, isActive: true } }).catch(() => 0),
    prisma.user.groupBy({ by: ['role'], where: { isActive: true }, _count: { id: true } }).catch(() => []),
    prisma.user.groupBy({ by: ['role'], where: { telegramId: { not: null }, isActive: true }, _count: { id: true } }).catch(() => []),
    prisma.product.count({ where: { isActive: true } }).catch(() => 0),
    prisma.ingredient.findMany({ select: { stock: true, minStock: true } }).catch(() => []),
    prisma.order.count().catch(() => 0),
    prisma.shift.count({ where: { closedAt: null } }).catch(() => 0),
    prisma.workspaceSession.count({ where: { status: 'ACTIVE' } }).catch(() => 0),
    prisma.setting.findMany().catch(() => []),
  ]);

  // Kalkulasi Stok Menipis
  const lowStockCount = (allIngredients || []).filter(
    (i) => Number(i.stock) <= Number(i.minStock)
  ).length;

  // Peta Pengaturan Notifikasi
  const settingsMap = {};
  for (const s of settingsList || []) {
    settingsMap[s.key] = s.value;
  }

  // Pemetaan Peran Staf
  const roleBreakdown = {
    OWNER: { total: 0, linked: 0 },
    MANAGER: { total: 0, linked: 0 },
    CASHIER: { total: 0, linked: 0 },
    BARISTA: { total: 0, linked: 0 },
    KITCHEN: { total: 0, linked: 0 },
  };

  for (const r of usersByRole || []) {
    if (roleBreakdown[r.role]) roleBreakdown[r.role].total = r._count.id;
  }
  for (const r of linkedByRole || []) {
    if (roleBreakdown[r.role]) roleBreakdown[r.role].linked = r._count.id;
  }

  return {
    bot: {
      name: 'Komazi Assistant',
      status: 'ONLINE',
      mode: (() => {
        const m = getBotMode();
        if (m === 'WEBHOOK') return 'Production (Webhook)';
        if (m === 'POLLING_PROD') return 'Production (Long Polling)';
        if (m === 'POLLING_DEV') return 'Development (Long Polling)';
        return process.env.NODE_ENV === 'production' ? 'Production' : 'Development';
      })(),
      uptime: uptimeFormatted,
      uptimeSeconds,
      nodeVersion: process.version,
      platform: process.platform,
      memory: {
        rss: `${rssMb} MB`,
        heapUsed: `${heapUsedMb} MB`,
        heapTotal: `${heapTotalMb} MB`,
      },
    },
    database: {
      status: dbStatus,
      latency: `${dbLatencyMs} ms`,
      engine: 'MySQL',
      orm: '@prisma/client v6.19.3',
      modelsCount: 34,
    },
    staff: {
      total: totalUsers,
      linked: linkedUsers,
      roles: roleBreakdown,
    },
    operations: {
      products: totalProducts,
      ingredients: allIngredients.length,
      lowStock: lowStockCount,
      orders: totalOrders,
      openShifts,
      activeWorkspaces,
    },
    notifications: {
      enabled: settingsMap['botEnabled'] === 'true',
      transaction: settingsMap['botNotifyTransaction'] === 'true',
      approval: settingsMap['botNotifyApproval'] === 'true',
      lowStock: settingsMap['botNotifyLowStock'] === 'true',
      shift: settingsMap['botNotifyShift'] === 'true',
      dailySummary: settingsMap['botNotifyDailySummary'] === 'true',
      baristaGroup: Boolean(settingsMap['botBaristaChatId']),
    },
    scheduler: {
      morningBrief: '08:00 WIB',
      stockoutCheck: 'Setiap 30 mnt',
      expiringWorkspace: 'Setiap 1 mnt',
      dailyClosing: '22:00 WIB',
    },
  };
}
