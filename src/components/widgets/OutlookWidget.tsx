import React from "react";
import SegmentedWidget from "./SegmentedWidget";
import WeeklyProjectionWidget from "./WeeklyProjectionWidget";
import ScheduleWidget from "./ScheduleWidget";

interface DailyData { date: string; total: number }

interface OutlookWidgetProps {
  dailyData: DailyData[];
  country: string;
}

/** Merges weeklyProjection + schedule — both forward-looking, unlike the rest of Insights. */
export default function OutlookWidget({ dailyData, country }: OutlookWidgetProps) {
  return (
    <SegmentedWidget
      segments={[
        { key: "projection", label: "Projection", render: () => <WeeklyProjectionWidget dailyData={dailyData} country={country} /> },
        { key: "schedule", label: "Schedule", render: () => <ScheduleWidget /> },
      ]}
    />
  );
}
