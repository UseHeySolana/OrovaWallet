import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { Brain } from "@/libs/brain";
import { initWallet } from "@/utils/wallet/initWallet";
import { bootstrapVerifiedTokensList } from "@/utils/functions";
import { syncPendingAppTransactions } from "@/services/appTransactions";
import AppCatalog from "@/utils/store/appCatalog.store";
import ToolsItem from "@/utils/store/toolsitems.store";

const brain = new Brain({
  notificationsEnabled: true,
  // llmEnabled: backend Brain digest LLM. Or set EXPO_PUBLIC_BRAIN_SUGGESTIONS_LLM=true.
  llmEnabled: false,
  llmModel: "my-llm",
});

/**
 * Post-splash app init: wallet hydrate, Brain, catalog sync, pending tx flush.
 * Kept out of `_layout.tsx` so the root layout stays UI-focused.
 */
export function useRootBootstrap(appReady: boolean) {
  const walletInitRanRef = useRef(false);

  useEffect(() => {
    if (!appReady) return;

    if (!walletInitRanRef.current) {
      walletInitRanRef.current = true;
      initWallet().catch(() => {
        // non-fatal
      });
      bootstrapVerifiedTokensList();
    }

    if (!brain.isStarted()) {
      brain.start().catch(() => {
        // non-fatal
      });
    }

    void syncPendingAppTransactions();
    ToolsItem.getState().migrateToolsToSlugs();
    void AppCatalog.getState().refreshCatalog();

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void syncPendingAppTransactions();
        void AppCatalog.getState().refreshCatalog();
      }
    });
    return () => subscription.remove();
  }, [appReady]);
}
