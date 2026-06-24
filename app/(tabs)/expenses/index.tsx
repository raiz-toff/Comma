import React, { useState } from "react";
import {
  ScrollView,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Text } from "@/src/components/ui/text";
import { CurrencyText } from "@/src/components/ui/CurrencyText";
import { SectionHeader } from "@/src/components/ui/SectionHeader";
import { EmptyState } from "@/src/components/ui/EmptyState";
import {
  getExpensesByMonth,
  getExpenseYTDSummary,
  deleteExpense,
} from "@/src/database/queries/expenses";
import { useSettingsStore } from "@/store/useSettingsStore";
import { cn } from "@/src/lib/utils";

const isWeb = Platform.OS === "web";

// ── Expense Category Registry ────────────────────────────────────────────────
export const EXPENSE_CATEGORIES = [
  { id: "fuel",        label: "Fuel",         icon: "⛽" },
  { id: "maintenance", label: "Maintenance",   icon: "🔧" },
  { id: "wash",        label: "Car Wash",      icon: "🚿" },
  { id: "insurance",   label: "Insurance",     icon: "🛡️" },
  { id: "parking",     label: "Parking",       icon: "🅿️" },
  { id: "phone",       label: "Phone",         icon: "📱" },
  { id: "equipment",   label: "Equipment",     icon: "🎒" },
  { id: "food",        label: "Food",          icon: "🍕" },
  { id: "other",       label: "Other",         icon: "💵" },
] as const;

export type ExpenseCategoryId = (typeof EXPENSE_CATEGORIES)[number]["id"];

export function getCategoryMeta(id: string) {
  return EXPENSE_CATEGORIES.find((c) => c.id === id) ?? { id: "other", label: "Other", icon: "💵" };
}

// ── Trash Icon ───────────────────────────────────────────────────────────────
const TrashIcon = ({ color = "#ef4444" }: { color?: string }) => (
  <View style={{ width: 14, height: 14, justifyContent: "center", alignItems: "center" }}>
    <View style={{ width: 12, height: 1.5, backgroundColor: color, borderRadius: 1, position: "absolute", top: 2 }} />
    <View style={{ width: 8, height: 9, borderWidth: 1.5, borderColor: color, borderTopWidth: 0, borderBottomLeftRadius: 1.5, borderBottomRightRadius: 1.5, position: "absolute", bottom: 0.5 }} />
    <View style={{ width: 1, height: 5, backgroundColor: color, position: "absolute", left: 5, top: 4.5 }} />
  </View>
);

