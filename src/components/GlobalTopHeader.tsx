import * as React from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  LayoutAnimation,
  Platform,
  UIManager,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useSettingsStore } from "@/store/useSettingsStore";
import { PLATFORMS, type PlatformKey } from "@/src/registry/platforms";
import { Bell, Settings, ChevronDown, ChevronUp } from "lucide-react-native";
import Svg, { Path, Circle, Rect, G } from "react-native-svg";

// Enable LayoutAnimation on Android
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ── Platform SVG logos (exact PWA brand assets) ────────────────────────────
const PlatformLogo = ({ id, size = 14 }: { id: string; size?: number }) => {
  switch (id) {
    case "doordash":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M23.071 8.409a6.09 6.09 0 0 0-5.396-3.228H.584A.589.589 0 0 0 .17 6.184L3.894 9.93a1.752 1.752 0 0 0 1.242.516h12.049a1.554 1.554 0 1 1 .031 3.108H8.91a.589.589 0 0 0-.415 1.003l3.725 3.747a1.75 1.75 0 0 0 1.242.516h3.757c4.887 0 8.584-5.225 5.852-10.413"
            fill="#FF3008"
          />
        </Svg>
      );
    case "ubereats":
      return (
        <Svg width={size} height={size} viewBox="0 0 192 192" fill="none">
          <Path d="M20 41.85v31.73c.77 8.11 8.14 14.41 16.88 14.52 8.91.12 16.58-6.25 17.36-14.52V41.85" stroke="#06C167" strokeLinecap="round" strokeLinejoin="round" strokeWidth={8} />
          <Path d="M54.24 88.11V55.2m13.84 32.91V41.85" stroke="#06C167" strokeLinecap="round" strokeMiterlimit={10} strokeWidth={8} />
          <Circle cx={84.53} cy={71.66} r={16.45} stroke="#06C167" strokeLinecap="round" strokeMiterlimit={10} strokeWidth={8} />
          <Path d="M142.57 82.97c-3 3.17-7.24 5.14-11.95 5.14-9.09 0-16.45-7.37-16.45-16.45s7.37-16.45 16.45-16.45 16.45 7.37 16.45 16.45h-32.9" stroke="#06C167" strokeLinecap="round" strokeLinejoin="round" strokeWidth={8} />
          <Path d="M160.22 88.11V56.96m11.78 0h0c-1.9 0-3.77.45-5.45 1.32-2.73 1.42-6.33 3.97-6.33 7.51" stroke="#06C167" strokeLinecap="round" strokeMiterlimit={10} strokeWidth={8} />
        </Svg>
      );
    case "instacart":
      return (
        <Svg width={size} height={size} viewBox="0 0 32 32">
          <Path
            d="M20.839 12.823c1.896 1.906 3.443 5.026 2.557 6.87-2.37 4.953-20.052 13.635-21.557 12.135-1.5-1.5 7.188-19.193 12.135-21.568 1.849-.88 4.964.682 6.87 2.563l-.005.021zM30.208 10.74c-.307-1.141-1.094-2.292-2.266-2.427-2.146-.25-5.536 3.547-5.297 4.448.245.922 5.026 2.5 6.802 1.224.922-.661 1.042-2.083.74-3.219zM23.552.208c1.599.432 3.214 1.531 3.406 3.177.344 3.016-4.979 7.76-6.245 7.422-1.26-.339-3.49-7.047-1.688-9.552.927-1.297 2.932-1.474 4.531-1.052v.005z"
            fill="#0AAD0A"
          />
        </Svg>
      );
    case "skip":
      return (
        <Svg width={size} height={size} viewBox="0 0 20 20">
          <Rect width={20} height={20} rx={4} fill="#ED5A1F" />
          <Path d="M6 6h8v2H9v2h4v2H9v4H6V6z" fill="#FFFFFF" />
        </Svg>
      );
    case "amazonflex":
    case "amazon":
      return (
        <Svg width={size} height={size} viewBox="0 0 20 20">
          <Rect width={20} height={20} rx={4} fill="#232F3E" />
          <Path d="M5 14V6h2l2.5 5 2.5-5h2v8h-2V9.5L9 14H8L6 9.5V14H5z" fill="#FF9900" />
        </Svg>
      );
    case "foodora":
      return (
        <Svg width={size} height={size} viewBox="0 0 20 20">
          <Rect width={20} height={20} rx={4} fill="#D8003F" />
          <Path d="M7 5h6v2H9v2h3v2H9v4H7V5z" fill="#FFFFFF" />
        </Svg>
      );
    case "lyft":
      return (
        <Svg width={size} height={size} viewBox="0 0 20 20">
          <Rect width={20} height={20} rx={4} fill="#FF00BF" />
          <Path d="M7 5v8c0 1.1.9 2 2 2h4v-2H9V5H7z" fill="#FFFFFF" />
        </Svg>
      );
    default:
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <Rect x={2} y={7} width={20} height={14} rx={2} ry={2} />
          <Path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
        </Svg>
      );
  }
};

