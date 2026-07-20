import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage, persist } from 'zustand/middleware';
import { DISPLAY_NAME_TO_SLUG, resolveAppSlug } from '@/libs/app/capabilities';

interface ToolParameters {
    type: string;
    value: string;
}

interface ToolConfig {
    type: string;
    parameters?: ToolParameters[];
}

interface Tool {
    /** Stable app slug (preferred) or legacy display name before migration. */
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
    isToolActive: (toolName: string) => boolean;
    migrateToolsToSlugs: () => void;
}

function toolKeyMatches(storedName: string, query: string): boolean {
    if (storedName === query) return true;
    const storedSlug = resolveAppSlug(storedName);
    const querySlug = resolveAppSlug(query);
    return !!storedSlug && !!querySlug && storedSlug === querySlug;
}

function normalizeToolName(name: string): string {
    return resolveAppSlug(name) || DISPLAY_NAME_TO_SLUG[name] || name;
}

function findToolIndex(tools: Tool[], toolName: string): number {
    return tools.findIndex((t) => toolKeyMatches(t.name, toolName));
}

function migrateTools(tools: Tool[]): Tool[] {
    const bySlug = new Map<string, Tool>();
    for (const tool of tools) {
        const slug = normalizeToolName(tool.name);
        const existing = bySlug.get(slug);
        if (!existing) {
            bySlug.set(slug, { ...tool, name: slug });
            continue;
        }
        // Merge configs if both legacy + slug entries exist.
        const mergedConfig = [...(existing.config || [])];
        for (const config of tool.config || []) {
            if (!mergedConfig.some((c) => c.type === config.type)) {
                mergedConfig.push(config);
            }
        }
        bySlug.set(slug, {
            ...existing,
            name: slug,
            value: existing.value === 'active' || tool.value === 'active' ? 'active' : tool.value,
            config: mergedConfig,
        });
    }
    return Array.from(bySlug.values());
}

const ToolsItem = create<ToolsStore>()(
    persist(
        (set, get) => ({
            tools: [],

            clearTools: () => {
                set({ tools: [] });
            },

            migrateToolsToSlugs: () => {
                set((state) => ({ tools: migrateTools(state.tools) }));
            },

            addTool: (tool) => {
                const name = normalizeToolName(tool.name);
                const normalized = { ...tool, name };
                const idx = findToolIndex(get().tools, name);
                if (idx >= 0) {
                    set((state) => ({
                        tools: state.tools.map((t, i) => (i === idx ? { ...t, ...normalized, name } : t)),
                    }));
                } else {
                    set((state) => ({ tools: [...state.tools, normalized] }));
                }
            },

            removeTool: (toolName) => {
                set((state) => ({
                    tools: state.tools.filter((t) => !toolKeyMatches(t.name, toolName)),
                }));
            },

            updateToolStatus: (toolName, status) => {
                set((state) => ({
                    tools: state.tools.map((t) =>
                        toolKeyMatches(t.name, toolName) ? { ...t, value: status } : t
                    ),
                }));
            },

            addToolConfig: (toolName, config) => {
                const exists = get().tools.some(
                    (t) => toolKeyMatches(t.name, toolName) && t.config?.some((c) => c.type === config.type)
                );
                if (exists) {
                    return;
                }
                set((state) => ({
                    tools: state.tools.map((t) =>
                        toolKeyMatches(t.name, toolName)
                            ? { ...t, config: [...(t.config || []), config] }
                            : t
                    ),
                }));
            },

            updateToolConfig: (toolName, configType, newConfig) => {
                set((state) => ({
                    tools: state.tools.map((t) =>
                        toolKeyMatches(t.name, toolName)
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
                        toolKeyMatches(t.name, toolName)
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
                        if (!toolKeyMatches(tool.name, toolName)) return tool;

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
                return get().tools.find((tool) => toolKeyMatches(tool.name, toolName))?.config || [];
            },
            getToolParameters: (toolName: string, configType: string) => {
                return get().tools.find((tool) => toolKeyMatches(tool.name, toolName))?.config?.find((config) => config?.type === configType)?.parameters || [];
            },
            getParameterValue: (toolName: string, configType: string, paramType: string) => {
                return get().tools.find((tool) => toolKeyMatches(tool.name, toolName))?.config?.find((config) => config?.type === configType)?.parameters?.find((param) => param?.type === paramType)?.value || "";
            },
            isToolActive: (toolName: string) => {
                return !!get().tools.find(
                    (tool) => toolKeyMatches(tool.name, toolName) && tool.value === 'active'
                );
            },
        }),


        {
            name: 'tools',
            storage: createJSONStorage(() => AsyncStorage),
            onRehydrateStorage: () => (state) => {
                state?.migrateToolsToSlugs();
            },
            version: 2,
            migrate: (persisted: any) => {
                if (!persisted) return persisted;
                return {
                    ...persisted,
                    tools: migrateTools(persisted.tools || []),
                };
            },
        }
    )
);

export default ToolsItem;
