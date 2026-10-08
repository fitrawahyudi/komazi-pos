import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/layout/Layout';
import PosPage from './pages/PosPage';
import WorkspacePage from './pages/WorkspacePage';
import OrdersPage from './pages/OrdersPage';
import MenuPage from './pages/MenuPage';
import StockPage from './pages/StockPage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';
import LoginPage from './pages/LoginPage';
import KdsPage from './pages/KdsPage';
import KdsStandaloneScreen from './pages/KdsStandaloneScreen';
import CustomersPage from './pages/CustomersPage';
import ToastContainer from './components/ui/ToastContainer';
import { useAuthStore } from './store/authStore';
import { useSettingsStore } from './store/settingsStore';
import { usePosStore } from './store/posStore';
import { useOrdersStore } from './store/ordersStore';
import { useStockStore } from './store/stockStore';
import { useWorkspaceStore } from './store/workspaceStore';
import { usePrinterStore } from './store/printerStore';
import { useShiftStore } from './store/shiftStore';
import { useCartStore } from './store/cartStore';

// Index Redirect Component
function IndexRedirect() {
  const { user } = useAuthStore();
  if (user?.role === 'KITCHEN' || user?.role === 'BARISTA') {
    return <Navigate to="/kds-screen" replace />;
  }
  return <Navigate to="/pos" replace />;
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

export default function App() {
  const { fetchSettings } = useSettingsStore();
  const { initAuth, isAuthenticated } = useAuthStore();

  useEffect(() => {
    // Validate stored auth token on every app load.
    initAuth();
    fetchSettings();

    // Auto-reconnect to last connected Bluetooth printer on app launch
    usePrinterStore.getState().autoConnectPrinter(true);

    // Auto-reconnect when app is resumed from recent apps / background
    const handleResume = () => {
      if (document.visibilityState === 'visible') {
        usePrinterStore.getState().autoConnectPrinter(true);
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
      usePosStore.getState().fetchCategories();
      usePosStore.getState().fetchProducts();
      useOrdersStore.getState().fetchOrders().then(() => {
        useCartStore.getState().syncOpenBillsWithBackendOrders?.();
      });
      useStockStore.getState().fetchIngredients();
      useWorkspaceStore.getState().fetchWorkspaceData?.();
      useShiftStore.getState().fetchActiveShift?.();
      useShiftStore.getState().fetchShiftHistory?.();
    }
  }, [isAuthenticated]);

  return (
    <BrowserRouter>
      <Routes>
        {/* Public Login Route */}
        <Route path="/login" element={<LoginPage />} />

        {/* Dedicated Standalone KDS Screen (No Sidebar, No Navbar - Dedicated for Kitchen/Bar Display) */}
        <Route
          path="/kds-screen"
          element={
            <ProtectedRoute>
              <KdsStandaloneScreen />
            </ProtectedRoute>
          }
        />

        {/* Protected App Routes inside Layout */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          {/* Index redirect */}
          <Route index element={<IndexRedirect />} />

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

          {/* Orders History (Staff Dapur DILARANG akses) */}
          <Route
            path="orders"
            element={
              <ProtectedRoute allowedRoles={['OWNER', 'MANAGER', 'CASHIER']}>
                <OrdersPage />
              </ProtectedRoute>
            }
          />

          {/* Kitchen Display System (Barista & Dapur) */}
          <Route path="kds" element={<KdsPage />} />

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

          {/* Stock & Inventory (Manager+) */}
          <Route
            path="stock"
            element={
              <ProtectedRoute allowedRoles={['MANAGER', 'OWNER']}>
                <StockPage />
              </ProtectedRoute>
            }
          />

          {/* Reports & Analytics (Manager+) */}
          <Route
            path="reports"
            element={
              <ProtectedRoute allowedRoles={['MANAGER', 'OWNER']}>
                <ReportsPage />
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

          {/* Printer Kasir & Hardware (Redirect ke Pengaturan Usaha tab Printer) */}
          <Route
            path="printer"
            element={<Navigate to="/settings?tab=printer" replace />}
          />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<IndexRedirect />} />
      </Routes>

      {/* Global Toast Notification Container */}
      <ToastContainer />
    </BrowserRouter>
  );
}
