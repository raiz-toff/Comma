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
    bonusAmount?: number;
    activeMileage: number;
    deadMileage: number;
    durationSeconds: number;
    notes?: string | null;
  };
  distanceUnit: "km" | "mi";
}

export function ShiftCard({ shift, distanceUnit }: ShiftCardProps) {
  const totalEarnings = shift.grossRevenue + shift.tipsRevenue + (shift.bonusAmount || 0);
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
      accessibilityRole="button"
      className="bg-card border border-line-subtle rounded-lg p-4 flex-row justify-between items-center active:border-line-strong"
    >
      {/* Left: Platform Badge, Date, Details */}
      <View className="flex flex-col gap-2 flex-1 pr-3">
        <View className="flex-row items-center gap-2 flex-wrap">
          <PlatformBadge platform={shift.platform as PlatformKey} size="sm" />
          <Text variant="labelXs" className="text-content-muted">
            {dateStr}
          </Text>
        </View>

        <View className="flex-row gap-4 mt-0.5">
          <Text variant="paragraphS" className="text-content-secondary">
            Hours: <Text variant="paragraphS" tabular className="font-bold text-content-primary">{durationHrs} hrs</Text>
          </Text>
          <Text variant="paragraphS" className="text-content-secondary">
            Distance: <Text variant="paragraphS" tabular className="font-bold text-content-primary">
              {((shift.activeMileage || 0) + (shift.deadMileage || 0)).toFixed(1)} {distanceUnit}
            </Text>
          </Text>
        </View>

        {shift.notes ? (
          <Text variant="paragraphS" className="text-content-secondary italic mt-0.5" numberOfLines={1}>
            "{shift.notes}"
          </Text>
        ) : null}
      </View>

      {/* Right: Total Earnings & Tips badge */}
      <View className="items-end gap-1">
        <CurrencyText amount={totalEarnings} size="md" className="font-extrabold" />
        {shift.tipsRevenue > 0 ? (
          <Text variant="labelXs" className="text-success bg-success/10 border border-success/20 px-1.5 py-0.5 rounded-full">
            <CurrencyText amount={shift.tipsRevenue} showSign size="sm" className="text-label-xs font-bold text-success" />
            {" tips"}
          </Text>
        ) : null}
        {shift.bonusAmount ? (
          <Text variant="labelXs" className="text-warning bg-warning/10 border border-warning/20 px-1.5 py-0.5 rounded-full">
            <CurrencyText amount={shift.bonusAmount} showSign size="sm" className="text-label-xs font-bold text-warning" />
            {" bonus"}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}
