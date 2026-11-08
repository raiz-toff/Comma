import React, { useState, useMemo, useEffect, useRef } from "react";
import { ScrollView, View, ActivityIndicator, Platform, Pressable, Modal, StyleSheet } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import Svg, { Path } from "react-native-svg";
import { Text } from "@/src/components/ui/text";
import { useColors } from "@/src/theme/useColors";
import { getPeriodStats, getEarningsByPlatform, getNetIncome } from "@/src/database/queries/analytics";
import { getPlatformDef } from "@/src/registry/platforms/index";
import { useSettingsStore } from "@/store/useSettingsStore";
import { DEMO_STRIP_HEIGHT } from "@/src/components/GlobalTopHeader";
import { usePlatformTheme } from "@/src/hooks/usePlatformTheme";
import { useLayout } from "@/src/hooks/useLayout";

type PeriodType = "week" | "month" | "year";

function getPeriodDates(type: PeriodType, offset: number, weekStartDay: number = 0) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  if (type === "week") {
    const day = start.getDay();
    const diff = start.getDate() - day + (day < weekStartDay ? -7 : 0) + weekStartDay;
    start.setDate(diff + offset * 7);
    end.setTime(start.getTime() + 6 * 24 * 60 * 60 * 1000);
    end.setHours(23, 59, 59, 999);
  } else if (type === "month") {
    start.setFullYear(start.getFullYear(), start.getMonth() + offset, 1);
    end.setFullYear(start.getFullYear(), start.getMonth() + 1, 0);
    end.setHours(23, 59, 59, 999);
  } else {
    start.setFullYear(start.getFullYear() + offset, 0, 1);
    end.setFullYear(start.getFullYear() + offset, 11, 31);
    end.setHours(23, 59, 59, 999);
  }

  return { start, end };
}

function currencyCode(country?: string) {
  return country === "CA" ? "CAD" : "USD";
}

function formatMoney(value: number, country?: string) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: currencyCode(country), minimumFractionDigits: 2 }).format(value);
}

function formatMoneyParts(value: number, country?: string) {
  const parts = new Intl.NumberFormat("en-US", { style: "currency", currency: currencyCode(country) }).formatToParts(value);
  return {
    symbol: parts.find((p) => p.type === "currency")?.value || "$",
    value: parts.filter((p) => p.type !== "currency").map((p) => p.value).join(""),
  };
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const C = useColors();
  return (
    <View style={{ marginTop: 28 }}>
      <Text variant="labelXs" className="text-content-secondary" style={{ marginBottom: 4 }}>
        {title}
      </Text>
      <View style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.lineSubtle }}>{children}</View>
    </View>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  const C = useColors();
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "baseline",
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: C.lineSubtle,
      }}
    >
      <Text variant="paragraphM" className={strong ? undefined : "text-content-secondary"}>
        {label}
      </Text>
      <Text variant={strong ? "headingS" : "labelM"} tabular>
        {value}
      </Text>
    </View>
  );
}

