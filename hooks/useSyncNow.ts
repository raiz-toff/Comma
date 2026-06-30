import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { syncNow, type SyncResult } from "../src/services/sync/syncNow";

/**
 * Manual "Sync now" hook (cloud-sync P2). Wraps the syncNow orchestrator with loading /
 * result / error state and invalidates React Query on success so the UI reflects any
 * rows pulled in. Automatic triggers (pull-on-open, push-on-leave) are P4 — this hook is
 * the only sync entry point in P2.
 */
export function useSyncNow() {
  const queryClient = useQueryClient();
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastResult, setLastResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const triggerSync = async (passphrase: string): Promise<SyncResult> => {
    setIsSyncing(true);
    setError(null);
    try {
      const result = await syncNow(passphrase);
      // Await invalidation so the UI reflects pulled data, not the pre-sync state.
      if (result.appliedRows > 0) {
        await queryClient.invalidateQueries();
      }
      setLastResult(result);
      return result;
    } catch (err: any) {
      setError(err?.message ?? "Sync failed.");
      throw err;
    } finally {
      setIsSyncing(false);
    }
  };

  return { isSyncing, lastResult, error, triggerSync };
}
