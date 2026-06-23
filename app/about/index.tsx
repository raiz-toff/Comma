import React, { useState } from "react";
import { ScrollView, View, TouchableOpacity, Share, Linking, Platform, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import Constants from "expo-constants";
import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system/legacy";
import { Text } from "@/src/components/ui/text";

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
  const [isExporting, setIsExporting] = useState(false);

  const appVersion = Constants.expoConfig?.version || "1.0.0";
  const sdkVersion = Constants.expoConfig?.sdkVersion || "56.0.0";

  const handleContactSupport = () => {
    Linking.openURL("mailto:support@comma.app?subject=Comma%20Support%20Request");
  };

  const handleExportDiagnostics = async () => {
    setIsExporting(true);
    try {
      // Load diagnostic log asset
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
        // Fallback for browser blocking popups/shares
        console.log("Diagnostic log:", err);
      } else {
        // Native alert
      }
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <SafeAreaView className="dark flex-1 bg-[#0b0f19]">
      {/* Header */}
      <View className="px-4 pt-3 pb-2 border-b border-slate-800/80 bg-slate-900/40 flex-row justify-between items-center">
        <TouchableOpacity
          onPress={() => router.back()}
          className="py-2 px-3 bg-slate-800/40 rounded-lg border border-slate-700/30"
        >
          <Text className="text-slate-300 text-xs font-semibold">Back</Text>
        </TouchableOpacity>
        <Text className="text-slate-100 text-base font-extrabold tracking-tight">About Comma</Text>
        <View className="w-10" />
      </View>

      <ScrollView contentContainerClassName="p-4 pb-20 flex flex-col gap-6">
        {/* Brand Hero */}
        <View className="items-center py-6 flex-col gap-2">
          <Text className="text-4xl font-extrabold text-emerald-500 tracking-tighter">COMMA</Text>
          <Text className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
            Gig Economy Tracker
          </Text>
          <Text className="text-[10px] text-slate-600 font-bold mt-1">
            v{appVersion} (SDK {sdkVersion})
          </Text>
        </View>

        {/* Privacy statement */}
        <View className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 flex flex-col gap-2">
          <Text className="text-sm font-bold text-slate-100 flex-row items-center gap-1.5">
            🔒 100% Local Privacy
          </Text>
          <Text className="text-xs text-slate-400 leading-relaxed font-medium">
            Comma does not collect, sell, or upload any of your personal details, locations, or earnings. Your financial logs and shift histories are stored strictly inside your device's secure SQLite sandbox.
          </Text>
        </View>

        {/* Support & Action */}
        <View className="flex flex-col gap-3">
          <Text className="text-slate-400 text-xs font-bold uppercase tracking-wide">Developer & Support</Text>
          
          <TouchableOpacity
            onPress={handleContactSupport}
            className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex-row justify-between items-center"
          >
            <View>
              <Text className="text-sm font-bold text-slate-200">Contact Support</Text>
              <Text className="text-[10px] text-slate-500">Email questions or bug reports directly to support</Text>
            </View>
            <Text className="text-slate-400 text-xs font-bold">→</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleExportDiagnostics}
            disabled={isExporting}
            className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex-row justify-between items-center"
          >
            <View className="flex-1 pr-4">
              <Text className="text-sm font-bold text-slate-200">Export Diagnostic Log</Text>
              <Text className="text-[10px] text-slate-500">Generate a text transcript of structural change logs</Text>
            </View>
            {isExporting ? (
              <ActivityIndicator size="small" color="#10b981" />
            ) : (
              <Text className="text-slate-400 text-xs font-bold">📤</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Acknowledgments */}
        <View className="flex flex-col gap-3">
          <Text className="text-slate-400 text-xs font-bold uppercase tracking-wide">Open Source Acknowledgments</Text>
          <View className="flex flex-col gap-2.5">
            {ACKNOWLEDGMENTS.map((ack, idx) => (
              <View
                key={idx}
                className="bg-slate-900/40 border border-slate-800/60 rounded-xl px-4 py-3"
              >
                <Text className="text-xs text-slate-200 font-bold">{ack.name}</Text>
                <Text className="text-[10px] text-slate-500 font-semibold mt-0.5">{ack.description}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Footer info */}
        <View className="items-center mt-4">
          <Text className="text-[9px] text-slate-600 font-bold uppercase tracking-widest">
            Made with ❤️ for gig economy drivers
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
