import React from "react";
import { View } from "react-native";
import { Text } from "../ui/text";
import { COLORS } from "@/src/theme/colors";

interface BestDayData { day: number; label: string; avgEarnings: number }
interface BestHourData { hour: number; avgEarnings: number }

interface WorkRhythmWidgetProps {
  bestDayData: BestDayData[];
  bestHourData: BestHourData[];
  streak: { current: number; best: number };
  zeroDaysCount: number;
}

function formatHour(h: number) {
  return h === 0 ? "12 AM" : h < 12 ? `${h} AM` : h === 12 ? "12 PM" : `${h - 12} PM`;
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, minWidth: "45%", gap: 4 }}>
      <Text variant="labelXs" style={{ color: COLORS.contentSecondary }}>{label}</Text>
      <Text variant="headingS" tabular style={{ color: COLORS.contentPrimary }} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    </View>
  );
}

/** Merges bestDay + bestHour + streak + zeroDays — all answer "when am I working well." */
export default function WorkRhythmWidget({ bestDayData, bestHourData, streak, zeroDaysCount }: WorkRhythmWidgetProps) {
  const bestDay = bestDayData.reduce((p, c) => (p && p.avgEarnings > c.avgEarnings ? p : c), bestDayData[0]);
  const bestHour = bestHourData.reduce((p, c) => (p && p.avgEarnings > c.avgEarnings ? p : c), bestHourData[0]);

  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", rowGap: 16, columnGap: 12 }}>
      <Cell label="Best Day" value={bestDay?.label || "—"} />
      <Cell label="Best Hour" value={bestHour ? formatHour(bestHour.hour) : "—"} />
      <Cell label="Streak" value={`${streak.current}d`} />
      <Cell label="Zero Days" value={String(zeroDaysCount)} />
    </View>
  );
}
