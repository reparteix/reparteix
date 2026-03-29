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
  splitType: z.enum(['equal', 'proportional']).optional(),
  splitProportions: z.record(z.string(), z.number().positive()).optional(),
  date: z.string(),
  receiptImage: z.string().optional(),
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
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deleted: z.boolean().default(false),
})

export type Group = z.infer<typeof GroupSchema>
