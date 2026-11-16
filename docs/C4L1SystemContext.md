# C4 L1 — System Context

Source: `C4L1SystemContext.drawio.xml`

The high-level context: people, the Orova system (app, Laravel API, admin dashboard), the planned Stellar commerce rail, the live Solana + voice path, and the live partners.

```mermaid
flowchart TB
  user["Person with Orova app"]
  operator["Operator"]

  subgraph orova ["Orova system"]
    app["Orova mobile app<br/>Expo / React Native"]
    api["Laravel API<br/>users, orders, OpenAI session"]
    admin["Admin dashboard"]
  end

  subgraph stellar ["Planned Stellar commerce rail"]
    kit["Stellar Wallets Kit"]
    soro["Soroswap"]
    bridge["Bridge card issuance and payments"]
    net["Stellar network"]
  end

  subgraph live ["Live chain + voice"]
    solana["Solana via Helius"]
    openai["OpenAI Realtime<br/>gpt-realtime-mini"]
  end

  subgraph partners ["Live partners"]
    p["PajCash<br/>AirBills<br/>Jupiter<br/>Jumia / Chowdeck / Crossmint"]
  end

  checkout["Merchant checkout engine"]

  user --> app
  operator --> admin
  admin --> api
  app --> api
  app --> kit
  kit --> net
  app --> soro
  soro --> net
  app --> bridge
  bridge -- "cards when no Stellar" --> checkout
  checkout -- "order record" --> api
  app --> solana
  app -- "WebRTC" --> openai
  api -- "POST /open-token" --> openai
  app --> p
```

> Laravel stores users and orders. It does not hold Stellar private keys. Solana, voice, and partners stay on the live path.
