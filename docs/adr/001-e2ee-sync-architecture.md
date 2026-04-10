# ADR 001: Arquitectura de Sincronització E2EE (Producció)

## Context
Volem permetre que un grup de Reparteix es pugui sincronitzar entre múltiples dispositius sense dependre d'un backend centralitzat que pugui llegir les dades. La funcionalitat ha de ser de grau de producció: usable, resilient, segura i sense fricció tècnica per a l'usuari.

## Requisits de Producció
1. **Privacitat total (E2EE)**: Les dades mai viatgen en clar. S'usa una clau simètrica per grup.
2. **Descentralització (0-backend propi)**: Ús de WebRTC (p2p) amb STUN/TURN públics i un servidor de signaling genèric (PeerJS).
3. **UX Transparant**: L'usuari només genera un enllaç d'invitació i el comparteix. No veu configuracions de xarxa.
4. **Resolució de Conflictes**: Fusió automàtica de dades concurrents usant CRDTs (Yjs).
5. **Model de disponibilitat**: Com que no hi ha base de dades central, la sincronització directa requereix que com a mínim un dispositiu amb les dades estigui actiu (o dissenyar un relay xifrat mínim, que de moment es descarta per mantenir cost 0).

## Decisió Arquitectònica

### 1. Capa de Dades (CRDT)
S'utilitzarà **Yjs** per gestionar l'estat del grup.
- Cada grup tindrà el seu propi `Y.Doc`.
- Les dades es persistiran localment a IndexedDB (`y-indexeddb`).

### 2. Capa de Seguretat (E2EE)
- En crear un grup sincronitzat, es genera una **Group Key** (AES-GCM 256).
- Aquesta clau **no surt mai del dispositiu** de forma pública. S'inclou en l'enllaç d'invitació (via hash/fragment que no s'envia al servidor).
- Tots els updates de Yjs es xifren amb la Group Key abans d'enviar-se per qualsevol canal de transport.

### 3. Capa de Transport (WebRTC)
- S'usarà **PeerJS** per a l'establiment de connexions WebRTC.
- Cada client genera un Peer ID determinista o efímer, derivat del Group ID, per trobar-se a la sala de signaling.
- Un cop connectats via WebRTC, s'intercanvien els updates xifrats de Yjs.

### 4. Flux d'Usuari (Onboarding de Sync)
1. **Iniciador**: Un usuari amb un grup local clica "Sincronitzar aquest grup".
2. **Generació**: Es crea la Group Key i es genera un enllaç tipus `https://reparteix.cat/#/join?g=GROUP_ID&k=KEY_BASE64`.
3. **Receptor**: Obre l'enllaç. L'app extreu la clau, es connecta a la sala de signaling del `GROUP_ID`, troba l'iniciador i descarrega l'estat inicial de Yjs.

## Conseqüències i Limitacions
- **"Store and forward" limitat**: Si dos usuaris fan canvis offline i no coincideixen mai online alhora, no es sincronitzaran fins que coincideixin. La UX ha de deixar molt clar quan un grup està "Sincronitzat" o "Pendent de connexió".
- **Mida de l'enllaç**: L'enllaç conté la clau mestra del grup, qui tingui l'enllaç té accés al grup si intercepta el trànsit.

## Fases d'Implementació
1. **Fase 1**: Refactor de l'estat actual per suportar Yjs internament (sense transport).
2. **Fase 2**: Implementació del mòdul E2EE i integració Yjs + IndexedDB.
3. **Fase 3**: Transport WebRTC i sala de signaling (PeerJS).
4. **Fase 4**: UX de producció (enllaços, estats de connexió, gestió d'errors).
