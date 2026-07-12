import React from "react";
import { View } from "react-native";
import { CalendarClock } from "lucide-react-native";
import { Text } from "../ui/text";
import { COLORS, withAlpha } from "@/src/theme/colors";

/**
 * Stub / empty-state widget. Web has a shift-planning calendar sketch feature
 * (`schedule_planning_shifts` app state) with no mobile equivalent or underlying
 * data table — this intentionally renders a clean empty state rather than inventing
 * new mobile data plumbing for a feature that doesn't exist on this platform yet.
 */
export default function ScheduleWidget() {
  return (
    <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 24, gap: 12 }}>
      <View style={{ backgroundColor: withAlpha(COLORS.contentMuted, 0.12), padding: 12, borderRadius: 16 }}>
        <CalendarClock size={28} color={COLORS.contentMuted} strokeWidth={2} />
      </View>
      <Text variant="labelXs" style={{ color: COLORS.contentSecondary, textAlign: "center" }}>
        No upcoming shifts scheduled
      </Text>
    </View>
  );
}
