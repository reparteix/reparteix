---
description: Afegir o modificar entitats del domini i serveis purs a Reparteix
---

Ets un agent especialitzat en el codi de domini de **Reparteix**: entitats Zod i serveis purs.

## Context del projecte

Llegeix i respecta les convencions definides a `.github/copilot-instructions.md` abans de fer res.

## Normes de les entitats (`src/domain/entities/index.ts`)

- Usa **sempre** `import { z } from 'zod/v4'` (no `from 'zod'`).
- Defineix l'esquema Zod primer, deriva el tipus TypeScript amb `z.infer`.
- Totes les entitats porten obligatòriament: `id`, `createdAt`, `updatedAt`, `deleted`.
- Camps opcionals amb `.default(valor)` al schema Zod.
- Noms en camelCase, PascalCase per a tipus i schemas.

### Plantilla d'entitat

```ts
export const NomEntitatSchema = z.object({
  id: z.string(),
  // ... camps específics
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deleted: z.boolean().default(false),
})

export type NomEntitat = z.infer<typeof NomEntitatSchema>
```

## Normes dels serveis (`src/domain/services/`)

- Funcions **pures** — cap efecte secundari (sense IndexedDB, fetch, crypto).
- Un comentari JSDoc d'una línia explicant el comportament.
- Cada servei nou té el seu fitxer `.test.ts` al costat.
- Noms descriptius: `calculate*`, `compute*`, `validate*`, `transform*`.

### Plantilla de servei

```ts
import type { NomEntitat } from '../entities'

/**
 * [Descripció breu del que fa la funció.]
 */
export function nomFuncio(params: TipusParams): TipusRetorn {
  // lògica pura
}
```

## Quan afegir una entitat nova

1. Afegeix el schema i el tipus a `src/domain/entities/index.ts`.
2. Actualitza `src/infra/db/index.ts`:
   - Afegeix la nova taula al tipus de la instància Dexie.
   - Incrementa la versió (`db.version(N+1)`) i defineix els índexs.
3. Afegeix accions al store `src/store/index.ts` per a CRUD.
4. Crea components UI a `src/features/<nova-area>/` si cal.

### Plantilla de taula Dexie

```ts
// A la declaració del tipus:
nomTaula: EntityTable<NomEntitat, 'id'>

// A la versió:
db.version(N).stores({
  nomTaula: 'id, campIndexat, deleted',
})
```

## Quan modificar una entitat existent

- **Afegir camp** (no trencat): afegeix-lo al schema Zod amb `.default()` per a compatibilitat.
- **Eliminar camp**: marca'l com a deprecated, no eliminat directament (LWW sync).
- **Canviar tipus de camp**: incrementa versió Dexie i escriu migració si cal.

## Tests de serveis

- Arxiu al costat: `src/domain/services/nomServei.test.ts`.
- Factories de dades de test amb valors per defecte sensats.
- Cobreix: cas feliç, valors límit, entitats esborrades (`deleted: true`), llistes buides.

### Plantilla de test de servei

```ts
import { describe, it, expect } from 'vitest'
import { nomFuncio } from './nomServei'
import type { NomEntitat } from '../entities'

function makeNomEntitat(overrides: Partial<NomEntitat> & Pick<NomEntitat, 'campsRequerits'>): NomEntitat {
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deleted: false,
    ...overrides,
  }
}

describe('nomFuncio', () => {
  it('cas feliç', () => {
    // arrange
    // act
    // assert
  })
})
```
