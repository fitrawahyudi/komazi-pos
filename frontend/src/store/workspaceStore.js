import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../services/api';

export const useWorkspaceStore = create(
  persist(
    (set, get) => ({
      areas: [],
      packages: [],
      sessions: [],
      historySessions: [],
      isLoading: false,

      fetchWorkspaceData: async () => {
        try {
          set({ isLoading: true });
          const [areasRes, packagesRes, sessionsRes] = await Promise.all([
            api.workspace.getAreas(),
            api.workspace.getPackages(),
            api.workspace.getActiveSessions(),
          ]);

          const updates = {};
          if (areasRes && areasRes.success && Array.isArray(areasRes.data)) {
            updates.areas = areasRes.data;
          }
          if (packagesRes && packagesRes.success && Array.isArray(packagesRes.data)) {
            updates.packages = packagesRes.data.map((p) => ({
              ...p,
              price: Number(p.price) || 0,
              overtimePerHr: Number(p.overtimePerHr) || 0,
            }));
          }
          if (sessionsRes && sessionsRes.success && Array.isArray(sessionsRes.data)) {
            updates.sessions = sessionsRes.data.map((s) => ({
              ...s,
              areaName: s.areaName || s.area?.name || '',
              packageName: s.packageName || s.package?.name || '',
              packagePrice: s.packagePrice !== undefined ? Number(s.packagePrice) : (Number(s.package?.price) || 0),
              overtimePerHr: s.overtimePerHr !== undefined ? Number(s.overtimePerHr) : (Number(s.package?.overtimePerHr) || 0),
              targetDurationMin: s.targetDurationMin || s.package?.durationMin || 60,
            }));
          }

          set({ ...updates, isLoading: false });
        } catch (err) {
          console.error('[WorkspaceStore] Error fetching workspace data:', err);
          set({ isLoading: false });
        }
      },

      // Area CRUD
      addArea: async (area) => {
        try {
          const res = await api.workspace.createArea(area);
          if (res && res.success && res.data) {
            set((state) => ({ areas: [...state.areas, res.data] }));
            return res.data;
          }
        } catch (err) {
          console.warn('[WorkspaceStore] addArea API error:', err);
        }
        const newArea = { ...area, id: Date.now() };
        set((state) => ({ areas: [...state.areas, newArea] }));
        return newArea;
      },

      updateArea: async (id, data) => {
        set((state) => ({
          areas: state.areas.map((a) => (a.id === id ? { ...a, ...data } : a)),
        }));
        try {
          await api.workspace.updateArea(id, data);
        } catch (err) {
          console.warn('[WorkspaceStore] updateArea API error:', err);
        }
      },

      deleteArea: async (id) => {
        try {
          await api.workspace.deleteArea(id);
          set((state) => ({
            areas: state.areas.filter((a) => a.id !== id),
          }));
          return { success: true };
        } catch (err) {
          console.warn('[WorkspaceStore] deleteArea API error:', err);
          return { success: false, message: err.message };
        }
      },

      // Package CRUD
      addPackage: async (pkg) => {
        try {
          const res = await api.workspace.createPackage(pkg);
          if (res && res.success && res.data) {
            const formatted = {
              ...res.data,
              price: Number(res.data.price) || 0,
              overtimePerHr: Number(res.data.overtimePerHr) || 0,
            };
            set((state) => ({ packages: [...state.packages, formatted] }));
            return formatted;
          }
        } catch (err) {
          console.warn('[WorkspaceStore] addPackage API error:', err);
        }
        const newPackage = { ...pkg, id: Date.now() };
        set((state) => ({ packages: [...state.packages, newPackage] }));
        return newPackage;
      },

      updatePackage: async (id, data) => {
        set((state) => ({
          packages: state.packages.map((p) => (p.id === id ? { ...p, ...data } : p)),
        }));
        try {
          await api.workspace.updatePackage(id, data);
        } catch (err) {
          console.warn('[WorkspaceStore] updatePackage API error:', err);
        }
      },

      deletePackage: async (id) => {
        try {
          await api.workspace.deletePackage(id);
          set((state) => ({
            packages: state.packages.filter((p) => p.id !== id),
          }));
          return { success: true };
        } catch (err) {
          console.warn('[WorkspaceStore] deletePackage API error:', err);
          return { success: false, message: err.message };
        }
      },

      // Check-in
      checkIn: async ({ areaId, packageId, customerName, phone }) => {
        const area = get().areas.find((a) => a.id === areaId);
        const pkg = get().packages.find((p) => p.id === packageId);
        if (!area || !pkg) return null;

        try {
          const res = await api.workspace.checkIn({ areaId, packageId, customerName, phone });
          if (res && res.success && res.data) {
            const serverSession = {
              ...res.data,
              areaName: res.data.areaName || res.data.area?.name || area.name,
              packageName: res.data.packageName || res.data.package?.name || pkg.name,
              packagePrice: res.data.packagePrice !== undefined ? Number(res.data.packagePrice) : (Number(res.data.package?.price) || Number(pkg.price)),
              overtimePerHr: res.data.overtimePerHr !== undefined ? Number(res.data.overtimePerHr) : (Number(res.data.package?.overtimePerHr) || Number(pkg.overtimePerHr)),
              targetDurationMin: res.data.targetDurationMin || res.data.package?.durationMin || pkg.durationMin || 60,
            };
            set((state) => ({
              sessions: [serverSession, ...state.sessions.filter((s) => s.id !== serverSession.id)],
            }));
            return serverSession;
          }
        } catch (err) {
          console.warn('[WorkspaceStore] Check-in API failed, creating locally:', err);
        }

        const newSession = {
          id: Date.now(),
          areaId: area.id,
          areaName: area.name,
          packageId: pkg.id,
          packageName: pkg.name,
          packagePrice: pkg.price,
          overtimePerHr: pkg.overtimePerHr || 0,
          customerName,
          phone: phone || '',
          checkInAt: new Date().toISOString(),
          targetDurationMin: pkg.durationMin,
          status: 'ACTIVE',
          orderId: null,
        };

        set((state) => ({
          sessions: [newSession, ...state.sessions],
        }));
        return newSession;
      },

      // Calculate checkout billing
      calculateCheckout: (session) => {
        const pkg = get().packages.find((p) => p.id === session.packageId) || session.package || {
          price: session.packagePrice || 20000,
          durationMin: session.targetDurationMin || 60,
          overtimePerHr: session.overtimePerHr || 15000,
        };

        const checkInTime = new Date(session.checkInAt).getTime();
        const now = Date.now();
        const elapsedMinutes = Math.max(1, Math.round((now - checkInTime) / (1000 * 60)));

        const baseDuration = session.targetDurationMin || pkg.durationMin || 60;
        const overtimeMinutes = Math.max(0, elapsedMinutes - baseDuration);

        const overtimeHours = Math.ceil(overtimeMinutes / 60);
        const overtimeCharge = overtimeHours * (Number(session.overtimePerHr ?? pkg.overtimePerHr) || 0);

        const baseCharge = Number(session.packagePrice ?? pkg.price) || 0;
        const totalCharge = baseCharge + overtimeCharge;

        return {
          elapsedMinutes,
          baseDuration,
          overtimeMinutes,
          overtimeHours,
          baseCharge,
          overtimeCharge,
          totalCharge,
        };
      },

      // Complete checkout session
      checkOut: async (sessionId) => {
        const state = get();
        const session = state.sessions.find((s) => s.id === sessionId);
        if (!session) return null;

        const billing = state.calculateCheckout(session);

        let serverData = null;
        try {
          const res = await api.workspace.checkOut(sessionId);
          if (res && res.success && res.data) {
            serverData = res.data;
          }
        } catch (err) {
          console.warn('[WorkspaceStore] Backend checkout sync error:', err);
        }

        const completedSession = {
          ...session,
          ...(serverData || {}),
          id: session.id,
          areaName: session.areaName || session.area?.name || serverData?.area?.name || 'Workspace',
          customerName: session.customerName || serverData?.customerName || 'Pelanggan',
          checkOutAt: serverData?.checkOutAt || new Date().toISOString(),
          status: 'COMPLETED',
          charge: serverData?.charge !== undefined ? Number(serverData.charge) : billing.totalCharge,
          billingDetails: serverData?.billingDetails || billing,
        };

        set({
          sessions: state.sessions.filter((s) => s.id !== sessionId),
          historySessions: [completedSession, ...state.historySessions],
        });

        return completedSession;
      },
    }),
    {
      name: 'komazi-workspace-storage',
      version: 3,
      migrate: (persistedState, version) => {
        if (version < 3) {
          return {
            areas: [],
            packages: [],
            sessions: [],
            historySessions: [],
          };
        }
        return persistedState;
      },
    }
  )
);
