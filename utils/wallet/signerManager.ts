import AppSettings from "@/utils/store/settingsstore.store";
import { hasMpcShareA } from "@/utils/storage/mpcShareStore";
import { getWalletSecret } from "@/utils/storage/secureStore";
import type { WalletMode } from "@/utils/wallet/types";
import type { WalletSigner } from "@/utils/wallet/signers/types";
import { LocalMnemonicSigner } from "@/utils/wallet/signers/localSigner";
import { MpcWalletSigner } from "@/utils/wallet/signers/mpcSigner";

let cachedSigner: WalletSigner | null = null;
let cachedMode: WalletMode | null = null;

/** Resolve effective wallet mode from settings + on-device material. */
export async function resolveWalletMode(): Promise<WalletMode> {
  const configured = AppSettings.getState().walletMode;
  if (configured === "mpc") {
    return "mpc";
  }
  const secret = await getWalletSecret();
  if (secret) return "local";
  const hasShare = await hasMpcShareA();
  if (hasShare) return "mpc";
  return "local";
}

export async function getWalletSigner(): Promise<WalletSigner> {
  const mode = await resolveWalletMode();
  if (cachedSigner && cachedMode === mode) {
    return cachedSigner;
  }
  cachedMode = mode;
  cachedSigner = mode === "mpc" ? new MpcWalletSigner() : new LocalMnemonicSigner();
  return cachedSigner;
}

export function invalidateWalletSignerCache(): void {
  cachedSigner = null;
  cachedMode = null;
}

export async function getWalletMode(): Promise<WalletMode> {
  return resolveWalletMode();
}
