sequenceDiagram
  participant UI_A as Phone A UI
  participant SDK_A as Phone A QVAC worker
  participant DHT as Hyperswarm DHT
  participant SDK_B as Phone B QVAC worker
  participant UI_B as Phone B (background)

  Note over UI_B,SDK_B: Provider already running startQVACProvider() + model loaded

  UI_A->>SDK_A: completion(history, stream:true)
  SDK_A->>DHT: connect(providerPublicKey) [first time only]
  DHT-->>SDK_A: route to Phone B
  SDK_A->>SDK_B: encrypted RPC: completion request

  loop Each generated token
    SDK_B->>SDK_B: run LLM locally
    SDK_B-->>SDK_A: RPC stream chunk (token)
    SDK_A-->>UI_A: tokenStream yields token
  end

  SDK_B-->>SDK_A: final stats
  SDK_A-->>UI_A: response.stats
