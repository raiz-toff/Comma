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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import * as Notifications from "expo-notifications";
import { Text } from "@/src/components/ui/text";
import { CurrencyText } from "@/src/components/ui/CurrencyText";
import { getShiftsPaginated } from "@/src/database/queries/shifts";
import { useSettingsStore } from "@/store/useSettingsStore";
import { PLATFORMS, type PlatformKey } from "@/src/registry/platforms";
import { PlatformBadge } from "@/src/components/ui/PlatformBadge";
import { cn } from "@/src/lib/utils";
import { db } from "@/src/database/client";
import { settings } from "@/src/database/schema";
import { eq } from "drizzle-orm";

const isWeb = Platform.OS === "web";

interface ShiftTemplate {
  id: string;
  platform: PlatformKey;
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, etc.
  startTime: string; // e.g. "17:00"
  endTime: string; // e.g. "21:00"
  reminderMinutes: number; // minutes before to alert (0 = none)
}

export default function ScheduleScreen() {
  const queryClient = useQueryClient();
  const { profile, isOnboardingCompleted } = useSettingsStore();

  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => new Date());

  // Templates & Notification states
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const [isPlanning, setIsPlanning] = useState(false);
  const [planPlatform, setPlanPlatform] = useState<PlatformKey>("doordash");
  const [planDay, setPlanDay] = useState(1); // Monday
  const [planStart, setPlanStart] = useState("17:00");
  const [planEnd, setPlanEnd] = useState("21:00");
  const [planReminder, setPlanReminder] = useState(true);

  const startOfMonth = useMemo(() => {
    return new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  }, [currentDate]);

  const endOfMonth = useMemo(() => {
    return new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59, 999);
  }, [currentDate]);

  // Query shifts for the viewed month
  const { data: monthlyShifts = [], isLoading } = useQuery({
    queryKey: ["schedule", "shifts", startOfMonth.toISOString(), endOfMonth.toISOString()],
    queryFn: () => getShiftsPaginated(1, { startDate: startOfMonth, endDate: endOfMonth }),
    enabled: isOnboardingCompleted,
  });

  // Load Templates
  const loadTemplates = async () => {
    try {
      if (isWeb) {
        const stored = localStorage.getItem("comma_shift_templates");
        if (stored) setTemplates(JSON.parse(stored));
      } else {
        const row = await db
          .select()
          .from(settings)
          .where(eq(settings.key, "shift_templates"))
          .limit(1);
        if (row[0]?.value) {
          setTemplates(JSON.parse(row[0].value));
        }
      }
    } catch {
      // Quiet fail
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

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

  // Filter shifts on selected date
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

  // Handle plan shift creation
  const handleSavePlan = async () => {
    // Schedule local notification if turned on
    if (planReminder && !isWeb) {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status === "granted") {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "Scheduled Shift Reminder 🚗",
            body: `Your planned ${planPlatform} shift starts in 30 minutes!`,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
            hour: parseInt(planStart.split(":")[0], 10),
            minute: parseInt(planStart.split(":")[1], 10),
            repeats: true,
            weekday: planDay + 1, // Notifications use 1-indexed weekday (1 = Sunday)
          },
        });
      }
    }

    const newTemplate: ShiftTemplate = {
      id: `template_${Date.now()}`,
      platform: planPlatform,
      dayOfWeek: planDay,
      startTime: planStart,
      endTime: planEnd,
      reminderMinutes: planReminder ? 30 : 0,
    };

    await saveTemplates([...templates, newTemplate]);
    setIsPlanning(false);
  };

  const handleDeleteTemplate = async (id: string) => {
    const filtered = templates.filter((t) => t.id !== id);
    await saveTemplates(filtered);
  };

  return (
    <SafeAreaView className="dark flex-1 bg-[#0b0f19]">
      {/* Header */}
      <View className="px-4 pt-3 pb-2 border-b border-slate-800/80 bg-slate-900/40 flex-row justify-between items-center">
        <TouchableOpacity
          onPress={() => router.back()}
          className="py-2 px-3 bg-slate-800/40 rounded-lg border border-slate-700/30"
        >
          <Text className="text-slate-300 text-xs font-semibold">Back</Text>
        </TouchableOpacity>
        <Text className="text-slate-100 text-base font-extrabold tracking-tight">Calendar & Presets</Text>
        <TouchableOpacity
          onPress={() => setIsPlanning(!isPlanning)}
          className="py-2 px-3 bg-emerald-500 rounded-lg"
        >
          <Text className="text-white text-xs font-bold uppercase tracking-wider">
            {isPlanning ? "Cancel" : "+ Plan"}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerClassName="p-4 pb-20 flex flex-col gap-5">
        {/* Plan Shift Form */}
        {isPlanning && (
          <View className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex flex-col gap-4">
            <Text className="text-slate-200 text-sm font-extrabold">Plan Recurring Shift</Text>

            {/* Platform Selector */}
            <View className="flex-col gap-1">
              <Text className="text-[10px] text-slate-500 font-bold uppercase">Select Platform</Text>
              <View className="flex-row flex-wrap gap-2">
                {Object.keys(PLATFORMS).map((key) => {
                  const pKey = key as PlatformKey;
                  const isSel = planPlatform === pKey;
                  return (
                    <TouchableOpacity
                      key={pKey}
                      onPress={() => setPlanPlatform(pKey)}
                      className={cn(
                        "px-3 py-2 rounded-xl border flex-row gap-1.5 items-center",
                        isSel ? "border-emerald-500 bg-emerald-500/10" : "border-slate-800 bg-slate-950"
                      )}
                    >
                      <PlatformBadge platform={pKey} size="sm" />
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Day of Week */}
            <View className="flex-col gap-1">
              <Text className="text-[10px] text-slate-500 font-bold uppercase">Day of Week</Text>
              <View className="flex-row justify-between bg-slate-950 border border-slate-800 rounded-xl p-1">
                {["S", "M", "T", "W", "T", "F", "S"].map((d, idx) => (
                  <TouchableOpacity
                    key={idx}
                    onPress={() => setPlanDay(idx)}
                    className={cn(
                      "w-8 h-8 rounded-lg items-center justify-center",
                      planDay === idx ? "bg-emerald-500/15" : ""
                    )}
                  >
                    <Text
                      className={cn(
                        "text-xs font-bold",
                        planDay === idx ? "text-emerald-400" : "text-slate-500"
                      )}
                    >
                      {d}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Shift Hours */}
            <View className="flex-row gap-3">
              <View className="flex-1 flex-col gap-1">
                <Text className="text-[10px] text-slate-500 font-bold uppercase">Start Time</Text>
                <TextInput
                  value={planStart}
                  onChangeText={setPlanStart}
                  placeholder="e.g. 17:00"
                  placeholderTextColor="#475569"
                  className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-slate-200 text-xs font-bold"
                />
              </View>
              <View className="flex-1 flex-col gap-1">
                <Text className="text-[10px] text-slate-500 font-bold uppercase">End Time</Text>
                <TextInput
                  value={planEnd}
                  onChangeText={setPlanEnd}
                  placeholder="e.g. 21:00"
                  placeholderTextColor="#475569"
                  className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-slate-200 text-xs font-bold"
                />
              </View>
            </View>

            {/* Reminder switch */}
            {!isWeb && (
              <View className="flex-row justify-between items-center bg-slate-950 border border-slate-800 rounded-xl p-3">
                <View>
                  <Text className="text-xs font-bold text-slate-200">Alert Reminder</Text>
                  <Text className="text-[9px] text-slate-500">Alert 30 mins before shift starts</Text>
                </View>
                <Switch
                  value={planReminder}
                  onValueChange={setPlanReminder}
                  trackColor={{ false: "#1e293b", true: "#10b981" }}
                  thumbColor="#fff"
                />
              </View>
            )}

            <TouchableOpacity
              onPress={handleSavePlan}
              className="py-3 bg-emerald-500 rounded-xl items-center"
            >
              <Text className="text-white text-xs font-bold uppercase tracking-wider">Save Schedule</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Calendar Card */}
        <View className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 flex flex-col gap-4">
          {/* Month Header Navigation */}
          <View className="flex-row justify-between items-center">
            <TouchableOpacity onPress={prevMonth} className="p-2 bg-slate-800/60 rounded-lg">
              <Text className="text-slate-300 text-xs font-bold">‹</Text>
            </TouchableOpacity>
            <Text className="text-slate-100 text-sm font-extrabold">
              {currentDate.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
            </Text>
            <TouchableOpacity onPress={nextMonth} className="p-2 bg-slate-800/60 rounded-lg">
              <Text className="text-slate-300 text-xs font-bold">›</Text>
            </TouchableOpacity>
          </View>

          {/* Weekday labels */}
          <View className="flex-row justify-between border-b border-slate-800/60 pb-2">
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d, i) => (
              <Text key={i} className="text-[10px] text-slate-500 font-bold uppercase text-center flex-1">
                {d}
              </Text>
            ))}
          </View>

          {/* Days Grid */}
          {isLoading ? (
            <ActivityIndicator size="small" color="#10b981" className="py-8" />
          ) : (
            <View className="flex-row flex-wrap">
              {calendarDays.map((day, idx) => {
                if (!day) {
                  return <View key={idx} className="w-[14.28%] aspect-square" />;
                }
                const dayKey = day.toISOString().split("T")[0];
                const shiftsOnDay = shiftsByDay[dayKey] || [];
                const isSelected = selectedDate.toDateString() === day.toDateString();

                return (
                  <TouchableOpacity
                    key={idx}
                    onPress={() => setSelectedDate(day)}
                    className={cn(
                      "w-[14.28%] aspect-square items-center justify-center p-1 rounded-xl relative",
                      isSelected ? "border border-emerald-500 bg-emerald-500/5" : ""
                    )}
                  >
                    <Text
                      className={cn(
                        "text-xs font-semibold",
                        isSelected ? "text-emerald-400 font-bold" : "text-slate-300"
                      )}
                    >
                      {day.getDate()}
                    </Text>

                    {/* Shift dots */}
                    {shiftsOnDay.length > 0 && (
                      <View className="absolute bottom-1.5 flex-row gap-0.5 justify-center">
                        {shiftsOnDay.slice(0, 3).map((s, sIdx) => {
                          const brandColor = PLATFORMS[s.platform as PlatformKey]?.color || "#cbd5e1";
                          return (
                            <View
                              key={sIdx}
                              style={{ backgroundColor: brandColor }}
                              className="w-1.5 h-1.5 rounded-full"
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

        {/* Selected Date Summary */}
        <View className="flex flex-col gap-3">
          <Text className="text-slate-400 text-xs font-bold uppercase tracking-wide">
            Shifts for {selectedDate.toLocaleDateString(undefined, { dateStyle: "medium" })}
          </Text>

          {selectedDayShifts.length === 0 ? (
            <View className="bg-slate-900/30 border border-dashed border-slate-800 rounded-2xl p-6 items-center">
              <Text className="text-slate-500 text-xs font-semibold">No recorded shifts on this date.</Text>
            </View>
          ) : (
            <View className="flex flex-col gap-2">
              <View className="bg-emerald-500/5 border border-emerald-500/10 rounded-2xl px-4 py-3 flex-row justify-between items-center">
                <Text className="text-xs text-slate-300 font-bold">Total Earnings</Text>
                <CurrencyText amount={selectedDayEarnings} size="sm" className="font-extrabold text-emerald-400" />
              </View>
              {selectedDayShifts.map((s) => (
                <View
                  key={s.id}
                  className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 flex-row justify-between items-center"
                >
                  <View className="flex-row gap-3 items-center">
                    <PlatformBadge platform={s.platform as PlatformKey} />
                    <View className="flex-col">
                      <Text className="text-xs font-bold text-slate-200">
                        {new Date(s.startTime).toLocaleTimeString(undefined, {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </Text>
                      <Text className="text-[9px] text-slate-500 mt-0.5">
                        {s.trackedMileage || 0} {profile.distanceUnit} logged
                      </Text>
                    </View>
                  </View>
                  <CurrencyText
                    amount={(s.grossRevenue || 0) + (s.tipsRevenue || 0)}
                    size="sm"
                    className="font-extrabold text-slate-100"
                  />
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Recurring Scheduled Presets */}
        <View className="flex flex-col gap-3">
          <Text className="text-slate-400 text-xs font-bold uppercase tracking-wide">Planned Weekly Templates</Text>
          {templates.length === 0 ? (
            <View className="bg-slate-900/30 border border-dashed border-slate-800 rounded-2xl p-6 items-center">
              <Text className="text-slate-500 text-xs font-semibold">No planned shift templates. Tap "+ Plan" to schedule.</Text>
            </View>
          ) : (
            <View className="flex flex-col gap-2">
              {templates.map((t) => {
                const dayName = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][t.dayOfWeek];
                return (
                  <View
                    key={t.id}
                    className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 flex-row justify-between items-center"
                  >
                    <View className="flex-row gap-3 items-center">
                      <PlatformBadge platform={t.platform} />
                      <View className="flex-col">
                        <Text className="text-xs font-bold text-slate-200">{dayName}</Text>
                        <Text className="text-[9px] text-slate-500 mt-0.5">
                          {t.startTime} - {t.endTime} {t.reminderMinutes > 0 ? "· Alert on" : ""}
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleDeleteTemplate(t.id)}
                      className="p-1.5 bg-rose-500/10 border border-rose-500/20 rounded-lg"
                    >
                      <Text className="text-rose-400 text-[10px] font-bold">Remove</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
