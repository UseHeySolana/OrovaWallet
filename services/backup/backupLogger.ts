const LOG = "[GoogleDriveBackup]";

type StatusListener = (step: string, detail?: string) => void;

let statusListener: StatusListener | null = null;

function previewWallet(address?: string) {
  if (!address) return "—";
  if (address.length <= 10) return address;
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

function formatDetail(extra?: Record<string, unknown>): string | undefined {
  if (!extra || Object.keys(extra).length === 0) return undefined;
  try {
    return JSON.stringify(extra);
  } catch {
    return String(extra);
  }
}

export function setBackupStatusListener(listener: StatusListener | null): void {
  statusListener = listener;
}

export function logBackup(
  step: string,
  extra?: Record<string, unknown>
): void {
  const detail = formatDetail(extra);
  // console.warn is easier to spot in Metro, Xcode, and adb logcat (ReactNativeJS).
  if (detail) {
    console.warn(LOG, step, detail);
  } else {
    console.warn(LOG, step);
  }
  statusListener?.(step, detail);
}

export function logBackupError(
  step: string,
  error: unknown,
  extra?: Record<string, unknown>
): void {
  const message =
    error instanceof Error ? error.message : String(error ?? "Unknown error");
  const detail = formatDetail({ ...extra, error: message });
  console.warn(LOG, step, detail ?? message);
  statusListener?.(`Error: ${step}`, detail ?? message);
}

export { previewWallet };
