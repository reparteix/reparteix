---
name: reparteix
description: Manage shared expenses — create groups, add members, track expenses (equal or proportional splits) and payments, calculate balances and minimum settlements. Export/import groups as JSON. Local-first, offline-capable PWA.
version: 1.0.0
author: pilipilisbot
tags:
  - expenses
  - splitwise
  - finance
  - local-first
  - offline
  - pwa
metadata:
  openclaw:
    os:
      - linux
      - darwin
      - windows
    requires:
      bins:
        - node
        - npm
      config: []
---

# Reparteix — Expense Splitting Skill

Reparteix is a local-first expense splitting application (like Splitwise) that runs entirely in the browser with no backend. All data is stored locally via IndexedDB.

## When to Use This Skill

Use this skill when the user wants to:

- Create or manage **groups** of people who share expenses (with name, icon, description, currency).
- Add, remove, or rename **members** in a group.
- Record **expenses** (who paid, how much, split equally or proportionally among whom, optional receipt image).
- Record **payments** (settlements between members).
- **Calculate balances** — see who owes whom.
- **Calculate minimum settlements** — find the fewest transfers needed to settle all debts.
- **Export** a group and all its data to a JSON file for backup.
- **Import** a group from a previously exported JSON file (Last-Write-Wins conflict resolution).

## Project Setup

```bash
# Install dependencies
npm install

# Run the development server
npm run dev

# Build for production
npm run build

# Run linter
npm run lint

# Run tests
npm run test
```

## Architecture Overview

```
src/
  domain/
    entities/       # Zod schemas and TypeScript types
    services/       # Pure business logic (balances, settlements)
  infra/
    db/             # Dexie (IndexedDB) database
  features/         # React UI feature modules
  store/            # Zustand global state
  sdk.ts            # Headless SDK — the main programmatic API
```

The headless SDK (`src/sdk.ts`) is the primary entry point for all operations. It wraps IndexedDB persistence and exposes a clean async API.

## SDK API Reference

Import the SDK:

```typescript
import { reparteix } from './src/sdk'
```

### Groups

| Method | Signature | Description |
|--------|-----------|-------------|
| `listGroups` | `() => Promise<Group[]>` | List all non-deleted groups |
| `getGroup` | `(id: string) => Promise<Group \| undefined>` | Get a group by ID |
| `createGroup` | `(name: string, currency?: string) => Promise<Group>` | Create a new group (default currency: `"EUR"`) |
| `updateGroup` | `(id: string, updates: { name?, description?, icon?, currency? }) => Promise<Group>` | Update group metadata |
| `deleteGroup` | `(id: string) => Promise<void>` | Soft-delete a group |

### Members

| Method | Signature | Description |
|--------|-----------|-------------|
| `addMember` | `(groupId: string, name: string) => Promise<Member>` | Add a member to a group |
| `renameMember` | `(groupId: string, memberId: string, newName: string) => Promise<void>` | Rename a member |
| `removeMember` | `(groupId: string, memberId: string) => Promise<void>` | Soft-delete a member (throws if they have expenses or payments) |

### Expenses

| Method | Signature | Description |
|--------|-----------|-------------|
| `listExpenses` | `(groupId: string) => Promise<Expense[]>` | List non-deleted expenses for a group |
| `listExpenseTotalsByGroup` | `() => Promise<Record<string, number>>` | Map of groupId → total expense amount (all groups) |
| `addExpense` | `(expense: { groupId, description, amount, payerId, splitAmong, date, splitType?, splitProportions?, receiptImage? }) => Promise<Expense>` | Add an expense |
| `updateExpense` | `(expense: Expense) => Promise<Expense>` | Update an existing expense |
| `deleteExpense` | `(id: string) => Promise<void>` | Soft-delete an expense |

### Payments

| Method | Signature | Description |
|--------|-----------|-------------|
| `listPayments` | `(groupId: string) => Promise<Payment[]>` | List non-deleted payments for a group |
| `addPayment` | `(payment: { groupId, fromId, toId, amount, date }) => Promise<Payment>` | Record a payment |
| `deletePayment` | `(id: string) => Promise<void>` | Soft-delete a payment |

### Balances & Settlements

| Method | Signature | Description |
|--------|-----------|-------------|
| `getBalances` | `(groupId: string) => Promise<Balance[]>` | Net balance per member (positive = owed, negative = owes) |
| `getSettlements` | `(groupId: string) => Promise<Settlement[]>` | Minimum transfers to settle all debts |

### Import / Export

| Method | Signature | Description |
|--------|-----------|-------------|
| `exportGroup` | `(groupId: string) => Promise<GroupExport>` | Export a group with all its expenses and payments as a versioned JSON object |
| `importGroup` | `(raw: unknown) => Promise<Group>` | Import a group from a `GroupExport` object. Validates with Zod, uses LWW for ID collisions, runs in a single transaction |

## Domain Entities

### Group

```typescript
{
  id: string
  name: string          // min 1 character
  description?: string  // optional description
  icon?: string         // optional emoji icon, e.g. "🍕"
  currency: string      // e.g. "EUR" (default), "USD", "GBP"
  members: Member[]
  createdAt: string     // ISO 8601 datetime
  updatedAt: string     // ISO 8601 datetime
  deleted: boolean      // soft delete flag
}
```

