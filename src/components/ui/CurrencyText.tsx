import * as React from "react";
import { Text } from "./text";
import { cn } from "@/src/lib/utils";
import { useSettingsStore } from "@/store/useSettingsStore";

export interface CurrencyTextProps {
  amount: number;
  size?: "sm" | "md" | "lg" | "xl";
  showSign?: boolean;
  className?: string;
  variant?: React.ComponentProps<typeof Text>["variant"];
}

export function CurrencyText({
  amount,
  size = "md",
  showSign = false,
  className,
  variant,
  ...props
}: CurrencyTextProps & Omit<React.ComponentProps<typeof Text>, "children">) {
  const profile = useSettingsStore((state) => state.profile);
  
  // Resolve currency. In the future, currency might be in the profile or setting KV.
  // We check for any explicit override, falling back to country-based detection.
  const currency = (profile as any)?.currency || (profile?.country === "US" ? "USD" : "CAD");
  const locale = profile?.country === "US" ? "en-US" : "en-CA";

  const formatted = React.useMemo(() => {
    try {
      const formatter = new Intl.NumberFormat(locale, {
        style: "currency",
        currency: currency,
        signDisplay: showSign ? "always" : "auto",
      });
      return formatter.format(amount);
    } catch (e) {
      // Fallback in case of invalid locale/currency configuration
      const prefix = currency === "USD" ? "$" : "CA$";
      const sign = amount < 0 ? "-" : showSign && amount > 0 ? "+" : "";
      return `${sign}${prefix}${Math.abs(amount).toFixed(2)}`;
    }
  }, [amount, currency, locale, showSign]);

  const colorClass = amount > 0 
    ? "text-emerald-500" 
    : amount < 0 
    ? "text-rose-500" 
    : "text-slate-500";

  const sizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-lg font-semibold",
    xl: "text-2xl font-bold",
  };

  return (
    <Text
      className={cn(colorClass, sizeClasses[size], className)}
      variant={variant}
      {...props}
    >
      {formatted}
    </Text>
  );
}
