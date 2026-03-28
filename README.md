# Reparteix

Alternativa a Splitwise pensada per ús personal i grups petits, amb arquitectura **local-first**, funcionament **offline**, i sincronització entre usuaris des del navegador.

## Objectiu

- 100% web app (sense servidor backend propi)
- Deployable a GitHub Pages
- Dades locals al navegador (IndexedDB)
- Compartició d'un mateix grup entre diverses persones
- Sincronització eventual (no cal real-time)
- Privadesa: dades xifrades client-side

## Com començar

```bash
npm install
npm run dev      # Servidor de desenvolupament
npm run test     # Executar tests
npm run build    # Build de producció
npm run lint     # Linter
```

## Stack

| Categoria | Tecnologia |
|-----------|-----------|
| Frontend | React + TypeScript + Vite |
| UI | TailwindCSS |
| State | Zustand |
| Persistència local | IndexedDB via Dexie |
| Validació | Zod |
| Routing | React Router |
| Testing | Vitest + React Testing Library |
| Build/deploy | GitHub Actions + GitHub Pages |

## Arquitectura

### 1) Client local-first
Cada client guarda totes les dades del grup localment (IndexedDB):
- operacions fluides i offline
- UI immediata
- cua de canvis (oplog)

### 2) Format de dades
Entitats principals:
- `groups` (id, nom, moneda, membres)
- `members` (id, nom, color)
- `expenses` (id, descripció, import, pagador, data, splitAmong)
- `payments` (id, from, to, amount, date)

Totes les entitats porten:
- `id` (UUID)
- `createdAt`, `updatedAt`
- `deleted` (soft delete)

### 3) Càlcul de balanços
Pipeline:
1. Sumar deutes bruts per membre (pagaments fets vs. beneficis rebuts)
2. Netejar (creditor/debtor)
3. Minimitzar transferències (greedy matching)

Sortida:
- "A paga X a B"
- Llista de transferències suggerides

### 4) Sync sense backend custom (futur)
**Opció MVP:** GitHub Gist com a magatzem de snapshot xifrat.

- Cada grup té un `syncTarget` (gist id)
- `push`: publica snapshot + marcador de versió
- `pull`: descarrega snapshot i fusiona
- Resolució de conflictes: Last-Write-Wins per registre (`updatedAt`)

### 5) Xifrat (futur)
- Derivar clau via passphrase del grup (PBKDF2/WebCrypto)
- Xifrar payload amb AES-GCM
- El remot només veu blobs xifrats

## Estructura del projecte

```txt
reparteix/
  src/
    domain/
      entities/       # Entitats amb Zod schemas
      services/       # Lògica de negoci (balanços)
    infra/
      db/             # IndexedDB via Dexie
    features/
      groups/         # UI grups (llista + detall)
      expenses/       # UI despeses
      balances/       # UI balanços i liquidacions
    store/            # Zustand state management
    test/             # Setup de tests
  public/
```

## Roadmap

### Fase 0 — Setup ✅
- [x] Inicialitzar Vite + TS
- [x] Configurar Tailwind + linter
- [x] Configurar Vitest

### Fase 1 — Core local ✅
- [x] Crear grup i membres
- [x] Alta/eliminació de despeses
- [x] Càlcul de balanços i transferències suggerides
- [x] Persistència IndexedDB

### Fase 2 — Sync bàsic (futur)
- [ ] Configurar passphrase de grup
- [ ] Snapshot xifrat a Gist
- [ ] Pull/push manual
- [ ] Merge LWW + detector de conflictes

### Fase 3 — UX i robustesa (futur)
- [ ] Historial d'activitat
- [ ] Import/export local JSON
- [ ] Avisos d'errors de sync
- [ ] Edició de despeses

### Fase 4 — Publicació (futur)
- [ ] Deploy GitHub Pages
- [ ] Documentació d'ús
- [ ] Dades d'exemple

## Decisions tècniques

1. **No backend propi** per reduir cost i operativa.
2. **Local-first** per UX ràpida i offline.
3. **Sync eventual** suficient per ús personal/grup petit.
4. **Xifrat client-side** per privadesa en un storage públic/extern.
5. **LWW al MVP** per simplicitat, amb opció CRDT a futur.

## Llicència

MIT
