import Constants from "expo-constants";
import * as Device from "expo-device";
import { Platform } from "react-native";
import WalletItem from "@/utils/store/wallet.store";
import UserItem from "@/utils/store/userstore.store";
import {
  submitBugReport,
  type BugReportSeverity,
  type BugReportType,
} from "@/services/bugReportApi";

const THROTTLE_MS = 5 * 60 * 1000;
const recentReports = new Map<string, number>();

function throttleKey(title: string, severity: string): string {
  return `${severity}:${title.slice(0, 120)}`;
}

function shouldThrottle(key: string): boolean {
  const last = recentReports.get(key);
  const now = Date.now();
  if (last && now - last < THROTTLE_MS) return true;
  recentReports.set(key, now);
  if (recentReports.size > 100) {
    const cutoff = now - THROTTLE_MS;
    for (const [k, t] of recentReports) {
      if (t < cutoff) recentReports.delete(k);
    }
  }
  return false;
}

function serializeError(error: unknown): { message: string; stack?: string } {
  if (error instanceof Error) {
    return { message: error.message || "Error", stack: error.stack };
  }
  if (typeof error === "string") {
    return { message: error };
  }
  try {
    return { message: JSON.stringify(error) };
  } catch {
    return { message: String(error) };
  }
}

function getAppVersion(): string {
  return (
    Constants.expoConfig?.version ??
    Constants.nativeAppVersion ??
    "unknown"
  );
}

function getDeviceInfo(): string {
  const parts = [
    Device.manufacturer,
    Device.modelName,
    Device.osName,
    Device.osVersion,
  ].filter(Boolean);
  return parts.join(" ") || Platform.OS;
}

export interface ReportBugOptions {
  title: string;
  summary?: string;
  error?: unknown;
  details?: string;
  severity?: BugReportSeverity;
  type?: BugReportType;
  metadata?: Record<string, unknown>;
}

/**
 * Report a bug or log to the admin pipeline (fire-and-forget).
 */
export async function reportBug(options: ReportBugOptions): Promise<void> {
  const severity = options.severity ?? "warning";
  const key = throttleKey(options.title, severity);
  if (shouldThrottle(key)) return;

  const { message, stack } = options.error
    ? serializeError(options.error)
    : { message: undefined, stack: undefined };

  const wallet =
    WalletItem.getState().publicKeyBase58 ??
    UserItem.getState().user?.wallet_address ??
    undefined;

  const user = UserItem.getState().user;

  await submitBugReport({
    title: options.title.slice(0, 255),
    summary: (options.summary ?? message)?.slice(0, 2000),
    details: options.details,
    stack_trace: stack,
    severity,
    type: options.type ?? "bug",
    wallet_address: wallet,
    app_version: getAppVersion(),
    platform: Platform.OS,
    device_info: getDeviceInfo(),
    metadata: {
      ...options.metadata,
      ...(user?.email ? { user_email: user.email } : {}),
      ...(user?.username ? { username: user.username } : {}),
      ...(user?.phoneE164 ? { phone: user.phoneE164 } : {}),
    },
  });
}

/** Shorthand for non-fatal warnings / diagnostic logs. */
export function reportWarning(
  title: string,
  options?: Omit<ReportBugOptions, "title" | "severity">
): void {
  reportBug({ ...options, title, severity: "warning", type: options?.type ?? "log" }).catch(
    () => {}
  );
}

/** Shorthand for critical failures. */
export function reportCritical(
  title: string,
  options?: Omit<ReportBugOptions, "title" | "severity">
): void {
  reportBug({ ...options, title, severity: "critical", type: options?.type ?? "bug" }).catch(
    () => {}
  );
}
