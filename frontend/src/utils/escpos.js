/**
 * ESC/POS Thermal Receipt Helper for Komazi POS
 * Powered by `esc-pos-encoder` package
 * Supports 58mm (32 chars/line) and 80mm (48 chars/line)
 */

import EscPosEncoder from 'esc-pos-encoder';
import { formatOrderType, formatDateTime, formatRupiah } from './format.js';
import {
  generateEscPosQrRasterBytes,
  generateDynamicQrisForOrder,
  convertStaticToDynamicQris,
  DEFAULT_STATIC_QRIS,
} from './qris.js';

/**
 * Receipt Encoder Wrapper integrating the official `esc-pos-encoder` NPM package
 */
export class KomaziReceiptEncoder {
  constructor(paperWidth = '58mm') {
    this.paperWidth = paperWidth;
    this.columns = paperWidth === '80mm' ? 48 : 32;
    // Instantiate esc-pos-encoder with proper column count
    this.encoder = new EscPosEncoder({
      columns: this.columns,
    });
  }

  // Initialize printer state
  init() {
    this.encoder.initialize();
    return this;
  }

  // Alignment: 'left', 'center', 'right'
  align(alignment = 'left') {
    this.encoder.align(alignment);
    return this;
  }

  // Bold text
  bold(enabled = true) {
    this.encoder.bold(Boolean(enabled));
    return this;
  }

  // Double size (for store title)
  doubleSize(enabled = true) {
    if (enabled) {
      this.encoder.size(2, 2);
    } else {
      this.encoder.size(1, 1);
    }
    return this;
  }

  // Add line feeds
  feed(lines = 1) {
    this.encoder.newline(lines);
    return this;
  }

  // Add plain sanitized text
  text(str = '') {
    const cleanStr = String(str || '')
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u00A0\u202F]/g, ' ')
      .replace(/[\u2022\u2023\u25E6]/g, '-')
      .replace(/[^\x00-\x7F]/g, ' ');
    this.encoder.text(cleanStr);
    return this;
  }

  // Add text with newline
  line(str = '') {
    const cleanStr = String(str || '')
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u00A0\u202F]/g, ' ')
      .replace(/[\u2022\u2023\u25E6]/g, '-')
      .replace(/[^\x00-\x7F]/g, ' ');
    this.encoder.line(cleanStr);
    return this;
  }

  // Add dashed divider line
  divider(paperWidth = this.paperWidth) {
    const cols = paperWidth === '80mm' ? 48 : 32;
    this.encoder.line('-'.repeat(cols));
    return this;
  }

  // Add two-column aligned line (e.g. "Americano Ice", "Rp 24.000")
  twoColumns(left, right, paperWidth = this.paperWidth) {
    const cols = paperWidth === '80mm' ? 48 : 32;
    const r = String(right ?? '').replace(/[\u00A0\u202F]/g, ' ').trim();
    let l = String(left ?? '').replace(/[\u00A0\u202F]/g, ' ').trim();
    const maxLeft = cols - r.length - 1;
    if (maxLeft > 0 && l.length > maxLeft) {
      l = l.substring(0, maxLeft);
    }
    const spaces = Math.max(1, cols - (l.length + r.length));
    this.encoder.line(l + ' '.repeat(spaces) + r);
    return this;
  }

  // QR Code generator (lightweight native GS ( k command with raster fallback)
  qrCode(text, paperWidth = this.paperWidth) {
    if (!text) return this;
    const qrSize = paperWidth === '80mm' ? 6 : 4;
    try {
      this.encoder.align('center');
      this.encoder.qrcode(text, 2, qrSize, 'm');
      this.encoder.newline(1);
    } catch (err) {
      console.warn('[EscPosEncoder] Native QR error, using compact raster fallback:', err);
      const rasterBytes = generateEscPosQrRasterBytes(text, paperWidth);
      if (rasterBytes && rasterBytes.length > 0) {
        this.encoder.raw(rasterBytes);
        this.encoder.newline(1);
      }
    }
    return this;
  }

  // Cash drawer kick pulse
  kickDrawer() {
    this.encoder.pulse();
    return this;
  }

  // Partial cut paper with line feeds
  cut() {
    this.encoder.newline(3);
    this.encoder.cut('partial');
    return this;
  }

  // Append raw bytes
  raw(bytes) {
    if (bytes) this.encoder.raw(bytes);
    return this;
  }

  // Final Uint8Array bytes
  encode() {
    return this.encoder.encode();
  }
}

