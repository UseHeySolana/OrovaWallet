import type { WalletBackupFile } from "@/services/backup/walletBackupCrypto";
import { logBackup, logBackupError } from "@/services/backup/backupLogger";

export const WALLET_BACKUP_FILE_NAME = "heysolana-wallet-backup-v1.json";

type DriveFile = {
  id: string;
  name?: string;
  modifiedTime?: string;
};

async function driveRequest<T>(
  accessToken: string,
  path: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(`https://www.googleapis.com/drive/v3${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    logBackupError("drive API error", message, { path, status: response.status });
    throw new Error(message || "Google Drive request failed");
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

async function findBackupFile(accessToken: string): Promise<DriveFile | null> {
  logBackup("drive — searching for backup file");
  const query = encodeURIComponent(
    `name='${WALLET_BACKUP_FILE_NAME}' and 'appDataFolder' in parents and trashed=false`
  );
  const result = await driveRequest<{ files?: DriveFile[] }>(
    accessToken,
    `/files?spaces=appDataFolder&q=${query}&fields=files(id,name,modifiedTime)&pageSize=1`
  );
  const file = result.files?.[0] ?? null;
  logBackup(file ? "drive — backup file found" : "drive — no backup file yet", {
    fileId: file?.id,
    modifiedTime: file?.modifiedTime,
  });
  return file;
}

async function uploadBackupContent(
  accessToken: string,
  fileId: string,
  content: string
): Promise<void> {
  const response = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: content,
    }
  );

  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    logBackupError("drive — upload content failed", message, {
      fileId,
      status: response.status,
    });
    throw new Error(message || "Could not upload wallet backup");
  }
  logBackup("drive — file content uploaded", { fileId });
}

export async function uploadWalletBackupToDrive(
  accessToken: string,
  backup: WalletBackupFile
): Promise<{ fileId: string; modifiedTime?: string }> {
  const content = JSON.stringify(backup);
  const existing = await findBackupFile(accessToken);

  if (existing?.id) {
    logBackup("drive — updating existing backup", { fileId: existing.id });
    await uploadBackupContent(accessToken, existing.id, content);
    return { fileId: existing.id, modifiedTime: new Date().toISOString() };
  }

  logBackup("drive — creating new backup file");
  const created = await driveRequest<DriveFile>(accessToken, "/files", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: WALLET_BACKUP_FILE_NAME,
      parents: ["appDataFolder"],
      mimeType: "application/json",
    }),
  });

  await uploadBackupContent(accessToken, created.id, content);
  return { fileId: created.id, modifiedTime: new Date().toISOString() };
}

export async function downloadWalletBackupFromDrive(
  accessToken: string
): Promise<WalletBackupFile | null> {
  const existing = await findBackupFile(accessToken);
  if (!existing?.id) {
    return null;
  }

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${existing.id}?alt=media`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(message || "Could not download wallet backup");
  }

  const raw = await response.text();
  const parsed = JSON.parse(raw) as WalletBackupFile;
  if (parsed.version !== 1) {
    throw new Error("Unsupported backup version");
  }
  return parsed;
}
