import React from "react";
import { View } from "react-native";
import { useColors } from "@/src/theme/useColors";
import { RatioBar } from "../ui/RatioBar";
import { StatRow } from "../ui/StatRow";
import { Divider } from "../ui/Divider";

interface DeadMilesWidgetProps {
  mileage: { active: number; dead: number; ratio: number } | undefined;
  distanceUnit?: string;
}

export default function DeadMilesWidget({ mileage, distanceUnit = "mi" }: DeadMilesWidgetProps) {
  const C = useColors();
  const activeVal = mileage?.active || 0;
  const deadVal = mileage?.dead || 0;
  const ratioVal = mileage?.ratio || 0;

  return (
    <View style={{ gap: 16, paddingTop: 4 }}>
      <RatioBar
        accessibilityLabel={`Active ${activeVal.toFixed(1)} ${distanceUnit}, dead ${deadVal.toFixed(1)} ${distanceUnit}, dead ratio ${ratioVal.toFixed(1)}%`}
        segments={[
          { value: activeVal, color: C.success },
          { value: deadVal, color: C.destructive },
        ]}
      />

      <View style={{ gap: 12 }}>
        <StatRow label={`Active ${distanceUnit}`} value={activeVal.toFixed(1)} unit={distanceUnit} dotColor={C.success} />
        <StatRow label={`Dead ${distanceUnit}`} value={deadVal.toFixed(1)} unit={distanceUnit} dotColor={C.destructive} />

        {/* Divider's own mt/pt reproduce the original row's marginTop:4+paddingTop:12 —
            grouped here (not gap-separated) so the parent's 12px gap isn't double-counted. */}
        <View>
          <Divider className="mt-1 pt-3" />
          <StatRow
            label="Dead Ratio"
            value={`${ratioVal.toFixed(1)}%`}
            muted
            valueColor={ratioVal > 40 ? C.destructive : C.success}
          />
        </View>
      </View>
    </View>
  );
}
