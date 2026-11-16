# QVAC — Private Voice Host Overview

Source: `QvacOverview.drawio.xml`

How the phone pairs with the Electron desktop host to run private voice models (ASR → LLM → TTS) locally, over LAN or P2P, with optional cloud fallback.

```mermaid
flowchart TB
  subgraph clients ["Clients"]
    wallet["HeySolana Wallet<br/>Expo / React Native app"]
    host["HeySolana Voice Host<br/>Electron desktop app"]
  end

  subgraph features ["Features"]
    ai["AiServiceProvider<br/>voice + chat session orchestration"]
    voice["QvacVoiceSession<br/>mic → ASR → LLM → TTS loop"]
    brain["QvacBrainProvider<br/>local LLM + embeddings + P2P fallback"]
  end

  subgraph libs ["Wallet libs"]
    voiceinfra["libs/voiceinfra<br/>Lan client, voice models, pairing, audio"]
    qvac["libs/qvac<br/>Hyperswarm seed, P2P manager, constants"]
    computeApi["services/qvacComputeApi<br/>register, route, receipt, balance"]
  end

  subgraph runtime ["Runtime"]
    sdk["@qvac/sdk<br/>loadModel, completion, transcribeStream,<br/>textToSpeech, embed, startQVACProvider"]
    asr["ASR worker<br/>Whisper Tiny + Silero VAD"]
    llm["LLM worker<br/>Llama 3.2 1B Instruct Q4"]
    tts["TTS worker<br/>Supertonic English"]
    embed["Embed worker<br/>EmbeddingGemma 300M Q4"]
    bridge["LanVoiceBridge<br/>HTTP /v1/chat, /v1/speak<br/>WS /v1/transcribe on :8787"]
  end

  subgraph backend ["Backend"]
    api["HeySolanaBackend<br/>QvacComputeController<br/>/sdk/qvac/wallet/*"]
    db[("Postgres<br/>providers, jobs, receipts, withdrawals")]
  end

  subgraph infra ["Infra"]
    secure["SecureStore<br/>QVAC_HYPERSWARM_SEED per install"]
    cache["Local model cache<br/>GGUF weights (~1 GB voice bundle)"]
  end

  subgraph external ["External"]
    dht["Hyperswarm DHT<br/>encrypted provider RPC + delegate"]
    lan["Local Wi-Fi LAN<br/>same-network HTTP + WebSocket"]
    openai["OpenAI Realtime<br/>optional cloud voice backend"]
  end

  subgraph modes ["Host modes"]
    m1["laptop + LAN (recommended)<br/>phone mic/speaker, inference on desktop"]
    m2["laptop + P2P<br/>delegate loadModel to paired provider key"]
    m3["device<br/>all models run on phone after download"]
  end

  wallet --> ai
  host -- "QvacHostService" --> bridge
  ai -- "voiceBackend=qvac" --> voice
  ai -- "brain digest / suggestions" --> brain
  voice --> voiceinfra
  brain --> qvac
  qvac -- "share compute" --> computeApi
  voiceinfra -- "loadModel + streams" --> sdk
  voiceinfra -- "QvacLanVoiceClient" --> bridge
  brain -- "completion + embed" --> sdk
  sdk --> asr
  sdk --> llm
  sdk --> tts
  sdk --> embed
  bridge -- "transcribeStream / completion / TTS" --> asr
  sdk -- "startQVACProvider + delegate RPC" --> dht
  bridge -- "0.0.0.0:8787" --> lan
  voiceinfra -- "phone → laptop" --> lan
  ai -. "voiceBackend=openai" .-> openai
  computeApi -- "POST /sdk/qvac/wallet/*" --> api
  api -- "providers + jobs + receipts" --> db
  brain -- "/route + /receipts when local LLM unavailable" --> computeApi
  api -- "returns provider_public_key + job ticket" --> dht
  qvac -- "ensureQvacHyperswarmSeed" --> secure
  sdk -- "GGUF cache" --> cache
```

> Voice loop: mic PCM → transcribeStream (VAD utterances) → completion(history) → textToSpeech → speaker. Mic gated during playback + 300 ms cooldown to prevent self-hearing.

> P2P marketplace: providers register + heartbeat → consumers /route → delegate inference → /receipts/submit credits points.
