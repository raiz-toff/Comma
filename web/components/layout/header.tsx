"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppStore } from "@/store/useAppStore";
import { PlatformSwitcher } from "./platform-switcher";
import { Clock, Receipt, FileText, Settings, Bell } from "lucide-react";
import { useEffect, useState, type ElementType } from "react";

// Live clock — hidden below 768px per layout spec
function LiveClock() {
  const [time, setTime] = useState("");
  useEffect(() => {
    const tick = () =>
      setTime(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    tick();
    const id = setInterval(tick, 10_000);
    return () => clearInterval(id);
  }, []);
  if (!time) return null;
  return (
    <span
      className="hidden min-[768px]:inline-flex items-center text-[11px] font-semibold tabular-nums"
      style={{ color: "hsl(var(--muted-foreground))" }}
    >
      {time}
    </span>
  );
}

// Action button: 34×34 circle below 1200px; pill with text label at 1200px+
function ActionBtn({
  icon: Icon, label, href,
}: {
  icon: ElementType; label: string; href: string;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(href + "/");
  return (
    <Link
      href={href}
      aria-label={label}
      // Below 1200px: fixed 34×34 circle. At 1200px+: auto-width pill with padding.
      className="flex items-center justify-center gap-1.5 h-[34px] w-[34px] min-[1200px]:w-auto min-[1200px]:px-3 rounded-full border shrink-0 transition-colors"
      style={{
        backgroundColor: active
          ? "color-mix(in srgb, hsl(var(--primary)) 14%, hsl(var(--accent)))"
          : "hsl(var(--accent))",
        borderColor: active ? "color-mix(in srgb, hsl(var(--primary)) 30%, hsl(var(--border)))" : "hsl(var(--border))",
        color: active ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))",
      }}
    >
      <Icon size={15} strokeWidth={active ? 2.3 : 1.8} className="shrink-0" />
      <span className="hidden min-[1200px]:inline text-[11px] font-bold whitespace-nowrap">
        {label}
      </span>
    </Link>
  );
}

// Icon-only button (always circular, never shows text)
function IconBtn({
  icon: Icon, href, label,
}: {
  icon: ElementType; href: string; label: string;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(href + "/");
  return (
    <Link
      href={href}
      aria-label={label}
      className="flex items-center justify-center h-[34px] w-[34px] rounded-full border shrink-0 transition-colors"
      style={{
        backgroundColor: active
          ? "color-mix(in srgb, hsl(var(--primary)) 14%, hsl(var(--accent)))"
          : "hsl(var(--accent))",
        borderColor: active ? "color-mix(in srgb, hsl(var(--primary)) 30%, hsl(var(--border)))" : "hsl(var(--border))",
        color: active ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))",
      }}
    >
      <Icon size={15} strokeWidth={active ? 2.3 : 1.8} />
    </Link>
  );
}

export function Header() {
  const { profile } = useAppStore();

  const initials = profile?.displayName
    ? (profile.displayName as string)
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "C";

  return (
    /*
     * Slot order: avatar → platform-switcher → spacer → action-btns → clock → notifications → settings
     *
     * Stickiness: not sticky below lg (1024px) — body scrolls naturally.
     *             sticky at lg+ — only app-main scrolls.
     */
    <header
      className="flex h-14 shrink-0 items-center gap-2 px-3 min-[480px]:gap-3 min-[480px]:px-4 lg:px-5 lg:sticky lg:top-0 lg:z-20"
      style={{
        backgroundColor: "hsl(var(--card))",
        borderBottom: "1px solid hsl(var(--border))",
      }}
    >
      {/* 1. Avatar — user initials, left anchor */}
      <div
        className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold shrink-0"
        style={{
          backgroundColor: "color-mix(in srgb, hsl(var(--primary)) 20%, hsl(var(--accent)))",
          color: "hsl(var(--primary))",
        }}
      >
        {initials}
      </div>

      {/* 2. Platform switcher */}
      <PlatformSwitcher />

      {/* 3. Spacer */}
      <div className="flex-1 min-w-0" />

      {/* 4. Action buttons — Shifts (Cal), Expenses, Reports */}
      <div className="flex items-center gap-1 min-[480px]:gap-1.5">
        <ActionBtn icon={Clock}    label="Shifts"   href="/shifts"   />
        <ActionBtn icon={Receipt}  label="Expenses" href="/expenses" />
        <ActionBtn icon={FileText} label="Reports"  href="/reports"  />
      </div>

      {/* 5. Clock — hidden below 768px */}
      <LiveClock />

      {/* 6. Notifications (placeholder — no notification system yet) */}
      <button
        aria-label="Notifications"
        className="hidden min-[480px]:flex items-center justify-center h-[34px] w-[34px] rounded-full border shrink-0 transition-colors"
        style={{
          backgroundColor: "hsl(var(--accent))",
          borderColor: "hsl(var(--border))",
          color: "hsl(var(--muted-foreground))",
          cursor: "default",
          opacity: 0.5,
        }}
        disabled
      >
        <Bell size={15} strokeWidth={1.8} />
      </button>

      {/* 7. Settings */}
      <IconBtn icon={Settings} href="/settings" label="Settings" />
    </header>
  );
}
