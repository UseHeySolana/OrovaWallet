import { EndStream, TransferFunction, Settings, Routing } from "./function"
import SessionManager from './aistream/aistream';
import { AirBills } from "./function/airbills";



const toolRouter = (SessionManager: SessionManager) => {
    return [

        new TransferFunction(SessionManager).transferFunction,
        new EndStream(SessionManager).endStream,
        new Settings(SessionManager).setVoice,
        new Settings(SessionManager).setName,
        new Routing(SessionManager).changeRoute,
        new Routing(SessionManager).goBack,
        new Routing(SessionManager).qrCode,
        new AirBills(SessionManager).buyAirtime,
    ]
}


export {
    toolRouter
}
