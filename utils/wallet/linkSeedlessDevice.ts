import AppSettings from "@/utils/store/settingsstore.store";
import WalletItem from "@/utils/store/wallet.store";
import UserItem from "@/utils/store/userstore.store";
import { setMpcShareA, getMpcShareA } from "@/utils/storage/mpcShareStore";
import { setStoredMpcSession } from "@/utils/passkey/mpcSessionStorage";
import {
  generateDeviceLinkKeyPair,
  decryptShareAFromPrimary,
  encryptShareAForNewDevice,
  type DeviceLinkKeyPair,
} from "@/utils/wallet/mpc/deviceLinkCrypto";
import {
  requestDeviceLink,
  pollDeviceLinkStatus,
  approveDeviceLink,
  lookupDeviceLinkByCode,
} from "@/utils/request/mpcDeviceLink";
import { fetchMpcShareB } from "@/utils/request/mpcWallet";
import { combineSharesToKeypair, decodeShareBase64 } from "@/utils/wallet/mpc/keyImport";
import { authenticateWithPasskey } from "@/utils/passkey/webAuthnClient";
import { invalidateWalletSignerCache } from "@/utils/wallet/signerManager";
import AsyncStorage from "@react-native-async-storage/async-storage";

const LINK_KEYS_STORAGE = "mpcDeviceLinkKeys_v1";

async function saveLinkKeys(linkId: string, keys: DeviceLinkKeyPair) {
  await AsyncStorage.setItem(
    LINK_KEYS_STORAGE,
    JSON.stringify({
      linkId,
      secretKey: Buffer.from(keys.secretKey).toString("base64"),
    })
  );
}

async function loadLinkKeys(linkId: string): Promise<Uint8Array | null> {
  const raw = await AsyncStorage.getItem(LINK_KEYS_STORAGE);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { linkId: string; secretKey: string };
    if (parsed.linkId !== linkId) return null;
    return new Uint8Array(Buffer.from(parsed.secretKey, "base64"));
  } catch {
    return null;
  }
}

export async function startDeviceLinkRequest(params: {
  username: string;
  walletAddress: string;
}) {
  const keys = generateDeviceLinkKeyPair();
  const res = await requestDeviceLink({
    username: params.username,
    walletAddress: params.walletAddress,
    newDevicePublicKeyBase64: keys.publicKeyBase64,
  });
  if (!res.status) {
    throw new Error(res.message);
  }
  await saveLinkKeys(res.data.link_id, keys);
  return res.data;
}

export async function waitForDeviceLinkApproval(params: {
  linkId: string;
  walletAddress: string;
  username: string;
  pollMs?: number;
  timeoutMs?: number;
}): Promise<{ ok: boolean; message: string }> {
  const { linkId, walletAddress, username } = params;
  const pollMs = params.pollMs ?? 2000;
  const timeoutMs = params.timeoutMs ?? 10 * 60 * 1000;
  const started = Date.now();

  const secretKey = await loadLinkKeys(linkId);
  if (!secretKey) {
    return { ok: false, message: "Link session expired on this device. Start again." };
  }

  while (Date.now() - started < timeoutMs) {
    const status = await pollDeviceLinkStatus(linkId);
    if (!status.status) {
      return { ok: false, message: status.message };
    }

    if (status.data.status === "expired") {
      return { ok: false, message: "Link code expired. Start again on this phone." };
    }

    if (
      status.data.status === "approved" &&
      status.data.encrypted_share_a &&
      status.data.mpc_session_token
    ) {
      try {
        const shareAB64 = decryptShareAFromPrimary(status.data.encrypted_share_a, secretKey);
        await setMpcShareA(shareAB64);
        await setStoredMpcSession(status.data.mpc_session_token);

        const shareBRes = await fetchMpcShareB(walletAddress, status.data.mpc_session_token);
        if (!shareBRes.status) {
          return { ok: false, message: shareBRes.message };
        }

        const keypair = combineSharesToKeypair(
          decodeShareBase64(shareAB64),
          decodeShareBase64(shareBRes.data.share_b)
        );
        if (keypair.publicKey.toBase58() !== walletAddress) {
          return {
            ok: false,
            message: "Linked shares do not match your account. Check your primary device wallet.",
          };
        }

        AppSettings.getState().setWalletMode("mpc");
        WalletItem.getState().updateKeypair(keypair);
        invalidateWalletSignerCache();
        const currentUser = UserItem.getState().user;
        if (currentUser) {
          UserItem.getState().setUser({
            ...currentUser,
            wallet_address: walletAddress,
            wallet_type: "mpc",
            username,
          });
        }

        await AsyncStorage.removeItem(LINK_KEYS_STORAGE);
        return { ok: true, message: "Wallet linked to this device" };
      } catch (e) {
        return {
          ok: false,
          message: e instanceof Error ? e.message : "Could not finish linking",
        };
      }
    }

    await new Promise((r) => setTimeout(r, pollMs));
  }

  return { ok: false, message: "Timed out waiting for your primary device. Try again." };
}

export async function approveDeviceLinkOnPrimary(params: {
  linkId: string;
  walletAddress: string;
  username: string;
  newDevicePublicKeyBase64: string;
}): Promise<{ ok: boolean; message: string }> {
  const shareAB64 = await getMpcShareA();
  if (!shareAB64) {
    return {
      ok: false,
      message: "Device share not found on this phone. This must be your primary device with the wallet.",
    };
  }

  let mpcSessionToken: string;
  try {
    const auth = await authenticateWithPasskey(params.walletAddress, params.username);
    mpcSessionToken = auth.mpcSessionToken;
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Passkey verification failed",
    };
  }

  const encrypted = encryptShareAForNewDevice(shareAB64, params.newDevicePublicKeyBase64);
  const res = await approveDeviceLink({
    linkId: params.linkId,
    encryptedShareA: encrypted,
    mpcSessionToken,
  });
  if (!res.status) {
    return { ok: false, message: res.message };
  }
  return { ok: true, message: "Approved — your other phone can finish linking" };
}

export async function approveDeviceLinkByCode(
  linkCode: string,
  username: string,
  walletAddress: string
) {
  const lookup = await lookupDeviceLinkByCode(linkCode);
  if (!lookup.status) {
    return { ok: false, message: lookup.message };
  }
  if (lookup.data.wallet_address !== walletAddress) {
    return { ok: false, message: "This code is for a different wallet account." };
  }
  return approveDeviceLinkOnPrimary({
    linkId: lookup.data.link_id,
    walletAddress,
    username,
    newDevicePublicKeyBase64: lookup.data.new_device_public_key,
  });
}

export function parseDeviceLinkQr(data: string): {
  linkId: string;
  linkCode: string;
  walletAddress: string;
} | null {
  try {
    const parsed = JSON.parse(data) as {
      type?: string;
      link_id?: string;
      link_code?: string;
      wallet_address?: string;
    };
    if (parsed.type !== "heysolana-device-link" || !parsed.link_id) {
      return null;
    }
    return {
      linkId: parsed.link_id,
      linkCode: parsed.link_code ?? "",
      walletAddress: parsed.wallet_address ?? "",
    };
  } catch {
    return null;
  }
}
