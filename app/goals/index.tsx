import React, { useState, useMemo } from "react";
import {
  ScrollView,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  TextInput,
  Modal,
  Pressable,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Award, Flame, Star, TrendingUp, Plus, Edit2, Trash2, X, Target } from "lucide-react-native";
import { Text } from "@/src/components/ui/text";
import { getGoalsWithProgress, insertGoal, deleteGoal } from "@/src/database/queries/goals";
import { getEarningsByDay } from "@/src/database/queries/analytics";
import { db } from "@/src/database/client";
import { shifts } from "@/src/database/schema";
import { desc, sql } from "drizzle-orm";
import { useSettingsStore } from "@/store/useSettingsStore";
import { cn } from "@/src/lib/utils";
import { usePlatformTheme } from "@/src/hooks/usePlatformTheme";
import Svg, { Circle } from "react-native-svg";

const isWeb = Platform.OS === "web";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const GOAL_UNITS = [
  { id: "currency", label: "Earnings ($)", icon: "💰" },
  { id: "hours", label: "Hours Worked", icon: "⏱️" },
  { id: "shifts", label: "Shifts Completed", icon: "🚗" },
  { id: "mileage", label: "Active Distance", icon: "📍" },
] as const;

const GOAL_PERIODS = [
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
  { id: "yearly", label: "Yearly" },
] as const;

function formatCurrency(value: number, country?: string) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: country === "CA" ? "CAD" : "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

// ─── Progress Ring Component ──────────────────────────────────────────────────

