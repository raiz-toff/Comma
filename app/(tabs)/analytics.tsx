import React, { useState, useMemo, useCallback } from "react";
import {
  ScrollView,
  View,
  ActivityIndicator,
  Platform,
  Pressable,
  Modal,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, LayoutGrid, Sparkles, BarChart2, DollarSign, Wallet, TrendingDown, Landmark, Clock, Activity } from "lucide-react-native";
import Svg, { Path } from "react-native-svg";
import { Text } from "@/src/components/ui/text";
import {
  getPeriodStats,
  getEarningsByPlatform,
  getEarningsByDayRange,
  getBestDayOfWeek,
  getBestHourOfDay,
  getMileageSplit,
  getNetIncome,
  getHourlyRate,
} from "@/src/database/queries/analytics";
import { useSettingsStore } from "@/store/useSettingsStore";
import { usePlatformTheme } from "@/src/hooks/usePlatformTheme";

import BestDayWidget from "@/src/components/widgets/BestDayWidget";
import BestHourWidget from "@/src/components/widgets/BestHourWidget";
import DeadMilesWidget from "@/src/components/widgets/DeadMilesWidget";
import StreakWidget from "@/src/components/widgets/StreakWidget";
import PlatformActivityWidget from "@/src/components/widgets/PlatformActivityWidget";
import IncomeBreakdownWidget from "@/src/components/widgets/IncomeBreakdownWidget";
import WeeklyProjectionWidget from "@/src/components/widgets/WeeklyProjectionWidget";
import TaxJarWidget from "@/src/components/widgets/TaxJarWidget";

// ─── Constants & Styling ──────────────────────────────────────────────────────
const BG = "#000000";
const SURFACE = "#0d0d0d";
const BORDER = "#262522";
const TEXT_MUTED = "#71717a";
const TEXT_DIM = "#52525b";

type PeriodType = "week" | "month" | "year";
type Category = "perf" | "insights" | "stats";

const CATEGORY_CONFIG = [
  { key: "perf" as const, label: "Performance", Icon: BarChart2 },
  { key: "insights" as const, label: "Insights", Icon: Sparkles },
  { key: "stats" as const, label: "Stat Cards", Icon: LayoutGrid },
];

