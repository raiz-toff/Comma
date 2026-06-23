import React, { useState, useEffect } from "react";
import {
  ScrollView,
  View,
  TextInput,
  TouchableOpacity,
  Alert,
  Platform,
  Switch,
  ActivityIndicator,
  Share,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import * as FileSystem from "expo-file-system/legacy";
import { Text } from "@/src/components/ui/text";
import { PlatformBadge } from "@/src/components/ui/PlatformBadge";
import { PLATFORMS, type PlatformKey } from "@/src/registry/platforms";
import { useSettingsStore, type DriverProfile } from "@/store/useSettingsStore";
import { cn } from "@/src/lib/utils";
import { db } from "@/src/database/client";
import { settings } from "@/src/database/schema";
import { useGoogleDriveSync } from "@/hooks/useGoogleDriveSync";
import { generateShiftsCSV, generateExpensesCSV } from "@/utils/reportGenerator";

const isWeb = Platform.OS === "web";

async function upsertSetting(key: string, value: string) {
  if (isWeb) {
    localStorage.setItem(`comma_setting_${key}`, value);
    return;
  }
  await db
    .insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } });
}

const COUNTRIES = [
  { id: "CA", label: "🇨🇦 Canada", unit: "km" as const, currency: "CAD" },
  { id: "US", label: "🇺🇸 United States", unit: "mi" as const, currency: "USD" },
];

const US_STATES = ["NY", "CA", "TX", "FL", "IL", "PA", "OH", "GA", "NC", "MI"];
const CA_PROVINCES = ["ON", "QC", "BC", "AB", "MB", "SK", "NS", "NB", "NL", "PE"];

