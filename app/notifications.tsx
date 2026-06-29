import React from "react";
import { ScrollView, View, TouchableOpacity, StyleSheet } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Text } from "@/src/components/ui/text";
import {
  BellOff,
  AlertCircle,
  Info,
  Trophy,
  X,
  ArrowLeft,
  Upload,
  Download,
  Trash2,
  XCircle,
} from "lucide-react-native";
import { useSettingsStore } from "../store/useSettingsStore";
import { usePlatformTheme } from "@/src/hooks/usePlatformTheme";
import { BadgeSvg } from "@/src/registry/badges/BadgeSvgs";
import type { NotificationItem } from "@/src/services/gamification";

// ─── Time grouping ────────────────────────────────────────────────────────────

type Bucket = { label: string; items: NotificationItem[] };

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function groupByDay(items: NotificationItem[]): Bucket[] {
  const now = new Date();
  const todayStr = ymd(now);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const yesterdayStr = ymd(yesterday);

  const today: NotificationItem[] = [];
  const yest: NotificationItem[] = [];
  const earlier: NotificationItem[] = [];

  for (const n of items) {
    const key = n.createdAt ? ymd(new Date(n.createdAt)) : "";
    if (key === todayStr) today.push(n);
    else if (key === yesterdayStr) yest.push(n);
    else earlier.push(n);
  }

  return [
    { label: "Today", items: today },
    { label: "Yesterday", items: yest },
    { label: "Earlier", items: earlier },
  ].filter((b) => b.items.length > 0);
}

