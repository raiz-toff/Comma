import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  ScrollView,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Modal,
  Pressable,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, X, LayoutGrid, Sparkles, BarChart2 } from "lucide-react-native";
import { Text } from "@/src/components/ui/text";
import {
  getPeriodStats,
  getEarningsByPlatform,
  getEarningsByDay,
  getBestDayOfWeek,
  getBestHourOfDay,
  getMileageSplit,
  getNetIncome,
  getHourlyRate,
} from "@/src/database/queries/analytics";
import { useSettingsStore } from "@/store/useSettingsStore";
import { cn } from "@/src/lib/utils";
import { db } from "@/src/database/client";
import { settings } from "@/src/database/schema";
import { eq } from "drizzle-orm";
import { usePlatformTheme } from "@/src/hooks/usePlatformTheme";

import RollingTrendWidget from "@/src/components/widgets/RollingTrendWidget";
import BestDayWidget from "@/src/components/widgets/BestDayWidget";
import BestHourWidget from "@/src/components/widgets/BestHourWidget";
import DeadMilesWidget from "@/src/components/widgets/DeadMilesWidget";
import StreakWidget from "@/src/components/widgets/StreakWidget";
import PlatformActivityWidget from "@/src/components/widgets/PlatformActivityWidget";
import IncomeBreakdownWidget from "@/src/components/widgets/IncomeBreakdownWidget";
import WeeklyProjectionWidget from "@/src/components/widgets/WeeklyProjectionWidget";
import TaxJarWidget from "@/src/components/widgets/TaxJarWidget";

// ─── Constants ────────────────────────────────────────────────────────────────

const isWeb = Platform.OS === "web";

const BG = "#0d0d0d";
const SURFACE = "#161615";
const BORDER = "#262522";
const MUTED = "#3a3a38";
const TEXT_MUTED = "#71717a";
const TEXT_DIM = "#52525b";

type Period = "week" | "month" | "3m" | "year" | "all";
type Category = "perf" | "insights" | "stats";

const PERIOD_OPTIONS: { key: Period; label: string; weeks: number }[] = [
  { key: "week", label: "7D", weeks: 1 },
  { key: "month", label: "30D", weeks: 4 },
  { key: "3m", label: "3M", weeks: 13 },
  { key: "year", label: "1Y", weeks: 52 },
  { key: "all", label: "All", weeks: 520 },
];

const CATEGORY_CONFIG: {
  key: Category;
  label: string;
  Icon: React.ComponentType<any>;
}[] = [
  { key: "perf", label: "Performance", Icon: BarChart2 },
  { key: "insights", label: "Insights", Icon: Sparkles },
  { key: "stats", label: "Stat Cards", Icon: LayoutGrid },
];

const WIDGET_META: Record<string, { label: string; category: Category }> = {
  rollingTrend:     { label: "Rolling 30-Day Trend",    category: "perf" },
  bestDay:          { label: "Best Day of Week",         category: "perf" },
  bestHour:         { label: "Best Hour of Day",         category: "perf" },
  deadMiles:        { label: "Dead Mileage Split",       category: "perf" },
  streak:           { label: "Active Streak",            category: "perf" },
  platformActivity: { label: "Platform Breakdown",       category: "insights" },
  incomeBreakdown:  { label: "Income Breakdown",         category: "insights" },
  weeklyProjection: { label: "Weekly Projection",        category: "insights" },
  taxJar:           { label: "Tax Jar Withholding",      category: "insights" },
  earnings:         { label: "Gross Revenue",            category: "stats" },
  netIncome:        { label: "Net Income",               category: "stats" },
  totalHours:       { label: "Hours Driven",             category: "stats" },
  avgRate:          { label: "Hourly Rate",              category: "stats" },
  tipsTotal:        { label: "Tips Total",               category: "stats" },
  expenses:         { label: "Expenses",                 category: "stats" },
  deliveries:       { label: "Shifts Logged",            category: "stats" },
};

const WIDGET_IDS_BY_CATEGORY: Record<Category, string[]> = {
  perf:     ["rollingTrend", "bestDay", "bestHour", "deadMiles", "streak"],
  insights: ["platformActivity", "incomeBreakdown", "weeklyProjection", "taxJar"],
  stats:    ["earnings", "netIncome", "totalHours", "avgRate", "tipsTotal", "expenses", "deliveries"],
};

