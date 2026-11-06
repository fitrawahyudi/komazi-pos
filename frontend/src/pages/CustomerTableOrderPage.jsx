import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  Coffee,
  ShoppingBag,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Upload,
  Camera,
  X,
  Search,
  ChevronRight,
  Info,
  Clock,
  Sparkles,
  RefreshCw,
  ArrowLeft,
  UtensilsCrossed,
} from 'lucide-react';
import { qrOrderService } from '../services/qrOrderService';
import { formatRupiah } from '../utils/format';
import LiveOrderTracker from '../components/customer/LiveOrderTracker';

export default function CustomerTableOrderPage() {
  const params = useParams();
  const [searchParams] = useSearchParams();

  // Ambil nomor meja dari path param /meja/:tableNo atau query string ?meja=...
  const rawParam = params.tableNo || searchParams.get('meja') || searchParams.get('table') || '01';
  // Simpan format bersih nomor meja (misal "12", "04", "VIP-1") tanpa prefix "Meja"
  const tableNo = String(rawParam).replace(/^(meja\s*)+/i, '').trim() || '01';
  const displayTable = `Meja ${tableNo}`;

  // State data utama
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState(null);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // State Pelanggan & Keranjang
  const [customerName, setCustomerName] = useState('');
  const [cart, setCart] = useState([]); // [{ productId, productName, variantName, qty, unitPrice, note }]

  // State Modal Varian
  const [variantModalProduct, setVariantModalProduct] = useState(null);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [itemNote, setItemNote] = useState('');

  // State Checkout & Bukti Transfer
  const [activeStep, setActiveStep] = useState('MENU'); // 'MENU' | 'CART' | 'PAYMENT' | 'TRACKER'
  const [paymentMethod, setPaymentMethod] = useState('QRIS'); // 'QRIS' | 'TRANSFER'
  const [proofFile, setProofFile] = useState(null);
  const [proofPreview, setProofPreview] = useState(null);
  const [validatingCart, setValidatingCart] = useState(false);
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [validationError, setValidationError] = useState(null);
  const [createdOrder, setCreatedOrder] = useState(null);
  const [activeOrderInvoice, setActiveOrderInvoice] = useState(() => {
    try {
      const raw = localStorage.getItem(`komazi_active_order_${tableNo}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.invoiceNo && Date.now() - (parsed.createdAt || 0) < 6 * 3600 * 1000) {
          return parsed.invoiceNo;
        }
      }
    } catch {}
    return null;
  });
  const [copiedAccount, setCopiedAccount] = useState(false);

  const fileInputRef = useRef(null);

  // Load config & katalog menu saat pertama dibuka
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [cfgRes, menuRes] = await Promise.all([
          qrOrderService.getConfig().catch(() => null),
          qrOrderService.getMenu().catch(() => null),
        ]);

        if (cfgRes?.data) {
          setConfig(cfgRes.data);
        }
        if (menuRes?.data) {
          setCategories(menuRes.data.categories || []);
          setProducts(menuRes.data.products || []);
        }
      } catch (err) {
        console.error('Gagal memuat data QR order:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Filter menu berdasarkan kategori & pencarian
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchCat = selectedCategory === 'ALL' || p.categoryId === Number(selectedCategory);
      const matchQuery =
        !searchQuery ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchCat && matchQuery;
    });
  }, [products, selectedCategory, searchQuery]);

  // Kalkulasi total keranjang
  const cartSubtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.unitPrice * item.qty, 0);
  }, [cart]);

  const taxAmount = useMemo(() => {
    const rate = config?.taxRate || 0;
    return rate > 0 ? Math.round(cartSubtotal * (rate / 100)) : 0;
  }, [cartSubtotal, config]);

  const serviceFeeAmount = useMemo(() => {
    const rate = config?.serviceFeeRate || 0;
    return rate > 0 ? Math.round(cartSubtotal * (rate / 100)) : 0;
  }, [cartSubtotal, config]);

  const cartTotal = cartSubtotal + taxAmount + serviceFeeAmount;
  const cartTotalItems = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.qty, 0);
  }, [cart]);

  // Handler tambah menu ke keranjang
  const handleAddToCartClick = (product) => {
    if (product.isSoldOut) return;

    if (product.variants && product.variants.length > 0) {
      setVariantModalProduct(product);
      setSelectedVariant(product.variants[0] || null);
      setItemNote('');
    } else {
      addToCart(product, null, '');
    }
  };

  const addToCart = (product, variant, note) => {
    const unitPrice = Number(product.price) + Number(variant?.extraPrice || 0);
    const variantName = variant?.name || null;

    setCart((prev) => {
      const existingIdx = prev.findIndex(
        (it) => it.productId === product.id && it.variantName === variantName && it.note === note
      );

      if (existingIdx >= 0) {
        const copy = [...prev];
        copy[existingIdx].qty += 1;
        return copy;
      }

      return [
        ...prev,
        {
          productId: product.id,
          productName: product.name,
          variantName,
          unitPrice,
          qty: 1,
          note: note || '',
        },
      ];
    });

    setVariantModalProduct(null);
  };

  const updateCartItemQty = (index, delta) => {
    setCart((prev) => {
      const copy = [...prev];
      const newQty = copy[index].qty + delta;
      if (newQty <= 0) {
        copy.splice(index, 1);
      } else {
        copy[index].qty = newQty;
      }
      return copy;
    });
  };

  // Handler foto bukti transfer
  const handleProofChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setProofFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      setProofPreview(event.target.result);
    };
    reader.readAsDataURL(file);
  };

  // Validasi real-time stok saat menuju halaman pembayaran
  const handleProceedToPayment = async () => {
    if (cart.length === 0) return;
    setValidatingCart(true);
    setValidationError(null);

    try {
      const res = await qrOrderService.validateCart(
        cart.map((it) => ({
          productId: it.productId,
          variantName: it.variantName,
          qty: it.qty,
        }))
      );

      if (res?.valid === false) {
        const list = res.unavailableItems?.map((u) => `• ${u.productName}: ${u.reason}`).join('\n');
        setValidationError(
          `Mohon maaf, beberapa menu di keranjang Anda sedang tidak tersedia:\n\n${list}\n\nSilakan sesuaikan pesanan Anda.`
        );
        return;
      }

      // Validasi lolos -> Lanjut ke step pembayaran
      setActiveStep('PAYMENT');
    } catch (err) {
      setValidationError(err.message || 'Gagal memeriksa ketersediaan menu. Silakan coba lagi.');
    } finally {
      setValidatingCart(false);
    }
  };

  // Submit checkout pesanan meja
  const handleSubmitOrder = async () => {
    if (!proofFile && !proofPreview) {
      alert('Mohon lampirkan foto bukti transfer pembayaran Anda.');
      return;
    }

    setSubmittingOrder(true);
    try {
      const formData = new FormData();
      formData.append('tableNo', tableNo);
      formData.append('customerName', customerName.trim() || 'Tamu');
      formData.append('paymentMethod', paymentMethod);
      formData.append('items', JSON.stringify(cart));

      if (proofFile) {
        formData.append('proof', proofFile);
      } else if (proofPreview) {
        formData.append('proofImage', proofPreview);
      }

      const res = await qrOrderService.checkout(formData);
      if (res?.data) {
        setCreatedOrder(res.data);
        setActiveOrderInvoice(res.data.invoiceNo);
        try {
          localStorage.setItem(
            `komazi_active_order_${tableNo}`,
            JSON.stringify({
              invoiceNo: res.data.invoiceNo,
              createdAt: Date.now(),
            })
          );
        } catch {}
        setActiveStep('TRACKER');
        setCart([]);
      }
    } catch (err) {
      alert(`Gagal mengirim pesanan: ${err.message}`);
    } finally {
      setSubmittingOrder(false);
    }
  };

  // Salin nomor rekening 1-klik
  const handleCopyAccount = () => {
    if (!config?.accountNo) return;
    navigator.clipboard?.writeText(config.accountNo);
    setCopiedAccount(true);
    setTimeout(() => setCopiedAccount(false), 2500);
  };

  // 1. Tampilan Loading Awal
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0e0e11] text-white flex flex-col items-center justify-center p-6">
        <div className="w-12 h-12 rounded-full border-2 border-amber-500 border-t-transparent animate-spin mb-4" />
        <p className="text-zinc-400 text-sm font-medium">Menghubungkan ke {displayTable}...</p>
      </div>
    );
  }

  // 2. Tampilan Fitur Dinonaktifkan (Trial Off State)
  if (!config?.enabled) {
    return (
      <div className="min-h-screen bg-[#0e0e11] text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 bg-zinc-900 border border-zinc-800 rounded-3xl flex items-center justify-center text-amber-500 shadow-2xl mb-6">
          <Coffee size={40} />
        </div>
        <span className="px-3 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-semibold rounded-full mb-3">
          {displayTable}
        </span>
        <h1 className="text-2xl font-bold mb-2">Pemesanan di Meja Sedang Tutup</h1>
        <p className="text-zinc-400 text-sm max-w-sm mb-6 leading-relaxed">
          Fitur pemesanan mandiri via QR meja saat ini sedang dinonaktifkan sementara. Silakan pesan dan lakukan
          pembayaran langsung di meja kasir kami ya!
        </p>
      </div>
    );
  }

  // 3. Tampilan Live Order Tracker (Pelacak Status Pesanan Meja Real-time)
  if (activeStep === 'TRACKER' || activeStep === 'SUCCESS') {
    return (
      <div className="min-h-screen bg-[#0e0e11] text-zinc-100 flex flex-col pb-12">
        {/* Top Bar Tracker */}
        <header className="sticky top-0 z-30 bg-[#0e0e11]/90 backdrop-blur-md border-b border-zinc-800/80 px-4 py-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              setActiveStep('MENU');
              setProofFile(null);
              setProofPreview(null);
            }}
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft size={16} />
            <span>Katalog Menu</span>
          </button>
        </header>

        <LiveOrderTracker
          orderInvoice={activeOrderInvoice || createdOrder?.invoiceNo}
          initialData={createdOrder}
          tableNo={tableNo}
          onOrderMore={() => {
            setActiveStep('MENU');
            setProofFile(null);
            setProofPreview(null);
          }}
        />
      </div>
    );
  }

  // 4. Tampilan Utama: Header, Menu, Cart Drawer, & Payment
  return (
    <div className="min-h-screen bg-[#0e0e11] text-zinc-100 flex flex-col pb-28">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 bg-[#0e0e11]/90 backdrop-blur-md border-b border-zinc-800/80 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold text-xs">
            ☕
          </div>
          <div>
            <h1 className="text-sm font-bold leading-tight tracking-tight text-white">
              {config?.storeName || 'Komazi Coffee'}
            </h1>
            <p className="text-[11px] text-zinc-400">Pemesanan Mandiri Meja</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {activeOrderInvoice && (
            <button
              type="button"
              onClick={() => setActiveStep('TRACKER')}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold shadow-sm hover:bg-amber-500/25 transition-all cursor-pointer animate-pulse"
              title="Lihat status pesanan yang sedang diproses"
            >
              <Clock size={13} />
              <span className="hidden sm:inline">Lacak</span> Status
            </button>
          )}
          <span className="px-2.5 py-1 bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono text-xs font-bold rounded-lg shadow-sm">
            {displayTable}
          </span>
        </div>
      </header>

      {/* Banner Input Nama Pelanggan */}
      <section className="px-4 pt-3 pb-1">
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-400 text-xs">
            👤
          </div>
          <div className="flex-1">
            <label className="block text-[10px] uppercase font-semibold text-zinc-500 tracking-wider">
              Nama Pemesan
            </label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Masukkan nama Anda (misal: Budi)"
              className="w-full bg-transparent text-xs text-white placeholder-zinc-600 focus:outline-none"
            />
          </div>
        </div>
      </section>

      {/* Search Bar */}
      <section className="px-4 py-2">
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari kopi, makanan, atau snack..."
            className="w-full bg-zinc-900/80 border border-zinc-800/80 rounded-xl pl-9 pr-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500/50 transition"
          />
        </div>
      </section>

      {/* Category Tabs */}
      <section className="px-4 py-1 overflow-x-auto scrollbar-none flex gap-1.5">
        <button
          onClick={() => setSelectedCategory('ALL')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
            selectedCategory === 'ALL'
              ? 'bg-amber-500 text-black font-semibold shadow-md'
              : 'bg-zinc-900 border border-zinc-800/80 text-zinc-400 hover:text-white'
          }`}
        >
          Semua Menu
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(String(cat.id))}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
              selectedCategory === String(cat.id)
                ? 'bg-amber-500 text-black font-semibold shadow-md'
                : 'bg-zinc-900 border border-zinc-800/80 text-zinc-400 hover:text-white'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </section>

      {/* Daftar Produk Menu Grid */}
      <main className="px-4 pt-3 grid grid-cols-2 gap-2.5">
        {filteredProducts.map((p) => {
          const isSoldOut = Boolean(p.isSoldOut);
          return (
            <div
              key={p.id}
              className={`relative bg-zinc-900/70 border rounded-2xl p-2.5 flex flex-col justify-between transition ${
                isSoldOut
                  ? 'border-zinc-800/50 opacity-60'
                  : 'border-zinc-800 hover:border-zinc-700 active:scale-[0.98]'
              }`}
            >
              {/* Gambar Menu */}
              <div className="relative w-full aspect-square bg-zinc-950 rounded-xl overflow-hidden mb-2 flex items-center justify-center">
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                ) : (
                  <Coffee size={32} className="text-zinc-700" />
                )}

                {/* Badge Sold Out */}
                {isSoldOut && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center">
                    <span className="px-2 py-1 bg-red-500/90 text-white font-bold text-[10px] rounded-md tracking-wider">
                      HABIS
                    </span>
                  </div>
                )}
              </div>

              {/* Info Produk */}
              <div>
                <h3 className="font-semibold text-xs text-white line-clamp-1">{p.name}</h3>
                {p.description && (
                  <p className="text-[10px] text-zinc-500 line-clamp-1 mt-0.5">{p.description}</p>
                )}
              </div>

              {/* Harga & Tombol Tambah */}
              <div className="mt-2.5 flex items-center justify-between">
                <span className="text-xs font-bold font-mono text-emerald-400">{formatRupiah(p.price)}</span>
                <button
                  disabled={isSoldOut}
                  onClick={() => handleAddToCartClick(p)}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold transition ${
                    isSoldOut
                      ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                      : 'bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-black shadow'
                  }`}
                >
                  +
                </button>
              </div>
            </div>
          );
        })}
      </main>

      {filteredProducts.length === 0 && (
        <div className="py-16 text-center text-zinc-500 text-xs">
          Tidak ada menu yang sesuai dengan pencarian Anda.
        </div>
      )}

      {/* Floating Bottom Bar (Jika Keranjang Terisi) */}
      {cart.length > 0 && activeStep === 'MENU' && (
        <div className="fixed bottom-0 inset-x-0 z-40 p-4 bg-gradient-to-t from-black via-black/95 to-transparent">
          <div className="max-w-md mx-auto bg-zinc-900 border border-zinc-700/80 rounded-2xl p-3 shadow-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-black flex items-center justify-center font-bold text-sm">
                <ShoppingBag size={18} />
              </div>
              <div>
                <p className="text-[11px] text-zinc-400 font-medium">{cartTotalItems} Menu Dipilih</p>
                <p className="text-sm font-bold font-mono text-emerald-400">{formatRupiah(cartTotal)}</p>
              </div>
            </div>
            <button
              onClick={() => setActiveStep('CART')}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-black font-semibold text-xs rounded-xl shadow transition flex items-center gap-1.5"
            >
              Lihat Pesanan <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Modal Pilih Varian */}
      {variantModalProduct && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-t-3xl sm:rounded-3xl p-5 space-y-4 animate-in slide-in-from-bottom">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <h3 className="font-bold text-sm text-white">{variantModalProduct.name}</h3>
                <p className="text-xs text-emerald-400 font-mono mt-0.5">
                  {formatRupiah(
                    Number(variantModalProduct.price) + Number(selectedVariant?.extraPrice || 0)
                  )}
                </p>
              </div>
              <button
                onClick={() => setVariantModalProduct(null)}
                className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400"
              >
                <X size={16} />
              </button>
            </div>

            {/* Opsi Varian */}
            {variantModalProduct.variants && variantModalProduct.variants.length > 0 && (
              <div>
                <label className="block text-[11px] font-semibold text-zinc-400 mb-2">Pilih Varian / Opsi:</label>
                <div className="grid grid-cols-2 gap-2">
                  {variantModalProduct.variants.map((v) => {
                    const isSelected = selectedVariant?.id === v.id;
                    return (
                      <button
                        key={v.id}
                        onClick={() => setSelectedVariant(v)}
                        className={`p-2.5 rounded-xl border text-left text-xs transition ${
                          isSelected
                            ? 'bg-amber-500/15 border-amber-500 text-amber-300 font-semibold'
                            : 'bg-zinc-950 border-zinc-800 text-zinc-300'
                        }`}
                      >
                        <div className="font-medium">{v.name}</div>
                        {v.extraPrice > 0 && (
                          <div className="text-[10px] text-emerald-400 font-mono">
                            +{formatRupiah(v.extraPrice)}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Catatan Khusus */}
            <div>
              <label className="block text-[11px] font-semibold text-zinc-400 mb-1.5">
                Catatan (Opsional):
              </label>
              <input
                type="text"
                value={itemNote}
                onChange={(e) => setItemNote(e.target.value)}
                placeholder="Contoh: Less sugar, extra es, hangat..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500/50"
              />
            </div>

            <button
              onClick={() => addToCart(variantModalProduct, selectedVariant, itemNote)}
              className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs rounded-xl shadow transition"
            >
              Tambahkan ke Pesanan
            </button>
          </div>
        </div>
      )}

      {/* Modal / Drawer Keranjang Pesanan (Step: 'CART') */}
      {activeStep === 'CART' && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col justify-end">
          <div className="w-full max-w-md mx-auto bg-zinc-900 border-t border-zinc-800 rounded-t-3xl max-h-[85vh] flex flex-col animate-in slide-in-from-bottom">
            {/* Header Drawer */}
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingBag size={18} className="text-amber-500" />
                <h2 className="font-bold text-sm text-white">Keranjang Pesanan ({displayTable})</h2>
              </div>
              <button
                onClick={() => setActiveStep('MENU')}
                className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400"
              >
                <X size={16} />
              </button>
            </div>

            {/* Alert Error Validasi Menu Kosong */}
            {validationError && (
              <div className="m-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-2.5 text-xs text-red-300">
                <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
                <div className="whitespace-pre-line leading-relaxed">{validationError}</div>
              </div>
            )}

            {/* Rincian Item */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {cart.map((item, idx) => (
                <div key={idx} className="bg-zinc-950/70 border border-zinc-800/80 rounded-xl p-3 flex items-center justify-between">
                  <div className="flex-1 pr-2">
                    <p className="font-semibold text-xs text-white">{item.productName}</p>
                    {item.variantName && (
                      <p className="text-[11px] text-amber-400 font-medium">{item.variantName}</p>
                    )}
                    {item.note && (
                      <p className="text-[10px] text-zinc-500 italic mt-0.5">"{item.note}"</p>
                    )}
                    <p className="text-xs font-mono text-emerald-400 mt-1 font-semibold">
                      {formatRupiah(item.unitPrice * item.qty)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-lg p-1">
                    <button
                      onClick={() => updateCartItemQty(idx, -1)}
                      className="w-6 h-6 rounded bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-300"
                    >
                      -
                    </button>
                    <span className="w-5 text-center text-xs font-bold text-white font-mono">{item.qty}</span>
                    <button
                      onClick={() => updateCartItemQty(idx, 1)}
                      className="w-6 h-6 rounded bg-amber-500 hover:bg-amber-400 flex items-center justify-center text-xs font-bold text-black"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Ringkasan Biaya & Tombol Bayar */}
            <div className="p-4 bg-zinc-950/80 border-t border-zinc-800 space-y-2">
              <div className="flex justify-between text-xs text-zinc-400">
                <span>Subtotal</span>
                <span className="font-mono text-zinc-200">{formatRupiah(cartSubtotal)}</span>
              </div>
              {taxAmount > 0 && (
                <div className="flex justify-between text-xs text-zinc-400">
                  <span>Pajak Restoran</span>
                  <span className="font-mono text-zinc-200">{formatRupiah(taxAmount)}</span>
                </div>
              )}
              {serviceFeeAmount > 0 && (
                <div className="flex justify-between text-xs text-zinc-400">
                  <span>Service Fee</span>
                  <span className="font-mono text-zinc-200">{formatRupiah(serviceFeeAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold text-white pt-2 border-t border-zinc-800">
                <span>Total Tagihan</span>
                <span className="font-mono text-emerald-400">{formatRupiah(cartTotal)}</span>
              </div>

              <button
                disabled={validatingCart || cart.length === 0}
                onClick={handleProceedToPayment}
                className="w-full mt-3 py-3 bg-amber-500 hover:bg-amber-400 disabled:bg-zinc-800 disabled:text-zinc-600 text-black font-bold text-xs rounded-xl shadow-lg transition flex items-center justify-center gap-2"
              >
                {validatingCart ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" /> Memvalidasi Stok Dapur...
                  </>
                ) : (
                  <>Lanjut ke Pembayaran ({formatRupiah(cartTotal)})</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Pembayaran & Upload Bukti Transfer (Step: 'PAYMENT') */}
      {activeStep === 'PAYMENT' && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col justify-end">
          <div className="w-full max-w-md mx-auto bg-zinc-900 border-t border-zinc-800 rounded-t-3xl max-h-[90vh] flex flex-col animate-in slide-in-from-bottom">
            {/* Header Payment */}
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
              <button
                onClick={() => setActiveStep('CART')}
                className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white"
              >
                <ArrowLeft size={16} /> Kembali
              </button>
              <h2 className="font-bold text-sm text-white">Pembayaran Langsung</h2>
              <button
                onClick={() => setActiveStep('MENU')}
                className="w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400"
              >
                <X size={14} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Pilihan Metode Bayar */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setPaymentMethod('QRIS')}
                  className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition ${
                    paymentMethod === 'QRIS'
                      ? 'bg-amber-500/15 border-amber-500 text-amber-300'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                  }`}
                >
                  📱 QRIS Instan
                </button>
                <button
                  onClick={() => setPaymentMethod('TRANSFER')}
                  className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition ${
                    paymentMethod === 'TRANSFER'
                      ? 'bg-amber-500/15 border-amber-500 text-amber-300'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                  }`}
                >
                  🏦 Transfer Bank
                </button>
              </div>

              {/* Box Instruksi & Detail Rekening */}
              <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-center space-y-3">
                <p className="text-xs text-zinc-400">Total yang harus ditransfer:</p>
                <div className="text-2xl font-black font-mono text-emerald-400">
                  {formatRupiah(cartTotal)}
                </div>

                {paymentMethod === 'QRIS' ? (
                  <div className="space-y-3 pt-2">
                    {config?.qrisUrl ? (
                      <div className="w-48 h-48 mx-auto bg-white p-2 rounded-xl border border-zinc-700 shadow-md flex items-center justify-center">
                        <img src={config.qrisUrl} alt="QRIS Kedai" className="w-full h-full object-contain" />
                      </div>
                    ) : (
                      <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-400">
                        📱 Silakan scan QRIS pada stiker meja Anda atau gunakan nomor transfer berikut.
                      </div>
                    )}
                    <p className="text-[11px] text-zinc-500">
                      Mendukung BCA, Mandiri, GoPay, OVO, ShopeePay, DANA, & LinkAja
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 pt-2">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-left">
                      <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
                        Bank Tujuan ({config?.bankName || 'BCA'})
                      </p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="font-mono font-bold text-sm text-white tracking-wider">
                          {config?.accountNo || 'Hubungi Kasir'}
                        </span>
                        {config?.accountNo && (
                          <button
                            onClick={handleCopyAccount}
                            className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-xs rounded-lg text-amber-400 flex items-center gap-1 transition"
                          >
                            {copiedAccount ? <Check size={12} /> : <Copy size={12} />}
                            {copiedAccount ? 'Tersalin' : 'Salin'}
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-zinc-400 mt-1">
                        a.n. <strong className="text-zinc-200">{config?.accountHolder || 'Komazi Space'}</strong>
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Upload Foto Bukti Pembayaran */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-zinc-300">
                  Unggah Foto Bukti Transfer (Wajib)
                </label>

                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  onChange={handleProofChange}
                  className="hidden"
                />

                {proofPreview ? (
                  <div className="relative w-full aspect-video bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden flex items-center justify-center">
                    <img src={proofPreview} alt="Bukti Transfer" className="w-full h-full object-contain" />
                    <button
                      onClick={() => {
                        setProofFile(null);
                        setProofPreview(null);
                      }}
                      className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/70 text-white flex items-center justify-center backdrop-blur-sm"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-6 border-2 border-dashed border-zinc-800 hover:border-amber-500/50 rounded-2xl flex flex-col items-center justify-center gap-2 bg-zinc-950/60 transition"
                  >
                    <div className="w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center text-amber-400">
                      <Camera size={20} />
                    </div>
                    <span className="text-xs text-zinc-300 font-medium">Ambil Foto / Pilih dari Galeri</span>
                    <span className="text-[10px] text-zinc-500">Format JPG, PNG, atau screenshot transfer</span>
                  </button>
                )}
              </div>
            </div>

            {/* Tombol Kirim Pesanan */}
            <div className="p-4 bg-zinc-950/80 border-t border-zinc-800">
              <button
                disabled={submittingOrder || (!proofFile && !proofPreview)}
                onClick={handleSubmitOrder}
                className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 disabled:bg-zinc-800 disabled:text-zinc-600 text-black font-bold text-xs rounded-xl shadow-lg transition flex items-center justify-center gap-2"
              >
                {submittingOrder ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" /> Mengirim Pesanan ke Kasir...
                  </>
                ) : (
                  <>Kirim Pesanan & Bukti Bayar</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

