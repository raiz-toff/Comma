import React, { useMemo, useEffect, useRef, useState } from "react";
import {
  ScrollView,
  View,
  ActivityIndicator,
  StyleSheet,
  Pressable,
  Modal,
  TextInput,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";
import { AlertTriangle, Settings, Calculator, Calendar, ChevronRight } from "lucide-react-native";
import { Text } from "@/src/components/ui/text";
import { CurrencyText } from "@/src/components/ui/CurrencyText";
import { useSettingsStore } from "@/store/useSettingsStore";
import { usePlatformTheme } from "@/src/hooks/usePlatformTheme";
import { useFeatureEnabled } from "@/hooks/useFeatureEnabled";
import {
  getCountryDef,
  getRegionsByCountry,
  getMileagePresetRate,
  resolveProvinceDef,
} from "@/src/registry/index";
import { getPlatformDef } from "@/src/registry/platforms";
import { getPeriodStats, getActiveVehicle } from "@/src/database/queries/analytics";
import { getEffectiveMileageRate, calculateMileageWriteOff } from "@/src/database/queries/taxProfiles";
import { getExpenseYTDSummary } from "@/src/database/queries/expenses";
import {
  getTaxHistory,
  getTaxJarBalance,
  setTaxJarBalance,
} from "@/src/database/queries/tax";
import {
  calculatePensionContributions,
  calculateHSTOwing,
  calculateSelfEmploymentTax,
  calculateHMRCMileageDeduction,
  calculateUKNationalInsurance,
} from "@/utils/taxCalculations";
import { getEarningsByPlatform } from "@/src/database/queries/analytics";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function ScalePressable({ onPress, style, children }: {
  onPress: () => void;
  style?: object | object[];
  children: React.ReactNode;
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => { scale.value = withSpring(0.96, { damping: 15 }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 15 }); }}
      style={[style, animatedStyle]}
    >
      {children}
    </AnimatedPressable>
  );
}

