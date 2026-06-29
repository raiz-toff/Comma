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
}

export default requireNativeModule<CommaTrackerModule>('CommaTracker');
