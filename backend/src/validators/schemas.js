import { z } from 'zod';

export const loginSchema = z.object({
  username: z.string().min(1, 'Username wajib diisi'),
  password: z.string().min(1, 'Password wajib diisi'),
});                                                                                                                            

export const createUserSchema = z.object({
  name: z.string().min(1, 'Nama wajib diisi'),
  username: z.string().min(3, 'Username minimal 3 karakter'),
  password: z.string().min(6, 'Password minimal 6 karakter'),
  role: z.enum(['OWNER', 'MANAGER', 'CASHIER', 'KITCHEN', 'BARISTA']),
});

export const updateUserSchema = z.object({
  name: z.string().optional(),
  password: z.string().min(6).optional(),
  role: z.enum(['OWNER', 'MANAGER', 'CASHIER', 'KITCHEN', 'BARISTA']).optional(),
  isActive: z.boolean().optional(),
});

export const categorySchema = z.object({
  name: z.string().min(1, 'Nama kategori wajib diisi'),
  sortOrder: z.number().int().optional(),
});

export const updateCategorySchema = z.object({
  name: z.string().min(1, 'Nama kategori tidak boleh kosong').optional(),
  sortOrder: z.number().int().optional(),
});

export const productVariantSchema = z.object({
  id: z.any().optional(),
  name: z.string().min(1),
  extraPrice: z.number().nonnegative().default(0),
});

export const productModifierSchema = z.object({
  id: z.any().optional(),
  name: z.string().min(1),
  price: z.number().nonnegative().default(0),
});

export const productSchema = z.object({
  name: z.string().min(1, 'Nama produk wajib diisi'),
  categoryId: z.number().int(),
  price: z.number().positive('Harga harus lebih dari 0'),
  sku: z.string().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  isActive: z.boolean().optional().default(true),
  isSoldOut: z.boolean().optional().default(false),
  variants: z.array(productVariantSchema).optional(),
  modifiers: z.array(productModifierSchema).optional(),
});

export const orderItemSchema = z.object({
  productId: z.number().int(),
  variantName: z.string().nullable().optional(),
  qty: z.number().int().min(1, 'Qty minimal 1'),
  unitPrice: z.number().nonnegative(),
  discount: z.number().nonnegative().optional().default(0),
  note: z.string().nullable().optional(),
});

export const paymentSchema = z.object({
  method: z.enum(['CASH', 'QRIS', 'TRANSFER']),
  amount: z.number().positive(),
  reference: z.string().nullable().optional(),
});

export const createOrderSchema = z.object({
  type: z.enum(['DINE_IN', 'TAKE_AWAY']).default('DINE_IN'),
  tableNo: z.string().nullable().optional(),
  customerName: z.string().nullable().optional(),
  shiftId: z.number().int().nullable().optional(),
  items: z.array(orderItemSchema).optional().default([]),
  discount: z.number().nonnegative().optional().default(0),
  payments: z.array(paymentSchema).optional(),
  workspaceSessionId: z.number().int().nullable().optional(),
}).refine((data) => (data.items && data.items.length > 0) || Boolean(data.workspaceSessionId), {
  message: 'Pesanan harus memiliki minimal satu item atau sesi workspace',
  path: ['items'],
});

export const voidOrderSchema = z.object({
  reason: z.string().min(3, 'Alasan void wajib diisi minimal 3 karakter'),
});

export const refundOrderSchema = z.object({
  reason: z.string().min(3, 'Alasan refund wajib diisi'),
  refundAmount: z.number().positive().optional(),
});

export const openShiftSchema = z.object({
  openingCash: z.number().nonnegative('Modal kas awal tidak boleh negatif'),
});

export const closeShiftSchema = z.object({
  closingCash: z.number().nonnegative('Kas fisik aktual tidak boleh negatif'),
  notes: z.string().optional(),
});
                        
export const workspaceCheckInSchema = z.object({
  areaId: z.number().int(),
  packageId: z.number().int(),
  customerName: z.string().min(1, 'Nama pelanggan wajib diisi'),
  phone: z.string().optional(),
});

export const stockMovementSchema = z.object({
  type: z.enum(['PURCHASE', 'ADJUSTMENT', 'WASTE', 'SALE']),
  qty: z.number(),
  note: z.string().optional(),
});
