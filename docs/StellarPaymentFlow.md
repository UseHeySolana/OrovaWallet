# Planned Stellar Payment Flow

Source: `StellarPaymentFlow.drawio.xml`

Target crypto-to-commerce path: user intent → Stellar wallet → Bridge (cards) → merchant checkout → order confirmation.

```mermaid
flowchart LR
  intent["User intent<br/>voice or text purchase"]
  builder["Transaction builder<br/>unsigned Stellar tx<br/>agent never holds keys"]
  kit["Stellar Wallets Kit<br/>connect + authorize"]
  soro["Soroswap<br/>route + quote + swap"]
  net["Stellar network<br/>submit authorized tx"]
  bridge["Bridge<br/>card issuance + card pay<br/>when merchant has no Stellar"]
  checkout["Merchant checkout engine<br/>Jumia / Chowdeck / Crossmint"]
  confirm["Order confirmation"]

  intent -- "pay for this order" --> builder
  builder -- "request authorization" --> kit
  kit -- "if asset must convert" --> soro
  soro -- "authorized swap" --> net
  kit -- "authorized payment" --> net
  soro -- "converted balance" --> bridge
  kit -- "Stellar balance to card" --> bridge
  bridge -- "card payment" --> checkout
  checkout --> confirm
```

> The AI agent builds the transaction. Wallets Kit is the only place the user signs.
