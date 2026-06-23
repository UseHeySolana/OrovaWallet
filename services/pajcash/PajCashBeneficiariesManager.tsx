import React, { useEffect, useRef } from "react";

import { getPajCashBeneficiaries } from "@/services/pajcashBeneficiariesApi";
import UserItem from "@/utils/store/userstore.store";
import WalletItem from "@/utils/store/wallet.store";
import PajCashBeneficiaries from "@/utils/store/pajcashBeneficiaries.store";
import { phoneForPushApi } from "@/utils/phone/phoneE164";
import { resolveWalletAddress } from "@/utils/wallet/resolveWalletAddress";

type Props = {
  children: React.ReactNode;
};

/**
 * Syncs PajCash bank beneficiaries from the backend when the user signs in
 * or when their wallet address becomes available after hydration.
 */
export const PajCashBeneficiariesManager: React.FC<Props> = ({ children }) => {
  const lastSyncKeyRef = useRef<string | null>(null);
  const syncingRef = useRef(false);

  useEffect(() => {
    const sync = async () => {
      const user = UserItem.getState().user;
      if (!user) return;

      const wallet = resolveWalletAddress();
      const phone = phoneForPushApi(user);
      if (!wallet && !phone) return;

      const syncKey = `${phone || ""}|${wallet || ""}`;
      if (syncKey === lastSyncKeyRef.current || syncingRef.current) return;

      syncingRef.current = true;
      try {
        const items = await getPajCashBeneficiaries();
        lastSyncKeyRef.current = syncKey;
        PajCashBeneficiaries.getState().setBeneficiaries(items);
      } catch (err) {
        console.warn("[PajCash Beneficiaries] sync failed", err);
      } finally {
        syncingRef.current = false;
      }
    };

    void sync();

    const unsubUser = UserItem.subscribe((state, prev) => {
      if (!state.user && prev.user) {
        lastSyncKeyRef.current = null;
        PajCashBeneficiaries.getState().clearBeneficiaries();
        return;
      }

      if (state.user && state.user !== prev.user) {
        lastSyncKeyRef.current = null;
        void sync();
      }
    });

    const unsubWallet = WalletItem.subscribe(() => {
      if (!UserItem.getState().user) return;
      lastSyncKeyRef.current = null;
      void sync();
    });

    return () => {
      unsubUser();
      unsubWallet();
    };
  }, []);

  return <>{children}</>;
};
