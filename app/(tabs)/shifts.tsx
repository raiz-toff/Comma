import React from "react";
import { ScrollView, View, TouchableOpacity, Alert, ActivityIndicator, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Text } from "../../src/components/ui/text";
import { SectionHeader } from "../../src/components/ui/SectionHeader";
import { EmptyState } from "../../src/components/ui/EmptyState";
import { PlatformBadge } from "../../src/components/ui/PlatformBadge";
import { CurrencyText } from "../../src/components/ui/CurrencyText";
import { getShiftsPaginated, deleteShift } from "../../src/database/queries/shifts";
import { useSettingsStore } from "../../store/useSettingsStore";
import { cn } from "../../src/lib/utils";

// Custom Trash/Delete Icon built with Views
const TrashIcon = ({ color = "#ef4444" }: { color?: string }) => (
  <View style={{ width: 14, height: 14, justifyContent: "center", alignItems: "center", position: "relative" }}>
    {/* Lid */}
    <View style={{ width: 12, height: 1.5, backgroundColor: color, borderRadius: 1, position: "absolute", top: 1 }} />
    {/* Lid handle */}
    <View style={{ width: 4, height: 1.5, borderTopLeftRadius: 1, borderTopRightRadius: 1, borderWidth: 1, borderColor: color, position: "absolute", top: -0.5 }} />
    {/* Can body */}
    <View style={{ width: 8, height: 9, borderWidth: 1.5, borderColor: color, borderTopWidth: 0, borderBottomLeftRadius: 1.5, borderBottomRightRadius: 1.5, position: "absolute", bottom: 0.5 }} />
    {/* Internal vertical stripes */}
    <View style={{ width: 1, height: 5, backgroundColor: color, position: "absolute", left: 5, top: 4.5 }} />
    <View style={{ width: 1, height: 5, backgroundColor: color, position: "absolute", right: 5, top: 4.5 }} />
  </View>
);

export default function ShiftsScreen() {
  const queryClient = useQueryClient();
  const { profile, isOnboardingCompleted } = useSettingsStore();

  const { data: shiftsList = [], isLoading, refetch } = useQuery({
    queryKey: ["shifts"],
    queryFn: () => getShiftsPaginated(1),
    enabled: isOnboardingCompleted,
  });

  const handleDelete = (id: string) => {
    const performDelete = async () => {
      try {
        await deleteShift(id);
        queryClient.invalidateQueries({ queryKey: ["shifts"] });
        queryClient.invalidateQueries({ queryKey: ["analytics"] });
      } catch (err) {
        console.error("Failed to delete shift:", err);
        Alert.alert("Error", "Failed to delete shift. Please try again.");
      }
    };

    if (Platform.OS === "web") {
      if (window.confirm("Are you sure you want to delete this shift?")) {
        performDelete();
      }
    } else {
      Alert.alert(
        "Delete Shift",
        "Are you sure you want to permanently delete this shift?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Delete", style: "destructive", onPress: performDelete },
        ]
      );
    }
  };

  // Group shifts by Month Year
  const groupedShifts = React.useMemo(() => {
    const groups: Record<string, typeof shiftsList> = {};
    shiftsList.forEach((shift) => {
      const date = new Date(shift.startTime);
      const monthYear = date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
      if (!groups[monthYear]) {
        groups[monthYear] = [];
      }
      groups[monthYear].push(shift);
    });
    return Object.entries(groups);
  }, [shiftsList]);

  if (isLoading) {
    return (
      <SafeAreaView className="dark flex-1 bg-[#0b0f19] items-center justify-center">
        <ActivityIndicator size="large" color="#10b981" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="dark flex-1 bg-[#0b0f19]">
      {/* Top Header Bar */}
      <View className="px-4 pt-3 pb-2 bg-slate-900/40 border-b border-slate-800/80">
        <SectionHeader
          title="Shifts"
          action={{
            label: "+ Add Shift",
            onPress: () => router.push("/shift/add"),
          }}
        />
      </View>

      {shiftsList.length === 0 ? (
        <View className="flex-1 justify-center p-4">
          <EmptyState
            title="No Shifts Tracked"
            message="Log your driving shifts manually or launch the stopwatch timer on the Dashboard."
            icon="calendar"
            actionLabel="Add Shift"
            onAction={() => router.push("/shift/add")}
          />
        </View>
      ) : (
        <ScrollView contentContainerClassName="p-4 pb-12 flex flex-col gap-6">
          {groupedShifts.map(([monthYear, items]) => (
            <View key={monthYear} className="flex-col gap-3">
              {/* Group Month Divider */}
              <View className="border-b border-slate-800/50 pb-2 mb-1">
                <Text className="text-sm font-extrabold text-slate-300 uppercase tracking-wider">{monthYear}</Text>
              </View>

              <View className="flex flex-col gap-3">
                {items.map((shift: any) => {
                  const totalEarnings = shift.grossRevenue + shift.tipsRevenue;
                  const durationHrs = (shift.durationSeconds / 3600).toFixed(1);
                  const dateStr = new Date(shift.startTime).toLocaleDateString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  return (
                    <TouchableOpacity
                      key={shift.id}
                      onPress={() => router.push({ pathname: "/shift/add", params: { shiftId: shift.id } })}
                      className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-4 flex-row justify-between items-center transition-all duration-200 active:border-slate-700"
                    >
                      {/* Left: Platform & Metadata */}
                      <View className="flex flex-col gap-2 flex-1 pr-3">
                        <View className="flex-row items-center gap-2">
                          <PlatformBadge platform={shift.platform} size="sm" />
                          <Text className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{dateStr}</Text>
                        </View>
                        <View className="flex-row gap-4 mt-0.5">
                          <Text className="text-xs text-slate-300 font-medium">
                            Hours: <Text className="font-bold text-slate-200">{durationHrs} hrs</Text>
                          </Text>
                          <Text className="text-xs text-slate-300 font-medium">
                            Distance: <Text className="font-bold text-slate-200">{shift.activeMileage.toFixed(1)} {profile.distanceUnit}</Text>
                          </Text>
                        </View>
                        {shift.notes ? (
                          <Text className="text-[11px] text-slate-400 italic mt-0.5" numberOfLines={1}>
                            "{shift.notes}"
                          </Text>
                        ) : null}
                      </View>

                      {/* Right: Revenue & Actions */}
                      <View className="flex-row items-center gap-3">
                        <View className="items-end gap-0.5">
                          <CurrencyText amount={totalEarnings} size="md" className="font-bold text-slate-100" />
                          {shift.tipsRevenue > 0 ? (
                            <Text className="text-[9px] text-emerald-400 font-bold uppercase tracking-wide">
                              + ${shift.tipsRevenue.toFixed(2)} tips
                            </Text>
                          ) : null}
                        </View>

                        <TouchableOpacity
                          onPress={(e) => {
                            e.stopPropagation();
                            handleDelete(shift.id);
                          }}
                          className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 active:bg-rose-500/20"
                        >
                          <TrashIcon color="#f43f5e" />
                        </TouchableOpacity>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
