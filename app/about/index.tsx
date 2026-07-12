import React, { useState } from "react";
import {
  View,
  ScrollView,
  TouchableOpacity,
  Share,
  Linking,
  Platform,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import Constants from "expo-constants";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { Text } from "@/src/components/ui/text";
import { Image } from "expo-image";
import { ChevronLeft, ChevronRight, Heart, Share2, Terminal, Globe, Coffee, BookOpen } from "lucide-react-native";
import { usePlatformTheme } from "@/src/hooks/usePlatformTheme";
import { useColors, useThemedStyles, type Palette } from "@/src/theme/useColors";
import { useLayout } from "@/src/hooks/useLayout";
import { notify } from "@/src/services/notify";
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";

const makeDS = (C: Palette) =>
  ({
    pageBg: C.background,
    cardBg: C.surface02,
    cardBorder: C.lineSubtle,
    inputBg: C.surface03,
    inputBorder: C.lineStrong,
    sep: C.lineSubtle,
    textPrimary: C.contentPrimary,
    textSecondary: C.contentSecondary,
    textLabel: C.contentMuted,
    rCard: 16,
    pagePad: 16,
    cardPad: 16,
  }) as const;

const isWeb = Platform.OS === "web";

export default function AboutScreen() {
  const { accentColor } = usePlatformTheme();
  const DS = useThemedStyles(makeDS);
  const { columnStyle } = useLayout();
  const s = useThemedStyles(makeStyles);
  const [isExporting, setIsExporting] = useState(false);
  const [debugTapCount, setDebugTapCount] = useState(0);
  const [debugTapTs, setDebugTapTs] = useState(0);
  const insets = useSafeAreaInsets();

  const scale = useSharedValue(0.92);
  React.useEffect(() => {
    scale.value = withSpring(1, { damping: 14, stiffness: 120 });
  }, []);
  const heroStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handleVersionTap = () => {
    const now = Date.now();
    const freshCount = now - debugTapTs > 5500 ? 1 : debugTapCount + 1;
    setDebugTapTs(now);
    setDebugTapCount(freshCount);
    if (freshCount >= 5) {
      setDebugTapCount(0);
      Alert.alert("Debug mode", "Developer tools unlocked.", [
        { text: "OK" },
        { text: "Open dev tools", onPress: () => router.push("/debug") },
      ]);
    }
  };

  const appVersion = Constants.expoConfig?.version ?? "1.0.0";

  const handleExportDiagnostics = async () => {
    setIsExporting(true);
    try {
      let logContent = "";
      if (isWeb) {
        logContent = localStorage.getItem("comma_system_log") ?? "No diagnostic log found.";
        await Share.share({ message: logContent, title: "Comma Diagnostic Log" });
      } else {
        // Read the live system log bundled into the app's document directory
        const docDir = FileSystem.documentDirectory ?? "";
        // Fall back to the bundled asset if the live file isn't present
        const livePath = `${docDir}system_log.md`;
        const liveExists = await FileSystem.getInfoAsync(livePath);
        logContent = liveExists.exists
          ? await FileSystem.readAsStringAsync(livePath)
          : "Comma diagnostic log — no entries yet.";
        const tmpPath = `${FileSystem.cacheDirectory}comma_diagnostics.txt`;
        await FileSystem.writeAsStringAsync(tmpPath, logContent);
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(tmpPath, { mimeType: "text/plain", dialogTitle: "Comma Diagnostic Log" });
        } else {
          await Share.share({ message: logContent, title: "Comma Diagnostic Log" });
        }
      }
    } catch {
      notify({ title: "Export failed", description: "Couldn't export the diagnostic log.", type: "warning", iconKey: "error" });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={["bottom", "left", "right"]}>
      {/*
        Header. It sits OUTSIDE the ScrollView, so it needs the same cap as the
        content — otherwise on a tablet the back button hugs the screen edge while
        the content it belongs to sits centred a couple of hundred points away.
        `columnStyle` is undefined below 600pt, so this changes nothing on a phone.
      */}
      <View style={[s.header, { paddingTop: insets.top + 10 }, columnStyle]}>
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={8}
          style={s.backBtn}
        >
          <ChevronLeft color={DS.textPrimary} size={20} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[s.scrollContent, columnStyle]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <Animated.View style={[s.hero, heroStyle]}>
          <TouchableOpacity
            onPress={handleVersionTap}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Comma logo"
          >
            <Image
              source={require("../../assets/logo-with-text.png")}
              style={s.logoImage}
              contentFit="contain"
            />
          </TouchableOpacity>
          <Text variant="paragraphL" style={s.tagline}>Gig earnings tracker.{"\n"}Local-first. Open source.</Text>
          <View style={s.versionPill}>
            <Text style={s.versionText}>v{appVersion}</Text>
          </View>
        </Animated.View>

        {/* Creator */}
        <View style={s.creatorBlock}>
          <Text variant="labelXs" className="text-content-muted">BUILT BY</Text>
          <Text variant="headingM">Rajkumar Neupane</Text>
        </View>

        {/* Divider */}
        <View style={s.divider} />

        {/* Links */}
        <View style={s.links}>
          <LinkRow
            icon={<BookOpen size={18} color={accentColor} />}
            label="Help & Docs"
            sub="Guides, FAQ & troubleshooting"
            onPress={() => Linking.openURL("https://comma-docs.vercel.app")}
          />
          <View style={s.linkSep} />
          <LinkRow
            icon={<Globe size={18} color={accentColor} />}
            label="Portfolio"
            sub="rajkumarneupane.com"
            onPress={() => Linking.openURL("https://www.rajkumarneupane.com")}
          />
          <View style={s.linkSep} />
          <LinkRow
            icon={<Coffee size={18} color={accentColor} />}
            label="Buy Me a Coffee"
            sub="Support the project"
            onPress={() => Linking.openURL("https://buymeacoffee.com/raiztuffy")}
          />
          <View style={s.linkSep} />
          <LinkRow
            icon={<Share2 size={18} color={accentColor} />}
            label="Share Comma"
            sub="Tell another driver"
            onPress={() => Share.share({ message: "Track gig earnings with COMMA — local-first, no cloud needed." })}
          />
          <View style={s.linkSep} />
          <LinkRow
            icon={isExporting
              ? <ActivityIndicator size="small" color={accentColor} />
              : <Terminal size={18} color={accentColor} />}
            label="Export Diagnostics"
            sub="System change log"
            onPress={handleExportDiagnostics}
            disabled={isExporting}
          />
        </View>

        {/* Footer */}
        <View style={s.footer}>
          <Text variant="paragraphS" className="text-content-secondary">Made with </Text>
          <Heart size={11} color={accentColor} fill={accentColor} />
          <Text variant="paragraphS" className="text-content-secondary"> by a gig driver, for gig drivers</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function LinkRow({
  icon,
  label,
  sub,
  onPress,
  disabled = false,
}: {
  icon: React.ReactNode;
  label: string;
  sub: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const C = useColors();
  const s = useThemedStyles(makeStyles);
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="link"
      accessibilityState={{ disabled }}
      style={s.linkRow}
      activeOpacity={0.6}
    >
      <View style={s.linkIcon}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text variant="labelM">{label}</Text>
        <Text variant="paragraphS" className="text-content-secondary" style={{ marginTop: 2 }}>{sub}</Text>
      </View>
      <ChevronRight size={16} color={C.contentMuted} />
    </TouchableOpacity>
  );
}

const makeStyles = (C: Palette) => {
  const DS = makeDS(C);
  return StyleSheet.create({
  safe: { flex: 1, backgroundColor: DS.pageBg },
  scrollContent: { paddingBottom: 32 },

  header: {
    paddingHorizontal: DS.pagePad,
    paddingBottom: 8,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: DS.inputBg,
    borderWidth: 0.5, borderColor: DS.inputBorder,
    alignItems: "center", justifyContent: "center",
  },

  hero: {
    alignItems: "center",
    paddingTop: 20,
    paddingBottom: 24,
    gap: 10,
  },
  logoImage: {
    width: 260,
    height: 260,
  },
  tagline: {
    textAlign: "center",
  },
  versionPill: {
    marginTop: 4,
    backgroundColor: DS.inputBg,
    borderWidth: 0.5, borderColor: DS.inputBorder,
    borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 5,
  },
  versionText: {
    fontSize: 11, fontWeight: "700",
    color: DS.textSecondary,
    letterSpacing: 0.3,
  },

  creatorBlock: {
    alignItems: "center",
    paddingBottom: 28,
    gap: 4,
  },

  divider: {
    height: 0.5,
    backgroundColor: DS.cardBorder,
    marginHorizontal: DS.pagePad,
    marginBottom: 8,
  },

  links: {
    marginHorizontal: DS.pagePad,
    backgroundColor: DS.cardBg,
    borderRadius: DS.rCard,
    borderWidth: 0.5,
    borderColor: DS.cardBorder,
    overflow: "hidden",
    marginTop: 12,
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: DS.cardPad,
    paddingVertical: 14,
    gap: 14,
  },
  linkIcon: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: DS.inputBg,
    borderWidth: 0.5, borderColor: DS.inputBorder,
    alignItems: "center", justifyContent: "center",
  },
  linkSep: { height: 0.5, backgroundColor: DS.sep, marginHorizontal: DS.cardPad },

  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 24,
    paddingTop: 28,
  },
  });
};
