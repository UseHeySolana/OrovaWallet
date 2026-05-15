import {
  registerDevicePasskey,
  useDevSimulatorInsecureStore,
} from "@/utils/storage/passkeyStore";
import { registerWebAuthnPasskey } from "@/utils/passkey/webAuthnClient";

/**
 * Register seedless unlock with WebAuthn (syncs via iCloud Keychain on Apple devices).
 * Device-only biometric fallback is not used for new registrations — link another device instead.
 */
export async function registerSeedlessAuth(
  walletAddress: string,
  username: string
): Promise<{ credentialId: string }> {
  if (useDevSimulatorInsecureStore) {
    const dev = await registerDevicePasskey(walletAddress);
    return { credentialId: dev.credentialId };
  }

  return registerWebAuthnPasskey(walletAddress, username);
}
