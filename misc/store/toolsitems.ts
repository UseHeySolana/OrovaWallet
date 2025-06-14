import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage, persist, PersistStorage } from 'zustand/middleware';

interface Tool {
    name: string;
    value: string;
}


interface ToolsStore {
    tools: Tool[];
    addTool: (tool: any) => void;
    removeTool: (tool: any) => void;
    getTool: (tool: any) => any;
    getToolValue: (tool: any) => any;
}

const ToolsItem = create(
    persist<ToolsStore>(
        (set, get) => ({
            tools: [],
            addTool: (tool: Tool) => {
                const existingTool = get().tools.find((t) => t.name === tool.name);
                if (existingTool) {
                    set((state) => ({ tools: state.tools.map((t) => t.name === tool.name ? tool : t) }))
                } else {
                    set((state) => ({ tools: [...state.tools, tool] }))
                }
            },
            removeTool: (tool: string) => set((state) => ({ tools: state.tools.filter((t) => t.name !== tool) })),

            getTool: (tool: string) => get().tools.find((t) => t.name === tool),

            getToolValue: (tool: string) => get().tools.find((t) => t.name === tool)?.value,
        }),
        {
            name: 'tools', // Storage key
            storage: createJSONStorage(() => AsyncStorage), // Use AsyncStorage for React Native
            onRehydrateStorage: () => (state) => {
                // console.log("Rehydrating:", state);
            }
        }
    )
);

export default ToolsItem;
