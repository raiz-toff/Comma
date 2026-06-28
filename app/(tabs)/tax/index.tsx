import React, { useMemo, useEffect, useRef, useState } from "react";
import { ScrollView, View, ActivityIndicator, StyleSheet, Pressable, Modal } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";
import { AlertTriangle, Settings, Coins, Calendar, TrendingUp, Calculator } from "lucide-react-native";
import { Text } from "@/src/components/ui/text";
import { CurrencyText } from "@/src/components/ui/CurrencyText";
import { useSettingsStore } from "@/store/useSettingsStore";
import { usePlatformTheme } from "@/src/hooks/usePlatformTheme";
import { useFeatureEnabled } from "@/hooks/useFeatureEnabled";
import {
  getCountryDef,
  getRegionsByCountry,
  getMileagePresetRate,
  getWithholdingPresetPct,
} from "@/src/registry/index";
import { getPeriodStats } from "@/src/database/queries/analytics";
import { getExpenseYTDSummary } from "@/src/database/queries/expenses";
import { getTaxHistory, insertTaxHistory } from "@/src/database/queries/tax";
import {
  calculateCPP,
  calculateHSTOwing,
  calculateCRAMileageDeduction,
  calculateQuarterlyInstallments,
  calculateSelfEmploymentTax,
  calculateScheduleC,
  calculateIRSMileageDeduction,
  calculateHMRCMileageDeduction,
} from "@/utils/taxCalculations";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function ScalePressable({ onPress, style, children, android_ripple }: any) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.95, { damping: 15 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15 });
  };

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[style, animatedStyle]}
      android_ripple={android_ripple}
    >
      {children}
    </AnimatedPressable>
  );
}

