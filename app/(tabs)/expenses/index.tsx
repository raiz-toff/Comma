import React, { useState, useCallback, useMemo } from "react";
import {
  ScrollView,
  View,
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Plus, Trash2, ChevronLeft, ChevronRight } from "lucide-react-native";
import { Text } from "@/src/components/ui/text";
import { CurrencyText } from "@/src/components/ui/CurrencyText";
import { EmptyState } from "@/src/components/ui/EmptyState";
import {
  getExpensesByMonth,
  getExpenseYTDSummary,
  deleteExpense,
} from "@/src/database/queries/expenses";
import { useSettingsStore } from "@/store/useSettingsStore";
import {
  getExpenseCategories,
  getCategoryMeta,
  type ExpenseCategory,
} from "@/src/registry/expenseCategories";

export { getExpenseCategories, getCategoryMeta, type ExpenseCategory };
export type ExpenseCategoryId = string;

// ─── Design tokens (match AnalyticsScreen) ───────────────────────────────────

const BG      = "#0d0d0d";
const SURFACE = "#161615";
const BORDER  = "#262522";
const MUTED   = "#3a3a38";
const TEXT_MUTED = "#71717a";
const TEXT_DIM   = "#52525b";

const isWeb = Platform.OS === "web";

// ─── Local type ───────────────────────────────────────────────────────────────

type ExpenseItem = {
  id: string;
  category: string;
  amount: number;
  date: string;
  notes?: string;
  isDeductible: boolean;
};

type MonthSection = {
  monthKey: string;
  label: string;
  items: ExpenseItem[];
};

type DeductibleFilter = "all" | "yes" | "no";

// ─── Subcomponents ────────────────────────────────────────────────────────────

