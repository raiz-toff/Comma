import React from "react";
import { View } from "react-native";
import { Stack } from "expo-router";
import { Text } from "../src/components/ui/text";

export default function VehiclesScreen() {
  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "Vehicles",
          headerStyle: { backgroundColor: "#12110f" },
          headerTintColor: "#f4f2ed",
          headerTitleStyle: { fontWeight: "bold" },
        }}
      />
      <View className="flex-1 bg-[#0b0f19] items-center justify-center p-4">
        <View className="items-center gap-2">
          <Text className="text-xl font-bold text-slate-100">Vehicles List</Text>
          <Text className="text-xs text-slate-400 text-center">Manage primary and secondary gig vehicles.</Text>
        </View>
      </View>
    </>
  );
}
