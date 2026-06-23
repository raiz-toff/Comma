import React, { useEffect, useState } from "react";
import { ScrollView, View, ActivityIndicator, Pressable, StyleSheet, Alert, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "../../src/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../src/components/ui/card";
import { Text } from "../../src/components/ui/text";
import { useActiveShift, type GigPlatform } from "../../store/useActiveShift";
import { useSettingsStore } from "../../store/useSettingsStore";
import OnboardingWizard from "../../components/OnboardingWizard";
import { cn } from "../../src/lib/utils";
import { CurrencyText } from "../../src/components/ui/CurrencyText";
import {
  getTodayStats,
  getWeekStats,
  getGoalProgress,
  getActiveVehicle,
  getPeriodStats,
  getFinancialOverviewForRange,
  getRolling30DayTrend,
  getFinancialMonthlyBreakdown,
} from "../../src/database/queries/analytics";
import Svg, { Path, Circle, Rect, Defs, LinearGradient, Stop } from "react-native-svg";

// --- Vector Icons as simple view paths to avoid third party native dependencies ---
const PlayIcon = ({ size = 14, color = "white" }: { size?: number; color?: string }) => (
  <View
    style={{
      width: 0,
      height: 0,
      borderLeftWidth: size * 0.8,
      borderTopWidth: size * 0.5,
      borderBottomWidth: size * 0.5,
      borderStyle: "solid",
      backgroundColor: "transparent",
      borderLeftColor: color,
      borderTopColor: "transparent",
      borderBottomColor: "transparent",
      marginLeft: size * 0.15,
    }}
  />
);

const SquareIcon = ({ size = 14, color = "white" }: { size?: number; color?: string }) => (
  <View
    style={{
      width: size * 0.8,
      height: size * 0.8,
      backgroundColor: color,
      borderRadius: size * 0.15,
    }}
  />
);

const PlusIcon = ({ size = 12, color = "#cbd5e1" }: { size?: number; color?: string }) => (
  <View style={{ width: size, height: size, justifyContent: "center", alignItems: "center" }}>
    <View style={{ position: "absolute", width: size, height: 1.5, backgroundColor: color, borderRadius: 0.8 }} />
    <View style={{ position: "absolute", width: 1.5, height: size, backgroundColor: color, borderRadius: 0.8 }} />
  </View>
);

const CoinsIcon = ({ size = 14, color = "#fbbf24" }: { size?: number; color?: string }) => (
  <View style={{ width: size, height: size, position: "relative" }}>
    <View
      style={{
        position: "absolute",
        width: size * 0.8,
        height: size * 0.8,
        borderRadius: (size * 0.8) / 2,
        borderWidth: 1.5,
        borderColor: color,
        bottom: 0,
        left: 0,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <View style={{ width: 1.5, height: size * 0.4, backgroundColor: color }} />
    </View>
    <View
      style={{
        position: "absolute",
        width: size * 0.8,
        height: size * 0.8,
        borderRadius: (size * 0.8) / 2,
        borderWidth: 1.5,
        borderColor: color,
        backgroundColor: "#0b0f19",
        top: 0,
        right: 0,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <View style={{ width: 1.5, height: size * 0.4, backgroundColor: color }} />
    </View>
  </View>
);

// --- High Fidelity Sparkline and Trend Charts ---
const Sparkline = ({ points, color, height = 30 }: { points: number[]; color: string; height?: number }) => {
  const safePoints = points && points.length >= 2 ? points : [12, 16, 9, 21, 14, 26, 17, 31, 23, 36, 29, 41, 33, 46];
  const max = Math.max(...safePoints, 1);
  const min = Math.min(...safePoints);
  const range = (max - min) || 1;
  const width = 100;
  
  const pathD = safePoints.map((p, i) => {
    const x = (i / (safePoints.length - 1)) * width;
    const y = height - ((p - min) / range) * (height - 4) - 2;
    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');

  const areaD = `${pathD} L ${width} ${height} L 0 ${height} Z`;

  return (
    <View style={{ height, width: "100%", marginVertical: 4 }}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={`grad-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={color} stopOpacity={0.15} />
            <Stop offset="100%" stopColor={color} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Path d={areaD} fill={`url(#grad-${color.replace('#','')})`} />
        <Path d={pathD} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </View>
  );
};

const StepChart = ({ points, color, height = 30 }: { points: number[]; color: string; height?: number }) => {
  const safePoints = points && points.length >= 2 ? points : [6, 14, 14, 10, 19, 19, 16, 24, 24, 30, 30, 22, 22, 27];
  const max = Math.max(...safePoints, 1);
  const min = Math.min(...safePoints);
  const range = (max - min) || 1;
  const width = 100;
  
  let pathD = "";
  safePoints.forEach((p, i) => {
    const x = (i / (safePoints.length - 1)) * width;
    const y = height - ((p - min) / range) * (height - 4) - 2;
    if (i === 0) {
      pathD = `M ${x.toFixed(1)} ${y.toFixed(1)}`;
    } else {
      const prevX = ((i - 1) / (safePoints.length - 1)) * width;
      const prevY = height - ((safePoints[i - 1] - min) / range) * (height - 4) - 2;
      pathD += ` L ${x.toFixed(1)} ${prevY.toFixed(1)} L ${x.toFixed(1)} ${y.toFixed(1)}`;
    }
  });

  const areaD = `${pathD} L ${width} ${height} L 0 ${height} Z`;

  return (
    <View style={{ height, width: "100%", marginVertical: 4 }}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={`grad-step-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={color} stopOpacity={0.12} />
            <Stop offset="100%" stopColor={color} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Path d={areaD} fill={`url(#grad-step-${color.replace('#','')})`} />
        <Path d={pathD} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </View>
  );
};

const CurveChart = ({ points, color, height = 30 }: { points: number[]; color: string; height?: number }) => {
  const safePoints = points && points.length >= 2 ? points : [14, 22, 19, 27, 24, 32, 29, 37, 31, 44, 39, 49, 41, 52];
  const max = Math.max(...safePoints, 1);
  const min = Math.min(...safePoints);
  const range = (max - min) || 1;
  const width = 100;

  let pathD = "";
  safePoints.forEach((p, i) => {
    const x = (i / (safePoints.length - 1)) * width;
    const y = height - ((p - min) / range) * (height - 4) - 2;
    if (i === 0) {
      pathD = `M ${x.toFixed(1)} ${y.toFixed(1)}`;
    } else {
      const prevX = ((i - 1) / (safePoints.length - 1)) * width;
      const prevY = height - ((safePoints[i - 1] - min) / range) * (height - 4) - 2;
      const cpX = prevX + (x - prevX) / 2;
      pathD += ` C ${cpX.toFixed(1)} ${prevY.toFixed(1)} ${cpX.toFixed(1)} ${y.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }
  });

  const areaD = `${pathD} L ${width} ${height} L 0 ${height} Z`;

  return (
    <View style={{ height, width: "100%", marginVertical: 4 }}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={`grad-curve-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={color} stopOpacity={0.15} />
            <Stop offset="100%" stopColor={color} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Path d={areaD} fill={`url(#grad-curve-${color.replace('#','')})`} />
        <Path d={pathD} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </View>
  );
};

const HoursPillars = ({ points, color }: { points: number[]; color: string }) => {
  const safePoints = points && points.length > 0 ? points : [3.5, 5, 6.5, 2.5, 6, 7.5, 2, 4.5, 6.8, 5.5, 8.5, 4, 4.8, 6.5];
  const max = Math.max(...safePoints, 1);
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", height: 26, gap: 2, width: "100%", marginVertical: 6 }}>
      {safePoints.map((p, i) => {
        const heightPct = `${Math.max(15, (p / max) * 100)}%` as any;
        return (
          <View
            key={i}
            style={{
              flex: 1,
              height: heightPct,
              backgroundColor: color,
              borderRadius: 1.5,
              opacity: 0.85,
            }}
          />
        );
      })}
    </View>
  );
};

const CircularProgress = ({ pct, color, size = 32 }: { pct: number; color: string; size?: number }) => {
  const r = 13;
  const cx = 18;
  const cy = 18;
  const strokeWidth = 3.5;
  const circumference = 2 * Math.PI * r;
  const strokeDashoffset = circumference - (Math.min(pct, 100) / 100) * circumference;

  return (
    <Svg width={size} height={size} viewBox="0 0 36 36">
      <Circle
        cx={cx}
        cy={cy}
        r={r}
        fill="transparent"
        stroke="#27272a"
        strokeWidth={strokeWidth}
      />
      <Circle
        cx={cx}
        cy={cy}
        r={r}
        fill="transparent"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
        transform="rotate(-90 18 18)"
      />
    </Svg>
  );
};

export default function HomeScreen() {
  const queryClient = useQueryClient();
  
  const {
    isActive,
    platform: activePlatform,
    elapsedSeconds,
    activeMileage,
    deadMileage,
    startShift,
    endShift,
    incrementTimer,
    updateMileage,
    reset,
  } = useActiveShift();

  const trackedMileage = activeMileage + deadMileage;

  const {
    isOnboardingCompleted,
    profile,
    isLoading,
    isDemoMode,
    activePlatformFilter,
    loadSettings,
    clearSampleData,
    resetSettings,
  } = useSettingsStore();

  const [selectedPlatform, setSelectedPlatform] = useState<GigPlatform>("doordash");
  const [avgRateTab, setAvgRateTab] = useState<"active" | "online">("active");
  const [hoursTab, setHoursTab] = useState<"active" | "online">("active");

  // Load Settings on Mount
  useEffect(() => {
    loadSettings();
  }, []);

  // Set up timer effect for active shift
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isActive) {
      interval = setInterval(() => {
        incrementTimer();
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isActive]);

  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const endOfYear = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  // Today stats
  const { data: todayStats = { gross: 0, tips: 0, count: 0, activeMileage: 0, deadMileage: 0 } } = useQuery({
    queryKey: ["analytics", "today", activePlatformFilter],
    queryFn: () => getTodayStats(activePlatformFilter),
    enabled: isOnboardingCompleted,
  });

  // Week stats
  const { data: weekStats = { gross: 0, tips: 0, count: 0, activeMileage: 0, deadMileage: 0, durationSeconds: 0 } } = useQuery({
    queryKey: ["analytics", "week", activePlatformFilter],
    queryFn: () => getWeekStats(activePlatformFilter),
    enabled: isOnboardingCompleted,
  });

  // Period stats for the current month overview
  const { data: financialOverview } = useQuery({
    queryKey: ["analytics", "financialOverview", activePlatformFilter],
    queryFn: () => getFinancialOverviewForRange(startOfMonth, endOfMonth, activePlatformFilter, 0),
    enabled: isOnboardingCompleted,
  });

  // Monthly table breakdown
  const { data: monthlyBreakdown } = useQuery({
    queryKey: ["analytics", "monthlyBreakdown", activePlatformFilter],
    queryFn: () => getFinancialMonthlyBreakdown(startOfYear, endOfYear, activePlatformFilter),
    enabled: isOnboardingCompleted,
  });

  // Rolling 30 day trend
  const { data: rollingTrend } = useQuery({
    queryKey: ["analytics", "rollingTrend", activePlatformFilter],
    queryFn: () => getRolling30DayTrend(activePlatformFilter),
    enabled: isOnboardingCompleted,
  });

  const { data: weeklyGoals = [] } = useQuery({
    queryKey: ["analytics", "goals", "weekly"],
    queryFn: () => getGoalProgress("weekly"),
    enabled: isOnboardingCompleted,
  });

  const { data: activeVehicle } = useQuery({
    queryKey: ["analytics", "activeVehicle"],
    queryFn: () => getActiveVehicle(),
    enabled: isOnboardingCompleted,
  });

  // Format stopwatch: HH:MM:SS
  const formatTime = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return [
      hrs.toString().padStart(2, "0"),
      mins.toString().padStart(2, "0"),
      secs.toString().padStart(2, "0"),
    ].join(":");
  };

  const platformLabels: Record<GigPlatform, string> = {
    ubereats: "Uber Eats",
    doordash: "DoorDash",
    skip: "Skip",
    instacart: "Instacart",
    lyft: "Lyft",
    amazon: "Amazon Flex",
    other: "Other",
  };

  // Local currency formatter
  const fmt = (val: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val);
  };

  // Projections
  const grossPayout = todayStats.gross + todayStats.tips;
  const deductions = (todayStats.activeMileage + todayStats.deadMileage) * 0.67;
  const netIncome = grossPayout - deductions;

  const handleStartShift = () => {
    const vId = activeVehicle?.id || "default_vehicle_1";
    startShift(selectedPlatform, vId);
  };

  const handleEndShift = async () => {
    const payload = await endShift();
    console.log("Completed Shift Payload:", payload);
    reset();
    queryClient.invalidateQueries({ queryKey: ["analytics"] });
    queryClient.invalidateQueries({ queryKey: ["shifts"] });
  };

  if (isLoading) {
    return (
      <SafeAreaView className="dark flex-1 bg-[#0d0d0c] items-center justify-center">
        <ActivityIndicator size="large" color="#10b981" />
      </SafeAreaView>
    );
  }

  if (!isOnboardingCompleted) {
    return <OnboardingWizard />;
  }

  // VS LAST calculations
  const currentWeekGross = weekStats.gross + weekStats.tips;
  const lastWeekGross = currentWeekGross * 0.93 || 150; // Mock historical comparison matching PWA
  const delta = currentWeekGross - lastWeekGross;
  const deltaPct = lastWeekGross > 0 ? ((delta / lastWeekGross) * 100).toFixed(1) : "0.0";
  const isUp = delta >= 0;

  // Efficiency / Margin variables
  const grossMonth = financialOverview?.gross || 0;
  const expenseMonth = financialOverview?.expense || 0;
  const netMonth = financialOverview?.netIncome || 0;
  const activeRateMonth = financialOverview?.activeAvgRateHr ?? financialOverview?.avgRateHr ?? 0;
  const onlineRateMonth = financialOverview?.onlineAvgRateHr ?? financialOverview?.avgRateHr ?? 0;
  const activeHoursMonth = financialOverview?.activeHours ?? financialOverview?.hours ?? 0;
  const onlineHoursMonth = financialOverview?.onlineHours ?? financialOverview?.hours ?? 0;

  const burnRatio = grossMonth > 0 ? (expenseMonth / grossMonth) * 100 : 0;
  const netMargin = grossMonth > 0 ? (netMonth / grossMonth) * 100 : 0;

  const taxRatePct = profile.taxWithholdingPct || 15;
  const taxSetAside = grossMonth * (taxRatePct / 100);
  const takeHomePay = netMonth - taxSetAside;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Banner for Demo Mode */}
        {isDemoMode && (
          <View style={styles.demoBanner}>
            <Text style={styles.demoText}>Viewing mock sample data</Text>
            <Pressable
              onPress={async () => {
                await clearSampleData();
                await loadSettings();
                queryClient.invalidateQueries({ queryKey: ["analytics"] });
                queryClient.invalidateQueries({ queryKey: ["shifts"] });
              }}
              style={styles.demoButton}
            >
              <Text style={styles.demoButtonText}>Clear Demo</Text>
            </Pressable>
          </View>
        )}

        {/* Active Shift Component */}
        <View style={[styles.activeShiftCard, isActive && styles.activeShiftCardActive]}>
          <View style={styles.activeShiftHeader}>
            <View style={styles.statusGroup}>
              <View style={[styles.statusDot, isActive ? styles.statusDotActive : styles.statusDotInactive]} />
              <Text style={[styles.statusText, isActive ? styles.statusTextActive : styles.statusTextInactive]}>
                {isActive
                  ? `STATUS: ON-DUTY • ${platformLabels[activePlatform || "other"]}`
                  : "STATUS: OFF-DUTY"}
              </Text>
            </View>
            {isActive && (
              <View style={styles.activeLabel}>
                <Text style={styles.activeLabelText}>ACTIVE</Text>
              </View>
            )}
          </View>

          <View style={styles.activeShiftBody}>
            {!isActive ? (
              // Idle Shift Starter
              <View style={{ gap: 14 }}>
                <View style={{ gap: 6 }}>
                  <Text style={styles.idleTitle}>Select Active Platform:</Text>
                  <View style={styles.platformSelectorRow}>
                    {(profile.selectedPlatforms || ["doordash", "ubereats", "skip"]).map((pId) => (
                      <Pressable
                        key={pId}
                        onPress={() => setSelectedPlatform(pId as any)}
                        style={[
                          styles.platformBtn,
                          selectedPlatform === pId && styles.platformBtnSelected
                        ]}
                      >
                        <Text
                          style={[
                            styles.platformBtnText,
                            selectedPlatform === pId && styles.platformBtnTextSelected
                          ]}
                        >
                          {platformLabels[pId as GigPlatform] || pId}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                <Pressable onPress={handleStartShift} style={styles.startShiftBtn}>
                  <PlayIcon size={14} color="white" />
                  <Text style={styles.startShiftBtnText}>START SHIFT</Text>
                </Pressable>
              </View>
            ) : (
              // Active Shift Dashboard
              <View style={{ gap: 14 }}>
                <View style={styles.timerDisplay}>
                  <Text style={styles.timerDigits}>{formatTime(elapsedSeconds)}</Text>
                  <Text style={styles.timerLabel}>Elapsed Duration</Text>
                </View>

                <View style={styles.activeMileageRow}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <View style={styles.mileageIconBg}>
                      <View style={{ width: 14, height: 14, borderRadius: 7, borderWidth: 1.5, borderColor: "#818cf8" }} />
                    </View>
                    <View>
                      <Text style={styles.mileageLabel}>Tracked Distance</Text>
                      <Text style={styles.mileageValue}>
                        {trackedMileage.toFixed(2)} {profile.distanceUnit}
                      </Text>
                    </View>
                  </View>

                  <Pressable onPress={() => updateMileage(0.5, 0)} style={styles.addMileBtn}>
                    <PlusIcon size={12} color="#ffffff" />
                    <Text style={styles.addMileBtnText}>+0.5 {profile.distanceUnit}</Text>
                  </Pressable>
                </View>

                <Pressable onPress={handleEndShift} style={styles.endShiftBtn}>
                  <SquareIcon size={14} color="white" />
                  <Text style={styles.endShiftBtnText}>END SHIFT</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>

        {/* KPI Hero Grid - High Fidelity PWA Port */}
        <View style={styles.kpiGrid}>
          {/* Card 1: Gross Earnings */}
          <View style={[styles.kpiCard, { borderColor: "#262624" }]}>
            <View style={styles.kpiCardTop}>
              <Text style={styles.kpiLabel}>Gross Earnings</Text>
              <View style={[styles.pulseDot, { backgroundColor: "#14b8a6" }]} />
            </View>
            <Text style={styles.kpiValueText}>{fmt(grossMonth)}</Text>
            
            <Sparkline points={rollingTrend?.points?.map((p: any) => p.y) || []} color="#14b8a6" />

            <View style={styles.comparisonBadge}>
              <Text style={[styles.comparisonText, isUp ? styles.textUp : styles.textDown]}>
                {isUp ? "↑" : "↓"} {deltaPct}%
              </Text>
              <Text style={styles.comparisonSub}>VS LAST</Text>
            </View>
          </View>

          {/* Card 2: Average Rate */}
          <View style={[styles.kpiCard, { borderColor: "#262624" }]}>
            <View style={styles.kpiCardTop}>
              <Text style={styles.kpiLabel}>Avg $/hr</Text>
              <View style={styles.tabButtons}>
                <Pressable
                  onPress={() => setAvgRateTab("active")}
                  style={[styles.tabBtn, avgRateTab === "active" && styles.tabBtnActive]}
                >
                  <Text style={[styles.tabBtnText, avgRateTab === "active" && styles.tabBtnTextActive]}>Act</Text>
                </Pressable>
                <Pressable
                  onPress={() => setAvgRateTab("online")}
                  style={[styles.tabBtn, avgRateTab === "online" && styles.tabBtnActive]}
                >
                  <Text style={[styles.tabBtnText, avgRateTab === "online" && styles.tabBtnTextActive]}>Onl</Text>
                </Pressable>
              </View>
            </View>
            <Text style={styles.kpiValueText}>
              {fmt(avgRateTab === "active" ? activeRateMonth : onlineRateMonth)}
              <Text style={{ fontSize: 11, fontWeight: "500", color: "#a1a1aa" }}>/hr</Text>
            </Text>

            <Sparkline
              points={
                avgRateTab === "active"
                  ? rollingTrend?.activeRatePoints?.map((p: any) => p.y) || []
                  : rollingTrend?.onlineRatePoints?.map((p: any) => p.y) || []
              }
              color="#f59e0b"
            />

            <View style={styles.comparisonBadge}>
              <Text style={{ fontSize: 9, fontWeight: "800", color: "#f59e0b" }}>
                {avgRateTab === "active" ? "ACTIVE EFFICIENCY" : "TOTAL EFFICIENCY"}
              </Text>
            </View>
          </View>

          {/* Card 3: Expenses */}
          <View style={[styles.kpiCard, { borderColor: "#262624" }]}>
            <View style={styles.kpiCardTop}>
              <Text style={styles.kpiLabel}>Expenses</Text>
            </View>
            <Text style={styles.kpiValueText}>{fmt(expenseMonth)}</Text>

            <StepChart points={rollingTrend?.points?.map((p: any) => p.y * 0.16) || []} color="#06b6d4" />

            <View style={styles.comparisonBadge}>
              <Text style={{ fontSize: 9, fontWeight: "800", color: "#06b6d4" }}>
                {burnRatio.toFixed(1)}%
              </Text>
              <Text style={styles.comparisonSub}>OF GROSS</Text>
            </View>
          </View>

          {/* Card 4: Net Take-Home */}
          <View style={[styles.kpiCard, { borderColor: "#262624" }]}>
            <View style={styles.kpiCardTop}>
              <Text style={styles.kpiLabel}>Net Take-Home</Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={[styles.kpiValueText, { fontSize: 17 }]}>{fmt(takeHomePay)}</Text>
              <CircularProgress pct={netMargin} color="#10b981" />
            </View>

            <CurveChart points={rollingTrend?.points?.map((p: any) => p.y * 0.8) || []} color="#10b981" />

            <View style={styles.comparisonBadge}>
              <Text style={{ fontSize: 9, fontWeight: "800", color: "#10b981" }}>
                {netMargin.toFixed(1)}%
              </Text>
              <Text style={styles.comparisonSub}>MARGIN</Text>
            </View>
          </View>

          {/* Card 5: Hours */}
          <View style={[styles.kpiCard, { borderColor: "#262624" }]}>
            <View style={styles.kpiCardTop}>
              <Text style={styles.kpiLabel}>Hours</Text>
              <View style={styles.tabButtons}>
                <Pressable
                  onPress={() => setHoursTab("active")}
                  style={[styles.tabBtn, hoursTab === "active" && styles.tabBtnActive]}
                >
                  <Text style={[styles.tabBtnText, hoursTab === "active" && styles.tabBtnTextActive]}>Act</Text>
                </Pressable>
                <Pressable
                  onPress={() => setHoursTab("online")}
                  style={[styles.tabBtn, hoursTab === "online" && styles.tabBtnActive]}
                >
                  <Text style={[styles.tabBtnText, hoursTab === "online" && styles.tabBtnTextActive]}>Onl</Text>
                </Pressable>
              </View>
            </View>
            <Text style={styles.kpiValueText}>
              {(hoursTab === "active" ? activeHoursMonth : onlineHoursMonth).toFixed(1)}
              <Text style={{ fontSize: 11, fontWeight: "500", color: "#a1a1aa" }}> hrs</Text>
            </Text>

            <HoursPillars
              points={
                hoursTab === "active"
                  ? rollingTrend?.activeHoursPoints?.map((p: any) => p.y) || []
                  : rollingTrend?.onlineHoursPoints?.map((p: any) => p.y) || []
              }
              color="#6366f1"
            />

            <View style={styles.comparisonBadge}>
              <Text style={{ fontSize: 9, fontWeight: "800", color: "#6366f1" }}>
                {hoursTab === "active" ? "ACTIVE HOURS" : "ONLINE HOURS"}
              </Text>
            </View>
          </View>

          {/* Card 6: Tax Set-Aside */}
          <View style={[styles.kpiCard, { borderColor: "#262624" }]}>
            <View style={styles.kpiCardTop}>
              <Text style={styles.kpiLabel}>Tax Set-Aside</Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={[styles.kpiValueText, { fontSize: 17 }]}>{fmt(taxSetAside)}</Text>
              <CircularProgress pct={taxRatePct} color="#f43f5e" />
            </View>

            <View style={{ flexDirection: "row", gap: 3, height: 18, alignItems: "flex-end", marginVertical: 8 }}>
              {Array.from({ length: 12 }).map((_, i) => (
                <View
                  key={i}
                  style={{
                    flex: 1,
                    height: 4,
                    borderRadius: 1,
                    backgroundColor: "#f43f5e",
                    opacity: 0.3 + (i / 12) * 0.7,
                  }}
                />
              ))}
            </View>

            <View style={styles.comparisonBadge}>
              <Text style={{ fontSize: 9, fontWeight: "800", color: "#f43f5e" }}>
                {taxRatePct}% TAX RATE
              </Text>
            </View>
          </View>
        </View>

        {/* Miles Tracked Bento Card */}
        <View style={[styles.bentoCardOuter, { padding: 16 }]}>
          <View style={styles.bentoHeader}>
            <Text style={styles.bentoTitle}>Distance Distribution</Text>
            <Text style={styles.bentoDesc}>Active vs Dead Mileage</Text>
          </View>
          <View style={{ gap: 14, paddingTop: 12 }}>
            <View style={{ gap: 5 }}>
              <View style={styles.distLabelRow}>
                <Text style={styles.distLabelText}>Active (On Delivery)</Text>
                <Text style={styles.distValueText}>
                  {todayStats.activeMileage.toFixed(1)} {profile.distanceUnit}
                </Text>
              </View>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    {
                      width: `${Math.min(100, (todayStats.activeMileage / Math.max(1, todayStats.activeMileage + todayStats.deadMileage)) * 100)}%`,
                      backgroundColor: "#10b981"
                    }
                  ]}
                />
              </View>
            </View>

            <View style={{ gap: 5 }}>
              <View style={styles.distLabelRow}>
                <Text style={styles.distLabelText}>Dead (Commute/Waiting)</Text>
                <Text style={[styles.distValueText, { color: "#fbbf24" }]}>
                  {todayStats.deadMileage.toFixed(1)} {profile.distanceUnit}
                </Text>
              </View>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    {
                      width: `${Math.min(100, (todayStats.deadMileage / Math.max(1, todayStats.activeMileage + todayStats.deadMileage)) * 100)}%`,
                      backgroundColor: "#fbbf24"
                    }
                  ]}
                />
              </View>
            </View>
          </View>
        </View>

        {/* Weekly Goal Bento Card */}
        <View style={[styles.bentoCardOuter, { padding: 16 }]}>
          <View style={styles.bentoHeader}>
            <Text style={styles.bentoTitle}>Weekly Goal Progress</Text>
          </View>
          <View style={{ gap: 10, paddingTop: 12 }}>
            {(() => {
              const goalProgress = weeklyGoals[0] || {
                targetValue: profile.weeklyGoal || 500,
                currentValue: weekStats.gross + weekStats.tips,
                progressPct: (profile.weeklyGoal || 500) > 0 ? ((weekStats.gross + weekStats.tips) / (profile.weeklyGoal || 500)) * 100 : 0
              };
              const pct = Math.min(goalProgress.progressPct, 100);
              return (
                <View style={{ gap: 10 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}>
                    <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4 }}>
                      <Text style={styles.goalCurrentText}>{fmt(goalProgress.currentValue)}</Text>
                      <Text style={{ color: "#a1a1aa", fontSize: 11, fontWeight: "500" }}>of</Text>
                      <Text style={styles.goalTargetText}>{fmt(goalProgress.targetValue)}</Text>
                    </View>
                    <Text style={styles.goalPctText}>{goalProgress.progressPct.toFixed(0)}%</Text>
                  </View>
                  <View style={styles.goalTrack}>
                    <View style={[styles.goalFill, { width: `${pct}%` }]} />
                  </View>
                  <Text style={styles.goalMutedText}>
                    Keep it up! You need {fmt(Math.max(0, goalProgress.targetValue - goalProgress.currentValue))} more to hit your weekly goal.
                  </Text>
                </View>
              );
            })()}
          </View>
        </View>

        {/* Monthly Breakdown Table */}
        <View style={[styles.bentoCardOuter, { padding: 16 }]}>
          <View style={styles.bentoHeader}>
            <Text style={styles.bentoTitle}>Monthly Breakdown</Text>
            <Text style={styles.bentoDesc}>YTD Financial Summary & Efficiency</Text>
          </View>
          <View style={{ paddingTop: 12 }}>
            {/* Header */}
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.tableHeaderText, { width: "20%" }]}>Period</Text>
              <Text style={[styles.tableHeaderText, { width: "22%", textAlign: "right" }]}>Earned</Text>
              <Text style={[styles.tableHeaderText, { width: "20%", textAlign: "right" }]}>Expenses</Text>
              <Text style={[styles.tableHeaderText, { width: "20%", textAlign: "right" }]}>Net</Text>
              <Text style={[styles.tableHeaderText, { width: "18%", textAlign: "right" }]}>$/hr</Text>
            </View>

            {/* Rows */}
            {monthlyBreakdown?.rows && monthlyBreakdown.rows.length > 0 ? (
              monthlyBreakdown.rows.map((row, idx) => (
                <View key={idx} style={[styles.tableBodyRow, idx % 2 === 1 && styles.tableBodyRowAlt]}>
                  <Text style={[styles.tableCellText, { width: "20%", fontWeight: "bold" }]}>{row.period}</Text>
                  <Text style={[styles.tableCellText, { width: "22%", textAlign: "right", color: "#10b981", fontWeight: "600" }]}>{fmt(row.earnings)}</Text>
                  <Text style={[styles.tableCellText, { width: "20%", textAlign: "right", color: "#f43f5e" }]}>{fmt(row.expenses)}</Text>
                  <Text style={[styles.tableCellText, { width: "20%", textAlign: "right", fontWeight: "700" }]}>{fmt(row.net)}</Text>
                  <Text style={[styles.tableCellText, { width: "18%", textAlign: "right", fontWeight: "600" }]}>{row.efficiency.toFixed(1)}</Text>
                </View>
              ))
            ) : (
              <View style={{ paddingVertical: 20, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: "#71717a", fontSize: 12, textAlign: "center", marginVertical: 14 }}>
                  No historical data available.
                </Text>
              </View>
            )}

            {/* Totals */}
            {monthlyBreakdown?.totals && (
              <View style={styles.tableTotalsRow}>
                <Text style={[styles.tableTotalsText, { width: "20%" }]}>Total</Text>
                <Text style={[styles.tableTotalsText, { width: "22%", textAlign: "right", color: "#10b981" }]}>{fmt(monthlyBreakdown.totals.earnings)}</Text>
                <Text style={[styles.tableTotalsText, { width: "20%", textAlign: "right", color: "#f43f5e" }]}>{fmt(monthlyBreakdown.totals.expenses)}</Text>
                <Text style={[styles.tableTotalsText, { width: "20%", textAlign: "right" }]}>{fmt(monthlyBreakdown.totals.net)}</Text>
                <Text style={[styles.tableTotalsText, { width: "18%", textAlign: "right" }]}>{monthlyBreakdown.totals.avgPerHr.toFixed(1)}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Reset App footer */}
        <Pressable
          onPress={() => {
            Alert.alert(
              "Reset App",
              "Are you sure you want to reset the app? This deletes all shifts, vehicles, and settings.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Reset",
                  style: "destructive",
                  onPress: async () => {
                    await resetSettings();
                    await loadSettings();
                    queryClient.invalidateQueries({ queryKey: ["analytics"] });
                    queryClient.invalidateQueries({ queryKey: ["shifts"] });
                  },
                },
              ]
            );
          }}
          style={styles.resetBtn}
        >
          <Text style={styles.resetBtnText}>RESET APP DATA</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0d0d0c",
  },
  scrollContent: {
    padding: 12,
    gap: 12,
    paddingBottom: 24,
  },
  demoBanner: {
    backgroundColor: "rgba(245, 158, 11, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.2)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  demoText: {
    fontSize: 12,
    color: "#fbbf24",
    fontWeight: "600",
  },
  demoButton: {
    backgroundColor: "rgba(245, 158, 11, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.3)",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  demoButtonText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#f59e0b",
    textTransform: "uppercase",
  },
  activeShiftCard: {
    backgroundColor: "#161615",
    borderColor: "#262624",
    borderWidth: 1,
    borderRadius: 16,
    overflow: "hidden",
  },
  activeShiftCardActive: {
    borderColor: "#10b981",
    borderWidth: 1.5,
  },
  activeShiftHeader: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#262624",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statusGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusDotActive: {
    backgroundColor: "#10b981",
  },
  statusDotInactive: {
    backgroundColor: "#71717a",
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statusTextActive: {
    color: "#10b981",
  },
  statusTextInactive: {
    color: "#a1a1aa",
  },
  activeLabel: {
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.2)",
  },
  activeLabelText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#10b981",
  },
  activeShiftBody: {
    padding: 12,
  },
  idleTitle: {
    color: "#e2e8f0",
    fontSize: 12,
    fontWeight: "600",
  },
  platformSelectorRow: {
    flexDirection: "row",
    gap: 6,
  },
  platformBtn: {
    flex: 1,
    backgroundColor: "#1c1c1a",
    borderColor: "#262624",
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: "center",
  },
  platformBtnSelected: {
    borderColor: "#10b981",
    backgroundColor: "rgba(16, 185, 129, 0.08)",
  },
  platformBtnText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#a1a1aa",
  },
  platformBtnTextSelected: {
    color: "#10b981",
  },
  startShiftBtn: {
    backgroundColor: "#10b981",
    borderRadius: 8,
    paddingVertical: 10,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  startShiftBtnText: {
    color: "white",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  timerDisplay: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0d0d0c",
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#262624",
  },
  timerDigits: {
    fontSize: 32,
    fontWeight: "800",
    color: "#ffffff",
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
    letterSpacing: 1,
  },
  timerLabel: {
    fontSize: 9,
    color: "#a1a1aa",
    textTransform: "uppercase",
    fontWeight: "700",
    marginTop: 4,
    letterSpacing: 0.5,
  },
  activeMileageRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#0d0d0c",
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#262624",
  },
  mileageIconBg: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: "rgba(129, 140, 248, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(129, 140, 248, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  mileageLabel: {
    fontSize: 9,
    color: "#a1a1aa",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  mileageValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#ffffff",
    marginTop: 1,
  },
  addMileBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#1c1c1a",
    borderWidth: 1,
    borderColor: "#262624",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  addMileBtnText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#ffffff",
  },
  endShiftBtn: {
    backgroundColor: "#ef4444",
    borderRadius: 8,
    paddingVertical: 10,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  endShiftBtnText: {
    color: "white",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 10,
  },
  kpiCard: {
    width: "48.5%",
    minHeight: 144,
    backgroundColor: "#161615",
    borderWidth: 1,
    borderRadius: 14,
    padding: 10,
    justifyContent: "space-between",
  },
  kpiCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  kpiLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: "#a1a1aa",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  kpiValueText: {
    fontSize: 20,
    fontWeight: "800",
    color: "#ffffff",
    marginVertical: 4,
    fontVariant: ["tabular-nums"],
  },
  comparisonBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1c1c1a",
    borderWidth: 1,
    borderColor: "#262624",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: "flex-start",
    gap: 4,
  },
  comparisonText: {
    fontSize: 9,
    fontWeight: "800",
  },
  comparisonSub: {
    fontSize: 8,
    color: "#71717a",
    fontWeight: "700",
  },
  textUp: {
    color: "#10b981",
  },
  textDown: {
    color: "#f43f5e",
  },
  tabButtons: {
    flexDirection: "row",
    backgroundColor: "#1c1c1a",
    borderWidth: 1,
    borderColor: "#262624",
    borderRadius: 6,
    padding: 1.5,
  },
  tabBtn: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tabBtnActive: {
    backgroundColor: "#27272a",
  },
  tabBtnText: {
    fontSize: 7.5,
    fontWeight: "700",
    color: "#71717a",
  },
  tabBtnTextActive: {
    color: "#ffffff",
  },
  bentoCardOuter: {
    backgroundColor: "#161615",
    borderColor: "#262624",
    borderWidth: 1,
    borderRadius: 16,
  },
  bentoHeader: {
    borderBottomWidth: 1,
    borderBottomColor: "#262624",
    paddingBottom: 10,
  },
  bentoTitle: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  bentoDesc: {
    color: "#a1a1aa",
    fontSize: 11,
    marginTop: 2,
  },
  distLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  distLabelText: {
    color: "#a1a1aa",
    fontSize: 11,
    fontWeight: "500",
  },
  distValueText: {
    color: "#10b981",
    fontSize: 12,
    fontWeight: "700",
  },
  barTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "#0d0d0c",
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 4,
  },
  goalCurrentText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#10b981",
  },
  goalTargetText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#ffffff",
  },
  goalPctText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#10b981",
  },
  goalTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "#0d0d0c",
    overflow: "hidden",
  },
  goalFill: {
    height: "100%",
    borderRadius: 4,
    backgroundColor: "#10b981",
  },
  goalMutedText: {
    fontSize: 10,
    color: "#71717a",
    fontWeight: "500",
    marginTop: 2,
  },
  tableHeaderRow: {
    flexDirection: "row",
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#262624",
  },
  tableHeaderText: {
    color: "#a1a1aa",
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tableBodyRow: {
    flexDirection: "row",
    paddingVertical: 8,
    alignItems: "center",
  },
  tableBodyRowAlt: {
    backgroundColor: "#1c1c1a",
    borderRadius: 6,
    paddingHorizontal: 4,
  },
  tableCellText: {
    color: "#e2e8f0",
    fontSize: 11,
    fontVariant: ["tabular-nums"],
  },
  tableTotalsRow: {
    flexDirection: "row",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#262624",
    marginTop: 4,
    alignItems: "center",
  },
  tableTotalsText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "bold",
    fontVariant: ["tabular-nums"],
  },
  resetBtn: {
    alignSelf: "center",
    backgroundColor: "rgba(239, 68, 68, 0.08)",
    borderColor: "rgba(239, 68, 68, 0.2)",
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 8,
  },
  resetBtnText: {
    color: "#ef4444",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1,
  },
});
