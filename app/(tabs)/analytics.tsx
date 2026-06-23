import React, { useState, useMemo } from "react";
import {
  ScrollView,
  View,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { Text } from "@/src/components/ui/text";
import { CurrencyText } from "@/src/components/ui/CurrencyText";
import { PlatformBadge } from "@/src/components/ui/PlatformBadge";
import {
  getPeriodStats,
  getEarningsByPlatform,
  getEarningsByDay,
  getBestDayOfWeek,
  getMileageSplit,
  getNetIncome,
  getHourlyRate,
} from "@/src/database/queries/analytics";
import { useSettingsStore } from "@/store/useSettingsStore";
import { cn } from "@/src/lib/utils";
import { type PlatformKey } from "@/src/registry/platforms";

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
    start.setFullYear(start.getFullYear() - 10); // "All time" = 10yr lookback
  }

  return { start, end };
}

// ─── Pure-View Bar Chart ─────────────────────────────────────────────────────
function MiniBar({
  value,
  maxValue,
  color = "#10b981",
  height = 60,
}: {
  value: number;
  maxValue: number;
  color?: string;
  height?: number;
}) {
  const pct = maxValue > 0 ? Math.max(2, (value / maxValue) * 100) : 2;
  return (
    <View
      style={{
        flex: 1,
        height,
        justifyContent: "flex-end",
        alignItems: "center",
        paddingHorizontal: 1,
      }}
    >
      <View
        style={{
          width: "80%",
          height: `${pct}%`,
          backgroundColor: color,
          borderRadius: 3,
          opacity: value > 0 ? 1 : 0.15,
        }}
      />
    </View>
  );
}

