import { useSettingsStore } from "../../store/useSettingsStore";

/** Input for pushing a notification into the in-app notification panel. */
export type AddNotificationInput = {
  title: string;
  description: string;
  type?: "info" | "success" | "warning";
  actionUrl?: string;
  /** Operational glyph selector: "backup"|"restore"|"export"|"wipe"|"import"|"error". */
  iconKey?: string;
  /** When set, the panel renders the badge SVG for this id. */
  badgeId?: string;
  /** Skip insert if the newest notification shares this title within a short window. */
  dedupeKey?: string;
};

/**
 * Push a notification into the in-app panel from anywhere — hooks, services, non-React code.
 * Uses getState() so it does not require a React render context.
 */
export const notify = (input: AddNotificationInput): Promise<void> =>
  useSettingsStore.getState().addNotification(input);

// ─── Convenience presets for operational outcomes ────────────────────────────

export const notifyBackup = (ok: boolean, detail?: string) =>
  notify(
    ok
      ? {
          title: "Backup complete",
          description: detail ?? "Your data was securely backed up to Google Drive.",
          type: "success",
          iconKey: "backup",
          dedupeKey: "backup_done",
        }
      : {
          title: "Backup failed",
          description: detail ?? "We couldn't back up your data. Please try again.",
          type: "warning",
          iconKey: "error",
          dedupeKey: "backup_fail",
        }
  );

export const notifyRestore = (ok: boolean, detail?: string) =>
  notify(
    ok
      ? {
          title: "Restore complete",
          description: detail ?? "Your data was restored from the selected backup.",
          type: "success",
          iconKey: "restore",
          dedupeKey: "restore_done",
        }
      : {
          title: "Restore failed",
          description: detail ?? "We couldn't restore from that backup. Please try again.",
          type: "warning",
          iconKey: "error",
          dedupeKey: "restore_fail",
        }
  );

export const notifyExport = (kind: string, ok: boolean, detail?: string) =>
  notify(
    ok
      ? {
          title: `${kind} exported`,
          description: detail ?? `Your ${kind} export is ready to share.`,
          type: "success",
          iconKey: "export",
          dedupeKey: `export_${kind}_done`,
        }
      : {
          title: `${kind} export failed`,
          description: detail ?? `We couldn't generate your ${kind} export.`,
          type: "warning",
          iconKey: "error",
          dedupeKey: `export_${kind}_fail`,
        }
  );

export const notifyWipe = () =>
  notify({
    title: "Data cleared",
    description: "All shifts, expenses, and settings were wiped from this device.",
    type: "warning",
    iconKey: "wipe",
    dedupeKey: "data_wiped",
  });

export const notifyImport = (count: number) =>
  notify({
    title: "Import complete",
    description: `${count} shift${count === 1 ? "" : "s"} imported successfully.`,
    type: "success",
    iconKey: "import",
    dedupeKey: "csv_import_done",
  });
