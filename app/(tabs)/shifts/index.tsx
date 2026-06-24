import React, { useState, useEffect } from "react";
import {
  ScrollView,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  TextInput,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Text } from "@/src/components/ui/text";
import { SectionHeader } from "@/src/components/ui/SectionHeader";
import { EmptyState } from "@/src/components/ui/EmptyState";
import { PlatformBadge } from "@/src/components/ui/PlatformBadge";
import { ShiftCard } from "@/src/components/shifts/ShiftCard";
import { getShiftsPaginated } from "@/src/database/queries/shifts";
import { useSettingsStore } from "@/store/useSettingsStore";
import { PLATFORMS, type PlatformKey } from "@/src/registry/platforms";
import { cn } from "@/src/lib/utils";

const isWeb = Platform.OS === "web";

export default function ShiftsListScreen() {
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { profile, isOnboardingCompleted } = useSettingsStore();

  // Filters State
  const [selectedPlatforms, setSelectedPlatforms] = useState<PlatformKey[]>([]);
  const [startDateStr, setStartDateStr] = useState<string>("");
  const [endDateStr, setEndDateStr] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);

  // Pagination State
  const [page, setPage] = useState(1);
  const [allShifts, setAllShifts] = useState<any[]>([]);

  // Parse dates safely
  const startDate = startDateStr ? new Date(startDateStr + "T00:00:00") : undefined;
  const endDate = endDateStr ? new Date(endDateStr + "T23:59:59") : undefined;

  const filters = {
    startDate,
    endDate,
    platforms: selectedPlatforms.length > 0 ? selectedPlatforms : undefined,
  };

  // Fetch hook
  const { data: pageShifts = [], isLoading, isFetching } = useQuery({
    queryKey: ["shifts", page, selectedPlatforms, startDateStr, endDateStr],
    queryFn: () => getShiftsPaginated(page, filters),
    enabled: isOnboardingCompleted,
  });

  // When filters change, reset page to 1 and clear shifts list
  useEffect(() => {
    setPage(1);
    setAllShifts([]);
  }, [selectedPlatforms, startDateStr, endDateStr]);

  // Append new page items when fetched
  useEffect(() => {
    if (pageShifts.length > 0) {
      if (page === 1) {
        setAllShifts(pageShifts);
      } else {
        setAllShifts((prev) => {
          // Avoid duplicate keys
          const existingIds = new Set(prev.map((s) => s.id));
          const newItems = pageShifts.filter((s) => !existingIds.has(s.id));
          return [...prev, ...newItems];
        });
      }
    } else if (page === 1) {
      setAllShifts([]);
    }
  }, [pageShifts, page]);

  const loadMore = () => {
    if (!isFetching && pageShifts.length === 20) {
      setPage((p) => p + 1);
    }
  };

  const hasMore = pageShifts.length === 20;

  const togglePlatformFilter = (key: PlatformKey) => {
    setSelectedPlatforms((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]
    );
  };

  const clearFilters = () => {
    setSelectedPlatforms([]);
    setStartDateStr("");
    setEndDateStr("");
  };

  const hasActiveFilters = selectedPlatforms.length > 0 || startDateStr || endDateStr;

  return (
    <SafeAreaView className="dark flex-1 bg-[#000000]" edges={["bottom", "left", "right"]} style={{ paddingTop: insets.top + 64 }}>
      {/* Top Header Bar */}
      <View className="px-4 pt-3 pb-2 bg-slate-900/40 border-b border-slate-800/80">
        <SectionHeader
          title="Shifts Log"
          action={{
            label: "+ Add Shift",
            onPress: () => router.push("/shift/add"),
          }}
        />
      </View>

      {/* Filter Toggle / Quick Stats Bar */}
      <View className="px-4 py-2 border-b border-slate-900 flex-row justify-between items-center bg-slate-950/20">
        <TouchableOpacity
          onPress={() => setShowFilters((sf) => !sf)}
          className={cn(
            "px-3 py-1.5 rounded-lg border flex-row items-center gap-1.5",
            hasActiveFilters
              ? "border-emerald-500/30 bg-emerald-500/10"
              : "border-slate-800 bg-slate-900/40"
          )}
        >
          <Text className={cn("text-xs font-bold", hasActiveFilters ? "text-emerald-400" : "text-slate-400")}>
            Filters {hasActiveFilters ? `(Active)` : ""}
          </Text>
          <View style={{ width: 6, height: 6, borderRightWidth: 1.5, borderTopWidth: 1.5, borderColor: hasActiveFilters ? "#34d399" : "#94a3b8", transform: [{ rotate: showFilters ? "135deg" : "45deg" }], marginTop: showFilters ? -2 : 2 }} />
        </TouchableOpacity>

        {hasActiveFilters && (
          <TouchableOpacity onPress={clearFilters}>
            <Text className="text-xs font-bold text-rose-400">Clear Filters</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Filters Expansion Panel */}
      {showFilters && (
        <View className="bg-slate-900/50 border-b border-slate-800/60 p-4 flex flex-col gap-4">
          {/* Platforms Multi-select */}
          <View className="flex flex-col gap-2">
            <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Filter Platforms</Text>
            <View className="flex-row flex-wrap gap-2">
              {(Object.keys(PLATFORMS) as PlatformKey[]).map((pKey) => {
                const isSelected = selectedPlatforms.includes(pKey);
                return (
                  <TouchableOpacity
                    key={pKey}
                    onPress={() => togglePlatformFilter(pKey)}
                    className={cn(
                      "p-0.5 rounded-full border",
                      isSelected ? "border-emerald-500 bg-emerald-500/10" : "border-transparent opacity-60"
                    )}
                  >
                    <PlatformBadge platform={pKey} size="sm" />
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Date range inputs */}
          <View className="flex flex-col gap-2">
            <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Date Range</Text>
            <View className="flex-row gap-3">
              <View className="flex-1 flex flex-col gap-1">
                <Text className="text-[9px] font-bold text-slate-500 uppercase tracking-wider pl-1">Start Date</Text>
                {isWeb ? (
                  <input
                    type="date"
                    value={startDateStr}
                    onChange={(e) => setStartDateStr(e.target.value)}
                    className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 text-slate-200 text-xs w-full outline-none focus:border-emerald-500"
                  />
                ) : (
                  <TextInput
                    value={startDateStr}
                    onChangeText={setStartDateStr}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#475569"
                    className="bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 text-xs font-semibold"
                  />
                )}
              </View>

              <View className="flex-1 flex flex-col gap-1">
                <Text className="text-[9px] font-bold text-slate-500 uppercase tracking-wider pl-1">End Date</Text>
                {isWeb ? (
                  <input
                    type="date"
                    value={endDateStr}
                    onChange={(e) => setEndDateStr(e.target.value)}
                    className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 text-slate-200 text-xs w-full outline-none focus:border-emerald-500"
                  />
                ) : (
                  <TextInput
                    value={endDateStr}
                    onChangeText={setEndDateStr}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#475569"
                    className="bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 text-xs font-semibold"
                  />
                )}
              </View>
            </View>
          </View>
        </View>
      )}

      {/* Shifts List / ScrollView */}
      {isLoading && page === 1 ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#10b981" />
        </View>
      ) : allShifts.length === 0 ? (
        <View className="flex-1 justify-center">
          <EmptyState
            icon="clock"
            title="No Shifts Found"
            message={
              hasActiveFilters
                ? "Try clearing or widening your active filters to find matching shifts."
                : "No shifts logged yet. Start driving and log your work to see your history!"
            }
            actionLabel="Add Shift"
            onAction={() => router.push("/shift/add")}
          />
        </View>
      ) : (
        <ScrollView
          contentContainerClassName="p-4 pb-16 flex flex-col gap-3"
          className="flex-1"
        >
          {allShifts.map((shift) => (
            <ShiftCard key={shift.id} shift={shift} distanceUnit={profile.distanceUnit} />
          ))}

          {/* Load More Button */}
          {hasMore && (
            <TouchableOpacity
              onPress={loadMore}
              disabled={isFetching}
              className="w-full py-4 border border-slate-800 bg-slate-900/30 rounded-2xl items-center justify-center mt-3 active:bg-slate-800/40"
            >
              {isFetching ? (
                <ActivityIndicator size="small" color="#10b981" />
              ) : (
                <Text className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">
                  Load More Shifts
                </Text>
              )}
            </TouchableOpacity>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
