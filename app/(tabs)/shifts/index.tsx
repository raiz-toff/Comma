import React, { useState } from "react";
import {
  View,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Platform,
  Modal,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Text } from "@/src/components/ui/text";
import { useSettingsStore } from "@/store/useSettingsStore";
import { usePlatformTheme } from "@/src/hooks/usePlatformTheme";
import { getShiftsPaginated } from "@/src/database/queries/shifts";
import { PLATFORMS, type PlatformKey } from "@/src/registry/platforms";
import { db } from "@/src/database/client";
import { settings } from "@/src/database/schema";
import { eq } from "drizzle-orm";
import Svg, { Path, Polyline, Circle, Line } from "react-native-svg";

// ─── Custom Icons ────────────────────────────────────────────────────────────
const ChevronLeft = ({ size = 22, color = "#fff" }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
    <Path d="m15 18-6-6 6-6" />
  </Svg>
);

const ChevronRight = ({ size = 22, color = "#fff" }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
    <Path d="m9 18 6-6-6-6" />
  </Svg>
);

const PlatformIcon = ({ id }: { id: string }) => {
  const cfg = PLATFORMS[id as PlatformKey];
  if (!cfg) return null;
  return (
    <View style={[styles.platIcon, { backgroundColor: cfg.color }]}>
      <Text style={[styles.platIconText, { color: cfg.textColor }]}>
        {cfg.label.slice(0, 1)}
      </Text>
    </View>
  );
};

// ─── Week calculations ────────────────────────────────────────────────────────
const getStartOfWeek = (d: Date, startDay: number): Date => {
  const date = new Date(d);
  const day = date.getDay();
  // Adjust so that we match the startDay (0 = Sunday, 1 = Monday)
  const delta = (day - startDay + 7) % 7;
  const start = new Date(date.setDate(date.getDate() - delta));
  start.setHours(0, 0, 0, 0);
  return start;
};

