import React, { useState, useMemo, useCallback } from "react";
import {
  ScrollView,
  View,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  Alert,
  Platform,
  Modal,
  StyleSheet,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { DatePickerModal } from "@/src/components/ui/DatePickerModal";
import { X, FileText, Table, BarChart2, Download, CalendarDays, Settings } from "lucide-react-native";
import Svg, { Path } from "react-native-svg";
import { Text } from "@/src/components/ui/text";
import { getPeriodStats, getMonthlyStatsForYear, getNetIncome } from "@/src/database/queries/analytics";
import { generateShiftsCSV, generateExpensesCSV, generatePDFSummary } from "@/utils/reportGenerator";
import { useSettingsStore } from "@/store/useSettingsStore";
import { usePlatformTheme } from "@/src/hooks/usePlatformTheme";
import { useFeatureEnabled } from "@/hooks/useFeatureEnabled";

const isWeb = Platform.OS === "web";

// ─── Design tokens ────────────────────────────────────────────────────────────
const BG      = "#000000";
const SURFACE = "#0d0d0d";
const PILL    = "#161615";
const BORDER  = "#1f1f1f";
const BORDER2 = "#262522";
const MUTED   = "#71717a";
const DIM     = "#52525b";

// ─── Custom Icons ─────────────────────────────────────────────────────────────
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

// ─── Period mode ──────────────────────────────────────────────────────────────
type PeriodMode = "month" | "quarter" | "year" | "custom";

interface QuickPreset {
  mode: PeriodMode;
  label: string;
}

const QUICK_PRESETS: QuickPreset[] = [
  { mode: "month",   label: "This Month" },
  { mode: "quarter", label: "This Quarter" },
  { mode: "year",    label: "This Year" },
];

function startOfMonth(d: Date): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
  return out;
}

