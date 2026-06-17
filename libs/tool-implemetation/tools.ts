import type { VoiceAssistantSession } from "@/libs/voiceinfra/types";
import { toolManipulator } from "@/libs/tools/heysolanaapp/toolManipulator";

const toolFunctions = (session: VoiceAssistantSession) => {
  return [new toolManipulator(session).chooseTools];
};

export { toolFunctions };
