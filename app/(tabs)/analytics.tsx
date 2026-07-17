import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  ScrollView,
  View,
  ActivityIndicator,
  Platform,
  Pressable,
  Modal,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, ChevronDown, LayoutGrid, Sparkles, BarChart2, DollarSign, Wallet, TrendingDown, Landmark, Clock, Activity } from "lucide-react-native";
import Svg, { Path } from "react-native-svg";
import { Text } from "@/src/components/ui/text";
import { IconBadge } from "@/src/components/ui/IconBadge";
import { Divider } from "@/src/components/ui/Divider";
import { KPI, withAlpha } from "@/src/theme/colors";
import { useColors, useThemedStyles, type Palette } from "@/src/theme/useColors";
import {
  getPeriodStats,
  getEarningsByPlatform,
  getEarningsByDayRange,
  getBestDayOfWeek,
  getBestHourOfDay,
  getMileageSplit,
  getNetIncome,
  getHourlyRate,
  getEarningsVsHoursScatter,
  getIncomeStabilityScore,
  getFinancialMonthlyBreakdown,
} from "@/src/database/queries/analytics";
import { useSettingsStore } from "@/store/useSettingsStore";
import { DEMO_STRIP_HEIGHT } from "@/src/components/GlobalTopHeader";
import { usePlatformTheme } from "@/src/hooks/usePlatformTheme";
import { useFeatureEnabled } from "@/hooks/useFeatureEnabled";
import { useLayout } from "@/src/hooks/useLayout";
import { router } from "expo-router";

// Composite widgets (consolidated from 21 single-purpose widgets down to 6
// grouped cards, mirroring the web Analytics tab — see web/src/registry/widgets/).
import TrendsWidget from "@/src/components/widgets/TrendsWidget";
import WorkRhythmWidget from "@/src/components/widgets/WorkRhythmWidget";
import IncomeSourcesWidget from "@/src/components/widgets/IncomeSourcesWidget";
import OutlookWidget from "@/src/components/widgets/OutlookWidget";
import EfficiencyStabilityWidget from "@/src/components/widgets/EfficiencyStabilityWidget";
import OrderEconomicsWidget from "@/src/components/widgets/OrderEconomicsWidget";

// ─── Constants & Styling ──────────────────────────────────────────────────────
const makeDS = (C: Palette) =>
  ({
    BG: C.background,
    SURFACE: C.surface02,
    BORDER: C.lineSubtle,
    TEXT_MUTED: C.contentSecondary,
    TEXT_DIM: C.contentMuted,
  }) as const;

type PeriodType = "week" | "month" | "year";
type Category = "perf" | "insights" | "stats";

const CATEGORY_CONFIG = [
  { key: "perf" as const, label: "Performance", Icon: BarChart2 },
  { key: "insights" as const, label: "Insights", Icon: Sparkles },
  { key: "stats" as const, label: "Stat Cards", Icon: LayoutGrid },
];

const WIDGET_META: Record<string, { label: string; category: Category }> = {
  trends:              { label: "Trends",                 category: "perf" },
  workRhythm:           { label: "Work Rhythm",            category: "perf" },
  incomeSources:        { label: "Income Sources",         category: "insights" },
  outlook:              { label: "Outlook",                category: "insights" },
  efficiencyStability:  { label: "Efficiency & Stability", category: "insights" },
  // Stat cards are custom rendered above; this is the one granular widget left below them.
  orderEconomics:       { label: "Order Economics",        category: "stats" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getPeriodDates(type: PeriodType, offset: number, weekStartDay: number = 0) {
  const start = new Date();
  start.setHours(0,0,0,0);
  const end = new Date();
  end.setHours(23,59,59,999);

  if (type === "week") {
    const day = start.getDay();
    const diff = start.getDate() - day + (day < weekStartDay ? -7 : 0) + weekStartDay;
    start.setDate(diff + offset * 7);
    end.setTime(start.getTime() + 6 * 24 * 60 * 60 * 1000);
    end.setHours(23,59,59,999);
  } else if (type === "month") {
    start.setFullYear(start.getFullYear(), start.getMonth() + offset, 1);
    end.setFullYear(start.getFullYear(), start.getMonth() + 1, 0);
    end.setHours(23,59,59,999);
  } else if (type === "year") {
    start.setFullYear(start.getFullYear() + offset, 0, 1);
    end.setFullYear(start.getFullYear() + offset, 11, 31);
    end.setHours(23,59,59,999);
  }

  return { start, end };
}

function formatCurrencyValue(value: number, country?: string) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: country === "CA" ? "CAD" : "USD",
    minimumFractionDigits: 2,
  }).format(value);
}

