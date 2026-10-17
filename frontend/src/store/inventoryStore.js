import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useInventoryStore = create(
  persist(
    (set, get) => ({
      // 1. DATA PEMASOK (SUPPLIERS)
      suppliers: [
        {
          id: 1,
          code: 'SUP-001',
          name: 'PT Kopi Sangrai Nusantara',
          category: 'Biji Kopi (Coffee Beans)',
          contactPerson: 'Budi Santoso',
          phone: '0812-3456-7890',
          email: 'order@kopinusantara.id',
          address: 'Jl. Industri Kopi No. 12, Bandung',
          status: 'ACTIVE', // ACTIVE, INACTIVE
          createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
        },
        {
          id: 2,
          code: 'SUP-002',
          name: 'CV Susu Segar Sejahtera',
          category: 'Dairy & Susu Segar',
          contactPerson: 'Siti Rahma',
          phone: '0813-9876-5432',
          email: 'sales@sususegar.co.id',
          address: 'Kawasan Agro Boyolali, Jawa Tengah',
          status: 'ACTIVE',
          createdAt: new Date(Date.now() - 25 * 86400000).toISOString(),
        },
        {
          id: 3,
          code: 'SUP-003',
          name: 'UD Sirup & Flavour Tropika',
          category: 'Sirup, Saus & Bubuk',
          contactPerson: 'Hendro Wijaya',
          phone: '0857-1122-3344',
          email: 'hendro@tropikasyrup.com',
          address: 'Ruko Sentra Niaga Blok B3, Jakarta Barat',
          status: 'ACTIVE',
          createdAt: new Date(Date.now() - 20 * 86400000).toISOString(),
        },
        {
          id: 4,
          code: 'SUP-004',
          name: 'PT Kemasan Paper Pratama',
          category: 'Kemasan & Cup Takeaway',
          contactPerson: 'Dewi Lestari',
          phone: '0878-5544-3322',
          email: 'dewi@kemasanpratama.id',
          address: 'Kawasan Industri Cikarang, Bekasi',
          status: 'ACTIVE',
          createdAt: new Date(Date.now() - 15 * 86400000).toISOString(),
        },
      ],

      addSupplier: (data) => {
        const current = get().suppliers;
        const newId = current.length > 0 ? Math.max(...current.map((s) => s.id)) + 1 : 1;
        const code = `SUP-${String(newId).padStart(3, '0')}`;
        const newSupplier = {
          id: newId,
          code,
          name: data.name.trim(),
          category: data.category?.trim() || 'Umum',
          contactPerson: data.contactPerson?.trim() || '-',
          phone: data.phone?.trim() || '-',
          email: data.email?.trim() || '-',
          address: data.address?.trim() || '-',
          status: data.status || 'ACTIVE',
          createdAt: new Date().toISOString(),
        };
        set((state) => ({ suppliers: [newSupplier, ...state.suppliers] }));
        return newSupplier;
      },

      updateSupplier: (id, data) => {
        set((state) => ({
          suppliers: state.suppliers.map((s) => (s.id === id ? { ...s, ...data } : s)),
        }));
      },

      deleteSupplier: (id) => {
        set((state) => ({
          suppliers: state.suppliers.filter((s) => s.id !== id),
        }));
      },

      bulkDeleteSuppliers: (ids) => {
        set((state) => ({
          suppliers: state.suppliers.filter((s) => !ids.includes(s.id)),
        }));
      },

      // 2. DATA STOK MASUK (INBOUND SHIPMENTS / PO)
      inboundRecords: [
        {
          id: 1,
          inboundNumber: 'INB-202610-001',
          supplierId: 1,
          supplierName: 'PT Kopi Sangrai Nusantara',
          date: new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0],
          receivedBy: 'Manager',
          totalAmount: 1850000,
          status: 'COMPLETED', // COMPLETED, PENDING, CANCELLED
          notes: 'Pengiriman batch biji espresso blend 10kg',
          items: [
            { name: 'House Blend Arabica 1kg', qty: 10, unit: 'kg', unitCost: 185000, subtotal: 1850000 },
          ],
        },
        {
          id: 2,
          inboundNumber: 'INB-202610-002',
          supplierId: 2,
          supplierName: 'CV Susu Segar Sejahtera',
          date: new Date(Date.now() - 1 * 86400000).toISOString().split('T')[0],
          receivedBy: 'Barista Lead',
          totalAmount: 960000,
          status: 'COMPLETED',
          notes: 'Restock fresh milk mingguan',
          items: [
            { name: 'Fresh Milk Pasteurisasi 1L', qty: 40, unit: 'liter', unitCost: 24000, subtotal: 960000 },
          ],
        },
      ],

      addInboundRecord: (record) => {
        const current = get().inboundRecords;
        const newId = current.length > 0 ? Math.max(...current.map((r) => r.id)) + 1 : 1;
        const todayStr = new Date().toISOString().slice(0, 7).replace('-', '');
        const inboundNumber = `INB-${todayStr}-${String(newId).padStart(3, '0')}`;
        const newRecord = {
          id: newId,
          inboundNumber,
          ...record,
          date: record.date || new Date().toISOString().split('T')[0],
          status: record.status || 'COMPLETED',
        };
        set((state) => ({ inboundRecords: [newRecord, ...state.inboundRecords] }));
        return newRecord;
      },

      deleteInboundRecord: (id) => {
        set((state) => ({
          inboundRecords: state.inboundRecords.filter((r) => r.id !== id),
        }));
      },

      bulkDeleteInboundRecords: (ids) => {
        set((state) => ({
          inboundRecords: state.inboundRecords.filter((r) => !ids.includes(r.id)),
        }));
      },

      // 3. DATA STOK OPNAME (AUDIT FISIK)
      opnameSessions: [
        {
          id: 1,
          opnameNumber: 'OPN-202610-01',
          date: new Date(Date.now() - 5 * 86400000).toISOString().split('T')[0],
          auditor: 'Manager',
          totalItemsChecked: 14,
          varianceCount: 2,
          status: 'APPROVED', // DRAFT, IN_PROGRESS, APPROVED
          appliedToStock: true,
          notes: 'Audit mingguan stok bar & syrup',
          items: [
            {
              ingredientId: 1,
              name: 'Espresso Roast Beans (House Blend)',
              unit: 'gram',
              systemStock: 5000,
              physicalStock: 4850,
              variance: -150,
              notes: 'Penyusutan kalibrasi & grinder purge',
            },
            {
              ingredientId: 2,
              name: 'Fresh Milk Pasteurisasi',
              unit: 'ml',
              systemStock: 12000,
              physicalStock: 12000,
              variance: 0,
              notes: 'Sesuai dengan pencatatan',
            },
            {
              ingredientId: 3,
              name: 'Vanilla Syrup Monin 700ml',
              unit: 'ml',
              systemStock: 1400,
              physicalStock: 1250,
              variance: -150,
              notes: 'Tetesan tumpah di bar',
            },
            {
              ingredientId: 4,
              name: 'Caramel Sauce Drizzle',
              unit: 'ml',
              systemStock: 800,
              physicalStock: 800,
              variance: 0,
              notes: 'Sesuai fisik',
            },
            {
              ingredientId: 5,
              name: 'Cup PET 16oz + Lid Dome',
              unit: 'pcs',
              systemStock: 350,
              physicalStock: 350,
              variance: 0,
              notes: 'Cocok',
            },
          ],
        },
      ],

      addOpnameSession: (session) => {
        const current = get().opnameSessions;
        const newId = current.length > 0 ? Math.max(...current.map((s) => s.id)) + 1 : 1;
        const todayStr = new Date().toISOString().slice(0, 7).replace('-', '');
        const opnameNumber = session.opnameNumber || `OPN-${todayStr}-${String(newId).padStart(2, '0')}`;
        
        const items = session.items || [];
        const totalItemsChecked = items.length > 0 ? items.length : (session.totalItemsChecked || 0);
        const varianceCount = items.length > 0
          ? items.filter((i) => Math.abs(Number(i.variance) || 0) > 0.0001).length
          : (session.varianceCount || 0);

        const newSession = {
          id: newId,
          opnameNumber,
          date: session.date || new Date().toISOString().split('T')[0],
          auditor: session.auditor || 'Staff',
          totalItemsChecked,
          varianceCount,
          status: session.status || 'APPROVED',
          appliedToStock: session.appliedToStock ?? true,
          notes: session.notes || '',
          items,
          createdAt: new Date().toISOString(),
        };

        set((state) => ({ opnameSessions: [newSession, ...state.opnameSessions] }));
        return newSession;
      },

      deleteOpnameSession: (id) => {
        set((state) => ({
          opnameSessions: state.opnameSessions.filter((s) => s.id !== id),
        }));
      },

      bulkDeleteOpnameSessions: (ids) => {
        set((state) => ({
          opnameSessions: state.opnameSessions.filter((s) => !ids.includes(s.id)),
        }));
      },

      updateOpnameSession: (id, data) => {
        set((state) => ({
          opnameSessions: state.opnameSessions.map((s) => (s.id === id ? { ...s, ...data } : s)),
        }));
      },

      // 4. DATA ASET & PERALATAN (ASSETS)
      assets: [
        {
          id: 1,
          code: 'AST-BAR-001',
          name: 'Mesin Espresso La Marzocco Linea PB 2-Group',
          category: 'Peralatan Bar & Kopi',
          location: 'Station Barista',
          purchaseDate: '2024-03-15',
          purchasePrice: 145000000,
          condition: 'EXCELLENT', // EXCELLENT, GOOD, MAINTENANCE, BROKEN
          lastMaintenance: '2026-09-10',
          serialNumber: 'LM-PB-2G-98213',
        },
        {
          id: 2,
          code: 'AST-BAR-002',
          name: 'Grinder Espresso Mazzer Major V Electronic',
          category: 'Peralatan Bar & Kopi',
          location: 'Station Barista',
          purchaseDate: '2024-03-15',
          purchasePrice: 28500000,
          condition: 'EXCELLENT',
          lastMaintenance: '2026-09-10',
          serialNumber: 'MZ-MJ-44120',
        },
        {
          id: 3,
          code: 'AST-KIT-001',
          name: 'Under-Counter Chiller 2-Door Gea S/S',
          category: 'Pendingin & Kitchen',
          location: 'Dapur Utama',
          purchaseDate: '2024-04-01',
          purchasePrice: 18500000,
          condition: 'GOOD',
          lastMaintenance: '2026-08-20',
          serialNumber: 'GEA-UC-99321',
        },
        {
          id: 4,
          code: 'AST-POS-001',
          name: 'iPad Pro 11" M2 + WindFall Metal POS Stand',
          category: 'Hardware Kasir',
          location: 'Kasir Front Office',
          purchaseDate: '2024-02-10',
          purchasePrice: 17200000,
          condition: 'EXCELLENT',
          lastMaintenance: '2026-10-01',
          serialNumber: 'APL-IPD-88741',
        },
      ],

      addAsset: (asset) => {
        const current = get().assets;
        const newId = current.length > 0 ? Math.max(...current.map((a) => a.id)) + 1 : 1;
        const code = `AST-${String(newId).padStart(3, '0')}`;
        const newAsset = {
          id: newId,
          code: asset.code || code,
          ...asset,
        };
        set((state) => ({ assets: [newAsset, ...state.assets] }));
        return newAsset;
      },

      updateAsset: (id, data) => {
        set((state) => ({
          assets: state.assets.map((a) => (a.id === id ? { ...a, ...data } : a)),
        }));
      },

      deleteAsset: (id) => {
        set((state) => ({
          assets: state.assets.filter((a) => a.id !== id),
        }));
      },
    }),
    {
      name: 'komazi-inventory-store',
    }
  )
);
