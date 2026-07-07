import React, { useState, useEffect, useMemo } from "react";
import {
  ScrollView,
  View,
  Pressable,
  ActivityIndicator,
  Alert,
  Share,
  StyleSheet,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Calculator, Clock, Download } from "lucide-react-native";
import { Text } from "@/src/components/ui/text";
import { useSettingsStore } from "@/store/useSettingsStore";
import { usePlatformTheme } from "@/src/hooks/usePlatformTheme";
import { notifyExport } from "@/src/services/notify";
import { db } from "@/src/database/client";
import { shifts, expenses, settings } from "@/src/database/schema";
import { and, gte, lte, eq } from "drizzle-orm";
import {
  calculatePensionContributions,
  calculateSelfEmploymentTax,
  calculateCRAMileageDeduction,
  calculateIRSMileageDeduction,
  calculateHMRCMileageDeduction,
  calculateHSTOwing,
  calculateUKNationalInsurance,
  projectQuarterlyInstallment,
} from "@/utils/taxCalculations";
import {
  getCountryDef,
  resolveProvinceDef,
} from "@/src/registry/index";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";

const isWeb = Platform.OS === "web";

// ─── Animated pressable ───────────────────────────────────────────────────────

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function ScalePressable({
  onPress,
  style,
  children,
}: {
  onPress: () => void;
  style?: object | object[];
  children: React.ReactNode;
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => {
        scale.value = withSpring(0.96, { damping: 15 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 15 });
      }}
      style={[style, animatedStyle]}
    >
      {children}
    </AnimatedPressable>
  );
}

// ─── Data layer ───────────────────────────────────────────────────────────────

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
  hstCollected: number;
  itcTotal: number;
  hstRemittable: number;
}

