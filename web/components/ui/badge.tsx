import * as React from "react";
import { cn } from "@/lib/utils";

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "success" | "warning" | "destructive" | "muted";
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-pill px-2 py-0.5 text-xs font-semibold",
        {
          "bg-primary/20 text-primary": variant === "default",
          "bg-green-500/20 text-green-400": variant === "success",
          "bg-yellow-500/20 text-yellow-400": variant === "warning",
          "bg-destructive/20 text-destructive": variant === "destructive",
          "bg-surface-04 text-content-muted": variant === "muted",
        },
        className
      )}
      {...props}
    />
  );
}
