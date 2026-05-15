import { Keypair } from "@solana/web3.js";
import AppSettings from "@/utils/store/settingsstore.store";
import WalletItem from "@/utils/store/wallet.store";
import { setMpcShareA } from "@/utils/storage/mpcShareStore";
import {
  splitKeypairForMpcImport,
  encodeShareBase64,
} from "@/utils/wallet/mpc/keyImport";
import { createMpcWalletOnServer } from "@/utils/request/mpcWallet";
import { invalidateWalletSignerCache } from "@/utils/wallet/signerManager";
import { registerSeedlessAuth } from "@/utils/passkey/registerSeedlessAuth";
import { setPasskeyCredentialLocal } from "@/utils/storage/passkeyStore";
import { uploadShareAPrfBackup } from "@/utils/passkey/shareAPrfBackup";

export interface CreateSeedlessWalletResult {
  ok: boolean;
  message: string;
  walletAddress?: string;
  keypair?: Keypair;
}

/**
 * New-user seedless path: random keypair → MPC split → Share A on device,
 * Share B on server, WebAuthn passkey — no mnemonic.
 */
export async function createSeedlessPasskeyWallet(params?: {
  username?: string;
}): Promise<CreateSeedlessWalletResult> {
  const keypair = Keypair.generate();
  const split = splitKeypairForMpcImport(keypair);
  const walletAddress = split.walletAddress;
  const username = params?.username ?? "wallet";

  try {
    const { credentialId } = await registerSeedlessAuth(walletAddress, username);
    await setPasskeyCredentialLocal(walletAddress, credentialId);
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Seedless setup failed",
    };
  }

  const shareABase64 = encodeShareBase64(split.shareA);
  const serverRes = await createMpcWalletOnServer({
    walletAddress,
    shareBEncryptedBase64: encodeShareBase64(split.shareB),
    username: params?.username,
  });
  if (!serverRes.status) {
    const msg = serverRes.message ?? "Could not register wallet";
    if (msg.includes("already has a seedless wallet")) {
      return {
        ok: false,
        message:
          "This account already has a seedless wallet. Sign in and choose Restore seedless wallet.",
      };
    }
    return { ok: false, message: msg };
  }

  await setMpcShareA(shareABase64);
  AppSettings.getState().setWalletMode("mpc");
  WalletItem.getState().updateKeypair(keypair);
  WalletItem.getState().updatePassphrase(null);
  invalidateWalletSignerCache();

  const backup = await uploadShareAPrfBackup({ walletAddress, username });
  const backupNote = backup.ok
    ? " Passkey backup saved."
    : ` Backup: ${backup.message}`;

  return {
    ok: true,
    message: `Seedless wallet created.${backupNote}`,
    walletAddress,
    keypair,
  };
}
