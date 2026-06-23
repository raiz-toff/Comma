import React, { useState } from "react";
import {
  ScrollView,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Text } from "@/src/components/ui/text";
import { CurrencyText } from "@/src/components/ui/CurrencyText";
import { EmptyState } from "@/src/components/ui/EmptyState";
import { getGoalsWithProgress, insertGoal, deleteGoal } from "@/src/database/queries/goals";
import { useSettingsStore } from "@/store/useSettingsStore";
import { cn } from "@/src/lib/utils";

const isWeb = Platform.OS === "web";

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

export default function GoalsScreen() {
  const queryClient = useQueryClient();
  const { profile, isOnboardingCompleted } = useSettingsStore();

  const [isAdding, setIsAdding] = useState(false);
  const [label, setLabel] = useState("");
  const [targetValue, setTargetValue] = useState("");
  const [unit, setUnit] = useState<typeof GOAL_UNITS[number]["id"]>("currency");
  const [period, setPeriod] = useState<typeof GOAL_PERIODS[number]["id"]>("weekly");
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const { data: goalsList = [], isLoading } = useQuery({
    queryKey: ["goals", "progress"],
    queryFn: () => getGoalsWithProgress(),
    enabled: isOnboardingCompleted,
  });

  const handleAddGoal = async () => {
    setErrorMessage("");
    const parsedTarget = parseFloat(targetValue);
    if (!label.trim()) {
      setErrorMessage("Please enter a label for the goal.");
      return;
    }
    if (!targetValue || isNaN(parsedTarget) || parsedTarget <= 0) {
      setErrorMessage("Please enter a valid target value greater than 0.");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        id: `goal_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        label: label.trim(),
        targetValue: parsedTarget,
        unit,
        period,
        isActive: true,
        createdAt: new Date(),
      };

      await insertGoal(payload);
      queryClient.invalidateQueries({ queryKey: ["goals"] });
      
      // Reset form
      setLabel("");
      setTargetValue("");
      setIsAdding(false);
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to add goal.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteGoal = (id: string) => {
    const performDelete = async () => {
      try {
        await deleteGoal(id);
        queryClient.invalidateQueries({ queryKey: ["goals"] });
      } catch {
        Alert.alert("Error", "Failed to delete goal.");
      }
    };

    if (isWeb) {
      if (window.confirm("Are you sure you want to delete this goal?")) {
        performDelete();
      }
    } else {
      Alert.alert("Delete Goal", "Permanently delete this goal?", [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: performDelete },
      ]);
    }
  };

  return (
    <SafeAreaView className="dark flex-1 bg-[#0b0f19]">
      {/* Header */}
      <View className="px-4 pt-3 pb-2 border-b border-slate-800/80 bg-slate-900/40 flex-row justify-between items-center">
        <TouchableOpacity
          onPress={() => router.back()}
          className="py-2 px-3 bg-slate-800/40 rounded-lg border border-slate-700/30"
        >
          <Text className="text-slate-300 text-xs font-semibold">Back</Text>
        </TouchableOpacity>
        <Text className="text-slate-100 text-base font-extrabold tracking-tight">Active Goals</Text>
        <TouchableOpacity
          onPress={() => setIsAdding(!isAdding)}
          className="py-2 px-3.5 bg-emerald-500 rounded-lg"
        >
          <Text className="text-white text-xs font-bold uppercase tracking-wider">
            {isAdding ? "Cancel" : "+ New"}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerClassName="p-4 pb-20 flex flex-col gap-5">
        {/* Add Goal Panel */}
        {isAdding && (
          <View className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex flex-col gap-4">
            <Text className="text-slate-200 text-sm font-extrabold">Create New Goal</Text>
            {errorMessage ? (
              <View className="bg-rose-500/10 border border-rose-500/20 p-3 rounded-xl">
                <Text className="text-rose-400 text-xs font-semibold">{errorMessage}</Text>
              </View>
            ) : null}

            {/* Label */}
            <View className="flex-col gap-1.5">
              <Text className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">Goal Name</Text>
              <TextInput
                value={label}
                onChangeText={setLabel}
                placeholder="e.g. Weekly Gas Budget, Weekend Earnings"
                placeholderTextColor="#475569"
                className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 text-xs font-medium"
              />
            </View>

            {/* Target & Unit */}
            <View className="flex-row gap-3">
              <View className="flex-1 flex-col gap-1.5">
                <Text className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">Target Value</Text>
                <TextInput
                  value={targetValue}
                  onChangeText={setTargetValue}
                  keyboardType="numeric"
                  placeholder="0.00"
                  placeholderTextColor="#475569"
                  className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 text-xs font-extrabold"
                />
              </View>
              <View className="flex-1 flex-col gap-1.5">
                <Text className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">Period</Text>
                <View className="flex-row gap-1 bg-slate-950 border border-slate-800 rounded-xl p-1 justify-around">
                  {GOAL_PERIODS.map((p) => (
                    <TouchableOpacity
                      key={p.id}
                      onPress={() => setPeriod(p.id)}
                      className={cn(
                        "px-2.5 py-1.5 rounded-lg flex-1 items-center",
                        period === p.id ? "bg-emerald-500/15" : ""
                      )}
                    >
                      <Text
                        className={cn(
                          "text-[9px] font-bold uppercase tracking-wide",
                          period === p.id ? "text-emerald-400" : "text-slate-500"
                        )}
                      >
                        {p.label[0]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            {/* Unit Grid */}
            <View className="flex-col gap-1.5">
              <Text className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">Goal Unit</Text>
              <View className="flex-row flex-wrap gap-2">
                {GOAL_UNITS.map((u) => (
                  <TouchableOpacity
                    key={u.id}
                    onPress={() => setUnit(u.id)}
                    className={cn(
                      "flex-row items-center gap-1.5 px-3 py-2 rounded-xl border flex-1 min-w-[45%]",
                      unit === u.id
                        ? "border-emerald-500 bg-emerald-500/10"
                        : "border-slate-800 bg-slate-950"
                    )}
                  >
                    <Text className="text-sm leading-none">{u.icon}</Text>
                    <Text
                      className={cn(
                        "text-[10px] font-bold",
                        unit === u.id ? "text-emerald-400" : "text-slate-400"
                      )}
                    >
                      {u.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity
              onPress={handleAddGoal}
              disabled={isSaving}
              className="py-3 bg-emerald-500 rounded-xl items-center mt-2"
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text className="text-white text-xs font-bold uppercase tracking-wider">Create Goal</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Goals List */}
        {isLoading ? (
          <View className="py-20 items-center">
            <ActivityIndicator size="large" color="#10b981" />
          </View>
        ) : goalsList.length === 0 ? (
          <EmptyState
            icon="target"
            title="No Active Goals"
            message="Track your driver metrics and target earnings by adding a custom goal."
            actionLabel="Add Goal"
            onAction={() => setIsAdding(true)}
          />
        ) : (
          <View className="flex flex-col gap-3">
            {goalsList.map((goal: any) => {
              const unitMeta = GOAL_UNITS.find((u) => u.id === goal.unit);
              const progressPct = goal.progressPct || 0;
              const roundedPct = Math.round(progressPct);

              return (
                <View
                  key={goal.id}
                  className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 flex flex-col gap-3"
                >
                  {/* Title & Badge */}
                  <View className="flex-row justify-between items-start">
                    <View className="flex-col gap-0.5 flex-1 pr-4">
                      <Text className="text-sm font-bold text-slate-100">{goal.label}</Text>
                      <Text className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">
                        {goal.period} · {unitMeta?.label}
                      </Text>
                    </View>
                    <View className="flex-row items-center gap-2">
                      <View className="px-2 py-0.5 bg-slate-800 rounded-lg">
                        <Text className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider">
                          {roundedPct}%
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => handleDeleteGoal(goal.id)}
                        className="p-1.5 bg-rose-500/10 border border-rose-500/20 rounded-lg"
                      >
                        <Text className="text-rose-400 text-[10px] font-bold">Delete</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Progress Bar */}
                  <View className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden">
                    <View
                      style={{
                        width: `${Math.min(100, progressPct)}%`,
                        backgroundColor: progressPct >= 100 ? "#10b981" : "#3b82f6",
                        height: "100%",
                      }}
                    />
                  </View>

                  {/* Numbers */}
                  <View className="flex-row justify-between items-center">
                    <View className="flex-row items-center gap-1">
                      <Text className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Current:</Text>
                      {goal.unit === "currency" ? (
                        <CurrencyText amount={goal.currentValue} size="sm" className="font-extrabold text-slate-200" />
                      ) : (
                        <Text className="text-xs font-extrabold text-slate-200">
                          {goal.currentValue.toFixed(goal.unit === "hours" ? 1 : 0)}
                        </Text>
                      )}
                    </View>
                    <View className="flex-row items-center gap-1">
                      <Text className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Target:</Text>
                      {goal.unit === "currency" ? (
                        <CurrencyText amount={goal.targetValue} size="sm" className="font-extrabold text-emerald-400" />
                      ) : (
                        <Text className="text-xs font-extrabold text-emerald-400">
                          {goal.targetValue}
                          {goal.unit === "hours" ? " hrs" : goal.unit === "mileage" ? ` ${profile.distanceUnit}` : ""}
                        </Text>
                      )}
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
