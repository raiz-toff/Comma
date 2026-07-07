import React from "react";
import SegmentedWidget from "./SegmentedWidget";
import DeadMilesWidget from "./DeadMilesWidget";
import StabilityScoreWidget from "./StabilityScoreWidget";

interface EfficiencyStabilityWidgetProps {
  mileage: { active: number; dead: number; ratio: number } | undefined;
  distanceUnit?: string;
  score: number;
  weeklyGross: number[];
}

/** Merges deadMiles + stabilityScore — both answer "how sustainable is this pattern." */
export default function EfficiencyStabilityWidget({ mileage, distanceUnit, score, weeklyGross }: EfficiencyStabilityWidgetProps) {
  return (
    <SegmentedWidget
      segments={[
        { key: "deadMiles", label: "Dead Miles", render: () => <DeadMilesWidget mileage={mileage} distanceUnit={distanceUnit} /> },
        { key: "stability", label: "Stability", render: () => <StabilityScoreWidget score={score} weeklyGross={weeklyGross} /> },
      ]}
    />
  );
}
