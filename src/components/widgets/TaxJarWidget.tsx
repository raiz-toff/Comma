import React from "react";
import { View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { Text } from "../ui/text";
import { KPI, withAlpha } from "@/src/theme/colors";
import { useColors } from "@/src/theme/useColors";

interface TaxJarWidgetProps {
  taxWithholdingPct: number;
}

export default function TaxJarWidget({ taxWithholdingPct }: TaxJarWidgetProps) {
  const C = useColors();
  const size = 110;
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (taxWithholdingPct / 100) * circumference;
  const pct = Math.round(taxWithholdingPct);

  return (
    <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 12, gap: 16 }}>
      <View
        accessible={true}
        accessibilityLabel={`Tax jar ${pct}% funded`}
        style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}
      >
        <Svg width={size} height={size} style={{ position: "absolute" }}>
          <Circle cx={size/2} cy={size/2} r={radius} stroke={withAlpha(KPI.tax, 0.12)} strokeWidth={strokeWidth} fill="none" />
          <Circle
            cx={size/2}
            cy={size/2}
            r={radius}
            stroke={KPI.tax}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${size/2} ${size/2})`}
          />
        </Svg>
        <Text variant="headingL" tabular style={{ color: C.contentPrimary }}>{pct}%</Text>
      </View>

      <Text variant="labelXs" style={{ color: C.contentSecondary, textAlign: "center" }}>
        Current Target Rate
      </Text>
    </View>
  );
}
