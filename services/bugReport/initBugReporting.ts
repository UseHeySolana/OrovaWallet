import { reportBug } from "@/services/bugReport/reportBug";

let initialized = false;

type FetchInput = Parameters<typeof fetch>[0];
type FetchInit = Parameters<typeof fetch>[1];

function getRequestUrl(input: FetchInput): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function getRequestMethod(input: FetchInput, init?: FetchInit): string {
  if (init?.method) return init.method.toUpperCase();
  if (typeof input === "object" && "method" in input && input.method) {
    return input.method.toUpperCase();
  }
  return "GET";
}

function sanitizeUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return rawUrl.split("?")[0].split("#")[0];
  }
}

function shouldSkipFetchReport(url: string): boolean {
  return url.includes("/bug-reports");
}

function initFetchReporting(): void {
  if (typeof globalThis.fetch !== "function") return;

  const originalFetch = globalThis.fetch.bind(globalThis);

  globalThis.fetch = (async (input: FetchInput, init?: FetchInit) => {
    const rawUrl = getRequestUrl(input);
    const url = sanitizeUrl(rawUrl);
    const method = getRequestMethod(input, init);
    const skipReport = shouldSkipFetchReport(rawUrl);

    try {
      const response = await originalFetch(input, init);

      if (!skipReport && !response.ok) {
        reportBug({
          title: `HTTP ${response.status} ${method} ${url}`.slice(0, 200),
          summary: `${method} request failed with ${response.status} ${response.statusText || ""}`.trim(),
          details: JSON.stringify(
            {
              url,
              method,
              status: response.status,
              statusText: response.statusText,
            },
            null,
            2
          ),
          severity: response.status >= 500 ? "critical" : "warning",
          type: "log",
          metadata: {
            handler: "fetch",
            failure_kind: "http_error",
            has_query: rawUrl.includes("?"),
          },
        }).catch(() => {});
      }

      return response;
    } catch (error) {
      if (!skipReport) {
        reportBug({
          title: `Network failed ${method} ${url}`.slice(0, 200),
          summary: error instanceof Error ? error.message : "Fetch request failed",
          error,
          details: JSON.stringify(
            {
              url,
              method,
            },
            null,
            2
          ),
          severity: "critical",
          type: "bug",
          metadata: {
            handler: "fetch",
            failure_kind: "network_error",
            has_query: rawUrl.includes("?"),
          },
        }).catch(() => {});
      }

      throw error;
    }
  }) as typeof fetch;
}

/**
 * Hooks global JS errors (and unhandled promise rejections where supported)
 * plus failed fetches, then sends them to POST /api/bug-reports for the admin pipeline.
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

  initFetchReporting();
}