function derivePeriod(
  mode: PeriodMode,
  selectedMonth: Date,
  customStart: Date,
  customEnd: Date,
): { start: Date; end: Date; label: string } {
  if (mode === "month") {
    const s = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1, 0, 0, 0, 0);
    const e = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0, 23, 59, 59, 999);
    const label = s.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    return { start: s, end: e, label };
  }
  if (mode === "quarter") {
    const now = new Date();
    const q = Math.floor(now.getMonth() / 3);
    const s = new Date(now.getFullYear(), q * 3, 1, 0, 0, 0, 0);
    const e = new Date(now.getFullYear(), q * 3 + 3, 0, 23, 59, 59, 999);
    return { start: s, end: e, label: `Q${q + 1} ${now.getFullYear()}` };
  }
  if (mode === "year") {
    const yr = new Date().getFullYear();
    const s = new Date(yr, 0, 1, 0, 0, 0, 0);
    const e = new Date(yr, 11, 31, 23, 59, 59, 999);
    return { start: s, end: e, label: `${yr}` };
  }
  // custom
  return { start: customStart, end: customEnd, label: "Custom Range" };
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function ReportsScreen({ onClose }: { onClose?: () => void } = {}) {
  const insets = useSafeAreaInsets();
  const { profile, isOnboardingCompleted } = useSettingsStore();
  const { accentColor, accentColorDim, accentColorMid, accentColorContrast } = usePlatformTheme();
  const isPdfEnabled = useFeatureEnabled("pdf_reports");

  const [periodMode, setPeriodMode] = useState<PeriodMode>("month");
  const [selectedMonth, setSelectedMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectorYear, setSelectorYear] = useState(() => new Date().getFullYear());
  const [customStart, setCustomStart] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [customEnd, setCustomEnd] = useState<Date>(() => {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d;
  });
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [isCustomExpanded, setIsCustomExpanded] = useState(false);
  const [selectedBarIndex, setSelectedBarIndex] = useState<number | null>(null);

  const { start, end, label: periodLabel } = useMemo(
    () => derivePeriod(periodMode, selectedMonth, customStart, customEnd),
    [periodMode, selectedMonth, customStart, customEnd],
  );

  const country = profile?.country ?? "CA";

  const formatCurrency = useCallback((val: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: country === "CA" ? "CAD" : "USD",
    }).format(val);
  }, [country]);

  const formatCurrencyParts = useCallback((val: number) => {
    const parts = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: country === "CA" ? "CAD" : "USD",
    }).formatToParts(val);
    return {
      symbol: parts.find((p) => p.type === "currency")?.value || "$",
      value: parts.filter((p) => p.type !== "currency").map((p) => p.value).join(""),
    };
  }, [country]);

  // ── Arrow navigation (month mode only) ────────────────────────────────────
  const now = new Date();
  const isCurrentOrFutureMonth =
    periodMode === "month" &&
    selectedMonth.getFullYear() === now.getFullYear() &&
    selectedMonth.getMonth() >= now.getMonth();

  const arrowsDisabled = periodMode !== "month";

  const handlePrevPeriod = () => {
    if (periodMode !== "month") return;
    setSelectedBarIndex(null);
    setSelectedMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextPeriod = () => {
    if (periodMode !== "month" || isCurrentOrFutureMonth) return;
    setSelectedBarIndex(null);
    setSelectedMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  // ── Main period stats ──────────────────────────────────────────────────────
  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ["reports", "stats", start.toISOString(), end.toISOString()],
    queryFn: () => getPeriodStats(start, end),
    enabled: isOnboardingCompleted,
  });

  const { data: netIncome = 0, isLoading: loadingNet } = useQuery({
    queryKey: ["reports", "net", start.toISOString(), end.toISOString()],
    queryFn: () => getNetIncome(start, end),
    enabled: isOnboardingCompleted,
  });

  // ── Bar chart data ─────────────────────────────────────────────────────────
  const weekBuckets = useMemo(() => {
    if (periodMode !== "month") return [];
    const yr = selectedMonth.getFullYear();
    const mo = selectedMonth.getMonth();
    const daysInMonth = new Date(yr, mo + 1, 0).getDate();
    return [
      { label: "W1", start: new Date(yr, mo, 1,  0, 0, 0, 0), end: new Date(yr, mo, 7,  23, 59, 59, 999) },
      { label: "W2", start: new Date(yr, mo, 8,  0, 0, 0, 0), end: new Date(yr, mo, 14, 23, 59, 59, 999) },
      { label: "W3", start: new Date(yr, mo, 15, 0, 0, 0, 0), end: new Date(yr, mo, 21, 23, 59, 59, 999) },
      { label: "W4", start: new Date(yr, mo, 22, 0, 0, 0, 0), end: new Date(yr, mo, daysInMonth, 23, 59, 59, 999) },
    ];
  }, [periodMode, selectedMonth]);

  const { data: barData = [] } = useQuery({
    queryKey: ["reports", "bars", periodMode, start.toISOString(), end.toISOString()],
    queryFn: async () => {
      if (periodMode === "month") {
        const results = await Promise.all(weekBuckets.map((b) => getPeriodStats(b.start, b.end)));
        return weekBuckets.map((b, i) => ({
          label: b.label,
          total: results[i].gross + results[i].tips,
        }));
      }
      if (periodMode === "quarter") {
        const q = Math.floor(start.getMonth() / 3);
        const yr = start.getFullYear();
        const months = [0, 1, 2].map((i) => ({
          label: new Date(yr, q * 3 + i, 1).toLocaleDateString("en-US", { month: "short" }),
          start: new Date(yr, q * 3 + i, 1, 0, 0, 0, 0),
          end: new Date(yr, q * 3 + i + 1, 0, 23, 59, 59, 999),
        }));
        const results = await Promise.all(months.map((m) => getPeriodStats(m.start, m.end)));
        return months.map((m, i) => ({ label: m.label, total: results[i].gross + results[i].tips }));
      }
      if (periodMode === "year") {
        const yr = start.getFullYear();
        const monthly = await getMonthlyStatsForYear(yr);
        const LETTERS = "JFMAMJJASOND";
        return Array.from({ length: 12 }, (_, i) => {
          const found = monthly.find((m) => m.monthIndex === i);
          return { label: LETTERS[i], total: found ? found.gross + found.tips : 0 };
        });
      }
      // custom: 4 equal chunks
      const totalMs = end.getTime() - start.getTime();
      const chunkMs = totalMs / 4;
      const chunks = Array.from({ length: 4 }, (_, i) => ({
        label: `P${i + 1}`,
        start: new Date(start.getTime() + i * chunkMs),
        end: new Date(start.getTime() + (i + 1) * chunkMs - 1),
      }));
      const results = await Promise.all(chunks.map((c) => getPeriodStats(c.start, c.end)));
      return chunks.map((c, i) => ({ label: c.label, total: results[i].gross + results[i].tips }));
    },
    enabled: isOnboardingCompleted,
  });

  // ── Modal: monthly stats for selector year ─────────────────────────────────
  const { data: yearMonthlyStats = [] } = useQuery({
    queryKey: ["reports", "monthly-stats", selectorYear],
    queryFn: () => getMonthlyStatsForYear(selectorYear),
    enabled: isOnboardingCompleted && isModalOpen,
  });

  const modalMonthsList = useMemo(() => {
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();
    const maxMonth = selectorYear === currentYear ? currentMonth : 11;
    const maxTotal = Math.max(...yearMonthlyStats.map((m) => m.gross + m.tips), 1);

    return Array.from({ length: maxMonth + 1 }, (_, i) => {
      const monthIndex = maxMonth - i;
      const mDate = new Date(selectorYear, monthIndex, 1);
      const mData = yearMonthlyStats.find((m) => m.monthIndex === monthIndex);
      const total = mData ? mData.gross + mData.tips : 0;
      return {
        date: mDate,
        monthIndex,
        label: mDate.toLocaleDateString("en-US", { month: "long" }),
        total,
        barPct: maxTotal > 0 ? (total / maxTotal) * 100 : 0,
      };
    });
  }, [selectorYear, yearMonthlyStats]);

  // ── Derived display values ─────────────────────────────────────────────────
  const grossRevenue = (stats?.gross ?? 0) + (stats?.tips ?? 0);
  const totalMileage = (stats?.activeMileage ?? 0) + (stats?.deadMileage ?? 0);
  const barMaxTotal = Math.max(...barData.map((b) => b.total), 0);
  const isLoading = loadingStats || loadingNet;

  // ── Export handlers (unchanged logic) ─────────────────────────────────────
  const handleExportShifts = async () => {
    try {
      const csv = await generateShiftsCSV(start, end);
      const filename = `shifts_${start.toISOString().split("T")[0]}_to_${end.toISOString().split("T")[0]}.csv`;
      if (isWeb) {
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        const fileUri = FileSystem.cacheDirectory + filename;
        await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: FileSystem.EncodingType.UTF8 });
        await Sharing.shareAsync(fileUri, { mimeType: "text/csv", dialogTitle: "Export Shifts CSV" });
      }
    } catch (err: any) {
      Alert.alert("Export Failed", err.message || "An error occurred exporting CSV.");
    }
  };

  const handleExportExpenses = async () => {
    try {
      const csv = await generateExpensesCSV(start, end);
      const filename = `expenses_${start.toISOString().split("T")[0]}_to_${end.toISOString().split("T")[0]}.csv`;
      if (isWeb) {
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        const fileUri = FileSystem.cacheDirectory + filename;
        await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: FileSystem.EncodingType.UTF8 });
        await Sharing.shareAsync(fileUri, { mimeType: "text/csv", dialogTitle: "Export Expenses CSV" });
      }
    } catch (err: any) {
      Alert.alert("Export Failed", err.message || "An error occurred exporting CSV.");
    }
  };

  const handleExportPDF = async () => {
    try {
      const result = await generatePDFSummary(start, end);
      if (isWeb) {
        const printWindow = window.open("", "_blank");
        if (printWindow) {
          printWindow.document.write(result);
          printWindow.document.close();
          printWindow.print();
        }
      } else {
        await Sharing.shareAsync(result, { mimeType: "application/pdf", dialogTitle: "Export PDF Summary" });
      }
    } catch (err: any) {
      Alert.alert("Export Failed", err.message || "An error occurred generating PDF.");
    }
  };

  const handlePresetSelect = (mode: PeriodMode) => {
    setPeriodMode(mode);
    setSelectedBarIndex(null);
    setIsModalOpen(false);
  };

  const handleMonthSelect = (date: Date) => {
    setPeriodMode("month");
    setSelectedMonth(startOfMonth(date));
    setSelectedBarIndex(null);
    setIsModalOpen(false);
  };

  const handleApplyCustomRange = () => {
    setPeriodMode("custom");
    setSelectedBarIndex(null);
    setIsCustomExpanded(false);
    setIsModalOpen(false);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BG }}>
      {/* ── Screen header ── */}
      <View style={styles.screenHeader}>
        <TouchableOpacity
          onPress={() => onClose ? onClose() : router.back()}
          style={styles.backBtn}
        >
          <X size={20} color="#ffffff" strokeWidth={2.5} />
        </TouchableOpacity>
        <Text style={styles.screenTitle}>Reports & Export</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top > 0 ? 0 : 8 }]} showsVerticalScrollIndicator={false}>

        {/* ── Period Navigation ── */}
        <View style={styles.periodNav}>
          <Pressable onPress={() => { setSelectorYear(selectedMonth.getFullYear()); setIsModalOpen(true); }} style={styles.periodPill}>
            <Text style={styles.periodPillText}>{periodLabel}</Text>
            <View style={{ justifyContent: "center", alignItems: "center", marginLeft: 6 }}>
              <Svg width={10} height={6} viewBox="0 0 10 6" fill="none">
                <Path d="M1 1L5 5L9 1" stroke="#a1a1aa" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </View>
          </Pressable>

          <View style={styles.navRow}>
            <Pressable
              onPress={handlePrevPeriod}
              disabled={arrowsDisabled}
              style={[styles.arrowBtn, arrowsDisabled && styles.arrowBtnDisabled]}
            >
              <ChevronLeft color={arrowsDisabled ? "#3f3f46" : "#fff"} />
            </Pressable>

            <View style={styles.amountRow}>
              <Text style={styles.amountSymbol}>{formatCurrencyParts(grossRevenue).symbol}</Text>
              <Text style={styles.amountText} numberOfLines={1} adjustsFontSizeToFit>
                {formatCurrencyParts(grossRevenue).value}
              </Text>
            </View>

            <Pressable
              onPress={handleNextPeriod}
              disabled={arrowsDisabled || isCurrentOrFutureMonth}
              style={[styles.arrowBtn, (arrowsDisabled || isCurrentOrFutureMonth) && styles.arrowBtnDisabled]}
            >
              <ChevronRight color={(arrowsDisabled || isCurrentOrFutureMonth) ? "#3f3f46" : "#fff"} />
            </Pressable>
          </View>
        </View>

        {/* ── Bar Chart ── */}
        <View style={styles.chartContainer}>
          {barMaxTotal > 0 && (
            <View style={styles.highLineOverlay} pointerEvents="none">
              <View style={styles.dashedLine} />
              <View style={styles.highBadge}>
                <Text style={styles.highBadgeText}>HIGH: {formatCurrency(barMaxTotal)}</Text>
              </View>
            </View>
          )}

          <View style={styles.chartRow}>
            {barData.map((bar, idx) => {
              const isSelected = selectedBarIndex === idx;
              const barHeightPct = barMaxTotal > 0 ? (bar.total / barMaxTotal) * 100 : 0;
              return (
                <Pressable
                  key={idx}
                  onPress={() => setSelectedBarIndex(selectedBarIndex === idx ? null : idx)}
                  style={styles.chartCol}
                >
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          height: `${Math.max(barHeightPct, bar.total > 0 ? 8 : 2)}%`,
                          backgroundColor: accentColor,
                          opacity: selectedBarIndex === null || isSelected ? 1 : 0.35,
                        },
                      ]}
                    />
                  </View>
                  <Text
                    style={[
                      styles.chartLabel,
                      {
                        color: isSelected ? accentColor : MUTED,
                        fontWeight: isSelected ? "800" : "600",
                      },
                    ]}
                  >
                    {bar.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* ── Summary Stat Grid ── */}
        {isLoading ? (
          <View style={{ paddingVertical: 32, alignItems: "center" }}>
            <ActivityIndicator size="large" color={accentColor} />
          </View>
        ) : (
          <View style={styles.statGrid}>
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Gross Revenue</Text>
                <Text style={styles.statValue}>{formatCurrency(grossRevenue)}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Net Earnings</Text>
                <Text style={[styles.statValue, { color: netIncome >= 0 ? "#fff" : "#f87171" }]}>
                  {formatCurrency(netIncome)}
                </Text>
              </View>
            </View>
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Total Shifts</Text>
                <Text style={styles.statValue}>{stats?.count ?? 0}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Mileage Logged</Text>
                <Text style={styles.statValue}>
                  {totalMileage.toFixed(1)} {profile?.distanceUnit ?? "km"}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* ── Export Actions ── */}
        <View style={styles.exportSection}>
          <Text style={styles.sectionLabel}>Export Actions</Text>

          <TouchableOpacity onPress={handleExportShifts} style={styles.exportRow}>
            <View style={styles.exportRowLeft}>
              <View style={styles.exportIconWrap}>
                <Table size={20} color={accentColor} />
              </View>
              <View style={{ gap: 2 }}>
                <Text style={styles.exportRowTitle}>Export Shifts CSV</Text>
                <Text style={styles.exportRowSub}>Platform earnings, tips, dates and mileage</Text>
              </View>
            </View>
            <Download size={16} color={MUTED} />
          </TouchableOpacity>

          <TouchableOpacity onPress={handleExportExpenses} style={styles.exportRow}>
            <View style={styles.exportRowLeft}>
              <View style={styles.exportIconWrap}>
                <BarChart2 size={20} color={accentColor} />
              </View>
              <View style={{ gap: 2 }}>
                <Text style={styles.exportRowTitle}>Export Expenses CSV</Text>
                <Text style={styles.exportRowSub}>Expense log, deductible markings and notes</Text>
              </View>
            </View>
            <Download size={16} color={MUTED} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              if (!isPdfEnabled) {
                router.push("/settings");
                return;
              }
              handleExportPDF();
            }}
            style={[
              styles.exportRow,
              isPdfEnabled && { backgroundColor: accentColor, borderWidth: 0, borderColor: "transparent" },
            ]}
          >
            <View style={styles.exportRowLeft}>
              <View style={[
                styles.exportIconWrap,
                isPdfEnabled && { backgroundColor: "rgba(0,0,0,0.15)", borderWidth: 0 },
              ]}>
                <FileText size={20} color={isPdfEnabled ? accentColorContrast : accentColor} />
              </View>
              <View style={{ gap: 2 }}>
                <Text style={[styles.exportRowTitle, isPdfEnabled && { color: accentColorContrast }]}>
                  Generate PDF Summary
                </Text>
                <Text style={[styles.exportRowSub, isPdfEnabled && { color: accentColorContrast, opacity: 0.7 }]}>
                  {isPdfEnabled ? "Print-safe tax summary report" : "Unlock in Settings to enable"}
                </Text>
              </View>
            </View>
            {isPdfEnabled
              ? <Download size={16} color={accentColorContrast} />
              : <Settings size={16} color={accentColor} />
            }
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ── Period Selector Modal ── */}
      {isModalOpen && (
        <Modal
          visible={isModalOpen}
          animationType="slide"
          transparent={false}
          onRequestClose={() => setIsModalOpen(false)}
        >
          <SafeAreaView style={styles.modalRoot} edges={["top", "bottom", "left", "right"]}>
            {/* Modal header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Period</Text>
              <Pressable onPress={() => setIsModalOpen(false)}>
                <Text style={[styles.closeBtnText, { color: accentColor }]}>Done</Text>
              </Pressable>
            </View>

            {/* Quick preset chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.presetRow}
            >
              {QUICK_PRESETS.map((p) => {
                const active = periodMode === p.mode;
                return (
                  <Pressable
                    key={p.mode}
                    onPress={() => handlePresetSelect(p.mode)}
                    style={[
                      styles.presetChip,
                      { flexShrink: 0 },
                      active && { backgroundColor: accentColor + "20", borderColor: accentColorMid },
                    ]}
                  >
                    <Text style={[styles.presetChipText, active && { color: accentColor }]} numberOfLines={1}>
                      {p.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Table sub-header */}
            <View style={styles.tableHeader}>
              <Text style={styles.tableHeaderLeft}>Month</Text>
              <Text style={styles.tableHeaderRight}>Gross Revenue</Text>
            </View>

            {/* Month list + custom range */}
            <ScrollView contentContainerStyle={styles.modalScroll} showsVerticalScrollIndicator={false}>
              {modalMonthsList.map((m, idx) => {
                const isActive =
                  periodMode === "month" &&
                  selectedMonth.getFullYear() === m.date.getFullYear() &&
                  selectedMonth.getMonth() === m.date.getMonth();

                return (
                  <Pressable
                    key={idx}
                    onPress={() => handleMonthSelect(m.date)}
                    style={[
                      styles.monthCard,
                      isActive && { borderColor: accentColor, backgroundColor: accentColor + "10" },
                    ]}
                  >
                    <View style={styles.monthInfo}>
                      <Text style={styles.monthRangeText}>{m.label} {selectorYear}</Text>
                      <Text style={styles.monthAmountText}>{formatCurrency(m.total)}</Text>
                    </View>

                    <View style={styles.miniBarContainer}>
                      <View style={styles.miniBarTrack}>
                        <View
                          style={[
                            styles.miniBarFill,
                            {
                              height: `${Math.max(m.barPct, m.total > 0 ? 10 : 2)}%`,
                              backgroundColor: isActive ? accentColor : accentColor + "80",
                            },
                          ]}
                        />
                      </View>
                    </View>
                  </Pressable>
                );
              })}

              {/* Custom Range collapsible */}
              <Pressable
                onPress={() => setIsCustomExpanded((v) => !v)}
                style={styles.customToggleBtn}
              >
                <Text style={styles.customToggleText}>
                  {isCustomExpanded ? "▾" : "▸"}{"  "}Custom Date Range
                </Text>
              </Pressable>

              {isCustomExpanded && (
                <View style={styles.customRangeCard}>
                  <View style={{ flexDirection: "row", gap: 12 }}>
                    {/* Start date */}
                    <View style={{ flex: 1, gap: 6 }}>
                      <Text style={styles.customDateLabel}>Start</Text>
                      {isWeb ? (
                        <input
                          type="date"
                          value={customStart.toISOString().substring(0, 10)}
                          onChange={(e) => {
                            if (e.target.value) setCustomStart(new Date(e.target.value + "T12:00:00"));
                          }}
                          style={{
                            background: "#161615",
                            border: "1px solid #262522",
                            borderRadius: 12,
                            padding: "8px 12px",
                            color: "#ffffff",
                            fontSize: 12,
                            outline: "none",
                            width: "100%",
                          }}
                        />
                      ) : (
                        <Pressable
                          onPress={() => setShowStartPicker(true)}
                          style={styles.datePickerBtn}
                        >
                          <Text style={styles.datePickerText}>
                            {customStart.toLocaleDateString(undefined, { dateStyle: "medium" })}
                          </Text>
                          <CalendarDays size={14} color={accentColor} />
                        </Pressable>
                      )}
                    </View>

                    {/* End date */}
                    <View style={{ flex: 1, gap: 6 }}>
                      <Text style={styles.customDateLabel}>End</Text>
                      {isWeb ? (
                        <input
                          type="date"
                          value={customEnd.toISOString().substring(0, 10)}
                          onChange={(e) => {
                            if (e.target.value) setCustomEnd(new Date(e.target.value + "T12:00:00"));
                          }}
                          style={{
                            background: "#161615",
                            border: "1px solid #262522",
                            borderRadius: 12,
                            padding: "8px 12px",
                            color: "#ffffff",
                            fontSize: 12,
                            outline: "none",
                            width: "100%",
                          }}
                        />
                      ) : (
                        <Pressable
                          onPress={() => setShowEndPicker(true)}
                          style={styles.datePickerBtn}
                        >
                          <Text style={styles.datePickerText}>
                            {customEnd.toLocaleDateString(undefined, { dateStyle: "medium" })}
                          </Text>
                          <CalendarDays size={14} color={accentColor} />
                        </Pressable>
                      )}
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={handleApplyCustomRange}
                    style={[styles.applyBtn, { backgroundColor: accentColor }]}
                  >
                    <Text style={[styles.applyBtnText, { color: accentColorContrast }]}>
                      Apply Custom Range
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              <View style={{ height: 16 }} />
            </ScrollView>

            {/* DatePickerModals — rendered outside the ScrollView */}
            {!isWeb && (
              <>
                <DatePickerModal
                  visible={showStartPicker}
                  value={customStart}
                  onChange={setCustomStart}
                  onClose={() => setShowStartPicker(false)}
                />
                <DatePickerModal
                  visible={showEndPicker}
                  value={customEnd}
                  onChange={setCustomEnd}
                  onClose={() => setShowEndPicker(false)}
                />
              </>
            )}

            {/* Modal footer: year navigation */}
            <View style={styles.modalFooter}>
              <Pressable onPress={() => setSelectorYear((y) => y - 1)} style={styles.pageBtn}>
                <Text style={styles.pageBtnText}>Previous Year</Text>
              </Pressable>
              <Text style={styles.pageIndicator}>{selectorYear}</Text>
              <Pressable
                onPress={() => setSelectorYear((y) => y + 1)}
                disabled={selectorYear >= new Date().getFullYear()}
                style={[styles.pageBtn, selectorYear >= new Date().getFullYear() && styles.pageBtnDisabled]}
              >
                <Text style={styles.pageBtnText}>Next Year</Text>
              </Pressable>
            </View>
          </SafeAreaView>
        </Modal>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screenHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#161615",
    borderWidth: 0.8,
    borderColor: "#262522",
    alignItems: "center",
    justifyContent: "center",
  },
  screenTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#ffffff",
    letterSpacing: -0.3,
  },
  scroll: {
    paddingBottom: 60,
  },

  // Period navigation
  periodNav: {
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  periodPill: {
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
  periodPillText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#a1a1aa",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  navRow: {
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
  arrowBtnDisabled: {
    opacity: 0.35,
    borderColor: "#161615",
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
    color: "#fff",
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

  // Bar chart
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
  chartLabel: {
    fontSize: 11,
    fontWeight: "600",
  },

  // Stat grid
  statGrid: {
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 24,
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#0d0d0d",
    borderRadius: 20,
    borderWidth: 0.8,
    borderColor: "#1f1f1f",
    padding: 16,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#71717a",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "800",
    color: "#fff",
  },

  // Export section
  exportSection: {
    paddingHorizontal: 16,
    gap: 10,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#71717a",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 2,
  },
  exportRow: {
    backgroundColor: "#0d0d0d",
    borderWidth: 0.8,
    borderColor: "#1f1f1f",
    borderRadius: 20,
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  exportRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    flex: 1,
  },
  exportIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#161615",
    borderWidth: 0.8,
    borderColor: "#262522",
    alignItems: "center",
    justifyContent: "center",
  },
  exportRowTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#ffffff",
  },
  exportRowSub: {
    fontSize: 11,
    color: "#71717a",
  },

  // Modal
  modalRoot: {
    flex: 1,
    backgroundColor: "#000",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: "#1f1f1f",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#fff",
  },
  closeBtnText: {
    fontSize: 14,
    fontWeight: "600",
  },
  presetRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  presetChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: "#161615",
    borderColor: "#262522",
  },
  presetChipText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#71717a",
  },
  tableHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: "#111",
  },
  tableHeaderLeft: {
    fontSize: 11,
    fontWeight: "700",
    color: "#71717a",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tableHeaderRight: {
    fontSize: 10,
    fontWeight: "800",
    color: "#71717a",
    letterSpacing: 0.4,
  },
  modalScroll: {
    paddingVertical: 8,
  },
  monthCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderWidth: 0.8,
    borderColor: "#1f1f1f",
    backgroundColor: "#0d0d0d",
    borderRadius: 20,
    marginHorizontal: 16,
    marginVertical: 6,
  },
  monthInfo: {
    gap: 4,
  },
  monthRangeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#a1a1aa",
  },
  monthAmountText: {
    fontSize: 18,
    fontWeight: "900",
    color: "#fff",
    letterSpacing: -0.4,
  },
  miniBarContainer: {
    alignItems: "center",
    justifyContent: "flex-end",
  },
  miniBarTrack: {
    width: 8,
    height: 36,
    backgroundColor: "#161615",
    borderRadius: 4,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  miniBarFill: {
    width: "100%",
    borderRadius: 4,
  },

  // Custom range
  customToggleBtn: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 0.8,
    borderColor: "#262522",
    backgroundColor: "#161615",
  },
  customToggleText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#a1a1aa",
  },
  customRangeCard: {
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: "#0d0d0d",
    borderWidth: 0.8,
    borderColor: "#1f1f1f",
    borderRadius: 20,
    padding: 16,
    gap: 12,
  },
  customDateLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#52525b",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  datePickerBtn: {
    backgroundColor: "#161615",
    borderWidth: 0.8,
    borderColor: "#262522",
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  datePickerText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "600",
  },
  applyBtn: {
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 4,
  },
  applyBtnText: {
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  // Modal footer
  modalFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 0.5,
    borderTopColor: "#1f1f1f",
    backgroundColor: "#000",
  },
  pageBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: "#161615",
    borderWidth: 0.8,
    borderColor: "#262522",
  },
  pageBtnDisabled: {
    opacity: 0.35,
  },
  pageBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#fff",
  },
  pageIndicator: {
    fontSize: 12,
    fontWeight: "600",
    color: "#71717a",
  },
});
