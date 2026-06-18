import { PublicKey } from "@solana/web3.js";

import type { VoiceAssistantSession } from "@/libs/voiceinfra/types";
import { FunctionParams } from "@/utils/types/types";
import WalletItem from "@/utils/store/wallet.store";
import { convertSpeech } from "@/utils/functions/extrafunctions";
import UserItem from "@/utils/store/userstore.store";
import { completeConversation, resolveMetasForMints } from "@/utils/functions";
import { getBalance } from "@/utils/wallet";
import { refreshUserWalletBalances } from "@/utils/wallet/walletBalanceCache";

const SOL_MINT = "So11111111111111111111111111111111111111112";

/**
 * Voice/chat tool: balances read directly from Solana RPC (no Zustand / DAS cache).
 */
export class WalletBalanceTool {
  public checkWalletBalance: FunctionParams;

  constructor(public session: VoiceAssistantSession) {
    this.checkWalletBalance = this.check_wallet_balance();
  }

  private check_wallet_balance(): FunctionParams {
    return {
      name: "check_wallet_balance",
      owner: "HeySolana",
      description:
        "Read the connected wallet's SOL and SPL token balances from chain. SPL rows use Jupiter token search (v2) for labels when an API key is set; otherwise cached wallet symbols.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
      handler: async () => {
        const messageId = this.session.functionMessageId;
        const owner = WalletItem.getState().publicKey;
        if (!owner) {
          if (messageId !== null) completeConversation(messageId, "failed");
          return await convertSpeech("Please connect your wallet first.");
        }

        const conn = this.session.connection;
        await refreshUserWalletBalances({ force: true });

        const sol = await getBalance(owner, conn);
        const parts: string[] = [`${sol.toFixed(4)} SOL`];

        const accounts = UserItem.getState().userWallet.tokenAccounts;
        const mints = accounts.map((a) => a.mint).filter(Boolean);
        const metaByMint = await resolveMetasForMints(mints);

        for (const acc of accounts) {
          if (acc.mint === SOL_MINT || acc.balance <= 0) continue;
          const meta = metaByMint.get(acc.mint);
          const label = meta?.symbol ?? acc.symbol;
          const decimals = meta?.decimals ?? acc.decimals;
          const bal = acc.balance;
          parts.push(
            `${bal < 1 ? bal.toFixed(Math.min(decimals, 6)) : bal.toFixed(2)} ${label}`
          );
        }

        if (messageId !== null) completeConversation(messageId, "complete");
        return await convertSpeech(
          `Your on-chain wallet holds ${parts.join(", ")}.`
        );
      },
    };
  }
}