export default function NotificationsScreen() {
  const { accentColor } = usePlatformTheme();
  const insets = useSafeAreaInsets();
  const {
    notifications,
    markAllNotificationsRead,
    clearAllNotifications,
    dismissNotification,
  } = useSettingsStore();

  const hasItems = notifications && notifications.length > 0;
  const unreadCount = hasItems ? notifications.filter((n) => !n.read).length : 0;
  const buckets = hasItems ? groupByDay(notifications) : [];

  const renderIcon = (item: NotificationItem) => {
    if (item.badgeId) {
      return <BadgeSvg id={item.badgeId} size={24} />;
    }
    const c = item.read ? "#65656E" : accentColor;
    switch (item.iconKey) {
      case "backup":
        return <Upload size={18} color={c} />;
      case "restore":
      case "export":
        return <Download size={18} color={c} />;
      case "wipe":
        return <Trash2 size={18} color={item.read ? "#65656E" : "#FF5247"} />;
      case "error":
        return <XCircle size={18} color={item.read ? "#65656E" : "#FF5247"} />;
    }
    switch (item.type) {
      case "success":
        return <Trophy size={18} color={c} />;
      case "warning":
        return <AlertCircle size={18} color={item.read ? "#65656E" : "#f59e0b"} />;
      default:
        return <Info size={18} color={c} />;
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#000" }} edges={["bottom", "left", "right"]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top ? insets.top + 12 : 24 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <ArrowLeft size={22} color="#F6F6F7" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={{ width: 44 }} />
      </View>

      {/* Action bar */}
      {hasItems && (
        <View style={styles.actionBar}>
          <View
            style={[
              styles.pill,
              {
                backgroundColor: unreadCount > 0 ? `${accentColor}22` : "#16161A",
                borderColor: unreadCount > 0 ? `${accentColor}55` : "#1C1C21",
              },
            ]}
          >
            <Text
              style={[
                styles.pillText,
                { color: unreadCount > 0 ? accentColor : "#9B9BA4" },
              ]}
            >
              {unreadCount > 0 ? `${unreadCount} unread` : "All read"}
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 20 }}>
            <TouchableOpacity
              onPress={markAllNotificationsRead}
              hitSlop={8}
              disabled={unreadCount === 0}
            >
              <Text
                style={[
                  styles.actionText,
                  { color: unreadCount > 0 ? accentColor : "#65656E" },
                ]}
              >
                Mark all read
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={clearAllNotifications} hitSlop={8}>
              <Text style={[styles.actionText, { color: "#9B9BA4" }]}>Clear all</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100, gap: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {hasItems ? (
          buckets.map((bucket) => (
            <View key={bucket.label} style={{ gap: 12 }}>
              <Text style={styles.sectionLabel}>{bucket.label}</Text>

              {bucket.items.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  activeOpacity={item.actionUrl ? 0.7 : 1}
                  onPress={() => {
                    if (item.actionUrl) router.push(item.actionUrl as any);
                  }}
                  style={[styles.card, item.read ? styles.cardRead : styles.cardUnread]}
                >
                  {/* Icon */}
                  <View style={[styles.iconBox, item.read && { opacity: 0.6 }]}>
                    {renderIcon(item)}
                  </View>

                  {/* Content */}
                  <View style={{ flex: 1 }}>
                    <View style={styles.titleRow}>
                      <Text
                        style={[
                          styles.cardTitle,
                          { color: item.read ? "#9B9BA4" : "#F6F6F7" },
                        ]}
                      >
                        {item.title}
                      </Text>
                      {!item.read && (
                        <View style={[styles.unreadDot, { backgroundColor: accentColor }]} />
                      )}
                    </View>

                    <Text style={styles.cardDesc}>{item.description}</Text>

                    <View style={styles.metaRow}>
                      <Text style={styles.cardTime}>{item.time}</Text>
                      {item.actionUrl && (
                        <Text style={[styles.viewDetails, { color: accentColor }]}>
                          View details →
                        </Text>
                      )}
                    </View>
                  </View>

                  {/* Dismiss */}
                  <TouchableOpacity
                    onPress={(e) => {
                      e.stopPropagation();
                      dismissNotification(item.id);
                    }}
                    hitSlop={8}
                    style={styles.dismissBtn}
                  >
                    <X size={12} color="#9B9BA4" />
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </View>
          ))
        ) : (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <BellOff size={28} color="#65656E" />
            </View>
            <View style={{ alignItems: "center" }}>
              <Text style={styles.emptyTitle}>All caught up!</Text>
              <Text style={styles.emptySub}>
                You have no new notifications. We'll alert you here when goals are reached,
                streaks are at risk, or backups and exports complete.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#16161A",
    borderWidth: 0.8,
    borderColor: "#1C1C21",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: "#F6F6F7",
    letterSpacing: -0.3,
  },
  actionBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  pillText: {
    fontSize: 11,
    fontWeight: "800",
  },
  actionText: {
    fontSize: 12,
    fontWeight: "800",
  },
  sectionLabel: {
    fontSize: 11,
    color: "#65656E",
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    paddingHorizontal: 4,
  },
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    borderWidth: 0.8,
    borderRadius: 20,
    padding: 16,
  },
  cardUnread: {
    backgroundColor: "#0F0F12",
    borderColor: "#1E1E23",
  },
  cardRead: {
    backgroundColor: "#0a0a0a",
    borderColor: "#16161A",
    opacity: 0.7,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#16161A",
    borderWidth: 1,
    borderColor: "#1C1C21",
    alignItems: "center",
    justifyContent: "center",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  cardTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 5,
  },
  cardDesc: {
    fontSize: 12,
    color: "#9B9BA4",
    lineHeight: 18,
    fontWeight: "500",
    marginTop: 3,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
  },
  cardTime: {
    fontSize: 10,
    color: "#65656E",
    fontWeight: "700",
  },
  viewDetails: {
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  dismissBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#16161A",
    borderWidth: 0.8,
    borderColor: "#1C1C21",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 96,
    gap: 16,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#0F0F12",
    borderWidth: 0.8,
    borderColor: "#1E1E23",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#d4d0c8",
  },
  emptySub: {
    fontSize: 12,
    color: "#65656E",
    textAlign: "center",
    marginTop: 6,
    maxWidth: 260,
    lineHeight: 18,
  },
});
