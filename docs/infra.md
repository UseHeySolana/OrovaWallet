If Dextopus is your router, then think of your stack like this:

```text
                Orova
    ┌────────────────────────┐
    │                        │
    │  NGN Onramp/Offramp    │
    │  User Accounts         │
    │  KYC                  │
    │  Wallet Management     │
    │  Ledger               │
    │                        │
    └──────────┬─────────────┘
               │
               ▼
        Dextopus Router
               │
     ┌─────────┼─────────┐
     ▼         ▼         ▼
   Solana    Base    Ethereum
```

The mistake would be exposing Dextopus to the user.

The user should never see:

```text
Source Chain
Destination Chain
Bridge
Router
Settlement
```

Those are infrastructure concepts.

---

# Buy Flow

Current:

```text
Buy SOL
```

Future:

```text
Buy Crypto
```

Screen:

```text
Asset
[ PEPE ]

Amount
[ ₦50,000 ]

Receive Address
[ 0x.... ]

Network
[ Ethereum ]
```

User clicks Continue.

Backend:

```text
1. User pays NGN
2. Orova receives payment
3. Orova buys USDC (quoted in USD terms)
4. Orova creates Dextopus route (Solana SOL origin)
5. Orova funds the route with SOL from PajCash (no SPL ATA rent)
6. Dextopus settles PEPE (or USDC, etc.) on the destination chain
7. User receives PEPE
```

The user never knows Dextopus exists.

---

# Sell Flow

This is actually where Dextopus becomes very powerful.

User wants NGN.

Screen:

```text
Sell Crypto

Asset:
PEPE

Amount:
10,000,000

Receive:
₦85,000

Bank:
GTBank
```

Backend:

```text
User sends PEPE
      │
      ▼
Dextopus Deposit Address
      │
      ▼
Dextopus Routes
      │
      ▼
USDC Settlement
      │
      ▼
Orova Treasury
      │
      ▼
NGN Payout
```

User experience:

```text
Send PEPE
Receive Naira
```

No chain selection.

No bridge.

No swaps.

---

# The Best Orova UX

I would actually build only 4 actions.

```text
Home

[ Buy ]
[ Sell ]
[ Send ]
[ Receive ]
```

---

## Buy

```text
I have:
₦50,000

I want:
PEPE

Wallet:
0x...
```

---

## Sell

```text
I have:
PEPE

Amount:
10,000,000

Bank:
GTBank
```

---

## Send

```text
Recipient:
Wallet Address

Asset:
USDC

Amount:
100
```

---

## Receive

```text
Receive USDC
```

Generate a Dextopus deposit route behind the scenes.

Show:

```text
Send USDC to:

0x742d...
```

or

```text
Send SOL to:

6Vas...
```

Dextopus handles the routing.

---

# Where Dextopus Lives

The architecture should be:

```text
Mobile App
    │
    ▼
Orova API
    │
    ├── Payments Service
    ├── KYC Service
    ├── Wallet Service
    ├── Ledger Service
    ├── Quote Service
    │
    └── Routing Service
             │
             ▼
         Dextopus
```

The Routing Service is your abstraction layer.

Never call Dextopus directly from the app.

Example:

```ts
POST /quote

{
  "amount": 50000,
  "currency": "NGN",
  "asset": "PEPE",
  "network": "ethereum"
}
```

Your Routing Service decides:

```text
Can I fulfill internally?
    YES → use treasury

    NO → use Dextopus
```

Later you can add:

* Dextopus
* deBridge
* Across
* Wormhole
* Circle CCTP

without changing the mobile app.

---

# The UX I'd ship

The app should feel like:

```text
Opay + Coinbase
```

not

```text
MetaMask + Bridge Aggregator
```

The user should only think in terms of:

```text
I have Naira.

I want PEPE.
```

or

```text
I have PEPE.

I want Naira.
```

Everything between those two statements is Orova's job, with Dextopus acting as the routing engine underneath.

---

# TODO

## Dextopus onramp deposit address strategy

**Status:** Deferred — decide later.

**Context:** PajCash onramp funds cross-chain buys with **native SOL** on Solana (not USDC), avoiding SPL ATA rent on the deposit leg. Amounts are still quoted in USDC-equivalent terms for the user; PajCash delivers SOL to a Dextopus deposit address, which bridges and settles on the destination chain.

Dextopus static addresses (`POST /deposit/static/generate`) are **reusable**, but each address is bound to a **full route** at creation time:

- Origin: Solana native SOL (`11111111111111111111111111111111`) — what PajCash sends
- Settlement chain (e.g. Base)
- Settlement token (e.g. USDC, WETH)
- Settlement recipient (e.g. `0xRecipient`)

Sending SOL to the same Solana address multiple times always follows that same route. It is **not** one universal inbox that can settle to different destinations per payment.

**Current behavior:** Route-specific reuse. We return an existing address when wallet + origin + settlement chain + settlement token + settlement recipient all match. Otherwise we generate a new one.

**When a new Solana deposit address is required:**

| Change | New address? |
| --- | --- |
| Same chain, same token, same recipient | No — reuse |
| Different recipient on same chain | Yes |
| Different token on same chain | Yes |
| Different chain | Yes |

**Options to decide:**

1. **Route-specific reuse (current)** — Correct when users pick different destinations per buy. Reuse only when the full route matches.
2. **One fixed address per user** — Only viable if every onramp settles to the **same** chain, token, and recipient (e.g. always the user’s linked Base USDC wallet). Reusing one address across different destinations would mis-route funds.
3. **Per-order quotes** — Use `POST /deposit/quote` for a fresh deposit address each buy. Not reusable, but always matches the selected route.

**Related code:**

- Backend dedup: `HeySolanaBackend/app/Http/Controllers/DextopusWalletController.php` (`generateDepositAddress`)
- Wallet client: `HeySolanaWallet/services/dextopusApi.ts` (`findOrCreateDextopusDepositAddress`, `matchDextopusDepositAddress`)
- Onramp flow: `HeySolanaWallet/app/dashboard/onramp/index.tsx`
