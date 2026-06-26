import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import {
  ScrollView,
  View,
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  TouchableOpacity,
  StyleSheet,
  Modal,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Plus, Trash2, ArrowDownRight, ArrowUpRight } from "lucide-react-native";
import Svg, { Path } from "react-native-svg";
import { Text } from "@/src/components/ui/text";
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
import { usePlatformTheme } from "@/src/hooks/usePlatformTheme";

export { getExpenseCategories, getCategoryMeta, type ExpenseCategory };
export type ExpenseCategoryId = string;

const isWeb = Platform.OS === "web";

// ─── Custom Icons ────────────────────────────────────────────────────────────
const ChevronLeft = ({ size = 22, color = "#fff" }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
    <Path d="m15 18-6-6 6-6" />
  </Svg>
);

const ChevronRight = ({ size = 22, color = "#fff" }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
    <Path d="m9 18 6-6-6-6" />
  </Svg>
);

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

// ─── Formatting Helper ────────────────────────────────────────────────────────
function formatCurrency(value: number, country: string) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: country === "CA" ? "CAD" : "USD",
  }).format(value);
}

function formatCurrencyParts(value: number, country: string) {
  const parts = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: country === "CA" ? "CAD" : "USD",
  }).formatToParts(value);

  return {
    symbol: parts.find((p) => p.type === "currency")?.value || "$",
    value: parts.filter((p) => p.type !== "currency").map((p) => p.value).join(""),
  };
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

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
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        backgroundColor: "#0d0d0d",
        borderWidth: 0.8,
        borderColor: "#1f1f1f",
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 14,
        marginBottom: 10,
      }}
    >
      <View
        style={{
          width: 46,
          height: 46,
          backgroundColor: "#161615",
          borderWidth: 1,
          borderColor: "#262522",
          borderRadius: 14,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ fontSize: 20 }}>{cat.icon}</Text>
      </View>

      <View style={{ flex: 1, gap: 4 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <Text style={{ fontSize: 15, fontWeight: "800", color: "#ffffff" }}>
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
              <Text style={{ fontSize: 9, fontWeight: "900", color: "#4ade80", textTransform: "uppercase" }}>
                Tax Deductible
              </Text>
            </View>
          )}
        </View>
        <Text style={{ fontSize: 12, color: "#71717a", fontWeight: "600" }}>
          {dateLabel}
          {expense.notes ? ` · ${expense.notes}` : ""}
        </Text>
      </View>

      <View style={{ alignItems: "flex-end", gap: 6 }}>
        <Text style={{ fontSize: 16, fontWeight: "900", color: "#f87171", letterSpacing: -0.5 }}>
          -{formatCurrency(expense.amount, country)}
        </Text>
        <TouchableOpacity
          onPress={onDelete}
          hitSlop={10}
          style={{
            padding: 6,
            borderRadius: 8,
            backgroundColor: "#2e0f0f",
            borderWidth: 1,
            borderColor: "#451a1a",
          }}
        >
          <Trash2 size={12} color="#f87171" strokeWidth={2.5} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function ExpensesScreen() {
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { isOnboardingCompleted, profile, setHeaderVisible } = useSettingsStore();
  const { accentColor, accentColorContrast } = usePlatformTheme();

  const lastScrollY = useRef(0);
  const handleScroll = (event: any) => {
    const currentY = event.nativeEvent.contentOffset.y;
    const diff = currentY - lastScrollY.current;
    const contentHeight = event.nativeEvent.contentSize.height;
    const layoutHeight = event.nativeEvent.layoutMeasurement.height;
    const isNearBottom = currentY + layoutHeight >= contentHeight - 40;

    if (currentY <= 0 || isNearBottom) {
      setHeaderVisible(true);
    } else if (diff > 15 && currentY > 50) {
      setHeaderVisible(false);
    } else if (diff < -15) {
      setHeaderVisible(true);
    }
    lastScrollY.current = currentY;
  };

  useEffect(() => {
    setHeaderVisible(true);
  }, []);

  const country = profile?.country ?? "CA";
  const customCategories = profile?.customCategories ?? [];
  const expenseCategories = getExpenseCategories(country, customCategories);

  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const [isMonthSelectorOpen, setIsMonthSelectorOpen] = useState(false);
  const [selectorYear, setSelectorYear] = useState(new Date().getFullYear());

  const [filterCategory, setFilterCategory] = useState<string>("");
  const [filterDeductible, setFilterDeductible] = useState<DeductibleFilter>("all");
  const [selectedWeekIndex, setSelectedWeekIndex] = useState<number | null>(null);
  const [isFiltersVisible, setIsFiltersVisible] = useState(false);

  const year = selectedMonth.getFullYear();
  const monthKey = `${year}-${String(selectedMonth.getMonth() + 1).padStart(2, "0")}`;

  const { data: monthSections = [], isLoading } = useQuery<MonthSection[]>({
    queryKey: ["expenses", "by-month", year],
    queryFn: () => getExpensesByMonth(year),
    enabled: isOnboardingCompleted,
  });

  const { data: selectorYearSections = [] } = useQuery<MonthSection[]>({
    queryKey: ["expenses", "by-month", selectorYear],
    queryFn: () => getExpensesByMonth(selectorYear),
    enabled: isOnboardingCompleted && isMonthSelectorOpen, // only load if modal is open
  });

  const { data: ytdSummary } = useQuery({
    queryKey: ["expenses", "ytd"],
    queryFn: () => getExpenseYTDSummary(),
    enabled: isOnboardingCompleted,
  });

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

  const rawCurrentMonthData = useMemo(() => {
    return monthSections.find(m => m.monthKey === monthKey)?.items || [];
  }, [monthSections, monthKey]);

  const currentMonthData = useMemo(() => {
    return rawCurrentMonthData.filter(e => {
      if (filterCategory && e.category !== filterCategory) return false;
      if (filterDeductible === "yes" && !e.isDeductible) return false;
      if (filterDeductible === "no" && e.isDeductible) return false;
      return true;
    });
  }, [rawCurrentMonthData, filterCategory, filterDeductible]);

  const modalMonthsList = useMemo(() => {
    const currentRealDate = new Date();
    const currentRealYear = currentRealDate.getFullYear();
    const currentRealMonth = currentRealDate.getMonth();
    
    const maxMonthIndex = selectorYear === currentRealYear ? currentRealMonth : 11;
    const length = maxMonthIndex + 1;

    return Array.from({ length }, (_, i) => {
      const monthIndex = maxMonthIndex - i; // Descending
      const mDate = new Date(selectorYear, monthIndex, 1);
      const mKey = `${selectorYear}-${String(monthIndex + 1).padStart(2, "0")}`;
      const mData = selectorYearSections.find((s) => s.monthKey === mKey);
      
      const items = mData?.items || [];
      const total = items.reduce((sum, e) => sum + e.amount, 0);
      
      const daysInM = new Date(selectorYear, monthIndex + 1, 0).getDate();
      const w = [
        { min: 1, max: 7, total: 0 },
        { min: 8, max: 14, total: 0 },
        { min: 15, max: 21, total: 0 },
        { min: 22, max: daysInM, total: 0 },
      ];
      items.forEach(exp => {
        const d = new Date(exp.date).getDate();
        const week = w.find(wk => d >= wk.min && d <= wk.max);
        if (week) week.total += exp.amount;
      });
      
      const maxW = Math.max(...w.map(wk => wk.total), 0);

      return {
        date: mDate,
        label: mDate.toLocaleDateString("en-US", { month: "long" }),
        total,
        weeks: w,
        maxWeek: maxW,
      };
    });
  }, [selectorYear, selectorYearSections]);

  const { totalMonthAmount, maxWeekTotal, weeks } = useMemo(() => {
    const daysInMonth = new Date(year, selectedMonth.getMonth() + 1, 0).getDate();
    const w = [
      { label: "Week 1", min: 1, max: 7, total: 0, items: [] as ExpenseItem[] },
      { label: "Week 2", min: 8, max: 14, total: 0, items: [] as ExpenseItem[] },
      { label: "Week 3", min: 15, max: 21, total: 0, items: [] as ExpenseItem[] },
      { label: "Week 4", min: 22, max: daysInMonth, total: 0, items: [] as ExpenseItem[] },
    ];

    let total = 0;
    currentMonthData.forEach(exp => {
      total += exp.amount;
      const day = new Date(exp.date).getDate();
      const week = w.find(wk => day >= wk.min && day <= wk.max);
      if (week) {
        week.total += exp.amount;
        week.items.push(exp);
      }
    });

    const max = Math.max(...w.map(wk => wk.total), 0);

    return { totalMonthAmount: total, maxWeekTotal: max, weeks: w };
  }, [currentMonthData, year, selectedMonth]);

  const displayedExpenses = useMemo(() => {
    if (selectedWeekIndex !== null && weeks[selectedWeekIndex]) {
      return weeks[selectedWeekIndex].items;
    }
    return currentMonthData;
  }, [currentMonthData, weeks, selectedWeekIndex]);

  const handlePrevMonth = () => {
    setSelectedWeekIndex(null);
    setSelectedMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    const nextMonth = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 1);
    const currentMonth = new Date();
    currentMonth.setDate(1);
    currentMonth.setHours(0,0,0,0);
    
    if (nextMonth <= currentMonth) {
      setSelectedWeekIndex(null);
      setSelectedMonth(nextMonth);
    }
  };

  const isCurrentOrFutureMonth = selectedMonth.getFullYear() === new Date().getFullYear() && selectedMonth.getMonth() >= new Date().getMonth();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#000" }} edges={["bottom", "left", "right"]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100, paddingTop: insets.top + 64 }}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        
        {/* ── Screen header ── */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16 }}>
          <View>
            <Text style={{ fontSize: 24, fontWeight: "900", color: "#ffffff", letterSpacing: -0.5 }}>Expenses</Text>
            <Text style={{ fontSize: 13, color: "#71717a", fontWeight: "600", marginTop: 2 }}>Track deductible costs</Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push("/expense/add")}
            style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: accentColor, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14 }}
          >
            <Plus size={16} color={accentColorContrast} strokeWidth={3} />
            <Text style={{ fontSize: 13, fontWeight: "800", color: accentColorContrast, letterSpacing: 0.5, textTransform: "uppercase" }}>Add</Text>
          </TouchableOpacity>
        </View>

        {/* ── Header & Nav (Similar to Shifts) ── */}
        <View style={styles.headerContainer}>
          <Pressable onPress={() => { setSelectorYear(selectedMonth.getFullYear()); setIsMonthSelectorOpen(true); }} style={styles.weekLabelContainer}>
            <Text style={styles.weekLabel}>
              {selectedMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </Text>
            <View style={{ justifyContent: "center", alignItems: "center", marginLeft: 6 }}>
              <Svg width={10} height={6} viewBox="0 0 10 6" fill="none">
                <Path d="M1 1L5 5L9 1" stroke="#a1a1aa" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </View>
          </Pressable>

          <View style={styles.navigationRow}>
            <Pressable onPress={handlePrevMonth} style={styles.arrowBtn}>
              <ChevronLeft color="#fff" />
            </Pressable>

            <View style={styles.amountRow}>
              <Text style={styles.amountSymbol}>{formatCurrencyParts(totalMonthAmount, country).symbol}</Text>
              <Text style={styles.amountText} numberOfLines={1} adjustsFontSizeToFit>
                {formatCurrencyParts(totalMonthAmount, country).value}
              </Text>
            </View>

            <Pressable
              onPress={handleNextMonth}
              disabled={isCurrentOrFutureMonth}
              style={[styles.arrowBtn, isCurrentOrFutureMonth && { opacity: 0.35 }]}
            >
              <ChevronRight color={isCurrentOrFutureMonth ? "#3f3f46" : "#fff"} />
            </Pressable>
          </View>
        </View>

        {/* ── Bar Chart Graph ── */}
        <View style={styles.chartContainer}>
          {maxWeekTotal > 0 && (
            <View style={styles.highLineOverlay} pointerEvents="none">
              <View style={styles.dashedLine} />
              <View style={styles.highBadge}>
                <Text style={styles.highBadgeText}>HIGH: {formatCurrency(maxWeekTotal, country)}</Text>
              </View>
            </View>
          )}

          <View style={styles.chartRow}>
            {weeks.map((week, idx) => {
              const isSelected = selectedWeekIndex === idx;
              const barHeightPct = maxWeekTotal > 0 ? (week.total / maxWeekTotal) * 100 : 0;
              return (
                <Pressable key={idx} onPress={() => setSelectedWeekIndex(isSelected ? null : idx)} style={styles.chartCol}>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          height: `${Math.max(barHeightPct, week.total > 0 ? 8 : 2)}%`,
                          backgroundColor: accentColor,
                          opacity: selectedWeekIndex === null || isSelected ? 1 : 0.35,
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.chartDayLabel, {
                    color: isSelected ? accentColor : "#71717a",
                    fontWeight: isSelected ? "800" : "600",
                  }]}>W{idx + 1}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* ── YTD summary Bento ── */}
        <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1, backgroundColor: "#0d0d0d", borderWidth: 0.8, borderColor: "#1f1f1f", borderRadius: 20, padding: 16 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <View style={{ backgroundColor: "#052e16", padding: 4, borderRadius: 8 }}>
                  <ArrowDownRight size={14} color="#4ade80" />
                </View>
                <Text style={{ fontSize: 10, fontWeight: "800", color: "#71717a", textTransform: "uppercase", letterSpacing: 1 }}>Deductible YTD</Text>
              </View>
              <Text style={{ fontSize: 32, fontWeight: "800", color: "#ffffff", letterSpacing: -1 }} numberOfLines={1} adjustsFontSizeToFit>
                {formatCurrency(ytdSummary?.deductible ?? 0, country)}
              </Text>
            </View>
            <View style={{ flex: 1, backgroundColor: "#0d0d0d", borderWidth: 0.8, borderColor: "#1f1f1f", borderRadius: 20, padding: 16 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <View style={{ backgroundColor: "#2e0f0f", padding: 4, borderRadius: 8 }}>
                  <ArrowUpRight size={14} color="#f87171" />
                </View>
                <Text style={{ fontSize: 10, fontWeight: "800", color: "#71717a", textTransform: "uppercase", letterSpacing: 1 }}>Standard YTD</Text>
              </View>
              <Text style={{ fontSize: 32, fontWeight: "800", color: "#ffffff", letterSpacing: -1 }} numberOfLines={1} adjustsFontSizeToFit>
                {formatCurrency(ytdSummary?.nonDeductible ?? 0, country)}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Transactions Header & Filter Toggle ── */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, marginBottom: 12 }}>
          <Text style={{ fontSize: 18, fontWeight: "800", color: "#ffffff", letterSpacing: -0.5 }}>Transactions</Text>
          <TouchableOpacity
            onPress={() => setIsFiltersVisible(!isFiltersVisible)}
            style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: "#161615", borderWidth: 1, borderColor: isFiltersVisible ? accentColor : "#262522" }}
          >
            <Text style={{ fontSize: 11, fontWeight: "800", color: isFiltersVisible ? accentColor : "#71717a", textTransform: "uppercase" }}>Filters</Text>
          </TouchableOpacity>
        </View>

        {/* ── Filters ── */}
        {isFiltersVisible && (
          <View style={{ paddingBottom: 12 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingBottom: 8 }}>
            <TouchableOpacity
              onPress={() => setFilterCategory("")}
              style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, backgroundColor: !filterCategory ? accentColor + "20" : "#161615", borderColor: !filterCategory ? accentColor : "#262522" }}
            >
              <Text style={{ fontSize: 12, fontWeight: "800", color: !filterCategory ? accentColor : "#71717a" }}>All Categories</Text>
            </TouchableOpacity>
            {expenseCategories.map((cat) => {
              const active = filterCategory === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  onPress={() => setFilterCategory(active ? "" : cat.id)}
                  style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, backgroundColor: active ? accentColor + "20" : "#161615", borderColor: active ? accentColor : "#262522" }}
                >
                  <Text style={{ fontSize: 14 }}>{cat.icon}</Text>
                  <Text style={{ fontSize: 12, fontWeight: "800", color: active ? accentColor : "#71717a" }}>{cat.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 16, marginTop: 4 }}>
            {([{ key: "all" as const, label: "All Types" }, { key: "yes" as const, label: "Deductible Only" }, { key: "no" as const, label: "Standard Only" }]).map(({ key, label }) => {
              const active = filterDeductible === key;
              return (
                <TouchableOpacity
                  key={key}
                  onPress={() => setFilterDeductible(key)}
                  style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, backgroundColor: active ? (key === "yes" ? "#052e16" : key === "no" ? "#2e0f0f" : "#262522") : "#161615", borderColor: active ? (key === "yes" ? "#166534" : key === "no" ? "#451a1a" : "#3f3f46") : "#262522" }}
                >
                  <Text style={{ fontSize: 10, fontWeight: "800", textTransform: "uppercase", color: active ? (key === "yes" ? "#4ade80" : key === "no" ? "#f87171" : "#ffffff") : "#52525b" }}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
        )}

        {/* ── List Content ── */}
        {isLoading ? (
          <View style={{ padding: 40, alignItems: "center" }}>
            <ActivityIndicator size="large" color={accentColor} />
          </View>
        ) : displayedExpenses.length === 0 ? (
          <View style={{ padding: 20 }}>
            <EmptyState icon="receipt" title="No expenses found" message={selectedWeekIndex !== null ? "No expenses were recorded for this week." : "No expenses were recorded for this month with the current filters."} actionLabel="Add Expense" onAction={() => router.push("/expense/add")} />
          </View>
        ) : (
          <View style={{ paddingHorizontal: 16, gap: 10, paddingBottom: 40 }}>
            {displayedExpenses.map((expense) => (
              <ExpenseRow
                key={expense.id}
                expense={expense}
                country={country}
                customCategories={customCategories}
                onPress={() => router.push({ pathname: "/expense/add", params: { expenseId: expense.id } })}
                onDelete={() => handleDelete(expense.id)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {/* ── Month Selector Modal ── */}
      <Modal visible={isMonthSelectorOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setIsMonthSelectorOpen(false)}>
        <View style={styles.modalRoot}>
          <View style={[styles.modalHeader, { paddingTop: Platform.OS === 'ios' ? 16 : insets.top + 16 }]}>
            <Text style={styles.modalTitle}>{selectorYear} Expenses</Text>
            <Pressable onPress={() => setIsMonthSelectorOpen(false)}>
              <Text style={[styles.closeBtnText, { color: accentColor }]}>Done</Text>
            </Pressable>
          </View>

          <View style={styles.tableHeader}>
            <Text style={styles.tableHeaderLeft}>MONTH</Text>
            <Text style={styles.tableHeaderRight}>YTD DEDUCTIBLE: {formatCurrency(ytdSummary?.deductible ?? 0, country)}</Text>
          </View>

          <ScrollView contentContainerStyle={styles.modalScroll}>
            {modalMonthsList.map((m, idx) => (
              <Pressable
                key={idx}
                onPress={() => {
                  setSelectedMonth(m.date);
                  setIsMonthSelectorOpen(false);
                }}
                style={[
                  styles.weekCard,
                  selectedMonth.getFullYear() === m.date.getFullYear() && selectedMonth.getMonth() === m.date.getMonth()
                    ? { borderColor: accentColor, backgroundColor: accentColor + "10" }
                    : {}
                ]}
              >
                <View style={styles.weekInfo}>
                  <Text style={styles.weekRangeText}>{m.label} {selectorYear}</Text>
                  <Text style={styles.weekAmountText}>{formatCurrency(m.total, country)}</Text>
                </View>
                
                <View style={styles.miniGraph}>
                  {m.weeks.map((week, wIdx) => {
                    const barHeightPct = m.maxWeek > 0 ? (week.total / m.maxWeek) * 100 : 0;
                    return (
                      <View key={wIdx} style={styles.miniGraphCol}>
                        <View style={styles.miniBarTrack}>
                          <View
                            style={[
                              styles.miniBarFill,
                              {
                                height: `${Math.max(barHeightPct, week.total > 0 ? 8 : 2)}%`,
                                backgroundColor: accentColor,
                              },
                            ]}
                          />
                        </View>
                        <Text style={styles.miniDateText}>W{wIdx + 1}</Text>
                      </View>
                    );
                  })}
                </View>
              </Pressable>
            ))}
          </ScrollView>

          <View style={[styles.modalFooter, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <Pressable onPress={() => setSelectorYear(y => y - 1)} style={styles.pageBtn}>
              <Text style={styles.pageBtnText}>Previous Year</Text>
            </Pressable>
            <Text style={styles.pageIndicator}>{selectorYear}</Text>
            <Pressable
              onPress={() => setSelectorYear(y => y + 1)}
              style={[styles.pageBtn, selectorYear >= new Date().getFullYear() && styles.pageBtnDisabled]}
              disabled={selectorYear >= new Date().getFullYear()}
            >
              <Text style={styles.pageBtnText}>Next Year</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  headerContainer: {
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  weekLabelContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#161615",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 0.8,
    borderColor: "#262522",
    marginBottom: 20,
    alignSelf: "center",
  },
  weekLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: "#a1a1aa",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  navigationRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
  },
  arrowBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#161615",
    borderWidth: 0.8,
    borderColor: "#262522",
    justifyContent: "center",
    alignItems: "center",
  },
  amountRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    flexShrink: 1,
    minWidth: 0,
  },
  amountSymbol: {
    fontSize: 24,
    fontWeight: "600",
    color: "#f87171",
    lineHeight: 30,
    marginTop: 10,
    marginRight: 4,
  },
  amountText: {
    flexShrink: 1,
    fontSize: 40,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.5,
    lineHeight: 48,
    paddingVertical: 2,
    includeFontPadding: false,
  },
  chartContainer: {
    backgroundColor: "#0d0d0d",
    borderRadius: 20,
    borderWidth: 0.8,
    borderColor: "#1f1f1f",
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 20,
  },
  highLineOverlay: {
    position: "absolute",
    left: 16,
    right: 16,
    top: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 1,
  },
  dashedLine: {
    flex: 1,
    height: 1,
    borderStyle: "dashed",
    borderWidth: 1,
    borderColor: "rgba(113, 113, 122, 0.25)",
  },
  highBadge: {
    backgroundColor: "#0d0d0d",
    paddingLeft: 8,
  },
  highBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#a1a1aa",
    letterSpacing: 0.5,
  },
  chartRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    height: 100,
  },
  chartCol: {
    alignItems: "center",
    flex: 1,
    height: "100%",
    justifyContent: "flex-end",
    gap: 8,
  },
  barTrack: {
    width: 14,
    height: 64,
    backgroundColor: "#161615",
    borderRadius: 7,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  barFill: {
    width: "100%",
    borderRadius: 7,
  },
  chartDayLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#71717a",
  },
  modalRoot: { flex: 1, backgroundColor: "#000" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 0.5, borderBottomColor: "#1f1f1f" },
  modalTitle: { fontSize: 18, fontWeight: "800", color: "#fff" },
  closeBtnText: { fontSize: 14, fontWeight: "600" },
  tableHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 22, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: "#111" },
  tableHeaderLeft: { fontSize: 11, fontWeight: "700", color: "#71717a", textTransform: "uppercase", letterSpacing: 0.5 },
  tableHeaderRight: { fontSize: 10, fontWeight: "800", color: "#71717a", letterSpacing: 0.4 },
  modalScroll: { paddingVertical: 8 },
  weekCard: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderWidth: 0.8, borderColor: "#1f1f1f", backgroundColor: "#0d0d0d", borderRadius: 20, marginHorizontal: 16, marginVertical: 6 },
  weekInfo: { gap: 4 },
  weekRangeText: { fontSize: 12, fontWeight: "600", color: "#a1a1aa" },
  weekAmountText: { fontSize: 18, fontWeight: "900", color: "#fff", letterSpacing: -0.4 },
  miniGraph: { flexDirection: "row", alignItems: "flex-end", gap: 4 },
  miniGraphCol: { alignItems: "center", gap: 4 },
  miniBarTrack: { width: 8, height: 32, backgroundColor: "#161615", borderRadius: 4, overflow: "hidden", justifyContent: "flex-end" },
  miniBarFill: { width: "100%", borderRadius: 4 },
  miniDateText: { fontSize: 8, fontWeight: "700", color: "#71717a" },
  modalFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 0.5, borderTopColor: "#1f1f1f", backgroundColor: "#000" },
  pageBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, backgroundColor: "#161615", borderWidth: 0.8, borderColor: "#262522" },
  pageBtnDisabled: { opacity: 0.35 },
  pageBtnText: { fontSize: 12, fontWeight: "700", color: "#fff" },
  pageIndicator: { fontSize: 12, fontWeight: "600", color: "#71717a" },
});
