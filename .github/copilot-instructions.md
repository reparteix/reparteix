# Instruccions per a GitHub Copilot — Reparteix

## Visió general

**Reparteix** és una aplicació web de repartiment de despeses (tipus Splitwise) amb arquitectura **local-first** i funcionament 100% offline. Les dades es guarden al navegador via IndexedDB. L'app es publica estàticament a GitHub Pages.

Idioma del projecte: **català** per a textos de la UI, **anglès** per al codi (noms de variables, funcions, comentaris tècnics).

## Stack tècnic

| Capa | Tecnologia |
|------|-----------|
| Frontend | React 19 + TypeScript |
| Build | Vite |
| Estils | TailwindCSS (classes inline, sense CSS custom) |
| Estat global | Zustand |
| Persistència | Dexie (IndexedDB) |
| Validació | Zod v4 (`import { z } from 'zod/v4'`) |
| Routing | React Router v7 |
| Tests | Vitest + @testing-library/jest-dom |

## Estructura del projecte

```
src/
  domain/
    entities/       # Esquemes Zod i tipus TypeScript
    services/       # Lògica pura (sense efectes secundaris), testejada amb Vitest
  infra/
    db/             # Dexie — definició de la base de dades IndexedDB
    crypto/         # WebCrypto (xifrat AES-GCM)
    sync/           # Proveïdors de sincronització (Gist, etc.)
  features/
    groups/         # Gestió de grups
    expenses/       # Gestió de despeses
    balances/       # Visualització de balanços i transferències
    settlements/    # Registre de pagaments
  store/            # Zustand store (accions + selectors)
  test/             # Setup global de tests (setup.ts)
```

## Convencions de codi

### TypeScript / React
- Usa **funcions** (no classes) per a components i serveis.
- Exporta components amb `export function NomComponent()`.
- Prefereix **interfaces** per a props, **types** per a unions/aliases.
- Tots els arxius de component acaben en `.tsx`, serveis en `.ts`.
- No usar `any`; empra `unknown` si el tipus és incert.

### Entitats del domini (`src/domain/entities/index.ts`)
- Defineix l'esquema Zod primer, deriva el tipus amb `z.infer<typeof XxxSchema>`.
- Totes les entitats porten: `id`, `createdAt`, `updatedAt`, `deleted` (soft delete).
- Usa `import { z } from 'zod/v4'` (no `from 'zod'`).

### Serveis del domini (`src/domain/services/`)
- Funcions **pures** sense efectes secundaris ni imports d'infra.
- Documenta el comportament amb un comentari JSDoc d'una línia.
- Cada servei té el seu arxiu de tests costat (`balances.ts` → `balances.test.ts`).

### Store Zustand (`src/store/index.ts`)
- Totes les accions asíncrones retornen `Promise<void>` o `Promise<T>`.
- Crida sempre `loadGroups()` o `loadGroupData()` al final d'una mutació per actualitzar l'estat.
- Genera IDs amb `crypto.randomUUID()`.
- Genera timestamps amb `new Date().toISOString()`.

### Infra / Dexie (`src/infra/db/index.ts`)
- La BD té una sola instància `db` exportada.
- Usa `db.version(N).stores({...})` per a migracions.
- Usa soft delete (`deleted: true`) en lloc d'eliminar registres.

### Estils (TailwindCSS)
- Escriu totes les classes directament al JSX, sense arxius CSS separats (excepte `index.css` per a variables globals).
- Paleta principal: `indigo-600` per a accions primàries, `red-500` per a accions destructives, `gray-*` per a text secundari.
- Botons: `px-4 py-2 rounded-md transition-colors` com a base.

## Comandes de desenvolupament

```bash
npm run dev        # Servidor de desenvolupament
npm run build      # Build de producció (TypeScript check + Vite build)
npm run lint       # ESLint
npm run test       # Vitest (mode watch — usa `vitest run` per CI)
```

> Per a tests de CI: `npx vitest run`

## Tests

- Arxius de test al costat del codi que testen (`*.test.ts`).
- Usa `describe` / `it` / `expect` de Vitest (no cal importar `test`).
- Factories de test: crea funcions `makeXxx(overrides)` per a valors per defecte.
- Tests del domini: únicament funcions pures, sense mocking.
- Tests de components: usa `@testing-library/react` + `userEvent`.

## Seguretat i privadesa

- Les dades mai surten del client sense xifrat.
- Xifrat: AES-GCM via WebCrypto, clau derivada amb PBKDF2 de la passphrase del grup.
- No registris secrets ni tokens al codi ni als logs.

## Decisions de disseny

1. **Sense backend propi** — tota la lògica és client-side.
2. **Local-first** — l'app funciona 100% offline.
3. **Sync eventual** — snapshot xifrat a GitHub Gist (MVP).
4. **LWW per a conflictes** — Last-Write-Wins per `updatedAt` + `deviceId` al MVP.
5. **Soft delete** — totes les entitats es marquen com `deleted: true`, mai s'esborren físicament.
