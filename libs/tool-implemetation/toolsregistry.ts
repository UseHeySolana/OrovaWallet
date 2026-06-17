import { AirBills } from "../tools/airbills/airbills.tool";
import { TransferFunction } from "@/libs/tools/transfer/transfer.tool";
import { SwapFunction } from "@/libs/tools/swap/swap.tool";
import { PajCash } from "@/libs/tools/pajcash/pajcash.tool";
import { Crossmint } from "@/libs/tools/crossmint/crossmint.tool";
import { JumiaTool } from "@/libs/tools/jumia/jumia.tool";
import { KalshiTool } from "@/libs/tools/kalshi/kalshi.tool";
import { BayseTool } from "@/libs/tools/bayse/bayse.tool";
import { MagicBlockTool } from "@/libs/tools/magicblock/magicblock.tool";
import { WalletBalanceTool } from "@/libs/tools/wallet/wallet.tool";
import { TokenSearchTool } from "@/libs/tools/tokens/tokenSearch.tool";
import type { VoiceAssistantSession } from "@/libs/voiceinfra/types";

const toolRouter = (session: VoiceAssistantSession) => {
  const magicblock = new MagicBlockTool(session);
  const walletBalance = new WalletBalanceTool(session);
  const tokenSearch = new TokenSearchTool(session);
  return [
    walletBalance.checkWalletBalance,
    tokenSearch.searchSplTokens,
    new TransferFunction(session).transferFunction,
    new AirBills(session).buyAirtime,
    new SwapFunction(session).swapFunction,
    new SwapFunction(session).checkPrice,
    new AirBills(session).buyElectricityBill,
    new PajCash(session).pajcashInitiate,
    new PajCash(session).pajcashVerify,
    new PajCash(session).pajitOfframp,
    new PajCash(session).pajcashOnramp,
    new PajCash(session).getNairaRate,

    // MagicBlock Private Payments
    magicblock.privateDeposit,
    magicblock.privateTransfer,
    magicblock.privateWithdraw,
    magicblock.privateBalance,

    //crossmint
    new Crossmint(session).searchProductsAmazon,
    new Crossmint(session).createAmazonOrder,
    new Crossmint(session).productDetails,

    // Jumia
    new JumiaTool(session).searchJumiaProducts,
    new JumiaTool(session).getJumiaProductDetails,
    new JumiaTool(session).placeJumiaOrder,

    // // Kalshi
    // new KalshiTool(SessionManager).activateKalshi,
    // new KalshiTool(SessionManager).backupApiKey,
    // new KalshiTool(SessionManager).kalshiStatus,
    // new KalshiTool(SessionManager).getSeries,
    // new KalshiTool(SessionManager).searchMarkets,
    // new KalshiTool(SessionManager).marketDetails,
    // new KalshiTool(SessionManager).marketPriceData,
    // new KalshiTool(SessionManager).placeOrder,
    // new KalshiTool(SessionManager).cancelOrder,
    // new KalshiTool(SessionManager).getOrders,
    // new KalshiTool(SessionManager).getPositions,

    // // Bayse
    // new BayseTool(SessionManager).activateBayse,
    // new BayseTool(SessionManager).bayseStatus,
    // new BayseTool(SessionManager).searchEvents,
    // new BayseTool(SessionManager).getQuote,
    // new BayseTool(SessionManager).placeOrder,
    // new BayseTool(SessionManager).cancelOrder,
    // new BayseTool(SessionManager).getOrders,
    // new BayseTool(SessionManager).getPortfolio,
    // new BayseTool(SessionManager).getActivities,
  ];
};

export { toolRouter };