export default function AnalyticsScreen() {
  const C = useColors();
  const { columnStyle } = useLayout();
  const insets = useSafeAreaInsets();
  const { profile, isOnboardingCompleted, activePlatformFilter, setHeaderVisible, isDemoMode } = useSettingsStore();
  const { accentColor, accentColorContrast } = usePlatformTheme();

  const [periodType, setPeriodType] = useState<PeriodType>("month");
  const [periodOffset, setPeriodOffset] = useState<number>(0);
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);

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

  const weekStartDay = profile?.locale?.weekStartDay ?? 0;
  const { start, end } = useMemo(() => getPeriodDates(periodType, periodOffset, weekStartDay), [periodType, periodOffset, weekStartDay]);
  const range = [start.toISOString(), end.toISOString(), activePlatformFilter];
  const enabled = isOnboardingCompleted;

  const { data: stats, isLoading } = useQuery({
    queryKey: ["analytics", "period-stats", ...range],
    queryFn: () => getPeriodStats(start, end, activePlatformFilter),
    enabled,
  });
  const { data: netIncome = 0 } = useQuery({
    queryKey: ["analytics", "net-income", ...range],
    queryFn: () => getNetIncome(start, end, activePlatformFilter),
    enabled,
  });
  const { data: platformData = [] } = useQuery({
    queryKey: ["analytics", "by-platform", ...range],
    queryFn: () => getEarningsByPlatform(start, end, activePlatformFilter),
    enabled,
  });

  const country = profile.country;
  const unit = profile.distanceUnit ?? "km";
  const earnings = (stats?.gross ?? 0) + (stats?.tips ?? 0) + (stats?.bonus ?? 0);
  const expenses = Math.max(0, earnings - netIncome);
  const onlineHrs = (stats?.durationSeconds ?? 0) / 3600;
  const activeHrs = Math.max(0, (stats?.durationSeconds ?? 0) - (stats?.pausedSeconds ?? 0)) / 3600;
  const activeDist = stats?.activeMileage ?? 0;
  const deadDist = stats?.deadMileage ?? 0;
  const totalDist = activeDist + deadDist;
  const perHour = (amount: number, hrs: number) => (hrs > 0 ? `${formatMoney(amount / hrs, country)}/hr` : "—");

  const periodLabel =
    periodType === "week"
      ? `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${end.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
      : periodType === "month"
        ? start.toLocaleDateString("en-US", { month: "long", year: "numeric" })
        : start.getFullYear().toString();

  const navButton = { width: 44, height: 44, borderRadius: 22, backgroundColor: C.surface03, borderWidth: StyleSheet.hairlineWidth, borderColor: C.lineSubtle, alignItems: "center", justifyContent: "center" } as const;
  const net = formatMoneyParts(netIncome, country);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.background }} edges={["bottom", "left", "right"]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[{ paddingBottom: 32, paddingTop: insets.top + 64 + (isDemoMode ? DEMO_STRIP_HEIGHT : 0) }, columnStyle]}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {/* Period picker + net headline */}
        <View style={{ alignItems: "center", marginVertical: 20, gap: 8 }}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setIsSelectorOpen(true)}
            style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.surface03, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, borderColor: C.lineSubtle }}
          >
            <Text variant="labelXs" className="text-content-secondary">{periodLabel}</Text>
            <Svg width={10} height={6} viewBox="0 0 10 6" fill="none">
              <Path d="M1 1L5 5L9 1" stroke={C.contentSecondary} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </Pressable>

          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", width: "100%", paddingHorizontal: 24 }}>
            <Pressable accessibilityRole="button" accessibilityLabel="Previous period" onPress={() => setPeriodOffset((o) => o - 1)} style={navButton}>
              <ChevronLeft color={C.contentPrimary} />
            </Pressable>

            <View style={{ alignItems: "center", flexShrink: 1, minWidth: 0 }}>
              <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
                <Text style={{ fontSize: 24, fontWeight: "600", color: C.contentPrimary, lineHeight: 30, marginTop: 10, marginRight: 4 }}>{net.symbol}</Text>
                <Text tabular style={{ flexShrink: 1, fontSize: 40, fontWeight: "800", color: C.contentPrimary, letterSpacing: -0.5, lineHeight: 48, paddingVertical: 2, includeFontPadding: false }} numberOfLines={1} adjustsFontSizeToFit>
                  {net.value}
                </Text>
              </View>
              <Text variant="labelXs" className="text-content-secondary">Net after expenses</Text>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Next period"
              accessibilityState={{ disabled: periodOffset >= 0 }}
              onPress={() => setPeriodOffset((o) => o + 1)}
              disabled={periodOffset >= 0}
              style={[navButton, periodOffset >= 0 && { opacity: 0.35 }]}
            >
              <ChevronRight color={periodOffset >= 0 ? C.contentDisabled : C.contentPrimary} />
            </Pressable>
          </View>
        </View>

        {isLoading ? (
          <View style={{ alignItems: "center", paddingVertical: 40 }}>
            <ActivityIndicator size="large" color={accentColor} />
          </View>
        ) : (
          <View style={{ paddingHorizontal: 20 }}>
            <Section title="Money">
              <Row label="Earnings" value={formatMoney(earnings, country)} />
              <Row label="Tips" value={formatMoney(stats?.tips ?? 0, country)} />
              <Row label="Expenses" value={`− ${formatMoney(expenses, country)}`} />
              <Row label="Net" value={formatMoney(netIncome, country)} strong />
            </Section>

            <Section title="Time">
              <Row label="Shifts" value={String(stats?.count ?? 0)} />
              <Row label="Hours online" value={`${onlineHrs.toFixed(1)} hrs`} />
              <Row label="Hours active" value={`${activeHrs.toFixed(1)} hrs`} />
              <Row label="Earnings per online hour" value={perHour(earnings, onlineHrs)} />
              <Row label="Net per online hour" value={perHour(netIncome, onlineHrs)} strong />
            </Section>

            <Section title="Distance">
              <Row label={`Active ${unit}`} value={activeDist.toFixed(1)} />
              <Row label={`Dead ${unit}`} value={deadDist.toFixed(1)} />
              <Row label="Dead share" value={totalDist > 0 ? `${((deadDist / totalDist) * 100).toFixed(0)}%` : "—"} />
            </Section>

            {platformData.length > 1 && (
              <Section title="By platform">
                {platformData.map((p) => (
                  <Row key={p.platform} label={getPlatformDef(p.platform)?.label ?? p.platform} value={formatMoney(p.total, country)} />
                ))}
              </Section>
            )}
          </View>
        )}
      </ScrollView>

      {/* Period selector */}
      <Modal visible={isSelectorOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setIsSelectorOpen(false)}>
        <View style={{ flex: 1, backgroundColor: C.background }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.lineSubtle, paddingTop: Platform.OS === "ios" ? 16 : insets.top + 16 }}>
            <Text variant="headingM">Time Period</Text>
            <Pressable accessibilityRole="button" onPress={() => setIsSelectorOpen(false)}>
              <Text variant="labelM" style={{ color: accentColor }}>Done</Text>
            </Pressable>
          </View>

          <View style={{ paddingHorizontal: 16, paddingTop: 20 }}>
            <View style={{ flexDirection: "row", backgroundColor: C.surface02, borderRadius: 12, padding: 4, borderWidth: 1, borderColor: C.lineSubtle }}>
              {(["week", "month", "year"] as const).map((type) => {
                const isActive = periodType === type;
                return (
                  <Pressable
                    key={type}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isActive }}
                    onPress={() => { setPeriodType(type); setPeriodOffset(0); setIsSelectorOpen(false); }}
                    style={{ flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: isActive ? accentColor : "transparent", alignItems: "center" }}
                  >
                    <Text variant="labelM" style={{ color: isActive ? accentColorContrast : C.contentSecondary, textTransform: "capitalize" }}>{type}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
