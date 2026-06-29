/**
 * Backup & Restore — guided hub screen.
 *
 * Replaces the cramped "Cloud Backup" card that used to live inside Settings → Data.
 * Walks the user through three clear steps (Connect → Password → Back up) that unlock
 * in order, then lists existing backups to restore. Reached via /settings/backup.
 */

import React, { useEffect, useState } from "react";
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
  KeyRound,
  UploadCloud,
  RotateCcw,
  Lock,
} from "lucide-react-native";

import { usePlatformTheme } from "@/src/hooks/usePlatformTheme";
import { useGoogleDriveSync } from "@/hooks/useGoogleDriveSync";
import {
  getBackupPassword,
  setBackupPassword,
  hasBackupPassword,
} from "@/src/services/backupPassword";
import type { DriveBackupFile } from "@/src/services/googleDrive";
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso?: string): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (isNaN(then)) return "";
  const sec = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr${hr > 1 ? "s" : ""} ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day} day${day > 1 ? "s" : ""} ago`;
  return new Date(iso).toLocaleDateString();
}

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

export default function BackupScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { accentColor, accentColorDim, accentColorMid, accentColorContrast } = usePlatformTheme();
  const {
    isAuthenticated,
    userEmail,
    isBackingUp,
    isRestoring,
    backups,
    backupsError,
    login,
    logout,
    triggerBackup,
    triggerRestore,
  } = useGoogleDriveSync();

  const [passwordSet, setPasswordSet] = useState(false);
  const [pwPrompt, setPwPrompt] = useState<null | { mode: "set" | "enter"; onSubmit: (pw: string) => void }>(null);
  const [dialog, setDialog] = useState<null | {
    variant: FeedbackVariant;
    title: string;
    message?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm?: () => void;
  }>(null);

  useEffect(() => {
    (async () => setPasswordSet(await hasBackupPassword()))();
  }, []);

  const ready = isAuthenticated && passwordSet;
  const lastBackupTime = backups[0]?.createdTime;

  // ── Actions ───────────────────────────────────────────────────────────────
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
          message: "Use this same password to restore on another device.",
        });
      },
    });

  const doBackup = async () => {
    const pw = await getBackupPassword();
    if (!pw) {
      openSetPassword();
      return;
    }
    try {
      await triggerBackup(pw);
      // Clear the Dashboard "back up your data" reminder immediately.
      queryClient.invalidateQueries({ queryKey: ["backup", "status"] });
      setDialog({ variant: "success", title: "Backup complete", message: "Your data is safely backed up to Google Drive." });
    } catch (e: any) {
      setDialog({ variant: "error", title: "Backup failed", message: e?.message ?? "Something went wrong." });
    }
  };

  const runRestore = async (file: DriveBackupFile, pw: string) => {
    try {
      await triggerRestore(file.id, pw);
      await setBackupPassword(pw); // remember on this device for next time
      setPasswordSet(true);
      setDialog({ variant: "success", title: "Restore complete", message: "Your data was restored from this backup." });
    } catch (e: any) {
      setDialog({
        variant: "error",
        title: "Restore failed",
        message: e?.message ?? "Couldn't restore — check your backup password.",
      });
    }
  };

  const onRestorePress = (file: DriveBackupFile) =>
    setDialog({
      variant: "info",
      title: "Restore this backup?",
      message: "This replaces all data on this device with the contents of this backup. It can't be undone.",
      confirmLabel: "Restore",
      cancelLabel: "Cancel",
      onConfirm: async () => {
        setDialog(null);
        const pw = await getBackupPassword();
        if (pw) {
          runRestore(file, pw);
        } else {
          setPwPrompt({
            mode: "enter",
            onSubmit: (entered) => {
              setPwPrompt(null);
              runRestore(file, entered);
            },
          });
        }
      },
    });

  const onDisconnect = () =>
    setDialog({
      variant: "info",
      title: "Disconnect Google Drive?",
      message: "You can reconnect any time. Your existing backups stay safe in your Drive.",
      confirmLabel: "Disconnect",
      cancelLabel: "Cancel",
      onConfirm: async () => {
        setDialog(null);
        await logout();
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
          <Text style={s.headerTitle}>Back up &amp; Restore</Text>
          <Text style={s.headerSub}>Encrypted backups on your Google Drive</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Intro */}
        <View style={[s.card, s.intro]}>
          <View style={[s.introIcon, { backgroundColor: "#16161A", borderColor: "#1E1E23" }]}>
            <GoogleDriveLogo size={26} />
          </View>
          <Text style={s.introTitle}>Keep your data safe</Text>
          <Text style={s.introText}>
            Your shifts, expenses, vehicles and settings — encrypted with your password and saved to your own
            Google Drive. Only you can read them.
          </Text>
        </View>

        {/* Step 1 — Connect */}
        <Text style={s.groupLabel}>STEP 1</Text>
        <Step
          index={1}
          done={isAuthenticated}
          title={isAuthenticated ? "Google Drive connected" : "Connect Google Drive"}
          subtitle={isAuthenticated ? userEmail ?? "Signed in" : "Sign in to store your backups"}
          accentColor={accentColor}
          accentColorDim={accentColorDim}
          accentColorMid={accentColorMid}
          right={
            isAuthenticated ? (
              <PillBtn label="Disconnect" variant="danger" onPress={onDisconnect}
                accent={accentColor} accentDim={accentColorDim} accentMid={accentColorMid} accentContrast={accentColorContrast} />
            ) : (
              <PillBtn label="Connect" variant="primary" onPress={login}
                accent={accentColor} accentDim={accentColorDim} accentMid={accentColorMid} accentContrast={accentColorContrast} />
            )
          }
        />

        {/* Step 2 — Password */}
        <Text style={s.groupLabel}>STEP 2</Text>
        <Step
          index={2}
          done={passwordSet}
          title="Backup password"
          subtitle={passwordSet ? "Set — required to restore" : "Encrypts your backup; needed to restore"}
          accentColor={accentColor}
          accentColorDim={accentColorDim}
          accentColorMid={accentColorMid}
          right={
            <PillBtn label={passwordSet ? "Change" : "Set"} variant={passwordSet ? "ghost" : "primary"} onPress={openSetPassword}
              accent={accentColor} accentDim={accentColorDim} accentMid={accentColorMid} accentContrast={accentColorContrast} />
          }
        />

        {/* Step 3 — Back up */}
        <Text style={s.groupLabel}>STEP 3</Text>
        <Step
          index={3}
          done={false}
          locked={!ready}
          title="Back up now"
          subtitle={
            !isAuthenticated
              ? "Connect Google Drive first"
              : !passwordSet
              ? "Set a backup password first"
              : lastBackupTime
              ? `Last backup ${timeAgo(lastBackupTime)}`
              : "No backups yet"
          }
          accentColor={accentColor}
          accentColorDim={accentColorDim}
          accentColorMid={accentColorMid}
          right={
            <PillBtn
              label={isBackingUp ? "Backing up…" : "Back up"}
              variant="primary"
              disabled={!ready || isBackingUp || isRestoring}
              onPress={doBackup}
              accent={accentColor}
              accentDim={accentColorDim}
              accentMid={accentColorMid}
              accentContrast={accentColorContrast}
            />
          }
        />

        {/* Backups list */}
        {isAuthenticated ? (
          <>
            <Text style={s.groupLabel}>YOUR BACKUPS</Text>
            <View style={s.card}>
              {backups.length === 0 ? (
                <View style={s.emptyWrap}>
                  <UploadCloud size={22} color={DS.textSecondary} />
                  <Text style={s.emptyText}>
                    {backupsError
                      ? `Couldn't load your backups: ${backupsError}`
                      : "No backups yet. Run your first backup above."}
                  </Text>
                </View>
              ) : (
                backups.map((b, i) => (
                  <View key={b.id} style={[s.backupRow, i < backups.length - 1 && s.rowDivider]}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.backupDate}>{new Date(b.createdTime).toLocaleString()}</Text>
                      <Text style={s.backupAgo}>{timeAgo(b.createdTime)}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => onRestorePress(b)}
                      disabled={isBackingUp || isRestoring}
                      style={[s.restoreBtn, { opacity: isBackingUp || isRestoring ? 0.4 : 1 }]}
                    >
                      <RotateCcw size={14} color={DS.textSecondary} />
                      <Text style={s.restoreText}>Restore</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>
          </>
        ) : null}

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
        cancelLabel={dialog?.cancelLabel}
        onConfirm={dialog?.onConfirm}
        onClose={() => setDialog(null)}
        accentColor={accentColor}
      />

      <BusyOverlay
        visible={isBackingUp || isRestoring}
        label={isBackingUp ? "Backing up…" : "Restoring…"}
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
