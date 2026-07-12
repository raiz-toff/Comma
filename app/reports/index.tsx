import React, { useState, useMemo, useCallback } from "react";
import {
  ScrollView,
  View,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
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
import { FeedbackDialog, BusyOverlay, type FeedbackVariant } from "@/src/components/ui/FeedbackDialog";
import { X, FileText, Table, BarChart2, Download, CalendarDays, Settings } from "lucide-react-native";
import Svg, { Path } from "react-native-svg";
import { Text } from "@/src/components/ui/text";
import { EmptyState } from "@/src/components/ui/EmptyState";
import { COLORS, withAlpha } from "@/src/theme/colors";
import { getPeriodStats, getMonthlyStatsForYear, getNetIncome } from "@/src/database/queries/analytics";
import { generateShiftsCSV, generateExpensesCSV, generatePDFSummary } from "@/utils/reportGenerator";
import { useSettingsStore } from "@/store/useSettingsStore";
import { usePlatformTheme } from "@/src/hooks/usePlatformTheme";
import { useFeatureEnabled } from "@/hooks/useFeatureEnabled";
import { notifyExport } from "@/src/services/notify";

const isWeb = Platform.OS === "web";

// ─── Design tokens (mirrors Comma DS COLORS) ──────────────────────────────────
const BG      = COLORS.background;
const SURFACE = COLORS.surface02;
const PILL    = COLORS.surface03;
const BORDER  = COLORS.lineSubtle;
const BORDER2 = COLORS.lineSubtle;
const MUTED   = COLORS.contentSecondary;
const DIM     = COLORS.contentMuted;

// ─── Custom Icons ─────────────────────────────────────────────────────────────
const ChevronLeft = ({ size = 22, color = COLORS.contentPrimary }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
    <Path d="m15 18-6-6 6-6" />
  </Svg>
);

const ChevronRight = ({ size = 22, color = COLORS.contentPrimary }: { size?: number; color?: string }) => (
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

  // ── Export feedback state ──────────────────────────────────────────────────
  const [busyExport, setBusyExport] = useState<null | "shifts" | "expenses" | "pdf">(null);
  const [dialog, setDialog] = useState<{ variant: FeedbackVariant; title: string; message?: string } | null>(null);
  const showDialog = useCallback(
    (variant: FeedbackVariant, title: string, message?: string) => setDialog({ variant, title, message }),
    [],
  );
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
          total: results[i].gross + results[i].tips + results[i].bonus,
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
        return months.map((m, i) => ({ label: m.label, total: results[i].gross + results[i].tips + results[i].bonus }));
      }
      if (periodMode === "year") {
        const yr = start.getFullYear();
        const monthly = await getMonthlyStatsForYear(yr);
        const LETTERS = "JFMAMJJASOND";
        return Array.from({ length: 12 }, (_, i) => {
          const found = monthly.find((m) => m.monthIndex === i);
          return { label: LETTERS[i], total: found ? found.gross + found.tips + found.bonus : 0 };
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
      return chunks.map((c, i) => ({ label: c.label, total: results[i].gross + results[i].tips + results[i].bonus }));
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
    const maxTotal = Math.max(...yearMonthlyStats.map((m) => m.gross + m.tips + m.bonus), 1);

    return Array.from({ length: maxMonth + 1 }, (_, i) => {
      const monthIndex = maxMonth - i;
      const mDate = new Date(selectorYear, monthIndex, 1);
      const mData = yearMonthlyStats.find((m) => m.monthIndex === monthIndex);
      const total = mData ? mData.gross + mData.tips + mData.bonus : 0;
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
  const grossRevenue = (stats?.gross ?? 0) + (stats?.tips ?? 0) + (stats?.bonus ?? 0);
  const totalMileage = (stats?.activeMileage ?? 0) + (stats?.deadMileage ?? 0);
  const barMaxTotal = Math.max(...barData.map((b) => b.total), 0);
  const isLoading = loadingStats || loadingNet;

  // ── Export handlers ────────────────────────────────────────────────────────
  // A CSV with no data rows is just an empty string (Papa.unparse([]) === "").
  const dateTag = (d: Date) => d.toISOString().split("T")[0];

  // Deliver a CSV string: browser download on web, share sheet on native.
  // Returns true if a share/download was actually initiated.
  const deliverCsv = async (csv: string, filename: string, dialogTitle: string): Promise<boolean> => {
    if (isWeb) {
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return true;
    }
    if (!(await Sharing.isAvailableAsync())) {
      showDialog("error", "Sharing Unavailable", "This device can't open a share sheet. Try exporting from a different device.");
      return false;
    }
    const fileUri = FileSystem.cacheDirectory + filename;
    await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: FileSystem.EncodingType.UTF8 });
    await Sharing.shareAsync(fileUri, { mimeType: "text/csv", dialogTitle });
    return true;
  };

  const handleExportShifts = async () => {
    if (busyExport) return;
    setBusyExport("shifts");
    try {
      const csv = await generateShiftsCSV(start, end);
      if (!csv.trim()) {
        showDialog("info", "Nothing to Export", "There are no shifts in the selected period.");
        return;
      }
      const ok = await deliverCsv(csv, `shifts_${dateTag(start)}_to_${dateTag(end)}.csv`, "Export Shifts CSV");
      if (ok) {
        showDialog("success", "Shifts Exported", "Your shifts CSV is ready to save or share.");
        notifyExport("Shifts CSV", true);
      }
    } catch (err: any) {
      showDialog("error", "Export Failed", err?.message || "An error occurred exporting the shifts CSV.");
      notifyExport("Shifts CSV", false, err?.message);
    } finally {
      setBusyExport(null);
    }
  };

  const handleExportExpenses = async () => {
    if (busyExport) return;
    setBusyExport("expenses");
    try {
      const csv = await generateExpensesCSV(start, end);
      if (!csv.trim()) {
        showDialog("info", "Nothing to Export", "There are no expenses in the selected period.");
        return;
      }
      const ok = await deliverCsv(csv, `expenses_${dateTag(start)}_to_${dateTag(end)}.csv`, "Export Expenses CSV");
      if (ok) {
        showDialog("success", "Expenses Exported", "Your expenses CSV is ready to save or share.");
        notifyExport("Expenses CSV", true);
      }
    } catch (err: any) {
      showDialog("error", "Export Failed", err?.message || "An error occurred exporting the expenses CSV.");
      notifyExport("Expenses CSV", false, err?.message);
    } finally {
      setBusyExport(null);
    }
  };

  const handleExportPDF = async () => {
    if (busyExport) return;
    setBusyExport("pdf");
    try {
      const result = await generatePDFSummary(start, end);
      if (isWeb) {
        const printWindow = window.open("", "_blank");
        if (!printWindow) {
          showDialog("error", "Pop-up Blocked", "Allow pop-ups for this site to open the printable summary.");
          return;
        }
        printWindow.document.write(result);
        printWindow.document.close();
        printWindow.print();
        return;
      }
      if (!(await Sharing.isAvailableAsync())) {
        showDialog("error", "Sharing Unavailable", "This device can't open a share sheet to save the PDF.");
        return;
      }
      await Sharing.shareAsync(result, { mimeType: "application/pdf", dialogTitle: "Export PDF Summary" });
      showDialog("success", "PDF Ready", "Your tax summary PDF is ready to save or share.");
      notifyExport("PDF Summary", true);
    } catch (err: any) {
      showDialog("error", "Export Failed", err?.message || "An error occurred generating the PDF.");
      notifyExport("PDF Summary", false, err?.message);
    } finally {
      setBusyExport(null);
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
          accessibilityRole="button"
          accessibilityLabel="Close reports"
          style={styles.backBtn}
        >
          <X size={20} color={COLORS.contentPrimary} strokeWidth={2.5} />
        </TouchableOpacity>
        <Text variant="headingM">Reports & Export</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top > 0 ? 0 : 8 }]} showsVerticalScrollIndicator={false}>

        {/* ── Period Navigation ── */}
        <View style={styles.periodNav}>
          <Pressable
            onPress={() => { setSelectorYear(selectedMonth.getFullYear()); setIsModalOpen(true); }}
            accessibilityRole="button"
            accessibilityLabel="Select period"
            style={styles.periodPill}
          >
            <Text variant="labelXs" style={styles.periodPillText}>{periodLabel}</Text>
            <View style={{ justifyContent: "center", alignItems: "center", marginLeft: 6 }}>
              <Svg width={10} height={6} viewBox="0 0 10 6" fill="none">
                <Path d="M1 1L5 5L9 1" stroke={COLORS.contentSecondary} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </View>
          </Pressable>

          <View style={styles.navRow}>
            <Pressable
              onPress={handlePrevPeriod}
              disabled={arrowsDisabled}
              accessibilityRole="button"
              accessibilityLabel="Previous month"
              accessibilityState={{ disabled: arrowsDisabled }}
              style={[styles.arrowBtn, arrowsDisabled && styles.arrowBtnDisabled]}
            >
              <ChevronLeft color={arrowsDisabled ? COLORS.contentDisabled : COLORS.contentPrimary} />
            </Pressable>

            <View style={styles.amountRow}>
              <Text tabular style={styles.amountSymbol}>{formatCurrencyParts(grossRevenue).symbol}</Text>
              <Text tabular style={styles.amountText} numberOfLines={1} adjustsFontSizeToFit>
                {formatCurrencyParts(grossRevenue).value}
              </Text>
            </View>

            <Pressable
              onPress={handleNextPeriod}
              disabled={arrowsDisabled || isCurrentOrFutureMonth}
              accessibilityRole="button"
              accessibilityLabel="Next month"
              accessibilityState={{ disabled: arrowsDisabled || isCurrentOrFutureMonth }}
              style={[styles.arrowBtn, (arrowsDisabled || isCurrentOrFutureMonth) && styles.arrowBtnDisabled]}
            >
              <ChevronRight color={(arrowsDisabled || isCurrentOrFutureMonth) ? COLORS.contentDisabled : COLORS.contentPrimary} />
            </Pressable>
          </View>
        </View>

        {/* ── Bar Chart ── */}
        <View style={styles.chartContainer}>
          {barMaxTotal > 0 && (
            <View style={styles.highLineOverlay} pointerEvents="none">
              <View style={styles.dashedLine} />
              <View style={styles.highBadge}>
                <Text variant="labelXs" tabular style={styles.highBadgeText}>HIGH: {formatCurrency(barMaxTotal)}</Text>
              </View>
            </View>
          )}

          {barData.length > 0 && barMaxTotal === 0 ? (
            <EmptyState
              icon="chart-bar"
              title="No earnings this period"
              message="Shifts you log in this period will show up here."
              className="flex-none py-4"
            />
          ) : (
            <View style={styles.chartRow}>
              {barData.map((bar, idx) => {
                const isSelected = selectedBarIndex === idx;
                const barHeightPct = barMaxTotal > 0 ? (bar.total / barMaxTotal) * 100 : 0;
                return (
                  <Pressable
                    key={idx}
                    onPress={() => setSelectedBarIndex(selectedBarIndex === idx ? null : idx)}
                    accessibilityRole="button"
                    accessibilityLabel={`${bar.label}: ${formatCurrency(bar.total)}`}
                    accessibilityState={{ selected: isSelected }}
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
                      variant="paragraphS"
                      style={{
                        color: isSelected ? accentColor : MUTED,
                        fontWeight: isSelected ? "800" : "600",
                      }}
                    >
                      {bar.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
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
                <Text variant="labelXs" style={styles.statLabel}>Gross Revenue</Text>
                <Text variant="headingM" tabular>{formatCurrency(grossRevenue)}</Text>
              </View>
              <View style={styles.statCard}>
                <Text variant="labelXs" style={styles.statLabel}>Net Earnings</Text>
                <Text
                  variant="headingM"
                  tabular
                  style={netIncome < 0 && { color: COLORS.destructive }}
                >
                  {formatCurrency(netIncome)}
                </Text>
              </View>
            </View>
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text variant="labelXs" style={styles.statLabel}>Total Shifts</Text>
                <Text variant="headingM" tabular>{stats?.count ?? 0}</Text>
              </View>
              <View style={styles.statCard}>
                <Text variant="labelXs" style={styles.statLabel}>Mileage Logged</Text>
                <Text variant="headingM" tabular>
                  {totalMileage.toFixed(1)} {profile?.distanceUnit ?? "km"}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* ── Export Actions ── */}
        <View style={styles.exportSection}>
          <Text variant="labelXs" style={styles.sectionLabel}>Export Actions</Text>

          <TouchableOpacity
            onPress={handleExportShifts}
            disabled={!!busyExport}
            accessibilityRole="button"
            accessibilityState={{ disabled: !!busyExport }}
            style={[styles.exportRow, !!busyExport && { opacity: 0.6 }]}
          >
            <View style={styles.exportRowLeft}>
              <View style={styles.exportIconWrap}>
                <Table size={20} color={accentColor} />
              </View>
              <View style={{ gap: 2 }}>
                <Text variant="labelM">Export Shifts CSV</Text>
                <Text variant="paragraphS" style={styles.exportRowSub}>Platform earnings, tips, dates and mileage</Text>
              </View>
            </View>
            {busyExport === "shifts" ? <ActivityIndicator size="small" color={accentColor} /> : <Download size={16} color={MUTED} />}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleExportExpenses}
            disabled={!!busyExport}
            accessibilityRole="button"
            accessibilityState={{ disabled: !!busyExport }}
            style={[styles.exportRow, !!busyExport && { opacity: 0.6 }]}
          >
            <View style={styles.exportRowLeft}>
              <View style={styles.exportIconWrap}>
                <BarChart2 size={20} color={accentColor} />
              </View>
              <View style={{ gap: 2 }}>
                <Text variant="labelM">Export Expenses CSV</Text>
                <Text variant="paragraphS" style={styles.exportRowSub}>Expense log, deductible markings and notes</Text>
              </View>
            </View>
            {busyExport === "expenses" ? <ActivityIndicator size="small" color={accentColor} /> : <Download size={16} color={MUTED} />}
          </TouchableOpacity>

          <TouchableOpacity
            disabled={!!busyExport}
            accessibilityRole="button"
            accessibilityState={{ disabled: !!busyExport }}
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
              !!busyExport && { opacity: 0.6 },
            ]}
          >
            <View style={styles.exportRowLeft}>
              <View style={[
                styles.exportIconWrap,
                isPdfEnabled && { backgroundColor: withAlpha(COLORS.background, 0.15), borderWidth: 0 },
              ]}>
                <FileText size={20} color={isPdfEnabled ? accentColorContrast : accentColor} />
              </View>
              <View style={{ gap: 2 }}>
                <Text variant="labelM" style={isPdfEnabled && { color: accentColorContrast }}>
                  Generate PDF Summary
                </Text>
                <Text variant="paragraphS" style={[styles.exportRowSub, isPdfEnabled && { color: accentColorContrast, opacity: 0.7 }]}>
                  {isPdfEnabled ? "Print-safe tax summary report" : "Unlock in Settings to enable"}
                </Text>
              </View>
            </View>
            {busyExport === "pdf"
              ? <ActivityIndicator size="small" color={accentColorContrast} />
              : isPdfEnabled
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
              <Text variant="headingM">Select Period</Text>
              <Pressable
                onPress={() => setIsModalOpen(false)}
                accessibilityRole="button"
                accessibilityLabel="Done"
                hitSlop={8}
              >
                <Text variant="labelM" style={{ color: accentColor }}>Done</Text>
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
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    style={[
                      styles.presetChip,
                      { flexShrink: 0 },
                      active && { backgroundColor: withAlpha(accentColor, 0.12), borderColor: accentColorMid },
                    ]}
                  >
                    <Text variant="labelM" style={[styles.presetChipText, active && { color: accentColor }]} numberOfLines={1}>
                      {p.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Table sub-header */}
            <View style={styles.tableHeader}>
              <Text variant="labelXs" style={styles.tableHeaderLeft}>Month</Text>
              <Text variant="labelXs" style={styles.tableHeaderRight}>Gross Revenue</Text>
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
                    accessibilityRole="button"
                    accessibilityState={{ selected: isActive }}
                    style={[
                      styles.monthCard,
                      isActive && { borderColor: accentColor, backgroundColor: withAlpha(accentColor, 0.06) },
                    ]}
                  >
                    <View style={styles.monthInfo}>
                      <Text variant="paragraphS" style={styles.monthRangeText}>{m.label} {selectorYear}</Text>
                      <Text variant="headingM" tabular>{formatCurrency(m.total)}</Text>
                    </View>

                    <View style={styles.miniBarContainer}>
                      <View style={styles.miniBarTrack}>
                        <View
                          style={[
                            styles.miniBarFill,
                            {
                              height: `${Math.max(m.barPct, m.total > 0 ? 10 : 2)}%`,
                              backgroundColor: isActive ? accentColor : withAlpha(accentColor, 0.5),
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
                accessibilityRole="button"
                accessibilityState={{ expanded: isCustomExpanded }}
                style={styles.customToggleBtn}
              >
                <Text variant="labelM" style={styles.customToggleText}>
                  {isCustomExpanded ? "▾" : "▸"}{"  "}Custom Date Range
                </Text>
              </Pressable>

              {isCustomExpanded && (
                <View style={styles.customRangeCard}>
                  <View style={{ flexDirection: "row", gap: 12 }}>
                    {/* Start date */}
                    <View style={{ flex: 1, gap: 6 }}>
                      <Text variant="labelXs" style={styles.customDateLabel}>Start</Text>
                      {isWeb ? (
                        <input
                          type="date"
                          value={customStart.toISOString().substring(0, 10)}
                          onChange={(e) => {
                            if (e.target.value) setCustomStart(new Date(e.target.value + "T12:00:00"));
                          }}
                          style={{
                            background: COLORS.surface03,
                            border: `1px solid ${COLORS.lineSubtle}`,
                            borderRadius: 12,
                            padding: "8px 12px",
                            color: COLORS.contentPrimary,
                            fontSize: 12,
                            outline: "none",
                            width: "100%",
                          }}
                        />
                      ) : (
                        <Pressable
                          onPress={() => setShowStartPicker(true)}
                          accessibilityRole="button"
                          accessibilityLabel="Choose start date"
                          style={styles.datePickerBtn}
                        >
                          <Text variant="labelM">
                            {customStart.toLocaleDateString(undefined, { dateStyle: "medium" })}
                          </Text>
                          <CalendarDays size={14} color={accentColor} />
                        </Pressable>
                      )}
                    </View>

                    {/* End date */}
                    <View style={{ flex: 1, gap: 6 }}>
                      <Text variant="labelXs" style={styles.customDateLabel}>End</Text>
                      {isWeb ? (
                        <input
                          type="date"
                          value={customEnd.toISOString().substring(0, 10)}
                          onChange={(e) => {
                            if (e.target.value) setCustomEnd(new Date(e.target.value + "T12:00:00"));
                          }}
                          style={{
                            background: COLORS.surface03,
                            border: `1px solid ${COLORS.lineSubtle}`,
                            borderRadius: 12,
                            padding: "8px 12px",
                            color: COLORS.contentPrimary,
                            fontSize: 12,
                            outline: "none",
                            width: "100%",
                          }}
                        />
                      ) : (
                        <Pressable
                          onPress={() => setShowEndPicker(true)}
                          accessibilityRole="button"
                          accessibilityLabel="Choose end date"
                          style={styles.datePickerBtn}
                        >
                          <Text variant="labelM">
                            {customEnd.toLocaleDateString(undefined, { dateStyle: "medium" })}
                          </Text>
                          <CalendarDays size={14} color={accentColor} />
                        </Pressable>
                      )}
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={handleApplyCustomRange}
                    accessibilityRole="button"
                    style={[styles.applyBtn, { backgroundColor: accentColor }]}
                  >
                    <Text variant="labelM" style={[styles.applyBtnText, { color: accentColorContrast }]}>
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
              <Pressable
                onPress={() => setSelectorYear((y) => y - 1)}
                accessibilityRole="button"
                style={styles.pageBtn}
              >
                <Text variant="labelM">Previous Year</Text>
              </Pressable>
              <Text variant="labelM" tabular style={styles.pageIndicator}>{selectorYear}</Text>
              <Pressable
                onPress={() => setSelectorYear((y) => y + 1)}
                disabled={selectorYear >= new Date().getFullYear()}
                accessibilityRole="button"
                accessibilityState={{ disabled: selectorYear >= new Date().getFullYear() }}
                style={[styles.pageBtn, selectorYear >= new Date().getFullYear() && styles.pageBtnDisabled]}
              >
                <Text variant="labelM">Next Year</Text>
              </Pressable>
            </View>
          </SafeAreaView>
        </Modal>
      )}

      {/* ── Export feedback ── */}
      <BusyOverlay
        visible={!!busyExport}
        label={busyExport === "pdf" ? "Generating PDF…" : "Preparing export…"}
        accentColor={accentColor}
      />
      <FeedbackDialog
        visible={!!dialog}
        variant={dialog?.variant ?? "info"}
        title={dialog?.title ?? ""}
        message={dialog?.message}
        accentColor={accentColor}
        onClose={() => setDialog(null)}
      />
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
    // circular: diameter / 2
    borderRadius: 22,
    backgroundColor: COLORS.surface03,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.lineSubtle,
    alignItems: "center",
    justifyContent: "center",
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
    backgroundColor: COLORS.surface03,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.lineSubtle,
    marginBottom: 20,
    alignSelf: "center",
  },
  periodPillText: { color: COLORS.contentSecondary },
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
  },
  arrowBtn: {
    width: 44,
    height: 44,
    // circular: diameter / 2
    borderRadius: 22,
    backgroundColor: COLORS.surface03,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.lineSubtle,
    justifyContent: "center",
    alignItems: "center",
  },
  arrowBtnDisabled: {
    opacity: 0.35,
    borderColor: COLORS.surface03,
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
    color: COLORS.contentPrimary,
    lineHeight: 30,
    marginTop: 10,
    marginRight: 4,
  },
  amountText: {
    // hero money — no exact variant; explicit size, DS token color
    flexShrink: 1,
    fontSize: 40,
    fontWeight: "800",
    color: COLORS.contentPrimary,
    letterSpacing: -0.5,
    lineHeight: 48,
    paddingVertical: 2,
    includeFontPadding: false,
  },

  // Bar chart
  chartContainer: {
    backgroundColor: COLORS.surface02,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.lineSubtle,
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
    borderColor: COLORS.lineSubtle,
  },
  highBadge: {
    backgroundColor: COLORS.surface02,
    paddingLeft: 8,
  },
  highBadgeText: { color: COLORS.contentSecondary },
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
    backgroundColor: COLORS.surface03,
    borderRadius: 8,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  barFill: {
    width: "100%",
    borderRadius: 8,
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
    backgroundColor: COLORS.surface02,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.lineSubtle,
    padding: 16,
  },
  statLabel: {
    color: COLORS.contentSecondary,
    marginBottom: 6,
  },

  // Export section
  exportSection: {
    paddingHorizontal: 16,
    gap: 10,
  },
  sectionLabel: {
    color: COLORS.contentSecondary,
    marginBottom: 2,
  },
  exportRow: {
    backgroundColor: COLORS.surface02,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.lineSubtle,
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
    // circular: diameter / 2
    borderRadius: 22,
    backgroundColor: COLORS.surface03,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.lineSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  exportRowSub: { color: COLORS.contentSecondary },

  // Modal
  modalRoot: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.lineSubtle,
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
    backgroundColor: COLORS.surface03,
    borderColor: COLORS.lineSubtle,
  },
  presetChipText: { color: COLORS.contentSecondary },
  tableHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.surface02,
  },
  tableHeaderLeft: { color: COLORS.contentSecondary },
  tableHeaderRight: { color: COLORS.contentSecondary },
  modalScroll: {
    paddingVertical: 8,
  },
  monthCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.lineSubtle,
    backgroundColor: COLORS.surface02,
    borderRadius: 20,
    marginHorizontal: 16,
    marginVertical: 6,
  },
  monthInfo: {
    gap: 4,
  },
  monthRangeText: { color: COLORS.contentSecondary },
  miniBarContainer: {
    alignItems: "center",
    justifyContent: "flex-end",
  },
  miniBarTrack: {
    width: 8,
    height: 36,
    backgroundColor: COLORS.surface03,
    // pill: width / 2
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
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.lineSubtle,
    backgroundColor: COLORS.surface03,
  },
  customToggleText: { color: COLORS.contentSecondary },
  customRangeCard: {
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: COLORS.surface02,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.lineSubtle,
    borderRadius: 20,
    padding: 16,
    gap: 12,
  },
  customDateLabel: { color: COLORS.contentMuted },
  datePickerBtn: {
    backgroundColor: COLORS.surface03,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.lineSubtle,
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  applyBtn: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 4,
  },
  applyBtnText: {
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
    borderTopColor: COLORS.lineSubtle,
    backgroundColor: COLORS.background,
  },
  pageBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: COLORS.surface03,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.lineSubtle,
  },
  pageBtnDisabled: {
    opacity: 0.35,
  },
  pageIndicator: { color: COLORS.contentSecondary },
});