async function fetchTaxSummary(
  year: number,
  country: string,
  taxRegion: string,
  hstRegistered: boolean
): Promise<TaxSummary> {
  let rawShifts: any[] = [];
  let rawExpenses: any[] = [];

  if (isWeb) {
    try {
      const sData = localStorage.getItem("comma_shifts");
      const eData = localStorage.getItem("comma_expenses");
      rawShifts = sData ? JSON.parse(sData) : [];
      rawExpenses = eData ? JSON.parse(eData) : [];
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

  let gross = 0;
  let tips = 0;
  let bonus = 0;
  let distanceKm = 0;
  let activeMileage = 0;
  let deadMileage = 0;

  rawShifts.forEach((s: any) => {
    gross += Number(s.grossRevenue || 0);
    tips += Number(s.tipsRevenue || 0);
    bonus += Number(s.bonusAmount || 0);
    const active = Number(s.activeMileage || s.trackedMileage || 0);
    const dead = Number(s.deadMileage || 0);
    distanceKm += active + dead;
    activeMileage += active;
    deadMileage += dead;
  });

  let totalExpenses = 0;
  rawExpenses.forEach((e: any) => {
    // Apply each expense's business-use percentage, consistent with the Tax/Analytics queries.
    if (e.isDeductible) totalExpenses += Number(e.amount || 0) * Number(e.deductiblePct ?? 100) / 100;
  });

  const totalGross = gross + tips + bonus;
  const netIncome = Math.max(0, totalGross - totalExpenses);

  let hstCollected = 0;
  let itcTotal = 0;
  let hstRemittable = 0;
  if (country === "CA" && hstRegistered) {
    const hstResult = calculateHSTOwing(0, totalGross, totalExpenses, taxRegion, year);
    hstCollected = hstResult.hstOnDirectRevenue;
    itcTotal = hstResult.itcEstimate;
    hstRemittable = hstResult.netRemittable;
  }

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
    gross: totalGross,
    businessExpenses: totalExpenses,
    netIncome,
    virtualJar,
    distanceKm,
    activeMileage,
    deadMileage,
    hstCollected,
    itcTotal,
    hstRemittable,
  };
}

interface Deadline {
  label: string;
  date: Date;
  daysUntil: number;
}

function getDeadlines(country: string, year: number): Deadline[] {
  const now = new Date();
  const list: { label: string; date: Date }[] = [];

  if (country === "CA") {
    list.push(
      { label: "Q1 Payment", date: new Date(year, 2, 15) },
      { label: "Q2 Payment", date: new Date(year, 5, 15) },
      { label: "Q3 Payment", date: new Date(year, 8, 15) },
      { label: "Q4 Payment", date: new Date(year, 11, 15) },
      { label: "Yearly Tax Return Due", date: new Date(year + 1, 5, 15) }
    );
  } else {
    list.push(
      { label: "Q1 Payment", date: new Date(year, 3, 15) },
      { label: "Q2 Payment", date: new Date(year, 5, 15) },
      { label: "Q3 Payment", date: new Date(year, 8, 15) },
      { label: "Q4 Payment", date: new Date(year + 1, 0, 15) },
      { label: "Yearly Tax Return Due", date: new Date(year + 1, 3, 15) }
    );
  }

  return list.map((item) => ({
    ...item,
    daysUntil: Math.ceil(
      (item.date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    ),
  }));
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function TaxCenterScreen() {
  const queryClient = useQueryClient();
  const { profile } = useSettingsStore();
  const { accentColor, accentColorContrast } = usePlatformTheme();
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());

  const queryKey = [
    "tax",
    "summary",
    selectedYear,
    profile.country,
    profile.taxRegion,
    profile.hstRegistered,
  ] as const;

  const { data: summary, isLoading } = useQuery({
    queryKey,
    queryFn: () =>
      fetchTaxSummary(
        selectedYear,
        profile.country,
        profile.taxRegion ?? "",
        profile.hstRegistered ?? false
      ),
  });

  // Local state for instant jar feedback — syncs from query data on load
  const [localJarValue, setLocalJarValue] = useState(0);
  useEffect(() => {
    if (summary?.virtualJar !== undefined) {
      setLocalJarValue(summary.virtualJar);
    }
  }, [summary?.virtualJar]);

  const currencyCode =
    profile.locale?.currency ?? (profile.country === "CA" ? "CAD" : "USD");
  const distanceUnit =
    profile.distanceUnit ?? (profile.country === "CA" ? "km" : "mi");

  const fmt = (val: number) =>
    new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currencyCode,
      minimumFractionDigits: 2,
    }).format(val);

  const targetSetAside = summary
    ? summary.gross * (profile.taxWithholdingPct / 100)
    : 0;
  const jarCoveragePct =
    targetSetAside > 0
      ? Math.min(100, (localJarValue / targetSetAside) * 100)
      : 0;

  const handleAdjustJar = async (amount: number) => {
    const next = Math.max(0, localJarValue + amount);
    // Instant local update — no wait for DB
    setLocalJarValue(next);
    const jarKey = `tax_virtual_jar_${selectedYear}`;
    await upsertSetting(jarKey, String(next));
    // Sync full query cache with correct key
    queryClient.setQueryData(queryKey, (prev: TaxSummary | undefined) =>
      prev ? { ...prev, virtualJar: next } : prev
    );
  };

  const handleExport = async (format: "json" | "csv") => {
    if (!summary) return;
    const deadlinesList = getDeadlines(profile.country, selectedYear);
    const exportText =
      format === "json"
        ? JSON.stringify(
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
              virtualJar: localJarValue,
              distanceKm: summary.distanceKm,
              deadlines: deadlinesList.map((d) => ({
                label: d.label,
                date: d.date.toISOString().split("T")[0],
                daysUntil: d.daysUntil,
              })),
            },
            null,
            2
          )
        : [
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
            ["virtual_jar", localJarValue],
            ["distance_km", summary.distanceKm],
            ...deadlinesList.map((d, i) => [
              `deadline_${i + 1}`,
              `${d.date.toISOString().split("T")[0]} (${d.label})`,
            ]),
          ]
            .map((row) =>
              row
                .map((s) => `"${String(s).replace(/"/g, '""')}"`)
                .join(",")
            )
            .join("\n");

    if (isWeb) {
      const blob = new Blob([exportText], {
        type: format === "json" ? "application/json" : "text/csv",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `comma-tax-${profile.country.toLowerCase()}-${selectedYear}.${format}`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      notifyExport(`Tax ${format.toUpperCase()}`, true);
    } else {
      try {
        await Share.share({
          title: `Tax ${format.toUpperCase()}`,
          message: exportText,
        });
        notifyExport(`Tax ${format.toUpperCase()}`, true);
      } catch (err: any) {
        Alert.alert("Export Failed", err.message || "Could not share file.");
        notifyExport(`Tax ${format.toUpperCase()}`, false, err?.message);
      }
    }
  };

  // ── Computed tax figures ──────────────────────────────────────────────────

  const countryDef = getCountryDef(profile.country || "CA");
  const netIncome = summary?.netIncome || 0;
  const totalDistance = summary?.distanceKm || 0;

  const mileageDeduction =
    profile.country === "CA"
      ? calculateCRAMileageDeduction(totalDistance, selectedYear)
      : profile.country === "UK"
      ? calculateHMRCMileageDeduction(
          distanceUnit === "mi" ? totalDistance : totalDistance * 0.621371,
          selectedYear
        )
      : calculateIRSMileageDeduction(
          distanceUnit === "mi" ? totalDistance : totalDistance * 0.621371,
          selectedYear
        );

  // Mileage reduces taxable income the same way logged expenses do — apply it BEFORE the
  // dependent taxes below so the "Mileage Tax Savings" line actually flows into
  // totalObligations, instead of being shown as a deduction that never affects the total.
  const taxableIncome = Math.max(0, netIncome - mileageDeduction);

  const pensionResult =
    profile.country === "CA"
      ? calculatePensionContributions(
          taxableIncome,
          profile.taxRegion || "ON",
          selectedYear
        )
      : { cpp1Total: 0, cpp2Total: 0, total: 0, planType: "CPP" as const };

  const seTaxEstimate =
    profile.country === "US"
      ? calculateSelfEmploymentTax(taxableIncome, selectedYear)
      : 0;

  const ukNI =
    profile.country === "UK"
      ? calculateUKNationalInsurance(taxableIncome, selectedYear)
      : null;

  const stateDef =
    profile.country === "US"
      ? resolveProvinceDef("US", profile.taxRegion || "CA")
      : null;
  const stateIncomeTax = stateDef?.incomeTaxRate
    ? taxableIncome * stateDef.incomeTaxRate
    : 0;

  const estimatedIncomeTax = taxableIncome * (profile.taxWithholdingPct / 100);

  const totalObligations =
    pensionResult.total +
    seTaxEstimate +
    (ukNI?.total ?? 0) +
    stateIncomeTax +
    estimatedIncomeTax +
    (summary?.hstRemittable ?? 0);

  const quarterlyProjection = useMemo(() => {
    if (!summary?.gross && !summary?.businessExpenses) return null;
    return projectQuarterlyInstallment(
      summary?.gross || 0,
      summary?.businessExpenses || 0,
      profile.taxWithholdingPct
    );
  }, [summary?.gross, summary?.businessExpenses, profile.taxWithholdingPct]);

  const deadlines = getDeadlines(profile.country, selectedYear);

  // ── Loading ───────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <SafeAreaView style={S.root}>
        <View style={S.loader}>
          <ActivityIndicator size="large" color={accentColor} />
        </View>
      </SafeAreaView>
    );
  }

  // ── No self-assessment required ───────────────────────────────────────────

  if (countryDef.hasSelfAssessmentTax === false) {
    return (
      <SafeAreaView style={S.root}>
        <View style={S.header}>
          <Pressable onPress={() => router.back()} style={S.backBtn}>
            <ArrowLeft size={16} color="#9B9BA4" />
          </Pressable>
          <Text style={[S.headerTitle, { marginLeft: 12 }]}>Tax Center</Text>
        </View>
        <View style={[S.loader, { padding: 24 }]}>
          <View style={S.card}>
            <View style={S.emptyIcon}>
              <Calculator size={24} color={accentColor} />
            </View>
            <Text style={S.emptyTitle}>No Self-Assessment Required</Text>
            <Text style={S.emptyBody}>
              In {countryDef.label}, gig platform earnings are handled directly
              by platforms. Independent self-assessment is not required.
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={S.root}>
      {/* Header */}
      <View style={S.header}>
        <Pressable onPress={() => router.back()} style={S.backBtn}>
          <ArrowLeft size={16} color="#9B9BA4" />
        </Pressable>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={S.headerTitle}>Tax Center</Text>
          <Text style={S.headerSub}>Full breakdown · {selectedYear}</Text>
        </View>
        {/* Year selector */}
        <View style={S.yearPicker}>
          {[0, 1].map((delta) => {
            const year = new Date().getFullYear() - delta;
            const active = selectedYear === year;
            return (
              <Pressable
                key={year}
                onPress={() => setSelectedYear(year)}
                style={[
                  S.yearChip,
                  active
                    ? { backgroundColor: accentColor, borderColor: accentColor }
                    : S.yearChipInactive,
                ]}
              >
                <Text
                  style={[
                    S.yearChipText,
                    { color: active ? accentColorContrast : "#9B9BA4" },
                  ]}
                >
                  {year}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={S.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Virtual Tax Jar ── */}
        <View style={S.card}>
          <Text style={S.cardLabel}>TAX SAVINGS JAR</Text>
          <Text style={[S.heroAmount, { color: accentColor, marginTop: 8 }]}>
            {fmt(localJarValue)}
          </Text>

          <View style={S.progressTrack}>
            <View
              style={[
                S.progressFill,
                {
                  width: `${Math.min(100, jarCoveragePct)}%` as `${number}%`,
                  backgroundColor: accentColor,
                },
              ]}
            />
          </View>

          <View style={S.jarStats}>
            <Text style={S.progressLabel}>
              {jarCoveragePct.toFixed(0)}% covered
            </Text>
            <Text style={S.progressLabel}>
              Target: {fmt(targetSetAside)}
            </Text>
          </View>

          {/* Quick adjust */}
          <View style={S.jarAdjust}>
            {([-25, -10, 10, 25] as const).map((amt) => (
              <ScalePressable
                key={amt}
                onPress={() => handleAdjustJar(amt)}
                style={[
                  S.adjustBtn,
                  amt < 0
                    ? {
                        borderColor: "rgba(239,68,68,0.3)",
                        backgroundColor: "rgba(239,68,68,0.06)",
                      }
                    : {
                        borderColor: "rgba(16,185,129,0.3)",
                        backgroundColor: "rgba(16,185,129,0.06)",
                      },
                ]}
              >
                <Text
                  style={[
                    S.adjustBtnText,
                    { color: amt < 0 ? "#f87171" : accentColor },
                  ]}
                >
                  {amt > 0 ? `+${amt}` : amt}
                </Text>
              </ScalePressable>
            ))}
          </View>
        </View>

        {/* ── Income snapshot ── */}
        <View style={S.twoCol}>
          <View style={[S.card, { flex: 1 }]}>
            <Text style={S.cardLabel}>TOTAL EARNINGS</Text>
            <Text style={[S.medAmount, { marginTop: 8 }]}>
              {fmt(summary?.gross || 0)}
            </Text>
            <Text style={S.miniNote}>Pay + tips + bonuses</Text>
          </View>
          <View style={[S.card, { flex: 1 }]}>
            <Text style={S.cardLabel}>EXPENSES</Text>
            <Text style={[S.medAmount, { marginTop: 8, color: "#f87171" }]}>
              {fmt(summary?.businessExpenses || 0)}
            </Text>
            <Text style={S.miniNote}>Money you spent to do the work</Text>
          </View>
        </View>

        {/* ── Net income ── */}
        <View style={S.card}>
          <View style={S.rowBetween}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={S.cardLabel}>WHAT YOU'LL BE TAXED ON</Text>
              <Text
                style={[S.heroAmount, { color: accentColor, marginTop: 8 }]}
              >
                {fmt(netIncome)}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={S.cardLabel}>YOURS TO KEEP</Text>
              <Text style={[S.mutedValue, { marginTop: 6 }]}>
                {fmt(Math.max(0, netIncome - targetSetAside))}
              </Text>
              <Text style={[S.miniNote, { marginTop: 2, textAlign: "right" }]}>
                after setting aside for taxes
              </Text>
            </View>
          </View>
        </View>

        {/* ── Estimated obligations ── */}
        <View style={S.card}>
          <Text style={S.cardLabel}>
            ESTIMATED TAXES YOU OWE · {selectedYear}
          </Text>

          <View style={{ marginTop: 14 }}>
            {/* CPP/QPP — Canada */}
            {profile.country === "CA" && (
              <>
                <View style={S.oblRow}>
                  <View style={S.oblLeft}>
                    <Text style={S.oblLabel}>
                      {pensionResult.planType === "QPP"
                        ? "Quebec Pension Plan"
                        : "Canada Pension Plan"}
                    </Text>
                    <Text style={S.oblNote}>
                      Required for self-employed workers ·{" "}
                      {pensionResult.planType === "QPP" ? "12.8%" : "11.9%"} of income
                    </Text>
                  </View>
                  <Text style={S.oblAmount}>
                    {fmt(pensionResult.cpp1Total)}
                  </Text>
                </View>
                {pensionResult.cpp2Total > 0 && (
                  <View style={[S.oblRow, S.oblSep]}>
                    <View style={S.oblLeft}>
                      <Text style={S.oblLabel}>
                        {pensionResult.planType === "QPP"
                          ? "Quebec Pension Plan — extra"
                          : "Canada Pension Plan — extra"}
                      </Text>
                      <Text style={S.oblNote}>
                        8% more on your higher earnings
                      </Text>
                    </View>
                    <Text style={S.oblAmount}>
                      {fmt(pensionResult.cpp2Total)}
                    </Text>
                  </View>
                )}
              </>
            )}

            {/* SE Tax — USA */}
            {profile.country === "US" && (
              <View style={S.oblRow}>
                <View style={S.oblLeft}>
                  <Text style={S.oblLabel}>Self-Employment Tax</Text>
                  <Text style={S.oblNote}>
                    Covers Social Security & Medicare
                  </Text>
                </View>
                <Text style={S.oblAmount}>{fmt(seTaxEstimate)}</Text>
              </View>
            )}

            {/* State income tax — USA */}
            {stateIncomeTax > 0 && (
              <View style={[S.oblRow, S.oblSep]}>
                <View style={S.oblLeft}>
                  <Text style={S.oblLabel}>
                    {profile.taxRegion} State Tax
                  </Text>
                  <Text style={S.oblNote}>Rough estimate for your state</Text>
                </View>
                <Text style={S.oblAmount}>{fmt(stateIncomeTax)}</Text>
              </View>
            )}

            {/* UK National Insurance */}
            {ukNI && (
              <>
                <View style={S.oblRow}>
                  <View style={S.oblLeft}>
                    <Text style={S.oblLabel}>National Insurance</Text>
                    <Text style={S.oblNote}>
                      {ukNI.isExemptClass2
                        ? "Exempt (below threshold)"
                        : "£3.45/week flat rate"}
                    </Text>
                  </View>
                  <Text style={S.oblAmount}>{fmt(ukNI.class2Annual)}</Text>
                </View>
                {ukNI.class4 > 0 && (
                  <View style={[S.oblRow, S.oblSep]}>
                    <View style={S.oblLeft}>
                      <Text style={S.oblLabel}>National Insurance — extra</Text>
                      <Text style={S.oblNote}>
                        9% of profit between £12,570–£50,270
                      </Text>
                    </View>
                    <Text style={S.oblAmount}>{fmt(ukNI.class4)}</Text>
                  </View>
                )}
              </>
            )}

            {/* Income tax reserve */}
            <View style={[S.oblRow, S.oblSep]}>
              <View style={S.oblLeft}>
                <Text style={S.oblLabel}>Income Tax</Text>
                <Text style={S.oblNote}>
                  {profile.taxWithholdingPct}% of what you'll be taxed on
                </Text>
              </View>
              <Text style={S.oblAmount}>{fmt(estimatedIncomeTax)}</Text>
            </View>

            {/* Mileage deduction */}
            {mileageDeduction > 0 && (
              <View style={[S.oblRow, S.oblSep]}>
                <View style={S.oblLeft}>
                  <Text style={S.oblLabel}>Mileage Tax Savings</Text>
                  <Text style={S.oblNote}>
                    Based on the {totalDistance.toFixed(0)}{" "}
                    {distanceUnit === "mi" ? "mi" : "km"} you drove — not tied to
                    any expenses you've logged
                  </Text>
                </View>
                <Text style={[S.oblAmount, { color: accentColor }]}>
                  −{fmt(mileageDeduction)}
                </Text>
              </View>
            )}
          </View>

          {/* Total row */}
          <View style={S.oblTotal}>
            <Text style={S.oblTotalLabel}>Total Estimated Tax</Text>
            <Text style={[S.oblAmount, { color: "#f59e0b", fontSize: 14 }]}>
              {fmt(totalObligations)}
            </Text>
          </View>
        </View>

        {/* ── HST Tracker — CA registered only ── */}
        {profile.country === "CA" && profile.hstRegistered && (
          <View style={S.card}>
            <Text style={S.cardLabel}>SALES TAX (HST) TRACKER</Text>
            <View style={{ marginTop: 14 }}>
              <View style={S.oblRow}>
                <View style={S.oblLeft}>
                  <Text style={S.oblLabel}>Sales Tax You Collected</Text>
                  <Text style={S.oblNote}>
                    Doesn't include tax the platform already collected for you
                  </Text>
                </View>
                <Text style={S.oblAmount}>
                  {fmt(summary?.hstCollected || 0)}
                </Text>
              </View>
              <View style={[S.oblRow, S.oblSep]}>
                <View style={S.oblLeft}>
                  <Text style={S.oblLabel}>Sales Tax You Can Claim Back</Text>
                  <Text style={S.oblNote}>
                    Tax you paid on your business expenses
                  </Text>
                </View>
                <Text style={[S.oblAmount, { color: "#f87171" }]}>
                  −{fmt(summary?.itcTotal || 0)}
                </Text>
              </View>
              <View style={[S.oblRow, S.oblSep]}>
                <View style={S.oblLeft}>
                  <Text style={S.oblLabel}>What You Owe the Tax Office</Text>
                  <Text style={S.oblNote}>For this filing period</Text>
                </View>
                <Text style={[S.oblAmount, { color: "#f59e0b" }]}>
                  {fmt(summary?.hstRemittable || 0)}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* ── Quarterly run-rate ── */}
        {quarterlyProjection && (
          <View style={S.card}>
            <Text style={S.cardLabel}>
              Q{quarterlyProjection.currentQuarter} ESTIMATE FOR THE YEAR
            </Text>
            {quarterlyProjection.isLimitedData && (
              <View style={S.warnStrip}>
                <Text style={S.warnText}>
                  ⚠ Based on just {quarterlyProjection.dayOfYear} days of data —
                  this might not be accurate yet
                </Text>
              </View>
            )}
            <View style={{ marginTop: 14 }}>
              <View style={S.oblRow}>
                <View style={S.oblLeft}>
                  <Text style={S.oblLabel}>Estimated Yearly Earnings</Text>
                </View>
                <Text style={S.oblAmount}>
                  {fmt(quarterlyProjection.projectedAnnualGross)}
                </Text>
              </View>
              <View style={[S.oblRow, S.oblSep]}>
                <View style={S.oblLeft}>
                  <Text style={S.oblLabel}>Estimated Yearly Take-Home</Text>
                </View>
                <Text style={S.oblAmount}>
                  {fmt(quarterlyProjection.projectedAnnualNet)}
                </Text>
              </View>
              <View style={[S.oblRow, S.oblSep]}>
                <View style={S.oblLeft}>
                  <Text style={[S.oblLabel, { color: accentColor }]}>
                    Suggested {quarterlyProjection.nextInstallmentLabel} Payment
                  </Text>
                  <Text style={S.oblNote}>About a quarter of your yearly tax</Text>
                </View>
                <Text
                  style={[S.oblAmount, { color: accentColor, fontSize: 14 }]}
                >
                  {fmt(quarterlyProjection.nextInstallmentAmount)}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* ── Installment deadlines ── */}
        <View style={S.card}>
          <Text style={S.cardLabel}>UPCOMING TAX PAYMENT DATES</Text>
          <View style={{ marginTop: 14 }}>
            {deadlines.map((d, idx) => {
              const overdue = d.daysUntil < 0;
              const urgent = !overdue && d.daysUntil <= 14;
              const accentHex = overdue
                ? "#FF5247"
                : urgent
                ? "#f59e0b"
                : "#2E2E36";
              return (
                <View
                  key={idx}
                  style={[
                    S.deadlineRow,
                    idx > 0 && {
                      borderTopWidth: 0.5,
                      borderTopColor: "#1E1E23",
                    },
                  ]}
                >
                  <View
                    style={[
                      S.deadlineIcon,
                      { borderColor: accentHex + "44" },
                    ]}
                  >
                    <Clock size={14} color={accentHex} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={S.oblLabel}>{d.label}</Text>
                    <Text style={S.oblNote}>
                      {d.date.toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </Text>
                  </View>
                  <View
                    style={[
                      S.daysPill,
                      {
                        borderColor: accentHex + "33",
                        backgroundColor: accentHex + "0D",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        S.daysPillText,
                        {
                          color: overdue
                            ? "#FF5247"
                            : urgent
                            ? "#f59e0b"
                            : "#65656E",
                        },
                      ]}
                    >
                      {overdue ? "OVERDUE" : `${d.daysUntil}d`}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* ── Export ── */}
        <View style={S.card}>
          <Text style={S.cardLabel}>EXPORT TAX SUMMARY</Text>
          <View style={S.exportRow}>
            <ScalePressable
              onPress={() => handleExport("json")}
              style={S.exportBtn}
            >
              <Download size={13} color={accentColor} />
              <Text style={[S.exportBtnText, { color: accentColor }]}>
                JSON
              </Text>
            </ScalePressable>
            <ScalePressable
              onPress={() => handleExport("csv")}
              style={S.exportBtn}
            >
              <Download size={13} color={accentColor} />
              <Text style={[S.exportBtnText, { color: accentColor }]}>
                CSV
              </Text>
            </ScalePressable>
          </View>
        </View>

        <Text style={S.disclaimer}>
          These are rough estimates using flat rates — they don't account for
          tax brackets or credits. Talk to a tax professional before filing.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles — matches tax/index.tsx design tokens ────────────────────────────

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  loader: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: { padding: 16, paddingTop: 8, gap: 10, paddingBottom: 60 },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#000",
    borderBottomWidth: 0.5,
    borderBottomColor: "#1E1E23",
  },
  headerTitle: {
    fontSize: 18,
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
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#16161A",
    borderWidth: 0.8,
    borderColor: "#1C1C21",
    alignItems: "center",
    justifyContent: "center",
  },

  // Year selector
  yearPicker: {
    flexDirection: "row",
    gap: 4,
    backgroundColor: "#0F0F12",
    borderRadius: 12,
    borderWidth: 0.8,
    borderColor: "#1E1E23",
    padding: 3,
  },
  yearChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 0.8,
    alignItems: "center",
    justifyContent: "center",
  },
  yearChipInactive: {
    borderColor: "transparent",
    backgroundColor: "transparent",
  },
  yearChipText: { fontSize: 11, fontWeight: "800" },

  // Cards
  card: {
    backgroundColor: "#0F0F12",
    borderWidth: 0.8,
    borderColor: "#1E1E23",
    borderRadius: 20,
    padding: 18,
  },
  cardLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#65656E",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  twoCol: { flexDirection: "row", gap: 10 },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },

  // Typography
  heroAmount: {
    fontSize: 26,
    fontWeight: "900",
    color: "#F6F6F7",
  },
  medAmount: {
    fontSize: 16,
    fontWeight: "900",
    color: "#F6F6F7",
  },
  mutedValue: {
    fontSize: 13,
    fontWeight: "700",
    color: "#9B9BA4",
  },
  miniNote: {
    fontSize: 10,
    fontWeight: "600",
    color: "#2E2E36",
    marginTop: 4,
  },

  // Jar
  jarStats: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
  progressTrack: {
    height: 5,
    backgroundColor: "#1E1E23",
    borderRadius: 3,
    marginTop: 12,
  },
  progressFill: { height: 5, borderRadius: 3 },
  progressLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#65656E",
    marginTop: 6,
  },
  jarAdjust: {
    flexDirection: "row",
    gap: 8,
    marginTop: 16,
  },
  adjustBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 0.8,
    alignItems: "center",
    justifyContent: "center",
  },
  adjustBtnText: { fontSize: 13, fontWeight: "800" },

  // Obligation rows
  oblRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
  },
  oblSep: {
    borderTopWidth: 0.5,
    borderTopColor: "#1E1E23",
  },
  oblLeft: { flex: 1, paddingRight: 12 },
  oblLabel: { fontSize: 12, fontWeight: "700", color: "#F6F6F7" },
  oblNote: {
    fontSize: 10,
    fontWeight: "600",
    color: "#65656E",
    marginTop: 2,
  },
  oblAmount: { fontSize: 13, fontWeight: "800", color: "#F6F6F7" },
  oblTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 0.8,
    borderColor: "rgba(245,158,11,0.2)",
    backgroundColor: "rgba(245,158,11,0.05)",
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 8,
  },
  oblTotalLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: "#f59e0b",
  },

  // Warn strip
  warnStrip: {
    backgroundColor: "rgba(245,158,11,0.06)",
    borderWidth: 0.8,
    borderColor: "rgba(245,158,11,0.18)",
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
  },
  warnText: { fontSize: 10, fontWeight: "600", color: "#9B9BA4" },

  // Deadlines
  deadlineRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
  },
  deadlineIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 0.8,
    backgroundColor: "#16161A",
    alignItems: "center",
    justifyContent: "center",
  },
  daysPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 0.8,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 44,
  },
  daysPillText: { fontSize: 10, fontWeight: "800" },

  // Export
  exportRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  exportBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: "#16161A",
    borderWidth: 0.8,
    borderColor: "#1C1C21",
  },
  exportBtnText: { fontSize: 12, fontWeight: "800" },

  // Empty state
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(16,185,129,0.08)",
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(16,185,129,0.25)",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 12,
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
    marginTop: 6,
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
});