// Export default alias for compatibility
export { KomaziReceiptEncoder as EscPosEncoder };

/**
 * Generate binary ESC/POS payload for Test Receipt using esc-pos-encoder
 */
export function buildTestReceiptEscPos(paperWidth = '58mm', storeSettings = {}) {
  const encoder = new KomaziReceiptEncoder(paperWidth);
  const storeName = storeSettings.storeName || 'KOMAZI COFFEE';
  const tagline = storeSettings.storeTagline;
  const address = storeSettings.address;
  const phone = storeSettings.phone;
  const headerText = storeSettings.headerText || storeSettings.receiptHeader;
  const footer = storeSettings.receiptFooter !== undefined ? storeSettings.receiptFooter : 'Terima Kasih Atas Kunjungan Anda!';

  encoder
    .init()
    .align('center')
    .doubleSize(true)
    .bold(true)
    .line(storeName)
    .doubleSize(false)
    .bold(false);

  if (tagline && tagline.trim()) encoder.line(tagline.trim());
  if (address && address.trim()) encoder.line(address.trim());
  if (phone && phone.trim()) encoder.line(`Telp: ${phone.trim()}`);
  if (headerText && headerText.trim()) {
    encoder.bold(true).line(`*** ${headerText.trim()} ***`).bold(false);
  }

  encoder
    .divider(paperWidth)
    .align('center')
    .bold(true)
    .line('*** UJI COBA PRINTER (TEST OK) ***')
    .bold(false)
    .line(`Tanggal: ${formatDateTime(new Date().toISOString())}`)
    .line(`Ukuran Kertas: ${paperWidth}`)
    .divider(paperWidth)
    .align('left');

  // Sample items
  encoder.bold(true);
  encoder.twoColumns('Americano Ice', 'Rp 24.000', paperWidth);
  encoder.bold(false);
  encoder.line('  1 x Rp 24.000 • Less Sugar');

  encoder.bold(true);
  encoder.twoColumns('Croissant Butter', 'Rp 28.000', paperWidth);
  encoder.bold(false);
  encoder.line('  1 x Rp 28.000');

  encoder
    .divider(paperWidth)
    .twoColumns('Subtotal:', 'Rp 52.000', paperWidth)
    .twoColumns('Diskon:', '-Rp 5.000', paperWidth)
    .twoColumns('PB1 / Pajak (10%):', 'Rp 4.700', paperWidth)
    .bold(true)
    .twoColumns('TOTAL:', 'Rp 51.700', paperWidth)
    .bold(false)
    .divider(paperWidth)
    .twoColumns('Metode Pembayaran:', 'CASH', paperWidth)
    .twoColumns('Bayar Tunai:', 'Rp 100.000', paperWidth)
    .bold(true)
    .twoColumns('Kembalian:', 'Rp 48.300', paperWidth)
    .bold(false)
    .divider(paperWidth);

  if (footer && footer.trim()) {
    encoder.align('center').bold(true).line(footer.trim()).bold(false);
  }

  if (storeSettings.wifiName && storeSettings.receiptShowWifi !== false) {
    encoder.line(`WiFi: ${storeSettings.wifiName} | Pass: ${storeSettings.wifiPass || '-'}`);
  }

  encoder.line('Follow IG: @komazicoffee');
  encoder.divider(paperWidth);
  encoder.align('center');
  encoder.bold(true);
  encoder.line('UJI CETAK QR CODE');
  encoder.bold(false);
  encoder.qrCode(DEFAULT_STATIC_QRIS, paperWidth);
  encoder.line('TEST QR SCAN OK');
  encoder.divider(paperWidth);
  encoder.feed(1);
  encoder.line('||||| | |||| ||| ||||| |||| || |');
  encoder.line('KMZ-TEST-PRINTER');

  encoder
    .feed(3)
    .cut();

  return encoder.encode();
}

