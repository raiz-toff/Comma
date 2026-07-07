import React, { useState } from "react";
import { View, Pressable } from "react-native";
import { Text } from "../ui/text";

const SURFACE = "#0F0F12";
const BORDER = "#1C1C21";
const TEXT_MUTED = "#9B9BA4";

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
      <View style={{ flexDirection: "row", backgroundColor: "#1C1C21", borderRadius: 10, padding: 3, gap: 3 }}>
        {segments.map((s) => {
          const isActive = s.key === active;
          return (
            <Pressable
              key={s.key}
              onPress={() => setActive(s.key)}
              style={{ flex: 1, paddingVertical: 7, borderRadius: 8, alignItems: "center", backgroundColor: isActive ? SURFACE : "transparent", borderWidth: isActive ? 1 : 0, borderColor: BORDER }}
            >
              <Text style={{ fontSize: 10, fontWeight: isActive ? "800" : "600", color: isActive ? "#F6F6F7" : TEXT_MUTED, letterSpacing: 0.3 }} numberOfLines={1}>
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