function formatCurrencyParts(value: number, country?: string) {
  const parts = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: country === "CA" ? "CAD" : "USD",
  }).formatToParts(value);

  return {
    symbol: parts.find((p) => p.type === "currency")?.value || "$",
    value: parts.filter((p) => p.type !== "currency").map((p) => p.value).join(""),
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function StatDetailRows({ rows }: { rows: { label: string; value: string; color?: string }[] }) {
  const C = useColors();
  return (
    <>
      <Divider className="mt-3.5 pt-3.5" />
      <View style={{ gap: 8 }}>
        {rows.map((r) => (
          <View key={r.label} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
            <Text variant="paragraphS" className="text-content-secondary">{r.label}</Text>
            <Text variant="labelM" tabular style={{ color: r.color ?? C.contentPrimary }}>{r.value}</Text>
          </View>
        ))}
      </View>
    </>
  );
}

// `detail` (optional) makes the card tap-to-expand, showing extra rows instead of a whole
// separate card — absorbs what used to be effectiveRate/monthHourly/outOfPocket/taxJar widgets.
function PremiumStatCard({ label, value, subtitle, color, Icon, width, flex, detail }: any) {
  const { SURFACE, BORDER } = useThemedStyles(makeDS);
  const [open, setOpen] = useState(false);
  const expandable = Array.isArray(detail) && detail.length > 0;

  return (
    <Pressable
      disabled={!expandable}
      onPress={() => setOpen((o) => !o)}
      style={{ width, flex, backgroundColor: SURFACE, borderWidth: 1, borderColor: BORDER, borderRadius: 16, padding: 16 }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <IconBadge icon={Icon} color={color} tone="tinted" size="xs" strokeWidth={2.5} />
        <Text variant="labelXs" className="text-content-secondary">{label}</Text>
      </View>
      <Text variant="headingXl" tabular style={{ paddingVertical: 2, includeFontPadding: false }} adjustsFontSizeToFit numberOfLines={1}>{value}</Text>
      {subtitle && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 }}>
          <Text variant="labelXs" style={{ color }}>{subtitle}</Text>
          {expandable && (
            <ChevronDown size={12} color={color} style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }} />
          )}
        </View>
      )}
      {expandable && open && <StatDetailRows rows={detail} />}
    </Pressable>
  );
}

