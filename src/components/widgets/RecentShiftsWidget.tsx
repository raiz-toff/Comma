import React from "react";
import { View } from "react-native";
import { Text } from "../ui/text";
import { PlatformBadge } from "../ui/PlatformBadge";
import { COLORS } from "@/src/theme/colors";
import type { PlatformKey } from "@/src/registry/platforms";

interface RecentShift {
  id: string;
  startTime: Date | string | number;
  platform: string;
  grossRevenue: number;
  tipsRevenue: number;
  bonusAmount?: number;
}

interface RecentShiftsWidgetProps {
  shifts: RecentShift[];
  country?: string;
}

export default function RecentShiftsWidget({ shifts, country }: RecentShiftsWidgetProps) {
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: country === "CA" ? "CAD" : "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(val);
  };

  if (!shifts || shifts.length === 0) {
    return (
      <View style={{ paddingVertical: 20, alignItems: "center" }}>
        <Text variant="paragraphS">No shifts logged yet</Text>
      </View>
    );
  }

  return (
    <View style={{ gap: 10 }}>
      {shifts.map((s) => {
        const total = (s.grossRevenue || 0) + (s.tipsRevenue || 0) + (s.bonusAmount || 0);
        const d = new Date(s.startTime);
        const dateLabel = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
        return (
          <View
            key={s.id}
            accessibilityLabel={`${dateLabel}, ${s.platform}, ${formatCurrency(total)}`}
            style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: COLORS.surface03, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Text variant="labelM" style={{ color: COLORS.contentPrimary, width: 48 }}>{dateLabel}</Text>
              <PlatformBadge platform={s.platform as PlatformKey} size="sm" />
            </View>
            <Text variant="labelM" tabular style={{ color: COLORS.contentPrimary }}>{formatCurrency(total)}</Text>
          </View>
        );
      })}
    </View>
  );
}
