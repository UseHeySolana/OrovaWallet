import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from "react-native-passkeys/build/ReactNativePasskeys.types";

type PasskeysModule = typeof import("react-native-passkeys");

let cached: PasskeysModule | null | undefined;

/** Load react-native-passkeys only when the native module is linked (dev build). */
export async function getPasskeysNative(): Promise<PasskeysModule | null> {
  if (cached !== undefined) {
    return cached;
  }
  try {
    cached = await import("react-native-passkeys");
    return cached;
  } catch {
    cached = null;
    return null;
  }
}

export async function isPasskeysNativeSupported(): Promise<boolean> {
  const mod = await getPasskeysNative();
  if (!mod) {
    return false;
  }
  try {
    return mod.isSupported();
  } catch {
    return false;
  }
}

export type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
};
