import React, { useState } from "react";
import {
ScrollView,
View,
TouchableOpacity,
ActivityIndicator,
Alert,
Platform,
TextInput,
Modal, StyleSheet
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Plus, Edit2, Trash2, X } from "lucide-react-native";
import { Text } from "@/src/components/ui/text";
import { Card } from "@/src/components/ui/card";
import { EmptyState } from "@/src/components/ui/EmptyState";
import { KPI, withAlpha } from "@/src/theme/colors";
import { useColors } from "@/src/theme/useColors";
import { getGoalsWithProgress, insertGoal, updateGoal, deleteGoal } from "@/src/database/queries/goals";
import { markActivationDone } from "@/src/services/onboarding/activationChecklist";
import { useSettingsStore } from "@/store/useSettingsStore";
import { usePlatformTheme } from "@/src/hooks/usePlatformTheme";
import { useLayout } from "@/src/hooks/useLayout";
import Svg, { Circle } from "react-native-svg";

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

// ─── Circular Progress ────────────────────────────────────────────────────────

function CircularProgress({
  progressPct,
  size = 140,
  strokeWidth = 10,
  color = KPI.rate,
  children,
}: {
  progressPct: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  children?: React.ReactNode;
}) {
  const C = useColors();
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;

  /*
   * Clamp, and treat a non-finite progress as zero.
   *
   * `progressPct` is typed `number`, but it arrives from a database row, and a
   * goal with no target divides by zero. A NaN reaches the SVG as
   * stroke-dashoffset="NaN", which is not a valid length — react-native-svg
   * rejects it and the whole screen throws rather than drawing an empty ring.
   * A goal we cannot compute should read as 0%, not take the page down.
   */
  const pct = Number.isFinite(progressPct) ? Math.min(Math.max(progressPct, 0), 100) : 0;
  const strokeDashoffset = circumference - (pct / 100) * circumference;

  return (
    <View
      style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}
      accessible={true}
      accessibilityLabel={`${Math.round(pct)}% complete`}
    >
      <Svg width={size} height={size}>
        <Circle stroke={C.surface04} fill="none" cx={size / 2} cy={size / 2} r={radius} strokeWidth={strokeWidth} />
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
  const C = useColors();
  const { profile, isOnboardingCompleted, isDemoMode } = useSettingsStore();
  const { accentColor, accentColorContrast } = usePlatformTheme();
  const { columnStyle, dialogStyle } = useLayout();

  // ── Goal form state ──
  const [isAdding, setIsAdding] = useState(false);
  const [editingGoal, setEditingGoal] = useState<any>(null);
  const [label, setLabel] = useState("");
  const [targetValue, setTargetValue] = useState("");
  const [unit, setUnit] = useState<typeof GOAL_UNITS[number]["id"]>("currency");
  const [period, setPeriod] = useState<typeof GOAL_PERIODS[number]["id"]>("weekly");
  const [isSaving, setIsSaving] = useState(false);

  // ── Queries ──
  const { data: goalsList = [], isLoading } = useQuery({
    queryKey: ["goals", "progress"],
    queryFn: () => getGoalsWithProgress(),
    enabled: isOnboardingCompleted,
  });

  // ── Derived values ──
  const weeklyEarningsGoal = goalsList.find((g: any) => g.period === "weekly" && g.unit === "currency");
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
    // Ticks the dashboard's "Set a weekly goal" item. Recorded on save rather than inferred from
    // the value, so a driver who deliberately keeps the seeded 500 still completes it.
    void markActivationDone("goal");
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
        <Card className="flex-row items-center gap-6 overflow-hidden p-6">
          <View style={{ flex: 1 }}>
            <Text variant="labelXs" style={{ color: KPI.rate, marginBottom: 6 }}>
              Weekly Thermometer
            </Text>
            <Text variant="headingL" style={{ marginBottom: 6 }}>
              {weeklyEarningsGoal.label}
            </Text>
            <Text variant="paragraphS" style={{ color: C.contentSecondary, marginBottom: 14 }}>
              Weekly Target Progress
            </Text>
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 4, marginBottom: 18 }}>
              <Text style={{ fontSize: 22, fontWeight: "600", color: C.contentPrimary, lineHeight: 28, marginTop: 8 }}>
                {formatCurrencyParts(weeklyEarningsGoal.currentValue, profile.country).symbol}
              </Text>
              <Text
                tabular
                style={{ flexShrink: 1, fontSize: 38, fontWeight: "800", color: C.contentPrimary, letterSpacing: -0.5, lineHeight: 46, includeFontPadding: false }}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {formatCurrencyParts(weeklyEarningsGoal.currentValue, profile.country).value}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => handleOpenForm(weeklyEarningsGoal)}
              accessibilityRole="button"
              style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.surface04, alignSelf: "flex-start", paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12 }}
            >
              <Edit2 size={13} color={C.contentPrimary} />
              <Text variant="labelXs">EDIT TARGET</Text>
            </TouchableOpacity>
          </View>
          <CircularProgress progressPct={weeklyEarningsGoal.progressPct} color={KPI.rate}>
            <Text variant="headingXl" tabular style={{ includeFontPadding: false }} adjustsFontSizeToFit numberOfLines={1}>
              {Math.round(weeklyEarningsGoal.progressPct)}%
            </Text>
          </CircularProgress>
        </Card>
      )}

      {/* Active goals list */}
      <Card className="overflow-hidden p-0">
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.lineSubtle }}>
          <Text variant="headingS">
            {weeklyEarningsGoal ? "Other Active Goals" : "Active Goals"}
          </Text>
          <TouchableOpacity
            onPress={() => handleOpenForm()}
            accessibilityRole="button"
            accessibilityLabel="Add goal"
            hitSlop={8}
            style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
          >
            <Plus size={16} color={accentColor} />
            <Text variant="labelXs" style={{ color: accentColor }}>Add</Text>
          </TouchableOpacity>
        </View>

        <View style={{ padding: 20, gap: 20 }}>
          {goalsList.filter((g: any) => g.id !== weeklyEarningsGoal?.id).length === 0 ? (
            <EmptyState
              icon="target"
              title="No other active goals"
              message="Tap Add to create one."
              className="py-2"
            />
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
                        <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: C.surface03, borderWidth: 1, borderColor: C.lineSubtle, alignItems: "center", justifyContent: "center" }}>
                          <Text style={{ fontSize: 16 }}>{unitMeta?.icon}</Text>
                        </View>
                        <View>
                          <Text variant="labelM" style={{ textTransform: "capitalize" }}>{goal.label}</Text>
                          <Text variant="labelXs" style={{ color: C.contentSecondary, marginTop: 2 }}>
                            {goal.period} · {unitMeta?.label}
                          </Text>
                        </View>
                      </View>
                      <View style={{ alignItems: "flex-end", gap: 6 }}>
                        <Text variant="labelM" tabular>
                          {goal.unit === "currency" ? formatCurrency(goal.targetValue, profile.country) : goal.targetValue}
                        </Text>
                        <View style={{ flexDirection: "row", gap: 8 }}>
                          <TouchableOpacity
                            onPress={() => handleOpenForm(goal)}
                            hitSlop={10}
                            accessibilityRole="button"
                            accessibilityLabel="Edit goal"
                          >
                            <Edit2 size={14} color={C.contentSecondary} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => handleDeleteGoal(goal.id)}
                            hitSlop={10}
                            accessibilityRole="button"
                            accessibilityLabel="Delete goal"
                          >
                            <Trash2 size={14} color={C.destructive} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                    <View
                      style={{ height: 5, backgroundColor: C.lineSubtle, borderRadius: 3, overflow: "hidden" }}
                      accessible={true}
                      accessibilityLabel={`${Math.round(Math.min(100, pct))}% of goal reached`}
                    >
                      <View style={{ height: "100%", width: `${Math.min(100, pct)}%`, backgroundColor: pct >= 100 ? C.success : accentColor }} />
                    </View>
                  </View>
                );
              })
          )}
        </View>
      </Card>
    </>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.background }} edges={["bottom", "left", "right"]}>
      <ScrollView contentContainerStyle={[{ paddingBottom: 120, paddingTop: insets.top ? insets.top + 16 : 36 }, columnStyle]}>
        {/* Header */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingBottom: 16 }}>
          <TouchableOpacity
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.surface03, borderWidth: StyleSheet.hairlineWidth, borderColor: C.lineSubtle, alignItems: "center", justifyContent: "center", marginLeft: -8 }}
          >
            <X size={22} color={C.contentPrimary} />
          </TouchableOpacity>
          <Text variant="headingS">Goals</Text>
          <View style={{ width: 44 }} />
        </View>

        {isLoading ? (
          <View style={{ paddingVertical: 60, alignItems: "center" }}>
            <ActivityIndicator size="large" color={accentColor} />
          </View>
        ) : (
          <View style={{ paddingHorizontal: 16, gap: 16 }}>
            {GoalsTab}
          </View>
        )}
      </ScrollView>

      {/* ── Goal Edit Modal ── */}
      <Modal visible={isAdding} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: C.scrim, justifyContent: "flex-end" }}>
          <View style={[{ backgroundColor: C.surface03, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: insets.bottom + 24 }, dialogStyle]}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <Text variant="headingM">
                {editingGoal ? "Edit Goal" : "Create Goal"}
              </Text>
              <TouchableOpacity
                onPress={() => setIsAdding(false)}
                accessibilityRole="button"
                accessibilityLabel="Close"
                hitSlop={8}
                style={{ padding: 8, backgroundColor: C.surface02, borderRadius: 20 }}
              >
                <X size={16} color={C.contentSecondary} />
              </TouchableOpacity>
            </View>

            <View style={{ gap: 20 }}>
              <View>
                <Text variant="labelXs" style={{ color: C.contentSecondary, marginBottom: 8, marginLeft: 4 }}>Goal Name</Text>
                <TextInput
                  value={label}
                  onChangeText={setLabel}
                  placeholder="e.g. Weekly Revenue Target"
                  placeholderTextColor={C.contentMuted}
                  style={{ backgroundColor: C.surface02, borderWidth: 1, borderColor: C.lineSubtle, borderRadius: 16, padding: 16, fontSize: 14, fontWeight: "600", color: C.contentPrimary }}
                />
              </View>

              <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text variant="labelXs" style={{ color: C.contentSecondary, marginBottom: 8, marginLeft: 4 }}>Target Value</Text>
                  <TextInput
                    value={targetValue}
                    onChangeText={setTargetValue}
                    keyboardType="numeric"
                    placeholder="0.00"
                    placeholderTextColor={C.contentMuted}
                    style={{ backgroundColor: C.surface02, borderWidth: 1, borderColor: C.lineSubtle, borderRadius: 16, padding: 16, fontSize: 16, fontWeight: "900", color: accentColor }}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="labelXs" style={{ color: C.contentSecondary, marginBottom: 8, marginLeft: 4 }}>Period</Text>
                  <View style={{ backgroundColor: C.surface02, borderWidth: 1, borderColor: C.lineSubtle, borderRadius: 16, padding: 4, flexDirection: "row", height: 56 }}>
                    {GOAL_PERIODS.map((p) => (
                      <TouchableOpacity
                        key={p.id}
                        onPress={() => setPeriod(p.id)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: period === p.id }}
                        style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: period === p.id ? C.surface04 : "transparent", borderRadius: 12 }}
                      >
                        <Text variant="labelXs" style={{ color: period === p.id ? C.contentPrimary : C.contentSecondary }}>
                          {p.label.slice(0, 3)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>

              <View>
                <Text variant="labelXs" style={{ color: C.contentSecondary, marginBottom: 8, marginLeft: 4 }}>Metric Type</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {GOAL_UNITS.map((u) => (
                    <TouchableOpacity
                      key={u.id}
                      onPress={() => setUnit(u.id)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: unit === u.id }}
                      style={{ flex: 1, minWidth: "45%", flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: unit === u.id ? withAlpha(accentColor, 0.12) : C.surface02, borderWidth: 1, borderColor: unit === u.id ? accentColor : C.lineSubtle, borderRadius: 16, padding: 16 }}
                    >
                      <Text style={{ fontSize: 16 }}>{u.icon}</Text>
                      <Text variant="labelM" style={{ color: unit === u.id ? accentColor : C.contentSecondary }}>{u.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <TouchableOpacity
                onPress={handleSaveGoal}
                disabled={isSaving}
                accessibilityRole="button"
                accessibilityState={{ disabled: isSaving }}
                style={{ backgroundColor: accentColor, borderRadius: 16, padding: 18, alignItems: "center", marginTop: 8 }}
              >
                {isSaving ? (
                  <ActivityIndicator color={accentColorContrast} />
                ) : (
                  <Text variant="labelM" style={{ color: accentColorContrast, textTransform: "uppercase", letterSpacing: 1 }}>
                    {editingGoal ? "Save Changes" : "Create Goal"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}
