import React, { useEffect, useState, useRef } from "react";
import {
  ScrollView,
  View,
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Alert,
  Platform,
  AppState,
  Modal,
  TextInput,
  useWindowDimensions,
  KeyboardAvoidingView,
  Animated as RNAnimated,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Text } from "../../src/components/ui/text";
import { withAlpha } from "../../src/theme/colors";
import { useColors, useThemedStyles, type Palette } from "@/src/theme/useColors";
import { EmptyState } from "../../src/components/ui/EmptyState";
import { BlurView } from "expo-blur";
import { ReceiptText, Calendar, Play, AlertCircle } from "lucide-react-native";
import { useActiveShift, type GigPlatform } from "../../store/useActiveShift";
import CommaTracker from "../../modules/comma-tracker";
import { useSettingsStore } from "../../store/useSettingsStore";
import { parseRoutePath } from "../../utils/polyline";
import { getVehicles } from "../../src/database/queries/vehicles";
import OnboardingWizard from "../../components/OnboardingWizard";
import { ActivationChecklist } from "../../components/ActivationChecklist";
import { useVocabulary } from "../../src/hooks/useVocabulary";
import { useFeatureEnabled } from "../../hooks/useFeatureEnabled";
import {
  getTodayStats,
  getWeekStats,
  getGoalProgress,
  getFinancialOverviewForRange,
  getPeriodStats,
  getActiveVehicle,
} from "../../src/database/queries/analytics";
import { getEffectiveMileageRate, calculateMileageWriteOff } from "../../src/database/queries/taxProfiles";
import { getShiftsPaginated, getUnreconciledShifts, getGPSOnlyShifts, reconcileOdometerAnchors } from "../../src/database/queries/shifts";
import { PlatformBadge } from "../../src/components/ui/PlatformBadge";
import { AppBottomSheet, type AppBottomSheetRef } from "../../src/components/ui/AppBottomSheet";
import { CelebrationSheet, type CelebrationSheetRef } from "../../src/components/celebration/CelebrationSheet";
import { useBackupStatus } from "../../hooks/useBackupStatus";
import { useLayout } from "../../src/hooks/useLayout";
import { useDeviceLocationSetup } from "../../hooks/useDeviceLocationSetup";
import Svg, { Path, Circle, Defs, LinearGradient, Stop, Polyline, Line } from "react-native-svg";
import { usePlatformTheme } from "../../src/hooks/usePlatformTheme";
import { PLATFORMS } from "../../src/registry/platforms";
import { PlatformLogo } from "../../src/components/GlobalTopHeader";
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';

/*
 * NOTE: the window height is NOT read here.
 *
 * `Dimensions.get("window")` at module scope is evaluated once, at import, and
 * then never again — so the height the clock overlay slides out to was fixed at
 * whatever the window happened to be when the bundle loaded. Rotate the device,
 * unfold a foldable, or drag an Android split-screen divider, and the sheet's
 * off-screen position is stale: it either stops short and leaves a strip of
 * itself on screen, or overshoots. HomeScreen reads it from
 * useWindowDimensions() instead, which is reactive.
 */

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type ScalePressableProps = {
  onPress?: () => void;
  style?: React.ComponentProps<typeof AnimatedPressable>["style"];
  android_ripple?: React.ComponentProps<typeof Pressable>["android_ripple"];
  children?: React.ReactNode;
};

function ScalePressable({ onPress, style, children, android_ripple }: ScalePressableProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.95, { damping: 15 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15 });
  };

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole="button"
      style={[style, animatedStyle]}
      android_ripple={android_ripple}
    >
      {children}
    </AnimatedPressable>
  );
}

// ─── Icons ───────────────────────────────────────────────────────────────────
const PlayIcon = ({ size = 14, color: colorProp }: { size?: number; color?: string }) => {
  const C = useColors();
  const color = colorProp ?? C.contentPrimary;
  return (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M8 5v14l11-7z" />
  </Svg>
  );
};

const SquareIcon = ({ size = 14, color: colorProp }: { size?: number; color?: string }) => {
  const C = useColors();
  const color = colorProp ?? C.contentPrimary;
  return (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M6 6h12v12H6z" />
  </Svg>
  );
};

const RouteIcon = ({ size = 16, color: colorProp }: { size?: number; color?: string }) => {
  const C = useColors();
  const color = colorProp ?? C.contentPrimary;
  return (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <Circle cx="5.5" cy="18.5" r="2.5" />
    <Circle cx="18.5" cy="5.5" r="2.5" />
    <Path d="M5.5 16V9a4 4 0 0 1 4-4h5" />
  </Svg>
  );
};

const ClockIcon = ({ size = 16, color: colorProp }: { size?: number; color?: string }) => {
  const C = useColors();
  const color = colorProp ?? C.contentPrimary;
  return (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <Circle cx="12" cy="12" r="10" />
    <Path d="M12 6v6l4 2" />
  </Svg>
  );
};

const TrendIcon = ({ size = 16, color: colorProp }: { size?: number; color?: string }) => {
  const C = useColors();
  const color = colorProp ?? C.contentPrimary;
  return (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <Path d="m22 7-8.5 8.5-5-5L2 17" />
    <Path d="M16 7h6v6" />
  </Svg>
  );
};

const ReceiptIcon = ({ size = 16, color: colorProp }: { size?: number; color?: string }) => {
  const C = useColors();
  const color = colorProp ?? C.contentPrimary;
  return (
  <Svg width={size} height={size} viewBox="0 0 1024 1024" fill="none">
    <Path
      d="M731.15 585.97c-100.99 0-182.86 81.87-182.86 182.86s81.87 182.86 182.86 182.86 182.86-81.87 182.86-182.86-81.87-182.86-182.86-182.86z m0 292.57c-60.5 0-109.71-49.22-109.71-109.71s49.22-109.71 109.71-109.71c60.5 0 109.71 49.22 109.71 109.71s-49.21 109.71-109.71 109.71z"
      fill={color}
    />
    <Path
      d="M758.58 692.98h-54.86v87.27l69.4 68.79 38.6-38.97-53.14-52.68zM219.51 474.96h219.43v73.14H219.51z"
      fill={color}
    />
    <Path
      d="M182.61 365.86h585.62v179.48h73.14V145.21c0-39.96-32.5-72.48-72.46-72.48h-27.36c-29.18 0-55.04 16.73-65.88 42.59-5.71 13.64-27.82 13.66-33.57-0.02-10.86-25.86-36.71-42.57-65.88-42.57h-18.16c-29.18 0-55.04 16.73-65.88 42.59-5.71 13.64-27.82 13.66-33.57-0.02-10.86-25.86-36.71-42.57-65.88-42.57H375.3c-29.18 0-55.04 16.73-65.88 42.59-5.71 13.64-27.82 13.66-33.57-0.02-10.86-25.86-36.71-42.57-65.88-42.57H182.4c-39.96 0-72.48 32.52-72.48 72.48v805.14h401.21v-73.14H183.04l-0.43-511.35z m25.81-222.29c14.25 34.09 47.32 56.11 84.23 56.11 36.89 0 69.96-22.02 82.66-53.8l15.86-2.3c14.25 34.09 47.32 56.11 84.23 56.11 36.89 0 69.96-22.02 82.66-53.8l16.59-2.3c14.25 34.09 47.32 56.11 84.23 56.11 36.89 0 69.96-22.02 82.66-53.8l26.68-0.66v147.5H182.54l-0.13-146.84 26.01-2.33z"
      fill={color}
    />
  </Svg>
  );
};

const BellIcon = ({ size = 18, color: colorProp }: { size?: number; color?: string }) => {
  const C = useColors();
  const color = colorProp ?? C.contentPrimary;
  return (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <Path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </Svg>
  );
};

const getFormattedHeaderDate = () => {
  const options: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'short', day: 'numeric' };
  return new Date().toLocaleDateString('en-US', options);
};

const getGreeting = () => {
  const hr = new Date().getHours();
  if (hr < 12) return "Good morning";
  if (hr < 17) return "Good afternoon";
  return "Good evening";
};

// ─── Custom Sparkline ────────────────────────────────────────────────────────
const Sparkline = ({ points, color, height = 36 }: { points: number[]; color: string; height?: number }) => {
  const safe = points?.length >= 2 ? points : [5, 9, 6, 14, 10, 18, 13, 22, 17, 28, 21, 34];
  const max = Math.max(...safe, 1);
  const min = Math.min(...safe);
  const range = (max - min) || 1;
  const w = 100;

  const coords = safe.map((p, i) => {
    const x = (i / (safe.length - 1)) * w;
    const y = height - ((p - min) / range) * (height - 6) - 3;
    return { x, y };
  });

  let line = `M ${coords[0].x.toFixed(1)} ${coords[0].y.toFixed(1)}`;
  for (let i = 0; i < coords.length - 1; i++) {
    const p0 = coords[i];
    const p1 = coords[i + 1];
    const cp1x = p0.x + (p1.x - p0.x) / 3;
    const cp1y = p0.y;
    const cp2x = p0.x + (2 * (p1.x - p0.x)) / 3;
    const cp2y = p1.y;
    line += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
  }

  const area = `${line} L ${w} ${height} L 0 ${height} Z`;
  const gradId = `sg-${color.replace("#", "")}`;

  return (
    <View style={{ height, width: "100%" }}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={color} stopOpacity={0.18} />
            <Stop offset="100%" stopColor={color} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Path d={area} fill={`url(#${gradId})`} />
        <Path d={line} fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </View>
  );
};

// ─── Ring Progress ──────────────────────────────────────────────────────────
const RingProgress = ({ pct, color, size = 28 }: { pct: number; color: string; size?: number }) => {
  const C = useColors();
  const r = 10;
  const stroke = 3;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(pct, 100) / 100) * circ;

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="12" cy="12" r={r} fill="none" stroke={C.surface03} strokeWidth={stroke} />
      <Circle
        cx="12"
        cy="12"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 12 12)"
      />
    </Svg>
  );
};

