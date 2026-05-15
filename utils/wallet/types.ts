/** How the app unlocks and signs transactions. */
export type WalletMode = "local" | "mpc";

export type MpcUpgradeStatus =
  | "not_started"
  | "ownership_proved"
  | "shares_stored"
  | "complete";

export interface MpcShareBundle {
  /** Base64-encoded 32-byte scalar share (device). */
  shareABase64: string;
  /** Base64-encoded 32-byte scalar share (encrypted for server). */
  shareBEncryptedBase64: string;
  /** Wallet address at import time — must match after upgrade. */
  walletAddress: string;
  /** Protocol version for future migrations. */
  version: 1;
}
