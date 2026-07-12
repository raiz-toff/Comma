import React from "react";
import { View, TouchableOpacity, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Text } from "@/src/components/ui/text";
import { CSVImportWizard } from "@/src/components/shifts/CSVImportWizard";

export default function CSVImportScreen() {
  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="px-4 pt-3 pb-3 border-b border-line-subtle bg-surface-02 flex-row items-center justify-between">
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => router.back()}
          className="px-3 py-2 bg-surface-04 rounded-lg border border-line-strong"
        >
          <Text variant="labelXs" className="text-content-secondary">← Cancel</Text>
        </TouchableOpacity>
        <Text variant="labelL" className="text-content-primary">CSV Import Wizard</Text>
        <View style={{ width: 60 }} /> {/* Spacer */}
      </View>

      <ScrollView contentContainerClassName="p-4 flex flex-col gap-4">
        <CSVImportWizard />
      </ScrollView>
    </SafeAreaView>
  );
}