### Member

```typescript
{
  id: string
  name: string          // min 1 character
  color: string         // hex color, e.g. "#6366f1"
  createdAt: string
  updatedAt: string
  deleted: boolean
}
```

### Expense

```typescript
{
  id: string
  groupId: string
  description: string             // min 1 character
  amount: number                  // positive
  payerId: string                 // member ID who paid
  splitAmong: string[]            // member IDs who share the cost (min 1)
  splitType?: 'equal' | 'proportional'  // defaults to equal
  splitProportions?: Record<string, number>  // memberId → weight (only for proportional)
  date: string                    // e.g. "2024-06-01"
  receiptImage?: string           // base64-encoded image or URL
  createdAt: string
  updatedAt: string
  deleted: boolean
}
```

### Payment

```typescript
{
  id: string
  groupId: string
  fromId: string        // member ID who pays
  toId: string          // member ID who receives
  amount: number        // positive
  date: string
  createdAt: string
  updatedAt: string
  deleted: boolean
}
```

### Balance

```typescript
{
  memberId: string
  total: number         // positive = owed money, negative = owes money
}
```

### Settlement

```typescript
{
  fromId: string        // debtor member ID
  toId: string          // creditor member ID
  amount: number        // transfer amount
}
```

### GroupExport

```typescript
{
  schemaVersion: 1
  exportedAt: string    // ISO 8601 datetime
  group: Group
  expenses: Expense[]
  payments: Payment[]
}
```

## Example Workflow

Here is a typical workflow to manage a group dinner expense:

```typescript
// 1. Create a group
const group = await reparteix.createGroup('Sopar', 'EUR')

// 2. Add members
const anna = await reparteix.addMember(group.id, 'Anna')
const bernat = await reparteix.addMember(group.id, 'Bernat')
const carla = await reparteix.addMember(group.id, 'Carla')

// 3. Record expenses
await reparteix.addExpense({
  groupId: group.id,
  description: 'Pizza',
  amount: 30,
  payerId: anna.id,
  splitAmong: [anna.id, bernat.id, carla.id],
  date: '2024-06-01',
})

await reparteix.addExpense({
  groupId: group.id,
  description: 'Begudes',
  amount: 15,
  payerId: bernat.id,
  splitAmong: [anna.id, bernat.id, carla.id],
  date: '2024-06-01',
})

// 4. Check balances
const balances = await reparteix.getBalances(group.id)
// Anna: +15, Bernat: 0, Carla: -15

// 5. Get minimum settlements
const settlements = await reparteix.getSettlements(group.id)
// e.g. [{ fromId: carla.id, toId: anna.id, amount: 15 }]

// 6. Record a payment when someone settles up
await reparteix.addPayment({
  groupId: group.id,
  fromId: carla.id,
  toId: anna.id,
  amount: 15,
  date: '2024-06-02',
})
```

## Important Conventions

- **Language**: UI text is in Catalan, code (variables, functions, comments) is in English.
- **Soft delete**: Entities are never physically removed — they are marked with `deleted: true`.
- **IDs**: Generated with `crypto.randomUUID()`.
- **Timestamps**: ISO 8601 format via `new Date().toISOString()`.
- **Currency**: Stored as a string on the group (e.g. `"EUR"`), not enforced beyond that.
- **Balances**: Positive means the member is owed money (creditor), negative means they owe (debtor).
- **Settlements**: Use greedy matching to minimize the number of transfers.
- **Split types**: `equal` (default) divides the expense equally; `proportional` uses `splitProportions` weights.
- **Import/Export**: Uses `schemaVersion: 1`. LWW (Last-Write-Wins by `updatedAt`) resolves ID collisions.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + TypeScript |
| Build | Vite 8 |
| Styles | TailwindCSS v4 |
| Components | shadcn/ui (Radix UI + Lucide icons) |
| State | Zustand 5 |
| Persistence | Dexie 4 (IndexedDB) |
| Validation | Zod v4 |
| Routing | React Router v7 (HashRouter) |
| PWA | vite-plugin-pwa (Workbox service worker) |
| Tests | Vitest + @testing-library/jest-dom |
| Releases | semantic-release (Conventional Commits) |
| Deploy | GitHub Actions → GitHub Pages |

## Maintenance

> **⚠️ This file must be kept up to date.**

Every time the SDK API, domain entities, tech stack, or project conventions change, this skill file **must be updated** in the same PR or commit. Follow these rules:

1. **Add new SDK methods** to the corresponding table in "SDK API Reference".
2. **Update entity schemas** whenever fields are added, removed, or made optional.
3. **Bump the `version`** in the YAML frontmatter following semver:
   - Patch (`x.y.Z`) — doc fixes, clarifications.
   - Minor (`x.Y.0`) — new SDK methods or entity fields (non-breaking).
   - Major (`X.0.0`) — breaking changes to the SDK or entities.
4. **Update "When to Use This Skill"** if new user-facing capabilities are added.
5. **Sync with `README.md`** — both files must reflect the same feature set.

The same rule applies to `README.md`, `.github/copilot-instructions.md`, and the agent files under `.github/agents/`.
