# Reparteix

Alternativa a Splitwise pensada per ús personal i grups petits, amb arquitectura **local-first** i funcionament **100% offline**. Les dades es guarden al navegador.

## Funcionalitats

- Crear grups amb membres, icona i moneda (EUR / USD / GBP)
- Afegir despeses i repartir-les entre els membres del grup (repartiment igual o proporcional)
- Adjuntar imatge del rebut a cada despesa
- Reanomenar membres del grup
- **Arxivar grups** — passa el grup a mode només lectura preservant tot l'historial; desarxivar restaura l'edició
- Càlcul automàtic de balanços i transferències mínimes
- Comparativa de deute net: transferències naïves vs optimitzades (% reducció)
- Registre de pagaments (settlements)
- Exportació i importació de grups en format `.reparteix.json` versionat (còpia de seguretat i migració)
- Obertura directa de fitxers `.reparteix.json` des de la PWA instal·lada (File Handling API)
- Retrocompatible amb format d'export antic (legacy)
- PWA instal·lable amb funcionament offline complet
- Actualitzacions automàtiques amb avís a l'usuari
- Mode fosc amb detecció automàtica de preferència del sistema i commutador manual (clar / fosc / sistema)
- Headless SDK per a ús programàtic sense UI
- **Sincronització P2P** entre dispositius via WebRTC — xifrat extrem a extrem (AES-256-GCM)
- Configuració flexible: servidors públics per defecte, o PeerJS/STUN/TURN propis (self-hosted)

## Stack tècnic

| Capa | Tecnologia |
|------|-----------|
| Frontend | React 19 + TypeScript |
| Build | Vite 8 |
| Estils | TailwindCSS v4 (classes inline) |
| Components UI | shadcn/ui (Radix UI + Lucide icons) |
| Estat global | Zustand 5 |
| Persistència | Dexie 4 (IndexedDB) |
| Validació | Zod v4 |
| Routing | React Router v7 (HashRouter) |
| PWA | vite-plugin-pwa (Workbox) |
| Tests | Vitest + @testing-library/jest-dom |
| Releases | semantic-release (Conventional Commits) |
| Deploy | GitHub Actions → GitHub Pages |
| Transport P2P | PeerJS 1.x (WebRTC data channels) |
| Xifrat | WebCrypto API (AES-256-GCM + PBKDF2) |

## Arquitectura

### Local-first

Totes les dades es guarden localment al navegador via IndexedDB. L'app funciona completament sense connexió a internet.

### Model de dades

Entitats principals (definides amb esquemes Zod a `src/domain/entities/`):

- **Group** — `id`, `name`, `description?`, `icon?`, `currency`, `members[]`, `archived` (read-only flag)
- **Member** — `id`, `name`, `color` (embegut dins del grup)
- **Expense** — `id`, `groupId`, `description`, `amount`, `payerId`, `splitAmong[]`, `splitType?`, `splitProportions?`, `date`, `receiptImage?`
- **Payment** — `id`, `groupId`, `fromId`, `toId`, `amount`, `date`

Totes les entitats porten camps comuns: `id` (UUID), `createdAt`, `updatedAt`, `deleted` (soft delete).

### Càlcul de balanços

1. Suma les contribucions de cada pagador i resta la part proporcional de cada participant
2. Incorpora els pagaments registrats
3. Minimitza el nombre de transferències amb un algorisme greedy (ordenant creditors i deutors per import descendent)
4. Mòdul de **netting** (`netting.ts`): compara transferències naïves (O(deutors × creditors)) amb les minimitzades, mostrant el nombre estalviat i el % de reducció
5. Arrodoniment a 2 decimals: `Math.round(x * 100) / 100`

### SDK headless

L'arxiu `src/sdk.ts` exporta un objecte `reparteix` amb totes les operacions de negoci (CRUD de grups, membres, despeses, pagaments, balanços, liquidacions, i exportació/importació de grups) sense dependre de la UI. El store Zustand delega al SDK.

### Sincronització P2P

Sincronització directa entre navegadors sense servidor propi:

- **Transport**: WebRTC data channels via PeerJS (signaling públic per defecte)
- **Xifrat**: AES-256-GCM amb clau derivada de contrasenya de grup (PBKDF2, 100.000 iteracions)
- **Protocol**: missatges tipats (hello, request-sync, sync-data, sync-ack, error) validats amb Zod
- **Merge**: Last-Write-Wins per `updatedAt` amb detecció de conflictes i integritat referencial
- **Configuració**: servidors PeerJS/STUN/TURN configurables per a instal·lacions self-hosted