/** A single expense row */
function ExpenseRow({
  expense,
  country,
  customCategories,
  onPress,
  onDelete,
}: {
  expense: ExpenseItem;
  country: string;
  customCategories: any[];
  onPress: () => void;
  onDelete: () => void;
}) {
  const cat = getCategoryMeta(expense.category, country, customCategories);

  const dateLabel = new Date(expense.date).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        backgroundColor: pressed ? "#1a1a19" : SURFACE,
        borderWidth: 1,
        borderColor: pressed ? "#2e2e2b" : BORDER,
        borderRadius: 16,
        paddingHorizontal: 14,
        paddingVertical: 13,
      })}
    >
      {/* Category icon bubble */}
      <View
        style={{
          width: 42,
          height: 42,
          backgroundColor: BG,
          borderWidth: 1,
          borderColor: BORDER,
          borderRadius: 12,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ fontSize: 20, lineHeight: 24 }}>{cat.icon}</Text>
      </View>

      {/* Label + meta */}
      <View style={{ flex: 1, gap: 3 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
          <Text style={{ fontSize: 14, fontWeight: "700", color: "#ffffff" }}>
            {cat.label}
          </Text>
          {expense.isDeductible && (
            <View
              style={{
                paddingHorizontal: 6,
                paddingVertical: 2,
                backgroundColor: "#052e16",
                borderWidth: 1,
                borderColor: "#166534",
                borderRadius: 6,
              }}
            >
              <Text style={{ fontSize: 8, fontWeight: "800", color: "#4ade80", letterSpacing: 0.6, textTransform: "uppercase" }}>
                Deductible
              </Text>
            </View>
          )}
        </View>
        <Text style={{ fontSize: 11, color: TEXT_MUTED, fontWeight: "500" }}>
          {dateLabel}
          {expense.notes ? ` · ${expense.notes}` : ""}
        </Text>
      </View>

      {/* Amount + delete */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Text style={{ fontSize: 15, fontWeight: "900", color: "#f87171" }}>
          <CurrencyText amount={expense.amount} size="sm" />
        </Text>
        <Pressable
          onPress={onDelete}
          hitSlop={10}
          style={({ pressed }) => ({
            padding: 8,
            borderRadius: 10,
            backgroundColor: pressed ? "#3b0f0f" : "#1c0a0a",
            borderWidth: 1,
            borderColor: "#7f1d1d",
          })}
        >
          <Trash2 size={14} color="#f87171" strokeWidth={2} />
        </Pressable>
      </View>
    </Pressable>
  );
}

/** YTD stat card pair */
function YtdSummary({ deductible, nonDeductible }: { deductible: number; nonDeductible: number }) {
  return (
    <View style={{ flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingVertical: 12 }}>
      <View
        style={{
          flex: 1,
          backgroundColor: SURFACE,
          borderWidth: 1,
          borderColor: BORDER,
          borderRadius: 14,
          paddingHorizontal: 14,
          paddingVertical: 12,
          gap: 4,
        }}
      >
        <Text style={{ fontSize: 9, fontWeight: "800", color: "#4ade80", textTransform: "uppercase", letterSpacing: 1 }}>
          YTD Deductible
        </Text>
        <CurrencyText amount={deductible} size="md" style={{ fontWeight: "900", color: "#f1f5f9" }} />
      </View>
      <View
        style={{
          flex: 1,
          backgroundColor: SURFACE,
          borderWidth: 1,
          borderColor: BORDER,
          borderRadius: 14,
          paddingHorizontal: 14,
          paddingVertical: 12,
          gap: 4,
        }}
      >
        <Text style={{ fontSize: 9, fontWeight: "800", color: "#f87171", textTransform: "uppercase", letterSpacing: 1 }}>
          YTD Non-Deductible
        </Text>
        <CurrencyText amount={nonDeductible} size="md" style={{ fontWeight: "900", color: "#f1f5f9" }} />
      </View>
    </View>
  );
}

/** Section label used before month groups */
function MonthLabel({ label, total }: { label: string; total: number }) {
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingTop: 20,
        paddingBottom: 8,
      }}
    >
      <Text style={{ fontSize: 10, fontWeight: "800", color: TEXT_DIM, textTransform: "uppercase", letterSpacing: 1.2 }}>
        {label}
      </Text>
      <CurrencyText amount={total} size="sm" style={{ fontWeight: "700", color: TEXT_MUTED }} />
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function ExpensesScreen() {
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { isOnboardingCompleted, profile } = useSettingsStore();

  const country          = profile?.country ?? "CA";
  const customCategories = profile?.customCategories ?? [];
  const expenseCategories = getExpenseCategories(country, customCategories);

  const currentYear = new Date().getFullYear();
  const [year, setYear]                       = useState(currentYear);
  const [filterCategory, setFilterCategory]   = useState<string>("");
  const [filterDeductible, setFilterDeductible] = useState<DeductibleFilter>("all");

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: monthSections = [], isLoading } = useQuery<MonthSection[]>({
    queryKey: ["expenses", "by-month", year],
    queryFn: () => getExpensesByMonth(year),
    enabled: isOnboardingCompleted,
  });

  const { data: ytdSummary } = useQuery({
    queryKey: ["expenses", "ytd"],
    queryFn: () => getExpenseYTDSummary(),
    enabled: isOnboardingCompleted,
  });

  // ── Delete handler ─────────────────────────────────────────────────────────

  const handleDelete = useCallback((id: string) => {
    const performDelete = async () => {
      try {
        await deleteExpense(id);
        queryClient.invalidateQueries({ queryKey: ["expenses"] });
        queryClient.invalidateQueries({ queryKey: ["analytics"] });
      } catch {
        Alert.alert("Error", "Could not delete expense. Try again.");
      }
    };

    if (isWeb) {
      if (window.confirm("Delete this expense?")) performDelete();
    } else {
      Alert.alert("Delete Expense", "Permanently remove this expense?", [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: performDelete },
      ]);
    }
  }, [queryClient]);

  // ── Filtered sections ──────────────────────────────────────────────────────

  const filteredSections = useMemo(
    () =>
      monthSections
        .map((section) => ({
          ...section,
          items: section.items.filter((e) => {
            if (filterCategory && e.category !== filterCategory) return false;
            if (filterDeductible === "yes" && !e.isDeductible)   return false;
            if (filterDeductible === "no"  && e.isDeductible)    return false;
            return true;
          }),
        }))
        .filter((s) => s.items.length > 0),
    [monthSections, filterCategory, filterDeductible]
  );

  const hasItems = filteredSections.length > 0;
  const isFiltered = filterCategory !== "" || filterDeductible !== "all";

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: BG, paddingTop: insets.top + 64 }}
      edges={["bottom", "left", "right"]}
    >
      {/* ── Screen header ────────────────────────────────────────────── */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          paddingHorizontal: 20,
          paddingTop: 20,
          paddingBottom: 16,
          borderBottomWidth: 1,
          borderBottomColor: BORDER,
          backgroundColor: BG,
        }}
      >
        <View>
          <Text style={{ fontSize: 22, fontWeight: "800", color: "#ffffff", letterSpacing: -0.5, marginBottom: 2 }}>
            Expenses
          </Text>
          <Text style={{ fontSize: 12, color: TEXT_MUTED, fontWeight: "500" }}>
            Track deductible & non-deductible costs
          </Text>
        </View>
        <Pressable
          onPress={() => router.push("/expense/add")}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            backgroundColor: pressed ? "#166534" : "#15803d",
            paddingHorizontal: 14,
            paddingVertical: 9,
            borderRadius: 12,
          })}
        >
          <Plus size={15} color="#ffffff" strokeWidth={2.5} />
          <Text style={{ fontSize: 13, fontWeight: "800", color: "#ffffff" }}>Add</Text>
        </Pressable>
      </View>

      {/* ── YTD summary ──────────────────────────────────────────────── */}
      <View style={{ borderBottomWidth: 1, borderBottomColor: BORDER, backgroundColor: BG }}>
        <YtdSummary
          deductible={ytdSummary?.deductible ?? 0}
          nonDeductible={ytdSummary?.nonDeductible ?? 0}
        />
      </View>

      {/* ── Filter bar (sticky) ───────────────────────────────────────── */}
      <View style={{ borderBottomWidth: 1, borderBottomColor: BORDER, backgroundColor: BG }}>
        {/* Year switcher */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            paddingVertical: 10,
            borderBottomWidth: 1,
            borderBottomColor: BORDER,
          }}
        >
          <Pressable
            onPress={() => setYear((y) => y - 1)}
            hitSlop={8}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderRadius: 8,
              backgroundColor: pressed ? MUTED : SURFACE,
              borderWidth: 1,
              borderColor: BORDER,
            })}
          >
            <ChevronLeft size={12} color={TEXT_MUTED} strokeWidth={2.5} />
            <Text style={{ fontSize: 11, fontWeight: "700", color: TEXT_MUTED }}>{year - 1}</Text>
          </Pressable>

          <Text style={{ fontSize: 14, fontWeight: "900", color: "#ffffff", minWidth: 40, textAlign: "center" }}>
            {year}
          </Text>

          {year < currentYear ? (
            <Pressable
              onPress={() => setYear((y) => y + 1)}
              hitSlop={8}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: 8,
                backgroundColor: pressed ? MUTED : SURFACE,
                borderWidth: 1,
                borderColor: BORDER,
              })}
            >
              <Text style={{ fontSize: 11, fontWeight: "700", color: TEXT_MUTED }}>{year + 1}</Text>
              <ChevronRight size={12} color={TEXT_MUTED} strokeWidth={2.5} />
            </Pressable>
          ) : (
            // Phantom element to keep year label centered
            <View style={{ width: 60 }} />
          )}
        </View>

        {/* Category chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ flexDirection: "row", gap: 6, paddingHorizontal: 16, paddingVertical: 10 }}
        >
          {/* "All" chip */}
          <Pressable
            onPress={() => setFilterCategory("")}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 20,
              borderWidth: 1,
              backgroundColor: !filterCategory ? "#052e16" : SURFACE,
              borderColor: !filterCategory ? "#166534" : BORDER,
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: "700", color: !filterCategory ? "#4ade80" : TEXT_MUTED }}>
              All categories
            </Text>
          </Pressable>

          {expenseCategories.map((cat) => {
            const active = filterCategory === cat.id;
            return (
              <Pressable
                key={cat.id}
                onPress={() => setFilterCategory(active ? "" : cat.id)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 5,
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 20,
                  borderWidth: 1,
                  backgroundColor: active ? "#052e16" : SURFACE,
                  borderColor: active ? "#166534" : BORDER,
                }}
              >
                <Text style={{ fontSize: 13, lineHeight: 16 }}>{cat.icon}</Text>
                <Text style={{ fontSize: 11, fontWeight: "700", color: active ? "#4ade80" : TEXT_MUTED }}>
                  {cat.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Deductible toggle */}
        <View style={{ flexDirection: "row", gap: 6, paddingHorizontal: 16, paddingBottom: 10 }}>
          {([
            { key: "all" as const, label: "All" },
            { key: "yes" as const, label: "Deductible" },
            { key: "no"  as const, label: "Non-deductible" },
          ]).map(({ key, label }) => {
            const active = filterDeductible === key;
            return (
              <Pressable
                key={key}
                onPress={() => setFilterDeductible(key)}
                style={{
                  paddingHorizontal: 11,
                  paddingVertical: 5,
                  borderRadius: 8,
                  borderWidth: 1,
                  backgroundColor: active
                    ? key === "yes" ? "#052e16" : key === "no" ? "#1c0a0a" : SURFACE
                    : SURFACE,
                  borderColor: active
                    ? key === "yes" ? "#166534" : key === "no" ? "#7f1d1d" : MUTED
                    : BORDER,
                }}
              >
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: "800",
                    letterSpacing: 0.4,
                    textTransform: "uppercase",
                    color: active
                      ? key === "yes" ? "#4ade80" : key === "no" ? "#f87171" : "#ffffff"
                      : TEXT_DIM,
                  }}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* ── Content ──────────────────────────────────────────────────── */}
      {isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12 }}>
          <ActivityIndicator size="large" color="#15803d" />
          <Text style={{ fontSize: 12, color: TEXT_MUTED, fontWeight: "500" }}>Loading expenses…</Text>
        </View>
      ) : !hasItems ? (
        <View style={{ flex: 1, justifyContent: "center" }}>
          <EmptyState
            icon="receipt"
            title={isFiltered ? "No matching expenses" : "No expenses yet"}
            message={
              isFiltered
                ? "Clear your filters to see all expenses."
                : "Tap Add to log your first expense."
            }
            actionLabel="Add Expense"
            onAction={() => router.push("/expense/add")}
          />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
        >
          {filteredSections.map((section) => {
            const sectionTotal = section.items.reduce((sum, e) => sum + e.amount, 0);
            return (
              <View key={section.monthKey}>
                <MonthLabel label={section.label} total={sectionTotal} />
                <View style={{ paddingHorizontal: 16, gap: 8 }}>
                  {section.items.map((expense) => (
                    <ExpenseRow
                      key={expense.id}
                      expense={expense}
                      country={country}
                      customCategories={customCategories}
                      onPress={() =>
                        router.push({ pathname: "/expense/add", params: { expenseId: expense.id } })
                      }
                      onDelete={() => handleDelete(expense.id)}
                    />
                  ))}
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
