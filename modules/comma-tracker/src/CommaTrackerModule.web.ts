import { registerWebModule, NativeModule } from 'expo';

class CommaTrackerModule extends NativeModule {
  startTracking() {
    return false;
  }
  stopTracking() {}
  requestBatteryOptimizationExemption() {}
  hasOverlayPermission() {
    return false;
  }
  requestOverlayPermission() {}
  setDistanceUnit(_unit: string) {}
}

export default registerWebModule(CommaTrackerModule, 'CommaTrackerModule');
