# HeySolana

HeySolana is a multilingual, AI assistant built with React Native and native Android services. It empowers users with real-time voice interactions to carry out solana transactions , GPT-4 integration, and floating UI components. Designed to be persistent, accessible, and contextually aware, HeySolana is the intelligent assistant you always wanted on mobile.

## 🌟 Features

- 🎤 **Voice Input** (WebRTC): Speak naturally to HeySolana in your preferred language.
- 🧠 **GPT-4 Integration**: Smart responses powered by OpenAI's latest models.
- 🔁 **Persistent Background Service**: Runs in the background without interruption.
- 🌐 **Multilingual Support**: Understands and responds in multiple languages.
- 🗂️ **Context Memory**: Optional short-term memory (can persist across sessions).
- 🛠️ **Custom Commands**: Trigger device or app actions using your voice.
- 🔒 **Privacy-First**: Audio streamed securely with minimal retention.

---

## 📦 Tech Stack

| Layer | Tech |
|------|------|
| Mobile Frontend | React Native + Reanimated |
| Voice Handling | WebRTC + Custom Audio Worklet |
| AI Backend | OpenAI GPT-4 via API |
| State Management | Zustand / Redux |
| Native Integration | Android Services (Java/Kotlin), iOS support (planned) |
| Background Services | Foreground Service (Android) |
| Assistant Core | Custom Task Dispatcher + GPT Tools |

---

## 🚀 Getting Started

### 1. Clone the repo

```bash
git clone https://github.com/UseHeySolana/HeySolanaWallet
cd HeySolanaWallet
````

### 2. Install dependencies

```bash
npm install
# or
yarn
```

### 3. Add OpenAI API Key

Create a `.env` file:

```env
OPENAI_API_KEY=your_openai_key_here
```

> You can also plug in your own LLM endpoint if self-hosting.

### 4. Run on Android

```bash
npx react-native run-android
```

> Ensure you’ve granted **overlay**, **microphone**, and **background activity** permissions.

---

## 🧠 Architecture Overview

```
+-----------------------------+
|     React Native App       |
+------------+----------------
             |
     Voice Overlay (Bubble)
             |
     Expandable Overlay Panel
             |
      Audio Input via WebRTC
             |
        Voice Transcriber
             |
          LLM Backend <----- Context Cache (Optional)
             |
    +--------+--------+
    | Device Commands |
    |   Web Search    |
    |   Smart Tools   |
    +-----------------+
```


## 🛡️ Permissions

Make sure the following Android permissions are enabled:
* `SYSTEM_ALERT_WINDOW`
* `RECORD_AUDIO`
* `FOREGROUND_SERVICE`
* `INTERNET`
* `WAKE_LOCK` (Optional for wake-word)

---

## 🔮 Future Plans

* [ ] Wake Word ("Hey Solana") integration
* [ ] Home automation plugin system
* [ ] On-device LLM fallback (e.g., Whisper + local transformers)
* [ ] iOS full parity
* [ ] Vision mode using camera
* [ ] Plugin SDK for devs to add custom tools

---

## 👨‍💻 Contributing

Got an idea for a tool, overlay mod, or model integration?

1. Fork the repo
2. Create your feature branch (`git checkout -b feature/awesome-thing`)
3. Commit your changes
4. Push to the branch
5. Open a pull request

---

## 📜 License

MIT License. Use it. Remix it. Just don’t train your evil robot uprising on it without credit.

---

## 💬 Credits

Built with love by Moses Erhinyodavwe (@YrayPixels)
Powered by React Native, OpenAI, and caffeine.

```

