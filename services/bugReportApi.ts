import { BASE_URL } from "@/utils/constant";

export type BugReportSeverity = "critical" | "warning" | "info";
export type BugReportType = "bug" | "log";

export interface SubmitBugReportPayload {
  title: string;
  summary?: string;
  details?: string;
  stack_trace?: string;
  severity?: BugReportSeverity;
  type?: BugReportType;
  wallet_address?: string;
  source?: string;
  app_version?: string;
  platform?: string;
  device_info?: string;
  metadata?: Record<string, unknown>;
}

/**
 * POST /api/bug-reports — no auth; ingested into admin Bugs & Logs pipeline.
 */
export async function submitBugReport(
  payload: SubmitBugReportPayload
): Promise<boolean> {
  if (!BASE_URL) {
    if (__DEV__) {
      console.warn("[bugReport] EXPO_PUBLIC_API_URL not set; skipping report");
    }
    return false;
  }

  try {
    const res = await fetch(`${BASE_URL}/bug-reports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "wallet",
        severity: "warning",
        type: "bug",
        ...payload,
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      if (__DEV__) {
        console.warn("[bugReport] submit failed", res.status, body);
      }
      return false;
    }

    return true;
  } catch (e) {
    if (__DEV__) {
      console.warn("[bugReport] network error", e);
    }
    return false;
  }
}
