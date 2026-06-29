import { NativeModule, requireNativeModule } from 'expo';

declare class CommaTrackerModule extends NativeModule {
  /** Returns false if the service could not start (permission missing or background start refused). */
  startTracking(): boolean;
  stopTracking(): void;
  requestBatteryOptimizationExemption(): void;
  /** "Display over other apps" special-access permission (for the floating live-shift overlay). */
  hasOverlayPermission(): boolean;
  requestOverlayPermission(): void;
  /** Tell the native overlay which unit to render miles in ("mi" | "km"). */
  setDistanceUnit(unit: string): void;
  /** Push the live shift timing so the overlay clock mirrors the in-app timer (pause-aware). */
  setShiftTiming(startTimeMs: number, pausedSeconds: number, isPaused: boolean, frozenElapsed: number): void;
  /** True (once) if the user tapped the floating pill to open the shift console. */
  consumeOpenConsole(): boolean;
}

export default requireNativeModule<CommaTrackerModule>('CommaTracker');
