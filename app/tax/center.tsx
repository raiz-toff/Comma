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
import { Card } from "@/src/components/ui/card";
import { withAlpha } from "@/src/theme/colors";
import { useColors, useThemedStyles, type Palette } from "@/src/theme/useColors";
import { useLayout } from "@/src/hooks/useLayout";
import { useSettingsStore } from "@/store/useSettingsStore";
import { usePlatformTheme } from "@/src/hooks/usePlatformTheme";
import { notifyExport } from "@/src/services/notify";
import { db } from "@/src/database/client";
import { shifts, expenses, settings } from "@/src/database/schema";
import { and, gte, lte, eq } from "drizzle-orm";
import {
  calculatePensionContributions,
  calculateSelfEmploymentTax,
  calculateIRSMileageDeduction,
  calculateHMRCMileageDeduction,
  calculateHSTOwing,
  calculateUKNationalInsurance,
  projectQuarterlyInstallment,
} from "@/utils/taxCalculations";
import { calculateMileageWriteOffForBreakdown } from "@/src/database/queries/taxProfiles";
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
  ...rest
}: {
  onPress: () => void;
  style?: object | object[];
  children: React.ReactNode;
} & Omit<React.ComponentProps<typeof Pressable>, "onPress" | "style" | "children">) {
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
      {...rest}
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
  /** Vehicle-aware write-off (CA/US only — each vehicle's own rate applied to only its own
   * mileage, then summed); 0 for other countries, where the component still resolves it
   * itself via the flat HMRC/preset-rate calculators. */
  vehicleMileageDeduction: number;
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
  // vehicleId -> { activeMileage, deadMileage }, for a mileage write-off that resolves each
  // vehicle's own rate/eligibility instead of applying one vehicle's rate to every mile driven.
  const mileageByVehicle = new Map<string | null, { activeMileage: number; deadMileage: number }>();

  rawShifts.forEach((s: any) => {
    gross += Number(s.grossRevenue || 0);
    tips += Number(s.tipsRevenue || 0);
    bonus += Number(s.bonusAmount || 0);
    const active = Number(s.activeMileage || s.trackedMileage || 0);
    const dead = Number(s.deadMileage || 0);
    distanceKm += active + dead;
    activeMileage += active;
    deadMileage += dead;

    const vehicleId = s.vehicleId ?? null;
    const row = mileageByVehicle.get(vehicleId) ?? { activeMileage: 0, deadMileage: 0 };
    row.activeMileage += active;
    row.deadMileage += dead;
    mileageByVehicle.set(vehicleId, row);
  });

  // Only count a vehicle-tagged expense (fuel, insurance, ...) if that vehicle was actually
  // driven this year — otherwise a car expense gets deducted from a bike-only year's earnings.
  // General expenses (no vehicleId) always count.
  const vehicleIdsUsed = new Set(rawShifts.map((s: any) => s.vehicleId).filter(Boolean));
  let totalExpenses = 0;
  rawExpenses.forEach((e: any) => {
    // Apply each expense's business-use percentage, consistent with the Tax/Analytics queries.
    if (e.isDeductible && (!e.vehicleId || vehicleIdsUsed.has(e.vehicleId))) {
      totalExpenses += Number(e.amount || 0) * Number(e.deductiblePct ?? 100) / 100;
    }
  });

  const vehicleMileageDeduction =
    country === "CA" || country === "US"
      ? (
          await calculateMileageWriteOffForBreakdown(
            Array.from(mileageByVehicle.entries()).map(([vehicleId, m]) => ({ vehicleId, ...m })),
            year,
            country
          )
        ).writeOff
      : 0;

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
    vehicleMileageDeduction,
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
  const C = useColors();
  const S = useThemedStyles(makeStyles);
  // Above the `isLoading` and `hasSelfAssessmentTax` early returns below — a hook
  // called after them would not run on every render.
  const { columnStyle } = useLayout();
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

  // CA/US: each vehicle's own eligibility/rate applied to only the mileage it drove, then
  // summed — computed in fetchTaxSummary, which has the per-shift vehicleId to group by
  // (see vehicleMileageDeduction). UK/other still use a flat rate on total distance.
  const mileageDeduction =
    profile.country === "CA" || profile.country === "US"
      ? summary?.vehicleMileageDeduction ?? 0
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
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={8}
            style={S.backBtn}
          >
            <ArrowLeft size={16} color={C.contentSecondary} />
          </Pressable>
          <Text variant="headingM" style={{ marginLeft: 12 }}>Tax Center</Text>
        </View>
        <View style={[S.loader, { padding: 24 }]}>
          <Card>
            <View style={S.emptyIcon}>
              <Calculator size={24} color={accentColor} />
            </View>
            <Text variant="labelL" style={S.emptyTitle}>No Self-Assessment Required</Text>
            <Text variant="paragraphM" style={S.emptyBody}>
              In {countryDef.label}, gig platform earnings are handled directly
              by platforms. Independent self-assessment is not required.
            </Text>
          </Card>
        </View>
      </SafeAreaView>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={S.root}>
      {/*
        Header. It sits OUTSIDE the ScrollView, so it takes the same cap as the content —
        otherwise on a tablet the back button and the year picker are pushed to opposite
        edges of the screen while the cards they head sit centred between them.
        `columnStyle` is undefined below 600pt, so this changes nothing on a phone.
      */}
      <View style={[S.header, columnStyle]}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={8}
          style={S.backBtn}
        >
          <ArrowLeft size={16} color={C.contentSecondary} />
        </Pressable>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text variant="headingM">Tax Center</Text>
          <Text variant="paragraphS" style={S.headerSub}>Full breakdown · {selectedYear}</Text>
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
                accessibilityRole="button"
                accessibilityLabel={`Show ${year}`}
                accessibilityState={{ selected: active }}
                style={[
                  S.yearChip,
                  active
                    ? { backgroundColor: accentColor, borderColor: accentColor }
                    : S.yearChipInactive,
                ]}
              >
                <Text
                  variant="labelXs"
                  tabular
                  style={{ color: active ? accentColorContrast : C.contentSecondary }}
                >
                  {year}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[S.scroll, columnStyle]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Virtual Tax Jar ── */}
        <Card>
          <Text variant="labelXs" className="text-content-muted">TAX SAVINGS JAR</Text>
          <Text variant="headingXl" tabular style={{ color: accentColor, marginTop: 8 }}>
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
            <Text variant="paragraphS" tabular style={S.progressLabel}>
              {jarCoveragePct.toFixed(0)}% covered
            </Text>
            <Text variant="paragraphS" tabular style={S.progressLabel}>
              Target: {fmt(targetSetAside)}
            </Text>
          </View>

          {/* Quick adjust */}
          <View style={S.jarAdjust}>
            {([-25, -10, 10, 25] as const).map((amt) => (
              <ScalePressable
                key={amt}
                onPress={() => handleAdjustJar(amt)}
                accessibilityRole="button"
                accessibilityLabel={
                  amt < 0 ? `Remove $${-amt} from tax jar` : `Add $${amt} to tax jar`
                }
                style={[
                  S.adjustBtn,
                  amt < 0
                    ? {
                        borderColor: withAlpha(C.destructive, 0.3),
                        backgroundColor: withAlpha(C.destructive, 0.06),
                      }
                    : {
                        borderColor: withAlpha(C.success, 0.3),
                        backgroundColor: withAlpha(C.success, 0.06),
                      },
                ]}
              >
                <Text
                  variant="labelM"
                  tabular
                  style={{ color: amt < 0 ? C.destructive : accentColor }}
                >
                  {amt > 0 ? `+${amt}` : amt}
                </Text>
              </ScalePressable>
            ))}
          </View>
        </Card>

        {/* ── Income snapshot ── */}
        <View style={S.twoCol}>
          <Card className="flex-1">
            <Text variant="labelXs" className="text-content-muted">TOTAL EARNINGS</Text>
            <Text variant="headingS" tabular style={{ marginTop: 8 }}>
              {fmt(summary?.gross || 0)}
            </Text>
            <Text variant="paragraphS" style={S.miniNote}>Pay + tips + bonuses</Text>
          </Card>
          <Card className="flex-1">
            <Text variant="labelXs" className="text-content-muted">EXPENSES</Text>
            <Text variant="headingS" tabular style={{ marginTop: 8, color: C.destructive }}>
              {fmt(summary?.businessExpenses || 0)}
            </Text>
            <Text variant="paragraphS" style={S.miniNote}>Money you spent to do the work</Text>
          </Card>
        </View>

        {/* ── Net income ── */}
        <Card>
          <View style={S.rowBetween}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text variant="labelXs" className="text-content-muted">WHAT YOU'LL BE TAXED ON</Text>
              <Text
                variant="headingXl"
                tabular
                style={{ color: accentColor, marginTop: 8 }}
              >
                {fmt(netIncome)}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text variant="labelXs" className="text-content-muted">YOURS TO KEEP</Text>
              <Text variant="labelM" tabular style={[S.mutedValue, { marginTop: 6 }]}>
                {fmt(Math.max(0, netIncome - targetSetAside))}
              </Text>
              <Text variant="paragraphS" style={[S.miniNote, { marginTop: 2, textAlign: "right" }]}>
                after setting aside for taxes
              </Text>
            </View>
          </View>
        </Card>

        {/* ── Estimated obligations ── */}
        <Card>
          <Text variant="labelXs" className="text-content-muted">
            ESTIMATED TAXES YOU OWE · {selectedYear}
          </Text>

          <View style={{ marginTop: 14 }}>
            {/* CPP/QPP — Canada */}
            {profile.country === "CA" && (
              <>
                <View style={S.oblRow}>
                  <View style={S.oblLeft}>
                    <Text variant="labelM">
                      {pensionResult.planType === "QPP"
                        ? "Quebec Pension Plan"
                        : "Canada Pension Plan"}
                    </Text>
                    <Text variant="paragraphS" style={S.oblNote}>
                      Required for self-employed workers ·{" "}
                      {pensionResult.planType === "QPP" ? "12.8%" : "11.9%"} of income
                    </Text>
                  </View>
                  <Text variant="labelM" tabular>
                    {fmt(pensionResult.cpp1Total)}
                  </Text>
                </View>
                {pensionResult.cpp2Total > 0 && (
                  <View style={[S.oblRow, S.oblSep]}>
                    <View style={S.oblLeft}>
                      <Text variant="labelM">
                        {pensionResult.planType === "QPP"
                          ? "Quebec Pension Plan — extra"
                          : "Canada Pension Plan — extra"}
                      </Text>
                      <Text variant="paragraphS" style={S.oblNote}>
                        8% more on your higher earnings
                      </Text>
                    </View>
                    <Text variant="labelM" tabular>
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
                  <Text variant="labelM">Self-Employment Tax</Text>
                  <Text variant="paragraphS" style={S.oblNote}>
                    Covers Social Security & Medicare
                  </Text>
                </View>
                <Text variant="labelM" tabular>{fmt(seTaxEstimate)}</Text>
              </View>
            )}

            {/* State income tax — USA */}
            {stateIncomeTax > 0 && (
              <View style={[S.oblRow, S.oblSep]}>
                <View style={S.oblLeft}>
                  <Text variant="labelM">
                    {profile.taxRegion} State Tax
                  </Text>
                  <Text variant="paragraphS" style={S.oblNote}>Rough estimate for your state</Text>
                </View>
                <Text variant="labelM" tabular>{fmt(stateIncomeTax)}</Text>
              </View>
            )}

            {/* UK National Insurance */}
            {ukNI && (
              <>
                <View style={S.oblRow}>
                  <View style={S.oblLeft}>
                    <Text variant="labelM">National Insurance</Text>
                    <Text variant="paragraphS" style={S.oblNote}>
                      {ukNI.isExemptClass2
                        ? "Exempt (below threshold)"
                        : "£3.45/week flat rate"}
                    </Text>
                  </View>
                  <Text variant="labelM" tabular>{fmt(ukNI.class2Annual)}</Text>
                </View>
                {ukNI.class4 > 0 && (
                  <View style={[S.oblRow, S.oblSep]}>
                    <View style={S.oblLeft}>
                      <Text variant="labelM">National Insurance — extra</Text>
                      <Text variant="paragraphS" style={S.oblNote}>
                        9% of profit between £12,570–£50,270
                      </Text>
                    </View>
                    <Text variant="labelM" tabular>{fmt(ukNI.class4)}</Text>
                  </View>
                )}
              </>
            )}

            {/* Income tax reserve */}
            <View style={[S.oblRow, S.oblSep]}>
              <View style={S.oblLeft}>
                <Text variant="labelM">Income Tax</Text>
                <Text variant="paragraphS" style={S.oblNote}>
                  {profile.taxWithholdingPct}% of what you'll be taxed on
                </Text>
              </View>
              <Text variant="labelM" tabular>{fmt(estimatedIncomeTax)}</Text>
            </View>

            {/* Mileage deduction */}
            {mileageDeduction > 0 && (
              <View style={[S.oblRow, S.oblSep]}>
                <View style={S.oblLeft}>
                  <Text variant="labelM">Mileage Tax Savings</Text>
                  <Text variant="paragraphS" style={S.oblNote}>
                    Based on the {totalDistance.toFixed(0)}{" "}
                    {distanceUnit === "mi" ? "mi" : "km"} you drove — not tied to
                    any expenses you've logged
                  </Text>
                </View>
                <Text variant="labelM" tabular style={{ color: accentColor }}>
                  −{fmt(mileageDeduction)}
                </Text>
              </View>
            )}
          </View>

          {/* Total row */}
          <View style={S.oblTotal}>
            <Text variant="labelM" style={S.oblTotalLabel}>Total Estimated Tax</Text>
            <Text variant="labelM" tabular style={{ color: C.warning }}>
              {fmt(totalObligations)}
            </Text>
          </View>
        </Card>

        {/* ── HST Tracker — CA registered only ── */}
        {profile.country === "CA" && profile.hstRegistered && (
          <Card>
            <Text variant="labelXs" className="text-content-muted">SALES TAX (HST) TRACKER</Text>
            <View style={{ marginTop: 14 }}>
              <View style={S.oblRow}>
                <View style={S.oblLeft}>
                  <Text variant="labelM">Sales Tax You Collected</Text>
                  <Text variant="paragraphS" style={S.oblNote}>
                    Doesn't include tax the platform already collected for you
                  </Text>
                </View>
                <Text variant="labelM" tabular>
                  {fmt(summary?.hstCollected || 0)}
                </Text>
              </View>
              <View style={[S.oblRow, S.oblSep]}>
                <View style={S.oblLeft}>
                  <Text variant="labelM">Sales Tax You Can Claim Back</Text>
                  <Text variant="paragraphS" style={S.oblNote}>
                    Tax you paid on your business expenses
                  </Text>
                </View>
                <Text variant="labelM" tabular style={{ color: C.destructive }}>
                  −{fmt(summary?.itcTotal || 0)}
                </Text>
              </View>
              <View style={[S.oblRow, S.oblSep]}>
                <View style={S.oblLeft}>
                  <Text variant="labelM">What You Owe the Tax Office</Text>
                  <Text variant="paragraphS" style={S.oblNote}>For this filing period</Text>
                </View>
                <Text variant="labelM" tabular style={{ color: C.warning }}>
                  {fmt(summary?.hstRemittable || 0)}
                </Text>
              </View>
            </View>
          </Card>
        )}

        {/* ── Quarterly run-rate ── */}
        {quarterlyProjection && (
          <Card>
            <Text variant="labelXs" className="text-content-muted">
              Q{quarterlyProjection.currentQuarter} ESTIMATE FOR THE YEAR
            </Text>
            {quarterlyProjection.isLimitedData && (
              <View style={S.warnStrip}>
                <Text variant="paragraphS" style={S.warnText}>
                  ⚠ Based on just {quarterlyProjection.dayOfYear} days of data —
                  this might not be accurate yet
                </Text>
              </View>
            )}
            <View style={{ marginTop: 14 }}>
              <View style={S.oblRow}>
                <View style={S.oblLeft}>
                  <Text variant="labelM">Estimated Yearly Earnings</Text>
                </View>
                <Text variant="labelM" tabular>
                  {fmt(quarterlyProjection.projectedAnnualGross)}
                </Text>
              </View>
              <View style={[S.oblRow, S.oblSep]}>
                <View style={S.oblLeft}>
                  <Text variant="labelM">Estimated Yearly Take-Home</Text>
                </View>
                <Text variant="labelM" tabular>
                  {fmt(quarterlyProjection.projectedAnnualNet)}
                </Text>
              </View>
              <View style={[S.oblRow, S.oblSep]}>
                <View style={S.oblLeft}>
                  <Text variant="labelM" style={{ color: accentColor }}>
                    Suggested {quarterlyProjection.nextInstallmentLabel} Payment
                  </Text>
                  <Text variant="paragraphS" style={S.oblNote}>About a quarter of your yearly tax</Text>
                </View>
                <Text
                  variant="labelM"
                  tabular
                  style={{ color: accentColor }}
                >
                  {fmt(quarterlyProjection.nextInstallmentAmount)}
                </Text>
              </View>
            </View>
          </Card>
        )}

        {/* ── Installment deadlines ── */}
        <Card>
          <Text variant="labelXs" className="text-content-muted">UPCOMING TAX PAYMENT DATES</Text>
          <View style={{ marginTop: 14 }}>
            {deadlines.map((d, idx) => {
              const overdue = d.daysUntil < 0;
              const urgent = !overdue && d.daysUntil <= 14;
              const accentHex = overdue
                ? C.destructive
                : urgent
                ? C.warning
                : C.contentMuted;
              return (
                <View
                  key={idx}
                  style={[
                    S.deadlineRow,
                    idx > 0 && {
                      borderTopWidth: 0.5,
                      borderTopColor: C.lineSubtle,
                    },
                  ]}
                >
                  <View
                    style={[
                      S.deadlineIcon,
                      { borderColor: withAlpha(accentHex, 0.27) },
                    ]}
                  >
                    <Clock size={14} color={accentHex} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text variant="labelM">{d.label}</Text>
                    <Text variant="paragraphS" style={S.oblNote}>
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
                        borderColor: withAlpha(accentHex, 0.2),
                        backgroundColor: withAlpha(accentHex, 0.05),
                      },
                    ]}
                  >
                    <Text
                      tabular
                      style={[
                        S.daysPillText,
                        {
                          color: overdue
                            ? C.destructive
                            : urgent
                            ? C.warning
                            : C.contentMuted,
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
        </Card>

        {/* ── Export ── */}
        <Card>
          <Text variant="labelXs" className="text-content-muted">EXPORT TAX SUMMARY</Text>
          <View style={S.exportRow}>
            <ScalePressable
              onPress={() => handleExport("json")}
              accessibilityRole="button"
              accessibilityLabel="Export tax summary as JSON"
              style={S.exportBtn}
            >
              <Download size={13} color={accentColor} />
              <Text variant="labelM" style={{ color: accentColor }}>
                JSON
              </Text>
            </ScalePressable>
            <ScalePressable
              onPress={() => handleExport("csv")}
              accessibilityRole="button"
              accessibilityLabel="Export tax summary as CSV"
              style={S.exportBtn}
            >
              <Download size={13} color={accentColor} />
              <Text variant="labelM" style={{ color: accentColor }}>
                CSV
              </Text>
            </ScalePressable>
          </View>
        </Card>

        <Text variant="paragraphS" style={S.disclaimer}>
          These are rough estimates using flat rates — they don't account for
          tax brackets or credits. Talk to a tax professional before filing.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles — matches tax/index.tsx design tokens ────────────────────────────

const makeStyles = (C: Palette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  loader: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: { padding: 16, paddingTop: 8, gap: 10, paddingBottom: 60 },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: C.background,
    borderBottomWidth: 0.5,
    borderBottomColor: C.lineSubtle,
  },
  headerSub: { marginTop: 2 },
  backBtn: {
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

  // Year selector
  yearPicker: {
    flexDirection: "row",
    gap: 4,
    backgroundColor: C.surface02,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.lineSubtle,
    padding: 3,
  },
  yearChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  yearChipInactive: {
    borderColor: "transparent",
    backgroundColor: "transparent",
  },

  // Cards
  twoCol: { flexDirection: "row", gap: 10 },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },

  // Typography
  mutedValue: { color: C.contentSecondary },
  miniNote: { marginTop: 4 },

  // Jar
  jarStats: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
  progressTrack: {
    height: 5,
    backgroundColor: C.lineSubtle,
    // pill: ~height / 2
    borderRadius: 3,
    marginTop: 12,
  },
  progressFill: { height: 5, borderRadius: 3 },
  progressLabel: { marginTop: 6 },
  jarAdjust: {
    flexDirection: "row",
    gap: 8,
    marginTop: 16,
  },
  adjustBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },

  // Obligation rows
  oblRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
  },
  oblSep: {
    borderTopWidth: 0.5,
    borderTopColor: C.lineSubtle,
  },
  oblLeft: { flex: 1, paddingRight: 12 },
  oblNote: { marginTop: 2 },
  oblTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: withAlpha(C.warning, 0.2),
    backgroundColor: withAlpha(C.warning, 0.05),
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 8,
  },
  oblTotalLabel: { color: C.warning },

  // Warn strip
  warnStrip: {
    backgroundColor: withAlpha(C.warning, 0.06),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: withAlpha(C.warning, 0.18),
    borderRadius: 12,
    padding: 10,
    marginTop: 10,
  },
  warnText: { color: C.contentSecondary },

  // Deadlines
  deadlineRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
  },
  deadlineIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: C.surface03,
    alignItems: "center",
    justifyContent: "center",
  },
  daysPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 44,
  },
  // micro badge — labelXs would uppercase the "45d" copy, so size stays explicit
  daysPillText: { fontSize: 10, fontWeight: "800" },

  // Export
  exportRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  exportBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: C.surface03,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.lineSubtle,
  },

  // Empty state
  emptyIcon: {
    width: 48,
    height: 48,
    // circular: diameter / 2
    borderRadius: 24,
    backgroundColor: withAlpha(C.success, 0.08),
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: withAlpha(C.success, 0.25),
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 12,
  },
  emptyTitle: { textAlign: "center" },
  emptyBody: {
    textAlign: "center",
    marginTop: 6,
  },

  // Disclaimer
  disclaimer: {
    textAlign: "center",
    paddingHorizontal: 8,
    marginTop: 4,
  },
});