const formatWeekStr = (start: Date, end: Date): string => {
  const options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${start.toLocaleDateString("en-US", options)} – ${end.toLocaleDateString("en-US", options)}`;
};

const formatDayName = (dateStr: string | Date): string => {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
};

const RouteMinimap = ({ routePathJson, strokeColor }: { routePathJson: string; strokeColor: string }) => {
  const points = React.useMemo(() => {
    try {
      const parsed = JSON.parse(routePathJson);
      if (!Array.isArray(parsed) || parsed.length < 2) return null;
      return parsed as Array<{ latitude: number; longitude: number }>;
    } catch {
      return null;
    }
  }, [routePathJson]);

  if (!points) return null;

  const lats = points.map((p) => p.latitude);
  const lngs = points.map((p) => p.longitude);

  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  const latRange = maxLat - minLat || 0.001;
  const lngRange = maxLng - minLng || 0.001;

  const width = 100;
  const height = 60;
  const padding = 6;

  const svgPoints = points.map((p) => {
    const x = padding + ((p.longitude - minLng) / lngRange) * (width - 2 * padding);
    const y = padding + (1 - (p.latitude - minLat) / latRange) * (height - 2 * padding);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");

  const startPoint = points[0];
  const endPoint = points[points.length - 1];

  const startX = padding + ((startPoint.longitude - minLng) / lngRange) * (width - 2 * padding);
  const startY = padding + (1 - (startPoint.latitude - minLat) / latRange) * (height - 2 * padding);

  const endX = padding + ((endPoint.longitude - minLng) / lngRange) * (width - 2 * padding);
  const endY = padding + (1 - (endPoint.latitude - minLat) / latRange) * (height - 2 * padding);

  return (
    <View style={{ width: 100, height: 60, backgroundColor: "#090909", borderRadius: 8, borderWidth: 0.5, borderColor: "#1e1e1e", overflow: "hidden", marginLeft: 12 }}>
      <Svg width={width} height={height}>
        <Line x1="0" y1="20" x2="100" y2="20" stroke="#121212" strokeWidth="0.5" />
        <Line x1="0" y1="40" x2="100" y2="40" stroke="#121212" strokeWidth="0.5" />
        <Line x1="33" y1="0" x2="33" y2="60" stroke="#121212" strokeWidth="0.5" />
        <Line x1="66" y1="0" x2="66" y2="60" stroke="#121212" strokeWidth="0.5" />
        
        <Polyline
          points={svgPoints}
          fill="none"
          stroke={strokeColor}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <Circle cx={startX} cy={startY} r="3" fill="#10b981" />
        <Circle cx={endX} cy={endY} r="3.5" fill="#ef4444" stroke="#000" strokeWidth="0.8" />
      </Svg>
    </View>
  );
};

// ─── Component ───────────────────────────────────────────────────────────────
export default function ShiftsScreen() {
  const insets = useSafeAreaInsets();
  const { activePlatformFilter, profile } = useSettingsStore();
  const { platformColor } = usePlatformTheme();

  // Selected week tracker
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);
  const [isWeekSelectorOpen, setIsWeekSelectorOpen] = useState(false);

  // Selector Year and Page state
  const [selectorYear, setSelectorYear] = useState(() => selectedDate.getFullYear());
  const [selectorPage, setSelectorPage] = useState(0);

  // Sync selector states when opened
  React.useEffect(() => {
    if (isWeekSelectorOpen) {
      setSelectorYear(selectedDate.getFullYear());
      setSelectorPage(0);
    }
  }, [isWeekSelectorOpen, selectedDate]);

  // Fetch week start setting
  const { data: weekStartDaySetting = "0" } = useQuery({
    queryKey: ["settings", "week_start_day"],
    queryFn: async () => {
      if (Platform.OS === "web") {
        return localStorage.getItem("comma_setting_week_start_day") || "0";
      }
      const row = await db.select().from(settings).where(eq(settings.key, "week_start_day")).limit(1);
      return row[0]?.value || "0";
    },
  });

  const startDay = parseInt(weekStartDaySetting, 10);
  const weekStart = getStartOfWeek(selectedDate, startDay);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  const now = new Date();
  const currentWeekStart = getStartOfWeek(now, startDay);
  const isCurrentOrFutureWeek = weekStart.getTime() >= currentWeekStart.getTime();

  // 1-Week query for main shifts screen
  const { data: weeklyShifts = [], isLoading } = useQuery({
    queryKey: ["shifts", "weekly-uber", weekStart.toISOString(), activePlatformFilter],
    queryFn: async () => {
      const filters = {
        startDate: weekStart,
        endDate: weekEnd,
        platforms: activePlatformFilter && activePlatformFilter !== "all"
          ? activePlatformFilter.split(",")
          : undefined,
      };
      return getShiftsPaginated(1, filters);
    },
  });

  // Selector Year-to-Date Query (runs in parallel pages to get full year of data)
  const selectorYearStart = React.useMemo(() => new Date(selectorYear, 0, 1), [selectorYear]);
  const selectorYearEnd = React.useMemo(() => new Date(selectorYear, 11, 31, 23, 59, 59, 999), [selectorYear]);

  const { data: selectorYearShifts = [], isLoading: isYearShiftsLoading } = useQuery({
    queryKey: ["shifts", "year", selectorYear, activePlatformFilter],
    queryFn: async () => {
      const filters = {
        startDate: selectorYearStart,
        endDate: selectorYearEnd,
        platforms: activePlatformFilter && activePlatformFilter !== "all"
          ? activePlatformFilter.split(",")
          : undefined,
      };
      const pages = [1, 2, 3, 4, 5, 6, 7, 8];
      const results = await Promise.all(
        pages.map((p) => getShiftsPaginated(p, filters))
      );
      return results.flat();
    },
  });

  // Generate selector list of weeks for selectorYear (YTD if current year)
  const modalWeeksList = React.useMemo(() => {
    const now = new Date();
    // Limit to the current date (no future weeks)
    const endYearLimit = selectorYear === now.getFullYear()
      ? now
      : new Date(selectorYear, 11, 31);
      
    const startYearLimit = new Date(selectorYear, 0, 1);
    
    const startOfWeekLimit = getStartOfWeek(startYearLimit, startDay);
    const endOfWeekLimit = getStartOfWeek(endYearLimit, startDay);
    
    const diffTime = Math.abs(endOfWeekLimit.getTime() - startOfWeekLimit.getTime());
    const totalWeeks = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 7)) + 1;
    
    return Array.from({ length: totalWeeks }, (_, index) => {
      const wStart = new Date(endOfWeekLimit);
      wStart.setDate(endOfWeekLimit.getDate() - index * 7);
      
      const wEnd = new Date(wStart);
      wEnd.setDate(wStart.getDate() + 6);
      wEnd.setHours(23, 59, 59, 999);
      
      const wShifts = selectorYearShifts.filter((s) => {
        const sTime = new Date(s.startTime).getTime();
        return sTime >= wStart.getTime() && sTime <= wEnd.getTime();
      });
      
      const wTotal = wShifts.reduce((sum, s) => sum + (s.grossRevenue || 0) + (s.tipsRevenue || 0), 0);
      
      const daysData = Array.from({ length: 7 }, (_, i) => {
        const day = new Date(wStart);
        day.setDate(wStart.getDate() + i);
        const dayStr = day.toISOString().split("T")[0];
        
        const dayShifts = wShifts.filter((s) => {
          const sDateStr = new Date(s.startTime).toISOString().split("T")[0];
          return sDateStr === dayStr;
        });
        
        const dayTotal = dayShifts.reduce((sum, s) => sum + (s.grossRevenue || 0) + (s.tipsRevenue || 0), 0);
        return {
          total: dayTotal,
          dateNum: day.getDate(),
        };
      });
      
      const wMaxDayTotal = Math.max(...daysData.map((d) => d.total), 0);
      
      return {
        start: wStart,
        end: wEnd,
        total: wTotal,
        maxDay: wMaxDayTotal,
        days: daysData,
      };
    });
  }, [selectorYear, selectorYearShifts, startDay]);

  // Modal Pagination
  const WEEKS_PER_PAGE = 8;
  const totalPages = Math.max(Math.ceil(modalWeeksList.length / WEEKS_PER_PAGE), 1);
  
  const visibleWeeks = React.useMemo(() => {
    const startIdx = selectorPage * WEEKS_PER_PAGE;
    return modalWeeksList.slice(startIdx, startIdx + WEEKS_PER_PAGE);
  }, [modalWeeksList, selectorPage]);

  // Page navigation handlers
  const handleModalNextPage = () => {
    if (selectorPage < totalPages - 1) {
      setSelectorPage((p) => p + 1);
    } else {
      // Transition to previous year
      setSelectorYear((y) => y - 1);
      setSelectorPage(0);
    }
  };

  const handleModalPrevPage = () => {
    if (selectorPage > 0) {
      setSelectorPage((p) => p - 1);
    } else {
      // Transition to next year if not in future
      const currentRealYear = new Date().getFullYear();
      if (selectorYear < currentRealYear) {
        setSelectorYear((y) => y + 1);
        setSelectorPage(0);
      }
    }
  };

  // Navigate weeks
  const handlePrevWeek = () => {
    setSelectedDayIndex(null);
    setSelectedDate((prev) => {
      const date = new Date(prev);
      date.setDate(prev.getDate() - 7);
      return date;
    });
  };

  const handleNextWeek = () => {
    if (isCurrentOrFutureWeek) return;
    setSelectedDayIndex(null);
    setSelectedDate((prev) => {
      const date = new Date(prev);
      date.setDate(prev.getDate() + 7);
      return date;
    });
  };

  // Build the 7 days array based on startDay
  const shiftsByDay = React.useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const day = new Date(weekStart);
      day.setDate(weekStart.getDate() + i);
      const dayStr = day.toISOString().split("T")[0];
      
      const dayShifts = weeklyShifts.filter((s) => {
        const sDateStr = new Date(s.startTime).toISOString().split("T")[0];
        return sDateStr === dayStr;
      });

      const dayTotal = dayShifts.reduce((sum, s) => sum + (s.grossRevenue || 0) + (s.tipsRevenue || 0), 0);
      return {
        date: day,
        shifts: dayShifts,
        total: dayTotal,
        label: day.toLocaleDateString("en-US", { weekday: "short" }),
      };
    });
  }, [weekStart, weeklyShifts]);

  // Calculate totals and labels dynamically
  const weeklyTotal = weeklyShifts.reduce((sum, s) => sum + (s.grossRevenue || 0) + (s.tipsRevenue || 0), 0);
  const maxDayTotal = Math.max(...shiftsByDay.map((d) => d.total), 0);

  const displayedTotal = selectedDayIndex !== null ? shiftsByDay[selectedDayIndex].total : weeklyTotal;
  const displayedLabel = selectedDayIndex !== null 
    ? shiftsByDay[selectedDayIndex].date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })
    : formatWeekStr(weekStart, weekEnd);

  const displayedShifts = selectedDayIndex !== null ? shiftsByDay[selectedDayIndex].shifts : weeklyShifts;
  const listTitle = selectedDayIndex !== null
    ? `Shifts on ${shiftsByDay[selectedDayIndex].date.toLocaleDateString("en-US", { weekday: "long" })}`
    : "Shifts this week";

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: profile?.country === "CA" ? "CAD" : "USD",
    }).format(val);
  };

  const weekdayHeaderLetters = startDay === 0
    ? "S   M   T   W   T   F   S"
    : "M   T   W   T   F   S   S";

  const totalOnlineSeconds = displayedShifts.reduce((sum, s) => sum + (s.durationSeconds || 0), 0);
  const totalPausedSeconds = displayedShifts.reduce((sum, s) => sum + (s.pausedSeconds || 0), 0);
  const totalActiveSeconds = Math.max(0, totalOnlineSeconds - totalPausedSeconds);

  const totalDeadMileage = displayedShifts.reduce((sum, s) => sum + (s.deadMileage || 0), 0);
  const totalActiveMileage = displayedShifts.reduce((sum, s) => sum + (s.activeMileage || 0), 0);
  const totalMiles = totalActiveMileage + totalDeadMileage;

  const totalOrders = displayedShifts.reduce((sum, s) => {
    const hrs = (s.durationSeconds || 0) / 3600;
    const ordersForShift = Math.max(1, Math.round(hrs * 2.3));
    return sum + ordersForShift;
  }, 0);

  return (
    <SafeAreaView style={styles.root} edges={["bottom", "left", "right"]}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 64 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Week Selection & Header ────────────────────────────────────────── */}
        <View style={styles.header}>
          <Pressable onPress={() => setIsWeekSelectorOpen(true)} style={styles.weekLabelContainer}>
            <Text style={styles.weekLabel}>
              {displayedLabel}
            </Text>
            <View style={styles.dropdownChevron}>
              <Svg width={10} height={6} viewBox="0 0 10 6" fill="none">
                <Path d="M1 1L5 5L9 1" stroke="#a1a1aa" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </View>
          </Pressable>

          <View style={styles.navigationRow}>
            <Pressable onPress={handlePrevWeek} style={styles.arrowBtn}>
              <ChevronLeft color="#fff" />
            </Pressable>

            <Text style={styles.amountText}>
              {formatCurrency(displayedTotal)}
            </Text>

            <Pressable
              onPress={handleNextWeek}
              disabled={isCurrentOrFutureWeek}
              style={[styles.arrowBtn, isCurrentOrFutureWeek && styles.arrowBtnDisabled]}
            >
              <ChevronRight color={isCurrentOrFutureWeek ? "#3f3f46" : "#fff"} />
            </Pressable>
          </View>
        </View>

        {/* ─── Bar Chart Graph ────────────────────────────────────────────────── */}
        <View style={styles.chartContainer}>
          {maxDayTotal > 0 && (
            <View style={styles.highLineOverlay} pointerEvents="none">
              <View style={styles.dashedLine} />
              <View style={styles.highBadge}>
                <Text style={styles.highBadgeText}>HIGH: {formatCurrency(maxDayTotal)}</Text>
              </View>
            </View>
          )}

          <View style={styles.chartRow}>
            {shiftsByDay.map((dayData, idx) => {
              const isSelected = selectedDayIndex === idx;
              const barHeightPct = maxDayTotal > 0 ? (dayData.total / maxDayTotal) * 100 : 0;
              const barColor = platformColor || "#3b82f6";
              
              return (
                <Pressable
                  key={idx}
                  onPress={() => setSelectedDayIndex(selectedDayIndex === idx ? null : idx)}
                  style={styles.chartCol}
                >
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          height: `${Math.max(barHeightPct, dayData.total > 0 ? 8 : 2)}%`,
                          backgroundColor: barColor,
                          opacity: selectedDayIndex === null || isSelected ? 1 : 0.35,
                        },
                      ]}
                    />
                  </View>
                  <Text
                    style={[
                      styles.chartDayLabel,
                      {
                        color: isSelected ? (platformColor || "#3b82f6") : "#71717a",
                        fontWeight: isSelected ? "800" : "500",
                      },
                    ]}
                  >
                    {dayData.label.slice(0, 1)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* ─── Weekly Stats Section ───────────────────────────────────────────── */}
        <View style={styles.statsContainer}>
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Online</Text>
              <Text style={styles.statValue}>{(totalOnlineSeconds / 3600).toFixed(1)} hrs</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Active</Text>
              <Text style={styles.statValue}>{(totalActiveSeconds / 3600).toFixed(1)} hrs</Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Deadmile / Total Miles</Text>
              <Text style={styles.statValue}>
                {totalDeadMileage.toFixed(1)} / {totalMiles.toFixed(1)} {profile?.distanceUnit || "mi"}
              </Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Orders</Text>
              <Text style={styles.statValue}>{displayedShifts.length > 0 ? totalOrders : 0}</Text>
            </View>
          </View>
        </View>

        {/* ─── Shifts List ────────────────────────────────────────────────────── */}
        <View style={styles.listContainer}>
          <Text style={styles.sectionTitle}>{listTitle}</Text>

          {isLoading ? (
            <ActivityIndicator size="small" color={platformColor || "#3b82f6"} style={{ marginTop: 24 }} />
          ) : displayedShifts.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>
                {selectedDayIndex !== null 
                  ? "No shifts logged on this day."
                  : "No shifts logged for this week."}
              </Text>
            </View>
          ) : (
            <View style={styles.shiftsList}>
              {displayedShifts.map((shift) => {
                const totalShiftEarnings = (shift.grossRevenue || 0) + (shift.tipsRevenue || 0);
                const durationHrs = (shift.durationSeconds || 0) / 3600;
                return (
                  <Pressable
                    key={shift.id}
                    onPress={() => router.push({ pathname: "/shift/add", params: { shiftId: shift.id } })}
                    style={styles.shiftCard}
                  >
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <View style={{ flex: 1 }}>
                        <View style={styles.shiftHeader}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 }}>
                            <PlatformIcon id={shift.platform} />
                            <Text style={styles.shiftDay} numberOfLines={1}>
                              {formatDayName(shift.startTime)}
                            </Text>
                          </View>
                          <Text style={[styles.shiftAmount, { flexShrink: 0, marginLeft: 8 }]} numberOfLines={1} adjustsFontSizeToFit>
                            {formatCurrency(totalShiftEarnings)}
                          </Text>
                        </View>

                        <View style={styles.shiftMeta}>
                          <Text style={styles.metaText}>
                            Duration: {durationHrs.toFixed(1)} hrs
                          </Text>
                          {shift.activeMileage !== undefined && (
                            <Text style={styles.metaText}>
                              Mileage: {shift.activeMileage} {profile?.distanceUnit || "mi"}
                            </Text>
                          )}
                        </View>
                      </View>

                      {shift.routePath && (
                        <RouteMinimap
                          routePathJson={shift.routePath}
                          strokeColor={PLATFORMS[shift.platform as PlatformKey]?.color || "#3b82f6"}
                        />
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* ─── Week Selector Dropdown Modal ────────────────────────────────────── */}
      <Modal
        visible={isWeekSelectorOpen}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setIsWeekSelectorOpen(false)}
      >
        <SafeAreaView style={styles.modalRoot} edges={["top", "bottom", "left", "right"]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select week ({selectorYear})</Text>
            <Pressable onPress={() => setIsWeekSelectorOpen(false)}>
              <Text style={[styles.closeBtnText, { color: platformColor || "#3b82f6" }]}>Cancel</Text>
            </Pressable>
          </View>

          <View style={styles.tableHeader}>
            <Text style={styles.tableHeaderLeft}>Weekly Earnings</Text>
            <Text style={styles.tableHeaderRight}>{weekdayHeaderLetters}</Text>
          </View>

          {isYearShiftsLoading ? (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
              <ActivityIndicator size="large" color={platformColor || "#3b82f6"} />
              <Text style={{ color: "#71717a", fontSize: 13, marginTop: 12, fontWeight: "600" }}>Loading earnings data...</Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.modalScroll} showsVerticalScrollIndicator={false}>
              {visibleWeeks.map((week, idx) => {
                const isSelected = getStartOfWeek(selectedDate, startDay).getTime() === week.start.getTime();
                const formattedRange = `${week.start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${week.end.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;

                return (
                  <Pressable
                    key={idx}
                    onPress={() => {
                      setSelectedDate(week.start);
                      setSelectedDayIndex(null);
                      setIsWeekSelectorOpen(false);
                    }}
                    style={[
                      styles.weekCard,
                      isSelected && { borderColor: platformColor || "#3b82f6", borderWidth: 1 }
                    ]}
                  >
                    <View style={styles.weekInfo}>
                      <Text style={styles.weekRangeText}>{formattedRange}</Text>
                      <Text style={styles.weekAmountText}>{formatCurrency(week.total)}</Text>
                    </View>

                    <View style={styles.miniGraph}>
                      {week.days.map((day, dIdx) => {
                        const barHeightPct = week.maxDay > 0 ? (day.total / week.maxDay) * 100 : 0;
                        return (
                          <View key={dIdx} style={styles.miniGraphCol}>
                            <View style={styles.miniBarTrack}>
                              <View
                                style={[
                                  styles.miniBarFill,
                                  {
                                    height: `${Math.max(barHeightPct, day.total > 0 ? 10 : 2)}%`,
                                    backgroundColor: platformColor || "#3b82f6",
                                  },
                                ]}
                              />
                            </View>
                            <Text style={styles.miniDateText}>{day.dateNum}</Text>
                          </View>
                        );
                      })}
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          {/* Modal Footer with Pagination Controls */}
          <View style={styles.modalFooter}>
            <Pressable
              onPress={handleModalPrevPage}
              disabled={selectorPage === 0 && selectorYear >= new Date().getFullYear()}
              style={[
                styles.pageBtn,
                (selectorPage === 0 && selectorYear >= new Date().getFullYear()) && styles.pageBtnDisabled
              ]}
            >
              <Text style={styles.pageBtnText}>← Newer</Text>
            </Pressable>

            <Text style={styles.pageIndicator}>
              Page {selectorPage + 1} of {totalPages}
            </Text>

            <Pressable
              onPress={handleModalNextPage}
              style={styles.pageBtn}
            >
              <Text style={styles.pageBtnText}>Older →</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000",
  },
  scroll: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    alignItems: "center",
    marginVertical: 20,
    gap: 8,
  },
  weekLabelContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: "#161615",
    borderWidth: 0.8,
    borderColor: "#262522",
  },
  weekLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: "#a1a1aa",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  dropdownChevron: {
    justifyContent: "center",
    alignItems: "center",
  },
  navigationRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    paddingHorizontal: 8,
  },
  arrowBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#161615",
    borderWidth: 0.8,
    borderColor: "#262522",
    justifyContent: "center",
    alignItems: "center",
  },
  arrowBtnDisabled: {
    opacity: 0.35,
    borderColor: "#161615",
  },
  amountText: {
    fontSize: 44,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -1.2,
    paddingVertical: 4,
  },
  chartContainer: {
    backgroundColor: "#0d0d0d",
    borderRadius: 20,
    borderWidth: 0.8,
    borderColor: "#1f1f1f",
    padding: 16,
    marginVertical: 10,
  },
  highLineOverlay: {
    position: "absolute",
    left: 16,
    right: 16,
    top: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 1,
  },
  dashedLine: {
    flex: 1,
    height: 1,
    borderStyle: "dashed",
    borderWidth: 1,
    borderColor: "rgba(113, 113, 122, 0.25)",
  },
  highBadge: {
    backgroundColor: "#0d0d0d",
    paddingLeft: 8,
  },
  highBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#a1a1aa",
    letterSpacing: 0.5,
  },
  chartRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    height: 100,
  },
  chartCol: {
    alignItems: "center",
    flex: 1,
    height: "100%",
    justifyContent: "flex-end",
    gap: 8,
  },
  barTrack: {
    width: 14,
    height: 64,
    backgroundColor: "#161615",
    borderRadius: 7,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  barFill: {
    width: "100%",
    borderRadius: 7,
  },
  chartDayLabel: {
    fontSize: 11,
    fontWeight: "600",
  },
  listContainer: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#71717a",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  emptyState: {
    paddingVertical: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontSize: 13,
    color: "#52525b",
  },
  shiftsList: {
    gap: 12,
  },
  shiftCard: {
    backgroundColor: "#0d0d0d",
    borderRadius: 20,
    borderWidth: 0.8,
    borderColor: "#1f1f1f",
    padding: 16,
    gap: 12,
  },
  shiftHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  platIcon: {
    width: 24,
    height: 24,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  platIconText: {
    fontSize: 11,
    fontWeight: "900",
  },
  shiftDay: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
  shiftAmount: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
  shiftMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 0.5,
    borderTopColor: "#1a1a1a",
    paddingTop: 8,
  },
  metaText: {
    fontSize: 12,
    color: "#71717a",
    fontWeight: "500",
  },

  // Modal styles
  modalRoot: {
    flex: 1,
    backgroundColor: "#000",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: "#1f1f1f",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#fff",
  },
  closeBtnText: {
    fontSize: 14,
    fontWeight: "600",
  },
  tableHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: "#111",
  },
  tableHeaderLeft: {
    fontSize: 11,
    fontWeight: "700",
    color: "#71717a",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tableHeaderRight: {
    fontSize: 10,
    fontWeight: "800",
    color: "#71717a",
    letterSpacing: 0.4,
  },
  modalScroll: {
    paddingVertical: 8,
  },
  weekCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderWidth: 0.8,
    borderColor: "#1f1f1f",
    backgroundColor: "#0d0d0d",
    borderRadius: 20,
    marginHorizontal: 16,
    marginVertical: 6,
  },
  weekInfo: {
    gap: 4,
  },
  weekRangeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#a1a1aa",
  },
  weekAmountText: {
    fontSize: 18,
    fontWeight: "900",
    color: "#fff",
    letterSpacing: -0.4,
  },
  miniGraph: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 4,
  },
  miniGraphCol: {
    alignItems: "center",
    gap: 4,
  },
  miniBarTrack: {
    width: 8,
    height: 32,
    backgroundColor: "#161615",
    borderRadius: 4,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  miniBarFill: {
    width: "100%",
    borderRadius: 4,
  },
  miniDateText: {
    fontSize: 8,
    fontWeight: "700",
    color: "#71717a",
  },

  // Modal Footer styles
  modalFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 0.5,
    borderTopColor: "#1f1f1f",
    backgroundColor: "#000",
  },
  pageBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: "#161615",
    borderWidth: 0.8,
    borderColor: "#262522",
  },
  pageBtnDisabled: {
    opacity: 0.35,
  },
  pageBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#fff",
  },
  pageIndicator: {
    fontSize: 12,
    fontWeight: "600",
    color: "#71717a",
  },
  statsContainer: {
    marginVertical: 10,
    gap: 12,
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#0d0d0d",
    borderRadius: 20,
    borderWidth: 0.8,
    borderColor: "#1f1f1f",
    padding: 16,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#71717a",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "800",
    color: "#fff",
  },
});
