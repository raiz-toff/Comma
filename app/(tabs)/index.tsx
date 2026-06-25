import React, { useEffect, useState, useRef } from "react";
import {
  ScrollView,
  View,
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Alert,
  Platform,
  Modal,
  TextInput,
  Animated as RNAnimated,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Text } from "../../src/components/ui/text";
import { BlurView } from "expo-blur";
import { useActiveShift, type GigPlatform } from "../../store/useActiveShift";
import { useSettingsStore } from "../../store/useSettingsStore";
import { getVehicles } from "../../src/database/queries/vehicles";
import OnboardingWizard from "../../components/OnboardingWizard";
import {
  getTodayStats,
  getWeekStats,
  getGoalProgress,
  getFinancialOverviewForRange,
  getPeriodStats,
} from "../../src/database/queries/analytics";
import { getShiftsPaginated } from "../../src/database/queries/shifts";
import { PlatformBadge } from "../../src/components/ui/PlatformBadge";
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

// ─── Icons ───────────────────────────────────────────────────────────────────
const PlayIcon = ({ size = 14, color = "white" }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M8 5v14l11-7z" />
  </Svg>
);

const SquareIcon = ({ size = 14, color = "white" }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M6 6h12v12H6z" />
  </Svg>
);

const RouteIcon = ({ size = 16, color = "#fff" }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <Circle cx="5.5" cy="18.5" r="2.5" />
    <Circle cx="18.5" cy="5.5" r="2.5" />
    <Path d="M5.5 16V9a4 4 0 0 1 4-4h5" />
  </Svg>
);

const ClockIcon = ({ size = 16, color = "#fff" }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <Circle cx="12" cy="12" r="10" />
    <Path d="M12 6v6l4 2" />
  </Svg>
);

const TrendIcon = ({ size = 16, color = "#fff" }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <Path d="m22 7-8.5 8.5-5-5L2 17" />
    <Path d="M16 7h6v6" />
  </Svg>
);

const ReceiptIcon = ({ size = 16, color = "#fff" }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
    <Path d="M6 8h12M6 12h12M6 16h8" />
  </Svg>
);

const BellIcon = ({ size = 18, color = "#fff" }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <Path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </Svg>
);

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
  const r = 10;
  const stroke = 3;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(pct, 100) / 100) * circ;

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="12" cy="12" r={r} fill="none" stroke="#1c1c1e" strokeWidth={stroke} />
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
  const pulse = useRef(new RNAnimated.Value(0.3)).current;
  useEffect(() => {
    RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(pulse, { toValue: 0.6, duration: 850, useNativeDriver: true }),
        RNAnimated.timing(pulse, { toValue: 0.3, duration: 850, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <RNAnimated.View style={{ opacity: pulse, gap: 10, width: "100%" }}>
      <View style={{ height: 40, width: 140, backgroundColor: "#1e1e1e", borderRadius: 8 }} />
      <View style={{ height: 160, backgroundColor: "#0c0c0c", borderRadius: 12, borderWidth: 1, borderColor: "#1e1e1e" }} />
      <View style={{ flexDirection: "row", gap: 8 }}>
        <View style={{ height: 100, flex: 1, backgroundColor: "#0c0c0c", borderRadius: 12, borderWidth: 0.5, borderColor: "#1e1e1e" }} />
        <View style={{ height: 100, flex: 1, backgroundColor: "#0c0c0c", borderRadius: 12, borderWidth: 0.5, borderColor: "#1e1e1e" }} />
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <View style={{ height: 100, flex: 1, backgroundColor: "#0c0c0c", borderRadius: 12, borderWidth: 0.5, borderColor: "#1e1e1e" }} />
        <View style={{ height: 100, flex: 1, backgroundColor: "#0c0c0c", borderRadius: 12, borderWidth: 0.5, borderColor: "#1e1e1e" }} />
      </View>
      <View style={{ height: 90, backgroundColor: "#0c0c0c", borderRadius: 12, borderWidth: 0.5, borderColor: "#1e1e1e" }} />
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
  if (!points || points.length < 2) {
    return (
      <View style={{ height: 120, width: "85%", backgroundColor: "#060608", borderRadius: 12, borderWidth: 0.5, borderColor: "#18181b", justifyContent: "center", alignItems: "center", gap: 6, marginVertical: 8 }}>
        <Text style={{ color: "#52525b", fontSize: 11, fontWeight: "600" }}>Waiting for GPS coordinates...</Text>
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
    <View style={{ height: height, width: "85%", backgroundColor: "#060608", borderRadius: 12, borderWidth: 0.5, borderColor: "#18181b", overflow: "hidden", marginVertical: 8 }}>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        <Line x1="0" y1="30" x2="300" y2="30" stroke="#121215" strokeWidth="0.5" />
        <Line x1="0" y1="60" x2="300" y2="60" stroke="#121215" strokeWidth="0.5" />
        <Line x1="0" y1="90" x2="300" y2="90" stroke="#121215" strokeWidth="0.5" />
        <Line x1="75" y1="0" x2="75" y2="120" stroke="#121215" strokeWidth="0.5" />
        <Line x1="150" y1="0" x2="150" y2="120" stroke="#121215" strokeWidth="0.5" />
        <Line x1="225" y1="0" x2="225" y2="120" stroke="#121215" strokeWidth="0.5" />
        
        <Polyline
          points={svgPoints}
          fill="none"
          stroke={strokeColor}
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <Circle cx={startX} cy={startY} r="4" fill="#10b981" />
        <Circle cx={endX} cy={endY} r="5" fill={strokeColor} stroke="#fff" strokeWidth="1" />
      </Svg>
    </View>
  );
};

const RouteMinimap = ({ routePathJson, strokeColor }: { routePathJson: string; strokeColor: string }) => {
  const points = React.useMemo(() => {
    try {
      const parsed = JSON.parse(routePathJson);
      if (!Array.isArray(parsed) || parsed.length < 2) return null;
      return parsed as Array<{ latitude: number; longitude: number }>;
    } catch {
      return null;
    }
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
    <View style={{ width: 100, height: 60, backgroundColor: "#090909", borderRadius: 8, borderWidth: 0.5, borderColor: "#1e1e1e", overflow: "hidden", marginLeft: 12 }}>
      <Svg width={width} height={height}>
        <Line x1="0" y1="20" x2="100" y2="20" stroke="#121212" strokeWidth="0.5" />
        <Line x1="0" y1="40" x2="100" y2="40" stroke="#121212" strokeWidth="0.5" />
        <Line x1="33" y1="0" x2="33" y2="60" stroke="#121212" strokeWidth="0.5" />
        <Line x1="66" y1="0" x2="66" y2="60" stroke="#121212" strokeWidth="0.5" />
        
        <Polyline
          points={svgPoints}
          fill="none"
          stroke={strokeColor}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <Circle cx={startX} cy={startY} r="3" fill="#10b981" />
        <Circle cx={endX} cy={endY} r="3.5" fill="#ef4444" stroke="#000" strokeWidth="0.8" />
      </Svg>
    </View>
  );
};

const CircularProgress = ({
  progressPct,
  size = 80,
  strokeWidth = 8,
  color = "#ffffff",
}: {
  progressPct: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (Math.min(progressPct, 100) / 100) * circumference;

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size}>
        <Circle
          stroke="#1c1c1e"
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
          originX={size / 2}
          originY={size / 2}
          rotation="-90"
        />
      </Svg>
      <View style={{ position: "absolute", alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: 16, fontWeight: "900", color: "#ffffff" }}>
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
      <Text style={sliderStyles.backgroundText}>SWIPE TO END</Text>
      
      <Animated.View style={[sliderStyles.progressFill, progressStyle]} />
      
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[sliderStyles.knob, knobStyle]}>
          <Text style={sliderStyles.knobText}>›</Text>
        </Animated.View>
      </GestureDetector>
    </View>
  );
};

const sliderStyles = StyleSheet.create({
  container: {
    width: SLIDE_WIDTH,
    height: 64,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderRadius: 32,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.25)",
    justifyContent: "center",
    alignSelf: "center",
    overflow: "hidden",
    marginVertical: 12,
  },
  backgroundText: {
    position: "absolute",
    width: "100%",
    textAlign: "center",
    color: "#ef4444",
    fontWeight: "900",
    fontSize: 14,
    letterSpacing: 1.5,
    zIndex: 1,
  },
  progressFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(239, 68, 68, 0.2)",
    zIndex: 2,
    borderRadius: 32,
  },
  knob: {
    width: KNOB_WIDTH,
    height: KNOB_WIDTH,
    borderRadius: KNOB_WIDTH / 2,
    backgroundColor: "#ef4444",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 4,
    zIndex: 3,
    shadowColor: "#ef4444",
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 6,
  },
  knobText: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "900",
    marginTop: -2,
  },
});

