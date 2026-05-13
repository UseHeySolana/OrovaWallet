import { PublicKey } from "@solana/web3.js";

import SessionManager from "@/libs/voiceinfra/SessionManager";
import { FunctionParams } from "@/utils/types/types";
import WalletItem from "@/utils/store/wallet.store";
import { convertSpeech } from "@/utils/functions/extrafunctions";
import { completeConversation, verifiedTokens } from "@/utils/functions";
import { getBalance } from "@/utils/wallet";
import { getTokenBalance } from "@/libs/tools/transfer/transfers";

/**
 * Voice/chat tool: balances read directly from Solana RPC (no Zustand / DAS cache).
 */
export class WalletBalanceTool {
  public checkWalletBalance: FunctionParams;

  constructor(public session: SessionManager) {
    this.checkWalletBalance = this.check_wallet_balance();
  }

  private check_wallet_balance(): FunctionParams {
    return {
      name: "check_wallet_balance",
      owner: "HeySolana",
      description:
        "Read the connected wallet's SOL and supported SPL token balances directly from the Solana blockchain. Use whenever the user asks for their balance, how much SOL or tokens they have, or you need up-to-date amounts (do not rely on earlier conversation or cached wallet summaries).",
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
        const sol = await getBalance(owner, conn);
        const parts: string[] = [`${sol.toFixed(4)} SOL`];

        for (const t of verifiedTokens) {
          if (t.symbol === "SOL") continue;
          const bal = await getTokenBalance(
            owner.toBase58(),
            t.address,
            t.decimals,
            conn
          );
          if (bal > 0) {
            parts.push(
              `${bal < 1 ? bal.toFixed(Math.min(t.decimals, 6)) : bal.toFixed(2)} ${t.symbol}`
            );
          }
        }

        if (messageId !== null) completeConversation(messageId, "complete");
        return await convertSpeech(
          `Your on-chain wallet holds ${parts.join(", ")}.`
        );
      },
    };
  }
}
