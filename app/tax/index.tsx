import React, { useState, useEffect } from "react";
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
import { router } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Calculator,
  Calendar,
  TrendingUp,
  Clock,
  Car,
  Download,
  Info,
  ChevronRight,
  ExternalLink,
} from "lucide-react-native";
import { Text } from "@/src/components/ui/text";
import { useSettingsStore } from "@/store/useSettingsStore";
import { db } from "@/src/database/client";
import { shifts, expenses, settings } from "@/src/database/schema";
import { and, gte, lte, eq } from "drizzle-orm";
import {
  PROVINCIAL_HST_RATES,
  calculateCPP,
  calculateSelfEmploymentTax,
  calculateCRAMileageDeduction,
  calculateIRSMileageDeduction,
} from "@/utils/taxCalculations";

const isWeb = Platform.OS === "web";

async function upsertSetting(key: string, value: string) {
  if (isWeb) {
    localStorage.setItem(`comma_setting_${key}`, value);
    return;
  }
  await db
    .insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } });
}

interface TaxSummary {
  gross: number;
  businessExpenses: number;
  netIncome: number;
  virtualJar: number;
  distanceKm: number;
  activeMileage: number;
  deadMileage: number;
}

async function fetchTaxSummary(year: number): Promise<TaxSummary> {
  let rawShifts = [];
  let rawExpenses = [];

  if (isWeb) {
    try {
      const sData = localStorage.getItem("comma_shifts");
      const eData = localStorage.getItem("comma_expenses");
      rawShifts = sData ? JSON.parse(sData) : [];
      rawExpenses = eData ? JSON.parse(eData) : [];
    } catch (e) {
      console.error(e);
    }
  } else {
    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999);

    rawShifts = await db
      .select()
      .from(shifts)
      .where(and(gte(shifts.startTime, startOfYear), lte(shifts.startTime, endOfYear)));

    rawExpenses = await db
      .select()
      .from(expenses)
      .where(and(gte(expenses.date, startOfYear), lte(expenses.date, endOfYear)));
  }

  if (isWeb) {
    const start = new Date(year, 0, 1).getTime();
    const end = new Date(year, 11, 31, 23, 59, 59, 999).getTime();
    rawShifts = rawShifts.filter((s: any) => {
      const t = new Date(s.startTime).getTime();
      return t >= start && t <= end;
    });
    rawExpenses = rawExpenses.filter((e: any) => {
      const t = new Date(e.date).getTime();
      return t >= start && t <= end;
    });
  }

  let gross = 0;
  let tips = 0;
  let distanceKm = 0;
  let activeMileage = 0;
  let deadMileage = 0;

  rawShifts.forEach((s: any) => {
    gross += Number(s.grossRevenue || 0);
    tips += Number(s.tipsRevenue || 0);
    distanceKm += Number(s.activeMileage || s.trackedMileage || 0) + Number(s.deadMileage || 0);
    activeMileage += Number(s.activeMileage || s.trackedMileage || 0);
    deadMileage += Number(s.deadMileage || 0);
  });

  let totalExpenses = 0;
  rawExpenses.forEach((e: any) => {
    if (e.isDeductible) {
      totalExpenses += Number(e.amount || 0);
    }
  });

  const netIncome = Math.max(0, (gross + tips) - totalExpenses);

  let virtualJar = 0;
  const jarKey = `tax_virtual_jar_${year}`;
  if (isWeb) {
    try {
      const val = localStorage.getItem(`comma_setting_${jarKey}`);
      virtualJar = val ? Number(val) : 0;
    } catch {}
  } else {
    try {
      const row = await db.select().from(settings).where(eq(settings.key, jarKey)).limit(1);
      virtualJar = row[0]?.value ? Number(row[0].value) : 0;
    } catch {}
  }

  return {
    gross: gross + tips,
    businessExpenses: totalExpenses,
    netIncome,
    virtualJar,
    distanceKm,
    activeMileage,
    deadMileage,
  };
}

interface Deadline {
  label: string;
  date: Date;
  daysUntil: number;
}

