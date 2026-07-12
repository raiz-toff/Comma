import React, { useState } from "react";
import { View, Pressable } from "react-native";
import { Text } from "../ui/text";
import { COLORS } from "@/src/theme/colors";

interface Segment {
  key: string;
  label: string;
  render: () => React.ReactNode;
}

interface SegmentedWidgetProps {
  segments: Segment[];
  defaultKey?: string;
}

/** Groups several widgets behind one tab bar instead of one card each. */
export default function SegmentedWidget({ segments, defaultKey }: SegmentedWidgetProps) {
  const [active, setActive] = useState(defaultKey ?? segments[0]?.key);
  const activeSegment = segments.find((s) => s.key === active) ?? segments[0];

  return (
    <View style={{ gap: 14 }}>
      <View accessibilityRole="tablist" style={{ flexDirection: "row", backgroundColor: COLORS.surface01, borderRadius: 12, padding: 3, gap: 3 }}>
        {segments.map((s) => {
          const isActive = s.key === active;
          return (
            <Pressable
              key={s.key}
              onPress={() => setActive(s.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              hitSlop={{ top: 10, bottom: 10 }}
              style={{ flex: 1, paddingVertical: 7, borderRadius: 8, alignItems: "center", backgroundColor: isActive ? COLORS.surface04 : "transparent", borderWidth: isActive ? 1 : 0, borderColor: COLORS.lineSubtle }}
            >
              <Text variant="labelXs" style={{ color: isActive ? COLORS.contentPrimary : COLORS.contentSecondary }} numberOfLines={1}>
                {s.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {activeSegment?.render()}
    </View>
  );
}
