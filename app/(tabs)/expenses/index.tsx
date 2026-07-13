import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import {
  FlatList,
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
import { ExpenseCategoryIcon } from "@/src/components/ui/ExpenseCategoryIcon";
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
import { useLayout } from "@/src/hooks/useLayout";
import { withAlpha } from "@/src/theme/colors";
import { useColors, useThemedStyles, type Palette } from "@/src/theme/useColors";
import { useDueRecurringExpense } from "@/hooks/useDueRecurringExpense";
import { materializeRecurringOccurrence, snoozeRecurringExpense } from "@/src/services/recurringExpenses";
import { FeedbackDialog } from "@/src/components/ui/FeedbackDialog";

export { getExpenseCategories, getCategoryMeta, type ExpenseCategory };
export type ExpenseCategoryId = string;

const isWeb = Platform.OS === "web";

// ─── Custom Icons ────────────────────────────────────────────────────────────
const ChevronLeft = ({ size = 22, color }: { size?: number; color?: string }) => {
  const C = useColors();
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color ?? C.contentPrimary} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
      <Path d="m15 18-6-6 6-6" />
    </Svg>
  );
};

const ChevronRight = ({ size = 22, color }: { size?: number; color?: string }) => {
  const C = useColors();
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color ?? C.contentPrimary} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
      <Path d="m9 18 6-6-6-6" />
    </Svg>
  );
};

