import React, { useEffect, useRef } from "react";

import {
  getPajCashSession,
  savePajCashSession,
} from "@/services/pajcashSessionApi";
import UserItem from "@/utils/store/userstore.store";
import WalletItem from "@/utils/store/wallet.store";
import PajCashSession from "@/utils/store/pajcashSession.store";
import { phoneForPushApi } from "@/utils/phone/phoneE164";
import { resolveWalletAddress } from "@/utils/wallet/resolveWalletAddress";

type Props = {
  children: React.ReactNode;
};

/**
 * Restores a valid PajCash session from the backend when the user signs in
 * on a new device, and pushes fresher local sessions to the backend.
 */
export const PajCashSessionManager: React.FC<Props> = ({ children }) => {
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
        const local = PajCashSession.getState();
        const remote = await getPajCashSession();

        if (remote) {
          if (!local.isSessionValid()) {
            local.setSession({
              recipient: remote.recipient,
              token: remote.token,
              expiresAt: remote.expiresAt ?? "",
            });
          } else if (local.token && local.token !== remote.token) {
            const localExp = local.expiresAt
              ? new Date(local.expiresAt).getTime()
              : 0;
            const remoteExp = remote.expiresAt
              ? new Date(remote.expiresAt).getTime()
              : 0;
            if (remoteExp > localExp) {
              local.setSession({
                recipient: remote.recipient,
                token: remote.token,
                expiresAt: remote.expiresAt ?? "",
              });
            } else if (local.recipient && local.token) {
              await savePajCashSession({
                recipient: local.recipient,
                token: local.token,
                expiresAt: local.expiresAt,
              });
            }
          }
        } else if (local.isSessionValid() && local.recipient && local.token) {
          await savePajCashSession({
            recipient: local.recipient,
            token: local.token,
            expiresAt: local.expiresAt,
          });
        }

        lastSyncKeyRef.current = syncKey;
      } catch (err) {
        console.warn("[PajCash Session] sync failed", err);
      } finally {
        syncingRef.current = false;
      }
    };

    void sync();

    const unsubUser = UserItem.subscribe((state, prev) => {
      if (!state.user && prev.user) {
        lastSyncKeyRef.current = null;
        PajCashSession.getState().clearSession();
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
