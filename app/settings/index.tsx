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
  TextInput,
  TouchableOpacity,
  Switch,
  ScrollView,
  Modal,
  Alert,
  ActivityIndicator,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { Text } from "@/src/components/ui/text";
import * as Sharing from "expo-sharing";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import * as FileSystem from "expo-file-system/legacy";
import { eq } from "drizzle-orm";
import { ChevronLeft, ChevronRight, ArrowUp, ArrowDown, Trash2, Check, ChevronDown, ChevronUp, Calculator, Target, CalendarDays, Trophy, FileText, BarChart2 } from "lucide-react-native";
import * as LocalAuthentication from "expo-local-authentication";

import { useSettingsStore, type DriverProfile } from "@/store/useSettingsStore";
import { PLATFORMS, type PlatformKey, getPlatformsByCountry } from "@/src/registry/platforms";
import { FEATURE_MODULES, listCaProvinceCodes, listUsStateCodes } from "@/src/registry/index";
import { GIG_DRIVER_DEFAULTS } from "@/src/hooks/useAppContext";
import { getMileagePresetRate, getRegionsByCountry, getCountryDef } from "@/src/registry/countries/index";
import { resolveAvailablePlatformIds } from "@/src/registry/market/resolve";
import { insertTaxHistory } from "@/src/database/queries/tax";
import { getDBPlatforms, updateDBPlatform } from "@/src/database/queries/platforms";
import { PlatformBadge } from "@/src/components/ui/PlatformBadge";
import { db } from "@/src/database/client";
import { settings, shifts, expenses } from "@/src/database/schema";
import { generateShiftsCSV, generateExpensesCSV } from "@/utils/reportGenerator";
import { usePlatformTheme } from "@/src/hooks/usePlatformTheme";
import { useLayout } from "@/src/hooks/useLayout";
import { notify } from "@/src/services/notify";
import { FeedbackDialog, BusyOverlay, type FeedbackVariant } from "@/src/components/ui/FeedbackDialog";
import { withAlpha } from "@/src/theme/colors";
import { useColors, useThemedStyles, type Palette } from "@/src/theme/useColors";

// ─── Design tokens ──────────────────────────────────────────────────────────

/** Single source of truth for all colours and radii — values come from the active palette. */
const makeDS = (C: Palette) =>
  ({
    pageBg: C.background,
    cardBg: C.surface02,
    cardBorder: C.lineSubtle,
    inputBg: C.surface03,
    inputBorder: C.lineStrong,
    sep: C.lineSubtle,

    brand: C.contentPrimary,
    brandSurface: C.surface04,
    brandBorder: C.lineStrong,
    brandText: C.contentPrimary,

    danger: C.destructive,
    dangerSurface: withAlpha(C.destructive, 0.12),
    dangerBorder: withAlpha(C.destructive, 0.25),
    dangerText: C.destructive,

    textPrimary: C.contentPrimary,
    textSecondary: C.contentSecondary,
    textMuted: C.contentMuted,
    textLabel: C.contentMuted,   // floating section labels

    rCard: 16,
    rInput: 12,
    rChip: 8,
    rPill: 20,

    pagePad: 16,
    cardPad: 16,
    rowPad: 12,
  }) as const;

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
  const s = useThemedStyles(makeStyles);
  return <Text variant="labelXs" className="text-content-muted" style={s.groupLabel}>{text.toUpperCase()}</Text>;
}

