import React from "react";
import { View, TouchableOpacity, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Text } from "@/src/components/ui/text";
import { CSVImportWizard } from "@/src/components/shifts/CSVImportWizard";

export default function CSVImportScreen() {
  return (
    <SafeAreaView className="dark flex-1 bg-[#000]">
      {/* Header */}
      <View className="px-4 pt-3 pb-3 border-b border-[#1E1E23] bg-[#0F0F12] flex-row items-center justify-between">
        <TouchableOpacity onPress={() => router.back()} className="px-3 py-2 bg-[#1E1E23] rounded-lg border border-[#26262C]">
          <Text className="text-zinc-300 text-xs font-semibold">← Cancel</Text>
        </TouchableOpacity>
        <Text className="text-white font-bold text-sm tracking-tight">CSV Import Wizard</Text>
        <View style={{ width: 60 }} /> {/* Spacer */}
      </View>

      <ScrollView contentContainerClassName="p-4 flex flex-col gap-4">
        <CSVImportWizard />
      </ScrollView>
    </SafeAreaView>
  );
}
