import React, { useState, useMemo, useEffect } from "react";
import {
  ScrollView,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  TextInput,
  Switch,
  StyleSheet,
  Modal,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import * as Notifications from "expo-notifications";
import { Text } from "@/src/components/ui/text";
import { CurrencyText } from "@/src/components/ui/CurrencyText";
import { getShiftsPaginated } from "@/src/database/queries/shifts";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useFeatureEnabled } from "@/hooks/useFeatureEnabled";
import { usePlatformTheme } from "@/src/hooks/usePlatformTheme";
import { PLATFORMS, type PlatformKey } from "@/src/registry/platforms";
import { PlatformBadge } from "@/src/components/ui/PlatformBadge";
import { cn } from "@/src/lib/utils";
import { db } from "@/src/database/client";
import { settings } from "@/src/database/schema";
import { eq } from "drizzle-orm";
import { ChevronLeft, ChevronRight, Trash2, Bell, Clock } from "lucide-react-native";
import DateTimePicker from "@react-native-community/datetimepicker";

const isWeb = Platform.OS === "web";

// ─── Design tokens ──────────────────────────────────────────────────────────
const DS = {
  pageBg: "#000000",
  cardBg: "#0c0c0c",
  cardBorder: "#1e1e1e",
  inputBg: "#161616",
  inputBorder: "#2a2a2a",
  sep: "#1a1a1a",

  brand: "#ffffff",
  brandSurface: "rgba(255, 255, 255, 0.08)",
  brandBorder: "rgba(255, 255, 255, 0.18)",
  brandText: "#ffffff",

  textPrimary: "#e8e7e0",
  textSecondary: "#6a6963",
  textMuted: "#38372f",
  textLabel: "#48473f",

  danger: "#f43f5e",
  dangerSurface: "rgba(244,63,94,0.07)",
  dangerBorder: "rgba(244,63,94,0.22)",
  dangerText: "#fb7185",

  rCard: 18,
  rInput: 11,
  rChip: 8,
  rPill: 20,

  pagePad: 16,
  cardPad: 15,
  rowPad: 13,
} as const;

interface ShiftTemplate {
  id: string;
  platform: PlatformKey;
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, etc.
  startTime: string; // e.g. "17:00"
  endTime: string; // e.g. "21:00"
  reminderMinutes: number; // minutes before to alert (0 = none)
  date?: string;
}