type ExpenseItem = {
  id: string;
  category: string;
  amount: number;
  date: string;
  notes?: string;
  isDeductible: boolean;
  isRecurring?: boolean;
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
  const C = useColors();
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
        backgroundColor: C.surface02,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: C.lineSubtle,
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        marginBottom: 10,
      }}
    >
      <View
        style={{
          width: 46,
          height: 46,
          backgroundColor: C.surface03,
          borderWidth: 1,
          borderColor: C.lineSubtle,
          borderRadius: 12,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ExpenseCategoryIcon id={expense.category} size={20} color={C.contentSecondary} />
      </View>

      <View style={{ flex: 1, gap: 4 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <Text variant="labelM">
            {cat.label}
          </Text>
          {expense.isDeductible && (
            <View
              style={{
                paddingHorizontal: 6,
                paddingVertical: 2,
                backgroundColor: withAlpha(C.success, 0.12),
                borderWidth: 1,
                borderColor: withAlpha(C.success, 0.25),
                borderRadius: 8,
              }}
            >
              <Text variant="labelXs" className="text-success">
                Tax Deductible
              </Text>
            </View>
          )}
          {expense.isRecurring && (
            <View
              style={{
                paddingHorizontal: 6,
                paddingVertical: 2,
                backgroundColor: withAlpha(C.info, 0.12),
                borderWidth: 1,
                borderColor: withAlpha(C.info, 0.25),
                borderRadius: 8,
              }}
            >
              <Text variant="labelXs" style={{ color: C.info }}>
                Recurring
              </Text>
            </View>
          )}
        </View>
        <Text variant="paragraphS" className="text-content-secondary">
          {dateLabel}
          {expense.notes ? ` · ${expense.notes}` : ""}
        </Text>
      </View>

      <View style={{ alignItems: "flex-end", gap: 6 }}>
        <Text variant="labelL" tabular className="text-destructive">
          -{formatCurrency(expense.amount, country)}
        </Text>
        <TouchableOpacity
          onPress={onDelete}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Delete expense"
          style={{
            padding: 6,
            borderRadius: 8,
            backgroundColor: withAlpha(C.destructive, 0.12),
            borderWidth: 1,
            borderColor: withAlpha(C.destructive, 0.25),
          }}
        >
          <Trash2 size={12} color={C.destructive} strokeWidth={2.5} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const keyExtractor = (item: ExpenseItem) => item.id;

const ItemSeparator = () => <View style={{ height: 10 }} />;

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function ExpensesScreen() {
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { isOnboardingCompleted, profile, setHeaderVisible } = useSettingsStore();
  const { accentColor, accentColorContrast } = usePlatformTheme();
  const C = useColors();
  const styles = useThemedStyles(makeStyles);
  const { gridStyle, dialogStyle } = useLayout();

  // Recurring expense reminder — once per app session, fires when this tab is opened.
  const { dueExpense: dueRecurringExpense, dismiss: dismissDueRecurring } = useDueRecurringExpense(isOnboardingCompleted);
  const [isResolvingRecurring, setIsResolvingRecurring] = useState(false);

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

  const renderExpenseItem = ({ item }: { item: ExpenseItem }) => (
    <View style={{ paddingHorizontal: 16 }}>
      <ExpenseRow
        expense={item}
        country={country}
        customCategories={customCategories}
        onPress={() => router.push({ pathname: "/expense/[id]", params: { id: item.id } })}
        onDelete={() => handleDelete(item.id)}
      />
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.background }} edges={["bottom", "left", "right"]}>
      <FlatList
        data={displayedExpenses}
        keyExtractor={keyExtractor}
        renderItem={renderExpenseItem}
        ItemSeparatorComponent={ItemSeparator}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[{ paddingBottom: 100, paddingTop: insets.top + 64 }, gridStyle]}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        ListHeaderComponent={
          <>
        
            {/* ── Screen header ── */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16 }}>
              <View>
                <Text variant="headingL">Expenses</Text>
                <Text variant="paragraphS" className="text-content-secondary" style={{ marginTop: 2 }}>Track deductible costs</Text>
              </View>
              <TouchableOpacity
                onPress={() => router.push("/expense/add")}
                accessibilityRole="button"
                activeOpacity={0.8}
                style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: accentColor, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 }}
              >
                <Plus size={16} color={accentColorContrast} strokeWidth={3} />
                <Text variant="labelM" className="uppercase" style={{ color: accentColorContrast, letterSpacing: 0.5 }}>Add</Text>
              </TouchableOpacity>
            </View>

            {/* ── Header & Nav (Similar to Shifts) ── */}
            <View style={styles.headerContainer}>
              <Pressable
                onPress={() => { setSelectorYear(selectedMonth.getFullYear()); setIsMonthSelectorOpen(true); }}
                accessibilityRole="button"
                accessibilityLabel="Change month"
                style={styles.weekLabelContainer}
              >
                <Text variant="labelXs" className="text-content-secondary">
                  {selectedMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                </Text>
                <View style={{ justifyContent: "center", alignItems: "center", marginLeft: 6 }}>
                  <Svg width={10} height={6} viewBox="0 0 10 6" fill="none">
                    <Path d="M1 1L5 5L9 1" stroke={C.contentSecondary} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                </View>
              </Pressable>

              <View style={styles.navigationRow}>
                <Pressable
                  onPress={handlePrevMonth}
                  accessibilityRole="button"
                  accessibilityLabel="Previous month"
                  style={styles.arrowBtn}
                >
                  <ChevronLeft color={C.contentPrimary} />
                </Pressable>

                <View style={styles.amountRow}>
                  <Text style={styles.amountSymbol}>{formatCurrencyParts(totalMonthAmount, country).symbol}</Text>
                  <Text style={styles.amountText} tabular numberOfLines={1} adjustsFontSizeToFit>
                    {formatCurrencyParts(totalMonthAmount, country).value}
                  </Text>
                </View>

                <Pressable
                  onPress={handleNextMonth}
                  disabled={isCurrentOrFutureMonth}
                  accessibilityRole="button"
                  accessibilityLabel="Next month"
                  accessibilityState={{ disabled: isCurrentOrFutureMonth }}
                  style={[styles.arrowBtn, isCurrentOrFutureMonth && { opacity: 0.35 }]}
                >
                  <ChevronRight color={isCurrentOrFutureMonth ? C.contentDisabled : C.contentPrimary} />
                </Pressable>
              </View>
            </View>

            {/* ── Bar Chart Graph ── */}
            <View style={styles.chartContainer}>
              {maxWeekTotal > 0 && (
                <View style={styles.highLineOverlay} pointerEvents="none">
                  <View style={styles.dashedLine} />
                  <View style={styles.highBadge}>
                    <Text variant="labelXs" tabular className="text-content-secondary">HIGH: {formatCurrency(maxWeekTotal, country)}</Text>
                  </View>
                </View>
              )}

              <View style={styles.chartRow}>
                {weeks.map((week, idx) => {
                  const isSelected = selectedWeekIndex === idx;
                  const barHeightPct = maxWeekTotal > 0 ? (week.total / maxWeekTotal) * 100 : 0;
                  return (
                    <Pressable
                      key={idx}
                      onPress={() => setSelectedWeekIndex(isSelected ? null : idx)}
                      accessibilityRole="button"
                      accessibilityLabel={`Week ${idx + 1}`}
                      accessibilityState={{ selected: isSelected }}
                      style={styles.chartCol}
                    >
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
                      <Text variant="labelXs" style={{ color: isSelected ? accentColor : C.contentSecondary }}>W{idx + 1}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* ── YTD summary Bento ── */}
            <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
              <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ flex: 1, backgroundColor: C.surface02, borderWidth: StyleSheet.hairlineWidth, borderColor: C.lineSubtle, borderRadius: 16, padding: 16 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
                    <View style={{ backgroundColor: withAlpha(C.success, 0.12), padding: 4, borderRadius: 8 }}>
                      <ArrowDownRight size={14} color={C.success} />
                    </View>
                    <Text variant="labelXs" className="text-content-secondary">Deductible YTD</Text>
                  </View>
                  <Text tabular style={{ fontSize: 32, fontWeight: "800", color: C.contentPrimary, letterSpacing: -0.5, lineHeight: 38, paddingVertical: 2, includeFontPadding: false }} numberOfLines={1} adjustsFontSizeToFit>
                    {formatCurrency(ytdSummary?.deductible ?? 0, country)}
                  </Text>
                </View>
                <View style={{ flex: 1, backgroundColor: C.surface02, borderWidth: StyleSheet.hairlineWidth, borderColor: C.lineSubtle, borderRadius: 16, padding: 16 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
                    <View style={{ backgroundColor: withAlpha(C.destructive, 0.12), padding: 4, borderRadius: 8 }}>
                      <ArrowUpRight size={14} color={C.destructive} />
                    </View>
                    <Text variant="labelXs" className="text-content-secondary">Standard YTD</Text>
                  </View>
                  <Text tabular style={{ fontSize: 32, fontWeight: "800", color: C.contentPrimary, letterSpacing: -0.5, lineHeight: 38, paddingVertical: 2, includeFontPadding: false }} numberOfLines={1} adjustsFontSizeToFit>
                    {formatCurrency(ytdSummary?.nonDeductible ?? 0, country)}
                  </Text>
                </View>
              </View>
            </View>

            {/* ── Transactions Header & Filter Toggle ── */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, marginBottom: 12 }}>
              <Text variant="headingM">Transactions</Text>
              <TouchableOpacity
                onPress={() => setIsFiltersVisible(!isFiltersVisible)}
                accessibilityRole="button"
                accessibilityState={{ expanded: isFiltersVisible }}
                style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: C.surface03, borderWidth: 1, borderColor: isFiltersVisible ? accentColor : C.lineSubtle }}
              >
                <Text variant="labelXs" style={{ color: isFiltersVisible ? accentColor : C.contentSecondary }}>Filters</Text>
              </TouchableOpacity>
            </View>

            {/* ── Filters ── */}
            {isFiltersVisible && (
              <View style={{ paddingBottom: 12 }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingBottom: 8 }}>
                <TouchableOpacity
                  onPress={() => setFilterCategory("")}
                  accessibilityRole="button"
                  accessibilityState={{ selected: !filterCategory }}
                  style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, borderWidth: 1, backgroundColor: !filterCategory ? withAlpha(accentColor, 0.12) : C.surface03, borderColor: !filterCategory ? accentColor : C.lineSubtle }}
                >
                  <Text variant="labelM" style={{ color: !filterCategory ? accentColor : C.contentSecondary }}>All Categories</Text>
                </TouchableOpacity>
                {expenseCategories.map((cat) => {
                  const active = filterCategory === cat.id;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      onPress={() => setFilterCategory(active ? "" : cat.id)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, backgroundColor: active ? withAlpha(accentColor, 0.12) : C.surface03, borderColor: active ? accentColor : C.lineSubtle }}
                    >
                      <ExpenseCategoryIcon id={cat.id} size={14} color={active ? accentColor : C.contentSecondary} />
                      <Text variant="labelM" style={{ color: active ? accentColor : C.contentSecondary }}>{cat.label}</Text>
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
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, backgroundColor: active ? (key === "yes" ? withAlpha(C.success, 0.12) : key === "no" ? withAlpha(C.destructive, 0.12) : C.surface04) : C.surface03, borderColor: active ? (key === "yes" ? withAlpha(C.success, 0.25) : key === "no" ? withAlpha(C.destructive, 0.25) : C.lineStrong) : C.lineSubtle }}
                    >
                      <Text variant="labelXs" style={{ color: active ? (key === "yes" ? C.success : key === "no" ? C.destructive : C.contentPrimary) : C.contentMuted }}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
            )}

          </>
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={{ padding: 40, alignItems: "center" }}>
              <ActivityIndicator size="large" color={C.contentSecondary} />
            </View>
          ) : (
            <View style={{ padding: 20 }}>
              <EmptyState icon="receipt" title="No expenses found" message={selectedWeekIndex !== null ? "No expenses were recorded for this week." : "No expenses were recorded for this month with the current filters."} actionLabel="Add Expense" onAction={() => router.push("/expense/add")} />
            </View>
          )
        }
        ListFooterComponent={displayedExpenses.length > 0 ? <View style={{ height: 40 }} /> : null}
      />

      {/* ── Month Selector Modal ── */}
      <Modal visible={isMonthSelectorOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setIsMonthSelectorOpen(false)}>
        <View style={styles.modalRoot}>
          {/*
            A full-screen modal, so the surface itself stays full-bleed and each row
            inside takes the same `dialogStyle` cap — header, month list and footer end
            up in one centred column on a tablet instead of drifting apart. Undefined
            on a phone, so nothing here moves below 600pt.
          */}
          <View style={[styles.modalHeader, { paddingTop: Platform.OS === 'ios' ? 16 : insets.top + 16 }, dialogStyle]}>
            <Text variant="headingM">{selectorYear} Expenses</Text>
            <Pressable onPress={() => setIsMonthSelectorOpen(false)} accessibilityRole="button">
              <Text variant="labelM" style={{ color: accentColor }}>Done</Text>
            </Pressable>
          </View>

          <View style={[styles.tableHeader, dialogStyle]}>
            <Text variant="labelXs" className="text-content-secondary">MONTH</Text>
            <Text variant="labelXs" tabular className="text-content-secondary">YTD DEDUCTIBLE: {formatCurrency(ytdSummary?.deductible ?? 0, country)}</Text>
          </View>

          <ScrollView contentContainerStyle={[styles.modalScroll, dialogStyle]}>
            {modalMonthsList.map((m, idx) => {
              const isSelectedMonth = selectedMonth.getFullYear() === m.date.getFullYear() && selectedMonth.getMonth() === m.date.getMonth();
              return (
              <Pressable
                key={idx}
                onPress={() => {
                  setSelectedMonth(m.date);
                  setIsMonthSelectorOpen(false);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelectedMonth }}
                style={[
                  styles.weekCard,
                  isSelectedMonth
                    ? { borderColor: accentColor, backgroundColor: withAlpha(accentColor, 0.12) }
                    : {}
                ]}
              >
                <View style={styles.weekInfo}>
                  <Text variant="paragraphS" className="text-content-secondary">{m.label} {selectorYear}</Text>
                  <Text variant="headingM" tabular>{formatCurrency(m.total, country)}</Text>
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
                        <Text variant="labelXs" className="text-content-secondary">W{wIdx + 1}</Text>
                      </View>
                    );
                  })}
                </View>
              </Pressable>
              );
            })}
          </ScrollView>

          <View style={[styles.modalFooter, { paddingBottom: Math.max(insets.bottom, 16) }, dialogStyle]}>
            <Pressable onPress={() => setSelectorYear(y => y - 1)} accessibilityRole="button" style={styles.pageBtn}>
              <Text variant="labelM">Previous Year</Text>
            </Pressable>
            <Text variant="labelM" tabular className="text-content-secondary">{selectorYear}</Text>
            <Pressable
              onPress={() => setSelectorYear(y => y + 1)}
              accessibilityRole="button"
              accessibilityState={{ disabled: selectorYear >= new Date().getFullYear() }}
              style={[styles.pageBtn, selectorYear >= new Date().getFullYear() && styles.pageBtnDisabled]}
              disabled={selectorYear >= new Date().getFullYear()}
            >
              <Text variant="labelM">Next Year</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* ── Recurring Expense Due Prompt — fires once per session, on this tab only ── */}
      {dueRecurringExpense ? (
        <FeedbackDialog
          visible={!!dueRecurringExpense}
          variant="info"
          accentColor={accentColor}
          title="Recurring expense due"
          message={`${getCategoryMeta(dueRecurringExpense.category, country, customCategories).label} — ${formatCurrency(dueRecurringExpense.amount, country)} — due ${dueRecurringExpense.recurringNextDate}. Did you pay it?`}
          cancelLabel="Skip for now"
          actions={[
            {
              label: "Yes, Paid",
              onPress: async () => {
                if (isResolvingRecurring) return;
                setIsResolvingRecurring(true);
                try {
                  await materializeRecurringOccurrence(dueRecurringExpense);
                  queryClient.invalidateQueries({ queryKey: ["expenses"] });
                  queryClient.invalidateQueries({ queryKey: ["analytics"] });
                } finally {
                  setIsResolvingRecurring(false);
                  dismissDueRecurring();
                }
              },
            },
            {
              label: "Edit Amount",
              variant: "neutral",
              onPress: () => {
                const templateId = dueRecurringExpense.id;
                dismissDueRecurring();
                router.push({ pathname: "/expense/add", params: { recurringTemplateId: templateId } });
              },
            },
          ]}
          onClose={async () => {
            if (isResolvingRecurring) return;
            setIsResolvingRecurring(true);
            try {
              await snoozeRecurringExpense(dueRecurringExpense.id);
            } finally {
              setIsResolvingRecurring(false);
              dismissDueRecurring();
            }
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const makeStyles = (C: Palette) => StyleSheet.create({
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
    backgroundColor: C.surface03,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.lineSubtle,
    marginBottom: 20,
    alignSelf: "center",
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
    backgroundColor: C.surface03,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.lineSubtle,
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
    color: C.destructive,
    lineHeight: 30,
    marginTop: 10,
    marginRight: 4,
  },
  amountText: {
    flexShrink: 1,
    fontSize: 40,
    fontWeight: "800",
    color: C.contentPrimary,
    letterSpacing: -0.5,
    lineHeight: 48,
    paddingVertical: 2,
    includeFontPadding: false,
  },
  chartContainer: {
    backgroundColor: C.surface02,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.lineSubtle,
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
    borderColor: C.lineSubtle,
  },
  highBadge: {
    backgroundColor: C.surface02,
    paddingLeft: 8,
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
    backgroundColor: C.surface03,
    borderRadius: 8,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  barFill: {
    width: "100%",
    borderRadius: 8,
  },
  modalRoot: { flex: 1, backgroundColor: C.background },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 0.5, borderBottomColor: C.lineSubtle },
  tableHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 22, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: C.lineSubtle },
  modalScroll: { paddingVertical: 8 },
  weekCard: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: C.lineSubtle, backgroundColor: C.surface02, borderRadius: 12, marginHorizontal: 16, marginVertical: 6 },
  weekInfo: { gap: 4 },
  miniGraph: { flexDirection: "row", alignItems: "flex-end", gap: 4 },
  miniGraphCol: { alignItems: "center", gap: 4 },
  miniBarTrack: { width: 8, height: 32, backgroundColor: C.surface03, borderRadius: 8, overflow: "hidden", justifyContent: "flex-end" },
  miniBarFill: { width: "100%", borderRadius: 8 },
  modalFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 0.5, borderTopColor: C.lineSubtle, backgroundColor: C.background },
  pageBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, backgroundColor: C.surface03, borderWidth: StyleSheet.hairlineWidth, borderColor: C.lineSubtle },
  pageBtnDisabled: { opacity: 0.35 },
});