// ─── Home Skeleton ───────────────────────────────────────────────────────────
const HomeSkeleton = () => {
  const C = useColors();
  const pulse = useRef(new RNAnimated.Value(0.3)).current;
  useEffect(() => {
    const anim = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(pulse, { toValue: 0.6, duration: 850, useNativeDriver: true }),
        RNAnimated.timing(pulse, { toValue: 0.3, duration: 850, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [pulse]);

  return (
    <RNAnimated.View style={{ opacity: pulse, gap: 10, width: "100%" }}>
      <View style={{ height: 40, width: 140, backgroundColor: C.lineSubtle, borderRadius: 8 }} />
      <View style={{ height: 160, backgroundColor: C.surface02, borderRadius: 12, borderWidth: 1, borderColor: C.lineSubtle }} />
      <View style={{ flexDirection: "row", gap: 8 }}>
        <View style={{ height: 100, flex: 1, backgroundColor: C.surface02, borderRadius: 12, borderWidth: 0.5, borderColor: C.lineSubtle }} />
        <View style={{ height: 100, flex: 1, backgroundColor: C.surface02, borderRadius: 12, borderWidth: 0.5, borderColor: C.lineSubtle }} />
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <View style={{ height: 100, flex: 1, backgroundColor: C.surface02, borderRadius: 12, borderWidth: 0.5, borderColor: C.lineSubtle }} />
        <View style={{ height: 100, flex: 1, backgroundColor: C.surface02, borderRadius: 12, borderWidth: 0.5, borderColor: C.lineSubtle }} />
      </View>
      <View style={{ height: 90, backgroundColor: C.surface02, borderRadius: 12, borderWidth: 0.5, borderColor: C.lineSubtle }} />
    </RNAnimated.View>
  );
};

// ─── Helper helpers ──────────────────────────────────────────────────────────
function ymd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfWeekDate(d: Date, startDay: number) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const delta = (x.getDay() - startDay + 7) % 7;
  x.setDate(x.getDate() - delta);
  return x;
}

function rangeForPreset(preset: string, now: Date, weekStart: number) {
  const y = now.getFullYear();
  const m = now.getMonth();
  const today = ymd(now);
  if (preset === "day") return { start: today, end: today, preset: "day" };
  if (preset === "week") return { start: ymd(startOfWeekDate(now, weekStart)), end: today, preset: "week" };
  if (preset === "month") {
    const start = `${y}-${String(m + 1).padStart(2, "0")}-01`;
    return { start, end: today, preset: "month" };
  }
  return { start: today, end: today, preset: "day" };
}

const formatDuration = (secs: number) => {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

const formatTime = (total: number) => {
  const h = Math.floor(total / 3600).toString().padStart(2, "0");
  const m = Math.floor((total % 3600) / 60).toString().padStart(2, "0");
  const s = (total % 60).toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
};

const LiveRouteMap = ({ points, strokeColor }: { points: Array<{ latitude: number; longitude: number }>; strokeColor: string }) => {
  const C = useColors();
  if (!points || points.length < 2) {
    return (
      <View style={{ height: 120, width: "85%", backgroundColor: C.surface01, borderRadius: 12, borderWidth: 0.5, borderColor: C.lineSubtle, justifyContent: "center", alignItems: "center", gap: 6, marginVertical: 8 }}>
        <Text variant="paragraphS">Waiting for GPS coordinates...</Text>
      </View>
    );
  }

  const lats = points.map((p) => p.latitude);
  const lngs = points.map((p) => p.longitude);

  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  const latRange = maxLat - minLat || 0.001;
  const lngRange = maxLng - minLng || 0.001;

  const width = 300;
  const height = 120;
  const padding = 12;

  const svgPoints = points.map((p) => {
    const x = padding + ((p.longitude - minLng) / lngRange) * (width - 2 * padding);
    const y = padding + (1 - (p.latitude - minLat) / latRange) * (height - 2 * padding);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");

  const startPoint = points[0];
  const endPoint = points[points.length - 1];

  const startX = padding + ((startPoint.longitude - minLng) / lngRange) * (width - 2 * padding);
  const startY = padding + (1 - (startPoint.latitude - minLat) / latRange) * (height - 2 * padding);

  const endX = padding + ((endPoint.longitude - minLng) / lngRange) * (width - 2 * padding);
  const endY = padding + (1 - (endPoint.latitude - minLat) / latRange) * (height - 2 * padding);

  return (
    <View style={{ height: height, width: "85%", backgroundColor: C.surface01, borderRadius: 12, borderWidth: 0.5, borderColor: C.lineSubtle, overflow: "hidden", marginVertical: 8 }}>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        <Line x1="0" y1="30" x2="300" y2="30" stroke={C.surface02} strokeWidth="0.5" />
        <Line x1="0" y1="60" x2="300" y2="60" stroke={C.surface02} strokeWidth="0.5" />
        <Line x1="0" y1="90" x2="300" y2="90" stroke={C.surface02} strokeWidth="0.5" />
        <Line x1="75" y1="0" x2="75" y2="120" stroke={C.surface02} strokeWidth="0.5" />
        <Line x1="150" y1="0" x2="150" y2="120" stroke={C.surface02} strokeWidth="0.5" />
        <Line x1="225" y1="0" x2="225" y2="120" stroke={C.surface02} strokeWidth="0.5" />
        
        <Polyline
          points={svgPoints}
          fill="none"
          stroke={strokeColor}
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <Circle cx={startX} cy={startY} r="4" fill={C.primary} />
        <Circle cx={endX} cy={endY} r="5" fill={strokeColor} stroke={C.contentPrimary} strokeWidth="1" />
      </Svg>
    </View>
  );
};

const RouteMinimap = ({ routePathJson, strokeColor }: { routePathJson: string; strokeColor: string }) => {
  const C = useColors();
  const points = React.useMemo(() => {
    return parseRoutePath(routePathJson);
  }, [routePathJson]);

  if (!points) return null;

  const lats = points.map((p) => p.latitude);
  const lngs = points.map((p) => p.longitude);

  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  const latRange = maxLat - minLat || 0.001;
  const lngRange = maxLng - minLng || 0.001;

  const width = 100;
  const height = 60;
  const padding = 6;

  const svgPoints = points.map((p) => {
    const x = padding + ((p.longitude - minLng) / lngRange) * (width - 2 * padding);
    const y = padding + (1 - (p.latitude - minLat) / latRange) * (height - 2 * padding);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");

  const startPoint = points[0];
  const endPoint = points[points.length - 1];

  const startX = padding + ((startPoint.longitude - minLng) / lngRange) * (width - 2 * padding);
  const startY = padding + (1 - (startPoint.latitude - minLat) / latRange) * (height - 2 * padding);

  const endX = padding + ((endPoint.longitude - minLng) / lngRange) * (width - 2 * padding);
  const endY = padding + (1 - (endPoint.latitude - minLat) / latRange) * (height - 2 * padding);

  return (
    <View style={{ width: 100, height: 60, backgroundColor: C.surface01, borderRadius: 8, borderWidth: 0.5, borderColor: C.lineSubtle, overflow: "hidden", marginLeft: 12 }}>
      <Svg width={width} height={height}>
        <Line x1="0" y1="20" x2="100" y2="20" stroke={C.surface02} strokeWidth="0.5" />
        <Line x1="0" y1="40" x2="100" y2="40" stroke={C.surface02} strokeWidth="0.5" />
        <Line x1="33" y1="0" x2="33" y2="60" stroke={C.surface02} strokeWidth="0.5" />
        <Line x1="66" y1="0" x2="66" y2="60" stroke={C.surface02} strokeWidth="0.5" />
        
        <Polyline
          points={svgPoints}
          fill="none"
          stroke={strokeColor}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <Circle cx={startX} cy={startY} r="3" fill={C.primary} />
        <Circle cx={endX} cy={endY} r="3.5" fill={C.destructive} stroke={C.background} strokeWidth="0.8" />
      </Svg>
    </View>
  );
};

const CircularProgress = ({
  progressPct,
  size = 80,
  strokeWidth = 8,
  color: colorProp,
}: {
  progressPct: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
}) => {
  const C = useColors();
  const color = colorProp ?? C.contentPrimary;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (Math.min(progressPct, 100) / 100) * circumference;

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size}>
        <Circle
          stroke={C.surface03}
          fill="none"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
        />
        <Circle
          stroke={color}
          fill="none"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90, ${size / 2}, ${size / 2})`}
        />
      </Svg>
      <View style={{ position: "absolute", alignItems: "center", justifyContent: "center" }}>
        <Text variant="headingS" tabular>
          {Math.round(progressPct)}%
        </Text>
      </View>
    </View>
  );
};

const SLIDE_WIDTH = 300;
const KNOB_WIDTH = 56;
const THRESHOLD = SLIDE_WIDTH - KNOB_WIDTH - 4;

const SwipeToEnd = ({ onEnd }: { onEnd: () => void }) => {
  const sliderStyles = useThemedStyles(makeSliderStyles);
  const translateX = useSharedValue(0);

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      // Clamp values between 0 and the threshold on the UI thread
      translateX.value = Math.max(0, Math.min(event.translationX, THRESHOLD));
    })
    .onEnd(() => {
      if (translateX.value >= THRESHOLD * 0.8) {
        translateX.value = withTiming(THRESHOLD, { duration: 120 }, () => {
          if (onEnd) runOnJS(onEnd)();
        });
      } else {
        translateX.value = withSpring(0, {
          damping: 15,
          stiffness: 150,
        });
      }
    });

  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const progressStyle = useAnimatedStyle(() => ({
    width: translateX.value + KNOB_WIDTH,
  }));

  return (
    <View style={sliderStyles.container}>
      <Text variant="labelM" style={sliderStyles.backgroundText}>SWIPE TO END</Text>
      
      <Animated.View style={[sliderStyles.progressFill, progressStyle]} />
      
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[sliderStyles.knob, knobStyle]}>
          <Text style={sliderStyles.knobText}>›</Text>
        </Animated.View>
      </GestureDetector>
    </View>
  );
};

const makeSliderStyles = (C: Palette) => StyleSheet.create({
  container: {
    width: SLIDE_WIDTH,
    height: 64,
    backgroundColor: withAlpha(C.destructive, 0.1),
    borderRadius: 32,
    borderWidth: 1,
    borderColor: withAlpha(C.destructive, 0.25),
    justifyContent: "center",
    alignSelf: "center",
    overflow: "hidden",
    marginVertical: 12,
  },
  backgroundText: {
    position: "absolute",
    width: "100%",
    textAlign: "center",
    color: C.destructive,
    letterSpacing: 1.5,
    zIndex: 1,
  },
  progressFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: withAlpha(C.destructive, 0.2),
    zIndex: 2,
    borderRadius: 32,
  },
  knob: {
    width: KNOB_WIDTH,
    height: KNOB_WIDTH,
    borderRadius: KNOB_WIDTH / 2,
    backgroundColor: C.destructive,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 4,
    zIndex: 3,
  },
  knobText: {
    color: C.contentPrimary,
    fontSize: 28,
    fontWeight: "900",
    marginTop: -2,
  },
});

// ─── Main Component ──────────────────────────────────────────────────────────
export default function HomeScreen() {
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const C = useColors();
  const S = useThemedStyles(makeS);
  const { gridStyle } = useLayout();
  // Reactive, unlike the module-scope Dimensions.get() this replaced — see the
  // note at the top of the file. Rotation and foldables change this at runtime.
  const { height: screenHeight } = useWindowDimensions();

  // A restored vault marks onboarding complete, so the wizard — the only thing
  // that asks for location — never runs on a new phone. An OS grant cannot be
  // synced. Ask here, once per device. See services/permissions/deviceSetup.ts.
  useDeviceLocationSetup();

  const {
    isActive, platform: activePlatform, elapsedSeconds,
    activeMileage, deadMileage, targetTime, startTime,
    isPaused, isFirstOrderReceived, sessionId,
    startShift, endShift, incrementTimer, updateMileage,
    pauseShift, resumeShift, markFirstOrderReceived, reset,
  } = useActiveShift();

  const {
    profile,
    isDemoMode,
    isLoading,
    loadSettings,
    clearSampleData,
    activePlatformFilter,
    preferredVehicleId,
    isOnboardingCompleted,
    streakDays,
    isHeaderVisible,
    setHeaderVisible,
  } = useSettingsStore();

  const { accentColor, accentColorContrast, platformColor } = usePlatformTheme();

  const { t: vocab } = useVocabulary();
  const isGoalsEnabled = useFeatureEnabled("goals");

  const platformTextColor = React.useMemo(() => {
    if (!activePlatformFilter || activePlatformFilter === "all") return C.contentPrimary;
    const first = activePlatformFilter.split(",")[0];
    const cfg = PLATFORMS[first as keyof typeof PLATFORMS];
    return cfg?.textColor ?? C.contentPrimary;
  }, [activePlatformFilter]);

  // Wizard state
  const wizardSheetRef = useRef<AppBottomSheetRef>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState<"vehicle" | "platform" | "target">("vehicle");

  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [selectedPlatformId, setSelectedPlatformId] = useState<GigPlatform>("doordash");
  const [selectedPlatformIds, setSelectedPlatformIds] = useState<GigPlatform[]>(["doordash"]);
  const [targetMode, setTargetMode] = useState(false);
  const [customHours, setCustomHours] = useState(2);
  const [customMinutes, setCustomMinutes] = useState(0);

  const lastScrollY = React.useRef(0);
  const handleScroll = (event: any) => {
    const currentY = event.nativeEvent.contentOffset.y;
    const diff = currentY - lastScrollY.current;
    const contentHeight = event.nativeEvent.contentSize.height;
    const layoutHeight = event.nativeEvent.layoutMeasurement.height;
    const isNearBottom = currentY + layoutHeight >= contentHeight - 40;

    if (currentY <= 0 || isNearBottom) {
      setHeaderVisible(true);
    } else if (diff > 15 && currentY > 50) {
      setHeaderVisible(false);
    } else if (diff < -15) {
      setHeaderVisible(true);
    }
    lastScrollY.current = currentY;
  };


  // Overlay state
  const [showClockOverlay, setShowClockOverlay] = useState(false);
  const [endedShiftId, setEndedShiftId] = useState<string | null>(null);

  // Bulletin Mode — a badge unlocked this shift, celebrated after the completion modal closes.
  const [pendingBadgeId, setPendingBadgeId] = useState<string | null>(null);
  const celebrationRef = useRef<CelebrationSheetRef>(null);

  // Backup reminder — honors the user's "Backup overdue" alert toggle; dismissible for the session.
  const { data: backupStatus } = useBackupStatus(isOnboardingCompleted);
  const [backupBannerDismissed, setBackupBannerDismissed] = useState(false);

  // Odometer Prompt states
  const [showOdoPrompt, setShowOdoPrompt] = useState(false);
  const [odoPromptVehicleId, setOdoPromptVehicleId] = useState<string | null>(null);
  const [odoInput, setOdoInput] = useState("");
  const [odoError, setOdoError] = useState("");
  const [heroTab, setHeroTab] = useState<"T" | "W">("W");
  const [deadMilesAtFirstOrder, setDeadMilesAtFirstOrder] = useState(0);
  const heroTabAnim = useRef(new RNAnimated.Value(34)).current; // 34 = W position (30px tab + 4px gap)

  const sheetTranslateY = useSharedValue(screenHeight);

  useEffect(() => {
    if (!isActive) setDeadMilesAtFirstOrder(0);
  }, [isActive]);

  useEffect(() => {
    // Instant show/hide — no slow slide animation.
    sheetTranslateY.value = showClockOverlay ? 0 : screenHeight;
    // Hide the global top header when the fullscreen shift console/tracking page is open
    if (showClockOverlay) {
      setHeaderVisible(false);
    } else {
      setHeaderVisible(true);
    }
    // screenHeight is a dependency now that it is reactive: if the window resizes
    // while the overlay is closed, the sheet must be re-parked off the NEW bottom
    // edge, or a strip of it reappears on screen.
  }, [showClockOverlay, screenHeight]);

  // If the user tapped the floating shift pill, open the live console (not just land on home)
  // when the app comes to the foreground.
  useEffect(() => {
    const checkConsole = () => {
      if (Platform.OS === "web") return;
      try {
        if (CommaTracker.consumeOpenConsole()) setShowClockOverlay(true);
      } catch {}
    };
    checkConsole(); // cold start / mount
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") checkConsole();
    });
    return () => sub.remove();
  }, []);

  const animatedSheetStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: sheetTranslateY.value }],
    };
  });

  // Present the celebration once the "Shift Completed" modal has closed, so the
  // two moments don't overlap. Small delay lets the modal finish dismissing.
  useEffect(() => {
    if (!endedShiftId && pendingBadgeId) {
      const id = pendingBadgeId;
      setPendingBadgeId(null);
      const t = setTimeout(() => celebrationRef.current?.celebrate(id), 350);
      return () => clearTimeout(t);
    }
  }, [endedShiftId, pendingBadgeId]);

  // Queries
  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles"],
    queryFn: getVehicles,
    enabled: isOnboardingCompleted,
  });

  const isFirstWizardStep = React.useMemo(() => {
    return wizardStep === "platform";
  }, [wizardStep]);

  const { data: todayStats } = useQuery({
    queryKey: ["analytics", "today", activePlatformFilter],
    queryFn: () => getTodayStats(activePlatformFilter),
    enabled: isOnboardingCompleted,
  });

  const { data: weekStats } = useQuery({
    queryKey: ["analytics", "week", activePlatformFilter],
    queryFn: () => getWeekStats(activePlatformFilter),
    enabled: isOnboardingCompleted,
  });

  // Statically target today for homepage metrics
  const todayStr = ymd(new Date());

  const { data: rangeStats, isLoading: isRangeLoading } = useQuery({
    queryKey: ["analytics", "todayRange", activePlatformFilter, todayStr],
    queryFn: () => {
      // Build local-midnight boundaries — new Date("YYYY-MM-DD") parses as UTC
      // midnight, which lands hours into the day in non-UTC timezones and silently
      // excludes shifts logged earlier that day.
      const start = new Date(); start.setHours(0, 0, 0, 0);
      const end = new Date(); end.setHours(23, 59, 59, 999);
      return getPeriodStats(start, end, activePlatformFilter);
    },
    enabled: isOnboardingCompleted,
  });

  const { data: financialOverview } = useQuery({
    queryKey: ["analytics", "financial", activePlatformFilter, todayStr],
    queryFn: () => {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      const end = new Date(); end.setHours(23, 59, 59, 999);
      return getFinancialOverviewForRange(start, end, activePlatformFilter, 0);
    },
    enabled: isOnboardingCompleted,
  });

  // The mileage write-off is a tax estimate, not real money — it must never be subtracted from
  // the headline earnings figure, and it only applies at all if the active vehicle is actually
  // eligible (a saved tax profile — including an explicit opt-out — always wins over the
  // researched country/vehicle-type default; see getEffectiveMileageRate).
  const { data: mileageRate } = useQuery({
    queryKey: ["analytics", "mileage-rate", todayStr],
    queryFn: async () => {
      const vehicle = await getActiveVehicle();
      if (!vehicle) return null;
      return getEffectiveMileageRate(vehicle.id, new Date().getFullYear(), profile?.country || "CA", vehicle.type);
    },
    enabled: isOnboardingCompleted,
  });

  const { data: weeklyGoals = [] } = useQuery({
    queryKey: ["analytics", "goals", "weekly"],
    queryFn: () => getGoalProgress("weekly"),
    enabled: isOnboardingCompleted,
  });

  const { data: recentShifts = [] } = useQuery({
    queryKey: ["shifts", "recent", activePlatformFilter],
    queryFn: async () => {
      const filters = activePlatformFilter && activePlatformFilter !== "all"
        ? { platforms: activePlatformFilter.split(",") }
        : undefined;
      const data = await getShiftsPaginated(1, filters);
      return data.slice(0, 3);
    },
    enabled: isOnboardingCompleted,
  });

  const { data: unreconciledShifts = [], refetch: refetchUnreconciled } = useQuery({
    queryKey: ["shifts", "unreconciled"],
    queryFn: () => getUnreconciledShifts(),
    enabled: isOnboardingCompleted,
  });

  const { data: gpsOnlyShifts = [], refetch: refetchGpsOnly } = useQuery({
    queryKey: ["shifts", "gps-only"],
    queryFn: () => getGPSOnlyShifts(),
    enabled: isOnboardingCompleted,
  });


  // Load configuration on mount
  useEffect(() => {
    loadSettings();
    setHeaderVisible(true);
  }, []);

  useEffect(() => {
    RNAnimated.spring(heroTabAnim, {
      toValue: heroTab === "T" ? 0 : 34,
      useNativeDriver: true,
      tension: 320,
      friction: 22,
    }).start();
  }, [heroTab]);



  if (isLoading) {
    return (
      <SafeAreaView style={[S.root, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={C.contentSecondary} />
      </SafeAreaView>
    );
  }

  if (!isOnboardingCompleted) {
    return <OnboardingWizard />;
  }

  // Derive stats
  const currentStats = {
    gross: rangeStats?.gross ?? 0,
    tips: rangeStats?.tips ?? 0,
    bonus: rangeStats?.bonus ?? 0,
    miles: (rangeStats?.activeMileage ?? 0) + (rangeStats?.deadMileage ?? 0),
    duration: rangeStats?.durationSeconds ?? 0,
    count: rangeStats?.count ?? 0,
    rate: (rangeStats && rangeStats.durationSeconds > 0) ? ((rangeStats.gross + rangeStats.tips + rangeStats.bonus) / (rangeStats.durationSeconds / 3600)) : 0,
    expenses: financialOverview?.expense ?? 0,
  };

  // Real money earned — never reduced by the mileage write-off, which is a tax estimate, not
  // an expense. Shown separately (see writeOff below) so it can never be mistaken for lost income.
  const writeOff    = mileageRate ? calculateMileageWriteOff(currentStats.miles, mileageRate) : 0;
  const netEarnings = currentStats.gross + currentStats.tips + currentStats.bonus;
  const totalMiles  = activeMileage + deadMileage;
  // Live shift's own write-off (distinct from `writeOff`, which is today's aggregate across all shifts).
  const sessionWriteOff = mileageRate ? calculateMileageWriteOff(totalMiles, mileageRate) : 0;

  // Derive weekly summary metrics dynamically (avoiding any hardcoding)
  const weeklyGross = weekStats?.gross ?? 0;
  const weeklyTips = weekStats?.tips ?? 0;
  const weeklyBonus = weekStats?.bonus ?? 0;
  const weeklyMiles = (weekStats?.activeMileage ?? 0) + (weekStats?.deadMileage ?? 0);
  const weeklyWriteOff = mileageRate ? calculateMileageWriteOff(weeklyMiles, mileageRate) : 0;
  const weeklyNet = weeklyGross + weeklyTips + weeklyBonus;
  const weeklyShiftsCount = weekStats?.count ?? 0;
  const weeklyDuration = weekStats?.durationSeconds ?? 0;
  const weeklyRate = weeklyDuration > 0 ? (weeklyGross + weeklyTips + weeklyBonus) / (weeklyDuration / 3600) : 0;

  // Cards below the hero card follow the selected T/W tab
  const displayStats = heroTab === "T"
    ? { duration: currentStats.duration, miles: currentStats.miles, rate: currentStats.rate }
    : { duration: weeklyDuration, miles: weeklyMiles, rate: weeklyRate };

  // Sparkline calculation
  const sparkPoints = [
    todayStats?.gross ?? 0,
    (weekStats?.gross ?? 0) / 7,
    currentStats.gross
  ].map(v => Math.max(0, v));

  const fmt = (val: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: profile?.locale?.currency || "USD",
    }).format(val);
  };


  const openWizard = () => {
    if (isDemoMode) {
      Alert.alert(
        "Demo Mode Active",
        "You cannot start tracking live drives while Demo Mode is active. Please turn off Demo Mode in Settings to use real tracking.",
        [
          { text: "Go to Settings", onPress: () => router.push("/settings") },
          { text: "Cancel", style: "cancel" }
        ]
      );
      return;
    }

    setTargetMode(false);
    setCustomHours(2);
    setCustomMinutes(0);

    const hasMultipleVehicles = vehicles && vehicles.length > 1;

    const preferred = vehicles.find((v: any) => v.id === preferredVehicleId)?.id ?? vehicles[0]?.id;
    setSelectedVehicleId(preferred ?? "default_vehicle_1");

    setWizardStep("platform");
    setShowWizard(true);
    wizardSheetRef.current?.present();
  };

  const handleSimulateGPSMove = () => {
    const unit = profile?.distanceUnit ?? "mi";
    const conversionFactor = unit === "mi" ? 1609.344 : 1000.0;
    const distanceConverted = 100.0 / conversionFactor;
    
    if (isFirstOrderReceived) {
      updateMileage(distanceConverted, 0);
    } else {
      updateMileage(0, distanceConverted);
    }
  };

  const nextStep = () => {
    const hasMultipleVehicles = vehicles && vehicles.length > 1;

    if (wizardStep === "platform") {
      if (hasMultipleVehicles) {
        setWizardStep("vehicle");
      } else {
        setWizardStep("target");
      }
    } else if (wizardStep === "vehicle") {
      setWizardStep("target");
    } else if (wizardStep === "target") {
      submitWizard();
    }
  };

  const prevStep = () => {
    const hasMultipleVehicles = vehicles && vehicles.length > 1;

    if (wizardStep === "target") {
      if (hasMultipleVehicles) {
        setWizardStep("vehicle");
      } else {
        setWizardStep("platform");
      }
    } else if (wizardStep === "vehicle") {
      setWizardStep("platform");
    }
  };

  const submitWizard = async () => {
    let finalTargetTimeEpoch: number | null = null;
    if (targetMode) {
      const d = new Date();
      d.setHours(d.getHours() + customHours);
      d.setMinutes(d.getMinutes() + customMinutes);
      finalTargetTimeEpoch = d.getTime();
    }
    const vId = selectedVehicleId || "default_vehicle_1";
    
    const finalPlatformValue = selectedPlatformIds.join(",");

    reset(); // FORCE FRESH START
    await startShift(finalPlatformValue, vId, finalTargetTimeEpoch);
    setShowWizard(false);
    wizardSheetRef.current?.dismiss();
    setShowClockOverlay(true);
  };

  const handleEndShift = async () => {
    const payload = await endShift();
    reset();
    const newBadges = await useSettingsStore.getState().evaluateGamification();
    queryClient.invalidateQueries({ queryKey: ["analytics"] });
    queryClient.invalidateQueries({ queryKey: ["shifts"] });
    setShowClockOverlay(false);

    // Bulletin Mode — celebrate the first freshly-unlocked badge from this shift.
    if (newBadges.length > 0) {
      setPendingBadgeId(newBadges[0]);
    }

    if (payload?.shiftId) {
      setEndedShiftId(payload.shiftId);

      // Check if odometer prompt is due:
      // 1. Today is the 1st of the month, or
      // 2. The oldest un-reconciled gps_only shift is >= 14 days old
      const today = new Date();
      const isFirstOfMonth = today.getDate() === 1;

      let is14DaysOld = false;
      const gpsOnly = await getGPSOnlyShifts();
      if (gpsOnly.length > 0) {
        const oldestDate = new Date(gpsOnly[0].startTime);
        const diffTime = Math.abs(today.getTime() - oldestDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays >= 14) {
          is14DaysOld = true;
        }
      }

      if ((isFirstOfMonth || is14DaysOld) && payload.vehicleId) {
        setOdoPromptVehicleId(payload.vehicleId);
        setShowOdoPrompt(true);
      }
    }
  };

  return (
    <SafeAreaView style={S.root} edges={["top", "left", "right", "bottom"]}>
      <ScrollView
        contentContainerStyle={[S.scroll, { paddingBottom: 24 }, gridStyle]}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        
        {/* ── Header ──────────────────────────────────────────────────── */}
        <View style={S.header}>
          <View style={S.headerLeft}>
            <View style={S.avatar}>
              <Text variant="labelM">
                {profile?.displayName ? profile.displayName.substring(0, 1).toUpperCase() : "D"}
              </Text>
            </View>
            <View style={{ gap: 2 }}>
              <Text variant="headingM" style={S.headerTitle}>{getGreeting()}, {profile?.displayName || "Driver"}</Text>
              <Text variant="paragraphS" className="text-content-secondary">{getFormattedHeaderDate()}</Text>
            </View>
          </View>
        </View>

        {/* ── Unreconciled Shifts Banner ───────────────────────────────── */}
        {!isActive && unreconciledShifts.length > 0 && (
          <Pressable
            onPress={() => router.push({ pathname: "/shift/add", params: { shiftId: unreconciledShifts[0].id } })}
            accessibilityRole="button"
            style={{
              backgroundColor: withAlpha(C.warning, 0.12),
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: withAlpha(C.warning, 0.3),
              borderRadius: 16,
              padding: 16,
              marginHorizontal: 16,
              marginBottom: 16,
              flexDirection: "row" as const,
              alignItems: "center" as const,
              justifyContent: "space-between" as const,
              gap: 12
            }}
          >
            <View style={{ flex: 1, gap: 4 }}>
              <Text variant="labelXs" style={{ color: C.warning }}>
                Action Required
              </Text>
              <Text variant="labelM" style={{ lineHeight: 18 }}>
                You have {unreconciledShifts.length} un-reconciled shift{unreconciledShifts.length > 1 ? "s" : ""} from {new Date(unreconciledShifts[0].startTime).toLocaleDateString([], { weekday: 'long' })}. Tap to enter earnings.
              </Text>
            </View>
            <Text variant="headingS" style={{ color: C.warning }}>›</Text>
          </Pressable>
        )}

        {/* ── Backup Reminder Banner ───────────────────────────────────── */}
        {/* Only nudge once there's data worth protecting (at least one shift) — and never in demo
            mode, where the "data" is seeded sample records the driver is about to throw away. */}
        {!isActive && !isDemoMode && backupStatus?.isOverdue && !backupBannerDismissed && recentShifts.length > 0 && (
          <Pressable
            onPress={() => router.push("/settings/backup")}
            accessibilityRole="button"
            style={{
              backgroundColor: withAlpha(C.info, 0.12),
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: withAlpha(C.info, 0.3),
              borderRadius: 16,
              padding: 16,
              marginHorizontal: 16,
              marginBottom: 16,
              flexDirection: "row" as const,
              alignItems: "center" as const,
              justifyContent: "space-between" as const,
              gap: 12,
            }}
          >
            <View style={{ flex: 1, gap: 4 }}>
              <Text variant="labelXs" style={{ color: C.info }}>
                Protect your data
              </Text>
              <Text variant="labelM" style={{ lineHeight: 18 }}>
                {backupStatus.daysSince === null
                  ? "Your data lives only on this device. Turn on Cloud Sync to keep it safe on Google Drive."
                  : `It's been ${backupStatus.daysSince} day${backupStatus.daysSince === 1 ? "" : "s"} since your data synced. Tap to open Cloud Sync.`}
              </Text>
            </View>
            <Pressable
              onPress={(e) => {
                e.stopPropagation?.();
                setBackupBannerDismissed(true);
              }}
              accessibilityRole="button"
              accessibilityLabel="Dismiss"
              hitSlop={10}
              style={{ paddingHorizontal: 4 }}
            >
              <Text style={{ color: C.contentMuted, fontSize: 18, fontWeight: "700" }}>✕</Text>
            </Pressable>
          </Pressable>
        )}



        {isRangeLoading ? (
          <HomeSkeleton />
        ) : (
          <>
            {/* ── Today / Week Hero Card ─────────────────────────────────────── */}
            <View style={{ backgroundColor: C.surface02, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, borderColor: C.lineSubtle, paddingVertical: 24, paddingHorizontal: 20, flexDirection: "row", alignItems: "stretch", gap: 16 }}>
              {/* Left: content */}
              <View style={{ flex: 1, gap: 12 }}>
                <Text variant="labelXs" className="text-content-muted">
                  {heroTab === "T" ? "TODAY · EARNED" : "THIS WEEK · EARNED"}
                </Text>
                <Text
                  variant="display"
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.6}
                  tabular
                  style={{ letterSpacing: -1 }}
                >
                  {heroTab === "T" ? fmt(netEarnings) : fmt(weeklyNet)}
                </Text>
                <Text variant="labelM" className="text-content-secondary" tabular>
                  {heroTab === "T"
                    ? `${fmt(weeklyNet)} this week · ${weeklyShiftsCount} ${weeklyShiftsCount === 1 ? vocab('session') : vocab('session_plural')}`
                    : `${fmt(netEarnings)} today · ${weeklyShiftsCount} ${weeklyShiftsCount === 1 ? vocab('session') : vocab('session_plural')}`}
                </Text>
              </View>

              {/* Right: T / W vertical tab strip inside a pill container */}
              <View style={{ justifyContent: "center" }}>
                <View style={{ backgroundColor: C.surface01, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: C.lineSubtle, padding: 4, gap: 4 }}>
                  {/* Sliding active indicator */}
                  <RNAnimated.View
                    style={{
                      position: "absolute",
                      top: 4,
                      left: 4,
                      width: 30,
                      height: 30,
                      borderRadius: 12,
                      backgroundColor: accentColor,
                      transform: [{ translateY: heroTabAnim }],
                    }}
                  />
                  {(["T", "W"] as const).map((tab) => (
                    <Pressable
                      key={tab}
                      onPress={() => setHeroTab(tab)}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: heroTab === tab }}
                      style={{ width: 30, height: 30, borderRadius: 12, alignItems: "center", justifyContent: "center" }}
                    >
                      <Text variant="labelM" style={{ color: heroTab === tab ? accentColorContrast : C.contentMuted }}>
                        {tab}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>

            {/* ── 3-Column Stats Row ───────────────────────────────────────── */}
            <View style={{ flexDirection: "row", gap: 10, marginVertical: 4 }}>
              {/* Card 1: Time */}
              <View style={{ flex: 1, backgroundColor: C.surface02, borderWidth: StyleSheet.hairlineWidth, borderColor: C.lineSubtle, borderRadius: 16, paddingVertical: 18, paddingHorizontal: 12, alignItems: "center", justifyContent: "center", gap: 4 }}>
                <Text variant="headingM" tabular style={{ textAlign: "center" }}>
                  {(displayStats.duration / 3600).toFixed(1)}h
                </Text>
                <Text variant="labelXs" className="text-content-muted" style={{ textAlign: "center" }}>
                  {vocab('session').charAt(0).toUpperCase() + vocab('session').slice(1) + " time"}
                </Text>
              </View>

              {/* Card 2: Distance */}
              <View style={{ flex: 1, backgroundColor: C.surface02, borderWidth: StyleSheet.hairlineWidth, borderColor: C.lineSubtle, borderRadius: 16, paddingVertical: 18, paddingHorizontal: 12, alignItems: "center", justifyContent: "center", gap: 4 }}>
                <Text variant="headingM" tabular style={{ textAlign: "center" }}>
                  {displayStats.miles.toFixed(1)}{profile?.distanceUnit ?? "km"}
                </Text>
                <Text variant="labelXs" className="text-content-muted" style={{ textAlign: "center" }}>Driven</Text>
              </View>

              {/* Card 3: Hourly rate */}
              <View style={{ flex: 1, backgroundColor: C.surface02, borderWidth: StyleSheet.hairlineWidth, borderColor: C.lineSubtle, borderRadius: 16, paddingVertical: 18, paddingHorizontal: 12, alignItems: "center", justifyContent: "center", gap: 4 }}>
                <Text variant="headingM" tabular style={{ textAlign: "center" }}>
                  {fmt(displayStats.rate)}
                </Text>
                <Text variant="labelXs" className="text-content-muted" style={{ textAlign: "center" }}>Per hour</Text>
              </View>
            </View>

            {/* ── Weekly Goal Progress Card ────────────────────────────────── */}
            {isGoalsEnabled && weeklyGoals.slice(0, 1).map((g: any) => {
              const current = g.currentValue ?? 0;
              const target = g.targetValue ?? 1;
              const percent = Math.min(100, Math.round((current / target) * 100));
              return (
                <Pressable
                  key={g.id}
                  onPress={() => router.push("/goals")}
                  accessibilityRole="button"
                  style={{ backgroundColor: C.surface02, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, borderColor: C.lineSubtle, padding: 16, gap: 12 }}
                >
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text variant="labelXs" style={{ color: accentColor }}>
                        Weekly Thermometer
                      </Text>
                      <Text variant="headingM" style={{ letterSpacing: -0.5 }}>
                        {g.label}
                      </Text>
                      <Text variant="labelM" className="text-content-secondary" tabular style={{ marginTop: 2 }}>
                        {g.unit === "currency" ? fmt(current) : `${current.toFixed(1)} hrs`} of {g.unit === "currency" ? fmt(target) : `${target} hrs`}
                      </Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: withAlpha(C.warning, 0.12), paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 0.5, borderColor: withAlpha(C.warning, 0.3) }}>
                          <Text style={{ fontSize: 12, marginRight: 2 }}>🔥</Text>
                          <Text variant="labelXs" tabular style={{ color: C.warning }}>{streakDays} DAY STREAK</Text>
                        </View>
                        <View style={{ backgroundColor: percent >= 100 ? withAlpha(accentColor, 0.15) : C.surface04, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 0.5, borderColor: percent >= 100 ? withAlpha(accentColor, 0.25) : C.lineStrong }}>
                          <Text variant="labelXs" tabular style={{ color: percent >= 100 ? accentColor : C.contentSecondary }}>{percent}% DONE</Text>
                        </View>
                      </View>
                    </View>
                    <CircularProgress progressPct={percent} color={accentColor} size={90} strokeWidth={8} />
                  </View>
                </Pressable>
              );
            })}

            {/* ── Finish Setting Up ─────────────────────────────────────────
                Holds the config the onboarding wizard defers — asked here, next to the numbers
                each item sharpens, rather than in front of them. Removes itself once done. */}
            <ActivationChecklist />

            {/* ── Recent Sessions ────────────────────────────────────────── */}
            <View style={{ gap: 10, marginTop: 4 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 4 }}>
                <Text variant="labelXs" className="text-content-secondary">
                  Recent {vocab('session_plural')}
                </Text>
                {recentShifts && recentShifts.length > 0 && (
                  <Pressable onPress={() => router.push("/shifts")} accessibilityRole="button">
                    <Text variant="labelM" style={{ color: accentColor }}>View All</Text>
                  </Pressable>
                )}
              </View>
              {recentShifts && recentShifts.length > 0 ? (
                recentShifts.map((shift: any) => {
                  const durationHours = (shift.durationSeconds / 3600).toFixed(1);
                  const shiftMiles = (shift.activeMileage || 0) + (shift.deadMileage || 0);
                  // Real money earned — mileage is a tax estimate, not an expense, so it never
                  // reduces this (matches netEarnings above).
                  const totalRevenue = shift.grossRevenue + shift.tipsRevenue + (shift.bonusAmount || 0);
                  const totalMiles = shiftMiles.toFixed(0);
                  
                  return (
                    <Pressable
                      key={shift.id}
                      onPress={() => router.push({ pathname: "/shifts/[id]", params: { id: shift.id, from: "dashboard" } })}
                      accessibilityRole="button"
                      style={{
                        backgroundColor: C.surface02,
                        borderRadius: 12,
                        borderWidth: 0.5,
                        borderColor: C.lineSubtle,
                        padding: 14,
                        flexDirection: "row" as const,
                        justifyContent: "space-between" as const,
                        alignItems: "center" as const
                      }}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1, marginRight: 8 }}>
                        <PlatformBadge platform={shift.platform} size="md" />
                        <View style={{ gap: 2, flex: 1 }}>
                          <Text variant="labelM" numberOfLines={1}>
                            {PLATFORMS[shift.platform as GigPlatform] ? PLATFORMS[shift.platform as GigPlatform]?.label : (shift.platform || "Trip")}
                          </Text>
                          <Text variant="paragraphS" className="text-content-secondary" tabular numberOfLines={1}>
                            {durationHours}h • {totalMiles} {profile?.distanceUnit ?? "mi"}
                          </Text>
                        </View>
                      </View>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                        <View style={{ alignItems: "flex-end", gap: 2 }}>
                          <Text variant="labelL" tabular style={{ color: accentColor }}>
                            {new Intl.NumberFormat("en-US", { style: "currency", currency: profile?.locale?.currency || "USD" }).format(totalRevenue)}
                          </Text>
                          <Text variant="paragraphS" tabular>
                            {new Intl.NumberFormat("en-US", { style: "currency", currency: profile?.locale?.currency || "USD" }).format(totalRevenue / (shift.durationSeconds / 3600 || 1))}/hr
                          </Text>
                        </View>
                        {shift.routePath && (
                          <RouteMinimap
                            routePathJson={shift.routePath}
                            strokeColor={PLATFORMS[shift.platform as GigPlatform]?.color || accentColor}
                          />
                        )}
                      </View>
                    </Pressable>
                  );
                })
              ) : (
                // A driver with no shifts has never seen what Comma is for. This is the last
                // place left to show them, so it carries the same promise the reveal does —
                // and an actual way to act on it.
                <EmptyState
                  icon="clock"
                  title={vocab('no_sessions_yet')}
                  message={`Log one and Comma will show you what it was really worth — after tax and mileage, not just the gross the app paid you.`}
                  actionLabel="Log a shift"
                  onAction={() => router.push("/shift/add")}
                  className="bg-surface-02 border border-line-subtle rounded-lg py-8"
                />
              )}
            </View>

            {/* Active-shift timer lives in the bottom action bar (single source) — no duplicate banner here. */}

            {/* ── Mileage Write-off Tip ─────────────────────────────────────────
                Only shown when the active vehicle is actually eligible (a saved tax profile —
                including an explicit opt-out — always wins over the registry default). This
                is an estimated tax deduction, not money earned — kept out of the headline
                "EARNED" figure above. */}
            {currentStats.miles > 0 && mileageRate?.deductionMethod === "standard_mileage" && writeOff > 0 && (
              <View style={S.tipCard}>
                <Text style={{ fontSize: 13 }}>🚗</Text>
                <Text variant="paragraphS" className="text-content-secondary" style={{ flex: 1, lineHeight: 18 }}>
                  At {mileageRate.ratePrimary != null ? `$${mileageRate.ratePrimary}` : ""}/{profile?.distanceUnit ?? "mi"} you've got an est. <Text variant="paragraphS" tabular style={{ color: C.warning, fontWeight: "bold" }}>{fmt(writeOff)}</Text> tax write-off on <Text variant="paragraphS" tabular style={{ fontWeight: "bold", color: C.contentPrimary }}>{currentStats.miles.toFixed(1)}</Text> {profile?.distanceUnit ?? "mi"} today.
                </Text>
              </View>
            )}

            {/* ── Demo Mode Banner (Moved to bottom) ────────────────────────── */}
            {isDemoMode && (
              <View style={S.demoBanner}>
                <Text style={S.demoText}>Demo Mode Active (Sample Data)</Text>
                <Pressable onPress={clearSampleData} accessibilityRole="button" style={S.demoBtn}>
                  <Text style={S.demoBtnText}>Clear Data</Text>
                </Pressable>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* ── Fixed Bottom Action Bar ────────────────────────────────────────── */}
      <View style={{ borderTopWidth: 1, borderTopColor: C.lineSubtle, backgroundColor: C.background, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12 }}>
        <View style={{ flexDirection: "row", backgroundColor: C.surface02, borderRadius: 16, borderWidth: 1, borderColor: C.lineSubtle, padding: 4, gap: 4 }}>

          {/* Left: Log Expense */}
          <ScalePressable
            onPress={() => router.push("/expense/add")}
            style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 10, borderRadius: 12, backgroundColor: "transparent" }}
          >
            <ReceiptText color={C.contentSecondary} size={13} strokeWidth={2} />
            <Text style={{ fontSize: 11, fontWeight: "600", color: C.contentSecondary, letterSpacing: 0.1 }}>Expense</Text>
          </ScalePressable>

          {/* Center: Start Shift or Active Shift */}
          {!isActive ? (
            unreconciledShifts.length > 0 ? (
              <ScalePressable
                onPress={() => router.push({ pathname: "/shift/add", params: { shiftId: unreconciledShifts[0].id } })}
                style={{ flex: 1.2, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 10, borderRadius: 12, backgroundColor: withAlpha(C.warning, 0.2), borderWidth: 1, borderColor: C.warning }}
              >
                <AlertCircle color={C.warning} size={13} strokeWidth={2.5} />
                <Text style={{ fontSize: 11, fontWeight: "800", color: C.warning, letterSpacing: 0.1 }}>Reconcile</Text>
              </ScalePressable>
            ) : (
              <ScalePressable
                onPress={openWizard}
                style={{ flex: 1.2, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 10, borderRadius: 12, backgroundColor: accentColor, borderWidth: 1, borderColor: accentColor }}
              >
                <Play color={accentColorContrast} size={13} fill={accentColorContrast} strokeWidth={2.5} />
                <Text style={{ fontSize: 11, fontWeight: "800", color: accentColorContrast, letterSpacing: 0.1 }}>{vocab('start_cta')}</Text>
              </ScalePressable>
            )
          ) : (
            <ScalePressable
              onPress={() => setShowClockOverlay(true)}
              style={{ flex: 1.2, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 10, borderRadius: 12, backgroundColor: C.surface04, borderWidth: 1, borderColor: C.lineSubtle }}
            >
              <View style={[S.pulseDot, { backgroundColor: accentColor }]} />
              <Text tabular style={{ fontSize: 11, fontWeight: "800", color: C.contentPrimary, letterSpacing: 0.1 }}>{formatTime(elapsedSeconds)}</Text>
            </ScalePressable>
          )}

          {/* Right: Log Past Shift */}
          <ScalePressable
            onPress={() => router.push("/shift/add")}
            style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 10, borderRadius: 12, backgroundColor: "transparent" }}
          >
            <Calendar color={C.contentSecondary} size={13} strokeWidth={2} />
            <Text style={{ fontSize: 11, fontWeight: "600", color: C.contentSecondary, letterSpacing: 0.1 }}>
              Log {vocab('session').charAt(0).toUpperCase() + vocab('session').slice(1)}
            </Text>
          </ScalePressable>

        </View>
      </View>

      {/* ── Fullscreen Clock Overlay ── */}
      <Animated.View style={[StyleSheet.absoluteFill, { zIndex: 10000, backgroundColor: C.background }, animatedSheetStyle]}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <SafeAreaView style={S.clockOverlay}>
            <View style={S.clockHeader}>
              <Text variant="headingS">{vocab('session').charAt(0).toUpperCase() + vocab('session').slice(1)} Console</Text>
              <ScalePressable onPress={() => setShowClockOverlay(false)} style={S.clockCloseBtn}>
                <Text variant="labelM">Minimize</Text>
              </ScalePressable>
            </View>

            <View style={S.clockBody}>
              <View style={{ alignItems: "center", gap: 14, paddingVertical: 8 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  {activePlatform && PLATFORMS[activePlatform as GigPlatform] && <PlatformLogo id={activePlatform as string} size={16} />}
                  <Text variant="labelXs" className="text-content-secondary">
                    {PLATFORMS[activePlatform as GigPlatform]?.label ?? activePlatform ?? `Active ${vocab('session')}`}
                  </Text>
                </View>
                <Text
                  tabular
                  style={[S.clockDigits, { fontSize: 56, lineHeight: 68, paddingVertical: 4, includeFontPadding: true }]}
                  numberOfLines={1}
                >
                  {formatTime(elapsedSeconds)}
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: isPaused ? C.warning : accentColor }} />
                  <Text variant="labelXs" style={{ color: isPaused ? C.warning : C.contentSecondary }}>{isPaused ? "Paused" : "Tracking"}</Text>
                  <Text variant="paragraphS">
                    · since {startTime ? new Date(startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: profile?.locale?.timeFormat !== "24h" }) : "—"}
                  </Text>
                </View>
              </View>

              <View style={{ width: "92%", backgroundColor: C.surface02, borderRadius: 16, borderWidth: 1, borderColor: C.lineSubtle, padding: 16, gap: 14 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text variant="labelXs" className="text-content-muted">Current Mileage</Text>
                  <View style={{
                    backgroundColor: isFirstOrderReceived ? withAlpha(accentColor, 0.12) : withAlpha(C.warning, 0.12),
                    borderRadius: 8,
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderWidth: 0.5,
                    borderColor: isFirstOrderReceived ? withAlpha(accentColor, 0.25) : withAlpha(C.warning, 0.25)
                  }}>
                    <Text variant="labelXs" style={{ color: isFirstOrderReceived ? accentColor : C.warning }}>
                      {isFirstOrderReceived ? vocab('active_miles') : vocab('dead_miles')}
                    </Text>
                  </View>
                </View>

                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}>
                  <View>
                    <Text variant="headingXl" tabular style={{ paddingVertical: 2 }}>
                      {totalMiles.toFixed(2)}
                      <Text variant="paragraphM"> {profile?.distanceUnit ?? "mi"}</Text>
                    </Text>
                    <Text variant="paragraphS" className="text-content-secondary" style={{ marginTop: 2 }}>
                      {vocab('active_miles').charAt(0).toUpperCase() + vocab('active_miles').slice(1)}: <Text variant="paragraphS" tabular style={{ color: C.contentPrimary, fontWeight: "bold" }}>{(activeMileage - deadMilesAtFirstOrder).toFixed(1)}</Text> | {vocab('dead_miles').charAt(0).toUpperCase() + vocab('dead_miles').slice(1)}: <Text variant="paragraphS" tabular style={{ color: C.contentPrimary, fontWeight: "bold" }}>{deadMilesAtFirstOrder.toFixed(1)}</Text>
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text variant="headingM" tabular style={{ paddingVertical: 1 }}>{fmt(sessionWriteOff)}</Text>
                    <Text variant="paragraphS" className="text-content-secondary">write-off value</Text>
                  </View>
                </View>

                <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
                  <ScalePressable onPress={() => isPaused ? resumeShift() : pauseShift()} style={[S.clockSecBtn, { flex: 1 }]}>
                    {isPaused
                      ? <><PlayIcon size={10} color={C.contentPrimary} /><Text variant="labelM" style={S.clockSecBtnText}>Resume</Text></>
                      : <><View style={{ width: 8, height: 8, backgroundColor: C.warning, borderRadius: 1 }} /><Text variant="labelM" style={[S.clockSecBtnText, { color: C.warning }]}>Pause</Text></>
                    }
                  </ScalePressable>

                  {isFirstOrderReceived ? (
                      <View
                        style={[S.clockSecBtn, { flex: 1, borderColor: C.lineStrong, backgroundColor: C.surface04, opacity: 0.8, flexDirection: "column", gap: 2 }]}
                      >
                        <Text style={{ fontSize: 11, fontWeight: "800", color: accentColor }}>✓ Active Mode On</Text>
                        {deadMilesAtFirstOrder > 0 && (
                          <Text variant="paragraphS" className="text-content-secondary" tabular>
                            {deadMilesAtFirstOrder.toFixed(1)} {profile?.distanceUnit ?? "mi"} dead
                          </Text>
                        )}
                      </View>
                    ) : (
                      <ScalePressable
                        onPress={() => {
                          setDeadMilesAtFirstOrder(activeMileage);
                          markFirstOrderReceived();
                        }}
                        style={[S.clockSecBtn, { flex: 1, borderColor: accentColor, backgroundColor: withAlpha(accentColor, 0.12) }]}
                      >
                        <View style={{ width: 8, height: 8, backgroundColor: accentColor, borderRadius: 4 }} />
                        <Text variant="labelM" style={[S.clockSecBtnText, { color: accentColor }]}>Got First Order</Text>
                      </ScalePressable>
                    )
                  }
                </View>
              </View>
            </View>

            <View style={{ padding: 14, gap: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 8 }}>
                <View style={[S.pulseDot, { backgroundColor: accentColor, width: 6, height: 6, borderRadius: 3 }]} />
                <Text variant="labelXs" className="text-content-secondary">GPS is collecting data</Text>
              </View>
              <SwipeToEnd key={sessionId || "idle"} onEnd={handleEndShift} />
            </View>
          </SafeAreaView>
        </GestureHandlerRootView>
      </Animated.View>

      {/* ── Shift Completed Modal ─────────────────────────────────────── */}
      <Modal visible={!!endedShiftId} transparent animationType="fade">
        <View style={S.wizardOverlay}>
          <View style={[S.wizardContent, { alignItems: "center", paddingVertical: 32, gap: 20 }]}>
            <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: withAlpha(accentColor, 0.12), justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: withAlpha(accentColor, 0.25) }}>
              <SquareIcon size={24} color={accentColor} />
            </View>
            <View style={{ alignItems: "center", gap: 8 }}>
              <Text variant="headingL" style={{ letterSpacing: 0.5 }}>Shift Completed</Text>
              <Text variant="paragraphM" style={{ textAlign: "center", paddingHorizontal: 20, lineHeight: 20 }}>
                Your GPS tracking data, mileage, and duration have been securely saved to the local database.
              </Text>
            </View>
            <View style={{ width: "100%", gap: 12, marginTop: 16 }}>
              <Pressable
                onPress={() => {
                  const sId = endedShiftId;
                  setEndedShiftId(null);
                  router.push({
                    pathname: "/shift/add",
                    params: { shiftId: sId }
                  });
                }}
                accessibilityRole="button"
                style={[S.primBtn, { width: "100%", marginHorizontal: 0, height: 54, borderRadius: 16, backgroundColor: accentColor }]}
              >
                <Text variant="labelL" style={[S.primBtnText, { color: accentColorContrast }]}>Add Earnings & Details</Text>
              </Pressable>
              <Pressable
                onPress={() => setEndedShiftId(null)}
                accessibilityRole="button"
                style={[S.secBtn, { width: "100%", marginHorizontal: 0, height: 54, backgroundColor: "transparent", borderWidth: 0 }]}
              >
                <Text variant="labelL" style={S.secBtnText}>Save As Is</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Odometer Anchor Prompt Modal ───────────────────────────────── */}
      <Modal visible={showOdoPrompt} transparent animationType="fade">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={S.wizardOverlay}>
          <View style={[S.wizardContent, { paddingVertical: 28, gap: 16 }]}>
            <View style={{ alignItems: "center", gap: 6 }}>
              <Text variant="headingM" style={{ letterSpacing: 0.5 }}>Quick Audit Required</Text>
              <Text variant="paragraphM" style={{ textAlign: "center", lineHeight: 18 }}>
                To maintain tax audit compliance, please enter your vehicle's current dashboard odometer reading.
              </Text>
            </View>

            {odoError ? (
              <View style={{ backgroundColor: withAlpha(C.destructive, 0.1), borderWidth: 0.5, borderColor: withAlpha(C.destructive, 0.2), padding: 10, borderRadius: 12 }}>
                <Text variant="paragraphS" style={{ color: C.destructive, textAlign: "center" }}>{odoError}</Text>
              </View>
            ) : null}

            <View style={{ gap: 8 }}>
              <Text variant="labelXs" className="text-content-secondary">
                Current Odometer
              </Text>
              <TextInput
                value={odoInput}
                onChangeText={(val) => {
                  setOdoError("");
                  setOdoInput(val.replace(/[^0-9]/g, ""));
                }}
                keyboardType="numeric"
                placeholder="e.g. 45210"
                placeholderTextColor={C.contentMuted}
                style={{
                  backgroundColor: C.surface02,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: C.lineSubtle,
                  borderRadius: 12,
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                  color: C.contentPrimary,
                  fontSize: 15,
                  fontWeight: "700",
                  textAlign: "center"
                }}
              />
            </View>

            <View style={{ width: "100%", gap: 10, marginTop: 12 }}>
              <Pressable
                onPress={async () => {
                  const num = parseInt(odoInput, 10);
                  if (isNaN(num) || num <= 0) {
                    setOdoError("Please enter a valid odometer reading greater than 0.");
                    return;
                  }
                  
                  if (odoPromptVehicleId) {
                    try {
                      await reconcileOdometerAnchors(odoPromptVehicleId, num);
                      queryClient.invalidateQueries({ queryKey: ["shifts"] });
                      queryClient.invalidateQueries({ queryKey: ["analytics"] });
                      refetchGpsOnly();
                      setShowOdoPrompt(false);
                      setOdoInput("");
                      setOdoPromptVehicleId(null);
                    } catch (e: any) {
                      setOdoError(e?.message || "Failed to reconcile odometer. Please check entry.");
                    }
                  }
                }}
                accessibilityRole="button"
                style={[S.primBtn, { width: "100%", marginHorizontal: 0, height: 48, borderRadius: 12, backgroundColor: accentColor }]}
              >
                <Text variant="labelM" style={[S.primBtnText, { color: accentColorContrast }]}>Save & Reconcile</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setShowOdoPrompt(false);
                  setOdoInput("");
                  setOdoPromptVehicleId(null);
                }}
                accessibilityRole="button"
                style={[S.secBtn, { width: "100%", marginHorizontal: 0, height: 44, backgroundColor: "transparent", borderWidth: 0 }]}
              >
                <Text variant="labelM" style={S.secBtnText}>Remind Me Later</Text>
              </Pressable>
            </View>
          </View>
        </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Start Shift Wizard Modal ──────────────────────────────────── */}
      <AppBottomSheet ref={wizardSheetRef} onDismiss={() => setShowWizard(false)}>
        {showWizard && (
          <View style={{ gap: 16 }}>

            <View style={S.wizardHeader}>
              <Text variant="labelL">Start {vocab('session').charAt(0).toUpperCase() + vocab('session').slice(1)} Wizard</Text>
              <Pressable
                onPress={() => wizardSheetRef.current?.dismiss()}
                accessibilityRole="button"
                accessibilityLabel="Dismiss"
                hitSlop={8}
                style={S.wizardCloseBtn}
              >
                <Text style={S.wizardCloseText}>✕</Text>
              </Pressable>
            </View>

            {wizardStep === "vehicle" && (
              <View style={{ gap: 10 }}>
                <Text variant="labelM">Which vehicle are you driving today?</Text>
                {vehicles.map((v: any) => {
                  const icon = v.type === "ev" ? "⚡" : v.type === "bicycle" || v.type === "ebike" ? "🚲" : "🚗";
                  const sel = selectedVehicleId === v.id;
                  return (
                    <Pressable
                      key={v.id}
                      onPress={() => {
                        setSelectedVehicleId(v.id);
                        setWizardStep("target");
                      }}
                      accessibilityRole="button"
                      accessibilityState={{ selected: sel }}
                      style={[S.wizardRow, sel && S.wizardRowSel]}
                    >
                      <Text style={{ fontSize: 20 }}>{icon}</Text>
                      <View style={{ flex: 1 }}>
                        <Text variant="labelM">{v.nickname || "Unnamed vehicle"}</Text>
                        <Text variant="paragraphS">{v.make} {v.model}</Text>
                      </View>
                      <Text style={{ color: C.contentMuted }}>›</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}

            {wizardStep === "platform" && (
              <View style={{ gap: 10 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <Text variant="labelM" style={{ flex: 1, marginRight: 8 }}>On which platform you are going to work today?</Text>
                  <Pressable
                    onPress={() => {
                      const allPlats = profile?.selectedPlatforms ?? ["doordash", "ubereats", "skip"];
                      setSelectedPlatformIds(allPlats as GigPlatform[]);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: selectedPlatformIds.length === (profile?.selectedPlatforms ?? ["doordash", "ubereats", "skip"]).length }}
                    style={{
                      backgroundColor: selectedPlatformIds.length === (profile?.selectedPlatforms ?? ["doordash", "ubereats", "skip"]).length ? accentColor : C.surface03,
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 8,
                      borderWidth: 0.5,
                      borderColor: C.lineStrong
                    }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: "800", color: selectedPlatformIds.length === (profile?.selectedPlatforms ?? ["doordash", "ubereats", "skip"]).length ? accentColorContrast : C.contentSecondary }}>All</Text>
                  </Pressable>
                </View>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {(profile?.selectedPlatforms ?? ["doordash", "ubereats", "skip"]).map((pId: string) => {
                    const pColor = PLATFORMS[pId as GigPlatform]?.color ?? C.contentMuted;
                    const sel = selectedPlatformIds.includes(pId as GigPlatform);
                    return (
                      <Pressable
                        key={pId}
                        onPress={() => {
                          setSelectedPlatformIds((prev) => {
                            if (prev.includes(pId as GigPlatform)) {
                              if (prev.length <= 1) return prev;
                              return prev.filter((x) => x !== pId);
                            } else {
                              return [...prev, pId as GigPlatform];
                            }
                          });
                        }}
                        accessibilityRole="button"
                        accessibilityState={{ selected: sel }}
                        style={[
                          S.wizardRow,
                          { flex: 1, minWidth: "45%", justifyContent: "center", paddingVertical: 14, gap: 8 },
                          sel && { borderColor: pColor, backgroundColor: C.surface03 }
                        ]}
                      >
                        <PlatformLogo id={pId} size={16} />
                        <Text variant="labelM" style={{ color: sel ? C.contentPrimary : C.contentSecondary }}>
                          {PLATFORMS[pId as GigPlatform]?.label ?? pId}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}

            {wizardStep === "target" && (
              <View style={{ gap: 14 }}>
                <Text variant="labelM">Do you want to set a duration target for this {vocab('session')}?</Text>

                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: C.surface02, padding: 12, borderRadius: 8, borderWidth: 0.5, borderColor: C.lineSubtle }}>
                  <Text variant="labelM">Enable {vocab('session').charAt(0).toUpperCase() + vocab('session').slice(1)} Goal</Text>
                  <Pressable
                    onPress={() => setTargetMode(!targetMode)}
                    accessibilityRole="switch"
                    accessibilityState={{ checked: targetMode }}
                    accessibilityLabel={`Enable ${vocab('session')} goal`}
                    style={{
                      width: 44,
                      height: 24,
                      borderRadius: 12,
                      backgroundColor: targetMode ? accentColor : C.lineSubtle,
                      justifyContent: "center",
                      paddingHorizontal: 2,
                      alignItems: targetMode ? "flex-end" : "flex-start"
                    }}
                  >
                    <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: C.contentPrimary }} />
                  </Pressable>
                </View>

                {targetMode && (
                  <View style={{ gap: 10 }}>
                    <Text variant="paragraphS" className="text-content-secondary">Set Target Duration</Text>

                    <View style={{ flexDirection: "row", gap: 8 }}>
                      {[4, 8, 10].map((h) => (
                        <Pressable
                          key={h}
                          onPress={() => { setCustomHours(h); setCustomMinutes(0); }}
                          accessibilityRole="button"
                          accessibilityState={{ selected: customHours === h && customMinutes === 0 }}
                          style={{ flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: customHours === h && customMinutes === 0 ? accentColor : C.lineStrong, backgroundColor: customHours === h && customMinutes === 0 ? withAlpha(accentColor, 0.12) : C.surface02, alignItems: "center" }}
                        >
                          <Text variant="labelM" tabular style={{ color: customHours === h && customMinutes === 0 ? accentColor : C.contentSecondary }}>{h} hrs</Text>
                        </Pressable>
                      ))}
                    </View>

                    <View style={{ flexDirection: "row", gap: 10, alignItems: "center", marginTop: 4 }}>
                      <TextInput
                        keyboardType="number-pad"
                        value={String(customHours)}
                        onChangeText={(txt) => setCustomHours(Math.max(0, parseInt(txt) || 0))}
                        style={S.wizardInput}
                        maxLength={2}
                      />
                      <Text variant="labelM">hr</Text>

                      <TextInput
                        keyboardType="number-pad"
                        value={String(customMinutes)}
                        onChangeText={(txt) => setCustomMinutes(Math.max(0, Math.min(59, parseInt(txt) || 0)))}
                        style={S.wizardInput}
                        maxLength={2}
                      />
                      <Text variant="labelM">min</Text>
                    </View>
                  </View>
                )}
              </View>
            )}

            <View style={S.wizardFooter}>
              {!isFirstWizardStep && (
                <Pressable onPress={prevStep} accessibilityRole="button" style={S.wizardBackBtn}>
                  <Text variant="labelM" className="text-content-secondary">Back</Text>
                </Pressable>
              )}
              <View style={{ flex: 1 }} />
              <Pressable
                onPress={nextStep}
                accessibilityRole="button"
                style={[S.wizardNextBtn, { backgroundColor: accentColor }]}
              >
                <Text variant="labelM" style={{ color: accentColorContrast }}>
                  {wizardStep === "target" ? "Start " + vocab('session').charAt(0).toUpperCase() + vocab('session').slice(1) : "Next"}
                </Text>
              </Pressable>
            </View>

          </View>
        )}
      </AppBottomSheet>

      {/* ── Bulletin Mode · Milestone Celebration ─────────────────────── */}
      <CelebrationSheet ref={celebrationRef} />

    </SafeAreaView>
  );
}

const makeS = (C: Palette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  scroll: { padding: 14, paddingTop: 76, gap: 10, paddingBottom: 110 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12 },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  headerTitle: { letterSpacing: -0.2 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.surface04, alignItems: "center", justifyContent: "center" },

  tipCard: { flexDirection: "row", gap: 10, backgroundColor: C.surface01, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: C.lineSubtle, padding: 12, alignItems: "center" },

  pulseDot: { width: 8, height: 8, borderRadius: 4 },

  primBtn: { justifyContent: "center", alignItems: "center" },
  primBtnText: { textAlign: "center" },
  secBtn: { justifyContent: "center", alignItems: "center" },
  secBtnText: { color: C.contentSecondary },

  clockOverlay: { flex: 1, backgroundColor: C.background },
  clockHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 18, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: C.lineSubtle },
  clockCloseBtn: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 12, backgroundColor: C.surface03, borderWidth: 1, borderColor: C.lineSubtle },
  clockBody: { flex: 1, justifyContent: "center", alignItems: "center", gap: 20 },
  clockDigits: { fontSize: 52, fontWeight: "bold", color: C.contentPrimary, paddingVertical: 8, textAlign: "center", textAlignVertical: "center", includeFontPadding: false },
  clockSecBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 46, borderRadius: 12, backgroundColor: C.surface02, borderWidth: 1, borderColor: C.lineStrong },
  clockSecBtnText: { color: C.contentPrimary },

  wizardOverlay: { flex: 1, backgroundColor: C.scrim, justifyContent: "center", padding: 20 },
  wizardContent: { backgroundColor: C.surface01, borderRadius: 20, borderWidth: 1, borderColor: C.lineSubtle, padding: 16, gap: 16 },
  wizardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomWidth: 0.5, borderBottomColor: C.lineSubtle, paddingBottom: 10 },
  wizardCloseBtn: { padding: 4 },
  wizardCloseText: { fontSize: 18, color: C.contentMuted },
  wizardRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 12, backgroundColor: C.surface02, borderWidth: 0.5, borderColor: C.lineSubtle },
  wizardRowSel: { borderColor: C.contentPrimary },
  wizardInput: { flex: 1, height: 40, backgroundColor: C.surface02, borderWidth: 0.5, borderColor: C.lineSubtle, borderRadius: 8, paddingHorizontal: 10, color: C.contentPrimary, fontSize: 13, fontWeight: "600" },
  wizardFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 0.5, borderTopColor: C.lineSubtle, paddingTop: 14, marginTop: 2 },
  wizardBackBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  wizardNextBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 },

  demoBanner: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: withAlpha(C.warning, 0.12), borderWidth: StyleSheet.hairlineWidth, borderColor: withAlpha(C.warning, 0.2), padding: 12, borderRadius: 20, marginBottom: 12, marginHorizontal: 16 },
  demoText: { fontSize: 11, fontWeight: "800", color: C.warning },
  demoBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: withAlpha(C.warning, 0.2) },
  demoBtnText: { fontSize: 11, fontWeight: "800", color: C.warning },
});
