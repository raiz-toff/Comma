/**
 * COMMA — Google Drive API
 * Raw Drive REST API interactions for the appDataFolder scope.
 * Everything is scoped to the hidden appDataFolder.
 */

import { ensureAccessToken } from './drive-auth.js';

const DRIVE_API_URL = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD_API_URL = 'https://www.googleapis.com/upload/drive/v3/files';

/**
 * Lists all files in the appDataFolder.
 * @returns {Promise<Array<{id: string, name: string}>>}
 */
export async function listAppDataFiles() {
  const token = await ensureAccessToken();
  if (!token) throw new Error('No valid access token found.');

  const url = new URL(DRIVE_API_URL);
  url.searchParams.set('spaces', 'appDataFolder');
  url.searchParams.set('fields', 'files(id, name, modifiedTime, createdTime, size)');
  url.searchParams.set('pageSize', '1000');

  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(`Drive API Error: ${err.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return data.files || [];
}

/**
 * Downloads a file from Drive by ID.
 * @param {string} fileId 
 * @returns {Promise<Blob>}
 */
export async function downloadFile(fileId) {
  const token = await ensureAccessToken();
  if (!token) throw new Error('No valid access token found.');

  const response = await fetch(`${DRIVE_API_URL}/${fileId}?alt=media`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.statusText}`);
  }

  return response.blob();
}

/**
 * Uploads or updates a file in the appDataFolder.
 * @param {string} name 
 * @param {Blob} blob 
 * @param {string} [existingFileId] If provided, updates the existing file.
 * @returns {Promise<string>} The file ID.
 */
export async function uploadFile(name, blob, existingFileId = null) {
  const token = await ensureAccessToken();
  if (!token) throw new Error('No valid access token found.');

  const metadata = {
    name: name,
    parents: existingFileId ? undefined : ['appDataFolder']
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', blob);

  const url = existingFileId 
    ? `${UPLOAD_API_URL}/${existingFileId}?uploadType=multipart`
    : `${UPLOAD_API_URL}?uploadType=multipart`;

  const method = existingFileId ? 'PATCH' : 'POST';

  const response = await fetch(url, {
    method: method,
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: form
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(`Upload failed: ${err.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return data.id;
}

/**
 * Upload a text envelope (a `.cmlog`/`.cmsnap` sync file body) to the appDataFolder under
 * `filename`, ALWAYS as a new file (never updates an existing one — every push/compaction writes
 * a fresh, uniquely-timestamped filename by construction, see `services/sync/changeLog.js`).
 * Interop plan Workstream 3 — mirrors mobile's `driveIO.ts` `uploadSyncFile`; delegates to the
 * existing `uploadFile` multipart helper (web's FormData-based upload is already reliable, so
 * there's no need for mobile's manual multipart-string workaround for React Native's fetch).
 * @param {string} filename
 * @param {string} envelope
 * @returns {Promise<string>} the new file's Drive id
 */
export async function uploadSyncFile(filename, envelope) {
  const blob = new Blob([envelope], { type: 'application/octet-stream' });
  return uploadFile(filename, blob);
}

/**
 * Renames a file (used for rotation).
 * @param {string} fileId 
 * @param {string} newName 
 */
export async function renameFile(fileId, newName) {
  const token = await ensureAccessToken();
  if (!token) throw new Error('No valid access token found.');

  const response = await fetch(`${DRIVE_API_URL}/${fileId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ name: newName })
  });

  if (!response.ok) {
    throw new Error(`Failed to rename file: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Deletes a file from Drive.
 * @param {string} fileId 
 */
export async function deleteFile(fileId) {
  const token = await ensureAccessToken();
  if (!token) throw new Error('No valid access token found.');

  const response = await fetch(`${DRIVE_API_URL}/${fileId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok && response.status !== 404) {
    throw new Error(`Failed to delete file: ${response.statusText}`);
  }
}
