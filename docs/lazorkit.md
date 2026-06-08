Overview
LazorKit Wallet Mobile Adapter — passkey smart wallets for React Native & Expo.

React Native / Expo adapter for LazorKit smart wallets on Solana. Users authenticate with a device passkey (Face ID, Touch ID, screen lock) through the LazorKit portal — your app never touches private key material.

Package

@lazorkit/wallet-mobile-adapter on npm. Requires React Native ≥ 0.70 and Expo SDK ≥ 50 (or bare workflow).

Why this SDK
No seed phrase. Passkey-based WebAuthn, synced via iCloud Keychain / Google Password Manager.
No gas. Kora paymaster sponsors every mutation — users don't need SOL.
Programmable wallet. Vault + authority PDAs, role-based access (owner / admin / spender), on-chain spending limits.
Session keys. One prompt mints a scoped Ed25519 signer — subsequent sends are prompt-free.
Deferred execution. Sign a single challenge to authorise multi-instruction payloads that exceed the single-tx size limit.
How it fits together

┌──────────────┐ deep link ┌────────────────┐ signs ┌──────────────┐
│ your app │─────────────────▶│ LazorKit Portal│──────────▶│ passkey │
│ (RN/Expo) │◀─────────────────│ (WebAuthn) │ │ (OS / browser)│
└──────┬───────┘ redirect URL └────────────────┘ └──────────────┘
│
▼ build tx / finalize
┌──────────────┐ relay via ┌──────────────┐
│ SDK │────paymaster───▶│ Solana │
└──────────────┘ └──────────────┘
The portal handles the WebAuthn round-trip; the SDK builds instructions, finalises the passkey signature, and submits through the paymaster.

Getting Started
Wire up LazorKit in your React Native / Expo app in 5 minutes.

A complete working integration takes four steps: install dependencies, add polyfills, mount the provider, call the hook.

Zero-config defaults

Every provider prop is optional. If you leave them blank the SDK uses Devnet defaults (api.devnet.solana.com, portal.lazor.sh, kora.devnet.lazorkit.com). Ship to production by overriding rpcUrl + configPaymaster.

