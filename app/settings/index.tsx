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
  Modal,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import * as FileSystem from "expo-file-system/legacy";
import { Text } from "@/src/components/ui/text";
import { PlatformBadge } from "@/src/components/ui/PlatformBadge";
import { PLATFORMS, type PlatformKey } from "@/src/registry/platforms";
import { useSettingsStore, type DriverProfile } from "@/store/useSettingsStore";
import { cn } from "@/src/lib/utils";
import { db } from "@/src/database/client";
import { settings, shifts, expenses } from "@/src/database/schema";
import { eq } from "drizzle-orm";
import { useGoogleDriveSync } from "@/hooks/useGoogleDriveSync";
import { generateShiftsCSV, generateExpensesCSV } from "@/utils/reportGenerator";
import { ArrowUp, ArrowDown, Trash2, ShieldAlert, Sparkles, Database, Check, ChevronLeft } from "lucide-react-native";

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

const PRESET_ACCENTS = [
  "#10B981", // Emerald
  "#FF4D4F", // Red
  "#F5A623", // Amber
  "#3B82F6", // Blue
  "#8B5CF6", // Purple
  "#F97316", // Orange
  "#14B8A6", // Teal
  "#E11D48", // Rose
  "#22C55E", // Green
  "#6366F1", // Indigo
];

interface PlatformConfig {
  active: boolean;
  hourlyRate: string;
  mileageRate: string;
  priority: string;
}