const WIDGET_META: Record<string, { label: string; category: Category }> = {
  bestDay:          { label: "Best Day of Week",         category: "perf" },
  bestHour:         { label: "Best Hour of Day",         category: "perf" },
  deadMiles:        { label: "Dead Mileage Split",       category: "perf" },
  streak:           { label: "Active Streak",            category: "perf" },
  platformActivity: { label: "Platform Breakdown",       category: "insights" },
  incomeBreakdown:  { label: "Income Breakdown",         category: "insights" },
  weeklyProjection: { label: "Weekly Projection",        category: "insights" },
  taxJar:           { label: "Tax Jar Withholding",      category: "insights" },
  // Stat cards are now custom rendered
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getPeriodDates(type: PeriodType, offset: number) {
  const start = new Date();
  start.setHours(0,0,0,0);
  const end = new Date();
  end.setHours(23,59,59,999);

  if (type === "week") {
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1);
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
function PremiumStatCard({ label, value, subtitle, color, Icon, width, flex }: any) {
  return (
    <View style={{ width, flex, backgroundColor: SURFACE, borderWidth: 1, borderColor: BORDER, borderRadius: 20, padding: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <View style={{ backgroundColor: color + "20", padding: 6, borderRadius: 8 }}>
          <Icon size={14} color={color} strokeWidth={2.5} />
        </View>
        <Text style={{ fontSize: 10, fontWeight: "800", color: TEXT_MUTED, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</Text>
      </View>
      <Text style={{ fontSize: 32, fontWeight: "800", color: "#ffffff", letterSpacing: -1 }} adjustsFontSizeToFit numberOfLines={1}>{value}</Text>
      {subtitle && <Text style={{ fontSize: 11, fontWeight: "700", color: color, marginTop: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>{subtitle}</Text>}
    </View>
  );
}

function SwitchableStatCard({ label, activeValue, onlineValue, activeSubtitle, onlineSubtitle, color, Icon, width, flex }: any) {
  const [tab, setTab] = useState<"active" | "online">("active");

  const value = tab === "active" ? activeValue : onlineValue;
  const subtitle = tab === "active" ? activeSubtitle : onlineSubtitle;

  return (
    <View style={{ width, flex, backgroundColor: SURFACE, borderWidth: 1, borderColor: BORDER, borderRadius: 20, padding: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={{ backgroundColor: color + "20", padding: 6, borderRadius: 8 }}>
            <Icon size={14} color={color} strokeWidth={2.5} />
          </View>
          <Text style={{ fontSize: 10, fontWeight: "800", color: TEXT_MUTED, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</Text>
        </View>

        <View style={{ flexDirection: "row", backgroundColor: "#1f1f1e", borderRadius: 8, padding: 2, borderWidth: 1, borderColor: BORDER }}>
          <Pressable onPress={() => setTab("active")} style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: tab === "active" ? color + "20" : "transparent" }}>
            <Text style={{ fontSize: 9, fontWeight: "800", color: tab === "active" ? color : TEXT_MUTED }}>ACT</Text>
          </Pressable>
          <Pressable onPress={() => setTab("online")} style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: tab === "online" ? color + "20" : "transparent" }}>
            <Text style={{ fontSize: 9, fontWeight: "800", color: tab === "online" ? color : TEXT_MUTED }}>ONL</Text>
          </Pressable>
        </View>
      </View>
      
      <Text style={{ fontSize: 32, fontWeight: "800", color: "#ffffff", letterSpacing: -1 }} adjustsFontSizeToFit numberOfLines={1}>{value}</Text>
      <Text style={{ fontSize: 11, fontWeight: "700", color: color, marginTop: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>{subtitle}</Text>
    </View>
  );
}

function WidgetCard({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <View style={{ backgroundColor: SURFACE, borderWidth: 1, borderColor: BORDER, borderRadius: 20, overflow: "hidden", marginBottom: 12 }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: BORDER }}>
        <Text style={{ fontSize: 13, fontWeight: "700", color: "#ffffff" }}>{WIDGET_META[id]?.label ?? id}</Text>
      </View>
      <View style={{ padding: 16 }}>{children}</View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function AnalyticsScreen() {
  const insets = useSafeAreaInsets();
  const { profile, isOnboardingCompleted, activePlatformFilter } = useSettingsStore();
  const { accentColor, accentColorContrast } = usePlatformTheme();

  const [periodType, setPeriodType] = useState<PeriodType>("month");
  const [periodOffset, setPeriodOffset] = useState<number>(0);
  const [activeCategory, setActiveCategory] = useState<Category>("perf");
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);

  const { start, end } = useMemo(() => getPeriodDates(periodType, periodOffset), [periodType, periodOffset]);
  
  // dailyData widget fetches rolling weeks relative to the viewed start date to generate the trend
  const diffTime = Math.abs(new Date().getTime() - start.getTime());
  const diffWeeksOffset = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 7));
  const trendWeeks = (periodType === "week" ? 1 : periodType === "month" ? 4 : 52) + diffWeeksOffset;

  const enabled = isOnboardingCompleted;

  const { data: periodStats, isLoading: loadingStats } = useQuery({ queryKey: ["analytics", "period-stats", start.toISOString(), end.toISOString()], queryFn: () => getPeriodStats(start, end), enabled });
  const { data: platformData = [] } = useQuery({ queryKey: ["analytics", "by-platform", start.toISOString(), end.toISOString(), activePlatformFilter], queryFn: () => getEarningsByPlatform(start, end, activePlatformFilter), enabled });
  const { data: dailyData = [] } = useQuery({ queryKey: ["analytics", "by-day-range", start.toISOString(), end.toISOString(), activePlatformFilter], queryFn: () => getEarningsByDayRange(start, end, activePlatformFilter), enabled });
  const { data: bestDayData = [] } = useQuery({ queryKey: ["analytics", "best-day", start.toISOString(), end.toISOString(), activePlatformFilter], queryFn: () => getBestDayOfWeek(start, end, activePlatformFilter), enabled });
  const { data: bestHourData = [] } = useQuery({ queryKey: ["analytics", "best-hour", start.toISOString(), end.toISOString()], queryFn: () => getBestHourOfDay(start, end), enabled });
  const { data: mileage } = useQuery({ queryKey: ["analytics", "mileage", start.toISOString(), end.toISOString()], queryFn: () => getMileageSplit(start, end), enabled });
  const { data: netIncome = 0 } = useQuery({ queryKey: ["analytics", "net-income", start.toISOString(), end.toISOString()], queryFn: () => getNetIncome(start, end), enabled });
  const { data: hourlyRate = 0 } = useQuery({ queryKey: ["analytics", "hourly-rate", start.toISOString(), end.toISOString()], queryFn: () => getHourlyRate(start, end), enabled });

  const totalRevenue  = (periodStats?.gross ?? 0) + (periodStats?.tips ?? 0);
  const durationHrs   = (periodStats?.durationSeconds ?? 0) / 3600;
  const maxDayAvg     = Math.max(1, ...bestDayData.map((d) => d.avgEarnings));
  const maxHourAvg    = Math.max(1, ...bestHourData.map((h) => h.avgEarnings));

  const streak = useMemo(() => {
    let best = 0, cur = 0;
    dailyData.forEach((d) => { if (d.total > 0) { cur++; best = Math.max(best, cur); } else cur = 0; });
    return { current: cur, best };
  }, [dailyData]);

  const country = profile.country;

  const renderWidgetContent = useCallback((id: string) => {
    switch (id) {
      case "bestDay":           return <BestDayWidget bestDayData={bestDayData} maxDayAvg={maxDayAvg} />;
      case "bestHour":          return <BestHourWidget bestHourData={bestHourData} maxHourAvg={maxHourAvg} />;
      case "deadMiles":         return <DeadMilesWidget mileage={mileage} />;
      case "streak":            return <StreakWidget streak={streak} />;
      case "platformActivity":  return <PlatformActivityWidget platformData={platformData} />;
      case "incomeBreakdown":   return <IncomeBreakdownWidget totalRevenue={totalRevenue} netIncome={netIncome} taxWithholdingPct={profile.taxWithholdingPct} country={country} />;
      case "weeklyProjection":  return <WeeklyProjectionWidget dailyData={dailyData} country={country} />;
      case "taxJar":            return <TaxJarWidget taxWithholdingPct={profile.taxWithholdingPct} />;
      default: return null;
    }
  }, [dailyData, bestDayData, maxDayAvg, bestHourData, maxHourAvg, mileage, streak, platformData, totalRevenue, netIncome, profile, country, durationHrs, hourlyRate, periodStats]);

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
        <PremiumStatCard width="100%" label="Gross Earnings" value={formatCurrencyValue(totalRevenue, country)} subtitle="Total Revenue" color="#14b8a6" Icon={DollarSign} />
        
        {/* Row 1: Net & Expenses */}
        <View style={{ flexDirection: "row", gap: 12 }}>
          <PremiumStatCard flex={1} label="Net Take-Home" value={formatCurrencyValue(netIncome, country)} subtitle="After Expenses" color="#3b82f6" Icon={Wallet} />
          <PremiumStatCard flex={1} label="Expenses" value={formatCurrencyValue(expenses, country)} subtitle={`${totalRevenue > 0 ? ((expenses/totalRevenue)*100).toFixed(1) : 0}% Burn Ratio`} color="#ef4444" Icon={TrendingDown} />
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
             color="#f59e0b" 
             Icon={Activity} 
          />
          <PremiumStatCard flex={1} label="Tax Set-Aside" value={formatCurrencyValue(taxSetAside, country)} subtitle={`${taxRate}% Tax Rate`} color="#0ea5e9" Icon={Landmark} />
        </View>
        
        {/* Full-width Footer */}
        <SwitchableStatCard 
           width="100%"
           label="Total Time" 
           activeValue={`${activeHrs.toFixed(1)} hrs`} 
           onlineValue={`${durationHrs.toFixed(1)} hrs`} 
           activeSubtitle={`${periodStats?.count ?? 0} Shifts Logged (Active)`}
           onlineSubtitle={`${periodStats?.count ?? 0} Shifts Logged (Online)`}
           color="#8b5cf6" 
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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BG }} edges={["bottom", "left", "right"]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24, paddingTop: insets.top + 64 }}>
        
        {/* ── Header & Nav (Similar to Shifts/Expenses) ── */}
        <View style={{ alignItems: "center", marginVertical: 20, gap: 8 }}>
          <Pressable onPress={() => setIsSelectorOpen(true)} style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#161615", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 0.8, borderColor: "#262522" }}>
            <Text style={{ fontSize: 12, fontWeight: "800", color: "#a1a1aa", textTransform: "uppercase", letterSpacing: 0.5 }}>
              {getPeriodLabel()}
            </Text>
            <View style={{ justifyContent: "center", alignItems: "center" }}>
              <Svg width={10} height={6} viewBox="0 0 10 6" fill="none">
                <Path d="M1 1L5 5L9 1" stroke="#a1a1aa" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </View>
          </Pressable>

          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", width: "100%", paddingHorizontal: 24 }}>
            <Pressable onPress={() => setPeriodOffset(o => o - 1)} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "#161615", borderWidth: 0.8, borderColor: "#262522", alignItems: "center", justifyContent: "center" }}>
              <ChevronLeft color="#fff" />
            </Pressable>

            <View style={{ flexDirection: "row", alignItems: "flex-start", flexShrink: 1, minWidth: 0 }}>
              <Text style={{ fontSize: 24, fontWeight: "600", color: "#fff", lineHeight: 30, marginTop: 10, marginRight: 4 }}>
                {formatCurrencyParts(netIncome, country).symbol}
              </Text>
              <Text style={{ flexShrink: 1, fontSize: 40, fontWeight: "800", color: "#fff", letterSpacing: -0.5, lineHeight: 48, paddingVertical: 2, includeFontPadding: false }} numberOfLines={1} adjustsFontSizeToFit>
                {formatCurrencyParts(netIncome, country).value}
              </Text>
            </View>

            <Pressable
              onPress={() => setPeriodOffset(o => o + 1)}
              disabled={periodOffset >= 0}
              style={[{ width: 44, height: 44, borderRadius: 22, backgroundColor: "#161615", borderWidth: 0.8, borderColor: "#262522", alignItems: "center", justifyContent: "center" }, periodOffset >= 0 && { opacity: 0.35, borderColor: "#161615" }]}
            >
              <ChevronRight color={periodOffset >= 0 ? "#3f3f46" : "#fff"} />
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
            {activeCategory === "stats" ? renderStatCards() : activeWidgets.map((id) => (
              <WidgetCard key={id} id={id}>
                {renderWidgetContent(id)}
              </WidgetCard>
            ))}
          </View>
        )}
      </ScrollView>

      {/* ── Category tabs ── */}
      <View style={{ borderTopWidth: 1, borderTopColor: BORDER, backgroundColor: BG, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12 }}>
        <View style={{ flexDirection: "row", backgroundColor: SURFACE, borderRadius: 16, borderWidth: 1, borderColor: BORDER, padding: 4, gap: 4 }}>
          {CATEGORY_CONFIG.map(({ key, label, Icon }) => {
            const active = activeCategory === key;
            return (
              <Pressable key={key} onPress={() => setActiveCategory(key)} style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 10, borderRadius: 12, backgroundColor: active ? "#1f1f1e" : "transparent", borderWidth: active ? 1 : 0, borderColor: BORDER }}>
                <Icon size={13} color={active ? accentColor : TEXT_DIM} strokeWidth={active ? 2.5 : 2} />
                <Text style={{ fontSize: 11, fontWeight: active ? "800" : "600", color: active ? accentColor : TEXT_DIM, letterSpacing: 0.1 }} numberOfLines={1}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* ── Period Selector Modal ── */}
      <Modal visible={isSelectorOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setIsSelectorOpen(false)}>
        <View style={{ flex: 1, backgroundColor: "#000" }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 0.5, borderBottomColor: "#1f1f1f", paddingTop: Platform.OS === 'ios' ? 16 : insets.top + 16 }}>
            <Text style={{ fontSize: 18, fontWeight: "800", color: "#fff" }}>Time Period</Text>
            <Pressable onPress={() => setIsSelectorOpen(false)}>
              <Text style={{ fontSize: 14, fontWeight: "600", color: accentColor }}>Done</Text>
            </Pressable>
          </View>

          <View style={{ paddingHorizontal: 16, paddingTop: 20 }}>
            <Text style={{ fontSize: 11, fontWeight: "800", color: TEXT_MUTED, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Select grouping</Text>
            <View style={{ flexDirection: "row", backgroundColor: SURFACE, borderRadius: 12, padding: 4, borderWidth: 1, borderColor: BORDER }}>
              {["week", "month", "year"].map((type) => {
                const isActive = periodType === type;
                return (
                  <Pressable
                    key={type}
                    onPress={() => { setPeriodType(type as PeriodType); setPeriodOffset(0); setIsSelectorOpen(false); }}
                    style={{ flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: isActive ? accentColor : "transparent", alignItems: "center" }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: isActive ? "800" : "600", color: isActive ? accentColorContrast : TEXT_MUTED, textTransform: "capitalize" }}>{type}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={{ fontSize: 12, color: TEXT_DIM, marginTop: 16, lineHeight: 18 }}>
              Change the time grouping here to adjust how the analytics dashboard aggregates your performance metrics. Use the back/forward arrows on the main screen to scrub backward in time.
            </Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