function SwitchableStatCard({ label, activeValue, onlineValue, activeSubtitle, onlineSubtitle, color, Icon, width, flex, detail }: any) {
  const C = useColors();
  const { SURFACE, BORDER, TEXT_MUTED } = useThemedStyles(makeDS);
  const [tab, setTab] = useState<"active" | "online">("active");
  const [open, setOpen] = useState(false);
  const expandable = Array.isArray(detail) && detail.length > 0;

  const value = tab === "active" ? activeValue : onlineValue;
  const subtitle = tab === "active" ? activeSubtitle : onlineSubtitle;

  return (
    <View style={{ width, flex, backgroundColor: SURFACE, borderWidth: 1, borderColor: BORDER, borderRadius: 16, padding: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <IconBadge icon={Icon} color={color} tone="tinted" size="xs" strokeWidth={2.5} />
          <Text variant="labelXs" className="text-content-secondary">{label}</Text>
        </View>

        <View style={{ flexDirection: "row", backgroundColor: C.surface04, borderRadius: 8, padding: 2, borderWidth: 1, borderColor: BORDER }}>
          <Pressable accessibilityRole="tab" accessibilityLabel="Active" accessibilityState={{ selected: tab === "active" }} onPress={() => setTab("active")} style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, backgroundColor: tab === "active" ? withAlpha(color, 0.12) : "transparent" }}>
            <Text variant="labelXs" style={{ color: tab === "active" ? color : TEXT_MUTED }}>ACT</Text>
          </Pressable>
          <Pressable accessibilityRole="tab" accessibilityLabel="Online" accessibilityState={{ selected: tab === "online" }} onPress={() => setTab("online")} style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, backgroundColor: tab === "online" ? withAlpha(color, 0.12) : "transparent" }}>
            <Text variant="labelXs" style={{ color: tab === "online" ? color : TEXT_MUTED }}>ONL</Text>
          </Pressable>
        </View>
      </View>

      <Text variant="headingXl" tabular style={{ paddingVertical: 2, includeFontPadding: false }} adjustsFontSizeToFit numberOfLines={1}>{value}</Text>

      {expandable ? (
        <Pressable onPress={() => setOpen((o) => !o)} style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 }}>
          <Text variant="labelXs" style={{ color }}>{subtitle}</Text>
          <ChevronDown size={12} color={color} style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }} />
        </Pressable>
      ) : (
        <Text variant="labelXs" style={{ color, marginTop: 6 }}>{subtitle}</Text>
      )}
      {expandable && open && <StatDetailRows rows={detail} />}
    </View>
  );
}

