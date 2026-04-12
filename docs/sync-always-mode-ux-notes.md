# Sync modes UX notes

This note explores whether sync should become a per-group mode instead of a purely manual action.

## Proposed modes

### Off

Use when:
- the group is personal or single-device
- the user does not want background sync
- the user wants zero sync surface/noise

UX implications:
- no active sync badge
- no retry/background behavior
- sync action available only as an explicit setup/enable action

### Manual

Use when:
- the user occasionally syncs between devices
- the group is shared, but not continuously active
- the user wants explicit control

UX implications:
- current product direction fits here
- user presses a single action when needed
- no continuous sync expectation

### Always

Use when:
- the group is active across multiple devices or users
- the user expects the group to stay fresh automatically
- the app has connectivity and permission to keep trying

UX implications:
- sync becomes part of the group state, not only a one-shot action
- app should attempt reconciliation whenever connectivity is available
- local changes should enqueue sync quickly if the group is connected
- UI must make status visible but calm

## Product concerns

### 1. Always mode changes the mental model

Manual sync is an action.
Always sync is a property of the group.

That means the UX should likely move from:
- "Do sync now"

to:
- "This group syncs automatically"
- "Status: connected / pending / offline / error"

### 2. Asking for sync mode during group creation can make sense, but only if lightweight

If added too early, it will feel heavy.
If added well, it can prevent later confusion.

A reasonable creation flow could be:
- Group name
- Members / currency as today
- Optional step: "Sincronització" with:
  - Off
  - Manual
  - Always
- If Manual or Always:
  - ask for group password

Alternative:
- keep creation simple
- after create, show a lightweight banner/card:
  - "Vols activar sincronització per aquest grup?"

This may be better for reducing setup friction.

## Recommended model

I would currently lean toward:

### Default
- new groups start in `off`

### Activation
- after group creation, offer:
  - "Activar sincronització"

### Then choose mode
- Manual
- Always

Why:
- avoids making every group creation heavier
- keeps sync opt-in
- still allows stronger setup for groups that need it

## Group-level visibility

A small group badge makes a lot of sense.

Possible badge states:
- `Sense sync`
- `Sync manual`
- `Sync automàtica`
- `Sync pendent`
- `Sync amb error`

This badge should probably appear:
- in group settings
- optionally in the group header if mode is Always

But it should stay subtle, not become top-level noise.

## Behavior when changes happen

If mode is Always, then yes: when local changes occur and connectivity exists, the app should try to sync.

But from product perspective, this should likely be:
- debounced/batched
- not immediate per keystroke/action
- visible as "pending" then "syncing" then "up to date"

Recommended behavior:
- local write happens
- group enters `pending sync`
- after short debounce/window, app tries to sync
- if peer not reachable, keep calm pending/offline state and retry later

## Mockup direction

### Group settings

**Sincronització**

This group can stay in sync across devices.

Mode:
- Off
- Manual
- Always

Password:
[ ************* ]

Status:
- Up to date
- Last sync 2 min ago

[ Guardar configuració ]

---

### Group header badge idea

`Sync automàtica · Al dia`
`Sync manual`
`Sync pendent`
`Sync amb error`

---

### Always mode status block

**Sincronització activada**
Aquest grup es posa al dia automàticament quan hi ha connexió.

Status: `Al dia`
Last sync: `fa 2 min`

[ Sincronitzar ara ]
[ Veure detalls ]

---

### Pending/offline state

**Sincronització automàtica**
Hi ha canvis pendents. Es provarà de sincronitzar quan hi hagi connexió.

Status: `Pendent`

[ Sincronitzar ara ]

## Risks

### 1. Always mode can overpromise

If browsers or devices sleep aggressively, users may interpret "always" as truly real-time.
The product must frame it more honestly as:
- automatic when possible
- not guaranteed instant everywhere

### 2. Password setup can add friction

If the password is mandatory too early, group creation becomes heavier.
This is why post-create activation may be better.

### 3. Background sync changes architecture expectations

Once Always exists, users will expect:
- retries
- status persistence
- decent offline handling
- fewer manual recovery steps

So Always should not be introduced as just a label. It needs real runtime support.

## Recommendation

If we do this, I would aim for:

1. keep sync outside the main functional tabs
2. model sync as a per-group capability with `off / manual / always`
3. expose a subtle badge/status on the group
4. keep Manual as today's safer baseline
5. introduce Always only with honest copy and pending/offline states

## Short conclusion

Yes, the idea makes sense.

But:
- `manual` is an action UX
- `always` is a group-state UX

So if we go there, the UI should evolve from a sync button into a lightweight status system for the group, not just a prettier modal.