/** Rounded card surface. Pass `danger` for the red-tinted danger zone variant. */
function Card({
  children,
  danger = false,
}: {
  children: React.ReactNode;
  danger?: boolean;
}) {
  const DS = useThemedStyles(makeDS);
  const s = useThemedStyles(makeStyles);
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
  const s = useThemedStyles(makeStyles);
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
  const s = useThemedStyles(makeStyles);
  return (
    <>
      {block ? (
        <View style={s.rowBlock}>
          <Text variant="labelM">{label}</Text>
          {hint ? <Text variant="paragraphS" className="text-content-secondary" style={s.rowHint}>{hint}</Text> : null}
          <View style={s.rowBlockBody}>{children}</View>
        </View>
      ) : (
        <View style={s.rowInline}>
          <View style={s.rowInlineLabel}>
            <Text variant="labelM">{label}</Text>
            {hint ? <Text variant="paragraphS" className="text-content-secondary" style={s.rowHint}>{hint}</Text> : null}
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
  const s = useThemedStyles(makeStyles);
  return (
    <View style={[s.segmented, style]}>
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
  const s = useThemedStyles(makeStyles);
  const chips = (
    <View style={s.chips}>
      {options.map((opt) => {
        const on = opt.value === value;
        return (
          <TouchableOpacity
            key={opt.value}
            onPress={() => onChange(opt.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
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
  const { style, ...restProps } = props;
  const C = useColors();
  const DS = useThemedStyles(makeDS);
  const s = useThemedStyles(makeStyles);
  return (
    <TextInput
      placeholderTextColor={DS.textMuted}
      selectionColor={DS.textPrimary}
      cursorColor={DS.textPrimary}
      style={[s.inlineInput, style, { color: C.contentPrimary }]}
      {...restProps}
    />
  );
}

/** Full-width text input — for use in block rows or standalone. */
function FullInput(props: React.ComponentProps<typeof TextInput>) {
  const { style, ...restProps } = props;
  const C = useColors();
  const DS = useThemedStyles(makeDS);
  const s = useThemedStyles(makeStyles);
  return (
    <TextInput
      placeholderTextColor={DS.textMuted}
      selectionColor={DS.textPrimary}
      cursorColor={DS.textPrimary}
      style={[s.fullInput, style, { color: C.contentPrimary }]}
      {...restProps}
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
  const DS = useThemedStyles(makeDS);
  const s = useThemedStyles(makeStyles);
  const v = {
    ghost: { bg: DS.inputBg, border: DS.inputBorder, text: DS.textSecondary },
    primary: { bg: accentColorDim, border: accentColorMid, text: accentColor },
    danger: { bg: DS.dangerSurface, border: DS.dangerBorder, text: DS.dangerText },
  }[variant];

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      activeOpacity={0.7}
      style={[s.btn, { backgroundColor: v.bg, borderColor: v.border, opacity: disabled ? 0.5 : 1 }]}
    >
      <Text style={[s.btnText, { color: v.text }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Static data ─────────────────────────────────────────────────────────────

const COUNTRIES = [
  { id: "CA", label: "🇨🇦 Canada", unit: "km" as const, currency: "CAD" },
  // { id: "US", label: "🇺🇸 United States", unit: "mi" as const, currency: "USD" },
  // { id: "UK", label: "🇬🇧 United Kingdom", unit: "mi" as const, currency: "GBP" },
  // { id: "NP", label: "🇳🇵 Nepal", unit: "km" as const, currency: "NPR" },
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
  "#F6F6F7", "#22c55e", "#3b82f6", "#8b5cf6",
  "#f59e0b", "#FF5247", "#f97316", "#14b8a6",
  "#e11d48", "#ec4899", "#6366f1", "#65656E",
];

const PRESET_COLORS = [
  "#22c55e", // Green
  "#3b82f6", // Blue
  "#8b5cf6", // Purple
  "#f59e0b", // Amber/Yellow
  "#FF5247", // Red
  "#f97316", // Orange
  "#06b6d4", // Cyan
  "#ec4899", // Pink
  "#a855f7", // Indigo/Purple
  "#9B9BA4", // Gray
];

const PRESET_EMOJIS = [
  "🚗", "🚲", "🛵", "📦", "🍔", "🛍️", "🏃", "🚚", "🍽️", "🚐", "🚕", "⚙️"
];

function ColorPicker({ selectedColor, onSelectColor }: { selectedColor: string; onSelectColor: (c: string) => void }) {
  const C = useColors();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 6 }}>
      {PRESET_COLORS.map((c) => {
        const isSelected = selectedColor.toLowerCase() === c.toLowerCase();
        return (
          <TouchableOpacity
            key={c}
            onPress={() => onSelectColor(c)}
            accessibilityRole="button"
            accessibilityLabel={`Color ${c}`}
            accessibilityState={{ selected: isSelected }}
            hitSlop={8}
            style={[
              {
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: c,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: C.lineStrong,
              },
              isSelected && {
                borderWidth: 2.5,
                borderColor: C.contentPrimary,
                transform: [{ scale: 1.1 }],
              }
            ]}
          >
            {isSelected && (
              <Check size={12} color={c.toLowerCase() === "#F6F6F7" ? "#000" : C.contentPrimary} strokeWidth={3.5} />
            )}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

function EmojiPicker({ selectedEmoji, onSelectEmoji }: { selectedEmoji: string; onSelectEmoji: (e: string) => void }) {
  const C = useColors();
  const DS = useThemedStyles(makeDS);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 6 }}>
      {PRESET_EMOJIS.map((e) => {
        const isSelected = selectedEmoji === e;
        return (
          <TouchableOpacity
            key={e}
            onPress={() => onSelectEmoji(e)}
            accessibilityRole="button"
            accessibilityLabel={`Emoji ${e}`}
            accessibilityState={{ selected: isSelected }}
            hitSlop={6}
            style={[
              {
                width: 34,
                height: 34,
                borderRadius: 8,
                backgroundColor: DS.inputBg,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: DS.inputBorder,
              },
              isSelected && {
                borderColor: C.contentPrimary,
                backgroundColor: C.surface04,
                transform: [{ scale: 1.1 }],
              }
            ]}
          >
            <Text style={{ fontSize: 16 }}>{e}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}


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
  const C = useColors();
  const DS = useThemedStyles(makeDS);
  const s = useThemedStyles(makeStyles);
  const { columnStyle } = useLayout();
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
    featureOverrides,
    updateFeatureOverride,
  } = useSettingsStore();

  const [dashWidgets, setDashWidgets] = useState<string[]>([]);

  // ── UI state ────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TabId>("you");
  const [isSaving, setIsSaving] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  // ── Tab: You ────────────────────────────────────────────────────────────────
  // Profile identity (name/country/region) is edited in /settings/profile — read-only here
  const country = (profile?.country ?? "CA") as "US" | "CA" | "UK" | "NP";


  // ── Tab: Appearance ─────────────────────────────────────────────────────────
  const [theme, setTheme] = useState<"auto" | "light" | "dark">(profile?.theme ?? "auto");

  /**
   * Theme applies on tap, not on Save. Everything else on this tab is staged in
   * local state and written when the driver saves, but a theme you have to save
   * to see is a theme you cannot preview — you would be picking blind. Writing
   * straight to the profile re-themes the app underneath the picker, which is
   * also the preview. The Save handler still sends `theme`, harmlessly.
   */
  const chooseTheme = (next: "auto" | "light" | "dark") => {
    setTheme(next);
    void updateProfile({ theme: next });
  };
  const [selectedAccent, setSelectedAccent] = useState(
    (profile?.avatarData && profile?.avatarData.startsWith("#")) ? profile.avatarData : "#F6F6F7"
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
    backupOverdue: true,
  });

  // ── Tab: Data ───────────────────────────────────────────────────────────────
  const [integrityResult, setIntegrityResult] = useState("");
  const [isCheckingIntegrity, setIsCheckingIntegrity] = useState(false);
  const [archiveDays, setArchiveDays] = useState("30");
  const [resetPlatformTarget, setResetPlatformTarget] = useState("");
  const [exportedThisSession, setExportedThisSession] = useState(false);

  // ── Export CSV dialog state ──────────────────────────────────────────────────
  const [exportChooserOpen, setExportChooserOpen] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportDialog, setExportDialog] = useState<{ variant: FeedbackVariant; title: string; message?: string } | null>(null);


  // ── Navigate to tab from route param ────────────────────────────────────────
  useEffect(() => {
    const tab = params.tab as TabId | undefined;
    if (tab && TABS.some((t) => t.id === tab)) setActiveTab(tab);
  }, [params.tab]);

  // ── Sync appearance/locale → local state ────────────────────────────────────
  useEffect(() => {
    setTheme(profile?.theme ?? "auto");
    setSelectedAccent(
      (profile?.avatarData && profile?.avatarData.startsWith("#")) ? profile.avatarData : "#F6F6F7"
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

      // Profile identity (name/country/region) is managed by /settings/profile screen.
      // Here we only update appearance, locale, and platform selections.
      await updateProfile({
        displayName: profile?.displayName || "Driver",
        country: profile?.country,
        taxRegion: profile?.taxRegion,
        distanceUnit: profile?.distanceUnit,
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
        await updateDBPlatform(profile?.country || "CA", pKey, {
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
            notify({
              title: "Platform data cleared",
              description: `All shift records for ${resetPlatformTarget} were deleted.`,
              type: "warning",
              iconKey: "wipe",
              dedupeKey: `wipe_${resetPlatformTarget}`,
            });
          },
        },
      ],
    );
  };

  // ── Export CSV ───────────────────────────────────────────────────────────────
  const doExport = async (type: "shifts" | "expenses") => {
    setExportChooserOpen(false);
    setExportBusy(true);
    try {
      const start = new Date(0);
      const end = new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000);
      const csv = type === "shifts"
        ? await generateShiftsCSV(start, end)
        : await generateExpensesCSV(start, end);

      // An empty CSV string means there were no rows to export.
      if (!csv.trim()) {
        setExportDialog({ variant: "info", title: "Nothing to Export", message: `You have no ${type} recorded yet.` });
        return;
      }

      const fname = `comma_${type}_${new Date().toISOString().slice(0, 10)}.csv`;

      if (isWeb) {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
        a.download = fname;
        a.click();
        URL.revokeObjectURL(a.href);
      } else {
        // expo-sharing handles file URIs on both iOS and Android.
        // (RN's Share.share({url}) silently ignores `url` on Android.)
        if (!(await Sharing.isAvailableAsync())) {
          setExportDialog({ variant: "error", title: "Sharing Unavailable", message: "This device can't open a share sheet to save the file." });
          return;
        }
        const uri = FileSystem.cacheDirectory + fname;
        await FileSystem.writeAsStringAsync(uri, csv, { encoding: FileSystem.EncodingType.UTF8 });
        await Sharing.shareAsync(uri, { mimeType: "text/csv", dialogTitle: `Export ${type === "shifts" ? "Shifts" : "Expenses"} CSV` });
      }
      setExportedThisSession(true);
      setExportDialog({
        variant: "success",
        title: "Export Ready",
        message: `Your ${type} CSV is ready to save or share.`,
      });
    } catch (err: any) {
      setExportDialog({ variant: "error", title: "Export Failed", message: err?.message || "An error occurred exporting the CSV." });
    } finally {
      setExportBusy(false);
    }
  };

  const handleExportCSV = () => setExportChooserOpen(true);

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



  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={s.safe} edges={["bottom", "left", "right"]}>

      {/* ── Header ── Outside the scroller, so it takes the same cap as the content. */}
      <View style={[s.header, { paddingTop: insets.top + 10 }, columnStyle]}>
        <View style={s.headerLeft}>
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
            <Text variant="headingS">Settings</Text>
            <Text variant="paragraphS" className="text-content-secondary" style={{ marginTop: 1 }}>Configure your vault</Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={handleSave}
          disabled={isSaving}
          accessibilityRole="button"
          accessibilityLabel="Save settings"
          accessibilityState={{ disabled: isSaving }}
          activeOpacity={0.8}
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
            <Text variant="labelM" style={{ color: accentColorContrast }}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Tab bar ── Also outside the scroller. The cap goes on the ScrollView's own
           frame, not its contentContainerStyle: this one scrolls horizontally, and a
           maxWidth on the content container would clamp the row instead of the viewport. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[s.tabScroll, columnStyle]}
        contentContainerStyle={s.tabRow}
      >
        {TABS.map(({ id, label }) => {
          const on = activeTab === id;
          return (
            <TouchableOpacity
              key={id}
              onPress={() => setActiveTab(id)}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              hitSlop={{ top: 8, bottom: 8 }}
              style={[
                s.tab,
                on && { backgroundColor: accentColorDim, borderColor: accentColorMid }
              ]}
            >
              <Text variant="labelM" style={[s.tabText, on && { color: accentColor }]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── Tab content ── */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={[s.scrollContent, columnStyle]}
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

            <GroupLabel text="Profile" />
            <TouchableOpacity
              onPress={() => router.push("/settings/profile")}
              accessibilityRole="button"
              style={{
                backgroundColor: DS.inputBg,
                borderRadius: 12,
                borderWidth: 0.5,
                borderColor: DS.inputBorder,
                paddingHorizontal: 16,
                paddingVertical: 14,
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
              }}
              activeOpacity={0.7}
            >
              <View style={{
                width: 40, height: 40, borderRadius: 12,
                backgroundColor: accentColorDim, borderWidth: 1, borderColor: accentColorMid,
                justifyContent: "center", alignItems: "center",
              }}>
                <Text variant="headingS" style={{ color: accentColor }}>
                  {(profile?.displayName || "D").charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="labelL">
                  {profile?.displayName || "Driver"}
                </Text>
                <Text variant="paragraphS" className="text-content-secondary">
                  {COUNTRIES.find(c => c.id === profile?.country)?.label?.replace(/^\S+\s/, "") || profile?.country} · {profile?.taxRegion} · {profile?.distanceUnit ?? "km"}
                </Text>
              </View>
              <ChevronRight size={16} color={DS.textSecondary} />
            </TouchableOpacity>

            <GroupLabel text="Optional Features" />
            <Card>
              {FEATURE_MODULES.filter((f) => !f.core && f.userToggleable).map((feature, idx, arr) => {
                const defaultVal = GIG_DRIVER_DEFAULTS[feature.key] ?? false;
                const active = feature.key in (featureOverrides || {})
                  ? !!featureOverrides[feature.key]
                  : defaultVal;

                const FEATURE_UI: Record<string, { Icon: React.ComponentType<{ size: number; color: string }>; where: string }> = {
                  analytics_advanced: { Icon: BarChart2,   where: "Analytics tab" },
                  tax_workspace:      { Icon: Calculator,  where: "Tax tab" },
                  goals:              { Icon: Target,      where: "Goals screen" },
                  schedule:           { Icon: CalendarDays, where: "Schedule screen" },
                  gamification:       { Icon: Trophy,      where: "Dashboard" },
                  pdf_reports:        { Icon: FileText,    where: "Reports screen" },
                };
                const meta = FEATURE_UI[feature.key];

                return (
                  <View key={feature.key}>
                    <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 4, gap: 12 }}>
                      {meta && (
                        <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: active ? accentColorDim : withAlpha(C.lineStrong, 0.25), justifyContent: "center", alignItems: "center" }}>
                          <meta.Icon size={18} color={active ? accentColor : DS.textSecondary} />
                        </View>
                      )}
                      <View style={{ flex: 1, gap: 2 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <Text variant="labelM">{feature.label}</Text>
                          {meta && (
                            <View style={{ backgroundColor: withAlpha(C.lineStrong, 0.4), borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 }}>
                              <Text variant="labelXs" className="text-content-secondary">{meta.where}</Text>
                            </View>
                          )}
                        </View>
                        <Text variant="paragraphS" className="text-content-secondary">{feature.description}</Text>
                      </View>
                      <Switch
                        value={active}
                        onValueChange={(val) => updateFeatureOverride(feature.key, val)}
                        accessibilityLabel={feature.label}
                        trackColor={{ false: DS.inputBorder, true: accentColor }}
                        thumbColor={C.contentPrimary}
                      />
                    </View>
                    {idx < arr.length - 1 && <Sep />}
                  </View>
                );
              })}
            </Card>
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
                  onChange={chooseTheme}
                />
              </Row>
              <Row label="Accent color" block last>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={s.swatches}>
                    {PRESET_ACCENTS.map((hex) => {
                      // The neutral preset is stored as dark's foreground hex, but it
                      // MEANS "use the foreground colour" — usePlatformTheme resolves it
                      // through the palette. Paint the swatch literally and in light mode
                      // it is a near-white dot on a near-white card, i.e. invisible.
                      const isNeutral = hex.toLowerCase() === "#f6f6f7";
                      const swatchColor = isNeutral ? C.contentPrimary : hex;
                      // Compare case-insensitively on BOTH sides: PRESET_ACCENTS is mixed
                      // case, so lowercasing only the left never matched #F6F6F7, #FF5247
                      // or #65656E — three swatches could never show as selected.
                      const on =
                        String(selectedAccent || "#F6F6F7").toLowerCase() === hex.toLowerCase();
                      return (
                        <TouchableOpacity
                          key={hex}
                          onPress={() => setSelectedAccent(hex)}
                          accessibilityRole="button"
                          accessibilityLabel={`Accent color ${hex}`}
                          accessibilityState={{ selected: on }}
                          hitSlop={8}
                          style={[
                            s.swatch,
                            { backgroundColor: swatchColor },
                            on && { borderWidth: 2.5, borderColor: isNeutral ? C.contentMuted : C.contentPrimary }
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
                <Text variant="labelM" className="text-content-secondary">
                  {currency}
                </Text>
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
          const inactiveKeys = platformKeys.filter((k) => !platformConfigs[k]?.active && k !== "other");

          const renderPlatformCard = (pKey: PlatformKey) => {
            const dbPlatform = dbPlatforms.find((p) => p.id === pKey);
            const cfg = platformConfigs[pKey] ?? {
              active: false, hourlyRate: "20", mileageRate: getMileagePresetRate(profile.country, profile.taxRegion), priority: "1",
              customLabel: dbPlatform?.label || PLATFORMS[pKey]?.label || pKey,
              customColor: dbPlatform?.color || PLATFORMS[pKey]?.color || "#9B9BA4",
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
                      <Text variant="labelM">{resolvedLabel}</Text>
                      {cfg.active && (
                        <Text variant="paragraphS" style={[s.rowHint, { color: accentColor }]}>
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
                      accessibilityLabel={resolvedLabel}
                      trackColor={{ false: DS.inputBorder, true: accentColor }}
                      thumbColor={C.contentPrimary}
                    />
                  </View>
                </TouchableOpacity>

                {(cfg.active && isExpanded) && (
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
                        <Row label="Theme Color" last={false} block>
                          <View style={{ gap: 6 }}>
                            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                              <Text variant="paragraphS" className="text-content-secondary">Hex Color Code</Text>
                              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                                <InlineInput
                                  value={cfg.customColor ?? ""}
                                  placeholder="e.g. #a855f7"
                                  onChangeText={(v) => updateCfg({ customColor: v })}
                                  style={{ width: 100 }}
                                />
                                <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: cfg.customColor || "#9B9BA4" }} />
                              </View>
                            </View>
                            <ColorPicker
                              selectedColor={cfg.customColor ?? ""}
                              onSelectColor={(c) => updateCfg({ customColor: c })}
                            />
                          </View>
                        </Row>
                        <Row label="Logo/Emoji" last={false} block>
                          <View style={{ gap: 6 }}>
                            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                              <Text variant="paragraphS" className="text-content-secondary">Custom Emoji</Text>
                              <InlineInput
                                value={cfg.customEmoji ?? ""}
                                placeholder="e.g. 🚲"
                                onChangeText={(v) => updateCfg({ customEmoji: v })}
                                maxLength={2}
                                style={{ width: 60 }}
                              />
                            </View>
                            <EmojiPicker
                              selectedEmoji={cfg.customEmoji ?? ""}
                              onSelectEmoji={(e) => updateCfg({ customEmoji: e })}
                            />
                          </View>
                        </Row>
                      </>
                    )}
                    <Row label="Default Hourly Pay" last={false} hint="Used for shift pay estimation & targets">
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                        <Segmented
                          options={[
                            { value: "custom" as const, label: "Hourly Rate" },
                            { value: "na" as const, label: "N/A" }
                          ]}
                          value={cfg.hourlyRate === "N/A" ? "na" : "custom"}
                          onChange={(v) => updateCfg({ hourlyRate: v === "na" ? "N/A" : "20" })}
                          style={{ minWidth: 140 }}
                        />
                        {cfg.hourlyRate !== "N/A" && (
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                            <Text style={{ color: DS.textSecondary, fontSize: 13 }}>{countryDef.symbol}</Text>
                            <InlineInput
                              value={cfg.hourlyRate}
                              keyboardType="numeric"
                              onChangeText={(v) => updateCfg({ hourlyRate: v })}
                              style={{ minWidth: 50, textAlign: "center" }}
                            />
                            <Text style={{ color: DS.textSecondary, fontSize: 13 }}>/ hr</Text>
                          </View>
                        )}
                      </View>
                    </Row>
                    <Row label="Default Mileage Rate" last={false} hint="Claimable driving expense deduction rate">
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                        <Segmented
                          options={[
                            { value: "custom" as const, label: "Per Distance" },
                            { value: "na" as const, label: "N/A" }
                          ]}
                          value={cfg.mileageRate === "N/A" ? "na" : "custom"}
                          onChange={(v) => updateCfg({ mileageRate: v === "na" ? "N/A" : getMileagePresetRate(country, profile?.taxRegion ?? "ON") })}
                          style={{ minWidth: 140 }}
                        />
                        {cfg.mileageRate !== "N/A" && (
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                            <Text style={{ color: DS.textSecondary, fontSize: 13 }}>{countryDef.symbol}</Text>
                            <InlineInput
                              value={cfg.mileageRate}
                              keyboardType="numeric"
                              onChangeText={(v) => updateCfg({ mileageRate: v })}
                              style={{ minWidth: 50, textAlign: "center" }}
                            />
                            <Text style={{ color: DS.textSecondary, fontSize: 13 }}>/ {profile?.distanceUnit ?? "km"}</Text>
                          </View>
                        )}
                      </View>
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
                <Text variant="labelXs" className="text-content-secondary">
                  Platforms available in your region ({countryDef.label})
                </Text>
              </View>
              <GroupLabel text="Active Platforms" />
              {activeKeys.length === 0 ? (
                <Card>
                  <View style={{ padding: 16, alignItems: "center" }}>
                    <Text variant="paragraphS" className="text-content-secondary" style={{ textAlign: "center" }}>
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
                      accessibilityRole="button"
                      accessibilityState={{ expanded: showOtherPlatforms }}
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                        paddingVertical: 14,
                        paddingHorizontal: 16,
                      }}
                    >
                      <Text variant="labelM">
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
                                <Text variant="labelM">
                                  {cfg.customLabel || dbPlatforms.find((p) => p.id === pKey)?.label || PLATFORMS[pKey]?.label || pKey}
                                </Text>
                              </View>
                              <Switch
                                value={cfg.active}
                                onValueChange={(v) => updateCfg({ active: v })}
                                accessibilityLabel={cfg.customLabel || dbPlatforms.find((p) => p.id === pKey)?.label || PLATFORMS[pKey]?.label || pKey}
                                trackColor={{ false: DS.inputBorder, true: accentColor }}
                                thumbColor={C.contentPrimary}
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
                      accessibilityRole="button"
                      style={{
                        flexDirection: "row",
                        justifyContent: "center",
                        alignItems: "center",
                        paddingVertical: 14,
                        paddingHorizontal: 16,
                        gap: 8,
                      }}
                    >
                      <Text variant="labelM" style={{ color: accentColor }}>
                        + Create Custom Platform
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={{ padding: 16, gap: 16 }}>
                      <Text variant="labelM">
                        New Custom Platform
                      </Text>

                      {/* Platform Name */}
                      <View style={{ gap: 6 }}>
                        <Text variant="labelXs" className="text-content-secondary">Platform Name</Text>
                        <TextInput
                          value={newPlatformLabel}
                          onChangeText={setNewPlatformLabel}
                          placeholder="e.g. Pathao, InDriver"
                          placeholderTextColor={DS.textMuted}
                          style={[
                            s.inlineInput,
                            { textAlign: "left", width: "100%", paddingHorizontal: 12 }
                          ]}
                        />
                      </View>

                      {/* Theme Color */}
                      <View style={{ gap: 8 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                          <Text variant="labelXs" className="text-content-secondary">Theme Color</Text>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                            <TextInput
                              value={newPlatformColor}
                              onChangeText={setNewPlatformColor}
                              placeholder="#a855f7"
                              placeholderTextColor={DS.textMuted}
                              style={[s.inlineInput, { width: 95 }]}
                            />
                            <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: newPlatformColor || "#9B9BA4", borderWidth: 1, borderColor: C.lineStrong }} />
                          </View>
                        </View>
                        <ColorPicker
                          selectedColor={newPlatformColor}
                          onSelectColor={setNewPlatformColor}
                        />
                      </View>

                      {/* Emoji Logo */}
                      <View style={{ gap: 8 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                          <Text variant="labelXs" className="text-content-secondary">Emoji Logo</Text>
                          <TextInput
                            value={newPlatformEmoji}
                            onChangeText={setNewPlatformEmoji}
                            placeholder="🚲"
                            placeholderTextColor={DS.textMuted}
                            maxLength={2}
                            style={[s.inlineInput, { width: 60, textAlign: "center" }]}
                          />
                        </View>
                        <EmojiPicker
                          selectedEmoji={newPlatformEmoji}
                          onSelectEmoji={setNewPlatformEmoji}
                        />
                      </View>

                      <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
                        <TouchableOpacity
                          onPress={() => {
                            setIsAddingCustom(false);
                            setNewPlatformLabel("");
                          }}
                          accessibilityRole="button"
                          activeOpacity={0.7}
                          style={{
                            paddingVertical: 8,
                            paddingHorizontal: 12,
                            borderRadius: 8,
                            borderWidth: 1,
                            borderColor: DS.inputBorder,
                          }}
                        >
                          <Text variant="labelM" className="text-content-secondary">Cancel</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={async () => {
                            if (!newPlatformLabel.trim()) {
                              Alert.alert("Required", "Please enter a platform name.");
                              return;
                            }
                            const newId = `custom_platform_${Date.now()}`;
                            const defaultMileage = getMileagePresetRate(country, profile?.taxRegion ?? "ON");
                            
                            // Insert into database directly
                            await updateDBPlatform(country, newId, {
                              id: newId,
                              label: newPlatformLabel.trim(),
                              color: newPlatformColor.trim() || "#9B9BA4",
                              textColor: "#F6F6F7",
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
                                customColor: newPlatformColor.trim() || "#9B9BA4",
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
                          accessibilityRole="button"
                          activeOpacity={0.8}
                          style={{
                            paddingVertical: 8,
                            paddingHorizontal: 16,
                            borderRadius: 8,
                            backgroundColor: accentColor,
                          }}
                        >
                          <Text variant="labelM" style={{ color: accentColorContrast }}>Add Platform</Text>
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
                { key: "backupOverdue", label: "Sync reminder", hint: "Notify if your data hasn't synced to the cloud recently" },
              ] as const).map(({ key, label, hint }, i, arr) => (
                <Row key={key} label={label} hint={hint} last={i === arr.length - 1}>
                  <Switch
                    value={notifs[key]}
                    onValueChange={(v) => setNotifs((p) => ({ ...p, [key]: v }))}
                    accessibilityLabel={label}
                    trackColor={{ false: DS.inputBorder, true: accentColor }}
                    thumbColor={C.contentPrimary}
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
            <GroupLabel text="Cloud Sync" />
            <Card>
              <Row
                label="Cloud Sync"
                hint="Connect Google Drive once. On one device it's your automatic backup; on another, your data stays in sync. Free."
                last
              >
                <Btn label="Open" variant="primary" onPress={() => router.push("/settings/backup")} />
              </Row>
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
                  options={Object.keys(platformConfigs)
                    .filter((k) => platformConfigs[k].active)
                    .map((k) => ({
                      value: k,
                      label: platformConfigs[k].customLabel || PLATFORMS[k as PlatformKey]?.label || k
                    }))}
                  value={resetPlatformTarget as any}
                  onChange={setResetPlatformTarget as any}
                  danger
                />
                {resetPlatformTarget ? (
                  <View style={{ marginTop: 10 }}>
                    <Btn 
                      label={`Wipe ${
                        platformConfigs[resetPlatformTarget]?.customLabel || 
                        PLATFORMS[resetPlatformTarget as PlatformKey]?.label || 
                        resetPlatformTarget
                      } data`} 
                      variant="danger" 
                      onPress={confirmResetPlatform} 
                    />
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
      </KeyboardAvoidingView>

      {/* ── Keyboard shortcuts modal ── */}
      <Modal visible={showShortcuts} transparent animationType="fade">
        <TouchableOpacity
          style={s.overlay}
          activeOpacity={1}
          onPress={() => setShowShortcuts(false)}
        >
          <TouchableOpacity activeOpacity={1} style={s.overlayCard}>
            <View style={s.overlayHeader}>
              <Text variant="labelM">Keyboard Shortcuts</Text>
              <TouchableOpacity
                onPress={() => setShowShortcuts(false)}
                accessibilityRole="button"
                accessibilityLabel="Close"
                hitSlop={8}
                style={s.overlayClose}
              >
                <Text style={{ color: DS.textSecondary, fontSize: 16, lineHeight: 16, fontWeight: "700" }}>×</Text>
              </TouchableOpacity>
            </View>
            {KEYBOARD_SHORTCUTS.map((sc) => (
              <View key={sc.keys} style={s.shortcutRow}>
                <Text variant="paragraphS" className="text-content-secondary">{sc.desc}</Text>
                <View style={s.kbdBadge}>
                  <Text style={s.kbdText}>{sc.keys}</Text>
                </View>
              </View>
            ))}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── Export CSV: themed chooser + feedback ── */}
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

// ─── StyleSheet ───────────────────────────────────────────────────────────────

const makeStyles = (C: Palette) => {
  const DS = makeDS(C);
  return StyleSheet.create({
  safe: { flex: 1, backgroundColor: DS.pageBg },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: DS.pagePad, paddingTop: 4, paddingBottom: 60 },

  // ── Header ──────────────────────────────────────────────────────────────────
  header: { paddingHorizontal: DS.pagePad, paddingBottom: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: DS.inputBg, borderWidth: 0.5, borderColor: DS.inputBorder, alignItems: "center", justifyContent: "center" },
  saveBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: DS.rPill, backgroundColor: DS.brand, minWidth: 64, alignItems: "center", justifyContent: "center" },
  saveBtnDone: { backgroundColor: DS.brandSurface, borderWidth: 0.5, borderColor: DS.brandBorder },

  // ── Tab bar ─────────────────────────────────────────────────────────────────
  tabScroll: { flexGrow: 0, marginBottom: 10 },
  tabRow: { paddingHorizontal: DS.pagePad, gap: 6, flexDirection: "row" },
  tab: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: DS.rPill, backgroundColor: DS.inputBg, borderWidth: 0.5, borderColor: DS.inputBorder },
  tabOn: { backgroundColor: DS.brandSurface, borderColor: DS.brandBorder },
  tabText: { color: DS.textSecondary },
  tabTextOn: { color: DS.brandText },

  // ── Section label ───────────────────────────────────────────────────────────
  groupLabel: { marginBottom: 6, marginTop: 20, paddingHorizontal: 2 },

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

  rowHint: { marginTop: 2 },

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
    fontWeight: "500" as const,
    paddingHorizontal: 12,
    height: 38,                // explicit height prevents vertical text clipping
    minWidth: 90,
    textAlign: "right" as const,
  },
  fullInput: {
    backgroundColor: DS.inputBg,
    borderRadius: DS.rInput,
    borderWidth: 0.5,
    borderColor: DS.inputBorder,
    color: DS.textPrimary,
    fontSize: 14,
    fontWeight: "500" as const,
    paddingHorizontal: 14,
    height: 44,                // explicit height prevents vertical text clipping
    width: "100%" as const,
  },

  // ── Button ──────────────────────────────────────────────────────────────────
  btn: { paddingHorizontal: 13, paddingVertical: 7, borderRadius: DS.rInput, borderWidth: 0.5, flexDirection: "row", alignItems: "center", gap: 5 },
  btnText: { fontSize: 11, fontWeight: "700" },

  // ── Accent swatches ─────────────────────────────────────────────────────────
  swatches: { flexDirection: "row", gap: 8, paddingVertical: 2 },
  swatch: { width: 26, height: 26, borderRadius: 13 },
  swatchOn: { borderWidth: 2.5, borderColor: DS.textPrimary },

  // ── Widget list (Appearance tab) ─────────────────────────────────────────────
  widgetList: { gap: 6 },
  widgetRow: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: DS.inputBg, borderRadius: 12, borderWidth: 0.5, borderColor: DS.inputBorder, paddingHorizontal: 10, paddingVertical: 8 },
  widgetDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: DS.brand },
  widgetLabel: { flex: 1, color: DS.textPrimary, fontSize: 12, fontWeight: "500" },
  widgetActions: { flexDirection: "row", gap: 4 },
  iconBtn: { width: 24, height: 24, borderRadius: 8, backgroundColor: DS.cardBg, borderWidth: 0.5, borderColor: DS.cardBorder, alignItems: "center", justifyContent: "center" },

  // ── Pre/code block (integrity output) ───────────────────────────────────────
  preBlock: { backgroundColor: DS.inputBg, borderRadius: DS.rCard, borderWidth: 0.5, borderColor: DS.inputBorder, padding: 14, marginTop: 8 },
  preText: { color: DS.textSecondary, fontSize: 11, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace", lineHeight: 17 },

  // ── Shortcuts modal ─────────────────────────────────────────────────────────
  overlay: { flex: 1, backgroundColor: C.scrim, justifyContent: "center", alignItems: "center", padding: 20 },
  overlayCard: { width: "100%", maxWidth: 360, backgroundColor: DS.cardBg, borderRadius: DS.rCard, borderWidth: 0.5, borderColor: DS.cardBorder, padding: 18, gap: 12 },
  overlayHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: DS.sep },
  overlayClose: { width: 28, height: 28, borderRadius: 14, backgroundColor: DS.inputBg, borderWidth: 0.5, borderColor: DS.inputBorder, alignItems: "center", justifyContent: "center" },
  shortcutRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 2 },
  kbdBadge: { backgroundColor: DS.inputBg, borderWidth: 0.5, borderColor: DS.inputBorder, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  kbdText: { color: DS.brandText, fontSize: 11, fontWeight: "700", fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
  });
};