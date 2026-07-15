/**
 * Backup & Restore — simplified "one-tap" hub screen.
 *
 * Sync always encrypts. There is no plain mode and no toggle: connecting Google Drive
 * prompts for a backup password as a normal, required part of turning Sync on — not an
 * "Advanced"/power-user setting. Reached via /settings/backup.
 */

import React, { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Modal,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import { Text } from "@/src/components/ui/text";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import {
  ChevronLeft,
  Check,
  FileDown,
  RefreshCw,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
} from "lucide-react-native";

import { usePlatformTheme } from "@/src/hooks/usePlatformTheme";
import { useLayout } from "@/src/hooks/useLayout";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useGoogleDriveSync } from "@/hooks/useGoogleDriveSync";
import { useSyncNow } from "@/hooks/useSyncNow";
import {
  isSyncEnabled,
  setSyncEnabled as persistSyncEnabled,
  getSyncSchedule,
  setSyncSchedule as persistSyncSchedule,
  setLastPushedAt,
  getLastPushRunAt,
} from "@/src/database/syncState";
import {
  SYNC_SCHEDULES,
  SCHEDULE_LABELS,
  DEFAULT_SCHEDULE,
  type SyncSchedule,
} from "@/src/services/sync/schedule";
import {
  getBackupPassword,
  setBackupPassword,
  hasBackupPassword,
} from "@/src/services/backupPassword";
import { exportBackupFile, restoreBackupFile } from "@/src/services/backupFile";
import { resetCloudVault } from "@/src/services/sync/cloudReset";
import { FeedbackDialog, BusyOverlay, type FeedbackVariant } from "@/src/components/ui/FeedbackDialog";
import { GoogleDriveLogo } from "@/src/components/logos/GoogleDriveLogo";
import { SetBackupPasswordScreen } from "@/src/components/sync/SetBackupPasswordScreen";
import { ForgotPasswordScreen } from "@/src/components/sync/ForgotPasswordScreen";
import { withAlpha } from "@/src/theme/colors";
import { useColors, useThemedStyles, type Palette } from "@/src/theme/useColors";

// ─── Design tokens ────────────────────────────────────────────────────────────

const makeDS = (C: Palette) =>
  ({
    pageBg: C.background,
    cardBg: C.surface02,
    cardBorder: C.lineSubtle,
    inputBg: C.surface03,
    inputBorder: C.lineStrong,
    sep: C.lineSubtle,
    textPrimary: C.contentPrimary,
    textSecondary: C.contentSecondary,
    textMuted: C.contentMuted,
  }) as const;

const MIN_PW = 6;

