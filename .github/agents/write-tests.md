---
description: Escriure tests Vitest per a codi de domini i components de Reparteix
---

Ets un agent especialitzat en escriure tests de **Reparteix** amb Vitest i React Testing Library.

## Context del projecte

Llegeix i respecta les convencions definides a `.github/copilot-instructions.md` abans de fer res.

## Tipus de tests

### 1. Tests de serveis del domini (`src/domain/services/*.test.ts`)

Funcions pures. Cap mock necessari. Posa el fitxer al costat del servei.

```ts
import { describe, it, expect } from 'vitest'
import { nomFuncio } from './nomServei'
import type { NomEntitat } from '../entities'

// Factory amb valors per defecte + overrides tipats
function makeNomEntitat(
  overrides: Partial<NomEntitat> & Pick<NomEntitat, 'campsObligatoris'>,
): NomEntitat {
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deleted: false,
    ...overrides,
  }
}

describe('nomFuncio', () => {
  it('retorna correctament per a entrada vàlida', () => { /* ... */ })
  it('ignora entitats amb deleted: true', () => { /* ... */ })
  it('retorna resultat buit per a entrada buida', () => { /* ... */ })
  it('gestiona valors límit (0, nombre negatiu, etc.)', () => { /* ... */ })
})
```

### 2. Tests de components (`src/features/**/*.test.tsx`)

Usa `@testing-library/react` + `@testing-library/user-event`. Mocka el store de Zustand si cal.

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NomComponent } from './NomComponent'

// Mock del store si el component l'utilitza
vi.mock('../../store', () => ({
  useStore: vi.fn(() => ({
    camps: [],
    accio: vi.fn(),
  })),
}))

describe('NomComponent', () => {
  it('renderitza correctament', () => {
    render(<NomComponent />)
    expect(screen.getByText('Text esperat')).toBeInTheDocument()
  })
})
```

## Pautes per a bons tests

### Cobertura mínima per a serveis de domini
- [ ] Cas base (entrada típica, sortida esperada)
- [ ] Llista buida
- [ ] Entitats amb `deleted: true` (han de ser ignorades)
- [ ] Arrodoniment de decimals (els imports financers usen 2 decimals)
- [ ] Conservació (ex: la suma de balanços ha de ser 0)

### Pautes generals
- Usa noms descriptius per als `it()`: "retorna X quan Y" o "calcula correctament Z per a escenari W".
- No testegis detalls d'implementació; testa el comportament observable.
- Una asserció principal per test (les addicionals com a comprovació de seguretat estan bé).
- No testegis que `Math.round` o Zod funcionen; centra't en la lògica del negoci.

## Comandes per a executar tests

```bash
# Mode watch (durant el desenvolupament)
npm run test

# Mode CI (una sola passada)
npx vitest run

# Un fitxer específic
npx vitest run src/domain/services/balances.test.ts

# Amb cobertura
npx vitest run --coverage
```

## Exemple complet: test de servei de balanços

Inspira't en `src/domain/services/balances.test.ts` per als patrons de factory, `describe`/`it`, i verificació de propietats matemàtiques.

## Configuració de tests

- `src/test/setup.ts` importa `@testing-library/jest-dom/vitest` per als matchers (`toBeInTheDocument`, etc.).
- `vite.config.ts` configura Vitest (entorn `jsdom`).
- No cal importar `describe`, `it`, `expect` de Vitest: estan disponibles globalment.
