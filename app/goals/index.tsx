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
import { Award, Flame, Star, TrendingUp, Plus, Edit2, Trash2, X, Target, Shield } from "lucide-react-native";
import { Text } from "@/src/components/ui/text";
import { getGoalsWithProgress, insertGoal, updateGoal, deleteGoal } from "@/src/database/queries/goals";
import { getEarningsByDay } from "@/src/database/queries/analytics";
import { db } from "@/src/database/client";
import { shifts } from "@/src/database/schema";
import { desc } from "drizzle-orm";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useFeatureEnabled } from "@/hooks/useFeatureEnabled";
import { usePlatformTheme } from "@/src/hooks/usePlatformTheme";
import Svg, { Circle } from "react-native-svg";
import { BADGES, type BadgeDefinition } from "@/src/registry/index";
import { BadgeSvg } from "@/src/registry/badges/BadgeSvgs";

const isWeb = Platform.OS === "web";

// ─── Constants ────────────────────────────────────────────────────────────────

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(value: number, country?: string) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: country === "CA" ? "CAD" : "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCurrencyParts(value: number, country?: string) {
  const parts = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: country === "CA" ? "CAD" : "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).formatToParts(value);
  return {
    symbol: parts.find((p) => p.type === "currency")?.value || "$",
    value: parts.filter((p) => p.type !== "currency").map((p) => p.value).join(""),
  };
}

function timeAgo(isoStr: string): string {
  const diff = Date.now() - new Date(isoStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "1d ago";
  return `${days}d ago`;
}

function daysUntilReset(nextResetDate: string | null): number {
  if (!nextResetDate) return 7;
  const diff = new Date(nextResetDate).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86400000));
}

function getStreakMilestone(streakDays: number): { target: number; label: string } {
  if (streakDays < 7) return { target: 7, label: "7-day streak" };
  if (streakDays < 30) return { target: 30, label: "30-day streak" };
  if (streakDays < 100) return { target: 100, label: "100-day streak" };
  return { target: 100, label: "Legend" };
}

function getXpFromNotificationTitle(title: string): string {
  if (title.includes("Badge Unlocked")) return "+40 XP";
  if (title.includes("Challenge Complete")) return "+60 XP";
  if (title.includes("Level Up")) return "Level Up!";
  return "+XP";
}

// ─── Circular Progress ────────────────────────────────────────────────────────

