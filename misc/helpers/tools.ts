import SessionManager from './aistream/aistream';
import { toolManipulator } from "./function/toolManipulator";



const toolFunctions = (SessionManager: SessionManager) => {
    return [
        new toolManipulator(SessionManager).chooseTools,
    ]
}

export {
    toolFunctions,
}