Flux de sincronització:
1. Dispositiu A prem «Compartir» → s'obre sessió i espera peer
2. Dispositiu B prem «Rebre» amb la mateixa contrasenya → es connecta automàticament
3. Les dades es xifren, s'intercanvien i es fusionen amb LWW
4. Ambdós dispositius queden sincronitzats

Documentació detallada: `docs/adr/001-sync-architecture.md`

## Estructura del projecte

```
src/
  domain/
    entities/         # Esquemes Zod i tipus TypeScript
    services/         # Lògica pura (sense efectes secundaris)
  infra/
    db/               # Dexie — base de dades IndexedDB
  features/
    groups/           # GroupList, GroupDetail, GroupSettings
    expenses/         # ExpenseList
    balances/         # BalanceView
    settlements/      # SettlementList
  store/              # Zustand store (accions + selectors)
  components/
    ui/               # Components shadcn/ui (Button, Card, Tabs, etc.)
    Footer.tsx
    ThemeToggle.tsx    # Commutador de tema (clar/fosc/sistema)
    PWAUpdatePrompt.tsx
  hooks/              # Hooks personalitzats (useTheme, useFileHandler)
  lib/                # Utilitats (cn() per a classes Tailwind)
  sdk.ts              # API headless per a ús programàtic
  sdk.test.ts         # Tests del SDK
  test/               # Setup global de tests
```

## Com començar

```bash
# Instal·lar dependències
npm install

# Servidor de desenvolupament
npm run dev

# Lint
npm run lint

# Tests
npm run test            # execució única
npm run test:watch      # mode watch

# Build de producció (inclou typecheck)
npm run build
```

## Desplegament

L'app es desplega automàticament a **GitHub Pages** amb cada push a `main`.

- `vite.config.ts` configurat amb `base` dinàmic via `VITE_BASE_PATH` (per defecte `/`)
- Workflow: `.github/workflows/deploy-pages.yml`

### Previews de PR

Cada pull request genera automàticament un desplegament de preview a:

- `https://staging.reparteix.cat/pr-<PR_NUMBER>/`

El workflow `.github/workflows/pr-preview.yml` s'executa en els events `opened`, `synchronize` i `reopened` de PR, i:

1. Compila l'app amb `VITE_BASE_PATH=/pr-<PR_NUMBER>/`
2. Publica el build al repositori `reparteix/staging`
3. Comenta a la PR amb l'URL de preview

Quan la PR es tanca, el workflow elimina el directori de preview i actualitza el comentari.

**Requisits:**

- Secret `STAGING_TOKEN` amb permisos d'escriptura al repositori `reparteix/staging`
- DNS configurat: `staging.reparteix.cat CNAME reparteix.github.io`
- GitHub Pages habilitat a `reparteix/staging` des de la branca `main`

> **Nota:** Les PRs de forks no generen preview perquè no tenen accés als secrets del repositori.

### Releases automàtics

El projecte usa [semantic-release](https://semantic-release.gitbook.io/semantic-release/) amb [Conventional Commits](https://www.conventionalcommits.org/):

| Prefix | Efecte |
|--------|--------|
| `fix:` | patch (`1.0.0` → `1.0.1`) |
| `feat:` | minor (`1.0.0` → `1.1.0`) |
| `BREAKING CHANGE` o `!` | major (`1.0.0` → `2.0.0`) |
| `chore:`, `docs:`, `refactor:`, `test:` | sense release |

Configuració a `.releaserc.json`, workflow a `.github/workflows/release.yml`.

## Decisions de disseny

1. **Sense backend propi** — tota la lògica és client-side.
2. **Local-first** — l'app funciona 100% offline, dades a IndexedDB.
3. **Soft delete** — les entitats es marquen com `deleted: true`, mai s'esborren físicament.
4. **HashRouter** — per compatibilitat amb hosting estàtic (GitHub Pages).
5. **PWA** — instal·lable i amb service worker per a cache offline.

## Manteniment de la documentació

> **⚠️ Regla important:** Quan s'introdueixin canvis que afectin les funcionalitats, l'arquitectura, l'stack tècnic o les convencions del projecte, cal actualitzar **immediatament** els fitxers de documentació:
>
> - `README.md` — descripció del projecte, stack, funcionalitats, estructura
> - `SKILL.md` — referència de l'API del SDK, entitats, convencions (actualitza també la `version` del frontmatter)
> - `.github/copilot-instructions.md` — convencions globals per als agents
> - `.github/agents/*.md` — instruccions específiques per a cada agent

## Possibles evolucions

- Historial d'activitat
- Proveïdors de sync alternatius (Dropbox, WebDAV)
- Sincronització amb relay persistent per a sync asíncron (quan els peers no coincideixen online)

## Llicència

MIT
