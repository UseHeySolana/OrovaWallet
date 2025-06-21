import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage, persist } from 'zustand/middleware';

interface ToolParameters {
    type: string;
    value: string;
}

interface ToolConfig {
    type: string;
    parameters?: ToolParameters[];
}

interface Tool {
    name: string;
    value: 'active' | 'inactive';
    config?: ToolConfig[];
}

interface ToolsStore {
    tools: Tool[];
    clearTools: () => void;
    addTool: (tool: Tool) => void;
    removeTool: (toolName: string) => void;
    updateToolStatus: (toolName: string, status: 'active' | 'inactive') => void;

    addToolConfig: (toolName: string, config: ToolConfig) => void;
    updateToolConfig: (toolName: string, configType: string, newConfig: ToolConfig) => void;
    removeToolConfig: (toolName: string, configType: string) => void;
    updateToolParameter: (toolName: string, configType: string, paramUpdate: ToolParameters) => void;
    getToolConfig: (toolName: string) => ToolConfig[];
    getToolParameters: (toolName: string, configType: string) => ToolParameters[];
    getParameterValue: (toolName: string, configType: string, paramType: string) => string;
}

const ToolsItem = create<ToolsStore>()(
    persist(
        (set, get) => ({
            tools: [],

            clearTools: () => {
                set({ tools: [] });
            },

            addTool: (tool) => {
                const exists = get().tools.some((t) => t.name === tool.name);
                if (exists) {
                    set((state) => ({
                        tools: state.tools.map((t) => t.name === tool.name ? tool : t),
                    }));
                } else {
                    set((state) => ({ tools: [...state.tools, tool] }));
                }
            },

            removeTool: (toolName) => {
                set((state) => ({
                    tools: state.tools.filter((t) => t.name !== toolName),
                }));
            },

            updateToolStatus: (toolName, status) => {
                set((state) => ({
                    tools: state.tools.map((t) =>
                        t.name === toolName ? { ...t, value: status } : t
                    ),
                }));
            },

            addToolConfig: (toolName, config) => {
                //check if config already exists
                const exists = get().tools.some((t) => t.name === toolName && t.config?.some((c) => c.type === config.type));
                if (exists) {
                    return;
                }
                set((state) => ({
                    tools: state.tools.map((t) =>
                        t.name === toolName
                            ? { ...t, config: [...(t.config || []), config] }
                            : t
                    ),
                }));
            },

            updateToolConfig: (toolName, configType, newConfig) => {
                set((state) => ({
                    tools: state.tools.map((t) =>
                        t.name === toolName
                            ? {
                                ...t,
                                config: (t.config || []).map((c) =>
                                    c.type === configType ? newConfig : c
                                ),
                            }
                            : t
                    ),
                }));
            },

            removeToolConfig: (toolName, configType) => {
                set((state) => ({
                    tools: state.tools.map((t) =>
                        t.name === toolName
                            ? {
                                ...t,
                                config: (t.config || []).filter(
                                    (c) => c.type !== configType
                                ),
                            }
                            : t
                    ),
                }));
            },

            updateToolParameter: (toolName, configType, paramUpdate) => {
                set((state) => {

                    const updatedTools = state.tools.map((tool) => {
                        if (tool.name !== toolName) return tool;

                        const configList = tool.config ?? [];

                        const updatedConfigList = configList.some((config) => config.type === configType)
                            ? configList.map((config) => {
                                if (config.type !== configType) return config;

                                const existingParams = config.parameters ?? [];
                                const paramIndex = existingParams.findIndex(
                                    (param) => param.type === paramUpdate.type
                                );

                                const updatedParams =
                                    paramIndex !== -1
                                        ? existingParams.map((param, i) =>
                                            i === paramIndex ? { ...param, value: paramUpdate.value } : param
                                        )
                                        : [...existingParams, paramUpdate];

                                return { ...config, parameters: updatedParams };
                            })
                            : [...configList, { type: configType, parameters: [paramUpdate] }];

                        return { ...tool, config: updatedConfigList };
                    });

                    return { tools: updatedTools };
                });
            },
            getToolConfig: (toolName: string) => {
                return get().tools.find((tool: any) => tool?.name === toolName)?.config || [];
            },
            getToolParameters: (toolName:string, configType:string) => {
                return get().tools.find((tool: any) => tool?.name === toolName)?.config?.find((config: any) => config?.type === configType)?.parameters || [];
            },
            getParameterValue: (toolName: string, configType: string, paramType: string) => {
                return get().tools.find((tool: any) => tool?.name === toolName)?.config?.find((config: any) => config?.type === configType)?.parameters?.find((param: any) => param?.type === paramType)?.value || "";
            }
        }),


        {
            name: 'tools',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);

export default ToolsItem;
