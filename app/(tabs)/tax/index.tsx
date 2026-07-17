import React, { useMemo, useEffect, useRef, useState } from "react";
import {
  ScrollView,
  View,
  ActivityIndicator,
  StyleSheet,
  Pressable,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";
import { AlertTriangle, Settings, Calculator, Calendar, ChevronRight } from "lucide-react-native";
import { Text } from "@/src/components/ui/text";
import { Card } from "@/src/components/ui/card";
import { CurrencyText } from "@/src/components/ui/CurrencyText";
import { withAlpha } from "@/src/theme/colors";
import { useColors, useThemedStyles, type Palette } from "@/src/theme/useColors";
import { useSettingsStore } from "@/store/useSettingsStore";
import { DEMO_STRIP_HEIGHT } from "@/src/components/GlobalTopHeader";
import { usePlatformTheme } from "@/src/hooks/usePlatformTheme";
import { useLayout } from "@/src/hooks/useLayout";
import { useFeatureEnabled } from "@/hooks/useFeatureEnabled";
import {
  getCountryDef,
  getRegionsByCountry,
  getMileagePresetRate,
  resolveProvinceDef,
} from "@/src/registry/index";
import { getPlatformDef } from "@/src/registry/platforms";
import { getPeriodStats, getVehicleMileageBreakdown } from "@/src/database/queries/analytics";
import { calculateMileageWriteOffForBreakdown } from "@/src/database/queries/taxProfiles";
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

function ScalePressable({ onPress, style, children, ...rest }: {
  onPress: () => void;
  style?: object | object[];
  children: React.ReactNode;
} & Omit<React.ComponentProps<typeof Pressable>, "onPress" | "style" | "children">) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => { scale.value = withSpring(0.96, { damping: 15 }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 15 }); }}
      style={[style, animatedStyle]}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
}

