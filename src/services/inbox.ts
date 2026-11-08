import { db } from "../database/client";
import { settings } from "../database/schema";
import { eq } from "drizzle-orm";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

export interface NotificationItem {
  id: string;
  title: string;
  description: string;
  time: string;
  type: "info" | "success" | "warning";
  read: boolean;
  createdAt: string;
  actionUrl?: string;
  /** Glyph selector for operational events: "backup"|"restore"|"export"|"wipe"|"import"|"error". */
  iconKey?: string;
}

export interface InboxState {
  notifications: NotificationItem[];
}

// The inbox lives in the row the old gamification state used. Reading only `notifications`
// out of it keeps a driver's existing inbox and ignores the retired XP/badge fields.
const STATE_KEY = "gamification_state";
const MAX_ITEMS = 100;

const triggerNativeNotification = async (title: string, body: string, url: string, isDemoMode: boolean) => {
  if (Platform.OS === "web" || isDemoMode) return;
  try {
    const perm = await Notifications.getPermissionsAsync();
    let status = perm.status;
    if (status === "undetermined" && perm.canAskAgain) {
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status === "granted") {
      await Notifications.scheduleNotificationAsync({
        content: { title, body, sound: true, data: { url } },
        trigger: null,
      });
    }
  } catch (e) {
    console.warn("Failed to trigger native notification:", e);
  }
};

function toYmdString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export const InboxService = {
  async loadState(): Promise<InboxState> {
    try {
      const rows = await db.select().from(settings).where(eq(settings.key, STATE_KEY)).limit(1);
      if (rows.length === 0) return { notifications: [] };
      const parsed = JSON.parse(rows[0].value);
      return { notifications: Array.isArray(parsed?.notifications) ? parsed.notifications : [] };
    } catch (e) {
      console.warn("Failed to load inbox, starting empty:", e);
      return { notifications: [] };
    }
  },

  async saveState(state: InboxState): Promise<void> {
    try {
      const value = JSON.stringify({ notifications: state.notifications.slice(0, MAX_ITEMS) });
      await db
        .insert(settings)
        .values({ key: STATE_KEY, value })
        .onConflictDoUpdate({ target: settings.key, set: { value } });
    } catch (e) {
      console.error("Failed to save inbox:", e);
    }
  },

  /** Adds any due reminders (tax installment deadlines) and saves the inbox. */
  async evaluate(isDemoMode = false): Promise<InboxState> {
    const state = await this.loadState();
    const now = new Date();

    const deadlines = [
      new Date(now.getFullYear(), 2, 31),
      new Date(now.getFullYear(), 5, 15),
      new Date(now.getFullYear(), 8, 15),
      new Date(now.getFullYear(), 11, 15),
    ];
    for (const deadline of deadlines) {
      const diffDays = Math.ceil((deadline.getTime() - now.getTime()) / 86400000);
      if (diffDays <= 0 || diffDays > 10) continue;
      const key = `tax_deadline_${toYmdString(deadline)}`;
      if (state.notifications.some((n) => n.id.startsWith(key))) continue;
      state.notifications.unshift({
        id: `${key}_${Date.now()}`,
        title: "Tax Installment Due Soon",
        description: `Estimated quarterly tax deadline is approaching in ${diffDays} days (${toYmdString(deadline)}).`,
        time: "Warning",
        type: "warning",
        read: false,
        createdAt: now.toISOString(),
        actionUrl: "/(tabs)/tax",
      });
      triggerNativeNotification("Tax Installment Due Soon", `Estimated quarterly tax deadline is approaching in ${diffDays} days.`, "/tax", isDemoMode);
    }

    state.notifications = state.notifications.slice(0, MAX_ITEMS);
    await this.saveState(state);
    return state;
  },
};
