/**
 * SettingsScreen.tsx
 *
 * Tab-based settings for COMMA.  Architecture mirrors the PWA modules:
 *   You · Appearance · Platforms · Alerts · Data · About
 *
 * TODO: Once stable, extract each tab into its own file:
 *   ./tabs/YouTab.tsx · ./tabs/AppearanceTab.tsx · etc.
 *
 * Design approach:
 *   iOS-style grouped sections — one card per logical group, dividers inside.
 *   Single StyleSheet, no Tailwind className. All colours from the `DS` token object.
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Switch,
  ScrollView,
  Modal,
  Alert,
  ActivityIndicator,
  StyleSheet,
  Platform,
  Share,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import * as FileSystem from "expo-file-system/legacy";
import { eq } from "drizzle-orm";
import { ChevronLeft, ArrowUp, ArrowDown, Trash2, Check, ChevronDown, ChevronUp } from "lucide-react-native";
import * as LocalAuthentication from "expo-local-authentication";

import { useSettingsStore, type DriverProfile } from "@/store/useSettingsStore";
import { PLATFORMS, type PlatformKey, getPlatformsByCountry } from "@/src/registry/platforms";
import { listCaProvinceCodes, listUsStateCodes } from "@/src/registry/tax/withholdingPresets";
import { getMileagePresetRate, getRegionsByCountry } from "@/src/registry/provinces/index";
import { getCountryDef } from "@/src/registry/countries/index";
import { resolveAvailablePlatformIds } from "@/src/registry/market/resolve";
import { insertTaxHistory } from "@/src/database/queries/tax";
import { getDBPlatforms, updateDBPlatform } from "@/src/database/queries/platforms";
import { PlatformBadge } from "@/src/components/ui/PlatformBadge";
import { db } from "@/src/database/client";
import { settings, shifts, expenses } from "@/src/database/schema";
import { useGoogleDriveSync } from "@/hooks/useGoogleDriveSync";
import { generateShiftsCSV, generateExpensesCSV } from "@/utils/reportGenerator";
import { usePlatformTheme } from "@/src/hooks/usePlatformTheme";

// ─── Design tokens ──────────────────────────────────────────────────────────

/** Single source of truth for all colours and radii. */
const DS = {
  pageBg: "#000000",
  cardBg: "#0c0c0c",
  cardBorder: "#1e1e1e",
  inputBg: "#161616",
  inputBorder: "#2a2a2a",
  sep: "#1a1a1a",

  brand: "#ffffff",
  brandSurface: "rgba(255, 255, 255, 0.08)",
  brandBorder: "rgba(255, 255, 255, 0.18)",
  brandText: "#ffffff",

  danger: "#f43f5e",
  dangerSurface: "rgba(244,63,94,0.07)",
  dangerBorder: "rgba(244,63,94,0.22)",
  dangerText: "#fb7185",

  textPrimary: "#e8e7e0",
  textSecondary: "#6a6963",
  textMuted: "#38372f",
  textLabel: "#48473f",   // floating section labels

  rCard: 18,
  rInput: 11,
  rChip: 8,
  rPill: 20,

  pagePad: 16,
  cardPad: 15,
  rowPad: 13,
} as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const isWeb = Platform.OS === "web";

async function upsertSetting(key: string, value: string): Promise<void> {
  if (isWeb) {
    localStorage.setItem(`comma_setting_${key}`, value);
    return;
  }
  await db
    .insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } });
}

async function readSetting(key: string): Promise<string> {
  if (isWeb) return localStorage.getItem(`comma_setting_${key}`) ?? "";
  const rows = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
  return rows[0]?.value ?? "";
}

// ─── Primitive components ────────────────────────────────────────────────────

/** Floating uppercase label above a card group — matches PWA `settings-section-title`. */
function GroupLabel({ text }: { text: string }) {
  return <Text style={s.groupLabel}>{text.toUpperCase()}</Text>;
}

/** Rounded card surface. Pass `danger` for the red-tinted danger zone variant. */
function Card({
  children,
  danger = false,
}: {
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <View
      style={[
        s.card,
        danger && {
          backgroundColor: DS.dangerSurface,
          borderColor: DS.dangerBorder,
        },
      ]}
    >
      {children}
    </View>
  );
}

/** Hairline separator between rows inside a card. */
function Sep() {
  return <View style={s.sep} />;
}

/**
 * Settings row.
 *
 * - Default (inline=true): label on the left, `children` pinned to the right.
 *   Best for Switch, small Segmented, or a single action button.
 *
 * - Block (block=true): label above, `children` full-width below.
 *   Best for chip groups, large inputs, or any control that needs breathing room.
 */
function Row({
  label,
  hint,
  children,
  block = false,
  last = false,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  block?: boolean;
  last?: boolean;
}) {
  return (
    <>
      {block ? (
        <View style={s.rowBlock}>
          <Text style={s.rowLabel}>{label}</Text>
          {hint ? <Text style={s.rowHint}>{hint}</Text> : null}
          <View style={s.rowBlockBody}>{children}</View>
        </View>
      ) : (
        <View style={s.rowInline}>
          <View style={s.rowInlineLabel}>
            <Text style={s.rowLabel}>{label}</Text>
            {hint ? <Text style={s.rowHint}>{hint}</Text> : null}
          </View>
          <View style={s.rowInlineControl}>{children}</View>
        </View>
      )}
      {!last && <Sep />}
    </>
  );
}

