import React, { useEffect, useState } from "react";
import { ScrollView, View, ActivityIndicator, Pressable, StyleSheet, Alert, Platform, TextInput, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
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
import { getVehicles } from "../../src/database/queries/vehicles";
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

function ymd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfWeekDate(d: Date, weekStartDay: number) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const delta = (x.getDay() - weekStartDay + 7) % 7;
  x.setDate(x.getDate() - delta);
  return x;
}

function defaultRangeForPreset(preset: string, now: Date, weekStartDay: number) {
  const y = now.getFullYear();
  const m = now.getMonth();
  const today = ymd(now);
  if (preset === "day") {
    return { start: today, end: today, preset: "day" };
  }
  if (preset === "week") {
    return { start: ymd(startOfWeekDate(now, weekStartDay)), end: today, preset: "week" };
  }
  if (preset === "month") {
    const start = `${y}-${String(m + 1).padStart(2, "0")}-01`;
    const end = ymd(new Date(y, m + 1, 0));
    return { start, end, preset: "month" };
  }
  if (preset === "q1") return { start: `${y}-01-01`, end: `${y}-03-31`, preset: "q1" };
  if (preset === "q2") return { start: `${y}-04-01`, end: `${y}-06-30`, preset: "q2" };
  if (preset === "q3") return { start: `${y}-07-01`, end: `${y}-09-30`, preset: "q3" };
  if (preset === "q4") return { start: `${y}-10-01`, end: `${y}-12-31`, preset: "q4" };
  if (preset === "year") {
    return { start: `${y}-01-01`, end: `${y}-12-31`, preset: "year" };
  }
  if (preset === "ytd") {
    return { start: `${y}-01-01`, end: today, preset: "ytd" };
  }
  return { start: `${y - 1}-01-01`, end: today, preset: "all" };
}

const CalendarIcon = ({ size = 18, color = "#10b981" }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <Path d="M16 2v4M8 2v4M3 10h18" />
  </Svg>
);

const ChevronDownIcon = ({ size = 16, color = "#a1a1aa" }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M6 9l6 6 6-6" />
  </Svg>
);

const ChevronUpIcon = ({ size = 16, color = "#a1a1aa" }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M18 15l-6-6-6 6" />
  </Svg>
);

