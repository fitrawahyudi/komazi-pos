import prisma from '../config/db.js';
import { successResponse, errorResponse } from '../utils/response.js';

export async function getSummary(req, res) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [todayOrders, totalOrders, lowStockIngredients] = await Promise.all([
      prisma.order.findMany({
        where: {
          createdAt: { gte: today },
          status: 'PAID',
        },
        include: {
          workspace: true,
        },
      }),
      prisma.order.count({ where: { status: 'PAID' } }),
      prisma.ingredient.findMany(),
    ]);

    const todayRevenue = todayOrders.reduce((sum, o) => sum + parseFloat(o.total), 0);
    const todayTransactions = todayOrders.length;
    const aov = todayTransactions > 0 ? Math.round(todayRevenue / todayTransactions) : 0;

    let workspaceRevenue = 0;
    for (const order of todayOrders) {
      for (const ws of order.workspace) {
        if (ws.charge) workspaceRevenue += parseFloat(ws.charge);
      }
    }

    const lowStockCount = lowStockIngredients.filter(
      (i) => parseFloat(i.stock) <= parseFloat(i.minStock)
    ).length;

    return successResponse(res, {
      todayRevenue,
      todayTransactions,
      averageOrderValue: aov,
      workspaceRevenue,
      totalOrdersAllTime: totalOrders,
      lowStockCount,
    }, 'Ringkasan laporan penjualan hari ini');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

export async function getSales(req, res) {
  try {
    const { days = 7 } = req.query;
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - parseInt(days));

    const orders = await prisma.order.findMany({
      where: {
        createdAt: { gte: pastDate },
        status: 'PAID',
      },
      select: {
        createdAt: true,
        total: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return successResponse(res, orders, 'Data penjualan rentang tanggal');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

export async function getTopProducts(req, res) {
  try {
    const items = await prisma.orderItem.groupBy({
      by: ['productId', 'productName'],
      _sum: {
        qty: true,
        lineTotal: true,
      },
      orderBy: {
        _sum: {
          qty: 'desc',
        },
      },
      take: 10,
    });

    const formatted = items.map((i) => ({
      productId: i.productId,
      name: i.productName,
      totalQty: i._sum.qty || 0,
      totalRevenue: i._sum.lineTotal || 0,
    }));

    return successResponse(res, formatted, 'Produk terlaris');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

function formatWibDateTime(dateInput) {
  if (!dateInput) return '-';
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return String(dateInput);
    return new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(d).replace(/\./g, ':') + ' WIB';
  } catch {
    return String(dateInput);
  }
}

function escapeCsv(val) {
  if (val === null || val === undefined) return '';
  const str = String(val).trim();
  if (str.includes(';') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function exportCSV(req, res) {
  try {
    const isOwner = req.user?.role === 'OWNER' || req.user?.role === 'MANAGER';
    const orders = await prisma.order.findMany({
      include: {
        cashier: { select: { name: true } },
        payments: true,
        items: isOwner ? { select: { lineCost: true, unitCost: true, qty: true } } : false,
      },
      orderBy: { createdAt: 'desc' },
    });

    const headers = [
      'No',
      'No Invoice',
      'Waktu Transaksi (WIB)',
      'Kasir',
      'Pelanggan',
      'Tipe Pesanan',
      'Subtotal (Rp)',
      'Diskon (Rp)',
      'Pajak (Rp)',
      'Total Akhir (Rp)',
      ...(isOwner ? ['Total HPP (Rp)', 'Laba Kotor (Rp)', 'Margin (%)'] : []),
      'Metode Pembayaran',
      'Status',
    ];

    let totalSubtotal = 0;
    let totalDiscount = 0;
    let totalTax = 0;
    let totalRevenue = 0;
    let totalCogs = 0;
    let totalGrossProfit = 0;

    const dataRows = orders.map((o, idx) => {
      const subtotal = Math.round(Number(o.subtotal || 0));
      const discount = Math.round(Number(o.discount || 0));
      const tax = Math.round(Number(o.tax || 0));
      const total = Math.round(Number(o.total || 0));

      let orderCogs = 0;
      if (isOwner) {
        orderCogs = (o.items || []).reduce((sum, item) => {
          const cost = Number(item.lineCost || 0);
          if (cost > 0) return sum + cost;
          return sum + (Number(item.unitCost || 0) * Number(item.qty || 1));
        }, 0);
      }
      orderCogs = Math.round(orderCogs);
      const grossProfit = Math.round(total - orderCogs);
      const marginPct = total > 0 ? ((grossProfit / total) * 100).toFixed(1) : '0';

      if (o.status !== 'VOIDED') {
        totalSubtotal += subtotal;
        totalDiscount += discount;
        totalTax += tax;
        totalRevenue += total;
        totalCogs += orderCogs;
        totalGrossProfit += grossProfit;
      }

      const cashier = o.cashier?.name || 'Kasir';
      const customer = o.customerName || 'Tamu';
      const orderType = o.type === 'DINE_IN' ? 'Dine-In' : o.type === 'TAKE_AWAY' ? 'Take-Away' : o.type;
      const paymentMethod = o.payments?.[0]?.method === 'QRIS' ? 'QRIS' : o.payments?.[0]?.method === 'TRANSFER' ? 'Transfer Bank' : 'Tunai (Cash)';
      const statusLabel = o.status === 'PAID' ? 'Lunas' : o.status === 'VOIDED' ? 'Dibatalkan (Void)' : o.status === 'SERVED' ? 'Disajikan' : o.status;

      return [
        idx + 1,
        o.invoiceNo,
        formatWibDateTime(o.createdAt),
        escapeCsv(cashier),
        escapeCsv(customer),
        escapeCsv(orderType),
        subtotal,
        discount,
        tax,
        total,
        ...(isOwner ? [orderCogs, grossProfit, `${marginPct}%`] : []),
        escapeCsv(paymentMethod),
        escapeCsv(statusLabel),
      ].join(';');
    });

    const avgMargin = totalRevenue > 0 ? ((totalGrossProfit / totalRevenue) * 100).toFixed(1) : '0';
    const summaryRow = [
      'TOTAL KESELURUHAN',
      '',
      '',
      '',
      '',
      '',
      totalSubtotal,
      totalDiscount,
      totalTax,
      totalRevenue,
      ...(isOwner ? [totalCogs, totalGrossProfit, `${avgMargin}%`] : []),
      '',
      `${orders.filter(o => o.status !== 'VOIDED').length} Transaksi Berhasil`,
    ].join(';');

    const csvLines = [
      'sep=;',
      'KOMAZI COFFEE & WORKSPACE - LAPORAN PENJUALAN;;;;;;;;;;;;;',
      `Dicetak Pada: ${formatWibDateTime(new Date())};;;;;;;;;;;;;`,
      `Ringkasan: ${orders.length} Transaksi | Total Omzet: Rp ${totalRevenue.toLocaleString('id-ID')}${isOwner ? ` | Total HPP: Rp ${totalCogs.toLocaleString('id-ID')} | Total Laba Kotor: Rp ${totalGrossProfit.toLocaleString('id-ID')} (${avgMargin}%)` : ''};;;;;;;;;;;;;`,
      '',
      headers.join(';'),
      ...dataRows,
      '',
      summaryRow,
    ];

    const csvContent = '\uFEFF' + csvLines.join('\r\n');
    const dateStr = new Date().toISOString().slice(0, 10);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="Komazi_Laporan_Penjualan_${dateStr}.csv"`);
    return res.status(200).send(csvContent);
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}
