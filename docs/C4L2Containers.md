# C4 L2 — Containers

Source: `C4L2Containers.drawio.xml`

Zoom into the Orova system: mobile app internals, the planned Stellar containers, and the Laravel 11 API with MySQL.

```mermaid
flowchart TB
  subgraph phone ["Orova mobile app — Expo"]
    ui["expo-router screens"]
    ai["AiContext + SessionManager"]
    tx["Transaction builder"]
    tools["Commerce tools<br/>Jumia, Chowdeck, Crossmint"]
    wallet["Solana wallet<br/>bip39, web3.js, SecureStore"]
  end

  subgraph planned ["Planned Stellar containers"]
    kit["Stellar Wallets Kit session"]
    soro["Soroswap client"]
    bridge["Bridge card client"]
  end

  subgraph api ["Laravel 11 API"]
    wallets["v2 wallets + wallet catalog"]
    orders["Orders and checkout records"]
    db[("MySQL<br/>public Stellar address + orders")]
  end

  ui --> ai
  ai --> tx
  tx -- "unsigned tx" --> kit
  tx -- "route + quote" --> soro
  tx -- "card settlement" --> bridge
  kit -- "authorized" --> tools
  bridge --> tools
  tools --> orders
  orders --> db
  ui --> wallets
  wallets --> db
  tx -- "Solana path" --> wallet
```

> Private keys stay in the user's Stellar wallet. MySQL stores the public address and the order.
