import React, { useState, useEffect } from "react";
import {
  ScrollView,
  View,
  TextInput,
  TouchableOpacity,
  Alert,
  Platform,
  Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Text } from "@/src/components/ui/text";
import { PlatformBadge } from "@/src/components/ui/PlatformBadge";
import { PLATFORMS, type PlatformKey } from "@/src/registry/platforms";
import { useSettingsStore, type DriverProfile } from "@/store/useSettingsStore";
import { cn } from "@/src/lib/utils";
import { db } from "@/src/database/client";
import { settings } from "@/src/database/schema";

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

        {/* ── 4. DATA & BACKUP (Stubs for Phase 9/12) ── */}
        <View className="flex flex-col gap-3">
          <Text className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">Data & Backup</Text>
          <View className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 flex flex-col gap-3">
            <TouchableOpacity
              onPress={() => Alert.alert("Coming Soon", "Google Drive backup will be available in a future update.")}
              className="flex-row items-center justify-between py-3 border-b border-slate-800/40"
            >
              <View>
                <Text className="text-sm font-semibold text-slate-200">Backup to Google Drive</Text>
                <Text className="text-[10px] text-slate-500 mt-0.5">Phase 12 feature</Text>
              </View>
              <View className="px-2.5 py-1 bg-slate-800/60 rounded-lg border border-slate-700/40">
                <Text className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Soon</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => Alert.alert("Coming Soon", "CSV export will be available in a future update.")}
              className="flex-row items-center justify-between py-3"
            >
              <View>
                <Text className="text-sm font-semibold text-slate-200">Export CSV</Text>
                <Text className="text-[10px] text-slate-500 mt-0.5">Download all shift data as CSV</Text>
              </View>
              <View className="px-2.5 py-1 bg-slate-800/60 rounded-lg border border-slate-700/40">
                <Text className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Soon</Text>
              </View>
            </TouchableOpacity>
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