export default function AnalyticsScreen() {
  const { profile, isOnboardingCompleted } = useSettingsStore();
  const [period, setPeriod] = useState<Period>("month");

  const { start, end } = useMemo(() => getPeriodDates(period), [period]);
  const weeks = PERIOD_OPTIONS.find((p) => p.key === period)?.weeks ?? 4;

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

  // ── Derived ───────────────────────────────────────────────────────────────
  const totalRevenue = (periodStats?.gross || 0) + (periodStats?.tips || 0);
  const durationHrs = (periodStats?.durationSeconds || 0) / 3600;

  const maxDailyEarning = useMemo(
    () => Math.max(1, ...dailyData.map((d) => d.total)),
    [dailyData]
  );
  const maxDayAvg = useMemo(
    () => Math.max(1, ...bestDayData.map((d) => d.avgEarnings)),
    [bestDayData]
  );

  // Insights: auto-generated from data
  const insights = useMemo(() => {
    const msgs: string[] = [];
    if (bestDayData.length > 0) {
      const best = bestDayData.reduce((a, b) => (a.avgEarnings > b.avgEarnings ? a : b));
      if (best.avgEarnings > 0) msgs.push(`Your best day this period is ${best.label} — avg $${best.avgEarnings.toFixed(2)}.`);
    }
    if (mileage && mileage.ratio > 0) {
      msgs.push(`${mileage.ratio.toFixed(0)}% of your total mileage is dead (unearned) distance.`);
    }
    if (hourlyRate > 0) {
      msgs.push(`You're earning $${hourlyRate.toFixed(2)}/hr on average.`);
    }
    if (platformData.length > 1) {
      const top = platformData[0];
      msgs.push(`${top?.platform} is your top platform with ${top?.share.toFixed(0)}% of revenue.`);
    }
    return msgs;
  }, [bestDayData, mileage, hourlyRate, platformData]);

  return (
    <SafeAreaView className="dark flex-1 bg-[#0b0f19]">
      {/* Header */}
      <View className="px-4 pt-3 pb-2 border-b border-slate-800/80 bg-slate-900/40">
        <Text className="text-lg font-extrabold text-slate-100 tracking-tight">Analytics</Text>
      </View>

      {/* Period Selector */}
      <View className="flex-row px-4 py-2.5 gap-2 border-b border-slate-900 bg-slate-950/20">
        {PERIOD_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.key}
            onPress={() => setPeriod(opt.key)}
            className={cn(
              "flex-1 py-2 rounded-xl items-center border",
              period === opt.key
                ? "border-emerald-500 bg-emerald-500/10"
                : "border-slate-800 bg-slate-900/30"
            )}
          >
            <Text
              className={cn(
                "text-xs font-extrabold uppercase tracking-widest",
                period === opt.key ? "text-emerald-400" : "text-slate-500"
              )}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loadingStats ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#10b981" />
        </View>
      ) : (
        <ScrollView contentContainerClassName="p-4 pb-20 flex flex-col gap-5">

          {/* ── 1. Earnings Overview ───────────────────────────────────────── */}
          <View className="flex flex-col gap-3">
            <Text className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">
              Earnings Overview
            </Text>
            <View className="flex-row gap-2.5">
              <StatCard label="Gross Revenue" value={totalRevenue} type="currency" accent="#10b981" />
              <StatCard label="Net Income" value={netIncome} type="currency" accent="#6366f1" />
            </View>
            <View className="flex-row gap-2.5">
              <StatCard label="Hourly Rate" value={hourlyRate} type="currency" accent="#f59e0b" suffix="/hr" />
              <StatCard label="Total Shifts" value={periodStats?.count || 0} type="number" accent="#0ea5e9" />
            </View>
            <View className="flex-row gap-2.5">
              <StatCard label="Hours Driven" value={durationHrs} type="decimal" accent="#8b5cf6" suffix=" hrs" />
              <StatCard label="Active Distance" value={periodStats?.activeMileage || 0} type="decimal" accent="#ec4899" suffix={` ${profile.distanceUnit}`} />
            </View>
          </View>

          {/* ── 2. Platform Breakdown ─────────────────────────────────────── */}
          {platformData.length > 0 && (
            <View className="flex flex-col gap-3">
              <Text className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">
                Platform Breakdown
              </Text>
              <View className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-4 flex flex-col gap-3">
                {platformData.map((p) => (
                  <View key={p.platform} className="flex-row items-center gap-3">
                    <PlatformBadge platform={p.platform as PlatformKey} size="sm" />
                    <View className="flex-1 flex flex-col gap-1">
                      <View className="flex-row justify-between items-center">
                        <Text className="text-xs font-bold text-slate-200 capitalize">{p.platform}</Text>
                        <View className="flex-row items-center gap-2">
                          <Text className="text-[10px] text-slate-500 font-bold">{p.count} shifts</Text>
                          <CurrencyText amount={p.total} size="sm" className="font-extrabold text-slate-100" />
                        </View>
                      </View>
                      {/* Share bar */}
                      <View className="h-1.5 bg-slate-950 rounded-full overflow-hidden">
                        <View
                          style={{ width: `${p.share}%`, backgroundColor: "#10b981", borderRadius: 4, height: "100%" }}
                        />
                      </View>
                      <Text className="text-[9px] text-slate-500 font-bold">{p.share.toFixed(0)}% of total</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* ── 3. Daily Earnings Trend ───────────────────────────────────── */}
          {dailyData.length > 0 && (
            <View className="flex flex-col gap-3">
              <Text className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">
                Daily Earnings Trend
              </Text>
              <View className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-4">
                <View className="flex-row items-end" style={{ height: 80 }}>
                  {dailyData.slice(-28).map((d, i) => (
                    <MiniBar key={i} value={d.total} maxValue={maxDailyEarning} height={70} />
                  ))}
                </View>
                <View className="flex-row justify-between mt-1.5">
                  <Text className="text-[9px] text-slate-600 font-bold">
                    {dailyData.slice(-28)[0]?.date?.substring(5) || ""}
                  </Text>
                  <Text className="text-[9px] text-slate-600 font-bold">
                    {dailyData.slice(-1)[0]?.date?.substring(5) || "Today"}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* ── 4. Best Days of Week ─────────────────────────────────────── */}
          {bestDayData.some((d) => d.avgEarnings > 0) && (
            <View className="flex flex-col gap-3">
              <Text className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">
                Best Days of Week
              </Text>
              <View className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-4 flex flex-col gap-2">
                <View className="flex-row items-end" style={{ height: 70 }}>
                  {bestDayData.map((d, i) => (
                    <MiniBar key={i} value={d.avgEarnings} maxValue={maxDayAvg} color="#6366f1" height={60} />
                  ))}
                </View>
                <View className="flex-row justify-between mt-1">
                  {bestDayData.map((d) => (
                    <Text key={d.day} className="text-[8px] text-slate-500 font-bold flex-1 text-center">
                      {d.label}
                    </Text>
                  ))}
                </View>
              </View>
            </View>
          )}

          {/* ── 5. Mileage Split ─────────────────────────────────────────── */}
          {mileage && (mileage.active + mileage.dead) > 0 && (
            <View className="flex flex-col gap-3">
              <Text className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">
                Mileage Split
              </Text>
              <View className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-4 flex flex-col gap-3">
                <View className="flex-row justify-between">
                  <View className="items-center flex-1">
                    <Text className="text-base font-extrabold text-emerald-400">
                      {mileage.active.toFixed(1)} {profile.distanceUnit}
                    </Text>
                    <Text className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">Active</Text>
                  </View>
                  <View className="items-center flex-1">
                    <Text className="text-base font-extrabold text-rose-400">
                      {mileage.dead.toFixed(1)} {profile.distanceUnit}
                    </Text>
                    <Text className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">Dead</Text>
                  </View>
                  <View className="items-center flex-1">
                    <Text className="text-base font-extrabold text-amber-400">
                      {mileage.ratio.toFixed(0)}%
                    </Text>
                    <Text className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">Dead Ratio</Text>
                  </View>
                </View>

                {/* Split bar */}
                <View className="w-full h-3 bg-slate-950 rounded-full overflow-hidden flex-row mt-1">
                  <View style={{ flex: Math.max(0.01, mileage.active), backgroundColor: "#10b981" }} />
                  <View style={{ flex: Math.max(0.01, mileage.dead), backgroundColor: "#f43f5e" }} />
                </View>
              </View>
            </View>
          )}

          {/* ── 6. Auto-generated Insights ───────────────────────────────── */}
          {insights.length > 0 && (
            <View className="flex flex-col gap-3">
              <Text className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">
                Insights
              </Text>
              <View className="flex flex-col gap-2.5">
                {insights.map((msg, i) => (
                  <View
                    key={i}
                    className="bg-slate-900/50 border border-slate-800/60 rounded-xl px-4 py-3 flex-row gap-2.5 items-start"
                  >
                    <Text className="text-base leading-none mt-0.5">💡</Text>
                    <Text className="text-xs text-slate-300 font-medium leading-relaxed flex-1">{msg}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Empty state */}
          {totalRevenue === 0 && (periodStats?.count || 0) === 0 && (
            <View className="py-16 items-center justify-center gap-3">
              <Text className="text-3xl">📊</Text>
              <Text className="text-slate-400 text-sm font-medium text-center px-4 leading-relaxed">
                No shift data for this period.{"\n"}Start logging shifts to see your analytics.
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ─── StatCard Component ───────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  type,
  accent,
  suffix,
}: {
  label: string;
  value: number;
  type: "currency" | "number" | "decimal";
  accent: string;
  suffix?: string;
}) {
  return (
    <View
      className="flex-1 bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 flex flex-col gap-1.5"
      style={{ borderLeftWidth: 3, borderLeftColor: accent }}
    >
      <Text className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">{label}</Text>
      {type === "currency" ? (
        <CurrencyText amount={value} size="md" className="font-extrabold text-slate-100" />
      ) : (
        <Text className="text-base font-extrabold text-slate-100">
          {type === "decimal" ? value.toFixed(1) : Math.round(value)}
          {suffix || ""}
        </Text>
      )}
    </View>
  );
}
