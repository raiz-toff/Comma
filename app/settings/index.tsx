/**
 * Settings — one page, no tabs. Every control saves the moment it changes.
 */

import React, { useState, useEffect } from "react";
import { View, TouchableOpacity, Switch, ScrollView, Alert, StyleSheet } from "react-native";
import { Text } from "@/src/components/ui/text";
import * as Sharing from "expo-sharing";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import * as FileSystem from "expo-file-system/legacy";
import { eq } from "drizzle-orm";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import * as LocalAuthentication from "expo-local-authentication";

import { useSettingsStore } from "@/store/useSettingsStore";
import { PLATFORMS, type PlatformKey } from "@/src/registry/platforms";
import { getCountryDef } from "@/src/registry/countries/index";
import { PlatformBadge } from "@/src/components/ui/PlatformBadge";
import { Card } from "@/src/components/ui/card";
import { db } from "@/src/database/client";
import { settings } from "@/src/database/schema";
import { generateShiftsCSV, generateExpensesCSV } from "@/utils/reportGenerator";
import { usePlatformTheme } from "@/src/hooks/usePlatformTheme";
import { useLayout } from "@/src/hooks/useLayout";
import { FeedbackDialog, BusyOverlay, type FeedbackVariant } from "@/src/components/ui/FeedbackDialog";
import { withAlpha } from "@/src/theme/colors";
import { useColors, useThemedStyles, type Palette } from "@/src/theme/useColors";

// ─── Persistence ─────────────────────────────────────────────────────────────

async function upsertSetting(key: string, value: string): Promise<void> {
  await db
    .insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } });
}

async function readSetting(key: string): Promise<string> {
  const rows = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
  return rows[0]?.value ?? "";
}

// ─── Primitives ──────────────────────────────────────────────────────────────

function Sep() {
  const s = useThemedStyles(makeStyles);
  return <View style={s.sep} />;
}

function Row({ label, hint, children, last = false }: { label: string; hint?: string; children: React.ReactNode; last?: boolean }) {
  const s = useThemedStyles(makeStyles);
  return (
    <>
      <View style={s.row}>
        <View style={{ flex: 1 }}>
          <Text variant="labelM">{label}</Text>
          {hint ? <Text variant="paragraphS" className="text-content-secondary" style={{ marginTop: 2 }}>{hint}</Text> : null}
        </View>
        <View style={{ flexShrink: 0, alignItems: "flex-end" }}>{children}</View>
      </View>
      {!last && <Sep />}
    </>
  );
}