export default function SettingsScreen() {
  const queryClient = useQueryClient();
  const {
    profile,
    isOnboardingCompleted,
    isDemoMode,
    loadSettings,
    resetSettings,
    clearSampleData,
  } = useSettingsStore();

  // Local editable copies
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [country, setCountry] = useState<"US" | "CA">(profile.country);
  const [taxRegion, setTaxRegion] = useState(profile.taxRegion);
  const [distanceUnit, setDistanceUnit] = useState<"km" | "mi">(profile.distanceUnit);
  const [selectedPlatforms, setSelectedPlatforms] = useState<PlatformKey[]>(
    (profile.selectedPlatforms as PlatformKey[]) ?? []
  );
  const [taxWithholdingPct, setTaxWithholdingPct] = useState(String(profile.taxWithholdingPct));
  const [isSaving, setIsSaving] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);

  const {
    isAuthenticated,
    isBackingUp,
    isRestoring,
    backups,
    lastBackup,
    login,
    logout,
    triggerBackup,
    triggerRestore,
  } = useGoogleDriveSync();

  const [backupPin, setBackupPin] = useState("1234");

  useEffect(() => {
    setDisplayName(profile.displayName);
    setCountry(profile.country);
    setTaxRegion(profile.taxRegion);
    setDistanceUnit(profile.distanceUnit);
    setSelectedPlatforms((profile.selectedPlatforms as PlatformKey[]) ?? []);
    setTaxWithholdingPct(String(profile.taxWithholdingPct));
  }, [profile]);

  const regionList = country === "CA" ? CA_PROVINCES : US_STATES;

  const togglePlatform = (key: PlatformKey) => {
    setSelectedPlatforms((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updatedProfile: DriverProfile = {
        ...profile,
        displayName: displayName.trim() || profile.displayName,
        country,
        taxRegion,
        distanceUnit,
        selectedPlatforms,
        taxWithholdingPct: parseFloat(taxWithholdingPct) || profile.taxWithholdingPct,
      };

      await upsertSetting("profile", JSON.stringify(updatedProfile));
      await loadSettings();
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      setSavedFeedback(true);
      setTimeout(() => setSavedFeedback(false), 2000);
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to save settings.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetApp = () => {
    const performReset = async () => {
      await resetSettings();
      queryClient.invalidateQueries();
      router.replace("/");
    };

    if (isWeb) {
      if (window.confirm("Reset the app? All data will be permanently deleted.")) performReset();
    } else {
      Alert.alert(
        "Reset App",
        "All data will be permanently deleted. This cannot be undone.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Reset", style: "destructive", onPress: performReset },
        ]
      );
    }
  };

  const handleClearDemo = async () => {
    await clearSampleData();
    queryClient.invalidateQueries();
    router.replace("/");
  };

  const handleExportCSV = async () => {
    const exportData = async (type: "shifts" | "expenses") => {
      try {
        const start = new Date(0);
        const end = new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000);
        const csv = type === "shifts" ? await generateShiftsCSV(start, end) : await generateExpensesCSV(start, end);
        const filename = `comma_${type}_${new Date().toISOString().split("T")[0]}.csv`;

        if (isWeb) {
          const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.setAttribute("href", url);
          link.setAttribute("download", filename);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        } else {
          const fileUri = FileSystem.cacheDirectory + filename;
          await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: FileSystem.EncodingType.UTF8 });
          await Share.share({ url: fileUri, title: `Export ${type} CSV`, message: `Comma ${type} Export` });
        }
      } catch (err: any) {
        Alert.alert("Export Failed", err.message || "An error occurred exporting CSV.");
      }
    };

    if (isWeb) {
      const choice = window.confirm("Export Shifts? (Click Cancel to export Expenses instead)");
      if (choice) {
        exportData("shifts");
      } else {
        exportData("expenses");
      }
    } else {
      Alert.alert(
        "Export CSV",
        "Choose which logs to export:",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Expenses", onPress: () => exportData("expenses") },
          { text: "Shifts", onPress: () => exportData("shifts") },
        ]
      );
    }
  };

  return (
    <SafeAreaView className="dark flex-1 bg-[#0b0f19]">
      {/* Header */}
      <View className="px-4 pt-3 pb-3 border-b border-slate-800/80 bg-slate-900/40 flex-row items-center justify-between">
        <Text className="text-lg font-extrabold text-slate-100 tracking-tight">Settings</Text>
        <TouchableOpacity
          onPress={handleSave}
          disabled={isSaving}
          className={cn(
            "px-4 py-2 rounded-lg",
            savedFeedback ? "bg-emerald-500/20 border border-emerald-500/30" : "bg-emerald-500"
          )}
        >
          <Text className={cn("text-xs font-bold", savedFeedback ? "text-emerald-400" : "text-white")}>
            {isSaving ? "Saving…" : savedFeedback ? "Saved ✓" : "Save"}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerClassName="p-4 pb-16 flex flex-col gap-6">
        {/* ── 1. PROFILE ── */}
        <View className="flex flex-col gap-3">
          <Text className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">Profile</Text>

          <View className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 flex flex-col gap-4">
            <View className="flex flex-col gap-1.5">
              <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Display Name</Text>
              <TextInput
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Your name"
                placeholderTextColor="#475569"
                className="bg-slate-950/60 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 text-sm font-semibold"
              />
            </View>

            <View className="flex flex-col gap-2">
              <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Country</Text>
              <View className="flex-row gap-2">
                {COUNTRIES.map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    onPress={() => {
                      setCountry(c.id as "US" | "CA");
                      setDistanceUnit(c.unit);
                      setTaxRegion(c.id === "CA" ? "ON" : "NY");
                    }}
                    className={cn(
                      "flex-1 py-3 rounded-xl border items-center",
                      country === c.id
                        ? "border-emerald-500 bg-emerald-500/10"
                        : "border-slate-800 bg-slate-900/30"
                    )}
                  >
                    <Text className={cn("text-sm font-bold", country === c.id ? "text-emerald-400" : "text-slate-400")}>
                      {c.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View className="flex flex-col gap-2">
              <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                {country === "CA" ? "Province" : "State"}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View className="flex-row gap-2">
                  {regionList.map((r) => (
                    <TouchableOpacity
                      key={r}
                      onPress={() => setTaxRegion(r)}
                      className={cn(
                        "px-3 py-2 rounded-lg border",
                        taxRegion === r
                          ? "border-emerald-500 bg-emerald-500/10"
                          : "border-slate-800 bg-slate-900/30"
                      )}
                    >
                      <Text className={cn("text-xs font-bold", taxRegion === r ? "text-emerald-400" : "text-slate-400")}>
                        {r}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          </View>
        </View>

        {/* ── 2. PLATFORMS ── */}
        <View className="flex flex-col gap-3">
          <Text className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">Active Platforms</Text>
          <View className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4">
            <View className="flex-row flex-wrap gap-2.5">
              {(Object.keys(PLATFORMS) as PlatformKey[]).map((pKey) => {
                const isSelected = selectedPlatforms.includes(pKey);
                return (
                  <TouchableOpacity
                    key={pKey}
                    onPress={() => togglePlatform(pKey)}
                    className={cn(
                      "rounded-full border-2 p-1 transition-all duration-200",
                      isSelected ? "border-emerald-500 opacity-100" : "border-transparent opacity-45"
                    )}
                  >
                    <PlatformBadge platform={pKey} size="md" />
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text className="text-[10px] text-slate-500 mt-3 font-medium">
              {selectedPlatforms.length === 0 ? "No platforms selected — all will show on Dashboard." : `${selectedPlatforms.length} platform${selectedPlatforms.length !== 1 ? "s" : ""} selected`}
            </Text>
          </View>
        </View>

        {/* ── 3. LOCALE ── */}
        <View className="flex flex-col gap-3">
          <Text className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">Locale</Text>
          <View className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 flex flex-col gap-4">
            <View className="flex flex-col gap-2">
              <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Distance Unit</Text>
              <View className="flex-row gap-2">
                {(["km", "mi"] as const).map((unit) => (
                  <TouchableOpacity
                    key={unit}
                    onPress={() => setDistanceUnit(unit)}
                    className={cn(
                      "flex-1 py-3 rounded-xl border items-center",
                      distanceUnit === unit
                        ? "border-emerald-500 bg-emerald-500/10"
                        : "border-slate-800 bg-slate-900/30"
                    )}
                  >
                    <Text className={cn("text-sm font-bold uppercase", distanceUnit === unit ? "text-emerald-400" : "text-slate-400")}>
                      {unit}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View className="flex flex-col gap-2">
              <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tax Withholding %</Text>
              <View className="flex-row items-center bg-slate-950/60 border border-slate-800 rounded-xl overflow-hidden">
                <TextInput
                  value={taxWithholdingPct}
                  onChangeText={setTaxWithholdingPct}
                  keyboardType="numeric"
                  placeholder="25"
                  placeholderTextColor="#475569"
                  className="flex-1 px-4 py-3 text-slate-100 text-sm font-semibold text-right"
                />
                <View className="px-3 py-3 bg-slate-900/40 border-l border-slate-800">
                  <Text className="text-sm text-slate-400 font-bold">%</Text>
                </View>
              </View>
              <View className="flex-row gap-2 flex-wrap">
                {["15", "20", "25", "28", "30"].map((rate) => (
                  <TouchableOpacity
                    key={rate}
                    onPress={() => setTaxWithholdingPct(rate)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg border",
                      taxWithholdingPct === rate
                        ? "border-emerald-500 bg-emerald-500/10"
                        : "border-slate-800 bg-slate-900/30"
                    )}
                  >
                    <Text className={cn("text-xs font-bold", taxWithholdingPct === rate ? "text-emerald-400" : "text-slate-400")}>
                      {rate}%
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </View>

        {/* ── 4. DATA & BACKUP ── */}
        <View className="flex flex-col gap-3">
          <Text className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">Data & Backup</Text>
          <View className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 flex flex-col gap-3">
            {/* Import CSV */}
            <TouchableOpacity
              onPress={() => router.push("/settings/import")}
              className="flex-row items-center justify-between py-3 border-b border-slate-800/40"
            >
              <View>
                <Text className="text-sm font-semibold text-slate-200">Import CSV</Text>
                <Text className="text-[10px] text-slate-500 mt-0.5">Load shift history from CSV wizard</Text>
              </View>
              <View className="px-2.5 py-1 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                <Text className="text-[9px] text-emerald-400 uppercase font-bold tracking-wider">Launch</Text>
              </View>
            </TouchableOpacity>

            {/* Export CSV */}
            <TouchableOpacity
              onPress={handleExportCSV}
              className="flex-row items-center justify-between py-3 border-b border-slate-800/40"
            >
              <View>
                <Text className="text-sm font-semibold text-slate-200">Export CSV</Text>
                <Text className="text-[10px] text-slate-500 mt-0.5">Download all shift or expense data as CSV</Text>
              </View>
              <View className="px-2.5 py-1 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                <Text className="text-[9px] text-emerald-400 uppercase font-bold tracking-wider">Export</Text>
              </View>
            </TouchableOpacity>

            {/* Google Drive Connection */}
            <View className="py-3 flex-col gap-3">
              <View className="flex-row items-center justify-between">
                <View>
                  <Text className="text-sm font-semibold text-slate-200">Google Drive Sync</Text>
                  <Text className="text-[10px] text-slate-500 mt-0.5">
                    {isAuthenticated ? "Connected to Google Drive" : "Connect your Google account"}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={isAuthenticated ? logout : login}
                  className={cn(
                    "px-3 py-1.5 rounded-lg border",
                    isAuthenticated
                      ? "border-rose-500/30 bg-rose-500/10"
                      : "border-emerald-500/30 bg-emerald-500/10"
                  )}
                >
                  <Text className={cn("text-[10px] uppercase font-bold tracking-wider", isAuthenticated ? "text-rose-400" : "text-emerald-400")}>
                    {isAuthenticated ? "Disconnect" : "Connect"}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Backups controls (only if connected) */}
              {isAuthenticated && (
                <View className="flex-col gap-3 mt-1 bg-slate-950/40 p-3 rounded-xl border border-slate-850">
                  {/* PIN Input */}
                  <View className="flex flex-col gap-1.5">
                    <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Backup PIN (4 digits)</Text>
                    <TextInput
                      value={backupPin}
                      onChangeText={(val) => setBackupPin(val.replace(/[^0-9]/g, "").slice(0, 4))}
                      keyboardType="number-pad"
                      secureTextEntry
                      placeholder="1234"
                      placeholderTextColor="#475569"
                      className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 text-sm font-semibold font-mono"
                    />
                  </View>

                  {/* Backup Button */}
                  <TouchableOpacity
                    onPress={() => triggerBackup(backupPin).catch(e => Alert.alert("Backup Failed", e.message))}
                    disabled={isBackingUp || isRestoring}
                    className="w-full py-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30 items-center justify-center flex-row gap-2"
                  >
                    {isBackingUp ? (
                      <ActivityIndicator size="small" color="#10b981" />
                    ) : (
                      <Text className="text-emerald-400 font-bold text-xs uppercase">Backup Data to Drive</Text>
                    )}
                  </TouchableOpacity>

                  {/* Backups List */}
                  {backups.length > 0 ? (
                    <View className="flex-col gap-2 mt-2 pt-2 border-t border-slate-900">
                      <Text className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Available Backups</Text>
                      {backups.map((b) => (
                        <View key={b.id} className="flex-row justify-between items-center py-2 border-b border-slate-900 last:border-b-0">
                          <View className="flex-col max-w-[70%]">
                            <Text className="text-xs font-semibold text-slate-300" numberOfLines={1}>
                              {b.name}
                            </Text>
                            <Text className="text-[9px] text-slate-500 mt-0.5">
                              {new Date(b.createdTime).toLocaleString()}
                            </Text>
                          </View>
                          <TouchableOpacity
                            onPress={() => {
                              const performRestore = async () => {
                                try {
                                  await triggerRestore(b.id, backupPin);
                                  Alert.alert("Success", "Backup restored successfully!");
                                } catch (err: any) {
                                  Alert.alert("Restore Failed", err.message || "Failed to restore backup.");
                                }
                              };

                              if (isWeb) {
                                if (window.confirm("Restore this backup? Local data will be overwritten.")) performRestore();
                              } else {
                                Alert.alert(
                                  "Restore Backup",
                                  "Restore this backup? Current local data will be overwritten and replaced.",
                                  [
                                    { text: "Cancel", style: "cancel" },
                                    { text: "Restore", style: "destructive", onPress: performRestore },
                                  ]
                                );
                              }
                            }}
                            disabled={isBackingUp || isRestoring}
                            className="px-2.5 py-1 bg-blue-500/10 border border-blue-500/20 rounded-lg"
                          >
                            <Text className="text-[9px] text-blue-400 font-bold uppercase">Restore</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text className="text-[10px] text-slate-500 text-center italic mt-1">No backups found on Drive</Text>
                  )}
                </View>
              )}
            </View>
          </View>
        </View>

        {/* ── 5. DANGER ZONE ── */}
        <View className="flex flex-col gap-3">
          <Text className="text-xs font-extrabold text-rose-400/70 uppercase tracking-widest">Danger Zone</Text>
          <View className="bg-rose-500/5 border border-rose-500/15 rounded-2xl p-4 flex flex-col gap-3">
            {isDemoMode && (
              <TouchableOpacity
                onPress={handleClearDemo}
                className="w-full py-3.5 rounded-xl items-center border border-amber-500/30 bg-amber-500/10"
              >
                <Text className="text-amber-400 font-bold text-sm">Clear Demo Data</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={handleResetApp}
              className="w-full py-3.5 rounded-xl items-center border border-rose-500/30 bg-rose-500/10"
            >
              <Text className="text-rose-400 font-bold text-sm">Reset App (Delete All Data)</Text>
            </TouchableOpacity>

            <Text className="text-[10px] text-slate-500 text-center leading-relaxed">
              Resetting permanently deletes all shifts, vehicles, expenses, goals, and settings.
              This action cannot be undone.
            </Text>
          </View>
        </View>

        {/* App Version */}
        <View className="items-center py-4">
          <Text className="text-[10px] text-slate-600 font-mono">Comma • v0.3.0 • Phase 3</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
