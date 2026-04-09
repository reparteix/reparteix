# Sync PoC Architecture

## Goal

Build a first proof of concept for group sync in Reparteix with these constraints:

- no Reparteix-owned backend required for the default path
- local-first data model
- strong app-level privacy
- optional self-hosted signaling/connectivity endpoints

## Proposed stack

### Data model
- **Yjs** as the CRDT layer
- one Y.Doc per group
- IndexedDB persistence on each device

Why Yjs first:
- mature ecosystem for browser sync
- compact updates
- easier first PoC path than building custom merge logic

### Transport
- **WebRTC data channels** for peer-to-peer sync
- **PeerJS-compatible signaling** for peer discovery/session setup
- configurable **STUN/TURN** endpoints

Default mode:
- public PeerJS + public STUN

Advanced mode:
- self-hosted PeerJS + self-hosted STUN/TURN

## Security model for the PoC

Transport encryption from WebRTC is not enough.
The PoC should add an app-level envelope:

- each group has a random symmetric **group key**
- Yjs updates are encoded and encrypted before transport/persistence sync exchange
- invite flow shares the group key out of band or through an encrypted invitation payload

PoC simplification:
- no member revocation yet
- no key rotation yet
- focus on safe sharing between trusted initial members

## Config model

The frontend should stay the same in all modes.
Only these values change:

- signaling host/path
- STUN servers
- TURN servers
- feature flag to enable sync PoC

This should be injectable by config, not hardcoded.

## PoC milestones

### Milestone 1, local encrypted document
- create Y.Doc for a group
- persist locally
- encode/decode encrypted updates

### Milestone 2, two-browser sync
- connect two peers through WebRTC
- exchange encrypted Yjs updates
- verify balances/expenses converge

### Milestone 3, reconnect/offline
- reconnect after one peer goes offline
- ensure pending local changes sync correctly later

## Explicit non-goals for the first PoC

- perfect member revocation
- multi-device identity management
- background relay persistence when no peers are online
- production-ready UX

## Exit criteria

The PoC is successful if:

- two browsers can share one group and converge reliably
- data remains unreadable to signaling infrastructure
- config supports both public and self-hosted connectivity services
- the implementation is small enough to evolve into MVP instead of throwaway code
