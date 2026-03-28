---
description: Afegir una nova funcionalitat seguint els patrons del projecte Reparteix
---

Ets un agent especialitzat en afegir noves funcionalitats a **Reparteix**, una app React + TypeScript local-first per a repartiment de despeses.

## Context del projecte

Llegeix i respecta les convencions definides a `.github/copilot-instructions.md` abans de fer res.

## Passos per afegir una nova funcionalitat

1. **Comprèn el domini**: determina quines entitats Zod de `src/domain/entities/index.ts` intervenen.
2. **Lògica de domini** (si cal): afegeix o modifica serveis purs a `src/domain/services/`. Escriu tests costat.
3. **Persistència** (si cal): actualitza l'esquema Dexie a `src/infra/db/index.ts` incrementant la versió.
4. **Store** (si cal): afegeix les accions necessàries a `src/store/index.ts` seguint el patró existent (async, `loadGroups`/`loadGroupData` al final).
5. **Component UI**: crea o modifica components a `src/features/<area>/`. Usa TailwindCSS inline, sense fitxers CSS addicionals.
6. **Routing** (si cal): afegeix la nova ruta a `src/main.tsx` o al component de routing corresponent.
7. **Tests** (si cal): afegeix tests Vitest per a la lògica de domini nova.

## Plantilla de component

```tsx
import { useState } from 'react'
import type { Group } from '../../domain/entities'
import { useStore } from '../../store'

interface NomComponentProps {
  group: Group
}

export function NomComponent({ group }: NomComponentProps) {
  // estat local amb useState
  // accions del store amb useStore()
  return (
    <div>
      {/* JSX amb classes TailwindCSS */}
    </div>
  )
}
```

## Plantilla d'acció al store

```ts
nomAccio: async (param: string) => {
  const timestamp = new Date().toISOString()
  // lògica
  await db.entitat.add({ id: crypto.randomUUID(), ...camps, createdAt: timestamp, updatedAt: timestamp, deleted: false })
  await get().loadGroups() // o loadGroupData(groupId) si és dada de grup
},
```

## Convencions de noms

- Components: `PascalCase` (ex: `ExpenseList`, `BalanceView`)
- Accions al store: `camelCase`, verbs imperatius (ex: `addExpense`, `deleteGroup`)
- Serveis de domini: funcions exportades `camelCase` (ex: `calculateBalances`)
- Fitxers: `kebab-case` per carpetes, `PascalCase` per components, `camelCase` per serveis

## Restriccions

- No afegeixis dependències noves sense justificació explícita.
- No modifiquis la lògica de càlcul de balanços (`calculateBalances`, `calculateSettlements`) a menys que sigui necessari per la funcionalitat.
- Tota text de la UI ha d'estar en **català**.
- No introdueixis efectes secundaris (network, DB) a `src/domain/`.
