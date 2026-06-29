import React from "react";
import { View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { Text } from "../ui/text";

interface TaxJarWidgetProps {
  taxWithholdingPct: number;
}

export default function TaxJarWidget({ taxWithholdingPct }: TaxJarWidgetProps) {
  const size = 110;
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (taxWithholdingPct / 100) * circumference;

  return (
    <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 12, gap: 16 }}>
      <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
        <Svg width={size} height={size} style={{ position: "absolute" }}>
          <Circle cx={size/2} cy={size/2} r={radius} stroke="#0ea5e920" strokeWidth={strokeWidth} fill="none" />
          <Circle 
            cx={size/2} 
            cy={size/2} 
            r={radius} 
            stroke="#0ea5e9" 
            strokeWidth={strokeWidth} 
            fill="none" 
            strokeDasharray={circumference} 
            strokeDashoffset={strokeDashoffset} 
            strokeLinecap="round" 
            transform={`rotate(-90 ${size/2} ${size/2})`} 
          />
        </Svg>
        <Text style={{ fontSize: 24, fontWeight: "900", color: "#F6F6F7" }}>{taxWithholdingPct}%</Text>
      </View>
      
      <Text style={{ fontSize: 11, fontWeight: "700", color: "#9B9BA4", textTransform: "uppercase", letterSpacing: 1, textAlign: "center" }}>
        Current Target Rate
      </Text>
    </View>
  );
}
