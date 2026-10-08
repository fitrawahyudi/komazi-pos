import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import BluetoothModal from '../pos/BluetoothModal';
import { useUiStore } from '../../store/uiStore';

export default function Layout() {
  const { isBluetoothModalOpen, closeBluetoothModal } = useUiStore();

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-komazi-black text-komazi-text">
      {/* Top Navbar */}
      <Navbar />

      {/* Main Body Area: Sidebar + Content */}
      <div className="flex flex-1 overflow-hidden relative">
        <Sidebar />
        <main className="flex-1 overflow-y-auto bg-komazi-black relative">
          <Outlet />
        </main>
      </div>

      {/* Global Bluetooth Connection Modal (Single Instance - Anti Double UI) */}
      {isBluetoothModalOpen && <BluetoothModal onClose={closeBluetoothModal} />}
    </div>
  );
}
