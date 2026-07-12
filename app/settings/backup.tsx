/**
 * Backup & Restore — simplified "one-tap" hub screen.
 *
 * Sync activates the moment the user connects Google Drive — no password required.
 * End-to-End Encryption is an optional Advanced setting for power users.
 * Reached via /settings/backup.
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
  Switch,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
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
  clearBackupPassword,
  hasBackupPassword,
} from "@/src/services/backupPassword";
import { exportBackupFile, restoreBackupFile } from "@/src/services/backupFile";
import { FeedbackDialog, BusyOverlay, type FeedbackVariant } from "@/src/components/ui/FeedbackDialog";
import { GoogleDriveLogo } from "@/src/components/logos/GoogleDriveLogo";
import { E2EESetupScreen } from "@/src/components/sync/E2EESetupScreen";
import { COLORS, withAlpha } from "@/src/theme/colors";

// ─── Design tokens ────────────────────────────────────────────────────────────

const DS = {
  pageBg: COLORS.background,
  cardBg: COLORS.surface02,
  cardBorder: COLORS.lineSubtle,
  inputBg: COLORS.surface03,
  inputBorder: COLORS.lineStrong,
  sep: COLORS.lineSubtle,
  textPrimary: COLORS.contentPrimary,
  textSecondary: COLORS.contentSecondary,
  textMuted: COLORS.contentMuted,
} as const;

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

// ─── E2E Password prompt modal (advanced feature) ─────────────────────────────

function PasswordPrompt({
  mode,
  accentColor,
  accentColorContrast,
  onCancel,
  onSubmit,
}: {
  mode: "set" | "enter";
  accentColor: string;
  accentColorContrast: string;
  onCancel: () => void;
  onSubmit: (pw: string) => void;
}) {
  const isSet = mode === "set";
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");

  const submit = () => {
    if (pw.length < MIN_PW) {
      setErr(`Use at least ${MIN_PW} characters.`);
      return;
    }
    if (isSet && pw !== confirm) {
      setErr("Passwords don't match.");
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
          <Text variant="headingS" style={{ textAlign: "center" }}>
            {isSet ? "Set encryption password" : "Enter encryption password"}
          </Text>
          <Text variant="paragraphM" style={{ textAlign: "center" }}>
            {isSet
              ? "This password encrypts your backup data end-to-end. You'll need it to restore on a new device. If you lose it, the backup can't be recovered."
              : "Enter the password you used when enabling E2E encryption."}
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
          {isSet ? (
            <TextInput
              style={s.dialogInput}
              value={confirm}
              onChangeText={(v) => { setConfirm(v); setErr(""); }}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="Confirm password"
              placeholderTextColor={DS.textMuted}
            />
          ) : null}
          {err ? <Text variant="paragraphS" className="text-destructive" style={{ alignSelf: "flex-start" }}>{err}</Text> : null}

          <View style={s.dialogRow}>
            <TouchableOpacity
              onPress={onCancel}
              accessibilityRole="button"
              style={[s.dialogBtn, { backgroundColor: COLORS.surface04 }]}
            >
              <Text variant="labelM" className="text-content-secondary">Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={submit}
              accessibilityRole="button"
              style={[s.dialogBtn, { backgroundColor: accentColor }]}
            >
              <Text variant="labelM" style={{ color: accentColorContrast }}>{isSet ? "Save" : "Unlock"}</Text>
            </TouchableOpacity>
          </View>
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
  const styleByVariant = {
    ghost: { bg: DS.inputBg, border: DS.inputBorder, text: DS.textSecondary },
    primary: { bg: accentDim, border: accentMid, text: accent },
    danger: { bg: withAlpha(COLORS.destructive, 0.12), border: withAlpha(COLORS.destructive, 0.25), text: COLORS.destructive },
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
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { accentColor, accentColorDim, accentColorMid, accentColorContrast } = usePlatformTheme();
  const isDemoMode = useSettingsStore((st) => st.isDemoMode);
  const loadSettings = useSettingsStore((st) => st.loadSettings);
  const { isAuthenticated, userEmail, login, logout } = useGoogleDriveSync();
  const { isSyncing, triggerSync } = useSyncNow();

  const [schedule, setScheduleState] = useState<SyncSchedule>(DEFAULT_SCHEDULE);
  const [syncEnabled, setSyncEnabledState] = useState(false);
  const [e2eEnabled, setE2eEnabled] = useState(false);       // Advanced: E2E encryption
  const [showE2eSetup, setShowE2eSetup] = useState(false);   // Full-screen enable flow
  const [showAdvanced, setShowAdvanced] = useState(false);   // Collapsed by default
  const [pwPrompt, setPwPrompt] = useState<null | { mode: "set" | "enter"; onSubmit: (pw: string) => void }>(null);
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
    // The stored password IS the mode: present → E2E on, absent → plain one-tap.
    setE2eEnabled(await hasBackupPassword());
    setLastSyncAt(await getLastPushRunAt());
  };

  useEffect(() => {
    refreshSyncState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-enable sync as soon as Drive is connected (no password required).
  // Only skip if demo mode is on or a file-restore just happened.
  useEffect(() => {
    if (isAuthenticated && !syncEnabled && !suppressAutoEnable.current && !isDemoMode) {
      setSyncEnabledState(true);
      persistSyncEnabled(true).catch(() => setSyncEnabledState(false));
    }
  }, [isAuthenticated, syncEnabled, isDemoMode]);

  // On a joining device that hasn't completed onboarding: auto-kick a sync once Drive connects.
  const restoreKicked = useRef(false);
  useEffect(() => {
    if (!isAuthenticated || !syncEnabled || isDemoMode || restoreKicked.current) return;
    if (useSettingsStore.getState().isOnboardingCompleted) return;
    restoreKicked.current = true;
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
   * Switching encryption mode changes the format of every file we write. Rewind the push
   * cursor to 0 so the very next push re-uploads this device's FULL state in the new mode —
   * otherwise the cloud keeps only old-mode files plus a thin new-mode delta, and a device
   * without the password can never reconstruct the history.
   */
  const repushInNewMode = async () => {
    await setLastPushedAt(0);
  };

  /** Commit the password chosen in the full-screen E2EE flow. */
  const onE2eConfirmed = async (pw: string) => {
    await setBackupPassword(pw);
    await repushInNewMode();
    setE2eEnabled(true);
    setShowE2eSetup(false);
    setDialog({
      variant: "success",
      title: "Encryption is on",
      message:
        "Your data is now encrypted on this phone before it reaches Google Drive.\n\n" +
        "Enter this same password on your other devices to keep them syncing. " +
        "If you lose it, the backup cannot be recovered by anyone.",
    });
  };

  const onToggleE2E = async (enable: boolean) => {
    if (enable) {
      // Full-screen takeover, not a dialog: this is the one action that can make the user's
      // data permanently unrecoverable, so the risk must be read and explicitly acknowledged
      // before a password can even be typed. See E2EESetupScreen.
      setShowE2eSetup(true);
    } else {
      setDialog({
        variant: "info",
        title: "Turn off encryption?",
        message:
          "Your data stays private — only your Google Account can reach it — but it will no longer be encrypted with your password.\n\n" +
          "Files already saved with the old password stay encrypted. Keep the password if you want other devices to read them.",
        confirmLabel: "Turn off",
        confirmDanger: true,
        cancelLabel: "Cancel",
        onConfirm: async () => {
          // clearBackupPassword, NOT setBackupPassword("") — an empty string is still a
          // stored value, so hasBackupPassword() would stay true and the toggle would
          // silently flip itself back on at the next mount.
          await clearBackupPassword();
          await repushInNewMode();
          setE2eEnabled(false);
          setDialog(null);
        },
      });
    }
  };

  /**
   * Run one sync. `override` lets the "enter your encryption password" prompt retry
   * immediately with the password the user just typed, without waiting for React state.
   *
   * The stored password IS the mode: present → E2E, absent → plain (one-tap). Reading it
   * from SecureStore at call time rather than from the `e2eEnabled` state variable also
   * fixes a race — the auto-restore kick below can fire before the effect that hydrates
   * `e2eEnabled`, which would have synced an E2E user with an empty password.
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

      // Some files on Drive are E2E-encrypted and we couldn't open them. Everything else
      // synced fine — ask for the password and re-run to pick up the rest.
      if (res.needsPassphrase) {
        setPwPrompt({
          mode: "enter",
          onSubmit: async (entered) => {
            await setBackupPassword(entered);
            setE2eEnabled(true);
            setPwPrompt(null);
            await doSyncNow(entered);
          },
        });
        return;
      }

      if (!wasOnboarded && useSettingsStore.getState().isOnboardingCompleted) {
        setDialog({
          variant: "success",
          title: "Welcome back",
          message: "Your backup is restored and this device now stays in sync.",
          confirmLabel: "Go to Dashboard",
          onConfirm: () => { setDialog(null); router.replace("/"); },
        });
        return;
      }
      const plural = (n: number) => (n === 1 ? "" : "s");
      setDialog({
        variant: "success",
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
    setFileBusy("export");
    try {
      await exportBackupFile();
    } catch (e: any) {
      setDialog({ variant: "error", title: "Export failed", message: e?.message ?? "Something went wrong." });
    } finally {
      setFileBusy(null);
    }
  };

  const onRestoreFile = () =>
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
            variant: "success",
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

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safe} edges={["bottom", "left", "right"]}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 10 }]}>
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

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Connection status card ── */}
        {!isAuthenticated ? (
          /* Not connected */
          <View style={[s.card, s.connectCard]}>
            <View style={[s.connectIconWrap, { borderColor: COLORS.lineSubtle }]}>
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
                onPress={doSyncNow}
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

                {/* E2E Encryption toggle */}
                <View style={[s.advRow, { borderTopColor: DS.sep }]}>
                  <View style={{ flex: 1 }}>
                    <Text variant="labelM">End-to-End Encryption</Text>
                    <Text variant="paragraphS" className="text-content-secondary" style={{ marginTop: 2 }}>
                      {e2eEnabled
                        ? "On — data is encrypted with your password before leaving your device."
                        : "Off — data is protected by your Google Account (same as Google Drive)."}
                    </Text>
                  </View>
                  <Switch
                    value={e2eEnabled}
                    onValueChange={onToggleE2E}
                    trackColor={{ false: COLORS.surface04, true: accentColorMid }}
                    thumbColor={e2eEnabled ? accentColor : DS.textMuted}
                  />
                </View>
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

      {/* Turning E2EE ON is a full-screen, must-acknowledge flow — losing this password is
          the only unrecoverable action in the app. Entering an EXISTING password (the
          needsPassphrase prompt) stays a lightweight modal: no risk, just a key. */}
      {showE2eSetup ? (
        <E2EESetupScreen
          accentColor={accentColor}
          accentColorContrast={accentColorContrast}
          onCancel={() => setShowE2eSetup(false)}
          onConfirm={onE2eConfirmed}
        />
      ) : null}

      {pwPrompt ? (
        <PasswordPrompt
          key={pwPrompt.mode}
          mode={pwPrompt.mode}
          accentColor={accentColor}
          accentColorContrast={accentColorContrast}
          onCancel={() => setPwPrompt(null)}
          onSubmit={pwPrompt.onSubmit}
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

const s = StyleSheet.create({
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
    backgroundColor: COLORS.surface03,
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
    backgroundColor: COLORS.scrim,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  dialogCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: COLORS.surface03,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: COLORS.lineStrong,
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