/** Pill-shaped segmented control. Works for 2–3 options. */
function Segmented<T extends string>({
  options,
  value,
  onChange,
  style,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  style?: any;
}) {
  return (
    <View style={[s.segmented, style]}>
      {options.map((opt) => {
        const on = opt.value === value;
        return (
          <TouchableOpacity
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={[s.segBtn, on && s.segBtnOn]}
          >
            <Text style={[s.segText, on && s.segTextOn]}>{opt.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/** Horizontally-wrapping chip group for multi-option or single-select lists. */
function Chips<T extends string>({
  options,
  value,
  onChange,
  scrollable = false,
  danger = false,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  scrollable?: boolean;
  danger?: boolean;
}) {
  const { accentColor, accentColorDim, accentColorMid } = usePlatformTheme();
  const chips = (
    <View style={s.chips}>
      {options.map((opt) => {
        const on = opt.value === value;
        return (
          <TouchableOpacity
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={[
              s.chip,
              on && (danger ? s.chipDangerOn : { borderColor: accentColorMid, backgroundColor: accentColorDim }),
            ]}
          >
            <Text
              style={[
                s.chipText,
                on && (danger ? s.chipTextDangerOn : { color: accentColor }),
              ]}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  return scrollable ? (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      {chips}
    </ScrollView>
  ) : (
    chips
  );
}

/** Right-aligned inline text input — narrow, for use inside Row inline mode. */
function InlineInput(props: React.ComponentProps<typeof TextInput>) {
  return (
    <TextInput
      placeholderTextColor={DS.textMuted}
      style={[s.inlineInput, props.style]}
      {...props}
    />
  );
}

/** Full-width text input — for use in block rows or standalone. */
function FullInput(props: React.ComponentProps<typeof TextInput>) {
  return (
    <TextInput
      placeholderTextColor={DS.textMuted}
      style={[s.fullInput, props.style]}
      {...props}
    />
  );
}

/** Small utility button. Three visual variants. */
function Btn({
  label,
  onPress,
  variant = "ghost",
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  variant?: "ghost" | "primary" | "danger";
  disabled?: boolean;
}) {
  const { accentColor, accentColorDim, accentColorMid } = usePlatformTheme();
  const v = {
    ghost: { bg: DS.inputBg, border: DS.inputBorder, text: DS.textSecondary },
    primary: { bg: accentColorDim, border: accentColorMid, text: accentColor },
    danger: { bg: DS.dangerSurface, border: DS.dangerBorder, text: DS.dangerText },
  }[variant];

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[s.btn, { backgroundColor: v.bg, borderColor: v.border, opacity: disabled ? 0.5 : 1 }]}
    >
      <Text style={[s.btnText, { color: v.text }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Static data ─────────────────────────────────────────────────────────────

const COUNTRIES = [
  { id: "CA", label: "🇨🇦 Canada", unit: "km" as const, currency: "CAD" },
  { id: "US", label: "🇺🇸 United States", unit: "mi" as const, currency: "USD" },
  { id: "UK", label: "🇬🇧 United Kingdom", unit: "mi" as const, currency: "GBP" },
  { id: "NP", label: "🇳🇵 Nepal", unit: "km" as const, currency: "NPR" },
] as const;

const CA_PROVINCES = listCaProvinceCodes();
const US_STATES = listUsStateCodes();

const WORK_PRESETS = [
  { value: "flexible", label: "Flexible" },
  { value: "weekdays", label: "Weekdays" },
  { value: "evenings", label: "Evenings" },
  { value: "weekends", label: "Weekends" },
] as const;

const PRESET_ACCENTS = [
  "#ffffff", "#22c55e", "#3b82f6", "#8b5cf6",
  "#f59e0b", "#ef4444", "#f97316", "#14b8a6",
  "#e11d48", "#22c55e", "#6366f1", "#6b7280",
];

const DATE_FORMATS = [
  { value: "YYYY-MM-DD", label: "ISO" },
  { value: "MM/DD/YYYY", label: "US" },
  { value: "DD/MM/YYYY", label: "EU" },
] as const;

const CURRENCIES = ["USD", "CAD", "EUR", "GBP", "AUD"] as const;

const KEYBOARD_SHORTCUTS = [
  { keys: "g  d", desc: "Go to Dashboard" },
  { keys: "g  s", desc: "Go to Shifts" },
  { keys: "g  t", desc: "Go to Tax" },
  { keys: "g  v", desc: "Go to Vehicles" },
  { keys: "⌘ K", desc: "Open search" },
  { keys: "/", desc: "Quick search" },
  { keys: "Esc", desc: "Close overlays" },
];

type TabId = "you" | "appearance" | "platforms" | "alerts" | "data";

const TABS: { id: TabId; label: string }[] = [
  { id: "you", label: "You" },
  { id: "appearance", label: "Appearance" },
  { id: "platforms", label: "Platforms" },
  { id: "alerts", label: "Alerts" },
  { id: "data", label: "Data" },
];

type PlatformConfig = {
  active: boolean;
  hourlyRate: string;
  mileageRate: string;
  priority: string;
  customLabel?: string;
  customColor?: string;
  customEmoji?: string;
};

type NotifPrefs = {
  shiftReminders: boolean;
  goalAlerts: boolean;
  taxReminders: boolean;
  weeklyDigest: boolean;
  maintenanceDue: boolean;
  insuranceExpiry: boolean;
  backupOverdue: boolean;
};



// ─── Main screen ─────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const { accentColor, accentColorDim, accentColorMid, accentColorContrast } = usePlatformTheme();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ tab?: string }>();
  const {
    profile,
    isDemoMode,
    loadSettings,
    resetSettings,
    clearSampleData,
    updateProfile,
    dbPlatforms,
  } = useSettingsStore();

  const [dashWidgets, setDashWidgets] = useState<string[]>([]);

  // ── UI state ────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TabId>("you");
  const [isSaving, setIsSaving] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  // ── Tab: You ────────────────────────────────────────────────────────────────
  const [displayName, setDisplayName] = useState(profile?.displayName ?? "");
  const [country, setCountry] = useState<"US" | "CA" | "UK" | "NP">(profile?.country ?? "CA");
  const [taxRegion, setTaxRegion] = useState(profile?.taxRegion ?? "ON");
  const [distanceUnit, setDistanceUnit] = useState<"km" | "mi">(profile?.distanceUnit ?? "km");
  const [isEditingYou, setIsEditingYou] = useState(false);

  // States for changing country flow
  const [selectedNewCountry, setSelectedNewCountry] = useState<"US" | "CA" | "UK" | "NP" | null>(null);
  const [incompatiblePlatforms, setIncompatiblePlatforms] = useState<string[]>([]);

  const handleSelectCountry = (newCountryId: "CA" | "US" | "UK" | "NP") => {
    if (newCountryId === profile?.country) {
      setCountry(newCountryId);
      // Reset back to profile values
      setTaxRegion(profile.taxRegion ?? "ON");
      setDistanceUnit(profile.distanceUnit ?? "km");
      if (profile.locale?.currency) setCurrency(profile.locale.currency);
      return;
    }

    const newCountryDef = getCountryDef(newCountryId);
    const defaultRegion = newCountryDef.tax.defaultRegionCode;
    const availablePlatformIds = resolveAvailablePlatformIds(newCountryId, defaultRegion);

    const activePlatformKeys = Object.keys(platformConfigs).filter((k) => platformConfigs[k]?.active);
    const incompatible = activePlatformKeys.filter((k) => !availablePlatformIds.includes(k));

    setIncompatiblePlatforms(incompatible);
    setSelectedNewCountry(newCountryId);
  };

  const confirmCountryChange = async () => {
    if (!selectedNewCountry) return;

    const newCountryDef = getCountryDef(selectedNewCountry);
    const defaultRegion = newCountryDef.tax.defaultRegionCode;

    // 1. Update the location states
    setCountry(selectedNewCountry);
    setTaxRegion(defaultRegion);
    setDistanceUnit(newCountryDef.distanceUnit);
    setCurrency(newCountryDef.currency);

    // 2. Load platform configs for the new country from DB, and deactivate incompatible ones
    const dbPlatforms = await getDBPlatforms(selectedNewCountry);
    const configs: Record<string, PlatformConfig> = {};
    dbPlatforms.forEach((p, idx) => {
      configs[p.id] = {
        active: p.isActive,
        hourlyRate: p.hourlyRate,
        mileageRate: p.mileageRate,
        priority: String(p.sortPriority || idx + 1),
        customLabel: p.label,
        customColor: p.color,
        customEmoji: p.logoEmoji || "",
      };
    });

    incompatiblePlatforms.forEach((k) => {
      if (configs[k]) {
        configs[k] = { ...configs[k], active: false };
      }
    });
    setPlatformConfigs(configs);

    // 3. Record tax history entry for the transition!
    const oldRegion = profile?.taxRegion || null;
    const oldRate = profile?.taxWithholdingPct || null;
    const newRate = newCountryDef.tax.defaultWithholdingPct;

    await insertTaxHistory({
      oldRegion: oldRegion ? `${profile.country}-${oldRegion}` : null,
      oldRate,
      newRegion: `${selectedNewCountry}-${defaultRegion}`,
      newRate,
    });

    // 4. Close modal
    setSelectedNewCountry(null);
    setIncompatiblePlatforms([]);
  };

  // ── Tab: Appearance ─────────────────────────────────────────────────────────
  const [theme, setTheme] = useState<"auto" | "light" | "dark">(profile?.theme ?? "dark");
  const [selectedAccent, setSelectedAccent] = useState(
    (profile?.avatarData && profile?.avatarData.startsWith("#")) ? profile.avatarData : "#ffffff"
  );
  const [currency, setCurrency] = useState<string>(profile?.locale?.currency ?? "CAD");
  const [dateFormat, setDateFormat] = useState<string>(profile?.locale?.dateFormat ?? "YYYY-MM-DD");
  const [weekStartDay, setWeekStartDay] = useState<string>(String(profile?.locale?.weekStartDay ?? "0"));
  const [timeFormat, setTimeFormat] = useState<"12h" | "24h">(profile?.locale?.timeFormat ?? "12h");


  // ── Tab: Platforms ──────────────────────────────────────────────────────────
  const [platformConfigs, setPlatformConfigs] = useState<Record<string, PlatformConfig>>({});
  const [showOtherPlatforms, setShowOtherPlatforms] = useState(false);
  const [expandedPlatforms, setExpandedPlatforms] = useState<Record<string, boolean>>({});
  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const [newPlatformLabel, setNewPlatformLabel] = useState("");
  const [newPlatformColor, setNewPlatformColor] = useState("#a855f7");
  const [newPlatformEmoji, setNewPlatformEmoji] = useState("🚲");

  // ── Tab: Alerts ─────────────────────────────────────────────────────────────
  const [notifs, setNotifs] = useState<NotifPrefs>({
    shiftReminders: true,
    goalAlerts: true,
    taxReminders: true,
    weeklyDigest: false,
    maintenanceDue: true,
    insuranceExpiry: true,
    backupOverdue: false,
  });

  // ── Tab: Data ───────────────────────────────────────────────────────────────
  const [integrityResult, setIntegrityResult] = useState("");
  const [isCheckingIntegrity, setIsCheckingIntegrity] = useState(false);
  const [archiveDays, setArchiveDays] = useState("30");
  const [resetPlatformTarget, setResetPlatformTarget] = useState("");
  const [exportedThisSession, setExportedThisSession] = useState(false);

  // Google Drive sync hook — swap with your actual implementation
  const {
    isAuthenticated, isBackingUp, isRestoring,
    backups, login, logout, triggerBackup, triggerRestore,
  } = useGoogleDriveSync();
  const [backupPin, setBackupPin] = useState("1234");

  // ── Navigate to tab from route param ────────────────────────────────────────
  useEffect(() => {
    const tab = params.tab as TabId | undefined;
    if (tab && TABS.some((t) => t.id === tab)) setActiveTab(tab);
  }, [params.tab]);

  // ── Sync profile → local state ───────────────────────────────────────────────
  useEffect(() => {
    setDisplayName(profile?.displayName ?? "");
    setCountry((profile?.country ?? "CA") as "US" | "CA" | "UK" | "NP");
    setTaxRegion(profile?.taxRegion ?? "ON");
    setDistanceUnit(profile?.distanceUnit ?? "km");
    setTheme(profile?.theme ?? "dark");
    setSelectedAccent(
      (profile?.avatarData && profile?.avatarData.startsWith("#")) ? profile.avatarData : "#ffffff"
    );

    if (profile?.locale) {
      if (profile.locale.currency) setCurrency(profile.locale.currency);
      if (profile.locale.dateFormat) setDateFormat(profile.locale.dateFormat);
      if (profile.locale.weekStartDay !== undefined) setWeekStartDay(String(profile.locale.weekStartDay));
      if (profile.locale.timeFormat) setTimeFormat(profile.locale.timeFormat);
    }
  }, [profile]);

  // ── Load persisted settings (widgets, platform configs, notifs) ──────────────
  useEffect(() => {
    (async () => {
      try {
        const [dbPlatforms, notifsRaw, weekStartRaw] = await Promise.all([
          getDBPlatforms(profile.country),
          readSetting("notification_prefs"),
          readSetting("week_start_day"),
        ]);

        if (weekStartRaw) setWeekStartDay(weekStartRaw);

        const configs: Record<string, PlatformConfig> = {};
        dbPlatforms.forEach((p, idx) => {
          configs[p.id] = {
            active: p.isActive,
            hourlyRate: p.hourlyRate,
            mileageRate: p.mileageRate,
            priority: String(p.sortPriority || idx + 1),
            customLabel: p.label,
            customColor: p.color,
            customEmoji: p.logoEmoji || "",
          };
        });
        setPlatformConfigs(configs);

        if (notifsRaw) setNotifs(JSON.parse(notifsRaw));
      } catch (e) {
        console.error("[settings] failed to load persisted settings", e);
      }
    })();
  }, [profile]);

  // ── Save ─────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const activePlatforms = Object.keys(platformConfigs).filter(
        (k) => platformConfigs[k].active,
      );

      // Use updateProfile — it auto-derives country defs and persists
      await updateProfile({
        displayName: displayName.trim() || profile?.displayName || "Driver",
        country: country as DriverProfile["country"],
        taxRegion,
        distanceUnit,
        selectedPlatforms: activePlatforms,
        theme: theme as DriverProfile["theme"],
        avatarData: selectedAccent,
        locale: {
          ...(profile.locale ?? {}),
          currency,
          dateFormat,
          weekStartDay: parseInt(weekStartDay, 10),
          timeFormat,
        },
      });

      // Save platform customizations (hourlyRate, mileageRate, sortPriority) to DB
      for (const pKey of Object.keys(platformConfigs)) {
        await updateDBPlatform(country, pKey, {
          isActive: platformConfigs[pKey].active,
          hourlyRate: platformConfigs[pKey].hourlyRate,
          mileageRate: platformConfigs[pKey].mileageRate,
          sortPriority: parseInt(platformConfigs[pKey].priority, 10) || 1,
          label: platformConfigs[pKey].customLabel,
          color: platformConfigs[pKey].customColor,
          logoEmoji: platformConfigs[pKey].customEmoji || null,
        });
      }

      await Promise.all([
        upsertSetting("notification_prefs", JSON.stringify(notifs)),
        upsertSetting("week_start_day", weekStartDay),
      ]);

      const refreshed = await getDBPlatforms(country);
      useSettingsStore.setState({ dbPlatforms: refreshed });

      queryClient.invalidateQueries();
      setSavedFeedback(true);
      setTimeout(() => setSavedFeedback(false), 2000);
    } catch (err: any) {
      Alert.alert("Save failed", err?.message ?? "Unknown error.");
    } finally {
      setIsSaving(false);
    }
  };

  // ── Danger actions ────────────────────────────────────────────────────────────
  const authenticateWithBiometrics = async (reason: string): Promise<boolean> => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hasHardware || !isEnrolled) {
        return true;
      }
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

  const confirmResetApp = () => {
    const run = async () => {
      const authenticated = await authenticateWithBiometrics("Confirm Identity to Reset Vault");
      if (!authenticated) {
        Alert.alert("Authentication failed", "Reset cancelled.");
        return;
      }
      await resetSettings();
      queryClient.invalidateQueries();
      router.replace("/");
    };
    Alert.alert(
      "Reset entire vault",
      "All data will be permanently deleted. This cannot be undone.",
      [{ text: "Cancel", style: "cancel" }, { text: "Reset", style: "destructive", onPress: run }],
    );
  };

  const confirmResetPlatform = () => {
    if (!resetPlatformTarget) return;
    Alert.alert(
      "Reset platform data",
      `Delete all shift records for ${resetPlatformTarget}? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const authenticated = await authenticateWithBiometrics(`Wipe ${resetPlatformTarget} Data`);
            if (!authenticated) {
              Alert.alert("Authentication failed", "Wipe cancelled.");
              return;
            }
            await db.delete(shifts).where(eq(shifts.platform, resetPlatformTarget));
            queryClient.invalidateQueries();
            Alert.alert("Done", `${resetPlatformTarget} data wiped.`);
          },
        },
      ],
    );
  };

  // ── Export CSV ───────────────────────────────────────────────────────────────
  const handleExportCSV = () => {
    const doExport = async (type: "shifts" | "expenses") => {
      const start = new Date(0);
      const end = new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000);
      const csv = type === "shifts"
        ? await generateShiftsCSV(start, end)
        : await generateExpensesCSV(start, end);
      const fname = `comma_${type}_${new Date().toISOString().slice(0, 10)}.csv`;

      if (isWeb) {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
        a.download = fname;
        a.click();
        URL.revokeObjectURL(a.href);
      } else {
        const uri = FileSystem.cacheDirectory + fname;
        await FileSystem.writeAsStringAsync(uri, csv, { encoding: FileSystem.EncodingType.UTF8 });
        await Share.share({ url: uri });
      }
      setExportedThisSession(true);
    };

    Alert.alert("Export CSV", "Which data?", [
      { text: "Cancel", style: "cancel" },
      { text: "Shifts", onPress: () => doExport("shifts") },
      { text: "Expenses", onPress: () => doExport("expenses") },
    ]);
  };

  // ── Integrity check ─────────────────────────────────────────────────────────
  const runIntegrityCheck = async () => {
    setIsCheckingIntegrity(true);
    try {
      const [shiftList, expenseList] = await Promise.all([
        db.select().from(shifts),
        db.select().from(expenses),
      ]);
      const issues: string[] = [];
      shiftList.forEach((s: any) => {
        if (!s.startTime || isNaN(new Date(s.startTime).getTime()))
          issues.push(`Shift #${s.id}: invalid start time`);
      });
      expenseList.forEach((e: any) => {
        if (!e.date || isNaN(new Date(e.date).getTime()))
          issues.push(`Expense #${e.id}: invalid date`);
      });
      setIntegrityResult(
        issues.length ? issues.join("\n") : "No issues found — vault is clean.",
      );
    } finally {
      setIsCheckingIntegrity(false);
    }
  };

  // ── Widget order helpers ──────────────────────────────────────────────────────
  const moveWidget = (i: number, dir: "up" | "down") => {
    const arr = [...dashWidgets];
    const j = dir === "up" ? i - 1 : i + 1;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    setDashWidgets(arr);
  };



  const regions = useMemo(() => {
    return getRegionsByCountry(country).map((r) => r.id);
  }, [country]);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={s.safe} edges={["bottom", "left", "right"]}>

      {/* ── Header ── */}
      <View style={[s.header, { paddingTop: insets.top + 10 }]}>
        <View style={s.headerLeft}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <ChevronLeft color={DS.textPrimary} size={20} />
          </TouchableOpacity>
          <View>
            <Text style={s.headerTitle}>Settings</Text>
            <Text style={s.headerSub}>Configure your vault</Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={handleSave}
          disabled={isSaving}
          style={[
            s.saveBtn,
            { backgroundColor: accentColor },
            savedFeedback && { backgroundColor: accentColorDim, borderColor: accentColorMid, borderWidth: 0.5 }
          ]}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color={accentColorContrast} />
          ) : savedFeedback ? (
            <Check size={14} color={accentColor} />
          ) : (
            <Text style={[s.saveBtnText, { color: accentColorContrast }]}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Tab bar ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.tabScroll}
        contentContainerStyle={s.tabRow}
      >
        {TABS.map(({ id, label }) => {
          const on = activeTab === id;
          return (
            <TouchableOpacity
              key={id}
              onPress={() => setActiveTab(id)}
              style={[
                s.tab,
                on && { backgroundColor: accentColorDim, borderColor: accentColorMid }
              ]}
            >
              <Text style={[s.tabText, on && { color: accentColor }]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── Tab content ── */}
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* ═══════════════════ TAB: YOU ═══════════════════ */}
        {activeTab === "you" && (
          <>
            {isDemoMode && (
              <>
                <GroupLabel text="Demo Mode" />
                <Card>
                  <Row label="Demo data active" hint="Exit to configure your real account." last>
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

            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
              <GroupLabel text="Profile details" />
              <TouchableOpacity
                onPress={() => setIsEditingYou(!isEditingYou)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 5,
                  borderRadius: 12,
                  backgroundColor: isEditingYou ? accentColorDim : DS.inputBg,
                  borderWidth: 0.5,
                  borderColor: isEditingYou ? accentColorMid : DS.inputBorder,
                  marginTop: 14,
                }}
              >
                <Text style={{ color: isEditingYou ? accentColor : DS.textSecondary, fontSize: 11, fontWeight: "700" }}>
                  {isEditingYou ? "Done" : "Edit Profile"}
                </Text>
              </TouchableOpacity>
            </View>

            {isEditingYou ? (
              <>
                <Card>
                  <Row label="Display name" last={true}>
                    <InlineInput
                      value={displayName}
                      onChangeText={setDisplayName}
                      placeholder="Your name"
                    />
                  </Row>
                </Card>

                <GroupLabel text="Location" />
                <Card>
                  <Row label="Country" hint="Changing country resets currency, distance unit, and filters active platforms." block last={false}>
                    <Chips
                      options={COUNTRIES.map((c) => ({ value: c.id, label: c.label }))}
                      value={country}
                      onChange={(v) => handleSelectCountry(v as "CA" | "US" | "UK" | "NP")}
                    />
                  </Row>
                  <Row label={country === "CA" ? "Province" : country === "US" ? "State" : "Region"} block last={false}>
                    <Chips
                      options={regions.map((r: string) => ({ value: r, label: r }))}
                      value={taxRegion}
                      onChange={setTaxRegion}
                      scrollable
                    />
                  </Row>
                  <Row label="Distance unit" hint={`Locked to country metric (${distanceUnit})`} last>
                    <Text style={{ color: DS.textSecondary, fontSize: 14, fontWeight: "500" }}>
                      {distanceUnit}
                    </Text>
                  </Row>
                </Card>
              </>
            ) : (
              <>
                <Card>
                  <Row label="Display name" last={true}>
                    <Text style={{ color: DS.textPrimary, fontSize: 14, fontWeight: "500" }}>
                      {displayName || "Not set"}
                    </Text>
                  </Row>
                </Card>

                <GroupLabel text="Location" />
                <Card>
                  <Row label="Country" last={false}>
                    <Text style={{ color: DS.textPrimary, fontSize: 14, fontWeight: "500" }}>
                      {COUNTRIES.find((c) => c.id === country)?.label || country}
                    </Text>
                  </Row>
                  <Row label={country === "CA" ? "Province" : "State"} last={false}>
                    <Text style={{ color: DS.textPrimary, fontSize: 14, fontWeight: "500" }}>
                      {taxRegion}
                    </Text>
                  </Row>
                  <Row label="Distance unit" last={true}>
                    <Text style={{ color: DS.textPrimary, fontSize: 14, fontWeight: "500" }}>
                      {distanceUnit}
                    </Text>
                  </Row>
                </Card>
              </>
            )}
          </>
        )}

        {/* ═══════════════════ TAB: APPEARANCE ═══════════════════ */}
        {activeTab === "appearance" && (
          <>
            <GroupLabel text="Interface" />
            <Card>
              <Row label="Theme" block last={false}>
                <Segmented
                  options={[
                    { value: "auto" as const, label: "Auto" },
                    { value: "light" as const, label: "Light" },
                    { value: "dark" as const, label: "Dark" },
                  ]}
                  value={theme}
                  onChange={setTheme}
                />
              </Row>
              <Row label="Accent color" block last>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={s.swatches}>
                    {PRESET_ACCENTS.map((hex) => {
                      const on = selectedAccent.toLowerCase() === hex;
                      return (
                        <TouchableOpacity
                          key={hex}
                          onPress={() => setSelectedAccent(hex)}
                          style={[
                            s.swatch,
                            { backgroundColor: hex },
                            on && { borderWidth: 2.5, borderColor: hex === "#ffffff" ? "#52525b" : "#ffffff" }
                          ]}
                        />
                      );
                    })}
                  </View>
                </ScrollView>
              </Row>
            </Card>

            <GroupLabel text="Regional & Locale" />
            <Card>
              <Row label="Currency" hint={`Locked to your country currency (${currency})`} last={false}>
                <Text style={{ color: DS.textSecondary, fontSize: 14, fontWeight: "500" }}>
                  {currency}
                </Text>
              </Row>
              <Row label="Date format" block last={false}>
                <Chips
                  options={DATE_FORMATS.map((d) => ({ value: d.value, label: d.label }))}
                  value={dateFormat as any}
                  onChange={setDateFormat as any}
                />
              </Row>
              <Row label="Week starts" last={false}>
                <Segmented
                  options={[{ value: "0", label: "Sun" }, { value: "1", label: "Mon" }]}
                  value={weekStartDay}
                  onChange={setWeekStartDay}
                />
              </Row>
              <Row label="Time format" last>
                <Segmented
                  options={[{ value: "12h" as const, label: "12h" }, { value: "24h" as const, label: "24h" }]}
                  value={timeFormat}
                  onChange={setTimeFormat}
                />
              </Row>
            </Card>


          </>
        )}

        {/* ═══════════════════ TAB: PLATFORMS ═══════════════════ */}
        {activeTab === "platforms" && (() => {
          const countryDef = getCountryDef(country);
          const platformKeys = dbPlatforms.filter(p => p.country === country).map((p) => p.id) as PlatformKey[];
          const activeKeys = platformKeys.filter((k) => platformConfigs[k]?.active);
          const inactiveKeys = platformKeys.filter((k) => !platformConfigs[k]?.active);

          const renderPlatformCard = (pKey: PlatformKey) => {
            const dbPlatform = dbPlatforms.find((p) => p.id === pKey);
            const cfg = platformConfigs[pKey] ?? {
              active: false, hourlyRate: "20", mileageRate: getMileagePresetRate(profile.country, profile.taxRegion), priority: "1",
              customLabel: dbPlatform?.label || PLATFORMS[pKey]?.label || pKey,
              customColor: dbPlatform?.color || PLATFORMS[pKey]?.color || "#71717a",
              customEmoji: dbPlatform?.logoEmoji || "",
            };
            const updateCfg = (patch: Partial<PlatformConfig>) =>
              setPlatformConfigs((p) => ({ ...p, [pKey]: { ...p[pKey], ...patch } }));

            const isExpanded = !!expandedPlatforms[pKey];
            const toggleExpand = () => setExpandedPlatforms((prev) => ({ ...prev, [pKey]: !prev[pKey] }));

            const resolvedLabel = cfg.customLabel || dbPlatform?.label || PLATFORMS[pKey]?.label || pKey;

            return (
              <Card key={pKey}>
                <TouchableOpacity
                  activeOpacity={cfg.active ? 0.7 : 1.0}
                  onPress={cfg.active ? toggleExpand : undefined}
                  style={[s.rowInline, { minHeight: 52 }]}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                    <PlatformBadge platform={pKey} size="sm" />
                    <View style={{ flex: 1 }}>
                      <Text style={s.rowLabel}>{resolvedLabel}</Text>
                      {cfg.active && (
                        <Text style={[s.rowHint, { color: accentColor }]}>
                          {isExpanded ? "Hide settings" : "Configure settings"}
                        </Text>
                      )}
                    </View>
                    {cfg.active && (
                      <View style={{ marginRight: 4 }}>
                        {isExpanded ? (
                          <ChevronUp size={16} color={DS.textSecondary} />
                        ) : (
                          <ChevronDown size={16} color={DS.textSecondary} />
                        )}
                      </View>
                    )}
                  </View>
                  <View style={s.rowInlineControl}>
                    <Switch
                      value={cfg.active}
                      onValueChange={(v) => {
                        updateCfg({ active: v });
                        if (v) {
                          setExpandedPlatforms((prev) => ({ ...prev, [pKey]: true }));
                        }
                      }}
                      trackColor={{ false: DS.inputBorder, true: accentColor }}
                      thumbColor="#fff"
                    />
                  </View>
                </TouchableOpacity>

                {cfg.active && isExpanded && (
                  <>
                    <Sep />
                    {(pKey === "other" || pKey.startsWith("custom_")) && (
                      <>
                        <Row label="Platform Name" last={false}>
                          <InlineInput
                            value={cfg.customLabel ?? ""}
                            placeholder="e.g. Pathao"
                            onChangeText={(v) => updateCfg({ customLabel: v })}
                          />
                        </Row>
                        <Row label="Theme Color" last={false}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                            <InlineInput
                              value={cfg.customColor ?? ""}
                              placeholder="e.g. #a855f7"
                              onChangeText={(v) => updateCfg({ customColor: v })}
                              style={{ width: 100 }}
                            />
                            <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: cfg.customColor || "#71717a" }} />
                          </View>
                        </Row>
                        <Row label="Logo/Emoji" last={false}>
                          <InlineInput
                            value={cfg.customEmoji ?? ""}
                            placeholder="e.g. 🚲"
                            onChangeText={(v) => updateCfg({ customEmoji: v })}
                            maxLength={2}
                            style={{ width: 60 }}
                          />
                        </Row>
                      </>
                    )}
                    <Row label="Hourly rate" last={false}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Segmented
                          options={[
                            { value: "custom" as const, label: "Rate" },
                            { value: "na" as const, label: "N/A" }
                          ]}
                          value={cfg.hourlyRate === "N/A" ? "na" : "custom"}
                          onChange={(v) => updateCfg({ hourlyRate: v === "na" ? "N/A" : "20" })}
                          style={{ minWidth: 90 }}
                        />
                        {cfg.hourlyRate !== "N/A" && (
                          <InlineInput
                            value={cfg.hourlyRate}
                            keyboardType="numeric"
                            onChangeText={(v) => updateCfg({ hourlyRate: v })}
                            style={{ minWidth: 60 }}
                          />
                        )}
                      </View>
                    </Row>
                    <Row label={`Mileage ($/${distanceUnit})`} last={false}>
                      <InlineInput
                        value={cfg.mileageRate}
                        keyboardType="numeric"
                        onChangeText={(v) => updateCfg({ mileageRate: v })}
                      />
                    </Row>
                    <Row label="Sort priority" last>
                      <InlineInput
                        value={cfg.priority}
                        keyboardType="numeric"
                        onChangeText={(v) => updateCfg({ priority: v })}
                      />
                    </Row>
                  </>
                )}
              </Card>
            );
          };

          return (
            <View style={{ gap: 12 }}>
              <View style={{
                backgroundColor: DS.inputBg,
                borderColor: DS.inputBorder,
                borderWidth: 1,
                borderRadius: 12,
                paddingVertical: 10,
                paddingHorizontal: 12,
                marginBottom: 4,
              }}>
                <Text style={{
                  color: DS.textSecondary,
                  fontSize: 10,
                  fontWeight: "800",
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}>
                  Platforms available in your region ({countryDef.label})
                </Text>
              </View>
              <GroupLabel text="Active Platforms" />
              {activeKeys.length === 0 ? (
                <Card>
                  <View style={{ padding: 16, alignItems: "center" }}>
                    <Text style={{ color: DS.textSecondary, fontSize: 12, fontStyle: "italic", textAlign: "center" }}>
                      No active platforms. Enable one below to get started.
                    </Text>
                  </View>
                </Card>
              ) : (
                activeKeys.map((pKey) => (
                  <View key={pKey}>
                    {renderPlatformCard(pKey)}
                  </View>
                ))
              )}

              {inactiveKeys.length > 0 && (
                <View style={{ marginTop: 8 }}>
                  <GroupLabel text="Other Available Platforms" />
                  <Card>
                    <TouchableOpacity
                      onPress={() => setShowOtherPlatforms(!showOtherPlatforms)}
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                        paddingVertical: 14,
                        paddingHorizontal: 16,
                      }}
                    >
                      <Text style={{ color: DS.textPrimary, fontSize: 13, fontWeight: "600" }}>
                        {showOtherPlatforms ? "Hide other platforms" : `Show other platforms (${inactiveKeys.length} available)`}
                      </Text>
                      <Text style={{ color: accentColor, fontSize: 16, fontWeight: "700" }}>
                        {showOtherPlatforms ? "−" : "+"}
                      </Text>
                    </TouchableOpacity>

                    {showOtherPlatforms && (
                      <View style={{ borderTopWidth: 0.5, borderTopColor: DS.sep, paddingTop: 6, paddingHorizontal: 16, paddingBottom: 14, gap: 12 }}>
                        {inactiveKeys.map((pKey, idx) => {
                          const cfg = platformConfigs[pKey] ?? {
                            active: false, hourlyRate: "20", mileageRate: getMileagePresetRate(profile.country, profile.taxRegion), priority: "1",
                          };
                          const updateCfg = (patch: Partial<PlatformConfig>) =>
                            setPlatformConfigs((p) => ({ ...p, [pKey]: { ...p[pKey], ...patch } }));

                          return (
                            <View
                              key={pKey}
                              style={{
                                flexDirection: "row",
                                justifyContent: "space-between",
                                alignItems: "center",
                                paddingVertical: 10,
                                borderBottomWidth: idx < inactiveKeys.length - 1 ? 0.5 : 0,
                                borderBottomColor: DS.sep,
                              }}
                            >
                              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                                <PlatformBadge platform={pKey} size="sm" />
                                <Text style={{ color: DS.textPrimary, fontSize: 13, fontWeight: "600" }}>
                                  {cfg.customLabel || dbPlatforms.find((p) => p.id === pKey)?.label || PLATFORMS[pKey]?.label || pKey}
                                </Text>
                              </View>
                              <Switch
                                value={cfg.active}
                                onValueChange={(v) => updateCfg({ active: v })}
                                trackColor={{ false: DS.inputBorder, true: accentColor }}
                                thumbColor="#fff"
                              />
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </Card>
                </View>
              )}

              {/* Add Custom Platform section */}
              <View style={{ marginTop: 12 }}>
                <GroupLabel text="Add Custom Platform" />
                <Card>
                  {!isAddingCustom ? (
                    <TouchableOpacity
                      onPress={() => setIsAddingCustom(true)}
                      style={{
                        flexDirection: "row",
                        justifyContent: "center",
                        alignItems: "center",
                        paddingVertical: 14,
                        paddingHorizontal: 16,
                        gap: 8,
                      }}
                    >
                      <Text style={{ color: accentColor, fontSize: 13, fontWeight: "700" }}>
                        + Create Custom Platform
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={{ padding: 16, gap: 12 }}>
                      <Text style={{ color: DS.textPrimary, fontSize: 13, fontWeight: "700", marginBottom: 4 }}>
                        New Custom Platform
                      </Text>
                      
                      <View style={{ gap: 6 }}>
                        <Text style={{ color: DS.textSecondary, fontSize: 11, fontWeight: "600" }}>Platform Name</Text>
                        <InlineInput
                          value={newPlatformLabel}
                          onChangeText={setNewPlatformLabel}
                          placeholder="e.g. Pathao, InDriver"
                          style={{ minHeight: 40, width: "100%", paddingHorizontal: 10 }}
                        />
                      </View>

                      <View style={{ flexDirection: "row", gap: 16 }}>
                        <View style={{ flex: 1, gap: 6 }}>
                          <Text style={{ color: DS.textSecondary, fontSize: 11, fontWeight: "600" }}>Theme Color</Text>
                          <InlineInput
                            value={newPlatformColor}
                            onChangeText={setNewPlatformColor}
                            placeholder="e.g. #22c55e"
                            style={{ minHeight: 40, width: "100%", paddingHorizontal: 10 }}
                          />
                        </View>
                        <View style={{ width: 80, gap: 6 }}>
                          <Text style={{ color: DS.textSecondary, fontSize: 11, fontWeight: "600" }}>Emoji Logo</Text>
                          <InlineInput
                            value={newPlatformEmoji}
                            onChangeText={setNewPlatformEmoji}
                            placeholder="e.g. 🚲"
                            maxLength={2}
                            style={{ minHeight: 40, width: "100%", textAlign: "center" }}
                          />
                        </View>
                      </View>

                      <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
                        <TouchableOpacity
                          onPress={() => {
                            setIsAddingCustom(false);
                            setNewPlatformLabel("");
                          }}
                          style={{
                            paddingVertical: 8,
                            paddingHorizontal: 12,
                            borderRadius: 6,
                            borderWidth: 1,
                            borderColor: DS.inputBorder,
                          }}
                        >
                          <Text style={{ color: DS.textSecondary, fontSize: 12, fontWeight: "600" }}>Cancel</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={async () => {
                            if (!newPlatformLabel.trim()) {
                              Alert.alert("Required", "Please enter a platform name.");
                              return;
                            }
                            const newId = `custom_platform_${Date.now()}`;
                            const defaultMileage = getMileagePresetRate(country, taxRegion);
                            
                            // Insert into database directly
                            await updateDBPlatform(country, newId, {
                              id: newId,
                              label: newPlatformLabel.trim(),
                              color: newPlatformColor.trim() || "#71717a",
                              textColor: "#ffffff",
                              country: country,
                              isActive: true,
                              hourlyRate: "20",
                              mileageRate: defaultMileage,
                              sortPriority: 10,
                              logoEmoji: newPlatformEmoji.trim() || null,
                            });

                            // Update local configs state so it shows up active immediately!
                            setPlatformConfigs(prev => ({
                              ...prev,
                              [newId]: {
                                active: true,
                                hourlyRate: "20",
                                mileageRate: defaultMileage,
                                priority: "10",
                                customLabel: newPlatformLabel.trim(),
                                customColor: newPlatformColor.trim() || "#71717a",
                                customEmoji: newPlatformEmoji.trim() || "",
                              }
                            }));

                            // Invalidate store and reload
                            const refreshed = await getDBPlatforms(country);
                            useSettingsStore.setState({ dbPlatforms: refreshed });

                            // Close the form
                            setIsAddingCustom(false);
                            setNewPlatformLabel("");
                            setNewPlatformColor("#a855f7");
                            setNewPlatformEmoji("🚲");
                          }}
                          style={{
                            paddingVertical: 8,
                            paddingHorizontal: 16,
                            borderRadius: 6,
                            backgroundColor: accentColor,
                          }}
                        >
                          <Text style={{ color: accentColorContrast, fontSize: 12, fontWeight: "700" }}>Add Platform</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </Card>
              </View>
            </View>
          );
        })()}

        {/* ═══════════════════ TAB: ALERTS ═══════════════════ */}
        {activeTab === "alerts" && (
          <>
            <GroupLabel text="Notification Reminders" />
            <Card>
              {([
                { key: "shiftReminders", label: "Shift reminders", hint: "Alert when a scheduled shift is near" },
                { key: "goalAlerts", label: "Goal achievements", hint: "Notify on weekly or monthly milestones" },
                { key: "taxReminders", label: "Tax filing alerts", hint: "CRA / IRS quarterly instalment reminders" },
                { key: "weeklyDigest", label: "Weekly digest", hint: "Summary stats delivered each week" },
                { key: "maintenanceDue", label: "Vehicle maintenance", hint: "Alert when odometer triggers a service window" },
                { key: "insuranceExpiry", label: "Insurance expiry", hint: "30-day warning before policy renewal" },
                { key: "backupOverdue", label: "Backup overdue", hint: "Notify if vault hasn't been archived recently" },
              ] as const).map(({ key, label, hint }, i, arr) => (
                <Row key={key} label={label} hint={hint} last={i === arr.length - 1}>
                  <Switch
                    value={notifs[key]}
                    onValueChange={(v) => setNotifs((p) => ({ ...p, [key]: v }))}
                    trackColor={{ false: DS.inputBorder, true: accentColor }}
                    thumbColor="#fff"
                  />
                </Row>
              ))}
            </Card>

            <GroupLabel text="Navigation" />
            <Card>
              <Row label="Keyboard shortcuts" hint="View all navigation combos" last>
                <Btn label="View" variant="ghost" onPress={() => setShowShortcuts(true)} />
              </Row>
            </Card>
          </>
        )}

        {/* ═══════════════════ TAB: DATA ═══════════════════ */}
        {activeTab === "data" && (
          <>
            <GroupLabel text="Cloud Backup" />
            <Card>
              <Row
                label="Google Drive"
                hint={isAuthenticated ? "Connected — sync active" : "Link your Drive to enable backups"}
                last={!isAuthenticated}
              >
                <Btn
                  label={isAuthenticated ? "Disconnect" : "Connect"}
                  variant={isAuthenticated ? "danger" : "primary"}
                  onPress={isAuthenticated ? logout : login}
                />
              </Row>
              {isAuthenticated && (
                <>
                  <Row label="Backup PIN" hint="4-digit PIN used to encrypt the backup file" last={false}>
                    <InlineInput
                      value={backupPin}
                      onChangeText={(v) => setBackupPin(v.replace(/\D/g, "").slice(0, 4))}
                      keyboardType="number-pad"
                      secureTextEntry
                      placeholder="1234"
                    />
                  </Row>
                  <Row label="Backup now" last={backups.length === 0}>
                    <Btn
                      label={isBackingUp ? "Backing up…" : "Run backup"}
                      variant="primary"
                      disabled={isBackingUp || isRestoring}
                      onPress={() => triggerBackup(backupPin).catch((e) => Alert.alert("Backup failed", e.message))}
                    />
                  </Row>
                  {backups.length > 0 && (
                    <>
                      <Sep />
                      {backups.map((b, i) => (
                        <Row
                          key={b.id}
                          label={b.name}
                          hint={new Date(b.createdTime).toLocaleString()}
                          last={i === backups.length - 1}
                        >
                          <Btn
                            label="Restore"
                            variant="ghost"
                            disabled={isBackingUp || isRestoring}
                            onPress={() =>
                              Alert.alert("Restore backup", "This will overwrite all local data.", [
                                { text: "Cancel", style: "cancel" },
                                {
                                  text: "Restore",
                                  style: "destructive",
                                  onPress: () =>
                                    triggerRestore(b.id, backupPin).catch((e) =>
                                      Alert.alert("Restore failed", e.message),
                                    ),
                                },
                              ])
                            }
                          />
                        </Row>
                      ))}
                    </>
                  )}
                </>
              )}
            </Card>

            <GroupLabel text="Import / Export" />
            <Card>
              <Row label="Export CSV" hint="Download shift or expense logs as CSV files" last={false}>
                <Btn label="Export" variant="ghost" onPress={handleExportCSV} />
              </Row>
              <Row label="Import CSV" hint="Restore shift history from a CSV file" last>
                <Btn label="Launch" variant="ghost" onPress={() => router.push("/settings/import")} />
              </Row>
            </Card>

            <GroupLabel text="Maintenance" />
            <Card>
              <Row label="Data health check" hint="Inspect database relations and date validity" last={false}>
                <Btn
                  label={isCheckingIntegrity ? "Checking…" : "Audit"}
                  variant="ghost"
                  disabled={isCheckingIntegrity}
                  onPress={runIntegrityCheck}
                />
              </Row>
              <Row
                label="Archive deleted records"
                hint={`Purge soft-deleted records older than ${archiveDays} days`}
                last
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <InlineInput
                    value={archiveDays}
                    onChangeText={setArchiveDays}
                    keyboardType="numeric"
                    style={{ minWidth: 48, textAlign: "center" }}
                  />
                  <Btn label="Run" variant="ghost" onPress={() => Alert.alert("Archive", `Would purge records older than ${archiveDays} days.`)} />
                </View>
              </Row>
            </Card>

            {integrityResult ? (
              <View style={s.preBlock}>
                <Text style={s.preText}>{integrityResult}</Text>
              </View>
            ) : null}

            <GroupLabel text="Danger Zone" />
            <Card danger>
              <Row
                label="Reset platform data"
                hint="Permanently deletes all shifts linked to a platform"
                block
                last={false}
              >
                <Chips
                  options={(Object.keys(PLATFORMS) as PlatformKey[]).map((p) => ({ value: p, label: p }))}
                  value={resetPlatformTarget as any}
                  onChange={setResetPlatformTarget as any}
                  danger
                />
                {resetPlatformTarget ? (
                  <View style={{ marginTop: 10 }}>
                    <Btn label={`Wipe ${resetPlatformTarget} data`} variant="danger" onPress={confirmResetPlatform} />
                  </View>
                ) : null}
              </Row>
              <Row
                label="Reset entire vault"
                hint="Permanently deletes all data. Cannot be undone."
                last
              >
                <Btn label="Reset app" variant="danger" onPress={confirmResetApp} />
              </Row>
            </Card>
          </>
        )}



        <View style={{ height: 48 }} />
      </ScrollView>

      {/* ── Keyboard shortcuts modal ── */}
      <Modal visible={showShortcuts} transparent animationType="fade">
        <TouchableOpacity
          style={s.overlay}
          activeOpacity={1}
          onPress={() => setShowShortcuts(false)}
        >
          <TouchableOpacity activeOpacity={1} style={s.overlayCard}>
            <View style={s.overlayHeader}>
              <Text style={s.overlayTitle}>Keyboard Shortcuts</Text>
              <TouchableOpacity onPress={() => setShowShortcuts(false)} style={s.overlayClose}>
                <Text style={{ color: DS.textSecondary, fontSize: 16, lineHeight: 16, fontWeight: "700" }}>×</Text>
              </TouchableOpacity>
            </View>
            {KEYBOARD_SHORTCUTS.map((sc) => (
              <View key={sc.keys} style={s.shortcutRow}>
                <Text style={s.shortcutDesc}>{sc.desc}</Text>
                <View style={s.kbdBadge}>
                  <Text style={s.kbdText}>{sc.keys}</Text>
                </View>
              </View>
            ))}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── Country change warning & compatibility audit modal ── */}
      <Modal visible={!!selectedNewCountry} transparent animationType="fade">
        <TouchableOpacity
          style={s.overlay}
          activeOpacity={1}
          onPress={() => {
            setCountry(profile.country as "CA" | "US" | "UK" | "NP");
            setSelectedNewCountry(null);
            setIncompatiblePlatforms([]);
          }}
        >
          <TouchableOpacity activeOpacity={1} style={s.overlayCard}>
            <View style={s.overlayHeader}>
              <Text style={s.overlayTitle}>Change Active Country</Text>
              <TouchableOpacity
                onPress={() => {
                  setCountry(profile.country as "CA" | "US" | "UK" | "NP");
                  setSelectedNewCountry(null);
                  setIncompatiblePlatforms([]);
                }}
                style={s.overlayClose}
              >
                <Text style={{ color: DS.textSecondary, fontSize: 16, lineHeight: 16, fontWeight: "700" }}>×</Text>
              </TouchableOpacity>
            </View>

            <Text style={{ color: DS.textPrimary, fontSize: 13, lineHeight: 18, fontWeight: "500" }}>
              Are you sure you want to change your active country to{" "}
              <Text style={{ color: accentColor, fontWeight: "800" }}>
                {COUNTRIES.find((c) => c.id === selectedNewCountry)?.label || selectedNewCountry}
              </Text>
              ? This is a drastic action that resets core regional settings.
            </Text>

            {/* Comparisons */}
            <View
              style={{
                backgroundColor: DS.inputBg,
                borderRadius: DS.rCard - 2,
                borderWidth: 0.5,
                borderColor: DS.inputBorder,
                padding: 12,
                gap: 8,
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: DS.textSecondary, fontSize: 11, fontWeight: "700" }}>Metric</Text>
                <Text style={{ color: DS.textSecondary, fontSize: 11, fontWeight: "700" }}>Change Details</Text>
              </View>
              <View style={{ height: 1, backgroundColor: DS.sep }} />
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: DS.textSecondary, fontSize: 12, fontWeight: "600" }}>Currency</Text>
                <Text style={{ color: DS.textPrimary, fontSize: 12, fontWeight: "700" }}>
                  {profile.locale?.currency || "CAD"} ➔ {selectedNewCountry ? getCountryDef(selectedNewCountry).currency : ""}
                </Text>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: DS.textSecondary, fontSize: 12, fontWeight: "600" }}>Distance Unit</Text>
                <Text style={{ color: DS.textPrimary, fontSize: 12, fontWeight: "700" }}>
                  {profile.distanceUnit || "km"} ➔ {selectedNewCountry ? getCountryDef(selectedNewCountry).distanceUnit : ""}
                </Text>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: DS.textSecondary, fontSize: 12, fontWeight: "600" }}>Default Tax Rate</Text>
                <Text style={{ color: DS.textPrimary, fontSize: 12, fontWeight: "700" }}>
                  {profile.taxWithholdingPct || 0}% ➔ {selectedNewCountry ? getCountryDef(selectedNewCountry).tax.defaultWithholdingPct : 0}%
                </Text>
              </View>
            </View>

            {/* Platform compatibility audit result */}
            <View
              style={{
                backgroundColor: incompatiblePlatforms.length > 0 ? DS.dangerSurface : "rgba(34, 197, 94, 0.05)",
                borderRadius: DS.rCard - 2,
                borderWidth: 0.5,
                borderColor: incompatiblePlatforms.length > 0 ? DS.dangerBorder : "rgba(34, 197, 94, 0.18)",
                padding: 12,
                gap: 6,
              }}
            >
              <Text
                style={{
                  color: incompatiblePlatforms.length > 0 ? DS.dangerText : "#22c55e",
                  fontSize: 11,
                  fontWeight: "800",
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                {incompatiblePlatforms.length > 0 ? "⚠️ Platform Compatibility Warning" : "✅ Platforms Compatible"}
              </Text>
              <Text style={{ color: DS.textPrimary, fontSize: 11.5, lineHeight: 16, fontWeight: "600" }}>
                {incompatiblePlatforms.length > 0
                  ? `The following active platforms are not available in the target market and will be automatically deactivated:\n${incompatiblePlatforms
                      .map((k) => PLATFORMS[k as PlatformKey]?.label || k)
                      .join(", ")}`
                  : "All of your currently active platforms are compatible with this country."}
              </Text>
            </View>

            <Text style={{ color: DS.textSecondary, fontSize: 10.5, lineHeight: 15, fontWeight: "600" }}>
              Note: Historical logs and stats will keep their logged numbers, but all forward estimations, mileage write-offs, and tax calculations will update immediately.
            </Text>

            {/* Actions */}
            <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
              <TouchableOpacity
                onPress={() => {
                  setCountry(profile.country as "CA" | "US" | "UK" | "NP");
                  setSelectedNewCountry(null);
                  setIncompatiblePlatforms([]);
                }}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: DS.rInput,
                  backgroundColor: DS.inputBg,
                  borderWidth: 0.5,
                  borderColor: DS.inputBorder,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: DS.textSecondary, fontSize: 12, fontWeight: "800" }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={confirmCountryChange}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: DS.rInput,
                  backgroundColor: accentColor,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: accentColorContrast, fontSize: 12, fontWeight: "800" }}>Confirm Change</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

// ─── StyleSheet ───────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: DS.pageBg },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: DS.pagePad, paddingTop: 4, paddingBottom: 60 },

  // ── Header ──────────────────────────────────────────────────────────────────
  header: { paddingHorizontal: DS.pagePad, paddingBottom: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerTitle: { color: DS.textPrimary, fontSize: 17, fontWeight: "700", letterSpacing: -0.3 },
  headerSub: { color: DS.textSecondary, fontSize: 10, marginTop: 1 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: DS.inputBg, borderWidth: 0.5, borderColor: DS.inputBorder, alignItems: "center", justifyContent: "center" },
  saveBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: DS.rPill, backgroundColor: DS.brand, minWidth: 64, alignItems: "center", justifyContent: "center" },
  saveBtnDone: { backgroundColor: DS.brandSurface, borderWidth: 0.5, borderColor: DS.brandBorder },
  saveBtnText: { color: "#000", fontSize: 12, fontWeight: "700" },

  // ── Tab bar ─────────────────────────────────────────────────────────────────
  tabScroll: { flexGrow: 0, marginBottom: 10 },
  tabRow: { paddingHorizontal: DS.pagePad, gap: 6, flexDirection: "row" },
  tab: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: DS.rPill, backgroundColor: DS.inputBg, borderWidth: 0.5, borderColor: DS.inputBorder },
  tabOn: { backgroundColor: DS.brandSurface, borderColor: DS.brandBorder },
  tabText: { fontSize: 12, fontWeight: "600", color: DS.textSecondary },
  tabTextOn: { color: DS.brandText },

  // ── Section label ───────────────────────────────────────────────────────────
  groupLabel: { fontSize: 10, fontWeight: "700", color: DS.textLabel, letterSpacing: 0.9, marginBottom: 6, marginTop: 20, textTransform: "uppercase", paddingHorizontal: 2 },

  // ── Card ─────────────────────────────────────────────────────────────────────
  card: { backgroundColor: DS.cardBg, borderRadius: DS.rCard, borderWidth: 0.5, borderColor: DS.cardBorder, overflow: "hidden" },

  // ── Separator ───────────────────────────────────────────────────────────────
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: DS.sep, marginHorizontal: DS.cardPad },

  // ── Row — inline (label left, control right) ─────────────────────────────
  rowInline: { flexDirection: "row", alignItems: "center", paddingHorizontal: DS.cardPad, paddingVertical: DS.rowPad, gap: 10 },
  rowInlineLabel: { flex: 1 },
  rowInlineControl: { flexShrink: 0, alignItems: "flex-end" },

  // ── Row — block (label above, control below) ─────────────────────────────
  rowBlock: { paddingHorizontal: DS.cardPad, paddingTop: DS.rowPad, paddingBottom: DS.rowPad },
  rowBlockBody: { marginTop: 10 },

  rowLabel: { color: DS.textPrimary, fontSize: 14, fontWeight: "500" },
  rowHint: { color: DS.textSecondary, fontSize: 10.5, marginTop: 2 },

  // ── Segmented control ───────────────────────────────────────────────────────
  segmented: { flexDirection: "row", backgroundColor: DS.inputBg, borderRadius: DS.rInput, borderWidth: 0.5, borderColor: DS.inputBorder, padding: 3, minWidth: 140 },
  segBtn: { flex: 1, paddingVertical: 5, borderRadius: DS.rInput - 2, alignItems: "center" },
  segBtnOn: { backgroundColor: DS.cardBg, borderWidth: 0.5, borderColor: DS.cardBorder },
  segText: { fontSize: 11, fontWeight: "600", color: DS.textSecondary },
  segTextOn: { color: DS.textPrimary },

  // ── Chips ────────────────────────────────────────────────────────────────────
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: DS.rChip, borderWidth: 0.5, borderColor: DS.inputBorder, backgroundColor: DS.inputBg },
  chipOn: { borderColor: DS.brandBorder, backgroundColor: DS.brandSurface },
  chipDangerOn: { borderColor: DS.dangerBorder, backgroundColor: DS.dangerSurface },
  chipText: { fontSize: 11, fontWeight: "600", color: DS.textSecondary },
  chipTextOn: { color: DS.brandText },
  chipTextDangerOn: { color: DS.dangerText },

  // ── Text inputs ──────────────────────────────────────────────────────────────
  inlineInput: {
    backgroundColor: DS.inputBg,
    borderRadius: DS.rInput,
    borderWidth: 0.5,
    borderColor: DS.inputBorder,
    color: DS.textPrimary,
    fontSize: 14,
    fontWeight: "500",
    paddingHorizontal: 12,
    paddingVertical: 7,
    minWidth: 90,
    textAlign: "right",
  },
  fullInput: {
    backgroundColor: DS.inputBg,
    borderRadius: DS.rInput,
    borderWidth: 0.5,
    borderColor: DS.inputBorder,
    color: DS.textPrimary,
    fontSize: 14,
    fontWeight: "500",
    paddingHorizontal: 14,
    paddingVertical: 11,
    width: "100%",
  },

  // ── Button ──────────────────────────────────────────────────────────────────
  btn: { paddingHorizontal: 13, paddingVertical: 7, borderRadius: DS.rInput, borderWidth: 0.5, flexDirection: "row", alignItems: "center", gap: 5 },
  btnText: { fontSize: 11, fontWeight: "700" },

  // ── Accent swatches ─────────────────────────────────────────────────────────
  swatches: { flexDirection: "row", gap: 8, paddingVertical: 2 },
  swatch: { width: 26, height: 26, borderRadius: 13 },
  swatchOn: { borderWidth: 2.5, borderColor: "#fff" },

  // ── Widget list (Appearance tab) ─────────────────────────────────────────────
  widgetList: { gap: 6 },
  widgetRow: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: DS.inputBg, borderRadius: 10, borderWidth: 0.5, borderColor: DS.inputBorder, paddingHorizontal: 10, paddingVertical: 8 },
  widgetDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: DS.brand },
  widgetLabel: { flex: 1, color: DS.textPrimary, fontSize: 12, fontWeight: "500" },
  widgetActions: { flexDirection: "row", gap: 4 },
  iconBtn: { width: 24, height: 24, borderRadius: 6, backgroundColor: DS.cardBg, borderWidth: 0.5, borderColor: DS.cardBorder, alignItems: "center", justifyContent: "center" },

  // ── Pre/code block (integrity output) ───────────────────────────────────────
  preBlock: { backgroundColor: DS.inputBg, borderRadius: DS.rCard, borderWidth: 0.5, borderColor: DS.inputBorder, padding: 14, marginTop: 8 },
  preText: { color: DS.textSecondary, fontSize: 11, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace", lineHeight: 17 },

  // ── Shortcuts modal ─────────────────────────────────────────────────────────
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "center", alignItems: "center", padding: 20 },
  overlayCard: { width: "100%", maxWidth: 360, backgroundColor: DS.cardBg, borderRadius: DS.rCard, borderWidth: 0.5, borderColor: DS.cardBorder, padding: 18, gap: 12 },
  overlayHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: DS.sep },
  overlayTitle: { color: DS.textPrimary, fontSize: 14, fontWeight: "700" },
  overlayClose: { width: 28, height: 28, borderRadius: 14, backgroundColor: DS.inputBg, borderWidth: 0.5, borderColor: DS.inputBorder, alignItems: "center", justifyContent: "center" },
  shortcutRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 2 },
  shortcutDesc: { color: DS.textSecondary, fontSize: 12 },
  kbdBadge: { backgroundColor: DS.inputBg, borderWidth: 0.5, borderColor: DS.inputBorder, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  kbdText: { color: DS.brandText, fontSize: 11, fontWeight: "700", fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
});