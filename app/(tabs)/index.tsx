import React, { useEffect, useState } from "react";
import { ScrollView, View, ActivityIndicator, TouchableOpacity, Alert, Platform } from "react-native";
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
import { BentoCard } from "../../src/components/ui/BentoCard";
import { CurrencyText } from "../../src/components/ui/CurrencyText";
import { getTodayStats, getWeekStats, getGoalProgress, getActiveVehicle } from "../../src/database/queries/analytics";

// Custom vector icons implemented as pure Views to avoid react-native-svg native dependency
const PlayIcon = ({ size = 16, color = "white" }: { size?: number; color?: string }) => (
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

const SquareIcon = ({ size = 16, color = "white" }: { size?: number; color?: string }) => (
  <View
    style={{
      width: size * 0.8,
      height: size * 0.8,
      backgroundColor: color,
      borderRadius: size * 0.15,
    }}
  />
);

const PlusIcon = ({ size = 14, color = "#cbd5e1" }: { size?: number; color?: string }) => (
  <View style={{ width: size, height: size, justifyContent: "center", alignItems: "center" }}>
    <View style={{ position: "absolute", width: size, height: 2, backgroundColor: color, borderRadius: 1 }} />
    <View style={{ position: "absolute", width: 2, height: size, backgroundColor: color, borderRadius: 1 }} />
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

const MilestoneIcon = ({ size = 18, color = "#818cf8" }: { size?: number; color?: string }) => (
  <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
    <View style={{ width: 2, height: size, backgroundColor: color, position: "absolute" }} />
    <View
      style={{
        width: size * 0.75,
        height: size * 0.45,
        backgroundColor: "#0b0f19",
        borderWidth: 1.5,
        borderColor: color,
        borderRadius: 2,
        position: "absolute",
        top: size * 0.15,
        justifyContent: "center",
        alignItems: "center",
      }}
    />
  </View>
);

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
    loadSettings,
    clearSampleData,
    resetSettings,
  } = useSettingsStore();

  const [selectedPlatform, setSelectedPlatform] = useState<GigPlatform>("doordash");

  // Load Settings on Mount
  useEffect(() => {
    loadSettings();
  }, []);

  // Timer effect
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;
    if (isActive) {
      intervalId = setInterval(() => {
        incrementTimer();
      }, 1000);
    }
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isActive, incrementTimer]);

  // React Query Fetchers for Dashboard stats
  const { data: todayStats = { gross: 0, tips: 0, count: 0, activeMileage: 0, deadMileage: 0 } } = useQuery({
    queryKey: ["analytics", "today"],
    queryFn: () => getTodayStats(),
    enabled: isOnboardingCompleted,
  });

  const { data: weekStats = { gross: 0, tips: 0, count: 0, activeMileage: 0, deadMileage: 0, durationSeconds: 0 } } = useQuery({
    queryKey: ["analytics", "week"],
    queryFn: () => getWeekStats(),
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

  // Platform label dictionary
  const platformLabels: Record<GigPlatform, string> = {
    doordash: "DoorDash",
    ubereats: "Uber Eats",
    skip: "Skip",
    instacart: "Instacart",
    lyft: "Lyft",
    amazon: "Amazon Flex",
    other: "Other",
  };

  // Today's projection math wired to Drizzle todayStats
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

  // Loading Screen
  if (isLoading) {
    return (
      <SafeAreaView className="dark flex-1 bg-[#0b0f19] items-center justify-center">
        <ActivityIndicator size="large" color="#3b82f6" />
      </SafeAreaView>
    );
  }

  // Onboarding Wizard Screen
  if (!isOnboardingCompleted) {
    return <OnboardingWizard />;
  }

  // Dashboard Screen
  return (
    <SafeAreaView className="dark flex-1 bg-[#0b0f19]">
      <ScrollView contentContainerClassName="p-4 flex flex-col gap-5 pb-12">
        {/* Banner for Demo Mode */}
        {isDemoMode && (
          <View className="bg-amber-500/10 border border-amber-500/20 px-4 py-3 rounded-xl flex flex-row justify-between items-center mt-1">
            <Text className="text-xs text-amber-500 font-semibold">
              Viewing mock sample data
            </Text>
            <TouchableOpacity
              onPress={async () => {
                await clearSampleData();
                await loadSettings();
                queryClient.invalidateQueries({ queryKey: ["analytics"] });
                queryClient.invalidateQueries({ queryKey: ["shifts"] });
              }}
              className="py-1.5 px-3 bg-amber-500/20 border border-amber-500/30 rounded-lg"
            >
              <Text className="text-[10px] font-bold text-amber-400 uppercase">Clear Demo</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Header Block with Driver Info */}
        <View className="flex flex-row justify-between items-center mt-2">
          <View className="flex flex-col gap-1">
            <Text className="text-2xl font-extrabold text-slate-100 tracking-tight">
              Hello, {profile.displayName} {profile.avatarData}
            </Text>
            <Text className="text-xs text-slate-400 font-medium">
              Tracking {profile.country} ({profile.taxRegion}) • {profile.distanceUnit}
            </Text>
          </View>

          <TouchableOpacity
            onPress={async () => {
              if (Platform.OS === "web") {
                if (window.confirm("Are you sure you want to reset the app? This deletes all shifts, vehicles, and settings.")) {
                  await resetSettings();
                  await loadSettings();
                  queryClient.invalidateQueries({ queryKey: ["analytics"] });
                  queryClient.invalidateQueries({ queryKey: ["shifts"] });
                }
              } else {
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
              }
            }}
            className="py-1 px-2.5 rounded bg-slate-900 border border-slate-800"
          >
            <Text className="text-[9px] font-extrabold text-slate-500 tracking-wider uppercase">Reset App</Text>
          </TouchableOpacity>
        </View>

        {/* 5.2.2: COMPONENT A — THE ACTIVE SHIFT HERO CARD */}
        <Card
          className={cn(
            "bg-slate-900/90 border border-slate-800 transition-all duration-300",
            isActive && "border-primary/80 border-2 shadow-lg shadow-primary/10"
          )}
        >
          <CardHeader className="pb-3 border-b border-slate-800/60">
            <View className="flex flex-row justify-between items-center">
              <View className="flex flex-row items-center gap-2">
                <View
                  className={cn(
                    "w-2.5 h-2.5 rounded-full",
                    isActive ? "bg-emerald-500 animate-pulse" : "bg-slate-600"
                  )}
                />
                <Text
                  className={cn(
                    "text-xs font-bold tracking-wider uppercase",
                    isActive ? "text-emerald-400 animate-pulse" : "text-slate-400"
                  )}
                >
                  {isActive
                    ? `STATUS: ON-DUTY • ${platformLabels[activePlatform || "other"]}`
                    : "STATUS: OFF-DUTY"}
                </Text>
              </View>
              {isActive && (
                <View className="bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
                  <Text className="text-[10px] font-bold text-primary uppercase">
                    Active
                  </Text>
                </View>
              )}
            </View>
          </CardHeader>

          <CardContent className="pt-5 flex flex-col gap-5">
            {!isActive ? (
              // Idle State
              <View className="flex flex-col gap-5">
                <View className="flex flex-col gap-1.5">
                  <Text className="text-slate-300 text-sm font-semibold">
                    Select Active Platform:
                  </Text>
                  <View className="flex flex-row gap-2">
                    {profile.selectedPlatforms.length > 0 ? (
                      profile.selectedPlatforms.map((pId) => (
                        <Button
                          key={pId}
                          variant="outline"
                          size="sm"
                          className={cn(
                            "flex-1 py-2.5 border-slate-800 bg-slate-900/50",
                            selectedPlatform === pId && "border-primary bg-primary/10"
                          )}
                          onPress={() => setSelectedPlatform(pId as any)}
                        >
                          <Text
                            className={cn(
                              "text-xs font-semibold uppercase",
                              selectedPlatform === pId ? "text-primary" : "text-slate-400"
                            )}
                          >
                            {platformLabels[pId as GigPlatform] || pId}
                          </Text>
                        </Button>
                      ))
                    ) : (
                      (["doordash", "ubereats", "skip"] as GigPlatform[]).map((pId) => (
                        <Button
                          key={pId}
                          variant="outline"
                          size="sm"
                          className={cn(
                            "flex-1 py-2.5 border-slate-800 bg-slate-900/50",
                            selectedPlatform === pId && "border-primary bg-primary/10"
                          )}
                          onPress={() => setSelectedPlatform(pId)}
                        >
                          <Text
                            className={cn(
                              "text-xs font-semibold",
                              selectedPlatform === pId ? "text-primary" : "text-slate-400"
                            )}
                          >
                            {platformLabels[pId]}
                          </Text>
                        </Button>
                      ))
                    )}
                  </View>
                </View>

                <Button
                  onPress={handleStartShift}
                  variant="default"
                  className="w-full bg-primary py-3 rounded-lg flex flex-row items-center justify-center gap-2 shadow-md shadow-primary/20"
                >
                  <PlayIcon size={16} color="white" />
                  <Text className="font-bold text-white text-sm">
                    START SHIFT
                  </Text>
                </Button>
              </View>
            ) : (
              // Active State
              <View className="flex flex-col gap-5">
                {/* Timer block */}
                <View className="items-center justify-center bg-slate-950/40 py-5 rounded-xl border border-slate-800/40">
                  <Text className="text-5xl font-extrabold text-slate-100 tracking-wider font-mono">
                    {formatTime(elapsedSeconds)}
                  </Text>
                  <Text className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mt-1.5">
                    Elapsed Duration
                  </Text>
                </View>

                {/* Mileage and quick actions */}
                <View className="flex flex-row justify-between items-center bg-slate-950/30 p-3.5 rounded-xl border border-slate-800/30">
                  <View className="flex flex-row items-center gap-3">
                    <View className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                      <MilestoneIcon size={18} color="#818cf8" />
                    </View>
                    <View>
                      <Text className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                        Tracked Distance
                      </Text>
                      <Text className="text-lg font-bold text-slate-200 mt-0.5">
                        {trackedMileage.toFixed(2)} {profile.distanceUnit}
                      </Text>
                    </View>
                  </View>

                  <Button
                    variant="outline"
                    size="sm"
                    className="border-slate-800 bg-slate-900 px-3 py-2 flex flex-row items-center gap-1.5"
                    onPress={() => updateMileage(0.5, 0)}
                  >
                    <PlusIcon size={14} color="#cbd5e1" />
                    <Text className="text-xs font-semibold text-slate-300">
                      + 0.5 {profile.distanceUnit}
                    </Text>
                  </Button>
                </View>

                {/* End shift button */}
                <Button
                  onPress={handleEndShift}
                  variant="destructive"
                  className="w-full py-3 rounded-lg flex flex-row items-center justify-center gap-2 shadow-md shadow-destructive/10"
                >
                  <SquareIcon size={16} color="white" />
                  <Text className="font-bold text-white text-sm">
                    END SHIFT
                  </Text>
                </Button>
              </View>
            )}
          </CardContent>
        </Card>

        {/* Bento Grid */}
        <View className="flex-row flex-wrap justify-between gap-y-4">
          <BentoCard size="1x1" title="Today" className="w-[48.5%]">
            <View className="flex-col justify-between h-full pt-1">
              <CurrencyText amount={todayStats.gross + todayStats.tips} size="lg" className="text-xl font-extrabold" />
              <Text className="text-xs text-slate-400 font-medium mt-1">
                {todayStats.count} {todayStats.count === 1 ? "shift" : "shifts"}
              </Text>
            </View>
          </BentoCard>

          <BentoCard size="1x1" title="This Week" className="w-[48.5%]">
            <View className="flex-col justify-between h-full pt-1">
              <CurrencyText amount={weekStats.gross + weekStats.tips} size="lg" className="text-xl font-extrabold" />
              <Text className="text-xs text-slate-400 font-medium mt-1">
                {(weekStats.durationSeconds / 3600).toFixed(1)} hrs active
              </Text>
            </View>
          </BentoCard>

          <BentoCard size="2x1" title="Miles Tracked" className="w-full">
            <View className="flex-col gap-3.5 pt-2">
              <View className="flex-col gap-1">
                <View className="flex-row justify-between items-center">
                  <Text className="text-xs text-slate-300 font-semibold">Active (On Delivery)</Text>
                  <Text className="text-xs font-bold text-emerald-400">
                    {todayStats.activeMileage.toFixed(1)} {profile.distanceUnit}
                  </Text>
                </View>
                <View className="w-full h-2 bg-slate-950 rounded-full overflow-hidden">
                  <View style={{ width: `${Math.min(100, (todayStats.activeMileage / Math.max(1, todayStats.activeMileage + todayStats.deadMileage)) * 100)}%` }} className="bg-emerald-500 h-full rounded-full" />
                </View>
              </View>

              <View className="flex-col gap-1">
                <View className="flex-row justify-between items-center">
                  <Text className="text-xs text-slate-300 font-semibold">Dead (Commute/Waiting)</Text>
                  <Text className="text-xs font-bold text-amber-500">
                    {todayStats.deadMileage.toFixed(1)} {profile.distanceUnit}
                  </Text>
                </View>
                <View className="w-full h-2 bg-slate-950 rounded-full overflow-hidden">
                  <View style={{ width: `${Math.min(100, (todayStats.deadMileage / Math.max(1, todayStats.activeMileage + todayStats.deadMileage)) * 100)}%` }} className="bg-amber-500 h-full rounded-full" />
                </View>
              </View>
            </View>
          </BentoCard>

          <BentoCard size="2x1" title="Weekly Goal" className="w-full">
            {(() => {
              const goalProgress = weeklyGoals[0] || {
                targetValue: profile.weeklyGoal,
                currentValue: weekStats.gross + weekStats.tips,
                progressPct: profile.weeklyGoal > 0 ? ((weekStats.gross + weekStats.tips) / profile.weeklyGoal) * 100 : 0
              };
              const pct = Math.min(goalProgress.progressPct, 100);
              return (
                <View className="flex-col gap-3 pt-2">
                  <View className="flex-row justify-between items-end">
                    <View className="flex-row items-baseline gap-1">
                      <CurrencyText amount={goalProgress.currentValue} size="lg" className="text-xl font-extrabold text-emerald-400" />
                      <Text className="text-slate-400 text-xs font-semibold">of</Text>
                      <CurrencyText amount={goalProgress.targetValue} size="md" className="text-slate-200 font-semibold" />
                    </View>
                    <Text className="text-emerald-400 text-sm font-extrabold">{goalProgress.progressPct.toFixed(0)}%</Text>
                  </View>
                  <View className="w-full h-3 bg-slate-950 rounded-full overflow-hidden">
                    <View style={{ width: `${pct}%` }} className="bg-emerald-500 h-full rounded-full" />
                  </View>
                  <Text className="text-[10px] text-slate-400 font-medium">
                    Keep it up! You need <CurrencyText amount={Math.max(0, goalProgress.targetValue - goalProgress.currentValue)} size="sm" className="font-bold text-slate-300" /> more to hit your weekly goal.
                  </Text>
                </View>
              );
            })()}
          </BentoCard>
        </View>

        {/* 5.2.3: COMPONENT B — THE "TODAY'S PROJECTION" BENTO CARD */}
        <Card className="bg-slate-900/90 border border-slate-800">
          <CardHeader className="pb-3 border-b border-slate-800/60">
            <View className="flex flex-row items-center gap-2">
              <View className="p-1.5 rounded bg-amber-500/10 border border-amber-500/20">
                <CoinsIcon size={14} color="#fbbf24" />
              </View>
              <View>
                <CardTitle className="text-slate-200 text-base font-bold">
                  Today's Projection
                </CardTitle>
                <CardDescription className="text-slate-400 text-xs">
                  Estimate based on shift mileage
                </CardDescription>
              </View>
            </View>
          </CardHeader>

          <CardContent className="pt-5 flex flex-col gap-4">
            {/* Gross Payout */}
            <View className="flex flex-row justify-between items-center bg-slate-950/20 p-3 rounded-lg border border-slate-800/60">
              <View className="flex flex-col gap-0.5">
                <Text className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                  Gross Payout
                </Text>
                <Text className="text-[10px] text-slate-500 font-medium">
                  Sum of gross + tips today
                </Text>
              </View>
              <CurrencyText amount={grossPayout} size="lg" className="font-bold text-slate-200" />
            </View>

            {/* Est. Deductions */}
            <View className="flex flex-row justify-between items-center bg-slate-950/20 p-3 rounded-lg border border-slate-800/60">
              <View className="flex flex-col gap-0.5">
                <Text className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                  Est. Deductions
                </Text>
                <Text className="text-[10px] text-slate-500 font-medium">
                  Standard Vehicle Write-off (67¢/unit)
                </Text>
              </View>
              <CurrencyText amount={deductions} size="lg" className="font-bold text-amber-500" />
            </View>

            {/* Est. Net Income */}
            <View className="flex flex-row justify-between items-center bg-[#07090f] p-3 rounded-lg border border-slate-800/60">
              <View className="flex flex-col gap-0.5">
                <Text className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                  Est. Net Income
                </Text>
                <Text className="text-[10px] text-slate-500 font-medium">
                  Gross - Deductions
                </Text>
              </View>
              <CurrencyText amount={netIncome} size="lg" className="font-bold" />
            </View>
          </CardContent>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
