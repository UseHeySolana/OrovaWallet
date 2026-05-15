import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from "@/utils/passkey/passkeysNative";
import {
  getPasskeysNative,
  isPasskeysNativeSupported,
} from "@/utils/passkey/passkeysNative";
import {
  fetchPasskeyRegisterOptions,
  verifyPasskeyRegistration,
  fetchPasskeyAuthOptions,
  verifyPasskeyAuth,
} from "@/utils/request/passkey";
import {
  registerDevicePasskey,
  getPasskeyCredential,
  useDevSimulatorInsecureStore,
} from "@/utils/storage/passkeyStore";
import {
  fetchMpcUpgradeChallenge,
  openMpcWalletSession,
} from "@/utils/request/mpcWallet";
import { signOwnershipMessage } from "@/utils/wallet/mpc/keyImport";
import { getWalletSigner } from "@/utils/wallet/signerManager";
import {
  getPrfSaltBase64Url,
  prfKeyFromExtensionOutput,
} from "@/utils/passkey/prfShareA";
import * as Crypto from "expo-crypto";

const PASSKEY_RP_ID =
  process.env.EXPO_PUBLIC_PASSKEY_RP_ID || "hey.yraytestings.com.ng";

type PrfSaltInput = { first: string };
type PasskeyPrfGetExtensions = {
  prf: {
    eval: PrfSaltInput;
    evalByCredential?: Record<string, PrfSaltInput>;
  };
};