export default function ScheduleScreen() {
  const { accentColor, accentColorDim, accentColorMid, accentColorContrast } = usePlatformTheme();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { profile, isOnboardingCompleted, updateProfile } = useSettingsStore();
  
  const isScheduleEnabled = useFeatureEnabled("schedule");

  useEffect(() => {
    if (!isScheduleEnabled && isOnboardingCompleted) {
      router.replace("/");
    }
  }, [isScheduleEnabled, isOnboardingCompleted]);

  if (!isScheduleEnabled) {
    return null;
  }

  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => new Date());

  // Templates & Notification states
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const [offDays, setOffDays] = useState<string[]>([]);
  const [isPlanning, setIsPlanning] = useState(false);
  const [planType, setPlanType] = useState<"recurring" | "single">("single");
  const [planPlatform, setPlanPlatform] = useState<PlatformKey>("doordash");
  const [planDays, setPlanDays] = useState<number[]>([1]); // Default to Monday
  const [planStart, setPlanStart] = useState("17:00");
  const [planEnd, setPlanEnd] = useState("21:00");
  const [planReminder, setPlanReminder] = useState(true);
  const [showNotifPrompt, setShowNotifPrompt] = useState(false);
  const [showPickerType, setShowPickerType] = useState<"start" | "end" | null>(null);

  const handleSelectDay = (day: Date) => {
    const isSameDay = selectedDate.toDateString() === day.toDateString();
    setSelectedDate(day);
    if (isSameDay) {
      setIsPlanning(true);
      setPlanType("single");
      setPlanDays([day.getDay()]);
    }
  };

  const togglePlanDay = (dayIdx: number) => {
    setPlanDays(prev => 
      prev.includes(dayIdx)
        ? (prev.length > 1 ? prev.filter(d => d !== dayIdx) : prev)
        : [...prev, dayIdx].sort()
    );
  };

  const formatTimeForDisplay = (time24: string): string => {
    if (!time24 || !time24.includes(":")) return time24;
    if (profile?.locale?.timeFormat === "24h") return time24;

    const [hStr, mStr] = time24.split(":");
    let h = parseInt(hStr, 10);
    const m = mStr.trim();
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12;
    if (h === 0) h = 12;
    const padH = h < 10 ? `0${h}` : `${h}`;
    return `${padH}:${m} ${ampm}`;
  };

  const parseInputTo24h = (timeStr: string): string | null => {
    const trimmed = timeStr.trim();
    const use12h = profile?.locale?.timeFormat === "12h";

    if (use12h) {
      const regex12 = /^([0]?[1-9]|1[0-2]):([0-5][0-9])\s*(AM|PM|am|pm)$/i;
      const match = trimmed.match(regex12);
      if (!match) return null;
      let hr = parseInt(match[1], 10);
      const min = match[2];
      const period = match[3].toUpperCase();
      if (period === "PM" && hr < 12) hr += 12;
      else if (period === "AM" && hr === 12) hr = 0;
      return `${hr < 10 ? "0" + hr : hr}:${min}`;
    } else {
      let val = trimmed;
      if (/^[0-9]:[0-5][0-9]$/.test(val)) val = "0" + val;
      const regex24 = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (!regex24.test(val)) return null;
      return val;
    }
  };

  const parseStringToDate = (timeStr: string, defaultHour: number): Date => {
    const d = new Date();
    const normalized = parseInputTo24h(timeStr);
    let h = defaultHour;
    let m = 0;
    if (normalized && normalized.includes(":")) {
      const [sh, sm] = normalized.split(":").map(Number);
      if (!isNaN(sh) && !isNaN(sm)) {
        h = sh;
        m = sm;
      }
    }
    d.setHours(h, m, 0, 0);
    return d;
  };

  const onPickerChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === "android") {
      setShowPickerType(null);
    }

    if (event.type === "dismissed") {
      setShowPickerType(null);
      return;
    }

    if (selectedDate) {
      const h = selectedDate.getHours();
      const m = selectedDate.getMinutes();
      const padH = h < 10 ? `0${h}` : `${h}`;
      const padM = m < 10 ? `0${m}` : `${m}`;
      const time24 = `${padH}:${padM}`;

      const displayVal = formatTimeForDisplay(time24);
      if (showPickerType === "start") {
        setPlanStart(displayVal);
      } else if (showPickerType === "end") {
        setPlanEnd(displayVal);
      }
    }

    if (Platform.OS !== "ios") {
      setShowPickerType(null);
    }
  };

  // Sync initial input value formatting with user settings preference
  useEffect(() => {
    if (profile?.locale?.timeFormat === "12h") {
      setPlanStart("05:00 PM");
      setPlanEnd("09:00 PM");
    } else {
      setPlanStart("17:00");
      setPlanEnd("21:00");
    }
  }, [profile?.locale?.timeFormat]);



  // Selected shift detail toggle
  const [expandedShiftId, setExpandedShiftId] = useState<string | null>(null);

  const startOfMonth = useMemo(() => {
    return new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  }, [currentDate]);

  const endOfMonth = useMemo(() => {
    return new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59, 999);
  }, [currentDate]);

  // Query shifts for the viewed month (limitParam = 500 to capture all)
  const { data: monthlyShifts = [], isLoading } = useQuery({
    queryKey: ["schedule", "shifts", startOfMonth.toISOString(), endOfMonth.toISOString()],
    queryFn: () => getShiftsPaginated(1, { startDate: startOfMonth, endDate: endOfMonth }, 500),
    enabled: isOnboardingCompleted,
  });

  // Load Templates & Off Days
  const loadScheduleData = async () => {
    try {
      if (isWeb) {
        const storedT = localStorage.getItem("comma_shift_templates");
        if (storedT) setTemplates(JSON.parse(storedT));
        const storedO = localStorage.getItem("comma_non_delivery_days");
        if (storedO) setOffDays(JSON.parse(storedO));
      } else {
        const rowT = await db
          .select()
          .from(settings)
          .where(eq(settings.key, "shift_templates"))
          .limit(1);
        if (rowT[0]?.value) {
          setTemplates(JSON.parse(rowT[0].value));
        }
        const rowO = await db
          .select()
          .from(settings)
          .where(eq(settings.key, "non_delivery_days"))
          .limit(1);
        if (rowO[0]?.value) {
          setOffDays(JSON.parse(rowO[0].value));
        }
      }
    } catch {
      // Quiet fail
    }
  };

  useEffect(() => {
    loadScheduleData();

    // Register Notification Categories (Action Buttons) for interactive alerts
    if (!isWeb) {
      Notifications.setNotificationCategoryAsync("shift-reminder", [
        {
          identifier: "start-shift",
          buttonTitle: "Start Shift 🚗",
          options: { opensAppToForeground: true },
        },
        {
          identifier: "snooze",
          buttonTitle: "Remind in 10m ⏳",
          options: { opensAppToForeground: false },
        },
      ]);
    }
  }, []);

  // Sync default plan platform with the user's selected platforms
  useEffect(() => {
    if (profile?.selectedPlatforms && profile.selectedPlatforms.length > 0) {
      if (!profile.selectedPlatforms.includes(planPlatform)) {
        setPlanPlatform(profile.selectedPlatforms[0] as PlatformKey);
      }
    } else {
      setPlanPlatform("other");
    }
  }, [profile?.selectedPlatforms]);

  // Save templates helper
  const saveTemplates = async (newTemplates: ShiftTemplate[]) => {
    setTemplates(newTemplates);
    try {
      if (isWeb) {
        localStorage.setItem("comma_shift_templates", JSON.stringify(newTemplates));
      } else {
        await db
          .insert(settings)
          .values({ key: "shift_templates", value: JSON.stringify(newTemplates) })
          .onConflictDoUpdate({
            target: settings.key,
            set: { value: JSON.stringify(newTemplates) },
          });
      }
    } catch {
      Alert.alert("Error", "Failed to save shift templates.");
    }
  };

  // Save off days helper
  const saveOffDays = async (newOffDays: string[]) => {
    setOffDays(newOffDays);
    try {
      if (isWeb) {
        localStorage.setItem("comma_non_delivery_days", JSON.stringify(newOffDays));
      } else {
        await db
          .insert(settings)
          .values({ key: "non_delivery_days", value: JSON.stringify(newOffDays) })
          .onConflictDoUpdate({
            target: settings.key,
            set: { value: JSON.stringify(newOffDays) },
          });
      }
    } catch {
      Alert.alert("Error", "Failed to save off days.");
    }
  };

  // Calendar helpers
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = useMemo(() => new Date(year, month + 1, 0).getDate(), [year, month]);
  const firstDayIndex = useMemo(() => new Date(year, month, 1).getDay(), [year, month]);

  const calendarDays = useMemo(() => {
    const days = [];
    // Pad initial days
    for (let i = 0; i < firstDayIndex; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    return days;
  }, [year, month, daysInMonth, firstDayIndex]);

  // Group shifts by day (YYYY-MM-DD)
  const shiftsByDay = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const shift of monthlyShifts) {
      const key = new Date(shift.startTime).toISOString().split("T")[0];
      if (!map[key]) map[key] = [];
      map[key].push(shift);
    }
    return map;
  }, [monthlyShifts]);

  // Selected date key
  const selectedDateKey = selectedDate.toISOString().split("T")[0];
  const selectedDayShifts = shiftsByDay[selectedDateKey] || [];
  const selectedDayEarnings = selectedDayShifts.reduce(
    (sum, s) => sum + (s.grossRevenue || 0) + (s.tipsRevenue || 0),
    0
  );

  // Month navigation
  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // Week View generator
  const weekStartDay = profile?.locale?.weekStartDay ?? 0;
  const weekDays = useMemo(() => {
    const d = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
    const day = d.getDay();
    const diff = (day - weekStartDay + 7) % 7;
    d.setDate(d.getDate() - diff);
    
    const days = [];
    for (let i = 0; i < 7; i++) {
      days.push(new Date(d));
      d.setDate(d.getDate() + 1);
    }
    return days;
  }, [selectedDate, weekStartDay]);



  // Validation function for start & end times
  const getValidatedTimes = (): { start: string; end: string } | null => {
    let start = planStart.trim();
    let end = planEnd.trim();

    // Auto-insert leading zero if format is H:MM
    if (/^[0-9]:[0-5][0-9]$/.test(start)) start = "0" + start;
    if (/^[0-9]:[0-5][0-9]$/.test(end)) end = "0" + end;

    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(start)) {
      Alert.alert("Invalid Start Time", "Please use HH:MM 24-hour format (e.g. 17:00 or 08:30).");
      return null;
    }
    if (!timeRegex.test(end)) {
      Alert.alert("Invalid End Time", "Please use HH:MM 24-hour format (e.g. 21:00 or 15:45).");
      return null;
    }

    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    const startMin = sh * 60 + sm;
    const endMin = eh * 60 + em;

    if (startMin === endMin) {
      Alert.alert("Invalid Duration", "Start time and End time cannot be the same.");
      return null;
    }

    return { start, end };
  };

  // Commit saving the planned templates
  const commitSavePlan = async (withReminder: boolean, validatedStart?: string, validatedEnd?: string) => {
    const startVal = validatedStart || planStart;
    const endVal = validatedEnd || planEnd;

    const sh = parseInt(startVal.split(":")[0], 10);
    const sm = parseInt(startVal.split(":")[1], 10);

    // Subtract 30 minutes for notification trigger
    let notifH = sh;
    let notifM = sm - 30;
    if (notifM < 0) {
      notifM += 60;
      notifH = (notifH - 1 + 24) % 24;
    }

    if (withReminder && !isWeb) {
      try {
        if (planType === "single") {
          // Schedule one-off alert for the specific date
          const triggerDate = new Date(selectedDate);
          triggerDate.setHours(notifH, notifM, 0, 0);

          await Notifications.scheduleNotificationAsync({
            content: {
              title: "Scheduled Shift Reminder",
              body: `Your planned ${planPlatform} shift starts in 30 minutes!`,
              categoryIdentifier: "shift-reminder",
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
              year: triggerDate.getFullYear(),
              month: triggerDate.getMonth() + 1,
              day: triggerDate.getDate(),
              hour: triggerDate.getHours(),
              minute: triggerDate.getMinutes(),
              repeats: false,
            },
          });
        } else {
          // Recurring weekly alerts
          for (const day of planDays) {
            await Notifications.scheduleNotificationAsync({
              content: {
                title: "Scheduled Shift Reminder",
                body: `Your planned ${planPlatform} shift starts in 30 minutes!`,
                categoryIdentifier: "shift-reminder",
              },
              trigger: {
                type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
                hour: notifH,
                minute: notifM,
                repeats: true,
                weekday: day + 1,
              },
            });
          }
        }
      } catch {
        // Quiet catch
      }
    }

    let newTemplates: ShiftTemplate[] = [];

    if (planType === "single") {
      newTemplates = [{
        id: `template_${Date.now()}_single`,
        platform: planPlatform,
        dayOfWeek: selectedDate.getDay(),
        startTime: startVal,
        endTime: endVal,
        reminderMinutes: withReminder ? 30 : 0,
        date: selectedDateKey,
      }];
    } else {
      newTemplates = planDays.map((day, dIdx) => ({
        id: `template_${Date.now()}_${dIdx}`,
        platform: planPlatform,
        dayOfWeek: day,
        startTime: startVal,
        endTime: endVal,
        reminderMinutes: withReminder ? 30 : 0,
      }));
    }

    await saveTemplates([...templates, ...newTemplates]);
    setIsPlanning(false);
  };

  // Handle plan shift creation
  const handleSavePlan = async () => {
    const validated = getValidatedTimes();
    if (!validated) return; // Validation failed, Alert already shown

    // Normalize input formatting
    setPlanStart(validated.start);
    setPlanEnd(validated.end);

    if (planReminder && !isWeb) {
      try {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        if (existingStatus !== "granted") {
          setShowNotifPrompt(true);
          return;
        }
      } catch {
        // Fallback
      }
    }
    await commitSavePlan(planReminder, validated.start, validated.end);
  };

  const handleRequestNotifPermission = async () => {
    const validated = getValidatedTimes();
    const start = validated ? validated.start : planStart;
    const end = validated ? validated.end : planEnd;
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      setShowNotifPrompt(false);
      if (status === "granted") {
        await commitSavePlan(true, start, end);
      } else {
        await commitSavePlan(false, start, end);
      }
    } catch {
      setShowNotifPrompt(false);
      await commitSavePlan(false, start, end);
    }
  };

  const handleSkipNotifPermission = async () => {
    const validated = getValidatedTimes();
    const start = validated ? validated.start : planStart;
    const end = validated ? validated.end : planEnd;
    setShowNotifPrompt(false);
    await commitSavePlan(false, start, end);
  };



  const handleDeleteTemplate = async (id: string) => {
    const filtered = templates.filter((t) => t.id !== id);
    await saveTemplates(filtered);
  };

  const handleToggleOffDay = async (dateKey: string) => {
    const next = offDays.includes(dateKey)
      ? offDays.filter((d) => d !== dateKey)
      : [...offDays, dateKey];
    await saveOffDays(next);
  };

  // Convert time "17:00" to decimal hour (17)
  const parseTimeToHour = (timeStr: string) => {
    if (!timeStr || !timeStr.includes(":")) return 0;
    const [h, m] = timeStr.split(":").map(Number);
    return h + (m / 60);
  };

  // 24 Hour timeline segments generator
  const getTimelineSegments = (isPM: boolean) => {
    const offset = isPM ? 12 : 0;
    const segments: { left: string; width: string; color: string; isTemplate: boolean; label: string; id: string }[] = [];

    // Add logged shifts
    selectedDayShifts.forEach((s) => {
      const startStr = new Date(s.startTime).toTimeString().slice(0, 5);
      const endStr = new Date(s.endTime).toTimeString().slice(0, 5);
      const start = parseTimeToHour(startStr);
      const end = parseTimeToHour(endStr);
      
      const segmentStart = Math.max(offset, Math.min(offset + 12, start));
      const segmentEnd = Math.max(offset, Math.min(offset + 12, end));
      
      if (segmentEnd > segmentStart) {
        const leftPct = ((segmentStart - offset) / 12) * 100;
        const widthPct = ((segmentEnd - segmentStart) / 12) * 100;
        const pCfg = PLATFORMS[s.platform as PlatformKey];
        segments.push({
          id: s.id,
          left: `${leftPct}%`,
          width: `${widthPct}%`,
          color: pCfg?.color || "#cbd5e1",
          isTemplate: false,
          label: pCfg?.label || s.platform,
        });
      }
    });

    // Add templates
    const selectedDayOfWeek = selectedDate.getDay();
    const activeTemplates = templates.filter((t) => {
      if (t.date) {
        return t.date === selectedDateKey;
      } else {
        const hasSingleDayOverride = templates.some(st => st.date === selectedDateKey && st.platform === t.platform);
        return t.dayOfWeek === selectedDayOfWeek && !hasSingleDayOverride;
      }
    });
    
    activeTemplates.forEach((t) => {
      const start = parseTimeToHour(t.startTime);
      const end = parseTimeToHour(t.endTime);
      
      const segmentStart = Math.max(offset, Math.min(offset + 12, start));
      const segmentEnd = Math.max(offset, Math.min(offset + 12, end));
      
      if (segmentEnd > segmentStart) {
        const leftPct = ((segmentStart - offset) / 12) * 100;
        const widthPct = ((segmentEnd - segmentStart) / 12) * 100;
        segments.push({
          id: t.id,
          left: `${leftPct}%`,
          width: `${widthPct}%`,
          color: "#475569",
          isTemplate: true,
          label: `Plan: ${t.startTime}-${t.endTime}`,
        });
      }
    });

    return segments;
  };

  const amSegments = useMemo(() => getTimelineSegments(false), [selectedDayShifts, templates, selectedDate]);
  const pmSegments = useMemo(() => getTimelineSegments(true), [selectedDayShifts, templates, selectedDate]);

  return (
    <SafeAreaView style={s.safe} edges={["bottom", "left", "right"]}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 10 }]}>
        <View style={s.headerLeft}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <ChevronLeft color={DS.textPrimary} size={20} />
          </TouchableOpacity>
          <View>
            <Text style={s.headerTitle}>Schedule</Text>
            <Text style={s.headerSub}>Plan & analyze shifts</Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => setIsPlanning(!isPlanning)}
          style={[
            s.headerBtn,
            { backgroundColor: accentColorDim, borderColor: accentColorMid },
            isPlanning && s.headerBtnCancel
          ]}
        >
          <Text style={[s.headerBtnText, { color: accentColor }, isPlanning && s.headerBtnCancelText]}>
            {isPlanning ? "Cancel" : "+ Plan"}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Plan Shift Form */}
        {isPlanning && (
          <View style={s.card}>
            <Text style={s.cardTitle}>
              {planType === "single" ? "Plan Single Shift" : "Plan Recurring Shift"}
            </Text>

            {/* Schedule Type Selector */}
            <View style={s.formGroup}>
              <Text style={s.formLabel}>Schedule Type</Text>
              <View style={s.segmented}>
                <TouchableOpacity
                  onPress={() => setPlanType("single")}
                  style={[s.segBtn, planType === "single" && s.segBtnOn, { flex: 1 }]}
                >
                  <Text style={[s.segText, planType === "single" && s.segTextOn]}>
                    Single Day
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setPlanType("recurring")}
                  style={[s.segBtn, planType === "recurring" && s.segBtnOn, { flex: 1 }]}
                >
                  <Text style={[s.segText, planType === "recurring" && s.segTextOn]}>
                    Weekly Recurring
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Platform Selector */}
            <View style={s.formGroup}>
              <Text style={s.formLabel}>Select Platform</Text>
              <View style={s.platformGrid}>
                {Object.keys(PLATFORMS)
                  .filter((key) => {
                    if (!profile?.selectedPlatforms || profile.selectedPlatforms.length === 0) {
                      return true;
                    }
                    return profile.selectedPlatforms.includes(key) || key === "other";
                  })
                  .map((key) => {
                    const pKey = key as PlatformKey;
                    const isSel = planPlatform === pKey;
                    return (
                      <TouchableOpacity
                        key={pKey}
                        onPress={() => setPlanPlatform(pKey)}
                        style={[s.platformChip, isSel && { borderColor: accentColorMid, backgroundColor: accentColorDim }]}
                      >
                        <PlatformBadge platform={pKey} size="sm" />
                      </TouchableOpacity>
                    );
                  })}
              </View>
            </View>

            {/* Target Date or Days of Week Selector */}
            {planType === "single" ? (
              <View style={s.formGroup}>
                <Text style={s.formLabel}>Target Date</Text>
                <View style={[s.input, { backgroundColor: DS.inputBg, opacity: 0.85, paddingVertical: 10, justifyContent: "center" }]}>
                  <Text style={{ fontSize: 13, color: DS.textPrimary, fontWeight: "600" }}>
                    {selectedDate.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={s.formGroup}>
                <Text style={s.formLabel}>Days of Week</Text>
                <View style={s.segmented}>
                  {["S", "M", "T", "W", "T", "F", "S"].map((d, idx) => {
                    const isSelected = planDays.includes(idx);
                    return (
                      <TouchableOpacity
                        key={idx}
                        onPress={() => togglePlanDay(idx)}
                        style={[s.segBtn, isSelected && s.segBtnOn]}
                      >
                        <Text style={[s.segText, isSelected && s.segTextOn]}>
                          {d}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Shift Hours */}
            <View style={s.formRow}>
              <View style={[s.formGroup, { flex: 1 }]}>
                <Text style={s.formLabel}>Start Time</Text>
                <TouchableOpacity onPress={() => setShowPickerType("start")} activeOpacity={0.7} style={{ width: "100%" }}>
                  <View style={{ position: "relative", justifyContent: "center" }}>
                    <TextInput
                      value={planStart}
                      editable={false}
                      pointerEvents="none"
                      placeholder={profile?.locale?.timeFormat === "12h" ? "e.g. 05:00 PM" : "e.g. 17:00"}
                      placeholderTextColor={DS.textSecondary}
                      style={[s.input, { paddingRight: 34 }]}
                    />
                    {!isWeb && (
                      <View
                        style={{
                          position: "absolute",
                          right: 0,
                          top: 0,
                          bottom: 0,
                          width: 36,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Clock size={14} color={DS.textSecondary} />
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              </View>
              <View style={[s.formGroup, { flex: 1 }]}>
                <Text style={s.formLabel}>End Time</Text>
                <TouchableOpacity onPress={() => setShowPickerType("end")} activeOpacity={0.7} style={{ width: "100%" }}>
                  <View style={{ position: "relative", justifyContent: "center" }}>
                    <TextInput
                      value={planEnd}
                      editable={false}
                      pointerEvents="none"
                      placeholder={profile?.locale?.timeFormat === "12h" ? "e.g. 09:00 PM" : "e.g. 21:00"}
                      placeholderTextColor={DS.textSecondary}
                      style={[s.input, { paddingRight: 34 }]}
                    />
                    {!isWeb && (
                      <View
                        style={{
                          position: "absolute",
                          right: 0,
                          top: 0,
                          bottom: 0,
                          width: 36,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Clock size={14} color={DS.textSecondary} />
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              </View>
            </View>

            {/* Reminder switch */}
            {!isWeb && (
              <View style={s.switchCard}>
                <View>
                  <Text style={s.switchLabel}>Alert Reminder</Text>
                  <Text style={s.switchSub}>Alert 30 mins before shift starts</Text>
                </View>
                <Switch
                  value={planReminder}
                  onValueChange={setPlanReminder}
                  trackColor={{ false: DS.inputBorder, true: accentColor }}
                  thumbColor="#fff"
                />
              </View>
            )}

            <TouchableOpacity onPress={handleSavePlan} style={[s.saveBtn, { backgroundColor: accentColor, borderWidth: 0 }]}>
              <Text style={[s.saveBtnText, { color: accentColorContrast }]}>Save Schedule</Text>
            </TouchableOpacity>


          </View>
        )}

        {/* Week View Grid */}
        <View>
          <Text style={s.groupLabel}>Week Overview</Text>
          <View style={s.weekRow}>
            {weekDays.map((day, idx) => {
              const key = day.toISOString().split("T")[0];
              const dayShifts = shiftsByDay[key] || [];
              const dayEarnings = dayShifts.reduce(
                (sum, s) => sum + (s.grossRevenue || 0) + (s.tipsRevenue || 0),
                0
              );
              const isSelected = selectedDate.toDateString() === day.toDateString();
              const isOff = offDays.includes(key);

              return (
                <TouchableOpacity
                  key={idx}
                  onPress={() => handleSelectDay(day)}
                  style={[
                    s.weekCell,
                    isSelected && { borderColor: accentColorMid, backgroundColor: accentColorDim },
                    isOff && s.weekCellOff,
                  ]}
                >
                  <Text style={[s.weekDayName, isSelected && { color: accentColor }]}>
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][day.getDay()]}
                  </Text>
                  <Text style={[s.weekDayNum, isSelected && { color: accentColor }]}>
                    {day.getDate()}
                  </Text>
                  
                  {dayShifts.length > 0 ? (
                    <CurrencyText
                      amount={dayEarnings}
                      size="sm"
                      className="font-extrabold mt-1 text-[9px]"
                      style={{ color: isSelected ? accentColor : DS.textPrimary }}
                    />
                  ) : (
                    <Text style={s.weekDayEmpty}>--</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Month Calendar Card */}
        <View style={s.card}>
          <View style={s.monthHeader}>
            <TouchableOpacity onPress={prevMonth} style={s.navBtn}>
              <ChevronLeft color={DS.textPrimary} size={16} />
            </TouchableOpacity>
            <Text style={s.monthTitle}>
              {currentDate.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
            </Text>
            <TouchableOpacity onPress={nextMonth} style={s.navBtn}>
              <ChevronRight color={DS.textPrimary} size={16} />
            </TouchableOpacity>
          </View>

          {/* Weekday labels */}
          <View style={s.calendarWeekdayHeader}>
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d, i) => (
              <Text key={i} style={s.calendarWeekdayText}>
                {d}
              </Text>
            ))}
          </View>

          {/* Days Grid */}
          {isLoading ? (
            <ActivityIndicator size="small" color={accentColor} style={{ paddingVertical: 32 }} />
          ) : (
            <View style={s.calendarGrid}>
              {calendarDays.map((day, idx) => {
                if (!day) {
                  return <View key={idx} style={s.calendarDayCell} />;
                }
                const dayKey = day.toISOString().split("T")[0];
                const shiftsOnDay = shiftsByDay[dayKey] || [];
                const isSelected = selectedDate.toDateString() === day.toDateString();
                const isToday = new Date().toDateString() === day.toDateString();
                const isOff = offDays.includes(dayKey);

                return (
                  <TouchableOpacity
                    key={idx}
                    onPress={() => handleSelectDay(day)}
                    style={[
                      s.calendarDayCell,
                      isSelected && { borderColor: accentColorMid, borderWidth: 0.5, backgroundColor: accentColorDim },
                      isToday && s.calendarDayCellToday,
                      isOff && s.calendarDayCellOff,
                    ]}
                  >
                    <Text
                      style={[
                        s.calendarDayNumber,
                        isSelected && { color: accentColor, fontWeight: "800" },
                        isToday && { color: accentColor, fontWeight: "700" },
                      ]}
                    >
                      {day.getDate()}
                    </Text>

                    {/* Shift dots */}
                    {shiftsOnDay.length > 0 && (
                      <View style={s.calendarDots}>
                        {shiftsOnDay.slice(0, 3).map((s, sIdx) => {
                          const brandColor = PLATFORMS[s.platform as PlatformKey]?.color || "#cbd5e1";
                          return (
                            <View
                              key={sIdx}
                              style={[s.calendarDot, { backgroundColor: brandColor }]}
                            />
                          );
                        })}
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* Selected Date Summary & Day Details */}
        <View style={s.card}>
          <View style={s.detailHeaderRow}>
            <View>
              <Text style={s.detailTitle}>
                {selectedDate.toLocaleDateString(undefined, { dateStyle: "long" })}
              </Text>
              <Text style={s.detailSub}>Daily schedules & history</Text>
            </View>
            <TouchableOpacity
              onPress={() => handleToggleOffDay(selectedDateKey)}
              style={[s.offDayBtn, offDays.includes(selectedDateKey) && s.offDayBtnOn]}
            >
              <Text style={[s.offDayBtnText, offDays.includes(selectedDateKey) && s.offDayBtnOnText]}>
                {offDays.includes(selectedDateKey) ? "Cancel Off-day" : "Mark Off-day"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* 24h Timelines */}
          <View style={s.timelineContainer}>
            <Text style={s.timelineLabel}>24h Time Allocation</Text>
            
            {/* AM Row */}
            <View style={s.timelineRow}>
              <View style={s.timelineInfo}>
                <Text style={s.timelineInfoText}>AM (00-12)</Text>
              </View>
              <View style={s.timelineTrack}>
                {amSegments.map((seg) => (
                  <View
                    key={seg.id}
                    style={[
                      s.timelineBlock,
                      { left: seg.left as any, width: seg.width as any, backgroundColor: seg.color },
                      seg.isTemplate && s.timelineBlockPlan,
                    ]}
                  />
                ))}
              </View>
              <View style={s.timelineHours}>
                {["0", "3", "6", "9", "12"].map((h) => (
                  <Text key={h} style={s.timelineHourText}>{h}</Text>
                ))}
              </View>
            </View>

            {/* PM Row */}
            <View style={s.timelineRow}>
              <View style={s.timelineInfo}>
                <Text style={s.timelineInfoText}>PM (12-00)</Text>
              </View>
              <View style={s.timelineTrack}>
                {pmSegments.map((seg) => (
                  <View
                    key={seg.id}
                    style={[
                      s.timelineBlock,
                      { left: seg.left as any, width: seg.width as any, backgroundColor: seg.color },
                      seg.isTemplate && s.timelineBlockPlan,
                    ]}
                  />
                ))}
              </View>
              <View style={s.timelineHours}>
                {["12", "15", "18", "21", "24"].map((h) => (
                  <Text key={h} style={s.timelineHourText}>{h}</Text>
                ))}
              </View>
            </View>
          </View>

          {/* Shifts logged list */}
          {selectedDayShifts.length === 0 ? (
            <View style={s.emptyBox}>
              <Text style={s.emptyBoxText}>No shifts logged on this date.</Text>
            </View>
          ) : (
            <View style={s.shiftList}>
              <View style={[s.earningsBanner, { backgroundColor: accentColorDim, borderColor: accentColorMid }]}>
                <Text style={s.earningsBannerLabel}>Total Earnings</Text>
                <CurrencyText amount={selectedDayEarnings} size="sm" className="font-extrabold text-emerald-400" />
              </View>
              {selectedDayShifts.map((sItem) => {
                const isExp = expandedShiftId === sItem.id;
                const basePay = ((sItem.grossRevenue || 0) - (sItem.tipsRevenue || 0)) || 0;
                
                const startT = new Date(sItem.startTime);
                const endT = new Date(sItem.endTime);
                const durHrs = Math.max(0.1, (endT.getTime() - startT.getTime()) / 3600000);
                const hourlyRate = ((sItem.grossRevenue || 0) + (sItem.tipsRevenue || 0)) / durHrs;

                return (
                  <View key={sItem.id} style={s.shiftItem}>
                    <TouchableOpacity
                      onPress={() => setExpandedShiftId(isExp ? null : sItem.id)}
                      style={s.shiftItemHeader}
                    >
                      <View style={s.shiftInfoLeft}>
                        <PlatformBadge platform={sItem.platform as PlatformKey} />
                        <View>
                          <Text style={s.shiftTime}>
                            {startT.toLocaleTimeString(undefined, {
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: profile?.locale?.timeFormat !== "24h",
                            })}
                          </Text>
                          <Text style={s.shiftSubtext}>
                            {sItem.trackedMileage || 0} {profile.distanceUnit || "mi"} logged
                          </Text>
                        </View>
                      </View>
                      <CurrencyText
                        amount={(sItem.grossRevenue || 0) + (sItem.tipsRevenue || 0)}
                        size="sm"
                        className="font-extrabold text-slate-100"
                      />
                    </TouchableOpacity>

                    {/* Collapsible Details */}
                    {isExp && (
                      <View style={s.shiftOverview}>
                        <View style={s.overviewGrid}>
                          <View style={s.overviewCell}>
                            <Text style={s.overviewLabel}>Hourly Rate</Text>
                            <Text style={[s.overviewValueBrand, { color: accentColor }]}>
                              ${hourlyRate.toFixed(2)}/h
                            </Text>
                          </View>
                          <View style={s.overviewCell}>
                            <Text style={s.overviewLabel}>Base Pay</Text>
                            <Text style={s.overviewValue}>${basePay.toFixed(2)}</Text>
                          </View>
                          <View style={s.overviewCell}>
                            <Text style={s.overviewLabel}>Tips</Text>
                            <Text style={s.overviewValueSuccess}>
                              ${(sItem.tipsRevenue || 0).toFixed(2)}
                            </Text>
                          </View>
                          <View style={s.overviewCell}>
                            <Text style={s.overviewLabel}>Deliveries</Text>
                            <Text style={s.overviewValue}>{sItem.deliveriesCount || 0}</Text>
                          </View>
                          <View style={s.overviewCell}>
                            <Text style={s.overviewLabel}>Distance</Text>
                            <Text style={s.overviewValue}>
                              {sItem.trackedMileage || 0} {profile.distanceUnit || "mi"}
                            </Text>
                          </View>
                          <View style={s.overviewCell}>
                            <Text style={s.overviewLabel}>Duration</Text>
                            <Text style={s.overviewValue}>{durHrs.toFixed(1)} hrs</Text>
                          </View>
                        </View>
                        {sItem.notes ? (
                          <View style={s.overviewNotes}>
                            <Text style={s.notesTitle}>Notes:</Text>
                            <Text style={s.notesText}>{sItem.notes}</Text>
                          </View>
                        ) : null}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </View>



        {/* Planned Shifts & Templates list */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Planned Shifts & Templates</Text>
          {templates.length === 0 ? (
            <View style={s.emptyBox}>
              <Text style={s.emptyBoxText}>No planned shifts or templates. Tap on any day to plan.</Text>
            </View>
          ) : (
            <View style={s.templateList}>
              {templates.map((t) => {
                const dayName = t.date
                  ? new Date(t.date + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
                  : ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][t.dayOfWeek];
                return (
                  <View key={t.id} style={s.templateItem}>
                    <View style={s.templateLeft}>
                      <PlatformBadge platform={t.platform} />
                      <View>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <Text style={s.templateDay}>{dayName}</Text>
                          <View style={{
                            backgroundColor: t.date ? "rgba(59, 130, 246, 0.1)" : "rgba(16, 185, 129, 0.1)",
                            borderColor: t.date ? "rgba(59, 130, 246, 0.3)" : "rgba(16, 185, 129, 0.3)",
                            borderWidth: 0.5,
                            borderRadius: 4,
                            paddingHorizontal: 4,
                            paddingVertical: 1,
                          }}>
                            <Text style={{ fontSize: 7.5, fontWeight: "700", color: t.date ? "#60a5fa" : "#34d399", textTransform: "uppercase" }}>
                              {t.date ? "Single" : "Weekly"}
                            </Text>
                          </View>
                        </View>
                        <Text style={s.templateTime}>
                          {formatTimeForDisplay(t.startTime)} - {formatTimeForDisplay(t.endTime)} {t.reminderMinutes > 0 ? "· Alert on" : ""}
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleDeleteTemplate(t.id)}
                      style={s.removeBtn}
                    >
                      <Trash2 color={DS.dangerText} size={15} />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Work Schedule Preset Card */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Work Schedule Preset</Text>
          <Text style={{ fontSize: 10, color: DS.textSecondary, marginBottom: 12 }}>
            Choose a recurring preset to help shape your weekly goals and targets.
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {[
              { value: "flexible", label: "Flexible" },
              { value: "weekdays", label: "Weekdays Only" },
              { value: "evenings", label: "Evenings Only" },
              { value: "weekends", label: "Weekends Only" },
            ].map((preset) => {
              const isSel = profile?.workSchedulePreset === preset.value;
              return (
                <TouchableOpacity
                  key={preset.value}
                  onPress={async () => {
                    await updateProfile({ workSchedulePreset: preset.value as any });
                  }}
                  style={[
                    s.platformChip,
                    { flex: 1, minWidth: "45%", paddingVertical: 10, alignItems: "center" },
                    isSel && { borderColor: accentColorMid, backgroundColor: accentColorDim }
                  ]}
                >
                  <Text style={{ fontSize: 12, fontWeight: "600", color: isSel ? accentColor : DS.textPrimary }}>
                    {preset.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

      </ScrollView>

      {/* Notification Soft Prompt Overlay */}
      {showNotifPrompt && (
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <View style={s.modalIconContainer}>
              <Bell size={26} color="#ffffff" />
            </View>
            <Text style={s.modalTitle}>Enable Shift Reminders</Text>
            <Text style={s.modalText}>
              Receive smart notifications 30 minutes before your planned shifts so you never miss high-earnings windows.
            </Text>
            <View style={s.modalButtonGroup}>
              <TouchableOpacity style={s.modalPrimaryBtn} onPress={handleRequestNotifPermission}>
                <Text style={s.modalPrimaryBtnText}>Allow Alerts</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.modalSecondaryBtn} onPress={handleSkipNotifPermission}>
                <Text style={s.modalSecondaryBtnText}>Maybe Later</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* iOS Time Picker Modal */}
      {Platform.OS === "ios" && showPickerType && (
        <Modal transparent animationType="fade" visible={!!showPickerType}>
          <View style={s.modalOverlay}>
            <View style={s.iosPickerContainer}>
              <View style={s.iosPickerHeader}>
                <Text style={s.iosPickerTitle}>
                  Select {showPickerType === "start" ? "Start Time" : "End Time"}
                </Text>
                <TouchableOpacity onPress={() => setShowPickerType(null)}>
                  <Text style={s.iosPickerDone}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={showPickerType === "start" ? parseStringToDate(planStart, 17) : parseStringToDate(planEnd, 21)}
                mode="time"
                is24Hour={profile?.locale?.timeFormat !== "12h"}
                display="spinner"
                onChange={onPickerChange}
                textColor="#ffffff"
                style={{ height: 200 }}
              />
            </View>
          </View>
        </Modal>
      )}

      {/* Android Time Picker */}
      {Platform.OS === "android" && showPickerType && (
        <DateTimePicker
          value={showPickerType === "start" ? parseStringToDate(planStart, 17) : parseStringToDate(planEnd, 21)}
          mode="time"
          is24Hour={profile?.locale?.timeFormat !== "12h"}
          display="default"
          onChange={onPickerChange}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: DS.pageBg,
  },
  header: {
    paddingHorizontal: DS.pagePad,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerTitle: {
    color: DS.textPrimary,
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  headerSub: {
    color: DS.textSecondary,
    fontSize: 10,
    marginTop: 1,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: DS.inputBg,
    borderWidth: 0.5,
    borderColor: DS.inputBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  headerBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: DS.rPill,
    backgroundColor: DS.brandSurface,
    borderWidth: 0.5,
    borderColor: DS.brandBorder,
  },
  headerBtnCancel: {
    backgroundColor: DS.dangerSurface,
    borderColor: DS.dangerBorder,
  },
  headerBtnText: {
    color: DS.brandText,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  headerBtnCancelText: {
    color: DS.dangerText,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: DS.pagePad,
    paddingTop: 10,
    paddingBottom: 40,
    gap: 16,
  },
  card: {
    backgroundColor: DS.cardBg,
    borderRadius: DS.rCard,
    borderWidth: 0.5,
    borderColor: DS.cardBorder,
    padding: DS.cardPad,
    gap: 12,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: DS.textPrimary,
  },
  groupLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: DS.textLabel,
    letterSpacing: 0.9,
    marginBottom: 8,
    textTransform: "uppercase",
    paddingHorizontal: 2,
  },

  // ── Form Styles ────────────────────────────────────────────────────────────
  formGroup: {
    gap: 5,
  },
  formRow: {
    flexDirection: "row",
    gap: 12,
  },
  formLabel: {
    fontSize: 9.5,
    fontWeight: "700",
    color: DS.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: DS.inputBg,
    borderColor: DS.inputBorder,
    borderWidth: 0.5,
    borderRadius: DS.rInput,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: DS.textPrimary,
    fontWeight: "600",
  },
  saveBtn: {
    backgroundColor: DS.brandText === "#ffffff" ? "#161616" : DS.brand,
    borderWidth: DS.brandText === "#ffffff" ? 0.5 : 0,
    borderColor: DS.brandBorder,
    borderRadius: DS.rInput,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },
  saveBtnText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  switchCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: DS.inputBg,
    borderColor: DS.inputBorder,
    borderWidth: 0.5,
    borderRadius: DS.rInput,
    padding: 10,
  },
  switchLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: DS.textPrimary,
  },
  switchSub: {
    fontSize: 9,
    color: DS.textSecondary,
    marginTop: 1,
  },
  platformGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  platformChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: DS.rChip,
    borderWidth: 0.5,
    borderColor: DS.inputBorder,
    backgroundColor: DS.inputBg,
  },
  platformChipOn: {
    borderColor: DS.brandBorder,
    backgroundColor: DS.brandSurface,
  },
  segmented: {
    flexDirection: "row",
    backgroundColor: DS.inputBg,
    borderRadius: DS.rInput,
    borderWidth: 0.5,
    borderColor: DS.inputBorder,
    padding: 3,
  },
  segBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: DS.rInput - 2,
    alignItems: "center",
  },
  segBtnOn: {
    backgroundColor: DS.cardBg,
    borderWidth: 0.5,
    borderColor: DS.cardBorder,
  },
  segText: {
    fontSize: 11,
    fontWeight: "700",
    color: DS.textSecondary,
  },
  segTextOn: {
    color: DS.textPrimary,
  },

  // ── Week Row ───────────────────────────────────────────────────────────────
  weekRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 6,
  },
  weekCell: {
    flex: 1,
    aspectRatio: 0.65,
    backgroundColor: DS.cardBg,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: DS.cardBorder,
    alignItems: "center",
    justifyContent: "center",
    padding: 4,
  },
  weekCellSelected: {
    borderColor: DS.brandBorder,
    backgroundColor: DS.brandSurface,
  },
  weekCellOff: {
    borderColor: DS.dangerBorder,
    backgroundColor: DS.dangerSurface,
  },
  weekDayName: {
    fontSize: 8.5,
    fontWeight: "700",
    color: DS.textSecondary,
    textTransform: "uppercase",
  },
  weekDayNameSelected: {
    color: DS.brandText,
  },
  weekDayNum: {
    fontSize: 14,
    fontWeight: "800",
    color: DS.textPrimary,
    marginTop: 2,
  },
  weekDayNumSelected: {
    color: DS.brandText,
  },
  weekDayEmpty: {
    fontSize: 9,
    color: DS.textMuted,
    marginTop: 4,
  },

  // ── Month Calendar ─────────────────────────────────────────────────────────
  monthHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  monthTitle: {
    color: DS.textPrimary,
    fontSize: 13.5,
    fontWeight: "800",
  },
  navBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: DS.inputBg,
    borderWidth: 0.5,
    borderColor: DS.inputBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  calendarWeekdayHeader: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: DS.sep,
    paddingBottom: 6,
    marginTop: 4,
  },
  calendarWeekdayText: {
    flex: 1,
    fontSize: 9,
    color: DS.textSecondary,
    fontWeight: "700",
    textTransform: "uppercase",
    textAlign: "center",
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  calendarDayCell: {
    width: "14.28%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    marginVertical: 1,
  },
  calendarDayCellSelected: {
    borderColor: DS.brandBorder,
    borderWidth: 0.5,
    backgroundColor: DS.brandSurface,
  },
  calendarDayCellToday: {
    backgroundColor: DS.inputBg,
  },
  calendarDayCellOff: {
    borderColor: DS.dangerBorder,
    borderWidth: 0.5,
    backgroundColor: DS.dangerSurface,
  },
  calendarDayNumber: {
    fontSize: 11,
    fontWeight: "600",
    color: DS.textPrimary,
  },
  calendarDayNumberSelected: {
    color: DS.brandText,
    fontWeight: "800",
  },
  calendarDayNumberToday: {
    color: DS.brandText,
    fontWeight: "700",
  },
  calendarDots: {
    flexDirection: "row",
    gap: 1.5,
    position: "absolute",
    bottom: 3,
  },
  calendarDot: {
    width: 3.5,
    height: 3.5,
    borderRadius: 1.75,
  },

  // ── Day Details & Timeline ──────────────────────────────────────────────────
  detailHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 4,
  },
  detailTitle: {
    fontSize: 13.5,
    fontWeight: "800",
    color: DS.textPrimary,
  },
  detailSub: {
    fontSize: 9.5,
    color: DS.textSecondary,
    marginTop: 1,
  },
  offDayBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: DS.rChip,
    backgroundColor: DS.inputBg,
    borderWidth: 0.5,
    borderColor: DS.inputBorder,
  },
  offDayBtnOn: {
    backgroundColor: DS.dangerSurface,
    borderColor: DS.dangerBorder,
  },
  offDayBtnText: {
    fontSize: 9.5,
    fontWeight: "700",
    color: DS.textPrimary,
  },
  offDayBtnOnText: {
    color: DS.dangerText,
  },
  timelineContainer: {
    backgroundColor: DS.inputBg,
    borderColor: DS.inputBorder,
    borderWidth: 0.5,
    borderRadius: DS.rCard - 2,
    padding: 10,
    gap: 8,
  },
  timelineLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: DS.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  timelineRow: {
    gap: 4,
  },
  timelineInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  timelineInfoText: {
    fontSize: 8.5,
    color: DS.textSecondary,
    fontWeight: "600",
  },
  timelineTrack: {
    height: 14,
    backgroundColor: DS.pageBg,
    borderRadius: 7,
    position: "relative",
    overflow: "hidden",
  },
  timelineBlock: {
    height: "100%",
    position: "absolute",
    borderRadius: 3,
  },
  timelineBlockPlan: {
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.2)",
    borderStyle: "dashed",
  },
  timelineHours: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 2,
  },
  timelineHourText: {
    fontSize: 8,
    color: DS.textMuted,
    fontWeight: "500",
  },
  emptyBox: {
    backgroundColor: "rgba(255,255,255,0.02)",
    borderColor: DS.cardBorder,
    borderWidth: 0.5,
    borderStyle: "dashed",
    borderRadius: DS.rCard - 2,
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyBoxText: {
    fontSize: 11,
    color: DS.textSecondary,
    fontWeight: "500",
  },
  shiftList: {
    gap: 8,
  },
  earningsBanner: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: DS.brandSurface,
    borderColor: DS.brandBorder,
    borderWidth: 0.5,
    borderRadius: DS.rCard - 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  earningsBannerLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: DS.textPrimary,
  },
  shiftItem: {
    backgroundColor: DS.inputBg,
    borderColor: DS.inputBorder,
    borderWidth: 0.5,
    borderRadius: DS.rCard - 4,
    overflow: "hidden",
  },
  shiftItemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
  },
  shiftInfoLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  shiftTime: {
    fontSize: 11.5,
    fontWeight: "700",
    color: DS.textPrimary,
  },
  shiftSubtext: {
    fontSize: 8.5,
    color: DS.textSecondary,
    marginTop: 1,
  },
  shiftOverview: {
    borderTopWidth: 0.5,
    borderTopColor: DS.sep,
    padding: 12,
    backgroundColor: DS.cardBg,
  },
  overviewGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  overviewCell: {
    width: "48%",
    backgroundColor: DS.inputBg,
    borderRadius: 8,
    padding: 8,
  },
  overviewLabel: {
    fontSize: 8.5,
    color: DS.textSecondary,
    fontWeight: "600",
  },
  overviewValue: {
    fontSize: 11,
    color: DS.textPrimary,
    fontWeight: "700",
    marginTop: 2,
  },
  overviewValueBrand: {
    fontSize: 11,
    color: DS.brandText,
    fontWeight: "800",
    marginTop: 2,
  },
  overviewValueSuccess: {
    fontSize: 11,
    color: "#22c55e",
    fontWeight: "700",
    marginTop: 2,
  },
  overviewNotes: {
    marginTop: 10,
    backgroundColor: DS.inputBg,
    borderRadius: 8,
    padding: 8,
  },
  notesTitle: {
    fontSize: 9,
    color: DS.textSecondary,
    fontWeight: "700",
  },
  notesText: {
    fontSize: 10.5,
    color: DS.textPrimary,
    marginTop: 2,
    lineHeight: 14,
  },



  // ── Templates ──────────────────────────────────────────────────────────────
  templateList: {
    gap: 6,
  },
  templateItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: DS.inputBg,
    borderColor: DS.inputBorder,
    borderWidth: 0.5,
    borderRadius: DS.rCard - 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  templateLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  templateDay: {
    fontSize: 11.5,
    fontWeight: "700",
    color: DS.textPrimary,
  },
  templateTime: {
    fontSize: 9,
    color: DS.textSecondary,
    marginTop: 1,
  },
  removeBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: "rgba(244,63,94,0.05)",
    borderWidth: 0.5,
    borderColor: "rgba(244,63,94,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.85)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
    padding: 24,
  },
  modalContent: {
    width: "100%",
    maxWidth: 320,
    backgroundColor: "#0c0c0c",
    borderRadius: 20,
    borderWidth: 0.8,
    borderColor: "#1e1e1e",
    padding: 24,
    alignItems: "center",
  },
  modalIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    borderWidth: 0.8,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#ffffff",
    marginBottom: 8,
    textAlign: "center",
  },
  modalText: {
    fontSize: 12,
    color: "#6a6963",
    lineHeight: 17,
    textAlign: "center",
    marginBottom: 24,
  },
  modalButtonGroup: {
    width: "100%",
    gap: 8,
  },
  modalPrimaryBtn: {
    width: "100%",
    height: 40,
    borderRadius: 20,
    backgroundColor: "#ffffff",
    justifyContent: "center",
    alignItems: "center",
  },
  modalPrimaryBtnText: {
    color: "#000000",
    fontSize: 12,
    fontWeight: "700",
  },
  modalSecondaryBtn: {
    width: "100%",
    height: 40,
    borderRadius: 20,
    borderWidth: 0.8,
    borderColor: "#1e1e1e",
    justifyContent: "center",
    alignItems: "center",
  },
  modalSecondaryBtnText: {
    color: "#6a6963",
    fontSize: 12,
    fontWeight: "600",
  },
  iosPickerContainer: {
    width: "100%",
    maxWidth: 320,
    backgroundColor: "#0c0c0c",
    borderRadius: 20,
    borderWidth: 0.8,
    borderColor: "#1e1e1e",
    padding: 16,
  },
  iosPickerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    paddingHorizontal: 8,
  },
  iosPickerTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#ffffff",
  },
  iosPickerDone: {
    fontSize: 13,
    fontWeight: "700",
    color: "#ffffff",
  },
});