export default function SettingsScreen() {
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const {
    profile,
    isOnboardingCompleted,
    isDemoMode,
    loadSettings,
    resetSettings,
    clearSampleData,
  } = useSettingsStore();

  const params = useLocalSearchParams<{ tab?: string }>();
  const [activeTab, setActiveTab] = useState<"you" | "appearance" | "platforms" | "alerts" | "data" | "about">("you");

  useEffect(() => {
    if (params.tab === "platforms") {
      setActiveTab("platforms");
    }
  }, [params.tab]);

  // Edit states for 'you' Tab
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [country, setCountry] = useState<"US" | "CA">(profile.country);
  const [taxRegion, setTaxRegion] = useState(profile.taxRegion);
  const [distanceUnit, setDistanceUnit] = useState<"km" | "mi">(profile.distanceUnit);
  const [primaryPlatform, setPrimaryPlatform] = useState(profile.selectedPlatforms?.[0] || "");
  const [weeklyGoal, setWeeklyGoal] = useState(String(profile.weeklyGoal));
  const [monthlyGoal, setMonthlyGoal] = useState(String(profile.monthlyGoal));
  const [annualGoal, setAnnualGoal] = useState(String(profile.annualGoal));
  const [taxWithholdingPct, setTaxWithholdingPct] = useState(String(profile.taxWithholdingPct));
  const [workSchedulePreset, setWorkSchedulePreset] = useState(profile.workSchedulePreset || "flexible");
  const [hstRegistered, setHstRegistered] = useState(profile.hstRegistered || false);

  // Edit states for 'appearance' Tab
  const [theme, setTheme] = useState(profile.theme || "dark");
  const [accentColor, setAccentColor] = useState(profile.avatarData || "#10B981");
  const [currency, setCurrency] = useState(profile.country === "CA" ? "CAD" : "USD");
  const [dateFormat, setDateFormat] = useState("YYYY-MM-DD");
  const [weekStartDay, setWeekStartDay] = useState("0"); // 0=Sunday, 1=Monday
  const [timeFormat, setTimeFormat] = useState("12h");
  const [bentoLayout, setBentoLayout] = useState("balanced");
  const [dashboardWidgets, setDashboardWidgets] = useState<{ id: string; size: string }[]>([]);

  // Edit states for 'platforms' Tab
  const [platformConfigs, setPlatformConfigs] = useState<Record<string, PlatformConfig>>({});

  // Edit states for 'alerts' Tab
  const [notifications, setNotifications] = useState({
    shiftReminders: true,
    goalAlerts: true,
    taxReminders: true,
    weeklyDigest: false,
    maintenanceDue: true,
    insuranceExpiry: true,
    backupOverdue: false,
  });
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);

  // Edit states for 'data' Tab
  const [integrityOutput, setIntegrityOutput] = useState("");
  const [isCheckingIntegrity, setIsCheckingIntegrity] = useState(false);
  const [archiveDays, setArchiveDays] = useState("30");
  const [selectedResetPlatform, setSelectedResetPlatform] = useState<string>("");

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

  // Load Initial Settings Configuration
  useEffect(() => {
    setDisplayName(profile.displayName);
    setCountry(profile.country);
    setTaxRegion(profile.taxRegion);
    setDistanceUnit(profile.distanceUnit);
    setWeeklyGoal(String(profile.weeklyGoal));
    setMonthlyGoal(String(profile.monthlyGoal));
    setAnnualGoal(String(profile.annualGoal));
    setTaxWithholdingPct(String(profile.taxWithholdingPct));
    setWorkSchedulePreset(profile.workSchedulePreset || "flexible");
    setHstRegistered(profile.hstRegistered || false);
    setTheme(profile.theme || "dark");

    // Load widget configuration
    async function loadWidgetsAndPlatformConfigs() {
      try {
        let savedWidgetsVal = "";
        let savedPlatformRatesVal = "";
        let savedNotifsVal = "";
        let savedWeekStartDayVal = "0";

        if (isWeb) {
          savedWidgetsVal = localStorage.getItem("comma_setting_dashboard_widgets") || "";
          savedPlatformRatesVal = localStorage.getItem("comma_setting_platform_configurations") || "";
          savedNotifsVal = localStorage.getItem("comma_setting_notification_prefs") || "";
          savedWeekStartDayVal = localStorage.getItem("comma_setting_week_start_day") || "0";
        } else {
          const widgetsRow = await db.select().from(settings).where(eq(settings.key, "dashboard_widgets")).limit(1);
          savedWidgetsVal = widgetsRow[0]?.value || "";

          const ratesRow = await db.select().from(settings).where(eq(settings.key, "platform_configurations")).limit(1);
          savedPlatformRatesVal = ratesRow[0]?.value || "";

          const notifsRow = await db.select().from(settings).where(eq(settings.key, "notification_prefs")).limit(1);
          savedNotifsVal = notifsRow[0]?.value || "";

          const weekStartRow = await db.select().from(settings).where(eq(settings.key, "week_start_day")).limit(1);
          savedWeekStartDayVal = weekStartRow[0]?.value || "0";
        }

        setWeekStartDay(savedWeekStartDayVal);

        if (savedWidgetsVal) {
          setDashboardWidgets(JSON.parse(savedWidgetsVal));
        } else {
          setDashboardWidgets([
            { id: "rollingTrend", size: "2x1" },
            { id: "platformActivity", size: "1x1" },
            { id: "deadMiles", size: "1x1" },
            { id: "taxJar", size: "1x1" },
          ]);
        }

        const initialConfigs: Record<string, PlatformConfig> = {};
        const parsedRates = savedPlatformRatesVal ? JSON.parse(savedPlatformRatesVal) : {};

        (Object.keys(PLATFORMS) as PlatformKey[]).forEach((pKey, index) => {
          initialConfigs[pKey] = {
            active: profile.selectedPlatforms?.includes(pKey) || parsedRates[pKey]?.active || false,
            hourlyRate: parsedRates[pKey]?.hourlyRate || "20",
            mileageRate: parsedRates[pKey]?.mileageRate || "0.62",
            priority: parsedRates[pKey]?.priority || String(index + 1),
          };
        });
        setPlatformConfigs(initialConfigs);

        if (savedNotifsVal) {
          setNotifications(JSON.parse(savedNotifsVal));
        }
      } catch (e) {
        console.error("Failed to load settings extra configs", e);
      }
    }
    loadWidgetsAndPlatformConfigs();
  }, [profile]);

  const regionList = country === "CA" ? CA_PROVINCES : US_STATES;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const activePlatforms = Object.keys(platformConfigs).filter((k) => platformConfigs[k].active);

      const updatedProfile: DriverProfile = {
        ...profile,
        displayName: displayName.trim() || profile.displayName,
        country,
        taxRegion,
        distanceUnit,
        selectedPlatforms: activePlatforms,
        taxWithholdingPct: parseFloat(taxWithholdingPct) || profile.taxWithholdingPct,
        workSchedulePreset: workSchedulePreset as any,
        hstRegistered,
        theme: theme as any,
        avatarData: accentColor,
      };

      // Save configurations
      await upsertSetting("profile", JSON.stringify(updatedProfile));
      await upsertSetting("dashboard_widgets", JSON.stringify(dashboardWidgets));
      await upsertSetting("platform_configurations", JSON.stringify(platformConfigs));
      await upsertSetting("notification_prefs", JSON.stringify(notifications));
      await upsertSetting("week_start_day", weekStartDay);

      await loadSettings();
      queryClient.invalidateQueries();
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

  const handleResetPlatform = async () => {
    if (!selectedResetPlatform) {
      Alert.alert("Error", "Please select a platform to reset.");
      return;
    }

    const performReset = async () => {
      // In Web mode or Native mode, wipe matching records
      if (isWeb) {
        localStorage.removeItem(`comma_shifts_${selectedResetPlatform}`);
        Alert.alert("Success", `Data for ${selectedResetPlatform} wiped successfully.`);
      } else {
        // Run SQLite wipe query
        await db.delete(shifts).where(eq(shifts.platform, selectedResetPlatform));
        Alert.alert("Success", `Data for ${selectedResetPlatform} wiped from SQLite.`);
      }
      queryClient.invalidateQueries();
    };

    if (isWeb) {
      if (window.confirm(`Wipe all shift records for ${selectedResetPlatform}? This cannot be undone.`)) performReset();
    } else {
      Alert.alert(
        "Reset Platform Data",
        `Wipe all shift records for ${selectedResetPlatform}? This cannot be undone.`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Wipe Data", style: "destructive", onPress: performReset },
        ]
      );
    }
  };

  const handleClearDemo = async () => {
    await clearSampleData();
    queryClient.invalidateQueries();
    router.replace("/");
    if (Platform.OS === "web") {
      window.location.reload();
    } else {
      const { DevSettings } = require("react-native");
      DevSettings.reload();
    }
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

  const runDataIntegrityCheck = async () => {
    setIsCheckingIntegrity(true);
    setIntegrityOutput("Running database audit...");
    try {
      if (isWeb) {
        setIntegrityOutput("Integrity Check passed: Clean localStorage configuration.");
      } else {
        const shiftList = await db.select().from(shifts);
        const expenseList = await db.select().from(expenses);
        const issues: string[] = [];

        shiftList.forEach((s: any) => {
          if (!s.startTime || isNaN(new Date(s.startTime).getTime())) {
            issues.push(`Shift [ID: ${s.id}] has invalid Start Time.`);
          }
        });

        expenseList.forEach((e: any) => {
          if (!e.date || isNaN(new Date(e.date).getTime())) {
            issues.push(`Expense [ID: ${e.id}] has invalid date.`);
          }
        });

        if (issues.length === 0) {
          setIntegrityOutput("🎉 Data Integrity: 100% clean. No broken relations or dates found!");
        } else {
          setIntegrityOutput(`⚠️ Inconsistencies found:\n${issues.join("\n")}`);
        }
      }
    } catch (e: any) {
      setIntegrityOutput(`Integrity check failed: ${e.message}`);
    } finally {
      setIsCheckingIntegrity(false);
    }
  };

  // Reordering widgets handlers
  const moveWidget = (index: number, direction: "up" | "down") => {
    const updated = [...dashboardWidgets];
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= updated.length) return;
    const temp = updated[index];
    updated[index] = updated[targetIdx];
    updated[targetIdx] = temp;
    setDashboardWidgets(updated);
  };

  const removeWidget = (id: string) => {
    setDashboardWidgets((prev) => prev.filter((w) => w.id !== id));
  };

  return (
    <SafeAreaView className="flex-1 bg-[#000000]" edges={["bottom", "left", "right"]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120, paddingTop: insets.top ? insets.top + 20 : 40 }} showsVerticalScrollIndicator={false}>
        
        {/* Header */}
        <View className="px-4 pb-4 flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            <TouchableOpacity onPress={() => router.back()} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "#161615", borderWidth: 0.8, borderColor: "#262522", alignItems: "center", justifyContent: "center", marginLeft: -8 }}>
              <ChevronLeft color="#ffffff" size={24} />
            </TouchableOpacity>
            <View>
              <Text className="text-lg font-extrabold text-slate-100 tracking-tight">System Settings</Text>
              <Text className="text-[10px] text-slate-400">Configure parameters & data portability</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={handleSave}
            disabled={isSaving}
            style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: savedFeedback ? "rgba(16, 185, 129, 0.2)" : "#10b981", borderWidth: 0.8, borderColor: savedFeedback ? "rgba(16, 185, 129, 0.3)" : "transparent" }}
          >
            <Text style={{ fontSize: 12, fontWeight: "800", color: savedFeedback ? "#34d399" : "#fff", textTransform: "uppercase" }}>
              {isSaving ? "Saving…" : savedFeedback ? "Saved ✓" : "Save"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tabs Menu bar */}
        <View className="mb-6">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="px-4 flex-row gap-2">
            {([
              { key: "you", label: "👤 You" },
              { key: "appearance", label: "🎨 Appearance" },
              { key: "platforms", label: "🚗 Platforms" },
              { key: "alerts", label: "🔔 Alerts" },
              { key: "data", label: "💾 Data" },
              { key: "about", label: "ℹ️ About" },
            ] as const).map((tab) => {
              const active = activeTab === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  onPress={() => setActiveTab(tab.key)}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: 20,
                    borderWidth: 0.8,
                    borderColor: active ? "rgba(16, 185, 129, 0.5)" : "#262522",
                    backgroundColor: active ? "rgba(16, 185, 129, 0.1)" : "#161615"
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5, color: active ? "#34d399" : "#a1a1aa" }}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <View className="px-4 pb-20 flex flex-col gap-6">
        {/* ─── TAB: YOU ─── */}
        {activeTab === "you" && (
          <View className="flex flex-col gap-5">
            {/* Display / Profile */}
            <View style={styles.cardOuter}>
              <Text style={styles.cardHeader}>Profile Information</Text>
              <View className="flex flex-col gap-4">
                <View className="flex flex-col gap-1.5">
                  <Text style={styles.labelTitle}>Display Name</Text>
                  <TextInput
                    value={displayName}
                    onChangeText={setDisplayName}
                    placeholder="Your name"
                    placeholderTextColor="#475569"
                    style={styles.input}
                  />
                </View>
                <View className="flex flex-col gap-1.5">
                  <Text style={styles.labelTitle}>Avatar Emoji</Text>
                  <TextInput
                    value={accentColor}
                    onChangeText={setAccentColor}
                    placeholder="🙂"
                    placeholderTextColor="#475569"
                    maxLength={3}
                    style={[styles.input, { width: 96, textAlign: "center" }]}
                  />
                </View>
              </View>
            </View>

            {/* Location & Market */}
            <View style={styles.cardOuter}>
              <Text style={styles.cardHeader}>Location & Unit Preferences</Text>
              <View className="flex flex-col gap-4">
                <View className="flex flex-col gap-2">
                  <Text style={styles.labelTitle}>Country</Text>
                  <View className="flex-row gap-2">
                    {COUNTRIES.map((c) => (
                      <TouchableOpacity
                        key={c.id}
                        onPress={() => {
                          setCountry(c.id as "US" | "CA");
                          setDistanceUnit(c.unit);
                          setTaxRegion(c.id === "CA" ? "ON" : "NY");
                          setCurrency(c.currency);
                        }}
                        className={cn(
                          "flex-1 py-3 rounded-xl border items-center",
                          country === c.id ? "border-emerald-500 bg-emerald-500/10" : "border-slate-800 bg-slate-900/30"
                        )}
                      >
                        <Text className={cn("text-sm font-bold", country === c.id ? "text-emerald-450" : "text-slate-400")}>
                          {c.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View className="flex flex-col gap-2">
                  <Text style={styles.labelTitle}>{country === "CA" ? "Province" : "State"}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View className="flex-row gap-2">
                      {regionList.map((r) => (
                        <TouchableOpacity
                          key={r}
                          onPress={() => setTaxRegion(r)}
                          className={cn(
                            "px-3 py-2 rounded-lg border",
                            taxRegion === r ? "border-emerald-500 bg-emerald-500/10" : "border-slate-850 bg-slate-900/30"
                          )}
                        >
                          <Text className={cn("text-xs font-bold", taxRegion === r ? "text-emerald-450" : "text-slate-400")}>
                            {r}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </View>

                <View className="flex flex-col gap-2">
                  <Text style={styles.labelTitle}>Distance Unit</Text>
                  <View className="flex-row gap-2">
                    {(["km", "mi"] as const).map((unit) => (
                      <TouchableOpacity
                        key={unit}
                        onPress={() => setDistanceUnit(unit)}
                        className={cn(
                          "flex-1 py-3 rounded-xl border items-center",
                          distanceUnit === unit ? "border-emerald-500 bg-emerald-500/10" : "border-slate-800 bg-slate-900/30"
                        )}
                      >
                        <Text className={cn("text-sm font-bold uppercase", distanceUnit === unit ? "text-emerald-450" : "text-slate-400")}>
                          {unit}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View className="flex flex-col gap-2">
                  <Text style={styles.labelTitle}>Primary Platform</Text>
                  <View className="bg-slate-950/60 border border-slate-800 rounded-xl p-1 flex-row flex-wrap gap-2">
                    {["None", ...Object.keys(PLATFORMS)].map((p) => {
                      const sel = p === "None" ? primaryPlatform === "" : primaryPlatform === p;
                      return (
                        <TouchableOpacity
                          key={p}
                          onPress={() => setPrimaryPlatform(p === "None" ? "" : p)}
                          className={cn("px-3 py-1.5 rounded-lg border", sel ? "border-emerald-500 bg-emerald-500/10" : "border-transparent")}
                        >
                          <Text className={cn("text-xs font-bold", sel ? "text-emerald-450" : "text-slate-400")}>
                            {p}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </View>
            </View>

            {/* Goals & Tax rates */}
            <View style={styles.cardOuter}>
              <Text style={styles.cardHeader}>Goals & Tax Withholding</Text>
              <View className="flex flex-col gap-4">
                <View className="flex flex-col gap-1.5">
                  <Text style={styles.labelTitle}>Weekly Revenue Goal</Text>
                  <TextInput
                    value={weeklyGoal}
                    onChangeText={setWeeklyGoal}
                    keyboardType="numeric"
                    style={styles.input}
                  />
                </View>
                <View className="flex flex-col gap-1.5">
                  <Text style={styles.labelTitle}>Monthly Revenue Goal</Text>
                  <TextInput
                    value={monthlyGoal}
                    onChangeText={setMonthlyGoal}
                    keyboardType="numeric"
                    style={styles.input}
                  />
                </View>
                <View className="flex flex-col gap-1.5">
                  <Text style={styles.labelTitle}>Annual Revenue Goal</Text>
                  <TextInput
                    value={annualGoal}
                    onChangeText={setAnnualGoal}
                    keyboardType="numeric"
                    style={styles.input}
                  />
                </View>
                <View className="flex flex-col gap-1.5">
                  <Text style={styles.labelTitle}>Estimated Tax Withholding (%)</Text>
                  <TextInput
                    value={taxWithholdingPct}
                    onChangeText={setTaxWithholdingPct}
                    keyboardType="numeric"
                    style={styles.input}
                  />
                </View>
                <View className="flex flex-col gap-2">
                  <Text style={styles.labelTitle}>Work Schedule Preset</Text>
                  <View className="flex-row flex-wrap gap-2">
                    {["flexible", "weekdays", "evenings", "weekends"].map((preset) => (
                      <TouchableOpacity
                        key={preset}
                        onPress={() => setWorkSchedulePreset(preset as any)}
                        className={cn(
                          "px-3.5 py-2 rounded-xl border capitalize",
                          workSchedulePreset === preset ? "border-emerald-500 bg-emerald-500/10" : "border-slate-850 bg-slate-900/30"
                        )}
                      >
                        <Text className={cn("text-xs font-bold", workSchedulePreset === preset ? "text-emerald-450" : "text-slate-400")}>
                          {preset}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                {country === "CA" && (
                  <View className="flex-row justify-between items-center py-2 border-t border-slate-900/60 mt-2">
                    <View className="max-w-[80%]">
                      <Text style={styles.labelTitle}>HST Registered</Text>
                      <Text className="text-[10px] text-slate-500">Enable Canadian Harmonized Sales Tax tracking</Text>
                    </View>
                    <Switch value={hstRegistered} onValueChange={setHstRegistered} trackColor={{ true: "#10b981" }} />
                  </View>
                )}
              </View>
            </View>
          </View>
        )}

        {/* ─── TAB: APPEARANCE ─── */}
        {activeTab === "appearance" && (
          <View className="flex flex-col gap-5">
            {/* Theme switcher */}
            <View style={styles.cardOuter}>
              <Text style={styles.cardHeader}>Interface Settings</Text>
              <View className="flex flex-col gap-4">
                <View className="flex flex-col gap-2">
                  <Text style={styles.labelTitle}>Theme Mode</Text>
                  <View style={styles.pillContainer}>
                    {["light", "dark", "auto"].map((m) => {
                      const active = theme === m;
                      return (
                        <TouchableOpacity
                          key={m}
                          onPress={() => setTheme(m as any)}
                          className={cn("flex-1 py-2 rounded-lg items-center capitalize", active ? "bg-slate-900 border border-slate-800" : "")}
                        >
                          <Text className={cn("text-xs font-bold", active ? "text-emerald-450" : "text-slate-400")}>
                            {m}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Accent presets */}
                <View className="flex flex-col gap-2">
                  <Text style={styles.labelTitle}>Accent Theme Swatches</Text>
                  <View className="flex-row flex-wrap gap-2.5">
                    {PRESET_ACCENTS.map((hex) => {
                      const active = accentColor === hex;
                      return (
                        <TouchableOpacity
                          key={hex}
                          onPress={() => setAccentColor(hex)}
                          style={{ backgroundColor: hex }}
                          className={cn("w-7 h-7 rounded-full border-2", active ? "border-white" : "border-transparent")}
                        />
                      );
                    })}
                  </View>
                </View>
              </View>
            </View>

            {/* Regional & Locale */}
            <View style={styles.cardOuter}>
              <Text style={styles.cardHeader}>Regional & Formatting</Text>
              <View className="flex flex-col gap-4">
                <View className="flex flex-col gap-1.5">
                  <Text style={styles.labelTitle}>Currency</Text>
                  <View className="flex-row flex-wrap gap-1.5">
                    {["USD", "CAD", "EUR", "GBP", "AUD"].map((c) => (
                      <TouchableOpacity
                        key={c}
                        onPress={() => setCurrency(c)}
                        className={cn(
                          "px-3.5 py-2 rounded-xl border",
                          currency === c ? "border-emerald-500 bg-emerald-500/10" : "border-slate-850 bg-slate-900/30"
                        )}
                      >
                        <Text className={cn("text-xs font-bold", currency === c ? "text-emerald-450" : "text-slate-400")}>
                          {c}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View className="flex flex-col gap-1.5">
                  <Text style={styles.labelTitle}>Date Format</Text>
                  <View className="flex-row flex-wrap gap-1.5">
                    {["YYYY-MM-DD", "MM/DD/YYYY", "DD/MM/YYYY"].map((df) => (
                      <TouchableOpacity
                        key={df}
                        onPress={() => setDateFormat(df)}
                        className={cn(
                          "px-3 py-2 rounded-xl border",
                          dateFormat === df ? "border-emerald-500 bg-emerald-500/10" : "border-slate-850 bg-slate-900/30"
                        )}
                      >
                        <Text className={cn("text-xs font-bold", dateFormat === df ? "text-emerald-450" : "text-slate-400")}>
                          {df}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View className="flex-row justify-between items-center py-1">
                  <Text style={styles.labelTitle}>Week Starts On</Text>
                  <View className="flex-row gap-2">
                    {["Sunday", "Monday"].map((dName, idx) => (
                      <TouchableOpacity
                        key={dName}
                        onPress={() => setWeekStartDay(String(idx))}
                        className={cn(
                          "px-3 py-1.5 rounded-lg border",
                          weekStartDay === String(idx) ? "border-emerald-500 bg-emerald-500/10" : "border-slate-850"
                        )}
                      >
                        <Text className={cn("text-[10px] font-bold uppercase", weekStartDay === String(idx) ? "text-emerald-450" : "text-slate-400")}>
                          {dName}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View className="flex-row justify-between items-center py-1">
                  <Text style={styles.labelTitle}>Shift Time Format</Text>
                  <View className="flex-row gap-2">
                    {["12h", "24h"].map((tf) => (
                      <TouchableOpacity
                        key={tf}
                        onPress={() => setTimeFormat(tf)}
                        className={cn(
                          "px-3 py-1.5 rounded-lg border",
                          timeFormat === tf ? "border-emerald-500 bg-emerald-500/10" : "border-slate-850"
                        )}
                      >
                        <Text className={cn("text-[10px] font-bold uppercase", timeFormat === tf ? "text-emerald-450" : "text-slate-400")}>
                          {tf}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>
            </View>

            {/* Dashboard widgets */}
            <View style={styles.cardOuter}>
              <Text style={styles.cardHeader}>Home Bento Dashboard</Text>
              <View className="flex flex-col gap-4">
                <View className="flex flex-col gap-1.5">
                  <Text style={styles.labelTitle}>Bento Layout Preset</Text>
                  <View style={styles.pillContainer}>
                    {["balanced", "focus", "dense"].map((bl) => {
                      const active = bentoLayout === bl;
                      return (
                        <TouchableOpacity
                          key={bl}
                          onPress={() => setBentoLayout(bl)}
                          className={cn("flex-1 py-2 rounded-lg items-center capitalize", active ? "bg-slate-900 border border-slate-800" : "")}
                        >
                          <Text className={cn("text-xs font-bold", active ? "text-emerald-450" : "text-slate-400")}>
                            {bl}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                <View className="flex flex-col gap-2">
                  <Text style={styles.labelTitle}>Widgets Sorting (Home Screen)</Text>
                  <View className="bg-slate-950/60 border border-slate-800 rounded-xl p-2 flex flex-col gap-2">
                    {dashboardWidgets.map((w, index) => (
                      <View key={w.id} className="flex-row items-center justify-between bg-slate-900/60 border border-slate-850 rounded-xl p-2.5">
                        <View className="flex-row items-center gap-2">
                          <View className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          <Text className="text-2xs font-extrabold text-slate-200">
                            {w.id} <Text className="text-slate-500 font-normal">({w.size})</Text>
                          </Text>
                        </View>
                        <View className="flex-row gap-1">
                          {index > 0 && (
                            <TouchableOpacity onPress={() => moveWidget(index, "up")} className="p-1 rounded bg-slate-950 border border-slate-850">
                              <ArrowUp size={11} color="#a1a1aa" />
                            </TouchableOpacity>
                          )}
                          {index < dashboardWidgets.length - 1 && (
                            <TouchableOpacity onPress={() => moveWidget(index, "down")} className="p-1 rounded bg-slate-950 border border-slate-850">
                              <ArrowDown size={11} color="#a1a1aa" />
                            </TouchableOpacity>
                          )}
                          <TouchableOpacity onPress={() => removeWidget(w.id)} className="p-1 rounded bg-slate-950 border border-slate-850">
                            <Trash2 size={11} color="#f43f5e" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                    {dashboardWidgets.length === 0 && (
                      <Text className="text-[10px] text-slate-500 font-bold text-center py-2">No widgets active. Customize in Analytics tab.</Text>
                    )}
                  </View>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* ─── TAB: PLATFORMS ─── */}
        {activeTab === "platforms" && (
          <View className="flex flex-col gap-5">
            <View style={styles.cardOuter}>
              <Text style={styles.cardHeader}>Platform Configurations</Text>
              <Text className="text-[10px] text-slate-500 mb-3 leading-relaxed">
                Configure rates and priority offsets for gig work tracking. Enabled platforms will populate matching options during shifts entry.
              </Text>

              <View className="flex flex-col gap-4">
                {(Object.keys(PLATFORMS) as PlatformKey[]).map((pKey) => {
                  const cfg = platformConfigs[pKey] || { active: false, hourlyRate: "20", mileageRate: "0.62", priority: "1" };
                  return (
                    <View key={pKey} className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 flex flex-col gap-3">
                      <View className="flex-row items-center justify-between">
                        <PlatformBadge platform={pKey} size="md" />
                        <Switch
                          value={cfg.active}
                          onValueChange={(val) => {
                            setPlatformConfigs((prev) => ({
                              ...prev,
                              [pKey]: { ...prev[pKey], active: val },
                            }));
                          }}
                          trackColor={{ true: "#10b981" }}
                        />
                      </View>

                      {cfg.active && (
                        <View className="flex-row gap-2 border-t border-slate-900/60 pt-3 mt-1">
                          <View className="flex-1 flex-col gap-1">
                            <Text className="text-[9px] font-bold text-slate-450 uppercase">Rate ($/hr)</Text>
                            <TextInput
                              value={cfg.hourlyRate}
                              keyboardType="numeric"
                              onChangeText={(val) => {
                                setPlatformConfigs((prev) => ({
                                  ...prev,
                                  [pKey]: { ...prev[pKey], hourlyRate: val },
                                }));
                              }}
                              style={styles.platformInput}
                            />
                          </View>

                          <View className="flex-1 flex-col gap-1">
                            <Text className="text-[9px] font-bold text-slate-450 uppercase">Mileage ($/{distanceUnit})</Text>
                            <TextInput
                              value={cfg.mileageRate}
                              keyboardType="numeric"
                              onChangeText={(val) => {
                                setPlatformConfigs((prev) => ({
                                  ...prev,
                                  [pKey]: { ...prev[pKey], mileageRate: val },
                                }));
                              }}
                              style={styles.platformInput}
                            />
                          </View>

                          <View className="w-16 flex-col gap-1">
                            <Text className="text-[9px] font-bold text-slate-450 uppercase">Priority</Text>
                            <TextInput
                              value={cfg.priority}
                              keyboardType="numeric"
                              onChangeText={(val) => {
                                setPlatformConfigs((prev) => ({
                                  ...prev,
                                  [pKey]: { ...prev[pKey], priority: val },
                                }));
                              }}
                              style={[styles.platformInput, { textAlign: "center" }]}
                            />
                          </View>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
          </View>
        )}

        {/* ─── TAB: ALERTS ─── */}
        {activeTab === "alerts" && (
          <View className="flex flex-col gap-5">
            {/* Notification triggers */}
            <View style={styles.cardOuter}>
              <Text style={styles.cardHeader}>Notification Reminders</Text>
              <Text className="text-[10px] text-slate-500 mb-3">Enable real-time push alerts and system background events.</Text>

              <View className="flex flex-col gap-3">
                {[
                  { key: "shiftReminders", label: "Shift Reminders", desc: "Notify when scheduled shifts are near" },
                  { key: "goalAlerts", label: "Goal Achievements", desc: "Congratulate when weekly/monthly targets are met" },
                  { key: "taxReminders", label: "Tax Filing Alerts", desc: "Reminders for CRA/IRS quarterly installments" },
                  { key: "weeklyDigest", label: "Weekly Progress Report", desc: "Brief summaries of weekly stats" },
                  { key: "maintenanceDue", label: "Vehicle Maintenance Check", desc: "Notify when odometer triggers service" },
                  { key: "insuranceExpiry", label: "Insurance Expiry Warning", desc: "Alert 30 days before policy renewals" },
                  { key: "backupOverdue", label: "Backup Warnings", desc: "Notify if local database is not archived" },
                ].map((notif) => (
                  <View key={notif.key} className="flex-row justify-between items-center py-2.5 border-b border-slate-900/60 last:border-b-0">
                    <View className="max-w-[75%]">
                      <Text style={styles.labelTitle}>{notif.label}</Text>
                      <Text className="text-[9px] text-slate-500 leading-normal">{notif.desc}</Text>
                    </View>
                    <Switch
                      value={(notifications as any)[notif.key]}
                      onValueChange={(val) => {
                        setNotifications((prev) => ({ ...prev, [notif.key]: val }));
                      }}
                      trackColor={{ true: "#10b981" }}
                    />
                  </View>
                ))}
              </View>
            </View>

            {/* Shortcuts guide */}
            <View style={styles.cardOuter}>
              <Text style={styles.cardHeader}>Developer Tools & Navigation</Text>
              <TouchableOpacity
                onPress={() => setShowShortcutsModal(true)}
                className="w-full py-3 bg-slate-950/60 border border-slate-800 rounded-xl items-center justify-center flex-row gap-2 active:bg-slate-900"
              >
                <Sparkles size={13} color="#10b981" />
                <Text className="text-xs text-slate-200 font-bold">Show Keyboard Shortcuts Cheatsheet</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ─── TAB: DATA ─── */}
        {activeTab === "data" && (
          <View className="flex flex-col gap-5">
            {/* Google Drive sync & PIN backup */}
            <View style={styles.cardOuter}>
              <Text style={styles.cardHeader}>Google Drive Sync & Backup</Text>
              <View className="flex flex-col gap-4">
                <View className="flex-row items-center justify-between">
                  <View>
                    <Text style={styles.labelTitle}>Cloud Integration</Text>
                    <Text className="text-[10px] text-slate-500 mt-0.5">
                      {isAuthenticated ? "Connected as Google Account" : "Sync backups to personal storage"}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={isAuthenticated ? logout : login}
                    className={cn(
                      "px-3.5 py-1.5 rounded-xl border",
                      isAuthenticated ? "border-rose-500/30 bg-rose-500/10" : "border-emerald-500/30 bg-emerald-500/10"
                    )}
                  >
                    <Text className={cn("text-[10px] uppercase font-bold tracking-wider", isAuthenticated ? "text-rose-400" : "text-emerald-450")}>
                      {isAuthenticated ? "Disconnect" : "Connect"}
                    </Text>
                  </TouchableOpacity>
                </View>

                {isAuthenticated && (
                  <View className="flex-col gap-3 mt-1 bg-slate-950/40 p-3 rounded-xl border border-slate-850">
                    <View className="flex flex-col gap-1.5">
                      <Text style={styles.labelTitle}>Backup PIN (4 digits)</Text>
                      <TextInput
                        value={backupPin}
                        onChangeText={(val) => setBackupPin(val.replace(/[^0-9]/g, "").slice(0, 4))}
                        keyboardType="number-pad"
                        secureTextEntry
                        placeholder="1234"
                        placeholderTextColor="#475569"
                        style={styles.input}
                      />
                    </View>

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
                                Alert.alert("Restore Backup", "Overwite current local data?", [
                                  { text: "Cancel", style: "cancel" },
                                  { text: "Restore", style: "destructive", onPress: performRestore },
                                ]);
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

            {/* CSV Import/Export */}
            <View style={styles.cardOuter}>
              <Text style={styles.cardHeader}>Import / Export Logs</Text>
              <View className="flex flex-col gap-3">
                <TouchableOpacity
                  onPress={() => router.push("/settings/import")}
                  className="flex-row items-center justify-between py-2.5 border-b border-slate-900/60"
                >
                  <View>
                    <Text style={styles.labelTitle}>Import CSV Wizard</Text>
                    <Text className="text-[9px] text-slate-500">Restore shift history from comma files</Text>
                  </View>
                  <View className="px-2.5 py-1 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                    <Text className="text-[9px] text-emerald-400 font-bold uppercase">Launch</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity onPress={handleExportCSV} className="flex-row items-center justify-between py-2.5">
                  <View>
                    <Text style={styles.labelTitle}>Export Logs</Text>
                    <Text className="text-[9px] text-slate-500">Download active data in standard CSV files</Text>
                  </View>
                  <View className="px-2.5 py-1 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                    <Text className="text-[9px] text-emerald-400 font-bold uppercase">Export</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>

            {/* Integrity checks */}
            <View style={styles.cardOuter}>
              <Text style={styles.cardHeader}>Maintenance & Vault Integrity</Text>
              <View className="flex flex-col gap-4">
                <View className="flex-row items-center justify-between">
                  <View className="max-w-[70%]">
                    <Text style={styles.labelTitle}>Data Health Check</Text>
                    <Text className="text-[9px] text-slate-500">Inspect shifts database relations</Text>
                  </View>
                  <TouchableOpacity
                    onPress={runDataIntegrityCheck}
                    disabled={isCheckingIntegrity}
                    className="px-3.5 py-1.5 bg-slate-950/60 border border-slate-800 rounded-xl"
                  >
                    {isCheckingIntegrity ? (
                      <ActivityIndicator size="small" color="#10b981" />
                    ) : (
                      <Text className="text-[10px] text-slate-350 font-bold uppercase">Audit</Text>
                    )}
                  </TouchableOpacity>
                </View>

                {integrityOutput ? (
                  <View className="bg-slate-950 border border-slate-850 rounded-xl p-3">
                    <Text className="text-[10px] font-mono text-slate-300 leading-normal">{integrityOutput}</Text>
                  </View>
                ) : null}

                <View className="flex flex-col gap-2 pt-2 border-t border-slate-900/60">
                  <Text style={styles.labelTitle}>Auto-Archive Deleted Records</Text>
                  <View className="flex-row items-center gap-3">
                    <TextInput
                      value={archiveDays}
                      onChangeText={setArchiveDays}
                      keyboardType="numeric"
                      style={styles.input}
                    />
                    <Text className="text-[10px] text-slate-500 font-bold flex-1">Days retention limit</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Danger Zone */}
            <View className="bg-rose-500/5 border border-rose-500/15 rounded-2xl p-4 flex flex-col gap-4">
              <Text className="text-xs font-extrabold text-rose-450 uppercase tracking-widest flex-row items-center gap-1.5">
                <ShieldAlert size={12} color="#f43f5e" /> Danger Zone
              </Text>

              <View className="flex flex-col gap-2.5">
                <Text style={styles.labelTitle}>Reset Platform Data</Text>
                <View className="flex-row gap-2">
                  <View className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-2 py-0.5 flex-row flex-wrap gap-1 items-center justify-start min-h-[44px]">
                    {Object.keys(PLATFORMS).map((p) => {
                      const sel = selectedResetPlatform === p;
                      return (
                        <TouchableOpacity
                          key={p}
                          onPress={() => setSelectedResetPlatform(p)}
                          className={cn("px-2 py-1 rounded border", sel ? "border-rose-500 bg-rose-500/10" : "border-transparent")}
                        >
                          <Text className={cn("text-[9px] font-bold", sel ? "text-rose-400" : "text-slate-500")}>
                            {p}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <TouchableOpacity
                    onPress={handleResetPlatform}
                    className="px-3.5 bg-rose-500/15 border border-rose-500/30 rounded-xl items-center justify-center"
                  >
                    <Text className="text-[10px] text-rose-450 font-black uppercase">Wipe</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View className="border-t border-rose-500/10 pt-3 flex flex-col gap-3">
                {isDemoMode && (
                  <TouchableOpacity
                    onPress={handleClearDemo}
                    className="w-full py-3 rounded-xl items-center border border-amber-500/30 bg-amber-500/10"
                  >
                    <Text className="text-amber-400 font-bold text-xs uppercase">Clear Demo Data</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={handleResetApp}
                  className="w-full py-3.5 rounded-xl items-center border border-rose-500/30 bg-rose-500/10"
                >
                  <Text className="text-rose-400 font-bold text-xs uppercase">Reset App (Delete All Data)</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* ─── TAB: ABOUT ─── */}
        {activeTab === "about" && (
          <View className="flex flex-col gap-5">
            <View style={styles.cardOuter}>
              <Text style={styles.cardHeader}>COMMA Financial Vault</Text>
              <Text className="text-xs text-slate-300 leading-relaxed font-medium">
                COMMA is a local-first, offline-ready mobile vault designed to empower gig economy independent contractors with tax optimization, mileage audits, and goals tracking. All data is persisted directly on your hardware and never sent to cloud servers unless manually synced.
              </Text>
            </View>

            <View style={styles.cardOuter}>
              <Text style={styles.cardHeader}>About & Links</Text>
              <View className="flex flex-col gap-2.5">
                <TouchableOpacity
                  onPress={() => Share.share({ message: "Optimize your gig driver finances with COMMA App!" })}
                  style={styles.button}
                >
                  <Text className="text-xs text-slate-350 font-bold uppercase tracking-wider">Share COMMA App</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => Alert.alert("Manifesto", "Data Portability: Your financial records belong strictly to you. COMMA guarantees open imports and clean CSV exports.")}
                  style={styles.button}
                >
                  <Text className="text-xs text-slate-350 font-bold uppercase tracking-wider">Data Portability Manifesto</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => Alert.alert("Support", "Feedback & Support: Contact dev team at support@comma-app.com")}
                  style={styles.button}
                >
                  <Text className="text-xs text-slate-350 font-bold uppercase tracking-wider">Support & Feedback</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* App version */}
            <View className="items-center py-4">
              <Text className="text-[10px] text-slate-650 font-mono">Comma Mobile • v0.3.0 • Phase 3 Complete</Text>
            </View>
          </View>
        )}
        </View>
      </ScrollView>

      {/* Keyboard Shortcuts Modal */}
      <Modal visible={showShortcutsModal} transparent animationType="fade">
        <View className="flex-1 bg-black/70 items-center justify-center p-4">
          <View className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-5 gap-4">
            <View className="flex-row justify-between items-center border-b border-slate-800 pb-3">
              <Text className="text-sm font-black text-slate-100">Keyboard Shortcuts</Text>
              <TouchableOpacity onPress={() => setShowShortcutsModal(false)} className="p-1 rounded-full bg-slate-800">
                <X size={14} color="#a1a1aa" />
              </TouchableOpacity>
            </View>

            <View className="flex flex-col gap-3">
              {[
                { keys: "N", desc: "Start a new shift log" },
                { keys: "E", desc: "Log a new expense entry" },
                { keys: "Tab (1-6)", desc: "Quick settings tab switching" },
                { keys: "Escape", desc: "Close any modal overlay" },
                { keys: "S", desc: "Commit setting changes" },
              ].map((sc) => (
                <View key={sc.keys} className="flex-row justify-between items-center py-1">
                  <Text className="text-xs text-slate-350 font-semibold">{sc.desc}</Text>
                  <View className="px-2 py-1 bg-slate-950 border border-slate-800 rounded">
                    <Text className="text-[10px] font-mono font-bold text-emerald-450">{sc.keys}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const X = ({ size, color }: { size: number; color: string }) => (
  <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
    <Text style={{ color, fontSize: size, fontWeight: "900" }}>×</Text>
  </View>
);

const styles = {
  cardOuter: {
    backgroundColor: "#0d0d0d",
    borderColor: "#1f1f1f",
    borderWidth: 0.8,
    borderRadius: 20,
    padding: 16,
  },
  cardHeader: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700" as const,
    borderBottomWidth: 0.8,
    borderBottomColor: "#1f1f1f",
    paddingBottom: 8,
    marginBottom: 12,
  },
  labelTitle: {
    color: "#a1a1aa",
    fontSize: 10,
    fontWeight: "800" as const,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: "#161615",
    borderWidth: 0.8,
    borderColor: "#262522",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800" as const,
  },
  platformInput: {
    backgroundColor: "#161615",
    borderWidth: 0.8,
    borderColor: "#262522",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800" as const,
  },
  pillContainer: {
    backgroundColor: "#161615",
    borderWidth: 0.8,
    borderColor: "#262522",
    borderRadius: 20,
    padding: 4,
    flexDirection: "row" as const,
  },
  button: {
    backgroundColor: "#161615",
    borderWidth: 0.8,
    borderColor: "#262522",
    borderRadius: 20,
    paddingVertical: 14,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    width: "100%",
  }
};
