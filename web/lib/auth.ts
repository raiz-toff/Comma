/**
 * Google OAuth2 PKCE flow for the Comma web app.
 *
 * SETUP REQUIRED: Add the following Authorized Redirect URI to your Google Cloud
 * OAuth 2.0 client (Web application type) at console.cloud.google.com:
 *   - http://localhost:3000/auth/callback  (development)
 *   - https://your-domain.com/auth/callback  (production)
 */

const CLIENT_ID = "438513486290-hvsmc82435unb6t9gvmgddngk0p92g1m.apps.googleusercontent.com";
const SCOPES = ["https://www.googleapis.com/auth/drive.appdata", "openid", "email", "profile"].join(" ");

function getRedirectUri(): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/auth/callback`;
}

// ─── PKCE helpers ────────────────────────────────────────────────────────────

function generateVerifier(): string {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return btoa(Array.from(arr, (b) => String.fromCharCode(b)).join(""))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

async function generateChallenge(verifier: string): Promise<string> {
  const enc = new TextEncoder();
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(verifier));
  return btoa(Array.from(new Uint8Array(digest), (b) => String.fromCharCode(b)).join(""))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

// ─── Token storage ────────────────────────────────────────────────────────────

export interface GoogleTokens {
  accessToken: string;
  refreshToken: string;
  expiryTime: number;
  email?: string;
  name?: string;
}

const TOKEN_KEY = "comma_gdrive_tokens";

export function saveTokens(tokens: GoogleTokens): void {
  localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
}

export function getTokens(): GoogleTokens | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearTokens(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function isAuthenticated(): boolean {
  const tokens = getTokens();
  return !!tokens?.accessToken;
}

// ─── OAuth flow ───────────────────────────────────────────────────────────────

export async function startGoogleAuth(): Promise<void> {
  const verifier = generateVerifier();
  const challenge = await generateChallenge(verifier);
  const state = crypto.randomUUID();

  sessionStorage.setItem("pkce_verifier", verifier);
  sessionStorage.setItem("oauth_state", state);

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: getRedirectUri(),
    response_type: "code",
    scope: SCOPES,
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
    access_type: "offline",
    prompt: "consent",
  });

  window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function handleOAuthCallback(code: string, state: string): Promise<GoogleTokens> {
  const savedState = sessionStorage.getItem("oauth_state");
  const verifier = sessionStorage.getItem("pkce_verifier");

  if (state !== savedState) throw new Error("OAuth state mismatch. Please try signing in again.");
  if (!verifier) throw new Error("PKCE verifier missing. Please try signing in again.");

  sessionStorage.removeItem("oauth_state");
  sessionStorage.removeItem("pkce_verifier");

  // Token exchange goes through our API route so the client_secret stays server-side
  const res = await fetch("/api/auth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      code_verifier: verifier,
      redirect_uri: getRedirectUri(),
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`Token exchange failed: ${err}`);
  }

  const data = await res.json();

  // Fetch user info
  let email: string | undefined;
  let name: string | undefined;
  try {
    const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${data.access_token}` },
    });
    if (userRes.ok) {
      const user = await userRes.json();
      email = user.email;
      name = user.name;
    }
  } catch {}

  const tokens: GoogleTokens = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiryTime: Date.now() + data.expires_in * 1000,
    email,
    name,
  };

  saveTokens(tokens);
  return tokens;
}

let refreshInFlight: Promise<string> | null = null;

export async function getValidAccessToken(): Promise<string> {
  const tokens = getTokens();
  if (!tokens) throw new Error("Not authenticated. Please sign in with Google.");

  const isExpiring = tokens.expiryTime - Date.now() < 5 * 60 * 1000;
  if (!isExpiring) return tokens.accessToken;

  if (!tokens.refreshToken) throw new Error("Session expired. Please sign in again.");

  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const res = await fetch("/api/auth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "refresh_token",
        refresh_token: tokens.refreshToken,
      }),
    });

    if (!res.ok) throw new Error("Failed to refresh Google session. Please sign in again.");

    const data = await res.json();
    const updated: GoogleTokens = {
      ...tokens,
      accessToken: data.access_token,
      expiryTime: Date.now() + data.expires_in * 1000,
    };
    saveTokens(updated);
    return data.access_token;
  })().finally(() => { refreshInFlight = null; });

  return refreshInFlight;
}
