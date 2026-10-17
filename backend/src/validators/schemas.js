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
  price: z.number().nonnegative('Harga tidak boleh negatif'),
  sku: z.string().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  isDynamicPrice: z.boolean().optional().default(false),
  minPrice: z.number().nonnegative().optional().default(0),
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
  customerId: z.number().int().nullable().optional(),
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
  managerPin: z.union([z.string(), z.number()]).optional(),
});

export const refundOrderSchema = z.object({
  reason: z.string().min(3, 'Alasan refund wajib diisi'),
  refundAmount: z.number().positive().optional(),
  managerPin: z.union([z.string(), z.number()]).optional(),
});

export const openShiftSchema = z.object({
  openingCash: z.number().nonnegative('Modal kas awal tidak boleh negatif'),
  registerId: z.number().int().positive().optional(),
});

export const closeShiftSchema = z.object({
  closingCash: z.number().nonnegative('Kas fisik aktual tidak boleh negatif'),
  notes: z.string().optional(),
});

export const createCashMovementSchema = z.object({
  type: z.enum(['CASH_IN', 'CASH_OUT', 'CASH_DROP'], {
    errorMap: () => ({ message: 'Tipe kas harus CASH_IN, CASH_OUT, atau CASH_DROP' }),
  }),
  amount: z.number().positive('Nominal kas harus lebih dari Rp 0'),
  reason: z.string().min(2, 'Keterangan / alasan wajib diisi'),
  shiftId: z.number().int().optional(),
});
                        
export const workspaceCheckInSchema = z.object({
  areaId: z.number().int(),
  packageId: z.number().int(),
  customerName: z.string().min(1, 'Nama pelanggan wajib diisi'),
  customerId: z.number().int().nullable().optional(),
  phone: z.string().optional(),
});

export const stockMovementSchema = z.object({
  type: z.enum(['PURCHASE', 'ADJUSTMENT', 'WASTE', 'SALE']),
  qty: z.number(),
  note: z.string().optional(),
});

export const createCustomerSchema = z.object({
  name: z.string().min(1, 'Nama pelanggan wajib diisi'),
  phone: z.string().min(6, 'Nomor telepon/WhatsApp minimal 6 karakter'),
  email: z.string().email('Format email tidak valid').nullable().optional().or(z.literal('')),
  notes: z.string().nullable().optional(),
});

export const updateCustomerSchema = z.object({
  name: z.string().min(1, 'Nama pelanggan wajib diisi').optional(),
  phone: z.string().min(6, 'Nomor telepon/WhatsApp minimal 6 karakter').optional(),
  email: z.string().email('Format email tidak valid').nullable().optional().or(z.literal('')),
  notes: z.string().nullable().optional(),
  tier: z.enum(['SILVER', 'GOLD', 'PLATINUM']).optional(),
  isActive: z.boolean().optional(),
});

export const redeemPointsSchema = z.object({
  points: z.number().int().positive('Jumlah poin harus lebih dari 0'),
  note: z.string().optional(),
});

export const adjustPointsSchema = z.object({
  points: z.number().int('Nilai poin harus berupa bilangan bulat'),
  reason: z.string().min(1, 'Alasan penyesuaian poin wajib diisi'),
});

export const completePasswordResetSchema = z.object({
  token: z.string().min(1, 'Token reset wajib diisi'),
  newPassword: z.string().min(8, 'Password baru minimal 8 karakter'),
  confirmPassword: z.string().min(8, 'Konfirmasi password wajib diisi'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Konfirmasi password baru tidak cocok',
  path: ['confirmPassword'],
});

export const verifyPasswordResetTokenSchema = z.object({
  token: z.string().min(1, 'Token reset wajib diisi'),
});

export const requestOwnerResetOtpSchema = z.object({
  username: z.string().min(1, 'Username akun Owner wajib diisi'),
});

export const verifyOwnerResetOtpSchema = z.object({
  username: z.string().min(1, 'Username akun Owner wajib diisi'),
  otp: z.string().length(6, 'Kode OTP verifikasi harus berupa 6 digit angka').regex(/^\d{6}$/, 'Kode OTP harus berupa angka'),
  newPassword: z.string().min(8, 'Password baru minimal 8 karakter'),
  confirmPassword: z.string().min(8, 'Konfirmasi password wajib diisi'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Konfirmasi password baru tidak cocok',
  path: ['confirmPassword'],
});

