import { useEffect } from "react";
import { View } from "react-native";
import { router } from "expo-router";

import AppSettings from "@/utils/store/settingsstore.store";
import UserItem from "@/utils/store/userstore.store";
import { createWalletForUser } from "@/utils/wallet/createWalletForUser";

/** Legacy route — wallets are created silently during sign-up. */
export default function SecretPhrase() {
  const { user } = UserItem();
  const { setLoading, setToast } = AppSettings();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!user?.username) {
        router.replace("/auth/register");
        return;
      }

      if (user.wallet_address?.trim()) {
        router.replace("/dashboard");
        return;
      }

      setLoading(true);
      try {
        const result = await createWalletForUser(user.username);
        if (cancelled) return;

        if (!result.success) {
          setToast(result.message, "error");
          router.replace("/auth/username");
          return;
        }

        setToast("Wallet ready", "success");
        router.replace("/dashboard");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.username, user?.wallet_address, setLoading, setToast]);

  return <View className="flex-1 bg-grey dark:bg-dark" />;
}