/** "2 minutes ago" / "3 hours ago" / a date for anything older than a week. */
function formatLastSync(epochMs: number): string {
  const mins = Math.floor((Date.now() - epochMs) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(epochMs).toLocaleDateString();
}

// ─── Enter an existing backup password — lightweight modal, just a key ────────
//
// Setting a NEW password is a full-screen flow (SetBackupPasswordScreen) — the moment that
// deserves attention is committing to a password, not typing one you already chose and
// (hopefully) saved. This stays a small modal, with a way out for "I don't have it anymore."

function PasswordPrompt({
  accentColor,
  accentColorContrast,
  onCancel,
  onSubmit,
  onForgot,
}: {
  accentColor: string;
  accentColorContrast: string;
  onCancel: () => void;
  onSubmit: (pw: string) => void;
  onForgot: () => void;
}) {
  const C = useColors();
  const DS = useThemedStyles(makeDS);
  const s = useThemedStyles(makeStyles);
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");

  const submit = () => {
    if (pw.length < MIN_PW) {
      setErr(`Use at least ${MIN_PW} characters.`);
      return;
    }
    onSubmit(pw);
  };

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView
        style={s.overlay}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={s.dialogCard}>
          <View style={[s.dialogIcon, { backgroundColor: withAlpha(accentColor, 0.12), borderColor: withAlpha(accentColor, 0.25) }]}>
            <ShieldCheck size={24} color={accentColor} />
          </View>
          <Text variant="headingS" style={{ textAlign: "center" }}>Enter your backup password</Text>
          <Text variant="paragraphM" style={{ textAlign: "center" }}>
            Your Drive has data locked with a different password. Enter it to continue —
            backup is paused until you do, so your devices don't drift apart.
          </Text>

          <TextInput
            style={s.dialogInput}
            value={pw}
            onChangeText={(v) => { setPw(v); setErr(""); }}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="Password"
            placeholderTextColor={DS.textMuted}
          />
          {err ? <Text variant="paragraphS" className="text-destructive" style={{ alignSelf: "flex-start" }}>{err}</Text> : null}

          <View style={s.dialogRow}>
            <TouchableOpacity
              onPress={onCancel}
              accessibilityRole="button"
              style={[s.dialogBtn, { backgroundColor: C.surface04 }]}
            >
              <Text variant="labelM" className="text-content-secondary">Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={submit}
              accessibilityRole="button"
              style={[s.dialogBtn, { backgroundColor: accentColor }]}
            >
              <Text variant="labelM" style={{ color: accentColorContrast }}>Unlock</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={onForgot} accessibilityRole="button" style={{ marginTop: 2 }}>
            <Text variant="labelXs" className="text-content-muted">Forgot your password?</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Small pill button ────────────────────────────────────────────────────────

function PillBtn({
  label,
  onPress,
  variant = "ghost",
  disabled = false,
  accent,
  accentDim,
  accentMid,
  accentContrast,
}: {
  label: string;
  onPress: () => void;
  variant?: "ghost" | "primary" | "danger";
  disabled?: boolean;
  accent: string;
  accentDim: string;
  accentMid: string;
  accentContrast: string;
}) {
  const C = useColors();
  const DS = useThemedStyles(makeDS);
  const s = useThemedStyles(makeStyles);
  const styleByVariant = {
    ghost: { bg: DS.inputBg, border: DS.inputBorder, text: DS.textSecondary },
    primary: { bg: accentDim, border: accentMid, text: accent },
    danger: { bg: withAlpha(C.destructive, 0.12), border: withAlpha(C.destructive, 0.25), text: C.destructive },
  }[variant];
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      activeOpacity={0.7}
      style={[s.pill, { backgroundColor: styleByVariant.bg, borderColor: styleByVariant.border, opacity: disabled ? 0.4 : 1 }]}
    >
      <Text variant="labelM" style={{ color: styleByVariant.text }}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function SyncScreen() {
  const C = useColors();
  const DS = useThemedStyles(makeDS);
  const s = useThemedStyles(makeStyles);
  const { columnStyle } = useLayout();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { accentColor, accentColorDim, accentColorMid, accentColorContrast } = usePlatformTheme();
  const isDemoMode = useSettingsStore((st) => st.isDemoMode);
  const loadSettings = useSettingsStore((st) => st.loadSettings);
  const { isAuthenticated, userEmail, login, logout } = useGoogleDriveSync();
  const { isSyncing, triggerSync } = useSyncNow();

  const [schedule, setScheduleState] = useState<SyncSchedule>(DEFAULT_SCHEDULE);
  const [syncEnabled, setSyncEnabledState] = useState(false);
  const [hasPassword, setHasPassword] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);   // Collapsed by default
  const [pwPrompt, setPwPrompt] = useState<null | { onSubmit: (pw: string) => void }>(null);
  const [showSetPassword, setShowSetPassword] = useState<null | { onConfirm: (pw: string) => void | Promise<void> }>(null);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [passphraseLockedFiles, setPassphraseLockedFiles] = useState<string[]>([]);
  const [fileBusy, setFileBusy] = useState<null | "export" | "restore">(null);
  const suppressAutoEnable = useRef(false);
  const [dialog, setDialog] = useState<null | {
    variant: FeedbackVariant;
    title: string;
    message?: string;
    confirmLabel?: string;
    confirmDanger?: boolean;
    cancelLabel?: string;
    onConfirm?: () => void;
  }>(null);

  const [lastSyncAt, setLastSyncAt] = useState(0);

  const refreshSyncState = async () => {
    setSyncEnabledState(await isSyncEnabled());
    setScheduleState(await getSyncSchedule());
    setHasPassword(await hasBackupPassword());
    setLastSyncAt(await getLastPushRunAt());
  };

  useEffect(() => {
    refreshSyncState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-enable sync as soon as Drive is connected. This does NOT mean data starts
  // flowing yet — sync has no plain mode, so the engine itself refuses to push until a
  // password exists (see syncNow's needsPasswordSetup). Only skip if demo mode is on or
  // a file-restore just happened.
  useEffect(() => {
    if (isAuthenticated && !syncEnabled && !suppressAutoEnable.current && !isDemoMode) {
      setSyncEnabledState(true);
      persistSyncEnabled(true).catch(() => setSyncEnabledState(false));
    }
  }, [isAuthenticated, syncEnabled, isDemoMode]);

  // As soon as Drive connects, kick a sync once — for a joining device (existing account)
  // this surfaces "Enter your password"; for a brand-new or previously-unencrypted account
  // it surfaces "Set a backup password". Fires for every device, onboarded or not — a
  // password is required to turn Sync on, full stop, not just for first-time joiners.
  const autoKicked = useRef(false);
  useEffect(() => {
    if (!isAuthenticated || !syncEnabled || isDemoMode || autoKicked.current) return;
    autoKicked.current = true;
    doSyncNow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, syncEnabled, isDemoMode]);

  // ── Demo guard ──────────────────────────────────────────────────────────────
  const blockedByDemo = () => {
    if (!isDemoMode) return false;
    setDialog({
      variant: "info",
      title: "Demo Mode Active",
      message: "Cloud Sync is disabled in Demo Mode so sample data isn't backed up. Turn off Demo Mode in Settings to sync real data.",
      confirmLabel: "Go to Settings",
      cancelLabel: "Cancel",
      onConfirm: () => { setDialog(null); router.push("/settings"); },
    });
    return true;
  };

  // ── Actions ─────────────────────────────────────────────────────────────────
  const onConnect = () => {
    if (blockedByDemo()) return;
    login();
  };

  const onDisconnect = () =>
    setDialog({
      variant: "info",
      title: "Turn off Cloud Sync?",
      message: "Sync stops and Google Drive disconnects on this device. Your synced data stays safe in your Drive — reconnect any time to pull it back.",
      confirmLabel: "Turn off",
      confirmDanger: true,
      cancelLabel: "Cancel",
      onConfirm: async () => {
        setDialog(null);
        setSyncEnabledState(false);
        await persistSyncEnabled(false);
        await logout();
      },
    });

  const onPickSchedule = async (next: SyncSchedule) => {
    const prev = schedule;
    setScheduleState(next);
    try {
      await persistSyncSchedule(next);
    } catch {
      setScheduleState(prev);
    }
  };

  /**
   * A brand-new password (first-ever setup, or a legacy no-password account setting one
   * for the first time) changes the format of every file we write. Rewind the push cursor
   * to 0 so the very next push re-uploads this device's FULL current state encrypted —
   * otherwise the cloud keeps only old plain files plus a thin new encrypted delta, and a
   * device that only has the password can never reconstruct the earlier history.
   */
  const repushInNewMode = async () => {
    await setLastPushedAt(0);
  };

  /**
   * "I don't have this password anymore." Cryptographically that's final — there is no
   * recovery. The only way forward is to give up on whatever's still locked behind it:
   * wipe this device and restart fresh on the SAME Drive account with a new password.
   * Anything still on another device is unaffected; anything that only existed under the
   * old password is gone for good, which is why this needs its own confirmation, gated
   * behind biometrics like the other irreversible resets in Settings.
   */
  const confirmForgotPassword = () => {
    setPwPrompt(null);
    setShowForgotPassword(true);
  };

  // Forgot-password → CLOUD reset (not a device wipe): keep this phone's data, throw away the
  // unreadable cloud copy, and rebuild it under a brand-new password (plans/008 Phase 1). The
  // forgot screen has already shown the consequences + an "I understand" gate; here we confirm
  // identity, collect the new password (full-screen, so its own "save this" warning lands),
  // then resetCloudVault does the delete-all + fresh-manifest + repush.
  const onForgotPasswordConfirmed = async () => {
    const authenticated = await authenticateWithBiometrics("Confirm Identity to Reset Cloud Backup");
    if (!authenticated) {
      setShowForgotPassword(false);
      setDialog({ variant: "error", title: "Authentication failed", message: "Reset cancelled." });
      return;
    }
    setShowForgotPassword(false);
    setShowSetPassword({
      onConfirm: async (newPw) => {
        setShowSetPassword(null);
        try {
          await resetCloudVault(newPw);
          setPassphraseLockedFiles([]);
          queryClient.invalidateQueries();
          await refreshSyncState();
          setDialog({
            variant: "info",
            title: "Backup rebuilt",
            message:
              "Your data on this phone is safe and now backs up under your new password. " +
              "Enter this same password on your other devices to reconnect them.",
          });
        } catch (e: any) {
          setDialog({ variant: "error", title: "Reset failed", message: e?.message ?? "Something went wrong." });
        }
      },
    });
  };

  // Change the account password: prove identity, collect a new password (full-screen, its own
  // "save this" warning), then rotate. We syncNow(current) FIRST so any peer data not yet on
  // this phone is merged in locally — otherwise resetCloudVault (delete-all + repush THIS
  // phone's state under the new password) would drop changes that only lived on other devices.
  const changePassword = () => {
    setDialog({
      variant: "info",
      title: "Change backup password?",
      message:
        "You'll set a new password and your other devices will need it to keep syncing. " +
        "Make sure your devices are synced first so nothing is left behind.",
      confirmLabel: "Change password",
      cancelLabel: "Cancel",
      onConfirm: async () => {
        setDialog(null);
        const authed = await authenticateWithBiometrics("Confirm Identity to Change Backup Password");
        if (!authed) {
          setDialog({ variant: "error", title: "Authentication failed", message: "Change cancelled." });
          return;
        }
        setShowSetPassword({
          onConfirm: async (newPw) => {
            setShowSetPassword(null);
            try {
              const current = (await getBackupPassword()) ?? "";
              if (current) await triggerSync(current); // pull peers' changes into local first
              await resetCloudVault(newPw);
              await refreshSyncState();
              setDialog({
                variant: "info",
                title: "Password changed",
                message: "Enter this new password on your other devices to keep them syncing.",
              });
            } catch (e: any) {
              setDialog({ variant: "error", title: "Change failed", message: e?.message ?? "Something went wrong." });
            }
          },
        });
      },
    });
  };

  const authenticateWithBiometrics = async (reason: string): Promise<boolean> => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hasHardware || !isEnrolled) return true;
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: reason,
        fallbackLabel: "Enter Passcode",
        disableDeviceFallback: false,
      });
      return result.success;
    } catch (e) {
      console.warn("Biometrics error:", e);
      return false;
    }
  };

  /**
   * Run one sync. `override` lets a password prompt retry immediately with what the user
   * just typed, without waiting for React state.
   *
   * Sync has no plain mode: the password always comes from SecureStore at call time, never
   * from a React state variable — this also sidesteps a race where the auto-kick effect
   * fires before any state hydration effect has run.
   */
  const doSyncNow = async (override?: string) => {
    if (blockedByDemo()) return;
    const wasOnboarded = useSettingsStore.getState().isOnboardingCompleted;
    try {
      const pw = override ?? (await getBackupPassword()) ?? "";
      const res = await triggerSync(pw);
      queryClient.invalidateQueries({ queryKey: ["backup", "status"] });
      await loadSettings();
      await refreshSyncState(); // pick up the new "Last synced" stamp

      // Drive has data locked with a password this device doesn't have — either the manifest
      // verifier rejected ours (res.wrongPassword, the authoritative signal) or the pull hit
      // files we couldn't open (res.needsPassphrase, the legacy pre-manifest case). Either way
      // the engine BLOCKED our push to keep the devices from drifting into separate encrypted
      // piles — nothing was backed up this run. Ask for the matching password; if they can't
      // produce it, "Forgot?" resets the cloud.
      if (res.wrongPassword || res.needsPassphrase) {
        setPassphraseLockedFiles(res.passphraseLockedFiles);
        setPwPrompt({
          onSubmit: async (entered) => {
            await setBackupPassword(entered);
            setPwPrompt(null);
            await doSyncNow(entered);
          },
        });
        return;
      }

      // This device has no password yet. Two very different situations look identical here,
      // and `vaultExists` (from the manifest) is what tells them apart:
      if (res.needsPasswordSetup) {
        if (res.vaultExists) {
          // A vault already exists on this Google account — the user must ENTER its password,
          // NOT set a new one (setting a new one is how a second device used to fork the vault).
          setPwPrompt({
            onSubmit: async (entered) => {
              await setBackupPassword(entered);
              setPwPrompt(null);
              await doSyncNow(entered);
            },
          });
          return;
        }
        // No vault anywhere — this device is starting one. Full-screen set flow: the one
        // moment that deserves the "save this, we can't recover it" warning to actually land.
        setShowSetPassword({
          onConfirm: async (chosen) => {
            await setBackupPassword(chosen);
            await repushInNewMode();
            setShowSetPassword(null);
            await doSyncNow(chosen);
          },
        });
        return;
      }

      if (!wasOnboarded && useSettingsStore.getState().isOnboardingCompleted) {
        setDialog({
          variant: "info",
          title: "Welcome back",
          message: "Your backup is restored and this device now stays in sync.",
          confirmLabel: "Go to Dashboard",
          onConfirm: () => { setDialog(null); router.replace("/"); },
        });
        return;
      }
      const plural = (n: number) => (n === 1 ? "" : "s");
      setDialog({
        variant: "info",
        title: "Synced",
        message:
          `Pulled ${res.pulledLogs} update${plural(res.pulledLogs)} · ` +
          `applied ${res.appliedRows}` +
          (res.auditedRows > 0 ? ` · ${res.auditedRows} money change${plural(res.auditedRows)} logged` : "") +
          `. ${res.pushed ? `Backed up ${res.pushedRows} row${plural(res.pushedRows)}.` : "Already up to date."}`,
      });
    } catch (e: any) {
      setDialog({ variant: "error", title: "Sync failed", message: e?.message ?? "Something went wrong." });
    }
  };

  // ── Backup file (offline copy) ───────────────────────────────────────────────
  const onExportFile = async () => {
    if (fileBusy) return;
    if (blockedByDemo()) return;
    setFileBusy("export");
    try {
      await exportBackupFile();
    } catch (e: any) {
      setDialog({ variant: "error", title: "Export failed", message: e?.message ?? "Something went wrong." });
    } finally {
      setFileBusy(null);
    }
  };

  const onRestoreFile = () => {
    if (blockedByDemo()) return;
    setDialog({
      variant: "info",
      title: "Restore from file?",
      message: "This replaces the data on this phone with the backup file's contents, and pauses Cloud Sync so the cloud can't immediately overwrite what you restored.",
      confirmLabel: "Choose file",
      confirmDanger: true,
      cancelLabel: "Cancel",
      onConfirm: async () => {
        setDialog(null);
        setFileBusy("restore");
        try {
          const res = await restoreBackupFile();
          if (!res.restored) return;
          suppressAutoEnable.current = true;
          setSyncEnabledState(false);
          queryClient.invalidateQueries();
          setDialog({
            variant: "info",
            title: "Backup restored",
            message: "Your data is back. Cloud Sync is paused — turn it back on to merge with your cloud copy.",
            confirmLabel: "Turn sync on",
            cancelLabel: "Keep paused",
            onConfirm: async () => {
              setDialog(null);
              suppressAutoEnable.current = false;
              setSyncEnabledState(true);
              await persistSyncEnabled(true);
            },
          });
        } catch (e: any) {
          setDialog({ variant: "error", title: "Restore failed", message: e?.message ?? "Something went wrong." });
        } finally {
          setFileBusy(null);
        }
      },
    });
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safe} edges={["bottom", "left", "right"]}>
      {/* Header — outside the ScrollView, so it takes the same cap as the content. */}
      <View style={[s.header, { paddingTop: insets.top + 10 }, columnStyle]}>
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={8}
          style={s.backBtn}
        >
          <ChevronLeft color={DS.textPrimary} size={20} />
        </TouchableOpacity>
        <View>
          <Text variant="headingM">Cloud Sync</Text>
          <Text variant="paragraphS" className="text-content-secondary" style={{ marginTop: 1 }}>
            Free · private on your Google Drive
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={[s.scroll, columnStyle]} showsVerticalScrollIndicator={false}>

        {/* ── Connection status card ── */}
        {!isAuthenticated ? (
          /* Not connected */
          <View style={[s.card, s.connectCard]}>
            <View style={[s.connectIconWrap, { borderColor: C.lineSubtle }]}>
              <GoogleDriveLogo size={28} />
            </View>
            <Text variant="headingS" style={{ textAlign: "center" }}>Connect Google Drive</Text>
            <Text variant="paragraphM" style={{ textAlign: "center" }}>
              Securely back up your data to your Google Account. Your GPS tracking data stays local on your phone.
            </Text>
            <TouchableOpacity
              onPress={onConnect}
              accessibilityRole="button"
              style={[s.connectBtn, { backgroundColor: accentColor }]}
            >
              <GoogleDriveLogo size={18} />
              <Text variant="labelL" style={{ color: accentColorContrast, marginLeft: 8 }}>Connect Google Drive</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* Connected */
          <View style={s.card}>
            {/* Connected header */}
            <View style={s.connectedHeader}>
              <View style={[s.connectedIconWrap, { backgroundColor: withAlpha(accentColor, 0.12), borderColor: withAlpha(accentColor, 0.25) }]}>
                <Check size={18} color={accentColor} strokeWidth={3} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="labelM">Connected to Google Drive</Text>
                <Text variant="paragraphS" className="text-content-secondary" style={{ marginTop: 2 }}>
                  {userEmail ?? "Signed in"}
                </Text>
              </View>
              <PillBtn
                label="Turn off"
                variant="danger"
                onPress={onDisconnect}
                accent={accentColor}
                accentDim={accentColorDim}
                accentMid={accentColorMid}
                accentContrast={accentColorContrast}
              />
            </View>

            {/* Sync status */}
            <View style={[s.syncRow, { borderTopColor: DS.sep }]}>
              <View style={[s.syncRowLeft, { flex: 1 }]}>
                <RefreshCw size={15} color={syncEnabled ? accentColor : DS.textSecondary} />
                <View style={{ flex: 1 }}>
                  <Text variant="paragraphS" className="text-content-secondary">
                    {syncEnabled ? "Syncing automatically" : "Sync paused"}
                  </Text>
                  <Text variant="paragraphS" className="text-content-muted">
                    {lastSyncAt > 0 ? `Last synced ${formatLastSync(lastSyncAt)}` : "Not synced from this phone yet"}
                  </Text>
                </View>
              </View>
              <PillBtn
                label={isSyncing ? "Syncing…" : "Sync now"}
                variant="primary"
                disabled={!syncEnabled || isSyncing}
                onPress={() => doSyncNow()}
                accent={accentColor}
                accentDim={accentColorDim}
                accentMid={accentColorMid}
                accentContrast={accentColorContrast}
              />
            </View>
          </View>
        )}

        {/* ── Advanced settings (collapsed) ── */}
        {isAuthenticated && (
          <>
            <TouchableOpacity
              onPress={() => setShowAdvanced((v) => !v)}
              accessibilityRole="button"
              style={s.advancedToggle}
            >
              <Text variant="labelXs" className="text-content-secondary">Advanced Settings</Text>
              {showAdvanced ? (
                <ChevronDown size={16} color={DS.textMuted} />
              ) : (
                <ChevronRight size={16} color={DS.textMuted} />
              )}
            </TouchableOpacity>

            {showAdvanced && (
              <View style={s.card}>
                {/* Auto-backup schedule */}
                <View style={s.advRow}>
                  <Text variant="paragraphS" className="text-content-secondary">Auto-backup schedule</Text>
                  <View style={s.segment}>
                    {SYNC_SCHEDULES.map((opt) => {
                      const active = schedule === opt;
                      return (
                        <TouchableOpacity
                          key={opt}
                          onPress={() => onPickSchedule(opt)}
                          disabled={!syncEnabled}
                          accessibilityRole="button"
                          accessibilityState={{ selected: active }}
                          style={[
                            s.segmentBtn,
                            active && { backgroundColor: accentColorDim, borderColor: accentColorMid },
                            !syncEnabled && { opacity: 0.4 },
                          ]}
                        >
                          <Text variant="labelM" style={{ color: active ? accentColor : DS.textSecondary }}>
                            {SCHEDULE_LABELS[opt]}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Change backup password — only meaningful once one is set */}
                {hasPassword ? (
                  <View style={[s.advRow, { borderTopColor: DS.sep }]}>
                    <View style={{ flex: 1 }}>
                      <Text variant="paragraphS" className="text-content-secondary">Backup password</Text>
                      <Text variant="paragraphS" className="text-content-muted" style={{ marginTop: 1 }}>
                        Change the password that protects your cloud backup
                      </Text>
                    </View>
                    <PillBtn
                      label="Change"
                      variant="ghost"
                      disabled={!syncEnabled}
                      onPress={changePassword}
                      accent={accentColor}
                      accentDim={accentColorDim}
                      accentMid={accentColorMid}
                      accentContrast={accentColorContrast}
                    />
                  </View>
                ) : null}
              </View>
            )}
          </>
        )}

        {/* ── Backup file (offline copy) ── */}
        <Text variant="labelXs" className="text-content-muted" style={s.groupLabel}>OFFLINE BACKUP FILE</Text>
        <View style={s.card}>
          <View style={s.stepRow}>
            <View style={[s.badge, { backgroundColor: DS.inputBg, borderColor: DS.inputBorder }]}>
              <FileDown size={15} color={DS.textSecondary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="labelM">Backup file</Text>
              <Text variant="paragraphS" className="text-content-secondary" style={s.stepSub}>
                An offline copy you keep yourself — save it to Files, Drive, or anywhere. Works without Google.
              </Text>
            </View>
          </View>

          <View style={[s.syncActionRow, { borderTopColor: DS.sep }]}>
            <Text variant="paragraphS" className="text-content-secondary" style={s.stepSub}>Download backup file</Text>
            <PillBtn
              label={fileBusy === "export" ? "Preparing…" : "Download"}
              variant="primary"
              disabled={!!fileBusy}
              onPress={onExportFile}
              accent={accentColor}
              accentDim={accentColorDim}
              accentMid={accentColorMid}
              accentContrast={accentColorContrast}
            />
          </View>

          <View style={[s.syncActionRow, { borderTopColor: DS.sep }]}>
            <Text variant="paragraphS" className="text-content-secondary" style={s.stepSub}>Restore from a backup file</Text>
            <PillBtn
              label={fileBusy === "restore" ? "Restoring…" : "Restore"}
              variant="ghost"
              disabled={!!fileBusy}
              onPress={onRestoreFile}
              accent={accentColor}
              accentDim={accentColorDim}
              accentMid={accentColorMid}
              accentContrast={accentColorContrast}
            />
          </View>
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>

      {pwPrompt ? (
        <PasswordPrompt
          accentColor={accentColor}
          accentColorContrast={accentColorContrast}
          onCancel={() => {
            // Declining leaves the mismatch unresolved — the engine held this device's push
            // (plans/008 Phase 0), so say so plainly rather than looking like a silent no-op.
            setPwPrompt(null);
            setDialog({
              variant: "info",
              title: "Backup paused",
              message:
                "This device won't back up until it can read your Drive data — otherwise your " +
                "devices would drift into separate copies. Tap Sync now and enter the password " +
                "when you have it.",
            });
          }}
          onSubmit={pwPrompt.onSubmit}
          onForgot={confirmForgotPassword}
        />
      ) : null}

      {showSetPassword ? (
        <SetBackupPasswordScreen
          accentColor={accentColor}
          accentColorContrast={accentColorContrast}
          onCancel={() => setShowSetPassword(null)}
          onConfirm={showSetPassword.onConfirm}
        />
      ) : null}

      {showForgotPassword ? (
        <ForgotPasswordScreen
          onCancel={() => setShowForgotPassword(false)}
          onConfirm={onForgotPasswordConfirmed}
        />
      ) : null}

      <FeedbackDialog
        visible={!!dialog}
        variant={dialog?.variant ?? "info"}
        title={dialog?.title ?? ""}
        message={dialog?.message}
        confirmLabel={dialog?.confirmLabel}
        confirmDanger={dialog?.confirmDanger}
        cancelLabel={dialog?.cancelLabel}
        onConfirm={dialog?.onConfirm}
        onClose={() => setDialog(null)}
        accentColor={accentColor}
      />

      <BusyOverlay
        visible={isSyncing}
        label="Syncing…"
        accentColor={accentColor}
      />
    </SafeAreaView>
  );
}

const makeStyles = (C: Palette) => {
  const DS = makeDS(C);
  return StyleSheet.create({
  safe: { flex: 1, backgroundColor: DS.pageBg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: DS.cardBorder,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: DS.inputBg,
    borderWidth: 0.5,
    borderColor: DS.inputBorder,
    alignItems: "center",
    justifyContent: "center",
  },

  scroll: { padding: 16, gap: 8 },

  card: {
    backgroundColor: DS.cardBg,
    borderWidth: 1,
    borderColor: DS.cardBorder,
    borderRadius: 16,
    padding: 16,
  },

  // ── Not-connected card ──
  connectCard: {
    alignItems: "center",
    gap: 12,
    paddingVertical: 28,
  },
  connectIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    backgroundColor: C.surface03,
    alignItems: "center",
    justifyContent: "center",
  },
  connectBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 14,
    marginTop: 4,
    alignSelf: "stretch",
  },

  // ── Connected card ──
  connectedHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  connectedIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  syncRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  syncRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  // ── Advanced ──
  advancedToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    paddingVertical: 10,
  },
  advRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingTop: 14,
    marginTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  segment: { flexDirection: "row", gap: 6 },
  segmentBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: DS.inputBg,
    borderColor: DS.inputBorder,
  },

  // ── Backup file ──
  groupLabel: {
    marginTop: 12,
    marginBottom: 4,
    marginLeft: 4,
  },
  stepRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  badge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  stepSub: { marginTop: 2 },
  pill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  syncActionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },

  // ── Password prompt ──
  overlay: {
    flex: 1,
    backgroundColor: C.scrim,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  dialogCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: C.surface03,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: C.lineStrong,
    padding: 22,
    gap: 12,
    alignItems: "center",
  },
  dialogIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  dialogInput: {
    alignSelf: "stretch",
    backgroundColor: DS.inputBg,
    borderWidth: 1,
    borderColor: DS.inputBorder,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: DS.textPrimary,
    fontSize: 15,
  },
  dialogRow: { flexDirection: "row", gap: 10, alignSelf: "stretch", marginTop: 4 },
  dialogBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: "center" },
  });
};