Prerequisites
React Native ≥ 0.70 or Expo SDK ≥ 50
A physical device or a simulator with biometrics enrolled (see Troubleshooting if you hit NotAllowedError)
A deep-link scheme for your app (e.g. myapp://)
Install
Install the SDK and peers

npm install @lazorkit/wallet-mobile-adapter @solana/web3.js \
 @react-native-async-storage/async-storage expo-web-browser \
 react-native-get-random-values react-native-url-polyfill buffer
@solana/web3.js is a peer dependency. Install it explicitly so bundlers pick one version instead of duplicating.

Add polyfills
React Native is missing some Node globals that Solana libraries expect. Add these imports at the very top of your entry file (app/\_layout.tsx, index.js, or App.tsx):

import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';
import { Buffer } from 'buffer';
global.Buffer = global.Buffer || Buffer;
The provider itself patches Buffer.prototype.subarray once mounted.

Register your deep-link scheme
The portal returns signature payloads via a redirect. Your app needs to own a URL scheme.

Expo
iOS (bare)
Android (bare)
app.json

{
"expo": {
"scheme": "myapp"
}
}
In dev with Expo Go you can use exp://localhost:8081 (or your tunnel URL).

Wrap your app with the provider
app/\_layout.tsx

import { LazorKitProvider } from '@lazorkit/wallet-mobile-adapter';
import { Stack } from 'expo-router';
export default function RootLayout() {
return (
<LazorKitProvider isDebug={__DEV__}>
<Stack />
</LazorKitProvider>
);
}
That's the minimum. To override defaults:

<LazorKitProvider
rpcUrl={process.env.EXPO_PUBLIC_RPC_URL}
portalUrl={process.env.EXPO_PUBLIC_PORTAL_URL}
configPaymaster={{
    paymasterUrl: process.env.EXPO_PUBLIC_PAYMASTER_URL!,
    apiKey: process.env.EXPO_PUBLIC_PAYMASTER_KEY,
  }}

>   <Stack />
> </LazorKitProvider>
> First flow: connect + send
> Connect
> app/index.tsx

import { useWallet } from '@lazorkit/wallet-mobile-adapter';
import { Button, Text } from 'react-native';
export default function HomeScreen() {
const { connect, isConnected, isConnecting, smartWalletPubkey } = useWallet();
if (isConnected) {
return <Text>Connected: {smartWalletPubkey!.toBase58()}</Text>;
}
return (
<Button
title={isConnecting ? 'Connecting…' : 'Connect with Passkey'}
onPress={() => connect({ redirectUrl: 'myapp://home' })}
/>
);
}
smartWalletPubkey = vault

smartWalletPubkey is the vault PDA — the address that receives and sends funds. Use it for connection.getBalance, for QR codes, and wherever you show the user their wallet address.

Send a transaction
app/send.tsx

import { useWallet } from '@lazorkit/wallet-mobile-adapter';
import { LAMPORTS_PER_SOL, PublicKey, SystemProgram } from '@solana/web3.js';
import { Button } from 'react-native';
export default function SendScreen() {
const { smartWalletPubkey, signAndSendTransaction } = useWallet();
const send = async () => {
if (!smartWalletPubkey) return;
const ix = SystemProgram.transfer({
fromPubkey: smartWalletPubkey, // vault
toPubkey: new PublicKey('RECIPIENT_ADDRESS'),
lamports: 0.01 \* LAMPORTS_PER_SOL,
});
const sig = await signAndSendTransaction(
{ instructions: [ix] },
{ redirectUrl: 'myapp://home' },
);
console.log('tx', sig);
};
return <Button title="Send 0.01 SOL" onPress={send} />;
}
(Optional) Use the vault balance

const { smartWalletPubkey, connection } = useWallet();
useEffect(() => {
if (!smartWalletPubkey) return;
connection.getBalance(smartWalletPubkey).then((l) =>
console.log('balance (SOL):', l / LAMPORTS_PER_SOL),
);
}, [smartWalletPubkey?.toBase58()]); 8. Deferred execution — split TX1 / TX2
For flows where TX1 and TX2 don't run in the same process — a relayer on your server, a scheduled job, a secondary device — use the split API instead of authorizeAndExecute:

import {
useWallet,
serializeDeferredPayload,
deserializeDeferredPayload,
} from '@lazorkit/wallet-mobile-adapter';
// Device A — passkey-signed TX1 only, returns payload
const { signature: tx1Sig, deferredPayload } = await authorizeDeferred(
{ instructions: jupiterSwapIxs, expiryOffset: 600 },
{ redirectUrl: 'myapp://cb' },
);
// Send the payload to your relayer as a JSON-safe string
await fetch('/api/relayer', {
method: 'POST',
body: serializeDeferredPayload(deferredPayload),
});
// Relayer / server / other device — no passkey required
const payload = deserializeDeferredPayload(await req.text());
const tx2Sig = await executeDeferred({ deferredPayload: payload });
If the authorization expires before TX2 is submitted, reclaim the rent:

await reclaimDeferred({
deferredExecPda, // from authorizeDeferred result
refundDestination: smartWalletPubkey, // refund to vault
});

LazorKitProvider
Provider component — initialises config, RPC, and the wallet store.

Wrap your app once at the root with LazorKitProvider. It sets up the Zustand store, builds the Connection, installs Buffer polyfills, and holds the portal / paymaster config.

import { LazorKitProvider } from '@lazorkit/wallet-mobile-adapter';
Minimum setup

<LazorKitProvider>
  <App />
</LazorKitProvider>
Devnet defaults

With no props, the provider connects to Solana Devnet through portal.lazor.sh and the public Kora paymaster at kora.devnet.lazorkit.com. Perfect for demos and local development.

Production setup

<LazorKitProvider
rpcUrl={process.env.EXPO_PUBLIC_RPC_URL}
portalUrl="https://portal.lazor.sh"
configPaymaster={{
    paymasterUrl: process.env.EXPO_PUBLIC_PAYMASTER_URL!,
    apiKey: process.env.EXPO_PUBLIC_PAYMASTER_KEY,
  }}
rpId="portal.lazor.sh"
isDebug={**DEV**}

>   <App />
> </LazorKitProvider>
> Props
> Prop	Type	Default	Required
> rpcUrl	string	https://api.devnet.solana.com	no
> portalUrl	string	https://portal.lazor.sh	no
> configPaymaster	{ paymasterUrl: string; apiKey?: string }	Devnet Kora	no
> rpId	string	portal.lazor.sh	no
> isDebug	boolean	false	no
> children	ReactNode	—	yes
> Prop details
> rpId must match

rpId is the WebAuthn Relying Party ID baked into each passkey at registration time. Changing it between connect calls invalidates existing passkeys. Keep it stable in production.

rpcUrl — Any Solana RPC. Falsy values fall back to the Devnet default.
portalUrl — The WebAuthn-enabled web page the SDK opens via expo-web-browser. Self-hosters can point this at their own portal.
configPaymaster — Kora JSON-RPC endpoint. apiKey is sent as x-api-key on every request.
isDebug — Enables verbose logs via the built-in logger.
Recipes
Switch networks at runtime

const [network, setNetwork] = useState<'devnet' | 'mainnet'>('devnet');
const rpcUrl = network === 'devnet'
? 'https://api.devnet.solana.com'
: 'https://api.mainnet-beta.solana.com';
return (
<LazorKitProvider rpcUrl={rpcUrl}>
<App />
</LazorKitProvider>
);
Changing rpcUrl recreates the Connection. The persisted wallet record is untouched — it continues to work on whichever cluster holds the on-chain wallet account.

Hide behind an env-driven config

const isProd = !**DEV**;
<LazorKitProvider
rpcUrl={isProd
? process.env.EXPO_PUBLIC_MAINNET_RPC!
: 'https://api.devnet.solana.com'}
configPaymaster={{
    paymasterUrl: isProd
      ? process.env.EXPO_PUBLIC_MAINNET_PAYMASTER!
      : 'https://kora.devnet.lazorkit.com',
  }}

>   <App />
> </LazorKitProvider>
> Runtime notes
> Memoizes the Connection on rpcUrl, so rebuilds are cheap.
> Persists { wallet, config } to AsyncStorage under key lazor-wallet-store.
> Runs a state migration on v0 → v1 to move smartWallet from the wallet PDA to the vault PDA. Users who connected before v2 keep their wallet transparently.

useWallet
Hook API — connect, sign, manage sessions & authorities.

import { useWallet } from '@lazorkit/wallet-mobile-adapter';
// Back-compat alias — both exports point to the same hook:
import { useLazorWallet } from '@lazorkit/wallet-mobile-adapter';
useWallet returns the wallet state plus every mutation method. Each mutation opens the portal, signs the challenge with a passkey, then relays the resulting transaction through the paymaster.

Every mutation takes options

Passkey-signed methods require a trailing options: SignOptions argument with your redirectUrl and optional onSuccess / onFail callbacks. Session-signed methods (no portal) only need callbacks.

Quick reference
Method Portal prompt Use for
connect yes Authenticate + create/load the smart wallet
disconnect no Clear local state
signAndSendTransaction yes Single-transaction Execute
signMessage yes Off-chain passkey signature
createSession yes Mint an Ed25519 session key with optional limits
signAndSendWithSession no Send a tx using a stored session keypair
revokeSession yes Close a session, refund rent
addAuthorityEd25519 yes Grant an Ed25519 key admin / spender rights
removeAuthority yes Remove any authority by PDA
listAuthorities no Read all authorities on the wallet
authorizeAndExecute yes (×1) Deferred 2-tx flow for oversized payloads (atomic, bundled)
authorizeDeferred yes TX1 only — returns DeferredPayload to run TX2 later elsewhere
executeDeferred no TX2 only — submit from a previously-authorized payload
reclaimDeferred no Close an expired DeferredExec and reclaim its rent
transferSol yes Convenience — SOL transfer from the vault
State
Field Type Notes
smartWalletPubkey PublicKey | null Vault PDA — where funds live. Use for balances, QRs.
vaultPubkey PublicKey | null Alias of smartWalletPubkey.
walletPdaPubkey PublicKey | null Wallet metadata PDA — only for raw LazorKitClient.
passkeyPubkey number[] | null 33-byte compressed secp256r1 pubkey.
isConnected boolean
isLoading boolean Any async op in progress.
isConnecting boolean
isSigning boolean Portal round-trip in flight.
error Error | null
connection Connection The @solana/web3.js connection from the provider.
Option shapes

// Passkey-signed flows (open the portal). Every mutation that prompts the user uses this.
interface SignOptions {
redirectUrl: string; // your app's deep-link scheme
onSuccess?: (result: any) => void;
onFail?: (error: Error) => void;
}
// No-passkey flows (session / executeDeferred / reclaimDeferred). No redirectUrl needed.
interface TxCallbacks {
onSuccess?: (signature: string) => void;
onFail?: (error: Error) => void;
}
Connection
connect
Open the portal, authenticate the user with their passkey, and either load the existing smart wallet or create a fresh one on-chain.

const wallet = await connect({ redirectUrl: 'myapp://home' });
// wallet.smartWallet → vault PDA (base58)
// wallet.walletPda → metadata PDA
// wallet.walletDevice → authority PDA for this passkey
Returns Promise<WalletInfo>.

disconnect

await disconnect({ onSuccess, onFail });
Clears the persisted state. The on-chain wallet is untouched — reconnect any time.

Transactions
signAndSendTransaction
Single-transaction execution. For payloads up to ~574 bytes of inner instructions.

const sig = await signAndSendTransaction(
{
instructions: [ix],
transactionOptions: {
feeToken: 'USDC', // optional: pay fees in any SPL mint
computeUnitLimit: 400_000,
addressLookupTableAccounts: [alt],
clusterSimulation: 'devnet', // portal-side preview cluster
},
},
{ redirectUrl: 'myapp://callback' },
);
Returns Promise<string> — confirmed signature.

authorizeAndExecute
Two-transaction deferred flow for payloads that don't fit in a single transaction (Jupiter swaps with routes + ATAs, multi-CPI batches). One passkey prompt covers both txs, and the SDK submits them back-to-back. Use this when everything runs in the same process.

const sig = await authorizeAndExecute(
{
instructions: jupiterSwapIxs,
expiryOffset: 300, // slots the authorization stays valid (~2m)
transactionOptions: { clusterSimulation: 'devnet' },
},
{ redirectUrl: 'myapp://callback' },
);
How it works

TX1 Authorize records a SHA-256 hash of your instruction set. TX2 ExecuteDeferred replays those exact instructions — the program rejects any mismatch. authorizeAndExecute submits both transactions automatically and returns TX2's signature.

authorizeDeferred
TX1 only. Passkey-signed Authorize. Returns the payload needed for TX2 so you can run it elsewhere — a server relayer, another device, a scheduled job.

const { signature, deferredPayload, deferredExecPda, counter } = await authorizeDeferred(
{
instructions: jupiterSwapIxs,
expiryOffset: 600, // 10 min
transactionOptions: { clusterSimulation: 'devnet' },
},
{ redirectUrl: 'myapp://callback' },
);
Returns Promise<AuthorizeResult>.

executeDeferred
TX2 only. No passkey prompt. Submit ExecuteDeferred from a payload produced by a prior authorizeDeferred call (either from this device, or deserialized from a wire format — see serializeDeferredPayload).

// Same machine — use the object directly:
const txSig = await executeDeferred({
deferredPayload, // from authorizeDeferred result
refundDestination: smartWalletPubkey, // optional — rent goes to vault
transactionOptions: { clusterSimulation: 'devnet' },
});
reclaimDeferred
No passkey prompt. Close an expired DeferredExec PDA and recover its rent. Gated on the original payer.

await reclaimDeferred({
deferredExecPda, // from authorizeDeferred result
refundDestination: smartWalletPubkey,
});
Cross-machine deferred flows

Any party holding a serialized deferredPayload can submit TX2 — the program verifies the instruction / accounts hash. Use serializeDeferredPayload() to get a JSON-safe string; deserializeDeferredPayload() to reconstruct it before calling executeDeferred.

import {
serializeDeferredPayload,
deserializeDeferredPayload,
} from '@lazorkit/wallet-mobile-adapter';
// Device A:
const { deferredPayload } = await authorizeDeferred(...);
await fetch('/relayer', { method: 'POST', body: serializeDeferredPayload(deferredPayload) });
// Relayer / device B:
const payload = deserializeDeferredPayload(await req.text());
const sig = await executeDeferred({ deferredPayload: payload });
transferSol
Shortcut — SystemProgram.transfer from the vault.

await transferSol(
{ recipient: new PublicKey('…'), lamports: 50_000_000 },
{ redirectUrl: 'myapp://callback' },
);
Session keys
Sessions let you skip the passkey prompt for a scoped set of operations. Create once with a passkey, then sign many transactions with a local Ed25519 key.

createSession

import { Actions, Keypair } from '@lazorkit/wallet-mobile-adapter';
const sessionKp = Keypair.generate();
const currentSlot = BigInt(await connection.getSlot());
const { signature, sessionPda } = await createSession(
{
sessionKey: sessionKp.publicKey,
expiresAtSlot: currentSlot + 216_000n, // ~24h on mainnet
actions: [
Actions.solRecurringLimit({ limit: 1_000_000_000n, window: 216_000n }),
Actions.solMaxPerTx(500_000_000n),
Actions.programWhitelist(JUPITER_PROGRAM_ID),
],
},
{ redirectUrl: 'myapp://callback' },
);
Persist sessionKp.secretKey securely (e.g. expo-secure-store) along with sessionPda.

Actions are immutable

Once a session is created, its action list can't be modified. To change limits, revoke the session and create a new one.

Returns Promise<{ signature: string; sessionPda: PublicKey }>.

signAndSendWithSession
Send a transaction using the stored session keypair. No portal prompt.

const sig = await signAndSendWithSession({
sessionKeypair: sessionKp,
sessionPda,
instructions: [ix],
transactionOptions: { clusterSimulation: 'devnet' },
});
Fails with 0xbd0 (ActionSolLimitExceeded) or related action errors once limits are hit. See Troubleshooting.

revokeSession

await revokeSession(
{
sessionPda,
refundDestination: smartWalletPubkey, // send rent back to the vault
},
{ redirectUrl: 'myapp://callback' },
);
Authorities
Give additional keys access to the wallet — typically an Ed25519 device key for a desktop or hardware companion.

addAuthorityEd25519

import { ROLE_ADMIN, ROLE_SPENDER } from '@lazorkit/wallet-mobile-adapter';
const { signature, newAuthorityPda } = await addAuthorityEd25519(
{ newEd25519Pubkey: deviceKp.publicKey, role: ROLE_SPENDER },
{ redirectUrl: 'myapp://callback' },
);
Role defaults to ROLE_SPENDER (execute only). Use ROLE_ADMIN to also allow session / authority management.

removeAuthority

await removeAuthority(
{ targetAuthorityPda, refundDestination: smartWalletPubkey },
{ redirectUrl: 'myapp://callback' },
);
You cannot remove the last Owner. Transfer ownership first (use LazorKitClient directly — transferOwnership isn't exposed through the hook yet).

listAuthorities
Read all authority accounts on the connected wallet. No passkey prompt.

const authorities = await listAuthorities();
// [{
// authorityPda, authorityType, role,
// credential, secp256r1Pubkey?
// }, …]
Messages
signMessage
Off-chain passkey signature over an arbitrary string. Ideal for session-less auth.

const { signature, signedPayload } = await signMessage(
'Sign in as user-123',
{ redirectUrl: 'myapp://callback' },
);
Both values are base64 strings. Verify server-side against the on-chain authority pubkey.

Returns Promise<{ signature: string; signedPayload: string }>.

Low-level escape hatch
The SDK re-exports everything from the program module — use these for flows the hook doesn't cover (admin protocol ops, manual prepare/finalize, custom signer layouts):

import {
LazorKitClient,
// PDAs
findWalletPda, findVaultPda, findAuthorityPda,
findSessionPda, findDeferredExecPda,
// On-chain state readers (single RPC, combined counter + pubkey)
readAuthorityState, readAuthorityCounter, readAuthorityPubkey,
// Session policy builders
Actions,
// Constants
ROLE_OWNER, ROLE_ADMIN, ROLE_SPENDER,
AUTH_TYPE_ED25519, AUTH_TYPE_SECP256R1,
// Cross-machine deferred helpers
serializeDeferredPayload, deserializeDeferredPayload,
} from '@lazorkit/wallet-mobile-adapter';
const client = new LazorKitClient(connection);
const [walletPda] = findWalletPda(userSeed);
const authorities = await client.listAuthorities(walletPda);
Use `readAuthorityState` for custom flows

If you're building your own prepare/finalize loop, call readAuthorityState(connection, authorityPda) to get { counter, publicKeyBytes } in a single getAccountInfo — saves an RPC round-trip over calling readAuthorityCounter and readAuthorityPubkey separately.

Types
TypeScript interfaces, constants, and session action builders.

Every public type grouped by what you're doing. Import anything below from @lazorkit/wallet-mobile-adapter directly.

Wallet state
WalletInfo
The persisted record written to AsyncStorage after connect.

interface WalletInfo {
credentialId: string; // WebAuthn credential ID (base64)
passkeyPubkey: number[]; // 33-byte compressed secp256r1 pubkey
expo: string;
platform: string; // 'ios' | 'android' | …
/** Vault PDA (base58) — the address funds live at. Show this to users. \*/
smartWallet: string;
/** Wallet metadata PDA (base58). Needed for raw LazorKitClient calls. _/
walletPda: string;
/\*\* Authority PDA (base58) tied to this passkey credential. _/
walletDevice: string;
}
After the v2 upgrade, smartWallet points to the vault PDA rather than the wallet metadata account. Existing persisted wallets are migrated automatically.

WalletConfig / LazorKitProviderProps

interface WalletConfig {
portalUrl: string;
configPaymaster: { paymasterUrl: string; apiKey?: string };
rpcUrl?: string;
rpId?: string;
}
interface LazorKitProviderProps {
rpcUrl?: string;
portalUrl?: string;
configPaymaster?: { paymasterUrl: string; apiKey?: string };
rpId?: string;
isDebug?: boolean;
children: ReactNode;
}
Options & payloads
SignOptions
Trailing argument on every passkey-signed method (opens the portal).

interface SignOptions {
redirectUrl: string; // your app deep-link scheme
onSuccess?: (result: any) => void;
onFail?: (error: Error) => void;
}
TxCallbacks
Trailing argument on non-passkey flows — session-signed txs, executeDeferred, reclaimDeferred. No redirectUrl needed.

interface TxCallbacks {
onSuccess?: (signature: string) => void;
onFail?: (error: Error) => void;
}
Transaction payloads

interface TransactionOptions {
feeToken?: string; // SPL mint base58
addressLookupTableAccounts?: AddressLookupTableAccount[];
computeUnitLimit?: number;
clusterSimulation?: 'devnet' | 'mainnet';
}
interface SignAndSendTransactionPayload {
instructions: TransactionInstruction[];
transactionOptions?: TransactionOptions;
}
interface AuthorizeExecutePayload extends SignAndSendTransactionPayload {
expiryOffset?: number; // slots; default 300 ≈ 2 min
}
// For `authorizeDeferred` — TX1 only, returns payload for later TX2.
interface AuthorizePayload {
instructions: TransactionInstruction[];
expiryOffset?: number; // slots; default 300 ≈ 2 min
transactionOptions?: TransactionOptions;
}
// Returned from `authorizeDeferred`.
interface AuthorizeResult {
signature: string; // TX1 signature
deferredPayload: DeferredPayload; // feed to executeDeferred later
deferredExecPda: PublicKey;
counter: number;
}
// For `executeDeferred` — TX2 only.
interface ExecuteDeferredPayload {
deferredPayload: DeferredPayload;
refundDestination?: PublicKey; // where TX2's DeferredExec rent lands
transactionOptions?: TransactionOptions;
}
// For `reclaimDeferred` — cleanup path.
interface ReclaimDeferredPayload {
deferredExecPda: PublicKey;
refundDestination?: PublicKey;
}
interface SessionSignPayload {
sessionKeypair: Keypair; // Ed25519 keypair from createSession
sessionPda: PublicKey;
instructions: TransactionInstruction[];
transactionOptions?: TransactionOptions;
}
// Internal shape produced by authorize\*/used by executeDeferred. Re-exported from
// the SDK so you can persist it across sessions / machines via the wire helpers.
interface DeferredPayload {
walletPda: PublicKey;
deferredExecPda: PublicKey;
compactInstructions: {
programIdIndex: number;
accountIndexes: number[];
data: Uint8Array;
}[];
remainingAccounts: {
pubkey: PublicKey;
isSigner: boolean;
isWritable: boolean;
}[];
}
// Wire helpers (JSON-safe strings) for cross-machine deferred flows.
serializeDeferredPayload(p: DeferredPayload): string;
deserializeDeferredPayload(s: string): DeferredPayload;
interface TransferSolPayload {
recipient: PublicKey;
lamports: bigint | number;
transactionOptions?: TransactionOptions;
}
Session payloads

interface CreateSessionPayload {
sessionKey: PublicKey; // fresh Ed25519 public key
expiresAtSlot: bigint; // absolute slot
actions?: SessionAction[]; // optional on-chain policy
}
interface RevokeSessionPayload {
sessionPda: PublicKey;
refundDestination?: PublicKey; // default: paymaster fee payer
}
Authority payloads

interface AddAuthorityPayload {
newEd25519Pubkey: PublicKey;
role?: number; // ROLE_ADMIN (1) | ROLE_SPENDER (2 — default)
}
interface RemoveAuthorityPayload {
targetAuthorityPda: PublicKey;
refundDestination?: PublicKey;
}
interface AuthorityEntry {
authorityPda: PublicKey;
authorityType: number; // 0 = ed25519, 1 = secp256r1
role: number; // 0 = owner, 1 = admin, 2 = spender
credential: Uint8Array; // 32 bytes
secp256r1Pubkey?: Uint8Array; // 33 bytes, secp256r1 only
}
type ListAuthoritiesResult = AuthorityEntry[];
Session actions
Actions are immutable policies attached to a session at creation. The on-chain program enforces them on every Execute signed by the session key.

Builder — Actions
Prefer these helpers over hand-building the raw object:

import { Actions } from '@lazorkit/wallet-mobile-adapter';
// SOL
Actions.solLimit(remainingLamports, expiresAt?)
Actions.solRecurringLimit({ limit, window, expiresAt? })
Actions.solMaxPerTx(maxLamports, expiresAt?)
// SPL tokens
Actions.tokenLimit({ mint, remaining, expiresAt? })
Actions.tokenRecurringLimit({ mint, limit, window, expiresAt? })
Actions.tokenMaxPerTx({ mint, max, expiresAt? })
// CPI filters
Actions.programWhitelist(programId, expiresAt?)
Actions.programBlacklist(programId, expiresAt?)
Raw enum / union

enum SessionActionType {
SolLimit = 1,
SolRecurringLimit = 2,
SolMaxPerTx = 3,
TokenLimit = 4,
TokenRecurringLimit = 5,
TokenMaxPerTx = 6,
ProgramWhitelist = 10,
ProgramBlacklist = 11,
}
type SessionAction =
| { type: SessionActionType.SolLimit; remaining: bigint; expiresAt?: bigint }
| { type: SessionActionType.SolRecurringLimit; limit: bigint; window: bigint; expiresAt?: bigint }
| { type: SessionActionType.SolMaxPerTx; max: bigint; expiresAt?: bigint }
| { type: SessionActionType.TokenLimit; mint: PublicKey; remaining: bigint; expiresAt?: bigint }
| { type: SessionActionType.TokenRecurringLimit; mint: PublicKey; limit: bigint; window: bigint; expiresAt?: bigint }
| { type: SessionActionType.TokenMaxPerTx; mint: PublicKey; max: bigint; expiresAt?: bigint }
| { type: SessionActionType.ProgramWhitelist; programId: PublicKey; expiresAt?: bigint }
| { type: SessionActionType.ProgramBlacklist; programId: PublicKey; expiresAt?: bigint };
Common limits (cheat sheet)
Slot window Minutes (≈) Hours (≈) Days (≈)
9_000n 60 1 —
54_000n — 6 —
216_000n — — 1
1_512_000n — — 7
Slot time ≈ 400 ms — these are approximations. Use on-chain slot math for precision.

Roles & auth types

export const ROLE_OWNER = 0; // can transfer ownership
export const ROLE_ADMIN = 1; // manage authorities + sessions
export const ROLE_SPENDER = 2; // execute only
export const AUTH_TYPE_ED25519 = 0;
export const AUTH_TYPE_SECP256R1 = 1;
Errors
SDK-level errors live on a small hierarchy:

class LazorKitError extends Error {
code?: string; // e.g. 'WALLET_CONNECTION_ERROR' | 'SIGNING_ERROR'
}
class WalletConnectionError extends LazorKitError { /_ code: WALLET_CONNECTION_ERROR _/ }
class SigningError extends LazorKitError { /_ code: SIGNING_ERROR _/ }
On-chain program errors appear inside SendTransactionError messages as hex codes — 0xbd0, 0xbd1, etc.
