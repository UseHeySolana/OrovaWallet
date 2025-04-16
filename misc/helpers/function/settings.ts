import AppSettings from "@/misc/store/settingsstore";
import SessionManager from "../aistream/aistream";
import { FunctionParams } from "../types";

export class Settings {
    public setVoice: FunctionParams;
    public setName: FunctionParams;

    constructor(public session: SessionManager) {
        this.setVoice = this.set_voice()
        this.setName = this.set_name()
    }
    set_voice() {
        return {
            name: "set_voice",
            description: "This choose which voice to use for the AI",
            parameters: {
                type: "object",
                properties: {
                    voice: {
                        type: "string",
                        description: "The voice to use for the AI"
                    }
                },
                required: ["voice"],
            },
            handler: async (args: { voice: string }) => {
                AppSettings.getState().updateAiVoice(args.voice)

                return "Stream Ended Successfully";
            }
        }
    }

    set_name() {
        return {
            name: "set_name",
            description: "This choose a name for your personalized AI",
            parameters: {
                type: "object",
                properties: {
                    name: {
                        type: "string",
                        description: "The name to use for the AI"
                    }
                },
                required: ["name"],
            },
            handler: async (args: { name: string }) => {
                AppSettings.getState().setAiName(args.name)

                return "Ai voice updated successfully";
            }
        }
    }


}
