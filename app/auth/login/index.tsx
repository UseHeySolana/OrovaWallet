import React, { useEffect, useRef, useState } from "react";
import {
  BackHandler,
  Platform,
  View,
} from "react-native";
import CText from "@/components/TextComp";
import { Image } from "expo-image";
import AppSettings from "@/utils/store/settingsstore.store";
import { router, useRootNavigationState } from "expo-router";
import UserItem from "@/utils/store/userstore.store";
import Buttons from "@/components/ButtonComp";
import { getCode, loginWithGoogle, loginWithGoogleBackup, verifyCode } from "@/utils/request/db";
import {
  clearStaleWalletPublicKey,
  hydrateWalletFromSecret,
  isWalletUnlockedForUser,
} from "@/utils/wallet/walletUnlock";
import { TouchableOpacity } from "react-native";
import { useThemeContext } from "@/context/ThemeContext";
import Otpsheet from "@/components/Sheets/OtpSheets";
import WalletSheet from "@/components/Sheets/WalletOptions";
import SmartContactInput, {
  DEFAULT_COUNTRY,
} from "@/components/auth/SmartContactInput";
import AuthFlowScreen from "@/components/auth/AuthFlowScreen";
import AuthFlowHeader from "@/components/auth/AuthFlowHeader";
import AuthFlowFooter from "@/components/auth/AuthFlowFooter";
import AuthCard from "@/components/auth/AuthCard";
import GoogleSignInButton from "@/components/auth/GoogleSignInButton";
import PinConfirmModal from "@/components/backup/PinConfirmModal";
import { authUi } from "@/components/auth/authUi";
import {
  CountrySelection,
  parseSmartContact,
} from "@/utils/contact/smartContact";
import { toPhoneE164 } from "@/utils/phone/phoneE164";
import { BiometricAuth } from "@/utils/dashboard";
import { OtpInput, OtpInputRef } from "react-native-otp-entry";
import { compactOtpInputTheme } from "@/components/otpInputTheme";
import {
  getGoogleSignInErrorMessage,
  refreshGoogleAuthSession,
  signInWithGoogleForAuth,
  type GoogleAuthSession,
} from "@/services/google/googleAuth";
import { isGoogleSignInConfigured } from "@/utils/google/googleConfig";
import {
  peekGoogleDriveWalletBackup,
  restoreWalletFromGoogleDrive,
} from "@/services/backup/walletBackupManager";
import { userNeedsLegacyWalletRestore, accountMissingServerWallet } from "@/utils/backup/backupStatus";
import { createWalletForUser } from "@/utils/wallet/createWalletForUser";

import {
  buildSessionUserFromServer,
  type ServerAuthUser,
} from "@/utils/account/userContact";
import {
  APP_REVIEW_DEMO,
  isAppReviewAccount,
  isAppReviewDemoWalletUser,
  isAppReviewEmail,
  isAppReviewPhone,
  restoreAppReviewDemoWallet,
} from "@/utils/auth/reviewAccount";

/** Survives Login remounts — prevents provision/nav loops when replace throws. */
let loginProvisionLock = false;
let loginDashboardNavScheduled = false;

function replaceToDashboard() {
  if (loginDashboardNavScheduled) return;
  loginDashboardNavScheduled = true;
  const attempt = (retriesLeft: number) => {
    const retry = () => {
      if (retriesLeft <= 0) {
        loginDashboardNavScheduled = false;
        return;
      }
      setTimeout(() => attempt(retriesLeft - 1), 50);
    };
    try {
      // expo-router may reject asynchronously if the root layout is remounting.
      Promise.resolve(router.replace("/dashboard")).catch(retry);
    } catch {
      retry();
    }
  };
  // Defer until after the current commit so Root Layout / Slot are mounted.
  setTimeout(() => attempt(5), 0);
}

