import React, { useState } from "react";
import { ScrollView, View, TouchableOpacity, Share, Linking, Platform, ActivityIndicator, StyleSheet, Alert } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import Constants from "expo-constants";
import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system/legacy";
import { Text } from "@/src/components/ui/text";
import { ChevronLeft, ShieldCheck, Mail, FileText, Heart, Terminal, Share2 } from "lucide-react-native";
import { usePlatformTheme } from "@/src/hooks/usePlatformTheme";
import { notify } from "@/src/services/notify";

// ─── Design tokens ──────────────────────────────────────────────────────────
const DS = {
  pageBg: "#000",
  cardBg: "#0F0F12",
  cardBorder: "#1E1E23",
  inputBg: "#16161A",
  inputBorder: "#2E2E36",
  sep: "#1E1E23",

  brand: "#F6F6F7",
  brandSurface: "rgba(255, 255, 255, 0.08)",
  brandBorder: "rgba(255, 255, 255, 0.18)",
  brandText: "#F6F6F7",

  textPrimary: "#F6F6F7",
  textSecondary: "#65656E",
  textMuted: "#2E2E36",
  textLabel: "#48473f",

  rCard: 18,
  rInput: 11,
  rChip: 8,
  rPill: 20,

  pagePad: 16,
  cardPad: 15,
  rowPad: 13,
} as const;

const isWeb = Platform.OS === "web";

const ACKNOWLEDGMENTS = [
  { name: "Expo SDK 56", description: "Universal React Native application chassis" },
  { name: "Drizzle ORM", description: "Type-safe SQL query builder and schema management" },
  { name: "SQLite", description: "Embedded relational database engine" },
  { name: "TanStack Query v5", description: "Asynchronous state synchronization and caching" },
  { name: "Zustand", description: "Lightweight store management for settings and session state" },
  { name: "NativeWind v4", description: "Tailwind CSS integration for React Native styling" },
];

