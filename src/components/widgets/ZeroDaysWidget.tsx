import React from "react";
import { View } from "react-native";
import { XCircle } from "lucide-react-native";
import { Text } from "../ui/text";
import { COLORS, KPI, withAlpha } from "@/src/theme/colors";

interface ZeroDaysWidgetProps {
  zeroDays: number;
  totalDays: number;
}

/** Dot grid is capped so a long history can't render hundreds of Views. */
const MAX_DOTS = 62;

export default function ZeroDaysWidget({ zeroDays, totalDays }: ZeroDaysWidgetProps) {
  const badge = zeroDays === 0 ? { label: "Perfect", color: COLORS.success } : zeroDays <= 3 ? { label: "Good", color: KPI.rate } : { label: "Review", color: COLORS.destructive };

  const shownDays = Math.min(totalDays, MAX_DOTS);
  const shownZeroDays = Math.min(zeroDays, shownDays);
  const gridLabel =
    `${zeroDays} zero-earning days out of ${totalDays}` +
    (totalDays > MAX_DOTS ? `, grid shows the most recent ${MAX_DOTS} days` : "");

  return (
    <View style={{ gap: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={{ backgroundColor: withAlpha(badge.color, 0.12), padding: 8, borderRadius: 12 }}>
            <XCircle size={16} color={badge.color} strokeWidth={2.5} />
          </View>
          <Text variant="labelM" style={{ color: COLORS.contentSecondary }}>Zero-Earning Days</Text>
        </View>
        <View style={{ backgroundColor: withAlpha(badge.color, 0.12), paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
          <Text variant="labelXs" style={{ color: badge.color }}>{badge.label}</Text>
        </View>
      </View>

      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
        <Text variant="headingXl" tabular style={{ color: COLORS.contentPrimary }}>{zeroDays}</Text>
        <Text variant="labelM" tabular style={{ color: COLORS.contentSecondary }}>of {totalDays} days</Text>
      </View>

      <View accessible={true} accessibilityLabel={gridLabel} style={{ flexDirection: "row", flexWrap: "wrap", gap: 5 }}>
        {Array.from({ length: shownDays }, (_, i) => (
          <View
            key={i}
            style={{
              width: 10,
              height: 10,
              borderRadius: 3,
              backgroundColor: i < shownZeroDays ? COLORS.destructive : withAlpha(COLORS.success, 0.25),
            }}
          />
        ))}
      </View>
    </View>
  );
}
