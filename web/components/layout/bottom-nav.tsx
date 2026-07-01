"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import {
  LayoutDashboard, Clock, Receipt, BarChart3,
  Target, FileText, Settings, MoreHorizontal, X, ChevronRight,
} from "lucide-react";

const PRIMARY = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Shifts",    href: "/shifts",    icon: Clock },
  { label: "Expenses",  href: "/expenses",  icon: Receipt },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
];

const MORE = [
  { label: "Goals",    href: "/goals",    icon: Target },
  { label: "Reports",  href: "/reports",  icon: FileText },
  { label: "Settings", href: "/settings", icon: Settings },
];

export function BottomNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const isMoreActive = MORE.some((i) => pathname === i.href || pathname.startsWith(i.href + "/"));

  // Close drawer on route change
  useEffect(() => { setMoreOpen(false); }, [pathname]);

  // Lock body scroll when drawer open
  useEffect(() => {
    document.body.style.overflow = moreOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [moreOpen]);

  return (
    <>
      {/* Backdrop */}
      {moreOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setMoreOpen(false)}
        />
      )}

      {/* More drawer */}
      <div
        className="fixed left-0 right-0 bottom-0 z-50 lg:hidden transition-transform duration-300"
        style={{
          transform: moreOpen ? "translateY(0)" : "translateY(100%)",
          backgroundColor: "hsl(var(--card))",
          borderRadius: "20px 20px 0 0",
          borderTop: "1px solid hsl(var(--border))",
          paddingBottom: "calc(1rem + env(safe-area-inset-bottom, 0px))",
          boxShadow: "0 -8px 32px rgba(0,0,0,0.18)",
        }}
      >
        <div className="flex items-center justify-between px-5 py-4">
          <p className="text-sm font-bold" style={{ color: "hsl(var(--foreground))" }}>More</p>
          <button
            onClick={() => setMoreOpen(false)}
            className="flex h-7 w-7 items-center justify-center rounded-full"
            style={{ backgroundColor: "hsl(var(--accent))", color: "hsl(var(--muted-foreground))" }}
          >
            <X size={14} />
          </button>
        </div>
        <div className="px-3 pb-2">
          {MORE.map(({ label, href, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-4 px-4 py-3.5 rounded-xl transition-colors"
                style={active
                  ? { backgroundColor: "color-mix(in srgb, hsl(var(--primary)) 14%, transparent)", color: "hsl(var(--primary))" }
                  : { color: "hsl(var(--foreground))" }
                }
              >
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-xl flex-shrink-0"
                  style={{
                    backgroundColor: active
                      ? "color-mix(in srgb, hsl(var(--primary)) 18%, transparent)"
                      : "hsl(var(--accent))",
                    color: active ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))",
                  }}
                >
                  <Icon size={17} strokeWidth={active ? 2.5 : 1.8} />
                </span>
                <span className="flex-1 text-sm font-semibold">{label}</span>
                <ChevronRight size={15} style={{ color: "hsl(var(--muted-foreground))", opacity: 0.5 }} />
              </Link>
            );
          })}
        </div>
      </div>

      {/* Bottom nav bar */}
      <nav
        className="fixed left-0 right-0 bottom-0 z-30 flex justify-around items-center lg:hidden"
        style={{
          minHeight: 56,
          paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom, 0px))",
          paddingTop: "0.5rem",
          backgroundColor: "hsl(var(--card))",
          borderTop: "1px solid hsl(var(--border))",
          boxShadow: "0 -4px 12px rgba(0,0,0,0.08)",
        }}
      >
        {PRIMARY.map(({ label, href, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className="flex flex-col items-center gap-1 px-3 py-1 rounded-lg transition-colors"
            >
              <Icon
                size={22}
                strokeWidth={active ? 2.5 : 1.7}
                style={{ color: active ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))" }}
              />
              <span
                className="text-[10px] font-semibold leading-none"
                style={{ color: active ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))" }}
              >
                {label}
              </span>
            </Link>
          );
        })}

        {/* More button */}
        <button
          onClick={() => setMoreOpen((o) => !o)}
          aria-current={isMoreActive ? "page" : undefined}
          className="flex flex-col items-center gap-1 px-3 py-1 rounded-lg transition-colors"
        >
          <MoreHorizontal
            size={22}
            strokeWidth={isMoreActive ? 2.5 : 1.7}
            style={{ color: isMoreActive ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))" }}
          />
          <span
            className="text-[10px] font-semibold leading-none"
            style={{ color: isMoreActive ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))" }}
          >
            More
          </span>
        </button>
      </nav>
    </>
  );
}
