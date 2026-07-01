"use client";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";

/**
 * Desktop: sliding pill tabs (like the PWA)
 * Mobile:  compact chip → tap → popover dropdown
 */
export function PlatformSwitcher() {
  const { activePlatforms, activePlatformId, setActivePlatformId } = useAppStore();
  const [open, setOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  // Close popover on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (!dropRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Hide when there are no active platforms (empty DB)
  if (activePlatforms.length === 0) return null;

  const all = [{ id: "all", label: "All", color: "hsl(var(--muted-foreground))" }, ...activePlatforms];
  const active = all.find((p) => p.id === activePlatformId) ?? all[0];

  return (
    <>
      {/* ── Desktop: pill tabs ── */}
      <div
        className="hidden lg:flex items-center gap-0.5 rounded-full p-0.5"
        style={{ backgroundColor: "hsl(var(--accent))", border: "1px solid hsl(var(--border))" }}
      >
        {all.map((p) => {
          const sel = p.id === activePlatformId;
          return (
            <button
              key={p.id}
              onClick={() => setActivePlatformId(p.id)}
              aria-selected={sel}
              className="h-7 rounded-full px-3 text-xs font-bold transition-all"
              style={sel
                ? { backgroundColor: p.color === "hsl(var(--muted-foreground))" ? "hsl(var(--card))" : p.color, color: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,0.18)" }
                : { color: "hsl(var(--muted-foreground))", backgroundColor: "transparent" }
              }
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {/* ── Mobile: compact chip + dropdown ── */}
      <div className="relative lg:hidden" ref={dropRef}>
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1.5 h-8 rounded-full px-3 text-xs font-bold transition-all"
          style={{
            backgroundColor: active.id === "all"
              ? "hsl(var(--accent))"
              : active.color,
            color: active.id === "all" ? "hsl(var(--foreground))" : "#fff",
            border: "1px solid hsl(var(--border))",
          }}
        >
          <span>{active.label}</span>
          <ChevronDown
            size={11}
            strokeWidth={3}
            className="transition-transform"
            style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
          />
        </button>

        {open && (
          <div
            className="absolute right-0 top-full mt-1.5 w-44 rounded-xl overflow-hidden z-50 py-1"
            style={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              boxShadow: "0 8px 24px rgba(0,0,0,0.20)",
            }}
          >
            {all.map((p) => {
              const sel = p.id === activePlatformId;
              return (
                <button
                  key={p.id}
                  onClick={() => { setActivePlatformId(p.id); setOpen(false); }}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-sm font-medium transition-colors text-left"
                  style={{
                    color: sel ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))",
                    backgroundColor: sel ? "hsl(var(--accent))" : "transparent",
                  }}
                >
                  {/* Color dot */}
                  <span
                    className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: p.color }}
                  />
                  <span className="flex-1">{p.label}</span>
                  {sel && <Check size={13} style={{ color: "hsl(var(--primary))" }} />}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