export default function ExpensesScreen() {
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { isOnboardingCompleted } = useSettingsStore();

  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [filterDeductible, setFilterDeductible] = useState<"all" | "yes" | "no">("all");

  // Queries
  const { data: monthSections = [], isLoading } = useQuery({
    queryKey: ["expenses", "by-month", year],
    queryFn: () => getExpensesByMonth(year),
    enabled: isOnboardingCompleted,
  });

  const { data: ytdSummary } = useQuery({
    queryKey: ["expenses", "ytd"],
    queryFn: () => getExpenseYTDSummary(),
    enabled: isOnboardingCompleted,
  });

  const handleDelete = (id: string) => {
    const performDelete = async () => {
      try {
        await deleteExpense(id);
        queryClient.invalidateQueries({ queryKey: ["expenses"] });
        queryClient.invalidateQueries({ queryKey: ["analytics"] });
      } catch {
        Alert.alert("Error", "Failed to delete expense.");
      }
    };

    if (isWeb) {
      if (window.confirm("Delete this expense?")) performDelete();
    } else {
      Alert.alert("Delete Expense", "Permanently delete this expense?", [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: performDelete },
      ]);
    }
  };

  // Apply local filters
  const filteredSections = monthSections
    .map((section) => ({
      ...section,
      items: section.items.filter((e: any) => {
        if (filterCategory && e.category !== filterCategory) return false;
        if (filterDeductible === "yes" && !e.isDeductible) return false;
        if (filterDeductible === "no" && e.isDeductible) return false;
        return true;
      }),
    }))
    .filter((s) => s.items.length > 0);

  const hasItems = filteredSections.some((s) => s.items.length > 0);

  return (
    <SafeAreaView className="dark flex-1 bg-[#000000]" edges={["bottom", "left", "right"]} style={{ paddingTop: insets.top + 64 }}>
      {/* ── Header ───────────────────────────────────────────────────── */}
      <View className="px-4 pt-3 pb-2 border-b border-slate-800/80 bg-slate-900/40">
        <SectionHeader
          title="Expenses"
          action={{ label: "+ Add", onPress: () => router.push("/expense/add") }}
        />
      </View>

      {/* ── YTD Summary Card ─────────────────────────────────────────── */}
      <View className="px-4 py-3 border-b border-slate-800/60 bg-slate-900/20">
        <View className="flex-row gap-3">
          <View className="flex-1 bg-slate-900/70 border border-slate-800/80 rounded-xl px-3.5 py-3">
            <Text className="text-[9px] text-emerald-400 font-bold uppercase tracking-wider">
              YTD Deductible
            </Text>
            <CurrencyText
              amount={ytdSummary?.deductible ?? 0}
              size="md"
              className="font-extrabold text-slate-100 mt-0.5"
            />
          </View>
          <View className="flex-1 bg-slate-900/70 border border-slate-800/80 rounded-xl px-3.5 py-3">
            <Text className="text-[9px] text-rose-400 font-bold uppercase tracking-wider">
              YTD Non-Deductible
            </Text>
            <CurrencyText
              amount={ytdSummary?.nonDeductible ?? 0}
              size="md"
              className="font-extrabold text-slate-100 mt-0.5"
            />
          </View>
        </View>
      </View>

      {/* ── Filter Bar ───────────────────────────────────────────────── */}
      <View className="flex-col border-b border-slate-900">
        {/* Category chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="flex-row gap-2 px-4 py-2"
        >
          <TouchableOpacity
            onPress={() => setFilterCategory("")}
            className={cn(
              "px-3 py-1.5 rounded-full border",
              !filterCategory
                ? "border-emerald-500 bg-emerald-500/10"
                : "border-slate-800 bg-slate-900/40"
            )}
          >
            <Text className={cn("text-[11px] font-bold", !filterCategory ? "text-emerald-400" : "text-slate-400")}>
              All
            </Text>
          </TouchableOpacity>
          {EXPENSE_CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              onPress={() => setFilterCategory(filterCategory === cat.id ? "" : cat.id)}
              className={cn(
                "px-3 py-1.5 rounded-full border flex-row items-center gap-1",
                filterCategory === cat.id
                  ? "border-emerald-500 bg-emerald-500/10"
                  : "border-slate-800 bg-slate-900/40"
              )}
            >
              <Text className="text-sm leading-none">{cat.icon}</Text>
              <Text
                className={cn(
                  "text-[11px] font-bold",
                  filterCategory === cat.id ? "text-emerald-400" : "text-slate-400"
                )}
              >
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Deductible toggle */}
        <View className="flex-row gap-2 px-4 pb-2">
          {(["all", "yes", "no"] as const).map((opt) => (
            <TouchableOpacity
              key={opt}
              onPress={() => setFilterDeductible(opt)}
              className={cn(
                "px-3 py-1 rounded-lg border",
                filterDeductible === opt
                  ? "border-emerald-500 bg-emerald-500/10"
                  : "border-slate-800 bg-slate-900/20"
              )}
            >
              <Text
                className={cn(
                  "text-[10px] font-bold uppercase tracking-wide",
                  filterDeductible === opt ? "text-emerald-400" : "text-slate-500"
                )}
              >
                {opt === "all" ? "All" : opt === "yes" ? "✓ Deductible" : "✗ Non-deductible"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ── Content ──────────────────────────────────────────────────── */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#10b981" />
        </View>
      ) : !hasItems ? (
        <View className="flex-1 justify-center">
          <EmptyState
            icon="receipt"
            title="No Expenses Found"
            message={
              filterCategory || filterDeductible !== "all"
                ? "Try clearing your filters to see all expenses."
                : "No expenses logged yet. Tap + Add to record your first expense."
            }
            actionLabel="Add Expense"
            onAction={() => router.push("/expense/add")}
          />
        </View>
      ) : (
        <ScrollView contentContainerClassName="pb-16">
          {/* Year Switcher */}
          <View className="flex-row justify-center items-center gap-4 py-3">
            <TouchableOpacity onPress={() => setYear((y) => y - 1)} className="px-3 py-1.5 bg-slate-900/50 rounded-lg border border-slate-800">
              <Text className="text-slate-400 text-xs font-bold">‹ {year - 1}</Text>
            </TouchableOpacity>
            <Text className="text-slate-100 font-extrabold text-sm">{year}</Text>
            {year < currentYear && (
              <TouchableOpacity onPress={() => setYear((y) => y + 1)} className="px-3 py-1.5 bg-slate-900/50 rounded-lg border border-slate-800">
                <Text className="text-slate-400 text-xs font-bold">{year + 1} ›</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Month Sections */}
          {filteredSections.map((section) => {
            const sectionTotal = section.items.reduce((sum: number, e: any) => sum + e.amount, 0);
            return (
              <View key={section.monthKey} className="mb-5">
                {/* Month header */}
                <View className="flex-row justify-between items-center px-4 py-2">
                  <Text className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">
                    {section.label}
                  </Text>
                  <CurrencyText amount={sectionTotal} size="sm" className="font-bold text-slate-300" />
                </View>

                {/* Expense rows */}
                <View className="px-4 flex flex-col gap-2">
                  {section.items.map((expense: any) => {
                    const cat = getCategoryMeta(expense.category);
                    return (
                      <TouchableOpacity
                        key={expense.id}
                        onPress={() => router.push({ pathname: "/expense/add", params: { expenseId: expense.id } })}
                        className="bg-slate-900/60 border border-slate-800/80 rounded-2xl px-4 py-3.5 flex-row items-center gap-3 active:border-slate-700"
                      >
                        {/* Category icon bubble */}
                        <View className="w-10 h-10 bg-slate-800/60 border border-slate-700/40 rounded-xl items-center justify-center">
                          <Text className="text-xl leading-none">{cat.icon}</Text>
                        </View>

                        {/* Label + meta */}
                        <View className="flex-1 flex-col gap-0.5">
                          <View className="flex-row items-center gap-2">
                            <Text className="text-sm font-bold text-slate-100">{cat.label}</Text>
                            {expense.isDeductible ? (
                              <View className="px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                                <Text className="text-[8px] text-emerald-400 font-bold uppercase tracking-wider">
                                  Deductible
                                </Text>
                              </View>
                            ) : null}
                          </View>
                          <Text className="text-[10px] text-slate-500 font-medium">
                            {new Date(expense.date).toLocaleDateString(undefined, {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                            })}
                            {expense.notes ? ` · ${expense.notes}` : ""}
                          </Text>
                        </View>

                        {/* Amount + delete */}
                        <View className="flex-row items-center gap-3">
                          <CurrencyText
                            amount={expense.amount}
                            size="sm"
                            className="font-extrabold text-rose-400"
                          />
                          <TouchableOpacity
                            onPress={(e) => {
                              e.stopPropagation();
                              handleDelete(expense.id);
                            }}
                            className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 active:bg-rose-500/20"
                          >
                            <TrashIcon color="#f43f5e" />
                          </TouchableOpacity>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