export default function HomeScreen() {
  const queryClient = useQueryClient();
  
  const {
    isActive,
    platform: activePlatform,
    elapsedSeconds,
    activeMileage,
    deadMileage,
    targetTime,
    startTime,
    isPaused,
    pausedSeconds,
    isFirstOrderReceived,
    startShift,
    endShift,
    incrementTimer,
    updateMileage,
    pauseShift,
    resumeShift,
    markFirstOrderReceived,
    reset,
  } = useActiveShift();

  const trackedMileage = activeMileage + deadMileage;

  const getEtaString = () => {
    const d = new Date();
    d.setHours(d.getHours() + customHours);
    d.setMinutes(d.getMinutes() + customMinutes);
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  };

  const {
    isOnboardingCompleted,
    profile,
    isLoading,
    isDemoMode,
    activePlatformFilter,
    setActivePlatformFilter,
    loadSettings,
    clearSampleData,
    resetSettings,
  } = useSettingsStore();

  // Start Shift Wizard states
  const [showStartShiftWizard, setShowStartShiftWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState<"vehicle" | "platform" | "target">("vehicle");
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [selectedPlatformId, setSelectedPlatformId] = useState<GigPlatform>("doordash");
  const [targetMode, setTargetMode] = useState(false);
  const [customHours, setCustomHours] = useState(2);
  const [customMinutes, setCustomMinutes] = useState(0);
  const [enableNotifications, setEnableNotifications] = useState(true);

  // Screen/Overlay visibility states
  const [showBigClockOverlay, setShowBigClockOverlay] = useState(false);

  // Vehicles query
  const { data: vehiclesList = [] } = useQuery({
    queryKey: ["vehicles"],
    queryFn: () => getVehicles(),
    enabled: isOnboardingCompleted,
  });

  const [selectedPlatform, setSelectedPlatform] = useState<GigPlatform>("doordash");
  const [avgRateTab, setAvgRateTab] = useState<"active" | "online">("active");
  const [hoursTab, setHoursTab] = useState<"active" | "online">("active");

  // Date Range and Filter States matching PWA
  const [dateRange, setDateRange] = useState(() => {
    const today = new Date();
    return defaultRangeForPreset("month", today, 0);
  });
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [filterExpanded, setFilterExpanded] = useState(false);

  // Load Settings on Mount
  useEffect(() => {
    loadSettings();
  }, []);

  // Sync date range preset week start day once profile settings are loaded
  useEffect(() => {
    const today = new Date();
    setDateRange(defaultRangeForPreset(dateRange.preset, today, 0));
  }, [profile?.country]);

  const handleSelectPreset = (preset: string) => {
    if (preset === "custom") {
      setCustomStart(dateRange.start);
      setCustomEnd(dateRange.end);
      setDateRange((prev) => ({ ...prev, preset: "custom" }));
      return;
    }
    const weekStartDay = 0;
    const range = defaultRangeForPreset(preset, new Date(), weekStartDay);
    setDateRange(range);
    setFilterExpanded(false);
  };

  const handleApplyCustomDates = () => {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(customStart) || !dateRegex.test(customEnd)) {
      Alert.alert("Invalid Format", "Dates must be in YYYY-MM-DD format.");
      return;
    }
    setDateRange({ start: customStart, end: customEnd, preset: "custom" });
    setFilterExpanded(false);
  };

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

  // Period stats for the selected overview range
  const { data: financialOverview } = useQuery({
    queryKey: ["analytics", "financialOverview", activePlatformFilter, dateRange.start, dateRange.end],
    queryFn: () => getFinancialOverviewForRange(new Date(dateRange.start), new Date(dateRange.end + "T23:59:59"), activePlatformFilter, 0),
    enabled: isOnboardingCompleted,
  });

  // Monthly table breakdown
  const { data: monthlyBreakdown } = useQuery({
    queryKey: ["analytics", "monthlyBreakdown", activePlatformFilter, dateRange.start, dateRange.end],
    queryFn: () => getFinancialMonthlyBreakdown(new Date(dateRange.start), new Date(dateRange.end + "T23:59:59"), activePlatformFilter),
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
    doordash: "DoorDash",
    ubereats: "Uber Eats",
    skip: "SkipTheDishes",
    instacart: "Instacart",
    amazonflex: "Amazon Flex",
    foodora: "Foodora",
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

  const handleStartShiftWizardStart = () => {
    setTargetMode(false);
    setCustomHours(2);
    setCustomMinutes(0);
    setEnableNotifications(true);

    if (vehiclesList.length > 1) {
      setWizardStep("vehicle");
      setSelectedVehicleId(vehiclesList.find((v: any) => v.isActive)?.id || vehiclesList[0]?.id || "default_vehicle_1");
    } else {
      setSelectedVehicleId(vehiclesList[0]?.id || "default_vehicle_1");
      setWizardStep("platform");
    }
    setShowStartShiftWizard(true);
  };

  const handleStartShiftWizardSubmit = () => {
    let finalTargetTimeEpoch: number | null = null;
    if (targetMode) {
      const d = new Date();
      d.setHours(d.getHours() + customHours);
      d.setMinutes(d.getMinutes() + customMinutes);
      finalTargetTimeEpoch = d.getTime();
    }
    const vId = selectedVehicleId || "default_vehicle_1";
    startShift(selectedPlatformId, vId, finalTargetTimeEpoch);
    setShowStartShiftWizard(false);
    setShowBigClockOverlay(true);
  };

  const handleEndShift = async () => {
    const payload = await endShift();
    reset();
    queryClient.invalidateQueries({ queryKey: ["analytics"] });
    queryClient.invalidateQueries({ queryKey: ["shifts"] });
    setShowBigClockOverlay(false);

    if (payload?.shiftId) {
      Alert.alert(
        "Shift Ended",
        "Your shift has been recorded. Let's enter your earnings details now!",
        [
          {
            text: "Enter Earnings",
            onPress: () => {
              router.push({
                pathname: "/shift/add",
                params: { shiftId: payload.shiftId }
              });
            }
          },
          { text: "Dismiss", style: "cancel" }
        ]
      );
    }
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

        {/* PWA-Parity Homepage Header */}
        <View style={styles.homepageHeader}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
            <View style={styles.headerAvatar}>
              <Text style={styles.headerAvatarText}>
                {profile?.displayName?.charAt(0).toUpperCase() || "C"}
              </Text>
            </View>
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>Financial Overview</Text>
              <Text style={styles.headerSubtitle}>
                Track your delivery performance.
              </Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            {!isActive ? (
              <Pressable
                onPress={handleStartShiftWizardStart}
                style={styles.compactStartBtn}
              >
                <PlayIcon size={12} color="white" />
                <Text style={styles.compactStartBtnText}>Start Shift</Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={() => setShowBigClockOverlay(true)}
                style={styles.compactActiveBtn}
              >
                <View style={styles.pulseDotActive} />
                <Text style={styles.compactActiveBtnText}>Active Shift</Text>
              </Pressable>
            )}
          </View>
        </View>
        {/* Date Range Collapsible Filter Bar */}
        <View style={styles.filterCard}>
          <Pressable
            onPress={() => setFilterExpanded(!filterExpanded)}
            style={styles.filterSummary}
          >
            <View style={styles.filterSummaryLeft}>
              <CalendarIcon size={16} color="#10b981" />
              <Text style={styles.filterSummaryText}>
                {dateRange.start} – {dateRange.end}
              </Text>
            </View>
            <View style={styles.filterSummaryRight}>
              <View style={styles.filterPresetBadge}>
                <Text style={styles.filterPresetBadgeText}>
                  {dateRange.preset === "custom"
                    ? "Custom"
                    : dateRange.preset.charAt(0).toUpperCase() + dateRange.preset.slice(1)}
                </Text>
              </View>
              {filterExpanded ? (
                <ChevronUpIcon size={14} color="#71717a" />
              ) : (
                <ChevronDownIcon size={14} color="#71717a" />
              )}
            </View>
          </Pressable>

          {filterExpanded && (
            <View style={styles.filterExpandedContent}>
              <View style={styles.presetButtonsRow}>
                {["day", "week", "month", "year", "ytd", "custom"].map((p) => {
                  const active = dateRange.preset === p;
                  return (
                    <Pressable
                      key={p}
                      onPress={() => handleSelectPreset(p)}
                      style={[styles.presetItemBtn, active && styles.presetItemBtnActive]}
                    >
                      <Text style={[styles.presetItemBtnText, active && styles.presetItemBtnTextActive]}>
                        {p === "ytd" ? "YTD" : p.charAt(0).toUpperCase() + p.slice(1)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {dateRange.preset === "custom" && (
                <View style={styles.customRangeInputsRow}>
                  <View style={styles.customDateInputContainer}>
                    <Text style={styles.customDateInputLabel}>Start Date</Text>
                    <TextInput
                      value={customStart}
                      onChangeText={setCustomStart}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor="#52525b"
                      style={styles.customDateTextInput}
                    />
                  </View>
                  <View style={styles.customDateInputContainer}>
                    <Text style={styles.customDateInputLabel}>End Date</Text>
                    <TextInput
                      value={customEnd}
                      onChangeText={setCustomEnd}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor="#52525b"
                      style={styles.customDateTextInput}
                    />
                  </View>
                  <Pressable onPress={handleApplyCustomDates} style={styles.customApplyBtn}>
                    <Text style={styles.customApplyBtnText}>Apply</Text>
                  </Pressable>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Start Shift Wizard Modal */}
        <Modal
          visible={showStartShiftWizard}
          transparent
          animationType="slide"
          onRequestClose={() => setShowStartShiftWizard(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {wizardStep === "vehicle" && "Select Active Vehicle"}
                  {wizardStep === "platform" && "Select Active Platform"}
                  {wizardStep === "target" && `Shift Target: ${platformLabels[selectedPlatformId]}`}
                </Text>
                <Pressable onPress={() => setShowStartShiftWizard(false)} style={styles.closeBtn}>
                  <Text style={styles.closeBtnText}>×</Text>
                </Pressable>
              </View>

              <View style={styles.modalBody}>
                {wizardStep === "vehicle" && (
                  <View style={{ gap: 12 }}>
                    <Text style={styles.modalSectionLabel}>Which vehicle are you driving?</Text>
                    {vehiclesList.length > 0 ? (
                      vehiclesList.map((v: any) => {
                        const iconEmoji = v.type === "ev" ? "⚡" : (v.type === "bicycle" || v.type === "ebike" ? "🚲" : "🚗");
                        return (
                          <Pressable
                            key={v.id}
                            onPress={() => {
                              setSelectedVehicleId(v.id);
                              setWizardStep("platform");
                            }}
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              backgroundColor: "#1c1c1a",
                              borderColor: selectedVehicleId === v.id ? "#10b981" : "#262624",
                              borderWidth: selectedVehicleId === v.id ? 1.5 : 1,
                              borderRadius: 12,
                              padding: 14,
                              gap: 12,
                            }}
                          >
                            <Text style={{ fontSize: 20 }}>{iconEmoji}</Text>
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontWeight: "700", color: "#ffffff", fontSize: 13 }}>
                                {v.nickname || "Unnamed Vehicle"}
                              </Text>
                              <Text style={{ fontSize: 10, color: "#71717a", textTransform: "uppercase", fontWeight: "700", marginTop: 2 }}>
                                {v.make} {v.model} ({v.type})
                              </Text>
                            </View>
                            <Text style={{ color: "#71717a", fontSize: 16 }}>→</Text>
                          </Pressable>
                        );
                      })
                    ) : (
                      <Pressable
                        onPress={() => {
                          setSelectedVehicleId("default_vehicle_1");
                          setWizardStep("platform");
                        }}
                        style={styles.modalSubmitBtn}
                      >
                        <Text style={styles.modalSubmitBtnText}>Use Default Vehicle</Text>
                      </Pressable>
                    )}
                  </View>
                )}

                {wizardStep === "platform" && (
                  <View style={{ gap: 12 }}>
                    <Text style={styles.modalSectionLabel}>Choose a platform to track:</Text>
                    <View style={styles.platformBadgeRow}>
                      {(profile?.selectedPlatforms || ["doordash", "ubereats", "skip"]).map((pId) => {
                        const pColors: Record<string, string> = {
                          doordash: "#ef4444",
                          ubereats: "#10b981",
                          skip: "#f97316",
                          other: "#818cf8",
                        };
                        const pColor = pColors[pId] || "#10b981";
                        return (
                          <Pressable
                            key={pId}
                            onPress={() => {
                              setSelectedPlatformId(pId as any);
                              setWizardStep("target");
                            }}
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              width: "100%",
                              backgroundColor: "#1c1c1a",
                              borderColor: "#262624",
                              borderWidth: 1,
                              borderRadius: 12,
                              padding: 14,
                              gap: 12,
                            }}
                          >
                            <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: pColor }} />
                            <Text style={{ fontWeight: "600", color: "#ffffff", flex: 1, fontSize: 13 }}>
                              {platformLabels[pId as GigPlatform] || pId}
                            </Text>
                            <Text style={{ color: "#71717a", fontSize: 16 }}>→</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                    {vehiclesList.length > 1 && (
                      <Pressable onPress={() => setWizardStep("vehicle")} style={{ alignSelf: "center", marginTop: 8 }}>
                        <Text style={{ color: "#a1a1aa", fontSize: 11, fontWeight: "600" }}>Back to Vehicle</Text>
                      </Pressable>
                    )}
                  </View>
                )}

                {wizardStep === "target" && (
                  <View style={{ gap: 16 }}>
                    <Text style={styles.modalSectionLabel}>Do you want to work until a fixed time?</Text>
                    
                    <View style={{ flexDirection: "row", gap: 10, justifyContent: "center" }}>
                      <Pressable
                        onPress={() => setTargetMode(false)}
                        style={{
                          flex: 1,
                          backgroundColor: !targetMode ? "#10b981" : "#1c1c1a",
                          paddingVertical: 12,
                          borderRadius: 8,
                          alignItems: "center",
                          borderWidth: 1,
                          borderColor: !targetMode ? "#10b981" : "#262624",
                        }}
                      >
                        <Text style={{ color: "white", fontWeight: "700", fontSize: 12 }}>No, just track</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => setTargetMode(true)}
                        style={{
                          flex: 1,
                          backgroundColor: targetMode ? "#10b981" : "#1c1c1a",
                          paddingVertical: 12,
                          borderRadius: 8,
                          alignItems: "center",
                          borderWidth: 1,
                          borderColor: targetMode ? "#10b981" : "#262624",
                        }}
                      >
                        <Text style={{ color: "white", fontWeight: "700", fontSize: 12 }}>Yes, set time</Text>
                      </Pressable>
                    </View>

                    {targetMode && (
                      <View style={{ gap: 12, backgroundColor: "#0d0d0c", padding: 12, borderRadius: 10, borderWidth: 1, borderColor: "#262624" }}>
                        <Text style={{ fontSize: 10, color: "#71717a", fontWeight: "700", textTransform: "uppercase" }}>
                          Select Preset Duration:
                        </Text>
                        <View style={{ flexDirection: "row", gap: 8 }}>
                          {[1, 2, 4, 8].map((h) => (
                            <Pressable
                              key={h}
                              onPress={() => {
                                setCustomHours(h);
                                setCustomMinutes(0);
                              }}
                              style={{
                                flex: 1,
                                backgroundColor: customHours === h && customMinutes === 0 ? "#10b981" : "#161615",
                                paddingVertical: 6,
                                borderRadius: 6,
                                alignItems: "center",
                                borderWidth: 1,
                                borderColor: "#262624",
                              }}
                            >
                              <Text style={{ color: "white", fontWeight: "700", fontSize: 11 }}>{h}h</Text>
                            </Pressable>
                          ))}
                        </View>

                        <Text style={{ fontSize: 10, color: "#71717a", fontWeight: "700", textTransform: "uppercase", marginTop: 4 }}>
                          Adjust Working Time:
                        </Text>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                          <View style={{ flex: 1, alignItems: "center", gap: 4 }}>
                            <Text style={{ fontSize: 9, color: "#a1a1aa", fontWeight: "600" }}>Hours</Text>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                              <Pressable
                                onPress={() => setCustomHours(Math.max(0, customHours - 1))}
                                style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: "#1c1c1a", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#262624" }}
                              >
                                <Text style={{ color: "white", fontWeight: "700", fontSize: 14 }}>-</Text>
                              </Pressable>
                              <Text style={{ color: "white", fontWeight: "800", fontSize: 14, width: 20, textAlign: "center" }}>{customHours}</Text>
                              <Pressable
                                onPress={() => setCustomHours(customHours + 1)}
                                style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: "#1c1c1a", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#262624" }}
                              >
                                <Text style={{ color: "white", fontWeight: "700", fontSize: 14 }}>+</Text>
                              </Pressable>
                            </View>
                          </View>

                          <View style={{ flex: 1, alignItems: "center", gap: 4 }}>
                            <Text style={{ fontSize: 9, color: "#a1a1aa", fontWeight: "600" }}>Minutes</Text>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                              <Pressable
                                onPress={() => setCustomMinutes(Math.max(0, customMinutes - 15))}
                                style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: "#1c1c1a", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#262624" }}
                              >
                                <Text style={{ color: "white", fontWeight: "700", fontSize: 14 }}>-</Text>
                              </Pressable>
                              <Text style={{ color: "white", fontWeight: "800", fontSize: 14, width: 24, textAlign: "center" }}>{customMinutes}</Text>
                              <Pressable
                                onPress={() => setCustomMinutes(Math.min(45, customMinutes + 15))}
                                style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: "#1c1c1a", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#262624" }}
                              >
                                <Text style={{ color: "white", fontWeight: "700", fontSize: 14 }}>+</Text>
                              </Pressable>
                            </View>
                          </View>
                        </View>

                        <Text style={{ color: "#10b981", fontSize: 11, fontWeight: "700", textAlign: "center", marginTop: 8 }}>
                          Target End Time: {getEtaString()}
                        </Text>
                      </View>
                    )}

                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, borderTopColor: "#262624", paddingTop: 12, marginTop: 4 }}>
                      <Pressable onPress={() => setWizardStep("platform")} style={{ paddingVertical: 8 }}>
                        <Text style={{ color: "#a1a1aa", fontSize: 11, fontWeight: "600" }}>Back</Text>
                      </Pressable>
                      <Pressable
                        onPress={handleStartShiftWizardSubmit}
                        style={{
                          backgroundColor: "#10b981",
                          borderRadius: 8,
                          paddingVertical: 10,
                          paddingHorizontal: 20,
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <PlayIcon size={10} color="white" />
                        <Text style={{ color: "white", fontWeight: "700", fontSize: 12 }}>START SHIFT</Text>
                      </Pressable>
                    </View>
                  </View>
                )}
              </View>
            </View>
          </View>
        </Modal>

        {/* Fullscreen Big Clock Timer Overlay Modal */}
        <Modal
          visible={showBigClockOverlay}
          transparent={false}
          animationType="fade"
          onRequestClose={() => setShowBigClockOverlay(false)}
        >
          <SafeAreaView style={{ flex: 1, backgroundColor: "#0d0d0c", justifyContent: "space-between", padding: 20 }}>
            {/* Header Status Bar */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
              <Pressable
                onPress={() => {
                  setShowBigClockOverlay(false);
                  Alert.alert("Shift Minimized", "Shift timer is running active in the background.", [{ text: "Got it" }]);
                }}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: "#161615",
                  borderWidth: 1,
                  borderColor: "#262624",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ChevronDownIcon size={16} color="#ffffff" />
              </Pressable>
              
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  backgroundColor: "#161615",
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: "#262624",
                }}
              >
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: isPaused
                      ? "#f59e0b"
                      : (activePlatform === "doordash" ? "#ef4444" : activePlatform === "ubereats" ? "#10b981" : activePlatform === "skip" ? "#f97316" : "#818cf8"),
                  }}
                />
                <Text style={{ color: "#ffffff", fontSize: 11, fontWeight: "700", textTransform: "uppercase" }}>
                  {platformLabels[activePlatform || "other"]} Active Shift
                </Text>
              </View>

              <View style={{ width: 36 }} />
            </View>

            {/* Central Dial Container */}
            <View style={{ alignItems: "center", justifyContent: "center", marginVertical: 20 }}>
              <View style={{ width: 280, height: 280, alignItems: "center", justifyContent: "center" }}>
                {/* SVG Progress Ring */}
                <View style={{ position: "absolute" }}>
                  <Svg width={280} height={280} viewBox="0 0 280 280">
                    <Circle
                      cx={140}
                      cy={140}
                      r={124}
                      stroke="#262624"
                      strokeWidth={6}
                      fill="transparent"
                    />
                    <Circle
                      cx={140}
                      cy={140}
                      r={124}
                      stroke={
                        isPaused
                          ? "#f59e0b"
                          : !isFirstOrderReceived
                          ? "#f59e0b"
                          : (activePlatform === "doordash" ? "#ef4444" : activePlatform === "ubereats" ? "#10b981" : activePlatform === "skip" ? "#f97316" : "#818cf8")
                      }
                      strokeWidth={6}
                      fill="transparent"
                      strokeLinecap="round"
                      strokeDasharray={779}
                      strokeDashoffset={
                        targetTime && startTime
                          ? 779 - (779 * Math.min(100, Math.floor(((elapsedSeconds * 1000) / (targetTime - startTime)) * 100))) / 100
                          : 195 // Steady 3/4 fill rotation base
                      }
                      transform="rotate(-90 140 140)"
                    />
                  </Svg>
                </View>

                {/* Inner Text & Timer details */}
                <View style={{ alignItems: "center", gap: 2 }}>
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "800",
                      textTransform: "uppercase",
                      color: isPaused
                        ? "#f59e0b"
                        : !isFirstOrderReceived
                        ? "#f59e0b"
                        : (activePlatform === "doordash" ? "#ef4444" : activePlatform === "ubereats" ? "#10b981" : activePlatform === "skip" ? "#f97316" : "#818cf8"),
                      letterSpacing: 1,
                    }}
                  >
                    {isPaused ? "Shift Paused" : !isFirstOrderReceived ? "Waiting for Order" : "Shift Active"}
                  </Text>
                  
                  <Text
                    style={{
                      fontSize: 42,
                      fontWeight: "900",
                      color: isPaused ? "#71717a" : "#ffffff",
                      fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
                      letterSpacing: 1.5,
                      marginVertical: 4,
                      textShadowColor: isPaused ? "transparent" : "rgba(255, 255, 255, 0.15)",
                      textShadowOffset: { width: 0, height: 0 },
                      textShadowRadius: 10,
                    }}
                  >
                    {formatTime(elapsedSeconds)}
                  </Text>

                  {/* Distance Tracker Panel */}
                  <View style={{ alignItems: "center", marginTop: 4 }}>
                    <Text style={{ fontSize: 16, fontWeight: "800", color: "#ffffff" }}>
                      {trackedMileage.toFixed(2)} {profile?.distanceUnit} total
                    </Text>
                    {isFirstOrderReceived ? (
                      <Text style={{ fontSize: 10, color: "#a1a1aa", fontWeight: "600", marginTop: 1 }}>
                        Active: {activeMileage.toFixed(2)} • Dead: {deadMileage.toFixed(2)} {profile?.distanceUnit}
                      </Text>
                    ) : (
                      <View
                        style={{
                          backgroundColor: "rgba(245, 158, 11, 0.15)",
                          borderColor: "rgba(245, 158, 11, 0.25)",
                          borderWidth: 1,
                          paddingHorizontal: 8,
                          paddingVertical: 2,
                          borderRadius: 4,
                          marginTop: 3,
                        }}
                      >
                        <Text style={{ fontSize: 8, fontWeight: "900", color: "#f59e0b", textTransform: "uppercase" }}>
                          Dead Miles 💀
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Target ETA details */}
                  {targetTime && startTime ? (
                    <Text style={{ fontSize: 10, color: "#71717a", fontWeight: "600", marginTop: 6, width: 180, textAlign: "center" }}>
                      Goal: working until {new Date(targetTime).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                    </Text>
                  ) : null}
                </View>
              </View>
            </View>

            {/* Target Goal Progress Slider Bar */}
            {targetTime && startTime ? (
              <View style={{ width: "100%", paddingHorizontal: 10, marginBottom: 12 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                  <Text style={{ color: "#a1a1aa", fontSize: 11, fontWeight: "600" }}>Shift Goal Progress</Text>
                  <Text style={{ color: "#ffffff", fontSize: 11, fontWeight: "700" }}>
                    {Math.min(100, Math.floor(((elapsedSeconds * 1000) / (targetTime - startTime)) * 100))}%
                  </Text>
                </View>
                <View style={{ height: 6, backgroundColor: "#161615", borderRadius: 3, overflow: "hidden", borderWidth: 1, borderColor: "#262624" }}>
                  <View
                    style={{
                      height: "100%",
                      width: `${Math.min(100, Math.floor(((elapsedSeconds * 1000) / (targetTime - startTime)) * 100))}%`,
                      backgroundColor: activePlatform === "doordash" ? "#ef4444" : activePlatform === "ubereats" ? "#10b981" : activePlatform === "skip" ? "#f97316" : "#818cf8",
                    }}
                  />
                </View>
              </View>
            ) : null}

            {/* Controls Actions Stack */}
            <View style={{ gap: 12, width: "100%" }}>
              {/* Got First Order Button */}
              {!isFirstOrderReceived && !isPaused && (
                <Pressable
                  onPress={() => {
                    markFirstOrderReceived();
                    Alert.alert("🎉 First Order Received!", "Active mileage tracking has started.");
                  }}
                  style={{
                    backgroundColor: "#f59e0b",
                    borderRadius: 8,
                    paddingVertical: 12,
                    alignItems: "center",
                    justifyContent: "center",
                    flexDirection: "row",
                    gap: 6,
                  }}
                >
                  <Text style={{ fontSize: 14 }}>🚩</Text>
                  <Text style={{ color: "#ffffff", fontWeight: "800", fontSize: 13, letterSpacing: 0.5 }}>
                    GOT FIRST ORDER
                  </Text>
                </Pressable>
              )}

              {/* Pause/Resume + Mileage row */}
              <View style={{ flexDirection: "row", gap: 10 }}>
                {/* Pause/Resume */}
                <Pressable
                  onPress={() => {
                    if (isPaused) {
                      resumeShift();
                    } else {
                      pauseShift();
                    }
                  }}
                  style={{
                    flex: 1,
                    backgroundColor: "#161615",
                    borderColor: "#262624",
                    borderWidth: 1,
                    borderRadius: 8,
                    paddingVertical: 12,
                    alignItems: "center",
                    justifyContent: "center",
                    flexDirection: "row",
                    gap: 6,
                  }}
                >
                  {isPaused ? (
                    <>
                      <PlayIcon size={10} color="#10b981" />
                      <Text style={{ color: "#10b981", fontWeight: "700", fontSize: 12 }}>Resume</Text>
                    </>
                  ) : (
                    <>
                      <View style={{ width: 8, height: 8, backgroundColor: "#f59e0b", borderRadius: 1 }} />
                      <Text style={{ color: "#f59e0b", fontWeight: "700", fontSize: 12 }}>Pause</Text>
                    </>
                  )}
                </Pressable>

                {/* Add Mileage */}
                <Pressable
                  onPress={() => {
                    if (isFirstOrderReceived) {
                      updateMileage(0.5, 0);
                    } else {
                      updateMileage(0, 0.5);
                    }
                  }}
                  style={{
                    flex: 1,
                    backgroundColor: "#161615",
                    borderColor: "#262624",
                    borderWidth: 1,
                    borderRadius: 8,
                    paddingVertical: 12,
                    alignItems: "center",
                    justifyContent: "center",
                    flexDirection: "row",
                    gap: 6,
                  }}
                >
                  <Text style={{ color: "#ffffff", fontWeight: "700", fontSize: 12 }}>
                    +0.5 {profile?.distanceUnit}
                  </Text>
                </Pressable>
              </View>

              {/* End Shift */}
              <Pressable
                onPress={handleEndShift}
                style={{
                  backgroundColor: "#ef4444",
                  borderRadius: 8,
                  paddingVertical: 14,
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "row",
                  gap: 8,
                }}
              >
                <SquareIcon size={12} color="white" />
                <Text style={{ color: "#ffffff", fontWeight: "800", fontSize: 13, letterSpacing: 0.5 }}>
                  STOP & SAVE SHIFT
                </Text>
              </Pressable>
            </View>
          </SafeAreaView>
        </Modal>

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
  homepageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  headerTextContainer: {
    flex: 1,
    paddingRight: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: "#ffffff",
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#a1a1aa",
    marginTop: 4,
    lineHeight: 16,
  },
  headerActions: {
    justifyContent: "center",
    alignItems: "flex-end",
  },
  compactStartBtn: {
    backgroundColor: "#10b981",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  compactStartBtnText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  compactActiveBtn: {
    backgroundColor: "#ef4444",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    shadowColor: "#ef4444",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  compactActiveBtnText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  pulseDotActive: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#ffffff",
  },
  filterCard: {
    backgroundColor: "#161615",
    borderColor: "#262624",
    borderWidth: 1,
    borderRadius: 14,
    overflow: "hidden",
  },
  filterSummary: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
  },
  filterSummaryLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  filterSummaryText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  filterSummaryRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  filterPresetBadge: {
    backgroundColor: "#262624",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  filterPresetBadgeText: {
    color: "#a1a1aa",
    fontSize: 10,
    fontWeight: "800",
  },
  filterExpandedContent: {
    borderTopWidth: 1,
    borderTopColor: "#262624",
    padding: 12,
    backgroundColor: "#1c1c1a",
    gap: 12,
  },
  presetButtonsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  presetItemBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#161615",
    borderColor: "#262624",
    borderWidth: 1,
  },
  presetItemBtnActive: {
    backgroundColor: "#10b981",
    borderColor: "#10b981",
  },
  presetItemBtnText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#a1a1aa",
  },
  presetItemBtnTextActive: {
    color: "#ffffff",
  },
  customRangeInputsRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: "#262624",
    paddingTop: 12,
  },
  customDateInputContainer: {
    flex: 1,
    gap: 4,
  },
  customDateInputLabel: {
    fontSize: 10,
    color: "#71717a",
    fontWeight: "700",
    textTransform: "uppercase",
  },
  customDateTextInput: {
    backgroundColor: "#161615",
    borderColor: "#262624",
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    color: "#ffffff",
    fontSize: 12,
  },
  customApplyBtn: {
    backgroundColor: "#10b981",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  customApplyBtnText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#161615",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderColor: "#262624",
    borderTopWidth: 1,
    padding: 16,
    paddingBottom: 32,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#262624",
    paddingBottom: 12,
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#ffffff",
  },
  closeBtn: {
    padding: 4,
  },
  closeBtnText: {
    fontSize: 22,
    color: "#71717a",
    fontWeight: "600",
  },
  modalBody: {
    gap: 16,
  },
  modalSectionLabel: {
    fontSize: 11,
    color: "#71717a",
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  platformBadgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  platformBadgeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#1c1c1a",
    borderColor: "#262624",
    borderWidth: 1,
  },
  platformBadgeBtnActive: {
    borderColor: "#10b981",
    backgroundColor: "rgba(16, 185, 129, 0.08)",
  },
  platformBadgeBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#a1a1aa",
  },
  platformBadgeBtnTextActive: {
    color: "#10b981",
  },
  modalSubmitBtn: {
    backgroundColor: "#10b981",
    borderRadius: 8,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  modalSubmitBtnText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  modalTimerContainer: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0d0d0c",
    paddingVertical: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#262624",
  },
  modalTimerDigits: {
    fontSize: 36,
    fontWeight: "900",
    color: "#ffffff",
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
    letterSpacing: 1,
  },
  modalTimerLabel: {
    fontSize: 10,
    color: "#a1a1aa",
    textTransform: "uppercase",
    fontWeight: "700",
    marginTop: 4,
    letterSpacing: 0.5,
  },
  modalMileageRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#0d0d0c",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#262624",
  },
  modalMileageLabel: {
    fontSize: 9,
    color: "#a1a1aa",
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  modalMileageValue: {
    fontSize: 16,
    fontWeight: "800",
    color: "#ffffff",
    marginTop: 2,
  },
  modalAddMileBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#1c1c1a",
    borderWidth: 1,
    borderColor: "#262624",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  modalAddMileBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#ffffff",
  },
  modalEndShiftBtn: {
    backgroundColor: "#ef4444",
    borderRadius: 8,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  modalEndShiftBtnText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  headerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#10b981",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.2)",
  },
  headerAvatarText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
  },
  platformSwitcherOuter: {
    marginBottom: 12,
  },
  platformSwitcherScroll: {
    paddingHorizontal: 2,
    gap: 8,
  },
  platformTab: {
    backgroundColor: "#161615",
    borderWidth: 1,
    borderColor: "#262624",
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  platformTabActive: {
    backgroundColor: "rgba(22, 22, 21, 0.9)",
  },
  platformTabInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  platformTabLogo: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  platformTabLogoText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "900",
  },
  platformTabLabel: {
    color: "#71717a",
    fontSize: 11,
    fontWeight: "600",
  },
  platformTabLabelActive: {
    color: "#ffffff",
    fontWeight: "700",
  },
});
