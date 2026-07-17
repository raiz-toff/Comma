import React from "react";
import { View } from "react-native";
import { CalendarClock } from "lucide-react-native";
import { Text } from "../ui/text";
import { IconBadge } from "../ui/IconBadge";
import { useColors } from "@/src/theme/useColors";

/**
 * Stub / empty-state widget. Web has a shift-planning calendar sketch feature
 * (`schedule_planning_shifts` app state) with no mobile equivalent or underlying
 * data table — this intentionally renders a clean empty state rather than inventing
 * new mobile data plumbing for a feature that doesn't exist on this platform yet.
 */
export default function ScheduleWidget() {
  const C = useColors();
  return (
    <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 24, gap: 12 }}>
      <IconBadge icon={CalendarClock} color={C.contentMuted} tone="tinted" size="lg" iconSize={28} strokeWidth={2} />
      <Text variant="labelXs" style={{ color: C.contentSecondary, textAlign: "center" }}>
        No upcoming shifts scheduled
      </Text>
    </View>
  );
}
