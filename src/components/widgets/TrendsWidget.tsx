import React from "react";
import SegmentedWidget from "./SegmentedWidget";
import RollingTrendWidget from "./RollingTrendWidget";
import WeekCompareWidget from "./WeekCompareWidget";
import HoursCompareWidget from "./HoursCompareWidget";
import ScatterWidget from "./ScatterWidget";

interface DailyData { date: string; total: number }
interface ScatterPoint { x: number; y: number }

interface TrendsWidgetProps {
  dailyData: DailyData[];
  thisWeekTotal: number;
  lastWeekTotal: number;
  activeHrs: number;
  durationHrs: number;
  scatterData: ScatterPoint[];
  country?: string;
}

/** Merges rollingTrend + weekCompare + hoursCompare + scatter — all answer "how is this trending." */
export default function TrendsWidget({ dailyData, thisWeekTotal, lastWeekTotal, activeHrs, durationHrs, scatterData, country }: TrendsWidgetProps) {
  return (
    <SegmentedWidget
      segments={[
        { key: "rolling", label: "30-Day", render: () => <RollingTrendWidget dailyData={dailyData} /> },
        { key: "week", label: "WoW", render: () => <WeekCompareWidget thisWeek={thisWeekTotal} lastWeek={lastWeekTotal} country={country} /> },
        { key: "hours", label: "Hours", render: () => <HoursCompareWidget activeHrs={activeHrs} onlineHrs={durationHrs} /> },
        { key: "scatter", label: "Scatter", render: () => <ScatterWidget data={scatterData} /> },
      ]}
    />
  );
}
