import prisma from '../config/db.js';

export const DEFAULT_EXPENSE_CATEGORIES = [
  { name: 'Listrik', description: 'Tagihan listrik operasional kedai', isDefault: true },
  { name: 'Air', description: 'Tagihan air PDAM / sumur bor kedai', isDefault: true },
  { name: 'Internet & Telekomunikasi', description: 'Biaya langganan WiFi kedai & pulsa operasional', isDefault: true },
  { name: 'Sewa Tempat', description: 'Sewa tempat / ruko operasional', isDefault: true },
  { name: 'Kebersihan', description: 'Retribusi sampah & perlengkapan kebersihan', isDefault: true },
  { name: 'Perawatan & Perbaikan', description: 'Servis rutin mesin espresso, grinder, chiller, AC', isDefault: true },
  { name: 'Perlengkapan Operasional', description: 'Plastik, sedotan, tissue, detergen, ATK', isDefault: true },
  { name: 'Transportasi', description: 'BBM kurir, logistik belanja pasar, parkir', isDefault: true },
  { name: 'Administrasi', description: 'Biaya admin bank, legalitas usaha, izin operasional', isDefault: true },
  { name: 'Biaya Lainnya', description: 'Biaya tak terduga operasional lainnya', isDefault: true },
];

export async function ensureDefaultExpenseCategories() {
  try {
    for (const cat of DEFAULT_EXPENSE_CATEGORIES) {
      await prisma.expenseCategory.upsert({
        where: { name: cat.name },
        update: {},
        create: cat,
      });
    }
  } catch (err) {
    console.error('Failed to ensure default expense categories:', err.message);
  }
}
