import React, { useState, useMemo, useEffect } from "react";
import {
  ScrollView,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Alert,
  Modal,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, X } from "lucide-react-native";
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

// Import modular widgets
import RollingTrendWidget from "@/src/components/widgets/RollingTrendWidget";
import BestDayWidget from "@/src/components/widgets/BestDayWidget";
import BestHourWidget from "@/src/components/widgets/BestHourWidget";
import DeadMilesWidget from "@/src/components/widgets/DeadMilesWidget";
import StreakWidget from "@/src/components/widgets/StreakWidget";
import PlatformActivityWidget from "@/src/components/widgets/PlatformActivityWidget";
import IncomeBreakdownWidget from "@/src/components/widgets/IncomeBreakdownWidget";
import WeeklyProjectionWidget from "@/src/components/widgets/WeeklyProjectionWidget";
import TaxJarWidget from "@/src/components/widgets/TaxJarWidget";

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

type Period = "week" | "month" | "3m" | "year" | "all";

const PERIOD_OPTIONS: { key: Period; label: string; weeks: number }[] = [
  { key: "week", label: "Week", weeks: 1 },
  { key: "month", label: "Month", weeks: 4 },
  { key: "3m", label: "3M", weeks: 13 },
  { key: "year", label: "Year", weeks: 52 },
  { key: "all", label: "All", weeks: 520 },
];

function getPeriodDates(period: Period): { start: Date; end: Date } {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  if (period === "week") start.setDate(start.getDate() - 7);
  else if (period === "month") start.setDate(start.getDate() - 30);
  else if (period === "3m") start.setDate(start.getDate() - 90);
  else if (period === "year") start.setDate(start.getDate() - 365);
  else {
    start.setFullYear(start.getFullYear() - 10);
  }

  return { start, end };
}

const DEFAULT_DASHBOARD_WIDGETS = [
  { id: "rollingTrend", size: "2x1" },
  { id: "platformActivity", size: "1x1" },
  { id: "deadMiles", size: "1x1" },
  { id: "taxJar", size: "1x1" },
];

