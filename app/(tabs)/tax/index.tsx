import React, { useMemo } from "react";
import { ScrollView, View, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Text } from "@/src/components/ui/text";
import { CurrencyText } from "@/src/components/ui/CurrencyText";
import { useSettingsStore } from "@/store/useSettingsStore";
import { getPeriodStats } from "@/src/database/queries/analytics";
import { getExpenseYTDSummary } from "@/src/database/queries/expenses";
import {
  calculateCPP,
  calculateHSTOwing,
  calculateCRAMileageDeduction,
  calculateQuarterlyInstallments,
  calculateSelfEmploymentTax,
  calculateScheduleC,
  calculateIRSMileageDeduction,
} from "@/utils/taxCalculations";

export default function TaxScreen() {
  const { profile, isOnboardingCompleted } = useSettingsStore();

  const currentYear = new Date().getFullYear();
  const startOfYear = useMemo(() => new Date(currentYear, 0, 1), [currentYear]);
  const endOfYear = useMemo(() => new Date(currentYear, 11, 31, 23, 59, 59, 999), [currentYear]);

  // Queries
  const { data: ytdStats, isLoading: loadingStats } = useQuery({
    queryKey: ["analytics", "ytd-stats", currentYear],
    queryFn: () => getPeriodStats(startOfYear, endOfYear),
    enabled: isOnboardingCompleted,
  });

  const { data: ytdExpenses, isLoading: loadingExpenses } = useQuery({
    queryKey: ["expenses", "ytd-summary", currentYear],
    queryFn: () => getExpenseYTDSummary(),
    enabled: isOnboardingCompleted,
  });

  // Derived calculations
  const grossRevenue = (ytdStats?.gross || 0) + (ytdStats?.tips || 0);
  const deductibleExpenses = ytdExpenses?.deductible || 0;
  const netIncome = Math.max(0, grossRevenue - deductibleExpenses);
  const totalMileage = (ytdStats?.activeMileage || 0) + (ytdStats?.deadMileage || 0);

  const isCanada = profile.country === "CA";
  const regionLabel = isCanada ? `Canada (${profile.taxRegion || "ON"})` : `USA (${profile.taxRegion || "CA"})`;

  // Tax calculations based on region
  const taxData = useMemo(() => {
    if (isCanada) {
      const cpp = calculateCPP(netIncome);
      const hst = profile.hstRegistered ? calculateHSTOwing(grossRevenue, profile.taxRegion || "ON") : 0;
      const mileageDeduction = calculateCRAMileageDeduction(totalMileage);
      const estimatedIncomeTax = netIncome * (profile.taxWithholdingPct / 100);
      const totalEstimatedTax = cpp.total + estimatedIncomeTax + hst;
      const installments = calculateQuarterlyInstallments(totalEstimatedTax);

      return {
        cpp: cpp.total,
        hst,
        mileageDeduction,
        estimatedIncomeTax,
        totalEstimatedTax,
        installments,
      };
    } else {
      const seTax = calculateSelfEmploymentTax(netIncome);
      const scheduleCProfit = calculateScheduleC(grossRevenue, deductibleExpenses);
      const mileageDeduction = calculateIRSMileageDeduction(totalMileage);
      const estimatedIncomeTax = netIncome * (profile.taxWithholdingPct / 100);
      const totalEstimatedTax = seTax + estimatedIncomeTax;
      const installments = calculateQuarterlyInstallments(totalEstimatedTax);

      return {
        seTax,
        scheduleCProfit,
        mileageDeduction,
        estimatedIncomeTax,
        totalEstimatedTax,
        installments,
      };
    }
  }, [isCanada, netIncome, grossRevenue, totalMileage, deductibleExpenses, profile]);

  const isLoading = loadingStats || loadingExpenses;

  return (
    <SafeAreaView className="dark flex-1 bg-[#0b0f19]">
      {/* Header */}
      <View className="px-4 pt-3 pb-2 border-b border-slate-800/80 bg-slate-900/40 flex-row justify-between items-center">
        <Text className="text-lg font-extrabold text-slate-100 tracking-tight">Tax Estimator ({currentYear})</Text>
        <TouchableOpacity
          onPress={() => router.push("/settings")}
          className="py-1.5 px-3 bg-slate-900/60 border border-slate-800 rounded-lg"
        >
          <Text className="text-slate-400 text-xs font-bold">Edit Settings</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#10b981" />
        </View>
      ) : (
        <ScrollView contentContainerClassName="p-4 pb-20 flex flex-col gap-5">
          {/* Region Card */}
          <View className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-4 flex-row justify-between items-center">
            <View>
              <Text className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Active Tax Profile</Text>
              <Text className="text-slate-200 text-sm font-extrabold mt-0.5">{regionLabel}</Text>
            </View>
            <View className="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
              <Text className="text-[9px] text-emerald-400 font-bold uppercase tracking-wider">
                {profile.country} Standard
              </Text>
            </View>
          </View>

          {/* Income & Expenses Summary */}
          <View className="flex flex-col gap-3">
            <Text className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">
              Business Schedule (YTD)
            </Text>
            <View className="bg-slate-900/40 border border-slate-800/60 rounded-2xl overflow-hidden">
              <View className="p-4 border-b border-slate-800/60 flex-row justify-between items-center">
                <Text className="text-xs text-slate-400 font-medium">Gross Revenue</Text>
                <CurrencyText amount={grossRevenue} size="sm" className="font-extrabold text-slate-100" />
              </View>
              <View className="p-4 border-b border-slate-800/60 flex-row justify-between items-center">
                <Text className="text-xs text-slate-400 font-medium">Deductible Expenses</Text>
                <CurrencyText amount={deductibleExpenses} size="sm" className="font-extrabold text-rose-400" />
              </View>
              <View className="p-4 bg-emerald-500/5 flex-row justify-between items-center">
                <Text className="text-xs text-slate-200 font-bold">Net Self-Employment Income</Text>
                <CurrencyText amount={netIncome} size="sm" className="font-extrabold text-emerald-400" />
              </View>
            </View>
          </View>

          {/* Estimated Tax Breakdown */}
          <View className="flex flex-col gap-3">
            <Text className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">
              Estimated Obligations
            </Text>
            <View className="bg-slate-900/40 border border-slate-800/60 rounded-2xl overflow-hidden">
              {isCanada ? (
                <>
                  <View className="p-4 border-b border-slate-800/60 flex-row justify-between items-center">
                    <View>
                      <Text className="text-xs text-slate-300 font-bold">CPP Contribution</Text>
                      <Text className="text-[9px] text-slate-500 font-medium mt-0.5">Self-employed portion (11.9%)</Text>
                    </View>
                    <CurrencyText amount={taxData.cpp || 0} size="sm" className="font-bold text-slate-100" />
                  </View>
                  {profile.hstRegistered && (
                    <View className="p-4 border-b border-slate-800/60 flex-row justify-between items-center">
                      <View>
                        <Text className="text-xs text-slate-300 font-bold">HST/GST Owing</Text>
                        <Text className="text-[9px] text-slate-500 font-medium mt-0.5">Estimated on gross revenue</Text>
                      </View>
                      <CurrencyText amount={taxData.hst || 0} size="sm" className="font-bold text-slate-100" />
                    </View>
                  )}
                </>
              ) : (
                <View className="p-4 border-b border-slate-800/60 flex-row justify-between items-center">
                  <View>
                    <Text className="text-xs text-slate-300 font-bold">Self-Employment Tax</Text>
                    <Text className="text-[9px] text-slate-500 font-medium mt-0.5">IRS SE Tax (15.3% of 92.35% profit)</Text>
                  </View>
                  <CurrencyText amount={taxData.seTax || 0} size="sm" className="font-bold text-slate-100" />
                </View>
              )}

              <View className="p-4 border-b border-slate-800/60 flex-row justify-between items-center">
                <View>
                  <Text className="text-xs text-slate-300 font-bold">Estimated Income Tax</Text>
                  <Text className="text-[9px] text-slate-500 font-medium mt-0.5">
                    Withholding rate: {profile.taxWithholdingPct}% of net
                  </Text>
                </View>
                <CurrencyText amount={taxData.estimatedIncomeTax || 0} size="sm" className="font-bold text-slate-100" />
              </View>

              <View className="p-4 bg-slate-900/80 flex-row justify-between items-center">
                <Text className="text-xs text-slate-100 font-extrabold">Total Estimated Obligation</Text>
                <CurrencyText amount={taxData.totalEstimatedTax || 0} size="sm" className="font-extrabold text-amber-400" />
              </View>
            </View>
          </View>

          {/* Mileage Deduction Card */}
          <View className="flex flex-col gap-3">
            <Text className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">
              Standard Mileage Deduction
            </Text>
            <View className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-4 flex-row justify-between items-center">
              <View className="flex-1">
                <Text className="text-base font-extrabold text-slate-200">
                  {totalMileage.toFixed(1)} {profile.distanceUnit}
                </Text>
                <Text className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">
                  Logged YTD Mileage
                </Text>
              </View>
              <View className="items-end">
                <CurrencyText amount={taxData.mileageDeduction || 0} size="md" className="font-extrabold text-emerald-400" />
                <Text className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">
                  Write-off Value ({profile.country === "CA" ? "CRA" : "IRS"})
                </Text>
              </View>
            </View>
          </View>

          {/* Quarterly Installment Dates */}
          <View className="flex flex-col gap-3">
            <Text className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">
              {profile.country === "CA" ? "CRA" : "IRS"} Quarterly Due Dates
            </Text>
            <View className="flex flex-col gap-2.5">
              {[
                { label: "Q1 Installment", date: "April 15, 2024" },
                { label: "Q2 Installment", date: "June 15, 2024" },
                { label: "Q3 Installment", date: "September 15, 2024" },
                { label: "Q4 Installment", date: "January 15, 2025" },
              ].map((q, idx) => (
                <View
                  key={idx}
                  className="bg-slate-900/50 border border-slate-800/60 rounded-xl px-4 py-3 flex-row justify-between items-center"
                >
                  <Text className="text-xs text-slate-300 font-semibold">{q.label}</Text>
                  <Text className="text-xs text-slate-500 font-bold">{q.date}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Disclaimer Card */}
          <View className="bg-slate-950/40 border border-slate-900/80 rounded-2xl p-4 flex-row gap-3 items-start">
            <Text className="text-lg mt-0.5">⚠️</Text>
            <Text className="text-[10px] text-slate-500 font-medium leading-relaxed flex-1">
              These are estimates only for preparation. Standard rates do not calculate provincial/state tax brackets or credits. Consult a licensed tax professional or CPA for your actual tax filings.
            </Text>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
