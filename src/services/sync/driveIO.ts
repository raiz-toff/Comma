/**
 * Shared Drive I/O for the sync engine (cloud-sync). One place for the appDataFolder
 * list + multipart upload so push / pull / compaction don't each re-implement them.
 * Reuses the backup service's token + timeout plumbing.
 */

import { getValidAccessToken, fetchWithTimeout } from "../googleDrive";

export interface DriveFileRef {
  id: string;
  name: string;
}

/** List all files in the appDataFolder (id + name), newest first. Callers filter by name. */
export async function listAppDataFiles(): Promise<DriveFileRef[]> {
  const accessToken = await getValidAccessToken();
  const response = await fetchWithTimeout(
    "https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&fields=files(id,name)&orderBy=createdTime%20desc&pageSize=1000",
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!response.ok) {
    throw new Error("Failed to list files from Google Drive.");
  }
  const data = await response.json();
  return data.files || [];
}

/**
 * Upload a text body to the appDataFolder under `filename` via multipart/related. Used for
 * both delta change-logs and snapshots. Manual multipart string (not FormData+Blob) for
 * React Native reliability — same approach as the backup uploader.
 */
export async function uploadSyncFile(filename: string, envelope: string): Promise<void> {
  const accessToken = await getValidAccessToken();
  const metadata = { name: filename, parents: ["appDataFolder"] };
  const boundary = "comma_sync_boundary";
  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/octet-stream\r\n\r\n` +
    `${envelope}\r\n` +
    `--${boundary}--`;

  const response = await fetchWithTimeout(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Sync upload failed (${response.status}). ${detail}`.trim());
  }
}
