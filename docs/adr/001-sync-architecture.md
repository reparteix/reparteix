# ADR-001: Sync Architecture — WebRTC + PeerJS + App-Level Encryption

## Status

Accepted (PoC)

## Context

Reparteix is a local-first expense splitting app that stores all data in IndexedDB.
Users need a way to synchronize group data across devices and between participants
without relying on a backend server.

### Goals

1. **No backend server to maintain** — zero infrastructure cost
2. **Usable sync for small groups** (3–10 users)
3. **Strong privacy** at the application level
4. **Graceful degradation** when no peers are online
5. **Local-first persistence** as the source of truth

### Reference: FilePizza

[FilePizza](https://github.com/kern/filepizza) demonstrates that browser-to-browser
data transfer is viable using WebRTC with PeerJS for signaling and public STUN servers.
However, FilePizza transfers ephemeral files — Reparteix handles structured, sensitive
financial data that requires end-to-end encryption at the application layer.

## Decision

### Architecture Layers

```
┌─────────────────────────────────────────┐
│            Application Layer            │
│  SDK · Zustand Store · React UI         │
├─────────────────────────────────────────┤
│           Sync Protocol Layer           │
│  SyncEnvelopeV1 · LWW Merge · Messages │
├─────────────────────────────────────────┤
│          Encryption Layer               │
│  AES-GCM · PBKDF2 Key Derivation       │
│  Group Key · WebCrypto API              │
├─────────────────────────────────────────┤
│          Transport Layer                │
│  WebRTC Data Channels · PeerJS          │
│  STUN/TURN (configurable)              │
├─────────────────────────────────────────┤
│          Persistence Layer              │
│  Dexie (IndexedDB) · Local-first       │
└─────────────────────────────────────────┘
```

### Transport: WebRTC + PeerJS

- **WebRTC data channels** for direct peer-to-peer communication
- **PeerJS** for signaling and peer discovery (public server by default)
- **STUN servers** for NAT traversal (Google public STUN by default)
- **TURN servers** optional, for environments where direct P2P fails
- All endpoints are **configurable** — self-hosted or public

### Security: App-Level Encryption

WebRTC provides transport-level encryption (DTLS), but this is insufficient for
our threat model. We add application-level encryption:

- Each group has a **symmetric group key** (AES-256-GCM)
- The group key is derived from a **passphrase** using PBKDF2 (100,000 iterations)
- All sync payloads are encrypted before transmission
- The passphrase is shared out-of-band (QR code, link, or verbal)
- Key derivation uses a unique **salt** per group (stored with group metadata)

```
Passphrase + Salt ──PBKDF2──▶ AES-256-GCM Key
                                    │
SyncEnvelopeV1 ──JSON.stringify──▶ plaintext ──encrypt──▶ { iv, ciphertext }
                                                              │
                                              ◀──decrypt──────┘
```

### Sync Protocol

The sync protocol reuses the existing `SyncEnvelopeV1` format and `computeSyncMerge`
LWW merge logic. The P2P layer adds:

1. **Handshake**: peers exchange group IDs and verify mutual access
2. **Sync exchange**: encrypted `SyncEnvelopeV1` payloads
3. **Acknowledgment**: confirmation of successful merge

Message types:
- `hello` — announce peer identity and group membership
- `request-sync` — request full snapshot for a specific group
- `sync-data` — encrypted SyncEnvelopeV1 payload
- `sync-ack` — acknowledge successful sync

### Configuration: Public vs Self-Hosted

The sync infrastructure is configurable to support two operational modes:

**Mode A — Public (default, zero-config):**
- PeerJS: `0.peerjs.com:443`
- STUN: `stun.l.google.com:19302`
- No setup required

**Mode B — Self-hosted (optional):**
- Custom PeerJS server (host/port/path)
- Custom STUN/TURN servers
- Same frontend, different configuration

Configuration is read at runtime from `SyncConfig`, allowing environment-level
or build-time customization without rebuilding the frontend.

## Consequences

### Positive

- Zero infrastructure cost for default operation
- Strong privacy — data encrypted before leaving the device
- Same frontend for public and self-hosted setups
- Reuses existing LWW merge logic (well-tested)
- Graceful offline degradation (local-first persistence)

### Negative / Risks

- NAT/firewalls may block P2P connections (especially on mobile networks)
- Public STUN servers don't guarantee universal connectivity
- If TURN is needed for reliability, the "zero backend" goal is compromised
- Member revocation is difficult once snapshots are shared
- Async sync without a persistent relay degrades UX when peers aren't online simultaneously

### Mitigations

- TURN can be added as optional configuration without changing the protocol
- The encryption layer ensures even compromised relays can't read data
- Future work may add an optional encrypted relay (e.g., GitHub Gist) for async sync

## References

- [FilePizza](https://github.com/kern/filepizza) — WebRTC file transfer reference
- [PeerJS](https://peerjs.com/) — WebRTC signaling library
- [WebCrypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
- [Issue #63](https://github.com/reparteix/reparteix/issues/63) — Original exploration issue
