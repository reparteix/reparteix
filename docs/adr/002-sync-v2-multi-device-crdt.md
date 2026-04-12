# ADR-002: Sync v2 — Multi-device, periodic sync, and advanced conflict resolution

## Status

Proposed

## Context

The current sync implementation is useful as a first production step, but it is still fundamentally:

- peer-to-peer between two peers at a time
- snapshot-based
- merge-by-entity using `updatedAt` (LWW)
- oriented to an explicit "share / receive" interaction

That solves an important MVP, but it falls short for the product experience we actually want:

1. **Single action: sync** instead of "send" vs "receive"
2. **Multi-user / multi-device** behavior
3. **Periodic retry / background sync attempts**
4. **Advanced conflict resolution** beyond timestamp-only merge
5. **Clear path to eventual real-time collaboration**

## Decision

We will treat the current PR #100 as **Sync v1** and open a new line of work for **Sync v2** with these product and architecture goals.

### Product goals for Sync v2

- The user should see a single primary action: **Sincronitzar**
- Any peer with the group key should be able to join the sync mesh
- Sync should support **repeated attempts over time** instead of one-shot transfers only
- The system should merge concurrent edits more safely than plain LWW snapshots
- The UX should expose:
  - last successful sync
  - peers seen recently
  - sync status / retry state
  - unresolved conflicts when automation is insufficient

### Architecture goals for Sync v2

#### 1. Session model: mesh-ready, not 1:1

Replace the current single-remote-peer session model with a topology that can coordinate:

- 1 user with multiple devices
- multiple participants of the same group
- repeated sync rounds with more than one remote peer

Implications:
- `SyncSessionStatus` should track **many remote peers**, not just one `remotePeerId`
- orchestration should support **fan-out** and **incremental reconciliation**
- connection lifecycle should tolerate peers appearing/disappearing

#### 2. Sync mode: periodic reconciliation

Sync v2 should support retries and periodic attempts:

- manual sync trigger from UI
- auto-retry while the sync screen is open
- optional periodic background attempts on app resume / visibility change
- eventual cron/background strategies only if platform support exists later

The important shift is: sync is not a single transfer, but an ongoing reconciliation process.

#### 3. Conflict model: move toward operation-based or CRDT-backed sync

Current v1 uses snapshot exchange + LWW merge. For v2, the target direction is:

- **CRDT or CRDT-like replicated state** for the collaborative parts of a group
- deterministic merge without relying only on wall-clock timestamps
- explicit causal metadata or lamport/vector-style ordering where needed

Practical recommendation:
- evaluate **Yjs** as the primary candidate for shared replicated state
- keep app-level encryption above transport
- map Reparteix domain entities into a replicated document model

Why Yjs first:
- mature ecosystem
- good browser support
- proven multi-peer sync patterns
- better fit for incremental synchronization than repeated full snapshots

### Recommended Sync v2 layering

```
UI / Store
  -> Sync coordinator
  -> Replicated document model (Yjs candidate)
  -> App-level encryption
  -> WebRTC mesh transport
  -> Optional relay / signaling / async bridge
```

### Additional ideas worth including in v2

Beyond the points already requested, these are also worth adding:

1. **Per-group device identity**
   - know which device last synced
   - avoid ambiguous "someone changed something"

2. **Sync journal / diagnostics**
   - last sync time
   - peers reached
   - bytes exchanged
   - last failure reason

3. **Explicit conflict UI for hard cases**
   - most merges should be automatic
   - but impossible/ambiguous merges need a human-visible resolution path

4. **Optional async relay later**
   - pure P2P is great, but not enough when peers are never online together
   - future optional encrypted relay could improve reliability without giving up privacy

5. **Key rotation / membership changes**
   - if a participant leaves a group, key management becomes important
   - v2 should at least leave space for future re-keying

## Consequences

### Positive

- Aligns the product with the real user mental model: "sync my group"
- Opens the door to multi-device and multi-user reliability
- Reduces data-loss/conflict risk from timestamp-only merges
- Creates a clean architectural boundary between v1 and the more advanced model

### Negative / Risks

- Considerably more complexity than snapshot sync
- CRDT integration will affect store, persistence and protocol design
- Background sync in browsers is constrained by platform limitations
- Encryption over replicated docs needs careful design to avoid leaking metadata unnecessarily

## Implementation strategy

Sync v2 should land incrementally, not as a full rewrite in one go:

### Phase 1
- New session model with multi-peer awareness
- UI change from "Compartir/Rebre" to **"Sincronitzar"**
- periodic retry loop while sync is active
- sync diagnostics

### Phase 2
- Introduce replicated document abstraction
- prototype Yjs-backed group model
- validate encrypted multi-peer merge behavior

### Phase 3
- migrate from snapshot-first sync to incremental sync
- add conflict UI for non-trivial cases
- define optional async relay strategy

## Decision boundary

- **PR #100 remains Sync v1**
- **Sync v2 starts as a separate PR/track**, because the conceptual model changes enough that mixing both in one PR would create noise and accidental regressions

## References

- ADR-001: `docs/adr/001-sync-architecture.md`
- PR #100: current Sync v1 implementation line
- Candidate technology: Yjs