const SIZE_OPTIONS = [
  { key: "1x1", label: "1 × 1 Square",   desc: "Compact snapshot" },
  { key: "2x1", label: "2 × 1 Wide",     desc: "Standard wide widget" },
  { key: "2x2", label: "2 × 2 Big",      desc: "Detailed overview" },
  { key: "1x2", label: "1 × 2 Tall",     desc: "Tall column" },
] as const;

const DEFAULT_DASHBOARD_WIDGETS: { id: string; size: string }[] = [
  { id: "rollingTrend", size: "2x1" },
  { id: "platformActivity", size: "1x1" },
  { id: "deadMiles", size: "1x1" },
  { id: "taxJar", size: "1x1" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function getPeriodDates(period: Period): { start: Date; end: Date } {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  if (period === "week")  start.setDate(start.getDate() - 7);
  else if (period === "month") start.setDate(start.getDate() - 30);
  else if (period === "3m")    start.setDate(start.getDate() - 90);
  else if (period === "year")  start.setDate(start.getDate() - 365);
  else start.setFullYear(start.getFullYear() - 10);
  return { start, end };
}

function formatCurrencyValue(value: number, country?: string) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: country === "CA" ? "CAD" : "USD",
    minimumFractionDigits: 2,
  }).format(value);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Pill showing an active widget in the dashboard ribbon */
function ActiveWidgetPill({
  id,
  size,
  accentColor,
  onRemove,
}: {
  id: string;
  size: string;
  accentColor: string;
  onRemove: () => void;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        backgroundColor: SURFACE,
        borderWidth: 1,
        borderColor: BORDER,
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 8,
      }}
    >
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: accentColor }} />
      <Text style={{ fontSize: 12, fontWeight: "700", color: "#ffffff" }}>
        {WIDGET_META[id]?.label ?? id}
      </Text>
      <View
        style={{
          backgroundColor: BG,
          borderRadius: 6,
          paddingHorizontal: 6,
          paddingVertical: 3,
        }}
      >
        <Text style={{ fontSize: 9, fontWeight: "900", color: TEXT_MUTED, letterSpacing: 0.8, textTransform: "uppercase" }}>
          {size}
        </Text>
      </View>
      <Pressable
        onPress={onRemove}
        hitSlop={8}
        style={({ pressed }) => ({
          backgroundColor: pressed ? "#3a0a10" : BG,
          borderRadius: 20,
          padding: 4,
          marginLeft: 2,
        })}
      >
        <X size={11} color="#f43f5e" strokeWidth={3} />
      </Pressable>
    </View>
  );
}

/** Card wrapping an available widget preview */
function WidgetPreviewCard({
  id,
  accentColor,
  accentColorContrast,
  onPin,
  children,
}: {
  id: string;
  accentColor: string;
  accentColorContrast: string;
  onPin: () => void;
  children: React.ReactNode;
}) {
  return (
    <View
      style={{
        backgroundColor: SURFACE,
        borderWidth: 1,
        borderColor: BORDER,
        borderRadius: 20,
        overflow: "hidden",
      }}
    >
      {/* Card header */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingTop: 14,
          paddingBottom: 12,
          borderBottomWidth: 1,
          borderBottomColor: BORDER,
        }}
      >
        <Text style={{ fontSize: 13, fontWeight: "700", color: "#ffffff", flexShrink: 1, marginRight: 8 }}>
          {WIDGET_META[id]?.label ?? id}
        </Text>
        <Pressable
          onPress={onPin}
          hitSlop={6}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: 5,
            backgroundColor: pressed ? accentColor + "cc" : accentColor,
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 10,
          })}
        >
          <Plus size={13} color={accentColorContrast} strokeWidth={3} />
          <Text style={{ fontSize: 11, fontWeight: "900", color: accentColorContrast, letterSpacing: 0.5, textTransform: "uppercase" }}>
            Pin
          </Text>
        </Pressable>
      </View>

      {/* Preview content */}
      <View style={{ padding: 16 }}>{children}</View>
    </View>
  );
}

