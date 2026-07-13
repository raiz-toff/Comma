/**
 * COMMA — Google Drive Authentication
 * Handles OAuth2 flow via Google Identity Services (GSI).
 * No backend required. Access tokens are cached in localStorage for their ~1h lifetime
 * (same trust level as the backup password stored beside it) so a reload doesn't lose
 * the session. GIS `requestAccessToken()` ALWAYS opens a popup — even with prompt:'' —
 * and popups need a user gesture, so nothing here may auto-prompt at page load.
 */

import { bus } from '../../core/events.js';

// --- Configuration ---
// Web client of the SAME Google Cloud project as the mobile app (438513486290 — see
// commaApp/src/config/google.ts). Drive's appDataFolder is scoped per project, so web and
// mobile can only see each other's sync files when their OAuth clients share this project.
// Console prereqs: this PWA's deployed origin(s) + http://localhost must be listed under the
// client's Authorized JavaScript Origins, Drive API enabled, user added as an OAuth test user.
const GOOGLE_CLIENT_ID = '438513486290-hvsmc82435unb6t9gvmgddngk0p92g1m.apps.googleusercontent.com';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';

// --- State ---
let tokenClient = null;
let accessToken = null;
let tokenExpiry = 0;
let isGsiLoaded = false;
let authPromise = null;
let authResolve = null;

const TOKEN_STORE_KEY = 'comma_drive_token';

/** Restore a still-fresh token from a previous page load, so reloads don't re-auth. */
function hydrateStoredToken() {
  try {
    const raw = localStorage.getItem(TOKEN_STORE_KEY);
    if (!raw) return;
    const p = JSON.parse(raw);
    if (p && typeof p.token === 'string' && typeof p.exp === 'number' && Date.now() < p.exp - 120 * 1000) {
      accessToken = p.token;
      tokenExpiry = p.exp;
    } else {
      localStorage.removeItem(TOKEN_STORE_KEY);
    }
  } catch {
    /* unreadable/blocked storage — behave as before (memory only) */
  }
}

/**
 * Initializes the Google Identity Services client.
 * Loads the GSI script if it's not already present.
 */
export async function initDriveAuth() {
  if (isGsiLoaded) return;

  hydrateStoredToken();

  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) {
      isGsiLoaded = true;
      setupTokenClient();
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      isGsiLoaded = true;
      setupTokenClient();
      resolve();
    };
    script.onerror = () => reject(new Error('Failed to load Google Identity Services script.'));
    document.head.appendChild(script);
  });
}

function setupTokenClient() {
  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: DRIVE_SCOPE,
    callback: (tokenResponse) => {
      if (tokenResponse.error) {
        console.error('[drive-auth] Auth error:', tokenResponse.error);
        bus.emit('drive:auth_failed', tokenResponse);
        return;
      }
      
      accessToken = tokenResponse.access_token;
      tokenExpiry = Date.now() + (tokenResponse.expires_in * 1000);

      localStorage.setItem('comma_drive_connected', 'true');
      try {
        localStorage.setItem(TOKEN_STORE_KEY, JSON.stringify({ token: accessToken, exp: tokenExpiry }));
      } catch {
        /* private mode etc. — token stays memory-only for this session */
      }
      bus.emit('drive:auth_success', tokenResponse);

      if (authResolve) {
        authResolve(accessToken);
        authResolve = null;
        authPromise = null;
      }
    },
  });
}

/**
 * Requests an access token.
 * @param {boolean} silent If true, attempts silent re-auth (no popup).
 */
export function requestToken(silent = false) {
  if (!tokenClient) {
    console.error('[drive-auth] Token client not initialized.');
    return;
  }

  tokenClient.requestAccessToken({
    prompt: silent ? '' : 'select_account',
  });
}

export function getAccessToken() {
  // If we have less than 2 minutes left, consider it expired to be safe
  if (!accessToken || Date.now() > tokenExpiry - (120 * 1000)) {
    return null;
  }
  return accessToken;
}

/**
 * True when a live token is already in hand — the ONLY condition under which background
 * work (auto-sync at open/visibility) may talk to Drive. Without one, background callers
 * must skip quietly: acquiring a token opens a popup, and popups without a user gesture
 * are how "the app asks me to log in on every reload" happens.
 */
export function hasValidAccessToken() {
  return getAccessToken() != null;
}

/**
 * Ensures a valid access token is available, triggering silent re-auth if needed.
 * @returns {Promise<string>}
 */
export async function ensureAccessToken() {
  const token = getAccessToken();
  if (token) return token;

  if (authPromise) return authPromise;

  authPromise = new Promise((resolve, reject) => {
    authResolve = resolve;
    // Set a timeout in case the popup/silent-flow fails to call the callback
    setTimeout(() => {
      if (authPromise) {
        authPromise = null;
        authResolve = null;
        reject(new Error('Authentication timed out.'));
      }
    }, 30000);

    requestToken(true); // Attempt silent re-auth
  });

  return authPromise;
}

/**
 * Checks if the user was previously connected to Drive.
 * @returns {boolean}
 */
export function isDriveConnected() {
  return localStorage.getItem('comma_drive_connected') === 'true';
}

/**
 * Disconnects Drive by clearing tokens and local flag.
 */
export function disconnectDrive() {
  if (accessToken) {
    window.google.accounts.oauth2.revoke(accessToken, () => {
      /* token revoked — nothing to do; state below is already cleared */
    });
  }
  accessToken = null;
  tokenExpiry = 0;
  localStorage.removeItem('comma_drive_connected');
  localStorage.removeItem(TOKEN_STORE_KEY);
  bus.emit('drive:disconnected');
}
