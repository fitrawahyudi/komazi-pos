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
  if (isNaN(date.getTime())) return '-';
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Format minutes or milliseconds into human readable: 2j 15m
 */
export function formatDuration(totalMinutes) {
  const mins = Math.max(0, Math.floor(Number(totalMinutes) || 0));
  if (mins === 0) return '0m';
  const hours = Math.floor(mins / 60);
  const minutes = mins % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}j`;
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
    cat.includes('non-coffee') ||
    cat.includes('drink') ||
    cat.includes('beverage') ||
    cat.includes('minuman') ||
    cat.includes('bar') ||
    cat.includes('barista') ||
    cat.includes('non-kopi') ||
    cat.includes('tea') ||
    cat.includes('teh') ||
    cat.includes('mocktail') ||
    cat.includes('signature drink') ||
    name.includes('latte') ||
    name.includes('espresso') ||
    name.includes('cappuccino') ||
    name.includes('cappucino') ||
    name.includes('americano') ||
    name.includes('macchiato') ||
    name.includes('machiato') ||
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
    name.includes('kopizi') ||
    name.includes('kopsu') ||
    name.includes('susu') ||
    name.includes('chocolate') ||
    name.includes('cokelat') ||
    name.includes('mocktail') ||
    name.includes('soda') ||
    name.includes('lemonade') ||
    name.includes('air mineral') ||
    name.includes('mineral') ||
    name.includes('cleo') ||
    name.includes('aqua') ||
    name.includes('taro') ||
    name.includes('red velvet') ||
    name.includes('boba') ||
    name.includes('cincau') ||
    name.includes('aren') ||
    name.includes('sanger') ||
    name.includes('cold brew') ||
    name.includes('manual brew') ||
    name.includes('long black') ||
    name.includes('piccolo') ||
    name.includes('cortado') ||
    name.includes('flat white') ||
    name.includes('mojito') ||
    name.includes('kombucha') ||
    name.includes('squash') ||
    name.includes('sparkling') ||
    name.includes('syrup') ||
    name.includes('sirup') ||
    name.startsWith('es ') ||
    name.startsWith('ice ')
  );
}

/**
 * Accurately resolve station type ('BAR' | 'KITCHEN') for a cart or order item.
 * Prioritizes:
 * 1. Direct station object/type on item (item.station?.type || item.stationType)
 * 2. Direct stationId matching known stations
 * 3. Product catalog lookup via productId (posStore or custom products list)
 * 4. Comprehensive category and keyword detection
 */
export function resolveItemStation(item, options = {}) {
  if (!item) return 'KITCHEN';

  // 1. Explicit station object on item or embedded product
  const directType = item.station?.type || item.stationType || item.product?.station?.type;
  if (directType === 'BAR' || directType === 'KITCHEN') return directType;

  const directCode = item.station?.code || item.product?.station?.code;
  if (directCode === 'BAR_MAIN') return 'BAR';
  if (directCode === 'KITCHEN_MAIN') return 'KITCHEN';

  const stations = options.stations || [];
  const products = options.products || [];

  // 2. Station by stationId on item
  const directStationId = item.stationId || item.product?.stationId;
  if (directStationId && stations.length > 0) {
    const matched = stations.find((s) => Number(s.id) === Number(directStationId));
    if (matched?.type) return matched.type;
  }

  // 3. Product catalog lookup if productId exists
  const prodId = item.productId || item.product?.id || item.id;
  if (prodId && products.length > 0) {
    const prod = products.find((p) => Number(p.id) === Number(prodId));
    if (prod) {
      if (prod.station?.type) return prod.station.type;
      if (prod.stationId && stations.length > 0) {
        const matched = stations.find((s) => Number(s.id) === Number(prod.stationId));
        if (matched?.type) return matched.type;
      }
      if (isDrinkItem(prod)) return 'BAR';
    }
  }

  // 4. Default heuristic check
  return isDrinkItem(item) ? 'BAR' : 'KITCHEN';
}

export function isKitchenItem(item, options = {}) {
  return resolveItemStation(item, options) === 'KITCHEN';
}

export function isBaristaItem(item, options = {}) {
  return resolveItemStation(item, options) === 'BAR';
}

/**
 * Format bank account number with readable grouping (e.g. 829-100-2931)
 */
export function formatAccountNumber(accNo = '') {
  const clean = String(accNo || '').replace(/\D/g, '');
  if (!clean) return String(accNo || '');
  if (clean.length === 10) {
    return `${clean.slice(0, 3)}-${clean.slice(3, 6)}-${clean.slice(6)}`;
  }
  if (clean.length > 8) {
    return clean.match(/.{1,4}/g)?.join('-') || clean;
  }
  return clean;
}

/**
 * Ekstrak inisial nama produk (1 huruf kapital) untuk produk yang belum memiliki gambar
 * Contoh: "Seasalt Crumble" -> "S", "Americano" -> "A", "Nasi Goreng" -> "N"
 */
export function getProductInitials(name = '') {
  if (!name || typeof name !== 'string') return 'P';
  const clean = name.trim().replace(/[^a-zA-Z0-9]/g, '');
  if (!clean) return 'P';
  return clean[0].toUpperCase();
}

/**
 * Palet warna gradien coral Komazi resmi terkurasi persis sesuai tema aplikasi
 */
export function getProductColor(name = '') {
  return {
    bg: 'from-[#FF6B5E] to-[#D9382B]',
    text: 'text-white',
    border: 'border-transparent',
    badge: 'bg-gradient-to-b from-[#FF6B5E] to-[#D9382B] text-white',
  };
}

/**
 * Check if a date string/object is today (local time)
 */
export function isToday(dateInput) {
  if (!dateInput) return false;
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return false;
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

/**
 * Return date string in YYYY-MM-DD format (local time)
 */
export function getLocalDateString(dateInput = new Date()) {
  if (dateInput === null || dateInput === undefined || dateInput === '') return '';
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}


