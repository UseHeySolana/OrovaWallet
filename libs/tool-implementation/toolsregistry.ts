import { AirBills } from "../tools/airbills/airbills.tool";
import { TransferFunction } from "@/libs/tools/transfer/transfer.tool";
import { SwapFunction } from "@/libs/tools/swap/swap.tool";
import { PajCash } from "@/libs/tools/pajcash/pajcash.tool";
import { Crossmint } from "@/libs/tools/crossmint/crossmint.tool";
import { JumiaTool } from "@/libs/tools/jumia/jumia.tool";
import { ChowdeckTool } from "@/libs/tools/chowdeck/chowdeck.tool";
import { KalshiTool } from "@/libs/tools/kalshi/kalshi.tool";
import { BayseTool } from "@/libs/tools/bayse/bayse.tool";
import { MagicBlockTool } from "@/libs/tools/magicblock/magicblock.tool";
import { DextopusTool } from "@/libs/tools/dextopus/dextopus.tool";
import { WalletBalanceTool } from "@/libs/tools/wallet/wallet.tool";
import { TokenSearchTool } from "@/libs/tools/tokens/tokenSearch.tool";
import SessionManager from "@/libs/voiceinfra/SessionManager";
import { filterToolsByActivation } from "@/libs/app/enabledTools";

const toolRouter = (SessionManager: SessionManager) => {
  const magicblock = new MagicBlockTool(SessionManager);
  const dextopus = new DextopusTool(SessionManager);
  const walletBalance = new WalletBalanceTool(SessionManager);
  const tokenSearch = new TokenSearchTool(SessionManager);
  const allTools = [
    walletBalance.checkWalletBalance,
    tokenSearch.searchSplTokens,
    new TransferFunction(SessionManager).transferFunction,
    new AirBills(SessionManager).buyAirtime,
    new SwapFunction(SessionManager).swapFunction,
    new SwapFunction(SessionManager).checkPrice,
    new AirBills(SessionManager).buyElectricityBill,
    new AirBills(SessionManager).buyDataBundle,
    new PajCash(SessionManager).pajcashInitiate,
    new PajCash(SessionManager).pajcashVerify,
    new PajCash(SessionManager).pajitOfframp,
    new PajCash(SessionManager).pajcashOnramp,
    new PajCash(SessionManager).getNairaRate,

    // MagicBlock Private Payments
    magicblock.privateDeposit,
    magicblock.privateTransfer,
    magicblock.privateWithdraw,
    magicblock.privateBalance,

    // Dextopus cross-chain deposits
    dextopus.createCrossChainDepositAddress,
    dextopus.bridgeCryptoQuote,
    dextopus.checkCrossChainDeposits,

    //crossmint
    new Crossmint(SessionManager).searchProductsAmazon,
    new Crossmint(SessionManager).createAmazonOrder,
    new Crossmint(SessionManager).productDetails,

    // Jumia
    new JumiaTool(SessionManager).searchJumiaProducts,
    new JumiaTool(SessionManager).getJumiaProductDetails,
    new JumiaTool(SessionManager).placeJumiaOrder,

    // Chowdeck food delivery
    new ChowdeckTool(SessionManager).setChowdeckLocation,
    new ChowdeckTool(SessionManager).searchChowdeckFood,
    new ChowdeckTool(SessionManager).getChowdeckMenuCategories,
    new ChowdeckTool(SessionManager).browseChowdeckVendorMenu,
    new ChowdeckTool(SessionManager).getChowdeckMenuItem,
    new ChowdeckTool(SessionManager).addChowdeckToCart,
    new ChowdeckTool(SessionManager).updateChowdeckCartQuantity,
    new ChowdeckTool(SessionManager).viewChowdeckCart,
    new ChowdeckTool(SessionManager).clearChowdeckCart,
    new ChowdeckTool(SessionManager).placeChowdeckOrder,

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

  return filterToolsByActivation(allTools);
};

export { toolRouter };
