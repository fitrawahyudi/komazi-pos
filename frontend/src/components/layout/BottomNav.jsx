import React from 'react';
import { NavLink } from 'react-router-dom';
import { useCartStore } from '../../store/cartStore';
import { useUiStore } from '../../store/uiStore';
import { Store, Laptop, Receipt, Menu, ShoppingBag } from 'lucide-react';

export default function BottomNav() {
  const { items } = useCartStore();
  const { toggleMobileSidebar } = useUiStore();
  const totalItems = items.reduce((sum, i) => sum + i.qty, 0);

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-komazi-surface/95 backdrop-blur-md border-t border-komazi-border px-3 py-1.5 flex items-center justify-around select-none">
      <NavLink
        to="/pos"
        className={({ isActive }) =>
          `flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all relative ${
            isActive
              ? 'text-komazi-coral font-bold'
              : 'text-komazi-muted hover:text-komazi-text'
          }`
        }
      >
        <div className="relative">
          <Store className="w-5 h-5" />
          {totalItems > 0 && (
            <span className="absolute -top-1.5 -right-2.5 w-4 h-4 rounded-full bg-komazi-coral text-white text-[9px] font-black flex items-center justify-center">
              {totalItems}
            </span>
          )}
        </div>
        <span className="text-[10px] mt-0.5">Kasir</span>
      </NavLink>

      <NavLink
        to="/orders"
        className={({ isActive }) =>
          `flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all ${
            isActive
              ? 'text-komazi-coral font-bold'
              : 'text-komazi-muted hover:text-komazi-text'
          }`
        }
      >
        <Receipt className="w-5 h-5" />
        <span className="text-[10px] mt-0.5">Pesanan</span>
      </NavLink>

      <button
        type="button"
        onClick={toggleMobileSidebar}
        className="flex flex-col items-center justify-center py-1 px-3 rounded-xl text-komazi-muted hover:text-komazi-text transition-all"
      >
        <Menu className="w-5 h-5" />
        <span className="text-[10px] mt-0.5">Menu Lain</span>
      </button>
    </nav>
  );
}
