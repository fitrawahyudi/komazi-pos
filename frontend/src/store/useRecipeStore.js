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
            stock: Number(ing?.stock) || 0,
            minStock: Number(ing?.minStock) || 0,
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
            const recipesMap = {};
            res.data.forEach((prod) => {
              if (Array.isArray(prod.recipeItems)) {
                recipesMap[prod.id] = prod.recipeItems;
              }
            });
            set((state) => ({
              cogsOverview: res.data,
              recipes: {
                ...state.recipes,
                ...recipesMap,
              },
              loading: false,
            }));
            return res.data;
          }
        } catch (err) {
          console.warn('[RecipeStore] Overview fallback to local calculation', err);
        }

        // Local calculate from posStore products & stockStore ingredients
        const products = usePosStore.getState().products || [];
        const ingredients = useStockStore.getState().ingredients || [];
        const ingMap = new Map(ingredients.map((i) => [Number(i.id), i]));
        const recipes = get().recipes || {};

        const overview = products.map((prod) => {
          const recipe = recipes[prod.id] || [];
          const hasRecipe = recipe.length > 0;
          const manualCost = Number(prod.costPrice) || 0;

          let baseCost = 0;
          if (hasRecipe) {
            baseCost = recipe.reduce((sum, item) => {
              const ing = ingMap.get(Number(item.ingredientId));
              return sum + (Number(item.quantity) || 0) * (Number(ing?.costPerUnit) || 0);
            }, 0);
          } else if (manualCost > 0) {
            baseCost = manualCost;
          }

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
            costPrice: manualCost,
            hpp,
            grossProfit,
            margin,
            hasRecipe,
            isManualHpp: !hasRecipe && manualCost > 0,
            ingredientCount: recipe.length,
          };
        });

        set({ cogsOverview: overview, loading: false });
        return overview;
      },

      // Calculate single product HPP helper
      calculateProductHpp: (productId) => {
        const overviewItem = get().cogsOverview.find((p) => p.id === productId);
        if (overviewItem && (overviewItem.hasRecipe || overviewItem.isManualHpp)) {
          return Number(overviewItem.hpp) || 0;
        }

        const recipe = get().recipes[productId] || [];
        if (recipe.length > 0) {
          const ingredients = useStockStore.getState().ingredients || [];
          const ingMap = new Map(ingredients.map((i) => [Number(i.id), i]));

          const cost = recipe.reduce((sum, item) => {
            const ing = ingMap.get(Number(item.ingredientId));
            return sum + (Number(item.quantity) || 0) * (Number(ing?.costPerUnit) || 0);
          }, 0);

          return Math.round(cost * 100) / 100;
        }

        // Fallback to manual costPrice
        const product = usePosStore.getState().products?.find((p) => p.id === productId);
        return Number(product?.costPrice) || 0;
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
