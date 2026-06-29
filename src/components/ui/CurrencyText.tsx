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
  
  // Resolve currency from registry-derived locale (set when country changes).
  const currency =
    profile?.locale?.currency ||
    (profile?.country === "US" ? "USD" : profile?.country === "UK" ? "GBP" : "CAD");
  const locale =
    profile?.locale?.currency ? undefined
    : profile?.country === "US" ? "en-US" : "en-CA";


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

  // Comma DS semantic money colors: Success when positive, Danger when negative, muted at zero.
  const colorClass = amount > 0
    ? "text-success"
    : amount < 0
    ? "text-destructive"
    : "text-content-muted";

  const sizeClasses = {
    sm: "text-label-m",
    md: "text-paragraph-m font-semibold",
    lg: "text-heading-s font-semibold",
    xl: "text-heading-l font-bold",
  };

  return (
    <Text
      className={cn(colorClass, sizeClasses[size], className)}
      variant={variant}
      tabular
      {...props}
    >
      {formatted}
    </Text>
  );
}
