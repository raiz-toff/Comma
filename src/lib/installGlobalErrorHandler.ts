/**
 * Lightweight global crash logger — no SDK, account, or DSN required.
 *
 * Captures uncaught JS errors (and, where supported, unhandled promise rejections) so they
 * are at least logged with a stable tag. When you later wire a crash service, replace the
 * body of `report()` with e.g. `Sentry.captureException(error)` and everything else keeps
 * working.
 */
let installed = false;

export function installGlobalErrorHandler(): void {
  if (installed) return;
  installed = true;

  const report = (error: unknown, isFatal?: boolean) => {
    // Swap for Sentry.captureException(error) / crashlytics().recordError(error) later.
    console.error(`[GlobalError]${isFatal ? " FATAL" : ""}`, error);
  };

  const g = globalThis as any;

  // 1. Uncaught JS errors via React Native's ErrorUtils, chaining the previous handler
  //    (which surfaces the red box in dev) so we don't suppress existing behavior.
  if (g?.ErrorUtils?.setGlobalHandler) {
    const previous = g.ErrorUtils.getGlobalHandler?.();
    g.ErrorUtils.setGlobalHandler((error: any, isFatal?: boolean) => {
      report(error, isFatal);
      previous?.(error, isFatal);
    });
  }

  // 2. Unhandled promise rejections, where the runtime exposes the DOM-style event.
  if (typeof g?.addEventListener === "function") {
    g.addEventListener("unhandledrejection", (event: any) => {
      report(event?.reason ?? event, false);
    });
  }
}