function Segmented<T extends string>({ options, value, onChange }: { options: readonly { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  const s = useThemedStyles(makeStyles);
  return (
    <View style={s.segmented}>
      {options.map((opt) => {
        const on = opt.value === value;
        return (
          <TouchableOpacity
            key={opt.value}
            onPress={() => onChange(opt.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            style={[s.segBtn, on && s.segBtnOn]}
          >
            <Text style={[s.segText, on && s.segTextOn]}>{opt.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function Btn({ label, onPress, variant = "ghost" }: { label: string; onPress: () => void; variant?: "ghost" | "primary" | "danger" }) {
  const { accentColor, accentColorDim, accentColorMid } = usePlatformTheme();
  const C = useColors();
  const s = useThemedStyles(makeStyles);
  const v = {
    ghost: { bg: C.surface03, border: C.lineStrong, text: C.contentSecondary },
    primary: { bg: accentColorDim, border: accentColorMid, text: accentColor },
    danger: { bg: withAlpha(C.destructive, 0.12), border: withAlpha(C.destructive, 0.25), text: C.destructive },
  }[variant];
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      activeOpacity={0.7}
      style={[s.btn, { backgroundColor: v.bg, borderColor: v.border }]}
    >
      <Text style={[s.btnText, { color: v.text }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function GroupLabel({ children }: { children: string }) {
  const s = useThemedStyles(makeStyles);
  return <Text variant="labelXs" className="text-content-muted" style={s.groupLabel}>{children}</Text>;
}

async function authenticateWithBiometrics(reason: string): Promise<boolean> {
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
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const { accentColor } = usePlatformTheme();
  const C = useColors();
  const s = useThemedStyles(makeStyles);
  const { columnStyle } = useLayout();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { profile, isDemoMode, resetSettings, clearSampleData, updateProfile, dbPlatforms } = useSettingsStore();

  const country = profile?.country ?? "CA";
  const weekStartDay = String(profile?.locale?.weekStartDay ?? 0) as "0" | "1";
  const timeFormat = profile?.locale?.timeFormat ?? "12h";

  const [syncReminder, setSyncReminder] = useState(true);
  const [exportChooserOpen, setExportChooserOpen] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportDialog, setExportDialog] = useState<{ variant: FeedbackVariant; title: string; message?: string } | null>(null);

  useEffect(() => {
    readSetting("notification_prefs")
      .then((raw) => {
        if (raw) setSyncReminder(JSON.parse(raw)?.backupOverdue !== false);
      })
      .catch((e) => console.error("[settings] failed to read notification prefs", e));
  }, []);

  const platforms = dbPlatforms
    .filter((p) => p.country === country)
    .sort((a, b) => (a.sortPriority ?? 0) - (b.sortPriority ?? 0));
  const selected = profile?.selectedPlatforms ?? [];

  const togglePlatform = async (id: string, on: boolean) => {
    const next = on ? [...selected, id] : selected.filter((p) => p !== id);
    await updateProfile({ selectedPlatforms: next });
    queryClient.invalidateQueries({ queryKey: ["analytics"] });
    queryClient.invalidateQueries({ queryKey: ["shifts"] });
  };

  const setLocale = (patch: { weekStartDay?: number; timeFormat?: "12h" | "24h" }) =>
    updateProfile({ locale: { ...(profile.locale ?? {}), ...patch } });

  const toggleSyncReminder = async (on: boolean) => {
    setSyncReminder(on);
    // Merge into the existing blob so retired keys from older versions are left alone.
    const raw = await readSetting("notification_prefs");
    const prefs = raw ? JSON.parse(raw) : {};
    await upsertSetting("notification_prefs", JSON.stringify({ ...prefs, backupOverdue: on }));
    queryClient.invalidateQueries({ queryKey: ["backup", "status"] });
  };

  const confirmResetApp = () => {
    const run = async () => {
      const authenticated = await authenticateWithBiometrics("Confirm Identity to Reset App");
      if (!authenticated) {
        Alert.alert("Authentication failed", "Reset cancelled.");
        return;
      }
      await resetSettings();
      queryClient.invalidateQueries();
      router.replace("/");
    };
    Alert.alert("Reset app", "All data on this phone will be permanently deleted. This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Reset", style: "destructive", onPress: run },
    ]);
  };

  const doExport = async (type: "shifts" | "expenses") => {
    setExportChooserOpen(false);
    setExportBusy(true);
    try {
      const start = new Date(0);
      const end = new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000);
      const csv = type === "shifts" ? await generateShiftsCSV(start, end) : await generateExpensesCSV(start, end);

      if (!csv.trim()) {
        setExportDialog({ variant: "info", title: "Nothing to Export", message: `You have no ${type} recorded yet.` });
        return;
      }
      if (!(await Sharing.isAvailableAsync())) {
        setExportDialog({ variant: "error", title: "Sharing Unavailable", message: "This device can't open a share sheet to save the file." });
        return;
      }
      const fname = `comma_${type}_${new Date().toISOString().slice(0, 10)}.csv`;
      const uri = FileSystem.cacheDirectory + fname;
      await FileSystem.writeAsStringAsync(uri, csv, { encoding: FileSystem.EncodingType.UTF8 });
      await Sharing.shareAsync(uri, { mimeType: "text/csv", dialogTitle: `Export ${type === "shifts" ? "Shifts" : "Expenses"} CSV` });
    } catch (err: any) {
      setExportDialog({ variant: "error", title: "Export Failed", message: err?.message || "An error occurred exporting the CSV." });
    } finally {
      setExportBusy(false);
    }
  };

  const switchColors = { trackColor: { false: C.lineStrong, true: accentColor }, thumbColor: C.contentPrimary };

  return (
    <SafeAreaView style={s.safe} edges={["bottom", "left", "right"]}>
      <View style={[s.header, { paddingTop: insets.top + 10 }, columnStyle]}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back" hitSlop={8} style={s.backBtn}>
          <ChevronLeft color={C.contentPrimary} size={20} />
        </TouchableOpacity>
        <Text variant="headingS">Settings</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={[s.scrollContent, columnStyle]} showsVerticalScrollIndicator={false}>
        {isDemoMode && (
          <>
            <GroupLabel>Demo Mode</GroupLabel>
            <Card className="p-0 gap-0">
              <Row label="Demo data active" hint="Exit to set up your real account." last>
                <Btn
                  label="Exit demo"
                  variant="primary"
                  onPress={async () => {
                    await clearSampleData();
                    queryClient.invalidateQueries();
                    router.replace("/");
                  }}
                />
              </Row>
            </Card>
          </>
        )}

        <GroupLabel>Profile</GroupLabel>
        <Card className="p-0 gap-0">
          <TouchableOpacity onPress={() => router.push("/settings/profile")} accessibilityRole="button" activeOpacity={0.7} style={s.row}>
            <View style={{ flex: 1 }}>
              <Text variant="labelM">{profile?.displayName || "Driver"}</Text>
              <Text variant="paragraphS" className="text-content-secondary" style={{ marginTop: 2 }}>
                {getCountryDef(country).label} · {profile?.taxRegion} · {profile?.distanceUnit ?? "km"}
              </Text>
            </View>
            <ChevronRight size={16} color={C.contentSecondary} />
          </TouchableOpacity>
        </Card>

        <GroupLabel>Platforms</GroupLabel>
        <Card className="p-0 gap-0">
          {platforms.map((p, i) => {
            const label = p.label || PLATFORMS[p.id as PlatformKey]?.label || p.id;
            return (
              <View key={p.id}>
                <View style={s.row}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                    <PlatformBadge platform={p.id as PlatformKey} size="sm" />
                    <Text variant="labelM">{label}</Text>
                  </View>
                  <Switch value={selected.includes(p.id)} onValueChange={(v) => togglePlatform(p.id, v)} accessibilityLabel={label} {...switchColors} />
                </View>
                {i < platforms.length - 1 && <Sep />}
              </View>
            );
          })}
        </Card>

        <GroupLabel>Preferences</GroupLabel>
        <Card className="p-0 gap-0">
          <Row label="Week starts">
            <Segmented
              options={[{ value: "0", label: "Sun" }, { value: "1", label: "Mon" }] as const}
              value={weekStartDay}
              onChange={(v) => setLocale({ weekStartDay: parseInt(v, 10) })}
            />
          </Row>
          <Row label="Time format">
            <Segmented
              options={[{ value: "12h", label: "12h" }, { value: "24h", label: "24h" }] as const}
              value={timeFormat}
              onChange={(v) => setLocale({ timeFormat: v })}
            />
          </Row>
          <Row label="Sync reminder" hint="Tell me if my data hasn't synced recently" last>
            <Switch value={syncReminder} onValueChange={toggleSyncReminder} accessibilityLabel="Sync reminder" {...switchColors} />
          </Row>
        </Card>

        <GroupLabel>Data</GroupLabel>
        <Card className="p-0 gap-0">
          <Row label="Cloud Sync" hint="Keep an encrypted copy in your own Google Drive.">
            <Btn label="Open" variant="primary" onPress={() => router.push("/settings/backup")} />
          </Row>
          <Row label="Export CSV" hint="Shifts or expenses as a spreadsheet">
            <Btn label="Export" onPress={() => setExportChooserOpen(true)} />
          </Row>
          <Row label="Import CSV" hint="Bring in shift history from a file" last>
            <Btn label="Import" onPress={() => router.push("/settings/import")} />
          </Row>
        </Card>

        <GroupLabel>Danger Zone</GroupLabel>
        <Card className="p-0 gap-0" style={{ backgroundColor: withAlpha(C.destructive, 0.12), borderColor: withAlpha(C.destructive, 0.25) }}>
          <Row label="Reset app" hint="Deletes all data on this phone. Your Google Drive copy is kept." last>
            <Btn label="Reset" variant="danger" onPress={confirmResetApp} />
          </Row>
        </Card>

        <View style={{ height: 48 }} />
      </ScrollView>

      <FeedbackDialog
        visible={exportChooserOpen}
        variant="info"
        title="Export CSV"
        message="Which data would you like to export?"
        accentColor={accentColor}
        cancelLabel="Cancel"
        actions={[
          { label: "Shifts", onPress: () => doExport("shifts") },
          { label: "Expenses", onPress: () => doExport("expenses"), variant: "neutral" },
        ]}
        onClose={() => setExportChooserOpen(false)}
      />
      <BusyOverlay visible={exportBusy} label="Preparing export…" accentColor={accentColor} />
      <FeedbackDialog
        visible={!!exportDialog}
        variant={exportDialog?.variant ?? "info"}
        title={exportDialog?.title ?? ""}
        message={exportDialog?.message}
        accentColor={accentColor}
        onClose={() => setExportDialog(null)}
      />
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const makeStyles = (C: Palette) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: C.background },
    scrollContent: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 60 },
    header: { paddingHorizontal: 16, paddingBottom: 12, flexDirection: "row", alignItems: "center", gap: 10 },
    backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.surface03, borderWidth: 0.5, borderColor: C.lineStrong, alignItems: "center", justifyContent: "center" },
    groupLabel: { marginBottom: 6, marginTop: 20, paddingHorizontal: 2 },
    sep: { height: StyleSheet.hairlineWidth, backgroundColor: C.lineSubtle, marginHorizontal: 16 },
    row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, gap: 10, minHeight: 52 },
    segmented: { flexDirection: "row", backgroundColor: C.surface03, borderRadius: 12, borderWidth: 0.5, borderColor: C.lineStrong, padding: 3, minWidth: 120 },
    segBtn: { flex: 1, paddingVertical: 5, borderRadius: 10, alignItems: "center" },
    segBtnOn: { backgroundColor: C.surface02, borderWidth: 0.5, borderColor: C.lineSubtle },
    segText: { fontSize: 11, fontWeight: "600", color: C.contentSecondary },
    segTextOn: { color: C.contentPrimary },
    btn: { paddingHorizontal: 13, paddingVertical: 7, borderRadius: 12, borderWidth: 0.5 },
    btnText: { fontSize: 11, fontWeight: "700" },
  });