function CircularProgress({
  progressPct,
  size = 140,
  strokeWidth = 10,
  color = "#f59e0b",
}: {
  progressPct: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (Math.min(progressPct, 100) / 100) * circumference;

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size}>
        <Circle
          stroke="#262522"
          fill="none"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
        />
        <Circle
          stroke={color}
          fill="none"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          originX={size / 2}
          originY={size / 2}
          rotation="-90"
        />
      </Svg>
      <View style={{ position: "absolute", alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: 32, fontWeight: "900", color: "#ffffff", letterSpacing: -1 }}>
          {Math.round(progressPct)}%
        </Text>
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function GoalsScreen() {
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { profile, isOnboardingCompleted } = useSettingsStore();
  const { accentColor, accentColorContrast } = usePlatformTheme();

  const [isAdding, setIsAdding] = useState(false);
  const [editingGoal, setEditingGoal] = useState<any>(null);
  
  // Form State
  const [label, setLabel] = useState("");
  const [targetValue, setTargetValue] = useState("");
  const [unit, setUnit] = useState<typeof GOAL_UNITS[number]["id"]>("currency");
  const [period, setPeriod] = useState<typeof GOAL_PERIODS[number]["id"]>("weekly");
  const [isSaving, setIsSaving] = useState(false);

  // Data queries
  const { data: goalsList = [], isLoading } = useQuery({
    queryKey: ["goals", "progress"],
    queryFn: () => getGoalsWithProgress(),
    enabled: isOnboardingCompleted,
  });

  const { data: dailyData = [] } = useQuery({
    queryKey: ["analytics", "by-day", "goals"],
    queryFn: () => getEarningsByDay(4), // 4 weeks for streak calc
    enabled: isOnboardingCompleted,
  });

  const { data: bestShift } = useQuery({
    queryKey: ["goals", "best-shift"],
    queryFn: async () => {
      if (isWeb) return { grossRevenue: 250 }; // mock for web
      const res = await db.select().from(shifts).orderBy(desc(shifts.grossRevenue)).limit(1);
      return res[0];
    },
    enabled: isOnboardingCompleted,
  });

  // Derived Gamification Stats
  const weeklyEarningsGoal = goalsList.find((g: any) => g.period === "weekly" && g.unit === "currency");
  
  const streakDays = useMemo(() => {
    let cur = 0;
    dailyData.forEach((d) => {
      if (d.total > 0) cur++;
      else cur = 0;
    });
    return cur;
  }, [dailyData]);

  // Mocked stats to replicate PWA feel until full gamification engine is ported
  const xpTotal = 12450;
  const xpLevel = 12;
  const badgesUnlocked = 4;
  const badgesTotal = 12;

  // Handlers
  const handleOpenForm = (goal?: any) => {
    if (goal) {
      setEditingGoal(goal);
      setLabel(goal.label);
      setTargetValue(goal.targetValue.toString());
      setUnit(goal.unit);
      setPeriod(goal.period);
    } else {
      setEditingGoal(null);
      setLabel("");
      setTargetValue("");
      setUnit("currency");
      setPeriod("weekly");
    }
    setIsAdding(true);
  };

  const handleSaveGoal = async () => {
    const parsedTarget = parseFloat(targetValue);
    if (!label.trim() || isNaN(parsedTarget) || parsedTarget <= 0) {
      Alert.alert("Invalid Input", "Please enter a valid name and target greater than 0.");
      return;
    }

    setIsSaving(true);
    try {
      if (editingGoal) {
        await deleteGoal(editingGoal.id); // Re-insert strategy for edit
      }
      const payload = {
        id: editingGoal ? editingGoal.id : `goal_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        label: label.trim(),
        targetValue: parsedTarget,
        unit,
        period,
        isActive: true,
        createdAt: editingGoal ? editingGoal.createdAt : new Date(),
      };

      await insertGoal(payload);
      queryClient.invalidateQueries({ queryKey: ["goals"] });
      setIsAdding(false);
    } catch (err: any) {
      Alert.alert("Error", "Failed to save goal.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteGoal = (id: string) => {
    const performDelete = async () => {
      await deleteGoal(id);
      queryClient.invalidateQueries({ queryKey: ["goals"] });
    };

    if (isWeb) {
      if (window.confirm("Delete this goal?")) performDelete();
    } else {
      Alert.alert("Delete Goal", "Permanently delete this goal?", [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: performDelete },
      ]);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0d0d0d" }} edges={["bottom", "left", "right"]}>
      {/* ── Screen header ── */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          paddingHorizontal: 20,
          paddingTop: insets.top ? 12 : 20,
          paddingBottom: 16,
          backgroundColor: "#0d0d0d",
        }}
      >
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 8, marginLeft: -8 }}>
          <X size={24} color="#a1a1aa" />
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: "900", color: "#ffffff", letterSpacing: -0.5 }}>
          Gamification & Goals
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120, gap: 20 }}>
        {isLoading ? (
          <View style={{ py: 40, alignItems: "center" }}>
            <ActivityIndicator size="large" color={accentColor} />
          </View>
        ) : (
          <>
            {/* ── Hero Section (Thermometer) ── */}
            {weeklyEarningsGoal && (
              <View
                style={{
                  backgroundColor: "#161615",
                  borderWidth: 1,
                  borderColor: "#262522",
                  borderRadius: 24,
                  padding: 24,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 24,
                  overflow: "hidden",
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 10, fontWeight: "800", color: "#f59e0b", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 6 }}>
                    Weekly Thermometer
                  </Text>
                  <Text style={{ fontSize: 28, fontWeight: "900", color: "#ffffff", letterSpacing: -1, lineHeight: 32, marginBottom: 6 }}>
                    {weeklyEarningsGoal.label}
                  </Text>
                  <Text style={{ fontSize: 13, color: "#71717a", fontWeight: "600", marginBottom: 16 }}>
                    Weekly Target Progress
                  </Text>
                  <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6, marginBottom: 20 }}>
                    <Text style={{ fontSize: 24, fontWeight: "900", color: "#ffffff", letterSpacing: -0.5 }}>
                      {formatCurrency(weeklyEarningsGoal.currentValue, profile.country)}
                    </Text>
                    <Text style={{ fontSize: 16, fontWeight: "700", color: "#52525b" }}>/</Text>
                    <Text style={{ fontSize: 16, fontWeight: "700", color: "#71717a" }}>
                      {formatCurrency(weeklyEarningsGoal.targetValue, profile.country)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleOpenForm(weeklyEarningsGoal)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      backgroundColor: "#262522",
                      alignSelf: "flex-start",
                      paddingHorizontal: 16,
                      paddingVertical: 10,
                      borderRadius: 12,
                    }}
                  >
                    <Edit2 size={14} color="#ffffff" />
                    <Text style={{ fontSize: 12, fontWeight: "800", color: "#ffffff" }}>EDIT TARGET</Text>
                  </TouchableOpacity>
                </View>
                <CircularProgress progressPct={weeklyEarningsGoal.progressPct} color="#f59e0b" />
              </View>
            )}

            {/* ── Bento Grid: Summary Stats ── */}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
              {/* XP & Level */}
              <View style={{ flex: 1, minWidth: "45%", backgroundColor: "#161615", borderWidth: 1, borderColor: "#262522", borderRadius: 20, padding: 16 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <Award size={16} color="#3b82f6" />
                  <Text style={{ fontSize: 12, fontWeight: "800", color: "#71717a", textTransform: "uppercase" }}>Driver XP</Text>
                </View>
                <Text style={{ fontSize: 20, fontWeight: "900", color: "#ffffff", marginBottom: 2 }}>
                  {xpTotal.toLocaleString()} <Text style={{ fontSize: 12, color: "#52525b" }}>XP</Text>
                </Text>
                <View style={{ height: 4, backgroundColor: "#262522", borderRadius: 2, marginVertical: 8 }}>
                  <View style={{ height: "100%", width: "45%", backgroundColor: "#3b82f6", borderRadius: 2 }} />
                </View>
                <Text style={{ fontSize: 11, fontWeight: "700", color: "#a1a1aa" }}>Level {xpLevel}</Text>
              </View>

              {/* Day Streak */}
              <View style={{ flex: 1, minWidth: "45%", backgroundColor: "#161615", borderWidth: 1, borderColor: "#262522", borderRadius: 20, padding: 16 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <Flame size={16} color="#ef4444" />
                  <Text style={{ fontSize: 12, fontWeight: "800", color: "#71717a", textTransform: "uppercase" }}>Day Streak</Text>
                </View>
                <Text style={{ fontSize: 20, fontWeight: "900", color: "#ffffff", marginBottom: 14 }}>
                  {streakDays} <Text style={{ fontSize: 12, color: "#52525b" }}>days</Text>
                </Text>
                <Text style={{ fontSize: 11, fontWeight: "700", color: "#a1a1aa" }}>Active streak</Text>
              </View>

              {/* Badges */}
              <View style={{ flex: 1, minWidth: "45%", backgroundColor: "#161615", borderWidth: 1, borderColor: "#262522", borderRadius: 20, padding: 16 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <Star size={16} color="#8b5cf6" />
                  <Text style={{ fontSize: 12, fontWeight: "800", color: "#71717a", textTransform: "uppercase" }}>Badges</Text>
                </View>
                <Text style={{ fontSize: 20, fontWeight: "900", color: "#ffffff", marginBottom: 14 }}>
                  {badgesUnlocked} <Text style={{ fontSize: 12, color: "#52525b" }}>/ {badgesTotal}</Text>
                </Text>
                <Text style={{ fontSize: 11, fontWeight: "700", color: "#a1a1aa" }}>Unlocked</Text>
              </View>

              {/* Personal Best */}
              <View style={{ flex: 1, minWidth: "45%", backgroundColor: "#161615", borderWidth: 1, borderColor: "#262522", borderRadius: 20, padding: 16 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <TrendingUp size={16} color="#10b981" />
                  <Text style={{ fontSize: 12, fontWeight: "800", color: "#71717a", textTransform: "uppercase" }}>Best Shift</Text>
                </View>
                <Text style={{ fontSize: 20, fontWeight: "900", color: "#ffffff", marginBottom: 14 }}>
                  {formatCurrency(bestShift?.grossRevenue ?? 0, profile.country)}
                </Text>
                <Text style={{ fontSize: 11, fontWeight: "700", color: "#a1a1aa" }}>All-time record</Text>
              </View>
            </View>

            {/* ── Active Goals List ── */}
            <View style={{ backgroundColor: "#161615", borderWidth: 1, borderColor: "#262522", borderRadius: 24, marginTop: 12, overflow: "hidden" }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: "#262522" }}>
                <Text style={{ fontSize: 16, fontWeight: "800", color: "#ffffff" }}>Active Goals</Text>
                <TouchableOpacity
                  onPress={() => handleOpenForm()}
                  style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
                >
                  <Plus size={16} color={accentColor} />
                  <Text style={{ fontSize: 12, fontWeight: "800", color: accentColor, textTransform: "uppercase" }}>Add Goal</Text>
                </TouchableOpacity>
              </View>
              
              <View style={{ padding: 20, gap: 20 }}>
                {goalsList.length === 0 ? (
                  <Text style={{ fontSize: 13, color: "#71717a", fontStyle: "italic", textAlign: "center" }}>
                    No active goals. Set one to start tracking!
                  </Text>
                ) : (
                  goalsList.map((goal: any) => {
                    const unitMeta = GOAL_UNITS.find((u) => u.id === goal.unit);
                    const progressPct = goal.progressPct || 0;

                    return (
                      <View key={goal.id} style={{ gap: 10 }}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                            <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: "#0d0d0d", borderWidth: 1, borderColor: "#262522", alignItems: "center", justifyContent: "center" }}>
                              <Text style={{ fontSize: 16 }}>{unitMeta?.icon}</Text>
                            </View>
                            <View>
                              <Text style={{ fontSize: 14, fontWeight: "800", color: "#ffffff", textTransform: "capitalize" }}>
                                {goal.label}
                              </Text>
                              <Text style={{ fontSize: 11, fontWeight: "700", color: "#71717a", textTransform: "uppercase", marginTop: 2 }}>
                                {goal.period} · {unitMeta?.label}
                              </Text>
                            </View>
                          </View>
                          <View style={{ alignItems: "flex-end", gap: 6 }}>
                            <Text style={{ fontSize: 15, fontWeight: "900", color: "#ffffff" }}>
                              {goal.unit === "currency" ? formatCurrency(goal.targetValue, profile.country) : goal.targetValue}
                            </Text>
                            <View style={{ flexDirection: "row", gap: 8 }}>
                              <TouchableOpacity onPress={() => handleOpenForm(goal)} hitSlop={10}>
                                <Edit2 size={14} color="#a1a1aa" />
                              </TouchableOpacity>
                              <TouchableOpacity onPress={() => handleDeleteGoal(goal.id)} hitSlop={10}>
                                <Trash2 size={14} color="#f43f5e" />
                              </TouchableOpacity>
                            </View>
                          </View>
                        </View>
                        <View style={{ height: 6, backgroundColor: "#0d0d0d", borderRadius: 3, overflow: "hidden" }}>
                          <View style={{ height: "100%", width: `${Math.min(100, progressPct)}%`, backgroundColor: progressPct >= 100 ? "#10b981" : accentColor }} />
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            </View>

            {/* ── Mock Challenges Section ── */}
            <View style={{ backgroundColor: "#161615", borderWidth: 1, borderColor: "#262522", borderRadius: 24, marginTop: 12, padding: 20 }}>
              <Text style={{ fontSize: 16, fontWeight: "800", color: "#ffffff", marginBottom: 20 }}>Challenges</Text>
              <View style={{ gap: 16 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "#0d0d0d", borderWidth: 1, borderColor: "#262522", alignItems: "center", justifyContent: "center" }}>
                    <Target size={20} color="#ec4899" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                      <Text style={{ fontSize: 13, fontWeight: "800", color: "#ffffff" }}>Weekend Warrior</Text>
                      <Text style={{ fontSize: 12, fontWeight: "900", color: "#ec4899" }}>60%</Text>
                    </View>
                    <View style={{ height: 4, backgroundColor: "#0d0d0d", borderRadius: 2 }}>
                      <View style={{ height: "100%", width: "60%", backgroundColor: "#ec4899", borderRadius: 2 }} />
                    </View>
                  </View>
                </View>
              </View>
            </View>
          </>
        )}
      </ScrollView>

      {/* ── Goal Edit Modal ── */}
      <Modal visible={isAdding} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: "#161615", borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: insets.bottom + 24 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <Text style={{ fontSize: 20, fontWeight: "900", color: "#ffffff" }}>
                {editingGoal ? "Edit Goal" : "Create Goal"}
              </Text>
              <TouchableOpacity onPress={() => setIsAdding(false)} style={{ padding: 8, backgroundColor: "#0d0d0d", borderRadius: 20 }}>
                <X size={16} color="#a1a1aa" />
              </TouchableOpacity>
            </View>

            <View style={{ gap: 20 }}>
              <View>
                <Text style={{ fontSize: 10, fontWeight: "800", color: "#71717a", textTransform: "uppercase", marginBottom: 8, marginLeft: 4 }}>Goal Name</Text>
                <TextInput
                  value={label}
                  onChangeText={setLabel}
                  placeholder="e.g. Weekly Gas Budget"
                  placeholderTextColor="#52525b"
                  style={{ backgroundColor: "#0d0d0d", borderWidth: 1, borderColor: "#262522", borderRadius: 16, padding: 16, fontSize: 14, fontWeight: "600", color: "#ffffff" }}
                />
              </View>

              <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 10, fontWeight: "800", color: "#71717a", textTransform: "uppercase", marginBottom: 8, marginLeft: 4 }}>Target Value</Text>
                  <TextInput
                    value={targetValue}
                    onChangeText={setTargetValue}
                    keyboardType="numeric"
                    placeholder="0.00"
                    placeholderTextColor="#52525b"
                    style={{ backgroundColor: "#0d0d0d", borderWidth: 1, borderColor: "#262522", borderRadius: 16, padding: 16, fontSize: 16, fontWeight: "900", color: accentColor }}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 10, fontWeight: "800", color: "#71717a", textTransform: "uppercase", marginBottom: 8, marginLeft: 4 }}>Period</Text>
                  <View style={{ backgroundColor: "#0d0d0d", borderWidth: 1, borderColor: "#262522", borderRadius: 16, padding: 4, flexDirection: "row", height: 56 }}>
                    {GOAL_PERIODS.map((p) => (
                      <TouchableOpacity
                        key={p.id}
                        onPress={() => setPeriod(p.id)}
                        style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: period === p.id ? "#262522" : "transparent", borderRadius: 12 }}
                      >
                        <Text style={{ fontSize: 10, fontWeight: "800", color: period === p.id ? "#ffffff" : "#71717a", textTransform: "uppercase" }}>{p.label.slice(0, 3)}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>

              <View>
                <Text style={{ fontSize: 10, fontWeight: "800", color: "#71717a", textTransform: "uppercase", marginBottom: 8, marginLeft: 4 }}>Metric Type</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {GOAL_UNITS.map((u) => (
                    <TouchableOpacity
                      key={u.id}
                      onPress={() => setUnit(u.id)}
                      style={{ flex: 1, minWidth: "45%", flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: unit === u.id ? accentColor + "20" : "#0d0d0d", borderWidth: 1, borderColor: unit === u.id ? accentColor : "#262522", borderRadius: 16, padding: 16 }}
                    >
                      <Text style={{ fontSize: 16 }}>{u.icon}</Text>
                      <Text style={{ fontSize: 12, fontWeight: "800", color: unit === u.id ? accentColor : "#a1a1aa" }}>{u.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <TouchableOpacity
                onPress={handleSaveGoal}
                disabled={isSaving}
                style={{ backgroundColor: accentColor, borderRadius: 16, padding: 18, alignItems: "center", marginTop: 8 }}
              >
                {isSaving ? <ActivityIndicator color={accentColorContrast} /> : <Text style={{ color: accentColorContrast, fontSize: 14, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1 }}>{editingGoal ? "Save Changes" : "Create Goal"}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
