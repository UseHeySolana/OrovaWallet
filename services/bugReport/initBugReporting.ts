import { reportBug } from "@/services/bugReport/reportBug";

let initialized = false;

/**
 * Hooks global JS errors (and unhandled promise rejections where supported)
 * and sends them to POST /api/bug-reports for the admin pipeline.
 */
export function initBugReporting(): void {
  if (initialized) return;
  initialized = true;

  const ErrorUtils = (global as typeof globalThis & {
    ErrorUtils?: {
      getGlobalHandler: () => ((error: Error, isFatal?: boolean) => void) | undefined;
      setGlobalHandler: (handler: (error: Error, isFatal?: boolean) => void) => void;
    };
  }).ErrorUtils;

  if (ErrorUtils?.getGlobalHandler && ErrorUtils?.setGlobalHandler) {
    const defaultHandler = ErrorUtils.getGlobalHandler();
    ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
      reportBug({
        title: error?.message?.slice(0, 200) || "Unhandled JS error",
        error,
        severity: isFatal ? "critical" : "warning",
        metadata: { isFatal: Boolean(isFatal), handler: "ErrorUtils" },
      }).catch(() => {});

      defaultHandler?.(error, isFatal);
    });
  }

  // Hermes / modern RN may expose unhandled promise rejections on globalThis
  const g = globalThis as typeof globalThis & {
    onunhandledrejection?: ((event: { reason?: unknown }) => void) | null;
  };

  if (typeof g.addEventListener === "function") {
    g.addEventListener("unhandledrejection", (event: { reason?: unknown }) => {
      const reason = event?.reason;
      const err = reason instanceof Error ? reason : new Error(String(reason ?? "Unhandled rejection"));
      reportBug({
        title: err.message?.slice(0, 200) || "Unhandled promise rejection",
        error: err,
        severity: "critical",
        metadata: { handler: "unhandledrejection" },
      }).catch(() => {});
    });
  }
}
