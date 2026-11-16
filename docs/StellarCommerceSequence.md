# Sequence — Stellar Commerce Payment

Source: `StellarCommerceSequence.drawio.xml`

Target flow for a spoken purchase that settles through Stellar, with Soroswap on the conversion branch and Bridge cards when the merchant cannot take Stellar.

```mermaid
sequenceDiagram
  actor User
  participant App as Orova
  participant Kit as Stellar Wallets Kit
  participant Soro as Soroswap
  participant Net as Stellar network
  participant Bridge as Bridge
  participant Shop as Merchant checkout

  User->>App: intent "pay for this order"
  App->>App: build unsigned transaction
  alt asset must be converted
    App->>Soro: request route + quote
    Soro-->>App: quote
    App->>Kit: request authorization
    User->>Kit: approve
    Kit->>Net: submit authorized swap
    Net-->>App: swap result
  end
  alt merchant accepts cards only
    App->>Bridge: issue or charge card from Stellar balance
    Bridge-->>App: card payment result
  end
  App->>Shop: complete checkout
  Shop-->>User: order confirmation
```

> The agent never receives the private key. Wallets Kit is the only authorization step. Soroswap is the conversion branch.
