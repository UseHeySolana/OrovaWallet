# HeySolana (Orova)

Mobile **Solana wallet** with a **voice-first AI assistant**. Speak or chat to send, swap, pay bills, ramp fiat, and shop — with confirmation before money moves.

Built with **Expo / React Native**. Product name in stores: **Orova** (see `app.config.ts` variants).

For a deeper architecture map, see [`docs/PROJECT_SUMMARY.md`](docs/PROJECT_SUMMARY.md).

## Features

- BIP39 wallet create/import; SOL + SPL balances
- Realtime voice + text AI (OpenAI Realtime via Laravel proxy)
- Jupiter swaps, PajCash onramp/offramp, AirBills, commerce tools
- Android PIP overlay + widgets; EAS Build / OTA updates
- Optional speaker verification (`EXPO_PUBLIC_VOICE_VERIFICATION_ENABLED`)

## Tech stack

| Layer | Tech |
|------|------|
| App | Expo ~54, React Native, expo-router |
| Chain | `@solana/web3.js`, Jupiter, Helius |
| AI / voice | OpenAI Realtime (WebRTC), tool registry |
| State | Zustand |
| UI | NativeWind, Reanimated, Gorhom sheets |
| Security | expo-secure-store, PIN / biometric |

## Getting started

### 1. Clone & install

```bash
git clone https://github.com/UseHeySolana/HeySolanaWallet
cd HeySolanaWallet
npm install
```

Use **npm** with `package-lock.json` as the source of truth for installs. Do not commit `yarn.lock` or `pnpm-lock.yaml`.

### 2. Environment

```bash
cp .env-example .env
```

Fill in values from `.env-example`. OpenAI keys live on the **Laravel backend** — the app does not need a client OpenAI key.

Minimum for local device testing:

- `EXPO_PUBLIC_API_URL` — backend base ending in `/api` (use your LAN IP on a physical device)
- `EXPO_PUBLIC_HELIUS_API` — RPC / DAS
- `EXPO_PUBLIC_NETWORK` — Solana cluster RPC base if required by your setup

### 3. Run (dev client)

```bash
npm run start          # Play Store variant
npm run android        # native Android
npm run ios            # native iOS (device)
```

Solana Mobile variant:

```bash
npm run start:solana-mobile
npm run android:solana-mobile
```

### 4. Quality checks

```bash
npm run lint
npm run typecheck
```

## Architecture (short)

```
UI (expo-router) → AiContext / SessionManager → OpenAI Realtime
                         ↓ function calls
                   tool registry (libs/tool-implementation)
                         ↓
              wallet sign + confirm sheets → Solana / partners
```

Bootstrap: fonts/splash in `app/_layout.tsx`, side-effects in `hooks/useRootBootstrap.ts`, provider tree in `app/providers/AppProviders.tsx`.

## App variants

| `APP_VARIANT` | Package / purpose |
|---------------|-------------------|
| `play` (default) | Play Store / general builds |
| `solana-mobile` | Solana dApp Store identity |

Configured in `app.config.ts` and `eas.json`.

## Permissions (Android)

Overlay, microphone, biometric, internet, foreground service, and related entries are declared in `app.json`. Grant overlay + mic when testing voice / PIP.

## Related repos

| Repo | Role |
|------|------|
| HeySolanaBackend (Laravel) | API, OpenAI proxy, Jumia, push, users |
| Heysolana-admin-dashboard | Ops UI |
| hey-solana-landing | Marketing |
| python-speech-brain | Voice verification services |

## Contributing

1. Fork and branch from the latest main
2. Prefer small PRs; match existing patterns under `libs/tools/` when adding tools
3. Run `npm run lint` and `npm run typecheck` before opening a PR
4. Never commit `.env`, keystores, or mnemonics

## License

MIT

## Credits

Built by Moses Erhinyodavwe (@YrayPixels) / Yray Labs.