/** A single stat row used in the "stats" category preview */
function StatRow({
  value,
  type,
  label,
  color,
  suffix,
  country,
}: {
  value: number;
  type: "currency" | "number" | "decimal";
  label: string;
  color: string;
  suffix?: string;
  country?: string;
}) {
  const formatted = useMemo(() => {
    if (type === "currency") return formatCurrencyValue(value, country);
    if (type === "decimal")  return value.toFixed(1);
    return Math.round(value).toString();
  }, [value, type, country]);

  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 9,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={{ width: 3, height: 28, borderRadius: 2, backgroundColor: color }} />
        <Text style={{ fontSize: 11, fontWeight: "700", color: TEXT_MUTED, textTransform: "uppercase", letterSpacing: 0.6 }}>
          {label}
        </Text>
      </View>
      <Text style={{ fontSize: 17, fontWeight: "900", color: "#ffffff" }}>
        {formatted}{suffix ?? ""}
      </Text>
    </View>
  );
}

/** Size selector modal */
function SizeSelectorModal({
  visible,
  widgetId,
  accentColor,
  accentColorContrast,
  onClose,
  onSelect,
}: {
  visible: boolean;
  widgetId: string | null;
  accentColor: string;
  accentColorContrast: string;
  onClose: () => void;
  onSelect: (size: string) => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "flex-end" }}
        onPress={onClose}
      >
        {/* Bottom sheet feel — stop propagation so tapping card doesn't dismiss */}
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: SURFACE,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            borderWidth: 1,
            borderBottomWidth: 0,
            borderColor: BORDER,
            paddingBottom: 36,
          }}
        >
          {/* Handle */}
          <View style={{ alignItems: "center", paddingTop: 12, paddingBottom: 8 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: MUTED }} />
          </View>

          {/* Header */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "flex-start",
              paddingHorizontal: 20,
              paddingBottom: 16,
              borderBottomWidth: 1,
              borderBottomColor: BORDER,
            }}
          >
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={{ fontSize: 16, fontWeight: "900", color: "#ffffff", marginBottom: 3 }}>
                Choose layout size
              </Text>
              {widgetId && (
                <Text style={{ fontSize: 12, color: TEXT_MUTED, fontWeight: "600" }}>
                  {WIDGET_META[widgetId]?.label ?? widgetId}
                </Text>
              )}
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              style={({ pressed }) => ({
                padding: 8,
                borderRadius: 20,
                backgroundColor: pressed ? MUTED : BG,
                borderWidth: 1,
                borderColor: BORDER,
              })}
            >
              <X size={15} color={TEXT_MUTED} />
            </Pressable>
          </View>

          {/* Size options */}
          <View style={{ paddingHorizontal: 16, paddingTop: 12, gap: 8 }}>
            {SIZE_OPTIONS.map((sz) => (
              <Pressable
                key={sz.key}
                onPress={() => onSelect(sz.key)}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  backgroundColor: pressed ? MUTED : BG,
                  borderWidth: 1,
                  borderColor: BORDER,
                  borderRadius: 16,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                })}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: "700", color: "#ffffff", marginBottom: 3 }}>
                    {sz.label}
                  </Text>
                  <Text style={{ fontSize: 12, color: TEXT_MUTED }}>
                    {sz.desc}
                  </Text>
                </View>
                <View
                  style={{
                    backgroundColor: accentColor + "18",
                    borderWidth: 1,
                    borderColor: accentColor + "40",
                    borderRadius: 8,
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                  }}
                >
                  <Text style={{ fontSize: 10, fontWeight: "900", color: accentColor, letterSpacing: 0.8, textTransform: "uppercase" }}>
                    {sz.key}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function AnalyticsScreen() {
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { profile, isOnboardingCompleted } = useSettingsStore();
  const { accentColor, accentColorContrast } = usePlatformTheme();

  const [period, setPeriod] = useState<Period>("month");
  const [activeCategory, setActiveCategory] = useState<Category>("perf");
  const [dashboardWidgets, setDashboardWidgets] = useState<{ id: string; size: string }[]>([]);
  const [sizeSelectorWidget, setSizeSelectorWidget] = useState<string | null>(null);

  const { start, end } = useMemo(() => getPeriodDates(period), [period]);
  const weeks = PERIOD_OPTIONS.find((p) => p.key === period)?.weeks ?? 4;

  // Load persisted widget configuration
  useEffect(() => {
    async function loadWidgets() {
      try {
        if (isWeb) {
          const val = localStorage.getItem("comma_setting_dashboard_widgets");
          setDashboardWidgets(val ? JSON.parse(val) : DEFAULT_DASHBOARD_WIDGETS);
        } else {
          const row = await db.select().from(settings).where(eq(settings.key, "dashboard_widgets")).limit(1);
          setDashboardWidgets(row[0]?.value ? JSON.parse(row[0].value) : DEFAULT_DASHBOARD_WIDGETS);
        }
      } catch {
        setDashboardWidgets(DEFAULT_DASHBOARD_WIDGETS);
      }
    }
    loadWidgets();
  }, []);

  // ── Queries ──────────────────────────────────────────────────────────────

  const enabled = isOnboardingCompleted;

  const { data: periodStats, isLoading: loadingStats } = useQuery({
    queryKey: ["analytics", "period-stats", period],
    queryFn: () => getPeriodStats(start, end),
    enabled,
  });
  const { data: platformData = [] } = useQuery({
    queryKey: ["analytics", "by-platform", period],
    queryFn: () => getEarningsByPlatform(start, end),
    enabled,
  });
  const { data: dailyData = [] } = useQuery({
    queryKey: ["analytics", "by-day", period],
    queryFn: () => getEarningsByDay(weeks),
    enabled,
  });
  const { data: bestDayData = [] } = useQuery({
    queryKey: ["analytics", "best-day", period],
    queryFn: () => getBestDayOfWeek(start, end),
    enabled,
  });
  const { data: bestHourData = [] } = useQuery({
    queryKey: ["analytics", "best-hour", period],
    queryFn: () => getBestHourOfDay(start, end),
    enabled,
  });
  const { data: mileage } = useQuery({
    queryKey: ["analytics", "mileage", period],
    queryFn: () => getMileageSplit(start, end),
    enabled,
  });
  const { data: netIncome = 0 } = useQuery({
    queryKey: ["analytics", "net-income", period],
    queryFn: () => getNetIncome(start, end),
    enabled,
  });
  const { data: hourlyRate = 0 } = useQuery({
    queryKey: ["analytics", "hourly-rate", period],
    queryFn: () => getHourlyRate(start, end),
    enabled,
  });

  // ── Derived values ───────────────────────────────────────────────────────

  const totalRevenue  = (periodStats?.gross ?? 0) + (periodStats?.tips ?? 0);
  const durationHrs   = (periodStats?.durationSeconds ?? 0) / 3600;
  const maxDayAvg     = Math.max(1, ...bestDayData.map((d) => d.avgEarnings));
  const maxHourAvg    = Math.max(1, ...bestHourData.map((h) => h.avgEarnings));

  const streak = useMemo(() => {
    let best = 0, cur = 0;
    dailyData.forEach((d) => {
      if (d.total > 0) { cur++; best = Math.max(best, cur); }
      else cur = 0;
    });
    return { current: cur, best };
  }, [dailyData]);

  const country = profile.country;

  // ── Widget management ────────────────────────────────────────────────────

  const handleAddWidget = useCallback(async (id: string, size: string) => {
    const updated = [...dashboardWidgets.filter((w) => w.id !== id), { id, size }];
    setDashboardWidgets(updated);
    setSizeSelectorWidget(null);
    await upsertSetting("dashboard_widgets", JSON.stringify(updated));
    queryClient.invalidateQueries({ queryKey: ["analytics"] });
  }, [dashboardWidgets, queryClient]);

  const handleRemoveWidget = useCallback(async (id: string) => {
    const updated = dashboardWidgets.filter((w) => w.id !== id);
    setDashboardWidgets(updated);
    await upsertSetting("dashboard_widgets", JSON.stringify(updated));
    queryClient.invalidateQueries({ queryKey: ["analytics"] });
  }, [dashboardWidgets, queryClient]);

  // ── Category views ───────────────────────────────────────────────────────

  const activeCategoryWidgetIds = WIDGET_IDS_BY_CATEGORY[activeCategory];

  const onDashboardInCategory = useMemo(
    () => dashboardWidgets.filter((w) => activeCategoryWidgetIds.includes(w.id)),
    [dashboardWidgets, activeCategoryWidgetIds]
  );

  const availableInCategory = useMemo(
    () => activeCategoryWidgetIds.filter((id) => !dashboardWidgets.some((w) => w.id === id)),
    [dashboardWidgets, activeCategoryWidgetIds]
  );

  // ── Widget content renderer ──────────────────────────────────────────────

  const renderWidgetContent = useCallback((id: string) => {
    switch (id) {
      case "rollingTrend":      return <RollingTrendWidget dailyData={dailyData} />;
      case "bestDay":           return <BestDayWidget bestDayData={bestDayData} maxDayAvg={maxDayAvg} />;
      case "bestHour":          return <BestHourWidget bestHourData={bestHourData} maxHourAvg={maxHourAvg} />;
      case "deadMiles":         return <DeadMilesWidget mileage={mileage} />;
      case "streak":            return <StreakWidget streak={streak} />;
      case "platformActivity":  return <PlatformActivityWidget platformData={platformData} />;
      case "incomeBreakdown":   return (
        <IncomeBreakdownWidget
          totalRevenue={totalRevenue}
          netIncome={netIncome}
          taxWithholdingPct={profile.taxWithholdingPct}
          country={country}
        />
      );
      case "weeklyProjection":  return <WeeklyProjectionWidget dailyData={dailyData} country={country} />;
      case "taxJar":            return <TaxJarWidget taxWithholdingPct={profile.taxWithholdingPct} />;
      // Stat cards
      case "earnings":    return <StatRow value={totalRevenue} type="currency" label="Gross Revenue" color="#10b981" country={country} />;
      case "netIncome":   return <StatRow value={netIncome}    type="currency" label="Net Income"    color="#6366f1" country={country} />;
      case "totalHours":  return <StatRow value={durationHrs}  type="decimal"  label="Hours Driven"  color="#8b5cf6" suffix=" hrs" />;
      case "avgRate":     return <StatRow value={hourlyRate}   type="currency" label="Hourly Rate"   color="#f59e0b" suffix="/hr" country={country} />;
      case "tipsTotal":   return <StatRow value={periodStats?.tips ?? 0} type="currency" label="Tips Total" color="#ec4899" country={country} />;
      case "expenses":    return <StatRow value={Math.max(0, (periodStats?.gross ?? 0) - netIncome)} type="currency" label="Expenses" color="#f43f5e" country={country} />;
      case "deliveries":  return <StatRow value={periodStats?.count ?? 0} type="number" label="Shifts Logged" color="#0ea5e9" />;
      default: return null;
    }
  }, [dailyData, bestDayData, maxDayAvg, bestHourData, maxHourAvg, mileage, streak, platformData, totalRevenue, netIncome, profile, country, durationHrs, hourlyRate, periodStats]);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: BG, paddingTop: insets.top + 64 }}
      edges={["bottom", "left", "right"]}
    >
      {/* ── Screen header ── */}
      <View
        style={{
          paddingHorizontal: 20,
          paddingTop: 20,
          paddingBottom: 16,
          borderBottomWidth: 1,
          borderBottomColor: BORDER,
          backgroundColor: BG,
        }}
      >
        <Text style={{ fontSize: 22, fontWeight: "800", color: "#ffffff", letterSpacing: -0.5, marginBottom: 2 }}>
          Analytics Builder
        </Text>
        <Text style={{ fontSize: 12, color: TEXT_MUTED, fontWeight: "500" }}>
          Drag widgets to your home dashboard
        </Text>
      </View>

      {/* ── Category tabs + Period picker ── */}
      <View
        style={{
          borderBottomWidth: 1,
          borderBottomColor: BORDER,
          backgroundColor: BG,
          paddingHorizontal: 16,
          paddingTop: 14,
          paddingBottom: 14,
          gap: 12,
        }}
      >
        {/* Category selector */}
        <View
          style={{
            flexDirection: "row",
            backgroundColor: SURFACE,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: BORDER,
            padding: 4,
            gap: 4,
          }}
        >
          {CATEGORY_CONFIG.map(({ key, label, Icon }) => {
            const active = activeCategory === key;
            return (
              <Pressable
                key={key}
                onPress={() => setActiveCategory(key)}
                style={{
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 5,
                  paddingVertical: 10,
                  borderRadius: 12,
                  backgroundColor: active ? "#1f1f1e" : "transparent",
                  borderWidth: active ? 1 : 0,
                  borderColor: BORDER,
                }}
              >
                <Icon
                  size={13}
                  color={active ? accentColor : TEXT_DIM}
                  strokeWidth={active ? 2.5 : 2}
                />
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: active ? "800" : "600",
                    color: active ? accentColor : TEXT_DIM,
                    letterSpacing: 0.1,
                  }}
                  numberOfLines={1}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Period pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: "row", gap: 6 }}>
            {PERIOD_OPTIONS.map((opt) => {
              const isActive = period === opt.key;
              return (
                <Pressable
                  key={opt.key}
                  onPress={() => setPeriod(opt.key)}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 7,
                    borderRadius: 10,
                    backgroundColor: isActive ? accentColor : SURFACE,
                    borderWidth: 1,
                    borderColor: isActive ? "transparent" : BORDER,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "800",
                      letterSpacing: 0.8,
                      textTransform: "uppercase",
                      color: isActive ? accentColorContrast : TEXT_MUTED,
                    }}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </View>

      {/* ── Body ── */}
      {loadingStats ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12 }}>
          <ActivityIndicator size="large" color={accentColor} />
          <Text style={{ fontSize: 12, color: TEXT_MUTED, fontWeight: "500" }}>Loading analytics…</Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 24, paddingBottom: 100, gap: 28 }}
        >
          {/* ── Pinned ribbon ── */}
          <View style={{ gap: 10 }}>
            <SectionLabel>Pinned to dashboard</SectionLabel>

            {onDashboardInCategory.length === 0 ? (
              <EmptySlate
                icon="📌"
                message="Nothing from this category is pinned yet."
                sub="Browse available widgets below to get started."
              />
            ) : (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {onDashboardInCategory.map((w) => (
                  <ActiveWidgetPill
                    key={w.id}
                    id={w.id}
                    size={w.size}
                    accentColor={accentColor}
                    onRemove={() => handleRemoveWidget(w.id)}
                  />
                ))}
              </View>
            )}
          </View>

          {/* ── Available widgets ── */}
          <View style={{ gap: 10 }}>
            <SectionLabel>Available widgets</SectionLabel>

            {availableInCategory.length === 0 ? (
              <EmptySlate
                icon="🎉"
                message="Every widget in this category is pinned!"
                sub="Switch to another category or manage your home layout."
              />
            ) : (
              <View style={{ gap: 12 }}>
                {availableInCategory.map((id) => (
                  <WidgetPreviewCard
                    key={id}
                    id={id}
                    accentColor={accentColor}
                    accentColorContrast={accentColorContrast}
                    onPin={() => setSizeSelectorWidget(id)}
                  >
                    {renderWidgetContent(id)}
                  </WidgetPreviewCard>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      )}

      {/* ── Size selector bottom sheet ── */}
      <SizeSelectorModal
        visible={sizeSelectorWidget !== null}
        widgetId={sizeSelectorWidget}
        accentColor={accentColor}
        accentColorContrast={accentColorContrast}
        onClose={() => setSizeSelectorWidget(null)}
        onSelect={(size) => sizeSelectorWidget && handleAddWidget(sizeSelectorWidget, size)}
      />
    </SafeAreaView>
  );
}

// ─── Tiny layout helpers ──────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text
      style={{
        fontSize: 10,
        fontWeight: "800",
        color: TEXT_DIM,
        textTransform: "uppercase",
        letterSpacing: 1.2,
        marginLeft: 2,
      }}
    >
      {children}
    </Text>
  );
}

function EmptySlate({ icon, message, sub }: { icon: string; message: string; sub: string }) {
  return (
    <View
      style={{
        paddingVertical: 32,
        paddingHorizontal: 20,
        backgroundColor: SURFACE,
        borderWidth: 1,
        borderColor: BORDER,
        borderRadius: 20,
        alignItems: "center",
        gap: 6,
      }}
    >
      <Text style={{ fontSize: 28, marginBottom: 4 }}>{icon}</Text>
      <Text style={{ fontSize: 13, fontWeight: "700", color: "#ffffff", textAlign: "center" }}>{message}</Text>
      <Text style={{ fontSize: 12, color: TEXT_MUTED, textAlign: "center", lineHeight: 18 }}>{sub}</Text>
    </View>
  );
}
