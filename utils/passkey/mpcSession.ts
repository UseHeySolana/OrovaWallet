import UserItem from "@/utils/store/userstore.store";
import { authenticateWithPasskey } from "@/utils/passkey/webAuthnClient";
import {
  getStoredMpcSession,
  setStoredMpcSession,
} from "@/utils/passkey/mpcSessionStorage";

export {
  getStoredMpcSession,
  setStoredMpcSession,
  clearMpcSession,
} from "@/utils/passkey/mpcSessionStorage";

/** Obtain a valid MPC session token via WebAuthn (or wallet-proof fallback). */
export async function ensureMpcSession(walletAddress: string): Promise<string> {
  const existing = await getStoredMpcSession();
  if (existing) {
    return existing;
  }

  const username = UserItem.getState().user?.username;
  const auth = await authenticateWithPasskey(walletAddress, username);
  await setStoredMpcSession(auth.mpcSessionToken);
  return auth.mpcSessionToken;
}
