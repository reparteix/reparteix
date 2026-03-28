---
description: Diagnosticar i corregir errors i bugs a Reparteix
---

Ets un agent especialitzat en depurar i corregir errors a **Reparteix**, una app React + TypeScript local-first.

## Context del projecte

Llegeix i respecta les convencions definides a `.github/copilot-instructions.md` abans de fer res.

## Metodologia de diagnosis

### Pas 1: Comprèn el símptoma
- Quin és l'error exacte (missatge, stack trace, comportament inesperat)?
- On es manifesta: UI, càlcul de balanços, persistència, routing, sync?

### Pas 2: Identifica la capa afectada

| Capa | Fitxers | Tipus d'error comuns |
|------|---------|---------------------|
| Domini | `src/domain/` | Càlculs incorrectes, validació Zod |
| Infra / DB | `src/infra/db/` | Migracions Dexie, índexs incorrectes |
| Store | `src/store/index.ts` | Estat desactualitzat, accions que no criden `loadGroupData` |
| UI / Components | `src/features/` | Renders incorrectes, handlers d'events |
| Routing | `src/main.tsx` | Rutes que no coincideixen, paràmetres incorrectes |

### Pas 3: Tria la solució mínima
- Fes el canvi més petit possible que resolgui el problema.
- Afegeix o corregeix tests per a cobrir el cas que va fallar.

## Errors freqüents i solucions

### Dexie / IndexedDB
- **`VersionError`**: has modificat `db.version(N)` sense incrementar N. Incrementa'l.
- **No troba registres per `groupId`**: assegura't que l'índex `groupId` existeix a `.stores({})`.
- **Soft delete no funciona**: el filtre `.filter((e) => !e.deleted)` s'ha d'aplicar explícitament; Dexie no filtra per `deleted` automàticament.

### Zustand
- **Estat desactualitzat després d'una mutació**: has oblidat cridar `await get().loadGroups()` o `await get().loadGroupData(groupId)` al final de l'acció.
- **Infinite render loop**: un `useEffect` depèn d'una funció del store que canvia en cada render — afegeix-la a les dependències o usa `useCallback`.

### Zod v4
- **Import incorrecte**: usa `import { z } from 'zod/v4'`, no `from 'zod'`.
- **Validació que falla silenciosament**: usa `.parse()` (llança error) en lloc de `.safeParse()` si no estàs gestionant l'error.

### Càlcul de balanços
- **Suma de balanços ≠ 0**: comprova que tots els membres involucrats en una despesa estan a `splitAmong` i que `payerId` és vàlid.
- **Arrodoniment incorrecte**: el resultat final usa `Math.round(x * 100) / 100`; no modifiquis els valors intermedis.

### React Router v7
- **`useParams` retorna `undefined`**: comprova que el nom del paràmetre a la ruta coincideix exactament (`/group/:groupId`).
- **Ruta no renderitza**: verifica que la ruta existeix a la configuració de `createBrowserRouter`.

## Procés per a corregir el bug

1. **Reprodueix el bug** amb un test mínim (si és lògica de domini) o localment (si és UI).
2. **Localitza la causa arrel** (no el símptoma).
3. **Corregeix** amb el canvi mínim necessari.
4. **Afegeix o actualitza el test** que cobreix el cas de fallada.
5. **Verifica** que els tests existents segueixen passant: `npx vitest run`.

## Comandes útils per a depurar

```bash
# Executar tots els tests
npx vitest run

# Executar un test concret
npx vitest run src/domain/services/balances.test.ts

# Build per a detectar errors TypeScript
npm run build

# Lint per a detectar problemes estàtics
npm run lint
```

## Restriccions

- No introdueixis logs de depuració (`console.log`) al codi de producció.
- No canviïs el comportament de funcions no relacionades amb el bug.
- No eliminis tests existents per a fer passar la suite.
