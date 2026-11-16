# Sequence — Solana Voice Send

Source: `SolanaVoiceSendSequence.drawio.xml`

Live path for a voice-driven Solana send. The same confirmation shape applies to Jupiter swaps, AirBills purchases, and PajCash off-ramps.

```mermaid
sequenceDiagram
  actor User
  participant App as Orova app
  participant API as Laravel API
  participant OAI as OpenAI Realtime
  participant Chain as Solana RPC (Helius)

  User->>App: speak "send 5 USDC"
  App->>API: POST /api/open-token
  API->>OAI: create client secret (gpt-realtime-mini)
  OAI-->>App: client_secret
  App->>OAI: WebRTC audio + tool list
  OAI-->>App: function call transfer_tokens
  App->>User: confirmation sheet (amount, asset, destination)
  User->>App: approve
  App->>App: sign from SecureStore
  App->>Chain: broadcast transaction
  Chain-->>App: signature
  App->>OAI: tool result
  OAI-->>User: spoken confirmation
  App->>API: POST /api/add-tx (when logging enabled)
```

> Signing happens only after the confirmation sheet, using the on-device Solana key.
