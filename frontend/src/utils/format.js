/**
 * Format number to Indonesian Rupiah currency string
 * e.g., 25000 -> "Rp 25.000"
 */
export function formatRupiah(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return 'Rp 0';
  const numeric = Math.round(Number(amount));
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(numeric);
}

/**
 * Format currency alias for formatRupiah
 */
export const formatCurrency = formatRupiah;

/**
 * Format Date to Indonesian format: 1 Okt 2026, 14:30 WIB
 */
export function formatDateTime(dateInput) {
  if (!dateInput) return '-';
  const date = new Date(dateInput);
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date) + ' WIB';
}

/**
 * Format time only: 14:30
 */
export function formatTime(dateInput) {
  if (!dateInput) return '-';
  const date = new Date(dateInput);
  return new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/**
 * Format minutes or milliseconds into human readable: 2j 15m
 */
export function formatDuration(totalMinutes) {
  if (totalMinutes < 0) return '0m';
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.floor(totalMinutes % 60);
  if (hours === 0) return `${minutes}m`;
  return `${hours}j ${minutes}m`;
}

/**
 * Generate sequential invoice number as per PRD: KMZ-YYYYMMDD-NNNN
 */
export function generateInvoiceNumber(sequence = 1) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const seqStr = String(sequence).padStart(4, '0');
  return `KMZ-${year}${month}${day}-${seqStr}`;
}

/**
 * Format order type: DINE_IN -> Dine In, TAKE_AWAY -> Take Away
 */
export function formatOrderType(type) {
  if (!type) return 'Dine In';
  const clean = String(type).trim().toUpperCase().replace(/[-_\s]+/g, '_');
  if (clean === 'DINE_IN') return 'Dine In';
  if (clean === 'TAKE_AWAY' || clean === 'TAKEAWAY') return 'Take Away';
  return String(type)
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Check if a cart / order item is a Drink / Beverage for Barista station
 */
export function isDrinkItem(item) {
  if (!item) return false;
  const cat = (item.categoryName || item.product?.category?.name || item.category || '').toLowerCase();
  const name = (item.name || item.productName || item.product?.name || '').toLowerCase();
  return (
    cat.includes('kopi') ||
    cat.includes('coffee') ||
    cat.includes('drink') ||
    cat.includes('beverage') ||
    cat.includes('minuman') ||
    cat.includes('bar') ||
    cat.includes('barista') ||
    cat.includes('non-kopi') ||
    name.includes('latte') ||
    name.includes('espresso') ||
    name.includes('cappuccino') ||
    name.includes('americano') ||
    name.includes('macchiato') ||
    name.includes('affogato') ||
    name.includes('frappe') ||
    name.includes('brew') ||
    name.includes('tea') ||
    name.includes('teh') ||
    name.includes('matcha') ||
    name.includes('juice') ||
    name.includes('jus') ||
    name.includes('smoothie') ||
    name.includes('milkshake') ||
    name.includes('kopi') ||
    name.includes('coffee') ||
    name.includes('susu') ||
    name.includes('chocolate') ||
    name.includes('cokelat') ||
    name.includes('mocktail') ||
    name.includes('soda') ||
    name.includes('lemonade') ||
    name.includes('air mineral') ||
    name.includes('taro') ||
    name.includes('red velvet') ||
    name.includes('boba') ||
    name.includes('cincau') ||
    name.includes('aren')
  );
}