/**
 * Generate binary ESC/POS payload for Order Receipt using esc-pos-encoder
 */
export function buildOrderReceiptEscPos(order, storeSettingsOrOptions = {}, paperWidthParam = '58mm', optionsParam = {}) {
  // Seamlessly accept either (order, storeSettings, paperWidth, options) OR (order, { storeSettings, paperWidth, ...options })
  let storeSettings = {};
  let paperWidth = '58mm';
  let options = {};

  if (storeSettingsOrOptions && typeof storeSettingsOrOptions === 'object') {
    if (storeSettingsOrOptions.storeSettings !== undefined || storeSettingsOrOptions.paperWidth !== undefined) {
      storeSettings = storeSettingsOrOptions.storeSettings || {};
      paperWidth = storeSettingsOrOptions.paperWidth || '58mm';
      options = storeSettingsOrOptions;
    } else {
      storeSettings = storeSettingsOrOptions;
      paperWidth = typeof paperWidthParam === 'string' ? paperWidthParam : '58mm';
      options = optionsParam || {};
    }
  }

  const encoder = new KomaziReceiptEncoder(paperWidth);
  const storeName = storeSettings.storeName || 'KOMAZI COFFEE';
  const tagline = storeSettings.storeTagline;
  const address = storeSettings.address;
  const phone = storeSettings.phone;
  const headerText = storeSettings.headerText || storeSettings.receiptHeader;
  const footer = storeSettings.receiptFooter !== undefined ? storeSettings.receiptFooter : 'Terima Kasih Atas Kunjungan Anda!';

  const resolvedPaymentMethod = String(
    order.paymentMethod ||
    order.payments?.[0]?.method ||
    order.payment_method ||
    (Array.isArray(order.payments) && order.payments.length > 0 ? order.payments[0]?.method : '') ||
    'CASH'
  ).toUpperCase();

  const displayPaymentMethod = (() => {
    if (resolvedPaymentMethod === 'CASH') return 'TUNAI';
    if (resolvedPaymentMethod.includes('QRIS')) return 'QRIS';
    if (resolvedPaymentMethod.includes('TRANSFER')) {
      const ref = order?.payments?.[0]?.reference;
      if (ref && ref.includes(':')) {
        return `TRF (${ref.split(':')[0]})`;
      }
      return 'TRANSFER BANK';
    }
    return resolvedPaymentMethod;
  })();

  const cashReceived = order.cashReceived || order.payments?.[0]?.tendered;
  const cashChange = order.cashChange ?? order.payments?.[0]?.change;

  encoder
    .init();

  // Kick cash drawer pulse if configured
  if (options.kickDrawer || options.kickCashDrawer) {
    encoder.kickDrawer();
  }

  if (storeSettings.receiptShowStoreName !== false) {
    encoder
      .align('center')
      .doubleSize(true)
      .bold(true)
      .line(storeName)
      .doubleSize(false)
      .bold(false);
  }

  if (storeSettings.receiptShowTagline !== false && tagline && tagline.trim()) encoder.line(tagline.trim());
  if (storeSettings.receiptShowAddress !== false && address && address.trim()) encoder.line(address.trim());
  if (storeSettings.receiptShowPhone !== false && phone && phone.trim()) encoder.line(`Telp: ${phone.trim()}`);
  if (storeSettings.receiptShowHeader !== false && headerText && headerText.trim()) {
    encoder.bold(true).line(`*** ${headerText.trim()} ***`).bold(false);
  }

  if (order.isBillCheck) {
    encoder.bold(true).line('*** TAGIHAN SEMENTARA (BILL) ***').bold(false);
  }

  encoder
    .divider(paperWidth)
    .align('left');

  if (order.isBillCheck) {
    encoder.twoColumns('Status:', 'BELUM LUNAS', paperWidth);
  }

  encoder
    .twoColumns('No. Faktur:', order.invoiceNo || `KMZ-${order.id}`, paperWidth)
    .twoColumns('Tanggal:', formatDateTime(order.createdAt || new Date().toISOString()), paperWidth);

  if (storeSettings.receiptShowCashier !== false) {
    encoder.twoColumns('Kasir:', order.cashierName || order.cashier?.name || order.shift?.cashier?.name || 'Kasir Bertugas', paperWidth);
  }

  if (storeSettings.receiptShowCustomer !== false) {
    encoder.twoColumns('Pelanggan:', order.customerName || 'Tamu Umum', paperWidth);
  }

  if (storeSettings.receiptShowTable !== false) {
    encoder.twoColumns(
      'Layanan:',
      `${formatOrderType(order.orderType || order.type)} ${order.tableNo ? `(Meja ${order.tableNo})` : ''}`.trim(),
      paperWidth
    );
  }

  encoder.divider(paperWidth);

  // Line items
  (order.items || []).forEach((item) => {
    const itemTotal = (item.qty || 1) * Number(item.price || item.unitPrice || 0);
    const unitPrice = Number(item.price || item.unitPrice || 0);
    const itemName = item.name || item.productName || 'Item';
    const totalStr = formatRupiah(itemTotal);

    // Line 1: Item Name (bold) on left, Total price on right
    encoder.bold(true);
    encoder.twoColumns(itemName, totalStr, paperWidth);
    encoder.bold(false);

    // Line 2: Qty x UnitPrice • Variant
    const variantStr = item.variantName ? ` • ${item.variantName}` : '';
    encoder.line(`  ${item.qty} x ${formatRupiah(unitPrice)}${variantStr}`);

    // Line 3: Note if present & enabled
    if (storeSettings.receiptShowNotes !== false && item.note) {
      encoder.line(`  * ${item.note}`);
    }
  });

  encoder
    .divider(paperWidth)
    .twoColumns('Subtotal:', formatRupiah(order.subtotal || order.total || 0), paperWidth);

  if (Number(order.discount) > 0) {
    encoder.twoColumns('Diskon:', `-${formatRupiah(order.discount)}`, paperWidth);
  }

  if (Number(order.tax) > 0) {
    encoder.twoColumns('PB1 / Pajak (10%):', formatRupiah(order.tax), paperWidth);
  }

  if (Number(order.serviceFee) > 0) {
    encoder.twoColumns('Service Fee (5%):', formatRupiah(order.serviceFee), paperWidth);
  }

  encoder
    .divider(paperWidth)
    .bold(true)
    .twoColumns('TOTAL:', formatRupiah(order.total || order.grandTotal || 0), paperWidth)
    .bold(false)
    .divider(paperWidth)
    .twoColumns('Metode Pembayaran:', displayPaymentMethod, paperWidth);

  if (cashReceived) {
    encoder.twoColumns('Bayar Tunai:', formatRupiah(cashReceived), paperWidth);
    encoder.bold(true);
    encoder.twoColumns('Kembalian:', formatRupiah(cashChange || 0), paperWidth);
    encoder.bold(false);
  }

  // Print Dynamic QRIS section if payment method is QRIS, or explicitly requested, or for unpaid bills
  const isQrisPaymentMethod = resolvedPaymentMethod.includes('QRIS') || resolvedPaymentMethod.includes('QR');
  const isUnpaidBill = ['OPEN', 'PENDING_PAYMENT', 'HOLD', 'PENDING', 'SERVED'].includes(String(order.status || '').toUpperCase()) &&
    (!order.payments || order.payments.length === 0 || !order.paidAt);
  const isQris =
    isQrisPaymentMethod ||
    isUnpaidBill ||
    order.showQris === true ||
    options.showQris === true;

  const qrisEnabled = storeSettings.qrisEnabled !== false;
  if (isQris && qrisEnabled && storeSettings.receiptShowQris !== false) {
    const qrisDynamic = generateDynamicQrisForOrder(order, storeSettings);
    encoder
      .divider(paperWidth)
      .align('center')
      .bold(true)
      .line('BAYAR DENGAN QRIS DINAMIS')
      .bold(false)
      .line(`Tagihan: ${formatRupiah(order.total || order.grandTotal || 0)}`)
      .qrCode(qrisDynamic, paperWidth)
      .line(`NMID: ${storeSettings.qrisNmid || 'ID1020088920199'}`)
      .line('Scan via BCA, Mandiri, GoPay, Dana dll.')
      .line('(Nominal otomatis terisi & terkunci)')
      .align('left');
  }

  encoder
    .divider(paperWidth);

  if (storeSettings.receiptShowFooter !== false && footer && footer.trim()) {
    encoder.align('center').bold(true).line(footer.trim()).bold(false);
  }

  if (storeSettings.receiptShowWifi !== false && storeSettings.wifiName) {
    encoder.line(`WiFi: ${storeSettings.wifiName} | Pass: ${storeSettings.wifiPass || '-'}`);
  }

  encoder.line('Follow IG: @komazicoffee');

  if (storeSettings.receiptShowBarcode !== false) {
    encoder.feed(1);
    encoder.line('||||| | |||| ||| ||||| |||| || |');
    encoder.line(String(order.invoiceNo || `KMZ-${order.id}`));
  }

  encoder
    .feed(3)
    .cut();

  return encoder.encode();
}

