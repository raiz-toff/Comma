"use client";
import { useEffect, useRef } from "react";
import { useAppStore } from "@/store/useAppStore";
import { getDb } from "@/lib/db/index";
import { loadDbFromIDB } from "@/lib/db/persist";
import { Spinner } from "@/components/ui/spinner";

export function AppProviders({ children }: { children: React.ReactNode }) {
  const {
    initAuth,
    isHydrating, setHydrating,
    setHasLocalData,
    isDbReady, isDbLoading, dbError,
    setDbReady, setDbError, loadProfile,
  } = useAppStore();
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    // 1. Read auth tokens from localStorage synchronously so isAuthenticated
    //    is correct before the layout's redirect effect fires.
    initAuth();

    // 2. Check IndexedDB for a saved database.  If one exists, load it
    //    automatically — the user should never need to re-import their backup
    //    on every reload.
    (async () => {
      try {
        const saved = await loadDbFromIDB();
        if (saved) {
          setHasLocalData(true);
          await getDb();           // mounts the saved DB into sql.js
          setDbReady(true);
          await loadProfile();
        }
      } catch (e: any) {
        setDbError(e?.message ?? "Failed to load database.");
      } finally {
        setHydrating(false);       // done — routing can now make decisions
      }
    })();
  }, []); // intentionally no deps; ref guard prevents double-run

  // Block rendering while we check IDB so the layout redirect never fires
  // against an uninitialised state.
  if (isHydrating) {
    return (
      <div
        className="flex h-screen items-center justify-center"
        style={{ backgroundColor: "hsl(var(--background))" }}
      >
        <Spinner size="lg" />
      </div>
    );
  }

  if (isDbReady && isDbLoading) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ backgroundColor: "hsl(var(--background))" }}>
        <div className="flex flex-col items-center gap-3">
          <Spinner size="lg" />
          <p className="text-sm text-content-muted">Loading your data…</p>
        </div>
      </div>
    );
  }

  if (dbError) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ backgroundColor: "hsl(var(--background))" }}>
        <div className="text-center">
          <p className="font-semibold" style={{ color: "hsl(var(--destructive))" }}>Database error</p>
          <p className="text-sm text-content-muted mt-1">{dbError}</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
