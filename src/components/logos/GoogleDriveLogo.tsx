import React from "react";
import Svg, { Path, G, Mask, Defs, LinearGradient, Stop } from "react-native-svg";

/**
 * Authentic Google Drive logo — a faithful 1:1 port of the official SVG
 * (rounded-corner mask + three gradient faces). Pure SVG, no external assets.
 */
interface Props {
  size?: number;
}

export const GoogleDriveLogo = ({ size = 24 }: Props) => {
  // Source is 800 × 741.37 (aspect ≈ 1.079).
  const w = size;
  const h = size * (741.3696 / 800);
  return (
    <Svg width={w} height={h} viewBox="0 0 800 741.3696" fill="none">
      <Defs>
        <LinearGradient id="b" x1="193.6" x2="103.09" y1="165.6" y2="111.21" gradientUnits="userSpaceOnUse">
          <Stop offset="0.09" stopColor="#ffe921" />
          <Stop offset="1" stopColor="#fec700" />
        </LinearGradient>
        <LinearGradient id="c" x1="114.4" x2="15.53" y1="181.61" y2="121.8" gradientUnits="userSpaceOnUse">
          <Stop offset="0.15" stopColor="#a9a8ff" />
          <Stop offset="0.33" stopColor="#6d97ff" />
          <Stop offset="0.48" stopColor="#3186ff" />
        </LinearGradient>
        <LinearGradient id="d" x1="128.88" x2="28.7" y1="37.88" y2="84.64" gradientUnits="userSpaceOnUse">
          <Stop offset="0.55" stopColor="#0ebc5f" />
          <Stop offset="0.85" stopColor="#78c9ff" />
        </LinearGradient>
        <Mask id="a" width="168" height="154" x="12" y="18" maskUnits="userSpaceOnUse">
          <Path
            fill="#fff"
            d="M63.09 37c14.626-25.333 51.193-25.334 65.819 0l45.033 78c14.626 25.334-3.657 57.001-32.91 57.001H50.967c-29.253 0-47.536-31.667-32.91-57.001Z"
          />
        </Mask>
      </Defs>

      <G mask="url(#a)" transform="matrix(4.8140532,0,0,4.8140532,-62.146701,-86.652356)">
        <Path fill="url(#b)" d="M206.905 172.02h-91.888l-19.015-32.934 45.944-79.578Z" />
        <Path fill="url(#c)" d="M-14.919 172.006 50.04 59.494v.002L31.032 92.422h38.02L115 172.004l-129.918.001Z" />
        <Path fill="url(#d)" d="M96.007-20.085 141.954 59.5l-19.011 32.928H31.048Z" />
      </G>
    </Svg>
  );
};
