import React, { useState } from 'react';
import {
  KeyRound,
  Copy,
  Check,
  Eye,
  EyeOff,
  ShieldCheck,
  Terminal,
  Code,
  Laptop,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { toast } from '../../store/toastStore';

/**
 * KdsApiKeySettingsCard - Pengaturan Kunci API (API Key) untuk KDS & BDS
 * Memenuhi spesifikasi implementation.md:
 * 1. Istilah antarmuka (UI): "API Key" atau "Kunci API"
 * 2. Contoh implementasi header X-API-Key dan query string ?api_key=
 * 3. Restriksi akses (Scoped Permissions): Hanya baca & update status pesanan, tanpa akses finansial
 */
export default function KdsApiKeySettingsCard({ formState, currentUser }) {
  const [showKey, setShowKey] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [activeSnippetTab, setActiveSnippetTab] = useState('header');

  const apiKey = formState?.kdsApiKey || 'komazi_kds_live_secure_token_key_2026';
  const isOwner = currentUser?.role === 'OWNER';

  const handleCopyKey = () => {
    navigator.clipboard.writeText(apiKey);
    setCopiedKey(true);
    toast.success('Kunci API berhasil disalin ke clipboard!');
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const headerSnippet = `// Menggunakan Request Header (Sangat Direkomendasikan untuk Produksi)
const fetchKitchenOrders = async () => {
  const response = await fetch('https://pos-system.com/api/kds/orders', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': '${apiKey}' // Nama parameter formal
    }
  });
  return response.json();
};`;

  const querySnippet = `// Menggunakan Query String Parameter (Alternatif Pengujian / Webhook)
// GET https://pos-system.com/api/kds/orders?api_key=${apiKey}

const testStreamUrl = 'https://pos-system.com/api/kds/orders?api_key=' + encodeURIComponent('${apiKey}');`;

  return (
    <div className="p-5 rounded-2xl bg-komazi-surface border border-komazi-border space-y-5 shadow-sm">
      {/* 1. Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-komazi-border pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-komazi-coral/15 flex items-center justify-center text-komazi-coral shadow-inner">
            <KeyRound className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-sm sm:text-base text-komazi-text">
                Kunci API &amp; Integrasi Layar Dapur (KDS / BDS)
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Aktif
              </span>
            </div>
            <p className="text-xs text-komazi-muted mt-0.5">
              Token otentikasi nirkabel untuk komunikasi terminal kasir POS dengan perangkat tablet dapur (KDS) dan bar (BDS)
            </p>
          </div>
        </div>

        {isOwner ? (
          <span className="px-2.5 py-1 rounded-full bg-komazi-coral/15 text-komazi-coral border border-komazi-coral/30 text-xs font-bold shrink-0 self-start sm:self-auto">
            Hak Akses: Khusus Owner
          </span>
        ) : (
          <span className="px-2.5 py-1 rounded-full bg-neutral-800 text-komazi-muted border border-komazi-border text-xs font-bold shrink-0 self-start sm:self-auto">
            Hanya Baca
          </span>
        )}
      </div>

      {/* 2. Scoped Permissions Notice */}
      <div className="p-3.5 rounded-xl bg-komazi-teal/10 border border-komazi-teal/30 flex items-start gap-3 text-xs text-neutral-300">
        <ShieldCheck className="w-4 h-4 text-komazi-teal-light shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold text-komazi-teal-light">
            Restriksi Akses Keamanan (Scoped Permissions):
          </p>
          <p className="text-neutral-400 text-[11px] leading-relaxed">
            Setiap Kunci API (API Key) ini dibatasi izinnya hanya untuk membaca antrean pesanan (<code className="text-komazi-text bg-black/40 px-1 py-0.5 rounded">read</code>) dan memperbarui status memasak/siap saji (<code className="text-komazi-text bg-black/40 px-1 py-0.5 rounded">update status</code>). Kunci ini secara otomatis <b>dilarang keras</b> mengakses data finansial, laporan omzet, void, atau modifikasi harga kasir.
          </p>
        </div>
      </div>

      {/* 3. API Key Display & Copy Field */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-komazi-text flex items-center justify-between">
          <span>Kunci API Aktif (API Key):</span>
          <span className="text-[11px] text-komazi-muted font-normal">
            Gunakan header <code className="text-komazi-coral bg-black/30 px-1 py-0.5 rounded font-mono">X-API-Key</code>
          </span>
        </label>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type={showKey ? 'text' : 'password'}
              readOnly
              value={apiKey}
              className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border font-mono text-xs text-komazi-text select-all focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              aria-label={showKey ? 'Sembunyikan Kunci API' : 'Lihat Kunci API'}
              className="absolute right-3 top-2.5 text-komazi-muted hover:text-white transition-colors"
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <button
            type="button"
            onClick={handleCopyKey}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark text-white font-bold text-xs shadow-md transition-all active:scale-95 shrink-0"
          >
            {copiedKey ? <Check className="w-4 h-4 stroke-[3]" /> : <Copy className="w-4 h-4" />}
            <span>{copiedKey ? 'Disalin!' : 'Salin Kunci API'}</span>
          </button>
        </div>
      </div>

      {/* 4. Integration Code Examples (Tabs) */}
      <div className="space-y-2 pt-2 border-t border-komazi-border/60">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-komazi-text flex items-center gap-1.5">
            <Terminal className="w-3.5 h-3.5 text-komazi-coral" />
            Contoh Implementasi Request (Code Snippets):
          </span>

          <div className="flex items-center gap-1 bg-komazi-surface-2 p-1 rounded-lg border border-komazi-border">
            <button
              type="button"
              onClick={() => setActiveSnippetTab('header')}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${
                activeSnippetTab === 'header'
                  ? 'bg-komazi-coral text-white shadow-sm'
                  : 'text-komazi-muted hover:text-white'
              }`}
            >
              Request Header (X-API-Key)
            </button>
            <button
              type="button"
              onClick={() => setActiveSnippetTab('query')}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${
                activeSnippetTab === 'query'
                  ? 'bg-komazi-coral text-white shadow-sm'
                  : 'text-komazi-muted hover:text-white'
              }`}
            >
              Query String (?api_key=)
            </button>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-[#090909] border border-komazi-border/80 font-mono text-[11px] text-neutral-300 overflow-x-auto relative">
          <pre className="whitespace-pre">
            {activeSnippetTab === 'header' ? headerSnippet : querySnippet}
          </pre>
        </div>
      </div>
    </div>
  );
}
