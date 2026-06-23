import React from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "../../src/components/ui/text";

export default function ExpensesScreen() {
  return (
    <SafeAreaView className="dark flex-1 bg-[#0b0f19] items-center justify-center p-4">
      <View className="items-center gap-2">
        <Text className="text-2xl font-extrabold text-slate-100 tracking-tight">Expenses</Text>
        <Text className="text-sm text-slate-400 text-center">Expense tracking features are pending implementation.</Text>
      </View>
    </SafeAreaView>
  );
}
