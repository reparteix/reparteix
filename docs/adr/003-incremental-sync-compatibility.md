# ADR-003: Incremental sync with backward-compatible fallback

## Status

Proposed

## Context

Sync v1 exchanges a full encrypted `SyncEnvelopeV1` snapshot for a group and merges entities with the current LWW rules. This is robust and easy to reason about, but it becomes inefficient when only a small subset of a group changed.

ADR-002 already points toward Sync v2 and a future CRDT-backed model. Issue #184 focuses on the intermediate architecture question: how to evolve from full-snapshot sync to incremental sync without breaking existing data, clients, imports, or encrypted transport assumptions.

The design must handle mixed environments:

- clients that only support the current full-sync protocol
- clients that support incremental sync
- existing groups and entities created before device identity metadata existed
- imported/exported data that may not preserve device metadata
- peers that have the group passphrase but unknown protocol capabilities

## Decision

We will add incremental sync as an optional protocol capability, not as a replacement for full-sync.

The compatibility contract is:

1. **Full-sync remains the mandatory baseline.** Every sync-capable client must support encrypted full-snapshot exchange.
2. **Incremental sync is negotiated per session.** A peer may use it only when both sides explicitly advertise compatible support.
3. **Fallback is automatic and safe.** If capabilities are missing, incompatible, or ambiguous, the session falls back to full-sync.
4. **Legacy data remains valid.** Missing device metadata must never make a group unsyncable.
5. **Full-sync remains the recovery path.** Users and the runtime can force a full resync when incremental state is suspicious or unavailable.

## Protocol capabilities

Add a capability negotiation step during `hello` / handshake.

Recommended shape:

```ts
type SyncCapability = 'full-sync' | 'incremental-sync-v1'

type SyncHelloV2 = {
  type: 'hello'
  groupId: string
  protocolVersion: 2
  capabilities: SyncCapability[]
  deviceId?: string
}
```

Rules:

- clients that do not send `capabilities` are treated as `['full-sync']`
- incremental mode requires both peers to include `incremental-sync-v1`
- if any required field is missing or malformed, use full-sync
- encrypted payload format remains app-level encrypted above transport, as in ADR-001

## Metadata model

Incremental sync needs enough metadata to detect changed records without requiring a full CRDT migration first.

Add metadata at the entity level for new writes:

```ts
type SyncEntityMeta = {
  updatedAt: string
  updatedByDeviceId?: string
  syncRevision?: string
}
```

Semantics:

- `updatedAt` keeps the current LWW compatibility path
- `updatedByDeviceId` identifies the writer when known
- `syncRevision` is a monotonic or sortable per-device revision token when available
- missing `updatedByDeviceId` or `syncRevision` means the record is legacy-compatible, not invalid

For legacy records:

- preserve existing values as-is
- never invent a device ID during import unless the user performs an actual edit
- when edited by a new client, stamp the new metadata on that edited entity only

## Incremental strategy

Use a timestamp/frontier delta as the first incremental sync version.

A peer stores per-group sync state:

```ts
type GroupSyncFrontier = {
  groupId: string
  peerDeviceId?: string
  lastFullSyncAt?: string
  lastIncrementalSyncAt?: string
  entityWatermark?: string
  perDeviceRevision?: Record<string, string>
}
```

For `incremental-sync-v1`:

1. peer A announces its frontier for the group
2. peer B sends entities changed after the relevant watermark/frontier
3. both peers merge using the existing entity merge rules
4. if either side detects an unsafe gap, it requests full-sync

This is intentionally conservative. It reduces payload size for normal repeated sync while keeping the existing snapshot merge as the correctness baseline.

## Why not a change journal first?

A journal/oplog is attractive for precise incremental sync, but it creates a stronger migration burden:

- existing groups do not have historical operations
- imports may not include operation history
- pruning and compaction become product-visible correctness questions
- conflict handling would need a larger redesign

A journal remains compatible with the future CRDT/Yjs direction in ADR-002, but it should not be the first incremental step.

## Conflict and legacy behavior

When a peer receives incremental data:

- merge known entities with the existing LWW/domain rules
- accept legacy entities without device metadata
- mark ambiguous conflicts for later UI if deterministic merge is unsafe
- request full-sync if the peer cannot prove its frontier is complete

Fallback to full-sync when:

- the remote peer lacks incremental capability
- device identity is missing for the session
- local frontier is missing, corrupted, or too old
- merge detects an entity reference gap
- the user selects a recovery/full-resync action

## Rollout plan

### Phase 1: compatibility foundation

- add protocol capability negotiation
- persist per-group device identity and sync frontier
- keep all sessions on full-sync unless both peers negotiate incremental
- add diagnostics for selected mode and fallback reason

### Phase 2: incremental-sync-v1

- send changed entities after the known watermark/frontier
- merge with current LWW/domain rules
- fallback automatically to full-sync on unsafe gaps
- add tests for mixed legacy/new clients

### Phase 3: recovery and product polish

- expose `lastFullSyncAt`, `lastIncrementalSyncAt`, payload size and fallback reason in diagnostics
- add manual full-resync recovery action
- prepare conflict UI hooks for entities that cannot be safely auto-merged

### Phase 4: future CRDT/journal work

- evaluate whether Yjs/CRDT state from ADR-002 should replace the delta approach
- optionally introduce an operation journal for entities that need causality
- keep full-sync as bootstrap and recovery even if the internal representation evolves

## Consequences

### Positive

- existing clients and exported data remain compatible
- incremental sync can ship without a big-bang protocol migration
- full-sync remains a simple recovery path
- device metadata improves diagnostics and future conflict handling
- leaves room for the CRDT/Yjs direction from ADR-002

### Negative / risks

- timestamp/frontier deltas are less precise than a true operation log
- LWW conflicts are still possible until richer conflict handling lands
- per-peer frontier persistence adds state that can become stale
- payload reduction depends on consistent `updatedAt` and metadata stamping

### Mitigations

- always support full-sync fallback
- treat missing metadata as legacy, not fatal
- add diagnostics for mode and fallback decisions
- prefer conservative full-sync over risky partial merge when uncertain

## Follow-up implementation issues

Recommended slices after this ADR:

1. Add protocol capability negotiation and full-sync fallback reason tracking.
2. Persist per-group device identity and sync frontier metadata.
3. Implement `incremental-sync-v1` entity delta exchange with tests.
4. Add diagnostics and manual force-full-resync UI.
5. Revisit CRDT/Yjs or journal-based replication once the compatibility layer is stable.

## References

- ADR-001: `docs/adr/001-sync-architecture.md`
- ADR-002: `docs/adr/002-sync-v2-multi-device-crdt.md`
- Sync v2 plan: `docs/sync-v2-plan.md`
- Issue #184: <https://github.com/reparteix/reparteix/issues/184>
