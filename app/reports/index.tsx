import React, { useState, useMemo } from "react";
import {
  ScrollView,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  Share,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import * as FileSystem from "expo-file-system/legacy";
import { Text } from "@/src/components/ui/text";
import { CurrencyText } from "@/src/components/ui/CurrencyText";
import { getPeriodStats } from "@/src/database/queries/analytics";
import { getExpenseYTDSummary } from "@/src/database/queries/expenses";
import { generateShiftsCSV, generateExpensesCSV, generatePDFSummary } from "@/utils/reportGenerator";
import { useSettingsStore } from "@/store/useSettingsStore";
import { cn } from "@/src/lib/utils";

const isWeb = Platform.OS === "web";

type Preset = "this_month" | "last_month" | "this_quarter" | "this_year" | "custom";

interface PresetOption {
  key: Preset;
  label: string;
}

const PRESET_OPTIONS: PresetOption[] = [
  { key: "this_month", label: "This Month" },
  { key: "last_month", label: "Last Month" },
  { key: "this_quarter", label: "This Quarter" },
  { key: "this_year", label: "This Year" },
  { key: "custom", label: "Custom Range" },
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
    end.setDate(0); // last day of last month
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
  const { profile, isOnboardingCompleted } = useSettingsStore();
  const [preset, setPreset] = useState<Preset>("this_month");
  
  // Custom date pickers state
  const [customStart, setCustomStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d;
  });
  const [customEnd, setCustomEnd] = useState(() => new Date());

  const { start, end } = useMemo(() => {
    return getPresetDates(preset, customStart, customEnd);
  }, [preset, customStart, customEnd]);

  // Queries
  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ["reports", "stats", start.toISOString(), end.toISOString()],
    queryFn: () => getPeriodStats(start, end),
    enabled: isOnboardingCompleted,
  });

  const { data: expensesSummary, isLoading: loadingExpenses } = useQuery({
    queryKey: ["reports", "expenses", start.toISOString(), end.toISOString()],
    queryFn: () => getExpenseYTDSummary(), // YTD is fine for cache but we'll calculate local deductions
    enabled: isOnboardingCompleted,
  });

  // Export handlers
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
        await Share.share({ url: fileUri, title: "Export Shifts CSV", message: `Comma Shifts Export` });
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
        await Share.share({ url: fileUri, title: "Export Expenses CSV", message: `Comma Expenses Export` });
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
        await Share.share({ url: result, title: "Export PDF Summary" });
      }
    } catch (err: any) {
      Alert.alert("Export Failed", err.message || "An error occurred generating PDF.");
    }
  };

  const grossRevenue = (stats?.gross || 0) + (stats?.tips || 0);
  const totalMileage = (stats?.activeMileage || 0) + (stats?.deadMileage || 0);
  const totalShifts = stats?.count || 0;

  const isLoading = loadingStats || loadingExpenses;

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
        <Text className="text-slate-100 text-base font-extrabold tracking-tight">Reports & Export</Text>
        <View className="w-10" />
      </View>

      <ScrollView contentContainerClassName="p-4 pb-20 flex flex-col gap-6">
        {/* Preset Selector */}
        <View className="flex flex-col gap-2">
          <Text className="text-slate-400 text-xs font-bold uppercase tracking-wide">Report Period</Text>
          <View className="flex-row flex-wrap gap-2">
            {PRESET_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                onPress={() => setPreset(opt.key)}
                className={cn(
                  "px-3 py-2 rounded-xl border flex-1 min-w-[45%] items-center",
                  preset === opt.key
                    ? "border-emerald-500 bg-emerald-500/10"
                    : "border-slate-800 bg-slate-900/40"
                )}
              >
                <Text
                  className={cn(
                    "text-xs font-bold",
                    preset === opt.key ? "text-emerald-400" : "text-slate-400"
                  )}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Custom Date Pickers */}
        {preset === "custom" && (
          <View className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex flex-row gap-3">
            <View className="flex-1 flex-col gap-1">
              <Text className="text-[10px] text-slate-500 font-bold uppercase">Start Date</Text>
              <input
                type="date"
                value={customStart.toISOString().substring(0, 10)}
                onChange={(e) => {
                  if (e.target.value) setCustomStart(new Date(e.target.value + "T12:00:00"));
                }}
                className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 text-xs w-full outline-none focus:border-emerald-500"
              />
            </View>
            <View className="flex-1 flex-col gap-1">
              <Text className="text-[10px] text-slate-500 font-bold uppercase">End Date</Text>
              <input
                type="date"
                value={customEnd.toISOString().substring(0, 10)}
                onChange={(e) => {
                  if (e.target.value) setCustomEnd(new Date(e.target.value + "T12:00:00"));
                }}
                className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 text-xs w-full outline-none focus:border-emerald-500"
              />
            </View>
          </View>
        )}

        {/* Summary Card Preview */}
        {isLoading ? (
          <View className="py-12 items-center">
            <ActivityIndicator size="large" color="#10b981" />
          </View>
        ) : (
          <View className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 flex flex-col gap-4">
            <Text className="text-slate-300 text-xs font-bold uppercase tracking-wider">Period Summary Preview</Text>
            
            <View className="flex-row gap-3">
              <View className="flex-1 flex-col gap-0.5">
                <Text className="text-[9px] text-slate-500 font-bold uppercase">Gross Revenue</Text>
                <CurrencyText amount={grossRevenue} size="sm" className="font-extrabold text-slate-200" />
              </View>
              <View className="flex-1 flex-col gap-0.5">
                <Text className="text-[9px] text-slate-500 font-bold uppercase">Total Shifts</Text>
                <Text className="text-sm font-extrabold text-slate-200">{totalShifts}</Text>
              </View>
            </View>

            <View className="flex-row gap-3">
              <View className="flex-1 flex-col gap-0.5">
                <Text className="text-[9px] text-slate-500 font-bold uppercase">Mileage Logged</Text>
                <Text className="text-sm font-extrabold text-slate-200">
                  {totalMileage.toFixed(1)} {profile.distanceUnit}
                </Text>
              </View>
              <View className="flex-1 flex-col gap-0.5">
                <Text className="text-[9px] text-slate-500 font-bold uppercase">Active Ratio</Text>
                <Text className="text-sm font-extrabold text-slate-200">
                  {totalMileage > 0 ? `${((stats?.activeMileage || 0) / totalMileage * 100).toFixed(0)}%` : "0%"}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Export Buttons */}
        <View className="flex flex-col gap-3">
          <Text className="text-slate-400 text-xs font-bold uppercase tracking-wide">Export Actions</Text>

          <TouchableOpacity
            onPress={handleExportShifts}
            className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex-row justify-between items-center active:border-slate-700"
          >
            <View className="flex-col gap-0.5">
              <Text className="text-sm font-bold text-slate-200">Export Shifts CSV</Text>
              <Text className="text-[10px] text-slate-500">Platform earnings, tips, dates and mileage breakdown</Text>
            </View>
            <Text className="text-lg">📊</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleExportExpenses}
            className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex-row justify-between items-center active:border-slate-700"
          >
            <View className="flex-col gap-0.5">
              <Text className="text-sm font-bold text-slate-200">Export Expenses CSV</Text>
              <Text className="text-[10px] text-slate-500">Expense log, deductible markings and notes</Text>
            </View>
            <Text className="text-lg">💵</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleExportPDF}
            className="bg-emerald-500 rounded-2xl p-4 flex-row justify-between items-center active:opacity-90"
          >
            <View className="flex-col gap-0.5">
              <Text className="text-sm font-bold text-white">Generate PDF Summary</Text>
              <Text className="text-[10px] text-white/80">Clean, print-safe tax summary report with branding</Text>
            </View>
            <Text className="text-lg">📄</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
