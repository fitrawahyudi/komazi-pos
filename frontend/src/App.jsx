import React, { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/layout/Layout';
import ToastContainer from './components/ui/ToastContainer';
import PageFallbackSkeleton from './components/ui/loading/skeletons/PageFallbackSkeleton';
import AnimatedSplashScreen from './components/common/AnimatedSplashScreen';
import { useAuthStore } from './store/authStore';
import { useSettingsStore } from './store/settingsStore';
import { usePosStore } from './store/posStore';
import { useOrdersStore, initOrdersSocketSync } from './store/ordersStore';
import { useWorkspaceStore } from './store/workspaceStore';
import { useShiftStore, initShiftSocketSync } from './store/shiftStore';
import { useCartStore } from './store/cartStore';
import { useCustomerStore, initCustomersSocketSync } from './store/customerStore';
import { NotificationService } from './services/notification.service';
import { useNotificationStore } from './store/notificationStore';
import { useToastStore } from './store/toastStore';
import { usePrinterStore } from './store/printerStore';
import { useCmsStore } from './store/cmsStore';
import { getSocket } from './services/socket';
import { isAndroid, isNative, isInstalledApp } from './services/platform';

// Code-splitting via React.lazy for dynamic asynchronous loading
// Official docs: https://react.dev/reference/react/lazy
const PosPage = lazy(() => import('./pages/PosPage'));
const WorkspacePage = lazy(() => import('./pages/WorkspacePage'));
const OrdersPage = lazy(() => import('./pages/OrdersPage'));
const MenuPage = lazy(() => import('./pages/MenuPage'));
const CategoriesPage = lazy(() => import('./pages/CategoriesPage'));
const PromosPage = lazy(() => import('./pages/PromosPage'));
const StockPage = lazy(() => import('./pages/StockPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const KdsPage = lazy(() => import('./pages/KdsPage'));
const KdsStandaloneScreen = lazy(() => import('./pages/KdsStandaloneScreen'));
const CustomersPage = lazy(() => import('./pages/CustomersPage'));
const PrinterPage = lazy(() => import('./pages/PrinterPage'));
const CashDrawerPage = lazy(() => import('./pages/CashDrawerPage'));
const CashSessionPage = lazy(() => import('./pages/CashSessionPage'));
const RefundsPage = lazy(() => import('./pages/RefundsPage'));
const SuppliersPage = lazy(() => import('./pages/inventory/SuppliersPage'));
const InboundStockPage = lazy(() => import('./pages/inventory/InboundStockPage'));
const StockOpnamePage = lazy(() => import('./pages/inventory/StockOpnamePage'));
const AssetsPage = lazy(() => import('./pages/inventory/AssetsPage'));
const ExpensesPage = lazy(() => import('./pages/finance/ExpensesPage'));
const DepreciationPage = lazy(() => import('./pages/finance/DepreciationPage'));
const HrisPage = lazy(() => import('./pages/hris/HrisPage'));
const ShiftHistoryPage = lazy(() => import('./pages/ShiftHistoryPage'));

// Public Landing Page & Dedicated Marketing CMS Portal (Admin & Owner)
const LandingPage = lazy(() => import('./pages/landing/LandingPage'));
const CmsLayout = lazy(() => import('./components/cms/CmsLayout'));
const CmsOverviewPage = lazy(() => import('./pages/cms/CmsOverviewPage'));
const CmsHeroPage = lazy(() => import('./pages/cms/CmsHeroPage'));
const CmsMenuSpotlightPage = lazy(() => import('./pages/cms/CmsMenuSpotlightPage'));
const CmsPromosPage = lazy(() => import('./pages/cms/CmsPromosPage'));
const CmsFacilitiesPage = lazy(() => import('./pages/cms/CmsFacilitiesPage'));
const CmsTestimonialsPage = lazy(() => import('./pages/cms/CmsTestimonialsPage'));
const CmsOutletPage = lazy(() => import('./pages/cms/CmsOutletPage'));
const CmsSeoPage = lazy(() => import('./pages/cms/CmsSeoPage'));
const DownloadPage = lazy(() => import('./pages/DownloadPage'));

// Index Redirect Component
function IndexRedirect() {
  const { user, isAuthenticated } = useAuthStore();
  if (!isAuthenticated) {
    return <Navigate to={isInstalledApp ? '/login' : '/'} replace />;
  }
  if (user?.role === 'KITCHEN' || user?.role === 'BARISTA') {
    return <Navigate to="/kds-screen" replace />;
  }
  return <Navigate to="/pos" replace />;
}

// Dedicated Printer Route - Redirects Owner to Settings tab Printer
function PrinterRoute() {
  const { user } = useAuthStore();
  if (user?.role === 'OWNER') {
    return <Navigate to="/settings?tab=printer" replace />;
  }
  return <PrinterPage />;
}

// Protected Route Guard
function ProtectedRoute({ children, allowedRoles }) {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    // If Kitchen or Barista staff tries to access unauthorized cashier/manager pages, redirect to KDS
    if (user?.role === 'KITCHEN' || user?.role === 'BARISTA') {
      return <Navigate to="/kds-screen" replace />;
    }
    return <Navigate to="/pos" replace />;
  }

  return children;
}

// Root Route Resolver: Menentukan tampilan root / secara instan tanpa flash
function RootRoute() {
  const { user, isAuthenticated } = useAuthStore();
  const landingData = useCmsStore((state) => state.landingData);
  const fetchPublicLanding = useCmsStore((state) => state.fetchPublicLanding);
  const isPreview = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('preview') === 'true';

  const [hasResolved, setHasResolved] = useState(() => Boolean(landingData?.config));

  useEffect(() => {
    let isMounted = true;
    fetchPublicLanding().finally(() => {
      if (isMounted) setHasResolved(true);
    });
    return () => {
      isMounted = false;
    };
  }, [fetchPublicLanding]);

  // 1. Jika berjalan sebagai aplikasi terinstal (APK / Standalone PWA), kunci langsung ke POS / Login
  if (isInstalledApp) {
    if (!isAuthenticated) {
      return <Navigate to="/login" replace />;
    }
    if (user?.role === 'KITCHEN' || user?.role === 'BARISTA') {
      return <Navigate to="/kds-screen" replace />;
    }
    return <Navigate to="/pos" replace />;
  }

  // 2. Jika konfigurasi landing page sudah ada dan NONAKTIF (bukan mode preview):
  // Langsung arahkan ke POS / Login secara instan tanpa memuat komponen LandingPage
  const isLandingActive = landingData?.config?.isLandingPageActive ?? true;
  if (landingData?.config && !isLandingActive && !isPreview) {
    if (!isAuthenticated) {
      return <Navigate to="/login" replace />;
    }
    if (user?.role === 'KITCHEN' || user?.role === 'BARISTA') {
      return <Navigate to="/kds-screen" replace />;
    }
    return <Navigate to="/pos" replace />;
  }

  // 3. Jika data belum pernah diambil (cache awal kosong) dan bukan mode pratinjau:
  // Tampilkan skeleton netral sementara, JANGAN render LandingPage sebelum status aktif/nonaktif terkonfirmasi
  if (!hasResolved && !landingData?.config && !isPreview) {
    return <PageFallbackSkeleton />;
  }

  // 4. Jika landing page aktif atau sedang dibuka dengan parameter ?preview=true
  return (
    <Suspense fallback={<PageFallbackSkeleton />}>
      <LandingPage />
    </Suspense>
  );
}

// CMS Route Guard: Aplikasi terinstal dilarang mengakses CMS studio
function CmsRouteGuard({ children }) {
  if (isInstalledApp) {
    return <Navigate to="/pos" replace />;
  }
  return children;
}

export default function App() {
  // Splash screen HANYA muncul pada aplikasi Android (Capacitor APK), BUKAN web browser
  const [showSplash, setShowSplash] = useState(() => {
    const isDebugSplash = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('splash');
    return (isAndroid && isNative) || isDebugSplash;
  });
  const { fetchSettings } = useSettingsStore();
  const { initAuth, isAuthenticated } = useAuthStore();

  // ─── Force-logout listener: user dinonaktifkan oleh Owner ───────────────
  useEffect(() => {
    const socket = getSocket();
    const handleForceLogout = ({ userId, reason }) => {
      const currentUser = useAuthStore.getState().user;
      if (currentUser && (!userId || currentUser.id === userId)) {
        // Panggil logout store untuk membersihkan token & state
        useAuthStore.getState().logout();
        // Tampilkan pesan toast di halaman login
        try {
          useToastStore.getState().addToast({
            type: 'error',
            title: '🔒 Sesi Dinonaktifkan',
            message: reason || 'Akun Anda telah dinonaktifkan. Silakan hubungi manager.',
            duration: 8000,
          });
        } catch {}
      }
    };

    if (socket) {
      socket.on('user:force_logout', handleForceLogout);
    }
    const handleCustomForceLogout = (e) => {
      handleForceLogout(e.detail || {});
    };
    window.addEventListener('auth:force_logout', handleCustomForceLogout);

    return () => {
      if (socket) socket.off('user:force_logout', handleForceLogout);
      window.removeEventListener('auth:force_logout', handleCustomForceLogout);
    };
  }, []);
  // ────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    // Validate stored auth token on every app load.
    initAuth();
    fetchSettings();
    NotificationService.init();

    // Verifikasi profil dan status keaktifan user di database secara proaktif
    if (useAuthStore.getState().isAuthenticated) {
      useAuthStore.getState().refreshProfile?.();
    }

    // Auto-reconnect to last connected Bluetooth printer on app launch
    usePrinterStore.getState().autoConnectPrinter(true);

    // Auto-reconnect & sinkronisasi status akun saat aplikasi kembali aktif dari background
    const handleResume = () => {
      if (document.visibilityState === 'visible') {
        usePrinterStore.getState().autoConnectPrinter(true);
        if (useAuthStore.getState().isAuthenticated) {
          useAuthStore.getState().refreshProfile?.();
        }
      }
    };

    document.addEventListener('visibilitychange', handleResume);
    window.addEventListener('focus', handleResume);

    return () => {
      document.removeEventListener('visibilitychange', handleResume);
      window.removeEventListener('focus', handleResume);
    };
  }, [initAuth, fetchSettings]);

  useEffect(() => {
    if (isAuthenticated) {
      initOrdersSocketSync?.();
      initCustomersSocketSync?.();
      initShiftSocketSync?.();
      usePosStore.getState().fetchCategories();
      usePosStore.getState().fetchProducts();
      useOrdersStore.getState().fetchOrders().then(() => {
        useCartStore.getState().syncOpenBillsWithBackendOrders?.();
      });
      useCustomerStore.getState().fetchCustomers?.({ silent: true });
      useWorkspaceStore.getState().fetchWorkspaceData?.();
      useShiftStore.getState().fetchActiveShift?.();
      useNotificationStore.getState().fetchUnreadCount?.();
      NotificationService.syncPushTokenWithBackend?.().catch(() => {});
    }
  }, [isAuthenticated]);

  return (
    <BrowserRouter>
      <Routes>
        {/* Public Login Route */}
        <Route
          path="/login"
          element={
            <Suspense fallback={<PageFallbackSkeleton />}>
              <LoginPage />
            </Suspense>
          }
        />

        {/* Public Reset Password Route */}
        <Route
          path="/reset-password"
          element={
            <Suspense fallback={<PageFallbackSkeleton />}>
              <ResetPasswordPage />
            </Suspense>
          }
        />

        {/* Dedicated Public Download & Comprehensive User Guide Route */}
        <Route
          path="/download"
          element={
            <Suspense fallback={<PageFallbackSkeleton />}>
              <DownloadPage />
            </Suspense>
          }
        />
        <Route path="/unduh" element={<Navigate to="/download" replace />} />
        <Route path="/apk" element={<Navigate to="/download" replace />} />
        <Route path="/panduan" element={<Navigate to="/download" replace />} />

        {/* Dedicated Standalone KDS Screen (No Sidebar, No Navbar - Dedicated for Kitchen/Bar Display) */}
        <Route
          path="/kds-screen"
          element={
            <ProtectedRoute allowedRoles={['KITCHEN', 'BARISTA', 'MANAGER', 'OWNER']}>
              <Suspense fallback={<PageFallbackSkeleton />}>
                <KdsStandaloneScreen />
              </Suspense>
            </ProtectedRoute>
          }
        />

        {/* Public F&B Landing Page (Bypass ke POS jika diinstal di aplikasi) */}
        <Route path="/" element={<RootRoute />} />

        {/* Marketing CMS Studio (Khusus Peran OWNER & MANAGER pada Web Browser) */}
        <Route
          path="/cms"
          element={
            <ProtectedRoute allowedRoles={['OWNER', 'MANAGER']}>
              <CmsRouteGuard>
                <Suspense fallback={<PageFallbackSkeleton />}>
                  <CmsLayout />
                </Suspense>
              </CmsRouteGuard>
            </ProtectedRoute>
          }
        >
          <Route index element={<CmsOverviewPage />} />
          <Route path="hero" element={<CmsHeroPage />} />
          <Route path="menu-spotlight" element={<CmsMenuSpotlightPage />} />
          <Route path="promos" element={<CmsPromosPage />} />
          <Route path="facilities" element={<CmsFacilitiesPage />} />
          <Route path="testimonials" element={<CmsTestimonialsPage />} />
          <Route path="outlet" element={<CmsOutletPage />} />
          <Route path="seo" element={<CmsSeoPage />} />
        </Route>

        {/* Protected App Routes inside POS Layout */}
        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >

          {/* POS Kasir (Staff Dapur/KITCHEN DILARANG akses) */}
          <Route
            path="pos"
            element={
              <ProtectedRoute allowedRoles={['OWNER', 'MANAGER', 'CASHIER']}>
                <PosPage />
              </ProtectedRoute>
            }
          />

          {/* Workspace Module - Disabled */}
          <Route path="workspace" element={<Navigate to="/pos" replace />} />

          {/* Kas Kasir (Peti Kas & Cash Drawer) */}
          <Route
            path="cash-drawer"
            element={
              <ProtectedRoute allowedRoles={['OWNER', 'MANAGER', 'CASHIER']}>
                <CashDrawerPage />
              </ProtectedRoute>
            }
          />
          <Route path="pos/cash" element={<Navigate to="/cash-drawer" replace />} />

          {/* Sesi Kas Terbuka (Shift Kasir) */}
          <Route
            path="cash-session"
            element={
              <ProtectedRoute allowedRoles={['OWNER', 'MANAGER', 'CASHIER']}>
                <CashSessionPage />
              </ProtectedRoute>
            }
          />
          <Route path="pos/shift" element={<Navigate to="/cash-session" replace />} />

          {/* Refund (Pengembalian Dana & Retur Transaksi) */}
          <Route
            path="refunds"
            element={
              <ProtectedRoute allowedRoles={['OWNER', 'MANAGER', 'CASHIER']}>
                <RefundsPage />
              </ProtectedRoute>
            }
          />

          {/* Orders History (Staff Dapur DILARANG akses) */}
          <Route
            path="orders"
            element={
              <ProtectedRoute allowedRoles={['OWNER', 'MANAGER', 'CASHIER']}>
                <OrdersPage />
              </ProtectedRoute>
            }
          />

          {/* Kitchen Display System (Khusus Dapur, Barista, Manager, & Owner) */}
          <Route
            path="kds"
            element={
              <ProtectedRoute allowedRoles={['KITCHEN', 'BARISTA', 'MANAGER', 'OWNER']}>
                <KdsPage />
              </ProtectedRoute>
            }
          />

          {/* Customers & Member Loyalty (Staff Dapur DILARANG akses) */}
          <Route
            path="customers"
            element={
              <ProtectedRoute allowedRoles={['OWNER', 'MANAGER', 'CASHIER']}>
                <CustomersPage />
              </ProtectedRoute>
            }
          />

          {/* Menu & Catalog (Manager+) */}
          <Route
            path="menu"
            element={
              <ProtectedRoute allowedRoles={['MANAGER', 'OWNER']}>
                <MenuPage />
              </ProtectedRoute>
            }
          />

          {/* Kategori Menu (Manager+) */}
          <Route
            path="categories"
            element={
              <ProtectedRoute allowedRoles={['MANAGER', 'OWNER']}>
                <CategoriesPage />
              </ProtectedRoute>
            }
          />

          {/* Manajemen Promo & Diskon (Manager+) */}
          <Route
            path="promos"
            element={
              <ProtectedRoute allowedRoles={['MANAGER', 'OWNER']}>
                <PromosPage />
              </ProtectedRoute>
            }
          />

          {/* Inventaris & Logistik (Manager+) */}
          <Route
            path="inventory/suppliers"
            element={
              <ProtectedRoute allowedRoles={['MANAGER', 'OWNER']}>
                <SuppliersPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="inventory/inbound"
            element={
              <ProtectedRoute allowedRoles={['MANAGER', 'OWNER']}>
                <InboundStockPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="inventory/sources"
            element={
              <ProtectedRoute allowedRoles={['MANAGER', 'OWNER']}>
                <StockPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="inventory/opname"
            element={
              <ProtectedRoute allowedRoles={['MANAGER', 'OWNER']}>
                <StockOpnamePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="inventory/assets"
            element={
              <ProtectedRoute allowedRoles={['MANAGER', 'OWNER']}>
                <AssetsPage />
              </ProtectedRoute>
            }
          />

          {/* Manajemen Keuangan (Manager & Owner) */}
          <Route
            path="finance/expenses"
            element={
              <ProtectedRoute allowedRoles={['MANAGER', 'OWNER']}>
                <ExpensesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="finance/depreciation"
            element={
              <ProtectedRoute allowedRoles={['MANAGER', 'OWNER']}>
                <DepreciationPage />
              </ProtectedRoute>
            }
          />
          <Route path="finance/assets" element={<Navigate to="/inventory/assets" replace />} />
          <Route path="finance" element={<Navigate to="/finance/expenses" replace />} />
          {/* Backwards compatibility untuk /stock */}
          <Route path="stock" element={<Navigate to="/inventory/sources" replace />} />

          {/* Reports & Analytics (Manager+) */}
          <Route path="analytics" element={<Navigate to="/reports/sales" replace />} />
          <Route path="analytics/sales" element={<Navigate to="/reports/sales" replace />} />
          <Route path="reports" element={<Navigate to="/reports/sales" replace />} />
          <Route
            path="reports/sales"
            element={
              <ProtectedRoute allowedRoles={['MANAGER', 'OWNER']}>
                <ReportsPage tab="SALES" />
              </ProtectedRoute>
            }
          />
          <Route
            path="reports/products"
            element={
              <ProtectedRoute allowedRoles={['MANAGER', 'OWNER']}>
                <ReportsPage tab="PRODUCTS" />
              </ProtectedRoute>
            }
          />
          <Route
            path="reports/categories"
            element={
              <ProtectedRoute allowedRoles={['MANAGER', 'OWNER']}>
                <ReportsPage tab="CATEGORIES" />
              </ProtectedRoute>
            }
          />
          <Route
            path="reports/customers"
            element={
              <ProtectedRoute allowedRoles={['MANAGER', 'OWNER']}>
                <ReportsPage tab="CUSTOMERS" />
              </ProtectedRoute>
            }
          />
          <Route
            path="reports/order-types"
            element={
              <ProtectedRoute allowedRoles={['MANAGER', 'OWNER']}>
                <ReportsPage tab="ORDER_TYPES" />
              </ProtectedRoute>
            }
          />
          <Route
            path="reports/payments"
            element={
              <ProtectedRoute allowedRoles={['MANAGER', 'OWNER']}>
                <ReportsPage tab="PAYMENTS" />
              </ProtectedRoute>
            }
          />
          <Route
            path="reports/taxes"
            element={
              <ProtectedRoute allowedRoles={['MANAGER', 'OWNER']}>
                <ReportsPage tab="TAXES" />
              </ProtectedRoute>
            }
          />
          <Route
            path="reports/discounts"
            element={
              <ProtectedRoute allowedRoles={['MANAGER', 'OWNER']}>
                <ReportsPage tab="DISCOUNTS" />
              </ProtectedRoute>
            }
          />
          <Route
            path="reports/staff"
            element={
              <ProtectedRoute allowedRoles={['MANAGER', 'OWNER']}>
                <ReportsPage tab="STAFF" />
              </ProtectedRoute>
            }
          />
          <Route
            path="reports/cash-drawer"
            element={
              <ProtectedRoute allowedRoles={['MANAGER', 'OWNER']}>
                <ReportsPage tab="CASH_DRAWER" />
              </ProtectedRoute>
            }
          />
          <Route
            path="reports/cogs"
            element={
              <ProtectedRoute allowedRoles={['MANAGER', 'OWNER']}>
                <ReportsPage tab="COGS" />
              </ProtectedRoute>
            }
          />
          <Route
            path="reports/profit-loss"
            element={
              <ProtectedRoute allowedRoles={['MANAGER', 'OWNER']}>
                <ReportsPage tab="PROFIT_LOSS" />
              </ProtectedRoute>
            }
          />

          {/* Riwayat Sesi Kasir */}
          <Route
            path="shift-history"
            element={
              <ProtectedRoute allowedRoles={['OWNER', 'MANAGER']}>
                <ShiftHistoryPage />
              </ProtectedRoute>
            }
          />

          {/* HRIS - Human Resource Information System */}
          <Route
            path="hris"
            element={
              <ProtectedRoute allowedRoles={['OWNER', 'MANAGER', 'CASHIER', 'BARISTA', 'KITCHEN']}>
                <HrisPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="hris/:tab"
            element={
              <ProtectedRoute allowedRoles={['OWNER', 'MANAGER', 'CASHIER', 'BARISTA', 'KITCHEN']}>
                <HrisPage />
              </ProtectedRoute>
            }
          />

          {/* Settings (Owner only) */}
          <Route
            path="settings"
            element={
              <ProtectedRoute allowedRoles={['OWNER']}>
                <SettingsPage />
              </ProtectedRoute>
            }
          />
          {/* Database Backup & Recovery (Owner only shortcut) */}
          <Route path="backup" element={<Navigate to="/settings?tab=backup" replace />} />

          {/* Printer Kasir & Hardware Management */}
          <Route
            path="printer"
            element={
              <ProtectedRoute allowedRoles={['OWNER', 'MANAGER']}>
                <PrinterRoute />
              </ProtectedRoute>
            }
          />
          <Route path="printers" element={<Navigate to="/printer" replace />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<IndexRedirect />} />
      </Routes>

      {/* Splash Screen Animasi (Hanya muncul pada aplikasi Android) */}
      {showSplash && (
        <AnimatedSplashScreen
          duration={1800}
          onFinish={() => setShowSplash(false)}
        />
      )}

      {/* Global Toast Notification Container */}
      <ToastContainer />
    </BrowserRouter>
  );
}