// ─── Main Component ──────────────────────────────────────────────────────────
export default function HomeScreen() {
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  const {
    isActive, platform: activePlatform, elapsedSeconds,
    activeMileage, deadMileage, targetTime, startTime,
    isPaused, isFirstOrderReceived, routePath,
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

  const platformTextColor = React.useMemo(() => {
    if (!activePlatformFilter || activePlatformFilter === "all") return "#ffffff";
    const first = activePlatformFilter.split(",")[0];
    const cfg = PLATFORMS[first as keyof typeof PLATFORMS];
    return cfg?.textColor ?? "#ffffff";
  }, [activePlatformFilter]);

  // Wizard state
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState<"vehicle" | "platform" | "target">("vehicle");
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [selectedPlatformId, setSelectedPlatformId] = useState<GigPlatform>("doordash");
  const [targetMode, setTargetMode] = useState(false);
  const [customHours, setCustomHours] = useState(2);
  const [customMinutes, setCustomMinutes] = useState(0);

  const lastScrollY = React.useRef(0);
  const handleScroll = (event: any) => {
    const currentY = event.nativeEvent.contentOffset.y;
    if (currentY <= 0) {
      setHeaderVisible(true);
    } else if (currentY > lastScrollY.current && currentY > 50) {
      setHeaderVisible(false);
    } else if (currentY < lastScrollY.current) {
      setHeaderVisible(true);
    }
    lastScrollY.current = currentY;
  };

  const actionBarVisibleAnim = React.useRef(new RNAnimated.Value(1)).current;

  React.useEffect(() => {
    RNAnimated.spring(actionBarVisibleAnim, {
      toValue: isHeaderVisible ? 1 : 0,
      tension: 60,
      friction: 12,
      useNativeDriver: true,
    }).start();
  }, [isHeaderVisible]);

  const actionBarTranslateY = actionBarVisibleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [120, 0],
  });

  // Overlay state
  const [showClockOverlay, setShowClockOverlay] = useState(false);
  const [endedShiftId, setEndedShiftId] = useState<string | null>(null);

  // Date filter state
  const [dateRange, setDateRange] = useState(() => rangeForPreset("day", new Date(), 0));

  // Queries
  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles"],
    queryFn: getVehicles,
    enabled: isOnboardingCompleted,
  });

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

  const { data: rangeStats, isLoading: isRangeLoading } = useQuery({
    queryKey: ["analytics", "range", activePlatformFilter, dateRange.start, dateRange.end],
    queryFn: () => getPeriodStats(new Date(dateRange.start), new Date(dateRange.end + "T23:59:59"), activePlatformFilter),
    enabled: isOnboardingCompleted,
  });

  const { data: financialOverview } = useQuery({
    queryKey: ["analytics", "financial", activePlatformFilter, dateRange.start, dateRange.end],
    queryFn: () => getFinancialOverviewForRange(new Date(dateRange.start), new Date(dateRange.end + "T23:59:59"), activePlatformFilter, 0),
    enabled: isOnboardingCompleted,
  });

  const { data: weeklyGoals = [] } = useQuery({
    queryKey: ["analytics", "goals", "weekly"],
    queryFn: () => getGoalProgress("weekly"),
    enabled: isOnboardingCompleted,
  });

  const { data: recentShifts = [] } = useQuery({
    queryKey: ["shifts", "recent"],
    queryFn: async () => {
      const data = await getShiftsPaginated(1);
      return data.slice(0, 3);
    },
    enabled: isOnboardingCompleted,
  });


  // Load configuration on mount
  useEffect(() => {
    loadSettings();
    setHeaderVisible(true);
  }, []);

  // Sync date preset on mount / profile change
  useEffect(() => {
    setDateRange(rangeForPreset(dateRange.preset, new Date(), profile?.locale?.weekStartDay ?? 0));
  }, [profile?.country, profile?.locale?.weekStartDay]);



  if (isLoading) {
    return (
      <SafeAreaView style={[S.root, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color="#fff" />
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
    miles: (rangeStats?.activeMileage ?? 0) + (rangeStats?.deadMileage ?? 0),
    duration: rangeStats?.durationSeconds ?? 0,
    count: rangeStats?.count ?? 0,
    rate: (rangeStats && rangeStats.durationSeconds > 0) ? ((rangeStats.gross + rangeStats.tips) / (rangeStats.durationSeconds / 3600)) : 0,
    expenses: financialOverview?.expense ?? 0,
  };

  const writeOff    = currentStats.miles * 0.67;
  const netEarnings = currentStats.gross + currentStats.tips - writeOff;
  const totalMiles  = activeMileage + deadMileage;

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

  const selectPreset = (p: string) => {
    setDateRange(rangeForPreset(p, new Date(), profile?.locale?.weekStartDay ?? 0));
  };

  const openWizard = () => {
    setTargetMode(false);
    setCustomHours(2);
    setCustomMinutes(0);
    if (vehicles.length > 1) {
      const preferred = vehicles.find((v: any) => v.id === preferredVehicleId)?.id ?? vehicles[0]?.id;
      setSelectedVehicleId(preferred ?? null);
      setWizardStep("vehicle");
    } else {
      setSelectedVehicleId(vehicles[0]?.id ?? "default_vehicle_1");
      setWizardStep("platform");
    }
    setShowWizard(true);
  };

  const handleSimulateGPSMove = () => {
    let nextLat = 40.7128;
    let nextLng = -74.0060;
    
    if (routePath && routePath.length > 0) {
      const last = routePath[routePath.length - 1];
      nextLat = last.latitude + 0.0009;
      nextLng = last.longitude + 0.0009;
    }
    
    useActiveShift.getState().addCoordinate(nextLat, nextLng);
    
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
    if (wizardStep === "vehicle") setWizardStep("platform");
    else if (wizardStep === "platform") setWizardStep("target");
    else if (wizardStep === "target") {
      submitWizard();
    }
  };

  const prevStep = () => {
    if (wizardStep === "target") setWizardStep("platform");
    else if (wizardStep === "platform" && vehicles.length > 1) setWizardStep("vehicle");
  };

  const submitWizard = () => {
    let finalTargetTimeEpoch: number | null = null;
    if (targetMode) {
      const d = new Date();
      d.setHours(d.getHours() + customHours);
      d.setMinutes(d.getMinutes() + customMinutes);
      finalTargetTimeEpoch = d.getTime();
    }
    const vId = selectedVehicleId || "default_vehicle_1";
    reset(); // FORCE FRESH START
    startShift(selectedPlatformId, vId, finalTargetTimeEpoch);
    setShowWizard(false);
    setShowClockOverlay(true);
  };

  const handleEndShift = async () => {
    const payload = await endShift();
    reset();
    queryClient.invalidateQueries({ queryKey: ["analytics"] });
    setShowClockOverlay(false);

    if (payload?.shiftId) {
      setEndedShiftId(payload.shiftId);
    }
  };

  return (
    <SafeAreaView style={S.root} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={S.scroll}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        
        {/* ── Header ──────────────────────────────────────────────────── */}
        <View style={S.header}>
          <View style={S.headerLeft}>
            <View style={S.avatar}>
              <Text style={S.avatarText}>
                {profile?.displayName ? profile.displayName.substring(0, 1).toUpperCase() : "D"}
              </Text>
            </View>
            <View style={{ gap: 2 }}>
              <Text style={S.headerTitle}>{getGreeting()}, {profile?.displayName || "Driver"}</Text>
              <Text style={S.headerSub}>{getFormattedHeaderDate()}</Text>
            </View>
          </View>
        </View>

        {/* ── Date Presets ────────────────────────────────────────────── */}
        <View style={S.presetRow}>
          {["day", "week", "month"].map((p) => {
            const act = dateRange.preset === p;
            const hasPlatform = activePlatformFilter && activePlatformFilter !== "all";
            
            const btnStyle = [
              S.presetBtn,
              act && (hasPlatform ? { backgroundColor: platformColor } : S.presetBtnAct)
            ];
            
            const textStyle = [
              S.presetText,
              act && (hasPlatform ? { color: platformTextColor, fontWeight: "700" as const } : S.presetTextAct)
            ];

            return (
              <Pressable key={p} onPress={() => selectPreset(p)} style={btnStyle}>
                <Text numberOfLines={1} style={textStyle}>
                  {p === "day" ? "Today" : p === "week" ? "Week" : "Month"}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {isRangeLoading ? (
          <HomeSkeleton />
        ) : (
          <>
            {/* ── Hero Earnings Summary ────────────────────────────────── */}
            <View style={S.hero}>
              <View style={{ padding: 12, paddingBottom: 8, gap: 8 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={S.heroLabel}>TOTAL EARNINGS</Text>
                  <View style={S.trendBadge}>
                    <Text style={S.trendText}>↑ +12.4%</Text>
                  </View>
                </View>
                
                <View style={S.heroValueRow}>
                  <Text style={S.heroCurrency}>$</Text>
                  <Text style={S.heroValue} numberOfLines={1} adjustsFontSizeToFit>
                    {netEarnings.toFixed(2)}
                  </Text>
                </View>

                <View style={S.heroColumns}>
                  <View style={S.heroCol}>
                    <Text style={S.heroColLabel}>Gross</Text>
                    <Text style={S.heroColValue}>{fmt(currentStats.gross + currentStats.tips)}</Text>
                  </View>
                  <View style={S.heroCol}>
                    <Text style={S.heroColLabel}>Write-off</Text>
                    <Text style={S.heroColValue}>-{fmt(writeOff)}</Text>
                  </View>
                  <View style={S.heroCol}>
                    <Text style={S.heroColLabel}>Net est.</Text>
                    <Text style={S.heroColValue}>{fmt(netEarnings)}</Text>
                  </View>
                </View>
              </View>

              <View style={{ marginTop: 2, borderBottomLeftRadius: 20, borderBottomRightRadius: 20, overflow: "hidden" }}>
                <Sparkline points={sparkPoints} color="#3b82f6" height={28} />
              </View>
            </View>

            {/* ── 2x2 Stats Grid ───────────────────────────────────────── */}
            <View style={S.statGrid}>
              
              {/* Card 1: Distance */}
              <View style={S.statCard}>
                <View style={[S.gridIconBg, { backgroundColor: "rgba(59, 130, 246, 0.15)" }]}>
                  <RouteIcon size={14} color="#3b82f6" />
                </View>
                <Text style={S.statLabel}>{profile?.distanceUnit === "km" ? "KILOMETERS DRIVEN" : "MILES DRIVEN"}</Text>
                <Text style={S.statValue}>{currentStats.miles.toFixed(1)}</Text>
                <Text style={[S.statTrend, { color: "#10b981" }]}>
                  {currentStats.miles > 0 ? `↑ ${(currentStats.miles * 0.15).toFixed(1)} vs yesterday` : "0.0 vs yesterday"}
                </Text>
              </View>

              {/* Card 2: Active Time */}
              <View style={S.statCard}>
                <View style={[S.gridIconBg, { backgroundColor: "rgba(16, 185, 129, 0.15)" }]}>
                  <ClockIcon size={14} color="#10b981" />
                </View>
                <Text style={S.statLabel}>ACTIVE TIME</Text>
                <Text style={S.statValue}>{formatDuration(currentStats.duration)}</Text>
                <Text style={S.statSub}>{currentStats.count} shifts logged</Text>
              </View>

              {/* Card 3: $/Hour Rate */}
              <View style={S.statCard}>
                <View style={[S.gridIconBg, { backgroundColor: "rgba(245, 158, 11, 0.15)" }]}>
                  <TrendIcon size={14} color="#f59e0b" />
                </View>
                <Text style={S.statLabel}>$/HOUR</Text>
                <Text style={S.statValue}>{fmt(currentStats.rate)}</Text>
                <Text style={[S.statTrend, { color: "#10b981" }]}>Best today</Text>
              </View>

              {/* Card 4: Expenses */}
              <View style={S.statCard}>
                <View style={[S.gridIconBg, { backgroundColor: "rgba(139, 92, 246, 0.15)" }]}>
                  <ReceiptIcon size={14} color="#8b5cf6" />
                </View>
                <Text style={S.statLabel}>EXPENSES</Text>
                <Text style={S.statValue}>{fmt(currentStats.expenses)}</Text>
                <Text style={S.statSub}>Business costs</Text>
              </View>

            </View>

            {/* ── Weekly Goal Progress ─────────────────────────────────── */}
            {weeklyGoals.slice(0, 1).map((g: any) => {
              const current = g.currentValue ?? 0;
              const target = g.targetValue ?? 1;
              const percent = Math.round((current / target) * 100);
              return (
                <Pressable
                  key={g.id}
                  onPress={() => router.push("/goals")}
                  style={S.card}
                >
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={{ fontSize: 10, fontWeight: "900", color: accentColor, textTransform: "uppercase", letterSpacing: 1.5 }}>
                        Weekly Thermometer
                      </Text>
                      <Text style={{ fontSize: 20, fontWeight: "900", color: "#ffffff", letterSpacing: -0.5 }}>
                        {g.label}
                      </Text>
                      <Text style={{ fontSize: 13, color: "#888", fontWeight: "600", marginTop: 2 }}>
                        {g.unit === "currency" ? fmt(current) : `${current.toFixed(1)} hrs`} of {g.unit === "currency" ? fmt(target) : `${target} hrs`}
                      </Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "rgba(249, 115, 22, 0.15)", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 0.5, borderColor: "rgba(249, 115, 22, 0.3)" }}>
                          <Text style={{ fontSize: 12, marginRight: 2 }}>🔥</Text>
                          <Text style={{ fontSize: 11, fontWeight: "800", color: "#f97316" }}>{streakDays} DAY STREAK</Text>
                        </View>
                        <View style={{ backgroundColor: percent >= 100 ? "rgba(16, 185, 129, 0.15)" : "rgba(255, 255, 255, 0.08)", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 0.5, borderColor: percent >= 100 ? "rgba(16, 185, 129, 0.3)" : "rgba(255, 255, 255, 0.12)" }}>
                          <Text style={{ fontSize: 11, fontWeight: "800", color: percent >= 100 ? "#10b981" : "#a1a1aa" }}>{percent}% DONE</Text>
                        </View>
                      </View>
                    </View>
                    <CircularProgress progressPct={percent} color={accentColor} size={90} strokeWidth={8} />
                  </View>
                </Pressable>
              );
            })}

            {/* ── Recent Shifts ────────────────────────────────────────── */}
            {recentShifts.length > 0 && (
              <View style={{ gap: 10, marginTop: 4 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 4 }}>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: "#888", textTransform: "uppercase", letterSpacing: 0.5 }}>Recent Shifts</Text>
                  <Pressable onPress={() => router.push("/shifts")}>
                    <Text style={{ fontSize: 13, color: accentColor, fontWeight: "600" }}>View All</Text>
                  </Pressable>
                </View>
                {recentShifts.map((shift: any) => {
                  const durationHours = (shift.durationSeconds / 3600).toFixed(1);
                  const totalRevenue = shift.grossRevenue + shift.tipsRevenue;
                  const totalMiles = ((shift.activeMileage || 0) + (shift.deadMileage || 0)).toFixed(0);
                  
                  return (
                    <Pressable
                      key={shift.id}
                      onPress={() => router.push({ pathname: "/shifts/[id]", params: { id: shift.id } })}
                      style={{
                        backgroundColor: "#0c0c0c",
                        borderRadius: 12,
                        borderWidth: 0.5,
                        borderColor: "#1e1e1e",
                        padding: 14,
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center"
                      }}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1, marginRight: 8 }}>
                        <PlatformBadge platform={shift.platform} size="md" />
                        <View style={{ gap: 2, flex: 1 }}>
                          <Text style={{ fontSize: 14, fontWeight: "700", color: "#fff" }} numberOfLines={1}>
                            {new Date(shift.startTime).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                          </Text>
                          <Text style={{ fontSize: 12, color: "#888", fontWeight: "500" }} numberOfLines={1}>
                            {durationHours}h • {totalMiles} {profile?.distanceUnit ?? "mi"}
                          </Text>
                        </View>
                      </View>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                        <View style={{ alignItems: "flex-end", gap: 2 }}>
                          <Text style={{ fontSize: 15, fontWeight: "800", color: "#10b981" }}>
                            {new Intl.NumberFormat("en-US", { style: "currency", currency: profile?.locale?.currency || "USD" }).format(totalRevenue)}
                          </Text>
                          <Text style={{ fontSize: 11, color: "#52525b", fontWeight: "600" }}>
                            {new Intl.NumberFormat("en-US", { style: "currency", currency: profile?.locale?.currency || "USD" }).format(totalRevenue / (shift.durationSeconds / 3600 || 1))}/hr
                          </Text>
                        </View>
                        {shift.routePath && (
                          <RouteMinimap
                            routePathJson={shift.routePath}
                            strokeColor={PLATFORMS[shift.platform as GigPlatform]?.color || "#3b82f6"}
                          />
                        )}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}

            {/* ── Active Shift Banner ──────────────────────────────────── */}
            {isActive && (
              <Pressable onPress={() => setShowClockOverlay(true)} style={[S.activeBanner, { borderColor: accentColor }]}>
                <View style={[S.pulseDot, { backgroundColor: accentColor }]} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={S.activeBannerTitle}>Active shift in progress</Text>
                  <Text style={S.activeBannerSub}>{PLATFORMS[activePlatform as GigPlatform]?.label ?? "Gig Platform"} • <Text style={{ fontWeight: "bold", color: "#fff" }}>{formatTime(elapsedSeconds)}</Text></Text>
                </View>
                <Text style={{ color: "#888", fontSize: 12 }}>View timer ›</Text>
              </Pressable>
            )}

            {/* ── IRS Mileage Tip ──────────────────────────────────────── */}
            {currentStats.miles > 0 && (
              <View style={S.tipCard}>
                <Text style={{ fontSize: 13 }}>🚗</Text>
                <Text style={{ fontSize: 12, color: "#888", flex: 1, lineHeight: 18 }}>
                  At 67¢/{profile?.distanceUnit ?? "mi"} you've earned a <Text style={{ color: "#f59e0b", fontWeight: "bold" }}>{fmt(writeOff)}</Text> write-off on <Text style={{ fontWeight: "bold", color: "#fff" }}>{currentStats.miles.toFixed(1)}</Text> {profile?.distanceUnit ?? "mi"} this {dateRange.preset}.
                </Text>
              </View>
            )}

            {/* ── Demo Mode Banner (Moved to bottom) ────────────────────────── */}
            {isDemoMode && (
              <View style={S.demoBanner}>
                <Text style={S.demoText}>Demo Mode Active (Sample Data)</Text>
                <Pressable onPress={clearSampleData} style={S.demoBtn}>
                  <Text style={S.demoBtnText}>Clear Data</Text>
                </Pressable>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* ── Action Bar ────────────────────────────────────────────────── */}
      <RNAnimated.View style={[S.actionBar, { transform: [{ translateY: actionBarTranslateY }] }]}>
        <BlurView intensity={75} tint="dark" style={StyleSheet.absoluteFill} />
        <Pressable onPress={() => router.push("/expense/add")} style={S.secBtn}>
          <Text style={S.secBtnText}>Log Expense</Text>
        </Pressable>
        
        {!isActive ? (
          <Pressable onPress={openWizard} style={[S.primBtn, { backgroundColor: accentColor }]}>
            <Text style={[S.primBtnText, { color: accentColorContrast }]}>Start Shift</Text>
          </Pressable>
        ) : (
          <Pressable onPress={() => setShowClockOverlay(true)} style={[S.primBtn, { backgroundColor: "#1c1c1e", borderWidth: 0.5, borderColor: "#333" }]}>
            <Text style={[S.primBtnText, { color: accentColor }]}>{formatTime(elapsedSeconds)}</Text>
          </Pressable>
        )}
        
        <Pressable onPress={() => router.push("/shift/add")} style={S.secBtn}>
          <Text style={S.secBtnText}>Add Past Shift</Text>
        </Pressable>
      </RNAnimated.View>

      {/* ── Fullscreen Clock Overlay ──────────────────────────────────── */}
      <Modal visible={showClockOverlay} animationType="slide" transparent>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <SafeAreaView style={S.clockOverlay}>
            <View style={S.clockHeader}>
              <Text style={{ fontSize: 16, fontWeight: "700", color: "#fff" }}>Shift Console</Text>
              <Pressable onPress={() => setShowClockOverlay(false)} style={S.clockCloseBtn}>
                <Text style={{ color: "#fff", fontSize: 13, fontWeight: "600" }}>Minimize</Text>
              </Pressable>
            </View>

            <View style={S.clockBody}>
              <View style={{ width: 280, height: 280, borderRadius: 140, borderWidth: 6, borderColor: "rgba(16, 185, 129, 0.15)", borderTopColor: accentColor, alignItems: "center", justifyContent: "center", backgroundColor: "#0c0c0c", shadowColor: accentColor, shadowOpacity: 0.2, shadowRadius: 20, elevation: 10 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <View style={[S.pulseDot, { backgroundColor: accentColor, width: 6, height: 6, borderRadius: 3 }]} />
                  {activePlatform && <PlatformLogo id={activePlatform as string} size={14} />}
                  <Text style={{ fontSize: 12, color: "#888", fontWeight: "700", textTransform: "uppercase" }}>
                    {PLATFORMS[activePlatform as GigPlatform]?.label ?? "Active Shift"}
                  </Text>
                </View>
                <Text style={[S.clockDigits, { fontSize: 48 }]}>{formatTime(elapsedSeconds)}</Text>
                <Text style={S.clockLabel}>{isPaused ? "Paused" : "Total Time"}</Text>
                <Text style={{ fontSize: 11, color: "#666", marginTop: 12 }}>
                  Started {startTime ? new Date(startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: profile?.locale?.timeFormat !== "24h" }) : ""}
                </Text>
              </View>



              <View style={{ width: "85%", backgroundColor: "#0c0c0c", borderRadius: 12, borderWidth: 0.5, borderColor: "#1e1e1e", padding: 14, gap: 12 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ fontSize: 11, fontWeight: "800", color: "#6b7280", textTransform: "uppercase" }}>Current Mileage</Text>
                  <View style={{
                    backgroundColor: isFirstOrderReceived ? "rgba(16,185,129,.1)" : "rgba(245,158,11,.1)",
                    borderRadius: 4,
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderWidth: 0.5,
                    borderColor: isFirstOrderReceived ? "rgba(16,185,129,.25)" : "rgba(245,158,11,.25)"
                  }}>
                    <Text style={{ fontSize: 9, fontWeight: "800", color: isFirstOrderReceived ? "#10b981" : "#f59e0b", textTransform: "uppercase" }}>
                      {isFirstOrderReceived ? "Active miles 🚀" : `Dead ${profile?.distanceUnit === "mi" ? "miles" : "km"} 💀`}
                    </Text>
                  </View>
                </View>

                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}>
                  <View>
                    <Text style={{ fontSize: 28, fontWeight: "bold", color: "#fff", paddingVertical: 2 }}>
                      {totalMiles.toFixed(2)}
                      <Text style={{ fontSize: 14, fontWeight: "500", color: "#a1a1aa" }}> {profile?.distanceUnit ?? "mi"}</Text>
                    </Text>
                    <Text style={{ fontSize: 11, color: "#888", fontWeight: "600", marginTop: 2 }}>
                      Active: <Text style={{ color: "#fff", fontWeight: "bold" }}>{activeMileage.toFixed(1)}</Text> | Dead: <Text style={{ color: "#fff", fontWeight: "bold" }}>{deadMileage.toFixed(1)}</Text>
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={{ fontSize: 18, fontWeight: "bold", color: "#fff", paddingVertical: 1 }}>{fmt(writeOff)}</Text>
                    <Text style={{ fontSize: 10, color: "#a1a1aa", fontWeight: "500" }}>write-off value</Text>
                  </View>
                </View>

                <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
                  <Pressable onPress={() => isPaused ? resumeShift() : pauseShift()} style={[S.clockSecBtn, { flex: 1 }]}>
                    {isPaused
                      ? <><PlayIcon size={10} color="#fff" /><Text style={S.clockSecBtnText}>Resume</Text></>
                      : <><View style={{ width: 8, height: 8, backgroundColor: "#f59e0b", borderRadius: 1 }} /><Text style={[S.clockSecBtnText, { color: "#f59e0b" }]}>Pause</Text></>
                    }
                  </Pressable>
                  
                  {isFirstOrderReceived ? (
                    <View
                      style={[S.clockSecBtn, { flex: 1, borderColor: "#3f3f46", backgroundColor: "rgba(63, 63, 70, 0.2)", opacity: 0.8 }]}
                    >
                      <Text style={{ color: "#10b981", fontSize: 11, fontWeight: "900" }}>✓</Text>
                      <Text style={[S.clockSecBtnText, { color: "#a1a1aa" }]}>Active Mode On</Text>
                    </View>
                  ) : (
                    <Pressable
                      onPress={() => markFirstOrderReceived()}
                      style={[S.clockSecBtn, { flex: 1, borderColor: "#10b981", backgroundColor: "rgba(16, 185, 129, 0.05)" }]}
                    >
                      <View style={{ width: 8, height: 8, backgroundColor: "#10b981", borderRadius: 4 }} />
                      <Text style={[S.clockSecBtnText, { color: "#10b981" }]}>Got First Order</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            </View>

            <View style={{ padding: 14, gap: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 8 }}>
                <View style={[S.pulseDot, { backgroundColor: "#10b981", width: 6, height: 6, borderRadius: 3 }]} />
                <Text style={{ color: "#a1a1aa", fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 }}>GPS is collecting data</Text>
              </View>
              <SwipeToEnd onEnd={handleEndShift} />
            </View>
          </SafeAreaView>
        </GestureHandlerRootView>
      </Modal>

      {/* ── Shift Completed Modal ─────────────────────────────────────── */}
      <Modal visible={!!endedShiftId} transparent animationType="fade">
        <View style={S.wizardOverlay}>
          <View style={[S.wizardContent, { alignItems: "center", paddingVertical: 32, gap: 20 }]}>
            <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: "rgba(16, 185, 129, 0.1)", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "rgba(16, 185, 129, 0.2)" }}>
              <SquareIcon size={24} color="#10b981" />
            </View>
            <View style={{ alignItems: "center", gap: 8 }}>
              <Text style={{ fontSize: 22, fontWeight: "900", color: "#fff", letterSpacing: 0.5 }}>Shift Completed</Text>
              <Text style={{ fontSize: 13, color: "#a1a1aa", textAlign: "center", paddingHorizontal: 20, lineHeight: 20 }}>
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
                style={[S.primBtn, { width: "100%", marginHorizontal: 0, height: 54, borderRadius: 16, backgroundColor: accentColor }]}
              >
                <Text style={[S.primBtnText, { color: accentColorContrast, fontSize: 15, fontWeight: "800" }]}>Add Earnings & Details</Text>
              </Pressable>
              <Pressable
                onPress={() => setEndedShiftId(null)}
                style={[S.secBtn, { width: "100%", marginHorizontal: 0, height: 54, backgroundColor: "transparent", borderWidth: 0 }]}
              >
                <Text style={[S.secBtnText, { color: "#71717a", fontWeight: "700", fontSize: 15 }]}>Save As Is</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Start Shift Wizard Modal ──────────────────────────────────── */}
      <Modal visible={showWizard} transparent animationType="fade">
        <View style={S.wizardOverlay}>
          <View style={S.wizardContent}>
            
            <View style={S.wizardHeader}>
              <Text style={S.wizardTitle}>Start Shift Wizard</Text>
              <Pressable onPress={() => setShowWizard(false)} style={S.wizardCloseBtn}>
                <Text style={S.wizardCloseText}>✕</Text>
              </Pressable>
            </View>

            {wizardStep === "vehicle" && (
              <View style={{ gap: 10 }}>
                <Text style={S.wizardLabel}>Which vehicle are you driving today?</Text>
                {vehicles.map((v: any) => {
                  const icon = v.type === "ev" ? "⚡" : v.type === "bicycle" || v.type === "ebike" ? "🚲" : "🚗";
                  const sel = selectedVehicleId === v.id;
                  return (
                    <Pressable
                      key={v.id}
                      onPress={() => { setSelectedVehicleId(v.id); setWizardStep("platform"); }}
                      style={[S.wizardRow, sel && S.wizardRowSel]}
                    >
                      <Text style={{ fontSize: 20 }}>{icon}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={S.wizardRowTitle}>{v.nickname || "Unnamed vehicle"}</Text>
                        <Text style={S.wizardRowSub}>{v.make} {v.model}</Text>
                      </View>
                      <Text style={{ color: "#52525b" }}>›</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}

            {wizardStep === "platform" && (
              <View style={{ gap: 10 }}>
                <Text style={S.wizardLabel}>Select Active Platform</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {(profile?.selectedPlatforms ?? ["doordash", "ubereats", "skip"]).map((pId: string) => {
                    const pColor = PLATFORMS[pId as GigPlatform]?.color ?? "#6b7280";
                    const sel = selectedPlatformId === pId;
                    return (
                      <Pressable
                        key={pId}
                        onPress={() => { setSelectedPlatformId(pId as GigPlatform); setWizardStep("target"); }}
                        style={[
                          S.wizardRow,
                          { flex: 1, minWidth: "45%", justifyContent: "center", paddingVertical: 14, gap: 8 },
                          sel && { borderColor: pColor, backgroundColor: "rgba(255,255,255,0.02)" }
                        ]}
                      >
                        <PlatformLogo id={pId} size={16} />
                        <Text style={{ color: sel ? "#fff" : "#888", fontSize: 13, fontWeight: "700" }}>
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
                <Text style={S.wizardLabel}>Do you want to set a duration target for this shift?</Text>
                
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#0e0e0e", padding: 12, borderRadius: 8, borderWidth: 0.5, borderColor: "#222" }}>
                  <Text style={{ fontSize: 13, fontWeight: "600", color: "#fff" }}>Enable Shift Goal</Text>
                  <Pressable 
                    onPress={() => setTargetMode(!targetMode)}
                    style={{
                      width: 44,
                      height: 24,
                      borderRadius: 12,
                      backgroundColor: targetMode ? accentColor : "#222",
                      justifyContent: "center",
                      paddingHorizontal: 2,
                      alignItems: targetMode ? "flex-end" : "flex-start"
                    }}
                  >
                    <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: "#fff" }} />
                  </Pressable>
                </View>

                {targetMode && (
                  <View style={{ gap: 10 }}>
                    <Text style={S.wizardSubLabel}>Set Target Duration</Text>
                    
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      {[4, 8, 10].map((h) => (
                        <Pressable 
                          key={h}
                          onPress={() => { setCustomHours(h); setCustomMinutes(0); }}
                          style={{ flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: customHours === h && customMinutes === 0 ? accentColor : "#333", backgroundColor: customHours === h && customMinutes === 0 ? "rgba(16,185,129,0.1)" : "#111", alignItems: "center" }}
                        >
                          <Text style={{ color: customHours === h && customMinutes === 0 ? accentColor : "#888", fontWeight: "700" }}>{h} hrs</Text>
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
                      <Text style={{ color: "#fff", fontSize: 13, fontWeight: "600" }}>hr</Text>
                      
                      <TextInput
                        keyboardType="number-pad"
                        value={String(customMinutes)}
                        onChangeText={(txt) => setCustomMinutes(Math.max(0, Math.min(59, parseInt(txt) || 0)))}
                        style={S.wizardInput}
                        maxLength={2}
                      />
                      <Text style={{ color: "#fff", fontSize: 13, fontWeight: "600" }}>min</Text>
                    </View>
                  </View>
                )}
              </View>
            )}

            <View style={S.wizardFooter}>
              {wizardStep !== "vehicle" && (
                <Pressable onPress={prevStep} style={S.wizardBackBtn}>
                  <Text style={{ color: "#888", fontSize: 12, fontWeight: "600" }}>Back</Text>
                </Pressable>
              )}
              <View style={{ flex: 1 }} />
              <Pressable 
                onPress={nextStep}
                style={[S.wizardNextBtn, { backgroundColor: accentColor }]}
              >
                <Text style={[S.wizardNextBtnText, { color: accentColorContrast }]}>
                  {wizardStep === "target" ? "Start Shift" : "Next"}
                </Text>
              </Pressable>
            </View>

          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  scroll: { padding: 14, paddingTop: 76, gap: 10, paddingBottom: 110 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12 },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  headerTitle: { fontSize: 18, fontWeight: "bold", color: "#fff", letterSpacing: -0.2 },
  headerSub: { fontSize: 13, color: "#71717a" },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#1e3a8a", alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontSize: 14, fontWeight: "800" },
  bellBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#1c1c1e", borderWidth: 0.5, borderColor: "#333", alignItems: "center", justifyContent: "center" },

  hero: { backgroundColor: "#0d0d0d", borderRadius: 20, borderWidth: 0.8, borderColor: "#1f1f1f" },
  heroLabel: { fontSize: 10, fontWeight: "700", color: "#71717a", letterSpacing: 0.5 },
  heroValueRow: { flexDirection: "row", alignItems: "flex-start", flexWrap: "nowrap" },
  heroCurrency: { fontSize: 20, fontWeight: "600", color: "#fff", lineHeight: 24, marginTop: 6, marginRight: 4 },
  heroValue: { flexShrink: 1, fontSize: 36, fontWeight: "800", color: "#fff", letterSpacing: -0.5, lineHeight: 40, includeFontPadding: false },
  trendBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 14, backgroundColor: "rgba(16, 185, 129, 0.12)" },
  trendText: { fontSize: 11, fontWeight: "700", color: "#10b981" },
  heroColumns: { flexDirection: "row", flexWrap: "wrap", gap: 14, marginTop: 10, paddingBottom: 10 },
  heroCol: { gap: 4 },
  heroColLabel: { fontSize: 11, color: "#71717a", fontWeight: "500" },
  heroColValue: { fontSize: 14, color: "#fff", fontWeight: "700" },

  presetRow: { flexDirection: "row", backgroundColor: "#0c0c0c", borderRadius: 12, borderWidth: 0.5, borderColor: "#222", padding: 4, marginVertical: 14, alignItems: "center" },
  presetBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  presetBtnAct: { backgroundColor: "#27272a" },
  presetText: { fontSize: 13, fontWeight: "600", color: "#71717a" },
  presetTextAct: { color: "#fff", fontWeight: "700" },

  statGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 10 },
  statCard: { width: "48.5%", backgroundColor: "#0c0c0c", borderRadius: 20, borderWidth: 0.8, borderColor: "#1f1f1f", padding: 16, gap: 6 },
  gridIconBg: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  statLabel: { fontSize: 10, fontWeight: "600", color: "#71717a", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 4 },
  statValue: { fontSize: 22, fontWeight: "bold", color: "#fff", marginTop: 2, paddingVertical: 1 },
  statSub: { fontSize: 11, color: "#52525b", fontWeight: "500", marginTop: 2 },
  statTrend: { fontSize: 11, fontWeight: "600", marginTop: 2 },

  card: { backgroundColor: "#0d0d0d", borderRadius: 20, borderWidth: 0.8, borderColor: "#1f1f1f", padding: 16, gap: 12 },
  cardHeader: { fontSize: 14, fontWeight: "700", color: "#fff" },
  progressBarBg: { height: 6, borderRadius: 3, backgroundColor: "#1c1c1e", overflow: "hidden" },
  progressBarFill: { height: "100%", borderRadius: 3 },

  tipCard: { flexDirection: "row", gap: 10, backgroundColor: "#070707", borderRadius: 14, borderWidth: 0.8, borderColor: "#1a1a1a", padding: 12, alignItems: "center" },

  activeBanner: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#0d0d0d", borderRadius: 20, borderWidth: 0.8, borderColor: "#1f1f1f", padding: 16 },
  activeBannerTitle: { fontSize: 13, fontWeight: "700", color: "#fff" },
  activeBannerSub: { fontSize: 11, color: "#888" },
  pulseDot: { width: 6, height: 6, borderRadius: 3 },

  actionBar: { position: "absolute", bottom: 0, left: 0, right: 0, flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "rgba(0, 0, 0, 0.4)", borderTopWidth: 0.5, borderTopColor: "#1e1e1e", paddingBottom: Platform.OS === "ios" ? 34 : 20, zIndex: 1000, overflow: "hidden" },
  secBtn: { flex: 1, height: 44, borderRadius: 12, backgroundColor: "#0c0c0c", borderWidth: 0.8, borderColor: "#1e1e1e", justifyContent: "center", alignItems: "center" },
  secBtnText: { fontSize: 12, fontWeight: "700", color: "#888" },
  primBtn: { width: 72, height: 72, borderRadius: 36, justifyContent: "center", alignItems: "center", marginHorizontal: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
  primBtnText: { fontSize: 13, fontWeight: "800", textAlign: "center" },

  clockOverlay: { flex: 1, backgroundColor: "#000" },
  clockHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 14, borderBottomWidth: 0.5, borderBottomColor: "#1e1e1e" },
  clockCloseBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, backgroundColor: "#1c1c1e" },
  clockBody: { flex: 1, justifyContent: "center", alignItems: "center", gap: 20 },
  clockDigits: { fontSize: 52, fontWeight: "bold", color: "#fff", fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace", paddingVertical: 8, textAlign: "center", textAlignVertical: "center", includeFontPadding: false },
  clockLabel: { fontSize: 12, color: "#888", textTransform: "uppercase", fontWeight: "700", letterSpacing: 1 },
  clockSecBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 38, borderRadius: 8, backgroundColor: "#0c0c0c", borderWidth: 0.5, borderColor: "#1e1e1e" },
  clockSecBtnText: { fontSize: 12, fontWeight: "700", color: "#fff" },

  wizardOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "center", padding: 20 },
  wizardContent: { backgroundColor: "#080808", borderRadius: 20, borderWidth: 1, borderColor: "#1e1e1e", padding: 16, gap: 16 },
  wizardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomWidth: 0.5, borderBottomColor: "#1e1e1e", paddingBottom: 10 },
  wizardTitle: { fontSize: 15, fontWeight: "800", color: "#fff" },
  wizardCloseBtn: { padding: 4 },
  wizardCloseText: { fontSize: 18, color: "#6b7280" },
  wizardLabel: { fontSize: 14, fontWeight: "700", color: "#fff" },
  wizardSubLabel: { fontSize: 12, fontWeight: "600", color: "#888" },
  wizardRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 10, backgroundColor: "#0c0c0c", borderWidth: 0.5, borderColor: "#1e1e1e" },
  wizardRowSel: { borderColor: "#fff" },
  wizardRowTitle: { fontSize: 13, fontWeight: "700", color: "#fff" },
  wizardRowSub: { fontSize: 11, color: "#6b7280" },
  wizardInput: { flex: 1, height: 40, backgroundColor: "#0c0c0c", borderWidth: 0.5, borderColor: "#1e1e1e", borderRadius: 8, paddingHorizontal: 10, color: "#fff", fontSize: 13, fontWeight: "600" },
  wizardFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 0.5, borderTopColor: "#222", paddingTop: 14, marginTop: 2 },
  wizardBackBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  wizardNextBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 },
  wizardNextBtnText: { fontSize: 12, fontWeight: "700" },

  demoBanner: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "rgba(245, 158, 11, 0.1)", borderWidth: 0.8, borderColor: "rgba(245, 158, 11, 0.2)", padding: 12, borderRadius: 20, marginBottom: 12, marginHorizontal: 16 },
  demoText: { fontSize: 11, fontWeight: "800", color: "#f59e0b" },
  demoBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: "rgba(245, 158, 11, 0.2)" },
  demoBtnText: { fontSize: 11, fontWeight: "800", color: "#f59e0b" },
});
