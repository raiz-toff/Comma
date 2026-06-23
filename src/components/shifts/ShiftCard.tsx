import React from "react";
import { View, TouchableOpacity } from "react-native";
import { router } from "expo-router";
import { Text } from "../ui/text";
import { PlatformBadge } from "../ui/PlatformBadge";
import { CurrencyText } from "../ui/CurrencyText";
import { type PlatformKey } from "../../registry/platforms";

interface ShiftCardProps {
  shift: {
    id: string;
    platform: string;
    startTime: string | Date;
    endTime: string | Date;
    grossRevenue: number;
    tipsRevenue: number;
    activeMileage: number;
    deadMileage: number;
    durationSeconds: number;
    notes?: string | null;
  };
  distanceUnit: "km" | "mi";
}

export function ShiftCard({ shift, distanceUnit }: ShiftCardProps) {
  const totalEarnings = shift.grossRevenue + shift.tipsRevenue;
  const durationHrs = (shift.durationSeconds / 3600).toFixed(1);
  
  const dateObj = new Date(shift.startTime);
  const dateStr = dateObj.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <TouchableOpacity
      onPress={() => router.push(`/shifts/${shift.id}` as any)}
      className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 flex-row justify-between items-center transition-all duration-200 active:border-slate-700/80"
    >
      {/* Left: Platform Badge, Date, Details */}
      <View className="flex flex-col gap-2 flex-1 pr-3">
        <View className="flex-row items-center gap-2 flex-wrap">
          <PlatformBadge platform={shift.platform as PlatformKey} size="sm" />
          <Text className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
            {dateStr}
          </Text>
        </View>
        
        <View className="flex-row gap-4 mt-0.5">
          <Text className="text-xs text-slate-300 font-medium">
            Hours: <Text className="font-bold text-slate-100">{durationHrs} hrs</Text>
          </Text>
          <Text className="text-xs text-slate-300 font-medium">
            Distance: <Text className="font-bold text-slate-100">
              {((shift.activeMileage || 0) + (shift.deadMileage || 0)).toFixed(1)} {distanceUnit}
            </Text>
          </Text>
        </View>
        
        {shift.notes ? (
          <Text className="text-[11px] text-slate-400 italic mt-0.5" numberOfLines={1}>
            "{shift.notes}"
          </Text>
        ) : null}
      </View>

      {/* Right: Total Earnings & Tips badge */}
      <View className="items-end gap-1">
        <CurrencyText amount={totalEarnings} size="md" className="font-extrabold text-slate-100" />
        {shift.tipsRevenue > 0 ? (
          <Text className="text-[9px] text-emerald-400 font-bold uppercase tracking-wide bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-full">
            +${shift.tipsRevenue.toFixed(2)} tips
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}
