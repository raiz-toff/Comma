import React, { useState } from "react";
import { ScrollView, View, TouchableOpacity, Share, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Text } from "@/src/components/ui/text";
import { Bell, BellOff, Check, AlertCircle, Info, Trophy } from "lucide-react-native";

interface NotificationItem {
  id: string;
  title: string;
  description: string;
  time: string;
  type: "info" | "success" | "warning";
  read: boolean;
}

const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: "1",
    title: "Weekly Earnings Goal Achieved!",
    description: "Congratulations! You reached 100% of your weekly earnings target across all active platforms.",
    time: "2 hours ago",
    type: "success",
    read: false,
  },
  {
    id: "2",
    title: "Tax season reminder",
    description: "Your estimated quarterly tax withholding report is ready. View it in the Tax page.",
    time: "1 day ago",
    type: "warning",
    read: false,
  },
  {
    id: "3",
    title: "Shift Logged Successfully",
    description: "Your 6h 15m Uber Eats shift has been added to your dashboard history.",
    time: "2 days ago",
    type: "info",
    read: true,
  },
  {
    id: "4",
    title: "Welcome to COMMA!",
    description: "Your local database has been initialized. You are ready to start tracking your gig mileage and earnings with absolute privacy.",
    time: "3 days ago",
    type: "info",
    read: true,
  },
];

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  const getIcon = (type: string, read: boolean) => {
    const color = read ? "#64748b" : "#10b981";
    switch (type) {
      case "success":
        return <Trophy size={18} color={read ? "#64748b" : "#eab308"} />;
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
        {notifications.length > 0 ? (
          <>
            <View className="flex-row justify-between items-center mb-2">
              <Text className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                Recent Alerts ({notifications.filter(n => !n.read).length} unread)
              </Text>
              <View className="flex-row gap-4">
                <TouchableOpacity onPress={markAllAsRead}>
                  <Text className="text-xs text-emerald-500 font-bold">Mark all read</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={clearAll}>
                  <Text className="text-xs text-slate-500 font-bold">Clear all</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View className="flex flex-col gap-3">
              {notifications.map((item) => (
                <View
                  key={item.id}
                  className={`border rounded-2xl p-4 flex flex-row gap-3 ${
                    item.read 
                      ? "bg-slate-900/30 border-slate-900/60 opacity-60" 
                      : "bg-slate-900/80 border-slate-800/80"
                  }`}
                >
                  <View className="mt-0.5">
                    {getIcon(item.type, item.read)}
                  </View>
                  <View className="flex-1 flex-col">
                    <View className="flex-row justify-between items-start">
                      <Text className={`text-sm font-bold flex-1 pr-2 ${item.read ? "text-slate-400" : "text-slate-100"}`}>
                        {item.title}
                      </Text>
                      {!item.read && (
                        <View className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5" />
                      )}
                    </View>
                    <Text className="text-xs text-slate-400 leading-relaxed font-medium mt-1">
                      {item.description}
                    </Text>
                    <Text className="text-[10px] text-slate-500 font-bold mt-2">
                      {item.time}
                    </Text>
                  </View>
                </View>
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
                You have no new notifications. We'll alert you here when goals are reached or reports are compiled.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
