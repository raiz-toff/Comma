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
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Modal,
  StyleSheet,
} from "react-native";
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

// ─── Design tokens (match Settings) ───────────────────────────────────────────

const DS = {
  pageBg: "#000",
  cardBg: "#0F0F12",
  cardBorder: "#1E1E23",
  inputBg: "#16161A",
  inputBorder: "#2E2E36",
  sep: "#1E1E23",
  textPrimary: "#F6F6F7",
  textSecondary: "#65656E",
  textMuted: "#2E2E36",
  textLabel: "#48473f",
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
      <View style={s.overlay}>
        <View style={s.dialogCard}>
          <View style={[s.dialogIcon, { backgroundColor: accentColor + "1f", borderColor: accentColor + "40" }]}>
            <KeyRound size={24} color={accentColor} />
          </View>
          <Text style={s.dialogTitle}>{isSet ? "Set backup password" : "Enter backup password"}</Text>
          <Text style={s.dialogMsg}>
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
          {err ? <Text style={s.dialogErr}>{err}</Text> : null}

          <View style={s.dialogRow}>
            <TouchableOpacity onPress={onCancel} style={[s.dialogBtn, { backgroundColor: "#1C1C21" }]}>
              <Text style={s.dialogBtnNeutral}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={submit} style={[s.dialogBtn, { backgroundColor: accentColor }]}>
              <Text style={[s.dialogBtnPrimary, { color: accentColorContrast }]}>{isSet ? "Save" : "Restore"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
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
            <Text style={[s.badgeNum, { color: DS.textSecondary }]}>{index}</Text>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.stepTitle}>{title}</Text>
          {subtitle ? <Text style={s.stepSub}>{subtitle}</Text> : null}
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
    danger: { bg: "rgba(244,63,94,0.07)", border: "rgba(244,63,94,0.22)", text: "#fb7185" },
  }[variant];
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[
        s.pill,
        { backgroundColor: styleByVariant.bg, borderColor: styleByVariant.border, opacity: disabled ? 0.4 : 1 },
      ]}
    >
      <Text style={[s.pillText, { color: styleByVariant.text }]}>{label}</Text>
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
    try {
      const res = await triggerSync(pw);
      queryClient.invalidateQueries({ queryKey: ["backup", "status"] });
      // The pull may have applied synced PROFILE keys (name, country, onboarding flag…) —
      // re-hydrate the store so the app (and a joining device's onboarding gate) reflects it.
      await loadSettings();
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
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <ChevronLeft color={DS.textPrimary} size={20} />
        </TouchableOpacity>
        <View>
          <Text style={s.headerTitle}>Cloud Sync</Text>
          <Text style={s.headerSub}>Free · encrypted on your Google Drive</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Intro */}
        <View style={[s.card, s.intro]}>
          <View style={[s.introIcon, { backgroundColor: "#16161A", borderColor: "#1E1E23" }]}>
            <GoogleDriveLogo size={26} />
          </View>
          <Text style={s.introTitle}>One feature. Backup and sync.</Text>
          <Text style={s.introText}>
            Connect Google Drive and you're done. On a single device your data is safely backed up; sign in on
            another and everything stays in sync — automatically, encrypted, only readable by you.
          </Text>
        </View>

        {/* Step 1 — Connect */}
        <Text style={s.groupLabel}>STEP 1</Text>
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
        <Text style={s.groupLabel}>STEP 2</Text>
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
        <Text style={s.groupLabel}>CLOUD SYNC</Text>
        <View style={s.card}>
          <View style={s.stepRow}>
            <View style={[s.badge, { backgroundColor: DS.inputBg, borderColor: DS.inputBorder }]}>
              <RefreshCw size={15} color={ready && syncEnabled ? accentColor : DS.textSecondary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.stepTitle}>
                {ready && syncEnabled ? "Cloud Sync is on" : "Cloud Sync is off"}
              </Text>
              <Text style={s.stepSub}>
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
            <Text style={s.stepSub}>Auto-back up</Text>
            <View style={s.segment}>
              {SYNC_SCHEDULES.map((opt) => {
                const active = schedule === opt;
                return (
                  <TouchableOpacity
                    key={opt}
                    onPress={() => onPickSchedule(opt)}
                    disabled={!ready || !syncEnabled}
                    style={[
                      s.segmentBtn,
                      active && { backgroundColor: accentColorDim, borderColor: accentColorMid },
                      (!ready || !syncEnabled) && { opacity: 0.4 },
                    ]}
                  >
                    <Text style={[s.segmentText, { color: active ? accentColor : DS.textSecondary }]}>
                      {SCHEDULE_LABELS[opt]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={[s.syncActionRow, { borderTopColor: DS.sep }]}>
            <Text style={s.stepSub}>
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
        <Text style={s.groupLabel}>BACKUP FILE</Text>
        <View style={s.card}>
          <View style={s.stepRow}>
            <View style={[s.badge, { backgroundColor: DS.inputBg, borderColor: DS.inputBorder }]}>
              <FileDown size={15} color={DS.textSecondary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.stepTitle}>Backup file</Text>
              <Text style={s.stepSub}>
                An offline copy you keep yourself — save it to Files, Drive, or anywhere. Works without Google.
              </Text>
            </View>
          </View>

          <View style={[s.syncActionRow, { borderTopColor: DS.sep }]}>
            <Text style={s.stepSub}>Download backup file</Text>
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
            <Text style={s.stepSub}>Restore from a backup file</Text>
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
    borderRadius: 10,
    backgroundColor: DS.inputBg,
    borderWidth: 0.5,
    borderColor: DS.inputBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { color: DS.textPrimary, fontSize: 18, fontWeight: "800" },
  headerSub: { color: DS.textSecondary, fontSize: 12, fontWeight: "500", marginTop: 1 },

  scroll: { padding: 16, gap: 8 },

  card: {
    backgroundColor: DS.cardBg,
    borderWidth: 1,
    borderColor: DS.cardBorder,
    borderRadius: 18,
    padding: 15,
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
  introTitle: { color: DS.textPrimary, fontSize: 16, fontWeight: "800" },
  introText: { color: DS.textSecondary, fontSize: 13, lineHeight: 19, textAlign: "center" },

  groupLabel: {
    color: DS.textLabel,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
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
  badgeNum: { fontSize: 13, fontWeight: "800" },
  stepTitle: { color: DS.textPrimary, fontSize: 14, fontWeight: "700" },
  stepSub: { color: DS.textSecondary, fontSize: 12, marginTop: 2, lineHeight: 16 },

  pill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  pillText: { fontSize: 13, fontWeight: "700" },

  emptyWrap: { alignItems: "center", gap: 8, paddingVertical: 14 },
  emptyText: { color: DS.textSecondary, fontSize: 12, fontStyle: "italic", textAlign: "center" },

  backupRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12 },
  rowDivider: { borderBottomWidth: 0.5, borderBottomColor: DS.sep },
  backupDate: { color: DS.textPrimary, fontSize: 13, fontWeight: "600" },
  backupAgo: { color: DS.textSecondary, fontSize: 11, marginTop: 2 },

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
    borderRadius: 9,
    borderWidth: 1,
    backgroundColor: DS.inputBg,
    borderColor: DS.inputBorder,
  },
  segmentText: { fontSize: 12, fontWeight: "700" },
  syncActionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 0.5,
  },
  restoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: DS.inputBg,
    borderWidth: 1,
    borderColor: DS.inputBorder,
  },
  restoreText: { color: DS.textSecondary, fontSize: 13, fontWeight: "700" },

  // Password prompt
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  dialogCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#1a1916",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#2E2E36",
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
  dialogTitle: { fontSize: 17, fontWeight: "800", color: "#F6F6F7", textAlign: "center" },
  dialogMsg: { fontSize: 13, fontWeight: "500", color: "#9B9BA4", textAlign: "center", lineHeight: 19 },
  dialogInput: {
    alignSelf: "stretch",
    backgroundColor: DS.inputBg,
    borderWidth: 1,
    borderColor: DS.inputBorder,
    borderRadius: 11,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: DS.textPrimary,
    fontSize: 15,
  },
  dialogErr: { color: "#fb7185", fontSize: 12, fontWeight: "600", alignSelf: "flex-start" },
  dialogRow: { flexDirection: "row", gap: 10, alignSelf: "stretch", marginTop: 4 },
  dialogBtn: { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: "center" },
  dialogBtnNeutral: { color: "#9B9BA4", fontWeight: "700", fontSize: 14 },
  dialogBtnPrimary: { fontWeight: "800", fontSize: 14 },
});
