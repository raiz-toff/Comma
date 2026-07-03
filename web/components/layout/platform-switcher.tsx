"use client";
import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { PlatformLogo } from "@/lib/platform-logos";

const ALL = { id: "all", label: "All", color: "#a09d96" };

/**
 * Matches the PWA platform-switcher--tabs behaviour exactly:
 *
 *  Collapsed  → pill shows only the active platform logo (26 px wide)
 *  First tap  → expand: all tabs with labels slide in
 *  Tap a tab  → select + collapse (visual snap instant; store update deferred 300ms)
 *  Swipe ←/→ → cycle while collapsed
 *  Outside click → collapse without changing selection
 *
 * Below md (768 px) the pill is replaced by a 26-px circle logo trigger
 * that opens a dropdown list.
 */
export function PlatformSwitcher() {
  const { activePlatforms, activePlatformId, setActivePlatformId } = useAppStore();

  /* ── sliding pill state ── */
  const [isExpanded, setIsExpanded] = useState(false);
  const [pendingId, setPendingId]   = useState<string | null>(null);
  const pillRef    = useRef<HTMLDivElement>(null);
  const timerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── mobile dropdown state ── */
  const [dropOpen, setDropOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  /* ── touch swipe ── */
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const swipeDidMove = useRef(false);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  /* Collapse pill on outside click */
  useEffect(() => {
    if (!isExpanded) return;
    const h = (e: MouseEvent) => {
      if (!pillRef.current?.contains(e.target as Node)) setIsExpanded(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [isExpanded]);

  /* Close dropdown on outside click */
  useEffect(() => {
    if (!dropOpen) return;
    const h = (e: MouseEvent) => {
      if (!dropRef.current?.contains(e.target as Node)) setDropOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [dropOpen]);

  if (activePlatforms.length === 0) return null;

  const all   = [ALL, ...activePlatforms];
  /* Visual id snaps immediately; real store update is deferred 300 ms */
  const visId = pendingId ?? activePlatformId;

  /**
   * Phase A: instant visual snap (CSS aria-selected + collapsed state)
   * Phase B: deferred heavy re-render 300 ms later (lets slide animation finish)
   */
  function applySelection(id: string) {
    setIsExpanded(false);
    setDropOpen(false);
    if (id === (pendingId ?? activePlatformId)) return;
    setPendingId(id);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setActivePlatformId(id);
      setPendingId(null);
    }, 300);
  }

  function handlePillClick(tabId: string) {
    if (!isExpanded) {
      setIsExpanded(true);  // first tap: expand only
    } else {
      applySelection(tabId); // second tap on a tab: select + collapse
    }
  }

  /* Touch swipe: cycle while collapsed */
  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current  = e.touches[0].clientX;
    touchStartY.current  = e.touches[0].clientY;
    swipeDidMove.current = false;
  }
  function onTouchMove(e: React.TouchEvent) {
    if (
      Math.abs(e.touches[0].clientX - touchStartX.current) > 10 ||
      Math.abs(e.touches[0].clientY - touchStartY.current) > 10
    ) {
      swipeDidMove.current = true;
    }
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (isExpanded || !swipeDidMove.current) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    if (Math.abs(dx) > 40 && Math.abs(dy) < 30) {
      const ids = all.map((p) => p.id);
      const cur = ids.indexOf(visId);
      const next = dx < 0 ? (cur + 1) % ids.length : (cur - 1 + ids.length) % ids.length;
      applySelection(ids[next]);
    }
  }

  /* ────────────────────────── RENDER ────────────────────────── */

  return (
    <>
      {/* ── <768px: 26-px circle logo → dropdown ── */}
      <div className="block md:hidden relative" ref={dropRef}>
        <button
          onClick={() => setDropOpen((o) => !o)}
          aria-label="Switch platform"
          style={{
            width: 26, height: 26, borderRadius: "50%",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0, overflow: "hidden", padding: 0, cursor: "pointer",
            border: "1.5px solid hsl(var(--border))",
            backgroundColor: visId === "all"
              ? "hsl(var(--accent))"
              : (all.find((p) => p.id === visId)?.color ?? "hsl(var(--accent))"),
            color: visId === "all" ? "hsl(var(--muted-foreground))" : "#fff",
          }}
        >
          {visId === "all"
            ? <span style={{ fontSize: 9, fontWeight: 800, lineHeight: 1 }}>ALL</span>
            : <PlatformLogo id={visId} size={14} />
          }
        </button>

        {dropOpen && (
          <div
            style={{
              position: "absolute", top: "calc(100% + 8px)", left: 0,
              width: 180, borderRadius: 14, overflow: "hidden", zIndex: 60, padding: "4px 0",
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              boxShadow: "0 8px 24px rgba(0,0,0,0.20)",
            }}
          >
            {all.map((p) => {
              const sel = p.id === visId;
              return (
                <button
                  key={p.id}
                  onClick={() => applySelection(p.id)}
                  style={{
                    display: "flex", width: "100%", alignItems: "center",
                    gap: 10, padding: "10px 12px",
                    fontSize: 13, fontWeight: 600, textAlign: "left",
                    color: sel ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))",
                    backgroundColor: sel ? "hsl(var(--accent))" : "transparent",
                    border: "none", cursor: "pointer",
                  }}
                >
                  <span
                    style={{
                      width: 20, height: 20, borderRadius: 4, flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      backgroundColor: p.id === "all" ? "hsl(var(--accent))" : p.color,
                      color: p.id === "all" ? "hsl(var(--muted-foreground))" : "#fff",
                    }}
                  >
                    {p.id === "all"
                      ? <span style={{ fontSize: 7, fontWeight: 800 }}>ALL</span>
                      : <PlatformLogo id={p.id} size={12} />
                    }
                  </span>
                  <span style={{ flex: 1 }}>{p.label}</span>
                  {sel && <Check size={13} style={{ color: "hsl(var(--primary))" }} />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── md+ (768px+): sliding pill tabs — exact PWA behaviour ── */}
      <div
        ref={pillRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        className="hidden md:inline-flex"
        style={{
          gap: 2,
          backgroundColor: "hsl(var(--accent))",
          border: "1px solid hsl(var(--border))",
          borderRadius: "9999px",
          padding: 3,
          alignItems: "center",
          /* Collapsed: just the active tab (26px + 2×3px padding = 32px).
             Expanded:  up to 55 vw (scrollable if overflow). */
          maxWidth: isExpanded ? "min(480px, 55vw)" : 32,
          overflow: isExpanded ? "auto" : "hidden",
          transition: "max-width 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          flexShrink: 0,
          whiteSpace: "nowrap",
          scrollbarWidth: "none",
          cursor: "pointer",
          /* Fade horizontal edges when expanded (scroll hint) */
          maskImage: isExpanded
            ? "linear-gradient(to right, transparent, #000 14px, #000 calc(100% - 14px), transparent)"
            : "none",
        }}
      >
        {all.map((p) => {
          const sel  = p.id === visId;
          const logoColor = sel ? "#fff" : p.color;
          const collapsed = !isExpanded && sel; // the "collapsed active tab" state

          return (
            <button
              key={p.id}
              aria-selected={sel}
              onClick={() => handlePillClick(p.id)}
              style={{
                /* Active tab always floats to front (order:-1) */
                order:          sel ? -1 : 0,
                /* Only active (or all when expanded) tabs are visible & clickable */
                opacity:        isExpanded || sel ? 1 : 0,
                pointerEvents:  (isExpanded || sel ? "auto" : "none") as React.CSSProperties["pointerEvents"],
                transition:     "opacity 0.15s ease, background-color 0.15s ease",
                /* Collapsed active: 26×26 icon-only. Expanded / unselected: label shown */
                height:         26,
                width:          collapsed ? 26 : "auto",
                padding:        collapsed ? 0 : "0 10px",
                flexShrink:     0,
                borderRadius:   "9999px",
                border:         "none",
                cursor:         "pointer",
                display:        "inline-flex",
                alignItems:     "center",
                justifyContent: collapsed ? "center" : "flex-start",
                gap:            collapsed ? 0 : 6,
                backgroundColor: sel
                  ? (p.id === "all" ? "hsl(var(--card))" : p.color)
                  : "transparent",
                color:          sel ? (p.id === "all" ? "hsl(var(--foreground))" : "#fff") : "hsl(var(--foreground))",
                boxShadow:      sel ? "0 1px 4px rgba(0,0,0,0.18)" : "none",
                fontSize:       11,
                fontWeight:     700,
                whiteSpace:     "nowrap",
              }}
            >
              {/* Logo — always shown; tinted by currentColor */}
              <span
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0, color: logoColor,
                }}
              >
                {p.id === "all"
                  ? <span style={{ fontSize: 9, fontWeight: 800, lineHeight: 1, color: logoColor }}>ALL</span>
                  : <PlatformLogo id={p.id} size={14} />
                }
              </span>

              {/* Label — slides in/out */}
              <span
                style={{
                  maxWidth:   collapsed ? 0 : 100,
                  opacity:    collapsed ? 0 : 1,
                  overflow:   "hidden",
                  transition: "max-width 0.3s cubic-bezier(0.4,0,0.2,1), opacity 0.2s ease",
                }}
              >
                {p.label}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}
