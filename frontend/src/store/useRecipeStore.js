import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../services/api';
import { useStockStore } from './stockStore';
import { usePosStore } from './posStore';

export const useRecipeStore = create(
  persist(
    (set, get) => ({
      // Map of productId -> array of recipe items { ingredientId, quantity, variantId }
      recipes: {},
      cogsOverview: [],
      loading: false,
      error: null,

      // Fetch recipe for a product (API first, fallback to store)
      fetchRecipe: async (productId) => {
        set({ loading: true, error: null });
        try {
          const res = await api.recipes.get(productId);
          if (res && res.success && res.data) {
            set((state) => ({
              loading: false,
              recipes: {
                ...state.recipes,
                [productId]: res.data.recipeItems || [],
              },
            }));
            return res.data;
          }
        } catch (err) {
          console.warn('[RecipeStore] Fallback to local recipe', err);
        }

        // Local fallback
        const localItems = get().recipes[productId] || [];
        const stockIngredients = useStockStore.getState().ingredients || [];
        const ingMap = new Map(stockIngredients.map((i) => [i.id, i]));

        const calculated = localItems.map((item) => {
          const ing = ingMap.get(item.ingredientId);
          const cost = Number(ing?.costPerUnit) || 0;
          const qty = Number(item.quantity) || 0;
          return {
            ...item,
            ingredientName: ing?.name || 'Bahan',
            ingredientUnit: ing?.unit || 'unit',
            costPerUnit: cost,
            quantity: qty,
            lineCost: Math.round(qty * cost * 100) / 100,
          };
        });

        const totalCost = calculated.reduce((sum, item) => sum + item.lineCost, 0);

        set({ loading: false });
        return {
          productId,
          recipeItems: calculated,
          hpp: Math.round(totalCost * 100) / 100,
        };
      },

      // Save recipe for a product
      saveRecipe: async (productId, items) => {
        set({ loading: true, error: null });
        try {
          const res = await api.recipes.save(productId, { items });
          if (res && res.success) {
            set((state) => ({
              loading: false,
              recipes: {
                ...state.recipes,
                [productId]: items,
              },
            }));
            get().fetchCogsOverview();
            return { success: true, data: res.data };
          }
        } catch (err) {
          console.warn('[RecipeStore] Saving locally', err);
        }

        // Local store fallback
        set((state) => ({
          loading: false,
          recipes: {
            ...state.recipes,
            [productId]: items,
          },
        }));
        get().fetchCogsOverview();
        return { success: true };
      },

      // Fetch COGS overview for all products
      fetchCogsOverview: async () => {
        set({ loading: true, error: null });
        try {
          const res = await api.recipes.getOverview();
          if (res && res.success && Array.isArray(res.data)) {
            set({ cogsOverview: res.data, loading: false });
            return res.data;
          }
        } catch (err) {
          console.warn('[RecipeStore] Overview fallback to local calculation', err);
        }

        // Local calculate from posStore products & stockStore ingredients
        const products = usePosStore.getState().products || [];
        const ingredients = useStockStore.getState().ingredients || [];
        const ingMap = new Map(ingredients.map((i) => [i.id, i]));
        const recipes = get().recipes || {};

        const overview = products.map((prod) => {
          const recipe = recipes[prod.id] || [];
          const baseCost = recipe.reduce((sum, item) => {
            const ing = ingMap.get(item.ingredientId);
            return sum + (Number(item.quantity) || 0) * (Number(ing?.costPerUnit) || 0);
          }, 0);

          const price = Number(prod.price) || 0;
          const hpp = Math.round(baseCost * 100) / 100;
          const grossProfit = Math.round((price - hpp) * 100) / 100;
          const margin = price > 0 ? Math.round(((price - hpp) / price) * 10000) / 100 : 0;

          return {
            id: prod.id,
            name: prod.name,
            sku: prod.sku,
            categoryName: prod.category?.name || prod.categoryName || '-',
            price,
            hpp,
            grossProfit,
            margin,
            hasRecipe: recipe.length > 0,
            ingredientCount: recipe.length,
          };
        });

        set({ cogsOverview: overview, loading: false });
        return overview;
      },

      // Calculate single product HPP helper
      calculateProductHpp: (productId) => {
        const recipe = get().recipes[productId] || [];
        const ingredients = useStockStore.getState().ingredients || [];
        const ingMap = new Map(ingredients.map((i) => [i.id, i]));

        const cost = recipe.reduce((sum, item) => {
          const ing = ingMap.get(item.ingredientId);
          return sum + (Number(item.quantity) || 0) * (Number(ing?.costPerUnit) || 0);
        }, 0);

        return Math.round(cost * 100) / 100;
      },
    }),
    {
      name: 'komazi-recipes-storage',
      version: 3,
      migrate: (persistedState, version) => {
        if (version < 3) {
          return { recipes: {} };
        }
        return persistedState;
      },
      partialize: (state) => ({ recipes: state.recipes }),
    }
  )
);
