import { useCallback, useEffect, useState } from "react";

import AppSettings from "@/utils/store/settingsstore.store";
import UserItem from "@/utils/store/userstore.store";
import {
  backupWalletToGoogleDrive,
  getGoogleSignInErrorMessage,
  restoreWalletFromGoogleDrive,
} from "@/services/backup/walletBackupManager";
import { getWalletBackupMeta } from "@/services/backup/walletBackupStorage";
import {
  logBackup,
  logBackupError,
  setBackupStatusListener,
} from "@/services/backup/backupLogger";

type PinModalMode = "backup" | "restore";

export function useGoogleDriveBackupActions() {
  const { user, setUser } = UserItem();
  const { pin, setToast, setLoading } = AppSettings();
  const [pinModalMode, setPinModalMode] = useState<PinModalMode | null>(null);
  const [backupMeta, setBackupMeta] = useState<Awaited<
    ReturnType<typeof getWalletBackupMeta>
  > | null>(null);
  const [loadingAction, setLoadingAction] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    setBackupStatusListener((step, detail) => {
      setStatusMessage(detail ? `${step} — ${detail}` : step);
    });
    return () => setBackupStatusListener(null);
  }, []);

  const refreshBackupMeta = useCallback(async () => {
    const meta = await getWalletBackupMeta();
    setBackupMeta(meta);
    return meta;
  }, []);

  const startBackup = useCallback(() => {
    logBackup("UI — back up tapped");
    if (!user?.wallet_address || !user.username) {
      logBackupError("UI — back up blocked", null, { reason: "no wallet" });
      setToast("Create your wallet before backing up", "error");
      return;
    }
    if (pin.length < 4) {
      logBackupError("UI — back up blocked", null, { reason: "no pin" });
      setToast("Set a PIN in the app before creating a backup", "error");
      return;
    }
    logBackup("UI — showing PIN modal for backup");
    setPinModalMode("backup");
  }, [pin.length, setToast, user?.username, user?.wallet_address]);

  const startRestore = useCallback(() => {
    if (pin.length < 4) {
      setToast("Set a PIN in the app before restoring a backup", "error");
      return;
    }
    setPinModalMode("restore");
  }, [pin.length, setToast]);

  const closePinModal = useCallback(() => {
    setPinModalMode(null);
  }, []);

  const confirmPin = useCallback(
    async (enteredPin: string) => {
      if (enteredPin !== pin) {
        logBackupError("UI — invalid PIN", null, { mode: pinModalMode });
        setToast("Invalid PIN", "error");
        return;
      }
      if (!pinModalMode) return;

      logBackup("UI — PIN confirmed", { mode: pinModalMode });
      setLoadingAction(true);
      setLoading(true);
      try {
        if (pinModalMode === "backup") {
          if (!user?.wallet_address || !user.username) return;
          const result = await backupWalletToGoogleDrive({
            pin: enteredPin,
            username: user.username,
            walletAddress: user.wallet_address,
          });
          await refreshBackupMeta();
          logBackup("UI — backup success toast", { email: result.googleEmail });
          setToast(
            `Wallet backed up to ${result.googleEmail || "Google Drive"}`,
            "success"
          );
        } else {
          const restored = await restoreWalletFromGoogleDrive(enteredPin);
          const meta = await getWalletBackupMeta();
          const currentUser = UserItem.getState().user;
          if (currentUser) {
            setUser({
              ...currentUser,
              wallet_address: restored.walletAddress,
              username: restored.username || currentUser.username,
              email: currentUser.email || meta?.googleEmail || undefined,
            });
          }
          await refreshBackupMeta();
          logBackup("UI — restore success");
          setToast("Wallet restored from Google Drive", "success");
        }
        setPinModalMode(null);
      } catch (error) {
        logBackupError("UI — action failed", error, { mode: pinModalMode });
        setToast(getGoogleSignInErrorMessage(error), "error");
      } finally {
        setLoadingAction(false);
        setLoading(false);
      }
    },
    [
      pin,
      pinModalMode,
      refreshBackupMeta,
      setLoading,
      setToast,
      setUser,
      user?.username,
      user?.wallet_address,
    ]
  );

  const isBackedUp =
    Boolean(backupMeta?.walletAddress) &&
    backupMeta?.walletAddress === user?.wallet_address;

  return {
    backupMeta,
    refreshBackupMeta,
    startBackup,
    startRestore,
    closePinModal,
    confirmPin,
    pinModalMode,
    loadingAction,
    isBackedUp,
    statusMessage,
  };
}