// ── Component ──────────────────────────────────────────────────────────────
export default function GlobalTopHeader() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile, activePlatformFilter, setActivePlatformFilter } = useSettingsStore();

  const [isExpanded, setIsExpanded] = React.useState(false);

  // ── Derived: active platform config ────────────────────────────────────
  const activePlatformConfig = React.useMemo<{ label: string; color: string } | null>(() => {
    if (activePlatformFilter === "all") return null;
    const cfg = PLATFORMS[activePlatformFilter as PlatformKey];
    return cfg ?? null;
  }, [activePlatformFilter]);

  const accentColor = activePlatformConfig?.color ?? "#10b981"; // green when "all"
  const activeLabel = activePlatformConfig?.label ?? "All Platforms";

  // ── Initials from display name ──────────────────────────────────────────
  const initials = React.useMemo(() => {
    const name = profile?.displayName?.trim() || "";
    if (!name) return "DR";
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }, [profile?.displayName]);

  const selectedPlatformsList: string[] = profile?.selectedPlatforms ?? [];
  const allPlatformIds = ["all", ...selectedPlatformsList];

  // ── Toggle ──────────────────────────────────────────────────────────────
  const handleToggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsExpanded((v) => !v);
  };

  const handleSelectFilter = (id: string) => {
    setActivePlatformFilter(id);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsExpanded(false);
  };

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 8) }]}>
      {/* ── Platform accent strip ── */}
      <View style={[styles.accentStrip, { backgroundColor: accentColor }]} />

      {/* ── Main header row ── */}
      <View style={styles.headerRow}>
        {/* Avatar → Settings */}
        <Pressable
          style={[styles.avatar, { borderColor: accentColor + "40" }]}
          onPress={() => router.push("/settings")}
        >
          <Text style={styles.avatarText}>{initials}</Text>
        </Pressable>

        {/* Centre: collapsed pill / trigger ── */}
        <Pressable style={[styles.filterPill, { borderColor: accentColor + "55" }]} onPress={handleToggleExpand}>
          {/* Color swatch dot */}
          <View style={[styles.swatchDot, { backgroundColor: accentColor }]} />

          {/* Active label */}
          <Text style={styles.filterPillLabel} numberOfLines={1}>
            {activeLabel}
          </Text>

          {/* Platform logo (only when not "all") */}
          {activePlatformConfig && (
            <View style={styles.pillLogoWrap}>
              <PlatformLogo id={activePlatformFilter} size={13} />
            </View>
          )}

          {/* Chevron */}
          {isExpanded
            ? <ChevronUp size={14} color="#94a3b8" strokeWidth={2.5} style={{ marginLeft: 2 }} />
            : <ChevronDown size={14} color="#94a3b8" strokeWidth={2.5} style={{ marginLeft: 2 }} />
          }
        </Pressable>

        {/* Right icons */}
        <View style={styles.rightIcons}>
          <Pressable style={styles.iconBtn} onPress={() => router.push("/settings")}>
            <Bell size={19} color="#10b981" strokeWidth={2} />
          </Pressable>
          <Pressable style={styles.iconBtn} onPress={() => router.push("/settings")}>
            <Settings size={19} color="#94a3b8" strokeWidth={2} />
          </Pressable>
        </View>
      </View>

      {/* ── Expanded platform picker ── */}
      {isExpanded && (
        <View style={styles.dropdownPanel}>
          {/* Header label */}
          <Text style={styles.dropdownHeading}>Filter by Platform</Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pillScroll}
          >
            {allPlatformIds.map((pId) => {
              const isAll = pId === "all";
              const isSelected = activePlatformFilter === pId;
              const cfg = !isAll ? PLATFORMS[pId as PlatformKey] : null;
              const pColor = cfg?.color ?? "#10b981";

              return (
                <Pressable
                  key={pId}
                  onPress={() => handleSelectFilter(pId)}
                  style={[
                    styles.dropdownPill,
                    isSelected
                      ? { borderColor: pColor, backgroundColor: pColor + "18" }
                      : styles.dropdownPillInactive,
                  ]}
                >
                  {/* Logo area */}
                  <View style={[
                    styles.dropdownPillLogo,
                    {
                      backgroundColor: isAll
                        ? (isSelected ? "#10b98133" : "#2a2a28")
                        : isSelected
                          ? pColor + "33"
                          : "#1e1e1c",
                      borderColor: isSelected ? pColor + "44" : "transparent",
                      borderWidth: 1,
                    },
                  ]}>
                    {isAll
                      ? <Text style={[styles.dropdownPillLogoText, { color: isSelected ? "#10b981" : "#94a3b8" }]}>∞</Text>
                      : <PlatformLogo id={pId} size={14} />
                    }
                  </View>

                  {/* Label */}
                  <Text style={[
                    styles.dropdownPillLabel,
                    { color: isSelected ? "#ffffff" : "#71717a" },
                  ]}>
                    {isAll ? "All" : cfg?.label || pId}
                  </Text>

                  {/* Active checkmark dot */}
                  {isSelected && (
                    <View style={[styles.checkDot, { backgroundColor: pColor }]} />
                  )}
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Active filter info bar (only when not "all") */}
          {activePlatformConfig && (
            <View style={[styles.filterInfoBar, { borderColor: accentColor + "30", backgroundColor: accentColor + "0D" }]}>
              <View style={[styles.filterInfoDot, { backgroundColor: accentColor }]} />
              <Text style={[styles.filterInfoText, { color: accentColor }]}>
                Dashboard filtered · {activePlatformConfig.label} only
              </Text>
              <Pressable onPress={() => handleSelectFilter("all")} style={styles.clearFilterBtn}>
                <Text style={styles.clearFilterText}>Clear</Text>
              </Pressable>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    backgroundColor: "#0d0d0c",
    borderBottomWidth: 1,
    borderBottomColor: "#1a1a19",
    zIndex: 50,
  },

  // 2-px accent strip at very top
  accentStrip: {
    height: 2,
    width: "100%",
  },

  // Header row
  headerRow: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 10,
  },

  // Avatar
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 9,
    backgroundColor: "#064e3b",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
  },
  avatarText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "bold",
    letterSpacing: 0.5,
  },

  // Collapsed filter pill (centre, takes remaining space)
  filterPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "#161615",
    borderWidth: 1,
    borderRadius: 9999,
    paddingHorizontal: 13,
    height: 36,
  },
  swatchDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  filterPillLabel: {
    flex: 1,
    color: "#e2e8f0",
    fontSize: 13,
    fontWeight: "600",
  },
  pillLogoWrap: {
    justifyContent: "center",
    alignItems: "center",
  },

  // Right icons
  rightIcons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  iconBtn: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
  },

  // Expanded dropdown
  dropdownPanel: {
    backgroundColor: "#0d0d0c",
    borderTopWidth: 1,
    borderTopColor: "#1a1a19",
    paddingBottom: 10,
    paddingTop: 10,
  },
  dropdownHeading: {
    color: "#52525b",
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  pillScroll: {
    paddingHorizontal: 12,
    gap: 8,
    alignItems: "center",
  },
  dropdownPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1.5,
    borderRadius: 9999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  dropdownPillInactive: {
    borderColor: "#262624",
    backgroundColor: "transparent",
  },
  dropdownPillLogo: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
  },
  dropdownPillLogoText: {
    fontSize: 14,
    fontWeight: "900",
  },
  dropdownPillLabel: {
    fontSize: 13,
    fontWeight: "700",
  },
  checkDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginLeft: 2,
  },

  // Active filter info bar shown inside dropdown
  filterInfoBar: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 12,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  filterInfoDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  filterInfoText: {
    flex: 1,
    fontSize: 11,
    fontWeight: "700",
  },
  clearFilterBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 6,
  },
  clearFilterText: {
    color: "#94a3b8",
    fontSize: 10,
    fontWeight: "700",
  },
});