function CircularProgress({
  progressPct,
  size = 140,
  strokeWidth = 10,
  color = "#f59e0b",
  children,
}: {
  progressPct: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  children?: React.ReactNode;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (Math.min(progressPct, 100) / 100) * circumference;
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size}>
        <Circle stroke="#1C1C21" fill="none" cx={size / 2} cy={size / 2} r={radius} strokeWidth={strokeWidth} />
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
        {children}
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function GoalsScreen() {
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const {
    profile,
    isOnboardingCompleted,
    xpTotal,
    xpLevel,
    streakDays,
    streakFrozenCount,
    unlockedBadgeIds,
    challenges,
    notifications,
    isDemoMode,
  } = useSettingsStore();
  const { accentColor, accentColorContrast } = usePlatformTheme();

  const isGoalsEnabled = useFeatureEnabled("goals");
  React.useEffect(() => {
    if (!isGoalsEnabled && isOnboardingCompleted) router.replace("/");
  }, [isGoalsEnabled, isOnboardingCompleted]);
  if (!isGoalsEnabled) return null;

  // ── Tab state ──
  const [activeTab, setActiveTab] = useState(0);

  // ── Goal form state ──
  const [isAdding, setIsAdding] = useState(false);
  const [editingGoal, setEditingGoal] = useState<any>(null);
  const [label, setLabel] = useState("");
  const [targetValue, setTargetValue] = useState("");
  const [unit, setUnit] = useState<typeof GOAL_UNITS[number]["id"]>("currency");
  const [period, setPeriod] = useState<typeof GOAL_PERIODS[number]["id"]>("weekly");
  const [isSaving, setIsSaving] = useState(false);

  // ── Badge detail modal ──
  const [selectedBadge, setSelectedBadge] = useState<BadgeDefinition | null>(null);
  const [showShieldTooltip, setShowShieldTooltip] = useState(false);

  // ── Queries ──
  const { data: goalsList = [], isLoading } = useQuery({
    queryKey: ["goals", "progress"],
    queryFn: () => getGoalsWithProgress(),
    enabled: isOnboardingCompleted,
  });

  useQuery({
    queryKey: ["analytics", "by-day", "goals"],
    queryFn: () => getEarningsByDay(4),
    enabled: isOnboardingCompleted,
  });

  const { data: bestShift } = useQuery({
    queryKey: ["goals", "best-shift"],
    queryFn: async () => {
      if (isWeb) return { grossRevenue: 250 };
      const res = await db.select().from(shifts).orderBy(desc(shifts.grossRevenue)).limit(1);
      return res[0] ?? null;
    },
    enabled: isOnboardingCompleted,
  });

  // ── Derived values ──
  const weeklyEarningsGoal = goalsList.find((g: any) => g.period === "weekly" && g.unit === "currency");
  const badgesUnlocked = unlockedBadgeIds?.length ?? 0;
  const badgesTotal = BADGES.length;

  const sortedBadges = useMemo(
    () =>
      [...BADGES].sort((a, b) => {
        const au = unlockedBadgeIds.includes(a.id);
        const bu = unlockedBadgeIds.includes(b.id);
        return au === bu ? 0 : au ? -1 : 1;
      }),
    [unlockedBadgeIds]
  );

  const recentXpNotifications = useMemo(
    () => notifications.filter((n) => n.type === "success").slice(0, 4),
    [notifications]
  );

  const streakMilestone = getStreakMilestone(streakDays);
  const streakPct = streakDays >= 100 ? 100 : (streakDays / streakMilestone.target) * 100;

  // ── Handlers ──
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
    if (isDemoMode) {
      Alert.alert("Demo Mode Active", "Turn off Demo Mode in Settings to manage goals.", [
        { text: "Go to Settings", onPress: () => router.push("/settings") },
        { text: "Cancel", style: "cancel" },
      ]);
      return;
    }
    const parsedTarget = parseFloat(targetValue);
    if (!label.trim() || isNaN(parsedTarget) || parsedTarget <= 0) {
      Alert.alert("Invalid Input", "Please enter a valid name and target greater than 0.");
      return;
    }
    setIsSaving(true);
    try {
      if (editingGoal) {
        await updateGoal(editingGoal.id, {
          label: label.trim(),
          targetValue: parsedTarget,
          unit,
          period,
          isActive: true,
        });
      } else {
        await insertGoal({
          id: `goal_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          label: label.trim(),
          targetValue: parsedTarget,
          unit,
          period,
          isActive: true,
          createdAt: new Date(),
        });
      }
      queryClient.invalidateQueries({ queryKey: ["goals"] });
      setIsAdding(false);
    } catch {
      Alert.alert("Error", "Failed to save goal.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteGoal = (id: string) => {
    if (isDemoMode) {
      Alert.alert("Demo Mode Active", "Turn off Demo Mode in Settings to manage goals.", [
        { text: "Go to Settings", onPress: () => router.push("/settings") },
        { text: "Cancel", style: "cancel" },
      ]);
      return;
    }
    const doDelete = async () => {
      await deleteGoal(id);
      queryClient.invalidateQueries({ queryKey: ["goals"] });
    };
    if (isWeb) {
      if (window.confirm("Delete this goal?")) doDelete();
    } else {
      Alert.alert("Delete Goal", "Permanently delete this goal?", [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: doDelete },
      ]);
    }
  };

  // ── Tab content ──

  const GoalsTab = (
    <>
      {/* Weekly thermometer hero */}
      {weeklyEarningsGoal && (
        <View
          style={{
            backgroundColor: "#0F0F12",
            borderWidth: 0.8,
            borderColor: "#1E1E23",
            borderRadius: 20,
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
            <Text style={{ fontSize: 24, fontWeight: "900", color: "#F6F6F7", letterSpacing: -0.5, lineHeight: 28, marginBottom: 6 }}>
              {weeklyEarningsGoal.label}
            </Text>
            <Text style={{ fontSize: 12, color: "#9B9BA4", fontWeight: "600", marginBottom: 14 }}>
              Weekly Target Progress
            </Text>
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 4, marginBottom: 18 }}>
              <Text style={{ fontSize: 22, fontWeight: "600", color: "#F6F6F7", lineHeight: 28, marginTop: 8 }}>
                {formatCurrencyParts(weeklyEarningsGoal.currentValue, profile.country).symbol}
              </Text>
              <Text
                style={{ flexShrink: 1, fontSize: 38, fontWeight: "800", color: "#F6F6F7", letterSpacing: -0.5, lineHeight: 46, includeFontPadding: false }}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {formatCurrencyParts(weeklyEarningsGoal.currentValue, profile.country).value}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => handleOpenForm(weeklyEarningsGoal)}
              style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#1C1C21", alignSelf: "flex-start", paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12 }}
            >
              <Edit2 size={13} color="#F6F6F7" />
              <Text style={{ fontSize: 11, fontWeight: "800", color: "#F6F6F7" }}>EDIT TARGET</Text>
            </TouchableOpacity>
          </View>
          <CircularProgress progressPct={weeklyEarningsGoal.progressPct} color="#f59e0b">
            <Text style={{ fontSize: 28, fontWeight: "800", color: "#F6F6F7", letterSpacing: -0.5, lineHeight: 34, includeFontPadding: false }} adjustsFontSizeToFit numberOfLines={1}>
              {Math.round(weeklyEarningsGoal.progressPct)}%
            </Text>
          </CircularProgress>
        </View>
      )}

      {/* Active goals list */}
      <View style={{ backgroundColor: "#0F0F12", borderWidth: 0.8, borderColor: "#1E1E23", borderRadius: 20, overflow: "hidden" }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 0.8, borderBottomColor: "#1E1E23" }}>
          <Text style={{ fontSize: 16, fontWeight: "800", color: "#F6F6F7" }}>
            {weeklyEarningsGoal ? "Other Active Goals" : "Active Goals"}
          </Text>
          <TouchableOpacity onPress={() => handleOpenForm()} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Plus size={16} color={accentColor} />
            <Text style={{ fontSize: 12, fontWeight: "800", color: accentColor, textTransform: "uppercase" }}>Add</Text>
          </TouchableOpacity>
        </View>

        <View style={{ padding: 20, gap: 20 }}>
          {goalsList.filter((g: any) => g.id !== weeklyEarningsGoal?.id).length === 0 ? (
            <Text style={{ fontSize: 13, color: "#9B9BA4", fontStyle: "italic", textAlign: "center" }}>
              No other active goals. Tap Add to create one.
            </Text>
          ) : (
            goalsList
              .filter((g: any) => g.id !== weeklyEarningsGoal?.id)
              .map((goal: any) => {
                const unitMeta = GOAL_UNITS.find((u) => u.id === goal.unit);
                const pct = goal.progressPct || 0;
                return (
                  <View key={goal.id} style={{ gap: 10 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                        <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: "#16161A", borderWidth: 1, borderColor: "#1C1C21", alignItems: "center", justifyContent: "center" }}>
                          <Text style={{ fontSize: 16 }}>{unitMeta?.icon}</Text>
                        </View>
                        <View>
                          <Text style={{ fontSize: 14, fontWeight: "800", color: "#F6F6F7", textTransform: "capitalize" }}>{goal.label}</Text>
                          <Text style={{ fontSize: 11, fontWeight: "700", color: "#9B9BA4", textTransform: "uppercase", marginTop: 2 }}>
                            {goal.period} · {unitMeta?.label}
                          </Text>
                        </View>
                      </View>
                      <View style={{ alignItems: "flex-end", gap: 6 }}>
                        <Text style={{ fontSize: 14, fontWeight: "900", color: "#F6F6F7" }}>
                          {goal.unit === "currency" ? formatCurrency(goal.targetValue, profile.country) : goal.targetValue}
                        </Text>
                        <View style={{ flexDirection: "row", gap: 8 }}>
                          <TouchableOpacity onPress={() => handleOpenForm(goal)} hitSlop={10}>
                            <Edit2 size={14} color="#9B9BA4" />
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => handleDeleteGoal(goal.id)} hitSlop={10}>
                            <Trash2 size={14} color="#FF5247" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                    <View style={{ height: 5, backgroundColor: "#1E1E23", borderRadius: 3, overflow: "hidden" }}>
                      <View style={{ height: "100%", width: `${Math.min(100, pct)}%`, backgroundColor: pct >= 100 ? "#22c55e" : accentColor }} />
                    </View>
                  </View>
                );
              })
          )}
        </View>
      </View>
    </>
  );

  const ProgressTab = (
    <>
      {/* XP & Level card */}
      <View style={{ backgroundColor: "#0F0F12", borderWidth: 0.8, borderColor: "#1E1E23", borderRadius: 20, padding: 20 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Award size={16} color="#3b82f6" />
            <Text style={{ fontSize: 12, fontWeight: "800", color: "#9B9BA4", textTransform: "uppercase" }}>Driver XP</Text>
          </View>
          <View style={{ backgroundColor: "#1e3a8a22", borderWidth: 1, borderColor: "#3b82f640", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
            <Text style={{ fontSize: 11, fontWeight: "900", color: "#3b82f6" }}>LVL {xpLevel}</Text>
          </View>
        </View>

        <Text style={{ fontSize: 34, fontWeight: "800", color: "#F6F6F7", letterSpacing: -0.5, lineHeight: 40, includeFontPadding: false, marginBottom: 4 }} adjustsFontSizeToFit numberOfLines={1}>
          {xpTotal.toLocaleString()} <Text style={{ fontSize: 16, color: "#65656E", fontWeight: "600" }}>XP</Text>
        </Text>

        <View style={{ height: 5, backgroundColor: "#1E1E23", borderRadius: 3, marginVertical: 10, overflow: "hidden" }}>
          <View style={{ height: "100%", width: `${xpTotal % 100}%`, backgroundColor: "#3b82f6", borderRadius: 3 }} />
        </View>
        <Text style={{ fontSize: 11, fontWeight: "700", color: "#65656E" }}>{100 - (xpTotal % 100)} XP to Level {xpLevel + 1}</Text>

        {/* Recent XP events */}
        {recentXpNotifications.length > 0 && (
          <View style={{ marginTop: 16, gap: 10, borderTopWidth: 0.8, borderTopColor: "#1E1E23", paddingTop: 14 }}>
            {recentXpNotifications.map((n) => (
              <View key={n.id} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={{ fontSize: 12, color: "#9B9BA4", flex: 1 }} numberOfLines={1}>{n.title}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <Text style={{ fontSize: 11, fontWeight: "800", color: "#3b82f6" }}>{getXpFromNotificationTitle(n.title)}</Text>
                  <Text style={{ fontSize: 10, color: "#65656E" }}>{timeAgo(n.createdAt)}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Streak card */}
      <View style={{ backgroundColor: "#0F0F12", borderWidth: 0.8, borderColor: "#1E1E23", borderRadius: 20, padding: 20 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 20 }}>
          <Flame size={16} color="#FF5247" />
          <Text style={{ fontSize: 12, fontWeight: "800", color: "#9B9BA4", textTransform: "uppercase" }}>Day Streak</Text>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 20 }}>
          <CircularProgress progressPct={streakPct} size={110} strokeWidth={8} color="#FF5247">
            <Text style={{ fontSize: 26, fontWeight: "800", color: "#F6F6F7", lineHeight: 32, includeFontPadding: false }}>{streakDays}</Text>
            <Text style={{ fontSize: 10, fontWeight: "700", color: "#9B9BA4" }}>days</Text>
          </CircularProgress>

          <View style={{ flex: 1, gap: 12 }}>
            <View>
              <Text style={{ fontSize: 10, fontWeight: "800", color: "#65656E", textTransform: "uppercase", marginBottom: 4 }}>Next milestone</Text>
              <Text style={{ fontSize: 13, fontWeight: "800", color: "#F6F6F7" }}>
                {streakDays >= 100 ? "Legend 🏆" : `${streakMilestone.target - streakDays} days to ${streakMilestone.label}`}
              </Text>
            </View>

            {/* Shield row */}
            <Pressable onPress={() => setShowShieldTooltip(true)} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              {Array.from({ length: Math.min(3, Math.max(0, streakFrozenCount)) }).map((_, i) => (
                <Shield key={i} size={18} color="#6366f1" fill="#6366f130" />
              ))}
              {Array.from({ length: Math.max(0, 3 - streakFrozenCount) }).map((_, i) => (
                <Shield key={`empty-${i}`} size={18} color="#2E2E36" />
              ))}
              <Text style={{ fontSize: 11, fontWeight: "700", color: "#6366f1", marginLeft: 2 }}>
                {streakFrozenCount}/3 shields
              </Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* Challenges section */}
      <View style={{ backgroundColor: "#0F0F12", borderWidth: 0.8, borderColor: "#1E1E23", borderRadius: 20, padding: 20 }}>
        <Text style={{ fontSize: 16, fontWeight: "800", color: "#F6F6F7", marginBottom: 18 }}>Weekly Challenges</Text>
        <View style={{ gap: 16 }}>
          {challenges && challenges.length > 0 ? (
            challenges.map((c) => {
              const pct = Math.min(100, Math.round((c.current / c.target) * 100));
              const isCompleted = !!c.completedAt;
              const resetDays = daysUntilReset(c.nextResetDate ?? null);
              return (
                <View key={c.id}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 }}>
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: isCompleted ? "#052e1640" : "#0F0F12",
                        borderWidth: 1,
                        borderColor: isCompleted ? "#22c55e40" : "#1C1C21",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Target size={18} color={isCompleted ? "#22c55e" : "#ec4899"} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 3 }}>
                        <Text style={{ fontSize: 13, fontWeight: "800", color: "#F6F6F7" }}>{c.name}</Text>
                        <Text style={{ fontSize: 12, fontWeight: "900", color: isCompleted ? "#22c55e" : "#ec4899" }}>
                          {isCompleted ? "✓ Done" : `${pct}%`}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 11, color: "#9B9BA4" }}>{c.description}</Text>
                    </View>
                  </View>
                  <View style={{ height: 4, backgroundColor: "#1E1E23", borderRadius: 2, overflow: "hidden", marginBottom: 6 }}>
                    <View style={{ height: "100%", width: `${pct}%`, backgroundColor: isCompleted ? "#22c55e" : "#ec4899", borderRadius: 2 }} />
                  </View>
                  <Text style={{ fontSize: 10, fontWeight: "700", color: "#65656E" }}>
                    {isCompleted ? `Resets in ${resetDays} day${resetDays === 1 ? "" : "s"}` : `${resetDays} day${resetDays === 1 ? "" : "s"} remaining`}
                  </Text>
                </View>
              );
            })
          ) : (
            <Text style={{ fontSize: 13, color: "#9B9BA4", fontStyle: "italic" }}>No active challenges.</Text>
          )}
        </View>
      </View>

      {/* Badges grid */}
      <View style={{ backgroundColor: "#0F0F12", borderWidth: 0.8, borderColor: "#1E1E23", borderRadius: 20, padding: 20 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Star size={16} color="#8b5cf6" />
            <Text style={{ fontSize: 16, fontWeight: "800", color: "#F6F6F7" }}>Driver Badges</Text>
          </View>
          <Text style={{ fontSize: 12, fontWeight: "700", color: "#9B9BA4" }}>{badgesUnlocked} / {badgesTotal}</Text>
        </View>

        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {sortedBadges.map((badge) => {
            const isUnlocked = unlockedBadgeIds.includes(badge.id);
            return (
              <View key={badge.id} style={{ width: "25%", padding: 4 }}>
                <Pressable
                  onPress={() => setSelectedBadge(badge)}
                  style={{
                    aspectRatio: 1,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: isUnlocked ? "#ffffff08" : "#0a0a0a",
                    borderWidth: 1,
                    borderColor: isUnlocked ? "#ffffff18" : "#1E1E23",
                    borderRadius: 14,
                  }}
                >
                  <BadgeSvg id={badge.id} size={36} locked={!isUnlocked} />
                </Pressable>
              </View>
            );
          })}
        </View>

        <Text style={{ fontSize: 11, color: "#65656E", textAlign: "center", marginTop: 14, fontStyle: "italic" }}>
          Tap a badge to see details
        </Text>
      </View>

      {/* Best shift stat */}
      <TouchableOpacity
        onPress={() => {
          if (bestShift?.id) {
            router.push({ pathname: "/shifts/[id]", params: { id: bestShift.id, from: "goals" } });
          }
        }}
        activeOpacity={0.7}
        style={{ backgroundColor: "#0F0F12", borderWidth: 0.8, borderColor: "#1E1E23", borderRadius: 20, padding: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <TrendingUp size={18} color={accentColor} />
          <View>
            <Text style={{ fontSize: 11, fontWeight: "800", color: "#9B9BA4", textTransform: "uppercase" }}>Best Shift — All Time</Text>
            <Text style={{ fontSize: 22, fontWeight: "900", color: "#F6F6F7", letterSpacing: -0.5, marginTop: 2, includeFontPadding: false } as any}>
              {formatCurrency(bestShift?.grossRevenue ?? 0, profile.country)}
            </Text>
          </View>
        </View>
        <Text style={{ fontSize: 18, color: "#65656E" }}>›</Text>
      </TouchableOpacity>
    </>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#000" }} edges={["bottom", "left", "right"]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120, paddingTop: insets.top ? insets.top + 16 : 36 }}>
        {/* Header */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingBottom: 16 }}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "#16161A", borderWidth: 0.8, borderColor: "#1C1C21", alignItems: "center", justifyContent: "center", marginLeft: -8 }}
          >
            <X size={22} color="#F6F6F7" />
          </TouchableOpacity>
          <Text style={{ fontSize: 17, fontWeight: "900", color: "#F6F6F7", letterSpacing: -0.3 }}>Goals & Progress</Text>
          <View style={{ width: 44 }} />
        </View>

        {/* Tab switcher */}
        <View style={{ flexDirection: "row", marginHorizontal: 16, marginBottom: 20, backgroundColor: "#16161A", borderRadius: 14, padding: 4, borderWidth: 0.8, borderColor: "#1C1C21" }}>
          {(["Goals", "Progress"] as const).map((tab, i) => (
            <Pressable
              key={tab}
              onPress={() => setActiveTab(i)}
              style={{
                flex: 1,
                paddingVertical: 10,
                alignItems: "center",
                backgroundColor: activeTab === i ? "#1C1C21" : "transparent",
                borderRadius: 10,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: "800", color: activeTab === i ? "#F6F6F7" : "#9B9BA4" }}>{tab}</Text>
            </Pressable>
          ))}
        </View>

        {/* Tab content */}
        {isLoading ? (
          <View style={{ paddingVertical: 60, alignItems: "center" }}>
            <ActivityIndicator size="large" color={accentColor} />
          </View>
        ) : (
          <View style={{ paddingHorizontal: 16, gap: 16 }}>
            {activeTab === 0 ? GoalsTab : ProgressTab}
          </View>
        )}
      </ScrollView>

      {/* ── Goal Edit Modal ── */}
      <Modal visible={isAdding} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: "#16161A", borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: insets.bottom + 24 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <Text style={{ fontSize: 20, fontWeight: "900", color: "#F6F6F7" }}>
                {editingGoal ? "Edit Goal" : "Create Goal"}
              </Text>
              <TouchableOpacity onPress={() => setIsAdding(false)} style={{ padding: 8, backgroundColor: "#0F0F12", borderRadius: 20 }}>
                <X size={16} color="#9B9BA4" />
              </TouchableOpacity>
            </View>

            <View style={{ gap: 20 }}>
              <View>
                <Text style={{ fontSize: 10, fontWeight: "800", color: "#9B9BA4", textTransform: "uppercase", marginBottom: 8, marginLeft: 4 }}>Goal Name</Text>
                <TextInput
                  value={label}
                  onChangeText={setLabel}
                  placeholder="e.g. Weekly Revenue Target"
                  placeholderTextColor="#65656E"
                  style={{ backgroundColor: "#0F0F12", borderWidth: 1, borderColor: "#1C1C21", borderRadius: 16, padding: 16, fontSize: 14, fontWeight: "600", color: "#F6F6F7" }}
                />
              </View>

              <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 10, fontWeight: "800", color: "#9B9BA4", textTransform: "uppercase", marginBottom: 8, marginLeft: 4 }}>Target Value</Text>
                  <TextInput
                    value={targetValue}
                    onChangeText={setTargetValue}
                    keyboardType="numeric"
                    placeholder="0.00"
                    placeholderTextColor="#65656E"
                    style={{ backgroundColor: "#0F0F12", borderWidth: 1, borderColor: "#1C1C21", borderRadius: 16, padding: 16, fontSize: 16, fontWeight: "900", color: accentColor }}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 10, fontWeight: "800", color: "#9B9BA4", textTransform: "uppercase", marginBottom: 8, marginLeft: 4 }}>Period</Text>
                  <View style={{ backgroundColor: "#0F0F12", borderWidth: 1, borderColor: "#1C1C21", borderRadius: 16, padding: 4, flexDirection: "row", height: 56 }}>
                    {GOAL_PERIODS.map((p) => (
                      <TouchableOpacity
                        key={p.id}
                        onPress={() => setPeriod(p.id)}
                        style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: period === p.id ? "#1C1C21" : "transparent", borderRadius: 12 }}
                      >
                        <Text style={{ fontSize: 10, fontWeight: "800", color: period === p.id ? "#F6F6F7" : "#9B9BA4", textTransform: "uppercase" }}>
                          {p.label.slice(0, 3)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>

              <View>
                <Text style={{ fontSize: 10, fontWeight: "800", color: "#9B9BA4", textTransform: "uppercase", marginBottom: 8, marginLeft: 4 }}>Metric Type</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {GOAL_UNITS.map((u) => (
                    <TouchableOpacity
                      key={u.id}
                      onPress={() => setUnit(u.id)}
                      style={{ flex: 1, minWidth: "45%", flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: unit === u.id ? accentColor + "20" : "#0F0F12", borderWidth: 1, borderColor: unit === u.id ? accentColor : "#1C1C21", borderRadius: 16, padding: 16 }}
                    >
                      <Text style={{ fontSize: 16 }}>{u.icon}</Text>
                      <Text style={{ fontSize: 12, fontWeight: "800", color: unit === u.id ? accentColor : "#9B9BA4" }}>{u.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <TouchableOpacity
                onPress={handleSaveGoal}
                disabled={isSaving}
                style={{ backgroundColor: accentColor, borderRadius: 16, padding: 18, alignItems: "center", marginTop: 8 }}
              >
                {isSaving ? (
                  <ActivityIndicator color={accentColorContrast} />
                ) : (
                  <Text style={{ color: accentColorContrast, fontSize: 14, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1 }}>
                    {editingGoal ? "Save Changes" : "Create Goal"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Badge Detail Modal ── */}
      <Modal visible={!!selectedBadge} transparent animationType="fade">
        <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "center", alignItems: "center", paddingHorizontal: 24 }} onPress={() => setSelectedBadge(null)}>
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View style={{ backgroundColor: "#16161A", borderRadius: 24, padding: 32, alignItems: "center", gap: 12, borderWidth: 0.8, borderColor: "#1C1C21", minWidth: 280 }}>
              {selectedBadge && (
                <BadgeSvg
                  id={selectedBadge.id}
                  size={72}
                  locked={!unlockedBadgeIds.includes(selectedBadge.id)}
                />
              )}
              <Text style={{ fontSize: 20, fontWeight: "900", color: "#F6F6F7", textAlign: "center" }}>{selectedBadge?.name}</Text>
              <Text style={{ fontSize: 13, color: "#9B9BA4", textAlign: "center", lineHeight: 20 }}>{selectedBadge?.description}</Text>

              {selectedBadge && unlockedBadgeIds.includes(selectedBadge.id) ? (
                <View style={{ backgroundColor: "#052e1640", borderWidth: 1, borderColor: "#22c55e40", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 6, marginTop: 4 }}>
                  <Text style={{ fontSize: 12, fontWeight: "800", color: "#22c55e" }}>✓ UNLOCKED</Text>
                </View>
              ) : (
                <View style={{ backgroundColor: "#16161A", borderWidth: 1, borderColor: "#1C1C21", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 6, marginTop: 4 }}>
                  <Text style={{ fontSize: 12, fontWeight: "800", color: "#9B9BA4" }}>LOCKED</Text>
                </View>
              )}

              <TouchableOpacity onPress={() => setSelectedBadge(null)} style={{ marginTop: 8, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: "#1C1C21", borderRadius: 14 }}>
                <Text style={{ fontSize: 13, fontWeight: "800", color: "#F6F6F7" }}>Close</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Shield Tooltip Modal ── */}
      <Modal visible={showShieldTooltip} transparent animationType="fade">
        <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.8)", justifyContent: "center", alignItems: "center", paddingHorizontal: 32 }} onPress={() => setShowShieldTooltip(false)}>
          <View style={{ backgroundColor: "#16161A", borderRadius: 20, padding: 24, gap: 10, borderWidth: 0.8, borderColor: "#1C1C21" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <Shield size={20} color="#6366f1" />
              <Text style={{ fontSize: 16, fontWeight: "900", color: "#F6F6F7" }}>Streak Shields</Text>
            </View>
            <Text style={{ fontSize: 13, color: "#9B9BA4", lineHeight: 20 }}>
              A shield lets you skip one day without breaking your streak. You earn 1 shield per level-up and 1 per calendar month, up to a maximum of 3.
            </Text>
            <Text style={{ fontSize: 13, color: "#9B9BA4", lineHeight: 20 }}>
              You currently have <Text style={{ color: "#6366f1", fontWeight: "800" }}>{streakFrozenCount} shield{streakFrozenCount !== 1 ? "s" : ""}</Text> remaining.
            </Text>
            <TouchableOpacity onPress={() => setShowShieldTooltip(false)} style={{ marginTop: 8, paddingVertical: 12, backgroundColor: "#1C1C21", borderRadius: 14, alignItems: "center" }}>
              <Text style={{ fontSize: 13, fontWeight: "800", color: "#F6F6F7" }}>Got it</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
