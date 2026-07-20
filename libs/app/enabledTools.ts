import {
  APP_CAPABILITIES,
  CORE_TOOL_FUNCTION_NAMES,
  resolveAppSlug,
} from "./capabilities";
import ToolsItem from "@/utils/store/toolsitems.store";
import type { FunctionParams } from "@/utils/types/types";

/**
 * Returns tool function names that should be registered for the current session.
 * Core tools are always included; app-owned tools require activation.
 */
export function getEnabledToolFunctionNames(): Set<string> {
  const enabled = new Set<string>(CORE_TOOL_FUNCTION_NAMES);
  const tools = ToolsItem.getState().tools;

  for (const tool of tools) {
    if (tool.value !== "active") continue;
    const slug = resolveAppSlug(tool.name);
    if (!slug) continue;
    const capability = APP_CAPABILITIES[slug];
    if (!capability) continue;
    for (const fn of capability.toolFunctionNames) {
      enabled.add(fn);
    }
  }

  // Apps without activation still keep metadata-only presence; no tools added.
  return enabled;
}

export function filterToolsByActivation(functions: FunctionParams[]): FunctionParams[] {
  const enabled = getEnabledToolFunctionNames();
  return functions.filter((fn) => {
    if (!fn?.name) return false;
    // Allow tools not mapped to any app capability (treat as core/shared).
    const ownedByApp = Object.values(APP_CAPABILITIES).some((cap) =>
      cap.toolFunctionNames.includes(fn.name)
    );
    if (!ownedByApp) return true;
    return enabled.has(fn.name);
  });
}
