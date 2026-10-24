import React, { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import TopLoadingBar from '../ui/loading/TopLoadingBar';
import ActionOverlayModal from '../ui/loading/ActionOverlayModal';
import PageFallbackSkeleton from '../ui/loading/skeletons/PageFallbackSkeleton';
import { useUiStore } from '../../store/uiStore';

const BluetoothModal = React.lazy(() => import('../pos/BluetoothModal'));
const UsbModal = React.lazy(() => import('../pos/UsbModal'));

export default function Layout() {
  const {
    isBluetoothModalOpen,
    closeBluetoothModal,
    isUsbModalOpen,
    closeUsbModal,
    globalOverlay,
    hideActionOverlay,
  } = useUiStore();

  return (
    <div className="flex flex-col h-[100dvh] min-h-[100dvh] w-screen overflow-hidden bg-komazi-black text-komazi-text">
      {/* Top Global Progress Bar */}
      <TopLoadingBar />

      {/* Top Navbar */}
      <Navbar />

      {/* Main Body Area: Sidebar + Content */}
      <div className="flex flex-1 overflow-hidden relative">
        <Sidebar />
        <main className="flex-1 overflow-y-auto bg-komazi-black relative">
          <Suspense fallback={<PageFallbackSkeleton />}>
            <Outlet />
          </Suspense>
        </main>
      </div>


      {/* Global Bluetooth Connection Modal (Single Instance - Anti Double UI) */}
      {isBluetoothModalOpen && (
        <Suspense fallback={null}>
          <BluetoothModal onClose={closeBluetoothModal} />
        </Suspense>
      )}

      {/* Global USB Connection Modal (Single Instance - Anti Double UI) */}
      {isUsbModalOpen && (
        <Suspense fallback={null}>
          <UsbModal onClose={closeUsbModal} />
        </Suspense>
      )}

      {/* Global Critical Action Overlay Modal */}
      <ActionOverlayModal
        isOpen={globalOverlay.isOpen}
        title={globalOverlay.title}
        message={globalOverlay.message}
        step={globalOverlay.step}
        totalSteps={globalOverlay.totalSteps}
        steps={globalOverlay.steps}
        onCancel={hideActionOverlay}
      />
    </div>
  );
}
