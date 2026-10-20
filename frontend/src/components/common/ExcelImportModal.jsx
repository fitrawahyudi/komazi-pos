import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Upload,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertCircle,
  FileText,
  Loader2,
  AlertTriangle,
  Calculator,
  TrendingUp,
  Sparkles,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import {
  parseExcelFile,
  downloadMenuTemplate,
  downloadIngredientTemplate,
  downloadRecipeTemplate,
  downloadCustomerTemplate,
  downloadStaffTemplate,
  downloadScheduleTemplate,
  downloadAttendanceTemplate,
  downloadInboundTemplate,
  downloadStockOpnameTemplate,
} from '../../utils/excel';
import api from '../../services/api';
import { useStockStore } from '../../store/stockStore';
import { useRecipeStore } from '../../store/useRecipeStore';
import { usePosStore } from '../../store/posStore';
import { useHrisStore } from '../../store/hrisStore';
import { useCustomerStore } from '../../store/customerStore';

/**
 * Helper to parse recipe string from Excel into structured items with cost lookup.
 * Supported formats:
 * - "Kopi Biji: 18 gram, Susu Fresh: 150 ml, Gula Aren: 20 ml"
 * - "Kopi Biji: 18g; Susu Fresh: 150ml"
 * - "18 gram Kopi Biji, 150 ml Susu Fresh"
 * - "Kopi Biji (18 gram), Susu (150 ml)"
 */
