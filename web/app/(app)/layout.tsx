"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/store/useAppStore";
import { AppProviders } from "@/components/providers";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { BottomNav } from "@/components/layout/bottom-nav";

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
       * Mobile  (<lg): flex-col, natural scroll, bottom nav fixed at bottom
       * Desktop (≥lg): flex-row, body viewport-locked, only app-main scrolls
       */}
      <div
        className="flex flex-col min-h-dvh lg:flex-row lg:h-dvh lg:overflow-hidden"
        style={{ backgroundColor: "hsl(var(--background))" }}
      >
        {/* Sidebar — desktop only (hidden below lg via sidebar.tsx) */}
        <Sidebar displayName={profile?.displayName as string | undefined} />

        {/* Content column */}
        <div className="flex flex-1 flex-col min-h-0">
          <Header />
          <main
            className="flex-1 overflow-y-auto overscroll-y-contain px-4 py-4 lg:px-7 lg:py-7"
            style={{
              /* On mobile, add bottom padding so content clears the fixed bottom nav */
              paddingBottom: "calc(5.5rem + env(safe-area-inset-bottom, 0px))",
            }}
          >
            <div className="mx-auto w-full max-w-[1200px]">
              {children}
            </div>
          </main>
        </div>

        {/* Bottom nav — mobile only (hidden above lg via bottom-nav.tsx) */}
        <BottomNav />
      </div>
    </AppProviders>
  );
}
