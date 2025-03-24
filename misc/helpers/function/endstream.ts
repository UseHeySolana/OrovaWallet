import AppSettings from "@/misc/store/settingsstore";
import SessionManager from "../aistream/aistream";
import GeminiSessionManager from "../gemini/StreamManager";

export class EndStream {
    public endStream: any;

    constructor(public session: SessionManager | GeminiSessionManager) {
        this.endStream = this.end_stream()
    }
    end_stream() {
        return {
            name: "end-stream",
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
