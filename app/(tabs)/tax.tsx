import React from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "../../src/components/ui/text";

export default function TaxScreen() {
  return (
    <SafeAreaView className="dark flex-1 bg-[#0b0f19] items-center justify-center p-4">
      <View className="items-center gap-2">
        <Text className="text-2xl font-extrabold text-slate-100 tracking-tight">Tax</Text>
        <Text className="text-sm text-slate-400 text-center">Tax estimations and summaries are pending implementation.</Text>
      </View>
    </SafeAreaView>
  );
}
