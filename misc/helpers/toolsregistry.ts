import { EndStream, TransferFunction, Settings, Routing } from "./function"
import SessionManager from './aistream/aistream';
import { AirBills } from "./function/airbills";
import { SwapFunction } from "./function/swap";
import { PajCash } from "./function/pajcash";
import ToolsItem from "../store/toolsitems";
import { Crossmint } from "./function/crossmint";



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
    ];
}


export {
    toolRouter
}
