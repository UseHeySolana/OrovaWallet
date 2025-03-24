

import { EndStream, TransferFunction, Settings, Routing } from "./function"
import SessionManager from './aistream/aistream';



const toolFunctions = (SessionManager: SessionManager) => {


    return [
        // new TransferFunction(SessionManager).transferFunction,
        // new EndStream(SessionManager).endStream,
        // new Settings(SessionManager).setVoice,
        // new Settings(SessionManager).setName,
        // new Routing(SessionManager).changeRoute,
        // new Routing(SessionManager).goBack,

    ]
}
export {
    toolFunctions,
}
