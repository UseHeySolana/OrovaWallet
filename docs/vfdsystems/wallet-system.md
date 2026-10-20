# Merchant Wallet System (VFD POOL)

Architecture for giving every Bizgrid merchant a cash wallet with a dedicated VFD account number (NUBAN), while **keeping storefronts, checkout, orders, POS, billing, and messaging credits unchanged**.

Status: v1 implementation (POOL).  
Provider: **VFD Bank Wallet API** — see [`docs/wallet/implementation.md`](wallet/implementation.md).

---

## 1. Goal

Merchants should be able to:

1. Receive a **dedicated account number** tied to their Bizgrid wallet (VFD `/client/create`).
2. **Deposit** funds into that account (bank transfer → VFD inward-credit webhook → local ledger).
3. See a clear **balance** and transaction history (Bizgrid ledger is source of truth in POOL mode).
4. **Withdraw** to their payout bank via VFD `/transfer` from the corporate pool.
5. Have **online order settlements** credit the same ledger (Paystack checkout unchanged).

Non-goals for v1:

- Customer/shopper wallets
- Replacing messaging / AI usage credits
- Changing SaaS subscription billing
- KYC consent / tier upgrades (v2)

Also in v1 (implemented): temporary `/virtualaccount` deposit numbers on signup (auto-renew / upgrade to permanent via BVN).

---

## 2. Mode: POOL

| Behavior | POOL |
|---|---|
| Deposits to merchant NUBAN | Swept automatically to Bizgrid corporate pool |
| Merchant balance | Tracked in Bizgrid `merchant_wallets` / `wallet_transactions` |
| Inward / outward bank charges | Inward + outward charges hit corporate account (per VFD) |
| Withdrawals | Transfer **from pool** to merchant’s payout bank; optional `uniqueSenderAccountId` so recipient sees the sub-account |

```text
Merchant bank transfer → VFD sub-account NUBAN → sweep → Bizgrid pool
                              │
                              └─ webhook → credit Bizgrid ledger

Paystack order paid → credit Bizgrid ledger (order_settlement)

Merchant withdraw → debit ledger → VFD transfer from pool → payout bank
```

---

## 3. Compatibility (do not break the website)

| Existing flow | Stays the same? | Wallet interaction |
|---|---|---|
| Public storefront browse / cart / place order | Yes | None |
| Online Paystack checkout | Yes | After paid: credit ledger with merchant net |
| Platform fee on online orders | Yes | Fee stays on platform; only net credits wallet |
| POS cash / show merchant bank | Yes | Unchanged in v1 |
| Merchant SaaS billing + credit packs | Yes | Separate |
| Store payout bank fields | Keep | Withdrawal destination (+ `payout_bank_code`) |
| Messaging / AI balances | Yes | Unrelated “wallets” |

---

## 4. Data model

- `merchant_wallets` — one per merchant; VFD account fields; `available_balance` / `pending_balance`; `wallet_tier` (`basic` for v1)
- `wallet_transactions` — append-only ledger (`deposit`, `order_settlement`, `withdrawal`, `reversal`, `adjustment`)
- `wallet_withdrawals` — transfer lifecycle + payee snapshot
- `wallet_account_aliases` — retired temporary/permanent account numbers still credited on late inward webhooks

Balance mutations only via `WalletService` with `lockForUpdate()` + `idempotency_key`.

Hardening: webhook secret required in production (header-only); unknown-account / payout alerts; withdrawals never auto-refund on ambiguous transfer errors (TSQ + payout webhook + scheduled reconcile); refunds reverse order settlements (freeze + alert on shortfall); hourly pool vs ledger drift check.

BVN: collected at activate, stored encrypted; only `bvn_last4` exposed in APIs.

---

## 5. VFD integration

| Concern | Detail |
|---|---|
| Base URL (test) | `https://api-devapps.vfdbank.systems/vtech-wallet/api/v2/wallet2` |
| Base URL (live) | `https://api-apps.vfdbank.systems/vtech-wallet/api/v2/wallet2` |
| Auth | `VFD_CONSUMER_KEY` + `VFD_CONSUMER_SECRET` → `POST …/baasauth/token` → `AccessToken` header on wallet calls |
| Create account | Signup/backfill: `POST /virtualaccount` (temporary, no BVN). Optional upgrade: `POST /client/create` (permanent) |
| Pool enquiry | `GET /account/enquiry` (no accountNumber) |
| Banks / recipient / transfer | `/bank`, `/transfer/recipient`, `/transfer` |
| Inward credit | Webhook → `POST /api/storehause/webhooks/vfd/inward-credit` |
| Payout status | Webhook → `POST /api/storehause/webhooks/vfd/payout` (`payout.success` / `payout.failed`) |
| TSQ | `GET /transactions?reference=` via `storehause:reconcile-wallet-withdrawals` |
| Pool drift | `storehause:reconcile-wallet-ledger --alert` |

Feature flag: `VFD_WALLET_ENABLED`. Set `VFD_WEBHOOK_SECRET` before production.

---

## 6. Merchant APIs (v1)

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/stores/me/wallet/activate` | BVN + DOB → create VFD account |
| `GET` | `/stores/me/wallet` | Balance + deposit account |
| `GET` | `/stores/me/wallet/transactions` | Ledger |
| `GET` | `/stores/me/wallet/banks` | VFD bank list |
| `POST` | `/stores/me/wallet/withdrawals` | Withdraw to payout bank |
| `GET` | `/stores/me/wallet/withdrawals` | Withdrawal history |

Gates: email verified; withdrawals also require `canReceivePayouts()` and configured payout bank + bank code.

---

## 7. v2 — KYC + tier upgrades (planned)

When a merchant upgrades wallet tier, require KYC and unlock higher limits / corporate features.

```text
Request higher tier → BVN consent / Consent Method APIs
  → /client/release or /client/upgrade
  → /transaction/limit + wallet_tier = verified|business
```

v2 will use:

- VFD Consent Method (`/client/individual`, `/bvn-consent`, `/client/release`)
- `/client/upgrade` (BVN update, compliance, individual→corporate)
- Stricter withdraw limits for `basic`; raised after verification
- Admin review for failed KYC / frozen wallets

No storefront shopper checkout changes in v2.

---

## 8. Related code

| Area | Path |
|---|---|
| Config | `config/vfd.php` |
| VFD client | `app/Services/Vfd/` |
| Ledger | `app/Services/WalletService.php` |
| Merchant API | `app/Http/Controllers/StoreWalletController.php` |
| Webhook | `app/Http/Controllers/VfdWebhookController.php` |
| Order settlement hook | `app/Services/PaystackService.php` |
| Provider docs | `docs/wallet/implementation.md` |