export default function AnalyticsScreen() {
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { profile, isOnboardingCompleted } = useSettingsStore();
  const [period, setPeriod] = useState<Period>("month");
  const [activeCategory, setActiveCategory] = useState<"perf" | "insights" | "stats">("perf");
  const [dashboardWidgets, setDashboardWidgets] = useState<{ id: string; size: string }[]>([]);
  const [sizeSelectorWidget, setSizeSelectorWidget] = useState<string | null>(null);

  const { start, end } = useMemo(() => getPeriodDates(period), [period]);
  const weeks = PERIOD_OPTIONS.find((p) => p.key === period)?.weeks ?? 4;

  // Load Custom Dashboard Widgets Configuration
  useEffect(() => {
    async function loadWidgets() {
      if (isWeb) {
        try {
          const val = localStorage.getItem("comma_setting_dashboard_widgets");
          setDashboardWidgets(val ? JSON.parse(val) : DEFAULT_DASHBOARD_WIDGETS);
        } catch {
          setDashboardWidgets(DEFAULT_DASHBOARD_WIDGETS);
        }
      } else {
        try {
          const row = await db.select().from(settings).where(eq(settings.key, "dashboard_widgets")).limit(1);
          setDashboardWidgets(row[0]?.value ? JSON.parse(row[0].value) : DEFAULT_DASHBOARD_WIDGETS);
        } catch {
          setDashboardWidgets(DEFAULT_DASHBOARD_WIDGETS);
        }
      }
    }
    loadWidgets();
  }, []);

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: periodStats, isLoading: loadingStats } = useQuery({
    queryKey: ["analytics", "period-stats", period],
    queryFn: () => getPeriodStats(start, end),
    enabled: isOnboardingCompleted,
  });

  const { data: platformData = [] } = useQuery({
    queryKey: ["analytics", "by-platform", period],
    queryFn: () => getEarningsByPlatform(start, end),
    enabled: isOnboardingCompleted,
  });

  const { data: dailyData = [] } = useQuery({
    queryKey: ["analytics", "by-day", period],
    queryFn: () => getEarningsByDay(weeks),
    enabled: isOnboardingCompleted,
  });

  const { data: bestDayData = [] } = useQuery({
    queryKey: ["analytics", "best-day", period],
    queryFn: () => getBestDayOfWeek(start, end),
    enabled: isOnboardingCompleted,
  });

  const { data: bestHourData = [] } = useQuery({
    queryKey: ["analytics", "best-hour", period],
    queryFn: () => getBestHourOfDay(start, end),
    enabled: isOnboardingCompleted,
  });

  const { data: mileage } = useQuery({
    queryKey: ["analytics", "mileage", period],
    queryFn: () => getMileageSplit(start, end),
    enabled: isOnboardingCompleted,
  });

  const { data: netIncome = 0 } = useQuery({
    queryKey: ["analytics", "net-income", period],
    queryFn: () => getNetIncome(start, end),
    enabled: isOnboardingCompleted,
  });

  const { data: hourlyRate = 0 } = useQuery({
    queryKey: ["analytics", "hourly-rate", period],
    queryFn: () => getHourlyRate(start, end),
    enabled: isOnboardingCompleted,
  });

  // ── Derived values ───────────────────────────────────────────────────────
  const totalRevenue = (periodStats?.gross || 0) + (periodStats?.tips || 0);
  const durationHrs = (periodStats?.durationSeconds || 0) / 3600;
  const maxDailyEarning = Math.max(1, ...dailyData.map((d) => d.total));
  const maxDayAvg = Math.max(1, ...bestDayData.map((d) => d.avgEarnings));
  const maxHourAvg = Math.max(1, ...bestHourData.map((h) => h.avgEarnings));

  // Compute Streak days from dailyData
  const streak = useMemo(() => {
    let best = 0;
    let cur = 0;
    dailyData.forEach((d) => {
      if (d.total > 0) {
        cur++;
        best = Math.max(best, cur);
      } else {
        cur = 0;
      }
    });
    return { current: cur, best };
  }, [dailyData]);

  // Widget Actions
  const handleAddWidget = async (id: string, size: string) => {
    const updated = [...dashboardWidgets.filter((w) => w.id !== id), { id, size }];
    setDashboardWidgets(updated);
    setSizeSelectorWidget(null);
    await upsertSetting("dashboard_widgets", JSON.stringify(updated));
    queryClient.invalidateQueries({ queryKey: ["analytics"] });
  };

  const handleRemoveWidget = async (id: string) => {
    const updated = dashboardWidgets.filter((w) => w.id !== id);
    setDashboardWidgets(updated);
    await upsertSetting("dashboard_widgets", JSON.stringify(updated));
    queryClient.invalidateQueries({ queryKey: ["analytics"] });
  };

  // Categories definition
  const perfWidgetIds = ["rollingTrend", "bestDay", "bestHour", "deadMiles", "streak"];
  const insightWidgetIds = ["platformActivity", "incomeBreakdown", "weeklyProjection", "taxJar"];
  const statWidgetIds = ["earnings", "netIncome", "totalHours", "avgRate", "tipsTotal", "expenses", "deliveries"];

  const activeWidgetIds = useMemo(() => {
    if (activeCategory === "perf") return perfWidgetIds;
    if (activeCategory === "insights") return insightWidgetIds;
    return statWidgetIds;
  }, [activeCategory]);

  const onDashboardInCategory = useMemo(() => {
    return dashboardWidgets.filter((w) => activeWidgetIds.includes(w.id));
  }, [dashboardWidgets, activeWidgetIds]);

  const availableInCategory = useMemo(() => {
    return activeWidgetIds.filter((id) => !dashboardWidgets.some((w) => w.id === id));
  }, [dashboardWidgets, activeWidgetIds]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: profile.country === "CA" ? "CAD" : "USD",
      minimumFractionDigits: 2,
    }).format(val);
  };

  // Render Widget Live View
  const renderWidgetContent = (id: string) => {
    switch (id) {
      case "rollingTrend":
        return <RollingTrendWidget dailyData={dailyData} />;
      case "bestDay":
        return <BestDayWidget bestDayData={bestDayData} maxDayAvg={maxDayAvg} />;
      case "bestHour":
        return <BestHourWidget bestHourData={bestHourData} maxHourAvg={maxHourAvg} />;
      case "deadMiles":
        return <DeadMilesWidget mileage={mileage} />;
      case "streak":
        return <StreakWidget streak={streak} />;
      case "platformActivity":
        return <PlatformActivityWidget platformData={platformData} />;
      case "incomeBreakdown":
        return (
          <IncomeBreakdownWidget
            totalRevenue={totalRevenue}
            netIncome={netIncome}
            taxWithholdingPct={profile.taxWithholdingPct}
            country={profile.country}
          />
        );
      case "weeklyProjection":
        return <WeeklyProjectionWidget dailyData={dailyData} country={profile.country} />;
      case "taxJar":
        return <TaxJarWidget taxWithholdingPct={profile.taxWithholdingPct} />;

      // Stat cards
      case "earnings":
        return <StatValue value={totalRevenue} type="currency" label="Gross Revenue" color="#10b981" />;
      case "netIncome":
        return <StatValue value={netIncome} type="currency" label="Net Income" color="#6366f1" />;
      case "totalHours":
        return <StatValue value={durationHrs} type="decimal" label="Hours Driven" color="#8b5cf6" suffix=" hrs" />;
      case "avgRate":
        return <StatValue value={hourlyRate} type="currency" label="Hourly Rate" color="#f59e0b" suffix="/hr" />;
      case "tipsTotal":
        return <StatValue value={periodStats?.tips || 0} type="currency" label="Tips Total" color="#ec4899" />;
      case "expenses":
        return <StatValue value={periodStats?.gross && netIncome ? Math.max(0, periodStats.gross - netIncome) : 0} type="currency" label="Expenses Claims" color="#f43f5e" />;
      case "deliveries":
        return <StatValue value={periodStats?.count || 0} type="number" label="Shifts Logged" color="#0ea5e9" />;
      default:
        return null;
    }
  };

  const getWidgetLabel = (id: string) => {
    const labels: Record<string, string> = {
      rollingTrend: "Rolling Trend (30d)",
      bestDay: "Best Day of Week",
      bestHour: "Best Hour of Day",
      deadMiles: "Dead Mileage Split",
      streak: "Active Streak",
      platformActivity: "Platform Breakdown",
      incomeBreakdown: "Income Breakdown",
      weeklyProjection: "Weekly Projection",
      taxJar: "Tax Jar Withholding",
      earnings: "Gross Revenue",
      netIncome: "Net Income",
      totalHours: "Hours Driven",
      avgRate: "Hourly Rate",
      tipsTotal: "Tips Total",
      expenses: "Expenses Claims",
      deliveries: "Shifts Logged",
    };
    return labels[id] || id;
  };

  return (
    <SafeAreaView className="dark flex-1 bg-[#000000]" edges={["bottom", "left", "right"]} style={{ paddingTop: insets.top + 64 }}>
      {/* Header */}
      <View className="px-4 pt-3 pb-2 border-b border-slate-800/80 bg-slate-900/40 flex-row justify-between items-center">
        <View>
          <Text className="text-lg font-extrabold text-slate-100 tracking-tight">Analytics Builder</Text>
          <Text className="text-[10px] text-slate-400">Assemble widgets on your home screen</Text>
        </View>
      </View>

      {/* Categories Tabs & Period Selector */}
      <View className="border-b border-slate-900 bg-slate-950/20 px-3 py-2 flex flex-col gap-2">
        {/* Categories */}
        <View className="flex-row gap-1 bg-slate-950 p-1 rounded-xl border border-slate-850">
          {(["perf", "insights", "stats"] as const).map((cat) => {
            const active = activeCategory === cat;
            return (
              <TouchableOpacity
                key={cat}
                onPress={() => setActiveCategory(cat)}
                className={cn("flex-1 py-2 rounded-lg items-center", active ? "bg-slate-900 border border-slate-800" : "bg-transparent")}
              >
                <Text className={cn("text-xs font-bold capitalize", active ? "text-emerald-400 font-extrabold" : "text-slate-450")}>
                  {cat === "perf" ? "Performance" : cat === "insights" ? "Insights" : "Stat Cards"}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Periods list */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row gap-2 py-1">
            {PERIOD_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                onPress={() => setPeriod(opt.key)}
                className={cn(
                  "px-3.5 py-1.5 rounded-full border",
                  period === opt.key ? "border-emerald-500 bg-emerald-500/10" : "border-slate-800 bg-slate-900/40"
                )}
              >
                <Text className={cn("text-[10px] font-extrabold uppercase tracking-wider", period === opt.key ? "text-emerald-400" : "text-slate-400")}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      {loadingStats ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#10b981" />
        </View>
      ) : (
        <ScrollView contentContainerClassName="p-4 pb-20 flex flex-col gap-5" showsVerticalScrollIndicator={false}>
          {/* Active on Dashboard ribbon */}
          <View className="flex flex-col gap-2.5">
            <Text className="text-2xs font-extrabold text-slate-400 uppercase tracking-widest">Active on Dashboard</Text>
            {onDashboardInCategory.length === 0 ? (
              <View className="py-3 px-4 bg-slate-900/30 border border-slate-850 rounded-xl">
                <Text className="text-2xs text-slate-500 font-bold text-center">No widgets from this category are currently pinned.</Text>
              </View>
            ) : (
              <View className="flex-row flex-wrap gap-2">
                {onDashboardInCategory.map((w) => (
                  <View key={w.id} className="flex-row items-center gap-1.5 bg-slate-900/60 border border-slate-850 rounded-full px-3 py-1.5">
                    <View className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <Text className="text-2xs font-bold text-slate-200">{getWidgetLabel(w.id)}</Text>
                    <Text className="text-[8px] font-black text-slate-500 bg-slate-950 px-1.5 py-0.5 rounded uppercase">{w.size}</Text>
                    <TouchableOpacity onPress={() => handleRemoveWidget(w.id)} className="p-0.5 rounded-full bg-slate-950 ml-1">
                      <X size={10} color="#f43f5e" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Available widgets section */}
          <View className="flex flex-col gap-2.5">
            <Text className="text-2xs font-extrabold text-slate-400 uppercase tracking-widest">Available Insights</Text>
            {availableInCategory.length === 0 ? (
              <View className="py-8 items-center justify-center gap-2">
                <Text className="text-xl">🎉</Text>
                <Text className="text-2xs text-slate-450 font-bold text-center">All modules in this category are pinned to the dashboard!</Text>
              </View>
            ) : (
              <View className="flex flex-col gap-4">
                {availableInCategory.map((id) => (
                  <View key={id} style={styles.bentoCardOuter}>
                    <View style={styles.bentoHeader} className="flex-row justify-between items-center">
                      <View>
                        <Text style={styles.bentoTitle}>{getWidgetLabel(id)}</Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => setSizeSelectorWidget(id)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-500 flex-row items-center gap-1 active:bg-emerald-600"
                      >
                        <Plus size={12} color="#ffffff" strokeWidth={3} />
                        <Text className="text-[10px] font-black text-white uppercase">Pin</Text>
                      </TouchableOpacity>
                    </View>
                    <View className="pt-2">{renderWidgetContent(id)}</View>
                  </View>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      )}

      {/* Inline Layout Size Choice Modal */}
      <Modal visible={sizeSelectorWidget !== null} transparent animationType="fade">
        <View className="flex-1 bg-black/60 items-center justify-center p-4">
          <View className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-5 gap-4">
            <View className="flex-row justify-between items-center border-b border-slate-800 pb-3">
              <View>
                <Text className="text-sm font-black text-slate-100">Choose Layout Size</Text>
                <Text className="text-2xs text-slate-400 mt-0.5">Select a grid layout for your dashboard</Text>
              </View>
              <TouchableOpacity onPress={() => setSizeSelectorWidget(null)} className="p-1 rounded-full bg-slate-800">
                <X size={14} color="#a1a1aa" />
              </TouchableOpacity>
            </View>

            <View className="flex flex-col gap-2">
              {[
                { key: "1x1", label: "1 × 1 Square", desc: "Compact snapshot widget" },
                { key: "2x1", label: "2 × 1 Wide", desc: "Wide standard widget" },
                { key: "2x2", label: "2 × 2 Big Square", desc: "Detailed square widget" },
                { key: "1x2", label: "1 × 2 Tall", desc: "Tall column widget" },
              ].map((sz) => (
                <TouchableOpacity
                  key={sz.key}
                  onPress={() => sizeSelectorWidget && handleAddWidget(sizeSelectorWidget, sz.key)}
                  className="p-3 bg-slate-950 border border-slate-850 rounded-xl flex-row items-center justify-between active:bg-slate-900"
                >
                  <View>
                    <Text className="text-xs font-bold text-slate-200">{sz.label}</Text>
                    <Text className="text-[10px] text-slate-500 mt-0.5">{sz.desc}</Text>
                  </View>
                  <Text className="text-2xs font-extrabold text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    {sz.key}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── StatValue Component ─────────────────────────────────────────────────────
function StatValue({
  value,
  type,
  label,
  color,
  suffix,
}: {
  value: number;
  type: "currency" | "number" | "decimal";
  label: string;
  color: string;
  suffix?: string;
}) {
  const formatVal = () => {
    if (type === "currency") {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
      }).format(value);
    }
    if (type === "decimal") return value.toFixed(1);
    return Math.round(value).toString();
  };

  return (
    <View className="flex flex-row justify-between items-center py-1">
      <View className="flex-row items-center gap-2">
        <View className="w-1.5 h-6 rounded-full" style={{ backgroundColor: color }} />
        <Text className="text-2xs font-bold text-slate-400 uppercase tracking-wider">{label}</Text>
      </View>
      <Text className="text-sm font-black text-slate-200">
        {formatVal()}
        {suffix || ""}
      </Text>
    </View>
  );
}

const styles = {
  bentoCardOuter: {
    backgroundColor: "#161615",
    borderColor: "#262624",
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  bentoHeader: {
    borderBottomWidth: 1,
    borderBottomColor: "#262624",
    paddingBottom: 10,
    marginBottom: 10,
  },
  bentoTitle: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700" as const,
  },
};
