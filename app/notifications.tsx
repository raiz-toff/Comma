import React from "react";
import { ScrollView, View, TouchableOpacity, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Text } from "@/src/components/ui/text";
import { BellOff, AlertCircle, Info, Trophy, X, Check } from "lucide-react-native";
import { useSettingsStore } from "../store/useSettingsStore";
import { usePlatformTheme } from "@/src/hooks/usePlatformTheme";

export default function NotificationsScreen() {
  const { accentColor } = usePlatformTheme();
  const {
    notifications,
    markAllNotificationsRead,
    clearAllNotifications,
    dismissNotification,
  } = useSettingsStore();

  const getIcon = (type: string, read: boolean) => {
    const color = read ? "#64748b" : accentColor;
    switch (type) {
      case "success":
        return <Trophy size={18} color={read ? "#64748b" : accentColor} />;
      case "warning":
        return <AlertCircle size={18} color={read ? "#64748b" : "#f59e0b"} />;
      default:
        return <Info size={18} color={color} />;
    }
  };

  return (
    <SafeAreaView className="dark flex-1 bg-[#000000]">
      {/* Header */}
      <View className="px-4 pt-3 pb-2 border-b border-slate-800/80 bg-slate-900/40 flex-row justify-between items-center">
        <TouchableOpacity
          onPress={() => router.back()}
          className="py-2 px-3 bg-slate-800/40 rounded-lg border border-slate-700/30"
        >
          <Text className="text-slate-300 text-xs font-semibold">Back</Text>
        </TouchableOpacity>
        <Text className="text-slate-100 text-base font-extrabold tracking-tight">Notifications</Text>
        <View className="w-10" />
      </View>

      <ScrollView contentContainerClassName="p-4 pb-20 flex flex-col gap-4">
        {notifications && notifications.length > 0 ? (
          <>
            <View className="flex-row justify-between items-center mb-2">
              <Text className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                Recent Alerts ({notifications.filter(n => !n.read).length} unread)
              </Text>
              <View className="flex-row gap-4">
                <TouchableOpacity onPress={markAllNotificationsRead}>
                  <Text className="text-xs font-bold" style={{ color: accentColor }}>Mark all read</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={clearAllNotifications}>
                  <Text className="text-xs text-slate-500 font-bold">Clear all</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View className="flex flex-col gap-3">
              {notifications.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  activeOpacity={item.actionUrl ? 0.7 : 1}
                  onPress={() => {
                    if (item.actionUrl) {
                      router.push(item.actionUrl as any);
                    }
                  }}
                  className={`border rounded-2xl p-4 flex flex-row gap-3 relative ${
                    item.read 
                      ? "bg-slate-900/30 border-slate-900/60 opacity-60" 
                      : "bg-slate-900/80 border-slate-800/80"
                  }`}
                >
                  <View className="mt-0.5">
                    {getIcon(item.type, item.read)}
                  </View>
                  <View className="flex-1 flex-col pr-6">
                    <View className="flex-row justify-between items-start">
                      <Text className={`text-sm font-bold flex-1 pr-2 ${item.read ? "text-slate-400" : "text-slate-100"}`}>
                        {item.title}
                      </Text>
                      {!item.read && (
                        <View className="w-2 h-2 rounded-full mt-1.5" style={{ backgroundColor: accentColor }} />
                      )}
                    </View>
                    <Text className="text-xs text-slate-400 leading-relaxed font-medium mt-1">
                      {item.description}
                    </Text>
                    <View className="flex-row justify-between items-center mt-2">
                      <Text className="text-[10px] text-slate-500 font-bold">
                        {item.time}
                      </Text>
                      {item.actionUrl && (
                        <Text className="text-[10px] font-bold uppercase tracking-wider" style={{ color: accentColor }}>
                          View details →
                        </Text>
                      )}
                    </View>
                  </View>

                  {/* Dismiss Button */}
                  <TouchableOpacity
                    onPress={(e) => {
                      e.stopPropagation();
                      dismissNotification(item.id);
                    }}
                    className="absolute top-3 right-3 p-1 rounded-full bg-slate-800/35 border border-slate-700/20"
                  >
                    <X size={12} color="#94a3b8" />
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </View>
          </>
        ) : (
          <View className="flex-1 items-center justify-center py-20 flex-col gap-4">
            <View className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 items-center justify-center">
              <BellOff size={28} color="#64748b" />
            </View>
            <View className="items-center">
              <Text className="text-base font-bold text-slate-300">All caught up!</Text>
              <Text className="text-xs text-slate-500 text-center mt-1 max-w-[240px]">
                You have no new notifications. We'll alert you here when goals are reached, streak risks occur, or reports are compiled.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
