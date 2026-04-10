import { z } from 'zod/v4'

export const MemberSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  color: z.string().default('#6366f1'),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deleted: z.boolean().default(false),
})

export type Member = z.infer<typeof MemberSchema>

export const ExpenseSchema = z.object({
  id: z.string(),
  groupId: z.string(),
  description: z.string().min(1),
  amount: z.number().positive(),
  payerId: z.string(),
  splitAmong: z.array(z.string()).min(1),
  splitType: z.enum(['equal', 'proportional', 'fixed']).optional(),
  splitProportions: z.record(z.string(), z.number().positive()).optional(),
  splitFixedAmounts: z.record(z.string(), z.number().nonnegative()).optional(),
  computedShares: z.record(z.string(), z.number()).optional(),
  date: z.string(),
  receiptImage: z.string().optional(),
  archived: z.boolean().default(false),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deleted: z.boolean().default(false),
})

export type Expense = z.infer<typeof ExpenseSchema>

export const PaymentSchema = z.object({
  id: z.string(),
  groupId: z.string(),
  fromId: z.string(),
  toId: z.string(),
  amount: z.number().positive(),
  date: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deleted: z.boolean().default(false),
})

export type Payment = z.infer<typeof PaymentSchema>

export const GroupSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  description: z.string().optional(),
  icon: z.string().optional(),
  currency: z.string().default('EUR'),
  members: z.array(MemberSchema),
  archived: z.boolean().default(false),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deleted: z.boolean().default(false),
})

export type Group = z.infer<typeof GroupSchema>

export const GroupExportSchema = z.object({
  schemaVersion: z.literal(1),
  exportedAt: z.string().datetime(),
  group: GroupSchema,
  expenses: z.array(ExpenseSchema),
  payments: z.array(PaymentSchema),
})

export type GroupExport = z.infer<typeof GroupExportSchema>

export const ReparteixExportV1Schema = z.object({
  format: z.literal('reparteix-export'),
  version: z.literal(1),
  exportedAt: z.string().datetime(),
  appVersion: z.string().optional(),
  data: z.object({
    groups: z.array(GroupSchema).min(1),
    expenses: z.array(ExpenseSchema),
    payments: z.array(PaymentSchema),
  }),
})

export type ReparteixExportV1 = z.infer<typeof ReparteixExportV1Schema>

export const SyncEnvelopeV1Schema = z.object({
  version: z.literal(1),
  source: z.string().optional(),
  exportedAt: z.string().datetime(),
  group: GroupSchema,
  expenses: z.array(ExpenseSchema).default([]),
  payments: z.array(PaymentSchema).default([]),
  meta: z
    .object({
      mode: z.enum(['snapshot', 'patch']).default('snapshot'),
    })
    .optional(),
})

export type SyncEnvelopeV1 = z.infer<typeof SyncEnvelopeV1Schema>

export const LiquidationTransferSchema = z.object({
  fromId: z.string(),
  toId: z.string(),
  amount: z.number().positive(),
})

export const LiquidationSchema = z.object({
  id: z.string(),
  groupId: z.string(),
  name: z.string().min(1),
  periodStart: z.string().optional(),
  periodEnd: z.string().optional(),
  transfers: z.array(LiquidationTransferSchema),
  balances: z.record(z.string(), z.number()),
  totalSpent: z.number().nonnegative(),
  createdAt: z.string().datetime(),
})

export type LiquidationTransfer = z.infer<typeof LiquidationTransferSchema>
export type Liquidation = z.infer<typeof LiquidationSchema>
