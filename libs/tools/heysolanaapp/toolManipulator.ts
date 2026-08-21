import SessionManager from "@/libs/voiceinfra/SessionManager";
import { toolRouter } from "@/libs/tool-implementation/toolsregistry";
import { FunctionParams } from "@/utils/types/types";


export class toolManipulator {
    public chooseTools: any;
    public toolsDes: FunctionParams[];


    constructor(public session: SessionManager,) {
        this.toolsDes = toolRouter(session)
        this.chooseTools = this.choose_tools()
    }

    choose_tools() {
        return {
            type: "function",
            name: "choose_tools",
            description: "You are to match the intent of the user so you can correctly map the tools that the user wants to use. Here are the list of available tools and what they do with their parameters",
            parameters: {
                type: "object",
                properties: {
                    tool: {
                        type: "string",
                        description: "This is the name of the tool to use according to the  list of tools available as provided."
                    },
                    parameter: {
                        type: "object",
                        description: "This is the parameter that the tool needs to use."
                    }
                },
                required: ["route"],
            },
            handler: async (args: { tool: string, parameter: object }) => {
                const selectedTool = this.toolsDes.find((tool) => tool.name === args.tool);

                if (!selectedTool) {
                    return "Tool not found";
                }
                const result = await selectedTool.handler(args.parameter);
                return result;
            }
        }
    }

}