function getDeadlines(country: "US" | "CA", year: number): Deadline[] {
  const now = new Date();
  const currentYear = year;
  const list: { label: string; date: Date }[] = [];

  if (country === "CA") {
    list.push(
      { label: "Q1 Installment", date: new Date(currentYear, 2, 15) },
      { label: "Q2 Installment", date: new Date(currentYear, 5, 15) },
      { label: "Q3 Installment", date: new Date(currentYear, 8, 15) },
      { label: "Q4 Installment", date: new Date(currentYear, 11, 15) },
      { label: "Self-Employed Filing Deadline", date: new Date(currentYear + 1, 5, 15) }
    );
  } else {
    list.push(
      { label: "Q1 Estimated Payment", date: new Date(currentYear, 3, 15) },
      { label: "Q2 Estimated Payment", date: new Date(currentYear, 5, 15) },
      { label: "Q3 Estimated Payment", date: new Date(currentYear, 8, 15) },
      { label: "Q4 Estimated Payment", date: new Date(currentYear + 1, 0, 15) },
      { label: "Federal Income Tax Return Filing", date: new Date(currentYear + 1, 3, 15) }
    );
  }

  return list.map((item) => {
    const daysUntil = Math.ceil((item.date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return {
      ...item,
      daysUntil,
    };
  });
}

const REGION_PRESETS_CA = Object.entries(PROVINCIAL_HST_RATES).map(([code, rate]) => ({
  code,
  rate: Math.round(rate * 100),
}));

const REGION_PRESETS_US = [
  { code: "CA", rate: 30 },
  { code: "NY", rate: 28 },
  { code: "TX", rate: 25 },
  { code: "FL", rate: 25 },
  { code: "IL", rate: 27 },
  { code: "PA", rate: 26 },
  { code: "OH", rate: 25 },
  { code: "GA", rate: 25 },
  { code: "NC", rate: 25 },
  { code: "MI", rate: 26 },
];

export default function TaxDashboardScreen() {
  const queryClient = useQueryClient();
  const { profile, loadSettings } = useSettingsStore();
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());

  const { data: summary, isLoading, refetch } = useQuery({
    queryKey: ["tax", "summary", selectedYear],
    queryFn: () => fetchTaxSummary(selectedYear),
  });

  const currencySymbol = profile.country === "CA" ? "$" : "$";
  const currencyCode = profile.country === "CA" ? "CAD" : "USD";

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currencyCode,
      minimumFractionDigits: 2,
    }).format(val);
  };

  const targetSetAside = summary ? summary.gross * (profile.taxWithholdingPct / 100) : 0;
  const jarCoveragePct = targetSetAside > 0 && summary ? Math.min(100, (summary.virtualJar / targetSetAside) * 100) : 0;

  // Region Presets
  const regionPresets = profile.country === "CA" ? REGION_PRESETS_CA : REGION_PRESETS_US;
  const currentRegion = profile.taxRegion || (profile.country === "CA" ? "ON" : "CA");

  const handleAdjustJar = async (amount: number) => {
    if (!summary) return;
    const next = Math.max(0, summary.virtualJar + amount);
    const jarKey = `tax_virtual_jar_${selectedYear}`;
    await upsertSetting(jarKey, String(next));
    queryClient.setQueryData(["tax", "summary", selectedYear], (prev: any) => ({
      ...prev,
      virtualJar: next,
    }));
  };

  const handleApplyPreset = async (regionCode: string, ratePct: number) => {
    try {
      const updatedProfile = {
        ...profile,
        taxRegion: regionCode,
        taxWithholdingPct: ratePct,
      };
      await upsertSetting("profile", JSON.stringify(updatedProfile));
      await loadSettings();
      refetch();
      Alert.alert("Success", `Applied preset for ${regionCode} with ${ratePct}% withholding rate.`);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to apply preset.");
    }
  };

  const handleExport = async (format: "json" | "csv") => {
    if (!summary) return;

    const deadlinesList = getDeadlines(profile.country, selectedYear);
    const fileSafeCountry = profile.country.toLowerCase();
    const filename = `comma-tax-summary-${fileSafeCountry}-${selectedYear}.${format}`;

    let exportText = "";
    if (format === "json") {
      exportText = JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          year: selectedYear,
          country: profile.country,
          currency: currencyCode,
          taxRatePct: profile.taxWithholdingPct,
          gross: summary.gross,
          businessExpenses: summary.businessExpenses,
          netIncome: summary.netIncome,
          taxSetAside: targetSetAside,
          virtualJar: summary.virtualJar,
          distanceKm: summary.distanceKm,
          deadlines: deadlinesList.map((d) => ({
            label: d.label,
            date: d.date.toISOString().split("T")[0],
            daysUntil: d.daysUntil,
          })),
        },
        null,
        2
      );
    } else {
      const rows = [
        ["metric", "value"],
        ["generated_at", new Date().toISOString()],
        ["tax_year", selectedYear],
        ["country", profile.country],
        ["currency", currencyCode],
        ["tax_rate_pct", profile.taxWithholdingPct],
        ["gross", summary.gross],
        ["business_expenses", summary.businessExpenses],
        ["net_income", summary.netIncome],
        ["tax_set_aside", targetSetAside],
        ["virtual_jar", summary.virtualJar],
        ["distance_km", summary.distanceKm],
      ];
      deadlinesList.forEach((d, idx) => {
        rows.push([`deadline_${idx + 1}`, `${d.date.toISOString().split("T")[0]} (${d.label})`]);
      });
      exportText = rows.map((row) => row.map((s) => `"${String(s).replace(/"/g, '""')}"`).join(",")).join("\n");
    }

    if (isWeb) {
      const blob = new Blob([exportText], { type: format === "json" ? "application/json" : "text/csv" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      try {
        await Share.share({
          title: `Export Tax ${format.toUpperCase()}`,
          message: exportText,
        });
      } catch (err: any) {
        Alert.alert("Export Failed", err.message || "Could not share file.");
      }
    }
  };

  const deadlines = getDeadlines(profile.country, selectedYear);

  // Estimates Calculations
  const netIncome = summary?.netIncome || 0;
  const cppEstimate = profile.country === "CA" ? calculateCPP(netIncome).employeePortion : 0;
  const seTaxEstimate = profile.country === "US" ? calculateSelfEmploymentTax(netIncome) : 0;
  const mileageDeduction =
    profile.country === "CA"
      ? calculateCRAMileageDeduction(summary?.distanceKm || 0)
      : calculateIRSMileageDeduction((summary?.distanceKm || 0) * 0.621371);

  if (isLoading) {
    return (
      <SafeAreaView className="dark flex-1 bg-[#0b0f19] items-center justify-center">
        <ActivityIndicator size="large" color="#10b981" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="dark flex-1 bg-[#0b0f19]">
      {/* Header */}
      <View className="px-4 pt-3 pb-3 border-b border-slate-800/80 bg-slate-900/40 flex-row items-center justify-between">
        <View className="flex-row items-center gap-3">
          <TouchableOpacity onPress={() => router.back()} className="p-1.5 rounded-lg bg-slate-850 active:bg-slate-800">
            <ArrowLeft size={18} color="#f4f2ed" />
          </TouchableOpacity>
          <View>
            <Text className="text-base font-extrabold text-slate-100 tracking-tight">Tax Center</Text>
            <Text className="text-[10px] text-slate-400">Quarterly installments & set-aside</Text>
          </View>
        </View>

        {/* Year Selector */}
        <View className="flex-row gap-1 bg-slate-950/80 border border-slate-800 rounded-lg p-0.5">
          {[0, 1].map((delta) => {
            const year = new Date().getFullYear() - delta;
            const active = selectedYear === year;
            return (
              <TouchableOpacity
                key={year}
                onPress={() => setSelectedYear(year)}
                className={`px-3 py-1 rounded-md ${active ? "bg-emerald-500" : "bg-transparent"}`}
              >
                <Text className={`text-[10px] font-extrabold ${active ? "text-white" : "text-slate-400"}`}>
                  {year}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <ScrollView contentContainerClassName="p-4 pb-16 flex flex-col gap-4">
        {/* Virtual Jar Card */}
        <View style={styles.bentoCardOuter}>
          <View style={styles.bentoHeader}>
            <Text style={styles.bentoTitle}>Virtual Tax Jar</Text>
            <Text style={styles.bentoDesc}>Save as you go to cover liabilities</Text>
          </View>
          <View className="items-center py-4 gap-4">
            <View className="w-28 h-28 rounded-full border-4 border-emerald-500/20 items-center justify-center relative">
              <Text className="text-2xl font-black text-slate-100">{jarCoveragePct.toFixed(0)}%</Text>
              <Text className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest mt-0.5">Covered</Text>
              <View
                style={{
                  position: "absolute",
                  bottom: -2,
                  backgroundColor: "#10b981",
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 999,
                }}
              >
                <Text style={{ fontSize: 8, fontWeight: "900", color: "#ffffff" }}>
                  {profile.taxWithholdingPct}% RATE
                </Text>
              </View>
            </View>

            <View className="flex-row w-full justify-around border-t border-b border-slate-850 py-3 mt-2">
              <View className="items-center">
                <Text className="text-2xs font-extrabold text-slate-400 uppercase tracking-wider">Target</Text>
                <Text className="text-sm font-bold text-slate-200 mt-1">{formatCurrency(targetSetAside)}</Text>
              </View>
              <View className="items-center">
                <Text className="text-2xs font-extrabold text-slate-400 uppercase tracking-wider">Saved</Text>
                <Text className="text-sm font-bold text-emerald-400 mt-1">{formatCurrency(summary?.virtualJar || 0)}</Text>
              </View>
            </View>

            {/* Adjust Buttons */}
            <View className="flex-row gap-2.5 mt-1">
              {[-25, -10, 10, 25].map((amt) => (
                <TouchableOpacity
                  key={amt}
                  onPress={() => handleAdjustJar(amt)}
                  className="px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-800 active:bg-slate-850"
                >
                  <Text className={`text-xs font-bold ${amt > 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {amt > 0 ? `+${amt}` : amt}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Income Snapshot Bento Grid */}
        <View className="flex-row justify-between">
          <View style={[styles.bentoCardOuter, { width: "48.5%", padding: 12 }]}>
            <Text className="text-2xs font-extrabold text-slate-400 uppercase tracking-wider">Gross Income</Text>
            <Text className="text-base font-black text-slate-100 mt-2">{formatCurrency(summary?.gross || 0)}</Text>
            <Text className="text-[10px] text-slate-500 mt-1">Total revenue + tips</Text>
          </View>
          <View style={[styles.bentoCardOuter, { width: "48.5%", padding: 12 }]}>
            <Text className="text-2xs font-extrabold text-slate-400 uppercase tracking-wider">Business Expenses</Text>
            <Text className="text-base font-black text-rose-400 mt-2">{formatCurrency(summary?.businessExpenses || 0)}</Text>
            <Text className="text-[10px] text-slate-500 mt-1">Deductible YTD claims</Text>
          </View>
        </View>

        <View style={styles.bentoCardOuter}>
          <View style={styles.bentoHeader}>
            <Text style={styles.bentoTitle}>Net Take-Home</Text>
          </View>
          <View className="p-3 flex-row justify-between items-center">
            <View>
              <Text className="text-lg font-black text-emerald-400">{formatCurrency(netIncome)}</Text>
              <Text className="text-[10px] text-slate-400 mt-0.5">Net taxable profit</Text>
            </View>
            <View className="items-end">
              <Text className="text-sm font-bold text-slate-300">
                {formatCurrency(Math.max(0, netIncome - targetSetAside))}
              </Text>
              <Text className="text-[10px] text-slate-500 mt-0.5">Net after withholdings</Text>
            </View>
          </View>
        </View>

        {/* Region & Presets */}
        <View style={styles.bentoCardOuter}>
          <View style={styles.bentoHeader}>
            <Text style={styles.bentoTitle}>Province/State Presets</Text>
            <Text style={styles.bentoDesc}>Apply standard regional rates</Text>
          </View>
          <View className="p-3">
            <View className="flex-row flex-wrap gap-2">
              {regionPresets.map((r) => {
                const isActive = currentRegion === r.code;
                return (
                  <TouchableOpacity
                    key={r.code}
                    onPress={() => handleApplyPreset(r.code, r.rate)}
                    className={`px-3 py-2 rounded-lg border ${
                      isActive
                        ? "bg-emerald-500 border-emerald-500"
                        : "bg-slate-900 border-slate-800 active:bg-slate-850"
                    }`}
                  >
                    <Text className={`text-2xs font-extrabold ${isActive ? "text-white" : "text-slate-350"}`}>
                      {r.code} ({r.rate}%)
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {/* Estimates & Withholding */}
        <View style={styles.bentoCardOuter}>
          <View style={styles.bentoHeader}>
            <Text style={styles.bentoTitle}>Tax Estimates</Text>
            <Text style={styles.bentoDesc}>Based on self-employment rules</Text>
          </View>
          <View className="p-3 gap-3">
            {profile.country === "CA" ? (
              <View className="flex-row justify-between items-center">
                <View>
                  <Text className="text-xs font-bold text-slate-200">CPP Employee Contribution</Text>
                  <Text className="text-[10px] text-slate-500 mt-0.5">Canada Pension Plan portion (5.95%)</Text>
                </View>
                <Text className="text-sm font-extrabold text-slate-100">{formatCurrency(cppEstimate)}</Text>
              </View>
            ) : (
              <View className="flex-row justify-between items-center">
                <View>
                  <Text className="text-xs font-bold text-slate-200">Self-Employment Tax</Text>
                  <Text className="text-[10px] text-slate-500 mt-0.5">SS + Medicare on 92.35% profit</Text>
                </View>
                <Text className="text-sm font-extrabold text-slate-100">{formatCurrency(seTaxEstimate)}</Text>
              </View>
            )}

            {/* Mileage Deductions comparison */}
            <View className="border-t border-slate-850 pt-3 flex-row justify-between items-center">
              <View>
                <Text className="text-xs font-bold text-slate-200">Standard Mileage Deduction</Text>
                <Text className="text-[10px] text-slate-500 mt-0.5">
                  Write-off based on total {summary?.distanceKm.toFixed(0)} km
                </Text>
              </View>
              <Text className="text-sm font-extrabold text-emerald-400">{formatCurrency(mileageDeduction)}</Text>
            </View>
          </View>
        </View>

        {/* Deadlines Card */}
        <View style={styles.bentoCardOuter}>
          <View style={styles.bentoHeader}>
            <Text style={styles.bentoTitle}>Installment Deadlines</Text>
            <Text style={styles.bentoDesc}>Upcoming filing & pay windows</Text>
          </View>
          <View className="p-3 gap-3">
            {deadlines.map((d, index) => {
              const overdue = d.daysUntil < 0;
              const urgent = d.daysUntil >= 0 && d.daysUntil <= 14;
              return (
                <View key={index} className="flex-row items-center justify-between border-b border-slate-900 pb-2.5 last:border-b-0 last:pb-0">
                  <View className="flex-row items-center gap-3">
                    <View className="w-10 h-10 rounded-lg bg-slate-950/80 border border-slate-800 items-center justify-center">
                      <Clock size={16} color={overdue ? "#f43f5e" : urgent ? "#f59e0b" : "#a1a1aa"} />
                    </View>
                    <View>
                      <Text className="text-xs font-bold text-slate-200">{d.label}</Text>
                      <Text className="text-[10px] text-slate-500 mt-0.5">
                        {d.date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                      </Text>
                    </View>
                  </View>
                  <View className="items-end">
                    <Text className={`text-[10px] font-black ${overdue ? "text-rose-500" : urgent ? "text-amber-500" : "text-slate-400"}`}>
                      {overdue ? "OVERDUE" : `${d.daysUntil} days left`}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* Export & Footer */}
        <View style={styles.bentoCardOuter}>
          <View style={styles.bentoHeader}>
            <Text style={styles.bentoTitle}>Export Tax Summary</Text>
            <Text style={styles.bentoDesc}>Save or share tax spreadsheets</Text>
          </View>
          <View className="p-3 flex-row gap-3">
            <TouchableOpacity
              onPress={() => handleExport("json")}
              className="flex-1 py-3 rounded-xl bg-slate-900 border border-slate-800 flex-row justify-center items-center gap-2 active:bg-slate-850"
            >
              <Download size={14} color="#10b981" />
              <Text className="text-xs font-bold text-emerald-400">JSON</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handleExport("csv")}
              className="flex-1 py-3 rounded-xl bg-slate-900 border border-slate-800 flex-row justify-center items-center gap-2 active:bg-slate-850"
            >
              <Download size={14} color="#10b981" />
              <Text className="text-xs font-bold text-emerald-400">CSV</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = {
  bentoCardOuter: {
    backgroundColor: "#161615",
    borderColor: "#262624",
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  bentoHeader: {
    borderBottomWidth: 1,
    borderBottomColor: "#262624",
    paddingBottom: 10,
    marginBottom: 12,
  },
  bentoTitle: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700" as const,
  },
  bentoDesc: {
    color: "#a1a1aa",
    fontSize: 11,
    marginTop: 2,
  },
};