export default function TaxScreen() {
  const insets = useSafeAreaInsets();
  const C = useColors();
  const S = useThemedStyles(makeStyles);
  const { profile, isOnboardingCompleted, setHeaderVisible, updateProfile, isDemoMode } =
    useSettingsStore();
  const { accentColor, accentColorDim, accentColorMid, accentColorContrast } = usePlatformTheme();
  // Called here, with the other hooks, because this screen early-returns twice below.
  const { gridStyle, dialogStyle } = useLayout();

  const isTaxEnabled = useFeatureEnabled("tax_workspace");

  useEffect(() => {
    if (!isTaxEnabled && isOnboardingCompleted) router.replace("/");
  }, [isTaxEnabled, isOnboardingCompleted]);

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

  // Vehicle-aware write-off: mileage is grouped by the vehicle that actually drove it, and each
  // vehicle's own rate/eligibility is resolved and applied separately (a saved tax profile —
  // including an explicit opt-out — always wins over the researched default, and the default
  // itself depends on that vehicle's type, e.g. a bicycle isn't eligible for a car's rate),
  // then summed. One flat rate for one "active" vehicle applied to every vehicle's mileage was
  // the bug (issue #9) — a multi-vehicle driver's write-off was simply wrong.
  const { data: mileageInfo } = useQuery({
    queryKey: ["analytics", "mileage-writeoff", currentYear],
    queryFn: async () => {
      const breakdown = await getVehicleMileageBreakdown(startOfYear, endOfYear);
      return calculateMileageWriteOffForBreakdown(breakdown, currentYear, profile?.country || "CA");
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
        // Vehicle-aware: each vehicle's own eligibility/rate is resolved and applied to only
        // the mileage it actually drove, then summed (see mileageInfo above).
        mileageDeduction = mileageInfo?.writeOff ?? 0;
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
  }, [countryDef, profile, netIncome, grossRevenue, deductibleExpenses, totalMileage, currentYear, mileageInfo]);

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

  // Guard AFTER all hooks — an early return between hooks changes the hook
  // count across renders and crashes when the feature flag flips.
  if (!isTaxEnabled) return null;

  if (countryDef.hasSelfAssessmentTax === false) {
    return (
      <SafeAreaView style={S.root} edges={["left", "right"]}>
        <View style={[S.header, { paddingTop: Math.max(insets.top, 8) + 8 + (isDemoMode ? DEMO_STRIP_HEIGHT : 0), paddingLeft: 70, height: Math.max(insets.top, 8) + 64 + (isDemoMode ? DEMO_STRIP_HEIGHT : 0) }, gridStyle]}>
          <Text variant="headingM">Tax · {currentYear}</Text>
        </View>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 20, backgroundColor: C.background }}>
          <Card className="gap-3">
            <View style={S.emptyIcon}>
              <Calculator size={26} color={accentColor} />
            </View>
            <Text variant="labelL" style={S.emptyTitle}>No Self-Assessment Required</Text>
            <Text variant="paragraphM" style={S.emptyBody}>
              In {countryDef.label}, gig platform earnings are handled directly by the platforms. Independent self-assessment is not required.
            </Text>
          </Card>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={S.root} edges={["left", "right"]}>
      {/* ── Header — sits in-line with the hamburger row ──
           It is a sibling of the ScrollView, not inside it, so it takes the same
           `gridStyle` cap as the content — otherwise on a tablet the gear button
           hugs the screen edge while the cards it belongs to sit centred. */}
      <View style={[S.header, { paddingTop: Math.max(insets.top, 8) + 8 + (isDemoMode ? DEMO_STRIP_HEIGHT : 0), paddingLeft: 70, height: Math.max(insets.top, 8) + 64 + (isDemoMode ? DEMO_STRIP_HEIGHT : 0) }, gridStyle]}>
        <View style={{ flex: 1 }}>
          <Text variant="headingM">Tax · {currentYear}</Text>
          <Text variant="paragraphS" style={S.headerSub}>{regionLabel} · {profile?.taxWithholdingPct || 0}% saved for taxes</Text>
        </View>
        <ScalePressable
          onPress={() => setIsSettingsOpen(true)}
          style={S.gearBtn}
          accessibilityRole="button"
          accessibilityLabel="Tax settings"
          hitSlop={8}
        >
          <Settings size={14} color={C.contentSecondary} />
        </ScalePressable>
      </View>

      {isLoading ? (
        <View style={S.loader}>
          <ActivityIndicator size="large" color={accentColor} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[S.scroll, { paddingBottom: 110 + insets.bottom }, gridStyle]}
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          {/* ── Threshold Alert Strips ── */}
          {thresholdAlerts.map((alert, idx) => (
            <View key={idx} style={S.alertStrip}>
              <AlertTriangle size={12} color={C.warning} />
              <Text variant="paragraphS" style={S.alertText}>{alert.message}</Text>
            </View>
          ))}

          {/* ── Tax Jar Card ── */}
          <Card className="gap-3">
            <Text variant="labelXs" style={S.cardLabel}>SAVED THIS YEAR</Text>
            <View style={S.jarRow}>
              <CurrencyText
                amount={taxJarBalance}
                size="xl"
                style={{ color: accentColor, fontWeight: "800", fontSize: 34, letterSpacing: -0.5 }}
              />
              <View style={{ alignItems: "flex-end" }}>
                <Text variant="labelXs" style={S.cardLabel}>TARGET</Text>
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
            <Text variant="paragraphS" tabular style={S.progressLabel}>
              {jarCoveragePct.toFixed(0)}% of {profile?.taxWithholdingPct || 0}% target saved
            </Text>

            <View style={S.jarFooter}>
              {todaySuggestion > 0 ? (
                <Text variant="paragraphS" style={S.suggestText}>
                  Suggested today:{" "}
                  <CurrencyText amount={todaySuggestion} size="sm" style={{ color: accentColor, fontWeight: "800" }} />
                </Text>
              ) : (
                <View />
              )}
              <Pressable
                onPress={() => setIsJarModalOpen(true)}
                accessibilityRole="button"
                accessibilityLabel="Log tax jar deposit"
                style={[S.pill, { borderColor: accentColor, backgroundColor: accentColorDim }]}
              >
                <Text variant="labelM" style={{ color: accentColor }}>+ Log</Text>
              </Pressable>
            </View>
          </Card>

          {/* ── Obligations Card ── */}
          <ScalePressable
            onPress={() => router.push("/tax/center" as any)}
            style={S.card}
            accessibilityRole="button"
          >
            <Text variant="labelXs" style={S.cardLabel}>ESTIMATED TAXES YOU OWE</Text>
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
                    <Text variant="labelM" style={S.pillMutedText}>
                      {pill.label}{" "}
                      <CurrencyText amount={pill.amount} size="sm" style={S.pillMutedText} />
                    </Text>
                  </View>
                ))}
              </View>
            )}

            <View style={S.breakdownLink}>
              <Text variant="labelM" style={{ color: accentColor }}>See full breakdown</Text>
              <ChevronRight size={12} color={accentColor} />
            </View>
          </ScalePressable>

          {/* ── Next Installment Row ── */}
          {nextInstallment && (
            <Pressable
              onPress={() => router.push("/tax/center" as any)}
              accessibilityRole="button"
              style={S.installmentRow}
            >
              <View style={S.installmentLeft}>
                <Calendar size={13} color={C.contentSecondary} />
                <Text variant="labelM" style={S.installmentLabel}>{nextInstallment.label}</Text>
                <Text variant="labelM" style={S.installmentDate}>
                  {nextInstallment.date.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </Text>
              </View>
              <View style={S.installmentRight}>
                <Text variant="labelM" tabular style={S.installmentDays}>{nextInstallment.daysUntil} days</Text>
                <ChevronRight size={12} color={C.contentMuted} />
              </View>
            </Pressable>
          )}

          {/* ── Disclaimer ── */}
          <Text variant="paragraphS" style={S.disclaimer}>
            Estimates only — standard rates, no bracket or credit adjustments. Consult a tax professional for your actual filing.
          </Text>
        </ScrollView>
      )}

      {/* ── Settings Bottom Sheet ── */}
      <Modal visible={isSettingsOpen} transparent animationType="slide">
        <Pressable style={S.sheetOverlay} onPress={() => setIsSettingsOpen(false)}>
          {/* The scrim behind stays full-bleed; only the sheet itself is capped. */}
          <Pressable
            style={[S.sheet, { paddingBottom: insets.bottom + 20 }, dialogStyle]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={S.sheetHandle} />
            <View style={S.sheetHeader}>
              <Text variant="headingS">Tax Profile</Text>
              <Text variant="paragraphS" style={S.sheetSub}>{regionLabel}</Text>
            </View>

            {/* HST toggle */}
            {countryDef.tax.hstOnboarding && (
              <View style={S.settingRow}>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text variant="labelM">GST/HST Registered</Text>
                  <Text variant="paragraphS" style={S.settingRowDesc}>
                    Required if gig earnings exceed $30k/yr in Canada.
                  </Text>
                </View>
                <Pressable
                  onPress={() => updateProfile({ hstRegistered: !profile?.hstRegistered })}
                  accessibilityRole="switch"
                  accessibilityLabel="GST/HST Registered"
                  accessibilityState={{ checked: !!profile?.hstRegistered }}
                  style={[
                    S.toggleBtn,
                    profile?.hstRegistered
                      ? { backgroundColor: accentColor, borderColor: accentColor }
                      : S.toggleBtnOff,
                  ]}
                >
                  <Text
                    variant="labelXs"
                    style={
                      profile?.hstRegistered
                        ? { color: accentColorContrast }
                        : { color: C.contentSecondary }
                    }
                  >
                    {profile?.hstRegistered ? "Registered" : "No"}
                  </Text>
                </Pressable>
              </View>
            )}

            {/* Withholding stepper */}
            <View style={S.settingRow}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text variant="labelM">Tax Savings Rate</Text>
                <Text variant="paragraphS" style={S.settingRowDesc}>% of your earnings (after expenses) to set aside for taxes.</Text>
              </View>
              <View style={S.stepper}>
                <Pressable
                  onPress={() =>
                    updateProfile({ taxWithholdingPct: Math.max(0, (profile?.taxWithholdingPct || 0) - 1) })
                  }
                  accessibilityRole="button"
                  accessibilityLabel="Decrease tax rate"
                  hitSlop={8}
                  style={S.stepBtn}
                >
                  <Text variant="headingM" style={S.stepBtnText}>−</Text>
                </Pressable>
                <View style={S.stepValue}>
                  <Text variant="labelM" tabular>{profile?.taxWithholdingPct || 0}%</Text>
                </View>
                <Pressable
                  onPress={() =>
                    updateProfile({ taxWithholdingPct: Math.min(100, (profile?.taxWithholdingPct || 0) + 1) })
                  }
                  accessibilityRole="button"
                  accessibilityLabel="Increase tax rate"
                  hitSlop={8}
                  style={S.stepBtn}
                >
                  <Text variant="headingM" style={S.stepBtnText}>+</Text>
                </Pressable>
              </View>
            </View>

            {/* Region change history */}
            {taxHistoryList && taxHistoryList.length > 0 && (
              <View style={S.historyBlock}>
                <Text variant="labelXs" style={S.settingBlockLabel}>Region Change History</Text>
                {taxHistoryList.slice(0, 3).map((hist) => (
                  <View key={hist.id} style={S.historyRow}>
                    <Text variant="labelM" style={S.historyText}>
                      {hist.oldRegion || "—"} → {hist.newRegion}
                    </Text>
                    <Text variant="paragraphS">
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
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <Pressable style={S.overlay} onPress={() => setIsJarModalOpen(false)}>
            <Pressable style={S.overlayCard} onPress={(e) => e.stopPropagation()}>
              <View style={S.overlayHeader}>
                <Text variant="labelL">Log Tax Jar Deposit</Text>
                <Pressable
                  onPress={() => setIsJarModalOpen(false)}
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                  hitSlop={8}
                  style={S.overlayClose}
                >
                  <Text variant="headingS" style={{ color: C.contentSecondary }}>×</Text>
                </Pressable>
              </View>
              <Text variant="paragraphM">Amount you're setting aside for taxes.</Text>
              <TextInput
                value={jarDepositInput}
                onChangeText={setJarDepositInput}
                placeholder="0.00"
                placeholderTextColor={C.contentMuted}
                keyboardType="decimal-pad"
                style={S.jarInput}
              />
              <View style={{ flexDirection: "row", gap: 8 }}>
                {[25, 50, 100, 200].map((amt) => (
                  <Pressable
                    key={amt}
                    onPress={() => setJarDepositInput(String(amt))}
                    accessibilityRole="button"
                    style={[S.chip, S.chipInactive, { flex: 1, paddingHorizontal: 4 }]}
                  >
                    <Text variant="labelM" tabular style={{ color: C.contentSecondary }}>${amt}</Text>
                  </Pressable>
                ))}
              </View>
              <View style={S.overlayActions}>
                <Pressable
                  onPress={() => setIsJarModalOpen(false)}
                  accessibilityRole="button"
                  style={S.cancelBtn}
                >
                  <Text variant="labelM" style={S.cancelBtnText}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={handleJarDeposit}
                  accessibilityRole="button"
                  style={[S.confirmBtn, { backgroundColor: accentColor }]}
                >
                  <Text variant="labelM" style={{ color: accentColorContrast }}>Add to Jar</Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const makeStyles = (C: Palette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  loader: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: { padding: 16, paddingTop: 8, gap: 10 },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: C.background,
  },
  headerSub: { marginTop: 2 },
  gearBtn: {
    width: 36,
    height: 36,
    // circular: diameter / 2
    borderRadius: 18,
    backgroundColor: C.surface03,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.lineSubtle,
    alignItems: "center",
    justifyContent: "center",
  },

  // Alert strip
  alertStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: withAlpha(C.warning, 0.06),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: withAlpha(C.warning, 0.2),
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  alertText: {
    color: C.contentSecondary,
    flex: 1,
  },

  // Cards
  card: {
    backgroundColor: C.surface02,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.lineSubtle,
    borderRadius: 20,
    padding: 18,
    gap: 12,
  },
  cardLabel: { color: C.contentMuted },

  // Tax Jar card internals
  jarRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  mutedValue: {
    color: C.contentSecondary,
    marginTop: 2,
  },
  progressTrack: {
    height: 6,
    backgroundColor: C.lineSubtle,
    // pill: height / 2
    borderRadius: 3,
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
  },
  progressLabel: { marginTop: -4 },
  jarFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 2,
  },
  suggestText: { color: C.contentSecondary },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },

  // Obligations card internals
  obligationTotal: {
    // hero money — no exact variant; explicit size, DS token color
    fontSize: 36,
    fontWeight: "800",
    color: C.contentPrimary,
    letterSpacing: -0.6,
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: -2,
  },
  pillMuted: {
    backgroundColor: C.surface03,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.lineSubtle,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  pillMutedText: { color: C.contentSecondary },
  breakdownLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    justifyContent: "flex-end",
    marginTop: 2,
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
  installmentLabel: { color: C.contentSecondary },
  installmentDate: { color: C.contentMuted },
  installmentRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  installmentDays: { color: C.contentMuted },

  // Disclaimer
  disclaimer: {
    textAlign: "center",
    paddingHorizontal: 8,
    marginTop: 4,
  },

  // Empty state
  emptyIcon: {
    width: 52,
    height: 52,
    // circular: diameter / 2
    borderRadius: 26,
    backgroundColor: withAlpha(C.primary, 0.08),
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: withAlpha(C.primary, 0.25),
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  emptyTitle: { textAlign: "center" },
  emptyBody: { textAlign: "center" },

  // Settings bottom sheet
  sheetOverlay: {
    flex: 1,
    backgroundColor: C.scrim,
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: C.surface02,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: C.lineSubtle,
    padding: 20,
    gap: 18,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.lineStrong,
    alignSelf: "center",
    marginBottom: 4,
  },
  sheetHeader: { gap: 2 },
  sheetSub: { color: C.contentSecondary },
  settingBlockLabel: { color: C.contentSecondary },
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 0.5,
    borderTopColor: C.lineSubtle,
    paddingTop: 14,
  },
  settingRowDesc: { marginTop: 2 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  chipInactive: {
    borderColor: C.lineSubtle,
    backgroundColor: C.surface03,
  },
  toggleBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    minWidth: 90,
    alignItems: "center",
  },
  toggleBtnOff: {
    borderColor: C.lineSubtle,
    backgroundColor: C.surface03,
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.surface03,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.lineSubtle,
    borderRadius: 12,
    overflow: "hidden",
  },
  stepBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  stepBtnText: { color: C.contentSecondary },
  stepValue: {
    width: 44,
    alignItems: "center",
  },
  historyBlock: {
    borderTopWidth: 0.5,
    borderTopColor: C.lineSubtle,
    paddingTop: 14,
    gap: 8,
  },
  historyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: C.surface03,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  historyText: { color: C.contentSecondary },

  // Modals
  overlay: {
    flex: 1,
    backgroundColor: C.scrim,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  overlayCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: C.surface02,
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.lineSubtle,
    padding: 20,
    gap: 16,
  },
  overlayHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: C.lineSubtle,
  },
  overlayClose: {
    width: 28,
    height: 28,
    // circular: diameter / 2
    borderRadius: 14,
    backgroundColor: C.surface03,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.lineSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  overlayActions: {
    flexDirection: "row",
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: C.surface03,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.lineSubtle,
    alignItems: "center",
  },
  cancelBtnText: { color: C.contentSecondary },
  confirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  jarInput: {
    backgroundColor: C.surface03,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.lineSubtle,
    borderRadius: 12,
    padding: 14,
    color: C.contentPrimary,
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
  },
});
