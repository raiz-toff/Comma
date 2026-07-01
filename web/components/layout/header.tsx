"use client";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAppStore } from "@/store/useAppStore";
import { PlatformSwitcher } from "./platform-switcher";

const PAGE_META: Record<string, { title: string; subtitle: string }> = {
  "/dashboard": { title: "Dashboard",  subtitle: "Your gig earnings at a glance" },
  "/shifts":    { title: "Shifts",     subtitle: "Shift history and details" },
  "/expenses":  { title: "Expenses",   subtitle: "Track deductible costs" },
  "/analytics": { title: "Analytics",  subtitle: "Trends and performance" },
  "/goals":     { title: "Goals",      subtitle: "Track your targets" },
  "/reports":   { title: "Reports",    subtitle: "Export and review your data" },
  "/settings":  { title: "Settings",   subtitle: "Account and preferences" },
};

export function Header() {
  const pathname = usePathname();
  const { profile } = useAppStore();
  const meta = Object.entries(PAGE_META).find(([p]) => pathname === p || pathname.startsWith(p + "/"))?.[1]
    ?? { title: "Comma", subtitle: "" };

  const initials = profile?.displayName
    ? (profile.displayName as string).split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
    : "C";

  return (
    <header
      className="flex h-14 items-center gap-3 shrink-0 px-4 lg:px-6"
      style={{
        backgroundColor: "hsl(var(--card))",
        borderBottom: "1px solid hsl(var(--border))",
        position: "sticky",
        top: 0,
        zIndex: 20,
      }}
    >
      {/* Left — logo on mobile / page title on desktop */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Logo mark — mobile only */}
        <div className="flex items-center gap-2 lg:hidden">
          <Image src="/logo.png" alt="Comma" width={26} height={26} className="rounded-lg" />
          <span className="text-sm font-bold" style={{ color: "hsl(var(--foreground))" }}>
            {meta.title}
          </span>
        </div>
        {/* Page title — desktop only */}
        <div className="hidden lg:block">
          <h1 className="text-sm font-bold leading-tight" style={{ color: "hsl(var(--foreground))" }}>
            {meta.title}
          </h1>
          {meta.subtitle && (
            <p className="text-[11px] leading-tight" style={{ color: "hsl(var(--muted-foreground))" }}>
              {meta.subtitle}
            </p>
          )}
        </div>
      </div>

      {/* Centre — platform switcher (flex-1 so it fills available space) */}
      <div className="flex flex-1 items-center justify-end lg:justify-center">
        <PlatformSwitcher />
      </div>

      {/* Right — display name + avatar */}
      <div className="flex items-center gap-2 shrink-0">
        {profile?.displayName && (
          <span className="hidden lg:block text-xs font-medium" style={{ color: "hsl(var(--muted-foreground))" }}>
            {profile.displayName as string}
          </span>
        )}
        <div
          className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold flex-shrink-0"
          style={{
            backgroundColor: "color-mix(in srgb, hsl(var(--primary)) 20%, hsl(var(--accent)))",
            color: "hsl(var(--primary))",
          }}
        >
          {initials}
        </div>
      </div>
    </header>
  );
}