function normalizeCreateOptions(
  serverOptions: Record<string, unknown>,
  rpId: string
): PublicKeyCredentialCreationOptionsJSON {
  const pk = (serverOptions.publicKey ?? serverOptions) as Record<string, unknown>;
  return {
    rp: (pk.rp as { id: string; name: string }) ?? { id: rpId, name: "Hey Solana" },
    user: pk.user as PublicKeyCredentialCreationOptionsJSON["user"],
    challenge: pk.challenge as string,
    pubKeyCredParams:
      (pk.pubKeyCredParams as PublicKeyCredentialCreationOptionsJSON["pubKeyCredParams"]) ?? [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
    timeout: (pk.timeout as number) ?? 120000,
    authenticatorSelection:
      (pk.authenticatorSelection as PublicKeyCredentialCreationOptionsJSON["authenticatorSelection"]) ?? {
        authenticatorAttachment: "platform",
        residentKey: "required",
        requireResidentKey: true,
        userVerification: "required",
      },
    attestation: (pk.attestation as "none") ?? "none",
  };
}

function normalizeGetOptions(
  serverOptions: Record<string, unknown>,
  rpId: string
): PublicKeyCredentialRequestOptionsJSON {
  const pk = (serverOptions.publicKey ?? serverOptions) as Record<string, unknown>;
  return {
    challenge: pk.challenge as string,
    timeout: (pk.timeout as number) ?? 120000,
    rpId: (pk.rpId as string) ?? rpId,
    allowCredentials:
      pk.allowCredentials as PublicKeyCredentialRequestOptionsJSON["allowCredentials"],
    userVerification: (pk.userVerification as "preferred") ?? "preferred",
  };
}

async function openSessionWithWalletProof(
  walletAddress: string,
  username: string
): Promise<string> {
  const signer = await getWalletSigner();
  const kp = await signer.getKeypair();
  if (!kp) {
    throw new Error("Wallet not unlocked");
  }

  const challengeRes = await fetchMpcUpgradeChallenge(walletAddress, username);
  if (!challengeRes.status) {
    throw new Error(challengeRes.message);
  }

  const signature = signOwnershipMessage(kp, challengeRes.data.challenge);
  const sessionRes = await openMpcWalletSession({
    walletAddress,
    username,
    challenge: challengeRes.data.challenge,
    signature,
  });
  if (!sessionRes.status) {
    throw new Error(sessionRes.message);
  }

  return sessionRes.data.mpc_session_token;
}

export async function registerWebAuthnPasskey(
  walletAddress: string,
  username: string
): Promise<{ credentialId: string; prfKey: Uint8Array | null }> {
  if (useDevSimulatorInsecureStore) {
    const dev = await registerDevicePasskey(walletAddress);
    return {
      credentialId: dev.credentialId,
      prfKey: await devSimulatorPrfKey(walletAddress),
    };
  }

  if (!(await isPasskeysNativeSupported())) {
    const dev = await registerDevicePasskey(walletAddress);
    return { credentialId: dev.credentialId, prfKey: null };
  }

  const Passkeys = await getPasskeysNative();
  if (!Passkeys) {
    const dev = await registerDevicePasskey(walletAddress);
    return { credentialId: dev.credentialId, prfKey: null };
  }

  const optRes = await fetchPasskeyRegisterOptions(walletAddress, username);
  if (!optRes.status) {
    throw new Error(optRes.message);
  }

  const rpId = optRes.data.rp_id || PASSKEY_RP_ID;
  const createOpts = normalizeCreateOptions(optRes.data.options, rpId);
  createOpts.attestation = "none";
  if (createOpts.authenticatorSelection) {
    createOpts.authenticatorSelection = {
      ...createOpts.authenticatorSelection,
      authenticatorAttachment: "platform",
      residentKey: "required",
      requireResidentKey: true,
      userVerification: "required",
    };
  }
  const prfSalt = await getPrfSaltBase64Url(walletAddress);
  const credential = await Passkeys.create({
    ...createOpts,
    extensions: {
      prf: { eval: { first: prfSalt } },
      credProps: true,
    },
  });
  if (!credential) {
    throw new Error("Passkey creation was cancelled");
  }
  const prfEnabled = credential.clientExtensionResults?.prf?.enabled;
  if (prfEnabled === false && typeof __DEV__ !== "undefined" && __DEV__) {
    console.warn("[SeedlessAuth] Passkey PRF not enabled on this authenticator (iOS 18+ required)");
  }

  const verifyRes = await verifyPasskeyRegistration({
    walletAddress,
    username,
    credential: credential as RegistrationResponseJSON,
  });
  if (!verifyRes.status) {
    throw new Error(verifyRes.message);
  }

  const prfKey = prfKeyFromExtensionOutput(credential.clientExtensionResults?.prf);

  return { credentialId: credential.id, prfKey };
}

async function devSimulatorPrfKey(walletAddress: string): Promise<Uint8Array> {
  const hex = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `dev-prf:${walletAddress}`
  );
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

async function authenticateWithServerWebAuthn(
  walletAddress: string,
  withPrf: boolean
): Promise<{ mpcSessionToken: string; prfKey: Uint8Array | null } | null> {
  if (!(await isPasskeysNativeSupported())) {
    return null;
  }

  const Passkeys = await getPasskeysNative();
  if (!Passkeys) {
    return null;
  }

  const optRes = await fetchPasskeyAuthOptions(walletAddress);
  if (!optRes.status) {
    if (optRes.message.includes("not registered")) {
      return null;
    }
    throw new Error(optRes.message);
  }

  const rpId = optRes.data.rp_id || PASSKEY_RP_ID;
  const getOpts = normalizeGetOptions(optRes.data.options, rpId);
  const prfSalt = withPrf ? await getPrfSaltBase64Url(walletAddress) : undefined;

  let prfExtensions: PasskeyPrfGetExtensions | undefined;
  if (withPrf && prfSalt) {
    const evalByCredential: Record<string, PrfSaltInput> = {};
    for (const cred of getOpts.allowCredentials ?? []) {
      if (cred.id) {
        evalByCredential[cred.id] = { first: prfSalt };
      }
    }
    prfExtensions = {
      prf: {
        eval: { first: prfSalt },
        ...(Object.keys(evalByCredential).length > 0 ? { evalByCredential } : {}),
      },
    };
  }

  const assertion = await Passkeys.get(
    prfExtensions ? { ...getOpts, extensions: prfExtensions } : getOpts
  );
  if (!assertion) {
    throw new Error("Passkey authentication cancelled");
  }

  const verifyRes = await verifyPasskeyAuth({ walletAddress, assertion });
  if (!verifyRes.status) {
    throw new Error(verifyRes.message);
  }

  const prfKey = withPrf
    ? prfKeyFromExtensionOutput(assertion.clientExtensionResults?.prf)
    : null;

  if (withPrf && !prfKey && typeof __DEV__ !== "undefined" && __DEV__) {
    console.warn("[SeedlessAuth] PRF missing after passkey auth", {
      prf: assertion.clientExtensionResults?.prf,
    });
  }

  return {
    mpcSessionToken: verifyRes.data.mpc_session_token,
    prfKey,
  };
}

async function authenticateWithDevicePasskey(
  walletAddress: string,
  username?: string
): Promise<{ mpcSessionToken: string } | null> {
  const { assertDevicePasskey, getPasskeyCredential } = await import(
    "@/utils/storage/passkeyStore"
  );
  const stored = await getPasskeyCredential();
  if (!stored || stored.walletAddress !== walletAddress) {
    return null;
  }

  await assertDevicePasskey(walletAddress);
  if (!username) {
    throw new Error("Username required for MPC session on this device");
  }

  const token = await openSessionWithWalletProof(walletAddress, username);
  return { mpcSessionToken: token };
}

export async function authenticateWithPasskeyAndPrf(
  walletAddress: string,
  username?: string
): Promise<{ mpcSessionToken: string; prfKey: Uint8Array | null }> {
  if (useDevSimulatorInsecureStore) {
    const dev = await authenticateWithDevicePasskey(walletAddress, username);
    if (!dev) {
      throw new Error("Username required for MPC session on this device");
    }
    return { ...dev, prfKey: await devSimulatorPrfKey(walletAddress) };
  }

  try {
    const webAuthn = await authenticateWithServerWebAuthn(walletAddress, true);
    if (webAuthn) return webAuthn;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("cancelled")) throw e;
    if (typeof __DEV__ !== "undefined" && __DEV__) {
      console.warn("[SeedlessAuth] WebAuthn+PRF failed:", e);
    }
  }

  try {
    const webAuthn = await authenticateWithServerWebAuthn(walletAddress, false);
    if (webAuthn) {
      return { mpcSessionToken: webAuthn.mpcSessionToken, prfKey: null };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("cancelled")) throw e;
  }

  const device = await authenticateWithDevicePasskey(walletAddress, username);
  if (device) {
    return { ...device, prfKey: null };
  }
  throw new Error("No passkey available for PRF unlock");
}

export async function authenticateWithPasskey(
  walletAddress: string,
  username?: string
): Promise<{ mpcSessionToken: string }> {
  if (useDevSimulatorInsecureStore) {
    const dev = await authenticateWithDevicePasskey(walletAddress, username);
    if (dev) return dev;
    throw new Error("Username required for MPC session on this device");
  }

  try {
    const webAuthn = await authenticateWithServerWebAuthn(walletAddress, false);
    if (webAuthn) return { mpcSessionToken: webAuthn.mpcSessionToken };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("cancelled")) {
      throw e;
    }
    if (typeof __DEV__ !== "undefined" && __DEV__) {
      console.warn("[SeedlessAuth] WebAuthn session failed, trying device passkey:", e);
    }
  }

  try {
    const device = await authenticateWithDevicePasskey(walletAddress, username);
    if (device) return device;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("cancelled") || msg.includes("not set up")) {
      throw e;
    }
    if (msg.includes("Wallet not unlocked")) {
      throw new Error(
        "Wallet is not on this device yet. Use a synced passkey (iCloud Keychain) or your recovery phrase."
      );
    }
    throw e;
  }

  throw new Error(
    "No passkey found for this wallet. Use your recovery phrase, or set up seedless again on a device that still has the wallet."
  );
}