/**
 * Generate binary ESC/POS payload for Kitchen Order Ticket
 */
export function buildKitchenTicketEscPos(order, options = {}) {
  const paperWidth = options.paperWidth || '58mm';
  const stationName = options.stationName || 'DAPUR / BAR';
  const isAdditional = options.isAdditional || false;
  const encoder = new KomaziReceiptEncoder(paperWidth);

  encoder
    .init()
    .align('center')
    .bold(true)
    .doubleSize(true)
    .line(isAdditional ? `[TAMBAHAN] ${stationName}` : `[ORDER] ${stationName}`)
    .doubleSize(false)
    .bold(false)
    .line('================================')
    .align('left')
    .twoColumns('No. Pesanan:', order.invoiceNo || `#${order.id}`, paperWidth)
    .twoColumns('Waktu:', formatDateTime(order.createdAt || new Date().toISOString()), paperWidth)
    .twoColumns(
      'Tipe:',
      `${formatOrderType(order.orderType || order.type)} ${order.tableNo ? `(Meja ${order.tableNo})` : ''}`.trim(),
      paperWidth
    );

  if (order.customerName) {
    encoder.twoColumns('Pelanggan:', order.customerName, paperWidth);
  }
  const cashierDisplay = order.cashierName || order.cashier?.name || order.shift?.cashier?.name;
  if (cashierDisplay) {
    encoder.twoColumns('Kasir:', cashierDisplay, paperWidth);
  }

  encoder.divider(paperWidth);

  const itemsToPrint = options.items || order.items || [];
  itemsToPrint.forEach((item) => {
    encoder.bold(true);
    encoder.line(`${item.qty}x  ${item.name || item.productName || 'Item'}`);
    encoder.bold(false);
    if (item.variantName) {
      encoder.line(`    Varian: ${item.variantName}`);
    }
    if (item.modifiers) {
      encoder.line(`    Topping/Mod: ${item.modifiers}`);
    }
    if (item.note) {
      encoder.bold(true);
      encoder.line(`    >> NOTE: ${item.note}`);
      encoder.bold(false);
    }
  });

  if (order.note || order.orderNote) {
    encoder.divider(paperWidth);
    encoder.bold(true);
    encoder.line(`Catatan Khusus: ${order.note || order.orderNote}`);
    encoder.bold(false);
  }

  encoder
    .divider(paperWidth)
    .feed(3)
    .cut();

  return encoder.encode();
}

