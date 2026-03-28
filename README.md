# Reparteix

Alternativa a Splitwise pensada per ús personal i grups petits, amb arquitectura **local-first**, funcionament **offline**, i sincronització entre usuaris des del navegador.

## Objectiu

- 100% web app (sense servidor backend propi)
- Deployable a GitHub Pages
- Dades locals al navegador
- Compartició d'un mateix grup entre diverses persones
- Sincronització eventual (no cal real-time)
- Privadesa: dades xifrades client-side

## Stack proposat

- **Frontend:** React + TypeScript + Vite
- **UI:** TailwindCSS + shadcn/ui
- **State:** Zustand
- **Persistència local:** IndexedDB via Dexie
- **Validació:** Zod
- **Routing:** React Router
- **Build/deploy:** GitHub Actions + GitHub Pages
- **Testing:** Vitest + React Testing Library

## Arquitectura

### 1) Client local-first
Cada client guarda totes les dades del grup localment (IndexedDB):
- operacions fluides i offline
- UI immediata
- cua de canvis (oplog)

### 2) Format de dades
Entitats principals:
- `groups` (id, nom, moneda, membres)
- `members` (id, nom, alias, color)
- `expenses` (id, descripció, import, pagador, data)
- `splits` (expenseId, memberId, amount)
- `payments` (id, from, to, amount, date)
- `oplog` (operations append-only)

Totes les entitats porten:
- `id` (ULID/UUID)
- `updatedAt`
- `deviceId`
- `deleted` (soft delete)

### 3) Sync sense backend custom
**Opció MVP:** GitHub Gist com a magatzem de snapshot xifrat.

- Cada grup té un `syncTarget` (gist id)
- `push`: publica snapshot + marcador de versió
- `pull`: descarrega snapshot i fusiona
- Resolució de conflictes:
  - nivell MVP: Last-Write-Wins per registre (`updatedAt`, `deviceId`)
  - evolució: CRDT lleuger per camps amb edició concurrent

### 4) Xifrat
- Derivar clau via passphrase del grup (PBKDF2/WebCrypto)
- Xifrar payload amb AES-GCM
- El remot només veu blobs xifrats

### 5) Càlcul de balanços
Pipeline:
1. sumar deutes bruts per membre
2. netejar (creditor/debtor)
3. minimitzar transferències (greedy matching)

Sortida:
- “A paga X a B”
- opcional: consolidar per rondes

## Estructura del projecte

```txt
splitwise-browser/
  src/
    app/
    domain/
      entities/
      services/
      sync/
    infra/
      db/
      crypto/
      sync/
    features/
      groups/
      expenses/
      balances/
      settlements/
    shared/
  docs/
    architecture.md
    data-model.md
    sync-protocol.md
  public/
```

## Roadmap (MVP → v1)

### Fase 0 — Setup (1 dia)
- [ ] Inicialitzar Vite + TS
- [ ] Configurar Tailwind + linter + format
- [ ] CI bàsic (test + build)

### Fase 1 — Core local (3-4 dies)
- [ ] Crear grup i membres
- [ ] Alta/edició/eliminació de despeses
- [ ] Càlcul de balanços
- [ ] Persistència IndexedDB

### Fase 2 — Sync bàsic (3-4 dies)
- [ ] Configurar passphrase de grup
- [ ] Snapshot xifrat a Gist
- [ ] Pull/push manual
- [ ] Merge LWW + detector de conflictes

### Fase 3 — UX i robustesa (2-3 dies)
- [ ] Historial d'activitat
- [ ] Import/export local JSON
- [ ] Avisos d'errors de sync
- [ ] Tests de domini

### Fase 4 — Publicació (1 dia)
- [ ] Deploy GitHub Pages
- [ ] Documentació d'ús
- [ ] Dades d'exemple

## Decisions tècniques (ADR resum)

1. **No backend propi** per reduir cost i operativa.
2. **Local-first** per UX ràpida i offline.
3. **Sync eventual** suficient per ús personal/grup petit.
4. **Xifrat client-side** per privadesa en un storage públic/extern.
5. **LWW al MVP** per simplicitat, amb opció CRDT a futur.

## Riscos i mitigacions

- **Conflictes de sincronització:** mostrar diff resum + resolució guiada
- **Pèrdua de passphrase:** no recuperable (documentar bé)
- **Rate limits API:** batching de sync i botó manual “Sincronitza”
- **Canvi de proveïdor sync:** encapsular `SyncProvider` amb interfície

## Possibles evolucions

- Proveïdors alternatius: Dropbox / WebDAV / Supabase Storage (mateix contracte)
- Realtime opcional: Yjs + WebRTC
- PWA instal·lable
- Compartició amb enllaç + invitació xifrada

## Com començar (quan s’implementi)

```bash
npm install
npm run dev
npm run test
npm run build
```

## Llicència

MIT
