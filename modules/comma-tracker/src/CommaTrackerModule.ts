import { NativeModule, requireNativeModule } from 'expo';

declare class CommaTrackerModule extends NativeModule {
  /** Returns false if the service could not start (permission missing or background start refused). */
  startTracking(): boolean;
  stopTracking(): void;
  requestBatteryOptimizationExemption(): void;
}

export default requireNativeModule<CommaTrackerModule>('CommaTracker');