export default function TaxScreen() {
  const insets = useSafeAreaInsets();
  const { profile, isOnboardingCompleted, setHeaderVisible, updateProfile, applyTaxPreset } = useSettingsStore();
  const { accentColor, accentColorDim, accentColorMid, accentColorContrast } = usePlatformTheme();
  
  const isTaxEnabled = useFeatureEnabled("tax_workspace");

  useEffect(() => {
    if (!isTaxEnabled && isOnboardingCompleted) {
      router.replace("/");
    }
  }, [isTaxEnabled, isOnboardingCompleted]);

  if (!isTaxEnabled) {
    return null;
  }
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const countryDef = useMemo(() => {
    return getCountryDef(profile?.country || "CA");
  }, [profile?.country]);

  const regions = useMemo(() => {
    return getRegionsByCountry(profile?.country || "CA").map((r) => r.id);
  }, [profile?.country]);

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

  const { data: taxHistoryList, refetch: refetchTaxHistory } = useQuery({
    queryKey: ["taxHistory"],
    queryFn: () => getTaxHistory(),
    enabled: isOnboardingCompleted,
  });

  // State for changing region flow
  const [selectedNewRegion, setSelectedNewRegion] = useState<string | null>(null);

  const getPresetForRegion = (regionCode: string) => {
    const preset = getWithholdingPresetPct(countryDef.tax.regionPresetType, regionCode);
    return preset ?? countryDef.tax.defaultWithholdingPct;
  };

  const handleSelectRegion = (code: string) => {
    if (code === profile?.taxRegion) return;
    setSelectedNewRegion(code);
  };

  const confirmRegionChange = async () => {
    if (!selectedNewRegion) return;
    
    // Get old and new rates
    const oldRegion = profile?.taxRegion || null;
    const oldRate = profile?.taxWithholdingPct || null;
    const newRate = getPresetForRegion(selectedNewRegion);
    
    // Record history
    await insertTaxHistory({
      oldRegion,
      oldRate,
      newRegion: selectedNewRegion,
      newRate,
    });
    
    // Apply preset
    await applyTaxPreset(selectedNewRegion);
    
    // Refetch history list
    refetchTaxHistory();
    
    // Clear selection state
    setSelectedNewRegion(null);
  };

  // Derived calculations
  const grossRevenue = (ytdStats?.gross || 0) + (ytdStats?.tips || 0);
  const deductibleExpenses = ytdExpenses?.deductible || 0;
  const netIncome = Math.max(0, grossRevenue - deductibleExpenses);
  const totalMileage = (ytdStats?.activeMileage || 0) + (ytdStats?.deadMileage || 0);

  const regionLabel = useMemo(() => {
    if (regions.length === 0) {
      return countryDef.label;
    }
    return `${countryDef.label} (${profile?.taxRegion || countryDef.tax.defaultRegionCode})`;
  }, [countryDef, profile?.taxRegion, regions]);

  // Tax calculations based on country definition
  const taxData = useMemo(() => {
    // 1. CPP (Canada)
    const cpp = countryDef.tax.calcCpp ? calculateCPP(netIncome).total : 0;

    // 2. SE Tax (USA)
    const seTax = countryDef.tax.calcSeTax ? calculateSelfEmploymentTax(netIncome) : 0;

    // 3. HST/GST/Sales Tax owing
    let hst = 0;
    if (countryDef.tax.hstOnboarding && profile?.hstRegistered) {
      hst = calculateHSTOwing(grossRevenue, profile?.taxRegion || countryDef.tax.defaultRegionCode);
    }

    // 4. Mileage deduction calculation
    let mileageDeduction = 0;
    if (countryDef.hasMileageDeduction) {
      if (profile?.country === "CA") {
        mileageDeduction = calculateCRAMileageDeduction(totalMileage);
      } else if (profile?.country === "UK") {
        mileageDeduction = calculateHMRCMileageDeduction(totalMileage);
      } else {
        const rateStr = getMileagePresetRate(profile?.country || "US", profile?.taxRegion || countryDef.tax.defaultRegionCode);
        const rate = parseFloat(rateStr) || 0;
        mileageDeduction = totalMileage * rate;
      }
    }

    // 5. Estimated Income Tax
    const estimatedIncomeTax = netIncome * ((profile?.taxWithholdingPct || 0) / 100);

    // 6. Total Estimated Tax
    const totalEstimatedTax = cpp + seTax + estimatedIncomeTax + hst;

    // 7. Installments
    const installments = calculateQuarterlyInstallments(totalEstimatedTax);

    return {
      cpp,
      seTax,
      hst,
      mileageDeduction,
      estimatedIncomeTax,
      totalEstimatedTax,
      installments,
    };
  }, [countryDef, profile, netIncome, grossRevenue, totalMileage]);

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

  const isLoading = loadingStats || loadingExpenses;

  if (countryDef.hasSelfAssessmentTax === false) {
    return (
      <SafeAreaView style={S.root} edges={["left", "right"]}>
        {/* Header */}
        <View style={[S.header, { paddingTop: insets.top + 64 }]}>
          <Text style={S.headerTitle}>Tax Estimator ({currentYear})</Text>
        </View>

        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "#000000" }}>
          <View style={{ width: "100%", alignItems: "center", gap: 16, padding: 24, backgroundColor: "#0d0d0d", borderWidth: 0.8, borderColor: "#1f1f1f", borderRadius: 20 }}>
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: "rgba(34, 197, 94, 0.08)", borderStyle: "dashed", borderWidth: 1, borderColor: "rgba(34, 197, 94, 0.3)", alignItems: "center", justifyContent: "center" }}>
              <Calculator size={28} color={accentColor} />
            </View>
            <View style={{ alignItems: "center" }}>
              <Text style={{ fontSize: 16, fontWeight: "900", color: "#ffffff", textAlign: "center" }}>
                No Self-Assessment Required
              </Text>
              <Text style={{ fontSize: 13, color: "#a1a1aa", textAlign: "center", marginTop: 8, lineHeight: 18 }}>
                In {countryDef.label}, gig platform earnings are either subject to withholding at source or handled directly by the platforms. Independent self-assessment estimated payments are not required.
              </Text>
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={S.root} edges={["left", "right"]}>
      {/* Header */}
      <View style={[S.header, { paddingTop: insets.top + 64 }]}>
        <Text style={S.headerTitle}>Tax Estimator ({currentYear})</Text>
        <ScalePressable
          onPress={() => setIsSettingsOpen(prev => !prev)}
          style={[S.editSettingsBtn, isSettingsOpen && { borderColor: accentColor }]}
        >
          <Settings color={isSettingsOpen ? accentColor : "#a1a1aa"} size={13} style={{ marginRight: 6 }} />
          <Text style={[S.editSettingsText, isSettingsOpen && { color: accentColor }]}>
            {isSettingsOpen ? "Done" : "Configure"}
          </Text>
        </ScalePressable>
      </View>

      {isLoading ? (
        <View style={S.loadingContainer}>
          <ActivityIndicator size="large" color={accentColor} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[S.scroll, { paddingBottom: 110 + insets.bottom }]}
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          {/* Region Card */}
          <View style={S.regionCard}>
            <View>
              <Text style={S.regionLabel}>Active Tax Profile</Text>
              <Text style={S.regionValue}>{regionLabel}</Text>
            </View>
            <View style={[S.regionBadge, { borderColor: accentColorMid, backgroundColor: accentColorDim }]}>
              <Text style={[S.regionBadgeText, { color: accentColor }]}>
                {countryDef.label} Standard
              </Text>
            </View>
          </View>

          {/* Tax Settings Card */}
          {isSettingsOpen && (
            <View style={S.settingsCard}>
              <Text style={S.settingsCardTitle}>Configure Tax Profile</Text>
              
              {/* Province / State Selector (Only if regions exist) */}
              {regions.length > 0 && (
                <View style={S.settingGroup}>
                  <Text style={S.settingGroupLabel}>
                    {countryDef.tax.regionLabel ? countryDef.tax.regionLabel.charAt(0).toUpperCase() + countryDef.tax.regionLabel.slice(1) : "Region"} Preset
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={S.horizontalChips}>
                    {regions.map((code) => {
                      const isSelected = profile?.taxRegion === code;
                      return (
                        <Pressable
                          key={code}
                          onPress={() => handleSelectRegion(code)}
                          style={[
                            S.chip,
                            isSelected
                              ? { borderColor: accentColor, backgroundColor: accentColorDim }
                              : S.chipInactive
                          ]}
                        >
                          <Text style={[
                            S.chipText,
                            isSelected ? { color: accentColor, fontWeight: "800" } : { color: "#71717a" }
                          ]}>
                            {code}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              {/* GST/HST Registered Toggle (Only if country has HST/GST onboarding) */}
              {countryDef.tax.hstOnboarding && (
                <View style={S.settingRow}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={S.settingRowLabel}>GST/HST Registered</Text>
                    <Text style={S.settingRowDesc}>
                      Required in Canada if gig earnings exceed $30k/yr. Enables calculation of HST collected & claimable ITCs.
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => updateProfile({ hstRegistered: !profile?.hstRegistered })}
                    style={[
                      S.toggleBtn,
                      profile?.hstRegistered
                        ? { backgroundColor: accentColor, borderColor: accentColor }
                        : S.toggleBtnInactive
                    ]}
                  >
                    <Text style={[
                      S.toggleBtnText,
                      profile?.hstRegistered ? { color: accentColorContrast } : { color: "#a1a1aa" }
                    ]}>
                      {profile?.hstRegistered ? "Registered" : "No"}
                    </Text>
                  </Pressable>
                </View>
              )}

              {/* Tax Withholding Percentage Stepper */}
              <View style={S.settingRow}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={S.settingRowLabel}>Withholding Rate</Text>
                  <Text style={S.settingRowDesc}>
                    Percentage of net revenue set aside as tax reserve.
                  </Text>
                </View>
                <View style={S.stepperContainer}>
                  <Pressable
                    onPress={() => updateProfile({ taxWithholdingPct: Math.max(0, (profile?.taxWithholdingPct || 0) - 1) })}
                    style={S.stepperButton}
                  >
                    <Text style={S.stepperButtonText}>-</Text>
                  </Pressable>
                  <View style={S.stepperValueContainer}>
                    <Text style={S.stepperValueText}>{profile?.taxWithholdingPct || 0}%</Text>
                  </View>
                  <Pressable
                    onPress={() => updateProfile({ taxWithholdingPct: Math.min(100, (profile?.taxWithholdingPct || 0) + 1) })}
                    style={S.stepperButton}
                  >
                    <Text style={S.stepperButtonText}>+</Text>
                  </Pressable>
                </View>
              </View>

              {/* Tax Region History Log List (Only if regions exist) */}
              {regions.length > 0 && taxHistoryList && taxHistoryList.length > 0 && (
                <View style={S.historySection}>
                  <Text style={S.settingGroupLabel}>{countryDef.tax.regionLabel ? countryDef.tax.regionLabel.charAt(0).toUpperCase() + countryDef.tax.regionLabel.slice(1) : "Region"} Change History</Text>
                  <View style={S.historyList}>
                    {taxHistoryList.map((hist) => (
                      <View key={hist.id} style={S.historyRow}>
                        <View style={S.historyRowHeader}>
                          <Text style={S.historyTextBold}>
                            {hist.oldRegion || "None"} ➔ {hist.newRegion}
                          </Text>
                          <Text style={S.historyDate}>
                            {hist.changedAt.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "2-digit" })}
                          </Text>
                        </View>
                        <Text style={S.historySubText}>
                          Withholding rate updated from {hist.oldRate !== null ? `${hist.oldRate}%` : "N/A"} to {hist.newRate}%
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Income & Expenses Summary */}
          <View style={S.section}>
            <Text style={S.sectionTitle}>Business Schedule (YTD)</Text>
            <View style={S.bentoCard}>
              <View style={S.rowItem}>
                <Text style={S.rowLabel}>Gross Revenue</Text>
                <CurrencyText amount={grossRevenue} size="sm" style={S.rowValue} />
              </View>
              <View style={S.rowItem}>
                <Text style={S.rowLabel}>Deductible Expenses</Text>
                <CurrencyText amount={deductibleExpenses} size="sm" style={S.rowValueRose} />
              </View>
              <View style={[S.rowItemHighlight, { backgroundColor: accentColorDim, borderTopWidth: 0.5, borderTopColor: accentColorMid }]}>
                <Text style={S.rowLabelBold}>
                  {countryDef.hasContractorEconomy ? "Net Self-Employment Income" : "Net Business Income"}
                </Text>
                <CurrencyText amount={netIncome} size="sm" style={[S.rowValueBold, { color: accentColor }]} />
              </View>
            </View>
          </View>

          {/* Estimated Tax Breakdown */}
          <View style={S.section}>
            <Text style={S.sectionTitle}>Estimated Obligations</Text>
            <View style={S.bentoCard}>
              {/* CPP Contribution (Canada) */}
              {countryDef.tax.calcCpp && (
                <View style={S.rowItem}>
                  <View>
                    <Text style={S.rowLabelBold}>CPP Contribution</Text>
                    <Text style={S.rowSubText}>Self-employed portion (11.9%)</Text>
                  </View>
                  <CurrencyText amount={taxData.cpp || 0} size="sm" style={S.rowValue} />
                </View>
              )}

              {/* Self-Employment Tax (USA) */}
              {countryDef.tax.calcSeTax && (
                <View style={S.rowItem}>
                  <View>
                    <Text style={S.rowLabelBold}>Self-Employment Tax</Text>
                    <Text style={S.rowSubText}>IRS SE Tax (15.3% of 92.35% profit)</Text>
                  </View>
                  <CurrencyText amount={taxData.seTax || 0} size="sm" style={S.rowValue} />
                </View>
              )}

              {/* HST/GST (Canada) */}
              {countryDef.tax.hstOnboarding && profile?.hstRegistered && (
                <View style={S.rowItem}>
                  <View>
                    <Text style={S.rowLabelBold}>HST/GST Owing</Text>
                    <Text style={S.rowSubText}>Estimated on gross revenue</Text>
                  </View>
                  <CurrencyText amount={taxData.hst || 0} size="sm" style={S.rowValue} />
                </View>
              )}

              <View style={S.rowItem}>
                <View>
                  <Text style={S.rowLabelBold}>Estimated Income Tax</Text>
                  <Text style={S.rowSubText}>
                    Withholding rate: {profile?.taxWithholdingPct || 0}% of net
                  </Text>
                </View>
                <CurrencyText amount={taxData.estimatedIncomeTax || 0} size="sm" style={S.rowValue} />
              </View>

              <View style={[S.rowItemHighlight, { backgroundColor: "rgba(245, 158, 11, 0.08)", borderTopWidth: 0.5, borderTopColor: "rgba(245, 158, 11, 0.2)" }]}>
                <Text style={[S.rowLabelBold, { color: "#f59e0b" }]}>Total Estimated Obligation</Text>
                <CurrencyText amount={taxData.totalEstimatedTax || 0} size="sm" style={[S.rowValueBold, { color: "#f59e0b" }]} />
              </View>
            </View>
          </View>

          {/* Mileage Deduction Card (Only if country has mileage deduction) */}
          {countryDef.hasMileageDeduction && (
            <View style={S.section}>
              <Text style={S.sectionTitle}>Standard Mileage Deduction</Text>
              <View style={S.regionCard}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: "900", color: "#fff" }}>
                    {totalMileage.toFixed(1)} {profile?.distanceUnit || "mi"}
                  </Text>
                  <Text style={S.regionLabel}>Logged YTD Mileage</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <CurrencyText amount={taxData.mileageDeduction || 0} size="md" style={[S.rowValueBold, { color: accentColor }]} />
                  <Text style={S.regionLabel}>
                    Write-off Value ({countryDef.mileageDeductionLabel || "Standard"})
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Quarterly Installment Dates (Only if country has installment schedule) */}
          {countryDef.taxInstallmentDates && countryDef.taxInstallmentDates.length > 0 && (
            <View style={S.section}>
              <Text style={S.sectionTitle}>
                {countryDef.label} Tax Deadlines
              </Text>
              <View style={S.dueDatesList}>
                {countryDef.taxInstallmentDates.map((item, idx) => {
                  const year = currentYear + (item.followYear ? 1 : 0);
                  const dateObj = new Date(year, item.month - 1, item.day);
                  const formattedDate = dateObj.toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  });
                  return (
                    <View key={idx} style={S.dueDateCard}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Calendar size={14} color="#71717a" />
                        <Text style={S.dueDateLabel}>{item.label}</Text>
                      </View>
                      <Text style={S.dueDateValue}>{formattedDate}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Disclaimer Card */}
          <View style={S.disclaimerCard}>
            <AlertTriangle size={15} color="#52525b" style={{ marginTop: 2 }} />
            <Text style={S.disclaimerText}>
              These are estimates only for preparation. Standard rates do not calculate provincial/state tax brackets or credits. Consult a licensed tax professional or CPA for your actual tax filings.
            </Text>
          </View>
        </ScrollView>
      )}

      {/* Change Tax Region Confirmation Modal */}
      <Modal visible={!!selectedNewRegion} transparent animationType="fade">
        <Pressable
          style={S.overlay}
          onPress={() => setSelectedNewRegion(null)}
        >
          <Pressable style={S.overlayCard} onPress={(e) => e.stopPropagation()}>
            <View style={S.overlayHeader}>
              <Text style={S.overlayTitle}>Change Tax {countryDef.tax.regionLabel ? countryDef.tax.regionLabel.charAt(0).toUpperCase() + countryDef.tax.regionLabel.slice(1) : "Region"}</Text>
              <Pressable onPress={() => setSelectedNewRegion(null)} style={S.overlayClose}>
                <Text style={{ color: "#a1a1aa", fontSize: 16, lineHeight: 16, fontWeight: "700" }}>×</Text>
              </Pressable>
            </View>

            <Text style={S.overlayWarningText}>
              Are you sure you want to change your active {countryDef.tax.regionLabel || "region"} from <Text style={{ color: "#ffffff", fontWeight: "800" }}>{profile?.taxRegion}</Text> to <Text style={{ color: accentColor, fontWeight: "800" }}>{selectedNewRegion}</Text>?
            </Text>

            <View style={S.comparisonContainer}>
              <View style={S.comparisonColumn}>
                <Text style={S.comparisonLabel}>Previous {countryDef.tax.regionLabel ? countryDef.tax.regionLabel.charAt(0).toUpperCase() + countryDef.tax.regionLabel.slice(1) : "Region"}</Text>
                <Text style={S.comparisonRegionCode}>{profile?.taxRegion}</Text>
                <Text style={S.comparisonRate}>Rate: {profile?.taxWithholdingPct || 0}%</Text>
              </View>
              <View style={S.comparisonArrow}>
                <Text style={{ color: "#71717a", fontSize: 18 }}>➔</Text>
              </View>
              <View style={S.comparisonColumn}>
                <Text style={S.comparisonLabel}>New {countryDef.tax.regionLabel ? countryDef.tax.regionLabel.charAt(0).toUpperCase() + countryDef.tax.regionLabel.slice(1) : "Region"}</Text>
                <Text style={[S.comparisonRegionCode, { color: accentColor }]}>{selectedNewRegion}</Text>
                <Text style={S.comparisonRate}>
                  Rate: {selectedNewRegion ? getPresetForRegion(selectedNewRegion) : 0}%
                </Text>
              </View>
            </View>

            <Text style={S.overlayInfoText}>
              All tax estimations, deductions, and set-aside recommendations from today and onward will be calculated using the new {countryDef.tax.regionLabel || "region"}'s rates. Past shift logs will remain archived.
            </Text>

            <View style={S.overlayActions}>
              <Pressable
                onPress={() => setSelectedNewRegion(null)}
                style={S.cancelBtn}
              >
                <Text style={S.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={confirmRegionChange}
                style={[S.confirmBtn, { backgroundColor: accentColor }]}
              >
                <Text style={[S.confirmBtnText, { color: accentColorContrast }]}>Confirm Change</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000000" },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: { padding: 14, paddingTop: 6, gap: 18 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: "#000000",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#ffffff",
    letterSpacing: -0.3,
  },
  editSettingsBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: "#161615",
    borderWidth: 0.8,
    borderColor: "#262522",
  },
  editSettingsText: {
    color: "#a1a1aa",
    fontSize: 12,
    fontWeight: "700",
  },
  
  // Region profile card
  regionCard: {
    backgroundColor: "#0d0d0d",
    borderWidth: 0.8,
    borderColor: "#1f1f1f",
    borderRadius: 20,
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  regionLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: "#71717a",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 2,
  },
  regionValue: {
    fontSize: 15,
    fontWeight: "800",
    color: "#ffffff",
    marginTop: 3,
  },
  regionBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 0.8,
  },
  regionBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  // Section styling
  section: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#71717a",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 2,
    paddingHorizontal: 4,
  },

  // Bento boxes
  bentoCard: {
    backgroundColor: "#0d0d0d",
    borderWidth: 0.8,
    borderColor: "#1f1f1f",
    borderRadius: 20,
    overflow: "hidden",
  },
  rowItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: "#161615",
  },
  rowItemHighlight: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
  },
  rowLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#a1a1aa",
  },
  rowLabelBold: {
    fontSize: 13,
    fontWeight: "800",
    color: "#ffffff",
  },
  rowValue: {
    fontWeight: "800",
    color: "#ffffff",
  },
  rowValueRose: {
    fontWeight: "800",
    color: "#f43f5e",
  },
  rowValueBold: {
    fontWeight: "900",
  },
  rowSubText: {
    fontSize: 9,
    fontWeight: "600",
    color: "#52525b",
    marginTop: 2,
  },

  // Due dates
  dueDatesList: {
    gap: 8,
  },
  dueDateCard: {
    backgroundColor: "#0d0d0d",
    borderWidth: 0.8,
    borderColor: "#1f1f1f",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dueDateLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#ffffff",
  },
  dueDateValue: {
    fontSize: 12,
    fontWeight: "700",
    color: "#71717a",
  },

  // Disclaimer
  disclaimerCard: {
    backgroundColor: "#070707",
    borderWidth: 0.8,
    borderColor: "#161615",
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  disclaimerText: {
    fontSize: 10,
    color: "#52525b",
    fontWeight: "600",
    lineHeight: 15,
    flex: 1,
  },
  
  // Tax settings styling
  settingsCard: {
    backgroundColor: "#0d0d0d",
    borderWidth: 0.8,
    borderColor: "#1f1f1f",
    borderRadius: 20,
    padding: 16,
    gap: 16,
  },
  settingsCardTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: "#ffffff",
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  settingGroup: {
    flexDirection: "column",
    gap: 8,
  },
  settingGroupLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: "#71717a",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  horizontalChips: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 2,
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
    borderColor: "#262522",
    backgroundColor: "#161615",
  },
  chipText: {
    fontSize: 12,
    fontWeight: "700",
  },
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 0.5,
    borderTopColor: "#161615",
    paddingTop: 14,
  },
  settingRowLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: "#ffffff",
  },
  settingRowDesc: {
    fontSize: 10,
    fontWeight: "600",
    color: "#52525b",
    marginTop: 2,
    lineHeight: 14,
  },
  toggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 0.8,
    minWidth: 90,
    alignItems: "center",
    justifyContent: "center",
  },
  toggleBtnInactive: {
    borderColor: "#262522",
    backgroundColor: "#161615",
  },
  toggleBtnText: {
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  stepperContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#161615",
    borderWidth: 0.8,
    borderColor: "#262522",
    borderRadius: 14,
    overflow: "hidden",
  },
  stepperButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.02)",
  },
  stepperButtonText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#a1a1aa",
  },
  stepperValueContainer: {
    width: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperValueText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#ffffff",
  },

  // Modal overlay styles
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.85)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  overlayCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#0d0d0d",
    borderRadius: 24,
    borderWidth: 0.8,
    borderColor: "#1f1f1f",
    padding: 20,
    gap: 16,
  },
  overlayHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: "#1f1f1f",
  },
  overlayTitle: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  overlayClose: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#161615",
    borderWidth: 0.8,
    borderColor: "#262522",
    alignItems: "center",
    justifyContent: "center",
  },
  overlayWarningText: {
    color: "#a1a1aa",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
  },
  comparisonContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#161615",
    borderRadius: 16,
    borderWidth: 0.8,
    borderColor: "#262522",
    padding: 14,
  },
  comparisonColumn: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  comparisonLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: "#71717a",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  comparisonRegionCode: {
    fontSize: 20,
    fontWeight: "900",
    color: "#ffffff",
  },
  comparisonRate: {
    fontSize: 11,
    fontWeight: "700",
    color: "#a1a1aa",
  },
  comparisonArrow: {
    paddingHorizontal: 10,
  },
  overlayInfoText: {
    color: "#52525b",
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "600",
  },
  overlayActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "#161615",
    borderWidth: 0.8,
    borderColor: "#262522",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: {
    color: "#a1a1aa",
    fontSize: 12,
    fontWeight: "800",
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmBtnText: {
    fontSize: 12,
    fontWeight: "800",
  },

  // History list styling
  historySection: {
    borderTopWidth: 0.5,
    borderTopColor: "#161615",
    paddingTop: 16,
    gap: 10,
  },
  historyList: {
    gap: 10,
  },
  historyRow: {
    backgroundColor: "#161615",
    borderRadius: 14,
    borderWidth: 0.8,
    borderColor: "#262522",
    padding: 12,
    gap: 4,
  },
  historyRowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  historyTextBold: {
    fontSize: 12,
    fontWeight: "800",
    color: "#ffffff",
  },
  historyDate: {
    fontSize: 10,
    fontWeight: "600",
    color: "#71717a",
  },
  historySubText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#71717a",
    lineHeight: 13,
  },
});
