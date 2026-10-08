import prisma from '../config/db.js';

/**
 * Generate sequential invoice number: KMZ-YYYYMMDD-NNNN (daily reset)
 */
export async function generateInvoiceNo() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const datePrefix = `KMZ-${year}${month}${day}`;

  // Find count of orders created today
  const startOfDay = new Date(year, now.getMonth(), now.getDate());
  const countToday = await prisma.order.count({
    where: {
      createdAt: {
        gte: startOfDay,
      },
    },
  });

  const nextSeq = String(countToday + 1).padStart(4, '0');
  return `${datePrefix}-${nextSeq}`;
}
