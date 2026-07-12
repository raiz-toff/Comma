/**
 * Backup & Restore — guided hub screen.
 *
 * Replaces the cramped "Cloud Backup" card that used to live inside Settings → Data.
 * Walks the user through three clear steps (Connect → Password → Back up) that unlock
 * in order, then lists existing backups to restore. Reached via /settings/backup.
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
import { Text } from "@/src/components/ui/text";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import {
  ChevronLeft,
  Check,
  FileDown,
  KeyRound,
  Lock,
  RefreshCw,
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
import { FeedbackDialog, BusyOverlay, type FeedbackVariant } from "@/src/components/ui/FeedbackDialog";
import { GoogleDriveLogo } from "@/src/components/logos/GoogleDriveLogo";
import { COLORS, withAlpha } from "@/src/theme/colors";

// ─── Design tokens (match Settings) ───────────────────────────────────────────

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
  textLabel: COLORS.contentMuted,
} as const;

const MIN_PW = 6;

// ─── Password prompt modal ────────────────────────────────────────────────────

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
            <KeyRound size={24} color={accentColor} />
          </View>
          <Text variant="headingS" style={{ textAlign: "center" }}>{isSet ? "Set backup password" : "Enter backup password"}</Text>
          <Text variant="paragraphM" style={{ textAlign: "center" }}>
            {isSet
              ? "This password encrypts your backup. You'll need it to restore — even on a new phone. If you lose it, the backup can't be recovered."
              : "Enter the password you used when this backup was created."}
          </Text>

          <TextInput
            style={s.dialogInput}
            value={pw}
            onChangeText={(v) => {
              setPw(v);
              setErr("");
            }}
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
              onChangeText={(v) => {
                setConfirm(v);
                setErr("");
              }}
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
              <Text variant="labelM" style={{ color: accentColorContrast }}>{isSet ? "Save" : "Restore"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Step card ────────────────────────────────────────────────────────────────

function Step({
  index,
  done,
  locked,
  title,
  subtitle,
  accentColor,
  accentColorDim,
  accentColorMid,
  right,
}: {
  index: number;
  done: boolean;
  locked?: boolean;
  title: string;
  subtitle?: string;
  accentColor: string;
  accentColorDim: string;
  accentColorMid: string;
  right?: React.ReactNode;
}) {
  return (
    <View style={[s.card, locked && { opacity: 0.5 }]}>
      <View style={s.stepRow}>
        <View
          style={[
            s.badge,
            done
              ? { backgroundColor: accentColorDim, borderColor: accentColorMid }
              : { backgroundColor: DS.inputBg, borderColor: DS.inputBorder },
          ]}
        >
          {done ? (
            <Check size={16} color={accentColor} strokeWidth={3} />
          ) : locked ? (
            <Lock size={14} color={DS.textSecondary} />
          ) : (
            <Text variant="labelM" style={{ color: DS.textSecondary }}>{index}</Text>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="labelM">{title}</Text>
          {subtitle ? <Text variant="paragraphS" className="text-content-secondary" style={s.stepSub}>{subtitle}</Text> : null}
        </View>
        {right ? <View style={{ marginLeft: 8 }}>{right}</View> : null}
      </View>
    </View>
  );
}

// ─── Small button ─────────────────────────────────────────────────────────────

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
      style={[
        s.pill,
        { backgroundColor: styleByVariant.bg, borderColor: styleByVariant.border, opacity: disabled ? 0.4 : 1 },
      ]}
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
  const [syncEnabled, setSyncEnabledState] = useState(false);
  const [schedule, setScheduleState] = useState<SyncSchedule>(DEFAULT_SCHEDULE);
  const [passwordSet, setPasswordSet] = useState(false);
  const [pwPrompt, setPwPrompt] = useState<null | { mode: "set" | "enter"; onSubmit: (pw: string) => void }>(null);
  const [fileBusy, setFileBusy] = useState<null | "export" | "restore">(null);
  // After a file restore, sync is deliberately OFF (fresh device id) — hold the auto-enable
  // effect below until the user opts back in, so the cloud can't instantly re-fill/overwrite
  // what was just restored.
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

  useEffect(() => {
    (async () => {
      setPasswordSet(await hasBackupPassword());
      setSyncEnabledState(await isSyncEnabled());
      setScheduleState(await getSyncSchedule());
    })();
  }, []);

  const ready = isAuthenticated && passwordSet;

  // Demo mode uses seeded sample data — connecting Drive or syncing would push that fake
  // data to the user's real cloud copy, so we block both entry points and point the user
  // to Settings to leave demo mode first.
  const blockedByDemo = () => {
    if (!isDemoMode) return false;
    setDialog({
      variant: "info",
      title: "Demo Mode Active",
      message: "Cloud Sync and Google Drive are disabled while Demo Mode is on, so your sample data isn't backed up. Turn off Demo Mode in Settings to sync your real data.",
      confirmLabel: "Go to Settings",
      cancelLabel: "Cancel",
      onConfirm: () => {
        setDialog(null);
        router.push("/settings");
      },
    });
    return true;
  };

  // "Connect then done": once Drive is connected AND a password is set, Cloud Sync turns
  // itself on — no extra switch to flip. Sync is free for everyone (no paywall).
  // Never auto-enable in demo mode — the seeded data must not reach the user's cloud.
  useEffect(() => {
    if (ready && !syncEnabled && !suppressAutoEnable.current && !isDemoMode) {
      setSyncEnabledState(true);
      persistSyncEnabled(true).catch(() => setSyncEnabledState(false));
    }
  }, [ready, syncEnabled, isDemoMode]);

  // Onboarding restore (issue #11): a user who reaches this screen BEFORE completing
  // onboarding came to pull an existing backup — run the sync the moment everything is
  // ready instead of leaving them to find "Sync now"; doSyncNow then redirects to the
  // dashboard once the imported profile completes onboarding. Fires on ANY ready state,
  // not just the auto-enable transition above, because password + sync-enabled may
  // already be persisted from an earlier session. One-shot per mount (ref, not state) so
  // a failed sync doesn't loop — the user can retry via "Sync now".
  const restoreKicked = useRef(false);
  useEffect(() => {
    if (!ready || !syncEnabled || isDemoMode || restoreKicked.current) return;
    if (useSettingsStore.getState().isOnboardingCompleted) return;
    restoreKicked.current = true;
    doSyncNow();
    // doSyncNow is recreated every render; this effect must only react to readiness.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, syncEnabled, isDemoMode]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const onConnect = () => {
    if (blockedByDemo()) return;
    login();
  };
  const openSetPassword = () =>
    setPwPrompt({
      mode: "set",
      onSubmit: async (pw) => {
        await setBackupPassword(pw);
        setPasswordSet(true);
        setPwPrompt(null);
        setDialog({
          variant: "success",
          title: "Password saved",
          message: "Keep this safe — you'll need the same password to unlock your data on another device.",
        });
      },
    });

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
    setScheduleState(next); // optimistic
    try {
      await persistSyncSchedule(next);
    } catch {
      setScheduleState(prev); // revert on failure
    }
  };

  const doSyncNow = async () => {
    if (blockedByDemo()) return;
    const pw = await getBackupPassword();
    if (!pw) {
      openSetPassword();
      return;
    }
    const wasOnboarded = useSettingsStore.getState().isOnboardingCompleted;
    try {
      const res = await triggerSync(pw);
      queryClient.invalidateQueries({ queryKey: ["backup", "status"] });
      // The pull may have applied synced PROFILE keys (name, country, onboarding flag…) —
      // re-hydrate the store so the app (and a joining device's onboarding gate) reflects it.
      await loadSettings();
      // This sync just restored a cloud backup that completed onboarding — take the user
      // straight to their dashboard instead of stranding them on this screen (issue #11).
      if (!wasOnboarded && useSettingsStore.getState().isOnboardingCompleted) {
        setDialog({
          variant: "success",
          title: "Welcome back",
          message: "Your backup is restored and this device now stays in sync.",
          confirmLabel: "Go to Dashboard",
          onConfirm: () => {
            setDialog(null);
            router.replace("/");
          },
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

  // ── Backup file (offline copy the user keeps themselves) ─────────────────────
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
      message:
        "This replaces the data on this phone with the backup file's contents, and pauses Cloud Sync so the cloud can't immediately overwrite what you restored.",
      confirmLabel: "Choose file",
      confirmDanger: true,
      cancelLabel: "Cancel",
      onConfirm: async () => {
        setDialog(null);
        setFileBusy("restore");
        try {
          const res = await restoreBackupFile();
          if (!res.restored) return; // picker cancelled
          // restoreBackupFile re-minted the device id and turned sync OFF — keep it off on
          // this screen too until the user opts back in.
          suppressAutoEnable.current = true;
          setSyncEnabledState(false);
          queryClient.invalidateQueries();
          setDialog({
            variant: "success",
            title: "Backup restored",
            message:
              "Your data is back. Cloud Sync is paused — turn it back on to merge with your cloud copy (newer cloud edits win conflicts).",
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

  // ── Render ──────────────────────────────────────────────────────────────────
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
          <Text variant="paragraphS" className="text-content-secondary" style={{ marginTop: 1 }}>Free · encrypted on your Google Drive</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Intro */}
        <View style={[s.card, s.intro]}>
          <View style={[s.introIcon, { backgroundColor: COLORS.surface03, borderColor: COLORS.lineSubtle }]}>
            <GoogleDriveLogo size={26} />
          </View>
          <Text variant="headingS">One feature. Backup and sync.</Text>
          <Text variant="paragraphM" style={{ textAlign: "center" }}>
            Connect Google Drive and you're done. On a single device your data is safely backed up; sign in on
            another and everything stays in sync — automatically, encrypted, only readable by you.
          </Text>
        </View>

        {/* Step 1 — Connect */}
        <Text variant="labelXs" className="text-content-muted" style={s.groupLabel}>STEP 1</Text>
        <Step
          index={1}
          done={isAuthenticated}
          title={isAuthenticated ? "Google Drive connected" : "Connect Google Drive"}
          subtitle={isAuthenticated ? userEmail ?? "Signed in" : "Sign in to store your data"}
          accentColor={accentColor}
          accentColorDim={accentColorDim}
          accentColorMid={accentColorMid}
          right={
            isAuthenticated ? (
              <PillBtn label="Turn off" variant="danger" onPress={onDisconnect}
                accent={accentColor} accentDim={accentColorDim} accentMid={accentColorMid} accentContrast={accentColorContrast} />
            ) : (
              <PillBtn label="Connect" variant="primary" onPress={onConnect}
                accent={accentColor} accentDim={accentColorDim} accentMid={accentColorMid} accentContrast={accentColorContrast} />
            )
          }
        />

        {/* Step 2 — Password */}
        <Text variant="labelXs" className="text-content-muted" style={s.groupLabel}>STEP 2</Text>
        <Step
          index={2}
          done={passwordSet}
          title="Sync password"
          subtitle={passwordSet ? "Set — unlocks your data on a new device" : "Encrypts your data; needed to unlock it on another device"}
          accentColor={accentColor}
          accentColorDim={accentColorDim}
          accentColorMid={accentColorMid}
          right={
            <PillBtn label={passwordSet ? "Change" : "Set"} variant={passwordSet ? "ghost" : "primary"} onPress={openSetPassword}
              accent={accentColor} accentDim={accentColorDim} accentMid={accentColorMid} accentContrast={accentColorContrast} />
          }
        />

        {/* Cloud Sync status + controls (auto-on once steps 1 & 2 are done) */}
        <Text variant="labelXs" className="text-content-muted" style={s.groupLabel}>CLOUD SYNC</Text>
        <View style={s.card}>
          <View style={s.stepRow}>
            <View style={[s.badge, { backgroundColor: DS.inputBg, borderColor: DS.inputBorder }]}>
              <RefreshCw size={15} color={ready && syncEnabled ? accentColor : DS.textSecondary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="labelM">
                {ready && syncEnabled ? "Cloud Sync is on" : "Cloud Sync is off"}
              </Text>
              <Text variant="paragraphS" className="text-content-secondary" style={s.stepSub}>
                {!isAuthenticated
                  ? "Connect Google Drive to turn it on."
                  : !passwordSet
                  ? "Set a sync password to turn it on."
                  : "Pulls updates when you open the app and backs up on your schedule."}
              </Text>
            </View>
          </View>

          {/* Auto-back-up cadence (WhatsApp-style). Pull always happens on app open. */}
          <View style={[s.syncSchedRow, { borderTopColor: DS.sep }]}>
            <Text variant="paragraphS" className="text-content-secondary" style={s.stepSub}>Auto-back up</Text>
            <View style={s.segment}>
              {SYNC_SCHEDULES.map((opt) => {
                const active = schedule === opt;
                return (
                  <TouchableOpacity
                    key={opt}
                    onPress={() => onPickSchedule(opt)}
                    disabled={!ready || !syncEnabled}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active, disabled: !ready || !syncEnabled }}
                    style={[
                      s.segmentBtn,
                      active && { backgroundColor: accentColorDim, borderColor: accentColorMid },
                      (!ready || !syncEnabled) && { opacity: 0.4 },
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

          <View style={[s.syncActionRow, { borderTopColor: DS.sep }]}>
            <Text variant="paragraphS" className="text-content-secondary" style={s.stepSub}>
              {ready && syncEnabled ? "Sync right now" : "Finish steps 1 & 2 first"}
            </Text>
            <PillBtn
              label={isSyncing ? "Syncing…" : "Sync now"}
              variant="primary"
              disabled={!ready || !syncEnabled || isSyncing}
              onPress={doSyncNow}
              accent={accentColor}
              accentDim={accentColorDim}
              accentMid={accentColorMid}
              accentContrast={accentColorContrast}
            />
          </View>
        </View>

        {/* Backup file — offline copy you keep yourself (works without Google) */}
        <Text variant="labelXs" className="text-content-muted" style={s.groupLabel}>BACKUP FILE</Text>
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

  intro: { alignItems: "center", gap: 8, paddingVertical: 20, marginBottom: 4 },
  introIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

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

  syncSchedRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 0.5,
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
  syncActionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 0.5,
  },

  // Password prompt
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
