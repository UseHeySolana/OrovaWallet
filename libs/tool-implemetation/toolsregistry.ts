import { AirBills } from "../tools/airbills/airbills.tool";
import { TransferFunction } from "@/libs/tools/transfer/transfer.tool";
import { SwapFunction } from "@/libs/tools/swap/swap.tool";
import { PajCash } from "@/libs/tools/pajcash/pajcash.tool";
import { Crossmint } from "@/libs/tools/crossmint/crossmint.tool";
import { JumiaTool } from "@/libs/tools/jumia/jumia.tool";
import { KalshiTool } from "@/libs/tools/kalshi/kalshi.tool";
import SessionManager from "@/libs/voiceinfra/SessionManager";

const toolRouter = (SessionManager: SessionManager) => {
  return [
    new TransferFunction(SessionManager).transferFunction,
    new AirBills(SessionManager).buyAirtime,
    new SwapFunction(SessionManager).swapFunction,
    new SwapFunction(SessionManager).checkPrice,
    new AirBills(SessionManager).buyElectricityBill,
    new PajCash(SessionManager).pajitOfframp,
    new PajCash(SessionManager).getNairaRate,

    //crossmint
    new Crossmint(SessionManager).searchProductsAmazon,
    new Crossmint(SessionManager).createAmazonOrder,
    new Crossmint(SessionManager).productDetails,

    // Jumia
    new JumiaTool(SessionManager).searchJumiaProducts,
    new JumiaTool(SessionManager).getJumiaProductDetails,
    new JumiaTool(SessionManager).placeJumiaOrder,

    // Kalshi
    new KalshiTool(SessionManager).activateKalshi,
    new KalshiTool(SessionManager).backupApiKey,
    new KalshiTool(SessionManager).kalshiStatus,
    new KalshiTool(SessionManager).searchMarkets,
    new KalshiTool(SessionManager).marketDetails,
    new KalshiTool(SessionManager).marketPriceData,
    new KalshiTool(SessionManager).placeOrder,
    new KalshiTool(SessionManager).cancelOrder,
    new KalshiTool(SessionManager).getOrders,
    new KalshiTool(SessionManager).getPositions,
  ];
};

export { toolRouter };
