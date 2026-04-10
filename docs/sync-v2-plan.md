# Sync v2 Plan

This document turns ADR-002 into an implementation plan with concrete acceptance criteria.

## Product outcome

The end state for Sync v2 is:

- the user sees a single action: **Sincronitzar**
- the same group can sync across **multiple users and multiple devices**
- synchronization can be retried periodically, not only as a one-shot transfer
- conflicts are resolved more safely than plain `updatedAt`-only LWW
- the UI explains sync status instead of hiding it

## Non-goals for the first v2 increment

These should not block the first usable v2 milestone:

- full Google Docs style real-time collaboration
- perfect background sync on all browsers
- member revocation / key rotation fully solved
- async relay infrastructure in the first milestone

## Acceptance criteria by phase

### Phase 1, UX and orchestration

Goal: move from "share/receive" to "sync" and prepare the runtime for repeated reconciliation.

#### Scope

- replace explicit **Compartir / Rebre** branching with a single **Sincronitzar** flow
- make session state multi-peer aware
- add retry loop while sync is active
- expose sync diagnostics in UI

#### Acceptance criteria

- user can open sync for a group and press a single main action
- session status can represent more than one remote peer
- sync retries happen automatically while the sync surface is open
- UI shows:
  - last successful sync time
  - current peers seen / connected
  - last failure reason
- existing Sync v1 behavior does not regress for the simple two-peer case

#### Suggested implementation slices

1. `SyncSessionStatus`
   - replace `remotePeerId: string | null` with a peer collection
2. sync coordinator
   - separate discovery / connection / reconciliation lifecycle
3. UI
   - replace send/receive buttons with one sync action
   - add sync status panel

### Phase 2, replicated state prototype

Goal: validate a CRDT-backed model for Reparteix group data.

#### Scope

- prototype Yjs-backed group document
- map group, members, expenses and payments into replicated structures
- validate encrypted payload exchange over current transport

#### Acceptance criteria

- two peers can exchange incremental updates without sending a full snapshot every time
- concurrent edits made on both sides converge deterministically
- same-device refresh preserves replicated state through persistence
- encryption boundary is still above transport

#### Open design questions

- one Y.Doc per group vs split docs by entity type
- how to persist CRDT state in IndexedDB cleanly
- whether app-level encryption wraps update batches or a higher-level envelope

### Phase 3, conflict handling and reliability

Goal: make the system operationally useful in real life.

#### Scope

- add conflict visibility for hard cases
- improve retry and peer availability heuristics
- prepare optional async relay path

#### Acceptance criteria

- users can see unresolved conflicts when automation is insufficient
- the app can retry sync without user micromanagement
- multi-device sync is stable enough for normal repeated usage
- architecture leaves room for optional encrypted relay without rewriting the domain model

## Suggested technical backlog

### Runtime / coordinator

- [x] `SyncSessionStatus` supports many peers
- [x] primary entry point auto-creates or auto-joins a sync session
- [ ] sync coordinator distinguishes discovery, sync round, retry backoff and idle states
- [ ] periodic retry loop with visibility-aware throttling
- [ ] sync journal persisted per group

### UI / product

- [x] replace send/receive with unified sync CTA
- [ ] add explicit "last synced" and "last error" indicators
- [x] add peer list / presence summary
- [ ] add conflict banner or resolution entry point
- [x] expose basic runtime diagnostics (`lastAttemptAt`, `lastSuccessAt`)

### Data model

- [ ] identify which entities can stay LWW and which need CRDT semantics
- [ ] prototype Yjs schema for group data
- [ ] define persistence strategy for replicated document state
- [ ] define migration path from snapshot sync to incremental sync

### Security

- [ ] define key ownership model for multi-device sync
- [ ] define how new peers get authorized
- [ ] leave extension points for future re-keying

## Additional ideas worth evaluating

These are not mandatory for the first milestone, but they are likely valuable:

- device naming, so sync status can say "Edu iPhone" / "MacBook" instead of anonymous peers
- change summaries after sync, for example "2 despeses noves, 1 pagament actualitzat"
- explicit manual "force full resync" action for recovery
- optional async encrypted relay for peers that are never online together

## Delivery recommendation

The safest path is:

1. keep PR #100 as Sync v1
2. use PR #104 for v2 artifacts and early implementation slices
3. land Phase 1 first before committing the whole codebase to a CRDT migration
