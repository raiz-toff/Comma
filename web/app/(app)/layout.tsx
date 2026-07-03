"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/store/useAppStore";
import { AppProviders } from "@/components/providers";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { BottomNav } from "@/components/layout/bottom-nav";
import { DemoBanner } from "@/components/layout/demo-banner";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, hasLocalData, profile } = useAppStore();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated && !hasLocalData) router.replace("/connect");
  }, [isAuthenticated, hasLocalData, router]);

  if (!isAuthenticated && !hasLocalData) return null;

  return (
    <AppProviders>
      {/*
       * <lg  (< 1024px): flex-col, body scrolls, header scrolls away, bottom nav fixed
       * lg+ (≥ 1024px): flex-row, body locked (h-dvh overflow-hidden), header sticky,
       *                  sidebar 240px left, only app-main scrolls
       */}
      <div
        className="flex flex-col min-h-dvh lg:flex-row lg:h-dvh lg:overflow-hidden"
        style={{ backgroundColor: "hsl(var(--background))" }}
      >
        {/* Sidebar — lg+ only (hidden below 1024px inside Sidebar component) */}
        <Sidebar displayName={profile?.displayName as string | undefined} />

        {/* Content column: header + scrollable main */}
        <div className="flex flex-1 flex-col min-h-0">
          <DemoBanner />
          <Header />

          {/*
           * Mobile: extra bottom padding clears the fixed bottom nav (56px + safe-area).
           * Desktop (lg+): normal padding — the !important rule in globals.css overrides.
           */}
          <main
            className="flex-1 overflow-y-auto overscroll-y-contain px-3 py-4 min-[480px]:px-4 lg:px-6 lg:py-6"
            style={{ paddingBottom: "calc(5rem + env(safe-area-inset-bottom, 0px))" }}
          >
            <div className="mx-auto w-full max-w-[1200px]">
              {children}
            </div>
          </main>
        </div>

        {/* Bottom nav — hidden at lg+ inside BottomNav component */}
        <BottomNav />
      </div>
    </AppProviders>
  );
}
