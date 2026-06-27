import React, { useState, useMemo } from "react";
import {
  ScrollView,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import DateTimePicker from "@react-native-community/datetimepicker";
import { ArrowLeft, FileText, Table, BarChart2, Download, CalendarDays } from "lucide-react-native";
import { Text } from "@/src/components/ui/text";
import { CurrencyText } from "@/src/components/ui/CurrencyText";
import { getPeriodStats } from "@/src/database/queries/analytics";
import { getExpenseYTDSummary } from "@/src/database/queries/expenses";
import { generateShiftsCSV, generateExpensesCSV, generatePDFSummary } from "@/utils/reportGenerator";
import { useSettingsStore } from "@/store/useSettingsStore";
import { usePlatformTheme } from "@/src/hooks/usePlatformTheme";

const isWeb = Platform.OS === "web";

// ─── Design tokens ────────────────────────────────────────────────────────────
const BG      = "#000000";
const SURFACE = "#0d0d0d";
const PILL    = "#161615";
const BORDER  = "#1f1f1f";
const BORDER2 = "#262522";
const MUTED   = "#71717a";
const DIM     = "#52525b";

type Preset = "this_month" | "last_month" | "this_quarter" | "this_year" | "custom";

interface PresetOption { key: Preset; label: string; }

const PRESET_OPTIONS: PresetOption[] = [
  { key: "this_month",    label: "This Month" },
  { key: "last_month",    label: "Last Month" },
  { key: "this_quarter",  label: "This Quarter" },
  { key: "this_year",     label: "This Year" },
  { key: "custom",        label: "Custom Range" },
];

function getPresetDates(preset: Preset, customStart?: Date, customEnd?: Date): { start: Date; end: Date } {
  const start = new Date();
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  start.setHours(0, 0, 0, 0);

  if (preset === "this_month") {
    start.setDate(1);
  } else if (preset === "last_month") {
    start.setMonth(start.getMonth() - 1);
    start.setDate(1);
    end.setDate(0);
  } else if (preset === "this_quarter") {
    const quarter = Math.floor(start.getMonth() / 3);
    start.setMonth(quarter * 3);
    start.setDate(1);
  } else if (preset === "this_year") {
    start.setMonth(0, 1);
  } else if (preset === "custom" && customStart && customEnd) {
    return { start: customStart, end: customEnd };
  }

  return { start, end };
}

export default function ReportsScreen() {
  const insets = useSafeAreaInsets();
  const { profile, isOnboardingCompleted } = useSettingsStore();
  const { accentColor, accentColorDim, accentColorMid, accentColorContrast } = usePlatformTheme();

  const [preset, setPreset] = useState<Preset>("this_month");

  const [customStart, setCustomStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d;
  });
  const [customEnd, setCustomEnd] = useState(() => new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const { start, end } = useMemo(() => getPresetDates(preset, customStart, customEnd), [preset, customStart, customEnd]);

  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ["reports", "stats", start.toISOString(), end.toISOString()],
    queryFn: () => getPeriodStats(start, end),
    enabled: isOnboardingCompleted,
  });

  const { data: expensesSummary, isLoading: loadingExpenses } = useQuery({
    queryKey: ["reports", "expenses", start.toISOString(), end.toISOString()],
    queryFn: () => getExpenseYTDSummary(),
    enabled: isOnboardingCompleted,
  });

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

  const grossRevenue = (stats?.gross || 0) + (stats?.tips || 0);
  const totalMileage = (stats?.activeMileage || 0) + (stats?.deadMileage || 0);
  const totalShifts  = stats?.count || 0;
  const isLoading    = loadingStats || loadingExpenses;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BG }}>
      {/* Header */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, paddingTop: insets.top + 14 }}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: PILL, borderWidth: 0.8, borderColor: BORDER2, alignItems: "center", justifyContent: "center" }}
        >
          <ArrowLeft size={20} color="#ffffff" strokeWidth={2.5} />
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: "900", color: "#ffffff", letterSpacing: -0.3 }}>Reports & Export</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48, gap: 20 }} showsVerticalScrollIndicator={false}>
        {/* ── Period Selector ── */}
        <View style={{ gap: 10 }}>
          <Text style={{ fontSize: 11, fontWeight: "800", color: MUTED, textTransform: "uppercase", letterSpacing: 1 }}>Report Period</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {PRESET_OPTIONS.map((opt) => {
              const active = preset === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  onPress={() => setPreset(opt.key)}
                  style={{
                    flex: 1,
                    minWidth: "45%",
                    paddingVertical: 10,
                    paddingHorizontal: 14,
                    borderRadius: 14,
                    borderWidth: 0.8,
                    alignItems: "center",
                    backgroundColor: active ? accentColorDim : SURFACE,
                    borderColor: active ? accentColorMid : BORDER,
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: "800", color: active ? accentColor : MUTED }}>{opt.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Custom Date Range ── */}
        {preset === "custom" && (
          <View style={{ backgroundColor: SURFACE, borderWidth: 0.8, borderColor: BORDER, borderRadius: 20, padding: 16, gap: 12 }}>
            <Text style={{ fontSize: 11, fontWeight: "800", color: MUTED, textTransform: "uppercase", letterSpacing: 0.8 }}>Custom Date Range</Text>
            <View style={{ flexDirection: "row", gap: 12 }}>
              {/* Start */}
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={{ fontSize: 10, fontWeight: "800", color: DIM, textTransform: "uppercase", letterSpacing: 0.5 }}>Start</Text>
                {isWeb ? (
                  <input
                    type="date"
                    value={customStart.toISOString().substring(0, 10)}
                    onChange={(e) => { if (e.target.value) setCustomStart(new Date(e.target.value + "T12:00:00")); }}
                    style={{ background: "#161615", border: "1px solid #262522", borderRadius: 12, padding: "8px 12px", color: "#ffffff", fontSize: 12, outline: "none", width: "100%" }}
                  />
                ) : (
                  <TouchableOpacity
                    onPress={() => setShowStartPicker(true)}
                    style={{ backgroundColor: PILL, borderWidth: 0.8, borderColor: BORDER2, borderRadius: 12, padding: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
                  >
                    <Text style={{ color: "#ffffff", fontSize: 12, fontWeight: "600" }}>{customStart.toLocaleDateString(undefined, { dateStyle: "medium" })}</Text>
                    <CalendarDays size={14} color={accentColor} />
                  </TouchableOpacity>
                )}
              </View>
              {/* End */}
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={{ fontSize: 10, fontWeight: "800", color: DIM, textTransform: "uppercase", letterSpacing: 0.5 }}>End</Text>
                {isWeb ? (
                  <input
                    type="date"
                    value={customEnd.toISOString().substring(0, 10)}
                    onChange={(e) => { if (e.target.value) setCustomEnd(new Date(e.target.value + "T12:00:00")); }}
                    style={{ background: "#161615", border: "1px solid #262522", borderRadius: 12, padding: "8px 12px", color: "#ffffff", fontSize: 12, outline: "none", width: "100%" }}
                  />
                ) : (
                  <TouchableOpacity
                    onPress={() => setShowEndPicker(true)}
                    style={{ backgroundColor: PILL, borderWidth: 0.8, borderColor: BORDER2, borderRadius: 12, padding: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
                  >
                    <Text style={{ color: "#ffffff", fontSize: 12, fontWeight: "600" }}>{customEnd.toLocaleDateString(undefined, { dateStyle: "medium" })}</Text>
                    <CalendarDays size={14} color={accentColor} />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {!isWeb && showStartPicker && (
              <DateTimePicker
                value={customStart}
                mode="date"
                display="default"
                onChange={(event, selectedDate) => { setShowStartPicker(false); if (selectedDate) setCustomStart(selectedDate); }}
              />
            )}
            {!isWeb && showEndPicker && (
              <DateTimePicker
                value={customEnd}
                mode="date"
                display="default"
                onChange={(event, selectedDate) => { setShowEndPicker(false); if (selectedDate) setCustomEnd(selectedDate); }}
              />
            )}
          </View>
        )}

        {/* ── Summary Preview ── */}
        {isLoading ? (
          <View style={{ paddingVertical: 40, alignItems: "center" }}>
            <ActivityIndicator size="large" color={accentColor} />
          </View>
        ) : (
          <View style={{ backgroundColor: SURFACE, borderWidth: 0.8, borderColor: BORDER, borderRadius: 20, overflow: "hidden" }}>
            <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12, borderBottomWidth: 0.5, borderBottomColor: "#161615" }}>
              <Text style={{ fontSize: 11, fontWeight: "800", color: MUTED, textTransform: "uppercase", letterSpacing: 1 }}>Period Summary Preview</Text>
            </View>
            <View style={{ padding: 16, gap: 16 }}>
              <View style={{ flexDirection: "row", gap: 16 }}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={{ fontSize: 10, fontWeight: "800", color: DIM, textTransform: "uppercase", letterSpacing: 0.5 }}>Gross Revenue</Text>
                  <CurrencyText amount={grossRevenue} size="sm" style={{ fontWeight: "800", color: "#ffffff", fontSize: 18 }} />
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={{ fontSize: 10, fontWeight: "800", color: DIM, textTransform: "uppercase", letterSpacing: 0.5 }}>Total Shifts</Text>
                  <Text style={{ fontSize: 18, fontWeight: "800", color: "#ffffff" }}>{totalShifts}</Text>
                </View>
              </View>
              <View style={{ flexDirection: "row", gap: 16 }}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={{ fontSize: 10, fontWeight: "800", color: DIM, textTransform: "uppercase", letterSpacing: 0.5 }}>Mileage Logged</Text>
                  <Text style={{ fontSize: 18, fontWeight: "800", color: "#ffffff" }}>{totalMileage.toFixed(1)} {profile.distanceUnit}</Text>
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={{ fontSize: 10, fontWeight: "800", color: DIM, textTransform: "uppercase", letterSpacing: 0.5 }}>Active Ratio</Text>
                  <Text style={{ fontSize: 18, fontWeight: "800", color: "#ffffff" }}>
                    {totalMileage > 0 ? `${(((stats?.activeMileage || 0) / totalMileage) * 100).toFixed(0)}%` : "0%"}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* ── Export Actions ── */}
        <View style={{ gap: 10 }}>
          <Text style={{ fontSize: 11, fontWeight: "800", color: MUTED, textTransform: "uppercase", letterSpacing: 1 }}>Export Actions</Text>

          <TouchableOpacity
            onPress={handleExportShifts}
            style={{ backgroundColor: SURFACE, borderWidth: 0.8, borderColor: BORDER, borderRadius: 20, padding: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: PILL, borderWidth: 0.8, borderColor: BORDER2, alignItems: "center", justifyContent: "center" }}>
                <Table size={20} color={accentColor} />
              </View>
              <View style={{ gap: 2 }}>
                <Text style={{ fontSize: 14, fontWeight: "800", color: "#ffffff" }}>Export Shifts CSV</Text>
                <Text style={{ fontSize: 11, color: MUTED }}>Platform earnings, tips, dates and mileage</Text>
              </View>
            </View>
            <Download size={16} color={MUTED} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleExportExpenses}
            style={{ backgroundColor: SURFACE, borderWidth: 0.8, borderColor: BORDER, borderRadius: 20, padding: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: PILL, borderWidth: 0.8, borderColor: BORDER2, alignItems: "center", justifyContent: "center" }}>
                <BarChart2 size={20} color={accentColor} />
              </View>
              <View style={{ gap: 2 }}>
                <Text style={{ fontSize: 14, fontWeight: "800", color: "#ffffff" }}>Export Expenses CSV</Text>
                <Text style={{ fontSize: 11, color: MUTED }}>Expense log, deductible markings and notes</Text>
              </View>
            </View>
            <Download size={16} color={MUTED} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleExportPDF}
            style={{ backgroundColor: accentColor, borderRadius: 20, padding: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(0,0,0,0.15)", alignItems: "center", justifyContent: "center" }}>
                <FileText size={20} color={accentColorContrast} />
              </View>
              <View style={{ gap: 2 }}>
                <Text style={{ fontSize: 14, fontWeight: "800", color: accentColorContrast }}>Generate PDF Summary</Text>
                <Text style={{ fontSize: 11, color: accentColorContrast, opacity: 0.7 }}>Print-safe tax summary report</Text>
              </View>
            </View>
            <Download size={16} color={accentColorContrast} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
