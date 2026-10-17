import prisma from '../config/db.js';

/**
 * Generate sequential invoice number: KMZ-YYYYMMDD-NNNN (daily reset)
 * Uses Asia/Jakarta timezone and queries the highest existing sequence for today to prevent collisions.
 * @param {object} [tx] - Optional Prisma transaction client
 * @param {number} [attempt=0] - Retry attempt offset
 */
export async function generateInvoiceNo(tx = null, attempt = 0) {
  const client = tx || prisma;

  // Format tanggal dalam zona waktu outlet (WIB - Asia/Jakarta)
  const formatter = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(new Date());
  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  const datePrefix = `KMZ-${year}${month}${day}`;

  // Cari nomor urut faktur tertinggi yang telah terbit hari ini
  const latestOrder = await client.order.findFirst({
    where: {
      invoiceNo: {
        startsWith: datePrefix,
      },
    },
    orderBy: {
      invoiceNo: 'desc',
    },
    select: {
      invoiceNo: true,
    },
  });

  let nextNum = 1;
  if (latestOrder?.invoiceNo) {
    const segments = latestOrder.invoiceNo.split('-');
    const lastSeq = parseInt(segments[2], 10);
    if (!isNaN(lastSeq)) {
      nextNum = lastSeq + 1;
    }
  }

  // Jika ada offset percobaan retry race condition, tambahkan
  nextNum += attempt;

  const nextSeq = String(nextNum).padStart(4, '0');
  return `${datePrefix}-${nextSeq}`;
}
