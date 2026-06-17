import AppSettings from "@/utils/store/settingsstore.store";
import type { VoiceAssistantSession } from "@/libs/voiceinfra/types";
import GeminiSessionManager from "@/libs/voiceinfra/gemini/GeminiSessionManager";
import { FunctionParams } from "@/utils/types/types";

export class EndStream {
    public endStream: FunctionParams;

    constructor(public session: VoiceAssistantSession | GeminiSessionManager) {
        this.endStream = this.end_stream()
    }
    end_stream() {
        return {
            name: "end-stream",
            owner: "HeySolana",
            description: "This function is used to close and end the stream",
            parameters: null,
            handler: async () => {
                AppSettings.getState().setLoading(true)
                setTimeout(() => {

                    this.session.stopSession()

                    AppSettings.getState().setLoading(false)
                }, 1000)


                return "Stream Ended Successfully";
            }
        }
    }


}
