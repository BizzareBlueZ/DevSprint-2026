/**
 * Zod Validation Schemas
 * Centralized request validation for API endpoints
 */
const { z } = require('zod')

// ─── Auth Schemas ──────────────────────────────────────────────
const loginSchema = z.object({
  email: z.string().min(1, 'Email is required'),
  password: z.string().min(1, 'Password is required'),
})

const registerSchema = z.object({
  studentId: z.string().regex(/^\d{9}$/, 'Student ID must be 9 digits'),
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  department: z.string().min(2, 'Department is required'),
  year: z.number().int().min(1).max(4).optional(),
})

// ─── Order Schemas ─────────────────────────────────────────────
const createOrderSchema = z.object({
  itemId: z.number().int().positive('Item ID is required'),
  type: z.enum(['dinner', 'iftar']).optional().default('dinner'),
  scheduledPickupTime: z.string().datetime().optional(),
})

const orderQuerySchema = z.object({
  status: z.string().optional(),
  search: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
})

const verifyQrSchema = z.object({
  qrCode: z.string().min(1, 'QR code is required'),
})

// ─── Wallet Schemas ────────────────────────────────────────────
const topupSchema = z.object({
  amount: z.number().positive().min(10, 'Minimum top-up is ৳10'),
  method: z.enum(['bkash', 'nagad', 'rocket', 'bank']).optional().default('bkash'),
  reference: z.string().optional(),
})

const emergencyRequestSchema = z.object({
  amount: z.number().positive().min(10, 'Minimum emergency balance is ৳10'),
  reason: z.string().optional(),
})

// ─── Cafeteria Schemas ─────────────────────────────────────────
const tokenSchema = z.object({
  type: z.enum(['dinner', 'iftar']),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
})

const bulkTokensSchema = z.object({
  tokens: z.array(tokenSchema).min(1, 'At least one token required').max(30),
})

// ─── Review Schemas ────────────────────────────────────────────
const reviewSchema = z.object({
  orderId: z.string().uuid('Invalid order ID'),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
})

// ─── Admin Schemas ─────────────────────────────────────────────
const createMenuItemSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  description: z.string().optional(),
  price: z.number().positive('Price must be positive'),
  category: z.string().min(1, 'Category is required'),
  is_available: z.boolean().optional().default(true),
  image_url: z.string().url().optional(),
  initial_stock: z.number().int().min(0).optional().default(50),
})

const updateMenuItemSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  price: z.number().positive().optional(),
  category: z.string().optional(),
  is_available: z.boolean().optional(),
  image_url: z.string().url().optional(),
})

const updateStockSchema = z.object({
  quantity: z.number().int().min(0, 'Quantity cannot be negative'),
})

// ─── ID Params ─────────────────────────────────────────────────
const uuidParam = z.object({
  orderId: z.string().uuid(),
})

const intIdParam = z.object({
  id: z.coerce.number().int().positive(),
})

const itemIdParam = z.object({
  itemId: z.coerce.number().int().positive(),
})

module.exports = {
  // Auth
  loginSchema,
  registerSchema,
  // Orders
  createOrderSchema,
  orderQuerySchema,
  verifyQrSchema,
  // Wallet
  topupSchema,
  emergencyRequestSchema,
  // Cafeteria
  tokenSchema,
  bulkTokensSchema,
  // Reviews
  reviewSchema,
  // Admin
  createMenuItemSchema,
  updateMenuItemSchema,
  updateStockSchema,
  // Params
  uuidParam,
  intIdParam,
  itemIdParam,
}