function WidgetCard({ id, children, style }: { id: string; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { SURFACE, BORDER } = useThemedStyles(makeDS);
  return (
    // `style` carries the two-up width on a wide tablet. It is undefined below
    // 900pt, so the array flattens to exactly the object that rendered before.
    <View style={[{ backgroundColor: SURFACE, borderWidth: 1, borderColor: BORDER, borderRadius: 16, overflow: "hidden", marginBottom: 12 }, style]}>
      <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: BORDER }}>
        <Text variant="labelM">{WIDGET_META[id]?.label ?? id}</Text>
      </View>
      <View style={{ padding: 16 }}>{children}</View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function AnalyticsScreen() {
  const C = useColors();
  const { BG, SURFACE, BORDER, TEXT_MUTED, TEXT_DIM } = useThemedStyles(makeDS);
  // Above the `if (!isAnalyticsEnabled) return null` below — hook order must not
  // depend on the feature flag.
  const { gridStyle, twoUpRow, twoUpItem } = useLayout();
  const insets = useSafeAreaInsets();
  const { profile, isOnboardingCompleted, activePlatformFilter, activeVehicleFilter, setHeaderVisible, streakDays, bestStreak, isDemoMode } = useSettingsStore();
  const { accentColor, accentColorContrast } = usePlatformTheme();
  const isAnalyticsEnabled = useFeatureEnabled("analytics_advanced");

  useEffect(() => {
    if (!isAnalyticsEnabled && isOnboardingCompleted) {
      router.replace("/");
    }
  }, [isAnalyticsEnabled, isOnboardingCompleted]);

  const [periodType, setPeriodType] = useState<PeriodType>("month");
  const [periodOffset, setPeriodOffset] = useState<number>(0);
  const [activeCategory, setActiveCategory] = useState<Category>("perf");
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);

  const lastScrollY = useRef(0);
  const handleScroll = (event: any) => {
    const currentY = event.nativeEvent.contentOffset.y;
    const diff = currentY - lastScrollY.current;
    const contentHeight = event.nativeEvent.contentSize.height;
    const layoutHeight = event.nativeEvent.layoutMeasurement.height;
    const isNearBottom = currentY + layoutHeight >= contentHeight - 40;

    if (currentY <= 0 || isNearBottom) {
      setHeaderVisible(true);
    } else if (diff > 15 && currentY > 50) {
      setHeaderVisible(false);
    } else if (diff < -15) {
      setHeaderVisible(true);
    }
    lastScrollY.current = currentY;
  };

  useEffect(() => {
    setHeaderVisible(true);
  }, []);

  const weekStartDay = profile?.locale?.weekStartDay ?? 0;
  const { start, end } = useMemo(() => getPeriodDates(periodType, periodOffset, weekStartDay), [periodType, periodOffset, weekStartDay]);
  const { start: thisWeekStart, end: thisWeekEnd } = useMemo(() => getPeriodDates("week", 0, weekStartDay), [weekStartDay]);
  const { start: lastWeekStart, end: lastWeekEnd } = useMemo(() => getPeriodDates("week", -1, weekStartDay), [weekStartDay]);
  const { start: monthStart, end: monthEnd } = useMemo(() => getPeriodDates("month", 0, weekStartDay), [weekStartDay]);

  // dailyData widget fetches rolling weeks relative to the viewed start date to generate the trend
  const diffTime = Math.abs(new Date().getTime() - start.getTime());
  const diffWeeksOffset = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 7));
  const trendWeeks = (periodType === "week" ? 1 : periodType === "month" ? 4 : 52) + diffWeeksOffset;

  const enabled = isOnboardingCompleted && isAnalyticsEnabled;

  const { data: periodStats, isLoading: loadingStats } = useQuery({ queryKey: ["analytics", "period-stats", start.toISOString(), end.toISOString()], queryFn: () => getPeriodStats(start, end), enabled });
  const { data: platformData = [] } = useQuery({ queryKey: ["analytics", "by-platform", start.toISOString(), end.toISOString(), activePlatformFilter, activeVehicleFilter], queryFn: () => getEarningsByPlatform(start, end, activePlatformFilter, activeVehicleFilter), enabled });
  const { data: dailyData = [] } = useQuery({ queryKey: ["analytics", "by-day-range", start.toISOString(), end.toISOString(), activePlatformFilter, activeVehicleFilter], queryFn: () => getEarningsByDayRange(start, end, activePlatformFilter, activeVehicleFilter), enabled });
  const { data: bestDayData = [] } = useQuery({ queryKey: ["analytics", "best-day", start.toISOString(), end.toISOString(), activePlatformFilter, activeVehicleFilter], queryFn: () => getBestDayOfWeek(start, end, activePlatformFilter, activeVehicleFilter), enabled });
  const { data: bestHourData = [] } = useQuery({ queryKey: ["analytics", "best-hour", start.toISOString(), end.toISOString()], queryFn: () => getBestHourOfDay(start, end), enabled });
  const { data: mileage } = useQuery({ queryKey: ["analytics", "mileage", start.toISOString(), end.toISOString()], queryFn: () => getMileageSplit(start, end), enabled });
  const { data: netIncome = 0 } = useQuery({ queryKey: ["analytics", "net-income", start.toISOString(), end.toISOString()], queryFn: () => getNetIncome(start, end), enabled });
  const { data: hourlyRate = 0 } = useQuery({ queryKey: ["analytics", "hourly-rate", start.toISOString(), end.toISOString()], queryFn: () => getHourlyRate(start, end), enabled });
  const { data: scatterData = [] } = useQuery({ queryKey: ["analytics", "scatter", start.toISOString(), end.toISOString(), activePlatformFilter, activeVehicleFilter], queryFn: () => getEarningsVsHoursScatter(start, end, activePlatformFilter, activeVehicleFilter), enabled });
  const { data: thisWeekStats } = useQuery({ queryKey: ["analytics", "week-stats", "this", thisWeekStart.toISOString(), thisWeekEnd.toISOString(), activePlatformFilter, activeVehicleFilter], queryFn: () => getPeriodStats(thisWeekStart, thisWeekEnd, activePlatformFilter, activeVehicleFilter), enabled });
  const { data: lastWeekStats } = useQuery({ queryKey: ["analytics", "week-stats", "last", lastWeekStart.toISOString(), lastWeekEnd.toISOString(), activePlatformFilter, activeVehicleFilter], queryFn: () => getPeriodStats(lastWeekStart, lastWeekEnd, activePlatformFilter, activeVehicleFilter), enabled });
  const { data: stabilityData } = useQuery({ queryKey: ["analytics", "stability-score", activePlatformFilter, activeVehicleFilter], queryFn: () => getIncomeStabilityScore(activePlatformFilter, activeVehicleFilter), enabled });
  const { data: monthHourlyRate = 0 } = useQuery({ queryKey: ["analytics", "month-hourly-rate", monthStart.toISOString(), monthEnd.toISOString(), activePlatformFilter, activeVehicleFilter], queryFn: () => getHourlyRate(monthStart, monthEnd, activePlatformFilter, activeVehicleFilter), enabled });
  const { data: monthlyBreakdown } = useQuery({ queryKey: ["analytics", "monthly-breakdown", start.toISOString(), end.toISOString(), activePlatformFilter, activeVehicleFilter], queryFn: () => getFinancialMonthlyBreakdown(start, end, activePlatformFilter, activeVehicleFilter), enabled });

  const totalRevenue  = (periodStats?.gross ?? 0) + (periodStats?.tips ?? 0) + (periodStats?.bonus ?? 0);
  const durationHrs   = (periodStats?.durationSeconds ?? 0) / 3600;
  const activeHrs      = Math.max(0, (periodStats?.durationSeconds ?? 0) - (periodStats?.pausedSeconds ?? 0)) / 3600;
  const onlineRate     = durationHrs > 0 ? totalRevenue / durationHrs : 0;
  const activeRate     = activeHrs > 0 ? totalRevenue / activeHrs : 0;
  const effectivePerHr = durationHrs > 0 ? netIncome / durationHrs : 0;
  const maxDayAvg     = Math.max(1, ...bestDayData.map((d) => d.avgEarnings));
  const maxHourAvg    = Math.max(1, ...bestHourData.map((h) => h.avgEarnings));
  const thisWeekTotal = (thisWeekStats?.gross ?? 0) + (thisWeekStats?.tips ?? 0) + (thisWeekStats?.bonus ?? 0);
  const lastWeekTotal = (lastWeekStats?.gross ?? 0) + (lastWeekStats?.tips ?? 0) + (lastWeekStats?.bonus ?? 0);
  const zeroDaysCount = dailyData.filter((d) => d.total === 0).length;
  const perDeliveryVal = (periodStats?.orders ?? 0) > 0 ? totalRevenue / (periodStats?.orders ?? 1) : 0;
  const outOfPocketVal = monthlyBreakdown?.totals?.outOfPocket ?? 0;


  const country = profile.country;

  const renderWidgetContent = useCallback((id: string) => {
    switch (id) {
      case "trends":
        return (
          <TrendsWidget
            dailyData={dailyData}
            thisWeekTotal={thisWeekTotal}
            lastWeekTotal={lastWeekTotal}
            activeHrs={activeHrs}
            durationHrs={durationHrs}
            scatterData={scatterData}
            country={country}
          />
        );
      case "workRhythm":
        return (
          <WorkRhythmWidget
            bestDayData={bestDayData}
            bestHourData={bestHourData}
            streak={{ current: streakDays, best: bestStreak }}
            zeroDaysCount={zeroDaysCount}
          />
        );
      case "incomeSources":
        return (
          <IncomeSourcesWidget
            platformData={platformData}
            totalRevenue={totalRevenue}
            netIncome={netIncome}
            taxWithholdingPct={profile.taxWithholdingPct}
            country={country}
          />
        );
      case "outlook":
        return <OutlookWidget dailyData={dailyData} country={country} />;
      case "efficiencyStability":
        return (
          <EfficiencyStabilityWidget
            mileage={mileage}
            distanceUnit={profile?.distanceUnit ?? "mi"}
            score={stabilityData?.stabilityScore ?? 0}
            weeklyGross={stabilityData?.weeklyGross ?? []}
          />
        );
      case "orderEconomics":
        return (
          <OrderEconomicsWidget
            count={periodStats?.orders ?? 0}
            perDelivery={perDeliveryVal}
            tips={periodStats?.tips ?? 0}
            country={country}
          />
        );
      default: return null;
    }
  }, [dailyData, bestDayData, maxDayAvg, bestHourData, maxHourAvg, mileage, platformData, totalRevenue, netIncome, profile, country, durationHrs, periodStats, streakDays, bestStreak, scatterData, thisWeekTotal, lastWeekTotal, activeHrs, stabilityData, perDeliveryVal, zeroDaysCount]);

  const activeWidgets = Object.keys(WIDGET_META).filter(id => WIDGET_META[id].category === activeCategory);

  // Render Stat Cards Category Content
  const renderStatCards = () => {
    const expenses = Math.max(0, (periodStats?.gross ?? 0) - netIncome);
    const taxRate = profile.taxWithholdingPct || 15;
    const taxSetAside = totalRevenue > 0 ? (totalRevenue * 0.3) * (taxRate / 100) : 0;
    
    const activeHrs = Math.max(0, (periodStats?.durationSeconds ?? 0) - (periodStats?.pausedSeconds ?? 0)) / 3600;
    const onlineRate = durationHrs > 0 ? totalRevenue / durationHrs : 0;
    const activeRate = activeHrs > 0 ? totalRevenue / activeHrs : 0;

    return (
      <View style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Full-width Hero Card */}
        <PremiumStatCard width="100%" label="Gross Earnings" value={formatCurrencyValue(totalRevenue, country)} subtitle="Total Revenue" color={KPI.gross} Icon={DollarSign} />
        
        {/* Row 1: Net & Expenses */}
        <View style={{ flexDirection: "row", gap: 12 }}>
          <PremiumStatCard flex={1} label="Net Take-Home" value={formatCurrencyValue(netIncome, country)} subtitle="After Expenses" color={KPI.net} Icon={Wallet} />
          <PremiumStatCard
            flex={1}
            label="Expenses"
            value={formatCurrencyValue(expenses, country)}
            subtitle={`${totalRevenue > 0 ? ((expenses/totalRevenue)*100).toFixed(1) : 0}% Burn Ratio`}
            color={KPI.expenses}
            Icon={TrendingDown}
            detail={[
              { label: "Burn Ratio", value: `${totalRevenue > 0 ? ((expenses/totalRevenue)*100).toFixed(1) : 0}% of gross` },
              { label: "Out of Pocket", value: formatCurrencyValue(outOfPocketVal, country) },
            ]}
          />
        </View>

        {/* Row 2: Rate & Tax */}
        <View style={{ flexDirection: "row", gap: 12 }}>
          <SwitchableStatCard
             flex={1}
             label="Avg Rate"
             activeValue={`${formatCurrencyValue(activeRate, country)}/hr`}
             onlineValue={`${formatCurrencyValue(onlineRate, country)}/hr`}
             activeSubtitle="Active Rate"
             onlineSubtitle="Online Rate"
             color={KPI.rate}
             Icon={Activity}
             detail={[
               { label: "Active Rate", value: `${formatCurrencyValue(activeRate, country)}/hr` },
               { label: "Online Rate", value: `${formatCurrencyValue(onlineRate, country)}/hr` },
               { label: "Effective (after costs)", value: `${formatCurrencyValue(effectivePerHr, country)}/hr` },
               { label: "Monthly Avg", value: `${formatCurrencyValue(monthHourlyRate, country)}/hr` },
             ]}
          />
          <PremiumStatCard
            flex={1}
            label="Tax Set-Aside"
            value={formatCurrencyValue(taxSetAside, country)}
            subtitle={`${taxRate}% Tax Rate`}
            color={KPI.tax}
            Icon={Landmark}
            detail={[
              { label: "Estimated Set-Aside", value: formatCurrencyValue(taxSetAside, country) },
              { label: "Net After Tax", value: formatCurrencyValue(Math.max(0, netIncome - taxSetAside), country), color: C.success },
            ]}
          />
        </View>
        
        {/* Full-width Footer */}
        <SwitchableStatCard 
           width="100%"
           label="Total Time" 
           activeValue={`${activeHrs.toFixed(1)} hrs`} 
           onlineValue={`${durationHrs.toFixed(1)} hrs`} 
           activeSubtitle={`${periodStats?.count ?? 0} Shifts Logged (Active)`}
           onlineSubtitle={`${periodStats?.count ?? 0} Shifts Logged (Online)`}
           color={KPI.hours}
           Icon={Clock}
        />
      </View>
    );
  };

  const getPeriodLabel = () => {
    if (periodType === "week") {
      return `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${end.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
    } else if (periodType === "month") {
      return start.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    } else {
      return start.getFullYear().toString();
    }
  };

  // All hooks above have run unconditionally — safe to early-return now without breaking
  // the Rules of Hooks. (The redirect effect above sends the user away when disabled.)
  if (!isAnalyticsEnabled) return null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BG }} edges={["bottom", "left", "right"]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[{ paddingBottom: 24, paddingTop: insets.top + 64 + (isDemoMode ? DEMO_STRIP_HEIGHT : 0) }, gridStyle]}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        
        {/* ── Header & Nav (Similar to Shifts/Expenses) ── */}
        <View style={{ alignItems: "center", marginVertical: 20, gap: 8 }}>
          <Pressable accessibilityRole="button" onPress={() => setIsSelectorOpen(true)} style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.surface03, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, borderColor: C.lineSubtle }}>
            <Text variant="labelXs" className="text-content-secondary">
              {getPeriodLabel()}
            </Text>
            <View style={{ justifyContent: "center", alignItems: "center" }}>
              <Svg width={10} height={6} viewBox="0 0 10 6" fill="none">
                <Path d="M1 1L5 5L9 1" stroke={C.contentSecondary} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </View>
          </Pressable>

          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", width: "100%", paddingHorizontal: 24 }}>
            <Pressable accessibilityRole="button" accessibilityLabel="Previous period" onPress={() => setPeriodOffset(o => o - 1)} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.surface03, borderWidth: StyleSheet.hairlineWidth, borderColor: C.lineSubtle, alignItems: "center", justifyContent: "center" }}>
              <ChevronLeft color={C.contentPrimary} />
            </Pressable>

            <View style={{ flexDirection: "row", alignItems: "flex-start", flexShrink: 1, minWidth: 0 }}>
              <Text style={{ fontSize: 24, fontWeight: "600", color: C.contentPrimary, lineHeight: 30, marginTop: 10, marginRight: 4 }}>
                {formatCurrencyParts(netIncome, country).symbol}
              </Text>
              <Text tabular style={{ flexShrink: 1, fontSize: 40, fontWeight: "800", color: C.contentPrimary, letterSpacing: -0.5, lineHeight: 48, paddingVertical: 2, includeFontPadding: false }} numberOfLines={1} adjustsFontSizeToFit>
                {formatCurrencyParts(netIncome, country).value}
              </Text>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Next period"
              accessibilityState={{ disabled: periodOffset >= 0 }}
              onPress={() => setPeriodOffset(o => o + 1)}
              disabled={periodOffset >= 0}
              style={[{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.surface03, borderWidth: StyleSheet.hairlineWidth, borderColor: C.lineSubtle, alignItems: "center", justifyContent: "center" }, periodOffset >= 0 && { opacity: 0.35, borderColor: C.surface03 }]}
            >
              <ChevronRight color={periodOffset >= 0 ? C.contentDisabled : C.contentPrimary} />
            </Pressable>
          </View>
        </View>

        {/* ── Body ── */}
        {loadingStats ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12 }}>
            <ActivityIndicator size="large" color={accentColor} />
          </View>
        ) : (
          <View style={{ paddingHorizontal: 16 }}>
            {/*
              On a wide tablet the widgets go two-up. A 500pt card beside another
              beats one 1000pt-wide card with a sparkline stretched across it —
              which is the whole reason this screen needed the extra width rather
              than just a centred column. Below 900pt `twoUpRow`/`twoUpItem` are
              undefined and the cards stack exactly as they always have.
            */}
            {activeCategory === "stats" ? (
              <>
                {renderStatCards()}
                <View style={[{ marginTop: 12 }, twoUpRow]}>
                  {activeWidgets.map((id) => (
                    <WidgetCard key={id} id={id} style={twoUpItem}>
                      {renderWidgetContent(id)}
                    </WidgetCard>
                  ))}
                </View>
              </>
            ) : (
              <View style={twoUpRow}>
                {activeWidgets.map((id) => (
                  <WidgetCard key={id} id={id} style={twoUpItem}>
                    {renderWidgetContent(id)}
                  </WidgetCard>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* ── Category tabs ── */}
      <View style={{ borderTopWidth: 1, borderTopColor: BORDER, backgroundColor: BG, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12 }}>
        <View style={{ flexDirection: "row", backgroundColor: SURFACE, borderRadius: 16, borderWidth: 1, borderColor: BORDER, padding: 4, gap: 4 }}>
          {CATEGORY_CONFIG.map(({ key, label, Icon }) => {
            const active = activeCategory === key;
            return (
              <Pressable key={key} accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={() => setActiveCategory(key)} style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 10, borderRadius: 12, backgroundColor: active ? C.surface04 : "transparent", borderWidth: active ? 1 : 0, borderColor: BORDER }}>
                <Icon size={13} color={active ? accentColor : TEXT_DIM} strokeWidth={active ? 2.5 : 2} />
                <Text variant="labelXs" style={{ color: active ? accentColor : TEXT_DIM }} numberOfLines={1}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* ── Period Selector Modal ── */}
      <Modal visible={isSelectorOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setIsSelectorOpen(false)}>
        <View style={{ flex: 1, backgroundColor: C.background }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.lineSubtle, paddingTop: Platform.OS === 'ios' ? 16 : insets.top + 16 }}>
            <Text variant="headingM">Time Period</Text>
            <Pressable accessibilityRole="button" onPress={() => setIsSelectorOpen(false)}>
              <Text variant="labelM" style={{ color: accentColor }}>Done</Text>
            </Pressable>
          </View>

          <View style={{ paddingHorizontal: 16, paddingTop: 20 }}>
            <Text variant="labelXs" className="text-content-secondary" style={{ marginBottom: 12 }}>Select grouping</Text>
            <View style={{ flexDirection: "row", backgroundColor: SURFACE, borderRadius: 12, padding: 4, borderWidth: 1, borderColor: BORDER }}>
              {["week", "month", "year"].map((type) => {
                const isActive = periodType === type;
                return (
                  <Pressable
                    key={type}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isActive }}
                    onPress={() => { setPeriodType(type as PeriodType); setPeriodOffset(0); setIsSelectorOpen(false); }}
                    style={{ flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: isActive ? accentColor : "transparent", alignItems: "center" }}
                  >
                    <Text variant="labelM" style={{ color: isActive ? accentColorContrast : TEXT_MUTED, textTransform: "capitalize" }}>{type}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text variant="paragraphS" style={{ marginTop: 16 }}>
              Change the time grouping here to adjust how the analytics dashboard aggregates your performance metrics. Use the back/forward arrows on the main screen to scrub backward in time.
            </Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
