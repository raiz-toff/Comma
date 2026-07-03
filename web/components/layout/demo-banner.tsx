"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/store/useAppStore";
import { clearDbFromIDB } from "@/lib/db/persist";
import { resetDbInstance } from "@/lib/db/index";
import { FlaskConical, X } from "lucide-react";

/**
 * Thin banner shown only in demo mode. Makes it unmistakable that the data is
 * sample data and gives visitors a one-click way out.
 */
export function DemoBanner() {
  const { isDemo, reset } = useAppStore();
  const router = useRouter();
  const [exiting, setExiting] = useState(false);

  if (!isDemo) return null;

  async function exitDemo() {
    setExiting(true);
    await clearDbFromIDB();
    resetDbInstance();
    reset();
    router.replace("/connect");
  }

  return (
    <div
      className="flex h-8 shrink-0 items-center justify-center gap-2 px-3 text-[11px] font-semibold"
      style={{
        backgroundColor: "color-mix(in srgb, hsl(var(--primary)) 16%, hsl(var(--card)))",
        color: "hsl(var(--primary))",
        borderBottom: "1px solid color-mix(in srgb, hsl(var(--primary)) 24%, hsl(var(--border)))",
      }}
    >
      <FlaskConical size={13} strokeWidth={2.2} />
      <span>Demo mode — exploring sample data</span>
      <button
        onClick={exitDemo}
        disabled={exiting}
        className="ml-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 transition-colors hover:bg-primary/15 disabled:opacity-50"
      >
        <X size={12} strokeWidth={2.4} />
        {exiting ? "Exiting…" : "Exit demo"}
      </button>
    </div>
  );
}
