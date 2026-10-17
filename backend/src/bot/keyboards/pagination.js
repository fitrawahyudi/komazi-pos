import { InlineKeyboard } from 'grammy';

/**
 * Membangun Inline Keyboard pagination 10 item dengan tombol seleksi angka.
 * Sesuai spesifikasi:
 * - Baris 1: Tombol Angka [ 1 ] s/d [ 5 ]
 * - Baris 2: Tombol Angka [ 6 ] s/d [ 10 ] (jika item > 5)
 * - Baris 3: Navigasi [ ⬅️ Sebelumnya ] [ 📄 Hal X/Y ] [ Selanjutnya ➡️ ]
 * - Baris 4: Kontrol [ 🔄 Refresh ] [ 🔙 Menu Utama ]
 *
 * @param {string} moduleCode - Kode modul unik (misal: 'stk', 'ord', 'ws', 'menu')
 * @param {Array<{ id: number|string }>} itemsOnCurrentPage - Array item di halaman aktif (max 10)
 * @param {number} currentPage - Nomor halaman aktif (1-indexed)
 * @param {number} totalPages - Total keseluruhan halaman
 * @param {string} backMenuCode - Callback untuk tombol kembali (default: 'menu')
 */
export function buildPaginatedNumericKeyboard(
  moduleCode,
  itemsOnCurrentPage = [],
  currentPage = 1,
  totalPages = 1,
  backMenuCode = 'menu'
) {
  const kb = new InlineKeyboard();
  const count = itemsOnCurrentPage.length;

  if (count > 0) {
    // Baris 1: Tombol Angka 1 s/d min(5, count)
    const row1Limit = Math.min(5, count);
    for (let i = 0; i < row1Limit; i++) {
      const item = itemsOnCurrentPage[i];
      kb.text(`[ ${i + 1} ]`, `sel:${moduleCode}:${item.id}`);
    }
    kb.row();

    // Baris 2: Tombol Angka 6 s/d count (jika ada lebih dari 5 item)
    if (count > 5) {
      for (let i = 5; i < count; i++) {
        const item = itemsOnCurrentPage[i];
        kb.text(`[ ${i + 1} ]`, `sel:${moduleCode}:${item.id}`);
      }
      kb.row();
    }
  }

  // Baris 3: Navigasi Halaman Dinamis
  if (totalPages > 1) {
    if (currentPage > 1) {
      kb.text('⬅️ Sebelumnya', `p:${moduleCode}:${currentPage - 1}`);
    }
    kb.text(`📄 ${currentPage}/${totalPages}`, 'noop');
    if (currentPage < totalPages) {
      kb.text('Selanjutnya ➡️', `p:${moduleCode}:${currentPage + 1}`);
    }
    kb.row();
  }

  // Baris 4: Kontrol Bawah
  kb.text('🔄 Refresh', `p:${moduleCode}:${currentPage}`)
    .text('🔙 Menu Utama', `go:${backMenuCode}`);

  return kb;
}

/**
 * Format teks standar untuk daftar data berpaginasi
 */
export function formatPaginatedList({
  title,
  items = [],
  formatItem = (item, index) => `[ ${index + 1} ] ${item.name || item.id}`,
  currentPage = 1,
  totalPages = 1,
  totalCount = 0,
  footerHint = 'Tekan tombol angka di bawah untuk melihat detail atau memilih aksi:',
}) {
  const header = `📋 <b>${title}</b>\n(Halaman ${currentPage}/${totalPages} — Total ${totalCount} Data)\n━━━━━━━━━━━━━━━━━━━━━━`;
  
  const body = items.length > 0
    ? items.map((item, idx) => formatItem(item, idx)).join('\n\n')
    : '<i>Tidak ada data yang tersedia pada halaman ini.</i>';

  const footer = `━━━━━━━━━━━━━━━━━━━━━━\n👇 <i>${footerHint}</i>`;

  return `${header}\n${body}\n${footer}`;
}