export default function AboutScreen() {
  const { accentColor } = usePlatformTheme();
  const [isExporting, setIsExporting] = useState(false);
  const [debugTapCount, setDebugTapCount] = useState(0);
  const [debugTapTs, setDebugTapTs] = useState(0);
  const insets = useSafeAreaInsets();

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

  const appVersion = Constants.expoConfig?.version || "1.0.0";
  const sdkVersion = Constants.expoConfig?.sdkVersion || "56.0.0";

  const handleContactSupport = () => {
    Linking.openURL("mailto:support@comma.app?subject=Comma%20Support%20Request");
  };

  const handleShareApp = () => {
    Share.share({
      message: "Track gig work earnings with COMMA — local-first, no cloud required.",
    });
  };

  const handleExportDiagnostics = async () => {
    setIsExporting(true);
    try {
      const asset = Asset.fromModule(require("@/assets/system_log.txt"));
      await asset.downloadAsync();

      let logContent = "";
      if (isWeb) {
        const response = await fetch(asset.uri);
        logContent = await response.text();
      } else if (asset.localUri) {
        logContent = await FileSystem.readAsStringAsync(asset.localUri);
      }

      if (!logContent) {
        logContent = "Diagnostic log is empty or could not be loaded.";
      }

      await Share.share({
        message: logContent,
        title: "Comma Diagnostic Log",
      });
    } catch (err: any) {
      if (isWeb) {
        console.log("Diagnostic log:", err);
      }
      // Surface the failure (native previously swallowed it silently).
      notify({
        title: "Export failed",
        description: "Couldn't export the diagnostic log. Please try again.",
        type: "warning",
        iconKey: "error",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={["bottom", "left", "right"]}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 10 }]}>
        <View style={s.headerLeft}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <ChevronLeft color={DS.textPrimary} size={20} />
          </TouchableOpacity>
          <View>
            <Text style={s.headerTitle}>About Comma</Text>
            <Text style={s.headerSub}>System stats & information</Text>
          </View>
        </View>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Brand Hero */}
        <View style={s.hero}>
          <Text style={s.heroTitle}>COMMA</Text>
          <Text style={s.heroSub}>Gig Economy Tracker</Text>
          <TouchableOpacity onPress={handleVersionTap} activeOpacity={0.8}>
            <Text style={s.heroVersion}>
              v{appVersion} (SDK {sdkVersion})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Privacy statement */}
        <View style={s.card}>
          <View style={s.privacyRow}>
            <View style={s.privacyIconBox}>
              <ShieldCheck color={accentColor} size={22} />
            </View>
            <View style={s.privacyContent}>
              <Text style={s.privacyTitle}>100% Local Privacy</Text>
              <Text style={s.privacyDesc}>
                Comma does not collect, sell, or upload any of your personal details, locations, or earnings. Your financial logs and shift histories are stored strictly inside your device's secure SQLite sandbox.
              </Text>
            </View>
          </View>
        </View>

        {/* Data Portability */}
        <View style={s.card}>
          <View style={s.privacyRow}>
            <View style={s.privacyIconBox}>
              <FileText color={accentColor} size={22} />
            </View>
            <View style={s.privacyContent}>
              <Text style={s.privacyTitle}>Data Portability Manifesto</Text>
              <Text style={s.privacyDesc}>
                Your financial records belong strictly to you. COMMA guarantees open imports and clean CSV exports at all times, with no proprietary vendor lock-in.
              </Text>
            </View>
          </View>
        </View>

        {/* Support & Action */}
        <View>
          <Text style={s.groupLabel}>Developer & Support</Text>
          <View style={s.menuCard}>
            <TouchableOpacity onPress={handleContactSupport} style={s.menuRow}>
              <View style={s.menuIconBox}>
                <Mail color={DS.textSecondary} size={18} />
              </View>
              <View style={s.menuContent}>
                <Text style={s.menuTitle}>Contact Support</Text>
                <Text style={s.menuDesc}>Email questions or bug reports directly to support</Text>
              </View>
              <View style={s.chevron} />
            </TouchableOpacity>

            <View style={s.sep} />

            <TouchableOpacity onPress={handleShareApp} style={s.menuRow}>
              <View style={s.menuIconBox}>
                <Share2 color={DS.textSecondary} size={18} />
              </View>
              <View style={s.menuContent}>
                <Text style={s.menuTitle}>Share COMMA</Text>
                <Text style={s.menuDesc}>Recommend Comma to other drivers</Text>
              </View>
              <View style={s.chevron} />
            </TouchableOpacity>

            <View style={s.sep} />

            <TouchableOpacity onPress={handleExportDiagnostics} disabled={isExporting} style={s.menuRow}>
              <View style={s.menuIconBox}>
                <FileText color={DS.textSecondary} size={18} />
              </View>
              <View style={s.menuContent}>
                <Text style={s.menuTitle}>Export Diagnostic Log</Text>
                <Text style={s.menuDesc}>Generate a text transcript of structural change logs</Text>
              </View>
              {isExporting ? (
                <ActivityIndicator size="small" color={accentColor} />
              ) : (
                <View style={s.chevron} />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Acknowledgments */}
        <View>
          <Text style={s.groupLabel}>Open Source Acknowledgments</Text>
          <View style={s.ackGrid}>
            {ACKNOWLEDGMENTS.map((ack, idx) => (
              <View key={idx} style={s.ackItem}>
                <View style={s.ackIconBox}>
                  <Terminal color={DS.textSecondary} size={15} />
                </View>
                <View style={s.ackContent}>
                  <Text style={s.ackTitle}>{ack.name}</Text>
                  <Text style={s.ackDesc}>{ack.description}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Footer info */}
        <View style={s.footer}>
          <Text style={s.footerText}>Made with</Text>
          <Heart color={accentColor} size={11} fill={accentColor} />
          <Text style={s.footerText}>for gig economy drivers</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: DS.pageBg,
  },
  header: {
    paddingHorizontal: DS.pagePad,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerTitle: {
    color: DS.textPrimary,
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  headerSub: {
    color: DS.textSecondary,
    fontSize: 10,
    marginTop: 1,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: DS.inputBg,
    borderWidth: 0.5,
    borderColor: DS.inputBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: DS.pagePad,
    paddingTop: 10,
    paddingBottom: 40,
    gap: 20,
  },
  hero: {
    alignItems: "center",
    paddingVertical: 24,
    gap: 4,
  },
  heroTitle: {
    fontSize: 44,
    fontWeight: "900",
    color: DS.brandText,
    letterSpacing: -0.5,
    lineHeight: 52,
    paddingHorizontal: 12,
  },
  heroSub: {
    fontSize: 11,
    fontWeight: "700",
    color: DS.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  heroVersion: {
    fontSize: 10,
    color: DS.textSecondary,
    fontWeight: "600",
    marginTop: 2,
  },
  groupLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: DS.textLabel,
    letterSpacing: 0.9,
    marginBottom: 8,
    textTransform: "uppercase",
    paddingHorizontal: 2,
  },
  card: {
    backgroundColor: DS.cardBg,
    borderRadius: DS.rCard,
    borderWidth: 0.5,
    borderColor: DS.cardBorder,
    padding: DS.cardPad,
  },
  privacyRow: {
    flexDirection: "row",
    gap: 12,
  },
  privacyIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: DS.brandSurface,
    borderWidth: 0.5,
    borderColor: DS.brandBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  privacyContent: {
    flex: 1,
  },
  privacyTitle: {
    color: DS.textPrimary,
    fontSize: 14,
    fontWeight: "700",
  },
  privacyDesc: {
    color: DS.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  menuCard: {
    backgroundColor: DS.cardBg,
    borderRadius: DS.rCard,
    borderWidth: 0.5,
    borderColor: DS.cardBorder,
    overflow: "hidden",
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: DS.cardPad,
    paddingVertical: DS.rowPad,
    gap: 12,
  },
  menuIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: DS.inputBg,
    borderWidth: 0.5,
    borderColor: DS.inputBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  menuContent: {
    flex: 1,
  },
  menuTitle: {
    color: DS.textPrimary,
    fontSize: 13.5,
    fontWeight: "600",
  },
  menuDesc: {
    color: DS.textSecondary,
    fontSize: 10.5,
    marginTop: 2,
  },
  chevron: {
    width: 8,
    height: 8,
    borderTopWidth: 2,
    borderRightWidth: 2,
    borderColor: DS.textSecondary,
    transform: [{ rotate: "45deg" }],
  },
  sep: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: DS.sep,
    marginHorizontal: DS.cardPad,
  },
  ackGrid: {
    gap: 8,
  },
  ackItem: {
    backgroundColor: DS.cardBg,
    borderRadius: DS.rCard - 4,
    borderWidth: 0.5,
    borderColor: DS.cardBorder,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  ackIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: DS.inputBg,
    borderWidth: 0.5,
    borderColor: DS.inputBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  ackContent: {
    flex: 1,
  },
  ackTitle: {
    color: DS.textPrimary,
    fontSize: 12,
    fontWeight: "700",
  },
  ackDesc: {
    color: DS.textSecondary,
    fontSize: 10,
    marginTop: 2,
  },
  footer: {
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
    marginTop: 10,
    paddingVertical: 10,
  },
  footerText: {
    fontSize: 9.5,
    color: DS.textSecondary,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
});