export function parseRecipeString(recipeStr, stockIngredients = []) {
  if (!recipeStr || typeof recipeStr !== 'string') return [];

  const parts = recipeStr.split(/[,;\n]+/).map((p) => p.trim()).filter(Boolean);
  const items = [];

  const ingMap = new Map();
  stockIngredients.forEach((ing) => {
    ingMap.set(ing.name.toLowerCase().trim(), ing);
    ingMap.set(String(ing.id), ing);
  });

  for (const part of parts) {
    let name = '';
    let quantity = 1;
    let unit = '';

    // Pattern 1: "Kopi Biji: 18 gram" or "Kopi Biji: 18" or "Kopi Biji (18 gram)" or "Kopi Biji - 18g"
    const colonMatch = part.match(/^([^:\-(]+)(?:[:\-]\s*|\s*\()([\d.,]+)\s*([a-zA-Z]*)\)?$/);
    if (colonMatch) {
      name = colonMatch[1].trim();
      quantity = parseFloat(colonMatch[2].replace(',', '.')) || 1;
      unit = colonMatch[3]?.trim() || '';
    } else {
      // Pattern 2: "18 gram Kopi Biji" or "18g Kopi Biji"
      const prefixMatch = part.match(/^([\d.,]+)\s*([a-zA-Z]*)\s+(.+)$/);
      if (prefixMatch) {
        quantity = parseFloat(prefixMatch[1].replace(',', '.')) || 1;
        unit = prefixMatch[2]?.trim() || '';
        name = prefixMatch[3].trim();
      } else {
        name = part.trim();
        quantity = 1;
        unit = '';
      }
    }

    if (!name) continue;

    // Matching against master stock ingredients
    let matchedIng = ingMap.get(name.toLowerCase());
    if (!matchedIng) {
      // Fuzzy partial match
      const lowerName = name.toLowerCase();
      matchedIng = stockIngredients.find(
        (s) => s.name.toLowerCase().includes(lowerName) || lowerName.includes(s.name.toLowerCase())
      );
    }

    const targetUnit = unit || matchedIng?.unit || 'gram';
    const costPerUnit = Number(matchedIng?.costPerUnit) || 0;

    // Unit conversion helper (e.g. stock in kg, recipe in gram)
    let effectiveQty = quantity;
    let finalUnit = targetUnit;
    if (matchedIng) {
      const sUnit = matchedIng.unit.toLowerCase();
      const rUnit = targetUnit.toLowerCase();
      if ((sUnit === 'kg' || sUnit === 'kilogram') && (rUnit === 'g' || rUnit === 'gram')) {
        effectiveQty = quantity / 1000;
        finalUnit = matchedIng.unit;
      } else if ((sUnit === 'g' || sUnit === 'gram') && (rUnit === 'kg' || rUnit === 'kilogram')) {
        effectiveQty = quantity * 1000;
        finalUnit = matchedIng.unit;
      } else if ((sUnit === 'l' || sUnit === 'liter') && (rUnit === 'ml' || rUnit === 'mililiter')) {
        effectiveQty = quantity / 1000;
        finalUnit = matchedIng.unit;
      } else if ((sUnit === 'ml' || sUnit === 'mililiter') && (rUnit === 'l' || rUnit === 'liter')) {
        effectiveQty = quantity * 1000;
        finalUnit = matchedIng.unit;
      } else {
        finalUnit = matchedIng.unit;
      }
    }

    const lineCost = Math.round(effectiveQty * costPerUnit * 100) / 100;

    items.push({
      ingredientId: matchedIng?.id || null,
      ingredientName: matchedIng?.name || name,
      quantity: effectiveQty,
      unit: finalUnit,
      costPerUnit,
      lineCost,
      isExisting: !!matchedIng,
    });
  }

  return items;
}

export default function ExcelImportModal({
  isOpen,
  onClose,
  title = 'Import Data Excel',
  type = 'MENU', // 'MENU' | 'INGREDIENT' | 'RECIPE' | 'CUSTOMER' | 'STAFF' | 'SCHEDULE' | 'ATTENDANCE' | 'INBOUND' | 'STOCK_OPNAME'
  categories = [],
  onSuccess,
}) {
  const [file, setFile] = useState(null);
  const [parsedRows, setParsedRows] = useState([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);
  const dragCounterRef = useRef(0);

  // Auto-fetch master ingredients when opening modal for Menu import
  useEffect(() => {
    if (isOpen && type === 'MENU') {
      useStockStore.getState().fetchIngredients?.();
    }
  }, [isOpen, type]);

  if (!isOpen) return null;

  // Unduh template sesuai tipe
  const handleDownloadTemplate = () => {
    switch (type) {
      case 'MENU':
        downloadMenuTemplate({
          categories: usePosStore.getState?.()?.categories || [],
          ingredients: useStockStore.getState?.()?.ingredients || [],
        });
        break;
      case 'INGREDIENT':
        downloadIngredientTemplate();
        break;
      case 'RECIPE':
        downloadRecipeTemplate({
          products: usePosStore.getState?.()?.products || [],
          ingredients: useStockStore.getState?.()?.ingredients || [],
        });
        break;
      case 'CUSTOMER':
        downloadCustomerTemplate();
        break;
      case 'STAFF':
        downloadStaffTemplate();
        break;
      case 'SCHEDULE':
        downloadScheduleTemplate();
        break;
      case 'ATTENDANCE':
        downloadAttendanceTemplate();
        break;
      case 'INBOUND':
        downloadInboundTemplate();
        break;
      case 'STOCK_OPNAME':
        downloadStockOpnameTemplate();
        break;
      default:
        downloadMenuTemplate();
    }
  };

  // Validasi baris data Menu sekaligus kalkulasi HPP & Margin
  const validateMenuRow = (row) => {
    const name = String(row['Nama Produk*'] || row['Nama Produk'] || row['name'] || '').trim();
    const rawPrice = row['Harga Jual*'] || row['Harga Jual'] || row['price'] || 0;
    const price = parseFloat(rawPrice);
    const category = String(
      row['Kategori*'] ||
      row['Kategori'] ||
      row['Kategori Menu'] ||
      row['Kategori Produk'] ||
      row['Nama Kategori'] ||
      row['Category'] ||
      row['category'] ||
      row['categoryName'] ||
      ''
    ).trim();
    const rawCatId = row['ID Kategori'] || row['categoryId'] || row['CatId'] || null;
    const categoryId = rawCatId && !isNaN(parseInt(rawCatId)) ? parseInt(rawCatId) : null;

    // Parse harga dinamis & batas harga minimum
    const dynamicRaw = String(row['Harga Dinamis?'] || row['Harga Dinamis'] || row['isDynamicPrice'] || '').toLowerCase().trim();
    const isDynamicPrice = dynamicRaw === 'ya' || dynamicRaw === 'true' || dynamicRaw === '1' || dynamicRaw === 'y' || dynamicRaw === 'yes';
    const rawMinPrice = row['Batas Harga Minimum'] || row['Harga Minimum'] || row['minPrice'] || 0;
    const minPrice = Math.max(0, parseFloat(rawMinPrice) || 0);

    const errors = [];
    if (!name) errors.push('Nama produk wajib diisi');
    if (!isDynamicPrice && (isNaN(price) || price < 0)) errors.push('Harga harus berupa angka valid');
    if (!category) errors.push('Kategori wajib diisi');

    // Parse varian
    const variantsRaw = String(row['Varian'] || '').trim();
    const variantPricesRaw = String(row['Harga Varian'] || '').trim();
    let variants = [];

    if (variantsRaw) {
      const vNames = variantsRaw.split(',').map((s) => s.trim()).filter(Boolean);
      const vPrices = variantPricesRaw.split(',').map((s) => parseFloat(s.trim()) || price);
      variants = vNames.map((vName, idx) => ({
        name: vName,
        price: vPrices[idx] || price,
      }));
    }

    const rawImageUrl = String(row['URL Gambar'] || row['Gambar'] || row['Foto'] || row['imageUrl'] || '').trim();
    const imageUrl = rawImageUrl ? rawImageUrl : null;

    // --- Kalkulasi HPP & Resep Bahan Baku ---
    const rawHpp = row['HPP / Modal (Rp)'] ?? row['HPP / Modal'] ?? row['HPP'] ?? row['Modal'] ?? row['cost'] ?? row['hpp'] ?? 0;
    const directHpp = Math.max(0, parseFloat(String(rawHpp).replace(/[^0-9.-]+/g, '')) || 0);

    const rawRecipe = String(row['Resep / Bahan Baku (Opsional)'] || row['Resep / Bahan Baku'] || row['Resep'] || row['Bahan Baku'] || row['recipe'] || '').trim();
    const stockIngredients = useStockStore.getState?.()?.ingredients || [];
    const recipeItems = parseRecipeString(rawRecipe, stockIngredients);
    const recipeCost = recipeItems.reduce((sum, it) => sum + (it.lineCost || 0), 0);

    // HPP final: jika ada directHpp gunakan directHpp, jika kosong tetapi ada resep gunakan recipeCost
    const resolvedHpp = directHpp > 0 ? directHpp : (recipeCost > 0 ? recipeCost : 0);

    // Sumber HPP untuk keterangan preview
    let hppSource = 'none';
    if (directHpp > 0 && recipeItems.length > 0) {
      hppSource = 'manual_and_recipe';
    } else if (directHpp > 0) {
      hppSource = 'direct';
    } else if (recipeCost > 0) {
      hppSource = 'calculated';
    }

    // Profit & Margin
    const effectivePrice = isDynamicPrice && minPrice > 0 ? minPrice : (isNaN(price) ? 0 : price);
    let grossProfit = 0;
    let marginPercent = 0;
    if (effectivePrice > 0 && resolvedHpp > 0) {
      grossProfit = effectivePrice - resolvedHpp;
      marginPercent = Math.round(((effectivePrice - resolvedHpp) / effectivePrice) * 1000) / 10;
    }

    const warnings = [];
    if (effectivePrice > 0 && resolvedHpp > effectivePrice && !isDynamicPrice) {
      warnings.push('HPP melebihi harga jual');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      transformed: {
        name,
        price: isNaN(price) ? 0 : price,
        isDynamicPrice,
        minPrice,
        categoryName: category,
        categoryId,
        sku: String(row['SKU'] || '').trim(),
        description: String(row['Deskripsi'] || '').trim(),
        imageUrl,
        variants,
        kitchenStation: String(row['Stasiun Dapur'] || '').trim() || 'BAR',
        hpp: resolvedHpp,
        directHpp,
        recipeCost,
        recipeItems,
        hppSource,
        grossProfit,
        marginPercent,
      },
      original: row,
    };
  };

  // Validasi baris data Bahan Baku
  const validateIngredientRow = (row) => {
    const name = String(
      row['Nama Bahan*'] ||
      row['Nama Bahan'] ||
      row['Nama Sumber Persediaan*'] ||
      row['Nama Sumber Persediaan'] ||
      row['Bahan Baku'] ||
      row['Bahan'] ||
      row['name'] ||
      ''
    ).trim();

    const unit = String(
      row['Satuan* (gram/ml/pcs/kg)'] ||
      row['Satuan*'] ||
      row['Satuan'] ||
      row['Unit'] ||
      row['unit'] ||
      'pcs'
    ).trim();

    const rawStock = row['Stok Awal*'] ?? row['Stok Awal'] ?? row['Stok'] ?? row['Jumlah Stok'] ?? row['Stok Saat Ini'] ?? row['stock'] ?? 0;
    const rawMin = row['Stok Minimum*'] ?? row['Stok Minimum'] ?? row['Stok Min'] ?? row['Min Stock'] ?? row['minStock'] ?? 0;
    const rawCost = row['Harga Modal per Satuan (Rp)*'] ?? row['Harga Modal per Satuan'] ?? row['Harga Modal'] ?? row['Harga per Satuan'] ?? row['Harga Beli Satuan (Rp)*'] ?? row['Harga Beli'] ?? row['costPerUnit'] ?? 0;

    const stock = parseFloat(String(rawStock).replace(',', '.'));
    const minStock = parseFloat(String(rawMin).replace(',', '.'));
    const costPerUnit = parseFloat(String(rawCost).replace(/[^0-9.-]+/g, ''));

    const errors = [];
    if (!name) errors.push('Nama bahan wajib diisi');
    if (!unit) errors.push('Satuan wajib diisi');
    if (isNaN(stock) || stock < 0) errors.push('Stok awal harus berupa angka valid');
    if (isNaN(minStock) || minStock < 0) errors.push('Stok minimum harus berupa angka valid');
    if (isNaN(costPerUnit) || costPerUnit < 0) errors.push('Harga modal harus berupa angka valid');

    const supplierName = String(
      row['Nama Supplier'] ||
      row['Supplier'] ||
      row['Pemasok'] ||
      row['Vendor'] ||
      row['Nama Pemasok / Supplier*'] ||
      row['Nama Pemasok'] ||
      ''
    ).trim();

    const supplierPhone = String(
      row['No WhatsApp Supplier'] ||
      row['Kontak Supplier'] ||
      row['WhatsApp'] ||
      row['No. WA Supplier'] ||
      row['Nomor Supplier'] ||
      row['Telepon Supplier'] ||
      ''
    ).trim();

    return {
      isValid: errors.length === 0,
      errors,
      warnings: [],
      transformed: {
        name,
        unit,
        stock: isNaN(stock) ? 0 : stock,
        minStock: isNaN(minStock) ? 0 : minStock,
        costPerUnit: isNaN(costPerUnit) ? 0 : costPerUnit,
        supplierName,
        supplierPhone,
      },
      original: row,
    };
  };

  // Validasi baris data Pelanggan (CRM)
  const validateCustomerRow = (row) => {
    const name = String(
      row['Nama Pelanggan*'] ||
      row['Nama Pelanggan'] ||
      row['Nama Member'] ||
      row['Nama'] ||
      row['name'] ||
      row['customerName'] ||
      ''
    ).trim();

    const rawPhone = String(
      row['Nomor WhatsApp / HP*'] ||
      row['Nomor WhatsApp / HP'] ||
      row['Nomor WhatsApp'] ||
      row['No WhatsApp'] ||
      row['Nomor HP'] ||
      row['No HP'] ||
      row['Telepon'] ||
      row['phone'] ||
      row['whatsapp'] ||
      ''
    ).trim();

    const cleanPhone = rawPhone.replace(/[-\s]/g, '');

    const email = String(
      row['Email'] ||
      row['Surel'] ||
      row['email'] ||
      ''
    ).trim();

    const rawPoints = row['Poin Awal'] ?? row['Poin'] ?? row['Saldo Poin'] ?? row['points'] ?? 10;
    const points = Math.max(0, parseInt(rawPoints) || 0);

    const rawTier = String(
      row['Tier Member'] ||
      row['Tier'] ||
      row['Level'] ||
      row['tier'] ||
      'SILVER'
    ).trim().toUpperCase();

    let tier = 'SILVER';
    if (['SILVER', 'GOLD', 'PLATINUM'].includes(rawTier)) {
      tier = rawTier;
    } else if (rawTier === 'REGULAR') {
      tier = 'SILVER';
    } else if (rawTier === 'VIP') {
      tier = 'PLATINUM';
    }

    const notes = String(
      row['Catatan / Alergi'] ||
      row['Catatan'] ||
      row['Alergi'] ||
      row['notes'] ||
      ''
    ).trim();

    const errors = [];
    if (!name) errors.push('Nama pelanggan wajib diisi');
    if (!cleanPhone) {
      errors.push('Nomor WhatsApp / HP wajib diisi');
    } else if (cleanPhone.length < 8) {
      errors.push('Nomor telepon minimal 8 digit');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: [],
      transformed: {
        name,
        phone: cleanPhone,
        email: email || null,
        points,
        tier,
        notes: notes || null,
      },
      original: row,
    };
  };

  // Validasi baris data Resep (BOM)
  const validateRecipeRow = (row) => {
    const sku = String(
      row['SKU Produk*'] ||
      row['SKU Produk'] ||
      row['SKU'] ||
      row['Kode Produk'] ||
      row['sku'] ||
      row['productSku'] ||
      row['Nama Produk*'] ||
      row['Nama Produk'] ||
      ''
    ).trim();

    const variantName = String(
      row['Nama Varian'] ||
      row['Varian'] ||
      row['Variant'] ||
      row['variantName'] ||
      ''
    ).trim();

    const ingredientName = String(
      row['Nama Sumber Persediaan*'] ||
      row['Nama Sumber Persediaan'] ||
      row['Nama Bahan*'] ||
      row['Nama Bahan'] ||
      row['Bahan Baku'] ||
      row['Bahan'] ||
      row['ingredientName'] ||
      ''
    ).trim();

    const rawQty = row['Jumlah per 1 Produk*'] ?? row['Jumlah per 1 Produk'] ?? row['Jumlah per Produk'] ?? row['Jumlah'] ?? row['Kuantitas'] ?? row['Qty'] ?? row['quantity'] ?? 0;
    const quantity = Math.max(0, parseFloat(String(rawQty).replace(',', '.')) || 0);

    const errors = [];
    if (!sku) errors.push('SKU / Nama produk wajib diisi');
    if (!ingredientName) errors.push('Nama bahan baku wajib diisi');
    if (isNaN(quantity) || quantity <= 0) errors.push('Jumlah per 1 produk harus lebih besar dari 0');

    return {
      isValid: errors.length === 0,
      errors,
      warnings: [],
      transformed: {
        sku,
        variantName: variantName || null,
        ingredientName,
        quantity,
      },
      original: row,
    };
  };

  // Validasi baris data Staf HRIS
  const validateStaffRow = (row) => {
    const name = String(row['Nama Lengkap*'] || row['Nama Lengkap'] || row['Nama'] || row['name'] || '').trim();
    const rawUsername = String(row['Username*'] || row['Username'] || row['username'] || '').trim().toLowerCase();
    const password = String(row['Password Sementara*'] || row['Password'] || row['Kata Sandi'] || row['password'] || '').trim();
    const rawRole = String(row['Peran Sistem*'] || row['Peran'] || row['Role'] || row['role'] || 'CASHIER').trim().toUpperCase();

    let role = rawRole;
    if (role === 'KASIR') role = 'CASHIER';
    if (role === 'MANAJER') role = 'MANAGER';
    if (role === 'DAPUR') role = 'KITCHEN';
    if (role === 'PEMILIK') role = 'OWNER';

    const validRoles = ['OWNER', 'MANAGER', 'CASHIER', 'BARISTA', 'KITCHEN'];
    const phone = String(row['Nomor Telepon / WA'] || row['Nomor Telepon'] || row['Telepon'] || row['No WhatsApp'] || row['phone'] || '').trim();
    const department = String(row['Departemen'] || row['department'] || 'Operasional').trim();
    const jobTitle = String(row['Jabatan'] || row['jobTitle'] || '').trim();
    const rawEmpType = String(row['Status Ikatan Kerja'] || row['Tipe Kerja'] || row['employmentType'] || 'FULL_TIME').trim().toUpperCase();
    let employmentType = rawEmpType;
    if (employmentType === 'PURNAWAKTU') employmentType = 'FULL_TIME';
    if (employmentType === 'PARUH_WAKTU' || employmentType === 'PARUHWAKTU' || employmentType === 'PARUH WAKTU') employmentType = 'PART_TIME';
    if (employmentType === 'KONTRAK') employmentType = 'CONTRACT';

    const baseSalary = Math.max(0, parseFloat(String(row['Gaji Pokok Bulanan (Rp)'] || row['Gaji Pokok'] || row['baseSalary'] || 0).replace(/[^0-9.-]+/g, '')) || 0);
    const dailyAllowance = Math.max(0, parseFloat(String(row['Uang Makan Harian (Rp)'] || row['Uang Makan'] || row['dailyAllowance'] || 0).replace(/[^0-9.-]+/g, '')) || 0);
    const hourlyOvertimeRate = Math.max(0, parseFloat(String(row['Tarif Lembur per Jam (Rp)'] || row['Tarif Lembur'] || row['hourlyOvertimeRate'] || 0).replace(/[^0-9.-]+/g, '')) || 0);

    const errors = [];
    if (!name) errors.push('Nama staf wajib diisi');
    if (!rawUsername) {
      errors.push('Username wajib diisi');
    } else if (rawUsername.length < 3) {
      errors.push('Username minimal 3 karakter');
    } else if (!/^[a-z0-9_.-]+$/.test(rawUsername)) {
      errors.push('Username hanya boleh huruf kecil, angka, titik, underscore, strip');
    }

    if (!password) {
      errors.push('Password sementara wajib diisi');
    } else if (password.length < 6) {
      errors.push('Password minimal 6 karakter');
    }

    if (!validRoles.includes(role)) {
      errors.push(`Peran tidak valid: "${role}". Pilihan: CASHIER, BARISTA, KITCHEN, MANAGER`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: [],
      transformed: {
        name,
        username: rawUsername,
        password,
        role,
        phone,
        department,
        jobTitle: jobTitle || role,
        employmentType,
        baseSalary,
        dailyAllowance,
        hourlyOvertimeRate,
      },
      original: row,
    };
  };

  // Helper format ukuran file
  const formatFileSize = (bytes) => {
    if (!bytes || isNaN(bytes)) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  // Proses validasi dan parsing file Excel/CSV
  const processFile = async (selectedFile) => {
    if (!selectedFile) return;

    // Validasi format/ekstensi file (.xlsx, .xls, .csv)
    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const fileName = selectedFile.name ? selectedFile.name.toLowerCase() : '';
    const isValidExt = validExtensions.some((ext) => fileName.endsWith(ext));

    if (!isValidExt) {
      setErrorMsg('Format file tidak didukung. Mohon unggah file Excel (.xlsx, .xls) atau CSV.');
      setFile(null);
      setParsedRows([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Validasi batas ukuran file (maks. 5MB)
    const MAX_SIZE = 5 * 1024 * 1024;
    if (selectedFile.size > MAX_SIZE) {
      setErrorMsg('Ukuran file melebihi batas maksimal 5MB.');
      setFile(null);
      setParsedRows([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setErrorMsg('');
    setFile(selectedFile);
    setIsParsing(true);

    try {
      // Pastikan data bahan baku terbaru siap untuk menghitung HPP resep
      if (type === 'MENU' && (!useStockStore.getState().ingredients || useStockStore.getState().ingredients.length === 0)) {
        await useStockStore.getState().fetchIngredients?.();
      }

      const rows = await parseExcelFile(selectedFile);
      if (!rows || rows.length === 0) {
        throw new Error('File tidak memiliki baris data yang dapat dibaca.');
      }

      const validated = rows.map((r) => {
        if (type === 'MENU') return validateMenuRow(r);
        if (type === 'STAFF') return validateStaffRow(r);
        if (type === 'CUSTOMER') return validateCustomerRow(r);
        if (type === 'RECIPE') return validateRecipeRow(r);
        return validateIngredientRow(r);
      });
      setParsedRows(validated);
    } catch (err) {
      setErrorMsg(err.message || 'Gagal memproses file Excel.');
      setParsedRows([]);
    } finally {
      setIsParsing(false);
    }
  };

  // Event handler input file biasa
  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      processFile(selectedFile);
    }
  };

  // Drag & drop event handlers
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (e.dataTransfer?.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      e.dataTransfer.dropEffect = 'copy';
    } catch {
      // ignore
    }
    if (!isDragging) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      setIsDragging(false);
      dragCounterRef.current = 0;
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounterRef.current = 0;

    const droppedFile = e.dataTransfer?.files?.[0];
    if (droppedFile) {
      processFile(droppedFile);
    }
  };

  const handleRemoveFile = (e) => {
    e?.stopPropagation();
    setFile(null);
    setParsedRows([]);
    setErrorMsg('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Submit bulk data to backend
  const handleImportSubmit = async () => {
    const validItems = parsedRows.filter((r) => r.isValid).map((r) => r.transformed);
    if (validItems.length === 0) {
      setErrorMsg('Tidak ada baris data valid yang siap diimpor.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      let endpoint = '/ingredients/bulk';
      let payloadKey = 'ingredients';
      if (type === 'MENU') {
        endpoint = '/products/bulk';
        payloadKey = 'products';
      } else if (type === 'STAFF') {
        endpoint = '/hris/staff/bulk';
        payloadKey = 'staff';
      } else if (type === 'CUSTOMER') {
        endpoint = '/customers/sync-batch';
        payloadKey = 'customers';
      } else if (type === 'RECIPE') {
        endpoint = '/products/recipes/bulk';
        payloadKey = 'recipes';
      }

      const res = await api.post(endpoint, { [payloadKey]: validItems });

      if (!res || res.success === false) {
        throw new Error(res?.message || 'Gagal mengimpor data ke server.');
      }

      // Refresh stores so everything reflects new products, categories, HPP and recipes immediately
      if (type === 'MENU') {
        usePosStore.getState().fetchCategories?.();
        usePosStore.getState().fetchProducts?.();
        useRecipeStore.getState().fetchCogsOverview?.();
        useStockStore.getState().fetchIngredients?.();
      } else if (type === 'INGREDIENT') {
        useStockStore.getState().fetchIngredients?.();
      } else if (type === 'STAFF') {
        useHrisStore.getState().fetchStaff?.();
        useHrisStore.getState().fetchOverview?.();
      } else if (type === 'CUSTOMER') {
        useCustomerStore.getState().fetchCustomers?.();
      } else if (type === 'RECIPE') {
        useRecipeStore.getState().fetchCogsOverview?.();
        useStockStore.getState().fetchIngredients?.();
        usePosStore.getState().fetchProducts?.();
      }

      if (onSuccess) {
        onSuccess(res.data?.data || res.data || validItems);
      }
      handleClose();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || err.message || 'Terjadi kesalahan saat mengimpor data.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setParsedRows([]);
    setErrorMsg('');
    setIsDragging(false);
    dragCounterRef.current = 0;
    if (fileInputRef.current) fileInputRef.current.value = '';
    onClose();
  };

  const validCount = parsedRows.filter((r) => r.isValid).length;
  const errorCount = parsedRows.filter((r) => !r.isValid).length;

  // Ringkasan metrik HPP untuk menu
  const validMenuItems = type === 'MENU' ? parsedRows.filter((r) => r.isValid).map((r) => r.transformed) : [];
  const itemsWithHpp = validMenuItems.filter((m) => m.hpp > 0);
  const avgMargin = itemsWithHpp.length > 0
    ? Math.round((itemsWithHpp.reduce((acc, m) => acc + m.marginPercent, 0) / itemsWithHpp.length) * 10) / 10
    : 0;
  const avgProfit = itemsWithHpp.length > 0
    ? Math.round(itemsWithHpp.reduce((acc, m) => acc + m.grossProfit, 0) / itemsWithHpp.length)
    : 0;

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn"
    >
      <div className="bg-komazi-surface border border-komazi-border w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-komazi-border flex items-center justify-between bg-komazi-surface-2/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display font-black text-lg text-komazi-text">{title}</h2>
              </div>
              <p className="text-xs text-komazi-muted">
                Unggah spreadsheet Excel (.xlsx, .xls) atau CSV untuk memasukkan puluhan data sekaligus.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-2 rounded-xl text-komazi-muted hover:text-white hover:bg-komazi-surface-3 transition-colors"
            title="Tutup Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Step 1: Download Template */}
          <div className="p-4 rounded-2xl bg-komazi-surface-2 border border-komazi-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-komazi-coral/15 text-komazi-coral shrink-0 mt-0.5">
                <Download className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-komazi-text">1. Unduh Template Excel Resmi</h3>
                <p className="text-xs text-komazi-muted mt-0.5">
                  {type === 'MENU'
                    ? 'Template ini dilengkapi kolom "HPP / Modal (Rp)", "Resep / Bahan Baku", dan sheet referensi Data Bahan Baku.'
                    : type === 'STAFF'
                    ? 'Template registrasi staf lengkap: Nama, Username, Password Sementara, Peran, Dept, Jabatan, dan Komponen Gaji.'
                    : type === 'CUSTOMER'
                    ? 'Template member loyalty CRM: Nama Pelanggan, Nomor WhatsApp, Email, Tier, Poin Awal, dan Catatan / Alergi.'
                    : type === 'RECIPE'
                    ? 'Template resep BOM produk: SKU Produk, Nama Varian, Nama Sumber Persediaan, dan Jumlah Takaran.'
                    : 'Gunakan format kolom standar Komazi agar data terbaca otomatis dan bebas error.'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="px-4 py-2 rounded-xl bg-komazi-surface hover:bg-komazi-surface-3 border border-komazi-border text-xs font-bold text-komazi-text transition-colors flex items-center gap-2 shrink-0 active:scale-95 shadow-sm"
            >
              <Download className="w-3.5 h-3.5 text-komazi-coral" />
              <span>Download Template</span>
            </button>
          </div>

          {/* Step 2: Upload File Zone (Drag & Drop) */}
          <div>
            <label className="block text-xs font-bold text-komazi-text mb-2">
              2. Pilih atau Seret File Excel / CSV yang Sudah Diisi
            </label>
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`relative border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all duration-200 group ${
                isDragging
                  ? 'border-komazi-coral bg-komazi-coral/10 scale-[1.01] shadow-lg shadow-komazi-coral/10 ring-4 ring-komazi-coral/20'
                  : file
                  ? 'border-emerald-500/50 bg-emerald-500/5 hover:bg-emerald-500/10'
                  : 'border-komazi-border hover:border-komazi-coral/60 bg-komazi-surface-2/40 hover:bg-komazi-surface-2'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileChange}
                onClick={(e) => {
                  e.target.value = '';
                }}
                className="hidden"
              />

              {isDragging ? (
                <div className="pointer-events-none flex flex-col items-center justify-center py-2 animate-pulse">
                  <div className="w-14 h-14 rounded-2xl bg-komazi-coral/20 text-komazi-coral flex items-center justify-center mb-3 scale-110 transition-transform">
                    <Upload className="w-7 h-7 animate-bounce" />
                  </div>
                  <p className="font-bold text-base text-komazi-coral">
                    Lepaskan file Excel / CSV di sini
                  </p>
                  <p className="text-xs text-komazi-muted mt-1">
                    File akan otomatis dipindai dan divalidasi oleh sistem
                  </p>
                </div>
              ) : file ? (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3 text-left overflow-hidden">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
                      <FileSpreadsheet className="w-6 h-6" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-komazi-text truncate max-w-[240px] sm:max-w-md block">
                          {file.name}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-bold border border-emerald-500/30 shrink-0">
                          {formatFileSize(file.size)}
                        </span>
                      </div>
                      <p className="text-xs text-komazi-muted mt-0.5">
                        Tarik & lepas file baru atau klik "Ganti File" untuk mengganti
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                      className="px-3 py-1.5 rounded-xl bg-komazi-surface-2 hover:bg-komazi-surface-3 border border-komazi-border text-xs font-bold text-komazi-text transition-colors flex items-center gap-1.5 active:scale-95 shadow-sm"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-komazi-coral" />
                      <span>Ganti File</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleRemoveFile}
                      className="px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-xs font-bold text-red-400 transition-colors flex items-center gap-1.5 active:scale-95"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Hapus</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="pointer-events-none flex flex-col items-center justify-center py-2">
                  <div className="w-12 h-12 rounded-2xl bg-komazi-coral/10 group-hover:bg-komazi-coral/20 text-komazi-coral flex items-center justify-center mb-3 transition-all group-hover:scale-105">
                    <Upload className="w-6 h-6" />
                  </div>
                  <p className="font-bold text-sm text-komazi-text">
                    Klik untuk memilih file atau <span className="text-komazi-coral underline decoration-komazi-coral/40 underline-offset-4">drag & drop</span> ke sini
                  </p>
                  <p className="text-xs text-komazi-muted mt-1">
                    Mendukung format Microsoft Excel (.xlsx, .xls) dan CSV (maks. 5MB)
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Error Message if any */}
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Parsing State */}
          {isParsing && (
            <div className="py-8 text-center text-komazi-muted text-xs flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-komazi-coral" />
              <span>Membaca file & menghitung HPP otomatis dari bahan baku...</span>
            </div>
          )}

          {/* Preview Section */}
          {parsedRows.length > 0 && !isParsing && (
            <div className="space-y-4">
              {/* Summary Metrics for Menu Import */}
              {type === 'MENU' && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3.5 rounded-2xl bg-komazi-surface-2/70 border border-komazi-border flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-komazi-coral/15 border border-komazi-coral/30 text-komazi-coral flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-[11px] text-komazi-muted font-medium">Total Menu</div>
                      <div className="text-sm font-black text-komazi-text">{validCount} Produk</div>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-komazi-surface-2/70 border border-komazi-border flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400 flex items-center justify-center shrink-0">
                      <Calculator className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-[11px] text-komazi-muted font-medium">HPP Terhitung</div>
                      <div className="text-sm font-black text-komazi-text">
                        {itemsWithHpp.length} / {validCount} <span className="text-[10px] text-komazi-muted font-normal">Menu</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-komazi-surface-2/70 border border-komazi-border flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
                      <TrendingUp className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-[11px] text-komazi-muted font-medium">Rata-rata Margin</div>
                      <div className="text-sm font-black text-emerald-400">
                        {itemsWithHpp.length > 0 ? `${avgMargin}%` : '-'}
                      </div>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-komazi-surface-2/70 border border-komazi-border flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-[11px] text-komazi-muted font-medium">Est. Laba / Porsi</div>
                      <div className="text-sm font-black text-komazi-text">
                        {itemsWithHpp.length > 0 ? `Rp ${avgProfit.toLocaleString('id-ID')}` : '-'}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Header pratinjau */}
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-xs uppercase tracking-wider text-komazi-muted flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  <span>Pratinjau Data ({parsedRows.length} Baris Ditemukan)</span>
                </h4>
                <div className="flex items-center gap-2 text-xs">
                  <span className="px-2.5 py-0.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold">
                    ✓ {validCount} Valid
                  </span>
                  {errorCount > 0 && (
                    <span className="px-2.5 py-0.5 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 font-bold">
                      ⚠ {errorCount} Error
                    </span>
                  )}
                </div>
              </div>

              {/* Tabel Pratinjau */}
              <div className="border border-komazi-border rounded-2xl overflow-hidden max-h-72 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-komazi-surface-2 text-komazi-muted sticky top-0 border-b border-komazi-border font-bold text-[11px] z-10">
                    <tr>
                      <th className="p-2.5 pl-3">Status</th>
                      {type === 'MENU' && (
                        <>
                          <th className="p-2.5">Nama Produk</th>
                          <th className="p-2.5">Kategori</th>
                          <th className="p-2.5">Harga Jual</th>
                          <th className="p-2.5">HPP (Modal)</th>
                          <th className="p-2.5">Margin Laba</th>
                          <th className="p-2.5">Resep / Varian</th>
                        </>
                      )}
                      {type === 'STAFF' && (
                        <>
                          <th className="p-2.5">Nama Pegawai</th>
                          <th className="p-2.5">Username</th>
                          <th className="p-2.5">Peran / Dept</th>
                          <th className="p-2.5">Jabatan / Tipe</th>
                          <th className="p-2.5">Gaji Pokok</th>
                        </>
                      )}
                      {type === 'CUSTOMER' && (
                        <>
                          <th className="p-2.5">Nama Member</th>
                          <th className="p-2.5">Nomor WhatsApp</th>
                          <th className="p-2.5">Email</th>
                          <th className="p-2.5 text-center">Tier Member</th>
                          <th className="p-2.5 text-right">Poin Awal</th>
                          <th className="p-2.5">Catatan / Alergi</th>
                        </>
                      )}
                      {type === 'RECIPE' && (
                        <>
                          <th className="p-2.5">SKU / Produk</th>
                          <th className="p-2.5">Nama Varian</th>
                          <th className="p-2.5">Nama Bahan Baku</th>
                          <th className="p-2.5 text-right">Jumlah Takaran</th>
                        </>
                      )}
                      {type !== 'MENU' && type !== 'STAFF' && type !== 'CUSTOMER' && type !== 'RECIPE' && (
                        <>
                          <th className="p-2.5">Nama Bahan</th>
                          <th className="p-2.5">Satuan</th>
                          <th className="p-2.5">Stok Awal</th>
                          <th className="p-2.5">Stok Min</th>
                          <th className="p-2.5">Harga Modal</th>
                          <th className="p-2.5">Supplier / Kontak</th>
                        </>
                      )}
                      <th className="p-2.5 pr-3">Keterangan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-komazi-border bg-komazi-surface">
                    {parsedRows.slice(0, 100).map((row, idx) => {
                      const t = row.transformed;
                      return (
                        <tr
                          key={idx}
                          className={`hover:bg-komazi-surface-2/50 transition-colors ${
                            !row.isValid ? 'bg-red-500/5' : ''
                          }`}
                        >
                          {/* Status */}
                          <td className="p-2.5 pl-3">
                            {row.isValid ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <AlertCircle className="w-4 h-4 text-red-400" />
                            )}
                          </td>

                          {/* MENU */}
                          {type === 'MENU' && (
                            <>
                              <td className="p-2.5">
                                <div className="flex flex-col max-w-[150px]">
                                  <span className="font-bold text-komazi-text truncate">{t.name || '-'}</span>
                                  {t.sku && <span className="text-[10px] text-komazi-muted font-mono">{t.sku}</span>}
                                </div>
                              </td>
                              <td className="p-2.5 text-komazi-muted">
                                {t.categoryName || '-'}
                              </td>
                              <td className="p-2.5 font-mono text-komazi-text">
                                {t.isDynamicPrice ? (
                                  <div className="flex flex-col">
                                    <span className="text-amber-400 font-bold text-[10px]">⚡ Dinamis</span>
                                    <span className="text-[10px] text-komazi-muted">
                                      {t.minPrice > 0 ? `Min: Rp ${t.minPrice.toLocaleString('id-ID')}` : 'Bebas'}
                                    </span>
                                  </div>
                                ) : (
                                  `Rp ${t.price.toLocaleString('id-ID')}`
                                )}
                              </td>
                              <td className="p-2.5 font-mono">
                                {t.hpp > 0 ? (
                                  <div className="flex flex-col">
                                    <span className="font-bold text-komazi-text text-xs">
                                      Rp {t.hpp.toLocaleString('id-ID')}
                                    </span>
                                    <span className="text-[10px] text-komazi-muted flex items-center gap-1">
                                      {t.hppSource === 'calculated' && (
                                        <span className="text-emerald-400 font-medium flex items-center gap-0.5">
                                          <Calculator className="w-2.5 h-2.5" /> Hitung Resep
                                        </span>
                                      )}
                                      {t.hppSource === 'manual_and_recipe' && (
                                        <span className="text-cyan-400 font-medium flex items-center gap-0.5">
                                          <Sparkles className="w-2.5 h-2.5" /> Input + Resep
                                        </span>
                                      )}
                                      {t.hppSource === 'direct' && <span>Input Modal</span>}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-komazi-muted/60 italic text-[11px]">Rp 0</span>
                                )}
                              </td>
                              <td className="p-2.5">
                                {t.hpp > 0 && (t.price > 0 || t.minPrice > 0) ? (
                                  <div className="flex flex-col gap-0.5">
                                    <span
                                      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-bold w-fit ${
                                        t.marginPercent >= 60
                                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                          : t.marginPercent >= 20
                                          ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                                          : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                                      }`}
                                    >
                                      {t.marginPercent}%
                                    </span>
                                    <span className="text-[10px] font-mono text-komazi-muted">
                                      {t.grossProfit >= 0 ? '+' : ''}Rp {t.grossProfit.toLocaleString('id-ID')}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-komazi-muted/60">-</span>
                                )}
                              </td>
                              <td className="p-2.5 text-komazi-muted">
                                <div className="flex flex-col gap-0.5 max-w-[140px]">
                                  {t.recipeItems?.length > 0 && (
                                    <span
                                      className="text-[10px] text-komazi-text font-medium truncate"
                                      title={t.recipeItems.map((r) => `${r.ingredientName} (${r.quantity} ${r.unit})`).join(', ')}
                                    >
                                      🥄 {t.recipeItems.length} bahan baku
                                    </span>
                                  )}
                                  {t.variants?.length > 0 && (
                                    <span className="text-[10px] text-komazi-muted truncate">
                                      🏷️ {t.variants.length} varian
                                    </span>
                                  )}
                                  {(!t.recipeItems || t.recipeItems.length === 0) && (!t.variants || t.variants.length === 0) && (
                                    <span className="text-komazi-muted/60 text-[11px]">-</span>
                                  )}
                                </div>
                              </td>
                            </>
                          )}

                          {/* STAFF */}
                          {type === 'STAFF' && (
                            <>
                              <td className="p-2.5">
                                <div className="flex flex-col max-w-[150px]">
                                  <span className="font-bold text-komazi-text truncate">{t.name || '-'}</span>
                                  {t.phone && <span className="text-[10px] text-komazi-muted">{t.phone}</span>}
                                </div>
                              </td>
                              <td className="p-2.5 text-komazi-muted">
                                <span className="font-mono text-komazi-coral font-semibold">@{t.username}</span>
                              </td>
                              <td className="p-2.5 font-mono text-komazi-text">
                                <div className="flex flex-col">
                                  <span className="font-bold text-[11px] text-komazi-text">{t.role}</span>
                                  <span className="text-[10px] text-komazi-muted">{t.department}</span>
                                </div>
                              </td>
                              <td className="p-2.5 text-komazi-muted">
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-komazi-text font-medium">{t.jobTitle || '-'}</span>
                                  <span className="text-[10px] text-komazi-muted">{t.employmentType}</span>
                                </div>
                              </td>
                              <td className="p-2.5 font-mono text-komazi-text text-xs">
                                Rp {t.baseSalary.toLocaleString('id-ID')}
                              </td>
                            </>
                          )}

                          {/* CUSTOMER */}
                          {type === 'CUSTOMER' && (
                            <>
                              <td className="p-2.5">
                                <span className="font-bold text-komazi-text">{t.name || '-'}</span>
                              </td>
                              <td className="p-2.5 font-mono text-komazi-text">
                                {t.phone || '-'}
                              </td>
                              <td className="p-2.5 text-komazi-muted">
                                {t.email || '-'}
                              </td>
                              <td className="p-2.5 text-center">
                                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-komazi-surface-2 border border-komazi-border text-komazi-coral">
                                  {t.tier}
                                </span>
                              </td>
                              <td className="p-2.5 text-right font-mono font-bold text-komazi-coral">
                                {t.points} pts
                              </td>
                              <td className="p-2.5 text-komazi-muted max-w-[180px] truncate" title={t.notes}>
                                {t.notes || '-'}
                              </td>
                            </>
                          )}

                          {/* RECIPE */}
                          {type === 'RECIPE' && (
                            <>
                              <td className="p-2.5">
                                <span className="font-bold font-mono text-komazi-coral">{t.sku || '-'}</span>
                              </td>
                              <td className="p-2.5 text-komazi-muted">
                                {t.variantName || <span className="italic text-komazi-muted/60">Semua Varian</span>}
                              </td>
                              <td className="p-2.5 font-semibold text-komazi-text">
                                {t.ingredientName || '-'}
                              </td>
                              <td className="p-2.5 text-right font-mono font-bold text-komazi-text">
                                {t.quantity}
                              </td>
                            </>
                          )}

                          {/* INGREDIENT (DEFAULT) */}
                          {type !== 'MENU' && type !== 'STAFF' && type !== 'CUSTOMER' && type !== 'RECIPE' && (
                            <>
                              <td className="p-2.5">
                                <span className="font-bold text-komazi-text">{t.name || '-'}</span>
                              </td>
                              <td className="p-2.5 text-komazi-muted">
                                {t.unit}
                              </td>
                              <td className="p-2.5 font-mono text-komazi-text">
                                {t.stock} {t.unit}
                              </td>
                              <td className="p-2.5 font-mono text-komazi-muted">
                                {t.minStock} {t.unit}
                              </td>
                              <td className="p-2.5 font-mono text-komazi-text">
                                Rp {t.costPerUnit.toLocaleString('id-ID')}
                              </td>
                              <td className="p-2.5 text-komazi-muted text-[11px]">
                                {t.supplierName ? (
                                  <div>
                                    <span className="font-medium text-komazi-text">{t.supplierName}</span>
                                    {t.supplierPhone && <span className="block text-[10px] text-komazi-muted">{t.supplierPhone}</span>}
                                  </div>
                                ) : (
                                  '-'
                                )}
                              </td>
                            </>
                          )}

                          {/* Keterangan */}
                          <td className="p-2.5 pr-3 text-[11px]">
                            {row.isValid ? (
                              <div className="flex flex-col">
                                <span className="text-emerald-400 font-medium">Siap diimpor</span>
                                {row.warnings?.length > 0 && (
                                  <span className="text-amber-400 text-[10px]">
                                    ⚠ {row.warnings.join(', ')}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-red-400 font-medium">
                                {row.errors.join(', ')}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-komazi-border bg-komazi-surface-2/60 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="px-4 py-2.5 rounded-xl bg-komazi-surface hover:bg-komazi-surface-3 border border-komazi-border text-xs font-bold text-komazi-muted hover:text-white transition-colors"
          >
            Batal
          </button>

          <button
            type="button"
            onClick={handleImportSubmit}
            disabled={validCount === 0 || isSubmitting || isParsing}
            className="px-6 py-2.5 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark disabled:opacity-50 text-white text-xs font-black shadow-md transition-all flex items-center gap-2 active:scale-95"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Menyimpan & Menghitung HPP...</span>
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                <span>Import {validCount} Baris Data</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
