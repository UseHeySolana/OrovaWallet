import { saveWalletAddress } from "@/utils/request/db";
import { setWalletSecret } from "@/utils/storage/secureStore";
import AppSettings from "@/utils/store/settingsstore.store";
import UserItem from "@/utils/store/userstore.store";
import WalletItem from "@/utils/store/wallet.store";
import { getKeypairFromMnemonic } from "@/utils/wallet";
import type { CreateWalletResult } from "@/utils/wallet/createWalletForUser";

/** App Review phone demo. OTP is fixed server-side; no WhatsApp message is sent. */
const REVIEW_PHONE_DIGITS = new Set([
  "2348132532430",
  "08132532430",
  "8132532430",
]);

/**
 * App Review email demo — fixed wallet + seed for Apple reviewers.
 * Seed matches Solana path m/44'/501'/0'/0'.
 */
export const APP_REVIEW_DEMO = {
  email: "demo@yraylabs.fun",
  username: "demo.yraylabs",
  otp: "123456",
  walletAddress: "13dqNw1su2UTYPVvqP6ahV8oHtghvoe2k2czkrx9uWJZ",
  mnemonic:
    "mass scrub off warfare beef abstract phrase sock modify reflect various dentist",
} as const;

export function isAppReviewPhone(value?: string | null): boolean {
  if (!value) return false;
  const digits = value.replace(/\D/g, "");
  return REVIEW_PHONE_DIGITS.has(digits);
}

export function isAppReviewEmail(value?: string | null): boolean {
  if (!value) return false;
  return value.trim().toLowerCase() === APP_REVIEW_DEMO.email;
}

export function isAppReviewDemoUsername(value?: string | null): boolean {
  if (!value) return false;
  return value.trim().toLowerCase() === APP_REVIEW_DEMO.username;
}

/** Fixed-seed demo wallet (email and/or username), not the phone review account. */
export function isAppReviewDemoWalletUser(input?: {
  email?: string | null;
  username?: string | null;
} | null): boolean {
  if (!input) return false;
  return isAppReviewEmail(input.email) || isAppReviewDemoUsername(input.username);
}

export function isAppReviewAccount(input?: {
  email?: string | null;
  phoneE164?: string | null;
  mobileNumber?: string | null;
  phone_number?: string | null;
  username?: string | null;
} | null): boolean {
  if (!input) return false;
  if (isAppReviewDemoWalletUser(input)) return true;
  return (
    isAppReviewPhone(input.phoneE164) ||
    isAppReviewPhone(input.mobileNumber) ||
    isAppReviewPhone(input.phone_number)
  );
}

/** Hydrate the fixed App Review demo wallet from its known seed. */
export async function restoreAppReviewDemoWallet(
  username: string
): Promise<CreateWalletResult> {
  const trimmedUsername = username.trim() || APP_REVIEW_DEMO.username;
  try {
    const keypair = await getKeypairFromMnemonic(APP_REVIEW_DEMO.mnemonic);
    const walletAddress = keypair.publicKey.toBase58();
    if (walletAddress !== APP_REVIEW_DEMO.walletAddress) {
      return {
        success: false,
        message: "Demo wallet derivation mismatch",
      };
    }

    await setWalletSecret(APP_REVIEW_DEMO.mnemonic);
    WalletItem.getState().updateKeypair(keypair);
    WalletItem.getState().updatePassphrase(APP_REVIEW_DEMO.mnemonic);

    // Server already seeds this address on get-code; sync is best-effort so
    // login is not blocked on a slow/unreachable add-walletaddress call.
    void saveWalletAddress(walletAddress, trimmedUsername).catch(() => undefined);

    const user = UserItem.getState().user;
    if (user) {
      UserItem.getState().setUser({
        ...user,
        wallet_address: walletAddress,
      });
    }

    // Do not prompt backup for the shared review account.
    AppSettings.getState().setPromptWalletBackup(false);

    return { success: true, walletAddress };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not restore demo wallet";
    return { success: false, message };
  }
}
