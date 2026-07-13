import React from "react";
import { View } from "react-native";
import Svg, { Path, Defs, LinearGradient, Stop } from "react-native-svg";
import { Text } from "../ui/text";
import { KPI } from "@/src/theme/colors";
import { useColors } from "@/src/theme/useColors";

interface DailyData {
  date: string;
  total: number;
}

interface RollingTrendWidgetProps {
  dailyData: DailyData[];
}

function Sparkline({ points, color, height = 70, accessibilityLabel }: { points: number[]; color: string; height?: number; accessibilityLabel?: string }) {
  const safePoints = points && points.length >= 2 ? points : [0, 0];
  const max = Math.max(...safePoints, 1);
  const min = Math.min(...safePoints);
  const range = (max - min) || 1;
  const width = 100;

  const pathD = safePoints
    .map((p, i) => {
      const x = (i / (safePoints.length - 1)) * width;
      const y = height - ((p - min) / range) * (height - 8) - 4;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  const areaD = `${pathD} L ${width} ${height} L 0 ${height} Z`;

  return (
    <View accessible={true} accessibilityLabel={accessibilityLabel} style={{ height, width: "100%", marginTop: 8 }}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={`spark-grad-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <Stop offset="100%" stopColor={color} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Path d={areaD} fill={`url(#spark-grad-${color.replace("#", "")})`} />
        <Path d={pathD} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </View>
  );
}

export default function RollingTrendWidget({ dailyData }: RollingTrendWidgetProps) {
  const C = useColors();
  const hasData = dailyData && dailyData.length > 0;

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    return dateStr.substring(5); // Converts "2024-06-25" -> "06-25"
  };

  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
         <Text variant="labelM" style={{ color: C.contentSecondary }}>Earnings Trajectory</Text>
         <Text variant="labelXs" style={{ color: KPI.gross }}>Trend</Text>
      </View>
      <Sparkline
        points={hasData ? dailyData.map((d) => d.total) : [0, 0]}
        color={KPI.gross}
        accessibilityLabel={hasData ? `Earnings trend chart across ${dailyData.length} days` : "Earnings trend chart, no data yet"}
      />
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
        <Text variant="labelXs" tabular style={{ color: C.contentMuted }}>
          {hasData ? formatDate(dailyData[0]?.date) : ""}
        </Text>
        <Text variant="labelXs" tabular style={{ color: C.contentMuted }}>
          {hasData ? formatDate(dailyData[dailyData.length - 1]?.date) : ""}
        </Text>
      </View>
    </View>
  );
}