export default function Login() {
  const rootNavState = useRootNavigationState();
  const navigationReady = Boolean(rootNavState?.key);
  const [contactInput, setContactInput] = useState("");
  const [userDetails, setUserDetails] = useState({
    username: "",
    mobileNumber: "",
    wallet_address: "",
    email: "",
  });

  const [otpValue, setOtpValue] = useState("");
  const { setUser, user, clearData } = UserItem();
  const { setLoading, isLoading, setToast, openWithAuth, pin, setPin } = AppSettings();
  const [currentState, setCurrentState] = useState<
    "verify-phrase" | "start-wallet" | "sign-up" | "set-pin" | ""
  >("");

  const [selectedValue, setSelectedValue] =
    useState<CountrySelection>(DEFAULT_COUNTRY);
  const [fingerPrintSigning, setFingerPrintSigning] = useState(false);
  const [pinSignin, setPinSignin] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleRestoreOpen, setGoogleRestoreOpen] = useState(false);
  const [googleRestoreLoading, setGoogleRestoreLoading] = useState(false);
  const [googleRestoreSession, setGoogleRestoreSession] =
    useState<GoogleAuthSession | null>(null);
  const [googleRestorePreview, setGoogleRestorePreview] = useState<{
    username: string;
    walletAddress: string;
  } | null>(null);
  const [pendingServerLogin, setPendingServerLogin] =
    useState<ServerAuthUser | null>(null);
  const { isDarkMode } = useThemeContext();
  const otpRef = useRef<OtpInputRef>(null);
  const reviewProvisionAttempted = useRef(false);
  const reviewProvisionInFlight = useRef(false);
  const [attempts, setAttempts] = useState(0);

  const [pinValue, setPinValue] = useState("");
  const [showLegacyWalletOptions, setShowLegacyWalletOptions] = useState(false);
  const googleEnabled = isGoogleSignInConfigured();

  const refreshLegacyWalletSheet = async (
    sessionUser: ReturnType<typeof buildSessionUserFromServer>
  ) => {
    const needsLegacy = await userNeedsLegacyWalletRestore({
      username: sessionUser.username,
      mobileNumber: sessionUser.mobileNumber,
      phoneE164: sessionUser.phoneE164,
      email: sessionUser.email,
      wallet_address: sessionUser.wallet_address,
      pin: "",
    });
    setShowLegacyWalletOptions(needsLegacy);
  };

  const silentProvisionWallet = async (
    sessionUser: ReturnType<typeof buildSessionUserFromServer>
  ): Promise<boolean> => {
    if (loginProvisionLock || reviewProvisionInFlight.current) {
      return false;
    }
    loginProvisionLock = true;
    reviewProvisionInFlight.current = true;
    setLoading(true);
    try {
      // Never mint a random wallet for the fixed App Review demo account.
      if (isAppReviewDemoWalletUser(sessionUser)) {
        const result = await restoreAppReviewDemoWallet(
          sessionUser.username || APP_REVIEW_DEMO.username
        );
        if (!result.success) {
          setToast(result.message, "error");
          return false;
        }
        setUser({
          ...sessionUser,
          email: sessionUser.email || APP_REVIEW_DEMO.email,
          username: sessionUser.username || APP_REVIEW_DEMO.username,
          wallet_address: result.walletAddress,
        });
        setCurrentState("");
        setShowLegacyWalletOptions(false);
        setToast("Demo wallet ready", "success");
        replaceToDashboard();
        return true;
      }

      const result = await createWalletForUser(sessionUser.username);
      if (!result.success) {
        setToast(result.message, "error");
        return false;
      }

      setUser({
        ...sessionUser,
        wallet_address: result.walletAddress,
      });
      setCurrentState("");
      setShowLegacyWalletOptions(false);
      setToast("Wallet ready — set a PIN and back up when prompted", "success");
      replaceToDashboard();
      return true;
    } finally {
      reviewProvisionInFlight.current = false;
      loginProvisionLock = false;
      setLoading(false);
    }
  };

  const provisionReviewWallet = async (
    sessionUser: ReturnType<typeof buildSessionUserFromServer>
  ): Promise<boolean> => {
    if (
      loginProvisionLock ||
      reviewProvisionInFlight.current ||
      reviewProvisionAttempted.current
    ) {
      return false;
    }
    reviewProvisionAttempted.current = true;
    reviewProvisionInFlight.current = true;
    loginProvisionLock = true;
    try {
      // Fixed-seed demo (email and/or username). Phone review creates a local wallet.
      if (isAppReviewDemoWalletUser(sessionUser)) {
        const result = await restoreAppReviewDemoWallet(
          sessionUser.username || APP_REVIEW_DEMO.username
        );
        if (!result.success) {
          setToast(result.message, "error");
          return false;
        }
        setUser({
          ...sessionUser,
          email: sessionUser.email || APP_REVIEW_DEMO.email,
          username: sessionUser.username || APP_REVIEW_DEMO.username,
          wallet_address: result.walletAddress,
        });
        setCurrentState("");
        setShowLegacyWalletOptions(false);
        setToast("Demo wallet ready", "success");
        replaceToDashboard();
        return true;
      }

      // Phone review path — release locks so silentProvision can own them.
      reviewProvisionInFlight.current = false;
      loginProvisionLock = false;
      return await silentProvisionWallet({
        ...sessionUser,
        wallet_address: "",
      });
    } finally {
      reviewProvisionInFlight.current = false;
      loginProvisionLock = false;
    }
  };

  const promptWalletRestoreOrProvision = async (
    sessionUser: ReturnType<typeof buildSessionUserFromServer>
  ) => {
    if (accountMissingServerWallet(sessionUser.wallet_address)) {
      await silentProvisionWallet(sessionUser);
      return;
    }

    await refreshLegacyWalletSheet(sessionUser);
    setCurrentState("start-wallet");
  };

  useEffect(() => {
    if (!user || googleRestoreOpen || !navigationReady) return;
    if (
      loginProvisionLock ||
      reviewProvisionInFlight.current ||
      loginDashboardNavScheduled
    ) {
      return;
    }

    let cancelled = false;
    const walletAddress = user.wallet_address || "";

    (async () => {
      const unlocked = await isWalletUnlockedForUser(walletAddress);
      if (
        cancelled ||
        loginProvisionLock ||
        reviewProvisionInFlight.current ||
        loginDashboardNavScheduled
      ) {
        return;
      }

      if (unlocked) {
        await hydrateWalletFromSecret();
        if (cancelled) return;
        setCurrentState("");
        if (openWithAuth) {
          setFingerPrintSigning(true);
          setTimeout(() => {
            BiometricAuth();
          }, 1000);
        } else {
          replaceToDashboard();
        }
        return;
      }

      clearStaleWalletPublicKey(walletAddress);

      setUserDetails((prev) => ({
        ...prev,
        mobileNumber: user.mobileNumber,
      }));

      setFingerPrintSigning(false);
      setPinSignin(false);

      // Review accounts: hydrate the fixed demo wallet (or silently provision
      // the phone review account). Never fall through to createWalletForUser
      // for the email demo — that races and leaves loading stuck.
      if (
        isAppReviewAccount({
          email: user.email,
          phoneE164: user.phoneE164,
          mobileNumber: user.mobileNumber,
          username: user.username,
        })
      ) {
        await provisionReviewWallet({
          username: user.username,
          mobileNumber: user.mobileNumber,
          phoneE164: user.phoneE164,
          email: user.email || (isAppReviewDemoWalletUser(user) ? APP_REVIEW_DEMO.email : ""),
          wallet_address: walletAddress,
          pin: user.pin || "",
        });
        return;
      }

      await promptWalletRestoreOrProvision({
        username: user.username,
        mobileNumber: user.mobileNumber,
        phoneE164: user.phoneE164,
        email: user.email,
        wallet_address: walletAddress,
        pin: user.pin || "",
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [
    user?.username,
    user?.wallet_address,
    user?.email,
    openWithAuth,
    pin.length,
    googleRestoreOpen,
    navigationReady,
  ]);

  const offerGoogleRestoreIfAvailable = async (
    session: GoogleAuthSession,
    _expectedWalletAddress?: string,
    serverUser?: ServerAuthUser
  ): Promise<boolean> => {
    try {
      const backup = await peekGoogleDriveWalletBackup({
        accessToken: session.accessToken,
      });
      if (!backup) return false;

      // Always offer Drive restore when a backup exists. On confirm, the backup
      // wallet replaces whatever is in the DB (including a mismatched empty/new one).

      if (serverUser) {
        setPendingServerLogin(serverUser);
      }
      setGoogleRestoreSession(session);
      setGoogleRestorePreview(backup);
      setGoogleRestoreOpen(true);
      setToast(`Backup found for @${backup.username}`, "success");
      return true;
    } catch {
      return false;
    }
  };

  const finishLoginFromServerUser = async (
    data: ServerAuthUser,
    googleEmail?: string,
    googleSession?: GoogleAuthSession,
    options?: { skipRestoreOffer?: boolean; clearGlobalLoading?: boolean }
  ) => {
    const clearGlobalLoading = options?.clearGlobalLoading !== false;
    const sessionUser = buildSessionUserFromServer(data, googleEmail);
    const walletAddress = data.wallet_address || sessionUser.wallet_address;
    // Allow a fresh review-wallet provision on each completed OTP / Google login,
    // unless a provision/nav is already in flight from a remounted effect.
    if (!loginProvisionLock && !loginDashboardNavScheduled) {
      reviewProvisionAttempted.current = false;
    }

    const unlocked = await isWalletUnlockedForUser(walletAddress);
    if (unlocked) {
      setUser({
        ...sessionUser,
        wallet_address: walletAddress,
      });
      await hydrateWalletFromSecret();
      setCurrentState("");
      setPinSignin(false);
      setFingerPrintSigning(false);
      setPendingServerLogin(null);
      setToast("Welcome back!", "success");
      replaceToDashboard();
      if (clearGlobalLoading) setLoading(false);
      return;
    }

    clearStaleWalletPublicKey(walletAddress);

    if (
      isAppReviewAccount({
        email: sessionUser.email,
        phoneE164: sessionUser.phoneE164,
        mobileNumber: sessionUser.mobileNumber,
        phone_number: data.phone_number,
        username: sessionUser.username,
      })
    ) {
      const provisioned = await provisionReviewWallet(sessionUser);
      if (clearGlobalLoading) setLoading(false);
      if (provisioned) return;
    }

    if (googleSession && !options?.skipRestoreOffer) {
      const offered = await offerGoogleRestoreIfAvailable(
        googleSession,
        walletAddress,
        data
      );
      if (offered) {
        if (clearGlobalLoading) setLoading(false);
        return;
      }
    }

    setPendingServerLogin(null);

    if (accountMissingServerWallet(walletAddress)) {
      const provisioned = await silentProvisionWallet({
        ...sessionUser,
        wallet_address: "",
      });
      if (clearGlobalLoading) setLoading(false);
      if (provisioned) return;
    }

    setUser({
      ...sessionUser,
      wallet_address: walletAddress,
    });
    await promptWalletRestoreOrProvision({
      ...sessionUser,
      wallet_address: walletAddress,
    });
    if (clearGlobalLoading) setLoading(false);
  };

  const handleLegacyCreateWallet = async () => {
    const username = user?.username || userDetails.username;
    if (!username) {
      setToast("Sign in again to continue", "error");
      return;
    }

    setCurrentState("");
    setLoading(true);
    try {
      const result = await createWalletForUser(username);
      if (!result.success) {
        setToast(result.message, "error");
        setCurrentState("start-wallet");
        return;
      }

      const currentUser = UserItem.getState().user;
      if (currentUser) {
        setUser({
          ...currentUser,
          wallet_address: result.walletAddress,
        });
      }
      setShowLegacyWalletOptions(false);
      setToast("Wallet created", "success");
      replaceToDashboard();
    } finally {
      setLoading(false);
    }
  };

  const loginWithContact = async () => {
    const parsed = parseSmartContact(contactInput, selectedValue);
    if (parsed.mode === "invalid") {
      setToast(parsed.message, "error");
      return;
    }

    // Fresh attempt — clear remount locks from a prior failed navigation.
    loginProvisionLock = false;
    loginDashboardNavScheduled = false;
    reviewProvisionAttempted.current = false;

    setLoading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const response = await getCode(
        parsed.mode === "email"
          ? { email: parsed.email }
          : {
              phone_number: parsed.phoneE164,
              country: parsed.country,
            }
      );

      if (response.status !== false) {
        setOtpValue("");
        setUserDetails({
          ...userDetails,
          username: response.data.username,
          wallet_address: response.data.wallet_address,
          email: response.data.email || (parsed.mode === "email" ? parsed.email : ""),
          mobileNumber: parsed.mode === "phone" ? parsed.mobileNumber : "",
        });
        setCurrentState("set-pin");
      } else {
        setToast(response.message || "Something went wrong", "error");
      }
    } finally {
      setLoading(false);
    }
  };

  const loginWithGoogleAccount = async () => {
    setGoogleLoading(true);
    let ownsGlobalLoading = false;
    try {
      const session = await signInWithGoogleForAuth();
      setLoading(true);
      ownsGlobalLoading = true;

      const response = await loginWithGoogle({
        google_id_token: session.idToken,
        google_id: session.id,
      });

      if (response.status !== false) {
        setToast("Signed in with Google", "success");
        await finishLoginFromServerUser(response.data, session.email, session);
        ownsGlobalLoading = false;
        return;
      }

      if (response.notFound) {
        const offered = await offerGoogleRestoreIfAvailable(session);
        if (offered) {
          setLoading(false);
          ownsGlobalLoading = false;
          return;
        }

        setToast("No account yet — pick a username to get started", "success");
        router.replace({
          pathname: "/auth/username",
          params: {
            contactMethod: "google",
            email: session.email,
          },
        });
        return;
      }

      setToast(response.message || "Google sign-in failed", "error");
    } catch (error) {
      setToast(getGoogleSignInErrorMessage(error), "error");
    } finally {
      setGoogleLoading(false);
      if (ownsGlobalLoading) setLoading(false);
    }
  };

  const startWalletSheetGoogleRestore = async () => {
    setCurrentState("");
    setGoogleLoading(true);
    try {
      const session = await signInWithGoogleForAuth();
      const backup = await peekGoogleDriveWalletBackup({
        accessToken: session.accessToken,
      });
      if (!backup) {
        setToast("No Google Drive backup found for this account", "error");
        setCurrentState("start-wallet");
        return;
      }
      setGoogleRestoreSession(session);
      setGoogleRestorePreview(backup);
      setGoogleRestoreOpen(true);
    } catch (error) {
      setToast(getGoogleSignInErrorMessage(error), "error");
      setCurrentState("start-wallet");
    } finally {
      setGoogleLoading(false);
    }
  };

  const confirmGoogleRestoreLogin = async (enteredPin: string) => {
    if (!googleRestoreSession || !googleRestorePreview) {
      return;
    }

    setGoogleRestoreLoading(true);
    setLoading(true);
    try {
      const restored = await restoreWalletFromGoogleDrive(enteredPin, {
        accessToken: googleRestoreSession.accessToken,
        googleEmail: googleRestoreSession.email,
      });
      setPin(enteredPin);

      const unlocked = await isWalletUnlockedForUser(restored.walletAddress);
      if (!unlocked) {
        throw new Error("Wallet secret was not saved on this device");
      }
      await hydrateWalletFromSecret();

      const authSession = await refreshGoogleAuthSession(googleRestoreSession);
      const googleEmail = googleRestoreSession.email;
      const response = await loginWithGoogleBackup({
        google_id_token: authSession.idToken,
        google_id: authSession.id,
        username: restored.username,
        wallet_address: restored.walletAddress,
      });

      // Backup wallet always wins over DB (even if DB already had an address).
      const serverUser: ServerAuthUser = {
        ...(response.status !== false
          ? response.data
          : pendingServerLogin ?? {
              username: restored.username,
              email: googleEmail,
            }),
        wallet_address: restored.walletAddress,
        username:
          (response.status !== false
            ? response.data.username
            : pendingServerLogin?.username) || restored.username,
      };

      setGoogleRestoreOpen(false);
      setGoogleRestoreSession(null);
      setGoogleRestorePreview(null);
      setPendingServerLogin(null);

      if (response.status === false) {
        setToast(
          response.message ||
            "Signed in locally — account link will sync on next login",
          "success"
        );
      }

      await finishLoginFromServerUser(
        serverUser,
        googleEmail,
        authSession,
        { skipRestoreOffer: true, clearGlobalLoading: false }
      );
    } catch (error) {
      setToast(getGoogleSignInErrorMessage(error), "error");
    } finally {
      setGoogleRestoreLoading(false);
      setLoading(false);
    }
  };

  const verifyPin = async () => {
    if (pinValue.length < 4) {
      setToast("Invalid Pin", "error");
      otpRef.current?.clear();
      return;
    }
    if (pinValue === pin) {
      const unlocked = await isWalletUnlockedForUser(user?.wallet_address);
      if (!unlocked) {
        setToast("Restore your wallet to continue", "error");
        setPinSignin(false);
        if (user) {
          if (accountMissingServerWallet(user.wallet_address)) {
            await silentProvisionWallet({
              username: user.username,
              mobileNumber: user.mobileNumber,
              phoneE164: user.phoneE164,
              email: user.email,
              wallet_address: user.wallet_address || "",
              pin: user.pin || "",
            });
            return;
          }
          await refreshLegacyWalletSheet({
            username: user.username,
            mobileNumber: user.mobileNumber,
            phoneE164: user.phoneE164,
            email: user.email,
            wallet_address: user.wallet_address || "",
            pin: user.pin || "",
          });
        }
        setCurrentState("start-wallet");
        return;
      }
      await hydrateWalletFromSecret();
      setToast("Pin Verified", "success");
      replaceToDashboard();
    } else {
      setToast("Invalid Pin", "error");
      otpRef.current?.clear();
      setAttempts(attempts + 1);
      if (attempts === 1) {
        setToast("Invalid Pin, 2 attempts left", "error");
      } else if (attempts === 2) {
        setToast("Invalid Pin, 1 attempt left", "error");
      }

      if (attempts >= 3) {
        setToast("You have reached the maximum number of attempts", "error");
        setCurrentState("");
        clearData();
        if (Platform.OS === "ios") {
          BackHandler.exitApp();
        } else {
          BackHandler.exitApp();
        }
        return;
      }
    }
  };

  const verifyOtp = async () => {
    if (otpValue.length < 6) {
      setToast("Invalid Otp", "error");
      return;
    }
    loginProvisionLock = false;
    loginDashboardNavScheduled = false;
    reviewProvisionAttempted.current = false;
    setLoading(true);
    const response = await verifyCode(otpValue, userDetails.username);
    if (response.status !== false) {
      setToast("Verification Successfull", "success");
      setOtpValue("");
      await finishLoginFromServerUser({
        username: userDetails.username,
        wallet_address: userDetails.wallet_address,
        email: userDetails.email,
        phone_number: userDetails.mobileNumber
          ? toPhoneE164(userDetails.mobileNumber, selectedValue.callingCode)
          : undefined,
      });
    } else {
      setToast(response.message || "Something went wrong", "error");
      setLoading(false);
    }
  };

  const signUpFooter = (
    <AuthFlowFooter
      prompt="Don't have an Account?"
      actionLabel="Sign up"
      onPress={() => router.replace("/auth/register")}
    />
  );

  return (
    <>
      {fingerPrintSigning ? (
        <View className="relative bg-grey dark:bg-dark flex-1 w-full justify-center items-center px-4">
          <View className="w-full max-w-md flex justify-center gap-y-10 items-center">
            <View className="h-40 w-40 rounded-full">
              <Image
                source={require("@/assets/images/icon.png")}
                style={{ width: "100%", height: "100%" }}
                contentFit="contain"
              />
            </View>

            <TouchableOpacity
              onPress={BiometricAuth}
              className="bg-purple py-5 flex flex-row justify-center items-center gap-x-3 rounded-full overflow-hidden w-full"
            >
              <View className="h-6 w-6 rounded-full">
                <Image
                  source={require("@/assets/images/biometric2.png")}
                  style={{ width: "100%", height: "100%" }}
                  contentFit="contain"
                />
              </View>

              <CText className="text-white text-[1.5rem] font-bold">
                Unlock with Biometric
              </CText>
            </TouchableOpacity>

            <View className={authUi.headerGap}>
              <CText
                style={{ fontFamily: "bold" }}
                className="text-[1rem] text-center"
              >
                Tap to login with your biometrics
              </CText>
              <TouchableOpacity onPress={() => setFingerPrintSigning(false)}>
                <CText
                  textColor="text-purple"
                  className="text-[1rem] text-center"
                >
                  or sign in with Google, email, or phone
                </CText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : (
        <AuthFlowScreen footer={signUpFooter}>
          {pinSignin ? (
            <>
              <AuthFlowHeader
                showLogo
                title="Welcome back!"
                subtitle="Let's make handsfreee transactions"
              />

              <CText className={`${authUi.subtitle} text-center`}>
                Enter your pin
              </CText>

              <AuthCard className="items-center">
                <OtpInput
                  ref={otpRef}
                  secureTextEntry={true}
                  focusColor={"#971BB2"}
                  theme={compactOtpInputTheme}
                  textProps={{
                    style: {
                      fontFamily: "bold",
                      fontSize: 18,
                      color: isDarkMode ? "white" : "black",
                    },
                  }}
                  blurOnFilled={true}
                  numberOfDigits={4}
                  onFilled={(text) => {
                    setPinValue(text);
                  }}
                />
              </AuthCard>

              <Buttons
                buttonType="pressable"
                onPress={() => verifyPin()}
                text="Login"
                loading={isLoading}
                type="primary"
              />
            </>
          ) : (
            <>
              <AuthFlowHeader
                showLogo
                title="Welcome back!"
                subtitle="Use your email or mobile number to sign in."
              />

              <SmartContactInput
                value={contactInput}
                onChangeText={setContactInput}
                selectedValue={selectedValue}
                onCountryChange={setSelectedValue}
              />

              <Buttons
                buttonType="pressable"
                onPress={() => loginWithContact()}
                text="Login"
                loading={isLoading && !googleLoading}
                type="primary"
              />

              {googleEnabled ? (
                <GoogleSignInButton
                  loading={googleLoading}
                  onPress={loginWithGoogleAccount}
                  accessibilityLabel="Sign in with Google"
                />
              ) : null}
            </>
          )}
        </AuthFlowScreen>
      )}

      <Otpsheet
        open={currentState === "set-pin"}
        verifyOtp={verifyOtp}
        setOtpValue={(text) => setOtpValue(text)}
        hint={
          isAppReviewEmail(contactInput) ||
          isAppReviewEmail(userDetails.email) ||
          isAppReviewPhone(contactInput) ||
          isAppReviewPhone(userDetails.mobileNumber)
            ? "Enter the one-time code from the App Review notes. No message is sent for this demo account."
            : userDetails.email && !userDetails.mobileNumber
              ? "Your one time password has been sent to your email"
              : "Your one time password has been sent to your whatsapp number"
        }
      />

      <WalletSheet
        open={currentState === "start-wallet"}
        showLegacyOptions={showLegacyWalletOptions}
        onCreateWallet={handleLegacyCreateWallet}
        onRestoreFromGoogle={
          googleEnabled ? startWalletSheetGoogleRestore : undefined
        }
      />

      <PinConfirmModal
        visible={googleRestoreOpen}
        title="Restore from Google Drive"
        subtitle={
          googleRestorePreview
            ? `Enter your app PIN to restore @${googleRestorePreview.username} from your Google backup.`
            : "Enter your app PIN to restore your wallet."
        }
        confirmLabel="Restore & sign in"
        loading={googleRestoreLoading}
        onClose={() => {
          setGoogleRestoreOpen(false);
          if (pendingServerLogin) {
            const sessionUser = buildSessionUserFromServer(
              pendingServerLogin,
              googleRestoreSession?.email
            );
            setUser({
              ...sessionUser,
              wallet_address:
                pendingServerLogin.wallet_address || sessionUser.wallet_address,
            });
            setPendingServerLogin(null);
            void refreshLegacyWalletSheet({
              ...sessionUser,
              wallet_address:
                pendingServerLogin.wallet_address || sessionUser.wallet_address,
            });
            setCurrentState("start-wallet");
          }
          setGoogleRestoreSession(null);
          setGoogleRestorePreview(null);
        }}
        onConfirm={confirmGoogleRestoreLogin}
      />
    </>
  );
}