export default function TaxScreen() {
  const insets = useSafeAreaInsets();
  const { profile, isOnboardingCompleted, setHeaderVisible, updateProfile } =
    useSettingsStore();
  const { accentColor, accentColorDim, accentColorMid, accentColorContrast } = usePlatformTheme();

  const isTaxEnabled = useFeatureEnabled("tax_workspace");

  useEffect(() => {
    if (!isTaxEnabled && isOnboardingCompleted) router.replace("/");
  }, [isTaxEnabled, isOnboardingCompleted]);

  if (!isTaxEnabled) return null;

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isJarModalOpen, setIsJarModalOpen] = useState(false);
  const [jarDepositInput, setJarDepositInput] = useState("");

  const countryDef = useMemo(() => getCountryDef(profile?.country || "CA"), [profile?.country]);
  const regionDefs = useMemo(() => getRegionsByCountry(profile?.country || "CA"), [profile?.country]);

  const currentYear = new Date().getFullYear();
  const startOfYear = useMemo(() => new Date(currentYear, 0, 1), [currentYear]);
  const endOfYear = useMemo(() => new Date(currentYear, 11, 31, 23, 59, 59, 999), [currentYear]);

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

  const { data: taxHistoryList } = useQuery({
    queryKey: ["taxHistory"],
    queryFn: () => getTaxHistory(),
    enabled: isOnboardingCompleted,
  });

  const { data: taxJarBalance = 0, refetch: refetchJar } = useQuery({
    queryKey: ["taxJar", currentYear],
    queryFn: () => getTaxJarBalance(currentYear),
    enabled: isOnboardingCompleted,
  });

  const { data: platformEarnings = [] } = useQuery({
    queryKey: ["analytics", "platform-earnings", currentYear],
    queryFn: () => getEarningsByPlatform(startOfYear, endOfYear),
    enabled: isOnboardingCompleted,
  });

  // Same eligibility-aware resolution as the dashboard: a saved tax profile (including an
  // explicit opt-out) always wins over the researched default, and the default itself depends
  // on the active vehicle's type, not just country (a bicycle isn't eligible for a car's rate).
  const { data: mileageRate } = useQuery({
    queryKey: ["analytics", "mileage-rate", currentYear],
    queryFn: async () => {
      const vehicle = await getActiveVehicle();
      if (!vehicle) return null;
      return getEffectiveMileageRate(vehicle.id, currentYear, profile?.country || "CA", vehicle.type);
    },
    enabled: isOnboardingCompleted,
  });

  const grossRevenue = (ytdStats?.gross || 0) + (ytdStats?.tips || 0) + (ytdStats?.bonus || 0);
  const deductibleExpenses = ytdExpenses?.deductible || 0;
  const netIncome = Math.max(0, grossRevenue - deductibleExpenses);
  const totalMileage = (ytdStats?.activeMileage || 0) + (ytdStats?.deadMileage || 0);

  const taxData = useMemo(() => {
    const province = profile?.taxRegion || countryDef.tax.defaultRegionCode;

    // Mileage deduction reduces taxable income the same way logged expenses already do —
    // compute it FIRST so pension/SE-tax/state-tax/income-tax are all based on the same
    // reduced base, and it actually flows into totalEstimatedTax below (previously this was
    // computed and never used anywhere, so the total silently ignored it).
    let mileageDeduction = 0;
    if (countryDef.hasMileageDeduction) {
      if (profile?.country === "CA" || profile?.country === "US") {
        // Vehicle-type-aware: respects a saved tax profile (custom rate or explicit opt-out)
        // and, absent one, only applies the researched default when the vehicle is eligible
        // (e.g. a bicycle isn't eligible for the CRA/IRS automobile mileage rate).
        mileageDeduction = mileageRate ? calculateMileageWriteOff(totalMileage, mileageRate) : 0;
      } else if (profile?.country === "UK") {
        mileageDeduction = calculateHMRCMileageDeduction(totalMileage, currentYear);
      } else {
        const rateStr = getMileagePresetRate(profile?.country || "US", province);
        mileageDeduction = totalMileage * (parseFloat(rateStr) || 0);
      }
    }
    const taxableIncome = Math.max(0, netIncome - mileageDeduction);

    const pensionResult = countryDef.tax.calcCpp
      ? calculatePensionContributions(taxableIncome, province, currentYear)
      : { cpp1Total: 0, cpp2Total: 0, total: 0, planType: "CPP" as const };

    const seTax = countryDef.tax.calcSeTax ? calculateSelfEmploymentTax(taxableIncome, currentYear) : 0;

    const niResult = countryDef.tax.calcNI
      ? calculateUKNationalInsurance(taxableIncome, currentYear)
      : null;

    const stateDef = profile?.country === "US" ? resolveProvinceDef("US", province) : null;
    const stateIncomeTax = stateDef?.incomeTaxRate ? taxableIncome * stateDef.incomeTaxRate : 0;

    let hstResult = null;
    if (countryDef.tax.hstOnboarding && profile?.hstRegistered) {
      hstResult = calculateHSTOwing(0, grossRevenue, deductibleExpenses, province, currentYear);
    }

    const estimatedIncomeTax = taxableIncome * ((profile?.taxWithholdingPct || 0) / 100);

    const totalEstimatedTax =
      pensionResult.total +
      seTax +
      (niResult?.total ?? 0) +
      stateIncomeTax +
      estimatedIncomeTax +
      (hstResult?.netRemittable ?? 0);

    return {
      pensionResult,
      seTax,
      niResult,
      stateIncomeTax,
      hstResult,
      mileageDeduction,
      estimatedIncomeTax,
      totalEstimatedTax,
    };
  }, [countryDef, profile, netIncome, grossRevenue, deductibleExpenses, totalMileage, currentYear, mileageRate]);

  // 3 biggest obligation line items — shown as pills on the card
  const obligationPills = useMemo(() => {
    const items: { label: string; amount: number }[] = [];
    if (countryDef.tax.calcCpp && taxData.pensionResult.total > 0) {
      items.push({
        label: "Pension Plan",
        amount: taxData.pensionResult.total,
      });
    }
    if (countryDef.tax.calcSeTax && taxData.seTax > 0) {
      items.push({ label: "Self-Employment Tax", amount: taxData.seTax });
    }
    if (taxData.stateIncomeTax > 0) {
      items.push({ label: `${profile?.taxRegion || ""} Tax`, amount: taxData.stateIncomeTax });
    }
    if (countryDef.tax.calcNI && (taxData.niResult?.total ?? 0) > 0) {
      items.push({ label: "National Insurance", amount: taxData.niResult!.total });
    }
    if (taxData.estimatedIncomeTax > 0) {
      items.push({ label: "Income Tax", amount: taxData.estimatedIncomeTax });
    }
    if ((taxData.hstResult?.netRemittable ?? 0) > 0) {
      items.push({ label: "Sales Tax", amount: taxData.hstResult!.netRemittable });
    }
    return items.sort((a, b) => b.amount - a.amount).slice(0, 3);
  }, [taxData, countryDef, profile?.taxRegion]);

  // Next upcoming installment date
  const nextInstallment = useMemo(() => {
    if (!countryDef.taxInstallmentDates?.length) return null;
    const now = new Date();
    const upcoming = countryDef.taxInstallmentDates
      .map((item) => {
        const year = currentYear + (item.followYear ? 1 : 0);
        const date = new Date(year, item.month - 1, item.day);
        const daysUntil = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return { label: item.label, date, daysUntil };
      })
      .filter((d) => d.daysUntil >= 0)
      .sort((a, b) => a.daysUntil - b.daysUntil);
    return upcoming[0] ?? null;
  }, [countryDef.taxInstallmentDates, currentYear]);

  // Platform threshold alerts
  const thresholdAlerts = useMemo(() => {
    const threshold = countryDef.taxFormThresholds;
    if (!threshold || platformEarnings.length === 0) return [];
    return platformEarnings
      .filter((pe) => {
        const def = getPlatformDef(pe.platform);
        return def.issuesTaxForm && pe.total >= threshold.singleIssuer;
      })
      .map((pe) => {
        const def = getPlatformDef(pe.platform);
        const formType = profile?.country === "CA" ? "T4A" : "1099-NEC";
        return {
          platform: def.label,
          total: pe.total,
          message: `You've earned enough with ${def.label} that they'll send you a ${formType} tax form — make sure to include this income when you file.`,
        };
      });
  }, [countryDef, platformEarnings, profile?.country]);

  // Tax Jar helpers
  const taxJarTarget = grossRevenue * ((profile?.taxWithholdingPct || 0) / 100);
  const jarCoveragePct = taxJarTarget > 0 ? Math.min(100, (taxJarBalance / taxJarTarget) * 100) : 0;
  const todaySuggestion =
    (ytdStats?.gross || 0) > 0
      ? (ytdStats?.gross || 0) * ((profile?.taxWithholdingPct || 0) / 100)
      : 0;

  const handleJarDeposit = async () => {
    const amount = parseFloat(jarDepositInput);
    if (isNaN(amount) || amount === 0) return;
    await setTaxJarBalance(currentYear, taxJarBalance + amount);
    refetchJar();
    setJarDepositInput("");
    setIsJarModalOpen(false);
  };

  const lastScrollY = useRef(0);
  const handleScroll = (event: any) => {
    const currentY = event.nativeEvent.contentOffset.y;
    const diff = currentY - lastScrollY.current;
    const contentHeight = event.nativeEvent.contentSize.height;
    const layoutHeight = event.nativeEvent.layoutMeasurement.height;
    const isNearBottom = currentY + layoutHeight >= contentHeight - 40;
    if (currentY <= 0 || isNearBottom) setHeaderVisible(true);
    else if (diff > 15 && currentY > 50) setHeaderVisible(false);
    else if (diff < -15) setHeaderVisible(true);
    lastScrollY.current = currentY;
  };

  useEffect(() => { setHeaderVisible(true); }, []);

  const regionLabel = regionDefs.length > 0
    ? `${countryDef.label} · ${profile?.taxRegion || countryDef.tax.defaultRegionCode}`
    : countryDef.label;

  const isLoading = loadingStats || loadingExpenses;

  if (countryDef.hasSelfAssessmentTax === false) {
    return (
      <SafeAreaView style={S.root} edges={["left", "right"]}>
        <View style={[S.header, { paddingTop: Math.max(insets.top, 8) + 8, paddingLeft: 70, height: Math.max(insets.top, 8) + 64 }]}>
          <Text style={S.headerTitle}>Tax · {currentYear}</Text>
        </View>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 20, backgroundColor: "#000" }}>
          <View style={S.card}>
            <View style={S.emptyIcon}>
              <Calculator size={26} color={accentColor} />
            </View>
            <Text style={S.emptyTitle}>No Self-Assessment Required</Text>
            <Text style={S.emptyBody}>
              In {countryDef.label}, gig platform earnings are handled directly by the platforms. Independent self-assessment is not required.
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={S.root} edges={["left", "right"]}>
      {/* ── Header — sits in-line with the hamburger row ── */}
      <View style={[S.header, { paddingTop: Math.max(insets.top, 8) + 8, paddingLeft: 70, height: Math.max(insets.top, 8) + 64 }]}>
        <View style={{ flex: 1 }}>
          <Text style={S.headerTitle}>Tax · {currentYear}</Text>
          <Text style={S.headerSub}>{regionLabel} · {profile?.taxWithholdingPct || 0}% saved for taxes</Text>
        </View>
        <ScalePressable onPress={() => setIsSettingsOpen(true)} style={S.gearBtn}>
          <Settings size={14} color="#9B9BA4" />
        </ScalePressable>
      </View>

      {isLoading ? (
        <View style={S.loader}>
          <ActivityIndicator size="large" color={accentColor} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[S.scroll, { paddingBottom: 110 + insets.bottom }]}
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          {/* ── Threshold Alert Strips ── */}
          {thresholdAlerts.map((alert, idx) => (
            <View key={idx} style={S.alertStrip}>
              <AlertTriangle size={12} color="#f59e0b" />
              <Text style={S.alertText}>{alert.message}</Text>
            </View>
          ))}

          {/* ── Tax Jar Card ── */}
          <View style={S.card}>
            <Text style={S.cardLabel}>SAVED THIS YEAR</Text>
            <View style={S.jarRow}>
              <CurrencyText
                amount={taxJarBalance}
                size="xl"
                style={{ color: accentColor, fontWeight: "900", fontSize: 34, letterSpacing: -0.5 }}
              />
              <View style={{ alignItems: "flex-end" }}>
                <Text style={S.cardLabel}>TARGET</Text>
                <CurrencyText amount={taxJarTarget} size="sm" style={S.mutedValue} />
              </View>
            </View>

            {/* Progress bar */}
            <View style={S.progressTrack}>
              <View
                style={[
                  S.progressFill,
                  { width: `${Math.min(100, jarCoveragePct)}%`, backgroundColor: accentColor },
                ]}
              />
            </View>
            <Text style={S.progressLabel}>
              {jarCoveragePct.toFixed(0)}% of {profile?.taxWithholdingPct || 0}% target saved
            </Text>

            <View style={S.jarFooter}>
              {todaySuggestion > 0 ? (
                <Text style={S.suggestText}>
                  Suggested today:{" "}
                  <CurrencyText amount={todaySuggestion} size="sm" style={{ color: accentColor, fontWeight: "800" }} />
                </Text>
              ) : (
                <View />
              )}
              <Pressable
                onPress={() => setIsJarModalOpen(true)}
                style={[S.pill, { borderColor: accentColor, backgroundColor: accentColorDim }]}
              >
                <Text style={[S.pillText, { color: accentColor }]}>+ Log</Text>
              </Pressable>
            </View>
          </View>

          {/* ── Obligations Card ── */}
          <ScalePressable onPress={() => router.push("/tax/center" as any)} style={S.card}>
            <Text style={S.cardLabel}>ESTIMATED TAXES YOU OWE</Text>
            <CurrencyText
              amount={taxData.totalEstimatedTax}
              size="xl"
              style={S.obligationTotal}
            />

            {/* Sub-pills */}
            {obligationPills.length > 0 && (
              <View style={S.pillRow}>
                {obligationPills.map((pill) => (
                  <View key={pill.label} style={S.pillMuted}>
                    <Text style={S.pillMutedText}>
                      {pill.label}{" "}
                      <CurrencyText amount={pill.amount} size="sm" style={S.pillMutedText} />
                    </Text>
                  </View>
                ))}
              </View>
            )}

            <View style={S.breakdownLink}>
              <Text style={[S.breakdownText, { color: accentColor }]}>See full breakdown</Text>
              <ChevronRight size={12} color={accentColor} />
            </View>
          </ScalePressable>

          {/* ── Next Installment Row ── */}
          {nextInstallment && (
            <Pressable onPress={() => router.push("/tax/center" as any)} style={S.installmentRow}>
              <View style={S.installmentLeft}>
                <Calendar size={13} color="#9B9BA4" />
                <Text style={S.installmentLabel}>{nextInstallment.label}</Text>
                <Text style={S.installmentDate}>
                  {nextInstallment.date.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </Text>
              </View>
              <View style={S.installmentRight}>
                <Text style={S.installmentDays}>{nextInstallment.daysUntil} days</Text>
                <ChevronRight size={12} color="#65656E" />
              </View>
            </Pressable>
          )}

          {/* ── Disclaimer ── */}
          <Text style={S.disclaimer}>
            Estimates only — standard rates, no bracket or credit adjustments. Consult a tax professional for your actual filing.
          </Text>
        </ScrollView>
      )}

      {/* ── Settings Bottom Sheet ── */}
      <Modal visible={isSettingsOpen} transparent animationType="slide">
        <Pressable style={S.sheetOverlay} onPress={() => setIsSettingsOpen(false)}>
          <Pressable
            style={[S.sheet, { paddingBottom: insets.bottom + 20 }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={S.sheetHandle} />
            <View style={S.sheetHeader}>
              <Text style={S.sheetTitle}>Tax Profile</Text>
              <Text style={S.sheetSub}>{regionLabel}</Text>
            </View>

            {/* HST toggle */}
            {countryDef.tax.hstOnboarding && (
              <View style={S.settingRow}>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={S.settingRowLabel}>GST/HST Registered</Text>
                  <Text style={S.settingRowDesc}>
                    Required if gig earnings exceed $30k/yr in Canada.
                  </Text>
                </View>
                <Pressable
                  onPress={() => updateProfile({ hstRegistered: !profile?.hstRegistered })}
                  style={[
                    S.toggleBtn,
                    profile?.hstRegistered
                      ? { backgroundColor: accentColor, borderColor: accentColor }
                      : S.toggleBtnOff,
                  ]}
                >
                  <Text
                    style={[
                      S.toggleBtnText,
                      profile?.hstRegistered ? { color: accentColorContrast } : { color: "#9B9BA4" },
                    ]}
                  >
                    {profile?.hstRegistered ? "Registered" : "No"}
                  </Text>
                </Pressable>
              </View>
            )}

            {/* Withholding stepper */}
            <View style={S.settingRow}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={S.settingRowLabel}>Tax Savings Rate</Text>
                <Text style={S.settingRowDesc}>% of your earnings (after expenses) to set aside for taxes.</Text>
              </View>
              <View style={S.stepper}>
                <Pressable
                  onPress={() =>
                    updateProfile({ taxWithholdingPct: Math.max(0, (profile?.taxWithholdingPct || 0) - 1) })
                  }
                  style={S.stepBtn}
                >
                  <Text style={S.stepBtnText}>−</Text>
                </Pressable>
                <View style={S.stepValue}>
                  <Text style={S.stepValueText}>{profile?.taxWithholdingPct || 0}%</Text>
                </View>
                <Pressable
                  onPress={() =>
                    updateProfile({ taxWithholdingPct: Math.min(100, (profile?.taxWithholdingPct || 0) + 1) })
                  }
                  style={S.stepBtn}
                >
                  <Text style={S.stepBtnText}>+</Text>
                </Pressable>
              </View>
            </View>

            {/* Region change history */}
            {taxHistoryList && taxHistoryList.length > 0 && (
              <View style={S.historyBlock}>
                <Text style={S.settingBlockLabel}>Region Change History</Text>
                {taxHistoryList.slice(0, 3).map((hist) => (
                  <View key={hist.id} style={S.historyRow}>
                    <Text style={S.historyText}>
                      {hist.oldRegion || "—"} → {hist.newRegion}
                    </Text>
                    <Text style={S.historyDate}>
                      {hist.changedAt.toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "2-digit",
                      })}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Tax Jar Deposit Modal ── */}
      <Modal visible={isJarModalOpen} transparent animationType="fade">
        <Pressable style={S.overlay} onPress={() => setIsJarModalOpen(false)}>
          <Pressable style={S.overlayCard} onPress={(e) => e.stopPropagation()}>
            <View style={S.overlayHeader}>
              <Text style={S.overlayTitle}>Log Tax Jar Deposit</Text>
              <Pressable onPress={() => setIsJarModalOpen(false)} style={S.overlayClose}>
                <Text style={{ color: "#9B9BA4", fontSize: 16, fontWeight: "700" }}>×</Text>
              </Pressable>
            </View>
            <Text style={S.overlayBody}>Amount you're setting aside for taxes.</Text>
            <TextInput
              value={jarDepositInput}
              onChangeText={setJarDepositInput}
              placeholder="0.00"
              placeholderTextColor="#65656E"
              keyboardType="decimal-pad"
              style={S.jarInput}
            />
            <View style={{ flexDirection: "row", gap: 8 }}>
              {[25, 50, 100, 200].map((amt) => (
                <Pressable
                  key={amt}
                  onPress={() => setJarDepositInput(String(amt))}
                  style={[S.chip, S.chipInactive, { flex: 1, paddingHorizontal: 4 }]}
                >
                  <Text style={[S.chipText, { color: "#9B9BA4" }]}>${amt}</Text>
                </Pressable>
              ))}
            </View>
            <View style={S.overlayActions}>
              <Pressable onPress={() => setIsJarModalOpen(false)} style={S.cancelBtn}>
                <Text style={S.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable onPress={handleJarDeposit} style={[S.confirmBtn, { backgroundColor: accentColor }]}>
                <Text style={[S.confirmBtnText, { color: accentColorContrast }]}>Add to Jar</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  loader: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: { padding: 16, paddingTop: 8, gap: 10 },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#000",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#F6F6F7",
    letterSpacing: -0.4,
  },
  headerSub: {
    fontSize: 11,
    fontWeight: "600",
    color: "#65656E",
    marginTop: 2,
  },
  gearBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#16161A",
    borderWidth: 0.8,
    borderColor: "#1C1C21",
    alignItems: "center",
    justifyContent: "center",
  },

  // Alert strip
  alertStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(245, 158, 11, 0.06)",
    borderWidth: 0.8,
    borderColor: "rgba(245, 158, 11, 0.2)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  alertText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#9B9BA4",
    flex: 1,
    lineHeight: 15,
  },

  // Cards
  card: {
    backgroundColor: "#0F0F12",
    borderWidth: 0.8,
    borderColor: "#1E1E23",
    borderRadius: 20,
    padding: 18,
    gap: 12,
  },
  cardLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#65656E",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },

  // Tax Jar card internals
  jarRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  jarAmount: {
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  mutedValue: {
    fontSize: 13,
    fontWeight: "700",
    color: "#9B9BA4",
    marginTop: 2,
  },
  progressTrack: {
    height: 6,
    backgroundColor: "#1E1E23",
    borderRadius: 3,
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
  },
  progressLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#65656E",
    marginTop: -4,
  },
  jarFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 2,
  },
  suggestText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#9B9BA4",
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 0.8,
    alignItems: "center",
    justifyContent: "center",
  },
  pillText: {
    fontSize: 12,
    fontWeight: "800",
  },

  // Obligations card internals
  obligationTotal: {
    fontSize: 36,
    fontWeight: "900",
    color: "#F6F6F7",
    letterSpacing: -0.6,
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: -2,
  },
  pillMuted: {
    backgroundColor: "#16161A",
    borderWidth: 0.8,
    borderColor: "#1E1E23",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  pillMutedText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#9B9BA4",
  },
  breakdownLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    justifyContent: "flex-end",
    marginTop: 2,
  },
  breakdownText: {
    fontSize: 12,
    fontWeight: "700",
  },

  // Next installment row
  installmentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  installmentLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  installmentLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#9B9BA4",
  },
  installmentDate: {
    fontSize: 13,
    fontWeight: "600",
    color: "#65656E",
  },
  installmentRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  installmentDays: {
    fontSize: 12,
    fontWeight: "700",
    color: "#65656E",
  },

  // Disclaimer
  disclaimer: {
    fontSize: 10,
    fontWeight: "500",
    color: "#2E2E36",
    textAlign: "center",
    lineHeight: 15,
    paddingHorizontal: 8,
    marginTop: 4,
  },

  // Empty state
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(34, 197, 94, 0.08)",
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(34, 197, 94, 0.25)",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: "#F6F6F7",
    textAlign: "center",
  },
  emptyBody: {
    fontSize: 13,
    color: "#9B9BA4",
    textAlign: "center",
    lineHeight: 18,
  },

  // Settings bottom sheet
  sheetOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#0F0F12",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 0.8,
    borderColor: "#1E1E23",
    padding: 20,
    gap: 18,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#2E2E36",
    alignSelf: "center",
    marginBottom: 4,
  },
  sheetHeader: { gap: 2 },
  sheetTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#F6F6F7",
    letterSpacing: -0.3,
  },
  sheetSub: {
    fontSize: 11,
    fontWeight: "600",
    color: "#9B9BA4",
  },
  settingBlock: { gap: 8 },
  settingBlockLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: "#9B9BA4",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 0.5,
    borderTopColor: "#16161A",
    paddingTop: 14,
  },
  settingRowLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: "#F6F6F7",
  },
  settingRowDesc: {
    fontSize: 10,
    fontWeight: "600",
    color: "#65656E",
    marginTop: 2,
    lineHeight: 14,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 0.8,
    alignItems: "center",
    justifyContent: "center",
  },
  chipInactive: {
    borderColor: "#1C1C21",
    backgroundColor: "#16161A",
  },
  chipText: {
    fontSize: 12,
    fontWeight: "700",
  },
  toggleBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 0.8,
    minWidth: 90,
    alignItems: "center",
  },
  toggleBtnOff: {
    borderColor: "#1C1C21",
    backgroundColor: "#16161A",
  },
  toggleBtnText: {
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#16161A",
    borderWidth: 0.8,
    borderColor: "#1C1C21",
    borderRadius: 14,
    overflow: "hidden",
  },
  stepBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  stepBtnText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#9B9BA4",
  },
  stepValue: {
    width: 44,
    alignItems: "center",
  },
  stepValueText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#F6F6F7",
  },
  historyBlock: {
    borderTopWidth: 0.5,
    borderTopColor: "#16161A",
    paddingTop: 14,
    gap: 8,
  },
  historyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#16161A",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  historyText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#9B9BA4",
  },
  historyDate: {
    fontSize: 10,
    fontWeight: "600",
    color: "#65656E",
  },

  // Modals
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  overlayCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#0F0F12",
    borderRadius: 24,
    borderWidth: 0.8,
    borderColor: "#1E1E23",
    padding: 20,
    gap: 16,
  },
  overlayHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: "#1E1E23",
  },
  overlayTitle: {
    color: "#F6F6F7",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  overlayClose: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#16161A",
    borderWidth: 0.8,
    borderColor: "#1C1C21",
    alignItems: "center",
    justifyContent: "center",
  },
  overlayBody: {
    color: "#9B9BA4",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
  },
  compRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#16161A",
    borderRadius: 16,
    borderWidth: 0.8,
    borderColor: "#1C1C21",
    padding: 14,
  },
  compCol: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  compLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: "#9B9BA4",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  compCode: {
    fontSize: 20,
    fontWeight: "900",
    color: "#F6F6F7",
  },
  compRate: {
    fontSize: 11,
    fontWeight: "700",
    color: "#9B9BA4",
  },
  overlayActions: {
    flexDirection: "row",
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "#16161A",
    borderWidth: 0.8,
    borderColor: "#1C1C21",
    alignItems: "center",
  },
  cancelBtnText: {
    color: "#9B9BA4",
    fontSize: 12,
    fontWeight: "800",
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
  },
  confirmBtnText: {
    fontSize: 12,
    fontWeight: "800",
  },
  jarInput: {
    backgroundColor: "#16161A",
    borderWidth: 0.8,
    borderColor: "#1C1C21",
    borderRadius: 14,
    padding: 14,
    color: "#F6F6F7",
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
  },
});
