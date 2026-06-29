import React from "react";
import Svg, { Path, Rect, Circle } from "react-native-svg";

const BG = "#1a1d24";

interface Props {
  id: string;
  size?: number;
  locked?: boolean;
}

export function BadgeSvg({ id, size = 40, locked = false }: Props) {
  const op = locked ? 0.25 : 1;
  const s = size;
  const vb = "0 0 48 48";

  switch (id) {
    // ─── Milestone ────────────────────────────────────────────────────────────
    case "first_shift":
      return (
        <Svg width={s} height={s} viewBox={vb} opacity={op}>
          <Path d="M24 6 L29 18 L42 19 L32 28 L35 41 L24 34 L13 41 L16 28 L6 19 L19 18 Z" fill="#4FC3A1" />
        </Svg>
      );

    case "century_day":
      return (
        <Svg width={s} height={s} viewBox={vb} opacity={op}>
          <Path d="M16 4 L20 22 L13 22 Z" fill="#E0A53B" />
          <Path d="M32 4 L35 22 L28 22 Z" fill="#E0A53B" />
          <Circle cx="24" cy="29" r="14" fill="#E0A53B" />
          <Circle cx="24" cy="29" r="8" fill={BG} />
          <Path d="M24 24 l1.6 3.4 3.7 .3 -2.8 2.4 .9 3.6 -3.4 -2 -3.4 2 .9 -3.6 -2.8 -2.4 3.7 -.3 Z" fill="#E0A53B" />
        </Svg>
      );

    case "five_hundred_week":
      return (
        <Svg width={s} height={s} viewBox={vb} opacity={op}>
          <Path d="M27 4 L12 26 H22 L19 44 L36 20 H25 Z" fill="#F2C12E" />
        </Svg>
      );

    case "thousand_month":
      return (
        <Svg width={s} height={s} viewBox={vb} opacity={op}>
          <Path d="M14 8 H34 L42 19 L24 43 L6 19 Z" fill="#7E6FF0" />
          <Path d="M14 8 L18 19 L6 19 Z" fill={BG} opacity={0.18} />
          <Path d="M34 8 L30 19 L42 19 Z" fill={BG} opacity={0.18} />
          <Path d="M18 19 L24 43 L30 19 Z" fill={BG} opacity={0.12} />
        </Svg>
      );

    case "early_bird":
      return (
        <Svg width={s} height={s} viewBox={vb} opacity={op}>
          <Circle cx="24" cy="26" r="11" fill="#F5A623" />
          <Rect x="4" y="38" width="40" height="6" rx="3" fill="#F5A623" />
          <Rect x="22" y="4" width="4" height="8" rx="2" fill="#F5A623" />
          <Rect x="8.5" y="10" width="4" height="8" rx="2" fill="#F5A623" transform="rotate(-40 10.5 14)" />
          <Rect x="35.5" y="10" width="4" height="8" rx="2" fill="#F5A623" transform="rotate(40 37.5 14)" />
        </Svg>
      );

    case "night_owl":
      return (
        <Svg width={s} height={s} viewBox={vb} opacity={op}>
          <Path d="M35 7 a18 18 0 1 0 6 25 a14 14 0 1 1 -6 -25 Z" fill="#6C7AE0" />
        </Svg>
      );

    case "marathon_shift":
      return (
        <Svg width={s} height={s} viewBox={vb} opacity={op}>
          <Circle cx="30" cy="11" r="5" fill="#E0533B" />
          <Path d="M26 17 L18 22 L11 20 L13 26 L21 28 L20 33 L13 41 L19 43 L27 34 L29 27 L36 30 L37 40 L43 40 L42 27 L33 22 Z" fill="#E0533B" />
        </Svg>
      );

    case "tip_champion":
      return (
        <Svg width={s} height={s} viewBox={vb} opacity={op}>
          <Circle cx="24" cy="24" r="18" fill="#E0A53B" />
          <Rect x="21.5" y="11" width="5" height="26" rx="2.5" fill={BG} />
          <Path d="M30 17 H20 a5 5 0 0 0 0 10 h8 a5 5 0 0 1 0 10 H17" fill="none" stroke={BG} strokeWidth="4.5" strokeLinecap="round" />
        </Svg>
      );

    case "goal_week_hit":
      return (
        <Svg width={s} height={s} viewBox={vb} opacity={op}>
          <Circle cx="24" cy="24" r="18" fill="#E0533B" />
          <Circle cx="24" cy="24" r="11.5" fill={BG} />
          <Circle cx="24" cy="24" r="6" fill="#E0533B" />
        </Svg>
      );

    case "goal_month_hit":
      return (
        <Svg width={s} height={s} viewBox={vb} opacity={op}>
          <Rect x="7" y="9" width="34" height="33" rx="5" fill="#5B8DEF" />
          <Rect x="13" y="5" width="5" height="9" rx="2.5" fill="#5B8DEF" />
          <Rect x="30" y="5" width="5" height="9" rx="2.5" fill="#5B8DEF" />
          <Path d="M16 28 L22 34 L33 22" fill="none" stroke={BG} strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );

    // ─── Expense ──────────────────────────────────────────────────────────────
    case "first_expense":
      return (
        <Svg width={s} height={s} viewBox={vb} opacity={op}>
          <Path d="M11 5 H29 L39 15 V43 H11 Z" fill="#9AA7B2" />
          <Path d="M29 5 V15 H39 Z" fill={BG} />
          <Rect x="16" y="22" width="18" height="3.5" rx="1.75" fill={BG} />
          <Rect x="16" y="29" width="18" height="3.5" rx="1.75" fill={BG} />
          <Rect x="16" y="36" width="12" height="3.5" rx="1.75" fill={BG} />
        </Svg>
      );

    case "expense_savvy":
      return (
        <Svg width={s} height={s} viewBox={vb} opacity={op}>
          <Rect x="6" y="11" width="36" height="28" rx="6" fill="#4FA86B" />
          <Rect x="28" y="20" width="16" height="10" rx="5" fill="#4FA86B" />
          <Circle cx="34" cy="25" r="2.6" fill={BG} />
        </Svg>
      );

    case "vehicle_caretaker":
      return (
        <Svg width={s} height={s} viewBox={vb} opacity={op}>
          <Path d="M31 6 a11 11 0 0 0 -9 18 L8 38 a4 4 0 0 0 6 6 L28 30 a11 11 0 0 0 14 -15 l-7 7 -5 -1 -1 -5 Z" fill="#7C8A99" />
        </Svg>
      );

    case "mileage_master":
      return (
        <Svg width={s} height={s} viewBox={vb} opacity={op}>
          <Path d="M6 32 A18 18 0 0 1 42 32 L34 32 A10 10 0 0 0 14 32 Z" fill="#5B8DEF" />
          <Rect x="22" y="16" width="4.5" height="16" rx="2.25" fill="#5B8DEF" transform="rotate(35 24 30)" />
          <Circle cx="24" cy="32" r="4.5" fill="#5B8DEF" />
        </Svg>
      );

    case "road_warrior":
      return (
        <Svg width={s} height={s} viewBox={vb} opacity={op}>
          <Path d="M13 25 L16 16 a4 4 0 0 1 4 -3 H28 a4 4 0 0 1 4 3 L35 25 Z" fill="#E0533B" />
          <Rect x="6" y="24" width="36" height="11" rx="4" fill="#E0533B" />
          <Circle cx="15" cy="36" r="4.5" fill="#E0533B" />
          <Circle cx="33" cy="36" r="4.5" fill="#E0533B" />
          <Circle cx="15" cy="36" r="1.8" fill={BG} />
          <Circle cx="33" cy="36" r="1.8" fill={BG} />
        </Svg>
      );

    // ─── Record ───────────────────────────────────────────────────────────────
    case "personal_best_earnings":
      return (
        <Svg width={s} height={s} viewBox={vb} opacity={op}>
          <Path d="M14 7 H34 V19 a10 10 0 0 1 -20 0 Z" fill="#E0A53B" />
          <Path d="M14 10 H8 a6 6 0 0 0 6 10 Z" fill="#E0A53B" />
          <Path d="M34 10 H40 a6 6 0 0 1 -6 10 Z" fill="#E0A53B" />
          <Rect x="21" y="27" width="6" height="8" fill="#E0A53B" />
          <Rect x="13" y="34" width="22" height="7" rx="2.5" fill="#E0A53B" />
        </Svg>
      );

    case "personal_best_hours":
      return (
        <Svg width={s} height={s} viewBox={vb} opacity={op}>
          <Path d="M24 4 l3 5 6 -1 1 6 5 3 -3 5 3 5 -5 3 -1 6 -6 -1 -3 5 -3 -5 -6 1 -1 -6 -5 -3 3 -5 -3 -5 5 -3 1 -6 6 1 Z" fill="#4FC3A1" />
          <Circle cx="24" cy="24" r="7" fill={BG} />
        </Svg>
      );

    // ─── Streak ───────────────────────────────────────────────────────────────
    case "streak_7":
      return (
        <Svg width={s} height={s} viewBox={vb} opacity={op}>
          <Path d="M25 3 c-3 7 -11 9 -11 21 a10 10 0 0 0 20 0 c0 -6 -4 -8 -5 -13 c-2 4 -4 4 -4 -8 Z" fill="#F5762E" />
          <Path d="M24 24 c-2 3 -3 4 -3 7 a3.5 3.5 0 0 0 7 0 c0 -3 -2 -4 -4 -7 Z" fill={BG} />
        </Svg>
      );

    case "streak_30":
      return (
        <Svg width={s} height={s} viewBox={vb} opacity={op}>
          <Path d="M25 2 c-3 8 -13 10 -13 23 a12 12 0 0 0 24 0 c0 -7 -5 -9 -6 -15 c-2 5 -5 5 -5 -8 Z" fill="#F25C2A" />
          <Path d="M24 24 c-2 3 -4 5 -4 8 a4 4 0 0 0 8 0 c0 -3 -2 -5 -4 -8 Z" fill={BG} />
        </Svg>
      );

    case "streak_100":
      return (
        <Svg width={s} height={s} viewBox={vb} opacity={op}>
          <Path d="M25 1 c-4 9 -15 11 -15 25 a14 14 0 0 0 28 0 c0 -8 -6 -10 -7 -17 c-2 6 -6 6 -6 -8 Z" fill="#E03B2A" />
          <Path d="M24 23 c-3 4 -5 6 -5 10 a5 5 0 0 0 10 0 c0 -4 -2 -6 -5 -10 Z" fill={BG} />
        </Svg>
      );

    case "perfect_week":
      return (
        <Svg width={s} height={s} viewBox={vb} opacity={op}>
          <Path d="M25 2 c-3 8 -13 10 -13 23 a12 12 0 0 0 24 0 c0 -7 -5 -9 -6 -15 c-2 5 -5 5 -5 -8 Z" fill="#F2A02E" />
          <Path d="M24 17 l2.1 4.6 5 .4 -3.8 3.3 1.2 4.9 -4.5 -2.7 -4.5 2.7 1.2 -4.9 -3.8 -3.3 5 -.4 Z" fill={BG} />
        </Svg>
      );

    // ─── Special ──────────────────────────────────────────────────────────────
    case "weekend_warrior":
      return (
        <Svg width={s} height={s} viewBox={vb} opacity={op}>
          <Path d="M24 4 L40 9 V24 C40 34 33 41 24 44 C15 41 8 34 8 24 V9 Z" fill="#7E6FF0" />
          <Path d="M24 12 L27 15 V28 H29 V31 H27 V35 H21 V31 H19 V28 H21 V15 Z" fill={BG} />
        </Svg>
      );

    case "platform_expert":
      return (
        <Svg width={s} height={s} viewBox={vb} opacity={op}>
          <Path d="M24 6 L44 16 L24 26 L4 16 Z" fill="#4FA8C9" />
          <Path d="M9 24 L24 31.5 L39 24 L44 26.5 L24 36.5 L4 26.5 Z" fill="#4FA8C9" />
          <Path d="M9 33 L24 40.5 L39 33 L44 35.5 L24 45.5 L4 35.5 Z" fill="#4FA8C9" />
        </Svg>
      );

    case "daily_grinder":
      return (
        <Svg width={s} height={s} viewBox={vb} opacity={op}>
          <Rect x="10" y="18" width="24" height="20" rx="5" fill="#8B5E3C" />
          <Path d="M34 22 h6 a5 5 0 0 1 0 10 h-6 Z" fill="#8B5E3C" />
          <Rect x="12" y="40" width="24" height="4" rx="2" fill="#8B5E3C" />
          <Rect x="15" y="8" width="4" height="8" rx="2" fill="#8B5E3C" />
          <Rect x="22" y="6" width="4" height="10" rx="2" fill="#8B5E3C" />
          <Rect x="29" y="8" width="4" height="8" rx="2" fill="#8B5E3C" />
        </Svg>
      );

    default:
      return (
        <Svg width={s} height={s} viewBox={vb} opacity={op}>
          <Circle cx="24" cy="24" r="18" fill="#3f3f46" />
          <Path d="M24 16 v8 M24 28 v2" stroke="#71717a" strokeWidth="3" strokeLinecap="round" />
        </Svg>
      );
  }
}
