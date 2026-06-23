import React from "react";
import { View } from "react-native";
import Svg, { Path, Defs, LinearGradient, Stop } from "react-native-svg";
import { Text } from "../ui/text";

interface DailyData {
  date: string;
  total: number;
}

interface RollingTrendWidgetProps {
  dailyData: DailyData[];
}

function Sparkline({ points, color, height = 50 }: { points: number[]; color: string; height?: number }) {
  const safePoints = points && points.length >= 2 ? points : [0, 0];
  const max = Math.max(...safePoints, 1);
  const min = Math.min(...safePoints);
  const range = (max - min) || 1;
  const width = 100;

  const pathD = safePoints
    .map((p, i) => {
      const x = (i / (safePoints.length - 1)) * width;
      const y = height - ((p - min) / range) * (height - 4) - 2;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  const areaD = `${pathD} L ${width} ${height} L 0 ${height} Z`;

  return (
    <View style={{ height, width: "100%" }}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={`spark-grad-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={color} stopOpacity={0.2} />
            <Stop offset="100%" stopColor={color} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Path d={areaD} fill={`url(#spark-grad-${color.replace("#", "")})`} />
        <Path d={pathD} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </View>
  );
}

export default function RollingTrendWidget({ dailyData }: RollingTrendWidgetProps) {
  const sliced = dailyData.slice(-28);
  const hasData = sliced.length > 0;

  return (
    <View className="gap-2.5">
      <Sparkline points={hasData ? sliced.map((d) => d.total) : [0, 0]} color="#10b981" />
      <View className="flex-row justify-between">
        <Text className="text-[9px] text-slate-500 font-bold">
          {hasData ? sliced[0]?.date?.substring(5) : ""}
        </Text>
        <Text className="text-[9px] text-slate-500 font-bold">Today</Text>
      </View>
    </View>
  );
}
