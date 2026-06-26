import { useState, useEffect } from "react";
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
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [backups, setBackups] = useState<DriveBackupFile[]>([]);
  const [lastBackup, setLastBackup] = useState<string | null>(null);

  const discovery = {
    authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenEndpoint: "https://oauth2.googleapis.com/token",
    revocationEndpoint: "https://oauth2.googleapis.com/revoke",
  };

  // oauth configuration
  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com", // client id will be injected by user credentials
      scopes: ["https://www.googleapis.com/auth/drive.appdata"],
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
    }
  };

  useEffect(() => {
    if (!isWeb && GoogleSignin) {
      try {
        GoogleSignin.configure({
          scopes: ["https://www.googleapis.com/auth/drive.appdata"],
        });
      } catch (err) {
        console.warn("Failed to configure GoogleSignin:", err);
      }
    }
    checkAuth();
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
        await GoogleSignin.signIn();
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
  };

  const loadBackupsList = async () => {
    try {
      const list = await listBackups();
      setBackups(list);
    } catch {
      // Quiet fail
    }
  };

  const triggerBackup = async (pin?: string) => {
    setIsBackingUp(true);
    try {
      await backupToDrive(pin);
      await loadBackupsList();
      setLastBackup(new Date().toISOString());
    } catch (err: any) {
      throw err;
    } finally {
      setIsBackingUp(false);
    }
  };

  const triggerRestore = async (fileId: string, pin?: string) => {
    setIsRestoring(true);
    try {
      await restoreFromDrive(fileId, pin);
      // Invalidate all react query queries to reload UI with the restored database!
      queryClient.invalidateQueries();
    } catch (err: any) {
      throw err;
    } finally {
      setIsRestoring(false);
    }
  };

  return {
    isAuthenticated,
    isBackingUp,
    isRestoring,
    backups,
    lastBackup,
    login,
    logout,
    triggerBackup,
    triggerRestore,
    requestReady: !!request,
  };
}
