import { useState, useEffect, useRef } from "react";
import { Platform, Alert } from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";
import * as SecureStore from "expo-secure-store";
import { useQueryClient } from "@tanstack/react-query";
import {
  saveTokens,
  getTokens,
  backupToDrive,
  listBackups,
  restoreFromDrive,
  type DriveBackupFile,
} from "../src/services/googleDrive";
import { notifyBackup, notifyRestore } from "../src/services/notify";
import { GOOGLE_WEB_CLIENT_ID, GOOGLE_DRIVE_SCOPES } from "../src/config/google";

let GoogleSignin: any = null;
try {
  GoogleSignin = require("@react-native-google-signin/google-signin").GoogleSignin;
} catch (e) {
  // Silent fallback
}

WebBrowser.maybeCompleteAuthSession();

const isWeb = Platform.OS === "web";
const REDIRECT_URI = AuthSession.makeRedirectUri({
  scheme: "comma",
  path: "oauth2callback",
});

export function useGoogleDriveSync() {
  const queryClient = useQueryClient();
  const isMountedRef = useRef(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [backups, setBackups] = useState<DriveBackupFile[]>([]);
  const [backupsError, setBackupsError] = useState<string | null>(null);
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const discovery = {
    authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenEndpoint: "https://oauth2.googleapis.com/token",
    revocationEndpoint: "https://oauth2.googleapis.com/revoke",
  };

  // oauth configuration
  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: GOOGLE_WEB_CLIENT_ID,
      scopes: GOOGLE_DRIVE_SCOPES,
      redirectUri: REDIRECT_URI,
      responseType: "token",
    },
    discovery
  );

  // Re-check authentication on mount
  const checkAuth = async () => {
    const tokens = await getTokens();
    setIsAuthenticated(!!tokens);
    if (tokens) {
      loadBackupsList();
      if (!isWeb && GoogleSignin) {
        try {
          const current = await GoogleSignin.getCurrentUser();
          setUserEmail(current?.user?.email ?? current?.data?.user?.email ?? null);
        } catch {}
      }
    }
  };

  useEffect(() => {
    if (!isWeb && GoogleSignin) {
      try {
        GoogleSignin.configure({
          webClientId: GOOGLE_WEB_CLIENT_ID,
          scopes: GOOGLE_DRIVE_SCOPES,
          offlineAccess: true,
        });
      } catch (err) {
        console.warn("Failed to configure GoogleSignin:", err);
      }
    }
    checkAuth();
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Handle oauth response
  useEffect(() => {
    if (response?.type === "success" && response.authentication?.accessToken) {
      const { accessToken, expiresIn } = response.authentication;
      const parsedExpiresIn = typeof expiresIn === "number" ? expiresIn : parseInt(expiresIn || "3600", 10);
      const expiryTime = Date.now() + parsedExpiresIn * 1000;

      saveTokens({
        accessToken,
        refreshToken: "", // implicit flow doesn't return refresh token by default
        expiryTime,
      }).then(() => {
        setIsAuthenticated(true);
        loadBackupsList();
      });
    }
  }, [response]);

  const login = async () => {
    if (isWeb) {
      await promptAsync();
    } else {
      if (!GoogleSignin) {
        Alert.alert(
          "Google Sign-In Unavailable",
          "Google Drive sync requires a custom native build. This option is not supported in the current development client."
        );
        return;
      }
      try {
        await GoogleSignin.hasPlayServices();
        const userInfo = await GoogleSignin.signIn();
        setUserEmail(userInfo?.data?.user?.email ?? userInfo?.user?.email ?? null);
        const tokens = await GoogleSignin.getTokens();
        
        const expiryTime = Date.now() + 3600 * 1000; // estimate 1 hour
        await saveTokens({
          accessToken: tokens.accessToken,
          refreshToken: "", // GoogleSignin automatically refreshes tokens in background
          expiryTime,
        });
        setIsAuthenticated(true);
        loadBackupsList();
      } catch (error) {
        console.error("Google Sign-In Error:", error);
        Alert.alert("Google Sign-In Failed", "Could not sign in to your Google Account.");
      }
    }
  };

  const logout = async () => {
    if (isWeb) {
      localStorage.removeItem("comma_gdrive_tokens");
    } else {
      await SecureStore.deleteItemAsync("comma_gdrive_tokens");
      if (GoogleSignin) {
        try {
          await GoogleSignin.signOut();
        } catch (e) {}
      }
    }
    setIsAuthenticated(false);
    setBackups([]);
    setUserEmail(null);
  };

  const loadBackupsList = async () => {
    try {
      const list = await listBackups();
      if (!isMountedRef.current) return;
      setBackups(list);
      setBackupsError(null);
    } catch (err: any) {
      if (!isMountedRef.current) return;
      // Surface the failure so the UI can distinguish "couldn't load (auth/network)" from the
      // genuine "no backups yet" empty state.
      setBackupsError(err?.message ?? "Couldn't load your backups from Google Drive.");
    }
  };

  const triggerBackup = async (passphrase: string) => {
    setIsBackingUp(true);
    try {
      await backupToDrive(passphrase);
      await loadBackupsList();
      setLastBackup(new Date().toISOString());
      notifyBackup(true);
    } catch (err: any) {
      notifyBackup(false, err?.message);
      throw err;
    } finally {
      setIsBackingUp(false);
    }
  };

  const triggerRestore = async (fileId: string, passphrase: string) => {
    setIsRestoring(true);
    try {
      await restoreFromDrive(fileId, passphrase);
      // Await invalidation so the success message/UI reflects the restored data, not the
      // pre-restore state (invalidateQueries returns a promise that triggers refetches).
      await queryClient.invalidateQueries();
      notifyRestore(true);
    } catch (err: any) {
      notifyRestore(false, err?.message);
      throw err;
    } finally {
      setIsRestoring(false);
    }
  };

  return {
    isAuthenticated,
    userEmail,
    isBackingUp,
    isRestoring,
    backups,
    backupsError,
    lastBackup,
    login,
    logout,
    triggerBackup,
    triggerRestore,
    requestReady: !!request,
  };
}
