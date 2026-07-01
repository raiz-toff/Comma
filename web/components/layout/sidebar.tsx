"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Clock, Receipt, BarChart3, Target,
  FileText, Settings,
} from "lucide-react";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Shifts",    href: "/shifts",    icon: Clock },
  { label: "Expenses",  href: "/expenses",  icon: Receipt },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Goals",     href: "/goals",     icon: Target },
  { label: "Reports",   href: "/reports",   icon: FileText },
  { label: "Settings",  href: "/settings",  icon: Settings },
];

interface SidebarProps { displayName?: string }

export function Sidebar({ displayName }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className="hidden lg:flex h-full w-60 flex-col shrink-0"
      style={{ backgroundColor: "hsl(var(--card))", borderRight: "1px solid hsl(var(--border))" }}
    >
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 py-5" style={{ borderBottom: "1px solid hsl(var(--border))" }}>
        <Image src="/logo.png" alt="Comma" width={38} height={38} className="rounded-xl" />
        <div>
          <p className="text-sm font-bold text-content-primary">Comma</p>
          <p className="text-xs text-content-muted">Web Dashboard</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
        {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors"
              style={active
                ? { backgroundColor: "color-mix(in srgb, hsl(var(--primary)) 15%, transparent)", color: "hsl(var(--primary))" }
                : { color: "hsl(var(--muted-foreground))" }
              }
              onMouseEnter={(e) => { if (!active) { (e.currentTarget as HTMLElement).style.backgroundColor = "hsl(var(--accent))"; (e.currentTarget as HTMLElement).style.color = "hsl(var(--foreground))"; }}}
              onMouseLeave={(e) => { if (!active) { (e.currentTarget as HTMLElement).style.backgroundColor = ""; (e.currentTarget as HTMLElement).style.color = "hsl(var(--muted-foreground))"; }}}
            >
              <Icon size={17} strokeWidth={active ? 2.5 : 1.8} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4" style={{ borderTop: "1px solid hsl(var(--border))" }}>
        {displayName && (
          <p className="text-xs text-content-secondary font-medium truncate mb-1.5">{displayName}</p>
        )}
        <div className="flex items-center gap-1.5">
          <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "hsl(var(--primary))" }} />
          <p className="text-xs text-content-muted">Local · Private · Drive-backed</p>
        </div>
        <p className="text-[11px] text-content-disabled mt-0.5">GPS & Start Shift on mobile only</p>
      </div>
    </aside>
  );
}
