import React, { useState } from "react";
import {
  ScrollView,
  View,
  TouchableOpacity,
  Alert,
  Platform,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { Text } from "@/src/components/ui/text";
import { PlatformBadge } from "@/src/components/ui/PlatformBadge";
import { CurrencyText } from "@/src/components/ui/CurrencyText";
import { getShiftById, deleteShift } from "@/src/database/queries/shifts";
import { getExpensesByShift, insertExpense, deleteExpense } from "@/src/database/queries/expenses";
import { useSettingsStore } from "@/store/useSettingsStore";
import { cn } from "@/src/lib/utils";
import { type PlatformKey } from "@/src/registry/platforms";

const isWeb = Platform.OS === "web";

const EXPENSE_CATEGORIES = [
  { id: "fuel", label: "Fuel", icon: "⛽" },
  { id: "maintenance", label: "Maintenance", icon: "🔧" },
  { id: "wash", label: "Car Wash", icon: "🚿" },
  { id: "insurance", label: "Insurance", icon: "🛡️" },
  { id: "other", label: "Other", icon: "💵" },
];

export default function ShiftDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { profile } = useSettingsStore();

  // Add Expense inline modal state
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [expenseCategory, setExpenseCategory] = useState("fuel");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseNotes, setExpenseNotes] = useState("");
  const [isSavingExpense, setIsSavingExpense] = useState(false);

  // Fetch Shift
  const { data: shift, isLoading: isLoadingShift } = useQuery({
    queryKey: ["shift", id],
    queryFn: () => getShiftById(id!),
    enabled: !!id,
  });

  // Fetch Expenses
  const { data: expensesList = [], isLoading: isLoadingExpenses } = useQuery({
    queryKey: ["shift-expenses", id],
    queryFn: () => getExpensesByShift(id!),
    enabled: !!id,
  });

  const handleDeleteShift = () => {
    const performDelete = async () => {
      try {
        await deleteShift(id!);
        queryClient.invalidateQueries({ queryKey: ["shifts"] });
        queryClient.invalidateQueries({ queryKey: ["analytics"] });
        router.back();
      } catch (err) {
        console.error(err);
        Alert.alert("Error", "Failed to delete shift.");
      }
    };

    if (isWeb) {
      if (window.confirm("Permanently delete this shift and all linked expenses?")) {
        performDelete();
      }
    } else {
      Alert.alert(
        "Delete Shift",
        "Are you sure you want to permanently delete this shift and all linked expenses?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Delete", style: "destructive", onPress: performDelete },
        ]
      );
    }
  };

  const handleSaveExpense = async () => {
    if (!expenseAmount || isNaN(parseFloat(expenseAmount))) {
      Alert.alert("Validation", "Please enter a valid expense amount.");
      return;
    }
    setIsSavingExpense(true);
    try {
      await insertExpense({
        id: `expense_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        shiftId: id!,
        category: expenseCategory,
        amount: parseFloat(expenseAmount),
        date: new Date(),
        isDeductible: true,
        vehicleId: shift?.vehicleId || null,
        notes: expenseNotes.trim() || null,
      });

      queryClient.invalidateQueries({ queryKey: ["shift-expenses", id] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      
      setExpenseAmount("");
      setExpenseNotes("");
      setShowAddExpense(false);
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to add expense.");
    } finally {
      setIsSavingExpense(false);
    }
  };

  const handleDeleteExpense = (expId: string) => {
    const performDelete = async () => {
      try {
        await deleteExpense(expId);
        queryClient.invalidateQueries({ queryKey: ["shift-expenses", id] });
        queryClient.invalidateQueries({ queryKey: ["analytics"] });
      } catch (err) {
        Alert.alert("Error", "Failed to delete expense.");
      }
    };

    if (isWeb) {
      if (window.confirm("Delete this expense?")) performDelete();
    } else {
      Alert.alert("Delete Expense", "Are you sure you want to delete this expense?", [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: performDelete },
      ]);
    }
  };

  if (isLoadingShift) {
    return (
      <SafeAreaView className="dark flex-1 bg-[#000000] items-center justify-center" edges={["bottom", "left", "right"]} style={{ paddingTop: insets.top + 64 }}>
        <ActivityIndicator size="large" color="#10b981" />
      </SafeAreaView>
    );
  }

  if (!shift) {
    return (
      <SafeAreaView className="dark flex-1 bg-[#000000] items-center justify-center p-6" edges={["bottom", "left", "right"]} style={{ paddingTop: insets.top + 64 }}>
        <Text className="text-slate-400 text-sm text-center">Shift not found.</Text>
        <TouchableOpacity onPress={() => router.back()} className="mt-4">
          <Text className="text-emerald-500 text-sm font-bold">← Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // Mileage metrics
  const activeMiles = shift.activeMileage || 0;
  const deadMiles = shift.deadMileage || 0;
  const totalMiles = activeMiles + deadMiles;
  const deadMilePct = totalMiles > 0 ? (deadMiles / totalMiles) * 100 : 0;
  const durationHrs = (shift.durationSeconds / 3600).toFixed(1);
  const totalRevenue = shift.grossRevenue + shift.tipsRevenue;
  const hourlyRate = shift.durationSeconds > 0 ? (totalRevenue / (shift.durationSeconds / 3600)) : 0;

  const dateStr = new Date(shift.startTime).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const timeStr = `${new Date(shift.startTime).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  })} - ${new Date(shift.endTime).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  })}`;

  return (
    <SafeAreaView className="dark flex-1 bg-[#000000]" edges={["bottom", "left", "right"]} style={{ paddingTop: insets.top + 64 }}>
      {/* Top Header */}
      <View className="px-4 pt-3 pb-3 border-b border-slate-800/80 bg-slate-900/40 flex-row items-center justify-between">
        <TouchableOpacity onPress={() => router.back()} className="px-3 py-2 bg-slate-800/40 rounded-lg border border-slate-700/30">
          <Text className="text-slate-300 text-xs font-semibold">← Back</Text>
        </TouchableOpacity>
        <Text className="text-slate-100 font-extrabold text-sm tracking-tight">Shift Details</Text>
        <TouchableOpacity
          onPress={() => router.push({ pathname: "/shift/add", params: { shiftId: shift.id } })}
          className="px-3 py-2 bg-slate-800/40 rounded-lg border border-slate-700/30"
        >
          <Text className="text-emerald-500 text-xs font-bold">Edit</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerClassName="p-4 pb-16 flex flex-col gap-5">
        {/* Main Card */}
        <View className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 flex flex-col gap-4">
          <View className="flex-row justify-between items-start">
            <View className="flex flex-col gap-1">
              <PlatformBadge platform={shift.platform as PlatformKey} size="md" />
              <Text className="text-slate-100 font-bold text-sm mt-1">{dateStr}</Text>
              <Text className="text-slate-400 text-xs font-medium">{timeStr}</Text>
            </View>
            <View className="items-end">
              <CurrencyText amount={totalRevenue} size="lg" className="font-extrabold text-emerald-400" />
              <Text className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">Total Revenue</Text>
            </View>
          </View>

          {/* Quick Stats Grid */}
          <View className="grid grid-cols-3 gap-2.5 flex-row border-t border-slate-800/50 pt-4 mt-1">
            <View className="flex-1 items-center bg-slate-950/30 border border-slate-800/40 rounded-xl p-2.5">
              <Text className="text-sm font-extrabold text-slate-100">{durationHrs}h</Text>
              <Text className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">Duration</Text>
            </View>
            <View className="flex-1 items-center bg-slate-950/30 border border-slate-800/40 rounded-xl p-2.5">
              <CurrencyText amount={hourlyRate} size="sm" className="font-extrabold text-slate-100" />
              <Text className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">Hourly Rate</Text>
            </View>
            <View className="flex-1 items-center bg-slate-950/30 border border-slate-800/40 rounded-xl p-2.5">
              <Text className="text-sm font-extrabold text-slate-100">{totalMiles.toFixed(1)} {profile.distanceUnit}</Text>
              <Text className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">Total Dist</Text>
            </View>
          </View>

          {/* Tips breakdown details */}
          <View className="flex-row justify-between items-center bg-slate-950/20 px-3.5 py-2.5 rounded-xl border border-slate-800/40">
            <Text className="text-xs text-slate-400 font-medium">Tips Component</Text>
            <CurrencyText amount={shift.tipsRevenue} size="sm" className="font-bold text-slate-200" />
          </View>

          {shift.notes ? (
            <View className="bg-slate-950/20 px-3.5 py-3 rounded-xl border border-slate-800/40">
              <Text className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Shift Notes</Text>
              <Text className="text-slate-300 text-xs mt-1.5 leading-relaxed font-medium">"{shift.notes}"</Text>
            </View>
          ) : null}
        </View>

        {/* Mileage breakdown card */}
        <View className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-4 flex flex-col gap-3">
          <Text className="text-sm font-extrabold text-slate-100 tracking-tight">Mileage Breakdown</Text>
          
          <View className="flex-col gap-2">
            {/* Labeled Rows */}
            <View className="flex-row justify-between text-xs">
              <Text className="text-slate-400 font-medium">Active Distance</Text>
              <Text className="text-slate-200 font-bold">{activeMiles.toFixed(1)} {profile.distanceUnit}</Text>
            </View>
            <View className="flex-row justify-between text-xs">
              <Text className="text-slate-400 font-medium">Dead Distance</Text>
              <Text className="text-slate-200 font-bold">{deadMiles.toFixed(1)} {profile.distanceUnit}</Text>
            </View>
            <View className="flex-row justify-between text-xs border-t border-slate-800/40 pt-2 mt-1">
              <Text className="text-slate-400 font-bold">Dead Distance Ratio</Text>
              <Text className="text-rose-400 font-bold">{deadMilePct.toFixed(0)}%</Text>
            </View>

            {/* Split Progress Bar */}
            <View className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden flex-row mt-2">
              <View style={{ flex: Math.max(0.01, activeMiles), backgroundColor: "#10b981" }} />
              <View style={{ flex: Math.max(0.01, deadMiles), backgroundColor: "#f43f5e" }} />
            </View>
          </View>
        </View>

        {/* Expenses List Section */}
        <View className="flex flex-col gap-3">
          <View className="flex-row justify-between items-center">
            <Text className="text-sm font-extrabold text-slate-100 tracking-tight">Linked Expenses</Text>
            <TouchableOpacity
              onPress={() => setShowAddExpense((v) => !v)}
              className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg"
            >
              <Text className="text-[11px] text-emerald-400 font-bold uppercase tracking-wider">
                {showAddExpense ? "Cancel" : "+ Add Expense"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Add Expense Form */}
          {showAddExpense && (
            <View className="bg-slate-900/60 border border-slate-700/60 rounded-2xl p-4 flex flex-col gap-4">
              <Text className="text-xs font-bold text-slate-400 uppercase tracking-wider">Category</Text>
              <View className="flex-row flex-wrap gap-2">
                {EXPENSE_CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    onPress={() => setExpenseCategory(cat.id)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg border flex-row items-center gap-1.5",
                      expenseCategory === cat.id
                        ? "border-emerald-500 bg-emerald-500/10"
                        : "border-slate-800 bg-slate-900/40"
                    )}
                  >
                    <Text className="text-sm">{cat.icon}</Text>
                    <Text className={cn("text-[11px] font-bold", expenseCategory === cat.id ? "text-emerald-400" : "text-slate-400")}>
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View className="flex flex-col gap-1.5">
                <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Amount ($) *</Text>
                <TextInput
                  value={expenseAmount}
                  onChangeText={setExpenseAmount}
                  keyboardType="numeric"
                  placeholder="0.00"
                  placeholderTextColor="#475569"
                  className="bg-slate-950/60 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 text-sm font-semibold"
                />
              </View>

              <View className="flex flex-col gap-1.5">
                <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Notes</Text>
                <TextInput
                  value={expenseNotes}
                  onChangeText={setExpenseNotes}
                  placeholder="Receipt note or details..."
                  placeholderTextColor="#475569"
                  className="bg-slate-950/60 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 text-sm font-semibold"
                />
              </View>

              <TouchableOpacity
                onPress={handleSaveExpense}
                disabled={isSavingExpense}
                className="w-full py-3.5 bg-emerald-500 rounded-xl items-center justify-center"
              >
                {isSavingExpense ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text className="text-white font-bold text-sm">Save Expense</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Expenses list cards */}
          {isLoadingExpenses ? (
            <ActivityIndicator size="small" color="#10b981" />
          ) : expensesList.length === 0 ? (
            <View className="py-6 border border-dashed border-slate-800/60 rounded-2xl items-center justify-center">
              <Text className="text-slate-500 text-xs font-medium">No expenses linked to this shift.</Text>
            </View>
          ) : (
            <View className="flex flex-col gap-2.5">
              {expensesList.map((exp: any) => {
                const catInfo = EXPENSE_CATEGORIES.find((c) => c.id === exp.category);
                return (
                  <View
                    key={exp.id}
                    className="flex-row items-center justify-between bg-slate-900/50 border border-slate-800/60 rounded-xl p-3.5"
                  >
                    <View className="flex-row items-center gap-3 flex-1">
                      <Text className="text-xl">{catInfo?.icon || "💵"}</Text>
                      <View className="flex-col flex-1">
                        <Text className="text-sm font-bold text-slate-100">
                          {catInfo?.label || exp.category}
                        </Text>
                        {exp.notes ? (
                          <Text className="text-[10px] text-slate-400 mt-0.5">{exp.notes}</Text>
                        ) : null}
                      </View>
                    </View>
                    <View className="flex-row items-center gap-3">
                      <CurrencyText amount={exp.amount} size="sm" className="font-bold text-rose-400" />
                      <TouchableOpacity
                        onPress={() => handleDeleteExpense(exp.id)}
                        className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20"
                      >
                        <View style={{ width: 10, height: 11, borderWidth: 1.5, borderColor: "#f43f5e", borderTopWidth: 0, borderBottomLeftRadius: 1, borderBottomRightRadius: 1 }}>
                          <View style={{ width: 10, height: 1.5, backgroundColor: "#f43f5e", position: "absolute", top: -3 }} />
                        </View>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Delete Shift Button */}
        <TouchableOpacity
          onPress={handleDeleteShift}
          className="w-full py-4 border border-rose-500/25 bg-rose-500/5 rounded-2xl items-center justify-center mt-4"
        >
          <Text className="text-xs font-extrabold text-rose-400 uppercase tracking-widest">
            Delete Shift Log
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
