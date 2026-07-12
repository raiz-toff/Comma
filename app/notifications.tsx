import React from "react";
import { SectionList, View, TouchableOpacity, StyleSheet } from "react-native";
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
import { COLORS, withAlpha } from "@/src/theme/colors";
import { EmptyState } from "@/src/components/ui/EmptyState";
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

type NotificationSection = { title: string; data: NotificationItem[]; isFirst: boolean };

// ─── Row ──────────────────────────────────────────────────────────────────────

function renderIcon(item: NotificationItem, accentColor: string) {
  if (item.badgeId) {
    return <BadgeSvg id={item.badgeId} size={24} />;
  }
  const c = item.read ? COLORS.contentMuted : accentColor;
  switch (item.iconKey) {
    case "backup":
      return <Upload size={18} color={c} />;
    case "restore":
    case "export":
      return <Download size={18} color={c} />;
    case "wipe":
      return <Trash2 size={18} color={item.read ? COLORS.contentMuted : COLORS.destructive} />;
    case "error":
      return <XCircle size={18} color={item.read ? COLORS.contentMuted : COLORS.destructive} />;
  }
  switch (item.type) {
    case "success":
      return <Trophy size={18} color={c} />;
    case "warning":
      return <AlertCircle size={18} color={item.read ? COLORS.contentMuted : COLORS.warning} />;
    default:
      return <Info size={18} color={c} />;
  }
}

type NotificationRowProps = {
  item: NotificationItem;
  accentColor: string;
  onDismiss: (id: string) => void;
};

const NotificationRow = React.memo(function NotificationRow({
  item,
  accentColor,
  onDismiss,
}: NotificationRowProps) {
  return (
    <TouchableOpacity
      activeOpacity={item.actionUrl ? 0.7 : 1}
      onPress={() => {
        if (item.actionUrl) router.push(item.actionUrl as any);
      }}
      style={[styles.card, item.read ? styles.cardRead : styles.cardUnread]}
    >
      {/* Icon */}
      <View style={[styles.iconBox, item.read && { opacity: 0.6 }]}>
        {renderIcon(item, accentColor)}
      </View>

      {/* Content */}
      <View style={{ flex: 1 }}>
        <View style={styles.titleRow}>
          <Text
            variant="labelM"
            style={[
              styles.cardTitle,
              { color: item.read ? COLORS.contentSecondary : COLORS.contentPrimary },
            ]}
          >
            {item.title}
          </Text>
          {!item.read && (
            <View style={[styles.unreadDot, { backgroundColor: accentColor }]} />
          )}
        </View>

        <Text variant="paragraphS" className="text-content-secondary" style={styles.cardDesc}>{item.description}</Text>

        <View style={styles.metaRow}>
          <Text variant="labelXs" className="text-content-muted">{item.time}</Text>
          {item.actionUrl && (
            <Text variant="labelXs" style={{ color: accentColor }}>
              View details →
            </Text>
          )}
        </View>
      </View>

      {/* Dismiss */}
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Dismiss notification"
        onPress={(e) => {
          e.stopPropagation();
          onDismiss(item.id);
        }}
        hitSlop={8}
        style={styles.dismissBtn}
      >
        <X size={12} color={COLORS.contentSecondary} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
});

const ItemSeparator = () => <View style={styles.itemSeparator} />;

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
  const sections: NotificationSection[] = buckets.map((bucket, index) => ({
    title: bucket.label,
    data: bucket.items,
    isFirst: index === 0,
  }));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }} edges={["bottom", "left", "right"]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top ? insets.top + 12 : 24 }]}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={styles.iconBtn}>
          <ArrowLeft size={22} color={COLORS.contentPrimary} />
        </TouchableOpacity>
        <Text variant="headingS">Notifications</Text>
        <View style={{ width: 44 }} />
      </View>

      {/* Action bar */}
      {hasItems && (
        <View style={styles.actionBar}>
          <View
            style={[
              styles.pill,
              {
                backgroundColor: unreadCount > 0 ? withAlpha(accentColor, 0.13) : COLORS.surface03,
                borderColor: unreadCount > 0 ? withAlpha(accentColor, 0.33) : COLORS.lineSubtle,
              },
            ]}
          >
            <Text
              variant="labelXs"
              style={{ color: unreadCount > 0 ? accentColor : COLORS.contentSecondary }}
            >
              {unreadCount > 0 ? `${unreadCount} unread` : "All read"}
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 20 }}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{ disabled: unreadCount === 0 }}
              onPress={markAllNotificationsRead}
              hitSlop={8}
              disabled={unreadCount === 0}
            >
              <Text
                variant="labelM"
                style={{ color: unreadCount > 0 ? accentColor : COLORS.contentMuted }}
              >
                Mark all read
              </Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" onPress={clearAllNotifications} hitSlop={8}>
              <Text variant="labelM" style={{ color: COLORS.contentSecondary }}>Clear all</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <SectionList<NotificationItem, NotificationSection>
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <Text
            variant="labelXs"
            className="text-content-muted"
            style={[styles.sectionLabel, !section.isFirst && styles.sectionLabelSpacing]}
          >
            {section.title}
          </Text>
        )}
        renderItem={({ item }) => (
          <NotificationRow
            item={item}
            accentColor={accentColor}
            onDismiss={dismissNotification}
          />
        )}
        ItemSeparatorComponent={ItemSeparator}
        ListEmptyComponent={
          <EmptyState
            icon={BellOff}
            title="All caught up!"
            message="You have no new notifications. We'll alert you here when goals are reached, streaks are at risk, or backups and exports complete."
            className="py-24"
          />
        }
      />
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
    backgroundColor: COLORS.surface03,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.lineSubtle,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -8,
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
  sectionLabel: {
    paddingHorizontal: 4,
    marginBottom: 12,
  },
  sectionLabelSpacing: {
    marginTop: 24,
  },
  itemSeparator: {
    height: 12,
  },
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 16,
  },
  cardUnread: {
    backgroundColor: COLORS.surface02,
    borderColor: COLORS.lineSubtle,
  },
  cardRead: {
    backgroundColor: COLORS.surface01,
    borderColor: COLORS.lineSubtle,
    opacity: 0.7,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.surface03,
    borderWidth: 1,
    borderColor: COLORS.lineSubtle,
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
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 5,
  },
  cardDesc: {
    marginTop: 3,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
  },
  dismissBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.surface03,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.lineSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
});
