import { isTablet } from "@/utils/layout/tablet";

const pad = isTablet();

/** Shared auth flow layout tokens — input shell matches Buttons (`py-5 rounded-full`) */
export const authUi = {
  screenPadding: pad ? "px-8" : "px-4",
  sectionGap: pad ? "gap-y-10" : "gap-y-8",
  headerGap: pad ? "gap-y-3" : "gap-y-2",
  inputShell: "bg-white dark:bg-accent rounded-full overflow-hidden",
  inputPadding: pad ? "px-6 py-6 text-[1.125rem]" : "px-5 py-5 text-[1rem]",
  inputMinHeight: pad ? "min-h-16" : "min-h-14",
  title: pad
    ? "text-[1.75rem] leading-10 text-center"
    : "text-[1.5rem] leading-8 text-center",
  subtitle: pad
    ? "text-[1.1875rem] leading-7 text-center text-black/80 dark:text-white/85"
    : "text-[1.0625rem] leading-6 text-center text-black/80 dark:text-white/85",
  headerContentWidth: "w-full max-w-md self-center",
  caption: pad
    ? "text-[1.125rem] leading-7 text-black/75 dark:text-white/80"
    : "text-[1rem] leading-6 text-black/75 dark:text-white/80",
} as const;
