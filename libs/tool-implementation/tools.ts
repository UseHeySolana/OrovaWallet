import SessionManager from "../voiceinfra/SessionManager";
import { toolManipulator } from "@/libs/tools/heysolanaapp/toolManipulator";

const toolFunctions = (SessionManager: SessionManager) => {
  return [new toolManipulator(SessionManager).chooseTools];
};

export { toolFunctions };
