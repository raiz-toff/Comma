/**
 * Shared Drive I/O for the sync engine (cloud-sync). One place for the appDataFolder
 * list + multipart upload so push / pull / compaction don't each re-implement them.
 * Reuses the backup service's token + timeout plumbing.
 */

import { getValidAccessToken, fetchWithTimeout } from "../googleDrive";

export interface DriveFileRef {
  id: string;
  name: string;
  /** RFC-3339; present for manifest-race tie-breaking (oldest createdTime wins) and Phase-2
   *  "peer file unchanged since last merge?" skips. Older list calls didn't request it. */
  createdTime?: string;
  modifiedTime?: string;
}

/**
 * Turn a failed Drive response into an actionable error. A 401/403 means the session went
 * stale or lost the Drive scope — the fix is to reconnect, so say that instead of a generic
 * "failed". Other statuses carry the HTTP code + Google's message so the real cause (quota,
 * network, bad request) is visible in logs and support reports rather than hidden.
 */
async function driveError(response: Response, action: string): Promise<Error> {
  const detail = await response.text().catch(() => "");
  // 401 = the token expired/was rejected → reconnecting mints a fresh one and fixes it.
  if (response.status === 401) {
    return new Error("Your Google Drive session expired. Reconnect Google Drive in Settings, then sync again.");
  }
  // 403 = the token is VALID but not allowed to reach Drive. Reconnecting won't help — it's an
  // authorization problem: the drive.appdata scope wasn't granted (app still in OAuth "Testing"
  // and this account isn't a test user, or the scope needs verification), or the build's signing
  // SHA-1 isn't on the Android OAuth client. Surface Google's own reason so the cause is visible.
  if (response.status === 403) {
    return new Error(`Google Drive denied access to Comma's storage (403). This is an app authorization issue, not a stale login — reconnecting won't fix it. ${detail}`.trim());
  }
  return new Error(`Couldn't ${action} (Google Drive returned ${response.status}). ${detail}`.trim());
}

/**
 * Authenticated GET to Drive, with a single 401 retry on a force-refreshed token. A just-issued
 * token can still be rejected once (the SDK sometimes returns a stale cached access token); the
 * retry mints a fresh one and tries again before giving up, so a transient stale-token 401
 * doesn't surface as a "session expired" the user can't do anything about.
 */
async function driveGet(url: string): Promise<Response> {
  const token = await getValidAccessToken();
  const res = await fetchWithTimeout(url, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status !== 401) return res;
  const fresh = await getValidAccessToken(true);
  return fetchWithTimeout(url, { headers: { Authorization: `Bearer ${fresh}` } });
}

/** List all files in the appDataFolder (id + name + times), newest first. Callers filter by name. */
export async function listAppDataFiles(): Promise<DriveFileRef[]> {
  const response = await driveGet(
    "https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&fields=files(id,name,createdTime,modifiedTime)&orderBy=createdTime%20desc&pageSize=1000"
  );
  if (!response.ok) {
    throw await driveError(response, "list your Google Drive backup");
  }
  const data = await response.json();
  return data.files || [];
}

/** Download a single appDataFolder file's raw text body (an envelope, a manifest JSON…). */
export async function downloadDriveText(fileId: string): Promise<string> {
  const response = await driveGet(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`);
  if (!response.ok) {
    throw await driveError(response, "download a file from Google Drive");
  }
  return response.text();
}

/**
 * Overwrite an EXISTING appDataFolder file's body in place (PATCH media upload) — the fileId
 * is stable across the update, so readers holding it keep working and the previous good
 * version survives a failed upload. Used for the vault manifest and (Phase 2) per-device
 * state files, which each own one durable file rather than piling up new ones per write.
 */
export async function updateDriveFile(fileId: string, body: string): Promise<void> {
  const accessToken = await getValidAccessToken();
  const response = await fetchWithTimeout(
    `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/octet-stream",
      },
      body,
    }
  );
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Drive update failed (${response.status}). ${detail}`.trim());
  }
}

/**
 * Upload a NEW text file to the appDataFolder under `filename` and return its Drive id.
 * Same multipart body as `uploadSyncFile`, but the caller wants the id back (e.g. to keep
 * updating that same file in place afterward via `updateDriveFile`).
 */
export async function createDriveFile(filename: string, body: string): Promise<string> {
  const accessToken = await getValidAccessToken();
  const metadata = { name: filename, parents: ["appDataFolder"] };
  const boundary = "comma_sync_boundary";
  const multipart =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/octet-stream\r\n\r\n` +
    `${body}\r\n` +
    `--${boundary}--`;

  const response = await fetchWithTimeout(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body: multipart,
    }
  );
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Drive create failed (${response.status}). ${detail}`.trim());
  }
  const data = await response.json();
  return data.id as string;
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
